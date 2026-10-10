const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
const state = app.slice(app.indexOf('// 単体メトロノーム状態'), app.indexOf('// 譜面描画状態'));
const code = app.slice(app.indexOf('const METRO_SVG_ICON'), app.indexOf('// ★ メトロノーム音量'));
const closeCode = app.slice(app.indexOf('function closePracticeModal('), app.indexOf('bindButtonActivation(closePracticeModalBtn,'));
const practiceCode = app.slice(app.indexOf('function showPracticeStatus('), app.indexOf('// ★ 簡易チューナー'));
function deferred() {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
}
function element(hidden = false) {
    const classes = new Set(hidden ? ['hidden'] : []);
    return { innerHTML: '', innerText: '', disabled: false, hidden, value: '1', attributes: {},
        classList: { contains: c => classes.has(c), add: c => classes.add(c), remove: c => classes.delete(c),
            toggle(c, value) { if (value) classes.add(c); else classes.delete(c); } },
        setAttribute(key, value) { this.attributes[key] = value; }, removeAttribute(key) { delete this.attributes[key]; },
        addEventListener(name, fn) { this[name] = fn; }, pause() {}, load() {},
        querySelector() { return null; }, style: { removeProperty() {} },
    };
}
function harness(options = {}) {
    let nextTimer = 0, audioRequests = 0, cancellations = 0, resetCount = 0;
    const timers = new Map(), ticks = [], sounds = new Set(), updates = [], warnings = [], volume = [];
    const c = { isPracticing: false, isStartingPractice: false, isFinalizingRecording: false,
        currentStage: { timeSignature: [4, 4], countInBars: 1, bpm: options.bpm || 60 }, currentBpm: options.bpm || 60,
        practiceModal: element(), standaloneMetroBtn: element(), metroVolSlider: { value: '40' },
        audioContext: { currentTime: 0 },
        unlockAudioContext: async () => { const i = audioRequests++; if (options.unlock) await options.unlock(i); },
        stopTuner() {}, setMetronomeVolume: value => volume.push(value),
        scheduleTick(time, accent) { const tick = { time, accent }; ticks.push(tick); sounds.add(tick); },
        stopAllScheduledTicks() { cancellations++; sounds.clear(); },
        updateVisualMetronome(...args) { updates.push(args); }, resetVisualMetronome() { resetCount++; },
        setTimeout(fn, ms) { const id = nextTimer++; timers.set(id, { fn, at: c.audioContext.currentTime + ms / 1000 }); return id; },
        clearTimeout(id) { timers.delete(id); }, console: { warn: (...args) => warnings.push(args) },
        // 実際の画面終了処理・練習開始処理も読み込むための関連部品。
        recordedAudioUrl: null, recordedAudioPlayer: element(), microphoneStream: null,
        scoreResizeObserver: null, alphaTabHealthCheckTimerId: null, scoreHealthCheckPending: false,
        scoreRenderInProgress: false, scoreLoadPending: false, scoreLoadConfirmed: false,
        activeScoreRenderGeneration: 0, scoreRenderGeneration: 0, modalOpenTimerId: null,
        verticalTabController: null, verticalTabWrapper: element(), currentPracticeBarIndex: 0,
        practiceModalPositionFrame: null, document: { body: { style: {} }, querySelector: () => null },
        collapseVolumeBar() {}, stopScoreContinuousScroll() {}, resetScoreFocusState() {},
        stopMicrophoneStream() {}, destroyAlphaTabApi() {}, cancelAnimationFrame() {},
        setScoreLoadState(value) { c.scoreLoadState = value; },
        practiceStartGeneration: 0, practiceSession: null, pendingPracticeMode: null, practiceTimerIds: [],
        recordingSession: null, recordingGeneration: 0, Blob, URL: { revokeObjectURL() {} },
        mainActionBtn: element(), recordPracticeBtn: element(), practiceRepeatSelect: element(),
        modalTempoDownBtn: element(), modalTempoUpBtn: element(), modalBpmBadge: element(),
        practiceStatus: element(), recordResultCard: element(true), retryScoreBtn: element(),
        visualMetronomeBox: element(), api: {},
        isScoreReadyForPractice: () => true, preparedScore: { generation: 1, bars: 4 },
        resetPracticeBar() {}, requestWakeLock: async () => {}, releaseWakeLock() {},
        buildScoreBarLayouts() {}, setPracticeBar() {}, updateHighlightBar() {}, setPlayFinishedVisual() {},
        startScoreContinuousScroll() {}, shouldUseVerticalTabLayout: () => false,
        isPracticeModalLandscape: () => false, requestPracticeModalInitialPosition() {},
        bindButtonActivation(button, fn) { if (button) button.activate = fn; },
    };
    vm.createContext(c); vm.runInContext(state + code + closeCode + practiceCode, c);
    const read = expression => vm.runInContext(expression, c);
    function advance(to) {
        let loops = 0;
        while (true) {
            const entry = [...timers.entries()].filter(([, t]) => t.at <= to + 1e-9).sort((a, b) => a[1].at - b[1].at)[0];
            if (!entry) break;
            assert.ok(++loops < 10000);
            const [id, t] = entry; timers.delete(id); c.audioContext.currentTime = t.at; t.fn();
        }
        c.audioContext.currentTime = to;
    }
    return { c, options, timers, ticks, sounds, updates, warnings, volume, read, advance,
        audioRequests: () => audioRequests, cancellations: () => cancellations, resetCount: () => resetCount };
}

