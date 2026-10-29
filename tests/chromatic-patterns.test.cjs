const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),{inflateRawSync}=require('node:zlib'),{pathToFileURL}=require('node:url');
const {pickerFixture,categoryFixture}=require('./helpers/chromatic-ui.cjs');
const root=path.join(__dirname,'..'),config=import(pathToFileURL(path.join(root,'js/config.js')).href);
const expected=['1234','1243','1324','1342','1423','1432','2134','2143','2314','2341','2413','2431','3124','3142','3214','3241','3412','3421','4123','4132','4213','4231','4312','4321'];
const readSource=fs.readFileSync(path.join(__dirname,'solo-genres.test.cjs'),'utf8'),readMxl=vm.runInNewContext(readSource.slice(readSource.indexOf('function readMxl('),readSource.indexOf('const genres='))+'\nreadMxl;',{assert,Buffer,inflateRawSync});
const alphaFile=require('./helpers/alpha-tab.cjs').alphaFile,alpha=require('./helpers/alpha-tab.cjs').alpha;
const original=readMxl(fs.readFileSync(path.join(root,'scores/chromatic/ex01.mxl'))).xml;
const tag=(xml,name)=>xml.match(new RegExp('<'+name+'>([^<]+)</'+name+'>'))?.[1];
const physicalStrings=[6,5,4,3,2,1,1,2,3,4,5,6],openMidi={1:64,2:59,3:55,4:50,5:45,6:40},stepMidi={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
test('24順列・EX番号・独立IDは正式対応表どおり、総40教材、既存16件を維持',async()=>{
 const c=await config,stages=c.CHROMATIC_STAGES;assert.equal(stages.length,24);assert.deepEqual(stages.map(s=>s.fingering),expected);
 assert.equal(new Set(stages.map(s=>s.fingering)).size,24);assert.ok(stages.every(s=>[...s.fingering].sort().join('')==='1234'));
 assert.deepEqual(stages.map(s=>s.id),Array.from({length:24},(_,i)=>i+1));assert.equal(new Set(stages.map(s=>s.file)).size,24);
 assert.equal(c.TUTORIAL_STAGES.length,3);assert.equal(c.BASIC_STAGES.length,10);assert.equal(c.SOLO_STAGES.length,3);
 const keys=[['tutorial',c.TUTORIAL_STAGES],['basic',c.BASIC_STAGES],['solo',c.SOLO_STAGES],['chromatic',stages]].flatMap(([k,a])=>a.map(s=>k+'-'+s.id));
 assert.equal(keys.length,40);assert.equal(new Set(keys).size,40);
 assert.equal(alpha.meta.version,'1.8.4');assert.match(fs.readFileSync(alphaFile,'utf8').slice(0,200),/build 34/);
});
for(const[index,pattern]of expected.entries())test('EX'+String(index+1).padStart(2,'0')+' '+pattern+'：実MXL展開・12小節・96音のpitch/string/fretとalphaTabモデル整合',async()=>{
 const stage=(await config).CHROMATIC_STAGES[index],bytes=fs.readFileSync(path.join(root,stage.file)),mxl=readMxl(bytes),xml=mxl.xml,score=alpha.importer.ScoreLoader.loadScoreFromBytes(bytes,new alpha.Settings());
 assert.equal(stage.code,'EX'+String(index+1).padStart(2,'0'));assert.equal(stage.id,index+1);assert.equal(stage.patternType,'single');
 assert.deepEqual(stage.fretOrder,[...pattern].map(n=>Number(n)+4));assert.equal(stage.bpm,80);assert.deepEqual(stage.timeSignature,[4,4]);assert.equal(stage.practiceBars,12);assert.equal(stage.countInBars,1);assert.equal(stage.available,true);
 assert.equal(mxl.bars,12);assert.equal(score.masterBars.length,12);
 assert.equal(xml.match(/<staff-details>[\s\S]*?<\/staff-details>/)[0],original.match(/<staff-details>[\s\S]*?<\/staff-details>/)[0]);
 assert.doesNotMatch(xml,/<(?:rest|chord|grace|time-modification|tuplet|tie)\b/);
 const measures=[...xml.matchAll(/<measure\b[^>]*>([\s\S]*?)<\/measure>/g)].map(m=>m[1]);
 let count=0;
 for(const[barIndex,measure]of measures.entries()){
  const notes=[...measure.matchAll(/<note\b[^>]*>([\s\S]*?)<\/note>/g)].map(n=>n[1]),beats=score.tracks[0].staves[0].bars[barIndex].voices[0].beats;
  assert.equal(notes.length,8);assert.equal(beats.length,8);assert.equal(score.masterBars[barIndex].timeSignatureNumerator,4);assert.equal(score.masterBars[barIndex].timeSignatureDenominator,4);
  for(const[i,n]of notes.entries()){
   const string=Number(tag(n,'string')),fret=Number(tag(n,'fret')),midi=(Number(tag(n,'octave'))+1)*12+stepMidi[tag(n,'step')]+Number(tag(n,'alter')||0),beat=beats[i],note=beat.notes[0];
   assert.equal(string,physicalStrings[barIndex]);assert.equal(fret,stage.fretOrder[i%4]);assert.equal(midi,openMidi[string]+fret);assert.equal(tag(n,'voice'),'1');assert.equal(tag(n,'type'),'eighth');assert.equal(Number(tag(n,'duration')),1);
   assert.equal(beat.notes.length,1);assert.equal(7-note.string,string);assert.equal(note.fret,fret);assert.equal(note.realValue,midi);assert.equal(beat.duration,8);assert.equal(beat.playbackDuration,480);assert.equal(beat.graceType,0);
   assert.equal(note.isTieDestination,false);count++;
  }
 }
 assert.equal(count,96);
 if(index===0)assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'f298ac010fdf71979a12f737b71ca2e5126bfe4dc8cd4b9a09dc4d13ffb25199');
 else assert.ok(xml.includes('クロマチック '+stage.code+'・運指'+pattern));
});
test('選択ボタン24個は全て正しい教材情報へ対応し、選択だけでモーダルを開かない',async()=>{
 const stages=(await config).CHROMATIC_STAGES,h=pickerFixture(stages);
 assert.equal(h.buttons.length,24);assert.equal(h.controller.selected,stages[0]);
 for(const[i,b]of h.buttons.entries()){
  b.dispatch('click');assert.equal(h.controller.selected,stages[i]);assert.equal(h.opened.length,i);
  assert.equal(h.buttons.filter(n=>n.getAttribute('aria-pressed')==='true').length,1);assert.equal(b.getAttribute('aria-pressed'),'true');
  assert.equal(h.fields.get('[data-chromatic-title]').innerText,stages[i].title);assert.ok(h.fields.get('[data-chromatic-meta]').innerText.includes(stages[i].fingering));assert.ok(h.fields.get('[data-chromatic-frets]').innerText.includes(stages[i].fretOrder.join(' → ')));
  h.fields.get('#chromaticStartBtn').dispatch('click');assert.equal(h.opened[i],stages[i]);assert.equal(h.win.location.hash,'#chromatic-'+(i+1));
 }
});
test('運指選択のEnter/Space・左右・Home/Endは選択状態とフォーカスを同期',async()=>{
 const stages=(await config).CHROMATIC_STAGES,h=pickerFixture(stages);
 for(const[key,at,next]of[['Enter',3,3],[' ',4,4],['ArrowRight',0,1],['ArrowLeft',0,23],['Home',23,0],['End',0,23]]){
  let prevented=false;h.buttons[at].dispatch('keydown',{key,preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(h.controller.selected,stages[next]);assert.equal(h.buttons[next].focused,true);
 }assert.equal(h.opened.length,0);
});
test('運指URLの初回・戻る・進むと再描画が最新の選択を復元し、イベントを重複しない',async()=>{
 const stages=(await config).CHROMATIC_STAGES,h=pickerFixture(stages,'#chromatic-8');assert.equal(h.controller.selected,stages[7]);
 h.buttons[23].dispatch('click');h.go(-1);assert.equal(h.controller.selected,stages[7]);h.go(1);assert.equal(h.controller.selected,stages[23]);
 h.controller.destroy();assert.equal(h.events.hashchange.size,0);assert.equal(h.events.popstate.size,0);
 const fresh=h.init(h.root,stages,()=>{});assert.equal(fresh.selected,stages[23]);assert.equal(h.events.hashchange.size,1);assert.equal(h.events.popstate.size,1);
});
test('複合パターンは単独選択に混入せず、将来の分類を既存IDと分離',async()=>{
 const stages=(await config).CHROMATIC_STAGES,h=pickerFixture([...stages,{...stages[0],id:25,patternType:'combined'}]);assert.equal(h.buttons.length,24);
 h.navigate('#chromatic-25');assert.equal(h.controller.selected,stages[0]);h.navigate('#chromatic-999');assert.equal(h.controller.selected,stages[0]);
});
test('初期は基礎編だけ、カテゴリカードのhashで対象一覧のみ表示し選択状態を示す',()=>{
 const h=categoryFixture();assert.equal(h.controller.category,'basic');assert.equal(h.sections.filter(s=>!s.hidden).length,1);
 for(const key of['tutorial','chromatic','basic','solo']){
  h.navigate('#'+key+'Exercises');assert.equal(h.controller.category,key);assert.equal(h.controller.selected,key==='solo'?'solo':'basic');assert.equal(h.sections.filter(s=>!s.hidden).length,1);assert.equal(h.sections.find(s=>s.dataset.exerciseCategory===key).hidden,false);
  for(const link of h.links)assert.equal(link.getAttribute('aria-current'),link.getAttribute('href')==='#'+key+'Exercises'?'true':null);
 }
});
test('各教材への旧hash直リンクを維持し、カテゴリの戻る／進む・空hashを復元',()=>{
 for(const key of['tutorial-1','basic-1','chromatic-24','solo-1']){
  const h=categoryFixture('#'+key);assert.equal(h.controller.category,key.split('-')[0]);
 }
 const h=categoryFixture();h.navigate('#tutorialExercises');h.navigate('#chromatic-24');h.go(-1);assert.equal(h.controller.category,'tutorial');h.go(1);assert.equal(h.controller.category,'chromatic');h.go(-2);assert.equal(h.controller.category,'basic');
 h.navigate('#%broken');assert.equal(h.controller.category,'basic');h.navigate('#unknown');assert.equal(h.controller.category,'basic');
});
test('上部の既存2タブを維持し、カテゴリ選択・URL履歴とスクロール位置を共存',()=>{
 const h=categoryFixture('#chromaticExercises');h.win.scrollY=350;h.entries[1].tab.dispatch('click');assert.equal(h.controller.category,'solo');assert.equal(h.win.location.hash,'#soloExercises');
 h.win.scrollY=90;h.entries[0].tab.dispatch('click');assert.equal(h.controller.category,'chromatic');assert.equal(h.win.location.hash,'#chromaticExercises');assert.equal(h.win.scrollY,350);
 h.go(-1);assert.equal(h.controller.category,'solo');h.go(1);assert.equal(h.controller.category,'chromatic');
});
