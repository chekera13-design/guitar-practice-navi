const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 奏法テストと同じXML DOM代替を使い、本番の前処理とモデル補完を検証する。
const domSource = fs.readFileSync(path.join(__dirname, 'technique-markers.test.cjs'), 'utf8');
const { parse } = vm.runInNewContext(domSource.slice(0, domSource.indexOf('const source ='))
    + '\n({ parse });', { require });
const source = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
class Chord {
    constructor() { this.name = ''; this.strings = []; this.barreFrets = []; this.showName = true; }
}
function harness(xml) {
    let doc;
    const c = vm.createContext({ console: { info() {} }, alphaTab: { model: { Chord } },
        DOMParser: class { parseFromString(xml) { doc = parse(xml); return doc; } },
        XMLSerializer: class { serializeToString(doc) { return doc; } } });
    vm.runInContext('let detectedSlurPairs=[]; let detectedSlashChords=[];\n'
        + source.slice(source.indexOf('function fixMuseScoreXml('), source.indexOf('// ★ スラー弧線'))
        + source.slice(source.indexOf('function applySlashChordNames('), source.indexOf('function getCompleteScorePartials('))
        + '\nthis.harmonies=()=>detectedSlashChords;', c);
    c.fixMuseScoreXml(xml);
    return { c, doc, harmonies: JSON.parse(JSON.stringify(c.harmonies())) };
}
const harmony = (root = 'G', bass = '', { rootAlter = 0, bassAlter = 0, kind = 'major', offset = 0 } = {}) =>
    `<harmony><root><root-step>${root}</root-step><root-alter>${rootAlter}</root-alter></root><kind>${kind}</kind>`
    + (bass ? `<bass><bass-step>${bass}</bass-step><bass-alter>${bassAlter}</bass-alter></bass>` : '')
    + `<offset>${offset}</offset></harmony>`;
const note = duration => `<note><duration>${duration}</duration></note>`;
const xml = measures => '<score-partwise><part id="P1">' + measures.map((m, i) =>
    `<measure number="${i + 1}"><attributes><divisions>1</divisions></attributes>${m}</measure>`).join('')
    + '</part></score-partwise>';
function score(namesByBar) {
    const shared = new Map(); let nextId = 0;
    const staff = { chords: new Map(), addChord(id, chord) { chord.staff = this; this.chords.set(id, chord); } };
    staff.bars = namesByBar.map(names => ({ voices: [{ beats: names.map((name, i) => {
        if (!shared.has(name)) {
            const chord = new Chord(); chord.name = name; chord.firstFret = 1;
            chord.strings = [0, 1, 2, 3, -1, -1]; chord.barreFrets = [1];
            chord.showDiagram = false; chord.showFingering = true;
            shared.set(name, chord); staff.addChord(name, chord);
        }
        return { id: nextId++, displayStart: i * 1920, chordId: name,
            get chord() { return staff.chords.get(this.chordId); } };
    }) }] }));
    return { tracks: [{ staves: [staff] }], staff, shared };
}
const names = s => s.staff.bars.flatMap(b => b.voices[0].beats.map(b => b.chord.name));

for (const [root, bass, options, initial, expected] of [
    ['G', 'B', {}, 'G', 'G/B'], ['G', '', {}, 'G', 'G'],
    ['C', 'E', {}, 'C', 'C/E'], ['D', 'F', { bassAlter: 1 }, 'D', 'D/F#'],
    ['B', 'D', { rootAlter: -1 }, 'Bb', 'Bb/D'],
    ['A', 'G', { kind: 'minor-seventh' }, 'Am7', 'Am7/G'],
    ['G', 'B', { bassAlter: -1 }, 'G', 'G/Bb'],
    ['F', 'C', { rootAlter: 1 }, 'F#', 'F#/C'],
    ['C', 'B', { bassAlter: -2 }, 'C', 'C/Bbb']
]) test(`${initial} + bass=${bass || 'なし'} → ${expected}`, () => {
    const h = harness(xml([harmony(root, bass, options) + note(4)])), s = score([[initial]]);
    h.c.applySlashChordNames(s);
    assert.equal(names(s)[0], expected);
    assert.equal(h.harmonies.length, bass ? 1 : 0);
    if (bass) assert.equal(h.harmonies[0].kind, options.kind || 'major');
});

