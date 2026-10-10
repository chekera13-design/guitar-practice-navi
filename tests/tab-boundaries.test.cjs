const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 既存のSVG/DOM代替を再利用し、本番の小節線検出・カード生成を実行する。
const source = fs.readFileSync(path.join(__dirname, 'first-bar-margin.test.cjs'), 'utf8');
const { Element, harness, boxes, validSvg, renderedScore, cases } = vm.runInNewContext(
    source.slice(0, source.indexOf('for (const entry of cases)'))
    + '\n({ Element, harness, boxes, validSvg, renderedScore, cases });',
    { require, __dirname, AbortController });
const plain = value => JSON.parse(JSON.stringify(value));
function internalRects(svg) {
    return svg.querySelectorAll('rect').filter(rect => Number(rect.getAttribute('height')) > 60
        && Number(rect.getAttribute('width')) <= 4 && Number(rect.getAttribute('x')) > 100
        && Number(rect.getAttribute('x')) < Number(svg.getAttribute('width')) - 10);
}
function geometry(svg) {
    return harness().context.detectTabGeometry(svg, 0, Number(svg.getAttribute('width')));
}

test('6弦が70px未満へ分断されても、重複する線片を同一Yの1本として認識', () => {
    const svg = renderedScore(cases[2]);
    const bottom = svg.querySelectorAll('rect').filter(rect => Number(rect.getAttribute('y')) > 113
        && Number(rect.getAttribute('height')) <= 3);
    assert.ok(bottom.length > 5); assert.ok(bottom.every(rect => Number(rect.getAttribute('width')) < 70));
    // 重複した線片で弦の本数が増えたり、検出支持量が水増しされたりしない。
    bottom.forEach(rect => svg.append(rect.cloneNode(true)));
    const detected = geometry(svg);
    assert.deepEqual(plain(detected.ys), [48.83, 61.83, 74.83, 87.83, 100.83, 113.83]);
    assert.deepEqual(plain(detected.internalBarlines.map(rect => rect.x)), [255.56, 420.56]);
});

test('全6弦が短い線片だけでも実線の境界を取得できる', () => {
    const svg = renderedScore({ ...cases[2], whole: true });
    assert.ok(svg.querySelectorAll('rect').filter(rect => Number(rect.getAttribute('height')) <= 3)
        .every(rect => Number(rect.getAttribute('width')) < 70));
    const detected = geometry(svg);
    assert.equal(detected.ys.length, 6);
    assert.deepEqual(plain(detected.internalBarlines.map(rect => rect.x)), [255.56, 420.56]);
});

test('譜面外と弦の間の短い装飾線は弦Yとして採用しない', () => {
    const svg = renderedScore(cases[2]);
    for (const y of [5, 22, 53.4, 150]) svg.append(new Element('rect', { x: 200, y, width: 12, height: 1 }));
    const detected = geometry(svg);
    assert.deepEqual(plain(detected.ys), [48.83, 61.83, 74.83, 87.83, 100.83, 113.83]);
    assert.equal(detected.internalBarlines.length, 2);
});

for (const entry of cases) {
    test(entry.name + '：有限・昇順の実線境界と最終小節右端を維持', () => {
        const h = harness(), svg = renderedScore(entry);
        h.controller.createCardsFromRenderedSvg(svg, null, entry.markers.length);
        const result = boxes(h.track);
        const precise = h.context.detectMeasureBoundaries(svg, entry.markers.length, entry.width, 145);
        assert.deepEqual(plain(result), plain(entry.expected)); validSvg(h.track);
        assert.equal(result[0][0], 35);
        assert.equal(result.at(-1)[0] + result.at(-1)[2], entry.width);
        assert.ok(result.every((box, index) => box.every(Number.isFinite) && box[2] > 0
            && (index === 0 || box[0] > result[index - 1][0])));
        for (let index = 1; index < result.length; index++) {
            const actualLine = entry.boundaries?.[index - 1] ?? entry.markers[index] - 1.44;
            assert.ok(Math.abs(precise[index].x - (actualLine - 1)) < 1e-8);
            assert.ok(Math.abs(result[index][0] - (actualLine - 1)) < 0.051);
            if (Math.abs(actualLine - (entry.markers[index] - 10)) > 0.1) {
                assert.notEqual(result[index][0], entry.markers[index] - 11);
            }
        }
    });
}

