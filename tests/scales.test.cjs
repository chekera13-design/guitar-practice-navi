const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {scaleFixture,scaleCategoryFixture}=require('./helpers/scale-ui.cjs');
const {createPracticeProgress}=require('./helpers/practice-progress.cjs');
const root=path.join(__dirname,'..'),config=import(pathToFileURL(path.join(root,'js/config.js')).href),scales=import(pathToFileURL(path.join(root,'js/config/scales.js')).href);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const provenance=JSON.parse(fs.readFileSync(path.join(root,'scores/scales/manifest.json'),'utf8'));
function fixture(file,marker,name){const s=fs.readFileSync(path.join(__dirname,file),'utf8');return vm.runInNewContext(s.slice(0,s.indexOf(marker))+'\n'+name,{require,__dirname,Blob,TextEncoder,AbortController,setImmediate});}
const boot=fixture('storage.test.cjs',"for (const failure of ['getItem",'boot;');
const scoreFixture=fixture('score-loading.test.cjs',"for (const state of ['idle'",'harness;');
const practice=fixture('practice.test.cjs','for (const repeats of','harness;');

test('10スケール教材を独立登録し、他カテゴリ48件と合わせ58件・一意のIDになる',async()=>{
 const c=await config,s=await scales;
 assert.equal(c.SCALE_STAGES,s.SCALE_STAGES);assert.equal(c.SCALE_KEYS,s.SCALE_KEYS);
 assert.deepEqual(c.SCALE_STAGES.map(x=>x.formId),['C','A','G','E','D','C','A','G','E','D']);
 assert.deepEqual(c.SCALE_STAGES.map(x=>x.code),['EX01','EX02','EX03','EX04','EX05','EX06','EX07','EX08','EX09','EX10']);
 assert.deepEqual(c.SCALE_KEYS.map(x=>x.id),['c','db','d','eb','e','f','fs','g','ab','a','bb','b']);
 assert.deepEqual(c.SCALE_KEYS.map(x=>x.label),['C','D♭','D','E♭','E','F','F♯','G','A♭','A','B♭','B']);
 const groups={tutorial:c.TUTORIAL_STAGES,basic:c.BASIC_STAGES,solo:c.SOLO_STAGES,chromatic:c.CHROMATIC_STAGES,chords:c.CHORD_STAGES,scales:c.SCALE_STAGES};
 assert.deepEqual(Object.values(groups).map(a=>a.length),[3,10,3,24,8,10]);
 const ids=Object.entries(groups).flatMap(([k,a])=>a.map(s=>k+'-'+s.id));assert.equal(ids.length,58);assert.equal(new Set(ids).size,58);
 for(const stage of c.SCALE_STAGES.slice(0,5)){assert.equal(stage.bpm,60);assert.deepEqual(stage.timeSignature,[4,4]);assert.equal(stage.countInBars,1);assert.equal(stage.practiceBars,9);assert.equal(stage.lessonType,'major-scale');assert.equal(stage.keyId,'c');assert.equal(stage.variants.length,12);}
 assert.notEqual(c.SCALE_STAGES[0],c.BASIC_STAGES[8]);assert.equal(c.BASIC_STAGES[8].file,'scores/basic/ex09.mxl');
});

test('60MXLは検証済みmanifestとバイト一致し、最新D原本と参考のハッシュも一致',async()=>{
 const s=await scales;assert.equal(provenance.forms.length,5);let count=0;
 for(const [index,form]of provenance.forms.entries()){
  assert.equal(form.lessonId,'scales-'+(index+1));assert.equal(sha(fs.readFileSync(path.join(root,form.baseSource))),form.sourceSha256);
  if(form.reference)assert.equal(sha(fs.readFileSync(path.join(root,form.reference))),form.referenceSha256);
  for(const v of form.variants){
   assert.match(v.keyId,/^[a-z]+$/);assert.match(v.file,new RegExp('^scores/scales/'+form.form.toLowerCase()+'/[a-z]+\\.mxl$'));
   assert.equal(sha(fs.readFileSync(path.join(root,v.file))),v.sha256);
   const stage=s.getScaleVariant(s.SCALE_STAGES[index],v.keyId);assert.equal(stage.file,v.file);assert.equal(stage.semitones,v.semitones);assert.equal(stage.minFret,v.range.minFret);assert.equal(stage.maxFret,v.range.maxFret);count++;
  }
 }assert.equal(count,60);assert.equal(fs.readdirSync(path.join(root,'scores/scales')).filter(x=>x.endsWith('.py')).length,0);
 const d=provenance.forms[4];assert.equal(d.labManifest,'generated-d-revised/D/manifest.json');
});

