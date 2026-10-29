const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),{inflateRawSync}=require('node:zlib'),{pathToFileURL}=require('node:url');
const {chordFixture,chordCategoryFixture}=require('./helpers/chord-ui.cjs');
const root=path.join(__dirname,'..'),config=import(pathToFileURL(path.join(root,'js/config.js')).href),diagram=import(pathToFileURL(path.join(root,'js/chordDiagram.js')).href);
const names=['C','D','E','G','A','Am','Dm','Em'],forms=['x32010','xx0232','022100','320003','x02220','x02210','xx0231','022000'];
const source=fs.readFileSync(path.join(__dirname,'solo-genres.test.cjs'),'utf8'),readMxl=vm.runInNewContext(source.slice(source.indexOf('function readMxl('),source.indexOf('const genres='))+'\nreadMxl;',{assert,Buffer,inflateRawSync});
const alphaFile=require('./helpers/alpha-tab.cjs').alphaFile,alpha=require('./helpers/alpha-tab.cjs').alpha,openMidi={6:40,5:45,4:50,3:55,2:59,1:64},stepValue={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
const tag=(xml,name)=>xml.match(new RegExp('<'+name+'>([^<]+)</'+name+'>'))?.[1];
const firstBytes=fs.readFileSync(path.join(root,'scores/chords/ex01.mxl')),original=readMxl(firstBytes).xml;
function fixture(file,marker,fn){const s=fs.readFileSync(path.join(__dirname,file),'utf8');return vm.runInNewContext(s.slice(0,s.indexOf(marker))+'\n'+fn,{require,__dirname,Blob,TextEncoder,AbortController,setImmediate});}
const boot=fixture('storage.test.cjs',"for (const failure of ['getItem",'boot;'),practice=fixture('practice.test.cjs','for (const repeats of','harness;');
test('基本8コードと教材を独立管理し、既存40件＋8件の48教材でIDが重複しない',async()=>{
 const c=await config,d=await diagram;assert.deepEqual(c.CHORD_FORMS.map(f=>f.name),names);assert.deepEqual(c.CHORD_FORMS.map(d.chordFormText),forms);
 assert.equal(new Set(c.CHORD_FORMS.map(f=>f.id)).size,8);assert.equal(c.CHORD_STAGES.length,8);assert.deepEqual(c.CHORD_STAGES.map(s=>s.id),[1,2,3,4,5,6,7,8]);
 c.CHORD_STAGES.forEach((s,i)=>{assert.equal(s.formId,c.CHORD_FORMS[i].id);assert.equal(s.practiceType,'single-chord');assert.equal(s.code,'EX0'+(i+1));assert.equal(s.bpm,70);assert.deepEqual(s.timeSignature,[4,4]);assert.equal(s.practiceBars,2);assert.equal(s.countInBars,1);assert.equal(s.available,true);assert.equal(s.isPreview,false);});
 assert.ok(c.CHORD_FORMS.every((f,i)=>f.quality===(i<5?'major':'minor')&&f.positionType==='open'));
 assert.equal(c.TUTORIAL_STAGES.length,3);assert.equal(c.BASIC_STAGES.length,10);assert.equal(c.SOLO_STAGES.length,3);assert.equal(c.CHROMATIC_STAGES.length,24);
 const keys=[['tutorial',c.TUTORIAL_STAGES],['basic',c.BASIC_STAGES],['solo',c.SOLO_STAGES],['chromatic',c.CHROMATIC_STAGES],['chords',c.CHORD_STAGES]].flatMap(([k,a])=>a.map(s=>k+'-'+s.id));
 assert.equal(keys.length,48);assert.equal(new Set(keys).size,48);assert.equal(alpha.meta.version,'1.8.4');assert.match(fs.readFileSync(alphaFile,'utf8').slice(0,200),/build 34/);
});
test('ユーザー確認済みC見本をバイト単位で維持し、BPMやframeを原本へ追加しない',()=>{
 assert.equal(crypto.createHash('sha256').update(firstBytes).digest('hex'),'42241081f2bc9d2167d4ab6781b3ad2aaa55d8f939339bff0891a472934f07e3');
 assert.doesNotMatch(original,/<frame\b|<sound\b[^>]*tempo=|<per-minute>/);
});
for(let i=0;i<8;i++)test(names[i]+'：MXL・図・フォーム・全音高が一致し、2小節とも全音符和音1つで8拍',async()=>{
 const c=await config,d=await diagram,form=c.CHORD_FORMS[i],stage=c.CHORD_STAGES[i],bytes=fs.readFileSync(path.join(root,stage.file)),mxl=readMxl(bytes),xml=mxl.xml,score=alpha.importer.ScoreLoader.loadScoreFromBytes(bytes,new alpha.Settings()),marks=d.chordFormMarks(form);
 assert.equal(mxl.bars,2);assert.equal(score.masterBars.length,2);assert.match(xml,/<score-partwise version="4.0">/);
 assert.equal(xml.match(/<staff-details>[\s\S]*?<\/staff-details>/)[0],original.match(/<staff-details>[\s\S]*?<\/staff-details>/)[0]);
 assert.equal(tag(xml,'root-step'),form.root);assert.equal(tag(xml,'kind'),i<5?'major':'minor');assert.doesNotMatch(xml,/<(?:rest|grace|time-modification|tuplet|tie|frame)\b/);
 const playable=[...forms[i]].flatMap((char,index)=>char==='x'?[]:[{string:6-index,fret:Number(char)}]),svg=d.createChordDiagram(form);
 assert.deepEqual(marks.map(m=>m.string),[6,5,4,3,2,1]);assert.deepEqual(marks.map(m=>m.fret),[...forms[i]].map(ch=>ch==='x'?null:Number(ch)));
 assert.match(svg,/role="img"/);assert.ok(svg.includes(forms[i]));assert.ok(svg.includes('6弦から1弦'));assert.doesNotMatch(svg,/<image\b|https?:\/\/(?!www\.w3\.org)|指番号/);
 for(const mark of marks){assert.ok(svg.includes('data-string="'+mark.string+'"'));if(mark.fret>0){assert.ok(svg.includes('data-string="'+mark.string+'" data-fret="'+mark.fret+'"'));assert.ok(mark.y>56+(mark.fret-1)*44&&mark.y<56+mark.fret*44);}else assert.ok(svg.includes('data-string="'+mark.string+'" data-kind="'+(mark.fret===null?'muted':'open')+'"'));}
 const measures=[...xml.matchAll(/<measure\b[^>]*>([\s\S]*?)<\/measure>/g)].map(m=>m[1]);
 let totalTicks=0;
 for(const[barIndex,measure]of measures.entries()){
  const notes=[...measure.matchAll(/<note\b[^>]*>([\s\S]*?)<\/note>/g)].map(n=>n[1]),bar=score.tracks[0].staves[0].bars[barIndex],beats=bar.voices[0].beats;
  assert.equal(notes.length,playable.length);assert.equal(notes.filter(n=>!/<chord\s*\/>/.test(n)).length,1);assert.equal(beats.length,1);
  const beat=beats[0];assert.equal(beat.duration,1);assert.equal(beat.playbackDuration,3840);assert.equal(beat.notes.length,playable.length);totalTicks+=beat.playbackDuration;
  assert.equal(score.masterBars[barIndex].timeSignatureNumerator,4);assert.equal(score.masterBars[barIndex].timeSignatureDenominator,4);
  notes.forEach((n,index)=>{const expected=playable[index],string=Number(tag(n,'string')),fret=Number(tag(n,'fret')),midi=(Number(tag(n,'octave'))+1)*12+stepValue[tag(n,'step')]+Number(tag(n,'alter')||0),model=beat.notes[index];
   assert.equal(/<chord\s*\/>/.test(n),index>0);assert.equal(tag(n,'type'),'whole');assert.equal(Number(tag(n,'duration')),4);assert.equal(tag(n,'voice'),'1');
   assert.equal(string,expected.string);assert.equal(fret,expected.fret);assert.equal(midi,openMidi[string]+fret);assert.equal(7-model.string,string);assert.equal(model.fret,fret);assert.equal(model.realValue,midi);
  });
 }assert.equal(totalTicks,8*960);assert.equal(score.tracks[0].staves[0].bars[0].voices[0].beats[0].chord.name,names[i]);
});
test('コード名検索は大文字小文字・空白を吸収し、E/Emやマイナーを区別',async()=>{
 const c=await config,h=chordFixture(c.CHORD_STAGES,c.CHORD_FORMS),visible=()=>h.buttons.filter(b=>!b.hidden).map(b=>Number(b.dataset.chordStageId));
 h.search(' e ');assert.deepEqual(visible(),[3,8]);assert.equal(h.controller.selected,c.CHORD_STAGES[2]);
 h.search('AM');assert.deepEqual(visible(),[6]);assert.equal(h.controller.selected,c.CHORD_STAGES[5]);
 h.search('');assert.equal(visible().length,8);assert.equal(h.fields.get('[data-chord-empty]').hidden,true);assert.equal(h.opened.length,0);
});
test('メジャー5件・マイナー3件で絞り込み、0件時は詳細と開始を無効化',async()=>{
 const c=await config,h=chordFixture(c.CHORD_STAGES,c.CHORD_FORMS),visible=()=>h.buttons.filter(b=>!b.hidden).map(b=>Number(b.dataset.chordStageId));
 h.quality('major');assert.deepEqual(visible(),[1,2,3,4,5]);h.quality('minor');assert.deepEqual(visible(),[6,7,8]);
 h.search('C');assert.equal(visible().length,0);assert.equal(h.fields.get('[data-chord-empty]').hidden,false);assert.equal(h.fields.get('#chordDetails').hidden,true);assert.equal(h.fields.get('#chordStartBtn').disabled,true);assert.equal(h.controller.selected,null);
 h.fields.get('#chordStartBtn').dispatch('click');assert.equal(h.opened.length,0);h.quality('all');assert.deepEqual(visible(),[1]);assert.equal(h.controller.selected,c.CHORD_STAGES[0]);
});
test('全8ボタンは選択だけでは起動せず、正しい図・詳細と共有の開始ボタンに接続',async()=>{
 const c=await config,h=chordFixture(c.CHORD_STAGES,c.CHORD_FORMS);
 for(const[i,b]of h.buttons.entries()){b.dispatch('click');assert.equal(h.opened.length,i);assert.equal(h.controller.selected,c.CHORD_STAGES[i]);assert.equal(h.fields.get('[data-chord-title]').innerText,names[i]);assert.ok(h.fields.get('[data-chord-form]').innerText.includes(forms[i]));assert.ok(h.fields.get('[data-chord-diagram]').innerHTML.includes(forms[i]));assert.equal(h.buttons.filter(b=>b.getAttribute('aria-pressed')==='true').length,1);assert.equal(h.win.location.hash,'#chords-'+(i+1));h.fields.get('#chordStartBtn').dispatch('click');assert.equal(h.opened[i],c.CHORD_STAGES[i]);}
});
test('コードURLの直接表示・戻る・進むで選択を復元し、隠れた検索条件を解除',async()=>{
 const c=await config,h=chordFixture(c.CHORD_STAGES,c.CHORD_FORMS,'#chords-6');assert.equal(h.controller.selected,c.CHORD_STAGES[5]);
 h.buttons[7].dispatch('click');h.go(-1);assert.equal(h.controller.selected,c.CHORD_STAGES[5]);h.go(1);assert.equal(h.controller.selected,c.CHORD_STAGES[7]);
 h.quality('minor');h.navigate('#chords-2');assert.equal(h.controller.selected,c.CHORD_STAGES[1]);assert.equal(h.fields.get('#chordSearch').value,'');assert.equal(h.fields.get('#chordQuality').value,'all');assert.ok(h.buttons.every(b=>!b.hidden));
 h.navigate('#chords-999');assert.equal(h.controller.selected,c.CHORD_STAGES[1]);
});
test('再描画で古い選択イベントを破棄し、コードチェンジ用データは単独UIに混入しない',async()=>{
 const c=await config,h=chordFixture([...c.CHORD_STAGES,{...c.CHORD_STAGES[0],id:9,practiceType:'chord-change'}],c.CHORD_FORMS);
 assert.equal(h.buttons.length,8);h.buttons[6].dispatch('click');h.controller.destroy();assert.equal(h.events.hashchange.size,0);assert.equal(h.events.popstate.size,0);
 const next=h.init(h.root,c.CHORD_STAGES,c.CHORD_FORMS,()=>{});assert.equal(next.selected,c.CHORD_STAGES[6]);assert.equal(h.events.hashchange.size,1);assert.equal(h.events.popstate.size,1);
});
test('コードカテゴリをhashと履歴から表示し、他の長い教材一覧を同時に表示しない',()=>{
 const h=chordCategoryFixture('#chords-6');assert.equal(h.controller.category,'chords');assert.equal(h.controller.selected,'basic');assert.equal(h.sections.filter(s=>!s.hidden).length,1);
 h.navigate('#chromaticExercises');assert.equal(h.controller.category,'chromatic');h.go(-1);assert.equal(h.controller.category,'chords');h.go(1);assert.equal(h.controller.category,'chromatic');
 h.navigate('#chordExercises');h.entries[1].tab.dispatch('click');assert.equal(h.controller.category,'solo');h.entries[0].tab.dispatch('click');assert.equal(h.controller.category,'chords');
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.match(html,/href="#chordExercises" data-category-link/);assert.match(html,/data-exercise-category="chords" hidden/);assert.match(html,/id="chordExerciseGrid"/);
});
test('アプリ全体のカード・コード選択は同じid1を取り違えず、完了状態を保持',()=>{
 const saved=new Map([['chogita_tutorial_completed','["tutorial-1"]']]),h=boot({saved}),opened=[];h.assertReady();h.context.openPracticeModal=s=>opened.push(s);
 for(const card of[h.tutorialCards[0],h.cards[0],h.soloCards[0]])card.dispatch('click');
 h.chromaticCards[0].dispatch('click');h.nodes.get('chromaticStartBtn').dispatch('click');h.chordButtons[0].dispatch('click');assert.equal(opened.length,4);h.nodes.get('chordStartBtn').dispatch('click');
 ['TUTORIAL_STAGES','BASIC_STAGES','SOLO_STAGES','CHROMATIC_STAGES','CHORD_STAGES'].forEach((name,i)=>assert.equal(opened[i],h.evaluate(name+'[0]')));
 h.context.testStage=h.evaluate('CHORD_STAGES[0]');h.evaluate('markTutorialCompleted(testStage,"practice");markTutorialCompleted(testStage,"record");');assert.equal(saved.get('chogita_tutorial_completed'),'["tutorial-1"]');assert.equal(h.writes.length,0);
});
for(let i=0;i<8;i++)for(const mode of['practice','record'])test(names[i]+' '+mode+'：和音の音数に依存せず、70 BPMで4＋8拍・12クリック・正しい終了と解放',async()=>{
 const c=await config,h=practice({bpm:70,bars:2});h.context.currentStage=c.CHORD_STAGES[i];h.prepareScore();await h.context.startPractice(mode);const s=h.context.practiceSession;
 assert.equal(s.bpm,70);assert.equal(s.beatsPerBar,4);assert.equal(s.countInBeats,4);assert.equal(s.practiceBeats,8);assert.equal(s.totalBeats,12);
 assert.ok(Math.abs(s.finishTime-s.startTime-(12*60/70+(mode==='record'?4*60/70+.1:0)))<1e-8);
 h.advance(s.finishTime+.03);assert.equal(h.ticks.length,12);assert.ok(h.ticks.every((t,n)=>t.accent===(n%4===0)));assert.equal(h.context.isPracticing,false);assert.equal(h.timers.size,0);
 if(mode==='record'){assert.ok(h.urls.length>0);assert.ok(h.streams.every(s=>s.getTracks().every(t=>t.readyState==='ended')));}
});
test('コード練習の3回リピートと停止・再開始は既存の拍基準を維持',async()=>{
 const c=await config,h=practice({bpm:70,bars:2});h.context.currentStage=c.CHORD_STAGES[0];h.prepareScore();h.context.practiceRepeatSelect.value='3';await h.context.startPractice();assert.equal(h.context.practiceSession.totalBeats,28);h.advance(4);h.context.stopPractice();assert.equal(h.timers.size,0);await h.context.startPractice();assert.equal(h.context.practiceSession.lastStep,-1);h.context.stopPractice();
});
