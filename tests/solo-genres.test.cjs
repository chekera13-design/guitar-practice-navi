const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {inflateRawSync}=require('node:zlib'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),config=import(pathToFileURL(path.join(root,'js/config.js')).href);
// 正式教材固有の期待値はここに集約。周回・録音・再試行は各共通機能テストで保護する。
const SOLO_LESSONS=[
 {id:1,code:'EX01',title:'EX01：コードの響きとベースライン',bpm:100,bars:8,file:'scores/solo/ex01.mxl'},
 {id:2,code:'EX02',title:'EX02：メロディーとベースの組み合わせ',bpm:60,bars:4,file:'scores/solo/ex02.mxl'},
 {id:3,code:'EX03',title:'EX03：アルペジオとコードの先取り',bpm:140,bars:8,file:'scores/solo/ex03.mxl'}
];

// テスト用ZIP展開。登録MXLの中央ディレクトリを読み、実データだけを返す。
// ダミーXMLや隣接するMusicXMLファイルへ差し替えず、音符を含む原本バイトを検証する。
function readMxl(bytes){
 const end=bytes.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));assert.ok(end>=0,'MXL ZIP end record');
 const count=bytes.readUInt16LE(end+10);let offset=bytes.readUInt32LE(end+16);const files={};
 for(let i=0;i<count;i++){
  assert.equal(bytes.readUInt32LE(offset),0x02014b50);assert.equal(bytes.readUInt16LE(offset+8)&1,0,'unencrypted fixture');
  const method=bytes.readUInt16LE(offset+10),compressed=bytes.readUInt32LE(offset+20),length=bytes.readUInt32LE(offset+24);
  const nameLength=bytes.readUInt16LE(offset+28),name=bytes.toString('utf8',offset+46,offset+46+nameLength),local=bytes.readUInt32LE(offset+42);
  assert.equal(bytes.readUInt32LE(local),0x04034b50);
  const start=local+30+bytes.readUInt16LE(local+26)+bytes.readUInt16LE(local+28);assert.ok(start+compressed<=bytes.length);
  const packed=bytes.subarray(start,start+compressed);assert.ok(method===0||method===8,'stored/deflated MXL');
  const data=method===0?packed:inflateRawSync(packed);assert.equal(data.length,length);
  assert.ok(!Object.hasOwn(files,name),'unique archive entries');files[name]={async:async format=>{assert.equal(format,'text');return data.toString('utf8');},text:data.toString('utf8')};
  offset+=46+nameLength+bytes.readUInt16LE(offset+30)+bytes.readUInt16LE(offset+32);
 }
 const names=Object.keys(files).filter(name=>name.endsWith('.xml')&&!name.startsWith('META-INF/'));assert.equal(names.length,1,'one score XML');
 const container=files['META-INF/container.xml'];assert.ok(container,'MXL container');
 assert.equal(container.text.match(/<rootfile\b[^>]*full-path="([^"]+)"/)[1],names[0]);
 const xml=files[names[0]].text;assert.match(xml,/<score-partwise\b/);
 return {files,xml,bars:(xml.match(/<measure\b/g)||[]).length};
}