test('開始関数の連打は1件だけ初期化し、スケジューラーと表示予約を重複させない', async () => {
    const pending = deferred(), h = harness({ unlock: () => pending.promise }), c = h.c;
    const starts = [c.startStandaloneMetronome(), c.startStandaloneMetronome(), c.startStandaloneMetronome()];
    assert.equal(h.audioRequests(), 1); assert.equal(h.timers.size, 0);
    assert.equal(h.read('isStartingStandaloneMetro'), true);
    assert.equal(c.standaloneMetroBtn.attributes['aria-busy'], 'true');
    pending.resolve(); await Promise.all(starts);
    assert.equal(h.read('isStandaloneMetroPlaying'), true); assert.equal(h.ticks.length, 1);
    await c.startStandaloneMetronome(); assert.equal(h.audioRequests(), 1);
    h.advance(3.1); assert.equal(h.ticks.length, 4); assert.equal(h.updates.length, 4);
    assert.equal(h.read('standaloneMetroDisplayTimerIds.size'), 0); assert.equal(h.timers.size, 1);
});

test('準備中の2回目タップは取消、3回目の新しい要求だけが開始できる', async () => {
    const a = deferred(), b = deferred(), h = harness({ unlock: i => [a, b][i].promise }), c = h.c;
    const oldStart = c.standaloneMetroBtn.click();
    assert.match(c.standaloneMetroBtn.innerHTML, /準備を中止/);
    await c.standaloneMetroBtn.click(); const nextStart = c.standaloneMetroBtn.click();
    a.resolve(); await oldStart;
    assert.equal(h.read('isStartingStandaloneMetro'), true); assert.equal(h.ticks.length, 0);
    b.resolve(); await nextStart; assert.equal(h.ticks.length, 1); assert.equal(h.timers.size, 2);
});

test('初期化待ち中の停止後に完了しても音・表示・タイマーを開始しない', async () => {
    const pending = deferred(), h = harness({ unlock: () => pending.promise }), c = h.c;
    const start = c.startStandaloneMetronome(); c.stopStandaloneMetronome();
    pending.resolve(); await start;
    assert.equal(h.read('isStartingStandaloneMetro'), false); assert.equal(h.read('isStandaloneMetroPlaying'), false);
    assert.equal(h.timers.size, 0); assert.equal(h.ticks.length, 0); assert.equal(h.updates.length, 0);
    assert.match(c.standaloneMetroBtn.innerHTML, /クリック/);
    assert.equal(c.standaloneMetroBtn.attributes['aria-busy'], undefined);
});

test('実際の画面終了処理が初期化待ちを取消し、完了後も画面・表示を復活させない', async () => {
    const pending = deferred(), h = harness({ unlock: () => pending.promise }), c = h.c;
    const start = c.startStandaloneMetronome(); c.closePracticeModal();
    const resets = h.resetCount(); pending.resolve(); await start;
    assert.equal(c.practiceModal.classList.contains('hidden'), true);
    assert.equal(h.read('isStandaloneMetroPlaying'), false); assert.equal(h.timers.size, 0);
    assert.equal(h.ticks.length, 0); assert.equal(h.updates.length, 0); assert.equal(h.resetCount(), resets);
});

for (const resolution of ['resolve', 'reject']) {
    test('停止直後の再開始へ古い初期化の' + resolution + 'が干渉しない', async () => {
        const a = deferred(), b = deferred(), h = harness({ unlock: i => [a, b][i].promise }), c = h.c;
        const old = c.startStandaloneMetronome(); c.stopStandaloneMetronome();
        const next = c.startStandaloneMetronome(); b.resolve(); await next;
        const timer = h.read('standaloneMetroTimerId'), cancellations = h.cancellations();
        if (resolution === 'resolve') a.resolve(); else a.reject(Error('old failure'));
        await old;
        assert.equal(h.read('standaloneMetroTimerId'), timer); assert.equal(h.read('isStandaloneMetroPlaying'), true);
        assert.equal(h.cancellations(), cancellations); assert.equal(h.warnings.length, 0);
        h.advance(1.1); assert.equal(h.ticks.length, 2); assert.equal(h.updates.length, 2);
    });
}

test('停止は音声予約・表示タイマー・スケジューラーをすべて解除する', async () => {
    const h = harness(), c = h.c; await c.startStandaloneMetronome();
    assert.equal(h.timers.size, 2); assert.equal(h.sounds.size, 1);
    c.stopStandaloneMetronome(); assert.equal(h.timers.size, 0); assert.equal(h.sounds.size, 0);
    assert.equal(h.read('standaloneMetroTimerId'), null); assert.equal(h.read('standaloneMetroDisplayTimerIds.size'), 0);
    h.advance(5); assert.equal(h.updates.length, 0); assert.equal(h.ticks.length, 1);
    assert.equal(h.read('standaloneBeat'), 0); assert.equal(h.read('standaloneNextTickTime'), 0);
});

