const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../..');
function node(attrs={},dataset={}){
 return {attrs:{...attrs},dataset,hidden:false,listeners:{},children:[],innerText:'',tabIndex:0,
  get id(){return this.attrs.id;},getAttribute(k){return this.attrs[k]??null;},setAttribute(k,v){this.attrs[k]=String(v);},
  removeAttribute(k){delete this.attrs[k];},addEventListener(k,f){(this.listeners[k]??=[]).push(f);},
  dispatch(k,e={}){for(const f of this.listeners[k]||[])f({target:this,preventDefault(){},...e});},
  contains(t){return this===t||this.children.some(c=>c.contains(t));},focus(){this.focused=true;},
  scrollIntoView(){this.scrolled=true;}
 };
}
function windowFixture(hash=''){
 const events={},history=[hash];let index=0;
 const win={location:{hash},scrollY:0,addEventListener(k,f){(events[k]??=new Set()).add(f);},
  removeEventListener(k,f){events[k]?.delete(f);},scrollTo({top}){this.scrollY=top;},
  history:{pushState(_s,_t,h){history.splice(++index);history.push(h);win.location.hash=h;}}};
 const emit=k=>{for(const f of [...events[k]||[]])f();};
 const navigate=h=>{if(win.location.hash!==h){win.history.pushState(null,'',h);emit('hashchange');}};
 const go=offset=>{index=Math.max(0,Math.min(history.length-1,index+offset));win.location.hash=history[index];emit('popstate');emit('hashchange');};
 return{win,events,navigate,go};
}
function load(name,fn,globals){return vm.runInNewContext(fs.readFileSync(path.join(root,'js',name),'utf8').replace(/^export /gm,'')+'\n'+fn,globals);}
function pickerFixture(stages,hash='',progress=null){
 const w=windowFixture(hash),r=node(),opened=[],fields=new Map(),buttons=[];
 Object.defineProperty(r,'innerHTML',{set(html){
  this.html=html;buttons.length=0;fields.clear();
  for(const m of html.matchAll(/id="(chromatic-\d+)" data-chromatic-id="(\d+)"/g)){
   const b=node({id:m[1]},{chromaticId:m[2]});b.countBadge=node();b.querySelector=()=>b.countBadge;buttons.push(b);
  }
  for(const s of['#chromaticStartBtn','[data-chromatic-title]','[data-chromatic-meta]','[data-chromatic-frets]','[data-chromatic-status]'])fields.set(s,node());
 }});
 r.querySelectorAll=()=>buttons;r.querySelector=s=>fields.get(s);
 const init=load('chromaticPatternPicker.js','initChromaticPatternPicker;',{window:w.win}),controller=init(r,stages,s=>opened.push(s),progress);
 return{...w,root:r,fields,buttons,opened,controller,init};
}
function categoryFixture(hash=''){
 const w=windowFixture(hash),nodes=new Map();
 const entries=['basic','solo'].map(key=>{
  const panel=node({id:key+'Panel'},{practicePanel:key});
  const tab=node({'aria-controls':panel.id,id:key+'Tab'},{practiceGenre:key});return{key,panel,tab};
 });
 const sections=['tutorial','basic','chromatic','solo'].map(key=>{
  const anchor=key+'Exercises',section=node({'aria-labelledby':anchor},{exerciseCategory:key}),heading=node({id:anchor});
  section.children.push(heading);nodes.set(anchor,heading);entries[key==='solo'?1:0].panel.children.push(section);
  const ids=key==='chromatic'?Array.from({length:24},(_,i)=>i+1):[1];
  for(const id of ids){const n=node({id:key+'-'+id});section.children.push(n);nodes.set(n.id,n);}
  return section;
 });
 const links=sections.slice(0,3).map(s=>node({href:'#'+s.getAttribute('aria-labelledby')}));
 const r={querySelectorAll(s){if(s.includes('role="tab"'))return entries.map(e=>e.tab);if(s.includes('role="tabpanel"'))return entries.map(e=>e.panel);if(s==='[data-exercise-category]')return sections;return links;}};
 const init=load('practiceGenres.js','initPracticeGenres;',{window:w.win,document:{getElementById:id=>nodes.get(id)}}),controller=init(r);
 return{...w,entries,sections,links,nodes,controller};
}
module.exports={pickerFixture,categoryFixture};
