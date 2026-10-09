const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 実際の読込・モーダル・開始処理へ、制御可能な通信とalphaTabイベントを渡す。
const app = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
const scoreCode = app.slice(app.indexOf('function destroyAlphaTabApi('), app.indexOf('// ★ 練習カードの動的生成'));
const modalCode = app.slice(app.indexOf('function openPracticeModal('), app.indexOf('bindButtonActivation(closePracticeModalBtn,'));
const practiceCode = app.slice(app.indexOf('function showPracticeStatus('), app.indexOf('// ★ 簡易チューナー'));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const response = { ok: true, text: async () => '<score-partwise />' };

function element(hidden = false) {
    const classes = new Set(hidden ? ['hidden'] : []);
    return { hidden, disabled: false, dataset: {}, innerText: '', value: '1', clientWidth: 400,
        clientHeight: 200, scrollHeight: 200, scrollTop: 0,
        classList: { contains: c => classes.has(c), add: c => classes.add(c), remove: c => classes.delete(c),
            toggle(c, value) { if (value) classes.add(c); else classes.delete(c); } },
        style: { setProperty() {}, removeProperty() {} },
        querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {},
        replaceChildren() { this.svg = null; }, pause() {}, load() {}, removeAttribute() {},
        getBoundingClientRect: () => ({ width: 400, height: 200 }),
    };
}

