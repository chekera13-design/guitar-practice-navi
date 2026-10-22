const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const file=process.env.GRACE_COLLISION_MODULE||path.resolve(__dirname,'../js/graceNotation.js'),modulePromise=import(pathToFileURL(file).href);
const arc='M 773.72 62.41 Q 777.80 55.51 781.89 62.41 Q 777.80 59.51 773.72 62.41 Z';
const tie='M781.8860069044879,66.41499999999999 C791.9923667145981,57.632344791932496,807.4288224108005,61.13234479193249,812.758918296893,73.41499999999999 C807.9542114424426,58.81516064615764,792.51775574624,55.31516064615765,781.8860069044879,66.41499999999999 z';
const lens=(y=0)=>`M 0 ${y} Q 5 ${y+2} 10 ${y} Q 5 ${y-2} 0 ${y} Z`;
const matrix={a:1,b:0,c:0,d:1,e:0,f:0,inverse(){return this;},multiply(){return this;}};
const style={transform:'none',clipPath:'none',mask:'none',filter:'none',opacity:'1',display:'inline',visibility:'visible',fill:'rgb(0,0,0)',fillOpacity:'1',stroke:'none'};
const rect={x:773.72,y:58.96,width:8.17,height:3.45},limits={left:0,right:1000,top:0,bottom:200};
function dom(){
 const svg={localName:'svg',parentElement:null,hasAttribute:()=>false,getCTM:()=>matrix,paths:[],querySelectorAll(){return this.paths;}};
 const node=d=>{const attrs={d},n={localName:'path',parentElement:svg,ownerSVGElement:svg,attrs,getAttribute:k=>attrs[k]??null,hasAttribute:k=>Object.hasOwn(attrs,k),getCTM:()=>matrix};svg.paths.push(n);return n;};
 return{svg,node};
}
function painted(fn){const old=global.getComputedStyle;global.getComputedStyle=n=>({...style,...n.style});try{return fn();}finally{global.getComputedStyle=old;}}
test('塗り全体の凸包距離下限は実測約2.92pxを過大評価しない',async()=>{const m=await modulePromise,r=m.graceFilledCurveDistance(arc,tie);assert.ok(r.hullDistance>2.9&&r.hullDistance<2.92);assert.equal(r.lowerBound,r.hullDistance-.01);assert.equal(m.GRACE_ARC.obstacleGap,.25);});
test('bbox接触でも一意に識別した通常タイとの距離が安全なら許可',async()=>{const m=await modulePromise,{node}=dom(),a=node(arc),b=node(tie),o={node:b,x:781.886,y:59.879,width:30.873,height:13.536};assert.equal(painted(()=>m.safeGraceArc(a,rect,limits,[o],()=>new Set([b]))),true);});
test('通常タイを除外せず実際に交差する場合は見送る',async()=>{const m=await modulePromise,{node}=dom(),a=node(arc),b=node(arc);assert.equal(painted(()=>m.safeGraceArc(a,rect,limits,[{...rect,node:b}],()=>new Set([b]))),false);});
test('塗り領域の包含も距離0として見送る',async()=>{const r=(await modulePromise).graceFilledCurveDistance(lens(),lens(.5));assert.equal(r.lowerBound,0);assert.equal(r.safe,false);});
test('非交差でも安全距離0.25px未満なら見送る',async()=>{const r=(await modulePromise).graceFilledCurveDistance(lens(),lens(2.1));assert.ok(r.lowerBound>0&&r.lowerBound<.25);assert.equal(r.safe,false);});
test('数値ガードを差し引いた距離で閾値判定する',async()=>{const r=(await modulePromise).graceFilledCurveDistance(lens(),lens(2.255));assert.ok(r.hullDistance>=.25);assert.ok(r.lowerBound<.25);assert.equal(r.safe,false);});
for(const [label,d]of [['円弧','M0 0 A1 1 0 0 0 10 0 Z'],['未閉鎖','M0 0 Q5 2 10 0 Q5 -2 0 0'],['複合',lens()+' '+lens(3)],['相対','m0 0 q5 2 10 0 q-5 -2 -10 0z'],['非有限','M0 0 Q5 NaN 10 0 Q5 -2 0 0 Z'],['過大座標','M0 0 Q5 2000000 10 0 Q5 -2 0 0 Z']])test(label+'pathは二次判定で救済しない',async()=>{const m=await modulePromise,{node}=dom(),a=node(arc),b=node(d);assert.equal(painted(()=>m.safeGraceArc(a,rect,limits,[{...rect,node:b}],()=>new Set([b]))),false);});
for(const [label,change]of [['transform',{transform:'matrix(1,0,0,1,0,0)'}],['stroke',{stroke:'black',strokeWidth:'1'}],['不明な不透明性',{opacity:''}],['半透明fill',{fillOpacity:'.5'}],['clipPath',{clipPath:'url(#clip)'}],['gradient',{fill:'url(#gradient)'}]])test(label+'付きpathは見送る',async()=>{const m=await modulePromise,{node}=dom(),a=node(arc),b=node(tie);b.style=change;assert.equal(painted(()=>m.safeGraceArc(a,rect,limits,[{...rect,node:b}],()=>new Set([b]))),false);});
test('transform属性も拒否する',async()=>{const m=await modulePromise,{node}=dom(),a=node(arc),b=node(tie);b.attrs.transform='translate(0 0)';assert.equal(painted(()=>m.safeGraceArc(a,rect,limits,[{...rect,node:b}],()=>new Set([b]))),false);});
test('数字・文字・通常スラーなど未認証障害物は従来どおり保護',async()=>{const m=await modulePromise,{node}=dom(),a=node(arc);for(const localName of ['text','rect','path']){const b=node(tie);b.localName=localName;assert.equal(painted(()=>m.safeGraceArc(a,rect,limits,[{...rect,node:b}],()=>new Set())),false);}});
test('bboxで安全なら形状解析も認証も実行しない',async()=>{const m=await modulePromise;assert.equal(m.safeGraceArc(null,rect,limits,[{x:0,y:0,width:10,height:10}],()=>{throw Error('must not run');}),true);});
test('不正bbox・小節外は救済しない',async()=>{const m=await modulePromise;assert.equal(m.safeGraceArc(null,{...rect,x:NaN},limits,[],()=>new Set()),false);assert.equal(m.safeGraceArc(null,rect,{...limits,right:780},[],()=>new Set()),false);});
function fixture(){
 const {svg,node}=dom(),path=node('M0 0 C3 -2 7 -2 10 0 C7 -1 3 -1 0 0 Z'),staff={tuning:[1,2,3,4,5,6]},bar={index:0,staff},voice={bar};
 const aBeat={id:1,voice,graceType:0},bBeat={id:2,voice,graceType:0},from={id:10,beat:aBeat,string:4,fret:0,isTieOrigin:true},to={id:11,beat:bBeat,string:4,fret:0,isTieDestination:true};
 from.tieDestination=to;to.tieOrigin=from;aBeat.notes=[from];bBeat.notes=[to];voice.beats=[aBeat,bBeat];bar.voices=[voice];staff.bars=[bar];
 const api={score:{tracks:[{staves:[staff]}]},renderer:{boundsLookup:{findBeat:b=>({notes:b.notes.map(n=>({note:n,noteHeadBounds:n===from?{x:-4,y:0,w:8,h:13}:{x:10,y:0,w:0,h:0}}))})}}};
 const sourceRow=(id,type)=>({id,barIndex:0,partIndex:0,staffIndex:0,voiceIndex:0,grace:false,ties:[{type}],tied:[{type}]});
 const state={source:{status:'parsed',notes:[sourceRow('a','start'),sourceRow('b','stop')],ties:[{id:'tie-0',start:'a',end:'b',valid:true}]},model:{status:'matched',notes:[{sourceNoteId:'a',noteId:10,beatId:1},{sourceNoteId:'b',noteId:11,beatId:2}],ties:[{sourceTieId:'tie-0',fromNoteId:10,toNoteId:11,verified:true}]}};
 return{state,api,partial:{svg,x:0,y:0,firstBarIndex:0,lastBarIndex:0},svg,node,path,from,to};
}
test('原本・相互tie参照・一意なNoteBounds・SVG端点から認証する',async()=>{const m=await modulePromise,f=fixture();assert.equal(painted(()=>m.certifyGraceTiePaths(f.state,f.api,f.partial).has(f.path)),true);});
for(const [label,change]of [['相互tie参照なし',f=>f.to.tieOrigin=null],['原本tieなし',f=>f.state.source.notes[0].ties=[]],['原本の組が不確定',f=>f.state.source.ties[0].valid=false],['モデルID対応不確定',f=>f.state.model.notes[0].noteId=99],['同形path複数',f=>f.node(f.path.attrs.d)],['モデルtie複数',f=>f.state.model.ties.push({...f.state.model.ties[0]})],['別partial',f=>f.partial.firstBarIndex=1]])test(label+'は同じ弦/fretでも認証しない',async()=>{const m=await modulePromise,f=fixture();change(f);assert.equal(painted(()=>m.certifyGraceTiePaths(f.state,f.api,f.partial).size),0);});
test('各候補は最新pathで再判定し、前の安全結果を流用しない',async()=>{const m=await modulePromise,{node}=dom(),a=node(lens()),b=node(lens(2.5)),o={x:0,y:-1,width:10,height:5,node:b},v={left:-10,right:20,top:-10,bottom:20},r={x:0,y:-1,width:10,height:2};assert.equal(painted(()=>m.safeGraceArc(a,r,v,[o],()=>new Set([b]))),true);b.attrs.d=lens(.5);assert.equal(painted(()=>m.safeGraceArc(a,r,v,[o],()=>new Set([b]))),false);});
