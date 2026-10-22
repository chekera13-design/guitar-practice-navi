const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),os=require('node:os');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),config=import(pathToFileURL(path.join(root,'js/config.js')).href);
const genres=import(pathToFileURL(path.join(root,'js/practiceGenres.js')).href);
const previousGlobals={window:global.window,document:global.document};
test.afterEach(()=>{for(const [key,value] of Object.entries(previousGlobals)){if(value===undefined)delete global[key];else global[key]=value;}});
function fixture(file,marker,result){const s=fs.readFileSync(path.join(__dirname,file),'utf8');return vm.runInNewContext(s.slice(0,s.indexOf(marker))+'\n'+result,{require,__dirname,Blob,TextEncoder,AbortController,setImmediate});}
const boot=fixture('storage.test.cjs',"for (const failure of ['getItem",'boot;');
const scoreHarness=fixture('score-loading.test.cjs',"for (const state of ['idle'",'harness;');
const practiceHarness=fixture('practice.test.cjs','for (const repeats of','harness;');

async function tabs(hash=''){
 const m=await genres,nodes=new Map(),events={};
 const win={scrollY:0,location:{hash},addEventListener(type,fn){events[type]=fn;},scrollTo({top}){this.scrollY=top;}};
 const entries=['basic','solo'].map(key=>{
  const panel={id:key+'Panel',dataset:{practicePanel:key},hidden:key!=='basic',contains(target){return target.panel===this;}};
  const tab={id:key+'Tab',dataset:{practiceGenre:key},attrs:{'aria-controls':panel.id},listeners:{},tabIndex:key==='basic'?0:-1,
   getAttribute(k){return this.attrs[k]??null;},setAttribute(k,v){this.attrs[k]=v;},focus(){win.focused=this.id;},
   addEventListener(k,fn){this.listeners[k]=fn;},click(){this.listeners.click();},key(key){let prevented=false;this.listeners.keydown({key,preventDefault(){prevented=true;}});return prevented;}};
  nodes.set(panel.id,panel);nodes.set(tab.id,tab);return{key,panel,tab};
 });
 for(const [id,index] of [['tutorialExercises',0],['basic-1',0],['solo-1',1]])nodes.set(id,{panel:entries[index].panel,scrollIntoView(){win.scrolledTo=id;}});
 global.window=win;global.document={getElementById:id=>nodes.get(id)};
 const root={querySelectorAll:s=>entries.map(e=>s.includes('role="tab"')?e.tab:e.panel)},controller=m.initPracticeGenres(root);
 return{entries,win,controller,hash(value){win.location.hash=value;events.hashchange();}};
}

