const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture(file, marker, expression) {
    const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
    return vm.runInNewContext(source.slice(0, source.indexOf(marker)) + '\n' + expression,
        { require, __dirname, AbortController, Blob, TextEncoder, setImmediate });
}
const tab = fixture('first-bar-margin.test.cjs', 'for (const entry of cases)',
    '({ Element, harness, boxes, validSvg, renderedScore, cases });');
const scoreFixture = fixture('score-loading.test.cjs', "for (const state of ['idle'", 'harness;');
const redrawFixture = fixture('scroll-redraw.test.cjs', "test('演奏していない", 'harness;');
const plain = value => JSON.parse(JSON.stringify(value));

function musicPartials(count) {
    const result = [];
    for (let first = 0; first < count; first += 10) {
        const bars = Math.min(10, count - first), final = first + bars === count;
        const width = first === 0 ? 222 + (bars - 1) * 172 : bars * 172;
        const markers = Array.from({ length: bars }, (_, i) => first === 0
            ? i === 0 ? 91.076 : 222 + (i - 1) * 172 : i * 172);
        const svg = tab.renderedScore({ width, markers, left: first === 0 ? 35 : 0 });
        svg.querySelectorAll('text').filter(t => t.getAttribute('fill') === '#C80000')
            .forEach((t, i) => { t.textContent = String(first + i + 1); });
        if (first) svg.querySelectorAll('text').filter(t => /[\ue000-\uf8ff]/.test(t.textContent)).forEach(t => t.remove());
        if (!final) {
            svg.querySelectorAll('rect').filter(r => Number(r.getAttribute('height')) > 60
                && Number(r.getAttribute('x')) > width - 12).forEach(r => r.remove());
            svg.append(new tab.Element('rect', { x: width - 1.44, y: 48.83, width: 1.44, height: 66.17 }));
        }
        result.push({ svg, partialIndex: result.length, firstBarIndex: first, lastBarIndex: first + bars - 1 });
    }
    return result;
}

for (const count of [1, 10, 11, 12, 20, 21, 31]) {
    test(count + '小節：全partialを統合して全体番号のカードを一度だけ反映', () => {
        const h = tab.harness(), partials = musicPartials(count);
        let commits = 0; const replace = h.track.replaceChildren.bind(h.track);
        h.track.replaceChildren = (...cards) => { commits++; replace(...cards); };
        h.controller.createCardsFromRenderedPartials(partials, count);
        assert.equal(commits, 1); assert.equal(h.track.children.length, count);
        assert.deepEqual(plain(h.track.children.map(card => Number(card.dataset.barIndex))), Array.from({ length: count }, (_, i) => i));
        assert.equal(h.controller.barCount, count); tab.validSvg(h.track);
        for (let i = 0; i < count; i++) assert.equal(h.track.children[i].children[0].getAttribute('aria-label'), `小節 ${i + 1} のTAB譜`);
        if (count > 10) {
            assert.equal(tab.boxes(h.track)[10][0], 0);
            assert.equal(h.track.children[10].children[0].querySelectorAll('text').some(t => /[\ue000-\uf8ff]/.test(t.textContent)), false);
        }
        h.controller.setCurrentBar(count - 1, 'button');
        assert.equal(h.indicator.textContent, `小節 ${count} / ${count}`);
        if (count > 10) {
            h.controller.setCurrentBar(9, 'button'); h.controller.nextButton.activate?.();
            h.controller.setCurrentBar(10, 'button'); assert.equal(h.indicator.textContent, `小節 11 / ${count}`);
        }
    });
}

test('partial末尾は実小節線、本当の末尾だけ実コンテンツ終端を使用', () => {
    const h = tab.harness(), partials = musicPartials(11);
    const last = partials[1].svg;
    // 最終SVGに余白を足しても08の実コンテンツ終端を使う。
    last.setAttribute('width', 300);
    h.controller.createCardsFromRenderedPartials(partials, 11);
    const boxes = tab.boxes(h.track);
    assert.equal(boxes[9][0] + boxes[9][2], Number(partials[0].svg.getAttribute('width')));
    assert.equal(boxes[10][0] + boxes[10][2], 184); // 弦終端172 + 既存の12px。
    assert.equal(boxes[0][0], 35); // 全体第1小節だけ余白除去。
});

