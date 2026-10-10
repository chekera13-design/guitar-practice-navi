const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = file => fs.readFileSync(path.join(__dirname, '../', file), 'utf8');
const app = read('js/app.js').replace(/import\s+[\s\S]*?from\s+"[^"]+";/g, '');
const engine = read('js/audioEngine.js').replace(/export /g, '');
// VMではデータ本体を読み込む。互換入口のESM importはconfig専用テストで確認。
const config = ['js/config/basic.js', 'js/config/tutorial.js'].map(read).join('\n').replace(/export /g, '');
const buttons = read('js/buttonInput.js').replace(/export /g, '');

function element() {
    const classes = new Set();
    return { dataset: {}, style: {}, value: '40', innerText: '', innerHTML: '', listeners: {},
        classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) },
        addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); },
        dispatch(name, event = {}) { this.listeners[name]?.forEach(fn => fn({ target: this, ...event })); },
        setAttribute(key, value) { this[key] = value; },
        querySelector() { return null; }, querySelectorAll() { return []; }, contains() { return false; },
    };
}

// 関数の切り出しではなく、設定・音声エンジン・ボタン登録・アプリ全体を実行する。
// 保存領域とDOMを代替し、実際の起動末尾まで到達してカードを生成することを検証。
function boot(options = {}) {
    const nodes = new Map(), timers = new Map(), writes = [], reads = [];
    let nextTimer = 0;
    const saved = options.saved || new Map();
    const get = id => {
        if (!nodes.has(id)) nodes.set(id, element());
        return nodes.get(id);
    };
    const grid = get('exerciseGrid');
    const tutorialGrid = get('tutorialExerciseGrid');
    let cards = [], tutorialCards = [];
    function bindGrid(target, updateCards) {
        Object.defineProperty(target, 'innerHTML', { get: () => target.html || '', set(html) {
            target.html = html;
            const renderedCards = [...html.matchAll(/class="exercise-card ([^"]+)"\s+data-stage-id="(\d+)"\s+id="([^"]+)"\s+data-stage-category="([^"]+)"/g)].map(match => {
                const card = element(); card.dataset.stageId = match[2]; card.id = match[3];
                card.dataset.stageCategory = match[4]; card.available = match[1].includes('exercise-card-available');
                return card;
            });
            updateCards(renderedCards);
        } });
    }
    bindGrid(grid, rendered => { cards = rendered; });
    bindGrid(tutorialGrid, rendered => { tutorialCards = rendered; });
    grid.querySelectorAll = () => cards.filter(card => card.available);
    tutorialGrid.querySelectorAll = () => tutorialCards.filter(card => card.available);
    const storage = {
        getItem(key) { reads.push(key); if (options.readError) throw options.readError; return saved.get(key) ?? null; },
        setItem(key, value) { writes.push([key, value]); if (options.writeError) throw options.writeError; saved.set(key, value); },
    };
    const context = {
        document: { getElementById: get, querySelector: () => null, querySelectorAll: () => [],
            body: { style: {} }, addEventListener() {} },
        window: { addEventListener() {} }, console,
        setTimeout(fn) { timers.set(++nextTimer, fn); return nextTimer; }, clearTimeout(id) { timers.delete(id); },
        VerticalTabController: class {},
    };
    Object.defineProperty(context, 'localStorage', { get() {
        if (options.accessError) throw options.accessError;
        return storage;
    } });
    vm.createContext(context);
    vm.runInContext(engine + '\n' + config + '\n' + buttons + '\n' + app, context);
    const evaluate = code => vm.runInContext(code, context);
    function assertReady(volume = 40) {
        assert.equal(get('metroVolSlider').value, volume);
        assert.equal(get('metroVolLabel').innerText, volume + '%');
        assert.equal(evaluate('getMetronomeVolume()'), volume / 100);
        for (const [target, rendered, stages] of [[grid, cards, evaluate('BASIC_STAGES')],
            [tutorialGrid, tutorialCards, evaluate('TUTORIAL_STAGES')]]) {
            assert.equal(rendered.length, stages.length);
            stages.forEach(stage => assert.ok(target.html.includes(stage.title)));
            rendered.filter(card => card.available).forEach(card => {
                assert.equal(card.listeners.click.length, 1);
                assert.equal(card.listeners.keydown.length, 1);
            });
        }
        assert.ok(get('metroVolSlider').listeners.input.length);
        assert.ok(get('mainActionBtn').listeners.click.length);
        assert.ok(get('recordPracticeBtn').listeners.click.length);
        assert.ok(get('closePracticeModalBtn').listeners.click.length);
        assert.ok(get('retryScoreBtn').listeners.click.length);
    }
    function changeVolume(volume) { get('metroVolSlider').value = String(volume); get('metroVolSlider').dispatch('input'); }
    return { options, saved, nodes, cards, tutorialCards, context, writes, reads, evaluate, assertReady, changeVolume, timers };
}

