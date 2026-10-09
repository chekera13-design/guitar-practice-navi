const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');

// 既存の制御可能なDOM・音声時刻・Recorderを再利用し、実際の完了処理へ接続する。
function fixture(file, marker, result) {
    const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
    return vm.runInNewContext(source.slice(0, source.indexOf(marker)) + '\n' + result,
        { require, __dirname, Blob, TextEncoder, AbortController, setImmediate });
}
const boot = fixture('storage.test.cjs', "for (const failure of ['getItem", 'boot;');
const practice = fixture('practice.test.cjs', 'for (const repeats of', 'harness;');
const score = fixture('score-loading.test.cjs', "for (const state of ['idle'", 'harness;');
const KEY = 'chogita_tutorial_completed';
const completed = home => Array.from(home.evaluate('[...completedTutorialStages]'));
const badge = (home, id) => home.nodes.get(`tutorial-${id}-completion`);
function session(id, options = {}, storage = {}) {
    const home = boot(storage), stage = home.evaluate(`TUTORIAL_STAGES[${id - 1}]`);
    const h = practice({ bars: id, bpm: stage.bpm, ...options }), c = h.context;
    c.currentStage = stage; h.prepareScore();
    c.markTutorialCompleted = (selected, mode) => home.context.markTutorialCompleted(selected, mode);
    return { home, h, c, stage };
}

test('3問の順序・BPM60・EX1全設定の維持・EX3に単音限定設定なし', () => {
    const home = boot(), stages = home.evaluate('TUTORIAL_STAGES');
    assert.deepEqual(Array.from(stages, s => [s.id, s.bpm, s.practiceBars]), [[1,60,1],[2,60,2],[3,60,3]]);
    assert.equal(createHash('sha256').update(JSON.stringify(stages[0])).digest('hex'),
        'c3a999c6df6c5d7353dae05a1371bc69f9a521d2bcbce1a6dc2ed24afcfb5b14');
    assert.equal(stages[1].string, 6); assert.equal(stages[1].noteName, 'E2');
    assert.equal('string' in stages[2], false); assert.equal('noteName' in stages[2], false);
    home.assertReady();
});

for (const id of [2, 3]) {
    test(`EX${id}カードが正しいMXL・BPM・ガイドを共通練習画面へ渡す`, async () => {
        const home = boot(), files = [], archives = [];
        const h = score({ fetch: async file => {
            files.push(file);
            const bytes = fs.readFileSync(path.join(__dirname, '..', file)); archives.push(bytes);
            return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
        } }), c = h.c;
        c.JSZip = c.window.JSZip = { loadAsync: async bytes => {
            assert.deepEqual(Buffer.from(bytes), archives.at(-1));
            return { files: { 'score.xml': { async: async () => fs.readFileSync(path.join(__dirname, '..',
                files.at(-1).replace(/\.mxl$/, '.musicxml')), 'utf8') } } };
        } };
        let opening; home.context.openPracticeModal = stage => { opening = h.open(stage); };
        home.tutorialCards[id - 1].dispatch('click'); await opening;
        const stage = home.evaluate(`TUTORIAL_STAGES[${id - 1}]`);
        assert.equal(c.currentStage, stage); assert.equal(c.currentBpm, 60);
        assert.deepEqual(files, [`scores/tutorial/ex0${id}.mxl`]);
        const xml = new TextDecoder().decode(c.api.loadCalls[0]);
        assert.equal((xml.match(/<measure\b/g) || []).length, id);
        assert.equal((xml.match(/<type>quarter<\/type>/g) || []).length, 8);
        if (id === 3) assert.equal((xml.match(/<type>whole<\/type>/g) || []).length, 6);
        for (const text of [stage.guide.content, ...stage.guide.points]) assert.ok(c.stageGuideBody.innerHTML.includes(text));
        h.complete(c.api, id); assert.equal(c.scoreLoadState, 'ready'); assert.equal(c.preparedScore.bars, id);
    });
}

