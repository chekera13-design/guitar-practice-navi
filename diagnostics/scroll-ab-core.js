// 診断ページ専用。時計・RAF・音声・スクロールへの書き込みを持たない。
const CAPACITY = 8192;
const summarize = values => {
    const sorted = Array.from(values).sort((a, b) => a - b);
    const n = sorted.length;
    return { samples: n, median: n ? sorted[Math.floor((n - 1) * 0.5)] : null,
        p95: n ? sorted[Math.ceil(n * 0.95) - 1] : null, max: n ? sorted[n - 1] : null };
};

export class ScrollABCapture {
    constructor(condition, metadata, notify = () => {}, clock = () => performance.now()) {
        if (!['A', 'B'].includes(condition)) throw new Error('A/B以外の条件はありません');
        this.condition = condition;
        this.metadata = metadata;
        this.notify = notify;
        this.clock = clock;
        this.phase = 'armed';
        this.reasons = [];
        this.rows = 0;
        this.dimensionSamples = 0;
        this.widthReads = { clientWidth: 0, scrollWidth: 0 };
        this.changed = 0;
        this.distance = 0;
        this.netDistance = 0;
        this.maxStep = 0;
        this.scrollLeftReads = 0;
        this.rafGaps = { over25ms: 0, over50ms: 0, over100ms: 0, over250ms: 0 };
        this.intervals = new Float64Array(CAPACITY);
        this.callbacks = new Float64Array(CAPACITY);
        this.dimensionTimes = new Float64Array(CAPACITY);
        this.clockDeltas = new Float64Array(CAPACITY);
        this.before = null;
        this.first = null;
        this.endBoundary = null;
        this.measuring = false;
        this.sampleDimensions = false;
        this.started = false;
        this.stopped = false;
    }

    start(context) {
        if (this.started) { this.invalidate('scroll-restarted-or-rendered'); return null; }
        if (this.phase !== 'armed') return null;
        this.started = true;
        this.context = context;
        this.wrapper = context.wrapper;
        if (!context.audioClock || context.restoreImmediately || context.beatSec !== 1 ||
            context.beatsPerBar !== 4 || context.repeatCount !== 1 ||
            context.totalBars * context.beatsPerBar * context.beatSec <= 33) {
            this.invalidate('requires-first-lap-EX5-60BPM-4/4-repeat1-audio-clock');
            return null;
        }
        this.phase = 'waiting';
        this.notify(this.phase);
        return this;
    }

    beginFrame(now, audio, display) {
        this.measuring = false;
        this.sampleDimensions = false;
        if (!['waiting', 'measuring'].includes(this.phase)) return;
        if (!Number.isFinite(now) || !Number.isFinite(audio) || !Number.isFinite(display) || audio < 0) {
            this.invalidate('invalid-or-count-in-audio-time'); return;
        }
        if (this.previousNow !== undefined && (now < this.previousNow || audio < this.previousAudio)) {
            this.clockAnomaly = { previousNow: this.previousNow, now, previousAudio: this.previousAudio, audio };
            this.invalidate('clock-rewind'); return;
        }
        const previousNow = this.previousNow, previousAudio = this.previousAudio;
        this.previousNow = now;
        this.previousAudio = audio;
        if (audio < 3) return;
        if (!this.first) {
            if (previousNow === undefined || previousAudio >= 3 || audio >= 33) {
                this.invalidate('audio-window-start-missed'); return;
            }
            this.before = { now: previousNow, audio: previousAudio };
            this.first = { now, audio };
            this.previousPosition = this.wrapper.scrollLeft;
            this.initialPosition = this.previousPosition;
            this.scrollLeftReads++;
            this.phase = 'measuring';
            this.notify(this.phase);
        }
        if (audio >= 33) {
            this.endBoundary = { now, audio, rafIntervalMs: now - previousNow,
                audioGapSeconds: audio - previousAudio };
            this.phase = 'captured';
            this.notify(this.phase);
            return;
        }
        if (this.rows >= CAPACITY) { this.invalidate('sample-capacity-exceeded'); return; }
        this.measuring = true;
        this.sampleDimensions = this.rows % 8 === 0;
        this.intervals[this.rows] = now - previousNow;
        this.clockDeltas[this.rows] = (display - audio) * 1000;
        const interval = now - previousNow;
        if (interval > 25) this.rafGaps.over25ms++;
        if (interval > 50) this.rafGaps.over50ms++;
        if (interval > 100) this.rafGaps.over100ms++;
        if (interval > 250) this.rafGaps.over250ms++;
        this.lastNow = now;
        this.lastAudio = audio;
    }

