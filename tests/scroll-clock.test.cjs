const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8').replace(/^export /gm, '');
function harness(options = {}) {
    let now = 0, elapsed = 2, next = 0;
    const frames = new Map(), progress = [], positions = [];
    const wrapper = { clientWidth: 200, scrollWidth: 100000, scrollLeft: 0 };
    const highlight = { style: {}, classList: { add() {}, remove() {} } };
    const c = { document: { querySelector: () => wrapper, getElementById: () => highlight },
        performance: { now: () => now },
        requestAnimationFrame(fn) { frames.set(++next, fn); return next; },
        cancelAnimationFrame(id) { frames.delete(id); },
    };
    vm.createContext(c); vm.runInContext(source, c);
    vm.runInContext('cachedBarLayouts = Array.from({length:12},(_,i)=>({left:i*300,top:10,width:300,height:180})); cachedScoreEndX=3600;', c);
    function start(extra = {}) {
        c.startScoreContinuousScroll({ totalBars: 12, beatSec: 1, repeatCount: 3,
            getElapsedSeconds: options.withoutAudio ? undefined : () => elapsed,
            onProgress: (bar, beat) => progress.push({ bar, beat }), ...extra });
    }
    function step(time, audio = elapsed) {
        now = time; elapsed = audio;
        const entry = frames.entries().next().value;
        assert.ok(entry, '有効なRAFが1本ある');
        frames.delete(entry[0]); entry[1](now); positions.push(wrapper.scrollLeft);
        return wrapper.scrollLeft;
    }
    return { c, frames, progress, positions, wrapper, highlight, start, step,
        setAudio(value) { elapsed = value; }, clock: () => vm.runInContext('createScrollDisplayClock()', c) };
}
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-7, `${a} ≈ ${b}`);

test('64ms刻みの音声時計でも、その間の各RAFでスクロール位置が進む', () => {
    const h = harness(); h.start(); h.step(0, 2);
    const a = h.step(16, 2), b = h.step(32, 2), c = h.step(48, 2), d = h.step(64, 2.064);
    assert.ok(a > 94 && b > a && c > b && d > c);
    assert.ok(d-c < 2, '64ms分をまとめてジャンプしない');
    assert.equal(h.frames.size, 1);
});

test('Fire相当の64ms刻みと16/33/50msのRAFでも移動が止まる割合を減らす', () => {
    const h = harness(); h.start();
    let now = 0, stopped = 0, baselineStopped = 0, prev, old;
    for (let i=0; i<900; i++) {
        now += i%43===0 ? 50 : i%11===0 ? 33.333 : 16.667;
        const audio = 2 + Math.floor(now/64)*0.064;
        const position = h.step(now, audio);
        // Fireで観測したDPR1.5のスクロール刻みに丸めても比較する。
        const rounded = Math.round(position*1.5)/1.5;
        const baseline = Math.round((audio*75-56)*1.5)/1.5;
        if (rounded===prev) stopped++;
        if (baseline===old) baselineStopped++;
        prev=rounded; old=baseline;
    }
    assert.ok(baselineStopped > 500);
    assert.ok(stopped < 10, `停止フレーム${stopped}`);
    assert.equal(h.frames.size, 1);
});

test('滑らかな位置が次小節へ進んでも拍通知とハイライトは音声時計を守る', () => {
    const h = harness(); h.start(); h.step(0, 3.96);
    h.step(60, 3.96);
    assert.ok(h.wrapper.scrollLeft > 244, '位置だけは境界を滑らかに通過');
    assert.equal(h.progress.at(-1).bar, 0); assert.equal(h.progress.at(-1).beat, 4);
    assert.equal(h.highlight.style.left, '0px');
    h.step(80, 4.024);
    assert.equal(h.progress.at(-1).bar, 1); assert.equal(h.highlight.style.left, '300px');
});

test('補間で音声より早く次の周回の先頭へ戻らない', () => {
    const h = harness(); h.start(); h.step(0, 47.97);
    h.step(64, 47.97);
    assert.ok(h.wrapper.scrollLeft > 3000); assert.equal(h.progress.at(-1).bar, 11);
    h.step(80, 48.034);
    assert.equal(h.wrapper.scrollLeft, 0); assert.equal(h.progress.at(-1).bar, 0);
});

