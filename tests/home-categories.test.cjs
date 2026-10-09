const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

// 実際のアプリ起動・カード生成・選択処理を既存の代替DOMで実行する。
function fixture(file, marker, result) {
    const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
    return vm.runInNewContext(source.slice(0, source.indexOf(marker)) + '\n' + result, {
        require, __dirname, Blob, TextEncoder, AbortController, setImmediate
    });
}
const boot = fixture('storage.test.cjs', "for (const failure of ['getItem", 'boot;');
const scoreFixture = fixture('score-loading.test.cjs', "for (const state of ['idle'", 'harness;');
const practiceFixture = fixture('practice.test.cjs', 'for (const repeats of', 'harness;');
const verticalFixture = fixture('vertical-tab.test.cjs', "test('実測したチュートリアル", '({ harness, score });');
const config = import(pathToFileURL(path.join(__dirname, '../js/config.js')).href);

test('独立したチュートリアル・基礎編セクションがこの順で存在し、案内リンクも維持', () => {
    const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
    const sections = [...html.matchAll(/<section class="current-exercises" aria-labelledby="([^"]+)">([\s\S]*?)<\/section>/g)];
    assert.deepEqual(sections.map(section => section[1]), ['tutorialExercises', 'basicExercises']);
    assert.match(sections[0][2], /<h3 id="tutorialExercises">チュートリアル<\/h3>/);
    assert.match(sections[0][2], /id="tutorialExerciseGrid"/);
    assert.match(sections[1][2], /<h3 id="basicExercises">基礎編<\/h3>/);
    assert.match(sections[1][2], /id="exerciseGrid"/);
    assert.doesNotMatch(sections[0][2], /id="exerciseGrid"/);
    assert.doesNotMatch(sections[1][2], /id="tutorialExerciseGrid"/);
    assert.match(html, /href="#tutorialExercises"/);
    assert.match(fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8'),
        /import \{ TUTORIAL_STAGES, BASIC_STAGES \} from "\.\/config.js";/);
});

test('アプリ起動でチュートリアル3件・基礎編6件を別々に生成する', () => {
    const h = boot(); h.assertReady();
    assert.equal(h.tutorialCards.length, 3); assert.equal(h.cards.length, 6);
    assert.deepEqual(Array.from(h.tutorialCards, card => card.id), ['tutorial-1', 'tutorial-2', 'tutorial-3']);
    assert.deepEqual(Array.from(h.cards, card => card.id), ['basic-1', 'basic-2', 'basic-3', 'basic-4', 'basic-5', 'basic-6']);
});

test('各カードの内容・BPM・順序・availableがconfigの配列と一致する', async () => {
    const h = boot(), { TUTORIAL_STAGES, BASIC_STAGES } = await config;
    for (const [grid, cards, stages] of [[h.nodes.get('tutorialExerciseGrid'), h.tutorialCards, TUTORIAL_STAGES],
        [h.nodes.get('exerciseGrid'), h.cards, BASIC_STAGES]]) {
        let previousTitle = -1;
        stages.forEach((stage, index) => {
            const at = grid.innerHTML.indexOf(stage.title);
            assert.ok(at > previousTitle); previousTitle = at;
            for (const value of [stage.code, stage.subTitle, stage.desc, 'BPM ' + stage.bpm]) assert.ok(grid.innerHTML.includes(value));
            assert.equal(Number(cards[index].dataset.stageId), stage.id);
            assert.equal(cards[index].available, stage.available);
        });
    }
});

test('同じid:1でもクリックで元のカテゴリ内のステージオブジェクトを渡す', () => {
    const h = boot(), opened = [];
    h.context.openPracticeModal = stage => opened.push(stage);
    h.tutorialCards[0].dispatch('click'); h.cards[0].dispatch('click');
    assert.equal(opened[0], h.evaluate('TUTORIAL_STAGES[0]'));
    assert.equal(opened[1], h.evaluate('BASIC_STAGES[0]'));
    assert.equal(opened[0].id, opened[1].id); assert.notEqual(opened[0], opened[1]);
    assert.equal(new Set([...h.tutorialCards, ...h.cards].map(card => card.id)).size, 9);
});

for (const key of ['Enter', ' ']) {
    test('両カテゴリのキーボード操作 ' + JSON.stringify(key) + ' も正しいEXを開く', () => {
        const h = boot(), opened = []; let prevented = 0;
        h.context.openPracticeModal = stage => opened.push(stage);
        for (const card of [h.tutorialCards[0], h.cards[0]]) card.dispatch('keydown', { key, preventDefault() { prevented++; } });
        assert.equal(opened[0], h.evaluate('TUTORIAL_STAGES[0]'));
        assert.equal(opened[1], h.evaluate('BASIC_STAGES[0]')); assert.equal(prevented, 2);
    });
}