test('partial末尾実線がなければ08の譜面末尾扱いで推定せず失敗', () => {
    const h = tab.harness(), partials = musicPartials(11), first = partials[0].svg;
    first.querySelectorAll('rect').filter(r => Number(r.getAttribute('height')) > 60
        && Number(r.getAttribute('x')) > 1700).forEach(r => r.remove());
    assert.throws(() => h.controller.createCardsFromRenderedPartials(partials, 11), /partial終端/);
    assert.equal(h.track.children.length, 0);
});

for (const entry of tab.cases) {
    test(entry.name + '：単一SVG互換入口とpartial入口の全切り抜き座標・ヘッダーが同一', () => {
        const a = tab.harness(), b = tab.harness(), bars = entry.markers.length;
        a.controller.createCardsFromRenderedSvg(tab.renderedScore(entry), null, bars);
        b.controller.createCardsFromRenderedPartials([{ svg: tab.renderedScore(entry), firstBarIndex: 0, lastBarIndex: bars - 1 }], bars);
        assert.deepEqual(plain(tab.boxes(b.track)), plain(entry.expected));
        assert.deepEqual(plain(tab.boxes(b.track)), plain(tab.boxes(a.track)));
        const glyphs = b.track.children[0].children[0].querySelectorAll('text').map(t => t.textContent);
        assert.ok(glyphs.includes('\ue06d')); assert.equal(glyphs.filter(t => t === '\ue084').length, 2);
    });
}

test('後半partial失敗時は前半だけDOMへ反映せず、古いカードも準備完了に残さない', () => {
    const h = tab.harness(); h.controller.createCardsFromRenderedPartials(musicPartials(1), 1);
    const partials = musicPartials(20); partials[1].svg.setAttribute('width', Infinity);
    let appended = 0; const append = h.track.append.bind(h.track);
    h.track.append = (...cards) => { appended += cards.length; append(...cards); };
    assert.throws(() => h.controller.createCardsFromRenderedPartials(partials, 20), /不正/);
    assert.equal(appended, 0); assert.equal(h.track.children.length, 0); assert.equal(h.controller.hasCards, false);
});

async function load({ bars = 20, ranges = [[0, 9], [10, 19], [-1, -1]], missing = -1,
    noBounds = -1, landscape = true, hidden = -1 } = {}) {
    const h = scoreFixture({ landscape }); await h.open();
    finish(h, { bars, ranges, missing, noBounds, hidden });
    return h;
}
function finish(h, { bars = 20, ranges = [[0, 9], [10, 19], [-1, -1]], missing = -1,
    noBounds = -1, hidden = -1, instance = h.c.api } = {}) {
    const container = h.c.document.getElementById('alphaTab'), svgs = [];
    instance.score = { masterBars: Array(bars).fill({}) };
    instance.scoreLoaded.emit(instance.score); instance.renderStarted.emit();
    ranges.forEach(([first, last], index) => {
        instance.renderer.partialLayoutFinished.emit({ id: 'partial-' + index, firstMasterBarIndex: first, lastMasterBarIndex: last });
        if (index === missing) return;
        const svg = { isConnected: true, childElementCount: 1, querySelector: () => ({}),
            parentElement: { layoutResultId: 'partial-' + index, renderedResultId: 'partial-' + index },
            getBoundingClientRect: () => ({ width: index === hidden ? 0 : 1000, height: 145 }) };
        svgs.push(svg);
    });
    container.querySelectorAll = () => svgs;
    instance.boundsLookup = { findMasterBarByIndex: i => i === noBounds ? null
        : { realBounds: { x: i * 172, y: 0, w: 172, h: 110 } } };
    instance.renderFinished.emit(); instance.postRenderFinished.emit();
    return svgs;
}

