const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createHash } = require('node:crypto');

// ソースを書き換えたVMではなく、NodeのESM読み込みで実際の相対importを検証。
const modules = Promise.all(['config.js', 'config/index.js', 'config/basic.js', 'config/tutorial.js']
    .map(file => import(pathToFileURL(path.join(__dirname, '../js', file)).href)));

test('config.jsの互換入口から既存4exportとチュートリアルを読み込める', async () => {
    const [entry] = await modules;
    assert.deepEqual(Object.keys(entry).sort(), ['BASIC_STAGES', 'EX1_STAGE', 'TUTORIAL_STAGES', 'defaultTuning', 'noteStrings'].sort());
    assert.equal(entry.EX1_STAGE, entry.BASIC_STAGES[0]);
    assert.deepEqual(entry.noteStrings, ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']);
    assert.deepEqual(entry.defaultTuning, { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 });
});

test('互換入口・カテゴリ集約・各カテゴリは同じ配列を再exportし、コピーしない', async () => {
    const [entry, index, basic, tutorial] = await modules;
    assert.equal(entry.BASIC_STAGES, index.BASIC_STAGES);
    assert.equal(index.BASIC_STAGES, basic.BASIC_STAGES);
    assert.equal(entry.EX1_STAGE, basic.EX1_STAGE);
    assert.equal(entry.TUTORIAL_STAGES, index.TUTORIAL_STAGES);
    assert.equal(index.TUTORIAL_STAGES, tutorial.TUTORIAL_STAGES);
});

test('既存基礎編6件の全フィールド・順序は移行前のスナップショットと一致', async () => {
    const [entry] = await modules;
    assert.equal(entry.BASIC_STAGES.length, 6);
    const digest = createHash('sha256').update(JSON.stringify(entry.BASIC_STAGES)).digest('hex');
    assert.equal(digest, 'dde9e677efe2bc43b0cad974d4bd590ffa9118570ab7607df90911112a23de4e');
});

test('チュートリアルEX1は別配列にあり、基礎編EX1のID・別名へ影響しない', async () => {
    const [entry] = await modules;
    assert.notEqual(entry.TUTORIAL_STAGES, entry.BASIC_STAGES);
    const tutorial = entry.TUTORIAL_STAGES[0], basic = entry.BASIC_STAGES[0];
    assert.equal(tutorial.id, 1); assert.equal(basic.id, 1);
    assert.notEqual(tutorial, basic); assert.notEqual(tutorial.file, basic.file);
    assert.equal(entry.EX1_STAGE, basic);
    assert.equal(basic.stageBadge, '基礎編 EX 1');
});

test('正式チュートリアルEX1は全弦開放の設定で、単音用string・noteNameを省略', async () => {
    const [entry] = await modules;
    assert.equal(entry.TUTORIAL_STAGES.length, 3);
    const stage = entry.TUTORIAL_STAGES[0];
    assert.equal(stage.title, 'EX 1: まずはギターの音を出してみよう');
    assert.equal(stage.stageBadge, 'チュートリアル EX 1');
    assert.equal(stage.subTitle, '全弦開放');
    assert.equal(stage.bpm, 60); assert.equal(stage.practiceBars, 1); assert.equal(stage.countInBars, 1);
    assert.deepEqual(stage.timeSignature, [4, 4]); assert.equal(stage.available, true);
    assert.equal(stage.file, 'scores/tutorial/ex01.mxl'); assert.equal(stage.guide.points.length, 3);
    assert.equal(Object.hasOwn(stage, 'string'), false); assert.equal(Object.hasOwn(stage, 'noteName'), false);
});

test('各カテゴリの相対楽譜パスはプロジェクトの既存ファイルへ解決できる', async () => {
    const [entry] = await modules;
    for (const stage of [...entry.BASIC_STAGES, ...entry.TUTORIAL_STAGES]) {
        assert.equal(fs.existsSync(path.join(__dirname, '..', stage.file)), true, stage.file);
    }
});
