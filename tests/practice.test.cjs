const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { syncMetronomeBeatDisplay } = require(path.join(__dirname, 'helpers/rhythm-display.cjs'));
const { createPracticeProgress } = require(path.join(__dirname, 'helpers/practice-progress.cjs'));

// 実際の練習・録音処理を、制御できる音声時刻とRecorderで検証する。
const app = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
const sequence = app.slice(app.indexOf('function showPracticeStatus('), app.indexOf('// ★ 簡易チューナー'));
const scoreGate = app.slice(app.indexOf('function isScoreReadyForPractice('), app.indexOf('function setScoreLoadState('));

function element(hidden = false) {
    const classes = new Set(hidden ? ['hidden'] : []);
    return {
        classList: { contains: c => classes.has(c), add: (...cs) => cs.forEach(c => classes.add(c)),
            remove: (...cs) => cs.forEach(c => classes.delete(c)),
            toggle(c, value) { if (value) classes.add(c); else classes.delete(c); } },
        disabled: false, hidden, innerText: '', value: '1', scrollLeft: 0, dataset: {},
        pause() {}, load() {}, removeAttribute(key) { delete this[key]; },
        setAttribute(key, value) { this[key] = value; },
        scrollIntoView() {}, scrollTo() {}, querySelector() { return this; }
    };
}

