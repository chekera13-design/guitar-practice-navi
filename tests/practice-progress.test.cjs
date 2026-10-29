const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{pathToFileURL}=require('node:url');
const {createPracticeProgress,PRACTICE_COUNT_STORAGE_KEY:KEY}=require('./helpers/practice-progress.cjs');
const {pickerFixture}=require('./helpers/chromatic-ui.cjs'),{chordFixture}=require('./helpers/chord-ui.cjs');
const config=import(pathToFileURL(path.join(__dirname,'../js/config.js')).href);
function fixture(file,marker,name){const s=fs.readFileSync(path.join(__dirname,file),'utf8');return vm.runInNewContext(s.slice(0,s.indexOf(marker))+'\n'+name,{require,__dirname,Blob,TextEncoder,AbortController,setImmediate});}
const practice=fixture('practice.test.cjs','for (const repeats of','harness;'),boot=fixture('storage.test.cjs',"for (const failure of ['getItem",'boot;');
function store(c,saved=new Map(),options={}){
 const writes=[],storage={getItem(k){if(options.readFail)throw Error('denied');return saved.get(k)??null;},setItem(k,v){if(options.writeFail)throw Error('quota');saved.set(k,v);writes.push([k,v]);}};
 const progress=createPracticeProgress({chromatic:c.CHROMATIC_STAGES,chords:c.CHORD_STAGES},()=>{if(options.accessFail)throw Error('disabled');return storage;});
 return{progress,saved,writes};
}
function observation(stage,repeatCount=1,mode='practice'){return{stage,mode,startTime:1,countInBeats:4,practiceBeats:8,beatSec:1,repeatCount};}
async function session(category,index=0,options={}){
 const c=await config,stage=(category==='chords'?c.CHORD_STAGES:c.CHROMATIC_STAGES)[index],state=store(c,new Map(),options),h=practice({bpm:stage.bpm,bars:stage.practiceBars,...options});
 h.context.currentStage=stage;h.context.practiceProgress=state.progress;h.prepareScore();
 return{...state,h,c:h.context,stage};
}
const lapEnd=(s,n=1)=>s.startTime+(s.countInBeats+s.practiceBeats*n)*s.beatSec;
test('32教材は初期0回で、未対象16教材や同じidの別オブジェクトには記録しない',async()=>{
 const c=await config,s=store(c);for(const stage of[...c.CHROMATIC_STAGES,...c.CHORD_STAGES])assert.equal(s.progress.getCount(stage),0);
 for(const stage of[...c.TUTORIAL_STAGES,...c.BASIC_STAGES,...c.SOLO_STAGES,{...c.CHORD_STAGES[0]}])s.progress.recordCompletedLaps(observation(stage),100);
 assert.equal(s.writes.length,0);assert.notEqual(KEY,'chogita_tutorial_completed');assert.notEqual(KEY,'chogita_metro_vol');
});
test('カウントインと最後の拍の途中は0、完走で1回、同じ周回や余韻の観測で増えない',async()=>{
 const c=await config,s=store(c),stage=c.CHORD_STAGES[0],o=observation(stage);
 for(const t of[1,4,5,12.9999])s.progress.recordCompletedLaps(o,t);assert.equal(s.progress.getCount(stage),0);
 for(const t of[13,13,14,100])s.progress.recordCompletedLaps(o,t);assert.equal(s.progress.getCount(stage),1);assert.equal(s.writes.length,1);
});
test('再読み込みと配列順序変更でもカテゴリ付きIDに回数が残り、コードと運指を混同しない',async()=>{
 const c=await config,s=store(c);s.progress.recordCompletedLaps(observation(c.CHORD_STAGES[0],3),29);s.progress.recordCompletedLaps(observation(c.CHROMATIC_STAGES[0]),13);
 const p=createPracticeProgress({chromatic:[...c.CHROMATIC_STAGES].reverse(),chords:[...c.CHORD_STAGES].reverse()},()=>({getItem:k=>s.saved.get(k)}));
 assert.equal(p.getCount(c.CHORD_STAGES[0]),3);assert.equal(p.getCount(c.CHROMATIC_STAGES[0]),1);assert.equal(p.getCount(c.CHORD_STAGES[1]),0);
 const data=JSON.parse(s.saved.get(KEY));assert.equal(data.version,1);assert.deepEqual(Object.keys(data.counts).sort(),['chords-1','chromatic-1']);
});
test('破損JSON・不正schemaや数値を安全に扱い、有効な回数だけを復元する',async()=>{
 const c=await config;
 for(const raw of['broken','null','[]','{"version":2,"counts":{}}','{"version":1,"counts":[]}',
  '{"version":1,"counts":{"chords-1":-1}}','{"version":1,"counts":{"chords-1":1.5}}','{"version":1,"counts":{"chords-1":"2"}}',
  '{"version":1,"counts":{"chords-1":9007199254740992}}']){
  const s=store(c,new Map([[KEY,raw]]));assert.equal(s.progress.getCount(c.CHORD_STAGES[0]),0);s.progress.recordCompletedLaps(observation(c.CHORD_STAGES[0]),13);assert.equal(s.progress.getCount(c.CHORD_STAGES[0]),1);
 }
 const s=store(c,new Map([[KEY,'{"version":1,"counts":{"chords-1":4,"chromatic-2":2,"basic-1":99}}']]));
 assert.equal(s.progress.getCount(c.CHORD_STAGES[0]),4);assert.equal(s.progress.getCount(c.CHROMATIC_STAGES[1]),2);assert.equal(s.progress.getCount(c.BASIC_STAGES[0]),0);
});
for(const failure of['accessFail','readFail','writeFail'])test(failure+'でも保存失敗を練習へ伝播せず、ページ内の回数を維持',async()=>{
 const c=await config,s=store(c,new Map(),{[failure]:true}),o=observation(c.CHORD_STAGES[0],3);s.progress.recordCompletedLaps(o,29);assert.equal(s.progress.getCount(o.stage),3);
});
test('安全な整数の上限で止まり、表示コールバックの失敗で記録が失われない',async()=>{
 const c=await config,s=store(c,new Map([[KEY,JSON.stringify({version:1,counts:{'chords-1':Number.MAX_SAFE_INTEGER-1}})]]));
 s.progress.subscribe(()=>{throw Error('display unavailable');});s.progress.recordCompletedLaps(observation(c.CHORD_STAGES[0],3),29);assert.equal(s.progress.getCount(c.CHORD_STAGES[0]),Number.MAX_SAFE_INTEGER);
});
for(const category of['chromatic','chords']){
 test(category+'の実際の通常練習は1周で1回、途中停止・開始直後終了は0',async()=>{
  const s=await session(category);await s.c.startPractice();const active=s.c.practiceSession,end=lapEnd(active);s.h.advance(end-.03);assert.equal(s.progress.getCount(s.stage),0);s.h.advance(end+.03);assert.equal(s.progress.getCount(s.stage),1);s.c.finishPractice();s.c.stopPractice();assert.equal(s.progress.getCount(s.stage),1);
  const partial=await session(category);await partial.c.startPractice();partial.h.advance(lapEnd(partial.c.practiceSession)-.1);partial.c.stopPractice();assert.equal(partial.progress.getCount(partial.stage),0);
  await partial.c.startPractice();partial.c.stopPractice();assert.equal(partial.progress.getCount(partial.stage),0);
 });
 for(const repeats of['3','5','unlimited'])test(category+'の'+repeats+'回：完走した周回だけ加算し、次の周回の途中停止で保持',async()=>{
  const s=await session(category);s.c.practiceRepeatSelect.value=repeats;await s.c.startPractice();const active=s.c.practiceSession;
  s.h.advance(lapEnd(active,2)+active.beatSec/2);assert.equal(s.progress.getCount(s.stage),2);assert.equal(s.c.isPracticing,true);
  if(repeats==='5'){s.h.advance(active.finishTime+.03);assert.equal(s.progress.getCount(s.stage),5);}else s.c.stopPractice();
  assert.equal(s.progress.getCount(s.stage),repeats==='5'?5:2);assert.equal(s.h.timers.size,0);
 });
 test(category+'の録音は本体完走時に加算し、Blob・余韻・再生・終了で再加算しない',async()=>{
  const s=await session(category,0,{delayedStop:true});await s.c.startPractice('record');const active=s.c.practiceSession,end=lapEnd(active);
  s.h.advance(end-.03);assert.equal(s.progress.getCount(s.stage),0);s.h.advance(end+.03);assert.equal(s.progress.getCount(s.stage),1);assert.equal(s.h.urls.length,0);
  s.h.advance(active.finishTime+.03);assert.equal(s.c.isFinalizingRecording,true);assert.equal(s.progress.getCount(s.stage),1);
  s.h.recorders[0].deliver();assert.equal(s.h.urls.length,1);assert.equal(s.c.isFinalizingRecording,false);assert.equal(s.progress.getCount(s.stage),1);
  s.c.recordedAudioPlayer.pause();s.c.clearRecordingResult();s.c.discardRecordingSession();s.c.stopPractice();assert.equal(s.progress.getCount(s.stage),1);
 });
}
test('停止操作が25ms観測の隙間で完了時刻を越えた場合も、完了1周だけ回収',async()=>{
 const s=await session('chords');await s.c.startPractice();const old=s.c.practiceSession,end=lapEnd(old);
 s.h.advance(end-.02);assert.equal(s.progress.getCount(s.stage),0);s.c.audioContext.currentTime=end;s.c.stopPractice();assert.equal(s.progress.getCount(s.stage),1);
 s.c.runPracticeScheduler(old);s.c.stopPractice();assert.equal(s.progress.getCount(s.stage),1);
});
test('同じコードの通常2回＋録音1回が共通の合計3回となる',async()=>{
 const s=await session('chords');for(let i=0;i<2;i++){await s.c.startPractice();s.h.advance(s.c.practiceSession.finishTime+.03);}
 assert.equal(s.progress.getCount(s.stage),2);await s.c.startPractice('record');s.h.advance(lapEnd(s.c.practiceSession)+.03);assert.equal(s.progress.getCount(s.stage),3);s.h.advance(s.c.practiceSession.finishTime+.03);assert.equal(s.progress.getCount(s.stage),3);
});
test('録音が本体完走後にBlob生成・停止で失敗しても1回を保持、開始失敗は0',async()=>{
 for(const options of[{noData:true},{stopFail:true},{startFail:true},{micFail:true}]){
  const s=await session('chords',0,options);await s.c.startPractice('record');s.h.advance(30);assert.equal(s.progress.getCount(s.stage),options.startFail||options.micFail?0:1);
 }
});
test('一覧は既存のボタンを再生成せずチェック・回数・読み上げだけを更新',async()=>{
 const c=await config,s=store(c),a=pickerFixture(c.CHROMATIC_STAGES,'',s.progress),b=chordFixture(c.CHORD_STAGES,c.CHORD_FORMS,'',s.progress),first=a.buttons[0],chord=b.buttons[0];
 assert.equal(first.countBadge.hidden,true);assert.equal(chord.countBadge.hidden,true);s.progress.recordCompletedLaps(observation(c.CHROMATIC_STAGES[0]),13);
 assert.equal(a.buttons[0],first);assert.equal(first.countBadge.hidden,false);assert.equal(first.countBadge.textContent,'✓ 練習1回');assert.match(first.getAttribute('aria-label'),/練習1回/);assert.equal(chord.countBadge.hidden,true);
 b.search('Dm');assert.equal(chord.hidden,true);s.progress.recordCompletedLaps(observation(c.CHORD_STAGES[0],3),29);assert.equal(chord.countBadge.textContent,'✓ 練習3回');assert.equal(chord.hidden,true);
 b.search('');assert.equal(chord.hidden,false);assert.equal(b.buttons[0],chord);b.buttons[0].dispatch('click');b.fields.get('#chordStartBtn').dispatch('click');assert.equal(b.opened[0],c.CHORD_STAGES[0]);
 a.controller.destroy();const old=first.countBadge.textContent;s.progress.recordCompletedLaps(observation(c.CHROMATIC_STAGES[0]),13);assert.equal(first.countBadge.textContent,old);
 const next=a.init(a.root,c.CHROMATIC_STAGES,()=>{},s.progress);assert.equal(a.buttons[0].countBadge.textContent,'✓ 練習2回');next.destroy();
});
test('アプリ全体の保存・表示を再読み込み後に復元し、Tutorialの完了キーを維持',async()=>{
 const saved=new Map([['chogita_tutorial_completed','["tutorial-1"]']]),home=boot({saved}),stage=home.evaluate('CHORD_STAGES[0]'),progress=home.evaluate('practiceProgress');
 home.assertReady();const h=practice({bars:2,bpm:70});h.context.currentStage=stage;h.context.practiceProgress=progress;h.prepareScore();await h.context.startPractice();h.advance(h.context.practiceSession.finishTime+.03);
 assert.equal(home.chordButtons[0].countBadge.textContent,'✓ 練習1回');assert.equal(saved.get('chogita_tutorial_completed'),'["tutorial-1"]');
 const restored=boot({saved});restored.assertReady();assert.equal(restored.chordButtons[0].countBadge.textContent,'✓ 練習1回');assert.equal(restored.chromaticCards[0].countBadge.hidden,true);assert.equal(restored.evaluate('completedTutorialStages.has("tutorial-1")'),true);
});

