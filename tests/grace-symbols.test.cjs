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
 const m=await modulePromise,service=m.createGraceNotation(),api={settings:{display:{staveProfile:3,resources:{graceFont:{size:11}}}}},owner={generation:1,stage:{},api};
 const token=service.begin(owner);service.capture(token,xml);const prepared=fix(xml,service,token);
 const score=alpha.importer.ScoreLoader.loadScoreFromBytes(new TextEncoder().encode(prepared.fixed),new alpha.Settings());api.score=score;
 service.bindModel(token,score);
 const svg=new Element('svg',{width:'1200px',height:'190px'});svg.connected=true;
 const bounds=new Map();
 for(const track of score.tracks)for(const staff of track.staves)for(const bar of staff.bars)for(const voice of bar.voices)for(const beat of voice.beats){
  const x=80+(bar.index-partialFirst)*200+(beat.index===0?0:12+(beat.index-1)*20);
  const entries=beat.notes.map(note=>{
   const string=staff.tuning.length-note.string+1,baseline=63+(string-1)*13;
   const head={x:x+offset,y:baseline-6.5,w:8,h:13};
   if(bar.index>=partialFirst){const text=svg.appendChild(new Element('text',{x:String(x),y:String(baseline)},String(note.fret)));
   text.box={x,y:baseline-10,width:beat.graceType?7:8,height:beat.graceType?12:16};}
   return{note,noteHeadBounds:head};
  });bounds.set(beat,{notes:entries});
  if(beat.text&&bar.index>=partialFirst){const text=svg.appendChild(new Element('text',{x:String(x+4),y:'35'},beat.text));text.box={x:x+3,y:33,width:beat.text==='H'?12:9,height:14};}
 }
 // NoteBoundsは全体座標、SVGはpartialローカル座標。
 api.renderer={boundsLookup:{findBeat:b=>bounds.get(b),findMasterBarByIndex:i=>({realBounds:{x:offset+(i-partialFirst)*200,w:250}})}};
 const partials=[{svg,x:offset,y:0,partialIndex:0,firstBarIndex:partialFirst,lastBarIndex:score.masterBars.length-1}];
 for(let i=0;i<6;i++)svg.appendChild(new Element('rect',{x:'0',y:String(59.5+i*13),width:'1200',height:'1'}));
 const original=svg.appendChild(new Element('path',{class:'alphatab-custom-slur'}));original.box={x:0,y:160,width:15,height:5};
 return{m,service,api,owner,token,prepared,score,svg,bounds,partials,original,
  draw(){service.annotate(token,api,partials);return service.snapshot().render;},
  paths(){return svg.querySelectorAll('.alphatab-grace-slur');}};
}