for (const failure of ['getItem-SecurityError', 'getItem-other-error', 'localStorage-getter']) {
    test(failure + 'でもアプリ全体が起動し、全カードと主要ボタンを登録', () => {
        const err = Error(failure);
        const h = boot(failure === 'localStorage-getter' ? { accessError: err } : { readError: err });
        h.assertReady();
    });
}

for (const value of [null, '', ' ', '\t\n', 'NaN', 'Infinity', '-Infinity', '1e309', '-1e309', 'broken', '40%', '12x', '-1', '101', '100.1', '-0.1']) {
    test(JSON.stringify(value) + 'は既定40%で起動・カード生成', () => {
        const h = boot({ saved: new Map([['chogita_metro_vol', value]]) });
        h.assertReady();
        assert.equal(h.writes.length, 0); // 破損値やアクセス不可を理由に保存値を上書きしない。
    });
}

for (const value of ['0', '1', '40', '75', '100', ' 25 ', '65.5']) {
    test('正常値 ' + JSON.stringify(value) + 'を従来どおり復元', () => {
        const h = boot({ saved: new Map([['chogita_metro_vol', value]]) });
        h.assertReady(Number(value));
        assert.equal(h.reads[0], 'chogita_metro_vol');
    });
}

for (const failure of ['setItem-SecurityError', 'setItem-QuotaExceededError', 'localStorage-getter']) {
    test(failure + 'でも複数回の音量変更・表示・音量バー操作を継続', () => {
        const options = {};
        const h = boot(options);
        const err = Error(failure);
        if (failure === 'localStorage-getter') options.accessError = err;
        else options.writeError = err;
        for (const volume of [0, 100, 23]) {
            assert.doesNotThrow(() => h.changeVolume(volume));
            assert.equal(h.evaluate('getMetronomeVolume()'), volume / 100);
            assert.equal(h.nodes.get('metroVolLabel').innerText, volume + '%');
        }
        h.nodes.get('metroVolToggleBtn').dispatch('click', { stopPropagation() {} });
        assert.equal(h.nodes.get('metroVolContainer').classList.contains('expanded'), true);
        assert.equal(h.timers.size, 1);
        h.nodes.get('metroVolToggleBtn').dispatch('click', { stopPropagation() {} });
        assert.equal(h.timers.size, 0);
        assert.equal(boot(options).evaluate('getMetronomeVolume()'), 0.4);
    });
}

test('読み取り失敗後もセッション内変更を反映し、書き込み可能なら保存できる', () => {
    const h = boot({ readError: Error('blocked read') });
    h.assertReady(); h.changeVolume(58);
    assert.equal(h.evaluate('getMetronomeVolume()'), 0.58);
    assert.equal(h.saved.get('chogita_metro_vol'), '58');
});

test('通常の変更を同じキーへ保存し、再起動時に復元する', () => {
    const saved = new Map();
    const first = boot({ saved }); first.assertReady();
    first.changeVolume(73);
    assert.deepEqual(first.writes, [['chogita_metro_vol', '73']]);
    const second = boot({ saved }); second.assertReady(73);
    second.changeVolume(0);
    boot({ saved }).assertReady(0);
});