const genres=import(pathToFileURL(path.join(root,'js/practiceGenres.js')).href);
const previousGlobals={window:global.window,document:global.document};
test.afterEach(()=>{for(const [key,value] of Object.entries(previousGlobals)){if(value===undefined)delete global[key];else global[key]=value;}});
function fixture(file,marker,result){const s=fs.readFileSync(path.join(__dirname,file),'utf8');return vm.runInNewContext(s.slice(0,s.indexOf(marker))+'\n'+result,{require,__dirname,Blob,TextEncoder,AbortController,setImmediate});}
const boot=fixture('storage.test.cjs',"for (const failure of ['getItem",'boot;');
const scoreHarness=fixture('score-loading.test.cjs',"for (const state of ['idle'",'harness;');

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
test('正式ソロEX01〜EX03の登録・BPM・拍子・小節数が実MXLと一致する',async()=>{
 const {SOLO_STAGES}=await config;assert.equal(SOLO_STAGES.length,SOLO_LESSONS.length);
 SOLO_LESSONS.forEach((expected,index)=>{
  const stage=SOLO_STAGES[index];for(const key of ['id','code','title','bpm','file'])assert.equal(stage[key],expected[key],expected.code+' '+key);
  assert.equal(stage.practiceBars,expected.bars);assert.equal(stage.countInBars,1);assert.deepEqual(stage.timeSignature,[4,4]);
  assert.equal(stage.available,true);assert.equal(stage.isPreview,false);assert.equal(stage.stageBadge,'ソロギター '+expected.code);
  assert.ok(stage.guide.title&&stage.guide.content&&stage.guide.points.length);assert.doesNotMatch(stage.title+stage.desc+stage.guide.content,/仮教材|表示検証用/);
  const score=readMxl(fs.readFileSync(path.join(root,stage.file)));assert.equal(score.bars,stage.practiceBars);assert.ok(score.xml.includes('<beats>4</beats>'));assert.ok(score.xml.includes('<beat-type>4</beat-type>'));
 });
});

test('Tutorial・Basic・SoloのEX1はカテゴリ付きIDで衝突しない',async()=>{
 const c=await config,keys=[['tutorial',c.TUTORIAL_STAGES],['basic',c.BASIC_STAGES],['solo',c.SOLO_STAGES]].flatMap(([k,a])=>a.map(s=>`${k}-${s.id}`));
 assert.equal(new Set(keys).size,keys.length);assert.ok(keys.includes('tutorial-1'));assert.ok(keys.includes('basic-1'));assert.ok(keys.includes('solo-1'));assert.equal(c.EX1_STAGE,c.BASIC_STAGES[0]);
});
test('正式ソロ3カードの内容・カテゴリと選択先を維持し、Basic・Tutorialを変更しない',()=>{
 const h=boot();h.assertReady();assert.equal(h.soloCards.length,SOLO_LESSONS.length);
 const basic=h.nodes.get('exerciseGrid').innerHTML,tutorial=h.nodes.get('tutorialExerciseGrid').innerHTML,stages=h.evaluate('JSON.stringify(BASIC_STAGES)'),opened=[];
 h.context.openPracticeModal=stage=>opened.push(stage);
 for(const [index,expected]of SOLO_LESSONS.entries()){
  const card=h.soloCards[index],stage=h.evaluate('SOLO_STAGES['+index+']');assert.equal(card.id,'solo-'+expected.id);assert.equal(card.dataset.stageId,String(expected.id));assert.equal(card.dataset.stageCategory,'solo');
  for(const value of [stage.code,stage.title,stage.subTitle,stage.desc,'BPM '+stage.bpm,stage.practiceBars+'小節'])assert.ok(h.nodes.get('soloExerciseGrid').innerHTML.includes(value),value);
  for(const key of ['click','Enter',' ']){const count=opened.length;if(key==='click')card.dispatch('click');else card.dispatch('keydown',{key,preventDefault(){}});assert.equal(opened.length,count+1);assert.equal(opened.at(-1),stage);}
 }
 h.cards[0].dispatch('click');assert.equal(opened.at(-1),h.evaluate('BASIC_STAGES[0]'));h.tutorialCards[0].dispatch('click');assert.equal(opened.at(-1),h.evaluate('TUTORIAL_STAGES[0]'));
 assert.equal(h.nodes.get('exerciseGrid').innerHTML,basic);assert.equal(h.nodes.get('tutorialExerciseGrid').innerHTML,tutorial);assert.equal(h.evaluate('JSON.stringify(BASIC_STAGES)'),stages);
 assert.doesNotMatch(h.nodes.get('soloExerciseGrid').innerHTML,/近日追加|準備中|completion|表示検証用/);
});

