const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 既存の通信・alphaTabイベント・Recorderの代替環境を再利用する。
// テスト本体は実行せず、実際のアプリ処理を呼ぶharnessだけを読み込む。
function fixture(file, marker) {
    const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
    return vm.runInNewContext(source.slice(0, source.indexOf(marker)) + '\nharness;', {
        require, __dirname, Blob, TextEncoder, setImmediate,
    });
}
const scoreFixture = fixture('score-loading.test.cjs', "for (const state of ['idle'");
const recordingFixture = fixture('practice.test.cjs', 'for (const repeats of');
const ui = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8');
const scrollCode = ui.slice(ui.indexOf('let cachedBarLayouts'), ui.indexOf('// ★ 簡易チューナー')).replace(/export /g, '');

async function harness(options = {}) {
    const h = scoreFixture({ landscape: true }), c = h.c;
    const container = c.document.getElementById('alphaTab');
    const wrapper = c.document.querySelector('.score-wrapper');
    const highlight = { style: {}, classList: { add() {}, remove() {} } };
    wrapper.clientWidth = 200; wrapper.scrollWidth = 2000; wrapper.scrollLeft = 0;
    const originalQuery = c.document.querySelector;
    c.document.querySelector = selector => selector === '#alphaTab svg' ? container.svg : originalQuery(selector);
    c.document.getElementById = id => id === 'scoreBarHighlight' ? highlight : container;
    const frames = new Map(); let nextFrame = 1000;
    c.requestAnimationFrame = fn => { frames.set(++nextFrame, fn); return nextFrame; };
    c.cancelAnimationFrame = id => frames.delete(id);
    vm.runInContext(scrollCode, c);
    const recording = recordingFixture();
    recording.context.audioContext = c.audioContext;
    for (const key of ['MediaRecorder', 'navigator', 'setupMicrophoneStream', 'URL']) c[key] = recording.context[key];
    c.window.MediaRecorder = c.MediaRecorder;
    c.recordResultCard.scrollIntoView = () => {};
    c.currentBpm = 60;
    await h.open();
    // モーダル初期位置調整のRAFを完了させ、以下はスクロールのRAFだけを検証。
    while (frames.size) {
        const [id, fn] = frames.entries().next().value; frames.delete(id); fn(0);
    }
    function redraw({ width = 300, offset = 0, instance = c.api, svgScale = 1, finish = true } = {}) {
        instance.score = { masterBars: Array(4).fill({}) };
        instance.boundsLookup = { findMasterBarByIndex: index => ({ realBounds: { x: offset + index * width, y: 10, w: width, h: 180 } }) };
        container.svg = { isConnected: true, childElementCount: 1,
            parentElement: { layoutResultId: 'music', renderedResultId: 'music' },
            viewBox: { baseVal: { x: 0, y: 0, width: 2000, height: 200 } },
            getBoundingClientRect: () => ({ width: 2000 * svgScale, height: 200 * svgScale }),
            getAttribute: () => null, querySelector: () => ({}) };
        // TAB生成は先頭へ戻る代替実装。復帰が生成後でないと現在小節が失われる。
        if (c.verticalTabController) {
            c.verticalTabController.createCardsFromRenderedSvg = function(svg, lookup, bars) {
                this.hasCards = true; this.barCount = bars; this.currentBar = 0;
            };
            c.verticalTabController.setCurrentBar = function(index) { this.currentBar = index; };
        }
        instance.scoreLoaded.emit(instance.score);
        instance.renderStarted.emit();
        instance.renderer.partialLayoutFinished.emit({ id: 'music', firstMasterBarIndex: 0, lastMasterBarIndex: 3 });
        instance.renderFinished.emit();
        if (finish) instance.postRenderFinished.emit();
    }
    function frameAt(time) {
        c.audioContext.currentTime = time;
        const entry = frames.entries().next().value;
        assert.ok(entry, '有効なスクロール更新が存在する');
        const [id, fn] = entry; frames.delete(id); fn(99999999);
    }
    function advance(time) {
        const id = c.practiceTimerIds[0];
        if (id) h.timers.delete(id);
        c.audioContext.currentTime = time;
        if (c.practiceSession) c.runPracticeScheduler(c.practiceSession);
    }
    redraw();
    return { ...h, c, wrapper, container, highlight, frames, redraw, frameAt, advance, recording };
}

