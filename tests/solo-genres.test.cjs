const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),os=require('node:os');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),config=import(pathToFileURL(path.join(root,'js/config.js')).href);
// test5固有の期待値はここで管理。正式教材への差替え時はこの定義を見直す。
// configには旧3小節のフォールバックが残る。変更せず、読込後は実譜面4小節を使うことを別に検証する。
const SOLO_PREVIEW=Object.freeze({file:'scores/solo/test5.musicxml',bars:4,configFallbackBars:3,
 graceNotes:8,graceBeats:7,groups:['single','chord','sequence','single','single','single'],slurs:8,graceSlurs:5,ties:14});
function scoreXml(stage){const xml=fs.readFileSync(path.join(root,stage.file),'utf8');return{xml,bars:(xml.match(/<measure\b/g)||[]).length};}
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
test('ソロEX1を独立configから再exportし、検証用・60 BPM・test5実譜面4小節・4/4',async()=>{
 const c=await config,solo=await import(pathToFileURL(path.join(root,'js/config/solo.js')).href),index=await import(pathToFileURL(path.join(root,'js/config/index.js')).href);
 assert.equal(c.SOLO_STAGES,solo.SOLO_STAGES);assert.equal(index.SOLO_STAGES,solo.SOLO_STAGES);assert.equal(c.SOLO_STAGES.length,1);const s=c.SOLO_STAGES[0];
 assert.equal(s.id,1);assert.equal(s.code,'EX1');assert.equal(s.bpm,60);assert.equal(s.practiceBars,SOLO_PREVIEW.configFallbackBars);assert.equal(s.countInBars,1);assert.deepEqual(s.timeSignature,[4,4]);assert.equal(s.isPreview,true);assert.equal(s.available,true);
 assert.equal(s.title,'EX1：小音符・奏法表示テスト');assert.equal(s.file,SOLO_PREVIEW.file);assert.ok(s.guide.content.includes('仮教材'));
 assert.ok(fs.statSync(path.join(root,s.file)).isFile());const {xml,bars}=scoreXml(s);assert.equal(bars,SOLO_PREVIEW.bars);assert.match(xml,/<beats>4<\/beats>/);assert.match(xml,/<beat-type>4<\/beat-type>/);
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
 const genre=await tabs();genre.entries[1].tab.click();assert.equal(genre.controller.selected,'solo');
 const home=boot(),files=[],h=scoreHarness({fetch:async file=>{files.push(file);return{ok:true,text:async()=>fs.readFileSync(path.join(root,file),'utf8')};}});let opening;
 assert.equal(home.soloCards.length,1);assert.equal(home.soloCards[0].id,'solo-1');
 home.context.openPracticeModal=s=>{opening=h.open(s);};home.soloCards[0].dispatch('click');await opening;
 const stage=home.evaluate('SOLO_STAGES[0]');assert.equal(h.c.currentStage,stage);assert.equal(h.c.currentBpm,60);assert.deepEqual(files,[stage.file]);
 const {xml,bars}=scoreXml(stage);assert.equal(bars,SOLO_PREVIEW.bars);assert.equal(new TextDecoder().decode(h.c.api.loadCalls[0]),xml);h.complete(h.c.api,bars);
 assert.equal(h.c.scoreLoadState,'ready');assert.equal(h.c.mainActionBtn.disabled,false);assert.equal(h.c.recordPracticeBtn.disabled,false);assert.equal(h.c.stageGuideTitle.innerText,stage.guide.title);
 assert.ok(h.c.stageGuideBody.innerHTML.includes(stage.guide.content));assert.equal(h.c.verticalTabController.hasCards,true);assert.equal(h.c.verticalTabController.barCount,bars);assert.equal(h.c.preparedScore.bars,bars);assert.equal(h.c.getStagePracticeBars(stage),bars);assert.equal(h.c.modalBarsBadge.innerText,`${bars}小節`);
 await h.c.startPractice();assert.equal(h.c.practiceSession.practiceBars,bars);h.c.stopPractice();
 h.c.closePracticeModal();assert.equal(h.c.practiceModal.classList.contains('hidden'),true);
 assert.equal(genre.controller.selected,'solo');genre.entries[0].tab.click();assert.equal(genre.controller.selected,'basic');
});
test('ソロXMLの失敗・再試行とBasicへの切替は既存世代ガードを使う',async()=>{
 const c=await config,files=[];let failure=true;const h=scoreHarness({fetch:async file=>{files.push(file);return{ok:!failure,status:404,text:async()=>'<score-partwise />'};}});
 const {bars}=scoreXml(c.SOLO_STAGES[0]);await h.open(c.SOLO_STAGES[0]);assert.equal(h.c.scoreLoadState,'error');assert.equal(h.c.retryScoreBtn.hidden,false);failure=false;await h.c.retryScoreLoad();h.complete(h.c.api,bars);assert.equal(h.c.scoreLoadState,'ready');
 const old=h.c.api;h.c.closePracticeModal();await h.open(c.BASIC_STAGES[0]);h.complete(old,bars);assert.equal(h.c.scoreLoadState,'loading');h.complete(h.c.api,4);assert.equal(h.c.preparedScore.stage,c.BASIC_STAGES[0]);assert.deepEqual(files.slice(0,2),[c.SOLO_STAGES[0].file,c.SOLO_STAGES[0].file]);
});
for(const repeat of ['1','3','unlimited'])test('ソロ実譜面の既存練習：'+repeat+'回・カウントイン1回・停止で完全終了',async()=>{
 const {SOLO_STAGES}=await config,s=SOLO_STAGES[0],{bars}=scoreXml(s),h=practiceHarness({bpm:s.bpm,bars}),c=h.context;c.currentStage=s;h.prepareScore();c.practiceRepeatSelect.value=repeat;
 await c.startPractice();assert.equal(c.isPracticing,true);assert.equal(c.practiceSession.practiceBars,bars);const cycles=repeat==='unlimited'?2:Number(repeat);h.advance(.3+4+bars*s.timeSignature[0]*cycles+.1);
 assert.equal(c.isPracticing,repeat==='unlimited');assert.equal(h.phases.filter(p=>p.phase==='count-in').length,4);if(repeat==='unlimited')c.stopPractice();assert.equal(h.timers.size,0);
});
test('ソロ録音練習も既存Recorder・1回完了経路を使う',async()=>{
 const s=(await config).SOLO_STAGES[0],{bars}=scoreXml(s),h=practiceHarness({bpm:60,bars}),c=h.context;c.currentStage=s;h.prepareScore();c.practiceRepeatSelect.value='5';await c.startPractice('record');
 assert.equal(c.practiceSession.repeatCount,1);assert.equal(c.practiceSession.practiceBars,bars);assert.equal(c.practiceSession.totalSteps,(s.countInBars+bars)*s.timeSignature[0]+4);assert.equal(h.recorders.length,1);h.advance(c.practiceSession.finishTime+.1);assert.equal(c.isPracticing,false);assert.equal(h.urls.length,1);assert.equal(h.timers.size,0);
});
test('登録test5をalphaTab 1.8.4 build34で読み込み、原本の小音符分類・スラー・通常タイを保持',async t=>{
 const lib=path.join(os.tmpdir(),'notation-lab-alphaTab-1.8.4.cjs');if(!fs.existsSync(lib)){t.skip('取得済み1.8.4キャッシュが必要');return;}
 const alpha=require(lib);assert.equal(alpha.meta.version,'1.8.4');assert.match(fs.readFileSync(lib,'utf8').slice(0,120),/build 34/);
 const {Element,parse}=fixture('technique-markers.test.cjs','const source =','({Element,parse});');Object.defineProperty(Element.prototype,'localName',{get(){return this.tagName;}});
 const previousParser=global.DOMParser;t.after(()=>{if(previousParser===undefined)delete global.DOMParser;else global.DOMParser=previousParser;});
 global.DOMParser=class{parseFromString(x){const d=parse(x);d.documentElement=d.querySelector('score-partwise');return d;}};
 const {xml,bars}=scoreXml((await config).SOLO_STAGES[0]),m=await import(pathToFileURL(path.join(root,'js/graceNotation.js')).href),doc=new DOMParser().parseFromString(xml);
 const score=alpha.importer.ScoreLoader.loadScoreFromBytes(new TextEncoder().encode(xml),new alpha.Settings());assert.equal(score.masterBars.length,SOLO_PREVIEW.bars);assert.equal(score.masterBars.length,bars);
 const source=m.analyzeGraceSource(xml),matched=m.matchGraceModel(source,score);assert.equal(source.status,'parsed');assert.equal(matched.status,'matched');assert.deepEqual(matched.diagnostics,[]);
 assert.equal(doc.querySelectorAll('grace').length,SOLO_PREVIEW.graceNotes);assert.equal(source.notes.filter(n=>n.grace).length,SOLO_PREVIEW.graceNotes);assert.equal(source.beats.filter(b=>b.grace).length,SOLO_PREVIEW.graceBeats);
 assert.deepEqual(source.groups.map(g=>g.kind),SOLO_PREVIEW.groups);assert.equal(matched.notes.length,source.notes.length);assert.equal(matched.groups.length,source.groups.length);
 const bySource=new Map(matched.notes.map(n=>[n.sourceNoteId,n])),actualBySource=new Map(),beats=score.tracks.flatMap(t=>t.staves.flatMap(s=>s.bars.flatMap(b=>b.voices.flatMap(v=>v.beats))));
 for(const row of source.notes){const staff=score.tracks[row.partIndex].staves[row.staffIndex],beat=staff.bars[row.barIndex].voices[row.voiceIndex].beats[row.beatIndex],note=beat.notes[row.noteIndex];actualBySource.set(row.id,note);
  assert.equal(note.id,bySource.get(row.id).noteId);assert.equal(note.beat,beat);assert.equal(note.string,staff.tuning.length-row.string+1);assert.equal(note.fret,row.fret);assert.equal(beat.voice.index,row.voiceIndex);assert.equal(beat.index,row.beatIndex);assert.equal(note.index,row.noteIndex);assert.equal(!!beat.graceType,row.grace);assert.equal(beat.displayStart,row.offsetTicks);
 }
 const graceBeats=beats.filter(b=>b.graceType),modelGroups=[...new Set(graceBeats.map(b=>b.graceGroup))];assert.equal(graceBeats.length,SOLO_PREVIEW.graceBeats);assert.equal(graceBeats.reduce((sum,b)=>sum+b.notes.length,0),SOLO_PREVIEW.graceNotes);
 assert.equal(modelGroups.length,SOLO_PREVIEW.groups.length);assert.deepEqual(modelGroups.map(g=>g.beats.length>1?'sequence':g.beats[0].notes.length>1?'chord':'single'),SOLO_PREVIEW.groups);
 for(const group of source.groups){const actual=group.noteIds.map(id=>actualBySource.get(id)),modelGroup=actual[0].beat.graceGroup;assert.ok(actual.every(n=>n.beat.graceGroup===modelGroup));assert.deepEqual(modelGroup.beats.flatMap(b=>b.notes.map(n=>n.id)),actual.map(n=>n.id));}
 assert.ok(matched.groups.find(g=>g.kind==='sequence').symbols.reasons.includes('sequence-symbols-out-of-scope'));
 assert.equal(source.slurs.length,SOLO_PREVIEW.slurs);assert.equal(matched.slurs.length,SOLO_PREVIEW.graceSlurs);assert.equal(doc.querySelectorAll('slur[type="start"]').length,source.slurs.length);
 for(const pair of source.slurs){const from=actualBySource.get(pair.start),to=actualBySource.get(pair.end);assert.equal(pair.valid,true);assert.equal(from.slurDestination,to);assert.equal(to.slurOrigin,from);}
 const graceSlurs=matched.slurs.map(s=>[s.logical.fromNoteId,s.logical.toNoteId]);assert.ok(matched.slurs.every(s=>s.slur.eligible));
 assert.equal(source.ties.length,SOLO_PREVIEW.ties);assert.equal(matched.ties.length,source.ties.length);assert.ok(matched.ties.every(tie=>tie.verified));
 for(const pair of source.ties){const from=actualBySource.get(pair.start),to=actualBySource.get(pair.end);assert.equal(pair.valid,true);assert.equal(from.tieDestination,to);assert.equal(to.tieOrigin,from);assert.equal(to.isTieDestination,true);assert.equal(from.beat.graceType,0);assert.equal(to.beat.graceType,0);assert.ok(!graceSlurs.some(([a,b])=>a===from.id&&b===to.id));}
 assert.ok(source.words.some(w=>w.raw==='P'&&actualBySource.get(source.beats.find(b=>b.id===w.anchorBeatId).notes[0]).beat.graceType===0));
 assert.ok(source.slurs.some(p=>actualBySource.get(p.start).beat.graceType===0));assert.ok(matched.slurs.some(p=>actualBySource.get(source.slurs.find(s=>s.id===p.sourceSlurId).end).beat.notes.length>1));
 assert.equal(new alpha.Settings().display.resources.graceFont.size,12);
});