test('ソロ操作はチュートリアル完了・保存キーへ書き込まない',()=>{
 const saved=new Map([['chogita_tutorial_completed','["tutorial-1","tutorial-2"]']]),h=boot({saved});
 const before=h.evaluate('JSON.stringify([...completedTutorialStages])');h.context.markTutorialCompleted(h.evaluate('SOLO_STAGES[0]'),'practice');h.context.markTutorialCompleted(h.evaluate('SOLO_STAGES[0]'),'record');
 assert.equal(h.evaluate('JSON.stringify([...completedTutorialStages])'),before);assert.equal(h.writes.length,0);assert.equal(saved.get('chogita_tutorial_completed'),'["tutorial-1","tutorial-2"]');
});
test('正式ソロ3カードから実MXL展開・ready・両練習ボタン・ガイド・小節カードへ接続',async()=>{
 const genre=await tabs();genre.entries[1].tab.click();assert.equal(genre.controller.selected,'solo');
 const home=boot(),files=[],archives=[],h=scoreHarness({fetch:async file=>{
  files.push(file);const bytes=fs.readFileSync(path.join(root,file));return{ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
 }}),c=h.c;
 // alphaTabのDOM描画・完了通知だけを代替し、MXLバイト・XMLは原本を使用する。
 c.JSZip=c.window.JSZip={loadAsync:async buffer=>{const bytes=Buffer.from(buffer);archives.push(bytes);return readMxl(bytes);}};
 let opening,oldApi;home.context.openPracticeModal=stage=>{opening=h.open(stage);};
 for(const [index,expected]of SOLO_LESSONS.entries()){
  home.soloCards[index].dispatch('click');await opening;const stage=home.evaluate('SOLO_STAGES['+index+']'),score=readMxl(fs.readFileSync(path.join(root,stage.file)));
  assert.equal(c.currentStage,stage);assert.equal(c.currentBpm,stage.bpm);assert.equal(c.modalStageTitle.innerText,stage.title);assert.equal(files.at(-1),stage.file);
  assert.deepEqual(archives.at(-1),fs.readFileSync(path.join(root,stage.file)));assert.equal(new TextDecoder().decode(c.api.loadCalls[0]),score.xml);
  assert.equal(c.scoreLoadState,'loading');assert.equal(c.mainActionBtn.disabled,true);assert.equal(c.recordPracticeBtn.disabled,true);
  if(oldApi){h.complete(oldApi,99);assert.equal(c.scoreLoadState,'loading');assert.equal(c.mainActionBtn.disabled,true);}
  h.complete(c.api,score.bars);assert.equal(c.scoreLoadState,'ready');assert.equal(c.mainActionBtn.disabled,false);assert.equal(c.recordPracticeBtn.disabled,false);
  assert.equal(c.stageGuideTitle.innerText,stage.guide.title);for(const text of [stage.guide.content,...stage.guide.points])assert.ok(c.stageGuideBody.innerHTML.includes(text));
  assert.equal(c.verticalTabController.hasCards,true);assert.equal(c.verticalTabController.barCount,score.bars);assert.equal(c.preparedScore.bars,score.bars);assert.equal(c.getStagePracticeBars(stage),score.bars);assert.equal(c.modalBarsBadge.innerText,expected.bars+'小節');
  await c.startPractice();assert.equal(c.practiceSession.practiceBars,score.bars);assert.equal(c.practiceSession.bpm,stage.bpm);c.stopPractice();
  oldApi=c.api;c.closePracticeModal();assert.equal(c.practiceModal.classList.contains('hidden'),true);assert.equal(c.scoreLoadState,'idle');assert.equal(c.preparedScore,null);assert.equal(oldApi.destroyed,true);
 }
 assert.deepEqual(files,SOLO_LESSONS.map(stage=>stage.file));assert.equal(genre.controller.selected,'solo');genre.entries[0].tab.click();assert.equal(genre.controller.selected,'basic');
});