function harness(options = {}) {
    let timerId = 0;
    const timers = new Map(), ticks = [], bars = [], phases = [], recorders = [], urls = [], revoked = [];
    const streams = [];
    let micRequests = 0;
    const context = { syncMetronomeBeatDisplay, practiceProgress: createPracticeProgress({}, () => null),
        isPracticing: false, isStartingPractice: false, isFinalizingRecording: false,
        isStandaloneMetroPlaying: false, isStartingStandaloneMetro: false,
        guideVideo: { close() {}, setDisabled() {} },
        practiceStartGeneration: 0, practiceSession: null, pendingPracticeMode: null,
        practiceTimerIds: [], recordingSession: null, recordingGeneration: 0,
        recordedAudioUrl: null, microphoneStream: null,
        scoreLoadState: 'ready', isScoreRendered: true, scoreRenderGeneration: 1,
        currentBpm: options.bpm || 60, currentStage: { timeSignature: [4, 4], countInBars: 1 }, api: {},
        practiceModal: element(), mainActionBtn: element(), recordPracticeBtn: element(),
        practiceRepeatSelect: element(), practiceStatus: element(), recordResultCard: element(true),
        recordedAudioPlayer: element(), visualMetronomeBox: element(), standaloneMetroBtn: element(),
        retryScoreBtn: element(),
        modalTempoDownBtn: element(), modalTempoUpBtn: element(), modalBpmBadge: element(),
        audioContext: { currentTime: 0 }, Blob,
        console: { warn() {} }, window: {},
        setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, time: context.audioContext.currentTime + ms / 1000 }); return id; },
        clearTimeout(id) { timers.delete(id); },
        document: { querySelector: () => context.wrapper },
        URL: { createObjectURL(blob) { urls.push(blob); return 'blob:' + urls.length; }, revokeObjectURL(url) { revoked.push(url); } },
        unlockAudioContext: async () => { if (options.audioFail) throw new Error('audio failure'); },
        requestWakeLock: async () => {}, releaseWakeLock() {},
        setupMicrophoneStream: async () => { if (options.prepareFail) throw new Error("microphone preparation failed"); }, stopMicrophoneStream() {},
        stopTuner() {}, stopStandaloneMetronome() {}, collapseVolumeBar() {},
        getStagePracticeBars: () => options.bars || 4, buildScoreBarLayouts() { return true; },
        resetPracticeBar() { bars.push(0); }, setPracticeBar(bar) { bars.push(bar); },
        scheduleTick(time, accent) { ticks.push({ time, accent }); }, stopAllScheduledTicks() {},
        resetVisualMetronome() {}, stopScoreContinuousScroll() {}, resetScoreFocusState() {},
        markTutorialCompleted() {},
        startScoreContinuousScroll(config) { context.scrollConfig = config; },
        updateVisualMetronome(beat, accent, text, phase) { phases.push({ beat, text, phase }); },
        updateHighlightBar() {}, setPlayFinishedVisual() {},
        shouldUseVerticalTabLayout: () => true, isPracticeModalLandscape: () => false,
        requestPracticeModalInitialPosition() {},
        bindButtonActivation(button, fn) { button.activate = fn; }
    };
    context.wrapper = element();
    const makeStream = () => {
        const track = { readyState: 'live', stop() { this.readyState = 'ended'; } };
        const stream = { getTracks: () => [track] }; streams.push(stream); return stream;
    };
    context.navigator = { mediaDevices: { getUserMedia: async () => {
        micRequests++;
        if (options.micPromise) return options.micPromise;
        if (options.micFail) throw new Error('permission denied');
        return makeStream();
    } } };
    class Recorder {
        static isTypeSupported() { return true; }
        constructor(stream) {
            if (options.constructFail) throw new Error('construct failed');
            this.state = 'inactive'; this.mimeType = 'audio/webm'; this.stream = stream;
            this.startCalls = 0;
            recorders.push(this);
        }
        start() {
            this.startCalls++;
            if (options.startFail) throw new Error('start failed');
            this.state = 'recording'; this.startTime = context.audioContext.currentTime;
        }
        stop() {
            if (options.stopFail) throw new Error('stop failed');
            this.state = 'inactive'; this.stopTime = context.audioContext.currentTime;
            if (!options.delayedStop) this.deliver();
        }
        deliver(data = 'recording') {
            if (!options.noData) this.ondataavailable?.({ data: new Blob([data]) });
            this.onstop?.();
        }
    }
    context.window.MediaRecorder = context.MediaRecorder = options.unsupported ? undefined : Recorder;
    function prepareScore() {
        context.api.score = { masterBars: Array(options.bars || 4).fill({}) };
        const partials = [{ svg: { isConnected: true } }];
        context.scorePartialState = { validatedPartials: partials };
        context.preparedScore = { generation: context.scoreRenderGeneration,
            stage: context.currentStage, api: context.api, bars: options.bars || 4, partials };
    }
    prepareScore();
    vm.createContext(context);
    vm.runInContext(scoreGate + sequence, context);
    function advance(to) {
        let safety = 0;
        while (true) {
            let next = null;
            for (const [id, timer] of timers) if (timer.time <= to + 1e-8 && (!next || timer.time < next.timer.time)) next = { id, timer };
            if (!next) break;
            assert.ok(++safety < 100000, 'timer loop terminates');
            timers.delete(next.id); context.audioContext.currentTime = next.timer.time; next.timer.fn();
        }
        context.audioContext.currentTime = to;
    }
    return { context, advance, timers, ticks, bars, phases, recorders, urls, revoked, streams,
        makeStream, micRequests: () => micRequests, options, prepareScore };
}

for (const repeats of [1, 3, 5]) {
    test('非録音練習 ' + repeats + ' 回：カウントイン1回・連続したクリック・先頭へ戻る', async () => {
        const h = harness(), c = h.context;
        c.practiceRepeatSelect.value = String(repeats);
        await c.startPractice('practice');
        h.advance(4.31);
        assert.equal(c.practiceStatus.hidden, true);
        assert.equal(c.practiceRepeatSelect.hidden, true);
        h.advance(0.3 + 4 + 16 * repeats + 0.1);
        assert.equal(c.isPracticing, false);
        assert.equal(h.ticks.length, 4 + 16 * repeats);
        for (let i = 1; i < h.ticks.length; i++) assert.ok(Math.abs(h.ticks[i].time - h.ticks[i - 1].time - 1) < 1e-8);
        assert.equal(h.phases.filter(p => p.phase === 'count-in').length, 4);
        const barChanges = h.bars.filter((bar, i, all) => i === 0 || bar !== all[i - 1]);
        assert.deepEqual(barChanges, Array.from({ length: repeats * 4 }, (_, i) => i % 4));
        assert.equal(h.micRequests(), 0); assert.equal(h.recorders.length, 0);
        assert.equal(h.timers.size, 0);
        assert.equal(c.practiceSession, null);
        assert.equal(c.practiceRepeatSelect.hidden, false);
        assert.equal(c.practiceStatus.hidden, true);
        assert.equal(c.recordResultCard.classList.contains('hidden'), true);
    });
}

