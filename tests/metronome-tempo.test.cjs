const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function fixture(file, marker, result) {
    const text = fs.readFileSync(path.join(__dirname, file), 'utf8');
    return vm.runInNewContext(text.slice(0, text.indexOf(marker)) + '\n' + result,
        { require, __dirname, Blob, TextEncoder, AbortController, setImmediate });
}
const metro = fixture('standalone-metronome.test.cjs', "test('開始関数", 'harness;');
const practice = fixture('practice.test.cjs', 'for (const repeats of', 'harness;');
const boot = fixture('storage.test.cjs', "for (const failure of ['getItem", 'boot;');
function near(actual, expected) { assert.ok(Math.abs(actual - expected) < 1e-8, actual + ' ≈ ' + expected); }
function enabled(c) { assert.equal(c.modalTempoDownBtn.disabled, false); assert.equal(c.modalTempoUpBtn.disabled, false); }
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }

for (const [initial, change] of [[60, 5], [65, -5], [70, 5], [80, -5]]) {
    test(initial + '→' + (initial + change) + '：拍途中のテンポ変更を次拍へ反映、以降は新しい間隔', async () => {
        const h = metro({ bpm: initial }), c = h.c, oldBeat = 60 / initial;
        await c.startStandaloneMetronome();
        h.advance(0.05 + oldBeat * 0.5);
        c.changePracticeTempo(change); const newBeat = 60 / (initial + change);
        const expectedNext = c.audioContext.currentTime + newBeat * 0.5;
        near(h.read('standaloneNextTickTime'), expectedNext);
        h.advance(expectedNext + newBeat * 3 + 0.02);
        near(h.ticks[1].time, expectedNext);
        for (let i = 2; i < h.ticks.length; i++) near(h.ticks[i].time - h.ticks[i - 1].time, newBeat);
        assert.equal(h.audioRequests(), 1); assert.equal(h.cancellations(), 0);
        c.stopStandaloneMetronome();
    });
}
test('60→65→70の連続変更でも拍の残り割合を維持し、音声予約・更新処理を重複しない', async () => {
    const h = metro(), c = h.c; await c.startStandaloneMetronome(); h.advance(0.55);
    const generation = h.read('standaloneMetroStartGeneration'), timer = h.read('standaloneMetroTimerId');
    c.changePracticeTempo(5); c.changePracticeTempo(5);
    near(h.read('standaloneNextTickTime'), 0.55 + 0.5 * 60 / 70);
    assert.equal(h.read('standaloneMetroStartGeneration'), generation);
    assert.equal(h.read('standaloneMetroTimerId'), timer); assert.equal(h.timers.size, 1);
    h.advance(5);
    assert.equal(new Set(h.ticks.map(t => t.time)).size, h.ticks.length);
    assert.equal(h.updates.length, h.ticks.length);
    assert.equal(h.read('standaloneMetroDisplayTimerIds.size'), 0);
    assert.equal(h.timers.size, 1); assert.equal(h.audioRequests(), 1);
    c.stopStandaloneMetronome();
});
test('予約済みの直近クリックは1回だけ鳴らし、その次から新テンポを使用', async () => {
    const h = metro(), c = h.c; await c.startStandaloneMetronome(); h.advance(0.98);
    assert.equal(h.ticks.length, 2); near(h.ticks[1].time, 1.05);
    const displayCount = h.read('standaloneMetroDisplayTimerIds.size');
    c.changePracticeTempo(5);
    assert.equal(h.cancellations(), 0); assert.equal(h.ticks.length, 2);
    assert.equal(h.read('standaloneMetroDisplayTimerIds.size'), displayCount);
    near(h.read('standaloneNextTickTime'), 1.05 + 60 / 65);
    h.advance(4);
    near(h.ticks[2].time, 1.05 + 60 / 65);
    assert.equal(new Set(h.ticks.map(t => t.time)).size, h.ticks.length);
    c.stopStandaloneMetronome();
});
test('開始直後の未来クリックを消さず、連続変更後の最新値で次の間隔を決定', async () => {
    const h = metro(), c = h.c; await c.startStandaloneMetronome();
    c.changePracticeTempo(5); c.changePracticeTempo(5); c.changePracticeTempo(-5);
    near(h.read('standaloneNextTickTime'), 0.05 + 60 / 65);
    assert.equal(h.ticks.length, 1); h.advance(3);
    for (let i = 1; i < h.ticks.length; i++) near(h.ticks[i].time - h.ticks[i - 1].time, 60 / 65);
    c.stopStandaloneMetronome();
});
test('同じAudioContext・1本のスケジューラーで多数のテンポ連打を処理', async () => {
    const h = metro(), c = h.c, audio = c.audioContext;
    await c.startStandaloneMetronome(); h.advance(0.4);
    for (let i = 0; i < 100; i++) c.changePracticeTempo(i % 2 ? -5 : 5);
    assert.equal(c.audioContext, audio); assert.equal(h.audioRequests(), 1); assert.equal(h.timers.size, 1);
    near(h.read('standaloneNextTickTime'), 1.05); h.advance(4.1);
    assert.equal(h.ticks.length, 5);
    for (let i = 1; i < h.ticks.length; i++) near(h.ticks[i].time - h.ticks[i - 1].time, 1);
    assert.equal(h.updates.length, 5); assert.equal(h.timers.size, 1); c.stopStandaloneMetronome();
});
test('単独再生中はテンポ操作可能、停止しても値を維持し、通常練習がその値を固定', async () => {
    const h = metro(), c = h.c; await c.startStandaloneMetronome(); c.updatePracticeControls(); enabled(c);
    c.changePracticeTempo(5); c.changePracticeTempo(5); c.changePracticeTempo(5);
    c.stopStandaloneMetronome(); assert.equal(c.currentBpm, 75); enabled(c);
    await c.startPractice(); assert.equal(c.practiceSession.bpm, 75);
    c.changePracticeTempo(-5); assert.equal(c.currentBpm, 75);
    assert.equal(c.modalTempoUpBtn.disabled, true); c.stopPractice();
});
for (const [bpm, delta, disabled] of [[20, -5, 'Down'], [200, 5, 'Up']]) {
    test(bpm + ' BPM：単独再生中も上限・下限の片側だけ無効', async () => {
        const h = metro({ bpm }), c = h.c; await c.startStandaloneMetronome(); c.updatePracticeControls();
        c.changePracticeTempo(delta); assert.equal(c.currentBpm, bpm);
        assert.equal(c['modalTempo' + disabled + 'Btn'].disabled, true);
        assert.equal(c['modalTempo' + (disabled === 'Down' ? 'Up' : 'Down') + 'Btn'].disabled, false);
        h.advance(7);
        for (let i = 1; i < h.ticks.length; i++) near(h.ticks[i].time - h.ticks[i - 1].time, 60 / bpm);
        c.stopStandaloneMetronome();
    });
}
for (const [bpm, delta] of [[20, 5], [200, -5]]) {
    test(bpm + ' BPM付近でも急な空白や二重予約を作らず次拍へ移る', async () => {
        const h = metro({ bpm }), c = h.c; await c.startStandaloneMetronome();
        h.advance(0.05 + 60 / bpm * 0.5); c.changePracticeTempo(delta);
        const next = h.read('standaloneNextTickTime'); assert.ok(next > c.audioContext.currentTime);
        h.advance(next + 60 / (bpm + delta) * 3 + 0.02);
        for (let i = 2; i < h.ticks.length; i++) near(h.ticks[i].time - h.ticks[i - 1].time, 60 / (bpm + delta));
        c.stopStandaloneMetronome();
    });
}
test('テンポ変更後の停止・再開始でも古い世代の音・表示・タイマーを復活させない', async () => {
    const h = metro(), c = h.c; await c.startStandaloneMetronome(); c.changePracticeTempo(5);
    const stale = [...h.timers.values()].map(t => t.fn), oldGeneration = h.read('standaloneMetroStartGeneration');
    c.stopStandaloneMetronome(); await c.startStandaloneMetronome();
    const timer = h.read('standaloneMetroTimerId'), count = h.ticks.length;
    stale.forEach(fn => fn());
    assert.ok(h.read('standaloneMetroStartGeneration') > oldGeneration);
    assert.equal(h.read('standaloneMetroTimerId'), timer); assert.equal(h.ticks.length, count);
    h.advance(2); c.stopStandaloneMetronome(); assert.equal(h.timers.size, 0); assert.equal(h.sounds.size, 0);
});
test('テンポ変更中に画面を閉じると全予約を解除し、遅れたコールバックを無視', async () => {
    const h = metro(), c = h.c; await c.startStandaloneMetronome(); c.changePracticeTempo(5);
    const stale = [...h.timers.values()].map(t => t.fn); c.closePracticeModal();
    const count = h.ticks.length; stale.forEach(fn => fn()); h.advance(10);
    assert.equal(h.ticks.length, count); assert.equal(h.sounds.size, 0); assert.equal(h.timers.size, 0);
    assert.equal(h.read('standaloneIntervalStartTime'), 0);
    assert.equal(c.currentBpm, c.currentStage.bpm);
});
test('単独の初期化待ちでもテンポを変更でき、最新値だけで開始', async () => {
    const pending = deferred(), h = metro({ unlock: () => pending.promise }), c = h.c;
    const start = c.startStandaloneMetronome(); c.changePracticeTempo(5); c.updatePracticeControls(); enabled(c);
    pending.resolve(); await start; h.advance(3);
    for (let i = 1; i < h.ticks.length; i++) near(h.ticks[i].time - h.ticks[i - 1].time, 60 / 65);
    c.stopStandaloneMetronome();
});
for (const resolution of ['resolve', 'reject']) {
    test('開始待ちのテンポ変更・取消・新開始に古い' + resolution + 'が干渉しない', async () => {
        const a = deferred(), b = deferred(), h = metro({ unlock: i => [a, b][i].promise }), c = h.c;
        const old = c.startStandaloneMetronome(); c.changePracticeTempo(5); c.stopStandaloneMetronome();
        c.changePracticeTempo(5); const start = c.startStandaloneMetronome(); b.resolve(); await start;
        const timer = h.read('standaloneMetroTimerId'), count = h.ticks.length;
        if (resolution === 'resolve') a.resolve(); else a.reject(Error('old start failed')); await old;
        assert.equal(h.read('standaloneMetroTimerId'), timer); assert.equal(h.ticks.length, count);
        h.advance(3);
        for (let i = count; i < h.ticks.length; i++) near(h.ticks[i].time - h.ticks[i - 1].time, 60 / 70);
        assert.equal(h.warnings.length, 0); c.stopStandaloneMetronome();
    });
}
test('単独ONから通常練習へ移ると古い単独世代を破棄し、sessionBpm固定', async () => {
    const h = metro(), c = h.c; await c.startStandaloneMetronome(); c.changePracticeTempo(5);
    const oldCallbacks = [...h.timers.values()].map(t => t.fn); await c.startPractice();
    const session = c.practiceSession, count = h.ticks.length, timerCount = h.timers.size;
    oldCallbacks.forEach(fn => fn());
    assert.equal(h.read('isStandaloneMetroPlaying'), false); assert.equal(h.ticks.length, count);
    assert.equal(h.timers.size, timerCount); assert.equal(session.bpm, 65);
    c.changePracticeTempo(5); assert.equal(c.currentBpm, 65);
    c.currentBpm = 150; c.retimeStandaloneMetronome(); near(session.beatSec, 60 / 65);
    c.stopPractice();
});
for (const mode of ['practice', 'record']) {
    test(mode + '：実行中は単独用テンポ変更経路でもsessionBpmを変更しない', async () => {
        const h = practice({ bpm: 75 }), c = h.context; await c.startPractice(mode);
        const session = c.practiceSession;
        c.changePracticeTempo(5); assert.equal(c.currentBpm, 75);
        c.currentBpm = 130; h.advance(session.startTime + session.countInBeats * session.beatSec + 0.03);
        assert.equal(session.bpm, 75); near(session.beatSec, 60 / 75);
        assert.equal(c.modalTempoDownBtn.disabled, true); assert.equal(c.modalTempoUpBtn.disabled, true);
        c.stopPractice();
    });
}
test('テンポ調整はconfigとlocalStorageへ書き戻さない', () => {
    const h = boot(), beforeWrites = h.writes.length, beforeConfig = h.evaluate('JSON.stringify([TUTORIAL_STAGES,BASIC_STAGES])');
    h.evaluate('currentBpm = 60; changePracticeTempo(5); changePracticeTempo(5); changePracticeTempo(-5);');
    assert.equal(h.writes.length, beforeWrites); assert.equal(h.evaluate('JSON.stringify([TUTORIAL_STAGES,BASIC_STAGES])'), beforeConfig);
});
test('現在テンポのaria-labelには画面方向によらずBPMを保持', () => {
    const c = metro().c; c.currentBpm = 70; c.updateTempoControls();
    assert.equal(c.modalBpmBadge.innerText, '70'); assert.equal(c.modalBpmBadge.attributes['aria-label'], '現在のテンポ 70 BPM');
});
test('テンポ操作はメトロノームバー内1組のみでヘッダーへ重複しない', () => {
    const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
    const header = html.slice(html.indexOf('<div class="practice-modal-header">'), html.indexOf('<!-- ②'));
    const bar = html.slice(html.indexOf('<div id="visualMetronomeBox"'), html.indexOf('<!-- ③'));
    for (const id of ['modalTempoDownBtn', 'modalBpmBadge', 'modalTempoUpBtn']) {
        assert.equal((html.match(new RegExp('id="' + id + '"', 'g')) || []).length, 1);
        assert.ok(bar.includes('id="' + id + '"')); assert.ok(!header.includes('id="' + id + '"'));
    }
});
test('単位表示はCSSの縦横切替だけで行い、44pxのタップ領域を維持', () => {
    const css = fs.readFileSync(path.join(__dirname, '../css/style.css'), 'utf8');
    assert.match(css, /#modalBpmBadge::after\s*\{ content: " BPM"; \}/);
    assert.match(css, /@media \(orientation: portrait\)\s*\{\s*#modalBpmBadge::after\s*\{ content: none;/);
    assert.match(css, /\.modal-tempo-btn\s*\{\s*width: 44px; height: 44px;/);
});