test('選択キーは安定した別オブジェクトで、開いている設定や基準Cを変質させない',async()=>{
 const s=await scales,a=s.SCALE_STAGES[0],b=s.getScaleVariant(a,'b');
 assert.equal(s.getScaleVariant(a,'c'),a);assert.equal(s.getScaleVariant(a,'b'),b);assert.notEqual(a,b);
 assert.equal(a.keyId,'c');assert.equal(b.keyId,'b');assert.equal(a.lessonId,b.lessonId);assert.equal(b.formId,'C');
 assert.equal(s.getScaleVariant(a,'fs').keyLabel,'F♯');assert.equal(s.getScaleVariant(a,'F#'),null);assert.equal(s.getScaleVariant({...a},'b'),null);
});

test('全5フォーム×12キーは選択だけで起動せず、開始時に正しい設定を渡す',async()=>{
 const s=await scales,h=scaleFixture(s);
 for(let i=0;i<5;i++)for(let k=0;k<12;k++){
  const n=h.opened.length;h.forms[i].dispatch('click');h.keys[k].dispatch('click');assert.equal(h.opened.length,n);
  const expected=s.getScaleVariant(s.SCALE_STAGES[i],s.SCALE_KEYS[k].id);assert.equal(h.controller.selected,expected);
  assert.equal(h.fields.get('[data-scale-key-label]').innerText,expected.keyLabel+'メジャー');
  assert.equal(h.forms.filter(b=>b.getAttribute('aria-pressed')==='true').length,1);assert.equal(h.keys.filter(b=>b.getAttribute('aria-pressed')==='true').length,1);
  h.fields.get('#scaleStartBtn').dispatch('click');assert.equal(h.opened.at(-1),expected);
 }
 assert.equal(h.opened.length,60);assert.equal(h.win.location.hash,'#scales-5');
});

test('初期C、キー変更でフォームを維持し、フォームごとのキーをページ内で保持',async()=>{
 const s=await scales,h=scaleFixture(s);assert.equal(h.controller.selected.keyId,'c');
 h.keys[11].dispatch('click');const b=h.controller.selected;h.fields.get('#scaleStartBtn').dispatch('click');
 h.keys[6].dispatch('click');assert.equal(h.controller.selected.formId,'C');assert.equal(h.opened[0],b);assert.equal(h.opened[0].keyId,'b');
 h.forms[1].dispatch('click');assert.equal(h.controller.selected.keyId,'c');h.keys[11].dispatch('click');h.forms[0].dispatch('click');assert.equal(h.controller.selected.keyId,'fs');
});