function harness(options = {}) {
    const instances = [], observers = [], timers = new Map();
    let audioRequests = 0, micRequests = 0, nextTimer = 0;
    const stage = { id: 1, file: 'one.xml', practiceBars: 99, timeSignature: [4, 4], countInBars: 1 };
    const c = { currentStage: stage, currentBpm: 60, currentPracticeBarIndex: 0,
        api: null, preparedScore: null, scoreLoadState: 'idle', isScoreRendered: false,
        scoreRenderInProgress: false, scoreLoadPending: false, scoreLoadConfirmed: false,
        scoreHealthCheckPending: false, scoreRepairAttempted: false, scoreRenderGeneration: 0,
        activeScoreRenderGeneration: 0, scoreRenderStartedAt: 0, scoreResizeObserver: null,
        alphaTabHealthCheckTimerId: null, modalOpenTimerId: null, practiceModalPositionFrame: null,
        practiceModalWasLandscape: false, verticalTabController: null, detectedSlurPairs: [],
        isPracticing: false, isStartingPractice: false, isFinalizingRecording: false,
        practiceStartGeneration: 0, practiceSession: null, pendingPracticeMode: null, practiceTimerIds: [],
        recordingSession: null, recordingGeneration: 0, recordedAudioUrl: null, microphoneStream: null,
        Blob, TextEncoder, performance: { now: () => 0 }, console: { error() {}, warn() {} },
        audioContext: { currentTime: 0 },
        setTimeout(fn) { timers.set(++nextTimer, fn); return nextTimer; }, clearTimeout(id) { timers.delete(id); },
        requestAnimationFrame() { return ++nextTimer; }, cancelAnimationFrame() {},
        unlockAudioContext: async () => { audioRequests++; if (options.audioPromise) await options.audioPromise; },
        requestWakeLock: async () => {}, releaseWakeLock() {},
        navigator: { mediaDevices: { getUserMedia: async () => { micRequests++; throw Error('unexpected microphone'); } } },
        fetch: async file => options.fetch ? options.fetch(file) : response,
        fixMuseScoreXml: xml => xml, handleWatermark() {}, renderSlursAndLabelsInSvg() {},
        buildScoreBarLayouts: () => !options.noLayouts,
        stopTuner() {}, stopStandaloneMetronome() {}, collapseVolumeBar() {},
        resetScoreFocusState() {}, resetVisualMetronome() {}, stopScoreContinuousScroll() {},
        markTutorialCompleted() {},
        stopAllScheduledTicks() {}, stopMicrophoneStream() {}, scheduleTick() {},
        updateVisualMetronome() {}, updateHighlightBar() {}, setPlayFinishedVisual() {},
        startScoreContinuousScroll() {}, URL: { revokeObjectURL() {} },
        bindButtonActivation(button, fn) { if (button) button.activate = fn; },
    };
    for (const id of ['mainActionBtn', 'recordPracticeBtn', 'practiceRepeatSelect', 'practiceStatus',
        'retryScoreBtn', 'scoreLoadStatus', 'scoreLoadMessage', 'recordedAudioPlayer', 'recordResultCard',
        'visualMetronomeBox', 'standaloneMetroBtn', 'verticalTabWrapper', 'modalStageBadge', 'modalBpmBadge',
        'modalBarsBadge', 'modalStageTitle', 'modalStageDesc', 'stageGuideTitle', 'stageGuideBody']) c[id] = element();
    c.recordResultCard.classList.add('hidden');
    c.practiceModal = element(true);
    const container = element(), wrapper = element(), content = element();
    container.querySelector = q => q === 'svg' ? container.svg : null;
    container.querySelectorAll = q => q === 'svg' && container.svg ? [container.svg] : [];
    c.practiceModal.querySelector = () => content;
    content.querySelector = () => wrapper;
    c.document = { getElementById: () => container,
        querySelector: q => q === '.score-wrapper' ? wrapper : content, body: { style: {} } };
    c.window = { innerWidth: 400, innerHeight: 800, addEventListener() {},
        getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
        matchMedia: q => ({ matches: q.includes('landscape') ? !!options.landscape : !options.landscape }) };
    c.ResizeObserver = class {
        constructor(fn) { this.fn = fn; observers.push(this); } observe() {} disconnect() { this.disconnected = true; }
    };
    const event = () => ({ on(fn) { this.fn = fn; }, emit(value) { this.fn?.(value); } });
    class AlphaTabApi {
        constructor() {
            if (options.constructFail) throw Error('init failure');
            this.scoreLoaded = event(); this.renderFinished = event(); this.postRenderFinished = event(); this.error = event();
            this.loadCalls = []; instances.push(this);
        }
        load(data) { this.loadCalls.push(data); if (options.loadThrows) throw Error('decode'); return !options.loadRejected; }
        destroy() { this.destroyed = true; }
    }
    c.alphaTab = c.window.alphaTab = { AlphaTabApi };
    c.VerticalTabController = class {
        constructor() { this.hasCards = false; this.barCount = 0; }
        createCardsFromRenderedSvg(svg, lookup, bars) {
            if (options.tabThrows) throw Error('TAB failed');
            this.hasCards = !options.noCards; this.barCount = bars;
        }
        setCurrentBar() {} resetToFirstBar() {} updateControls() {}
        setMessage(message) { this.message = message; }
        destroy() { this.hasCards = false; }
    };
    vm.createContext(c); vm.runInContext(scoreCode + modalCode + practiceCode, c);
    function complete(instance = c.api, bars = 4) {
        instance.score = { masterBars: Array(bars).fill({}) };
        instance.scoreLoaded.emit(instance.score);
        if (instance === c.api && !instance.destroyed && !options.noSvg) {
            container.svg = element(); container.svg.isConnected = true; container.svg.childElementCount = 1;
            container.svg.querySelector = () => ({});
        }
        instance.renderFinished.emit();
        instance.postRenderFinished.emit();
    }
    async function open(nextStage = stage) {
        c.openPracticeModal(nextStage);
        observers.at(-1).fn([{ contentRect: { width: 400 } }]);
        await new Promise(r => setImmediate(r));
    }
    return { c, stage, options, instances, observers, timers, complete, open,
        audioRequests: () => audioRequests, micRequests: () => micRequests };
}

for (const state of ['idle', 'loading', 'error']) {
    test(state + 'では両方の開始関数が音声・マイク処理に入らない', async () => {
        const h = harness(), c = h.c;
        c.practiceModal.classList.remove('hidden'); c.setScoreLoadState(state);
        assert.equal(c.mainActionBtn.disabled, true); assert.equal(c.recordPracticeBtn.disabled, true);
        await c.startPractice(); await c.startPractice('record');
        assert.equal(h.audioRequests(), 0); assert.equal(h.micRequests(), 0);
        assert.equal(c.isStartingPractice, false); assert.equal(c.practiceSession, null);
    });
}