test('有限回の最終時刻を過ぎた補間は次の周回へ戻らない', () => {
    const h = harness(); h.start({ repeatCount: 1 }); h.step(0, 47.97); h.step(64, 47.97);
    const before = h.wrapper.scrollLeft; h.step(80,48.034);
    assert.ok(h.wrapper.scrollLeft >= before); assert.equal(h.progress.at(-1).bar, 11);
    h.step(700,48.6); assert.equal(h.frames.size,0);
});

for(const rate of [0.9998, 1.0002]) {
    test(`音声時計の速度が${rate}でも10分間のずれが蓄積しない`, () => {
        const clock = harness().clock(); let last=0;
        for(let i=0;i<=36000;i++) {
            const ms=i*1000/60, truth=2+ms/1000*rate;
            const audio=2+Math.floor(ms/1000*rate/0.064)*0.064;
            const value=clock(audio,ms);
            assert.ok(value>=last); assert.ok(value-audio<=0.100001);
            assert.ok(Math.abs(value-truth)<0.081, '音声との位相差は蓄積しない'); last=value;
        }
    });
}

test('音声時計が停止した場合は最大100msまでで位置を止める', () => {
    const h = harness(), clock=h.clock(); clock(2,0);
    for(let i=1;i<=120;i++) assert.ok(clock(2,i*16.667)<=2.1);
    near(clock(2,2010),2.1);
});

test('長いRAF中断・大きな音声時刻変更・時計の巻き戻りは即時再同期する', () => {
    const clock = harness().clock(); clock(2,0); clock(2,16);
    near(clock(3,1000),3); near(clock(8,1016),8); near(clock(1,1032),1);
    near(clock(1.01,1000),1.01);
});

test('不正時刻・カウントインでは位置を変更せず、回復時に古い補間を使わない', () => {
    const h=harness(); h.start(); h.step(0,2); const left=h.wrapper.scrollLeft;
    for(const audio of [NaN, Infinity, -Infinity, -0.1]) {
        h.step(16,audio); assert.equal(h.wrapper.scrollLeft,left); assert.equal(h.frames.size,1);
    }
    h.step(32,2); near(h.wrapper.scrollLeft,94);
});

test('音声時計を渡さない呼出しは従来どおりRAF時刻だけで進む', () => {
    const h=harness({withoutAudio:true}); h.start(); h.step(2000); near(h.wrapper.scrollLeft,94);
    h.step(2016); near(h.wrapper.scrollLeft,95.2);
});

test('再描画復帰用の開始は最新音声位置を即時反映し、古いRAFと補間を無効にする', () => {
    const h=harness(); h.start(); h.step(0,2); h.step(32,2);
    const old=[...h.frames.values()][0]; h.setAudio(6); h.start({restoreImmediately:true});
    near(h.wrapper.scrollLeft,394); const id=[...h.frames.keys()][0];
    old(48); near(h.wrapper.scrollLeft,394); assert.equal(h.frames.size,1); assert.equal([...h.frames.keys()][0],id);
    h.step(48,6); assert.ok(h.wrapper.scrollLeft>394);
});

test('停止後の遅延RAFは位置も更新予約も復活させず、再開始で補間をリセットする', () => {
    const h=harness(); h.start(); h.step(0,2); const old=[...h.frames.values()][0];
    h.c.stopScoreContinuousScroll(); const left=h.wrapper.scrollLeft;
    old(64); assert.equal(h.wrapper.scrollLeft,left); assert.equal(h.frames.size,0);
    h.start(); h.step(80,2); near(h.wrapper.scrollLeft,94); assert.equal(h.frames.size,1);
});

for(const beatSec of [3, 0.3]) {
    test(`${60/beatSec} BPMでも1本のRAFで有限な位置を計算する`, () => {
        const h=harness(); h.start({beatSec});
        for(let i=0;i<120;i++) {const ms=i*16.667;h.step(ms,2+Math.floor(ms/64)*.064);assert.ok(Number.isFinite(h.wrapper.scrollLeft));assert.equal(h.frames.size,1);}
    });
}
