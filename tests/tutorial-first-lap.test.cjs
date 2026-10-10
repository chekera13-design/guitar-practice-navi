const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 既存の実コード用fixtureで、AudioContext時刻・保存・カード表示を一緒に検証する。
const source = fs.readFileSync(path.join(__dirname, 'tutorial-completion.test.cjs'), 'utf8');
const { session, boot, completed: readCompleted, badge, KEY } = vm.runInNewContext(
    source.slice(0, source.indexOf("test('3問の順序")) + '\n({session,boot,completed,badge,KEY});',
    { require, __dirname, Blob, TextEncoder, AbortController, setImmediate });
const completed = home => Array.from(readCompleted(home));

function firstLapEnd(c) {
    const s = c.practiceSession;
    return s.startTime + (s.countInBeats + s.practiceBeats) * s.beatSec;
}

for (const id of [1, 2]) for (const repeat of ['1', '3', '5', 'unlimited']) {
    test(`EX${id}・${repeat}：1周の最後の拍を通過して完了、選択回数は継続`, async () => {
        const { home, h, c } = session(id);
        let marks = 0, displays = 0;
        const mark = c.markTutorialCompleted, display = home.context.updateTutorialCompletionDisplay;
        c.markTutorialCompleted = (...args) => { marks++; mark(...args); };
        home.context.updateTutorialCompletionDisplay = () => { displays++; display(); };
        c.practiceRepeatSelect.value = repeat;
        await c.startPractice();
        const active = c.practiceSession, end = firstLapEnd(c);
        h.advance(end - c.practiceSession.practiceBeats * c.practiceSession.beatSec);
        assert.deepEqual(completed(home), [], 'カウントイン終了では完了しない');
        h.advance(end - 0.03);
        assert.deepEqual(completed(home), [], '最後の拍が鳴っていても未完了');
        h.advance(end);
        assert.deepEqual(completed(home), [`tutorial-${id}`]);
        assert.equal(badge(home, id).hidden, false);
        assert.equal(active.firstLapCompleted, true);
        assert.equal(c.isPracticing, repeat !== '1');
        if (repeat !== '1') {
            assert.equal(c.practiceSession, active, '完了でセッションを作り直さない');
            assert.equal(h.timers.size, 1);
            h.advance(repeat === 'unlimited' ? end + 100 : active.finishTime + 0.03);
            assert.equal(c.isPracticing, repeat === 'unlimited');
        }
        assert.equal(marks, 1, '毎周回や終了時に完了処理を呼び直さない');
        assert.equal(displays, 1);
        assert.equal(home.writes.filter(([key]) => key === KEY).length, 1);
        assert.deepEqual(JSON.parse(home.saved.get(KEY)), [`tutorial-${id}`]);
        assert.equal(h.phases.filter(p => p.phase === 'count-in').length, 4);
        for (let i = 1; i < h.ticks.length; i++)
            assert.ok(Math.abs(h.ticks[i].time - h.ticks[i - 1].time - active.beatSec) < 1e-8);
        if (repeat !== 'unlimited') assert.equal(h.ticks.length, 4 + 4 * id * Number(repeat));
        assert.equal(h.micRequests(), 0);
        c.stopPractice();
        assert.equal(h.timers.size, 0);
        assert.deepEqual(completed(home), [`tutorial-${id}`]);
    });
}

for (const id of [1, 2]) for (const action of ['stop', 'close', 'switch', 'error']) {
    test(`EX${id}・1周目途中の${action}と古いタイマーで完了しない`, async () => {
        const { home, h, c } = session(id);
        c.practiceRepeatSelect.value = 'unlimited';
        await c.startPractice();
        h.advance(firstLapEnd(c) - 0.03);
        const oldTimer = [...h.timers.values()][0].fn;
        if (action === 'error') c.failPractice('test failure', Error('test'));
        else c.stopPractice();
        if (action === 'close') c.practiceModal.classList.add('hidden');
        if (action === 'switch') {
            c.currentStage = home.evaluate('TUTORIAL_STAGES[2]'); h.prepareScore();
            await c.startPractice();
        }
        oldTimer(); h.advance(100);
        assert.deepEqual(completed(home), []);
        assert.equal(badge(home, id).hidden, true);
        assert.equal(home.saved.has(KEY), false);
        c.stopPractice(); assert.equal(h.timers.size, 0);
    });
}

