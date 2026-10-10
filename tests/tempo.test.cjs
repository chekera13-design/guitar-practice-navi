const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
function fixture(file, marker, result) {
    const text = fs.readFileSync(path.join(__dirname, file), 'utf8');
    return vm.runInNewContext(text.slice(0, text.indexOf(marker)) + '\n' + result,
        { require, __dirname, Blob, TextEncoder, AbortController, setImmediate });
}
const practice = fixture('practice.test.cjs', 'for (const repeats of', 'harness;');
const modal = fixture('score-loading.test.cjs', "for (const state of ['idle'", 'harness;');
const boot = fixture('storage.test.cjs', "for (const failure of ['getItem", 'boot;');
const config = import(pathToFileURL(path.join(__dirname, '../js/config.js')).href);
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function controls(c, bpm) { c.currentBpm = bpm; c.updateTempoControls(); }
function unlocked(c) { assert.equal(c.modalTempoDownBtn.disabled, false); assert.equal(c.modalTempoUpBtn.disabled, false); }
function locked(c) { assert.equal(c.modalTempoDownBtn.disabled, true); assert.equal(c.modalTempoUpBtn.disabled, true); }

for (const category of ['TUTORIAL_STAGES', 'BASIC_STAGES']) {
    test(category + '：全ステージで標準BPMを初期値にし、設定を変更せず±5できる', async () => {
        for (const stage of (await config)[category]) {
            const saved = JSON.stringify(stage), h = modal();
            await h.open(stage);
            assert.equal(h.c.currentBpm, stage.bpm);
            assert.equal(h.c.modalBpmBadge.innerText, String(stage.bpm));
            unlocked(h.c);
            h.c.modalTempoDownBtn.activate(); assert.equal(h.c.currentBpm, stage.bpm - 5);
            h.c.modalTempoUpBtn.activate(); assert.equal(h.c.currentBpm, stage.bpm);
            h.c.modalTempoUpBtn.activate(); assert.equal(h.c.modalBpmBadge.innerText, String(stage.bpm + 5));
            assert.equal(JSON.stringify(stage), saved);
            h.c.closePracticeModal();
        }
    });
}
test('83 BPMを丸めず初期化し、88／78へ5ずつ変更する', async () => {
    const h = modal(); await h.open({ ...h.stage, bpm: 83 });
    assert.equal(h.c.currentBpm, 83); h.c.modalTempoUpBtn.activate(); assert.equal(h.c.currentBpm, 88);
    h.c.modalTempoDownBtn.activate(); h.c.modalTempoDownBtn.activate(); assert.equal(h.c.currentBpm, 78);
});
for (const value of [NaN, Infinity, -Infinity, 0, -5, '80', null, undefined]) {
    test('不正な標準BPM ' + String(value) + ' は既定60へ安全に戻る', async () => {
        const h = modal(); await h.open({ ...h.stage, bpm: value });
        assert.equal(h.c.currentBpm, 60); unlocked(h.c); h.c.closePracticeModal();
    });
}
for (const [initial, delta, expected, side] of [[23, -5, 20, 'Down'], [198, 5, 200, 'Up'], [20, -5, 20, 'Down'], [200, 5, 200, 'Up']]) {
    test(initial + ' BPMから' + delta + '：上下限を超えず端のボタンを無効化', () => {
        const h = practice(), c = h.context; controls(c, initial);
        c.changePracticeTempo(delta); assert.equal(c.currentBpm, expected);
        c.changePracticeTempo(delta); assert.equal(c.currentBpm, expected);
        assert.equal(c['modalTempo' + side + 'Btn'].disabled, true);
        assert.equal(c['modalTempo' + (side === 'Down' ? 'Up' : 'Down') + 'Btn'].disabled, false);
        assert.equal(c.modalBpmBadge.innerText, String(expected));
    });
}
test('中間値では両方有効、未定義の変更幅では値を変更しない', () => {
    const c = practice().context; controls(c, 80); unlocked(c);
    for (const value of [0, 1, 10, NaN, Infinity]) c.changePracticeTempo(value);
    assert.equal(c.currentBpm, 80);
});
test('閉じて再オープンすると標準BPMへ戻り、別ステージへ引き継がない', async () => {
    const { BASIC_STAGES, TUTORIAL_STAGES } = await config, h = modal(), c = h.c;
    await h.open(BASIC_STAGES[0]); c.changePracticeTempo(-5); c.closePracticeModal(); locked(c);
    await h.open(BASIC_STAGES[0]); assert.equal(c.currentBpm, BASIC_STAGES[0].bpm);
    c.changePracticeTempo(5); await h.open(TUTORIAL_STAGES[0]); assert.equal(c.currentBpm, TUTORIAL_STAGES[0].bpm);
    c.closePracticeModal();
});
test('譜面読込中・失敗中でも停止中のテンポを変更でき、再試行後も一時値を維持', async () => {
    const h = modal(), c = h.c; await h.open({ ...h.stage, bpm: 80 });
    c.changePracticeTempo(-5); assert.equal(c.currentBpm, 75); assert.equal(c.mainActionBtn.disabled, true);
    c.api.error.emit(Error('score failure')); c.changePracticeTempo(-5); assert.equal(c.currentBpm, 70);
    await c.retryScoreLoad(); h.complete(); assert.equal(c.currentBpm, 70);
});
for (const repeat of ['1', '3', '5', 'unlimited']) {
    test('70 BPM・練習' + repeat + '：カウントイン・全周・表示追従が固定テンポ、終了後再設定可能', async () => {
        const h = practice({ bpm: 80, bars: 1 }), c = h.context;
        c.currentStage.bpm = 80; controls(c, 70); c.practiceRepeatSelect.value = repeat;
        await c.startPractice();
        const session = c.practiceSession;
        assert.equal(session.bpm, 70); assert.equal(session.beatSec, 60 / 70); locked(c);
        c.changePracticeTempo(5); assert.equal(c.currentBpm, 70);
        c.currentBpm = 120; c.updateTempoControls(); assert.equal(c.modalBpmBadge.innerText, '70');
        const cycles = repeat === 'unlimited' ? 7 : Number(repeat);
        h.advance(session.startTime + (session.countInBeats + session.practiceBeats * cycles) * session.beatSec + 0.04);
        assert.equal(h.phases.filter(p => p.phase === 'count-in').length, 4);
        for (let i = 1; i < h.ticks.length; i++) assert.ok(Math.abs(h.ticks[i].time - h.ticks[i - 1].time - 60 / 70) < 1e-8);
        assert.equal(c.scrollConfig.beatSec, 60 / 70);
        assert.equal(c.currentStage.bpm, 80);
        assert.equal(h.micRequests(), 0);
        if (repeat === 'unlimited') { assert.equal(c.isPracticing, true); c.stopPractice(); }
        assert.equal(c.isPracticing, false); unlocked(c);
        assert.equal(h.timers.size, 0);
    });
}
for (const state of ['isStartingPractice', 'isPracticing', 'isFinalizingRecording']) {
    test(state + 'ではUIと変更関数の両方でテンポをロック', () => {
        const c = practice().context; controls(c, 70); c[state] = true; c.updatePracticeControls(); locked(c);
        c.changePracticeTempo(-5); assert.equal(c.currentBpm, 70);
        c[state] = false; c.updatePracticeControls(); unlocked(c);
    });
}
test('音声初期化待ち前にBPMを確定し、待機中の別経路の値変更でも開始テンポは変わらない', async () => {
    const h = practice(), c = h.context, pending = deferred(); controls(c, 70);
    c.unlockAudioContext = () => pending.promise;
    const start = c.startPractice(); locked(c); c.currentBpm = 150; pending.resolve(); await start;
    assert.equal(c.practiceSession.bpm, 70); assert.equal(c.practiceSession.beatSec, 60 / 70); c.stopPractice();
});
test('マイク取得待ちでもBPMを確定し、待機中の値変更で録音テンポは変わらない', async () => {
    const pending = deferred(), h = practice({ micPromise: pending.promise }), c = h.context; controls(c, 50);
    const start = c.startPractice('record'); await new Promise(r => setImmediate(r)); locked(c);
    c.currentBpm = 140; pending.resolve(h.makeStream()); await start;
    assert.equal(c.practiceSession.bpm, 50); c.stopPractice(); unlocked(c);
});
test('手動停止後は変更可能で、次回は変更後のテンポを使う', async () => {
    const h = practice(), c = h.context; controls(c, 70); await c.startPractice(); h.advance(1);
    c.stopPractice(); unlocked(c); c.changePracticeTempo(5); await c.startPractice();
    assert.equal(c.practiceSession.bpm, 75); assert.equal(c.practiceSession.nextBeat > 0, true); c.stopPractice();
});
test('50 BPM録音：カウントイン・1回演奏・従来の余韻拍数・停止拍を維持し正常終了', async () => {
    const h = practice({ bars: 1 }), c = h.context; controls(c, 50); c.practiceRepeatSelect.value = '5';
    await c.startPractice('record'); const s = c.practiceSession, beat = 60 / 50;
    assert.equal(s.bpm, 50); assert.equal(s.repeatCount, 1); locked(c);
    const performAt = s.startTime + s.countInBeats * beat;
    h.advance(performAt + 0.04); assert.ok(Math.abs(h.recorders[0].startTime - performAt) < 0.026);
    assert.equal(c.scrollConfig.beatSec, beat);
    const stopAt = s.startTime + (s.totalSteps - 1) * beat;
    h.advance(stopAt + 0.04); assert.ok(Math.abs(h.recorders[0].stopTime - stopAt) < 0.026);
    h.advance(s.finishTime + 0.04); assert.equal(c.isPracticing, false); unlocked(c);
    assert.equal(h.urls.length, 1); assert.equal(h.phases.filter(p => p.phase === 'count-in').length, 4);
    for (let i = 1; i < h.ticks.length; i++) assert.ok(Math.abs(h.ticks[i].time - h.ticks[i - 1].time - beat) < 1e-8);
});
test('録音データ確定待ちの間はロックを維持し、遅いstop成功後に解除', async () => {
    const h = practice({ delayedStop: true }), c = h.context; controls(c, 70); await c.startPractice('record');
    const s = c.practiceSession; h.advance(s.finishTime + 0.04); assert.equal(c.isFinalizingRecording, true); locked(c);
    h.recorders[0].deliver(); unlocked(c);
});
for (const fault of ['audioFail', 'micFail', 'constructFail', 'startFail', 'stopFail', 'noData']) {
    test('エラー終了 ' + fault + ' 後はBPM操作へ復帰', async () => {
        const h = practice({ [fault]: true }), c = h.context; controls(c, 70);
        await c.startPractice('record');
        if (c.practiceSession) h.advance(c.practiceSession.finishTime + 0.04);
        assert.equal(c.isPracticing, false); assert.equal(c.isStartingPractice, false);
        assert.equal(c.isFinalizingRecording, false); unlocked(c); c.changePracticeTempo(5);
        assert.equal(c.currentBpm, 75); assert.equal(h.timers.size, 0);
    });
}
test('テンポ変更はlocalStorageへ書き込まない', () => {
    const h = boot(), before = h.writes.length;
    h.evaluate('currentBpm = 80; changePracticeTempo(-5); changePracticeTempo(5);');
    assert.equal(h.writes.length, before); assert.equal(h.evaluate('currentBpm'), 80);
});
test('BPM供給の変更でも演奏中redrawは既存AudioContext基準とsession拍長を維持', async () => {
    const h = practice({ bars: 4 }), c = h.context; controls(c, 70); await c.startPractice();
    const s = c.practiceSession;
    h.advance(s.startTime + (s.countInBeats + 5) * s.beatSec); c.resumePracticeScroll({ restoreImmediately: true });
    assert.equal(c.practiceSession, s); assert.equal(c.scrollConfig.beatSec, 60 / 70);
    assert.ok(Math.abs(c.scrollConfig.getElapsedSeconds() - 5 * s.beatSec) < 1e-8); c.stopPractice();
});
test('テンポUIは標準button・aria-label・live表示・44pxタップ領域', () => {
    const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
    for (const side of ['Down', 'Up']) {
        assert.match(html, new RegExp('<button id="modalTempo' + side + 'Btn" type="button"[^>]+aria-label="テンポを5 BPM'));
    }
    assert.match(html, /id="modalBpmBadge"[^>]+aria-live="polite"/);
    assert.match(fs.readFileSync(path.join(__dirname, '../css/style.css'), 'utf8'), /\.modal-tempo-btn\s*\{[^}]*width: 44px; height: 44px;/);
});

