const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),os=require('node:os');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),production=root,app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
const modulePromise=import(pathToFileURL(path.join(root,'js/graceNotation.js')).href);
const markerTests=fs.readFileSync(path.join(production,'tests/technique-markers.test.cjs'),'utf8');
const {Element,parse}=vm.runInNewContext(markerTests.slice(0,markerTests.indexOf('const source ='))+'\n({Element,parse})',{require});
const lib=require('./helpers/alpha-tab.cjs').alphaFile,alpha=require('./helpers/alpha-tab.cjs').alpha;
Object.defineProperty(Element.prototype,'localName',{get(){return this.tagName;}});
Object.defineProperty(Element.prototype,'parentElement',{get(){return this.parent;}});
Object.defineProperty(Element.prototype,'isConnected',{get(){return this.connected||this.parent?.isConnected||false;}});
const identity={a:1,b:0,c:0,d:1,e:0,f:0,inverse(){return this;},multiply(){return this;}};
Element.prototype.getCTM=function(){return identity;};
Element.prototype.getBBox=function(){
 if(this.box)return this.box;
 if(this.tagName==='rect')return Object.fromEntries(['x','y','width','height'].map(k=>[k,Number(this.getAttribute(k))]));
 if(this.tagName==='path'){
  const n=this.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number),x=Math.min(n[0],n[4]),right=Math.max(n[0],n[4]);
  const y=Math.min(n[1],(n[1]+n[3])*.5,(n[1]+n[7])*.5),bottom=Math.max(n[1],(n[1]+n[3])*.5,(n[1]+n[7])*.5);
  return{x,y,width:right-x,height:bottom-y};
 }
 throw Error('unmeasured test element');
};
global.DOMParser=class{parseFromString(xml){const doc=parse(xml);doc.documentElement=doc.querySelector('score-partwise');return doc;}};
global.document={fonts:{check:()=>true},createElementNS:(_,tag)=>new Element(tag)};
global.getComputedStyle=()=>({font:'12px Arial',stroke:'none'});
const serialize=n=>n.tagName==='document'?n.children.map(serialize).join(''):`<${n.tagName}${Object.entries(n.attrs).map(([k,v])=>` ${k}="${v}"`).join('')}>${n.text}${n.children.map(serialize).join('')}</${n.tagName}>`;
const input=name=>fs.readFileSync(path.join(production,'tests/fixtures','grace-'+name+'.musicxml'),'utf8');
function fix(xml,service,token){
 const c=vm.createContext({console:{info(){},warn(){}},DOMParser:global.DOMParser,XMLSerializer:class{serializeToString(doc){return serialize(doc);}},graceNotation:service});
 vm.runInContext('let detectedSlurPairs=[],detectedSlashChords=[];\n'+app.slice(app.indexOf('function fixMuseScoreXml('),app.indexOf('function handleWatermark('))+'\nthis.pairs=()=>detectedSlurPairs;',c);
 const fixed=c.fixMuseScoreXml(xml,token);return{fixed,c};
}
async function harness(t,{xml=input('test2'),partialFirst=0,offset=0}={}){
 
 assert.equal(alpha.meta.version,'1.8.4');assert.match(fs.readFileSync(lib,'utf8').slice(0,120),/build 34/);
 const m=await modulePromise,service=m.createGraceNotation(),api={settings:{display:{staveProfile:3}}},owner={generation:1,stage:{},api};
 const token=service.begin(owner);service.capture(token,xml);const prepared=fix(xml,service,token);
 const score=alpha.importer.ScoreLoader.loadScoreFromBytes(new TextEncoder().encode(prepared.fixed),new alpha.Settings());api.score=score;
 service.bindModel(token,score);
 const svg=new Element('svg',{width:'1200px',height:'190px'});svg.connected=true;
 const bounds=new Map();
 for(const track of score.tracks)for(const staff of track.staves)for(const bar of staff.bars)for(const voice of bar.voices)for(const beat of voice.beats){
  const x=80+(bar.index-partialFirst)*200+(beat.index===0?0:8+(beat.index-1)*20);
  const entries=beat.notes.map(note=>{
   const string=staff.tuning.length-note.string+1,baseline=60+(string-1)*13;
   const head={x:x+offset,y:baseline-6.5,w:8,h:13};
   if(bar.index>=partialFirst){const text=svg.appendChild(new Element('text',{x:String(x),y:String(baseline)},String(note.fret)));
   text.box={x,y:baseline-(beat.graceType?7:9),width:beat.graceType?7:8,height:beat.graceType?14:16};}
   return{note,noteHeadBounds:head};
  });bounds.set(beat,{notes:entries});
  if(beat.text&&bar.index>=partialFirst){const text=svg.appendChild(new Element('text',{x:String(x+4),y:'35'},beat.text));text.box={x:x+3,y:33,width:beat.text==='H'?12:9,height:14};}
 }
 // NoteBoundsは全体座標、SVGはpartialローカル座標。
 api.renderer={boundsLookup:{findBeat:b=>bounds.get(b),findMasterBarByIndex:i=>({realBounds:{x:offset+(i-partialFirst)*200,w:250}})}};
 const partials=[{svg,x:offset,y:0,partialIndex:0,firstBarIndex:partialFirst,lastBarIndex:score.masterBars.length-1}];
 const original=svg.appendChild(new Element('path',{class:'alphatab-custom-slur'}));original.box={x:0,y:160,width:15,height:5};
 return{m,service,api,owner,token,prepared,score,svg,bounds,partials,original,
  draw(){service.annotate(token,api,partials);return service.snapshot().render;},
  paths(){return svg.querySelectorAll('.alphatab-grace-slur');}};
}

