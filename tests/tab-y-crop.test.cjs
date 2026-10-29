const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const fixture = fs.readFileSync(path.join(__dirname, 'vertical-tab.test.cjs'), 'utf8');
const { Element, harness, boxes, validSvg } = vm.runInNewContext(
    fixture.slice(0, fixture.indexOf("test('実測したチュートリアル"))
    + '\n({ Element, harness, boxes, validSvg });', { require, __dirname, AbortController });
const plain = value => JSON.parse(JSON.stringify(value));

function digit(x, string, { top, bottom, text = '0', style, fill } = {}) {
    const y = 60.415 + 13 * (string - 1);
    const node = new Element('text', { x, y,
        style: style || 'font:14px Arial, sans-serif; dominant-baseline: middle', ...(fill ? { fill } : {}) }, text);
    const boxTop = top ?? y - 9.041667;
    node.getBBox = () => ({ x, y: boxTop, width: 7.79, height: (bottom ?? y + 6.291671) - boxTop });
    return node;
}

// EX2の実測と同じ弦Y・小節X・数字bbox。全弦の線片を70px未満に分断する。
function emScore({ height = 156, bars = 4, names = true, strings = [1, 2, 3, 4, 5, 6] } = {}) {
    const svg = new Element('svg', { width: 367, height });
    const splits = [156, 223.6, 290.6].slice(0, bars - 1);
    for (let index = 0; index < 6; index++) {
        const y = 59.83 + index * 13;
        for (let x = 35; x < 367; x += 40) {
            svg.append(new Element('rect', { x, y, width: Math.min(30, 367 - x), height: 1.17 }));
        }
        for (const x of splits) svg.append(new Element('rect', { x: x - 5, y, width: 10, height: 1.17 }));
    }
    for (const x of [35, ...splits, 357.46]) {
        svg.append(new Element('rect', { x, y: 59.83, width: 1.44, height: 66.17 }));
    }
    svg.append(new Element('rect', { x: 362.5, y: 59.83, width: 4.5, height: 66.17 }));
    svg.append(new Element('text', { x: 45.82 }, '\ue06d'),
        new Element('text', { x: 75.6 }, '\ue084'), new Element('text', { x: 75.6 }, '\ue084'));
    for (let bar = 0; bar < bars; bar++) {
        const x = [103.916, 168, 236, 304][bar];
        svg.append(new Element('text', { x: bar ? splits[bar - 1] + 1.44 : 91, y: 46.5,
            fill: '#C80000', style: 'font:11px Arial; dominant-baseline:hanging' }, String(bar + 1)));
        if (names) {
            const name = new Element('text', { x, y: 36,
                style: 'font:italic 12px Georgia; dominant-baseline:hanging' }, bar % 2 ? 'Am7' : 'Em7');
            name.getBBox = () => ({ x, y: 32.729, width: 25, height: 14 });
            svg.append(name);
        }
        for (const string of strings.filter(s => bar % 2 === 0 || s < 6)) svg.append(digit(x, string));
    }
    return svg;
}

function render(svg = emScore(), bars = 4) {
    const h = harness(); h.controller.createCardsFromRenderedSvg(svg, null, bars);
    validSvg(h.track); return h;
}
const bottom = box => Number((box[1] + box[3]).toFixed(10));

test('短い弦線片を統合した実6弦Yを使用し、旧70px条件による38～82へ戻らない', () => {
    const svg = emScore(), h = render(svg);
    assert.ok(svg.querySelectorAll('rect').filter(r => Number(r.getAttribute('height')) < 3)
        .every(r => Number(r.getAttribute('width')) < 70));
    assert.deepEqual(plain(h.context.detectTabGeometry(svg, 0, 367).ys), [59.83, 72.83, 85.83, 98.83, 111.83, 124.83]);
    for (const b of boxes(h.track)) { assert.equal(b[1], 21.8); assert.equal(bottom(b), 156); }
});

test('Em7の第1・第3小節で6弦0のbbox bottom=131.71全体がcrop内', () => {
    const svg = emScore(), h = render(svg);
    const digits = svg.querySelectorAll('text').filter(t => t.textContent === '0' && Number(t.getAttribute('y')) > 124);
    assert.equal(digits.length, 2);
    for (const index of [0, 2]) assert.ok(bottom(boxes(h.track)[index]) >= digits[index / 2].getBBox().y + digits[index / 2].getBBox().height);
});

