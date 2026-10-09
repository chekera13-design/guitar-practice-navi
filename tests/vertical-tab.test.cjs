const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 切り抜き計算もカード生成も実際のverticalTab.jsを実行する。
// DOMだけを代替し、SVGへ書き込まれた属性とカードの再利用を検証する。
class Element {
    constructor(tag, attrs = {}, text = '') {
        this.tagName = tag; this.attrs = { ...attrs }; this.textContent = text;
        this.childNodes = []; this.dataset = {}; this.clientHeight = 360;
        this.style = { setProperty(key, value) { this[key] = value; } };
        const classes = new Set();
        this.classList = { add: c => classes.add(c), remove: c => classes.delete(c),
            toggle(c, value) { if (value) classes.add(c); else classes.delete(c); } };
    }
    get children() { return this.childNodes; }
    get firstChild() { return this.childNodes[0]; }
    getAttribute(name) { return this.attrs[name] ?? null; }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    removeAttribute(name) { delete this.attrs[name]; }
    append(...nodes) { nodes.forEach(node => this.appendChild(node)); }
    appendChild(node) { node.remove(); node.parent = this; this.childNodes.push(node); return node; }
    insertBefore(node, before) {
        node.remove(); node.parent = this;
        const index = this.childNodes.indexOf(before);
        this.childNodes.splice(index < 0 ? this.childNodes.length : index, 0, node);
    }
    remove() {
        if (this.parent) this.parent.childNodes.splice(this.parent.childNodes.indexOf(this), 1);
        this.parent = null;
    }
    replaceChildren() { [...this.childNodes].forEach(node => node.remove()); }
    querySelectorAll(selector) {
        if (selector.includes(',')) return selector.split(',').flatMap(part => this.querySelectorAll(part.trim()));
        const matches = node => selector[0] === '.' ? node.className === selector.slice(1) : node.tagName === selector;
        return this.childNodes.flatMap(node => [...(matches(node) ? [node] : []), ...node.querySelectorAll(selector)]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    getBoundingClientRect() { return { width: 0, height: 0 }; }
    addEventListener() {}
    cloneNode(deep) {
        const clone = new Element(this.tagName, this.attrs, this.textContent);
        if (this.viewBox) clone.viewBox = { baseVal: { ...this.viewBox.baseVal } };
        if (deep) clone.append(...this.childNodes.map(node => node.cloneNode(true)));
        return clone;
    }
}

function harness() {
    const writes = [];
    const document = {
        querySelectorAll: () => [],
        createElement: tag => new Element(tag),
        createElementNS(ns, tag) {
            const node = new Element(tag), set = node.setAttribute.bind(node);
            node.setAttribute = (name, value) => { writes.push({ name, value: String(value) }); set(name, value); };
            return node;
        }
    };
    const context = { document, AbortController, bindButtonActivation() {}, console: { info() {}, error() {} } };
    vm.createContext(context);
    const source = fs.readFileSync(path.join(__dirname, '../js/verticalTab.js'), 'utf8');
    vm.runInContext(source.replace(/^import .*;\s*/m, '').replace('export class', 'class') + '\nthis.Controller = VerticalTabController;', context);
    const track = new Element('section'); track.className = 'vertical-tab-cards';
    const viewport = new Element('div'); viewport.className = 'vertical-tab-viewport';
    const indicator = new Element('span'); indicator.className = 'vertical-bar-indicator';
    const previous = new Element('button'), next = new Element('button');
    const message = new Element('span'); message.className = 'vertical-tab-message';
    const elements = { '.vertical-tab-cards': track, '.vertical-tab-viewport': viewport,
        '.vertical-bar-indicator': indicator, '.vertical-tab-message': message,
        "[data-action='previous']": previous, "[data-action='next']": next };
    const controller = new context.Controller({ querySelector: key => elements[key] });
    return { controller, context, track, previous, next, indicator, writes };
}

function score({ bars = 1, markers = true, lines = true, contentEnd = 166, svgEnd = 166,
    splits = [], finalBarline = true, shortLines = false } = {}) {
    const svg = new Element('svg', { width: svgEnd + 'px', height: '200px' });
    if (lines) {
        for (let string = 0; string < 6; string++) {
            const y = 48.83 + 13 * string;
            if (shortLines) {
                svg.append(new Element('rect', { x: 35, y, width: 67.746, height: 1.17 }),
                    new Element('rect', { x: 113.2569, y, width: contentEnd - 113.2569, height: 1.17 }));
            } else svg.append(new Element('rect', { x: 35, y, width: contentEnd - 35, height: 1.17 }));
        }
    }
    for (const x of [...splits, ...(finalBarline ? [contentEnd - 9.54] : [])]) {
        svg.append(new Element('rect', { x, y: 48.83, width: 1.44, height: 66.17 }));
    }
    if (finalBarline) svg.append(new Element('rect', { x: contentEnd - 4.5, y: 48.83, width: 4.5, height: 66.17 }));
    if (markers) {
        for (let index = 0; index < bars; index++) svg.append(new Element('text', {
            x: index === 0 ? 91.076 : splits[index - 1] + 12, y: 35.5, fill: '#C80000'
        }, String(index + 1)));
    }
    svg.append(new Element('text', {}, '\ue06d'), new Element('text', {}, '\ue084'), new Element('text', {}, '\ue084'));
    for (let string = 0; string < 6; string++) svg.append(new Element('text', {
        x: 103.916, y: 49.415 + 13 * string
    }, '0'));
    return svg;
}

function boxes(track) {
    return track.children.map(card => card.children[0].getAttribute('viewBox').split(' ').map(Number));
}
function validSvg(track) {
    for (const card of track.children) {
        const svg = card.children[0], box = svg.getAttribute('viewBox').split(' ').map(Number);
        assert.ok(box.every(Number.isFinite)); assert.ok(box[2] > 0); assert.ok(box[3] > 0);
        for (const rect of svg.querySelectorAll('clipPath')[0].children) {
            for (const key of ['x', 'y', 'width', 'height']) assert.ok(Number.isFinite(Number(rect.getAttribute(key))));
            assert.ok(Number(rect.getAttribute('width')) > 0);
        }
        assert.doesNotMatch(JSON.stringify(svg.attrs), /NaN|Infinity/);
    }
}

test('実測したチュートリアルEX1の短い弦ライン：1枚・有限幅・全6弦とTAB/4/4を保持', () => {
    const h = harness(); h.controller.createCardsFromRenderedSvg(score({ shortLines: true }), null, 1);
    assert.equal(h.track.children.length, 1); validSvg(h.track);
    assert.equal(boxes(h.track)[0][2], 166);
    const svg = h.track.children[0].children[0], texts = svg.querySelectorAll('text');
    assert.equal(texts.filter(t => t.textContent === '0').length, 6);
    assert.equal(texts.filter(t => /[\ue000-\uf8ff]/.test(t.textContent)).length, 3);
    const [x, y, width, height] = boxes(h.track)[0];
    for (const note of texts.filter(t => t.textContent === '0')) {
        assert.ok(Number(note.getAttribute('x')) >= x && Number(note.getAttribute('x')) < x + width);
        assert.ok(Number(note.getAttribute('y')) >= y && Number(note.getAttribute('y')) < y + height);
    }
    assert.equal(h.indicator.textContent, '小節 1 / 1');
    assert.equal(h.previous.disabled, true); assert.equal(h.next.disabled, true);
});

test('1小節も最終小節も同じ実コンテンツ終端を使い、SVG余白・クレジットを除外', () => {
    for (const bars of [1, 3]) {
        const h = harness(), contentEnd = bars === 1 ? 166 : 900;
        const svg = score({ bars, contentEnd, svgEnd: 2000, splits: bars === 1 ? [] : [300, 600] });
        svg.append(new Element('text', { x: 1800, y: 190 }, 'Credit'));
        // 譜面外の装飾線も終端候補にはしない。
        svg.append(new Element('rect', { x: 1500, y: 195, width: 400, height: 1 }));
        h.controller.createCardsFromRenderedSvg(svg, null, bars); validSvg(h.track);
        const last = boxes(h.track).at(-1);
        assert.equal(last[0] + last[2], contentEnd + 12);
    }
});

test('複数小節の途中の境界は従来どおり、最後は終止線の太い部分を含む', () => {
    const h = harness(); h.controller.createCardsFromRenderedSvg(score({ bars: 3, contentEnd: 900, svgEnd: 940, splits: [300, 600] }), null, 3);
    assert.deepEqual(boxes(h.track).map(b => [b[0], b[2]]), [[0, 301], [299, 302], [599, 313]]);
    h.controller.setCurrentBar(2, 'button');
    assert.equal(h.indicator.textContent, '小節 3 / 3'); assert.equal(h.next.disabled, true);
    h.controller.setCurrentBar(1, 'practice'); assert.equal(h.indicator.textContent, '小節 2 / 3');
    validSvg(h.track);
});

test('赤い小節番号がない場合も小節線から分割し、最終小節は実コンテンツ終端', () => {
    const h = harness(); h.controller.createCardsFromRenderedSvg(score({ bars: 3, markers: false, contentEnd: 900, svgEnd: 2000, splits: [300, 600] }), null, 3);
    assert.deepEqual(boxes(h.track).map(b => [b[0], b[2]]), [[0, 301], [299, 302], [599, 313]]);
    validSvg(h.track);
});

test('次境界・赤い番号・終止線がなくても、1小節の実コンテンツ終端を使う', () => {
    const h = harness(); h.controller.createCardsFromRenderedSvg(score({ markers: false, finalBarline: false, svgEnd: 2000 }), null, 1);
    assert.equal(boxes(h.track)[0][2], 178); validSvg(h.track);
});

test('実コンテンツを確定できない場合はSVG幅へフォールバック', () => {
    const h = harness(); h.controller.createCardsFromRenderedSvg(score({ lines: false, svgEnd: 400 }), null, 1);
    assert.equal(boxes(h.track)[0][2], 400); validSvg(h.track);
});

test('viewBoxがある場合は属性幅より優先し、その右端へフォールバック', () => {
    const h = harness(), svg = score({ lines: false, markers: false, finalBarline: false, svgEnd: 2000 });
    svg.viewBox = { baseVal: { x: 100, y: 0, width: 400, height: 200 } };
    h.controller.createCardsFromRenderedSvg(svg, null, 1);
    assert.deepEqual(boxes(h.track)[0].slice(0, 3), [100, 0, 400]); validSvg(h.track);
});

for (const invalid of [NaN, Infinity, -Infinity, -100, 0]) {
    test('不正なSVG幅 ' + invalid + ' は属性へ渡さずカードを生成しない', () => {
        const h = harness(), svg = score({ svgEnd: invalid });
        assert.throws(() => h.controller.createCardsFromRenderedSvg(svg, null, 1), /不正/);
        assert.equal(h.track.children.length, 0); assert.equal(h.controller.hasCards, false);
        assert.equal(h.writes.length, 0);
    });
}

for (const invalid of [NaN, Infinity, -Infinity]) {
    test('不正なviewBox開始位置 ' + invalid + ' は属性へ渡さない', () => {
        const h = harness(), svg = score();
        svg.viewBox = { baseVal: { x: invalid, width: 166, height: 200 } };
        assert.throws(() => h.controller.createCardsFromRenderedSvg(svg, null, 1), /不正/);
        assert.equal(h.writes.length, 0); assert.equal(h.controller.hasCards, false);
    });
}

for (const invalid of [NaN, Infinity, -Infinity, -100, 0]) {
    test('不正なSVG高さ ' + invalid + ' は属性へ渡さない', () => {
        const h = harness(), svg = score(); svg.setAttribute('height', String(invalid));
        assert.throws(() => h.controller.createCardsFromRenderedSvg(svg, null, 1), /不正/);
        assert.equal(h.writes.length, 0); assert.equal(h.controller.hasCards, false);
    });
}

test('小数点1桁への丸めでゼロになる幅も描画前に拒否する', () => {
    const h = harness();
    assert.throws(() => h.controller.createCardsFromRenderedSvg(score({ svgEnd: 0.04,
        markers: false, lines: false, finalBarline: false }), null, 1), /不正/);
    assert.equal(h.writes.length, 0); assert.equal(h.controller.hasCards, false);
});

for (const splits of [[100, 90], [300, 300], [300, 700]]) {
    test('逆転・ゼロ幅・範囲外の境界 ' + splits + ' は全カードの描画前に拒否', () => {
        const h = harness(), svg = score({ bars: 3, contentEnd: 650, svgEnd: 680, splits, finalBarline: false });
        // 境界を正確に負・ゼロにし、既存の1px重なりでも正の幅にならない入力。
        if (splits[0] === splits[1]) svg.querySelectorAll('text').find(t => t.textContent === '3').setAttribute('x', 299);
        assert.throws(() => h.controller.createCardsFromRenderedSvg(svg, null, 3), /不正/);
        assert.equal(h.track.children.length, 0); assert.equal(h.writes.length, 0);
        assert.equal(h.controller.hasCards, false);
    });
}

test('複数小節の境界が取得不能なら固定幅で捏造せず失敗する', () => {
    const h = harness();
    assert.throws(() => h.controller.createCardsFromRenderedSvg(score({ markers: false, finalBarline: false }), null, 3), /境界/);
    assert.equal(h.writes.length, 0); assert.equal(h.controller.hasCards, false);
});

test('再描画失敗時に古いカード・準備完了状態を残さない', () => {
    const h = harness(); h.controller.createCardsFromRenderedSvg(score(), null, 1);
    assert.equal(h.controller.hasCards, true);
    assert.throws(() => h.controller.createCardsFromRenderedSvg(score({ svgEnd: Infinity }), null, 1), /不正/);
    assert.equal(h.track.children.length, 0); assert.equal(h.controller.barCount, 0);
    assert.equal(h.controller.hasCards, false); assert.equal(h.indicator.textContent, '小節 - / -');
});

const scoreSource = fs.readFileSync(path.join(__dirname, 'score-loading.test.cjs'), 'utf8');
const scoreFixture = vm.runInNewContext(scoreSource.slice(0, scoreSource.indexOf("for (const state of ['idle'")) + '\nharness;', {
    require, __dirname, Blob, TextEncoder, setImmediate
});
test('実際のカード座標エラーが既存の準備失敗・開始禁止・再試行成功へつながる', async () => {
    const h = scoreFixture(), c = h.c; await h.open();
    const tab = harness(); c.verticalTabController = tab.controller;
    const failures = []; c.console.error = (label, error) => failures.push(String(error));
    function render(svg) {
        svg.isConnected = true; svg.childElementCount = 1;
        svg.getBoundingClientRect = () => ({ width: 400, height: 200 });
        c.document.getElementById('alphaTab').svg = svg;
        c.api.score = { masterBars: [{}] };
        c.api.scoreLoaded.emit(c.api.score); c.api.renderFinished.emit(); c.api.postRenderFinished.emit();
    }
    render(score({ svgEnd: Infinity }));
    assert.match(failures[0], /縦型TABの譜面サイズ/);
    assert.equal(c.scoreLoadState, 'error'); assert.equal(c.preparedScore, null);
    assert.equal(c.mainActionBtn.disabled, true); assert.equal(c.recordPracticeBtn.disabled, true);
    assert.equal(c.retryScoreBtn.hidden, false); assert.equal(c.scoreLoadMessage.innerText, '譜面を読み込めませんでした');
    assert.equal(tab.controller.hasCards, false); assert.equal(tab.writes.length, 0);
    const audioRequests = h.audioRequests();
    await c.startPractice(); await c.startPractice('record');
    assert.equal(h.audioRequests(), audioRequests); assert.equal(h.micRequests(), 0);
    await c.retryScoreBtn.activate(); assert.equal(c.scoreLoadState, 'loading');
    const retryTab = harness(); c.verticalTabController = retryTab.controller;
    render(score({ shortLines: true }));
    assert.equal(c.scoreLoadState, 'ready'); assert.equal(c.preparedScore.bars, 1);
    assert.equal(c.mainActionBtn.disabled, false); assert.equal(c.recordPracticeBtn.disabled, false);
    validSvg(retryTab.track);
});

const practiceSource = fs.readFileSync(path.join(__dirname, 'practice.test.cjs'), 'utf8');
const practiceFixture = vm.runInNewContext(practiceSource.slice(0, practiceSource.indexOf('for (const repeats of')) + '\nharness;', {
    require, __dirname, Blob, TextEncoder, setImmediate
});
for (const repeat of ['1', '3', '5', 'unlimited']) {
    test('1小節の練習 ' + repeat + '：AudioContext基準の既存周回処理で同じカードを再利用', async () => {
        const tab = harness(); tab.controller.createCardsFromRenderedSvg(score({ shortLines: true }), null, 1);
        const card = tab.track.children[0], h = practiceFixture({ bars: 1 }), c = h.context;
        c.resetPracticeBar = () => tab.controller.resetToFirstBar();
        c.setPracticeBar = index => tab.controller.setCurrentBar(index, 'practice');
        c.practiceRepeatSelect.value = repeat;
        await c.startPractice();
        const cycles = repeat === 'unlimited' ? 8 : Number(repeat);
        h.advance(0.3 + 4 + 4 * cycles + 0.01);
        assert.equal(c.isPracticing, repeat === 'unlimited');
        assert.equal(tab.track.children.length, 1); assert.equal(tab.track.children[0], card);
        assert.equal(tab.controller.currentBarIndex, 0); assert.equal(tab.indicator.textContent, '小節 1 / 1');
        assert.equal(h.phases.filter(p => p.phase === 'count-in').length, 4);
        for (let i = 1; i < h.ticks.length; i++) assert.ok(Math.abs(h.ticks[i].time - h.ticks[i - 1].time - 1) < 1e-8);
        assert.equal(h.micRequests(), 0); validSvg(tab.track);
        if (repeat === 'unlimited') { c.stopPractice(); assert.equal(h.timers.size, 0); }
    });
}