Element.prototype.removeAttribute=function(k){delete this.attrs[k];};
const setAttribute=Element.prototype.setAttribute;
Element.prototype.setAttribute=function(k,v){if(this.tagName==='text'&&this.box&&['x','y'].includes(k)&&this.getAttribute(k)!==null)this.box[k]+=Number(v)-Number(this.getAttribute(k));setAttribute.call(this,k,v);};
Element.prototype.cloneNode=function(deep){const n=new Element(this.tagName,{...this.attrs},this.text);if(this.box)n.box={...this.box};if(deep)for(const c of this.children)n.appendChild(c.cloneNode(true));return n;};
function cards(h){const track=new Element('div');track.connected=true;for(let i=0;i<h.score.masterBars.length;i++){
 const card=track.appendChild(new Element('article',{class:'vertical-tab-card'}));card.dataset={barIndex:String(i)};
 const svg=card.appendChild(new Element('svg',{viewBox:'0 0 1200 190'})),defs=svg.appendChild(new Element('defs')),clip=defs.appendChild(new Element('clipPath'));
 clip.appendChild(new Element('rect',{x:'0',y:'0',width:'1200',height:'190'}));const g=svg.appendChild(new Element('g',{'clip-path':'url(#test)'}));for(const child of h.svg.children)g.appendChild(child.cloneNode(true));
 }return track;}
