const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),root=path.join(__dirname,'../..');
function node(attrs={},dataset={}){
 return{attrs:{...attrs},dataset,listeners:{},children:[],hidden:false,disabled:false,value:'',innerText:'',
  get id(){return this.attrs.id;},getAttribute(k){return this.attrs[k]??null;},setAttribute(k,v){this.attrs[k]=String(v);},removeAttribute(k){delete this.attrs[k];},
  addEventListener(k,f){(this.listeners[k]??=[]).push(f);},dispatch(k,e={}){for(const f of this.listeners[k]||[])f({target:this,preventDefault(){},...e});},
  contains(t){return this===t||this.children.some(c=>c.contains(t));},focus(){this.focused=true;},scrollIntoView(){this.scrolled=true;}
 };
}
function windowFixture(hash=''){
 const history=[hash],events={};let index=0;
 const win={location:{hash},scrollY:0,addEventListener(k,f){(events[k]??=new Set()).add(f);},removeEventListener(k,f){events[k]?.delete(f);},
  scrollTo({top}){this.scrollY=top;},history:{
   pushState(_s,_t,h){history.splice(++index);history.push(h);win.location.hash=h;},
   replaceState(_s,_t,h){history[index]=h;win.location.hash=h;}
  }};
 const emit=k=>{for(const f of [...events[k]||[]])f();};
 return{win,events,navigate(h){if(win.location.hash!==h){win.history.pushState(null,'',h);emit('hashchange');}},
  go(offset){index=Math.max(0,Math.min(history.length-1,index+offset));win.location.hash=history[index];emit('popstate');emit('hashchange');}};
}
function chordFixture(stages,forms,hash='',progress=null){
 const w=windowFixture(hash),r=node(),fields=new Map(),buttons=[],opened=[];
 Object.defineProperty(r,'innerHTML',{set(html){
  this.html=html;buttons.length=0;fields.clear();
  for(const m of html.matchAll(/id="(chords-\d+)" data-chord-stage-id="(\d+)"/g)){
   const b=node({id:m[1]},{chordStageId:m[2]});b.countBadge=node();b.querySelector=()=>b.countBadge;buttons.push(b);
  }
  for(const s of['#chordSearch','#chordQuality','#chordDetails','#chordStartBtn','[data-chord-empty]','[data-chord-status]','[data-chord-title]','[data-chord-quality]','[data-chord-form]','[data-chord-meta]','[data-chord-diagram]'])fields.set(s,node());
 }});
 r.querySelectorAll=()=>buttons;r.querySelector=s=>fields.get(s);
 const read=f=>fs.readFileSync(path.join(root,'js',f),'utf8').replace(/^export /gm,'').replace(/import\s+[\s\S]*?from\s+"[^"]+";/g,'');
 const init=vm.runInNewContext(read('chordDiagram.js')+'\n'+read('chordPractice.js')+'\ninitChordPractice;',{window:w.win}),controller=init(r,stages,forms,s=>opened.push(s),progress);
 return{...w,root:r,fields,buttons,opened,controller,init,
  search(value){fields.get('#chordSearch').value=value;fields.get('#chordSearch').dispatch('input');},
  quality(value){fields.get('#chordQuality').value=value;fields.get('#chordQuality').dispatch('change');}};
}
function chordCategoryFixture(hash=''){
 const w=windowFixture(hash),nodes=new Map(),entries=['basic','solo'].map(key=>{
  const panel=node({id:key+'Panel'},{practicePanel:key}),tab=node({id:key+'Tab','aria-controls':panel.id},{practiceGenre:key});return{key,panel,tab};
 });
 const sections=['tutorial','basic','chromatic','chords','solo'].map(key=>{
  const anchor=(key==='chords'?'chord':key)+'Exercises',section=node({'aria-labelledby':anchor},{exerciseCategory:key}),heading=node({id:anchor});
  nodes.set(anchor,heading);section.children.push(heading);entries[key==='solo'?1:0].panel.children.push(section);
  for(let id=1;id<=(key==='chords'?8:1);id++){const button=node({id:key+'-'+id});section.children.push(button);nodes.set(button.id,button);}
  return section;
 });
 const links=sections.filter(s=>s.dataset.exerciseCategory!=='solo').map(s=>node({href:'#'+s.getAttribute('aria-labelledby')}));
 const r={querySelectorAll(s){if(s.includes('role="tab"'))return entries.map(e=>e.tab);if(s.includes('role="tabpanel"'))return entries.map(e=>e.panel);return s==='[data-exercise-category]'?sections:links;}};
 const init=vm.runInNewContext(fs.readFileSync(path.join(root,'js/practiceGenres.js'),'utf8').replace(/^export /gm,'')+'\ninitPracticeGenres;',{window:w.win,document:{getElementById:id=>nodes.get(id)}});
 return{...w,sections,links,entries,controller:init(r)};
}
module.exports={chordFixture,chordCategoryFixture};