test('演奏していない再描画では自動スクロールを開始しない', async () => {
    const h = await harness(); h.redraw({ width: 400 });
    assert.equal(h.frames.size, 0); assert.equal(h.wrapper.scrollLeft, 0);
});

test('カウントイン中の再描画は開始せず、最初の演奏拍から通常追従', async () => {
    const h = await harness(), c = h.c;
    await c.startPractice(); h.advance(2); h.redraw();
    assert.equal(h.frames.size, 0);
    h.advance(4.3); h.frameAt(6.3);
    assert.equal(h.wrapper.scrollLeft, 94); assert.equal(h.frames.size, 1);
});

test('renderFinishedだけでは旧座標を使わず、postRenderFinished後に新SVG座標へ即時復帰・継続', async () => {
    const h = await harness(), c = h.c;
    await c.startPractice(); h.advance(10.3); h.frameAt(10.3);
    const origin = c.practiceSession.startTime;
    assert.ok(Math.abs(h.wrapper.scrollLeft - 394) < 1e-8);
    h.redraw({ width: 400, offset: 100, svgScale: 1.5, finish: false });
    assert.ok(Math.abs(h.wrapper.scrollLeft - 394) < 1e-8);
    c.api.postRenderFinished.emit();
    assert.ok(Math.abs(h.wrapper.scrollLeft - 994) < 1e-8);
    assert.equal(c.practiceSession.startTime, origin); assert.equal(h.frames.size, 1);
    assert.equal(h.highlight.style.left, '750px');
    h.frameAt(11.3); assert.ok(Math.abs(h.wrapper.scrollLeft - 1144) < 1e-8);
});

test('TAB生成後に現在小節を復元し、縦→横→縦→横の再描画も追従', async () => {
    const h = await harness(), c = h.c;
    await c.startPractice(); h.advance(14.3);
    for (const landscape of [false, true, false, true]) {
        h.options.landscape = landscape; c.updatePracticeScoreLayout();
        h.redraw({ width: 350 });
        assert.equal(c.currentPracticeBarIndex, 2);
        assert.equal(c.verticalTabController.currentBar, 2);
        assert.equal(h.frames.size, 1);
        assert.ok(Math.abs(h.wrapper.scrollLeft - 819) < 1e-8);
    }
});

test('複数回再描画でもRAFは1本、取消済み旧RAFの遅延配送は新しい位置・RAFを変更しない', async () => {
    const h = await harness(), c = h.c;
    await c.startPractice(); h.advance(8.3);
    const oldCallbacks = [];
    for (const width of [300, 420, 260, 380, 500]) {
        if (h.frames.size) oldCallbacks.push([...h.frames.values()][0]);
        h.redraw({ width }); assert.equal(h.frames.size, 1);
    }
    const position = h.wrapper.scrollLeft, activeId = [...h.frames.keys()][0];
    oldCallbacks.forEach(fn => fn(99999999));
    assert.equal(h.wrapper.scrollLeft, position);
    assert.equal(h.frames.size, 1); assert.equal([...h.frames.keys()][0], activeId);
    h.frameAt(9.3); assert.ok(h.wrapper.scrollLeft > position);
});

for (const repeats of ['3', '5', 'unlimited']) {
    test(repeats + '回設定の2周目途中へ復帰し、周回の音声予約を変更しない', async () => {
        const h = await harness(), c = h.c;
        c.practiceRepeatSelect.value = repeats; await c.startPractice();
        h.advance(26.3); // 演奏開始4.3秒、2周目の1.5小節目。
        const session = c.practiceSession, nextBeat = session.nextBeat;
        h.redraw({ width: 400 });
        assert.equal(c.practiceSession, session); assert.equal(session.nextBeat, nextBeat);
        assert.equal(c.currentPracticeBarIndex, 1);
        assert.ok(Math.abs(h.wrapper.scrollLeft - 544) < 1e-8);
        assert.equal(h.frames.size, 1);
        h.frameAt(36.301); assert.equal(h.wrapper.scrollLeft, 0); // 3周目の先頭。
    });
}