const place=(h,track)=>{assert.equal(h.service.positionLabels(h.token,h.api,h.partials,track),true);return h.service.snapshot().labels;};
const moved=h=>h.svg.querySelectorAll('text').filter(n=>n.getAttribute('data-grace-label-id')!==null);
test('実モデルに照合済みの小音符H/Sだけを移動し、通常H/P/Sは維持',async t=>{
 const h=await harness(t);if(!h)return;h.draw();const normal=['H','P','S'].map((s,i)=>h.svg.appendChild(new Element('text',{x:String(700+i*30),y:'40'},s)));normal.forEach((n,i)=>n.box={x:700+i*30,y:25,width:10,height:14});
 const attrs=normal.map(n=>({...n.attrs}));const rows=place(h);assert.equal(rows.filter(r=>r.moved).length,2);assert.deepEqual(Array.from(moved(h),n=>n.textContent),['H','S']);assert.deepEqual(normal.map(n=>n.attrs),attrs);
});
test('曲線の実bbox中央上で、文字下端と曲線上端は2SVGpx',async t=>{const h=await harness(t);if(!h)return;h.draw();for(const r of place(h)){assert.equal(r.moved,true);assert.ok(Math.abs(r.after.x+r.after.width/2-r.curve.x-r.curve.width/2)<.001);assert.ok(Math.abs(r.gap-2)<.001);}});
test('横型初回はカードを要求しない',async t=>{const h=await harness(t);if(!h)return;h.draw();assert.ok(place(h).every(r=>r.moved&&r.copies===0));});
test('元SVGと縦カードの文字座標が一致し、cropは変更しない',async t=>{const h=await harness(t);if(!h)return;h.draw();const track=cards(h),before=track.querySelectorAll('svg').map(n=>n.getAttribute('viewBox'));const rows=place(h,track);for(const r of rows){assert.equal(r.copies,1);const copy=track.children[r.barIndex].querySelectorAll('text').find(n=>n.getAttribute('data-grace-label-id')===r.wordId),original=moved(h).find(n=>n.getAttribute('data-grace-label-id')===r.wordId);assert.equal(copy.getAttribute('x'),original.getAttribute('x'));assert.equal(copy.getAttribute('y'),original.getAttribute('y'));}assert.deepEqual(track.querySelectorAll('svg').map(n=>n.getAttribute('viewBox')),before);});
test('文字再適用と再描画で重複しない。曲線形状は同一',async t=>{const h=await harness(t);if(!h)return;h.draw();const shape=h.paths().map(n=>n.getAttribute('d'));place(h);const attrs=moved(h).map(n=>({...n.attrs}));place(h);assert.deepEqual(moved(h).map(n=>n.attrs),attrs);h.draw();assert.equal(moved(h).length,0);assert.deepEqual(h.paths().map(n=>n.getAttribute('d')),shape);place(h);assert.equal(moved(h).length,2);});
test('世代・stage・API・scoreが違う呼び出しは適用しない',async t=>{const h=await harness(t);if(!h)return;h.draw();place(h);const token=h.token;h.service.begin({...h.owner,generation:2,stage:{}});assert.equal(moved(h).length,0);assert.equal(h.service.positionLabels(token,h.api,h.partials),false);assert.equal(h.service.tokenFor({...h.owner,generation:2}),null);});
test('同一トークンでもAPI/score差替え時は適用しない',async t=>{const h=await harness(t);if(!h)return;h.draw();assert.equal(h.service.positionLabels(h.token,{...h.api},h.partials),false);h.api.score={};assert.equal(h.service.positionLabels(h.token,h.api,h.partials),false);});
test('文字の曖昧・変換付き・モデル接続破損は安全に見送る',async t=>{for(const kind of ['duplicate','transform','connection']){const h=await harness(t);if(!h)return;h.draw();const n=h.svg.querySelectorAll('text').find(n=>n.textContent==='H');if(kind==='duplicate')h.svg.appendChild(n.cloneNode(true));if(kind==='transform')n.setAttribute('transform','translate(1,0)');if(kind==='connection')h.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].slurDestination=null;const rows=place(h);assert.equal(rows[0].moved,false);assert.equal(rows[1].moved,true);}});
test('カード範囲外やclip不整合では文字を動かさず、例外を伝播しない',async t=>{for(const kind of ['crop','clip']){const h=await harness(t);if(!h)return;h.draw();const track=cards(h),svg=track.children[0].querySelector('svg'),clip=svg.querySelector('clipPath rect');if(kind==='clip')clip.setAttribute('height','180');else{svg.setAttribute('viewBox','0 48 1200 142');clip.setAttribute('y','48');clip.setAttribute('height','142');}assert.doesNotThrow(()=>place(h,track));assert.equal(h.service.snapshot().labels[0].moved,false);}});
test('restoreLabelsは数字や曲線に触らず標準位置へ戻す',async t=>{const h=await harness(t);if(!h)return;h.draw();const original=h.svg.querySelectorAll('text').map(n=>({...n.attrs})),d=h.paths().map(n=>n.getAttribute('d'));place(h);h.service.restoreLabels(h.token,h.api);assert.deepEqual(h.svg.querySelectorAll('text').map(n=>n.attrs),original);assert.deepEqual(h.paths().map(n=>n.getAttribute('d')),d);});
test('partial全体座標をローカルへ変換して文字を対応付ける',async t=>{const h=await harness(t,{offset:2000});if(!h)return;h.draw();const rows=place(h);assert.ok(rows.every(r=>r.moved));assert.ok(rows.every(r=>r.after.x<1200));});
test('NoteBounds欠落・SVG切断はその接続だけ見送り、ready経路を妨げない',async t=>{const h=await harness(t);if(!h)return;h.draw();h.bounds.delete(h.score.tracks[0].staves[0].bars[0].voices[0].beats[0]);assert.equal(place(h)[0].moved,false);h.svg.connected=false;assert.doesNotThrow(()=>place(h));assert.ok(h.service.snapshot().labels.every(r=>!r.moved));});
test('描画済みスラーがない場合は標準文字を維持し、仮の曲線を推測しない',async t=>{const h=await harness(t);if(!h)return;h.draw();const first=h.paths()[0],native=h.svg.querySelectorAll('text').find(n=>n.textContent==='H'),before={...native.attrs};first.remove();const rows=place(h);assert.equal(rows[0].moved,false);assert.equal(rows[1].moved,true);assert.deepEqual(native.attrs,before);assert.equal(h.paths().length,1);});
test('配置候補は延長後の実曲線bboxに追従',async()=>{const m=await modulePromise,r=m.chooseGraceLabel({curve:{x:40,y:45,width:11.5,height:4},label:{x:10,y:10,width:8,height:12},obstacles:[],viewBox:[0,0,100,100]});assert.equal(r.box.x+r.box.width/2,45.75);assert.equal(r.box.y+r.box.height,43);});
test('Cは衝突時だけ最小の安全な左右補正を使う',async()=>{const m=await modulePromise,r=m.chooseGraceLabel({curve:{x:40,y:45,width:10,height:4},label:{x:10,y:10,width:8,height:12},obstacles:[{x:48.7,y:31,width:2,height:12}],viewBox:[0,0,100,100]});assert.equal(r.moved,true);assert.equal(r.shift,-1);assert.equal(r.trials[0].reason,'label-obstacle');});
test('Cでも衝突回避不能なら標準配置へ戻す',async()=>{const m=await modulePromise,label={x:10,y:10,width:8,height:12},r=m.chooseGraceLabel({curve:{x:40,y:45,width:10,height:4},label,obstacles:[{x:0,y:29,width:100,height:16}],viewBox:[0,0,100,100]});assert.equal(r.moved,false);assert.deepEqual(r.box,label);assert.ok(r.trials.every(t=>Math.abs(t.shift)<=5));});
test('X境界確定後・記号追加後だけに文字移動し、回転時には先に復元',()=>{const first=app.slice(app.indexOf('apiInstance.postRenderFinished.on'),app.indexOf('apiInstance.postRenderFinished.on')+4800);assert.ok(first.indexOf('graceNotation.positionLabels(')>first.indexOf('graceNotation.addSymbols('));assert.ok(first.indexOf('graceNotation.positionLabels(')>first.indexOf('buildScoreBarLayouts('));const rotation=app.slice(app.indexOf('function updatePracticeScoreLayout('),app.indexOf('function setPracticeBar('));assert.ok(rotation.indexOf('graceNotation.restoreLabels(')<rotation.indexOf('verticalTabController.createCardsFromRenderedPartials('));assert.ok(rotation.indexOf('graceNotation.positionLabels(')>rotation.indexOf('graceNotation.addSymbols('));});