// 幾何単体テストでは制御点の包絡を使用（ブラウザでは実SVG getBBoxも別途照合）。
const oldBBox=Element.prototype.getBBox;
Element.prototype.getBBox=function(){
 if(this.tagName!=='path'||this.box||this.getAttribute('class')==='alphatab-grace-slur')return oldBBox.call(this);
 const tokens=this.getAttribute('d').match(/[A-Za-z]|-?\d+(?:\.\d+)?/g),pts=[];let i=0,x=0,y=0,cmd='';
 while(i<tokens.length){if(/^[A-Za-z]$/.test(tokens[i]))cmd=tokens[i++];if(cmd==='Z')continue;
 if(cmd==='H'){x=Number(tokens[i++]);pts.push([x,y]);}else if(cmd==='V'){y=Number(tokens[i++]);pts.push([x,y]);}
 else{const count=cmd==='C'?3:1;for(let j=0;j<count;j++){x=Number(tokens[i++]);y=Number(tokens[i++]);pts.push([x,y]);}}}
 const xs=pts.map(q=>q[0]),ys=pts.map(q=>q[1]);return{x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
};
Element.prototype.cloneNode=function(deep){const n=new Element(this.tagName,{...this.attrs},this.text);if(this.box)n.box={...this.box};if(deep)for(const c of this.children)n.appendChild(c.cloneNode(true));return n;};
global.getComputedStyle=n=>({font:'11px Arial',fontSize:'11px',textAnchor:'start',letterSpacing:'normal',stroke:'none'});
document.createElement=()=>({getContext:()=>({font:'',measureText:()=>({actualBoundingBoxAscent:8,actualBoundingBoxDescent:0,fontBoundingBoxAscent:10,fontBoundingBoxDescent:2,actualBoundingBoxLeft:0,actualBoundingBoxRight:6,width:7})})});
function cards(h,{outside=false,mismatch=false}={}){const track=new Element('div');for(let bar=0;bar<h.score.masterBars.length;bar++){
 const card=track.appendChild(new Element('article',{class:'vertical-tab-card'}));card.dataset={barIndex:String(bar)};
 const s=card.appendChild(new Element('svg',{viewBox:'0 0 1200 '+(outside?'65':'190')})),clip=s.appendChild(new Element('clipPath'));
 clip.appendChild(new Element('rect',{x:'0',y:'0',width:'1200',height:mismatch?'191':outside?'65':'190'}));s.appendChild(new Element('g',{'clip-path':'url(#test)'}));}return track;}
function symbols(h,track){h.service.addSymbols(h.token,h.api,h.partials,track);return h.service.snapshot().symbols;}
function groups(h){return h.svg.querySelectorAll('.alphatab-grace-symbol');}

test('1.8.4公開resources設定：小音符11px、通常数字14px、既定familyを維持',t=>{
 
 assert.match(app,/resources: \{ graceFont: "11px Arial, sans-serif" \}/);
 const settings=new alpha.Settings();settings.fillFromJson({display:{resources:{graceFont:'11px Arial, sans-serif'}}});
 assert.equal(settings.display.resources.graceFont.size,11);assert.equal(settings.display.resources.tablatureFont.size,14);
 assert.deepEqual(settings.display.resources.graceFont.families,new alpha.Settings().display.resources.graceFont.families);
});
test('単独と和音へ各1組。カードなしの横型初回にも追加',async t=>{
 const h=await harness(t);if(!h)return;const r=symbols(h);assert.equal(r.filter(x=>x.rendered).length,2,JSON.stringify(r));
 assert.deepEqual(r.map(x=>x.kind),['single','chord']);assert.equal(groups(h).length,2);
 assert.deepEqual(Array.from(groups(h),g=>Array.from(g.children,n=>n.getAttribute('data-symbol-part'))),[['stem','flag','slash'],['stem','flag','slash']]);
 assert.ok(r.every(x=>x.crop==='horizontal-no-card'&&x.inkGap===2));
});
test('数字の実字形下端から2px、旗・斜線はラボ改善形状のまま接合',async t=>{
 const h=await harness(t);if(!h)return;const r=symbols(h);assert.ok(r.every(x=>x.rendered));
 for(const x of r){assert.equal(x.geometry.y-(x.ink.y+x.ink.height),2);
 const g=x.geometry;assert.match(g.stem,new RegExp('V '+g.bottom));assert.ok(g.flag.startsWith('M '+(g.x-.425)+' '+g.bottom));
 assert.ok(x.parts.find(p=>p.role==='flag').box.width>3);}
});
test('slash=noには符尾/旗のみ。未指定/和音内矛盾には推測で追加しない',async t=>{
 const no=await harness(t,{xml:input('test2').replaceAll('slash="yes"','slash="no"')});if(!no)return;
 const r=symbols(no);assert.ok(r.every(x=>x.rendered&&x.slash===false));assert.ok(groups(no).every(g=>g.children.length===2));
 const absent=await harness(t,{xml:input('test2').replaceAll(' slash="yes"','')});assert.equal(symbols(absent).filter(x=>x.rendered).length,0);
 const xml=input('test2'),i=xml.lastIndexOf('slash="yes"');const mixed=await harness(t,{xml:xml.slice(0,i)+xml.slice(i).replace('slash="yes"','slash="no"')});
 const mixedResult=symbols(mixed);assert.equal(mixedResult[0].rendered,true);assert.equal(mixedResult[1].rendered,false);
});
test('test3の連続小音符には0組。標準連桁・曲線・数字を保持',async t=>{
 const h=await harness(t,{xml:input('test3')});if(!h)return;const before=h.svg.children.slice();
 const r=symbols(h);assert.deepEqual(r.map(x=>x.rendered),[true,true,false]);assert.match(r[2].reason,/sequence/);
 assert.ok(before.every(n=>n.parent===h.svg));assert.equal(h.original.parent,h.svg);
});
test('上向き・未対応音価は標準表示のまま見送る',async t=>{
 for(const xml of [input('test2').replaceAll('<stem>down</stem>','<stem>up</stem>'),input('test2').replaceAll('<type>eighth</type>','<type>16th</type>')]){
 const h=await harness(t,{xml});if(!h)return;assert.equal(symbols(h).filter(x=>x.rendered).length,0);assert.equal(h.original.parent,h.svg);}
});
test('最新NoteBoundsの欠落・曖昧なnote IDは該当グループのみ見送る',async t=>{
 for(const kind of ['missing','duplicate']){const h=await harness(t);if(!h)return;const beat=h.score.tracks[0].staves[0].bars[0].voices[0].beats[0];
 if(kind==='missing')h.bounds.delete(beat);else h.bounds.get(beat).notes.push(h.bounds.get(beat).notes[0]);
 const r=symbols(h);assert.equal(r[0].rendered,false);assert.equal(r[1].rendered,true);}
});
test('実字形計測不能・フォント未準備では数字位置を推測しない',async t=>{
 const h=await harness(t);if(!h)return;document.fonts.check=()=>false;try{assert.equal(symbols(h).filter(x=>x.rendered).length,0);}finally{document.fonts.check=()=>true;}
 const m=await modulePromise;assert.throws(()=>m.graceInkBounds({x:0,y:0,width:7,height:12},{width:8}),/uncertain/);
});
test('標準符尾/旗が存在する場所や2pxで衝突する配置では0/1pxへ戻さない',async t=>{
 const h=await harness(t);if(!h)return;const r=symbols(h),b=r[0].parts.find(p=>p.role==='stem').box;
 h.service.removeSymbols(h.token,h.api);h.svg.appendChild(new Element('rect',{x:String(b.x),y:String(b.y),width:'1',height:'30'}));
 const after=symbols(h);assert.equal(after[0].rendered,false);assert.equal(after[1].rendered,true);assert.equal(groups(h).length,1);
});
test('既存カードとclip範囲内に1組だけ複製し、X/Y/viewBoxを変更しない',async t=>{
 const h=await harness(t);if(!h)return;const track=cards(h),before=track.querySelectorAll('svg').map(s=>s.getAttribute('viewBox'));
 const r=symbols(h,track);assert.ok(r.every(x=>x.rendered));assert.equal(track.querySelectorAll('.alphatab-grace-symbol').length,2);
 assert.deepEqual(track.querySelectorAll('svg').map(s=>s.getAttribute('viewBox')),before);
 symbols(h,track);assert.equal(track.querySelectorAll('.alphatab-grace-symbol').length,2);assert.equal(groups(h).length,2);
});
test('crop外/clip不一致では記号だけ見送り、crop拡張も例外伝播もない',async t=>{
 for(const options of [{outside:true},{mismatch:true}]){const h=await harness(t);if(!h)return;const track=cards(h,options),before=track.querySelectorAll('svg').map(s=>s.getAttribute('viewBox'));
 assert.doesNotThrow(()=>symbols(h,track));assert.equal(groups(h).length,0);assert.deepEqual(track.querySelectorAll('svg').map(s=>s.getAttribute('viewBox')),before);assert.equal(h.original.parent,h.svg);}
});
test('再描画・回転では一旦除去し、新しい境界/座標で再生成できる',async t=>{
 const h=await harness(t);if(!h)return;const track=cards(h);symbols(h,track);h.service.removeSymbols(h.token,h.api);
 assert.equal(groups(h).length,0);assert.equal(track.querySelectorAll('.alphatab-grace-symbol').length,0);
 const before=symbols(h,track)[0].geometry.x;
 for(const b of h.bounds.values())for(const n of b.notes)n.noteHeadBounds.x+=15;
 for(const n of h.svg.querySelectorAll('text')){n.setAttribute('x',String(Number(n.getAttribute('x'))+15));n.box={...n.box,x:n.box.x+15};}
 const r=symbols(h,track);assert.equal(r[0].geometry.x,before+15);assert.equal(groups(h).length,2);
});
test('世代/score変更・closeで旧記号を破棄し、旧tokenで追加不可',async t=>{
 const h=await harness(t);if(!h)return;const track=cards(h);symbols(h,track);h.service.begin({...h.owner,generation:2});
 assert.equal(groups(h).length,0);assert.equal(track.querySelectorAll('.alphatab-grace-symbol').length,0);assert.equal(h.service.addSymbols(h.token,h.api,h.partials,track),false);
 h.service.clear();assert.equal(h.service.snapshot(),null);
});
test('partialのローカル座標を使用、全体Xを記号へ流用しない',async t=>{
 const h=await harness(t,{offset:3000});if(!h)return;const r=symbols(h);assert.ok(r.every(x=>x.rendered&&x.geometry.x<1200));
});
test('H/S・Cスラーを移動/削除せず、記号も曲線と重ねない',async t=>{
 const h=await harness(t);if(!h)return;h.draw();const before=h.paths().map(p=>p.getAttribute('d')),labels=h.svg.querySelectorAll('text').filter(n=>/^[HS]$/.test(n.textContent)).map(n=>({...n.attrs}));
 assert.ok(symbols(h).every(x=>x.rendered));assert.deepEqual(h.paths().map(p=>p.getAttribute('d')),before);
 assert.deepEqual(h.svg.querySelectorAll('text').filter(n=>/^[HS]$/.test(n.textContent)).map(n=>({...n.attrs})),labels);
});
test('記号処理はカード作成の後、回転時は境界解析より前に除去する',()=>{
 assert.ok(app.indexOf('graceNotation.addSymbols(graceToken, apiInstance')>app.indexOf('verticalTabController.createCardsFromRenderedPartials(partials, bars)'));
 const start=app.indexOf('function updatePracticeScoreLayout()'),code=app.slice(start,app.indexOf('function setPracticeBar',start));
 assert.ok(code.indexOf('graceNotation.removeSymbols(')<code.indexOf('verticalTabController.createCardsFromRenderedPartials('));
 assert.ok(code.indexOf('graceNotation.addSymbols(')>code.indexOf('graceNotation.validateCards('));
});


const pcZoomDigit={x:103.91600036621094,y:53.26222610473633,width:6.6666669845581055,height:12.222223281860352};
const pcZoomMetrics={width:6.11767578125,actualBoundingBoxAscent:8,actualBoundingBoxDescent:0,fontBoundingBoxAscent:10,fontBoundingBoxDescent:2,actualBoundingBoxLeft:0,actualBoundingBoxRight:6};
test('PC90%実測：SVG baseline/advance照合で画素丸めされたbboxへ依存しない',async()=>{
 const m=await modulePromise;assert.throws(()=>m.graceInkBounds(pcZoomDigit,pcZoomMetrics),/uncertain/);
 const ink=m.graceInkBounds(pcZoomDigit,pcZoomMetrics,{baseline:63.26222610473633,advance:6.128472328186035,pixelScale:.9});
 assert.equal(ink.y+ink.height,63.26222610473633);assert.equal(ink.width,6);
});
test('Fire実測：有効なglyph overhangをfont-cell bboxの外という理由で捨てない',async()=>{
 const m=await modulePromise,digit={x:103.916,y:53.32125,width:6,height:12.666667},metrics={...pcZoomMetrics,width:6,fontBoundingBoxDescent:3,actualBoundingBoxLeft:-1,actualBoundingBoxRight:7};
 const ink=m.graceInkBounds(digit,metrics,{baseline:63.32125,advance:6,pixelScale:1.5});assert.equal(ink.x,104.916);assert.equal(ink.width,6);assert.equal(ink.y+ink.height,63.32125);
});
test('advanceは実画素の丸めが同じ場合のみ照合できる',async()=>{
 const m=await modulePromise,digit={x:0,y:0,width:6,height:12.666667},metrics={...pcZoomMetrics,width:6,fontBoundingBoxDescent:3};
 assert.doesNotThrow(()=>m.graceInkBounds(digit,metrics,{baseline:10,advance:6.125,pixelScale:1.5}));
 assert.throws(()=>m.graceInkBounds(digit,metrics,{baseline:10,advance:8,pixelScale:1.5}),/uncertain/);
 assert.throws(()=>m.graceInkBounds(digit,metrics,{baseline:10,advance:6.125}),/uncertain/);
});
test('native baseline経路でも欠落API・非有限値・無関係な基準位置は拒否',async()=>{
 const m=await modulePromise,ref={baseline:10,advance:6.128472,pixelScale:.9};
 for(const metric of [{...pcZoomMetrics,actualBoundingBoxAscent:undefined},{...pcZoomMetrics,width:NaN},{...pcZoomMetrics,actualBoundingBoxAscent:30}])assert.throws(()=>m.graceInkBounds(pcZoomDigit,metric,ref),/uncertain/);
 assert.throws(()=>m.graceInkBounds(pcZoomDigit,pcZoomMetrics,{...ref,baseline:NaN}),/uncertain/);
 assert.throws(()=>m.graceInkBounds(pcZoomDigit,pcZoomMetrics,{...ref,baseline:1000}),/outside/);
});
test('符尾短縮でも数字との2px・旗と斜線の形状・接合は維持',async()=>{
 const m=await modulePromise,d={x:0,y:0,width:6.18,height:13},ink={x:0,y:2,width:6,height:8},a=m.graceSymbolGeometry(d,ink,{slash:true}),b=m.graceSymbolGeometry(d,ink,{slash:true,stemLengthScale:.98});
 assert.equal(a.y,b.y);assert.equal(b.y-(ink.y+ink.height),2);assert.ok(b.bottom<a.bottom);
 const numbers=s=>s.match(/-?\d+(?:\.\d+)?/g).map(Number),ap=numbers(a.flag),bp=numbers(b.flag);
 for(let i=0;i<ap.length;i++)assert.ok(Math.abs((bp[i]-ap[i])-(i%2?b.bottom-a.bottom:0))<1e-9);
 const as=numbers(a.slash),bs=numbers(b.slash);assert.ok(Math.abs((bs[2]-bs[0])-(as[2]-as[0]))<1e-9);assert.ok(Math.abs((bs[3]-bs[1])-(as[3]-as[1]))<1e-9);
});
test('微小な水平fitでも記号の形とY・隙間を変更せず、範囲外は拒否',async()=>{
 const m=await modulePromise,d={x:0,y:0,width:6,height:13},ink={x:0,y:2,width:6,height:8},a=m.graceSymbolGeometry(d,ink,{slash:true}),b=m.graceSymbolGeometry(d,ink,{slash:true,anchorShift:-.125});
 assert.equal(b.x,a.x-.125);assert.equal(b.y,a.y);assert.equal(b.bottom,a.bottom);assert.equal(b.inkGap,2);
 assert.throws(()=>m.graceSymbolGeometry(d,ink,{slash:true,anchorShift:1}),/unverified/);
 assert.throws(()=>m.graceSymbolGeometry(d,ink,{slash:true,stemLengthScale:.8}),/unverified/);
});
test('AQUOS実測：斜線と弦の距離0.244pxの衝突は2%短縮で安全域へ',async()=>{
 const m=await modulePromise,d={x:103.916,y:53.32125,width:6.1822919845581055,height:13},metric={...pcZoomMetrics,width:6.18212890625,fontBoundingBoxDescent:3},ink=m.graceInkBounds(d,metric);
 const a=m.graceSymbolGeometry(d,ink,{slash:true}),b=m.graceSymbolGeometry(d,ink,{slash:true,stemLengthScale:.98});
 const slashBottom=g=>{const p=g.slash.match(/-?\d+(?:\.\d+)?/g).map(Number);return Math.max(p[1],p[3])+m.GRACE_SYMBOL.stemWidth/2;};
 assert.ok(72.83-slashBottom(a)<.25);assert.ok(72.83-slashBottom(b)>=.25);assert.ok(b.bottom<85.83-.25);assert.ok(Math.abs(b.y-(ink.y+ink.height)-2)<1e-9);
});