test('無制限・途中停止：1本のタイマーで継続し、次回は先頭から', async () => {
    const h = harness(), c = h.context;
    c.practiceRepeatSelect.value = 'unlimited';
    await c.startPractice(); h.advance(80);
    assert.equal(c.isPracticing, true); assert.equal(h.timers.size, 1);
    assert.match(h.phases.at(-1).text, /練習 5\/∞/);
    assert.equal(c.practiceStatus.hidden, true);
    c.stopPractice(); assert.equal(h.timers.size, 0); assert.equal(c.practiceSession, null);
    c.practiceRepeatSelect.value = '1';
    await c.startPractice(); h.advance(84.4);
    assert.match(h.phases.at(-1).text, /練習 1\/1/);
    assert.equal(h.bars.at(-1), 0);
    assert.equal(c.practiceStatus.hidden, true);
    assert.equal(h.micRequests(), 0);
});

test('録音は常に1回：最終カウント拍から録音し、既存の余韻タイミング後に有効な結果のみ表示', async () => {
    const h = harness(), c = h.context;
    c.practiceRepeatSelect.value = '5';
    await c.startPractice('record'); h.advance(3.29);
    assert.equal(h.recorders[0].state, 'inactive');
    h.advance(3.31); assert.ok(Math.abs(h.recorders[0].startTime - 3.3) < 1e-8);
    h.advance(23.31); assert.ok(Math.abs(h.recorders[0].stopTime - 23.3) < 1e-8);
    assert.equal(c.recordResultCard.classList.contains('hidden'), true);
    h.advance(24.41);
    assert.equal(h.ticks.length, 20); assert.equal(c.isPracticing, false);
    assert.equal(c.isFinalizingRecording, false);
    assert.equal(c.recordResultCard.classList.contains('hidden'), false);
    assert.equal(c.recordedAudioPlayer.src, 'blob:1');
    assert.equal(await h.urls[0].text(), 'recording');
    assert.ok(h.streams.every(s => s.getTracks()[0].readyState === 'ended'));
    assert.equal(h.timers.size, 0);
});

test('遅いstopイベント：録音確定までは成功カードを出さず操作を戻さない', async () => {
    const h = harness({ delayedStop: true }), c = h.context;
    await c.startPractice('record'); h.advance(24.41);
    assert.equal(c.isFinalizingRecording, true); assert.equal(c.mainActionBtn.disabled, true);
    assert.equal(c.recordResultCard.classList.contains('hidden'), true);
    h.recorders[0].deliver();
    assert.equal(c.isFinalizingRecording, false); assert.equal(c.mainActionBtn.disabled, false);
    assert.equal(c.recordResultCard.classList.contains('hidden'), false);
});

test('閉じて別EXを録音：保存済みの古いイベントを遅延配送しても混ざらない', async () => {
    const h = harness({ delayedStop: true }), c = h.context;
    await c.startPractice('record'); h.advance(4.4);
    const old = h.recorders[0], oldData = old.ondataavailable, oldStop = old.onstop, oldError = old.onerror;
    c.stopPractice(); c.practiceModal.classList.add('hidden');
    c.practiceModal.classList.remove('hidden'); c.currentStage = { timeSignature: [3, 4], countInBars: 1 };
    h.prepareScore();
    await c.startPractice('record');
    oldData({ data: new Blob(['OLD']) }); oldStop(); oldError({ error: new Error('old error') });
    assert.equal(c.isPracticing, true); assert.equal(c.recordingSession.chunks.length, 0);
    h.advance(22.8); h.recorders[1].deliver('NEW');
    assert.equal(c.recordResultCard.classList.contains('hidden'), false);
    assert.equal(await h.urls[0].text(), 'NEW');
});