test('キーはURLと保存領域に含めず、同じ選択は余分な履歴を追加しない',async()=>{
 const s=await scales,h=scaleFixture(s,'#scales-1');const length=h.history.length;
 for(let i=0;i<25;i++)h.keys[i%12].dispatch('click');assert.equal(h.history.length,length);assert.equal(h.win.location.hash,'#scales-1');
 h.forms[0].dispatch('click');assert.equal(h.history.length,length);h.forms[2].dispatch('click');assert.equal(h.history.length,length+1);
 assert.doesNotMatch(fs.readFileSync(path.join(root,'js/scalePractice.js'),'utf8'),/localStorage|setItem|fetch\(|AudioContext|requestAnimationFrame|setInterval/);
});

test('教材ハッシュの直接表示・戻る・進むを復元し、再読み込みではCになる',async()=>{
 const s=await scales,h=scaleFixture(s,'#scales-5');assert.equal(h.controller.selected,s.SCALE_STAGES[4]);
 h.keys[4].dispatch('click');h.forms[1].dispatch('click');h.go(-1);assert.equal(h.controller.selected.formId,'D');assert.equal(h.controller.selected.keyId,'e');h.go(1);assert.equal(h.controller.selected.formId,'A');
 const reload=scaleFixture(s,h.win.location.hash);assert.equal(reload.controller.selected.formId,'A');assert.equal(reload.controller.selected.keyId,'c');
 h.navigate('#scales-999');assert.equal(h.controller.selected.formId,'A');h.navigate('#scales-1');assert.equal(h.controller.selected.formId,'C');
});

test('スケールだけを表示し、カテゴリ履歴で既存教材へ戻れる',()=>{
 const h=scaleCategoryFixture('#scales-5');assert.equal(h.controller.category,'scales');assert.equal(h.sections.filter(s=>!s.hidden).length,1);
 h.navigate('#chordExercises');assert.equal(h.controller.category,'chords');h.go(-1);assert.equal(h.controller.category,'scales');h.go(1);assert.equal(h.controller.category,'chords');
 h.navigate('#basic-9');assert.equal(h.controller.category,'basic');h.navigate('#scaleExercises');assert.equal(h.controller.category,'scales');
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.match(html,/href="#scaleExercises" data-category-link/);assert.match(html,/data-exercise-category="scales" hidden/);assert.match(html,/id="scaleExerciseGrid"/);
});

test('矢印・Home/Endでキーとフォームを選択でき、選択だけでは起動しない',async()=>{
 const s=await scales,h=scaleFixture(s);h.forms[0].dispatch('keydown',{key:'End'});assert.equal(h.controller.selected.formId,'D');assert.equal(h.forms[9].focused,true);
 h.fields.get('#scaleKeyToggle').dispatch('click');
 h.keys[0].dispatch('keydown',{key:'ArrowLeft'});assert.equal(h.controller.selected.keyId,'b');assert.equal(h.keys[11].focused,true);
 h.keys[11].dispatch('keydown',{key:'Home'});assert.equal(h.controller.selected.keyId,'c');assert.equal(h.opened.length,0);
});

test('破棄・再描画で履歴イベントが重複せず、古い開始ボタンは起動しない',async()=>{
 const s=await scales,h=scaleFixture(s);h.forms[3].dispatch('click');const old=h.fields.get('#scaleStartBtn');h.controller.destroy();
 assert.equal(h.events.hashchange.size,0);assert.equal(h.events.popstate.size,0);old.dispatch('click');assert.equal(h.opened.length,0);
 const next=h.init(h.root,s.SCALE_STAGES,()=>{});assert.equal(next.selected.formId,'E');assert.equal(h.events.hashchange.size,1);next.destroy();
});

test('実アプリ起動のスケール開始は他カテゴリとIDを混同せず、保存データを変更しない',()=>{
 const saved=new Map([['chogita_tutorial_completed','["tutorial-1"]'],['chogita_practice_counts_v1','{"version":1,"counts":{"chords-1":3}}']]),h=boot({saved}),opened=[];
 h.assertReady();h.context.openPracticeModal=s=>opened.push(s);
 h.scaleDom.forms[4].dispatch('click');h.scaleDom.keys[4].dispatch('click');h.nodes.get('scaleStartBtn').dispatch('click');
 assert.equal(opened[0],h.evaluate('getScaleVariant(SCALE_STAGES[4],"e")'));assert.equal(opened[0].minFret,0);assert.equal(opened[0].maxFret,5);
 assert.equal(h.writes.length,0);assert.equal(saved.get('chogita_tutorial_completed'),'["tutorial-1"]');assert.equal(h.chordButtons[0].countBadge.textContent,'✓ 練習3回');
});

test('キー変更後の読込・ready・ボタン・縦型9カードが正しい設定へ接続する',async()=>{
 const s=await scales,requested=[],h=scoreFixture({fetch:async file=>{requested.push(file);return{ok:true,text:async()=>'<score-partwise />'};}}),stage=s.getScaleVariant(s.SCALE_STAGES[4],'e');
 await h.open(stage);h.complete(h.c.api,9);assert.equal(requested.at(-1),stage.file);assert.equal(h.c.preparedScore.stage,stage);assert.equal(h.c.scoreLoadState,'ready');assert.equal(h.c.mainActionBtn.disabled,false);assert.equal(h.c.recordPracticeBtn.disabled,false);assert.equal(h.c.verticalTabController.barCount,9);assert.match(h.c.modalStageTitle.innerText,/Eメジャー/);
 h.c.closePracticeModal();await h.open(stage);h.complete(h.c.api,9);assert.equal(requested.at(-1),stage.file);assert.equal(h.c.preparedScore.stage.keyId,'e');
});

test('遅れたCの取得・描画イベントが新しいBキーの譜面を上書きしない',async()=>{
 const s=await scales;let resolve;const pending=new Promise(r=>{resolve=r;}),a=s.SCALE_STAGES[0],b=s.getScaleVariant(a,'b');
 const response={ok:true,text:async()=>'<score-partwise />'},h=scoreFixture({fetch:file=>file===a.file?pending:Promise.resolve(response)});
 await h.open(a);const old=h.c.api,observer=h.observers.at(-1);await h.open(b);const latest=h.c.api;
 h.complete(old,99);observer.fn([{contentRect:{width:400}}]);resolve(response);await new Promise(r=>setImmediate(r));
 assert.equal(old.loadCalls.length,0);h.complete(latest,9);h.complete(old,88);old.error.emit(Error('late'));
 assert.equal(h.c.preparedScore.stage,b);assert.equal(h.c.api,latest);assert.equal(h.c.scoreLoadState,'ready');
});

for(const [repeats,mode]of [[1,'practice'],[3,'practice'],[5,'practice'],[1,'record']])test('スケール '+mode+' '+repeats+'周は36拍/周・カウントイン4拍で正常終了',async()=>{
 const s=await scales,h=practice({bpm:60,bars:9}),c=h.context;c.currentStage=s.getScaleVariant(s.SCALE_STAGES[4],'e');h.prepareScore();c.practiceRepeatSelect.value=String(repeats);await c.startPractice(mode);const session=c.practiceSession;
 assert.equal(session.practiceBeats,36);assert.equal(session.countInBeats,4);assert.equal(session.totalBeats,4+36*repeats);h.advance(session.finishTime+.03);
 assert.equal(c.isPracticing,false);assert.equal(h.timers.size,0);assert.equal(h.ticks.length,4+36*repeats);
 if(mode==='record'){assert.equal(h.urls.length,1);assert.ok(h.streams.every(stream=>stream.getTracks()[0].readyState==='ended'));}
});

test('スケールの停止・再開始・無制限リピートは完走したキーだけ記録する',async()=>{
 const s=await scales,cfg=await config,saved=[],progress=createPracticeProgress({chromatic:cfg.CHROMATIC_STAGES,chords:cfg.CHORD_STAGES,scales:s.SCALE_STAGES.flatMap(stage=>stage.variants.map(v=>s.getScaleVariant(stage,v.keyId)))},()=>({getItem:()=>null,setItem:(...args)=>saved.push(args)}));
 const h=practice({bpm:60,bars:9}),c=h.context;c.currentStage=s.SCALE_STAGES[0];c.practiceProgress=progress;h.prepareScore();c.practiceRepeatSelect.value='unlimited';await c.startPractice();h.advance(80);assert.equal(c.isPracticing,true);c.stopPractice();assert.equal(h.timers.size,0);assert.equal(progress.getCount(s.SCALE_STAGES[0]),2);assert.equal(saved.length,2);
 await c.startPractice();assert.equal(c.practiceSession.lastStep,-1);c.stopPractice();assert.equal(progress.getCount(s.SCALE_STAGES[0]),2);assert.equal(saved.length,2);assert.equal(progress.getCount(cfg.CHORD_STAGES[0]),0);
});
