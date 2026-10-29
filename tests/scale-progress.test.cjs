const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{pathToFileURL}=require('node:url');
const {createPracticeProgress,PRACTICE_COUNT_STORAGE_KEY:KEY}=require('./helpers/practice-progress.cjs');
const {scaleFixture}=require('./helpers/scale-ui.cjs');
const config=import(pathToFileURL(path.join(__dirname,'../js/config.js')).href),scales=import(pathToFileURL(path.join(__dirname,'../js/config/scales.js')).href);
function fixture(file,marker,name){const s=fs.readFileSync(path.join(__dirname,file),'utf8');return vm.runInNewContext(s.slice(0,s.indexOf(marker))+'\n'+name,{require,__dirname,Blob,TextEncoder,AbortController,setImmediate});}
const practice=fixture('practice.test.cjs','for (const repeats of','harness;'),boot=fixture('storage.test.cjs',"for (const failure of ['getItem",'boot;');
async function store(saved=new Map(),failure=null){
 const c=await config,s=await scales,variants=s.SCALE_STAGES.flatMap(stage=>stage.variants.map(v=>s.getScaleVariant(stage,v.keyId,v.positionId))),writes=[];
 const progress=createPracticeProgress({chromatic:c.CHROMATIC_STAGES,chords:c.CHORD_STAGES,scales:variants},()=>{
  if(failure==='access')throw Error('denied');
  return{getItem(k){if(failure==='read')throw Error('denied');return saved.get(k)||null;},setItem(k,v){if(failure==='write')throw Error('quota');saved.set(k,v);writes.push([k,v]);}};
 });
 return{c,s,variants,progress,saved,writes,stage:(i,key='c')=>s.getScaleVariant(s.SCALE_STAGES[i],key)};
}
function complete(p,stage,laps=1,mode='practice'){
 const session={stage,mode,startTime:1,countInBeats:4,practiceBeats:36,beatSec:1,repeatCount:laps};p.beginSession(session);p.recordCompletedLaps(session,5+36*laps);return session;
}
const summary=(p,stage)=>({...p.getScaleSummary(stage)});
const lapEnd=(s,n=1)=>s.startTime+(s.countInBeats+s.practiceBeats*n)*s.beatSec;
async function running(index,key,options={}){
 const state=await store(),h=practice({bpm:60,bars:9,...options}),c=h.context;
 c.currentStage=state.stage(index,key);c.practiceProgress=state.progress;h.prepareScore();return{...state,h,c};
}

test('121パターンは初期0回で、未登録の同名オブジェクトを記録しない',async()=>{
 const s=await store();assert.equal(s.variants.length,121);for(const stage of s.variants)assert.equal(s.progress.getCount(stage),0);
 for(const stage of s.s.SCALE_STAGES)assert.deepEqual(summary(s.progress,stage),{total:'0',practicedKeys:0});
 complete(s.progress,{...s.stage(0)},3);assert.equal(s.writes.length,0);
});

test('C/DbとC/Aフォームは独立し、通常・録音は同じキーへ合算する',async()=>{
 const s=await store();complete(s.progress,s.stage(0,'c'),2);complete(s.progress,s.stage(0,'c'),1,'record');complete(s.progress,s.stage(0,'db'));complete(s.progress,s.stage(1,'c'),2);
 assert.equal(s.progress.getCount(s.stage(0,'c')),3);assert.equal(s.progress.getCount(s.stage(0,'db')),1);assert.equal(s.progress.getCount(s.stage(1,'c')),2);assert.equal(s.progress.getCount(s.stage(1,'db')),0);
 assert.deepEqual(summary(s.progress,s.stage(0)),{total:'4',practicedKeys:2});assert.deepEqual(summary(s.progress,s.stage(1)),{total:'2',practicedKeys:1});
 const data=JSON.parse(s.saved.get(KEY));assert.equal(data.version,1);assert.deepEqual(Object.keys(data.counts).sort(),['scales-1-c','scales-1-db','scales-2-c']);assert.equal(data.counts['scales-1-c'],3);
});

test('全フォームの合計と練習済みキー数は12キーの回数から算出し、別保存しない',async()=>{
 const s=await store();for(let i=0;i<5;i++)for(let k=0;k<12;k++)if(k%3===i%3)complete(s.progress,s.stage(i,s.s.SCALE_KEYS[k].id),k+1);
 for(const stage of s.s.SCALE_STAGES){const counts=stage.variants.map(v=>s.progress.getCount(s.s.getScaleVariant(stage,v.keyId,v.positionId)));assert.deepEqual(summary(s.progress,stage),{total:String(counts.reduce((a,b)=>a+b,0)),practicedKeys:counts.filter(n=>n>0).length});}
 assert.deepEqual(Object.keys(JSON.parse(s.saved.get(KEY))).sort(),['counts','version']);assert.ok(Object.keys(JSON.parse(s.saved.get(KEY)).counts).every(k=>/^scales-[1-5]-(c|db|d|eb|e|f|fs|g|ab|a|bb|b)$/.test(k)));
});