test('取得・scoreLoadedだけでは開始不可、SVG・小節配置・TAB準備後のみ開始可', async () => {
    const h = harness(), c = h.c; await h.open();
    assert.equal(c.scoreLoadState, 'loading'); assert.equal(c.mainActionBtn.disabled, true);
    c.api.renderFinished.emit(); assert.equal(c.scoreLoadState, 'loading');
    c.api.score = { masterBars: Array(4).fill({}) }; c.api.scoreLoaded.emit(c.api.score);
    c.api.renderFinished.emit();
    assert.equal(c.recordPracticeBtn.disabled, true);
    h.complete(); assert.equal(c.scoreLoadState, 'ready');
    assert.equal(c.mainActionBtn.disabled, false); assert.equal(c.recordPracticeBtn.disabled, false);
    assert.equal(c.verticalTabController.barCount, 4); assert.equal(c.scoreLoadStatus.hidden, true);
    await c.startPractice(); assert.equal(c.practiceSession.practiceBars, 4); // configの99小節を使わない。
    c.stopPractice();
});

for (const cause of ['constructFail', 'loadRejected', 'loadThrows', 'noSvg', 'noLayouts', 'noCards', 'tabThrows']) {
    test('準備失敗で開始不可・再試行表示：' + cause, async () => {
        const h = harness({ [cause]: true }), c = h.c; await h.open();
        if (c.scoreLoadState !== 'error') h.complete();
        assert.equal(c.scoreLoadState, 'error'); assert.equal(c.mainActionBtn.disabled, true);
        assert.equal(c.recordPracticeBtn.disabled, true); assert.equal(c.retryScoreBtn.hidden, false);
        assert.equal(c.scoreLoadMessage.innerText, '譜面を読み込めませんでした');
        await c.startPractice('record'); assert.equal(h.micRequests(), 0);
    });
}

test('小節のない譜面は成功扱いにしない', async () => {
    const h = harness(); await h.open(); h.complete(h.c.api, 0);
    assert.equal(h.c.scoreLoadState, 'error'); assert.equal(h.c.preparedScore, null);
});

test('通信失敗→再試行失敗→再試行成功、その間は両ボタン無効', async () => {
    let fail = true;
    const h = harness({ fetch: async () => fail ? { ok: false, status: 404 } : response }), c = h.c;
    await h.open(); assert.equal(c.scoreLoadState, 'error');
    assert.equal(c.verticalTabController.message, '譜面を読み込めませんでした');
    const failedApi = c.api;
    const retry = c.retryScoreBtn.activate(); assert.equal(c.scoreLoadState, 'loading');
    assert.equal(c.retryScoreBtn.hidden, true); assert.equal(c.mainActionBtn.disabled, true);
    await retry; assert.equal(c.scoreLoadState, 'error'); assert.equal(failedApi.destroyed, true);
    fail = false; await c.retryScoreBtn.activate(); assert.equal(c.scoreLoadState, 'loading');
    h.complete(failedApi); assert.equal(c.scoreLoadState, 'loading');
    assert.equal(c.recordPracticeBtn.disabled, true);
    h.complete(); assert.equal(c.scoreLoadState, 'ready'); assert.equal(c.recordPracticeBtn.disabled, false);
});

test('EX1の遅い取得結果・完了イベント・ResizeObserverをEX2に反映しない', async () => {
    const pending = deferred();
    const h = harness({ fetch: file => file === 'one.xml' ? pending.promise : Promise.resolve(response) }), c = h.c;
    await h.open(); const oldApi = c.api, oldObserver = h.observers.at(-1);
    const nextStage = { ...h.stage, id: 2, file: 'two.xml' }; await h.open(nextStage);
    const nextApi = c.api;
    h.complete(oldApi, 99); oldObserver.fn([{ contentRect: { width: 400 } }]);
    assert.equal(c.api, nextApi); assert.equal(c.scoreLoadState, 'loading');
    assert.equal(c.mainActionBtn.disabled, true);
    pending.resolve(response); await new Promise(r => setImmediate(r));
    assert.equal(oldApi.loadCalls.length, 0);
    h.complete(nextApi, 3); assert.equal(c.preparedScore.bars, 3);
    h.complete(oldApi, 88); oldApi.error.emit(Error('late'));
    assert.equal(c.scoreLoadState, 'ready'); assert.equal(c.modalBarsBadge.innerText, '3小節');
    assert.equal(c.preparedScore.stage, nextStage);
});