for(const category of ['chords','chromatic'])test(category+'の先行録音中の停止は0回、再録音の本体完走だけ1回加算する',async()=>{
 const s=await session(category,0,{delayedStop:true});await s.c.startPractice('record');
 let active=s.c.practiceSession;
 const target=active.startTime+(active.countInBeats-1)*active.beatSec;
 s.h.advance(target+.026);assert.equal(s.h.recorders[0].startCalls,1);
 assert.equal(s.progress.getCount(s.stage),0);assert.equal(s.writes.length,0);
 s.c.stopPractice();assert.equal(s.progress.getCount(s.stage),0);assert.equal(s.h.urls.length,0);
 await s.c.startPractice('record');active=s.c.practiceSession;
 s.h.advance(lapEnd(active)-.026);assert.equal(s.progress.getCount(s.stage),0);
 s.h.advance(lapEnd(active)+.026);assert.equal(s.progress.getCount(s.stage),1);
 s.h.advance(active.finishTime+.03);s.h.recorders[1].deliver();
 assert.equal(s.progress.getCount(s.stage),1);assert.equal(s.writes.length,1);assert.equal(s.h.urls.length,1);
 s.c.clearRecordingResult();assert.equal(s.h.revoked.length,1);s.c.stopPractice();
 assert.equal(s.progress.getCount(s.stage),1);
});
