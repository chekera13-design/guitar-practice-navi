const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),os=require('node:os');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
const modulePromise=import(pathToFileURL(path.join(root,'js/graceNotation.js')).href);
const markerTests=fs.readFileSync(path.join(__dirname,'technique-markers.test.cjs'),'utf8');
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
const input=name=>fs.readFileSync(path.join(__dirname,'fixtures','grace-'+name+'.musicxml'),'utf8');
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

test('原本directionを要素位置とgrace所属で照合し、H/S標準wordsを保持',async t=>{
 const h=await harness(t);if(!h)return;assert.deepEqual([...h.prepared.fixed.matchAll(/<words[^>]*>(.*?)<\/words>/g)].map(m=>m[1]),['H','S']);
 const texts=h.score.tracks[0].staves[0].bars.flatMap(b=>b.voices.flatMap(v=>v.beats.map(b=>b.text))).filter(Boolean);assert.deepEqual(texts,['H','S']);
 const defaults=fix(input('test2'),h.service,null);assert.equal(defaults.fixed.includes('<words'),false);
});
test('通常奏法のH/P/Sは標準文字へ振り分けず既存経路を維持',async t=>{
 const h=await harness(t,{xml:input('test2').replace(/<grace[^>]*\/>/g,'')});if(!h)return;
 assert.equal(h.prepared.fixed.includes('<words'),false);assert.deepEqual(JSON.parse(JSON.stringify(h.prepared.c.pairs().map(p=>p.label))),['H','S']);assert.equal(h.paths().length,0);
});
test('小音符は通常SVG処理に渡さず、専用の1接続1曲線だけ追加',async t=>{
 const h=await harness(t);if(!h)return;const report=h.draw();assert.equal(report.filter(r=>r.rendered).length,2);assert.equal(h.paths().length,2);
 const edges=h.service.snapshot().model.slurs;assert.deepEqual(report.map(r=>r.toNoteId),edges.map(e=>e.logical.toNoteId));
 assert.equal(h.svg.querySelectorAll('.alphaTab-slur-label').length,0);assert.equal(h.svg.querySelectorAll('.alphatab-custom-slur').length,1);
 h.prepared.c.document=global.document;h.prepared.c.renderSlursAndLabelsInSvg(h.api,[]); // 通常関数の小音符除外分岐も安全。
});
test('文字なしslurへH/Sを推測して追加しない',async t=>{
 const h=await harness(t,{xml:input('test2').replace(/<direction[\s\S]*?<\/direction>/g,'')});if(!h)return;
 h.draw();assert.equal(h.paths().length,2);assert.equal(h.svg.querySelectorAll('text').some(n=>/^[HS]$/.test(n.textContent)),false);
});
test('test3：連続小音符には独自曲線を追加しない',async t=>{
 const h=await harness(t,{xml:input('test3')});if(!h)return;h.draw();assert.equal(h.paths().length,2);assert.deepEqual(Array.from(h.paths(),n=>n.getAttribute('data-grace-bar')),['0','1']);
});
test('NoteBoundsの欠落・重複・不正値はその接続だけ見送る',async t=>{
 for(const kind of ['missing','duplicate','invalid']){const h=await harness(t);if(!h)return;const b=h.score.tracks[0].staves[0].bars[0].voices[0].beats[0];
 if(kind==='missing')h.bounds.delete(b);if(kind==='duplicate')h.bounds.get(b).notes.push(h.bounds.get(b).notes[0]);if(kind==='invalid')h.bounds.get(b).notes[0].noteHeadBounds.x=NaN;
 assert.doesNotThrow(()=>h.draw());assert.equal(h.paths().length,1);}
});
test('別note ID・変更された論理接続を使って曲線を描かない',async t=>{
 const h=await harness(t);if(!h)return;h.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].slurDestination=null;h.draw();assert.equal(h.paths().length,1);
});
test('標準effect曲線・タイとの重複を避け、標準要素は削除しない',async t=>{
 for(const effect of ['isTieOrigin','isEffectSlurOrigin']){const h=await harness(t);if(!h)return;const n=h.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0];
 Object.defineProperty(n,effect,{get:()=>true});h.draw();assert.equal(h.paths().length,1);assert.equal(h.original.parent,h.svg);}
});
test('純TAB以外では標準五線スラーを削除せず独自曲線を見送る',async t=>{
 const h=await harness(t);if(!h)return;h.api.settings.display.staveProfile=1;assert.doesNotThrow(()=>h.draw());assert.equal(h.paths().length,0);assert.equal(h.original.parent,h.svg);
});
test('標準H/SのSVGが二重・変換付き・欠落ならその曲線を見送る',async t=>{
 for(const kind of ['duplicate','transform','missing']){const h=await harness(t);if(!h)return;const label=h.svg.querySelectorAll('text').find(n=>n.textContent==='H');
 if(kind==='missing')label.remove();if(kind==='transform')label.setAttribute('transform','translate(1 0)');if(kind==='duplicate'){const n=h.svg.appendChild(new Element('text',{...label.attrs},'H'));n.box=label.box;}
 h.draw();assert.equal(h.paths().length,1);}
});
test('同じSVGへの再適用は増殖せず通常曲線・標準文字を維持',async t=>{
 const h=await harness(t);if(!h)return;h.draw();const d=h.paths().map(n=>n.getAttribute('d'));h.draw();assert.equal(h.paths().length,2);assert.deepEqual(h.paths().map(n=>n.getAttribute('d')),d);assert.equal(h.original.parent,h.svg);
});
test('フォント未準備では待機や例外伝播を増やさず曲線だけ見送る',async t=>{
 const h=await harness(t);if(!h)return;document.fonts.check=()=>false;try{h.draw();assert.equal(h.paths().length,0);}finally{document.fonts.check=()=>true;}
});
test('世代変更・closeで所有曲線だけ破棄し、旧tokenは新SVGへ描画不可',async t=>{
 const h=await harness(t);if(!h)return;h.draw();h.service.begin({...h.owner,generation:2});assert.equal(h.paths().length,0);assert.equal(h.service.annotate(h.token,h.api,h.partials),false);assert.equal(h.original.parent,h.svg);h.service.clear();assert.equal(h.service.snapshot(),null);
});
test('同じscoreの再描画では最新NoteBoundsを使用する',async t=>{
 const h=await harness(t);if(!h)return;h.draw();const before=h.paths()[0].getAttribute('d');
 for(const b of h.bounds.values())for(const entry of b.notes)entry.noteHeadBounds.x+=10;
 for(const n of h.svg.querySelectorAll('text')){n.setAttribute('x',String(Number(n.getAttribute('x'))+10));n.box={...n.box,x:n.box.x+10};}
 h.draw();assert.equal(h.paths().length,2);assert.notEqual(h.paths()[0].getAttribute('d'),before);
});
test('partial全体座標をローカルへ変換し、カード有無に依存せず描画',async t=>{
 const h=await harness(t,{offset:2000});if(!h)return;h.draw();assert.equal(h.paths().length,2);const entry=h.service.snapshot().render[0];assert.ok(entry.x1<2000);assert.equal(entry.crop,'not-assessed');
});
test('viewBox/clip外の曲線だけ撤回し、cropを拡張しない',async t=>{
 const h=await harness(t);if(!h)return;h.draw();const track=new Element('div');
 for(let bar=0;bar<2;bar++){const card=track.appendChild(new Element('article',{class:'vertical-tab-card'}));card.dataset={barIndex:String(bar)};
 const s=card.appendChild(new Element('svg',{viewBox:`0 ${bar?0:100} 1000 90`})),clip=s.appendChild(new Element('clipPath'));clip.appendChild(new Element('rect',{x:'0',y:bar?'0':'100',width:'1000',height:'90'}));
 for(const p of h.paths()){const n=s.appendChild(new Element('path',{...p.attrs}));n.box=p.getBBox();}}
 const before=track.querySelectorAll('svg').map(s=>s.getAttribute('viewBox'));h.service.validateCards(h.token,h.api,track);
 assert.equal(h.paths().length,1);assert.equal(h.service.snapshot().render[0].reason,'arc-outside-existing-crop');assert.deepEqual(track.querySelectorAll('svg').map(s=>s.getAttribute('viewBox')),before);
});
test('上向き・跨小節・連続など除外分類は通常スラーへ流さない',()=>{
 assert.match(app,/if \(pair\.start\.grace \|\| pair\.end\.grace\) return/);assert.ok(app.indexOf('graceNotation.annotate(graceToken')<app.indexOf('verticalTabController.createCardsFromRenderedPartials(partials, bars)'));
});
test('C方式はラボと同じ線幅2 SVG pxを使い、詰まった文字間は見送る',async()=>{
 const m=await modulePromise;assert.equal(m.GRACE_ARC.thickness*m.GRACE_ARC.widthScale,2);assert.deepEqual(m.GRACE_ARC.extensionRatios,[.15,.10]);
 assert.throws(()=>m.chooseGraceArc({x1:80,x2:88,preferredY:50,chordTop:54,digitTop:52,labelBox:{x:80,y:49,width:12,height:10}}),/no-safe-arc-space/);
});
test('第11・12小節の後半partialでもglobal barとnote IDから対応付ける',async t=>{
 const doc=parse(input('test2')),part=doc.querySelector('part'),attributes=part.querySelector('attributes');
 const divisions=Number(attributes.querySelector('divisions').textContent),padding=parse('<part>'+Array.from({length:10},(_,i)=>`<measure number="pad${i}">${serialize(attributes)}<note><rest/><duration>${divisions*4}</duration><voice>1</voice><type>whole</type></note></measure>`).join('')+'</part>').querySelector('part');
 part.children=[...padding.children,...part.children];const h=await harness(t,{xml:serialize(doc),partialFirst:10,offset:3000});if(!h)return;
 const report=h.draw();assert.equal(h.paths().length,2);assert.deepEqual(report.map(r=>r.barIndex),[10,11]);assert.ok(report.every(r=>r.x1<1200));
});
test('通常音符用・複数words・異なる原本を小音符H/Sとして保護しない',async t=>{
 const h=await harness(t);if(!h)return;const doc=new DOMParser().parseFromString(input('test2'));
 assert.equal(h.service.wordsToKeep(h.token,doc,input('test3')).size,0);
 const xml=input('test2').replace('<words','<words>other</words><words');
 const m=await modulePromise,service=m.createGraceNotation(),token=service.begin({generation:2,stage:{},api:{}});service.capture(token,xml);
 const kept=service.wordsToKeep(token,new DOMParser().parseFromString(xml),xml);assert.equal(kept.size,1);assert.equal([...kept][0].querySelector('words').textContent,'S');
});
test('縦カードの検証自体が失敗しても譜面処理へ例外を伝えない',async t=>{
 const h=await harness(t);if(!h)return;h.draw();assert.doesNotThrow(()=>h.service.validateCards(h.token,h.api,{querySelectorAll(){throw Error('unavailable');}}));
 assert.equal(h.paths().length,0);assert.equal(h.original.parent,h.svg);assert.equal(h.service.snapshot().render[0].reason,'vertical-validation-unavailable');
});
test('追加曲線だけを書き込み、数字・標準文字・SVG寸法を変更しない',async t=>{
 const h=await harness(t);if(!h)return;const original=[...h.svg.querySelectorAll('text,path,rect')],before=original.map(n=>({attrs:{...n.attrs},text:n.textContent})),size={...h.svg.attrs};
 h.draw();assert.deepEqual(original.map(n=>({attrs:{...n.attrs},text:n.textContent})),before);assert.deepEqual(h.svg.attrs,size);
});
test('短く浅い弧だけ15%延長し、S側の通常の高さの弧は延長しない',async t=>{
 const h=await harness(t);if(!h)return;const r=h.draw();assert.equal(r[0].extensionRatio,.15);assert.equal(r[1].extensionRatio,0);
});
test('延長先に障害物がある場合は10%を試し、安全でなければ従来長へ戻る',async t=>{
 for(const [x,expected] of [[83.18,.10],[83.45,0]]){const h=await harness(t);if(!h)return;const r=h.draw()[0];
 h.svg.appendChild(new Element('rect',{x:String(x),y:String(r.placement.top),width:'.01',height:String(r.placement.bottom-r.placement.top)}));
 const next=h.draw();assert.equal(next[0].rendered,true);assert.equal(next[0].extensionRatio,expected);}
});