for (const id of [1,2]) for (const repeat of [1,3,5]) {
    test(`EX${id}通常練習${repeat}回の正常終了だけで完了・表示・保存`, async () => {
        const {home,h,c} = session(id); c.practiceRepeatSelect.value = String(repeat);
        await c.startPractice('practice'); h.advance(4.31);
        assert.deepEqual(completed(home), []); assert.equal(badge(home,id).hidden, true);
        h.advance(4.3 + 4 * id * repeat + 0.11);
        assert.equal(c.isPracticing, false); assert.equal(h.timers.size,0);
        assert.deepEqual(completed(home), [`tutorial-${id}`]); assert.equal(badge(home,id).hidden,false);
        assert.deepEqual(JSON.parse(home.saved.get(KEY)), [`tutorial-${id}`]); assert.equal(h.micRequests(),0);
    });
}
for (const id of [1,2,3]) for (const at of [1,5]) {
    test(`EX${id}通常練習を${at === 1 ? 'カウントイン' : '演奏'}中に停止しても未完了`, async () => {
        const {home,h,c} = session(id); await c.startPractice('practice'); h.advance(at); c.stopPractice(); h.advance(100);
        assert.deepEqual(completed(home), []); assert.equal(badge(home,id).hidden,true); assert.equal(h.timers.size,0);
    });
}
for (const id of [1,2]) {
    test(`EX${id}無制限の途中停止では完了せず、次の1回の正常終了で完了`, async () => {
        const {home,h,c} = session(id); c.practiceRepeatSelect.value = 'unlimited';
        await c.startPractice(); h.advance(50); c.stopPractice(); assert.deepEqual(completed(home),[]);
        c.practiceRepeatSelect.value='1'; await c.startPractice(); h.advance(54.3+4*id+0.11);
        assert.deepEqual(completed(home),[`tutorial-${id}`]);
    });
    test(`EX${id}録音成功だけでは通常練習の完了条件を満たさない`, async () => {
        const {home,h,c} = session(id); await c.startPractice('record'); h.advance(4.3+4*id+4+0.11);
        assert.equal(c.recordResultCard.classList.contains('hidden'),false); assert.deepEqual(completed(home),[]);
    });
}
for (const repeat of [1,3,5]) {
    test(`EX3通常練習${repeat}回が正常終了しても未完了`, async () => {
        const {home,h,c}=session(3); c.practiceRepeatSelect.value=String(repeat);
        await c.startPractice(); h.advance(4.3+12*repeat+0.11);
        assert.equal(c.isPracticing,false); assert.deepEqual(completed(home),[]);
    });
}
test('EX3は既存の余韻・録音データ確定・演奏正常終了をすべて満たした後に完了',async()=>{
    const {home,h,c}=session(3); c.practiceRepeatSelect.value='5';
    await c.startPractice('record'); h.advance(19.31);
    assert.equal(h.recorders[0].state,'inactive'); assert.deepEqual(completed(home),[]);
    h.advance(20.41); assert.equal(c.recordResultCard.classList.contains('hidden'),false);
    assert.equal(await h.urls[0].text(),'recording'); assert.equal(h.ticks.length,16);
    assert.deepEqual(completed(home),['tutorial-3']); assert.equal(badge(home,3).hidden,false);
});
test('遅い録音確定を待ち、確定前には完了しない',async()=>{
    const {home,h,c}=session(3,{delayedStop:true}); await c.startPractice('record'); h.advance(20.41);
    assert.equal(c.isFinalizingRecording,true); assert.deepEqual(completed(home),[]);
    h.recorders[0].deliver(); assert.deepEqual(completed(home),['tutorial-3']);
});
test('EX3保存失敗でも録音成功・聴き返し・セッション内チェックを維持',async()=>{
    const {home,h,c}=session(3,{}, {writeError:Error('quota')});
    await c.startPractice('record'); h.advance(20.41);
    assert.equal(c.recordResultCard.classList.contains('hidden'),false);
    assert.equal(await h.urls[0].text(),'recording'); assert.equal(c.recordPracticeBtn.disabled,false);
    assert.deepEqual(completed(home),['tutorial-3']); assert.equal(badge(home,3).hidden,false);
    assert.equal(home.saved.has(KEY),false);
});
test('EX3を閉じて再録音しても古い成功・失敗は完了判定へ混ざらない',async()=>{
    const {home,h,c}=session(3,{delayedStop:true}); await c.startPractice('record'); h.advance(5);
    const old=h.recorders[0], data=old.ondataavailable, stop=old.onstop, error=old.onerror;
    c.stopPractice(); c.practiceModal.classList.add('hidden'); c.practiceModal.classList.remove('hidden');
    await c.startPractice('record');
    data({data:new Blob(['OLD'])}); stop(); error({error:Error('OLD')});
    assert.deepEqual(completed(home),[]); assert.equal(c.isPracticing,true);
    h.advance(25.41); h.recorders[1].deliver('NEW');
    assert.equal(await h.urls[0].text(),'NEW'); assert.deepEqual(completed(home),['tutorial-3']);
    assert.equal(home.writes.filter(([key])=>key===KEY).length,1);
});
for(const failure of ['constructFail','startFail','stopFail','noData','unsupported','micFail','audioFail']){
    test(`EX3 ${failure}では未完了・成功表示なし・停止状態へ復帰`,async()=>{
        const {home,h,c}=session(3,{[failure]:true}); await c.startPractice('record'); h.advance(30);
        assert.deepEqual(completed(home),[]); assert.equal(c.isPracticing,false);
        assert.equal(c.isStartingPractice,false); assert.equal(c.isFinalizingRecording,false);
        assert.equal(c.recordResultCard.classList.contains('hidden'),true); assert.equal(h.timers.size,0);
    });
}
for(const cause of ['error','timeout','empty','premature','url']){
    test(`EX3 ${cause}を録音成功として扱わない`,async()=>{
        const {home,h,c}=session(3,{delayedStop:true}); await c.startPractice('record'); h.advance(5);
        if(cause==='error') h.recorders[0].onerror({error:Error('encode failed')});
        else if(cause==='premature') h.recorders[0].deliver();
        else if(cause==='timeout') h.advance(30);
        else { if(cause==='url') c.URL.createObjectURL=()=>{throw Error('URL failed');};
            h.advance(20.41); h.recorders[0].deliver(cause==='empty'?'':'data'); }
        assert.deepEqual(completed(home),[]); assert.equal(c.recordResultCard.classList.contains('hidden'),true);
        assert.equal(c.isPracticing,false); assert.equal(c.isFinalizingRecording,false);
    });
}
for(const at of [1,5,20.41]){
    test(`EX3録音を${at}秒で終了・画面を閉じた後の遅い成功／失敗を無視`,async()=>{
        const {home,h,c}=session(3,{delayedStop:true}); await c.startPractice('record'); h.advance(at);
        const recorder=h.recorders[0], data=recorder.ondataavailable, stop=recorder.onstop, error=recorder.onerror;
        c.stopPractice(); c.practiceModal.classList.add('hidden');
        data({data:new Blob(['late'])}); stop(); error({error:Error('late')}); h.advance(100);
        assert.deepEqual(completed(home),[]); assert.equal(h.urls.length,0); assert.equal(h.timers.size,0);
    });
}
test('古いEX3イベントは新しいEX2練習の完了へ混ざらない',async()=>{
    const {home,h,c}=session(3,{delayedStop:true}); await c.startPractice('record'); h.advance(5);
    const old=h.recorders[0], data=old.ondataavailable, stop=old.onstop, error=old.onerror;
    c.stopPractice(); c.currentStage=home.evaluate('TUTORIAL_STAGES[1]'); h.prepareScore();
    await c.startPractice('practice'); data({data:new Blob(['OLD'])}); stop(); error({error:Error('OLD')});
    assert.deepEqual(completed(home),[]); assert.equal(c.isPracticing,true); h.advance(21.5);
    assert.deepEqual(completed(home),['tutorial-2']); assert.equal(badge(home,3).hidden,true);
});
test('1/3・2/3は個別のみ、3/3で見出しとジャンル案内も完了、再読込で維持',()=>{
    const home=boot(); for(const [index,mode] of [[0,'practice'],[1,'practice'],[2,'record']]){
        home.context.markTutorialCompleted(home.evaluate(`TUTORIAL_STAGES[${index}]`),mode);
        assert.equal(badge(home,index+1).hidden,false);
        assert.equal(home.nodes.get('tutorialCompletionStatus').hidden,index<2);
        assert.equal(home.nodes.get('tutorialCategoryStatus').innerText,index<2?'未完了':'✓ 完了');
    }
    const restored=boot({saved:home.saved}); restored.assertReady();
    assert.deepEqual(completed(restored),['tutorial-1','tutorial-2','tutorial-3']);
    assert.equal(restored.nodes.get('tutorialCompletionStatus').hidden,false);
    for(const id of [1,2,3]) assert.equal(badge(restored,id).hidden,false);
    assert.doesNotMatch(restored.nodes.get('exerciseGrid').innerHTML,/completion/);
});
test('基礎編id:1・複製オブジェクト・異なるモードで完了せず、重複完了は再保存しない',()=>{
    const home=boot(); for(const expression of ['BASIC_STAGES[0]','({...TUTORIAL_STAGES[0]})'])
        home.context.markTutorialCompleted(home.evaluate(expression),'practice');
    home.context.markTutorialCompleted(home.evaluate('TUTORIAL_STAGES[2]'),'practice');
    assert.deepEqual(completed(home),[]);
    const stage=home.evaluate('TUTORIAL_STAGES[0]'); home.context.markTutorialCompleted(stage,'practice');
    home.context.markTutorialCompleted(stage,'practice'); assert.equal(home.writes.length,1);
    home.assertReady();
});
for(const value of [null,'','broken','null','{}','true','[1,true,null,"basic-1","tutorial-0"]']){
    test(`保存値${JSON.stringify(value)}でも未完了で起動・9カード生成`,()=>{
        const home=boot({saved:new Map([[KEY,value]])}); home.assertReady(); assert.deepEqual(completed(home),[]);
        assert.equal(home.nodes.get('tutorialCompletionStatus').hidden,true);
    });
}
test('カテゴリ・個別キーを検証し、重複や未知のEXだけでは全体完了にならない',()=>{
    const home=boot({saved:new Map([[KEY,'["basic-1","tutorial-1","tutorial-1","tutorial-99",null]']])});
    assert.deepEqual(completed(home),['tutorial-1','tutorial-99']); assert.equal(badge(home,1).hidden,false);
    assert.equal(badge(home,2).hidden,true); assert.equal(badge(home,3).hidden,true);
    assert.equal(home.nodes.get('tutorialCompletionStatus').hidden,true);
});
for(const failure of ['readError','accessError','writeError']){
    test(`${failure}でも起動・通常練習正常終了・セッション内の完了表示を継続`,async()=>{
        const {home,h,c}=session(1,{}, {[failure]:Error('blocked')}); home.assertReady();
        await c.startPractice(); h.advance(8.41); assert.equal(c.isPracticing,false);
        assert.equal(c.mainActionBtn.disabled,false); assert.equal(h.timers.size,0);
        assert.deepEqual(completed(home),['tutorial-1']); assert.equal(badge(home,1).hidden,false);
        if(failure!=='readError') assert.deepEqual(completed(boot({saved:home.saved})),[]);
    });
}