for (const [bars, ranges] of [[1, [[0, 0], [-1, -1]]], [20, [[0, 9], [10, 19], [-1, -1]]],
    [21, [[0, 9], [10, 19], [20, 20], [-1, -1]]]]) {
    test(bars + '小節：音楽partialだけを分類してready、クレジットは数えない', async () => {
        const h = await load({ bars, ranges });
        assert.equal(h.c.scoreLoadState, 'ready');
        const partials = h.c.preparedScore.partials;
        assert.equal(partials.length, ranges.length - 1);
        assert.deepEqual(plain(partials.map(p => [p.firstBarIndex, p.lastBarIndex])), ranges.slice(0, -1));
        assert.equal(h.c.isScoreReadyForPractice(), true);
    });
}

for (const [name, ranges] of [
    ['欠落', [[0, 9], [11, 19]]], ['重複', [[0, 9], [9, 19]]],
    ['逆順', [[10, 19], [0, 9]]], ['範囲外', [[0, 9], [10, 20]]],
    ['負数', [[-2, 9], [10, 19]]], ['非整数', [[0, 9], [10.5, 19]]],
    ['NaN', [[0, 9], [NaN, 19]]], ['逆範囲', [[0, 9], [10, 8]]],
    ['後半未通知', [[0, 9]]], ['クレジットのみ', [[-1, -1]]]
]) {
    test('partial範囲' + name + 'では横画面でもready・練習開始を許可しない', async () => {
        const h = await load({ ranges });
        assert.equal(h.c.scoreLoadState, 'error'); assert.equal(h.c.preparedScore, null);
        assert.equal(h.c.mainActionBtn.disabled, true); assert.equal(h.c.recordPracticeBtn.disabled, true);
        const before = h.audioRequests(); await h.c.startPractice(); assert.equal(h.audioRequests(), before);
    });
}

for (const options of [{ missing: 1 }, { noBounds: 11 }, { hidden: 1 }]) {
    test('全小節の補完可能性に頼らずpartial/boundsの実在を確認：' + JSON.stringify(options), async () => {
        const h = await load(options);
        assert.equal(h.c.scoreLoadState, 'error'); assert.equal(h.c.isScoreReadyForPractice(), false);
    });
}

test('ready後にSVG2だけ欠落させた完了通知でreadyを取り消す', async () => {
    const h = await load(), container = h.c.document.getElementById('alphaTab');
    const svgs = container.querySelectorAll(); container.querySelectorAll = () => svgs.filter((s, i) => i !== 1);
    h.c.api.postRenderFinished.emit();
    assert.equal(h.c.scoreLoadState, 'error'); assert.equal(h.c.mainActionBtn.disabled, true);
});

test('同一partial描画IDの重複通知ではreadyにしない', async () => {
    const h = scoreFixture({ landscape: true }); await h.open();
    h.c.api.renderStarted.emit();
    const event = { id: 'duplicate', firstMasterBarIndex: 0, lastMasterBarIndex: 9 };
    h.c.api.renderer.partialLayoutFinished.emit(event);
    h.c.api.renderer.partialLayoutFinished.emit(event);
    assert.equal(h.c.scoreLoadState, 'error'); assert.equal(h.c.mainActionBtn.disabled, true);
});

test('SVGの描画IDが現在partialと一致しなければreadyにしない', async () => {
    const h = await load();
    h.c.preparedScore.partials[1].svg.parentElement.renderedResultId = 'previous-render';
    h.c.api.postRenderFinished.emit(); assert.equal(h.c.scoreLoadState, 'error');
});

test('再描画開始で旧対応表を無効化し、旧partialと新partialを結合しない', async () => {
    const h = await load(), c = h.c;
    c.api.renderStarted.emit(); assert.equal(c.isScoreReadyForPractice(), false);
    assert.equal(c.mainActionBtn.disabled, true);
    c.api.renderer.partialLayoutFinished.emit({ id: 'new-second', firstMasterBarIndex: 10, lastMasterBarIndex: 19 });
    c.api.postRenderFinished.emit(); assert.equal(c.scoreLoadState, 'error');
});

