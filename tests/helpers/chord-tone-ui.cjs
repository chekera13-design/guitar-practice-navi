const positionPolicy=require('./key-disclosure.cjs');
const {createKeyDisclosure}=require('./key-disclosure.cjs');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),root=path.join(__dirname,'../..');
function element(){return{dataset:{},attrs:{},listeners:{},children:[],hidden:false,disabled:false,innerText:'',
 setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k]??null;},removeAttribute(k){delete this.attrs[k];},
 removeEventListener(k,f){this.listeners[k]=(this.listeners[k]||[]).filter(fn=>fn!==f);}, addEventListener(k,f){(this.listeners[k]??=[]).push(f);},dispatch(k,event={}){for(const f of this.listeners[k]||[])f({target:this,preventDefault(){},...event});},
 focus(){this.focused=true;},contains(n){return this===n||this.children.some(c=>c.contains(n));},scrollIntoView(){}};}
function installChordToneRoot(node,make=element,register=()=>{}){
 const forms=[],keys=[],fields=new Map();
 Object.defineProperty(node,'innerHTML',{configurable:true,get(){return this.html||'';},set(html){
  this.html=html;forms.length=0;keys.length=0;fields.clear();
  for(const m of html.matchAll(/id="(chord-tones-\d+)" data-chord-tone-id="(\d+)"/g)){const b=make();b.id=m[1];b.dataset.chordToneId=m[2];b.total=make();b.practiced=make();b.querySelector=s=>s==='[data-chord-tone-total]'?b.total:s==='[data-chord-tone-practiced]'?b.practiced:null;forms.push(b);register(b.id,b);}
  for(const m of html.matchAll(/data-chord-tone-root="([^"]+)"/g)){const b=make();b.dataset.chordToneRoot=m[1];b.countBadge=make();b.nameNode=make();b.querySelector=s=>s==='[data-chord-tone-count]'?b.countBadge:s==='[data-chord-tone-name]'?b.nameNode:null;keys.push(b);}
  for(const name of ['#chordToneKeyToggle','#chordToneKeyPanel','[data-chord-tone-selected-count]','#chordToneStartBtn','#chordToneDetails','[data-chord-tone-title]','[data-chord-tone-form-label]','[data-chord-tone-description]','[data-chord-tone-meta]','[data-chord-tone-root-label]','[data-chord-tone-range]','[data-chord-tone-status]','[data-chord-tone-position-area]','[data-chord-tone-positions]']){
   const field=make();fields.set(name,field);if(name.startsWith('#')){field.id=name.slice(1);register(field.id,field);}
  }
 }});
 const positions=[];
 const previous=Object.getOwnPropertyDescriptor(node,'innerHTML');
 Object.defineProperty(node,'innerHTML',{configurable:true,get:previous.get,set(html){previous.set.call(this,html);positions.length=0;const g=fields.get('[data-chord-tone-positions]');Object.defineProperty(g,'innerHTML',{configurable:true,get(){return this.html||'';},set(value){this.html=value;positions.length=0;for(const m of value.matchAll(/data-chord-tone-position="([^"]+)"/g)){const b=make();b.dataset.chordTonePosition=m[1];b.countBadge=make();b.querySelector=s=>s==='[data-chord-tone-position-count]'?b.countBadge:null;positions.push(b);}}});g.querySelectorAll=()=>positions;}});
 node.querySelector=s=>fields.get(s);
 node.querySelectorAll=s=>s==='[data-chord-tone-id]'?forms:s==='[data-chord-tone-root]'?keys:[];
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
function chordToneFixture(config,hash='',progress=null){
 const w=windowFixture(hash),node=element(),dom=installChordToneRoot(node),opened=[];
 const text=fs.readFileSync(path.join(root,'js/chordTonePractice.js'),'utf8').replace(/import\s+[\s\S]*?from\s+"[^"]+";/g,'').replace(/^export /gm,'');
 const init=vm.runInNewContext(text+'\ninitChordTonePractice;',{createKeyDisclosure,...positionPolicy,window:w.win,...config});
 const controller=init(node,config.CHORD_TONE_STAGES,s=>opened.push(s),progress);
 return{...w,...dom,root:node,controller,opened,init};
}

module.exports={installChordToneRoot,chordToneFixture};