test('すでに実行待ちの古い表示・スケジューラーを配送しても新しいタイマーに触れない', async () => {
    const h = harness(), c = h.c; await c.startStandaloneMetronome();
    const oldCallbacks = [...h.timers.values()].map(t => t.fn); c.stopStandaloneMetronome();
    await c.startStandaloneMetronome(); const timer = h.read('standaloneMetroTimerId');
    oldCallbacks.forEach(fn => fn());
    assert.equal(h.read('standaloneMetroTimerId'), timer); assert.equal(h.timers.size, 2);
    assert.equal(h.read('standaloneMetroDisplayTimerIds.size'), 1); assert.equal(h.updates.length, 0);
    h.advance(1.1); assert.equal(h.ticks.length, 3); assert.equal(h.updates.length, 2);
});

test('AudioContext時刻とBPM間隔を維持し、停止後の別BPM・拍子で再開始できる', async () => {
    const h = harness({ bpm: 120 }), c = h.c; c.audioContext.currentTime = 10;
    await c.startStandaloneMetronome(); h.advance(11.1);
    const first = h.ticks.map(t => t.time);
    assert.equal(first.length, 3); assert.ok(Math.abs(first[0] - 10.05) < 1e-8);
    for (let i = 1; i < first.length; i++) assert.ok(Math.abs(first[i] - first[i - 1] - 0.5) < 1e-8);
    c.stopStandaloneMetronome(); c.currentBpm = 60; c.currentStage = { timeSignature: [3, 4] };
    await c.startStandaloneMetronome(); h.advance(14.2);
    const second = h.ticks.slice(first.length);
    assert.equal(second.length, 4); assert.deepEqual(second.map(t => t.accent), [true, false, false, true]);
    for (let i = 1; i < second.length; i++) assert.ok(Math.abs(second[i].time - second[i - 1].time - 1) < 1e-8);
    assert.deepEqual(h.volume, [0.4, 0.4]);
});

test('単体メトロノームはcurrentBpmで開始し、停止後の最新値で再開始', async () => {
    const h = harness({ bpm: 80 }), c = h.c;
    c.changePracticeTempo(-5); assert.equal(c.currentBpm, 75);
    await c.startStandaloneMetronome(); h.advance(2);
    for (let i = 1; i < h.ticks.length; i++) assert.ok(Math.abs(h.ticks[i].time - h.ticks[i - 1].time - 60 / 75) < 1e-8);
    assert.equal(c.currentBpm, 75);
    c.stopStandaloneMetronome(); c.changePracticeTempo(-5); await c.startStandaloneMetronome(); h.advance(4);
    const last = h.ticks.slice(-2); assert.ok(Math.abs(last[1].time - last[0].time - 60 / 70) < 1e-8);
    c.stopStandaloneMetronome();
});

test('現在の初期化失敗は停止状態へ戻し、再試行可能にする', async () => {
    const h = harness({ unlock: async () => { throw Error('audio failure'); } }), c = h.c;
    await c.toggleStandaloneMetronome();
    assert.equal(h.read('isStartingStandaloneMetro'), false); assert.equal(h.read('isStandaloneMetroPlaying'), false);
    assert.equal(h.timers.size, 0); assert.equal(h.warnings.length, 1);
    h.options.unlock = null; await c.toggleStandaloneMetronome(); assert.equal(h.read('isStandaloneMetroPlaying'), true);
});

test('練習の実際の開始処理が単体の開始待ちを取消し、遅い完了で練習のタイマーを消さない', async () => {
    const pending = deferred(), h = harness({ unlock: i => i === 0 ? pending.promise : Promise.resolve() }), c = h.c;
    const old = c.startStandaloneMetronome(); await c.startPractice();
    assert.equal(c.isPracticing, true);
    const timerCount = h.timers.size, tickCount = h.ticks.length, cancellations = h.cancellations();
    pending.resolve(); await old;
    assert.equal(h.read('isStandaloneMetroPlaying'), false); assert.equal(c.isPracticing, true);
    assert.equal(h.timers.size, timerCount); assert.equal(h.cancellations(), cancellations);
    assert.equal(h.ticks.length, tickCount); c.stopPractice();
});

for (const blocked of ['isPracticing', 'isStartingPractice', 'isFinalizingRecording', 'closed']) {
    test(blocked + 'では単体開始処理・音声初期化に入らない', async () => {
        const h = harness(), c = h.c;
        if (blocked === 'closed') c.practiceModal.classList.add('hidden'); else c[blocked] = true;
        await c.toggleStandaloneMetronome(); await c.startStandaloneMetronome();
        assert.equal(h.audioRequests(), 0); assert.equal(h.timers.size, 0);
    });
}
