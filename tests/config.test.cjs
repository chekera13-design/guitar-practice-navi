const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

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

test('Basicは空でない配列で正式EX1を含み、カテゴリ内のidが重複しない', async () => {
    const [entry] = await modules;
    const stages = entry.BASIC_STAGES;
    assert.ok(Array.isArray(stages) && stages.length > 0);
    assert.ok(stages.some(stage => stage.id === 1));
    assert.equal(new Set(stages.map(stage => stage.id)).size, stages.length);
    for (const stage of stages) assert.ok(Number.isSafeInteger(stage.id) && stage.id > 0);
});

test('Basicの表示・ファイル・公開状態は必要な型を持つ（説明文の完全一致には依存しない）', async () => {
    const [entry] = await modules;
    for (const stage of entry.BASIC_STAGES) {
        for (const field of ['code', 'stageBadge', 'title', 'subTitle', 'desc', 'file']) {
            assert.equal(typeof stage[field], 'string', field);
            assert.ok(stage[field].trim().length > 0, field);
        }
        assert.equal(typeof stage.available, 'boolean');
    }
});

test('BasicのBPM・拍子・カウントイン・練習小節数は有効な数値', async () => {
    const [entry] = await modules;
    for (const stage of entry.BASIC_STAGES) {
        assert.ok(Number.isFinite(stage.bpm) && stage.bpm > 0);
        assert.ok(Array.isArray(stage.timeSignature) && stage.timeSignature.length === 2);
        assert.ok(stage.timeSignature.every(value => Number.isSafeInteger(value) && value > 0));
        assert.ok(Number.isInteger(Math.log2(stage.timeSignature[1])));
        for (const field of ['countInBars', 'practiceBars']) {
            assert.ok(Number.isSafeInteger(stage[field]) && stage[field] > 0, field);
        }
    }
});

test('Basicのガイドはtitle・content・pointsの構造を維持', async () => {
    const [entry] = await modules;
    for (const { guide } of entry.BASIC_STAGES) {
        assert.ok(guide && typeof guide === 'object' && !Array.isArray(guide));
        for (const field of ['title', 'content']) {
            assert.equal(typeof guide[field], 'string'); assert.ok(guide[field].trim().length > 0);
        }
        assert.ok(Array.isArray(guide.points) && guide.points.length > 0);
        assert.ok(guide.points.every(point => typeof point === 'string' && point.trim().length > 0));
    }
});

test('Basic EX1の弦・開放音・拍子・小節数は参照譜面と一致する', async () => {
    const [entry] = await modules, stage = entry.EX1_STAGE;
    const xml = fs.readFileSync(path.join(__dirname, '..', stage.file.replace(/\.mxl$/, '.musicxml')), 'utf8');
    assert.equal((xml.match(/<measure\b/g) || []).length, stage.practiceBars);
    assert.match(xml, new RegExp(`<beats>${stage.timeSignature[0]}</beats>`));
    assert.match(xml, new RegExp(`<beat-type>${stage.timeSignature[1]}</beat-type>`));
    const notes = [...xml.matchAll(/<note\b[^>]*>([\s\S]*?)<\/note>/g)].map(match => match[1]);
    assert.ok(notes.length > 0);
    for (const note of notes) {
        assert.equal(Number(note.match(/<string>(\d+)<\/string>/)?.[1]), stage.string);
        assert.equal(Number(note.match(/<fret>(\d+)<\/fret>/)?.[1]), 0);
        assert.equal(note.match(/<step>([A-G])<\/step>/)?.[1] + note.match(/<octave>(\d+)<\/octave>/)?.[1], stage.noteName);
    }
    assert.match(xml, /<down-bow\b/); assert.match(xml, /<up-bow\b/);
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