test('EX10の9小節：共有Chordの通常Gを維持し、第2・第6小節だけ補完', () => {
    const xmlText = fs.readFileSync(path.join(__dirname, '../scores/basic/ex10.musicxml'), 'utf8');
    const h = harness(xmlText), s = score(['C', 'G', 'Am7', 'G', 'C', 'G', 'Am7', 'G', 'C'].map(n => [n]));
    assert.deepEqual(h.harmonies.map(h => h.barIndex), [1, 5]);
    assert.equal(s.staff.bars[1].voices[0].beats[0].chord, s.staff.bars[3].voices[0].beats[0].chord);
    h.c.applySlashChordNames(s);
    assert.deepEqual(names(s), ['C', 'G/B', 'Am7', 'G', 'C', 'G/B', 'Am7', 'G', 'C']);
    assert.equal(s.shared.get('G').name, 'G');
});

test('同じ小節内のG/BとGを小節内時刻で区別', () => {
    const h = harness(xml([harmony('G', 'B') + note(2) + harmony('G') + note(2)]));
    const s = score([['G', 'G']]); h.c.applySlashChordNames(s);
    assert.deepEqual(names(s), ['G/B', 'G']);
});

test('同じ小節内の2つのbassとharmony offsetを保持', () => {
    const h = harness(xml([harmony('C', 'E', { offset: 2 }) + note(2)
        + harmony('C', 'G', { offset: -2 }) + note(2)]));
    assert.deepEqual(h.harmonies.map(h => h.offsetTicks), [1920, 0]);
    const s = score([['C', 'C']]); h.c.applySlashChordNames(s);
    assert.deepEqual(names(s), ['C/G', 'C/E']);
});

test('再適用・再描画で二重slash追加やChord登録をしない', () => {
    const h = harness(xml([harmony('G', 'B') + note(4)])), s = score([['G']]);
    h.c.applySlashChordNames(s); const chord = s.staff.bars[0].voices[0].beats[0].chord;
    const count = s.staff.chords.size;
    h.c.applySlashChordNames(s); h.c.applySlashChordNames(s);
    assert.equal(names(s)[0], 'G/B'); assert.equal(s.staff.chords.size, count);
    assert.equal(s.staff.bars[0].voices[0].beats[0].chord, chord);
    assert.equal(chord.showDiagram, false); assert.equal(chord.showFingering, true);
    assert.deepEqual(chord.strings, [0, 1, 2, 3, -1, -1]);
});

test('partial境界を越えた第11小節だけ補完、SVG順序への依存なし', () => {
    const h = harness(xml(Array.from({ length: 12 }, (_, i) => harmony('G', i === 10 ? 'B' : '') + note(4))));
    const s = score(Array.from({ length: 12 }, () => ['G'])); h.c.applySlashChordNames(s);
    assert.deepEqual(names(s), Array.from({ length: 12 }, (_, i) => i === 10 ? 'G/B' : 'G'));
});

test('不正bass・不一致root・存在しないbeatは補完しない', () => {
    for (const [bass, options, initial] of [['Z', {}, 'G'], ['B', { bassAlter: Infinity }, 'G'],
        ['B', { bassAlter: 0.5 }, 'G'], ['B', {}, 'C'], ['B', { offset: 1 }, 'G']]) {
        const h = harness(xml([harmony('G', bass, options) + note(4)])), s = score([[initial]]);
        h.c.applySlashChordNames(s); assert.equal(names(s)[0], initial);
    }
});

test('次のXMLでbass検出状態をリセットし、harmony/XML本体は保持', () => {
    const h = harness(xml([harmony('G', 'B') + note(4)]));
    assert.equal(h.doc.querySelector('bass-step').textContent, 'B');
    h.c.fixMuseScoreXml(xml([harmony('G') + note(4)]));
    assert.equal(h.c.harmonies().length, 0);
});

test('世代確認後のscoreLoadedで補完し、SVG後処理に追加しない', () => {
    const handler = source.slice(source.indexOf('apiInstance.scoreLoaded.on'), source.indexOf('// renderFinished直後'));
    assert.ok(handler.indexOf('if (!isCurrentApi()) return;') < handler.indexOf('applySlashChordNames(score)'));
    assert.ok(handler.includes('applySlashChordNames(score)'));
    assert.equal(source.slice(source.indexOf('apiInstance.postRenderFinished.on'), source.indexOf('apiInstance.error.on'))
        .includes('applySlashChordNames'), false);
});
