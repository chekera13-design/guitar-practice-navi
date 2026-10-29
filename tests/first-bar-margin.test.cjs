const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 既存のDOM代替を共用し、実際のverticalTab.jsで切り抜き・カード生成を検証する。
const fixture = fs.readFileSync(path.join(__dirname, 'vertical-tab.test.cjs'), 'utf8');
const { Element, harness, score, boxes: fixtureBoxes, validSvg } = vm.runInNewContext(
    fixture.slice(0, fixture.indexOf("test('実測したチュートリアル"))
    + '\n({ Element, harness, score, boxes, validSvg });', { require, __dirname, AbortController });
const boxes = track => JSON.parse(JSON.stringify(fixtureBoxes(track)));

const cases = [
    { name: 'tutorial EX1', width: 166, markers: [91.076], whole: true,
        expected: [[35, 10.8, 131, 134.2]] },
    { name: 'tutorial EX2', width: 430, markers: [91.076, 257],
        expected: [[35, 10.8, 221.6, 134.2], [254.6, 10.8, 175.4, 134.2]] },
    { name: 'tutorial EX3', width: 497, markers: [91.076, 257, 422],
        expected: [[35, 10.8, 221.6, 134.2], [254.6, 10.8, 167, 134.2], [419.6, 10.8, 77.4, 134.2]] },
    { name: 'basic EX1', width: 946, markers: [91.076, 257, 522], boundaries: [255.56, 520.56],
        expected: [[35, 10.8, 221.6, 134.2], [254.6, 10.8, 267, 134.2], [519.6, 10.8, 426.4, 134.2]] },
    { name: 'basic EX2', width: 595, markers: [91.076, 257, 422],
        expected: [[35, 10.8, 221.6, 134.2], [254.6, 10.8, 167, 134.2], [419.6, 10.8, 175.4, 134.2]] }
];

function renderedScore({ width = 430, markers = [91.076, 257], boundaries, whole = false, left = 35 } = {}) {
    const svg = new Element('svg', { width, height: 145 });
    const splitXs = boundaries || markers.slice(1).map(x => x - 1.44);
    for (let string = 0; string < 6; string++) {
        const y = 48.83 + string * 13;
        // 全音符は全弦、4分音符は第6弦が短い線片に分割される元SVGを再現。
        if (whole || string === 5) {
            for (let x = left; x < width; x += 40) {
                svg.append(new Element('rect', { x, y, width: Math.min(30, width - x), height: 1.17 }));
            }
            svg.append(new Element('rect', { x: width - 12, y, width: 12, height: 1.17 }));
        } else svg.append(new Element('rect', { x: left, y, width: width - left, height: 1.17 }));
        // 実際のSVG同様、小節線の位置では数字による切れ目がない。
        for (const x of splitXs) {
            svg.append(new Element('rect', { x: x - 5, y, width: 10, height: 1.17 }));
        }
    }
    svg.append(new Element('rect', { x: left, y: 48.83, width: 1.44, height: 66.17 }));
    for (const x of [...splitXs, width - 9.54]) {
        svg.append(new Element('rect', { x, y: 48.83, width: 1.44, height: 66.17 }));
    }
    svg.append(new Element('rect', { x: width - 4.5, y: 48.83, width: 4.5, height: 66.17 }));
    markers.forEach((x, index) => svg.append(new Element('text', { x, fill: '#C80000' }, String(index + 1))));
    svg.append(new Element('text', { x: left + 10.82 }, '\ue06d'),
        new Element('text', { x: left + 40.6 }, '\ue084'), new Element('text', { x: left + 40.6 }, '\ue084'));
    for (let string = 0; string < 6; string++) svg.append(new Element('text', { x: left + 68.916,
        y: 49.415 + string * 13 }, '0'));
    return svg;
}

for (const entry of cases) {
    test(entry.name + '：左端・ヘッダーを維持し、内部境界は実際の小節線へ', () => {
        const h = harness();
        h.controller.createCardsFromRenderedSvg(renderedScore(entry), null, entry.markers.length);
        const after = boxes(h.track);
        const expected = JSON.parse(JSON.stringify(entry.expected));
        assert.deepEqual(after, expected);
        assert.equal(after.at(-1)[0] + after.at(-1)[2], entry.width);
        validSvg(h.track);
        const firstSvg = h.track.children[0].children[0];
        assert.equal(firstSvg.getAttribute('preserveAspectRatio'), 'xMidYMid meet');
        const texts = firstSvg.querySelectorAll('text');
        assert.equal(texts.filter(text => text.textContent === '\ue06d').length, 1);
        assert.equal(texts.filter(text => text.textContent === '\ue084').length, 2);
        assert.equal(texts.filter(text => text.textContent === '0').length, 6);
        // 実測したTAB/拍子/数字の右端まで切り抜き範囲に含む。
        for (const [left, right] of [[45.82, 62.49], [75.6, 92.53], [103.916, 111.71], [35, 36.44]]) {
            assert.ok(left >= after[0][0] && right <= after[0][0] + after[0][2]);
        }
        const clip = firstSvg.querySelectorAll('clipPath')[0].children[0];
        assert.equal(Number(clip.getAttribute('x')), 35);
        assert.equal(Number(clip.getAttribute('width')), expected[0][2]);
    });
}