test('両セクションを再描画しても各カードのイベント登録は1回ずつ', () => {
    const h = boot(); h.evaluate('renderExerciseCards(); renderExerciseCards();'); h.assertReady();
    for (const id of ['tutorialExerciseGrid', 'exerciseGrid']) {
        for (const card of h.nodes.get(id).querySelectorAll('.exercise-card-available')) {
            assert.equal(card.listeners.click.length, 1); assert.equal(card.listeners.keydown.length, 1);
        }
    }
});

test('共通カード生成はavailable:falseの表示と操作不可を維持', () => {
    const h = boot(), stage = { ...h.evaluate('TUTORIAL_STAGES[0]'), available: false };
    h.context.lockedStages = [stage];
    h.evaluate('renderStageCards(tutorialExerciseGrid, lockedStages, "tutorial");');
    assert.match(h.nodes.get('tutorialExerciseGrid').innerHTML, /exercise-card-locked/);
    assert.match(h.nodes.get('tutorialExerciseGrid').innerHTML, /tabindex="-1"/);
    assert.match(h.nodes.get('tutorialExerciseGrid').innerHTML, /準備中/);
    assert.equal(h.nodes.get('tutorialExerciseGrid').querySelectorAll('.exercise-card-available').length, 0);
});

async function connection(options = {}) {
    const home = boot(), files = [], archives = [];
    const h = scoreFixture({ fetch: async file => {
        files.push(file);
        if (options.fail) return { ok: false, status: 404 };
        const bytes = fs.readFileSync(path.join(__dirname, '..', file));
        archives.push({ file, bytes });
        return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
    } }), c = h.c;
    // 通信・alphaTabは代替環境。実ファイルのMXL bytesが解凍処理へ渡ることを確認する。
    c.JSZip = c.window.JSZip = { loadAsync: async bytes => {
        const archive = archives.at(-1);
        assert.deepEqual(Buffer.from(bytes), archive.bytes);
        return { files: { 'score.xml': { async: async () => fs.readFileSync(path.join(__dirname, '..',
            archive.file.replace(/\.mxl$/, '.musicxml')), 'utf8') } } };
    } };
    let opening;
    home.context.openPracticeModal = stage => { opening = h.open(stage); };
    async function select(category, index = 0) {
        (category === 'tutorial' ? home.tutorialCards : home.cards)[index].dispatch('click');
        await opening;
    }
    function completeTutorial() {
        const tab = verticalFixture.harness(), svg = verticalFixture.score({ shortLines: true });
        c.verticalTabController = tab.controller;
        svg.isConnected = true; svg.childElementCount = 1;
        svg.getBoundingClientRect = () => ({ width: 400, height: 200 });
        c.document.getElementById('alphaTab').svg = svg;
        c.api.score = { masterBars: [{}] };
        c.api.scoreLoaded.emit(c.api.score); c.api.renderFinished.emit(); c.api.postRenderFinished.emit();
        return tab;
    }
    return { home, h, c, files, options, select, completeTutorial };
}

test('ホームの正式チュートリアルEX1が共通モーダルへBPM60・バッジ・説明・ガイドを渡す', async () => {
    const h = await connection(); await h.select('tutorial');
    const stage = h.home.evaluate('TUTORIAL_STAGES[0]'), c = h.c;
    assert.equal(c.currentStage, stage); assert.equal(c.currentBpm, 60);
    assert.equal(c.modalStageBadge.innerText, stage.stageBadge); assert.equal(c.modalStageTitle.innerText, stage.title);
    assert.equal(c.modalStageDesc.innerText, stage.desc); assert.equal(c.modalBpmBadge.innerText, 'BPM 60');
    assert.equal(c.stageGuideTitle.innerText, stage.guide.title);
    for (const text of [stage.guide.content, ...stage.guide.points]) assert.ok(c.stageGuideBody.innerHTML.includes(text));
    assert.equal(c.practiceModal.classList.contains('hidden'), false);
});