test('全境界の実線が揃っていれば、離れた番号ラベルでも実線を優先', () => {
    const h = harness(), svg = renderedScore(cases[2]);
    svg.querySelectorAll('text').filter(t => t.getAttribute('fill') === '#C80000')
        .forEach((text, index) => { if (index) text.setAttribute('x', [0, 300, 460][index]); });
    h.controller.createCardsFromRenderedSvg(svg, null, 3);
    assert.deepEqual(plain(boxes(h.track)), plain(cases[2].expected));
});

test('番号ラベルがなくても実際の小節線から全境界を求める', () => {
    const h = harness(), svg = renderedScore(cases[2]);
    svg.querySelectorAll('text').filter(t => t.getAttribute('fill') === '#C80000').forEach(t => t.remove());
    h.controller.createCardsFromRenderedSvg(svg, null, 3);
    assert.deepEqual(plain(boxes(h.track)), plain(cases[2].expected));
});

for (const missingIndex of [0, 1]) {
    test('実線のない境界' + (missingIndex + 1) + 'だけ番号X−10へフォールバック', () => {
        const h = harness(), svg = renderedScore(cases[2]);
        internalRects(svg)[missingIndex].remove();
        h.controller.createCardsFromRenderedSvg(svg, null, 3);
        const result = boxes(h.track);
        const expectedStarts = missingIndex === 0 ? [35, 246, 419.6] : [35, 254.6, 411];
        assert.deepEqual(plain(result.map(box => box[0])), expectedStarts);
        assert.equal(result.at(-1)[0] + result.at(-1)[2], 497); validSvg(h.track);
    });
}

test('全実線がない場合は既存の番号推定で読み込める', () => {
    const h = harness(), svg = renderedScore(cases[2]); internalRects(svg).forEach(rect => rect.remove());
    h.controller.createCardsFromRenderedSvg(svg, null, 3);
    assert.deepEqual(plain(boxes(h.track).map(box => [box[0], box[2]])), [[35, 213], [246, 167], [411, 86]]);
});

test('実線も番号も不足なら既存エラーでカードを生成しない', () => {
    const h = harness(), svg = renderedScore(cases[2]); internalRects(svg).forEach(rect => rect.remove());
    svg.querySelectorAll('text').filter(t => t.getAttribute('fill') === '#C80000').forEach(t => t.remove());
    assert.throws(() => h.controller.createCardsFromRenderedSvg(svg, null, 3), /境界/);
    assert.equal(h.track.children.length, 0); assert.equal(h.controller.hasCards, false);
});

test('終止線を失われた途中境界の代わりに使わない', () => {
    const h = harness(), svg = renderedScore(cases[2]); internalRects(svg)[1].remove();
    svg.querySelectorAll('text').filter(t => t.getAttribute('fill') === '#C80000').forEach(t => t.remove());
    assert.throws(() => h.controller.createCardsFromRenderedSvg(svg, null, 3), /境界/);
});

test('実測EX2の終止線が小数誤差で右端を超えても途中境界に含めない', () => {
    const svg = renderedScore(cases[1]);
    const end = svg.querySelectorAll('rect').find(rect => Number(rect.getAttribute('width')) === 4.5);
    end.setAttribute('x', 425.50000000000006);
    assert.ok(Number(end.getAttribute('x')) + 4.5 > 430);
    assert.deepEqual(plain(geometry(svg).internalBarlines.map(rect => rect.x)), [255.56]);
    // 途中の小節線まで失われた場合、終止線で置き換えない。
    internalRects(svg).forEach(rect => rect.remove());
    svg.querySelectorAll('text').filter(t => t.getAttribute('fill') === '#C80000').forEach(t => t.remove());
    const h = harness();
    assert.throws(() => h.controller.createCardsFromRenderedSvg(svg, null, 2), /境界/);
});