for (const left of [0, 12, 47.25, 82.74]) {
    test('左端X=' + left + '：固定35pxや安全余白を使わず小節線の左端を保持', () => {
        const h = harness();
        h.controller.createCardsFromRenderedSvg(renderedScore({ left }), null, 2);
        assert.equal(boxes(h.track)[0][0], left);
        assert.ok(Math.abs(boxes(h.track)[0][0] + boxes(h.track)[0][2] - 256.56) < 0.051);
        const clip = h.track.children[0].children[0].querySelectorAll('clipPath')[0].children[0];
        assert.equal(Number(clip.getAttribute('x')), left);
        assert.ok(Math.abs(Number(clip.getAttribute('x')) + Number(clip.getAttribute('width')) - 256.56) < 0.051);
    });
}

test('検出できない左端小節線を終止線で代用せず、x=0へフォールバック', () => {
    const h = harness(); h.controller.createCardsFromRenderedSvg(score({ shortLines: true }), null, 1);
    assert.deepEqual(boxes(h.track)[0], [0, 10.8, 166, 149.1]);
});

for (const invalid of [NaN, Infinity, -Infinity, -1]) {
    test('不正な左端小節線X=' + invalid + 'は採用しない', () => {
        const h = harness(), svg = renderedScore();
        svg.querySelectorAll('rect').find(rect => Number(rect.getAttribute('height')) > 60).setAttribute('x', invalid);
        h.controller.createCardsFromRenderedSvg(svg, null, 2);
        assert.equal(boxes(h.track)[0][0], 0); validSvg(h.track);
    });
}

test('6本の弦を確認できない場合はx=0へフォールバック', () => {
    const h = harness(), svg = renderedScore();
    svg.querySelectorAll('rect').filter(rect => Number(rect.getAttribute('height')) <= 3
        && Number(rect.getAttribute('y')) > 110).forEach(rect => rect.remove());
    h.controller.createCardsFromRenderedSvg(svg, null, 2);
    assert.equal(boxes(h.track)[0][0], 0);
});

test('途中の小節線しかない場合は、全弦の開始位置との照合で除外', () => {
    const h = harness(), svg = renderedScore();
    svg.querySelectorAll('rect').find(rect => Number(rect.getAttribute('height')) > 60).remove();
    h.controller.createCardsFromRenderedSvg(svg, null, 2);
    assert.equal(boxes(h.track)[0][0], 0);
});

test('弦を横切らない符幹を左端小節線と判定しない', () => {
    const h = harness(), svg = renderedScore();
    svg.querySelectorAll('rect').find(rect => Number(rect.getAttribute('height')) > 60).setAttribute('height', 40);
    h.controller.createCardsFromRenderedSvg(svg, null, 2);
    assert.equal(boxes(h.track)[0][0], 0);
});

test('座標変換された線は推定せずフォールバック', () => {
    const h = harness(), svg = renderedScore();
    svg.querySelectorAll('rect').find(rect => Number(rect.getAttribute('height')) > 60).setAttribute('transform', 'translate(20 0)');
    h.controller.createCardsFromRenderedSvg(svg, null, 2);
    assert.equal(boxes(h.track)[0][0], 0);
});

test('検出した小節線が第1小節の右端以降なら従来の開始位置へ戻す', () => {
    const h = harness(), svg = renderedScore({ left: 260 });
    h.controller.createCardsFromRenderedSvg(svg, null, 2);
    assert.equal(boxes(h.track)[0][0], 0); validSvg(h.track);
});

test('複数候補では最も左の細い小節線を採用', () => {
    const h = harness(), svg = renderedScore();
    svg.append(new Element('rect', { x: 35.2, y: 48.83, width: 1.44, height: 66.17 }));
    h.controller.createCardsFromRenderedSvg(svg, null, 2);
    assert.equal(boxes(h.track)[0][0], 35);
});

test('第2・第3小節の送りと現在小節表示を維持', () => {
    const h = harness(); h.controller.createCardsFromRenderedSvg(renderedScore(cases[2]), null, 3);
    const before = boxes(h.track);
    for (const index of [1, 2, 1, 0]) {
        h.controller.setCurrentBar(index, 'button');
        assert.equal(h.indicator.textContent, `小節 ${index + 1} / 3`);
    }
    assert.deepEqual(boxes(h.track), before);
});

for (const repeats of [1, 3, 5, 20]) {
    test('1小節カードを' + repeats + '周しても再生成・座標変更しない', () => {
        const h = harness(); h.controller.createCardsFromRenderedSvg(renderedScore(cases[0]), null, 1);
        const card = h.track.children[0], originalBox = boxes(h.track);
        for (let index = 0; index < repeats; index++) h.controller.setCurrentBar(0, 'practice');
        assert.equal(h.track.children.length, 1); assert.equal(h.track.children[0], card);
        assert.deepEqual(boxes(h.track), originalBox);
    });
}