test('練習開始時の記録先は表示変更やsession.stage変更でも再割当てされない',async()=>{
 const s=await store(),a=s.stage(0,'c'),b=s.stage(0,'db'),session={stage:a,mode:'practice',startTime:1,countInBeats:4,practiceBeats:36,beatSec:1,repeatCount:1},notifications=[];
 s.progress.subscribe(stage=>notifications.push(stage));s.progress.beginSession(session);session.stage=b;s.progress.beginSession(session);s.progress.recordCompletedLaps(session,41);
 assert.equal(s.progress.getCount(a),1);assert.equal(s.progress.getCount(b),0);assert.equal(notifications[0],a);
 const unknown={...session,stage:{...a}};s.progress.beginSession(unknown);unknown.stage=a;s.progress.recordCompletedLaps(unknown,100);assert.equal(s.progress.getCount(a),1);
});

test('再読み込みと登録順変更でも教材ID＋キーIDに回数が残る',async()=>{
 const s=await store();complete(s.progress,s.stage(4,'e'),3);complete(s.progress,s.stage(0,'db'));
 const restored=await store(s.saved);assert.equal(restored.progress.getCount(restored.stage(4,'e')),3);assert.equal(restored.progress.getCount(restored.stage(0,'db')),1);
 const newObjects=s.variants.map(stage=>({...stage})).reverse(),p=createPracticeProgress({scales:newObjects},()=>({getItem:k=>s.saved.get(k)}));
 assert.equal(p.getCount(newObjects.find(v=>v.lessonId==='scales-5'&&v.keyId==='e')),3);assert.deepEqual(summary(p,newObjects.find(v=>v.lessonId==='scales-5')),{total:'3',practicedKeys:1});
});

test('既存32教材とTutorialの保存を維持し、双方の加算で他の記録を失わない',async()=>{
 const tutorial='["tutorial-1"]',saved=new Map([['chogita_tutorial_completed',tutorial],[KEY,JSON.stringify({version:1,counts:{'chromatic-1':2,'chords-1':3,'scales-1-db':4}})]]),s=await store(saved);
 complete(s.progress,s.stage(0,'c'));complete(s.progress,s.c.CHORD_STAGES[0]);const data=JSON.parse(saved.get(KEY));
 assert.equal(data.counts['chromatic-1'],2);assert.equal(data.counts['chords-1'],4);assert.equal(data.counts['scales-1-db'],4);assert.equal(data.counts['scales-1-c'],1);assert.equal(saved.get('chogita_tutorial_completed'),tutorial);
 const h=boot({saved});h.assertReady();assert.equal(h.scaleDom.forms[0].total.textContent,'合計5回');assert.equal(h.scaleDom.forms[0].practiced.textContent,'2/12');assert.equal(h.chordButtons[0].countBadge.textContent,'✓ 練習4回');
});

test('不正なキー回数を除外し、合計は安全整数上限を越えても正確に表示できる',async()=>{
 const s=await store(new Map([[KEY,JSON.stringify({version:1,counts:{'scales-1-c':-1,'scales-1-db':'2','scales-1-d':1.5,'scales-1-eb':3,'scales-1':99}})]]));
 assert.deepEqual(summary(s.progress,s.stage(0)),{total:'3',practicedKeys:1});
 const counts=Object.fromEntries(s.s.SCALE_KEYS.map(k=>['scales-1-'+k.id,Number.MAX_SAFE_INTEGER])),huge=await store(new Map([[KEY,JSON.stringify({version:1,counts})]]));
 assert.deepEqual(summary(huge.progress,huge.stage(0)),{total:(BigInt(Number.MAX_SAFE_INTEGER)*12n).toString(),practicedKeys:12});
});
for(const failure of ['access','read','write'])test('保存'+failure+'失敗でもキー別記録と表示をページ内で維持',async()=>{
 const s=await store(new Map(),failure);complete(s.progress,s.stage(0,'db'));assert.equal(s.progress.getCount(s.stage(0,'db')),1);assert.deepEqual(summary(s.progress,s.stage(0)),{total:'1',practicedKeys:1});
});