for (const failure of ['constructFail', 'prepareFail', 'startFail', 'stopFail', 'noData', 'unsupported', 'micFail']) {
    test('録音失敗から復帰：' + failure, async () => {
        const h = harness({ [failure]: true }), c = h.context;
        await c.startPractice('record'); h.advance(25);
        assert.equal(c.isPracticing, false); assert.equal(c.isStartingPractice, false);
        assert.equal(c.isFinalizingRecording, false); assert.equal(c.recordingSession, null);
        assert.equal(c.mainActionBtn.disabled, false); assert.equal(c.recordPracticeBtn.disabled, false);
        assert.equal(c.recordResultCard.classList.contains('hidden'), true);
        assert.equal(h.urls.length, 0); assert.equal(h.timers.size, 0);
        assert.ok(h.streams.every(s => s.getTracks()[0].readyState === 'ended'));
        assert.equal(c.practiceStatus.classList.contains('is-error'), true);
        h.options[failure] = false;
        await c.startPractice('practice'); assert.equal(c.isPracticing, true);
    });
}

test('Recorderの非同期errorとstopイベント未到着も復帰する', async () => {
    for (const cause of ['error', 'timeout']) {
        const h = harness({ delayedStop: true }), c = h.context;
        await c.startPractice('record'); h.advance(5);
        if (cause === 'error') h.recorders[0].onerror({ error: new Error('encoder error') });
        else h.advance(29);
        assert.equal(c.isPracticing, false); assert.equal(c.isFinalizingRecording, false);
        assert.equal(c.recordingSession, null); assert.equal(h.timers.size, 0);
        assert.equal(c.recordPracticeBtn.disabled, false);
    }
});

test('予定外の録音停止を成功として扱わない', async () => {
    const h = harness(), c = h.context;
    await c.startPractice('record'); h.advance(5);
    h.recorders[0].deliver();
    assert.equal(c.isPracticing, false); assert.equal(c.recordingSession, null);
    assert.equal(c.recordResultCard.classList.contains('hidden'), true);
    assert.equal(c.recordPracticeBtn.disabled, false); assert.equal(h.timers.size, 0);
});

test('マイク許可待ちで閉じた後、新しい練習に遅いマイクを渡さない', async () => {
    let resolve;
    const h = harness({ micPromise: new Promise(r => { resolve = r; }) }), c = h.context;
    const pending = c.startPractice('record');
    await new Promise(r => setImmediate(r));
    assert.equal(c.isStartingPractice, true);
    c.stopPractice(); await c.startPractice('practice');
    const stream = h.makeStream(); resolve(stream); await pending;
    assert.equal(stream.getTracks()[0].readyState, 'ended');
    assert.equal(c.practiceSession.mode, 'practice'); assert.equal(h.recorders.length, 0);
});

test('音声初期化失敗から再試行できる', async () => {
    const h = harness({ audioFail: true }), c = h.context;
    await c.startPractice(); assert.equal(c.isStartingPractice, false);
    assert.equal(c.mainActionBtn.disabled, false); assert.equal(h.micRequests(), 0);
    h.options.audioFail = false; await c.startPractice(); assert.equal(c.isPracticing, true);
});

test('BPMを共通の音声時刻へ反映し、向き変更でスクロールを復元しても周回を維持', async () => {
    const h = harness({ bpm: 120 }), c = h.context;
    c.practiceRepeatSelect.value = '3'; await c.startPractice(); h.advance(11);
    c.resumePracticeScroll();
    assert.equal(c.scrollConfig.beatSec, 0.5); assert.equal(c.scrollConfig.repeatCount, 3);
    assert.ok(Math.abs(c.scrollConfig.getElapsedSeconds() - 8.7) < 1e-8);
    assert.match(h.phases.at(-1).text, /練習 2\/3/);
    assert.equal(c.practiceStatus.hidden, true);
    for (let i = 1; i < h.ticks.length; i++) assert.ok(Math.abs(h.ticks[i].time - h.ticks[i - 1].time - 0.5) < 1e-8);
});