    afterDimensions(start, scrollWidthReads, clientWidthReads) {
        this.widthReads.scrollWidth += scrollWidthReads;
        this.widthReads.clientWidth += clientWidthReads;
        if (this.sampleDimensions) this.dimensionTimes[this.dimensionSamples++] = this.clock() - start;
    }

    afterWrite(actual) {
        this.scrollLeftReads++;
        const delta = actual - this.previousPosition;
        if (delta !== 0) this.changed++;
        this.distance += Math.abs(delta);
        this.netDistance += delta;
        this.maxStep = Math.max(this.maxStep, Math.abs(delta));
        this.previousPosition = actual;
    }

    endFrame(duration) {
        this.callbacks[this.rows++] = duration;
    }

    invalidate(reason) {
        if (this.stopped) return;
        if (!this.reasons.includes(reason)) this.reasons.push(reason);
        this.phase = 'invalid';
        this.measuring = false;
        this.sampleDimensions = false;
        this.notify(this.phase);
    }

    stop(reason) {
        if (this.stopped) return;
        if (this.phase !== 'captured') this.invalidate(reason || 'stopped-before-33s');
        this.stopReason = reason;
        this.stopped = true;
        this.measuring = false;
        this.sampleDimensions = false;
        this.notify('stopped');
    }

    result() {
        if (!this.stopped) throw new Error('練習停止後に集計してください');
        return { schema: 'tab-scroll-ab-v1', createdAt: new Date().toISOString(),
            condition: this.condition, validComparison: this.reasons.length === 0 && !!this.endBoundary,
            invalidReasons: [...this.reasons], clockAnomaly: this.clockAnomaly || null,
            startReason: 'audio-elapsed-crosses-3s',
            endReason: this.endBoundary ? 'audio-elapsed-crosses-33s' : this.stopReason,
            stopReason: this.stopReason, metadata: this.metadata,
            window: { requestedAudioSeconds: [3, 33], requestedDurationSeconds: 30,
                previousFrame: this.before, firstSample: this.first,
                lastSample: this.rows ? { now: this.lastNow, audio: this.lastAudio } : null,
                endBoundary: this.endBoundary,
                sampledAudioSpanSeconds: this.rows && this.first ? this.lastAudio - this.first.audio : 0,
                startOvershootMs: this.first ? (this.first.audio - 3) * 1000 : null,
                endOvershootMs: this.endBoundary ? (this.endBoundary.audio - 33) * 1000 : null },
            raf: { count: this.rows, intervalMs: summarize(this.intervals.subarray(0, this.rows)),
                callbackMs: summarize(this.callbacks.subarray(0, this.rows)), gaps: this.rafGaps },
            scroll: { writes: this.rows, changed: this.changed, unchanged: this.rows - this.changed,
                unchangedRatio: this.rows ? (this.rows - this.changed) / this.rows : null,
                totalDistancePx: this.distance, netDistancePx: this.netDistance, maxStepPx: this.maxStep,
                initialPositionPx: this.initialPosition ?? null, finalPositionPx: this.previousPosition ?? null,
                additionalScrollLeftReads: this.scrollLeftReads },
            dimensions: { reads: this.widthReads, sampleEveryFrames: 8,
                expressionBlockMs: summarize(this.dimensionTimes.subarray(0, this.dimensionSamples)) },
            displayMinusAudioMs: summarize(this.clockDeltas.subarray(0, this.rows)),
            limitations: [
                'RAF観測頻度は画面提示FPSではない。GPU負荷・Paint/Composite時間を確定しない。',
                '区間内の各書き込み直後にscrollLeftを1回追加取得。区間開始時にも1回取得。読み取り負荷を含む。',
                'callbackMsは既存RAF本体＋診断記録＋追加scrollLeft取得を含み、末尾の記録代入だけを含まない。',
                '寸法時間は8フレーム毎、既存3式の幅取得と算術を含む。各getter単体の時間ではない。',
                '3秒と33秒の境界を挟んだRAFで区間を確認。観測サンプルの時刻幅・境界超過量・終了境界へのRAF間隔を別途記録。',
                '音声の予約・RAF・スクロール計算と書き込みは通常のまま。集計は停止後のみ。'
            ] };
    }
}