test('Am7は通常のgeometry余白だけで、数字bboxによる追加拡張をしない', () => {
    const h = render();
    assert.deepEqual(plain(boxes(h.track)[1]), [155, 21.8, 69.6, 134.2]);
    assert.deepEqual(plain(boxes(h.track)[3]), [289.6, 21.8, 77.4, 134.2]);
});

for (const names of [true, false]) {
    for (const strings of [[6], [1], [1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5]]) {
        test(`コード名${names ? 'あり' : 'なし'}・弦${strings.join(',')}でも数字が収まりXを維持`, () => {
            const svg = emScore({ bars: 1, names, strings }), h = render(svg, 1), b = boxes(h.track)[0];
            assert.equal(b[0], 35); assert.equal(b[2], 332);
            for (const d of h.context.detectTabDigitBounds(svg, h.context.detectTabGeometry(svg, 0, 367))) {
                assert.ok(d.top >= b[1] && d.bottom <= bottom(b));
            }
        });
    }
}

test('必要な下端拡張はその数字を持つ小節だけに適用し、他カードは拡張しない', () => {
    const svg = emScore({ height: 220 }); svg.append(digit(103.916, 6, { bottom: 193.047 }));
    const h = render(svg), b = boxes(h.track);
    assert.equal(bottom(b[0]), 193.1);
    for (const index of [1, 2, 3]) assert.equal(bottom(b[index]), 170.9);
    assert.deepEqual(plain(b.map(v => [v[0], v[2]])), [[35, 122], [155, 69.6], [222.6, 69], [289.6, 77.4]]);
});

test('上端も数字bboxがはみ出す小節だけ拡張する', () => {
    const svg = emScore({ height: 220 }); svg.append(digit(236, 1, { top: 5.047 }));
    const b = boxes(render(svg).track);
    assert.equal(b[2][1], 5); assert.equal(bottom(b[2]), 170.9);
    for (const index of [0, 1, 3]) assert.equal(b[index][1], 21.8);
});

test('丸めで数字を切らず、viewBoxとclipPathに同じY・heightを書く', () => {
    const svg = emScore({ height: 220 }); svg.append(digit(168, 6, { top: 5.047, bottom: 193.047 }));
    const h = render(svg);
    for (const card of h.track.children) {
        const s = card.children[0], b = s.getAttribute('viewBox').split(' ').map(Number);
        const clip = s.querySelectorAll('clipPath')[0].children[0];
        assert.equal(Number(clip.getAttribute('y')), b[1]);
        assert.equal(Number(clip.getAttribute('height')), b[3]);
    }
    const b = boxes(h.track)[1]; assert.ok(b[1] <= 5.047 && bottom(b) >= 193.047);
});

for (const [name, text, attrs] of [
    ['TAB', 'TAB', {}], ['拍子の音楽glyph', '\ue084', {}],
    ['拍子の数字', '4', { style: 'font:36px alphaTab; dominant-baseline:middle' }],
    ['赤い小節番号', '1', { fill: '#C80000' }],
    ['小節番号のbaseline', '1', { style: 'font:11px Arial; dominant-baseline:hanging' }],
    ['コード名', 'Em7', {}], ['数字のコード名', '7', { style: 'font:12px Georgia; dominant-baseline:hanging' }],
    ['弦から離れた数字', '12', { y: 10 }]
]) {
    test(name + 'の大きいbboxをTAB数字として合算しない', () => {
        const svg = emScore(), node = digit(103.916, 1, { top: -100, bottom: 1000, text });
        for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
        svg.append(node);
        assert.deepEqual(plain(boxes(render(svg).track)), plain(boxes(render(emScore()).track)));
    });
}

test('多桁フレットも文字列一覧に依存せず認識する', () => {
    const svg = emScore({ height: 220 }); svg.append(digit(304, 6, { text: '24', bottom: 190.047 }));
    assert.equal(bottom(boxes(render(svg).track)[3]), 190.1);
});

test('geometry検出失敗でも取得できたTAB数字bboxで既存フォールバックを補正', () => {
    const svg = emScore({ bars: 1 }); svg.querySelectorAll('rect').forEach(r => r.remove());
    const h = render(svg, 1), b = boxes(h.track)[0];
    assert.equal(h.context.detectTabGeometry(svg, 0, 367), null);
    assert.equal(b[1], 0); assert.equal(bottom(b), 131.8);
});