test('基礎練習を初期表示し、タブ切替は既存パネルのhiddenだけを変える',async()=>{
 const h=await tabs();assert.equal(h.controller.selected,'basic');const[b,s]=h.entries;
 assert.equal(b.panel.hidden,false);assert.equal(s.panel.hidden,true);s.tab.click();assert.equal(h.controller.selected,'solo');assert.equal(s.tab.attrs['aria-selected'],'true');assert.equal(b.panel.hidden,true);
 b.tab.click();assert.equal(s.panel.hidden,true);assert.equal(b.panel.hidden,false);
});
test('矢印・Home/Endの選択とフォーカス、Tab順を同期',async()=>{
 const h=await tabs(),[b,s]=h.entries;assert.equal(b.tab.key('ArrowRight'),true);assert.equal(h.win.focused,'soloTab');assert.equal(s.tab.tabIndex,0);assert.equal(b.tab.tabIndex,-1);
 s.tab.key('ArrowRight');assert.equal(h.controller.selected,'basic');b.tab.key('End');assert.equal(h.controller.selected,'solo');s.tab.key('Home');assert.equal(h.controller.selected,'basic');assert.equal(b.tab.key('Tab'),false);
});
test('各ジャンルのホームスクロール位置をメモリ内で復元',async()=>{
 const h=await tabs(),[b,s]=h.entries;h.win.scrollY=450;s.tab.click();h.win.scrollY=90;b.tab.click();assert.equal(h.win.scrollY,450);s.tab.click();assert.equal(h.win.scrollY,90);
});
test('既存アンカーと新しいカードへのhashで該当パネルを表示し、URLへ書き込まない',async()=>{
 const h=await tabs('#solo-1');assert.equal(h.controller.selected,'solo');assert.equal(h.win.scrolledTo,'solo-1');
 h.hash('#tutorialExercises');assert.equal(h.controller.selected,'basic');assert.equal(h.win.scrolledTo,'tutorialExercises');h.hash('#solo-1');assert.equal(h.controller.selected,'solo');
 h.hash('#%broken');assert.equal(h.controller.selected,'solo');h.hash('#unknown');assert.equal(h.controller.selected,'solo');
 assert.equal((await tabs()).controller.selected,'basic');
});
test('ソロギターEX1だけを独立configから再exportし、検証用・60 BPM・3小節・4/4',async()=>{
 const c=await config,solo=await import(pathToFileURL(path.join(root,'js/config/solo.js')).href);
 assert.equal(c.SOLO_STAGES,solo.SOLO_STAGES);assert.equal(c.SOLO_STAGES.length,1);const s=c.SOLO_STAGES[0];
 assert.equal(s.id,1);assert.equal(s.code,'EX1');assert.equal(s.bpm,60);assert.equal(s.practiceBars,3);assert.equal(s.countInBars,1);assert.deepEqual(s.timeSignature,[4,4]);assert.equal(s.isPreview,true);assert.equal(s.available,true);
 assert.equal(s.title,'EX1：小音符・奏法表示テスト');assert.equal(s.file,'scores/solo/test3.musicxml');assert.ok(s.guide.content.includes('仮教材'));
 const xml=fs.readFileSync(path.join(root,s.file),'utf8');assert.equal((xml.match(/<measure\b/g)||[]).length,3);assert.match(xml,/<beats>4<\/beats>/);assert.match(xml,/<beat-type>4<\/beat-type>/);
});
test('Tutorial・Basic・SoloのEX1はカテゴリ付きIDで衝突しない',async()=>{
 const c=await config,keys=[['tutorial',c.TUTORIAL_STAGES],['basic',c.BASIC_STAGES],['solo',c.SOLO_STAGES]].flatMap(([k,a])=>a.map(s=>`${k}-${s.id}`));
 assert.equal(new Set(keys).size,keys.length);assert.ok(keys.includes('tutorial-1'));assert.ok(keys.includes('basic-1'));assert.ok(keys.includes('solo-1'));assert.equal(c.EX1_STAGE,c.BASIC_STAGES[0]);
});
test('ホームにはソロEX1が1枚だけ生成され、既存配列とカード内容は維持',()=>{
 const h=boot();h.assertReady();assert.equal(h.soloCards.length,1);assert.equal(h.soloCards[0].id,'solo-1');assert.equal(h.soloCards[0].dataset.stageCategory,'solo');
 const old=h.nodes.get('exerciseGrid').innerHTML,stages=h.evaluate('JSON.stringify(BASIC_STAGES)'),opened=[];
 h.context.openPracticeModal=s=>opened.push(s);h.soloCards[0].dispatch('click');h.cards[0].dispatch('click');h.tutorialCards[0].dispatch('click');
 assert.equal(opened[0],h.evaluate('SOLO_STAGES[0]'));assert.equal(opened[1],h.evaluate('BASIC_STAGES[0]'));assert.equal(opened[2],h.evaluate('TUTORIAL_STAGES[0]'));
 assert.equal(h.nodes.get('exerciseGrid').innerHTML,old);assert.equal(h.evaluate('JSON.stringify(BASIC_STAGES)'),stages);
 assert.doesNotMatch(h.nodes.get('soloExerciseGrid').innerHTML,/近日追加|準備中|solo-[23]|completion/);
});
test('ソロ操作はチュートリアル完了・保存キーへ書き込まない',()=>{
 const saved=new Map([['chogita_tutorial_completed','["tutorial-1","tutorial-2"]']]),h=boot({saved});
 const before=h.evaluate('JSON.stringify([...completedTutorialStages])');h.context.markTutorialCompleted(h.evaluate('SOLO_STAGES[0]'),'practice');h.context.markTutorialCompleted(h.evaluate('SOLO_STAGES[0]'),'record');
 assert.equal(h.evaluate('JSON.stringify([...completedTutorialStages])'),before);assert.equal(h.writes.length,0);assert.equal(saved.get('chogita_tutorial_completed'),'["tutorial-1","tutorial-2"]');
});
test('ソロEX1カードから既存XML読込・ready・練習ボタン・ガイドへ接続',async()=>{
 const home=boot(),files=[],h=scoreHarness({fetch:async file=>{files.push(file);return{ok:true,text:async()=>fs.readFileSync(path.join(root,file),'utf8')};}});let opening;
 home.context.openPracticeModal=s=>{opening=h.open(s);};home.soloCards[0].dispatch('click');await opening;
 const stage=home.evaluate('SOLO_STAGES[0]');assert.equal(h.c.currentStage,stage);assert.equal(h.c.currentBpm,60);assert.deepEqual(files,[stage.file]);
 assert.equal((new TextDecoder().decode(h.c.api.loadCalls[0]).match(/<measure\b/g)||[]).length,3);h.complete(h.c.api,3);
 assert.equal(h.c.scoreLoadState,'ready');assert.equal(h.c.mainActionBtn.disabled,false);assert.equal(h.c.recordPracticeBtn.disabled,false);assert.equal(h.c.stageGuideTitle.innerText,stage.guide.title);
 h.c.closePracticeModal();assert.equal(h.c.practiceModal.classList.contains('hidden'),true);
});
test('ソロXMLの失敗・再試行とBasicへの切替は既存世代ガードを使う',async()=>{
 const c=await config,files=[];let failure=true;const h=scoreHarness({fetch:async file=>{files.push(file);return{ok:!failure,status:404,text:async()=>'<score-partwise />'};}});
 await h.open(c.SOLO_STAGES[0]);assert.equal(h.c.scoreLoadState,'error');assert.equal(h.c.retryScoreBtn.hidden,false);failure=false;await h.c.retryScoreLoad();h.complete(h.c.api,3);assert.equal(h.c.scoreLoadState,'ready');
 const old=h.c.api;h.c.closePracticeModal();await h.open(c.BASIC_STAGES[0]);h.complete(old,3);assert.equal(h.c.scoreLoadState,'loading');h.complete(h.c.api,4);assert.equal(h.c.preparedScore.stage,c.BASIC_STAGES[0]);assert.deepEqual(files.slice(0,2),[c.SOLO_STAGES[0].file,c.SOLO_STAGES[0].file]);
});
for(const repeat of ['1','3','unlimited'])test('ソロ3小節の既存練習：'+repeat+'回・カウントイン1回・停止で完全終了',async()=>{
 const {SOLO_STAGES}=await config,s=SOLO_STAGES[0],h=practiceHarness({bpm:s.bpm,bars:s.practiceBars}),c=h.context;c.currentStage=s;h.prepareScore();c.practiceRepeatSelect.value=repeat;
 await c.startPractice();assert.equal(c.isPracticing,true);const cycles=repeat==='unlimited'?2:Number(repeat);h.advance(.3+4+12*cycles+.1);
 assert.equal(c.isPracticing,repeat==='unlimited');assert.equal(h.phases.filter(p=>p.phase==='count-in').length,4);if(repeat==='unlimited')c.stopPractice();assert.equal(h.timers.size,0);
});
test('ソロ録音練習も既存Recorder・1回完了経路を使う',async()=>{
 const s=(await config).SOLO_STAGES[0],h=practiceHarness({bpm:60,bars:3}),c=h.context;c.currentStage=s;h.prepareScore();c.practiceRepeatSelect.value='5';await c.startPractice('record');
 assert.equal(c.practiceSession.repeatCount,1);assert.equal(h.recorders.length,1);h.advance(21);assert.equal(c.isPracticing,false);assert.equal(h.urls.length,1);assert.equal(h.timers.size,0);
});
test('コピーしたtest3はalphaTab 1.8.4 build34で読み込め、小音符3分類を維持',async t=>{
 const lib=path.join(os.tmpdir(),'notation-lab-alphaTab-1.8.4.cjs');if(!fs.existsSync(lib)){t.skip('取得済み1.8.4キャッシュが必要');return;}
 const alpha=require(lib);assert.equal(alpha.meta.version,'1.8.4');assert.match(fs.readFileSync(lib,'utf8').slice(0,120),/build 34/);
 const {Element,parse}=fixture('technique-markers.test.cjs','const source =','({Element,parse});');Object.defineProperty(Element.prototype,'localName',{get(){return this.tagName;}});
 global.DOMParser=class{parseFromString(x){const d=parse(x);d.documentElement=d.querySelector('score-partwise');return d;}};
 const xml=fs.readFileSync(path.join(root,(await config).SOLO_STAGES[0].file),'utf8'),m=await import(pathToFileURL(path.join(root,'js/graceNotation.js')).href);
 const score=alpha.importer.ScoreLoader.loadScoreFromBytes(new TextEncoder().encode(xml),new alpha.Settings());assert.equal(score.masterBars.length,3);
 const source=m.analyzeGraceSource(xml);assert.deepEqual(source.groups.map(g=>g.kind),['single','chord','sequence']);assert.ok(m.matchGraceModel(source,score).groups[2].symbols.reasons.includes('sequence-symbols-out-of-scope'));
 assert.equal(new alpha.Settings().display.resources.graceFont.size,12);
});