test('チュートリアルのMXLパスで取得・読込し、実際の縦型TAB生成で1枚を準備する', async () => {
    const h = await connection(); await h.select('tutorial');
    assert.deepEqual(h.files, ['scores/tutorial/ex01.mxl']);
    assert.match(new TextDecoder().decode(h.c.api.loadCalls[0]), /<type>whole<\/type>/);
    assert.equal(h.c.scoreLoadState, 'loading'); assert.equal(h.c.mainActionBtn.disabled, true);
    const tab = h.completeTutorial();
    assert.equal(h.c.scoreLoadState, 'ready'); assert.equal(h.c.preparedScore.bars, 1);
    assert.equal(tab.track.children.length, 1);
    assert.equal(tab.track.children[0].children[0].getAttribute('viewBox'), '0.0 0.0 166.0 128.0');
    assert.equal(h.c.mainActionBtn.disabled, false); assert.equal(h.c.recordPracticeBtn.disabled, false);
});

test('閉じて基礎編EX1へ移動してもid:1が衝突せず、古いチュートリアル完了を無視', async () => {
    const h = await connection(); await h.select('tutorial'); h.completeTutorial();
    const oldApi = h.c.api; h.c.closePracticeModal(); await h.select('basic');
    const basic = h.home.evaluate('BASIC_STAGES[0]');
    assert.equal(h.c.currentStage, basic); assert.equal(h.c.currentBpm, basic.bpm);
    assert.equal(h.files.at(-1), basic.file); assert.equal(h.c.modalStageBadge.innerText, basic.stageBadge);
    h.h.complete(oldApi, 1); assert.equal(h.c.scoreLoadState, 'loading');
    h.h.complete(h.c.api, 4); assert.equal(h.c.scoreLoadState, 'ready');
    assert.equal(h.c.preparedScore.stage, basic); assert.equal(h.c.preparedScore.bars, 4);
});

test('チュートリアル読込失敗後も同じEXの再試行で正しいMXLを読み直す', async () => {
    const h = await connection({ fail: true }); await h.select('tutorial');
    assert.equal(h.c.scoreLoadState, 'error'); assert.equal(h.c.mainActionBtn.disabled, true);
    assert.equal(h.c.retryScoreBtn.hidden, false); h.options.fail = false;
    await h.c.retryScoreBtn.activate();
    assert.deepEqual(h.files, ['scores/tutorial/ex01.mxl', 'scores/tutorial/ex01.mxl']);
    h.completeTutorial(); assert.equal(h.c.scoreLoadState, 'ready'); assert.equal(h.c.preparedScore.bars, 1);
});

for (const repeat of ['1', '3', '5', 'unlimited']) {
    test('ホームから選んだ正式チュートリアルを既存の練習 ' + repeat + ' で1小節ずつ周回', async () => {
        const home = boot(); let stage; home.context.openPracticeModal = selected => { stage = selected; };
        home.tutorialCards[0].dispatch('click');
        const h = practiceFixture({ bpm: stage.bpm, bars: stage.practiceBars }), c = h.context;
        c.currentStage = stage; h.prepareScore(); c.practiceRepeatSelect.value = repeat;
        await c.startPractice();
        const cycles = repeat === 'unlimited' ? 8 : Number(repeat);
        h.advance(0.3 + 4 + 4 * cycles + 0.01);
        assert.equal(c.isPracticing, repeat === 'unlimited');
        assert.equal(h.phases.filter(p => p.phase === 'count-in').length, 4);
        assert.ok(h.bars.every(bar => bar === 0)); assert.equal(h.micRequests(), 0);
        for (let i = 1; i < h.ticks.length; i++) assert.ok(Math.abs(h.ticks[i].time - h.ticks[i - 1].time - 1) < 1e-8);
        if (repeat === 'unlimited') { c.stopPractice(); assert.equal(h.timers.size, 0); }
    });
}

test('ホームから選んだチュートリアルの録音練習は回数設定を使わず1回・既存の終了タイミング', async () => {
    const home = boot(); let stage; home.context.openPracticeModal = selected => { stage = selected; };
    home.tutorialCards[0].dispatch('click');
    const h = practiceFixture({ bpm: stage.bpm, bars: stage.practiceBars }), c = h.context;
    c.currentStage = stage; h.prepareScore(); c.practiceRepeatSelect.value = 'unlimited';
    await c.startPractice('record'); h.advance(4.31);
    assert.equal(c.practiceSession.repeatCount, 1); assert.equal(h.recorders.length, 1);
    h.advance(12.41); assert.equal(c.isPracticing, false); assert.equal(h.urls.length, 1);
    assert.equal(c.recordResultCard.classList.contains('hidden'), false);
    assert.ok(Math.abs(h.recorders[0].startTime - 4.3) < 0.1);
    assert.ok(Math.abs(h.recorders[0].stopTime - 11.3) < 0.1);
});