test('bbox取得例外・NaN・Infinity・負の高さ・座標変換は無理に採用しない', () => {
    for (const bad of ['throw', NaN, Infinity, -1, 'transform']) {
        const svg = emScore({ bars: 1 }), node = digit(103.916, 6);
        if (bad === 'transform') node.setAttribute('transform', 'translate(0,1000)');
        else node.getBBox = () => {
            if (bad === 'throw') throw Error('unavailable');
            return { x: 103, y: 100, width: 8, height: bad };
        };
        svg.append(node); assert.deepEqual(plain(boxes(render(svg, 1).track)), [[35, 21.8, 332, 134.2]]);
    }
});

for (const height of [0.04, 30, 128, 145.03, 156, 193.1, 200]) {
    test('sourceHeight=' + height + 'を超えず有限・正のY cropと同期したclipを生成', () => {
        const h = render(emScore({ height, bars: 1 }), 1), b = boxes(h.track)[0];
        assert.ok(b[1] >= 0 && b[3] > 0 && bottom(b) <= height);
        const clip = h.track.children[0].children[0].querySelectorAll('clipPath')[0].children[0];
        assert.equal(Number(clip.getAttribute('height')), b[3]);
    });
}

test('数字が元SVG外でもcropはsourceHeightを超えない', () => {
    const svg = emScore({ bars: 1 }); svg.append(digit(103.916, 6, { bottom: 999 }));
    assert.equal(bottom(boxes(render(svg, 1).track)[0]), 156);
});

test('ピッキングglyphやコード名のbboxを全面統合せず、数字と既存記号は保持', () => {
    const svg = emScore({ bars: 1 }); const pick = new Element('text', { x: 104, y: 30 }, '\ue612');
    pick.getBBox = () => ({ x: 104, y: -100, width: 15, height: 1000 }); svg.append(pick);
    const h = render(svg, 1); assert.deepEqual(plain(boxes(h.track)), [[35, 21.8, 332, 134.2]]);
    const texts = h.track.children[0].children[0].querySelectorAll('text').map(t => t.textContent);
    assert.ok(texts.includes('\ue612') && texts.includes('Em7') && texts.includes('\ue06d'));
});

test('Y拡張範囲に別の水平装飾線があっても08の最終小節X終端を変えない', () => {
    const svg = emScore({ height: 220, bars: 1 }); svg.setAttribute('width', 600);
    for (const y of [140, 150, 160, 170]) svg.append(new Element('rect', { x: 550, y, width: 30, height: 1 }));
    svg.append(digit(103.916, 6, { bottom: 190.047 }));
    const b = boxes(render(svg, 1).track)[0]; assert.equal(b[0] + b[2], 379); assert.equal(bottom(b), 190.1);
});

test('09複数partialのローカルY・global順・小節送りを維持', () => {
    const h = harness(), first = emScore({ height: 220 }), second = emScore({ bars: 1 });
    // 非最終partialの実小節線はSVGの右端。
    first.append(new Element('rect', { x: 365.56, y: 59.83, width: 1.44, height: 66.17 }));
    first.querySelectorAll('rect').filter(r => Number(r.getAttribute('height')) > 60
        && Number(r.getAttribute('x')) > 350 && Number(r.getAttribute('x')) < 365).forEach(r => r.remove());
    h.controller.createCardsFromRenderedPartials([
        { svg: first, firstBarIndex: 0, lastBarIndex: 3 }, { svg: second, firstBarIndex: 4, lastBarIndex: 4 }
    ], 5);
    assert.equal(h.track.children.length, 5); validSvg(h.track);
    assert.deepEqual(plain(h.track.children.map(c => c.dataset.barIndex)), ['0', '1', '2', '3', '4']);
    assert.equal(boxes(h.track)[4][0], 0); assert.equal(bottom(boxes(h.track)[4]), 156);
    h.controller.setCurrentBar(4, 'practice'); assert.equal(h.indicator.textContent, '小節 5 / 5');
});

for (const laps of [1, 3, 5, 20]) {
    test('1小節カードを' + laps + '周利用してもcrop・カード数を変更しない', () => {
        const h = render(emScore({ bars: 1 }), 1), card = h.track.children[0], original = plain(boxes(h.track));
        for (let lap = 0; lap < laps; lap++) h.controller.setCurrentBar(0, 'practice');
        assert.equal(h.track.children[0], card); assert.deepEqual(plain(boxes(h.track)), original);
    });
}
