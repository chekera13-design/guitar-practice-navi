const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const core = fs.readFileSync(path.join(root, 'diagnostics/scroll-ab-core.js'), 'utf8').replace(/^export /gm, '');
const Capture = vm.runInNewContext(core + '\nScrollABCapture;', { performance: { now: () => 100 } });
const helpers = vm.runInNewContext(core + '\n({ SCROLL_AB_CONDITIONS, SCROLL_AB_SEQUENCE, SCROLL_BACKGROUND_SEQUENCE, SCROLL_BACKGROUND_DESIGNS, SCROLL_DIAGNOSTIC_CLASSES, getComparisonProgress, applyDecorationCondition, observeCountInDecorations });');
const ui = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8').replace(/^export /gm, '');
function capture(condition = 'A', extra = {}) {
    const c = new Capture(condition, {});
    const wrapper = { scrollLeft: 0 };
    const info = { wrapper, totalBars: 12, beatsPerBar: 4, beatSec: 1, repeatCount: 1,
        audioClock: true, restoreImmediately: false, ...extra };
    c.start(info);
    function frame(audio, position, now = audio * 1000, display = audio) {
        c.beginFrame(now, audio, display);
        if (c.measuring) {
            c.afterDimensions(99, 1, 3); wrapper.scrollLeft = position;
            c.afterWrite(wrapper.scrollLeft); c.endFrame(0.25);
        }
    }
    return { c, frame, wrapper };
}
function complete(h) {
    h.frame(2.99, 0);
    for (let i = 0; i < 1800; i++) h.frame(3 + i / 60, Math.floor(i / 2));
    h.frame(33, 900);
    h.c.stop('practice-stopped');
    return h.c.result();
}

