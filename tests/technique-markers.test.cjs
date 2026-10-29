const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// XML位置抽出と公開NoteBoundsによるSVG後処理を直接検証する小さなDOM代替。
class Element {
    constructor(tagName, attrs = {}, text = '') {
        this.tagName = tagName; this.attrs = attrs; this.children = []; this.text = text;
    }
    get textContent() { return this.text + this.children.map(c => c.textContent).join(''); }
    set textContent(value) { this.text = value; }
    appendChild(child) { child.parent = this; this.children.push(child); return child; }
    getAttribute(name) { return this.attrs[name] ?? null; }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    remove() { this.parent.children = this.parent.children.filter(c => c !== this); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    querySelectorAll(selector) {
        const all = this.children.flatMap(c => [c, ...c.querySelectorAll('*')]);
        const match = (node, term) => {
            if (term === '*') return true;
            if (term.startsWith('.')) return (node.attrs.class || '').split(' ').includes(term.slice(1));
            const parsed = term.match(/^([\w-]+)(?:\[([\w-]+)="([^"]*)"\])?$/);
            return parsed && node.tagName === parsed[1] && (!parsed[2] || node.attrs[parsed[2]] === parsed[3]);
        };
        return all.filter(node => selector.split(',').some(s => {
            const terms = s.trim().split(/\s+/);
            if (!match(node, terms.pop())) return false;
            let ancestor = node.parent;
            while (terms.length) {
                const term = terms.pop();
                while (ancestor && !match(ancestor, term)) ancestor = ancestor.parent;
                if (!ancestor) return false;
                ancestor = ancestor.parent;
            }
            return true;
        }));
    }
}
function parse(xml) {
    const doc = new Element('document'), stack = [doc];
    for (const token of xml.match(/<[^>]+>|[^<]+/g) || []) {
        if (/^<\?|^<!/.test(token)) continue;
        if (token.startsWith('</')) { stack.pop(); continue; }
        if (token.startsWith('<')) {
            const tag = token.match(/^<([\w-]+)/)[1], attrs = {};
            for (const a of token.matchAll(/([\w-]+)="([^"]*)"/g)) attrs[a[1]] = a[2];
            const node = stack.at(-1).appendChild(new Element(tag, attrs));
            if (!token.endsWith('/>')) stack.push(node);
        } else stack.at(-1).text += token;
    }
    return doc;
}
const source = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
function harness(xml) {
    let parsed;
    const c = vm.createContext({ console: { info() {}, warn() {} },
        DOMParser: class { parseFromString(xml) { parsed = parse(xml); return parsed; } },
        XMLSerializer: class { serializeToString(doc) { return doc; } },
        document: { createElementNS: (_, tag) => new Element(tag) } });
    vm.runInContext('let detectedSlurPairs=[];\n' + source.slice(source.indexOf('function fixMuseScoreXml('),
        source.indexOf('function handleWatermark(')) + '\nthis.pairs=()=>detectedSlurPairs;', c);
    c.fixMuseScoreXml(xml);
    return { c, parsed, pairs: JSON.parse(JSON.stringify(c.pairs())) };
}
function note({ fret = 0, string = 1, duration = 1, slur = '', tie = '', chord = false, voice = 1, rest = false } = {}) {
    return `<note>${chord ? '<chord/>' : ''}${rest ? '<rest/>' : ''}<duration>${duration}</duration><voice>${voice}</voice>`
        + (tie ? `<tie type="${tie}"/>` : '')
        + `<notations>${slur ? `<slur type="${slur}" number="1"/>` : ''}${tie ? `<tied type="${tie}"/>` : ''}`
        + `<technical><string>${string}</string><fret>${fret}</fret></technical></notations></note>`;
}
const direction = label => label ? `<direction><direction-type><words>${label}</words></direction-type></direction>` : '';
const xml = measures => `<score-partwise><part id="P1">${measures.map((m, i) => `<measure number="${i + 1}"><attributes><divisions>1</divisions></attributes>${m}</measure>`).join('')}</part></score-partwise>`;
function rendering(h, { partialSize = 10, omitted = [] } = {}) {
    const count = h.parsed.querySelectorAll('measure').length, beats = new Map(), bounds = new Map();
    const bars = Array.from({ length: count }, () => ({ voices: [{ beats: [] }] }));
    for (const pair of h.pairs) for (const p of [pair.start, pair.end]) {
        const key = `${p.barIndex}:${p.voiceIndex}:${p.offsetTicks}`;
        let beat = beats.get(key);
        if (!beat) {
            beat = { displayStart: p.offsetTicks, notes: [] };
            beats.set(key, beat);
            const voice = bars[p.barIndex].voices[p.voiceIndex] ||= { beats: [] };
            voice.beats.push(beat); bounds.set(beat, { notes: [] });
        }
        const n = { id: bounds.size * 100 + beat.notes.length, string: 7 - p.string, fret: p.fret };
        beat.notes.push(n);
        const suppressed = omitted.includes(`${p.barIndex}:${p.offsetTicks}`);
        bounds.get(beat).notes.push({ note: { ...n }, noteHeadBounds: {
            x: p.barIndex * 200 + 80 + p.offsetTicks / 24, y: suppressed ? 67 : 60,
            w: suppressed ? 0 : 8, h: suppressed ? 0 : 14 } });
    }
    const partials = [];
    for (let first = 0; first < count; first += partialSize) partials.push({
        firstBarIndex: first, lastBarIndex: Math.min(count - 1, first + partialSize - 1),
        x: first * 200, y: 0,
        svg: new Element('svg', { width: `${Math.min(partialSize, count - first) * 200}px` }) });
    const instance = { score: { tracks: [{ staves: [{ tuning: Array(6), bars }] }] },
        settings: { display: { resources: { tablatureFont: { size: 14 } } } },
        renderer: { boundsLookup: { findBeat: beat => bounds.get(beat) } } };
    h.c.renderSlursAndLabelsInSvg(instance, partials);
    return { partials, instance, bounds };
}
const labels = svg => svg.querySelectorAll('.alphaTab-slur-label').map(t => t.textContent);

for (const label of ['S', 'H', 'P', '']) test(`明示${label || '文字なし'}のslur：曲線保持、既定Hなし`, () => {
    const h = harness(xml([direction(label) + note({ slur: 'start', fret: 5 }) + note({ slur: 'stop', fret: 7 })]));
    assert.equal(h.pairs[0].label, label || null);
    const svg = rendering(h).partials[0].svg;
    assert.deepEqual(labels(svg), label ? [label] : []);
    assert.equal(svg.querySelectorAll('.alphatab-custom-slur').length, 1);
});

test('文字なし0→0・上行・下行でH/Pを推測しない', () => {
    for (const [from, to] of [[0, 0], [5, 7], [7, 5]]) {
        const h = harness(xml([note({ fret: from, slur: 'start' }) + note({ fret: to, slur: 'stop' })]));
        assert.deepEqual(labels(rendering(h).partials[0].svg), []);
    }
});

test('technicalに明示されたH/Pも保持', () => {
    for (const [tag, label] of [['hammer-on', 'H'], ['pull-off', 'P']]) {
        const first = note({ slur: 'start' }).replace('<technical>', `<technical><${tag} type="start">${label}</${tag}>`);
        const h = harness(xml([first + note({ slur: 'stop' })]));
        assert.deepEqual(labels(rendering(h).partials[0].svg), [label]);
    }
});

test('休符・chord・backup/forwardを含むXMLの小節内時刻を保持', () => {
    const h = harness(xml([note({ rest: true }) + note({ fret: 2, string: 3, slur: 'start' })
        + note({ chord: true, string: 2 }) + note({ fret: 4, string: 3, slur: 'stop' })
        + '<backup><duration>3</duration></backup><forward><duration>1</duration></forward>'
        + note({ voice: 2, slur: 'start' }) + note({ voice: 2, slur: 'stop' })]));
    assert.equal(h.pairs[0].start.offsetTicks, 960);
    assert.equal(h.pairs[0].end.offsetTicks, 1920);
    assert.equal(h.pairs[1].start.offsetTicks, 960);
    assert.equal(h.pairs[1].start.voiceIndex, 1);
});

test('XML20音・tie後続数字4個省略でも全4小節のSと位置が維持', () => {
    const measure = direction('S') + note({ fret: 2, string: 3, duration: 0.5, slur: 'start' })
        + note({ fret: 4, string: 3, duration: 0.5, slur: 'stop' }) + note({ duration: 1, tie: 'start' })
        + note({ duration: 1, tie: 'stop' }) + note();
    const h = harness(xml(Array(4).fill(measure)));
    assert.equal(h.parsed.querySelectorAll('note').length, 20);
    assert.equal(h.parsed.querySelectorAll('tie[type="stop"]').length, 4);
    const { partials, instance } = rendering(h);
    // alphaTabがtie後続4音を省略した16個の数字を置いて再描画する。
    for (let i = 0; i < 16; i++) partials[0].svg.appendChild(new Element('text', { x: i * 30 }, '0'));
    h.c.renderSlursAndLabelsInSvg(instance, partials);
    assert.equal(partials[0].svg.querySelectorAll('text').filter(t => /^\d+$/.test(t.textContent)).length, 16);
    assert.deepEqual(labels(partials[0].svg), ['S', 'S', 'S', 'S']);
    assert.deepEqual(partials[0].svg.querySelectorAll('.alphaTab-slur-label').map(t => Number(t.getAttribute('x'))), [94, 294, 494, 694]);
});

test('省略された音自体がslur端点でも0幅NoteBoundsから曲線を描画', () => {
    const h = harness(xml([note({ slur: 'start', tie: 'start' }) + note({ slur: 'stop', tie: 'stop' })]));
    const svg = rendering(h, { omitted: ['0:960'] }).partials[0].svg;
    assert.equal(svg.querySelectorAll('.alphatab-custom-slur').length, 1);
    assert.ok(!svg.children[0].attrs.d.includes('NaN'));
});

test('後半partialのglobal barをローカル座標へ変換し最終markerを保持', () => {
    const h = harness(xml(Array(12).fill(direction('S') + note({ slur: 'start' }) + note({ slur: 'stop' }))));
    const { partials, instance } = rendering(h);
    assert.deepEqual(partials.map(p => labels(p.svg).length), [10, 2]);
    assert.deepEqual(labels(partials[1].svg), ['S', 'S']);
    assert.deepEqual(partials[1].svg.querySelectorAll('.alphaTab-slur-label').map(t => Number(t.attrs.x)), [104, 304]);
    h.c.renderSlursAndLabelsInSvg(instance, partials);
    assert.deepEqual(partials.map(p => labels(p.svg).length), [10, 2]); // redrawで重複しない
});

test('公開boundsが欠落・不正なら数字の連番へ戻らず描画をスキップ', () => {
    const h = harness(xml([direction('S') + note({ slur: 'start' }) + note({ slur: 'stop' })]));
    const r = rendering(h);
    r.instance.renderer.boundsLookup.findBeat = () => ({ notes: [{ note: {}, noteHeadBounds: { x: NaN } }] });
    h.c.renderSlursAndLabelsInSvg(r.instance, r.partials);
    assert.equal(r.partials[0].svg.children.length, 0);
});

test('note boundsを有効にしpartialの原点を保持、縦型複製前にmarkerを描画', () => {
    assert.match(source, /includeNoteBounds:\s*true/);
    assert.match(source, /x: result\.x, y: result\.y/);
    const start = source.indexOf('apiInstance.postRenderFinished.on');
    assert.ok(source.indexOf('renderSlursAndLabelsInSvg(apiInstance, partials)', start)
        < source.indexOf('verticalTabController.createCardsFromRenderedPartials', start));
});