test('同じDOMのキー回数・合計・キー数だけを更新し、選択と開始処理を変更しない',async()=>{
 const s=await store(),h=scaleFixture(s.s,'#scales-1',s.progress),button=h.keys[0],form=h.forms[0],historyLength=h.history.length;
 assert.equal(button.countBadge.textContent,'未練習');complete(s.progress,s.stage(0),3);
 assert.equal(h.keys[0],button);assert.equal(h.forms[0],form);assert.equal(button.countBadge.textContent,'✓ 練習3回');assert.equal(form.total.textContent,'合計3回');assert.equal(form.practiced.textContent,'1/12');assert.equal(button.getAttribute('aria-pressed'),'true');assert.match(button.getAttribute('aria-label'),/練習3回/);assert.equal(h.opened.length,0);assert.equal(h.history.length,historyLength);
 h.forms[1].dispatch('click');complete(s.progress,s.stage(0,'db'));assert.equal(form.total.textContent,'合計4回');assert.equal(form.practiced.textContent,'2/12');assert.equal(h.keys[1].countBadge.textContent,'未練習');h.forms[0].dispatch('click');assert.equal(h.keys[1].countBadge.textContent,'✓ 練習1回');
 h.controller.destroy();complete(s.progress,s.stage(0));assert.equal(form.total.textContent,'合計4回');
});

for(const [form,key,repeats]of [[0,'c','1'],[0,'db','3'],[1,'c','unlimited']])test(form+'/'+key+'：実際の完走・繰り返しだけを加算',async()=>{
 const s=await running(form,key);s.c.practiceRepeatSelect.value=repeats;await s.c.startPractice();const active=s.c.practiceSession;
 s.h.advance(lapEnd(active)-.1);assert.equal(s.progress.getCount(active.stage),0);
 if(repeats==='1'){s.h.advance(active.finishTime+.03);assert.equal(s.progress.getCount(active.stage),1);}else{s.h.advance(lapEnd(active,2)+.4);assert.equal(s.progress.getCount(active.stage),2);s.c.stopPractice();assert.equal(s.progress.getCount(active.stage),2);}
 assert.equal(s.progress.getCount(s.stage(form,key==='c'?'db':'c')),0);
});

test('途中停止・開始直後の終了は0、再開始後の完走を新しい1回として記録',async()=>{
 const s=await running(0,'db');await s.c.startPractice();s.c.stopPractice();assert.equal(s.progress.getCount(s.stage(0,'db')),0);
 await s.c.startPractice();s.h.advance(lapEnd(s.c.practiceSession)-.1);s.c.stopPractice();assert.equal(s.progress.getCount(s.stage(0,'db')),0);
 await s.c.startPractice();s.h.advance(s.c.practiceSession.finishTime+.03);assert.equal(s.progress.getCount(s.stage(0,'db')),1);
});

test('録音は本体完走で加算し、余韻・遅いBlob確定・終了で二重加算しない',async()=>{
 const s=await running(4,'e',{delayedStop:true});await s.c.startPractice('record');const active=s.c.practiceSession;
 s.h.advance(lapEnd(active)+.03);assert.equal(s.progress.getCount(active.stage),1);assert.equal(s.h.urls.length,0);
 s.h.advance(active.finishTime+.03);assert.equal(s.progress.getCount(active.stage),1);s.h.recorders[0].deliver();assert.equal(s.h.urls.length,1);s.c.finishPractice();s.c.stopPractice();assert.equal(s.progress.getCount(active.stage),1);
});

test('録音の開始失敗やマイク拒否では加算しない',async()=>{
 for(const options of [{micFail:true},{startFail:true}]){const s=await running(0,'c',options);await s.c.startPractice('record');if(s.c.practiceSession)s.h.advance(s.c.practiceSession.finishTime+.1);assert.equal(s.progress.getCount(s.stage(0)),0);}
});

test('練習中に別フォームを選択しても、開始時のフォーム・キーへ加算される',async()=>{
 const s=await running(0,'db'),h=scaleFixture(s.s,'#scales-1',s.progress);h.keys[1].dispatch('click');await s.c.startPractice();h.forms[1].dispatch('click');h.keys[4].dispatch('click');s.h.advance(s.c.practiceSession.finishTime+.03);
 assert.equal(h.controller.selected.formId,'A');assert.equal(s.progress.getCount(s.stage(0,'db')),1);assert.equal(s.progress.getCount(s.stage(1,'e')),0);assert.equal(h.forms[0].total.textContent,'合計1回');assert.equal(h.keys[4].countBadge.textContent,'未練習');
});