test('実際の横譜スクロール：AudioContext相当の時刻で周回しRAFは1本、停止で解除', () => {
    const ui = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8').replace(/export /g, '');
    const wrapper = { clientWidth: 200, scrollWidth: 1200, scrollLeft: 0 };
    let elapsed = 0, next = 0;
    const frames = new Map(), progress = [];
    const c = { document: { querySelector: () => wrapper, getElementById: () => null },
        performance: { now: () => 0 }, requestAnimationFrame(fn) { frames.set(++next, fn); return next; },
        cancelAnimationFrame(id) { frames.delete(id); } };
    vm.createContext(c); vm.runInContext(ui, c);
    vm.runInContext('cachedBarLayouts = Array.from({length: 4}, (_, i) => ({left: i * 260, width: 260})); cachedScoreEndX = 1040;', c);
    c.startScoreContinuousScroll({ totalBars: 4, beatSec: 1, repeatCount: 3, getElapsedSeconds: () => elapsed,
        onProgress: bar => progress.push(bar) });
    const frameAt = time => { elapsed = time; const [id, fn] = frames.entries().next().value; frames.delete(id); fn(999999); };
    frameAt(15.9); assert.equal(progress.at(-1), 3); assert.ok(wrapper.scrollLeft > 500);
    frameAt(16); assert.equal(progress.at(-1), 0); assert.equal(wrapper.scrollLeft, 0);
    frameAt(32); assert.equal(progress.at(-1), 0); assert.equal(frames.size, 1);
    c.stopScoreContinuousScroll(); assert.equal(frames.size, 0);
});

for (const bpm of [60, 120, 200]) test('EX09相当・' + bpm + ' BPM：録音だけ最終カウント拍から1回開始し、音声予約・演奏・停止時刻を維持', async () => {
    const h = harness({ bpm, bars: 9 }), c = h.context;
    c.practiceRepeatSelect.value = '5';
    await c.startPractice('record');
    const s = c.practiceSession, performanceStart = s.startTime + s.countInBeats * s.beatSec;
    const target = performanceStart - s.beatSec;
    assert.equal(s.repeatCount, 1); assert.equal(s.practiceBeats, 36);
    h.advance(target - 0.001); assert.equal(h.recorders[0].startCalls, 0);
    h.advance(target + 0.026);
    const recorder = h.recorders[0];
    assert.equal(recorder.startCalls, 1);
    assert.ok(recorder.startTime >= target - 1e-8 && recorder.startTime < target + 0.026);
    assert.ok(Math.abs(performanceStart - recorder.startTime - 60 / bpm) < 0.026);
    assert.equal(h.phases.at(-1).phase, 'count-in'); assert.equal(h.phases.at(-1).beat, 4);
    assert.equal(s.scrollStarted, false); assert.equal(c.scrollConfig, undefined);
    h.advance(performanceStart + 0.026);
    // 偽時計の境界丸めに依存せず、実際の演奏時刻で既存の再開経路も確認する。
    c.resumePracticeScroll();
    assert.equal(h.phases.at(-1).phase, 'rec'); assert.equal(h.phases.at(-1).beat, 1);
    assert.equal(recorder.startCalls, 1); assert.equal(s.scrollStarted, true);
    assert.ok(Math.abs(c.scrollConfig.getElapsedSeconds() - (c.audioContext.currentTime - performanceStart)) < 1e-8);
    const expectedStop = s.startTime + (s.totalSteps - 1) * s.beatSec;
    assert.ok(Math.abs(s.finishTime - (s.startTime + 44 * s.beatSec + 0.1)) < 1e-8);
    h.advance(s.finishTime + 0.03);
    assert.ok(recorder.stopTime >= expectedStop - 1e-8 && recorder.stopTime < expectedStop + 0.026);
    assert.equal(recorder.startCalls, 1); assert.equal(h.urls.length, 1);
    assert.equal(c.recordResultCard.classList.contains('hidden'), false);
    assert.ok(h.streams.every(stream => stream.getTracks().every(track => track.readyState === 'ended')));
    const normal = harness({ bpm, bars: 9 });
    await normal.context.startPractice('practice'); normal.advance(normal.context.practiceSession.finishTime + 0.03);
    assert.deepEqual(h.ticks, normal.ticks);
    assert.equal(h.ticks.length, 40); assert.equal(h.timers.size, 0);
});

