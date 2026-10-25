const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {pathToFileURL}=require('node:url'),root=path.resolve(__dirname,'..');
const modulePromise=import(pathToFileURL(path.join(root,'js/capoPositionNotation.js')).href);
const source={status:'parsed',candidates:[{raw:'capo2'}],diagnostics:[]};
async function setup(options={}){
 const m=await modulePromise,calls=[],score={tracks:[]},owner={generation:1,stage:{id:'solo-3'},api:{score}};
 const service=m.createCapoPositionNotation({analyzeSource:xml=>{calls.push(['capture',xml]);return structuredClone(source);},apply:(...args)=>{calls.push(['apply',...args]);return{moved:true,status:'moved'};},...options});
 const token=service.begin(owner);return{m,service,owner,token,score,calls};
}
test('production and independent lab use the same exported C implementation',async()=>{
 const m=await modulePromise,lab=await import(pathToFileURL(path.join(root,'diagnostics/capo-position-lab-core.js')).href);
 for(const key of ['analyzeCapoSource','applyCapoPosition','resolveCapo','chooseCapoPlacement','musicSnapshot'])assert.equal(lab[key],m[key]);
});
test('no-capo scores skip source parsing, model scanning and SVG access',async()=>{
 const h=await setup({analyzeSource(){throw Error('must not parse');},apply(){throw Error('must not draw');}});
 h.service.capture(h.token,'<score-partwise/>');h.service.bindModel(h.token,h.score);
 assert.equal(h.service.annotate(h.token,h.owner.api,new Proxy([],{get(){throw Error('must not inspect SVG');}})),true);
 assert.equal(h.service.snapshot().result.status,'absent');
});
test('capture preserves raw XML and annotate passes current score/cards and mode C',async()=>{
 const h=await setup(),xml='<words>capo2</words>',cards={querySelectorAll:()=>[]},partials=[{svg:{}}];
 h.service.capture(h.token,xml);h.service.bindModel(h.token,h.score);
 const before=JSON.stringify(h.score);assert.equal(h.service.annotate(h.token,h.owner.api,partials,cards),true);
 const args=h.calls[1];assert.equal(h.calls[0][1],xml);assert.equal(args[1],h.owner.api);assert.equal(args[2],partials);
 assert.equal(args[4].mode,'C');assert.equal(args[4].cards,cards);assert.equal(args[4].expectedScore,h.score);assert.equal(JSON.stringify(h.score),before);
});
test('generation, stage and API identity all govern the current token',async()=>{
 const h=await setup();assert.equal(h.service.tokenFor(h.owner),h.token);
 for(const delta of [{generation:2},{stage:{id:'solo-3'}},{api:{score:h.score}}])assert.equal(h.service.tokenFor({...h.owner,...delta}),null);
 const next=h.service.begin({...h.owner,generation:2});assert.notEqual(next,h.token);
 assert.equal(h.service.capture(h.token,'capo2'),false);assert.equal(h.service.bindModel(h.token,h.score),false);
 assert.equal(h.service.annotate(h.token,h.owner.api,[]),false);assert.equal(h.service.restore(h.token,h.owner.api),false);
});
test('replaced API/score cannot apply old coordinates',async()=>{
 const h=await setup();h.service.capture(h.token,'capo2');h.service.bindModel(h.token,h.score);
 assert.equal(h.service.annotate(h.token,{score:h.score},[]),false);
 h.owner.api.score={};assert.equal(h.service.annotate(h.token,h.owner.api,[]),false);assert.equal(h.calls.filter(c=>c[0]==='apply').length,0);
});
test('clear on close/error invalidates source, model and pending work',async()=>{
 const h=await setup();h.service.capture(h.token,'capo2');h.service.bindModel(h.token,h.score);h.service.clear();
 assert.equal(h.service.snapshot(),null);assert.equal(h.service.capture(h.token,'capo2'),false);assert.equal(h.service.annotate(h.token,h.owner.api,[]),false);
 const next=h.service.begin(h.owner);h.service.bindModel(next,h.score);h.service.annotate(next,h.owner.api,[]);assert.equal(h.service.snapshot().result.status,'absent');
});
test('source-analysis failure is nonblocking and never invokes the renderer',async()=>{
 const h=await setup({analyzeSource(){throw Error('bad XML');}});assert.equal(h.service.capture(h.token,'capo2'),true);
 h.service.bindModel(h.token,h.score);assert.equal(h.service.annotate(h.token,h.owner.api,[]),true);assert.equal(h.service.snapshot().result.status,'skipped');
 assert.equal(h.calls.length,0);
});
test('placement failure keeps the score ready path available',async()=>{
 const h=await setup({apply(){throw Error('unverified bounds');}});h.service.capture(h.token,'capo2');h.service.bindModel(h.token,h.score);
 assert.equal(h.service.annotate(h.token,h.owner.api,[]),true);assert.equal(h.service.snapshot().result.reason,'unverified bounds');
});
test('latest snapshot cannot mutate source or placement state',async()=>{
 const h=await setup();h.service.capture(h.token,'capo2');h.service.bindModel(h.token,h.score);h.service.annotate(h.token,h.owner.api,[]);
 const snapshot=h.service.snapshot();snapshot.source.candidates[0].raw='CAPO 5';snapshot.result.moved=false;
 assert.equal(h.service.snapshot().source.candidates[0].raw,'capo2');assert.equal(h.service.snapshot().result.moved,true);
});
test('a replacement during placement cannot publish an obsolete result',async()=>{
 let h;h=await setup({apply(){h.service.begin({...h.owner,generation:2});return{moved:true};}});
 h.service.capture(h.token,'capo2');h.service.bindModel(h.token,h.score);assert.equal(h.service.annotate(h.token,h.owner.api,[]),false);
 assert.equal(h.service.snapshot().generation,2);assert.equal(h.service.snapshot().result,null);
});
const fixture=fs.readFileSync(path.join(__dirname,'score-loading.test.cjs'),'utf8');
const makeHarness=vm.runInNewContext(fixture.slice(0,fixture.indexOf("for (const state of ['idle'"))+'\nharness;',{require,__dirname,Blob,TextEncoder,setImmediate});
async function integrated(options={}){
 const events=[],h=makeHarness({fetch:async()=>({ok:true,text:async()=>'<score-partwise><words>capo2</words></score-partwise>'}),...options});
 const {createCapoPositionNotation}=await modulePromise;
 h.c.capoPositionNotation=createCapoPositionNotation({analyzeSource:xml=>{events.push('raw');return{...source,xml};},apply:(api,partials,s,opts)=>{events.push('capo');assert.equal(api.score,opts.expectedScore);assert.equal(opts.mode,'C');return{moved:true};}});
 h.c.fixMuseScoreXml=xml=>{events.push('fix');assert.equal(h.c.capoPositionNotation.snapshot().source.xml,xml);return xml;};
 h.c.buildScoreBarLayouts=()=>{events.push('bounds');return true;};
 h.c.graceNotation.positionLabels=()=>events.push('grace-labels');return{h,events};
}
test('real app lifecycle captures before fix and places after bounds/cards/grace labels',async()=>{
 const {h,events}=await integrated();await h.open();
 const old=h.c.VerticalTabController.prototype.createCardsFromRenderedPartials;
 h.c.VerticalTabController.prototype.createCardsFromRenderedPartials=function(...args){events.push('cards');return old.apply(this,args);};
 h.complete();assert.equal(h.c.scoreLoadState,'ready');assert.deepEqual(events,['raw','fix','bounds','cards','grace-labels','capo']);
 assert.equal(h.c.mainActionBtn.disabled,false);assert.equal(h.c.capoPositionNotation.snapshot().result.moved,true);
});
test('app skip/error from optional placement does not change ready or practice controls',async()=>{
 const {h}=await integrated();h.c.capoPositionNotation.annotate=()=>{throw Error('optional display failure');};await h.open();h.complete();
 assert.equal(h.c.scoreLoadState,'ready');assert.equal(h.c.mainActionBtn.disabled,false);
});
test('app close and next stage clear prior annotation state and reject late events',async()=>{
 const {h}=await integrated();await h.open();h.complete();const old=h.c.api;
 h.c.closePracticeModal();assert.equal(h.c.capoPositionNotation.snapshot(),null);
 await h.open({...h.stage,id:2,file:'two.xml'});h.complete();const now=h.c.capoPositionNotation.snapshot();
 old.postRenderFinished.emit();assert.deepEqual(h.c.capoPositionNotation.snapshot(),now);assert.equal(h.c.scoreLoadState,'ready');
 h.c.setScoreLoadState('error');assert.equal(h.c.capoPositionNotation.snapshot(),null);
});
test('cached portrait card generation restores original text before cloning and reapplies once',async()=>{
 const {h}=await integrated({landscape:true});await h.open();h.complete();const events=[];
 assert.equal(h.c.verticalTabController,null);
 const service=h.c.capoPositionNotation,restore=service.restore,annotate=service.annotate;
 service.restore=(...a)=>{events.push('restore');return restore(...a);};service.annotate=(...a)=>{events.push('annotate');return annotate(...a);};
 const old=h.c.VerticalTabController.prototype.createCardsFromRenderedPartials;
 h.c.VerticalTabController.prototype.createCardsFromRenderedPartials=function(...a){events.push('clone');return old.apply(this,a);};
 h.c.window.matchMedia=q=>({matches:!q.includes('landscape')});h.c.updatePracticeScoreLayout();
 assert.deepEqual(events,['restore','clone','annotate']);assert.equal(h.c.scoreLoadState,'ready');h.c.updatePracticeScoreLayout();assert.equal(events.length,3);
});
test('display helper has no animation/audio/scroll loop and normal app does not load lab UI',async()=>{
 const module=fs.readFileSync(path.join(root,'js/capoPositionNotation.js'),'utf8'),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
 assert.doesNotMatch(module,/\b(?:requestAnimationFrame|setInterval|setTimeout|AudioContext|scrollLeft)\s*\(/);
 assert.doesNotMatch(module,/^import /m);assert.match(app,/from ['"]\.\/capoPositionNotation\.js['"]/);
 assert.doesNotMatch(app,/from ['"].*diagnostics/);assert.doesNotMatch(fs.readFileSync(path.join(root,'index.html'),'utf8'),/capo-position-lab/);
});