for (const id of [1, 2]) {
    test(`EX${id}・2周目途中停止後も完了維持、再開始は1周目から・再保存なし`, async () => {
        const { home, h, c } = session(id);
        c.practiceRepeatSelect.value = 'unlimited'; await c.startPractice();
        h.advance(firstLapEnd(c) + 0.5); c.stopPractice();
        assert.deepEqual(completed(home), [`tutorial-${id}`]);
        await c.startPractice();
        const active = c.practiceSession;
        assert.equal(active.firstLapCompleted, false);
        h.advance(active.startTime + active.countInBeats * active.beatSec + 0.03);
        assert.match(h.phases.at(-1).text, /練習 1\/∞/);
        h.advance(firstLapEnd(c)); c.stopPractice();
        assert.equal(home.writes.filter(([key]) => key === KEY).length, 1);
        assert.deepEqual(completed(boot({ saved: home.saved })), [`tutorial-${id}`]);
    });
}

for (const state of ['idle', 'loading', 'error']) {
    test(`譜面${state}では開始せず完了しない`, async () => {
        const { home, h, c } = session(1); c.scoreLoadState = state;
        await c.startPractice(); h.advance(100);
        assert.equal(c.isPracticing, false); assert.deepEqual(completed(home), []);
        assert.equal(h.timers.size, 0);
    });
}

test('1周目の音声エラーは完了せず、残った処理も復活しない', async () => {
    const { home, h, c } = session(2); await c.startPractice();
    c.scheduleTick = () => { throw Error('audio scheduling failed'); };
    h.advance(100);
    assert.equal(c.isPracticing, false); assert.equal(h.timers.size, 0);
    assert.deepEqual(completed(home), []);
});

test('EX3無制限の通常練習は何周しても未完了', async () => {
    const { home, h, c } = session(3); c.practiceRepeatSelect.value = 'unlimited';
    await c.startPractice(); h.advance(100); assert.equal(c.isPracticing, true);
    assert.deepEqual(completed(home), []); c.stopPractice();
});

for (const failure of [null, 'constructFail', 'startFail', 'stopFail', 'noData']) {
    test(`EX3録音${failure || '成功'}：1周目境界では完了せず、有効な録音確定条件を維持`, async () => {
        const { home, h, c } = session(3, failure ? { [failure]: true } : {});
        await c.startPractice('record'); h.advance(16.3);
        assert.deepEqual(completed(home), []);
        h.advance(21);
        assert.deepEqual(completed(home), failure ? [] : ['tutorial-3']);
        assert.equal(c.recordResultCard.classList.contains('hidden'), Boolean(failure));
    });
}

for (const failure of [null, 'readError', 'accessError', 'writeError']) {
    test(`保存${failure || '正常'}：1周完了後も継続・全3EXのみ全体完了`, async () => {
        const { home, h, c } = session(1, {}, failure ? { [failure]: Error('storage unavailable') } : {});
        for (const id of [1, 2]) {
            c.currentStage = home.evaluate(`TUTORIAL_STAGES[${id - 1}]`); h.prepareScore();
            c.practiceRepeatSelect.value = 'unlimited'; await c.startPractice();
            h.advance(firstLapEnd(c));
            assert.equal(c.isPracticing, true); c.stopPractice();
            assert.equal(home.nodes.get('tutorialCompletionStatus').hidden, true);
        }
        assert.deepEqual(completed(home), ['tutorial-1', 'tutorial-2']);
        c.currentStage = home.evaluate('TUTORIAL_STAGES[2]'); h.prepareScore();
        await c.startPractice('record'); h.advance(c.practiceSession.finishTime + 0.03);
        assert.deepEqual(completed(home), ['tutorial-1', 'tutorial-2', 'tutorial-3']);
        assert.equal(home.nodes.get('tutorialCompletionStatus').hidden, false);
        assert.equal(home.nodes.get('tutorialCategoryStatus').innerText, '✓ 完了');
        if (!failure) assert.deepEqual(completed(boot({ saved: home.saved })), completed(home));
    });
}