for (const condition of ['A', 'B', 'E', 'F', 'P2']) {
    test(condition + '：移動開始ではなく音声3～33秒で同じ30秒を採取し、停止後だけ集計', () => {
        const h = capture(condition);
        h.frame(0, 0); h.frame(2, 0);
        assert.equal(h.c.rows, 0);
        assert.throws(() => h.c.result(), /停止後/);
        const r = complete(h);
        assert.equal(r.validComparison, true); assert.equal(r.raf.count, 1800);
        assert.equal(r.scroll.writes, 1800); assert.equal(r.scroll.changed, 899);
        assert.equal(r.scroll.unchanged, 901); assert.equal(r.scroll.totalDistancePx, 899);
        assert.equal(r.scroll.maxStepPx, 1); assert.equal(r.scroll.additionalScrollLeftReads, 1801);
        assert.equal(r.dimensions.reads.clientWidth, 5400); assert.equal(r.dimensions.reads.scrollWidth, 1800);
        assert.equal(r.dimensions.expressionBlockMs.samples, 225);
        assert.equal(r.dimensions.expressionBlockMs.median, 1);
        assert.equal(r.raf.callbackMs.median, 0.25); assert.equal(r.displayMinusAudioMs.max, 0);
        assert.equal(r.condition, condition);
        assert.equal(r.conditionName, helpers.SCROLL_AB_CONDITIONS[condition].name);
        assert.equal(r.backgroundDesign, helpers.SCROLL_BACKGROUND_DESIGNS[condition] || null);
        assert.equal(r.raf.observedHz, 60);
        assert.deepEqual(Array.from(r.window.requestedAudioSeconds), [3, 33]);
    });
}
test('位置が一度も動かなくても3秒から計測し、静止割合100%を隠さない', () => {
    const h = capture(); h.frame(2.9, 0); h.frame(3, 0); h.frame(32.9, 0); h.frame(33.1, 0);
    h.c.stop('stopped'); const r = h.c.result();
    assert.equal(r.validComparison, true); assert.equal(r.scroll.unchangedRatio, 1);
    assert.ok(r.raf.gaps.over250ms > 0);
    assert.ok(Math.abs(r.window.endOvershootMs - 100) < 1e-8);
});
test('RAF間隔の閾値・最大移動幅・逆方向移動も実取得位置から集計する', () => {
    const h = capture(); h.frame(2.99, 0); h.frame(3, 10); h.frame(3.03, 12);
    h.frame(3.09, 9); h.frame(3.2, 15); h.frame(3.5, 15); h.frame(33, 15); h.c.stop('stopped');
    const r = h.c.result();
    assert.deepEqual(JSON.parse(JSON.stringify(r.raf.gaps)), { over25ms: 4, over50ms: 3, over100ms: 2, over250ms: 1 });
    assert.equal(r.scroll.totalDistancePx, 21); assert.equal(r.scroll.netDistancePx, 15);
    assert.equal(r.scroll.maxStepPx, 10);
});
test('表示時計と音声時計は同じ経過秒基準で差を保存する', () => {
    const h = capture(); h.frame(2.9, 0); h.frame(3, 1, 3000, 3.1); h.frame(33, 2); h.c.stop('stopped');
    assert.ok(Math.abs(h.c.result().displayMinusAudioMs.max - 100) < 1e-8);
});
test('iframeと親ページの時刻原点が異なっても寸法計時はiframeの時計を使う', () => {
    const c = new Capture('A', {}, () => {}, () => 500.75);
    c.start({ wrapper: { scrollLeft: 0 }, totalBars: 12, beatsPerBar: 4, beatSec: 1, repeatCount: 1, audioClock: true });
    c.beginFrame(2900, 2.9, 2.9); c.beginFrame(3000, 3, 3);
    c.afterDimensions(500.5, 1, 3); c.afterWrite(1); c.endFrame(1);
    c.beginFrame(33000, 33, 33); c.stop('stopped');
    assert.equal(c.result().dimensions.expressionBlockMs.median, 0.25);
});
test('33秒を越える長い中断は終了境界のRAF間隔としても記録する', () => {
    const h = capture(); h.frame(2.9, 0); h.frame(3, 1); h.frame(30, 10); h.frame(35, 20); h.c.stop('stopped');
    const r = h.c.result();
    assert.equal(r.window.endBoundary.rafIntervalMs, 5000);
    assert.equal(r.window.endOvershootMs, 2000);
    assert.equal(r.raf.count, 2, '終了境界確認フレームを区間内の書き込み数に混ぜない');
});
for (const reason of ['resize', 'orientationchange', 'document-hidden', 'stage-api-score-or-render-changed', 'audio-context-suspended', 'manual-score-interaction']) {
    test(reason + '混入は比較無効にする（部分結果の成功扱いなし）', () => {
        const h = capture(); h.frame(2.9, 0); h.frame(3, 1); h.c.invalidate(reason); h.frame(33, 10); h.c.stop(reason);
        const r = h.c.result(); assert.equal(r.validComparison, false); assert.ok(r.invalidReasons.includes(reason));
    });
}
test('33秒前の途中停止は無効、同じ結果を重複停止しても値を変えない', () => {
    const h = capture(); h.frame(2.9, 0); h.frame(3, 1); h.c.stop('early-stop');
    const first = JSON.stringify(h.c.result()); h.c.stop('again');
    assert.equal(JSON.stringify(h.c.result()).replace(/"createdAt":"[^"]+"/, ''), first.replace(/"createdAt":"[^"]+"/, ''));
    assert.equal(h.c.result().validComparison, false);
    assert.equal(h.c.result().raf.observedHz, null, '部分結果を30秒の観測頻度として扱わない');
});
for (const extra of [{ audioClock: false }, { restoreImmediately: true }, { beatSec: 0.5 }, { repeatCount: 3 }, { totalBars: 4 }]) {
    test('前提不一致を拒否：' + JSON.stringify(extra), () => {
        const h = capture('A', extra); assert.equal(h.c.phase, 'invalid');
    });
}
test('3秒を過ぎてからのRAF開始・巻き戻り・NaNは比較無効', () => {
    const late = capture(); late.frame(4, 0); assert.equal(late.c.phase, 'invalid');
    const rewind = capture(); rewind.frame(2.9, 0); rewind.frame(2, 0); assert.equal(rewind.c.phase, 'invalid');
    const nan = capture(); nan.frame(NaN, 0); assert.equal(nan.c.phase, 'invalid');
});
test('同じRAFタイムスタンプ・粗い音声時刻の反復を巻き戻りと誤認しない', () => {
    const h = capture(); h.frame(2.9, 0); h.frame(3, 1, 3000); h.frame(3, 1, 3000);
    assert.equal(h.c.phase, 'measuring'); assert.equal(h.c.rows, 2);
    h.frame(33, 2); h.c.stop('stopped');
    assert.equal(h.c.result().validComparison, true);
});
test('再描画でスクロールを再開した場合は混在させない', () => {
    const h = capture(); h.frame(2.9, 0); h.frame(3, 1);
    assert.equal(h.c.start(h.c.context), null); assert.equal(h.c.phase, 'invalid');
});
test('容量超過は無効。既存RAFやタイマーを自分で起動しない', () => {
    const h = capture(); h.frame(2.9, 0); h.c.rows = 8192; h.frame(3, 1);
    assert.equal(h.c.phase, 'invalid');
    assert.doesNotMatch(core, /requestAnimationFrame\s*\(|setInterval\s*\(|setTimeout\s*\(|new AudioContext/);
});

function scrollHarness(diagnostic) {
    let now = 0, elapsed = 0, next = 0, position = 0, reads = 0, cw = 0, sw = 0, writes = 0;
    const frames = new Map();
    const wrapper = { get clientWidth() { cw++; return 200; }, get scrollWidth() { sw++; return 4000; },
        get scrollLeft() { reads++; return position; }, set scrollLeft(value) { writes++; position = value; } };
    const c = { document: { querySelector: () => wrapper, getElementById: () => ({ style: {}, classList: { add() {}, remove() {} } }) },
        performance: { now: () => now }, requestAnimationFrame(fn) { frames.set(++next, fn); return next; },
        cancelAnimationFrame(id) { frames.delete(id); } };
    if (diagnostic) c.window = { __TAB_SCROLL_AB_DIAGNOSTIC__: diagnostic };
    vm.createContext(c); vm.runInContext(ui, c);
    vm.runInContext('cachedBarLayouts=Array.from({length:12},(_,i)=>({left:i*300,top:0,width:300,height:100}));cachedScoreEndX=3600;', c);
    c.startScoreContinuousScroll({ totalBars: 12, beatSec: 1, repeatCount: 1, getElapsedSeconds: () => elapsed });
    return { c, frames, wrapper, step(t, a) { now = t; elapsed = a; const [id, fn] = frames.entries().next().value;
        frames.delete(id); fn(t); return position; }, counts: () => ({ reads, cw, sw, writes }) };
}
test('通常入口は診断なし：追加scrollLeft取得0・寸法取得3/1・RAFは常に1本', () => {
    const h = scrollHarness(); h.step(0, 2); h.step(16, 2); h.step(32, 2);
    assert.deepEqual(h.counts(), { reads: 0, cw: 9, sw: 3, writes: 3 });
    assert.equal(h.frames.size, 1); h.c.stopScoreContinuousScroll(); assert.equal(h.frames.size, 0);
});
test('診断有無で補間後の書き込み位置は一致し、計測だけが追加される', () => {
    const capture = new Capture('B', {});
    const observed = scrollHarness({ scrollStart: info => capture.start(info), scrollStop: reason => { if (capture.started) capture.stop(reason); } });
    const normal = scrollHarness();
    for (let i = 0; i < 2100; i++) {
        const ms = i * 16, audio = Math.floor(ms / 64) * 0.064;
        assert.equal(observed.step(ms, audio), normal.step(ms, audio));
        assert.equal(observed.frames.size, 1);
    }
    observed.c.stopScoreContinuousScroll();
    assert.equal(capture.result().validComparison, true);
    assert.equal(observed.counts().writes, normal.counts().writes);
    assert.equal(observed.counts().cw, normal.counts().cw);
    assert.equal(observed.counts().reads, capture.rows + 1);
});
test('診断フック自体が失敗しても練習のRAF・書き込みを継続する', () => {
    let fault = 0;
    const h = scrollHarness({ scrollStart() { throw Error('test'); }, fault() { fault++; } });
    h.step(0, 2); assert.equal(h.frames.size, 1); assert.equal(h.counts().writes, 1); assert.equal(fault, 1);
});
test('A/Bページだけが診断を登録し、通常HTMLには入口・import・クエリ有効化がない', () => {
    const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const page = fs.readFileSync(path.join(root, 'diagnostics/scroll-ab.js'), 'utf8');
    assert.doesNotMatch(index, /scroll-ab|TAB_SCROLL_AB_DIAGNOSTIC/);
    assert.match(page, /child\.__TAB_SCROLL_AB_DIAGNOSTIC__ =/);
    assert.doesNotMatch(page, /requestAnimationFrame\s*\(|setInterval\s*\(|setTimeout\s*\(|new AudioContext/);
    const override = page.match(/export const decorationOverride = `([\s\S]*?)`;/)[1];
    assert.match(override, /#practiceModal\.scroll-ab-no-decoration/);
    const opaqueBackground = override.match(/#practiceModal\.scroll-ab-opaque-background \{ background: #0f172a !important; \}/);
    assert.ok(opaqueBackground, '不透明色はモーダル背面だけに適用する');
    const existingDecoration = override.replace(opaqueBackground[0], '');
    assert.doesNotMatch(existingDecoration, /[;{]\s*(?:background(?:-\w+)?|color|width|height|padding|display)\s*:/);
    assert.doesNotMatch(override, /practice-modal-content|score-wrapper|highlight|::before|::after/);
    assert.match(override, /\.beat-dot \{ box-shadow: none !important; transform: none !important; transition: none !important;/);
});

function classes(initial = []) {
    const values = new Set(initial);
    return { values, add(...names) { names.forEach(name => values.add(name)); },
        remove(...names) { names.forEach(name => values.delete(name)); }, contains: name => values.has(name) };
}
for (const [condition, backdrop, metro, cssClass] of [
    ['A', false, false, null], ['B', true, true, 'scroll-ab-no-decoration'],
    ['E', true, false, 'scroll-ab-no-backdrop'], ['F', false, true, 'scroll-ab-no-metronome'],
    ['P2', true, false, 'scroll-ab-opaque-background']
]) {
    test(condition + '：装飾の組み合わせ・条件名と適用classを正しく管理する', () => {
        const modal = { classList: classes(['practice-modal', 'vertical-tab-active', ...helpers.SCROLL_DIAGNOSTIC_CLASSES]) };
        const definition = helpers.SCROLL_AB_CONDITIONS[condition];
        assert.equal(definition.backdropDisabled, backdrop); assert.equal(definition.metronomeDisabled, metro);
        helpers.applyDecorationCondition(modal, condition);
        assert.ok(modal.classList.contains('practice-modal')); assert.ok(modal.classList.contains('vertical-tab-active'));
        const active = [...modal.classList.values].filter(name => name.startsWith('scroll-ab-'));
        assert.deepEqual(active, cssClass ? [cssClass] : []);
        helpers.applyDecorationCondition(modal);
        assert.equal([...modal.classList.values].filter(name => name.startsWith('scroll-ab-')).length, 0);
    });
}
test('A→E→A→F→A→B→Aを繰り返してもclassを重複・残留させない', () => {
    const modal = { classList: classes(['practice-modal']) };
    assert.deepEqual(Array.from(helpers.SCROLL_AB_SEQUENCE), ['A', 'E', 'A', 'F', 'A', 'B', 'A']);
    for (let cycle = 0; cycle < 3; cycle++) {
        for (const condition of helpers.SCROLL_AB_SEQUENCE) {
            helpers.applyDecorationCondition(modal, condition);
            helpers.applyDecorationCondition(modal, condition);
            assert.equal([...modal.classList.values].filter(name => name.startsWith('scroll-ab-')).length, condition === 'A' ? 0 : 1);
        }
    }
    assert.deepEqual([...modal.classList.values], ['practice-modal']);
});
test('C/Dや不正条件は追加せず、診断を誤起動しない', () => {
    for (const condition of ['C', 'D', '__proto__', 'unknown']) {
        assert.throws(() => new Capture(condition, {}), /A\/B\/E\/F/);
        assert.throws(() => helpers.applyDecorationCondition({ classList: classes() }, condition), /A\/B\/E\/F/);
    }
});

function observerHarness(condition) {
    let instance, styleReads = 0;
    const listeners = new Map();
    const bar = { classList: classes(), addEventListener: (event, fn) => listeners.set(event, fn),
        removeEventListener: event => listeners.delete(event), matches: () => true,
        get className() { return [...this.classList.values].join(' '); } };
    const dot = { classList: classes(['beat-dot', 'active']), textContent: '1', matches: () => true,
        get className() { return [...this.classList.values].join(' '); } };
    const badge = { classList: classes(['count-in']) };
    const rule = { selectorText: '.beat-dot.active', style: {
        getPropertyValue: p => p === 'box-shadow' ? '0 0 10px blue' : '', getPropertyPriority: () => '' } };
    const doc = { getElementById: id => id === 'visualMetronomeBox' ? bar : badge,
        querySelector: () => dot, styleSheets: [{ href: 'style.css', cssRules: [rule] }] };
    const win = { MutationObserver: class {
        constructor(fn) { this.fn = fn; instance = this; }
        observe() { this.connected = true; }
        disconnect() { this.connected = false; }
    }, getComputedStyle() { styleReads++; return { boxShadow: 'none', transition: 'all 0.1s', transform: 'none', backgroundColor: 'blue', borderColor: 'blue' }; } };
    const record = {};
    const end = helpers.observeCountInDecorations(win, doc, condition, record);
    return { record, bar, badge, dot, listeners, end, get styleReads() { return styleReads; },
        mutate(kind) { bar.classList.remove('accent-flash', 'beat-flash'); bar.classList.add(kind === 'accent' ? 'accent-flash' : 'beat-flash');
            if (instance.connected) instance.fn(); },
        transition() { listeners.get('transitionend')?.({ target: bar, propertyName: 'box-shadow' }); },
        get connected() { return instance.connected; } };
}
for (const condition of ['A', 'B', 'E', 'F', 'P2']) {
    test(condition + '：通常拍とアクセント拍の適用規則・transitionをカウントインでだけ観測', () => {
        const h = observerHarness(condition);
        h.mutate('accent'); h.mutate('accent');
        if (!helpers.SCROLL_AB_CONDITIONS[condition].metronomeDisabled) h.transition();
        h.mutate('beat'); h.mutate('beat');
        if (!helpers.SCROLL_AB_CONDITIONS[condition].metronomeDisabled) h.transition();
        assert.equal(h.connected, false); assert.equal(h.listeners.size, 0);
        assert.deepEqual(Array.from(h.record.observedStates), ['accent', 'beat']);
        assert.equal(h.record.endReason, 'two-count-in-states-checked');
        const applied = h.record.samples.filter(item => item.phase === 'class-applied');
        assert.equal(applied.length, 2);
        assert.ok(applied[0].matchedRules.dot.some(rule => rule.selector === '.beat-dot.active'));
        const count = h.styleReads; h.mutate('accent'); h.transition(); assert.equal(h.styleReads, count);
        assert.ok(count <= 8, '1回の準備につき最大4状態、computed styleは最大8取得');
    });
}
test('transition終了が来なくてもスクロール開始時に観測を解除し、計測中のstyle取得をゼロにする', () => {
    const h = observerHarness('A'); h.mutate('accent');
    h.end('scroll-start-before-measurement'); const count = h.styleReads;
    h.mutate('beat'); h.transition(); h.end('again');
    assert.equal(h.styleReads, count); assert.equal(h.connected, false); assert.equal(h.listeners.size, 0);
    assert.equal(h.record.endReason, 'scroll-start-before-measurement');
});
test('カウントイン以外のclass変化ではcomputed styleを取得しない', () => {
    const h = observerHarness('E'); h.badge.classList.remove('count-in');
    h.mutate('accent'); h.transition(); assert.equal(h.styleReads, 0); h.end('test-stop');
});

test('P0=A・P1=Eを再利用し、新しい表示条件はP2だけに限定する', () => {
    assert.deepEqual(Object.keys(helpers.SCROLL_AB_CONDITIONS), ['A', 'B', 'E', 'F', 'P2']);
    assert.equal(helpers.SCROLL_BACKGROUND_DESIGNS.A, 'P0');
    assert.equal(helpers.SCROLL_BACKGROUND_DESIGNS.E, 'P1');
    assert.equal(helpers.SCROLL_BACKGROUND_DESIGNS.P2, 'P2');
    assert.equal(Object.hasOwn(helpers.SCROLL_AB_CONDITIONS, 'P0'), false);
    assert.equal(Object.hasOwn(helpers.SCROLL_AB_CONDITIONS, 'P1'), false);
});
test('P0→P1→P0→P2→P0を繰り返して背景色・装飾classを残留させない', () => {
    const modal = { classList: classes(['practice-modal']) };
    assert.deepEqual(Array.from(helpers.SCROLL_BACKGROUND_SEQUENCE), ['A', 'E', 'A', 'P2', 'A']);
    for (let i = 0; i < 3; i++) {
        for (const condition of [...helpers.SCROLL_BACKGROUND_SEQUENCE, 'B', 'F', 'A']) {
            helpers.applyDecorationCondition(modal, condition);
            assert.equal([...modal.classList.values].filter(name => name.startsWith('scroll-ab-')).length, condition === 'A' ? 0 : 1);
            assert.equal(modal.classList.contains('scroll-ab-opaque-background'), condition === 'P2');
        }
    }
    assert.deepEqual([...modal.classList.values], ['practice-modal']);
});
test('背景5回と従来の装飾7回を分けて案内し、結果を混同しない', () => {
    const results = [{ condition: 'A', validComparison: true, metadata: {} },
        { condition: 'A', validComparison: true, metadata: { comparisonPlan: { id: 'background' } } },
        { condition: 'E', validComparison: false, metadata: { comparisonPlan: { id: 'background' } } }];
    const background = helpers.getComparisonProgress(results, 'background');
    const decoration = helpers.getComparisonProgress(results, 'decoration');
    assert.equal(background.validCount, 1); assert.equal(background.nextCondition, 'E'); assert.equal(background.inOrder, true);
    assert.equal(decoration.validCount, 1); assert.equal(decoration.nextCondition, 'E'); assert.equal(decoration.sequence.length, 7);
    for (const condition of ['E', 'A', 'P2', 'A']) results.push({ condition, validComparison: true, metadata: { comparisonPlan: { id: 'background' } } });
    assert.equal(helpers.getComparisonProgress(results, 'background').nextCondition, null);
    assert.equal(helpers.getComparisonProgress(results, 'background').inOrder, true);
    assert.equal(helpers.getComparisonProgress(results, 'decoration').validCount, 1);
});
test('再測定の無効結果は推奨順序を進めず、有効な順序違いは明示する', () => {
    const rows = ['A', 'P2'].map(condition => ({ condition, validComparison: true, metadata: { comparisonPlan: { id: 'background' } } }));
    assert.equal(helpers.getComparisonProgress(rows, 'background').inOrder, false);
    assert.throws(() => helpers.getComparisonProgress(rows, 'unknown'), /不明な比較手順/);
});
test('P2の追加でメトロノーム装飾やフィルター・アニメーションを追加しない', () => {
    const page = fs.readFileSync(path.join(root, 'diagnostics/scroll-ab.js'), 'utf8');
    const override = page.match(/export const decorationOverride = `([\s\S]*?)`;/)[1];
    for (const block of override.split('}')) {
        if (!block.includes('scroll-ab-opaque-background')) continue;
        const declaration = block.slice(block.indexOf('{') + 1);
        assert.doesNotMatch(declaration, /box-shadow|transform|transition|animation|opacity|linear-gradient|url\(/);
    }
    const html = fs.readFileSync(path.join(root, 'diagnostics/scroll-ab.html'), 'utf8');
    assert.equal((html.match(/<option value="A">/g) || []).length, 1);
    assert.equal((html.match(/<option value="E">/g) || []).length, 1);
    assert.match(html, /<option value="background">/);
    assert.match(html, /<option value="decoration">/);
});

test('通常の練習モーダルだけをP1にし、共通モーダルの色と旧ぼかしを維持する', () => {
    const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
    const shared = css.match(/(?:^|\n)\.modal\s*\{([^}]+)\}/)[1];
    assert.match(shared, /background:\s*rgba\(15, 23, 42, 0\.75\)/);
    assert.match(shared, /backdrop-filter:\s*blur\(4px\)/);
    const practice = [...css.matchAll(/(?:^|\n)#practiceModal\s*\{([^}]+)\}/g)];
    assert.equal(practice.length, 1, '練習モーダル専用の上書きは1つ');
    const declarations = Object.fromEntries(practice[0][1].split(';').filter(s => s.trim()).map(s => s.trim().split(/:\s*/)));
    assert.deepEqual(declarations, { 'backdrop-filter': 'none', '-webkit-backdrop-filter': 'none' });
    const content = css.match(/(?:^|\n)\.practice-modal-content\s*\{([^}]+)\}/)[1];
    assert.match(content, /background:\s*#ffffff/);
});
test('診断iframeだけに旧ぼかしを明示し、A/P0とFの過去の意味を保全する', () => {
    const page = fs.readFileSync(path.join(root, 'diagnostics/scroll-ab.js'), 'utf8');
    const override = page.match(/export const decorationOverride = `([\s\S]*?)`;/)[1];
    const historical = override.match(/(?:^|\n)#practiceModal\s*\{([^}]+)\}/)[1];
    assert.match(historical, /(?:^|;)\s*backdrop-filter:\s*blur\(4px\)/);
    assert.match(historical, /-webkit-backdrop-filter:\s*blur\(4px\)/);
    assert.doesNotMatch(historical, /background|opacity|width|height|padding|z-index/);
    assert.match(page, /doc\.head\.append\(style\)/);
    assert.match(page, /iframe\.addEventListener\('load', install\)/);
    assert.doesNotMatch(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /scroll-ab|decorationOverride/);
});
test('E/P1・B・P2は診断の旧ぼかしより強い指定で標準/WebKitとも無効化する', () => {
    const page = fs.readFileSync(path.join(root, 'diagnostics/scroll-ab.js'), 'utf8');
    const override = page.match(/export const decorationOverride = `([\s\S]*?)`;/)[1];
    const noneBlock = override.match(/#practiceModal\.scroll-ab-no-decoration,\s*#practiceModal\.scroll-ab-no-backdrop,\s*#practiceModal\.scroll-ab-opaque-background\s*\{([^}]+)\}/)[1];
    assert.match(noneBlock, /(?:^|;)\s*backdrop-filter:\s*none\s*!important/);
    assert.match(noneBlock, /-webkit-backdrop-filter:\s*none\s*!important/);
    assert.equal(helpers.SCROLL_AB_CONDITIONS.A.cssClass, null);
    assert.equal(helpers.SCROLL_AB_CONDITIONS.F.cssClass, 'scroll-ab-no-metronome');
    assert.doesNotMatch(override, /#practiceModal\.scroll-ab-no-metronome\s*\{[^}]*backdrop-filter/);
});
test('P0は旧背景・比較基準と表示し、JSONの条件ID・条件名は変えない', () => {
    const html = fs.readFileSync(path.join(root, 'diagnostics/scroll-ab.html'), 'utf8');
    assert.match(html, /P0 \/ A：旧背景・比較基準/);
    assert.match(html, /通常アプリはP1/);
    assert.equal(helpers.SCROLL_AB_CONDITIONS.A.name, '通常');
    assert.equal(helpers.SCROLL_AB_CONDITIONS.E.name, '背景ぼかしのみ無効');
    assert.equal(helpers.SCROLL_AB_CONDITIONS.F.name, 'メトロノーム装飾のみ無効');
    assert.equal(helpers.SCROLL_BACKGROUND_DESIGNS.A, 'P0');
});
