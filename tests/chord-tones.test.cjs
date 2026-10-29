const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {chordToneFixture}=require('./helpers/chord-tone-ui.cjs');
const {createPracticeProgress,PRACTICE_COUNT_STORAGE_KEY:KEY}=require('./helpers/practice-progress.cjs');
const root=path.join(__dirname,'..'),config=import(pathToFileURL(path.join(root,'js/config.js')).href),tones=import(pathToFileURL(path.join(root,'js/config/chordTones.js')).href),scales=import(pathToFileURL(path.join(root,'js/config/scales.js')).href);
const manifest=JSON.parse(fs.readFileSync(path.join(root,'scores/chord_tones/manifest.json'),'utf8'));
function fixture(file,marker,name){const text=fs.readFileSync(path.join(__dirname,file),'utf8'),i=text.indexOf(marker);assert.ok(i>0);return vm.runInNewContext(text.slice(0,i)+'\n'+name,{require,__dirname,Blob,TextEncoder,AbortController,setImmediate});}
const boot=fixture('storage.test.cjs',"for (const failure of ['getItem",'boot;'),practice=fixture('practice.test.cjs','for (const repeats of','harness;'),scoreFixture=fixture('score-loading.test.cjs',"for (const state of ['idle'",'harness;');
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
async function store(saved=new Map(),failure=null){
 const c=await config,t=await tones,s=await scales,variants=t.CHORD_TONE_STAGES.flatMap(stage=>stage.variants.map(v=>t.getChordToneVariant(stage,v.rootId,v.positionId))),writes=[];
 const progress=createPracticeProgress({chromatic:c.CHROMATIC_STAGES,chords:c.CHORD_STAGES,scales:s.SCALE_STAGES.flatMap(stage=>stage.variants.map(v=>s.getScaleVariant(stage,v.keyId,v.positionId))),chordTones:variants},()=>{
  if(failure==='access')throw Error('denied');
  return{getItem(k){if(failure==='read')throw Error('denied');return saved.get(k)||null;},setItem(k,v){if(failure==='write')throw Error('quota');saved.set(k,v);writes.push([k,v]);}};
 });
 return{c,t,s,variants,progress,saved,writes,stage:(i,code='c')=>t.getChordToneVariant(t.CHORD_TONE_STAGES[i],code)};
}
function complete(p,stage,laps=1,mode='practice'){
 const session={stage,mode,startTime:1,countInBeats:4,practiceBeats:20,beatSec:1,repeatCount:laps};p.beginSession(session);p.recordCompletedLaps(session,5+20*laps);return session;
}
const summary=(p,s)=>({...p.getChordToneSummary(s)}),lapEnd=(s,n=1)=>s.startTime+(s.countInBeats+s.practiceBeats*n)*s.beatSec;
async function running(i=0,code='c',options={}){const state=await store(),h=practice({bpm:60,bars:5,...options}),c=h.context;c.currentStage=state.stage(i,code);c.practiceProgress=state.progress;h.prepareScore();return{...state,h,c};}