for (const invalid of [NaN, Infinity, -Infinity, -20, 600]) {
    test('範囲外・不正な実線X=' + invalid + 'を採用しない', () => {
        const h = harness(), svg = renderedScore(cases[1]);
        internalRects(svg)[0].setAttribute('x', invalid);
        h.controller.createCardsFromRenderedSvg(svg, null, 2);
        assert.equal(boxes(h.track)[1][0], 246); validSvg(h.track);
    });
}

test('高さ不足の符幹・太い矩形・変換された矩形を小節線にしない', () => {
    for (const [attribute, value] of [['height', 40], ['width', 8], ['transform', 'translate(20 0)']]) {
        const h = harness(), svg = renderedScore(cases[1]); internalRects(svg)[0].setAttribute(attribute, value);
        h.controller.createCardsFromRenderedSvg(svg, null, 2);
        assert.equal(boxes(h.track)[1][0], 246); validSvg(h.track);
    }
});

test('候補のDOM順序が逆でも境界は昇順になり、重複候補は1本へ統合', () => {
    const h = harness(), svg = renderedScore(cases[2]);
    for (const rect of internalRects(svg).reverse()) { svg.append(rect); svg.append(rect.cloneNode(true)); }
    h.controller.createCardsFromRenderedSvg(svg, null, 3);
    assert.deepEqual(plain(boxes(h.track)), plain(cases[2].expected));
});

for (const pattern of ['quarter', 'whole', 'rest', 'multiple-strings', 'chord']) {
    test(pattern + '：音価・弦数によらず実線で切り抜き、各小節の音符/休符を含む', () => {
        const h = harness(), svg = renderedScore({ ...cases[2], whole: pattern === 'whole' || pattern === 'chord' });
        svg.querySelectorAll('text').filter(t => t.textContent === '0').forEach(t => t.remove());
        const noteXs = [[103.916, 140.806, 177.695, 214.585], [269.84, 306.5, 343.16, 379.81], [434.84]];
        noteXs.forEach((xs, bar) => {
            const chosen = pattern === 'whole' || pattern === 'chord' ? xs.slice(0, 1) : xs;
            chosen.forEach((x, index) => {
                for (let string = 0; string < (pattern === 'chord' ? 6 : 1); string++) {
                    svg.append(new Element('text', { x, y: 49.415 + string * 13 },
                        pattern === 'rest' && index === 1 ? '\ue4e5' : String(pattern === 'multiple-strings' ? bar : 0)));
                }
            });
        });
        h.controller.createCardsFromRenderedSvg(svg, null, 3); validSvg(h.track);
        const result = boxes(h.track);
        noteXs.forEach((xs, bar) => {
            for (const x of (pattern === 'whole' || pattern === 'chord' ? xs.slice(0, 1) : xs)) {
                assert.ok(x >= result[bar][0] && x + 8 < result[bar][0] + result[bar][2]);
            }
        });
        assert.ok(h.track.children[0].children[0].querySelectorAll('text').some(t => t.textContent === '\ue06d'));
    });
}

test('修正後の小節送り・現在小節表示と端でのボタン無効化を維持', () => {
    const h = harness(); h.controller.createCardsFromRenderedSvg(renderedScore(cases[2]), null, 3);
    const original = boxes(h.track);
    for (const index of [0, 1, 2, 1, 0]) {
        h.controller.setCurrentBar(index, 'button');
        assert.equal(h.indicator.textContent, `小節 ${index + 1} / 3`);
        assert.equal(h.previous.disabled, index === 0); assert.equal(h.next.disabled, index === 2);
    }
    assert.deepEqual(plain(boxes(h.track)), plain(original));
});