for (const action of ['stop', 'close', 'finish']) {
    test(action + '後の遅延再描画・旧RAFでスクロールを復活させない', async () => {
        const h = await harness(), c = h.c;
        await c.startPractice(); h.advance(10.3);
        const oldFrame = [...h.frames.values()][0], instance = c.api;
        h.redraw({ finish: false });
        if (action === 'stop') c.stopPractice();
        else if (action === 'close') c.closePracticeModal();
        else c.finishPractice();
        const position = h.wrapper.scrollLeft;
        instance.postRenderFinished.emit(); oldFrame(99999999);
        assert.equal(h.frames.size, 0); assert.equal(h.wrapper.scrollLeft, position);
    });
}

test('EX切替後の古いAPIの完了イベントは新しい座標・スクロールに干渉しない', async () => {
    const h = await harness(), c = h.c;
    await c.startPractice(); h.advance(10.3); const oldApi = c.api;
    await h.open({ ...h.stage, id: 2, file: 'two.xml' });
    while (h.frames.size) { const [id, fn] = h.frames.entries().next().value; h.frames.delete(id); fn(0); }
    h.redraw({ width: 500 }); await c.startPractice(); h.advance(20.6);
    h.redraw({ width: 500 }); const position = h.wrapper.scrollLeft;
    oldApi.postRenderFinished.emit();
    assert.equal(h.wrapper.scrollLeft, position); assert.equal(h.frames.size, 1);
});

test('停止後の新しい練習は新しい時刻原点を使い、古いRAFは新しいループを止めない', async () => {
    const h = await harness(), c = h.c;
    await c.startPractice(); h.advance(10.3); const oldFrame = [...h.frames.values()][0];
    c.stopPractice(); await c.startPractice(); h.advance(16.6); h.redraw();
    const session = c.practiceSession, position = h.wrapper.scrollLeft;
    oldFrame(99999999);
    assert.equal(c.practiceSession, session); assert.equal(h.frames.size, 1);
    assert.ok(Math.abs(position - 94) < 1e-8); assert.equal(h.wrapper.scrollLeft, position);
});

test('終了時刻を過ぎて停止処理待ちでも再描画からスクロールを再開しない', async () => {
    const h = await harness(), c = h.c;
    await c.startPractice(); h.advance(10.3);
    c.audioContext.currentTime = c.practiceSession.finishTime;
    h.redraw(); assert.equal(h.frames.size, 0);
});

for (const invalidation of ['practice-generation', 'score-generation', 'hidden', 'session']) {
    test(invalidation + 'が変わったら未解除のRAFも更新せず終了', async () => {
        const h = await harness(), c = h.c;
        await c.startPractice(); h.advance(10.3); h.redraw();
        const position = h.wrapper.scrollLeft;
        if (invalidation === 'practice-generation') c.practiceStartGeneration++;
        else if (invalidation === 'score-generation') c.scoreRenderGeneration++;
        else if (invalidation === 'hidden') c.practiceModal.classList.add('hidden');
        else c.practiceSession = { ...c.practiceSession };
        h.frameAt(11.3);
        assert.equal(h.wrapper.scrollLeft, position); assert.equal(h.frames.size, 0);
    });
}

test('録音中の再描画はRecorder・録音原点を維持し、従来の終了処理で録音結果を生成', async () => {
    const h = await harness(), c = h.c;
    await c.startPractice('record'); h.advance(10.3);
    const recorder = h.recording.recorders[0], recording = c.recordingSession;
    assert.equal(recorder.state, 'recording');
    const stopTime = c.practiceSession.finishTime;
    h.redraw({ width: 450 }); h.frameAt(11.3); h.redraw({ width: 350 });
    assert.equal(c.recordingSession, recording); assert.equal(h.recording.recorders.length, 1);
    assert.equal(recorder.state, 'recording');
    h.advance(stopTime); assert.equal(h.recording.urls.length, 1);
    assert.equal(c.recordResultCard.classList.contains('hidden'), false);
    assert.equal(h.frames.size, 0);
});

test('録音練習の停止後の遅延再描画も録音・追従を復活させない', async () => {
    const h = await harness(), c = h.c;
    await c.startPractice('record'); h.advance(10.3);
    c.stopPractice(); h.redraw();
    assert.equal(c.recordingSession, null); assert.equal(h.recording.urls.length, 0);
    assert.equal(h.frames.size, 0);
});