test('M7の5教材とスケール10教材を含む78件、一意のID、基礎EX09とタイプ別教材を混同しない',async()=>{
 const c=await config,t=await tones;
 assert.equal(c.CHORD_TONE_STAGES,t.CHORD_TONE_STAGES);assert.equal(c.CHORD_TONE_ROOTS,t.CHORD_TONE_ROOTS);assert.equal(c.CHORD_TONE_TYPES,t.CHORD_TONE_TYPES);
 const groups={tutorial:c.TUTORIAL_STAGES,basic:c.BASIC_STAGES,solo:c.SOLO_STAGES,chromatic:c.CHROMATIC_STAGES,chords:c.CHORD_STAGES,scales:c.SCALE_STAGES,'chord-tones':c.CHORD_TONE_STAGES};
 assert.deepEqual(Object.values(groups).map(a=>a.length),[3,10,3,24,8,10,20]);
 const ids=Object.entries(groups).flatMap(([cat,a])=>a.map(s=>cat+'-'+s.id));assert.equal(ids.length,78);assert.equal(new Set(ids).size,78);
 assert.deepEqual(t.CHORD_TONE_STAGES.slice(0,5).map(s=>s.formId),['C','A','G','E','D']);
 assert.deepEqual(t.CHORD_TONE_STAGES.slice(0,5).map(s=>s.code),['EX01','EX02','EX03','EX04','EX05']);
 for(const stage of t.CHORD_TONE_STAGES.slice(0,5)){assert.equal(stage.lessonId,'chord-tones-'+stage.id);assert.equal(stage.chordTypeId,'maj7');assert.equal(stage.rootId,'c');assert.equal(stage.chordLabel,'CM7');assert.equal(stage.bpm,60);assert.equal(stage.practiceBars,5);assert.equal(stage.countInBars,1);assert.deepEqual(stage.timeSignature,[4,4]);assert.equal(stage.variants.length,12);assert.equal(stage.isPreview,false);}
 assert.equal(c.BASIC_STAGES[8].file,'scores/basic/ex09.mxl');assert.notEqual(c.BASIC_STAGES[8],t.CHORD_TONE_STAGES[0]);
});
test('12ルートの安定IDから空白なしの12コード名を生成し、未作成タイプの教材は作らない',async()=>{
 const t=await tones;assert.deepEqual(t.CHORD_TONE_ROOTS.map(r=>r.id),['c','db','d','eb','e','f','fs','g','ab','a','bb','b']);
 assert.deepEqual(t.CHORD_TONE_ROOTS.map(r=>t.getChordToneLabel('maj7',r.id)),['CM7','D♭M7','DM7','E♭M7','EM7','FM7','F♯M7','GM7','A♭M7','AM7','B♭M7','BM7']);
 assert.deepEqual(Object.keys(t.CHORD_TONE_TYPES),['maj7','min7','dom7','m7b5']);assert.equal(t.getChordToneLabel('unknown','c'),null);assert.equal(t.getChordToneLabel('__proto__','c'),null);assert.equal(t.getChordToneLabel('maj7','Db'),null);
});
test('コピーした60MXLはmanifestのSHA-256に一致し、5参考配置・フォーム別のファイルへ接続',async()=>{
 const t=await tones;assert.equal(manifest.variants.length,60);
 for(const v of manifest.variants){const stage=t.getChordToneVariant(t.CHORD_TONE_STAGES.find(s=>s.lessonId===v.lessonId),v.keyId);assert.equal(stage.file,'scores/chord_tones/'+v.file);assert.equal(sha(fs.readFileSync(path.join(root,stage.file))),v.sha256);assert.equal(stage.semitones,v.semitones);assert.equal(stage.minFret,v.range.minFret);assert.equal(stage.maxFret,v.range.maxFret);assert.equal(stage.notes,37);}
 for(const [i,key,shift]of [[0,'db',1],[1,'bb',-2],[2,'g',-5],[3,'f',-7],[4,'e',-8]])assert.equal(t.getChordToneVariant(t.CHORD_TONE_STAGES[i],key).semitones,shift);
 for(const source of Object.values(manifest.sources))assert.equal(sha(fs.readFileSync(path.join(root,source.path))),source.sha256);
});
test('同じフォーム・ルートには安定した別オブジェクトを返し、基準CM7を変更しない',async()=>{
 const t=await tones,a=t.CHORD_TONE_STAGES[0],db=t.getChordToneVariant(a,'db');assert.equal(t.getChordToneVariant(a,'c'),a);assert.equal(t.getChordToneVariant(a,'db'),db);assert.notEqual(db,a);assert.equal(a.chordLabel,'CM7');assert.equal(db.chordLabel,'D♭M7');assert.equal(db.formId,'C');assert.equal(t.getChordToneVariant({...a},'db'),null);assert.equal(t.getChordToneVariant(a,'F#'),null);
});
test('実UIの5フォーム×12コードは選択だけで起動せず、練習するから対応設定を渡す',async()=>{
 const t=await tones,h=chordToneFixture(t);assert.equal(h.forms.length,20);assert.equal(h.keys.length,12);assert.equal(h.controller.selected.chordLabel,'CM7');
 for(let i=0;i<5;i++)for(let k=0;k<12;k++){h.forms[i].dispatch('click');h.keys[k].dispatch('click');const expected=t.getChordToneVariant(t.CHORD_TONE_STAGES[i],t.CHORD_TONE_ROOTS[k].id);assert.equal(h.controller.selected,expected);assert.equal(h.fields.get('[data-chord-tone-root-label]').innerText,expected.chordLabel);assert.equal(h.opened.length,i*12+k);h.fields.get('#chordToneStartBtn').dispatch('click');assert.equal(h.opened.at(-1),expected);}
 assert.match(h.root.innerHTML,/aria-label="コード選択"/);assert.doesNotMatch(h.root.innerHTML,/キー選択/);
});
test('フォーム別のコード選択保持・キーボード選択・再読込時CM7・戻る進むを維持',async()=>{
 const t=await tones,h=chordToneFixture(t,'#chord-tones-5');assert.equal(h.controller.selected.formId,'D');h.keys[4].dispatch('click');h.forms[1].dispatch('click');h.keys[10].dispatch('click');h.go(-1);assert.equal(h.controller.selected.formId,'D');assert.equal(h.controller.selected.rootId,'e');h.go(1);assert.equal(h.controller.selected.formId,'A');assert.equal(h.controller.selected.rootId,'bb');
 h.fields.get('#chordToneKeyToggle').dispatch('click');
 const length=h.history.length;h.keys[10].dispatch('keydown',{key:'End'});assert.equal(h.controller.selected.chordLabel,'BM7');assert.equal(h.keys[11].focused,true);assert.equal(h.history.length,length);assert.equal(h.opened.length,0);
 const reload=chordToneFixture(t,h.win.location.hash);assert.equal(reload.controller.selected.formId,'A');assert.equal(reload.controller.selected.rootId,'c');h.navigate('#chord-tones-999');assert.equal(h.controller.selected.formId,'A');
});
test('破棄・再生成で履歴イベントと完走購読が重複せず、古い開始操作を無視',async()=>{
 const t=await tones,s=await store(),h=chordToneFixture(t,'',s.progress),old=h.fields.get('#chordToneStartBtn');h.controller.destroy();old.dispatch('click');assert.equal(h.opened.length,0);assert.equal(h.events.hashchange.size,0);assert.equal(h.events.popstate.size,0);const next=h.init(h.root,t.CHORD_TONE_STAGES,()=>{},s.progress);assert.equal(h.events.hashchange.size,1);next.destroy();
});
test('実アプリ起動で独立カテゴリと5教材を初期化し、正しいコードを既存モーダルへ渡す',()=>{
 const h=boot(),opened=[];h.assertReady();h.context.openPracticeModal=s=>opened.push(s);h.chordToneDom.forms[1].dispatch('click');h.chordToneDom.keys[10].dispatch('click');assert.equal(opened.length,0);h.nodes.get('chordToneStartBtn').dispatch('click');assert.equal(opened[0],h.evaluate('getChordToneVariant(CHORD_TONE_STAGES[1],"bb")'));assert.equal(opened[0].semitones,-2);assert.equal(h.writes.length,0);
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.match(html,/href="#chordToneExercises" data-category-link/);assert.match(html,/data-exercise-category="chord-tones" hidden/);assert.match(html,/id="chordToneExerciseGrid" class="scale-browser"/);assert.doesNotMatch(html,/<strong>コードトーン<\/strong>/);
});
test('コードのMXL読込・ready・練習ボタン・5小節の縦型カードとガイドへ接続',async()=>{
 const t=await tones,requested=[],h=scoreFixture({fetch:async file=>{requested.push(file);return{ok:true,text:async()=>'<score-partwise />'};}}),stage=t.getChordToneVariant(t.CHORD_TONE_STAGES[4],'e');await h.open(stage);h.complete(h.c.api,5);assert.equal(requested.at(-1),stage.file);assert.equal(h.c.scoreLoadState,'ready');assert.equal(h.c.preparedScore.stage,stage);assert.equal(h.c.mainActionBtn.disabled,false);assert.equal(h.c.recordPracticeBtn.disabled,false);assert.equal(h.c.verticalTabController.barCount,5);assert.match(h.c.modalStageTitle.innerText,/EM7/);h.c.closePracticeModal();await h.open(stage);h.complete(h.c.api,5);assert.equal(h.c.preparedScore.stage,stage);
});
test('遅れたCM7の取得・描画は新しいDbM7へ適用されず、閉じた後にも残らない',async()=>{
 const t=await tones;let resolve;const pending=new Promise(r=>{resolve=r;}),a=t.CHORD_TONE_STAGES[0],b=t.getChordToneVariant(a,'db'),response={ok:true,text:async()=>'<score-partwise />'},h=scoreFixture({fetch:file=>file===a.file?pending:Promise.resolve(response)});await h.open(a);const old=h.c.api,observer=h.observers.at(-1);await h.open(b);const latest=h.c.api;observer.fn([{contentRect:{width:400}}]);resolve(response);await new Promise(r=>setImmediate(r));assert.equal(old.loadCalls.length,0);h.complete(latest,5);h.complete(old,99);old.error.emit(Error('late'));assert.equal(h.c.preparedScore.stage,b);assert.equal(h.c.api,latest);h.c.closePracticeModal();h.complete(old,99);assert.equal(h.c.preparedScore,null);
});
test('MXL取得失敗でも既存エラーと再試行を維持する',async()=>{
 const t=await tones;let fail=true;const h=scoreFixture({fetch:async()=>fail?{ok:false,status:404}:{ok:true,text:async()=>'<score-partwise />'}}),stage=t.getChordToneVariant(t.CHORD_TONE_STAGES[2],'g');await h.open(stage);assert.equal(h.c.scoreLoadState,'error');assert.equal(h.c.mainActionBtn.disabled,true);fail=false;await h.c.retryScoreBtn.activate();h.complete(h.c.api,5);assert.equal(h.c.scoreLoadState,'ready');assert.equal(h.c.preparedScore.stage,stage);
});
test('60組の初期回数は0で、同じIDを偽装した未登録オブジェクトには加算しない',async()=>{
 const s=await store();for(const stage of s.variants)assert.equal(s.progress.getCount(stage),0);complete(s.progress,{...s.stage(0)});assert.equal(s.writes.length,0);for(const stage of s.t.CHORD_TONE_STAGES)assert.deepEqual(summary(s.progress,stage),{total:'0',practicedCodes:0});
});
test('同フォームのCM7/DbM7と異なるフォームのCM7は独立し、通常・録音を合算',async()=>{
 const s=await store();complete(s.progress,s.stage(0),2);complete(s.progress,s.stage(0),1,'record');complete(s.progress,s.stage(0,'db'));complete(s.progress,s.stage(1),2);assert.equal(s.progress.getCount(s.stage(0)),3);assert.equal(s.progress.getCount(s.stage(0,'db')),1);assert.equal(s.progress.getCount(s.stage(1)),2);assert.deepEqual(summary(s.progress,s.stage(0)),{total:'4',practicedCodes:2});assert.deepEqual(Object.keys(JSON.parse(s.saved.get(KEY)).counts).sort(),['chord-tones-maj7-a-c','chord-tones-maj7-c-c','chord-tones-maj7-c-db']);
});
test('合計と練習済みコード数は個別回数から算出し、フォーム合計を二重保存しない',async()=>{
 const s=await store();for(let i=0;i<5;i++)for(let k=0;k<12;k++)if(k%3===i%3)complete(s.progress,s.stage(i,s.t.CHORD_TONE_ROOTS[k].id),k+1);for(const stage of s.t.CHORD_TONE_STAGES){const counts=stage.variants.map(v=>s.progress.getCount(s.t.getChordToneVariant(stage,v.rootId,v.positionId)));assert.deepEqual(summary(s.progress,stage),{total:String(counts.reduce((a,b)=>a+b,0)),practicedCodes:counts.filter(n=>n>0).length});}assert.deepEqual(Object.keys(JSON.parse(s.saved.get(KEY))).sort(),['counts','version']);assert.ok(Object.keys(JSON.parse(s.saved.get(KEY)).counts).every(k=>/^chord-tones-maj7-[caged]-(c|db|d|eb|e|f|fs|g|ab|a|bb|b)$/.test(k)));
});
test('開始時のフォームとコードへ固定して記録し、表示変更やsession.stage変更で付け替えない',async()=>{
 const s=await store(),a=s.stage(0,'db'),b=s.stage(1),session={stage:a,mode:'practice',startTime:1,countInBeats:4,practiceBeats:20,beatSec:1,repeatCount:1};s.progress.beginSession(session);session.stage=b;s.progress.beginSession(session);s.progress.recordCompletedLaps(session,25);assert.equal(s.progress.getCount(a),1);assert.equal(s.progress.getCount(b),0);
});
test('再読込と登録順変更でも既存32教材・スケール60・Tutorialの保存を維持',async()=>{
 const tutorial='["tutorial-1"]',saved=new Map([['chogita_tutorial_completed',tutorial],[KEY,JSON.stringify({version:1,counts:{'chromatic-1':2,'chords-1':3,'scales-1-db':4}})]]),s=await store(saved);complete(s.progress,s.stage(4,'e'),3);complete(s.progress,s.c.CHORD_STAGES[0]);const next=await store(saved);assert.equal(next.progress.getCount(next.stage(4,'e')),3);assert.equal(next.progress.getCount(next.c.CHROMATIC_STAGES[0]),2);assert.equal(next.progress.getCount(next.c.CHORD_STAGES[0]),4);assert.equal(next.progress.getCount(next.s.getScaleVariant(next.s.SCALE_STAGES[0],'db')),4);assert.equal(saved.get('chogita_tutorial_completed'),tutorial);
 const reordered=s.variants.map(v=>({...v,id:v.id+20,lessonId:'chord-tones-'+(v.id+20)})).reverse(),p=createPracticeProgress({chordTones:reordered},()=>({getItem:k=>saved.get(k)}));assert.equal(p.getCount(reordered.find(v=>v.chordTypeId==='maj7'&&v.formId==='D'&&v.rootId==='e')),3);
});
for(const failure of ['access','read','write'])test('保存'+failure+'失敗でも練習・ページ内回数更新を継続',async()=>{
 const s=await store(new Map(),failure);complete(s.progress,s.stage(0));assert.equal(s.progress.getCount(s.stage(0)),1);
});
test('不正回数を除外し、大きな合計も正確に算出する',async()=>{
 const counts=Object.fromEntries(['c','db','d','eb','e','f','fs','g','ab','a','bb','b'].map(k=>['chord-tones-maj7-c-'+k,Number.MAX_SAFE_INTEGER])),s=await store(new Map([[KEY,JSON.stringify({version:1,counts})]]));assert.deepEqual(summary(s.progress,s.stage(0)),{total:String(BigInt(Number.MAX_SAFE_INTEGER)*12n),practicedCodes:12});complete(s.progress,s.stage(0));assert.equal(s.progress.getCount(s.stage(0)),Number.MAX_SAFE_INTEGER);
 const bad=await store(new Map([[KEY,JSON.stringify({version:1,counts:{'chord-tones-maj7-c-c':-1,'chord-tones-maj7-c-db':'3','chord-tones-maj7-c-d':2.5}})]]));assert.equal(bad.progress.getCount(bad.stage(0)),0);assert.equal(bad.progress.getCount(bad.stage(0,'db')),0);assert.equal(bad.progress.getCount(bad.stage(0,'d')),0);
});
test('回数更新は既存DOMの文字だけを更新し、選択・履歴・譜面読込を変更しない',async()=>{
 const s=await store(),h=chordToneFixture(s.t,'#chord-tones-1',s.progress),button=h.keys[0],form=h.forms[0],length=h.history.length;complete(s.progress,s.stage(0),3);assert.equal(h.keys[0],button);assert.equal(h.forms[0],form);assert.equal(button.countBadge.textContent,'✓ 練習3回');assert.equal(form.total.textContent,'合計3回');assert.equal(form.practiced.textContent,'1/12');assert.equal(h.history.length,length);assert.equal(h.opened.length,0);assert.equal(button.getAttribute('aria-pressed'),'true');h.keys[1].dispatch('click');h.keys[0].dispatch('click');assert.equal(h.keys[0].countBadge.textContent,'✓ 練習3回');
 assert.doesNotMatch(fs.readFileSync(path.join(root,'js/chordTonePractice.js'),'utf8'),/fetch\(|AudioContext|requestAnimationFrame|setInterval|localStorage/);
});
for(const [repeats,mode]of [[1,'practice'],[3,'practice'],[5,'practice'],[1,'record'],[3,'record']])test(mode+' 繰り返し指定'+repeats+'：録音は既存どおり1周、通常は指定周回・20拍/周で完走',async()=>{
 const actualLaps=mode==='record'?1:repeats;
 const s=await running(1,'bb');s.c.practiceRepeatSelect.value=String(repeats);await s.c.startPractice(mode);const session=s.c.practiceSession;assert.equal(session.repeatCount,actualLaps);assert.equal(session.practiceBeats,20);assert.equal(session.countInBeats,4);assert.equal(session.totalBeats,4+20*actualLaps);s.h.advance(session.finishTime+.03);assert.equal(s.c.isPracticing,false);assert.equal(s.progress.getCount(s.stage(1,'bb')),actualLaps);assert.equal(s.h.ticks.length,4+20*actualLaps);assert.equal(s.h.timers.size,0);if(mode==='record'){assert.equal(s.h.urls.length,1);assert.ok(s.h.streams.every(x=>x.getTracks()[0].readyState==='ended'));}
});
test('開始直後・途中停止は0、停止後の再開始で完走1回、無制限は完走済み周だけ保持',async()=>{
 const s=await running();await s.c.startPractice();s.c.stopPractice();assert.equal(s.progress.getCount(s.stage(0)),0);await s.c.startPractice();s.h.advance(lapEnd(s.c.practiceSession)-1);s.c.stopPractice();assert.equal(s.progress.getCount(s.stage(0)),0);await s.c.startPractice();s.h.advance(s.c.practiceSession.finishTime+.03);assert.equal(s.progress.getCount(s.stage(0)),1);s.c.practiceRepeatSelect.value='unlimited';await s.c.startPractice();s.h.advance(lapEnd(s.c.practiceSession,2)+3);s.c.stopPractice();assert.equal(s.progress.getCount(s.stage(0)),3);assert.equal(s.h.timers.size,0);
});
test('録音本体完走で1回、余韻・遅いBlob確定・終了では二重加算しない',async()=>{
 const s=await running(0,'db',{delayedStop:true});await s.c.startPractice('record');const session=s.c.practiceSession;s.h.advance(lapEnd(session)+.03);assert.equal(s.progress.getCount(s.stage(0,'db')),1);assert.equal(s.h.urls.length,0);s.h.advance(session.finishTime+.1);assert.equal(s.progress.getCount(s.stage(0,'db')),1);s.h.recorders[0].deliver();assert.equal(s.h.urls.length,1);s.c.stopPractice();s.progress.recordCompletedLaps(session,session.finishTime+100);assert.equal(s.progress.getCount(s.stage(0,'db')),1);
});
test('録音開始失敗・マイク拒否で加算しない',async()=>{
 for(const options of [{micFail:true},{startFail:true}]){const s=await running(0,'c',options);await s.c.startPractice('record');if(s.c.practiceSession)s.h.advance(s.c.practiceSession.finishTime+.1);assert.equal(s.progress.getCount(s.stage(0)),0);}
});