test('再試行中に閉じると、遅れた取得・完了で復活しない', async () => {
    const pending = deferred(); let fail = true;
    const h = harness({ fetch: () => fail ? Promise.resolve({ ok: false, status: 500 }) : pending.promise }), c = h.c;
    await h.open(); fail = false;
    const retry = c.retryScoreLoad(), oldApi = c.api;
    c.closePracticeModal(); pending.resolve(response); await retry; h.complete(oldApi);
    assert.equal(c.scoreLoadState, 'idle'); assert.equal(c.preparedScore, null);
    assert.equal(c.practiceModal.classList.contains('hidden'), true);
    assert.equal(c.mainActionBtn.disabled, true); assert.equal(c.api, null);
    assert.equal(oldApi.loadCalls.length, 0); assert.equal(h.timers.size, 0);
});

test('失敗後の別EXは読み込み中から初期化し、古い失敗APIの完了を無視', async () => {
    const h = harness(), c = h.c; await h.open(); const old = c.api;
    old.error.emit(Error('failed')); h.complete(old); assert.equal(c.scoreLoadState, 'error');
    await h.open({ ...h.stage, id: 2, file: 'two.xml' });
    assert.equal(c.scoreLoadState, 'loading'); assert.equal(c.retryScoreBtn.hidden, true);
    h.complete(old); assert.equal(c.mainActionBtn.disabled, true);
    h.complete(); assert.equal(c.scoreLoadState, 'ready');
});

test('音声初期化待ちで譜面が無効になったら開始を取り消す', async () => {
    const pending = deferred(); const h = harness({ audioPromise: pending.promise }), c = h.c;
    await h.open(); h.complete(); const starting = c.startPractice('record');
    assert.equal(c.isStartingPractice, true);
    c.api.error.emit(Error('invalidated')); pending.resolve(); await starting;
    assert.equal(c.isStartingPractice, false); assert.equal(c.isPracticing, false);
    assert.equal(c.recordPracticeBtn.disabled, true); assert.equal(h.micRequests(), 0);
});

test('描画未完了は1回自動復旧後に失敗表示し、再試行できる', async () => {
    const h = harness(), c = h.c; await h.open(); c.performance.now = () => 9000;
    const first = h.timers.values().next().value; h.timers.clear(); first();
    await new Promise(r => setImmediate(r)); assert.equal(h.instances.length, 2);
    c.performance.now = () => 18000;
    const second = h.timers.values().next().value; h.timers.clear(); second();
    assert.equal(c.scoreLoadState, 'error'); assert.equal(c.retryScoreBtn.hidden, false);
});

test('横画面で成功後に縦へ変更してもTABが用意され、開始可能', async () => {
    const h = harness({ landscape: true }), c = h.c; await h.open(); h.complete();
    assert.equal(c.verticalTabController, null); h.options.landscape = false;
    c.updatePracticeScoreLayout(); assert.equal(c.verticalTabController.hasCards, true);
    assert.equal(c.isScoreReadyForPractice(), true);
});

test('同じ譜面の再描画が音声初期化待ち中に完了しても開始を失わない', async () => {
    const pending = deferred(); const h = harness({ audioPromise: pending.promise }), c = h.c;
    await h.open(); h.complete(); const starting = c.startPractice();
    h.complete(); pending.resolve(); await starting;
    assert.equal(c.isStartingPractice, false); assert.equal(c.isPracticing, true);
    assert.equal(c.practiceSession.practiceBars, 4); c.stopPractice();
});

test('練習中に譜面表示が失敗しても停止操作は可能、再試行は停止後に可能', async () => {
    const h = harness(), c = h.c; await h.open(); h.complete(); await c.startPractice();
    c.api.error.emit(Error('display failure'));
    assert.equal(c.mainActionBtn.disabled, false); assert.equal(c.retryScoreBtn.disabled, true);
    c.mainActionBtn.activate(); assert.equal(c.isPracticing, false);
    assert.equal(c.mainActionBtn.disabled, true); assert.equal(c.retryScoreBtn.disabled, false);
    await c.retryScoreLoad(); h.complete(); assert.equal(c.mainActionBtn.disabled, false);
});