test('同じSVGを異なるpartial範囲へ二重使用しない', () => {
    const h = tab.harness(), partials = musicPartials(20);
    partials[1].svg = partials[0].svg;
    assert.throws(() => h.controller.createCardsFromRenderedPartials(partials, 20), /partial小節範囲/);
    assert.equal(h.track.children.length, 0);
});

test('SVG2先頭に左端線があっても全体第1小節の余白除去を誤適用しない', () => {
    const h = tab.harness(), partials = musicPartials(11);
    partials[1].svg = tab.renderedScore({ width: 200, markers: [20], left: 10 });
    h.controller.createCardsFromRenderedPartials(partials, 11);
    assert.equal(tab.boxes(h.track)[10][0], 0);
    assert.equal(tab.boxes(h.track)[0][0], 35);
});

test('縦画面のカード数が不足した場合はreadyにしない', async () => {
    const h = scoreFixture({ landscape: false }); await h.open();
    h.c.verticalTabController.createCardsFromRenderedPartials = function() { this.hasCards = true; this.barCount = 10; };
    finish(h); assert.equal(h.c.scoreLoadState, 'error');
});

for (const action of ['close', 'switch', 'retry']) {
    test(action + '後の古いpartial/完了イベントを新しい対応表へ反映しない', async () => {
        const h = await load(), old = h.c.api;
        if (action === 'close') h.c.closePracticeModal();
        else if (action === 'switch') { await h.open({ ...h.stage, id: 2, file: 'two.xml' }); finish(h); }
        else { old.error.emit(Error('failure')); await h.c.retryScoreLoad(); finish(h); }
        const state = h.c.scoreLoadState, prepared = h.c.preparedScore;
        old.renderStarted.emit();
        old.renderer.partialLayoutFinished.emit({ id: 'old', firstMasterBarIndex: 0, lastMasterBarIndex: 999 });
        old.postRenderFinished.emit();
        assert.equal(h.c.scoreLoadState, state); assert.equal(h.c.preparedScore, prepared);
    });
}

test('完了後の遅延partialは収集終了済みの対応表を変えない', async () => {
    const h = await load(), prepared = h.c.preparedScore;
    h.c.api.renderer.partialLayoutFinished.emit({ id: 'late', firstMasterBarIndex: 0, lastMasterBarIndex: 999 });
    h.c.api.postRenderFinished.emit();
    assert.equal(h.c.scoreLoadState, 'ready'); assert.equal(h.c.preparedScore.partials.length, 2);
    assert.deepEqual(plain(h.c.preparedScore.partials.map(p => p.id)), plain(prepared.partials.map(p => p.id)));
});

test('横→縦→横で全体小節と演奏セッションを維持', async () => {
    const h = await load(), c = h.c;
    await c.startPractice(); const session = c.practiceSession;
    c.setPracticeBar(10); h.options.landscape = false; c.updatePracticeScoreLayout();
    assert.equal(c.verticalTabController.barCount, 20); assert.equal(c.isScoreReadyForPractice(), true);
    h.options.landscape = true; c.updatePracticeScoreLayout();
    assert.equal(c.practiceSession, session); assert.equal(c.currentPracticeBarIndex, 10);
});

test('SVG2のbar11以降も全体boundsで横追従・再描画復帰しRAFを増やさない', async () => {
    const h = await redrawFixture(), c = h.c;
    finish(h); await c.startPractice(); h.advance(45.3); // 開始4.3秒 + 10小節 + 1秒。
    h.frameAt(45.3); const session = c.practiceSession;
    assert.equal(c.currentPracticeBarIndex, 10); assert.ok(h.wrapper.scrollLeft > 1600);
    finish(h); assert.equal(c.practiceSession, session); assert.equal(h.frames.size, 1);
    assert.equal(c.currentPracticeBarIndex, 10); assert.equal(h.highlight.style.left, '1720px');
    h.frameAt(46.3); assert.ok(h.wrapper.scrollLeft > 1720); assert.equal(h.frames.size, 1);
});
