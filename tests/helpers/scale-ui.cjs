const positionPolicy=require('./key-disclosure.cjs');
const {createKeyDisclosure}=require('./key-disclosure.cjs');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),root=path.join(__dirname,'../..');
function element(){return{dataset:{},attrs:{},listeners:{},children:[],hidden:false,disabled:false,innerText:'',
 setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k]??null;},removeAttribute(k){delete this.attrs[k];},
 removeEventListener(k,f){this.listeners[k]=(this.listeners[k]||[]).filter(fn=>fn!==f);}, addEventListener(k,f){(this.listeners[k]??=[]).push(f);},dispatch(k,event={}){for(const f of this.listeners[k]||[])f({target:this,preventDefault(){},...event});},
 focus(){this.focused=true;},contains(n){return this===n||this.children.some(c=>c.contains(n));},scrollIntoView(){}};}
function installScaleRoot(node,make=element,register=()=>{}){
 const forms=[],keys=[],fields=new Map();
 Object.defineProperty(node,'innerHTML',{configurable:true,get(){return this.html||'';},set(html){
  this.html=html;forms.length=0;keys.length=0;fields.clear();
  for(const m of html.matchAll(/id="(scales-\d+)" data-scale-id="(\d+)"/g)){const b=make();b.id=m[1];b.dataset.scaleId=m[2];b.total=make();b.practiced=make();b.querySelector=s=>s==='[data-scale-total]'?b.total:s==='[data-scale-practiced]'?b.practiced:null;forms.push(b);register(b.id,b);}
  for(const m of html.matchAll(/data-scale-key="([^"]+)"/g)){const b=make();b.dataset.scaleKey=m[1];b.countBadge=make();b.nameNode=make();b.querySelector=s=>s==='[data-scale-count]'?b.countBadge:s==='[data-scale-key-name]'?b.nameNode:null;keys.push(b);}
  for(const name of ['#scaleKeyToggle','#scaleKeyPanel','[data-scale-selected-count]','#scaleStartBtn','#scaleDetails','[data-scale-title]','[data-scale-form-label]','[data-scale-description]','[data-scale-meta]','[data-scale-key-label]','[data-scale-range]','[data-scale-status]','[data-scale-position-area]','[data-scale-positions]']){
   const field=make();fields.set(name,field);if(name.startsWith('#')){field.id=name.slice(1);register(field.id,field);}
  }
 }});
 const positions=[];
 const group=()=>fields.get('[data-scale-positions]');
 const previous=Object.getOwnPropertyDescriptor(node,'innerHTML');
 Object.defineProperty(node,'innerHTML',{configurable:true,get:previous.get,set(html){previous.set.call(this,html);positions.length=0;const g=group();Object.defineProperty(g,'innerHTML',{configurable:true,get(){return this.html||'';},set(value){this.html=value;positions.length=0;for(const m of value.matchAll(/data-scale-position="([^"]+)"/g)){const b=make();b.dataset.scalePosition=m[1];b.countBadge=make();b.querySelector=s=>s==='[data-scale-position-count]'?b.countBadge:null;positions.push(b);}}});g.querySelectorAll=()=>positions;}});
 node.querySelector=s=>fields.get(s);
 node.querySelectorAll=s=>s==='[data-scale-id]'?forms:s==='[data-scale-key]'?keys:[];
 return{forms,keys,fields,positions};
}
function windowFixture(hash){
 const events={},history=[hash];let position=0;
 const win={location:{hash},scrollY:0,scrollTo(){},addEventListener(k,f){(events[k]??=new Set()).add(f);},removeEventListener(k,f){events[k]?.delete(f);},
 history:{pushState(_s,_t,next){history.splice(++position);history.push(next);win.location.hash=next;}}};
 const emit=k=>{for(const f of[...events[k]||[]])f();};
 return{win,events,history,navigate(next){if(next!==win.location.hash){win.history.pushState(null,'',next);emit('hashchange');}},
  go(offset){position=Math.max(0,Math.min(history.length-1,position+offset));win.location.hash=history[position];emit('popstate');emit('hashchange');}};
}
function scaleFixture(config,hash='',progress=null){
 const w=windowFixture(hash),node=element(),dom=installScaleRoot(node),opened=[];
 const text=fs.readFileSync(path.join(root,'js/scalePractice.js'),'utf8').replace(/import\s+[\s\S]*?from\s+"[^"]+";/g,'').replace(/^export /gm,'');
 const init=vm.runInNewContext(text+'\ninitScalePractice;',{createKeyDisclosure,...positionPolicy,window:w.win,...config});
 const controller=init(node,config.SCALE_STAGES,s=>opened.push(s),progress);
 return{...w,...dom,root:node,controller,opened,init};
}
function scaleCategoryFixture(hash=''){
 const w=windowFixture(hash),nodes=new Map();
 const entries=['basic','solo'].map(key=>{const tab=element(),panel=element();panel.id=key+'Panel';panel.dataset.practicePanel=key;tab.dataset.practiceGenre=key;tab.setAttribute('aria-controls',panel.id);return{tab,panel};});
 const sections=['tutorial','basic','chromatic','chords','scales','solo'].map(key=>{
  const s=element(),anchor=(key==='chords'?'chord':key==='scales'?'scale':key)+'Exercises',heading=element();
  s.dataset.exerciseCategory=key;s.setAttribute('aria-labelledby',anchor);heading.id=anchor;s.children.push(heading);nodes.set(anchor,heading);
  for(let i=1;i<=({tutorial:3,basic:10,chromatic:24,chords:8,scales:10,solo:3}[key]);i++){const button=element();button.id=key+'-'+i;s.children.push(button);nodes.set(button.id,button);}
  entries[key==='solo'?1:0].panel.children.push(s);return s;
 });
 const links=sections.map(s=>{const n=element();n.setAttribute('href','#'+s.getAttribute('aria-labelledby'));return n;});
 const node={querySelectorAll(s){return s.includes('role="tab"')?entries.map(e=>e.tab):s.includes('role="tabpanel"')?entries.map(e=>e.panel):s==='[data-exercise-category]'?sections:links;}};
 const init=vm.runInNewContext(fs.readFileSync(path.join(root,'js/practiceGenres.js'),'utf8').replace(/^export /gm,'')+'\ninitPracticeGenres;',{window:w.win,document:{getElementById:id=>nodes.get(id)}});
 return{...w,sections,controller:init(node)};
}
module.exports={installScaleRoot,scaleFixture,scaleCategoryFixture};