for (const [beats, countInBars] of [[3, 1], [1, 1], [4, 2]]) test(beats + '/4・カウントイン' + countInBars + '小節：固定4拍目ではなく演奏1拍前に録音する', async () => {
    const h = harness(), c = h.context;
    c.currentStage = { timeSignature: [beats, 4], countInBars }; h.prepareScore();
    await c.startPractice('record'); const s = c.practiceSession;
    const target = Math.max(s.startTime, s.startTime + s.countInBeats * s.beatSec - s.beatSec);
    h.advance(target - 0.001); assert.equal(h.recorders[0].startCalls, 0);
    h.advance(target + 0.026); assert.equal(h.recorders[0].startCalls, 1);
    assert.ok(h.recorders[0].startTime >= s.startTime - 1e-8);
    assert.ok(Math.abs(h.recorders[0].startTime - target) < 0.026);
    c.stopPractice(); assert.equal(h.urls.length, 0);
});

test('将来の0拍セッションの境界でもカウントイン原点より前へ録音を進めない', async () => {
    const h = harness(), c = h.context; await c.startPractice('record');
    // 現行configの0指定は1小節になる。ここでは録音判定の下限だけを0拍セッションで検証する。
    const s = c.practiceSession; s.countInBeats = 0; s.totalBeats = s.practiceBeats;
    s.totalSteps = s.totalBeats + 4; s.finishTime = s.startTime + s.totalSteps * s.beatSec + 0.1;
    h.advance(s.startTime - 0.001); assert.equal(h.recorders[0].startCalls, 0);
    h.advance(s.startTime + 0.026); assert.equal(h.recorders[0].startCalls, 1);
    assert.ok(h.recorders[0].startTime >= s.startTime - 1e-8); c.stopPractice();
});

for (const beforeStart of [true, false]) for (const close of [false, true]) test('先行録音' + (beforeStart ? '前' : '中') + 'の' + (close ? 'モーダル終了' : '停止') + 'は破棄し、古い処理を再録音へ適用しない', async () => {
    const h = harness(), c = h.context; await c.startPractice('record');
    const oldSession = c.practiceSession, target = oldSession.startTime + (oldSession.countInBeats - 1) * oldSession.beatSec;
    h.advance(target + (beforeStart ? -0.1 : 0.1));
    const old = h.recorders[0], data = old.ondataavailable, stopped = old.onstop, error = old.onerror;
    const timer = [...h.timers.values()][0].fn;
    assert.equal(old.startCalls, beforeStart ? 0 : 1);
    c.stopPractice(); if (close) c.practiceModal.classList.add('hidden');
    timer(); c.runPracticeScheduler(oldSession);
    assert.equal(old.startCalls, beforeStart ? 0 : 1); assert.equal(h.urls.length, 0);
    assert.equal(c.recordResultCard.classList.contains('hidden'), true); assert.equal(h.timers.size, 0);
    assert.ok(h.streams.every(stream => stream.getTracks().every(track => track.readyState === 'ended')));
    c.practiceModal.classList.remove('hidden'); await c.startPractice('record');
    const fresh = c.practiceSession;
    data({ data: new Blob(['OLD']) }); stopped(); error({ error: new Error('old recording') });
    assert.equal(c.practiceSession, fresh); assert.equal(h.urls.length, 0);
    h.advance(fresh.startTime + (fresh.countInBeats - 1) * fresh.beatSec + 0.026);
    assert.equal(h.recorders[1].startCalls, 1); assert.equal(h.urls.length, 0);
    c.stopPractice(); assert.equal(h.timers.size, 0);
});
