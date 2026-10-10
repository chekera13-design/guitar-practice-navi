const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const app = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
const volumeCode = app.slice(app.indexOf('function expandVolumeBar()'), app.indexOf('// ★ MuseScore 4'));

function harness() {
    const listeners = {}, timers = new Map();
    let landscape = false, timerId = 0, volume = 0;
    function node() {
        const classes = new Set();
        return { value: '40', attributes: {}, listeners: {},
            classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) },
            setAttribute(k, v) { this.attributes[k] = v; },
            focus() { this.focused = true; },
            addEventListener(k, fn) { this.listeners[k] = fn; },
        };
    }
    const container = node(), toggle = node(), slider = node(), label = node(), icon = node();
    container.contains = target => [container, toggle, slider, label].includes(target);
    const c = { metroVolContainer: container, metroVolToggleBtn: toggle, metroVolSlider: slider,
        metroVolLabel: label, metroVolIcon: icon, volCollapseTimer: null,
        isPracticeModalLandscape: () => landscape,
        localStorage: { getItem: () => null, setItem() {} },
        setMetronomeVolume: value => { volume = value; },
        setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id),
        document: { addEventListener: (type, fn) => { listeners['document:' + type] = fn; } },
        window: { addEventListener: (type, fn) => { listeners['window:' + type] = fn; } },
    };
    vm.createContext(c); vm.runInContext(volumeCode + '\ninitVolumeControl();', c);
    return { c, container, toggle, slider, label, timers,
        click: () => toggle.listeners.click({ stopPropagation() {} }),
        event: (type, e = {}) => listeners[type](e),
        landscape: value => { landscape = value; }, volume: () => volume,
        expanded: () => container.classList.contains('expanded'),
    };
}

test('再タップで開閉し、ARIAと自動収納タイマーも同期する', () => {
    const h = harness(); h.click();
    assert.equal(h.expanded(), true); assert.equal(h.toggle.attributes['aria-expanded'], 'true');
    assert.equal(h.timers.size, 1); h.click();
    assert.equal(h.expanded(), false); assert.equal(h.toggle.attributes['aria-expanded'], 'false');
    assert.equal(h.timers.size, 0);
});
test('スライダー内の操作は閉じず、外タップは閉じる', () => {
    const h = harness(); h.click(); h.event('document:click', { target: h.slider });
    assert.equal(h.expanded(), true); h.event('document:click', { target: {} });
    assert.equal(h.expanded(), false); assert.equal(h.timers.size, 0);
});
test('Escapeで閉じる', () => {
    const h = harness(); let stopped = false;
    h.click(); h.event('document:keydown', { key: 'Escape', stopPropagation() { stopped = true; } });
    assert.equal(h.expanded(), false); assert.equal(stopped, true); assert.equal(h.toggle.focused, true);
    stopped = false;
    h.event('document:keydown', { key: 'Escape', stopPropagation() { stopped = true; } });
    assert.equal(stopped, false); // 閉じている場合は既存モーダルのEscape処理へ渡す。
});
test('外側のタッチ開始で閉じ、遅れた操作終了でも収納タイマーを復活させない', () => {
    const h = harness(); h.click(); h.slider.listeners.touchstart();
    h.event('document:pointerdown', { target: {} }); h.slider.listeners.touchend();
    assert.equal(h.expanded(), false); assert.equal(h.timers.size, 0);
});
test('横画面への変更で閉じ、横画面でポップオーバーを再開しない', () => {
    const h = harness(); h.click(); h.landscape(true); h.event('window:resize');
    assert.equal(h.expanded(), false); assert.equal(h.timers.size, 0);
    h.click(); assert.equal(h.expanded(), false);
    h.landscape(false); h.click(); assert.equal(h.expanded(), true);
});
test('画面回転イベントでも残留するポップオーバーを解除する', () => {
    const h = harness(); h.click(); h.event('window:orientationchange');
    assert.equal(h.expanded(), false); assert.equal(h.timers.size, 0);
});
test('開閉・回転後も同じスライダー値・音量・%表示を維持する', () => {
    const h = harness(); h.click(); h.slider.value = '72';
    h.slider.listeners.input({ target: h.slider });
    h.click(); h.click(); h.landscape(true); h.event('window:resize');
    assert.equal(h.slider.value, '72'); assert.equal(h.volume(), 0.72); assert.equal(h.label.innerText, '72%');
});
test('操作中は自動収納を止め、操作終了後に従来の収納を再開する', () => {
    const h = harness(); h.click(); h.slider.listeners.touchstart(); assert.equal(h.timers.size, 0);
    h.slider.listeners.touchend(); assert.equal(h.timers.size, 1);
    [...h.timers.values()][0](); assert.equal(h.expanded(), false); assert.equal(h.timers.size, 0);
});
