// Shared display-only capo placement for alphaTab 1.8.4 build 34. The lab and app use this same implementation.
const NS='http://www.w3.org/2000/svg',owned=new WeakMap();
export const CAPO_LAYOUT=Object.freeze({paddingEm:.18,clearanceEm:.15,stepEm:.25,tolerance:.12});
const name=n=>(n?.localName||n?.tagName||'').toLowerCase();
const children=(n,t)=>[...(n?.children||[])].filter(c=>name(c)===t);
const child=(n,t)=>children(n,t)[0];
const value=(n,t,f=null)=>{const s=child(n,t)?.textContent;return s==null?f:Number(s);};
const near=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<CAPO_LAYOUT.tolerance;
function rootBox(n,b){
    const root=n.ownerSVGElement,ctm=n.getCTM(),reference=root?.getCTM();
    if(!ctm||!reference)throw Error('svg-coordinate-matrix-unavailable');
    const m=reference.inverse().multiply(ctm),points=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]]
        .map(([x,y])=>({x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f}));
    const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));
    const result={x,y,width:Math.max(...points.map(p=>p.x))-x,height:Math.max(...points.map(p=>p.y))-y};
    if(!Object.values(result).every(Number.isFinite))throw Error('svg-coordinate-matrix-invalid');return result;
}
const box=n=>rootBox(n,n.getBBox());
const validBox=b=>b&&Object.values(b).every(Number.isFinite)&&b.width>0&&b.height>0;
const inside=(a,b)=>validBox(a)&&validBox(b)&&a.x>=b.x-.005&&a.y>=b.y-.005&&a.x+a.width<=b.x+b.width+.005&&a.y+a.height<=b.y+b.height+.005;
export const overlap=(a,b,gap=0)=>a.x<b.x+b.width+gap&&a.x+a.width>b.x-gap&&a.y<b.y+b.height+gap&&a.y+a.height>b.y-gap;
export function parseCapoText(text){
    if(typeof text!=='string')return null;
    const m=/^capo\s*([1-9]\d?)$/i.exec(text.trim()),n=m?Number(m[1]):0;
    return n>=1&&n<=24?n:null;
}

// Read source directions, preserving their staff/voice/beat address; never edit XML.
export function analyzeCapoSource(xml,parseXml=x=>new DOMParser().parseFromString(x,'application/xml')){
    const result={status:'absent',candidates:[],diagnostics:[]};
    try{
        if(typeof xml!=='string')throw Error('source-unavailable');
        const doc=parseXml(xml);if(doc.querySelector('parsererror')||name(doc.documentElement)!=='score-partwise')throw Error('source-invalid');
        children(doc.documentElement,'part').forEach((part,partIndex)=>{
            let divisions=1;
            children(part,'measure').forEach((measure,barIndex)=>{
                let cursor=0,previous=null;const lanes=new Map(),pending=[];
                for(const [order,node]of [...measure.children].entries()){
                    const tag=name(node);
                    if(tag==='attributes')divisions=value(node,'divisions',divisions);
                    if(!Number.isFinite(divisions)||divisions<=0)throw Error('source-divisions-invalid');
                    if(tag==='backup'||tag==='forward'){cursor+=(tag==='backup'?-1:1)*value(node,'duration',0)*960/divisions;previous=null;}
                    if(tag==='direction')for(const dt of children(node,'direction-type'))for(const words of children(dt,'words')){
                        const raw=words.textContent.trim(),fret=parseCapoText(raw);if(fret===null)continue;
                        const row={sourceId:`capo-${partIndex}-${barIndex}-${order}-${result.candidates.length}`,partIndex,partId:part.getAttribute('id'),barIndex,order,
                            staff:value(node,'staff'),voice:value(node,'voice'),offset:cursor+value(node,'offset',0)*960/divisions,raw,fret,anchor:null};
                        result.candidates.push(row);pending.push(row);
                    }
                    if(tag!=='note')continue;
                    const staffIndex=value(node,'staff',1)-1,voiceIndex=value(node,'voice',1)-1,key=`${staffIndex}:${voiceIndex}`;
                    if(![staffIndex,voiceIndex].every(n=>Number.isInteger(n)&&n>=0))throw Error('source-lane-invalid');
                    if(!lanes.has(key))lanes.set(key,[]);const lane=lanes.get(key),isChord=!!child(node,'chord');let beat;
                    if(isChord){if(previous?.key!==key)throw Error('source-chord-unverified');beat=lane.at(-1);}
                    else{
                        beat={partIndex,staffIndex,voiceIndex,barIndex,beatIndex:lane.length,offset:cursor,grace:!!child(node,'grace'),rest:!!child(node,'rest'),notes:[]};lane.push(beat);
                        for(const row of pending)if(!row.anchor&&near(row.offset,cursor)&&(row.staff===null||row.staff===staffIndex+1)&&(row.voice===null||row.voice===voiceIndex+1))row.anchor=beat;
                        if(!beat.grace)cursor+=value(node,'duration',0)*960/divisions;
                    }
                    if(!beat.rest){const technical=child(child(node,'notations'),'technical');beat.notes.push({string:value(technical,'string'),fret:value(technical,'fret')});}
                    previous={key};
                }
                for(const row of pending)if(lanes.size>1&&(row.staff===null||row.voice===null))row.ambiguous=true;
            });
        });
        result.status=result.candidates.length?'parsed':'absent';
    }catch(error){result.status='invalid';result.diagnostics.push(error.message);}
    return result;
}
const beatsOf=score=>score.tracks.flatMap(t=>t.staves.flatMap(s=>s.bars.flatMap(b=>b.voices.flatMap(v=>v.beats))));
export function musicSnapshot(score){
    return JSON.stringify(score.tracks.map(t=>t.staves.map(s=>({capo:s.capo,tuning:[...s.tuning],transposition:s.transpositionPitch,
        chords:[...(s.chords?.entries?.()||[])].map(([id,c])=>[id,c.name]),bars:s.bars.map(b=>b.voices.map(v=>v.beats.map(bt=>({id:bt.id,text:bt.text,
            chordId:bt.chordId,start:bt.displayStart,playbackStart:bt.playbackStart,duration:bt.duration,playbackDuration:bt.playbackDuration,grace:bt.graceType,
            notes:bt.notes.map(n=>[n.id,n.string,n.fret,n.octave,n.tone,n.isTieDestination,n.tieOrigin?.id,n.tieDestination?.id,n.slurOrigin?.id,n.slurDestination?.id])}))))}))));
}
export function resolveCapo(source,score,lookup){
    if(source.status==='invalid')return{status:'skipped',reason:'source-invalid'};
    if(!source.candidates.length)return{status:'absent'};
    if(source.candidates.length!==1)return{status:'skipped',reason:'source-capo-not-unique'};
    const row=source.candidates[0],a=row.anchor;
    if(row.ambiguous||!a||row.partIndex!==0||row.barIndex!==0||!near(row.offset,0)||a.beatIndex!==0) return{status:'skipped',reason:'source-anchor-out-of-scope'};
    const staff=score.tracks[a.partIndex]?.staves[a.staffIndex],beat=staff?.bars[a.barIndex]?.voices[a.voiceIndex]?.beats[a.beatIndex];
    if(!beat||staff.capo!==0)return{status:'skipped',reason:'model-or-structured-capo-out-of-scope'};
    const all=beatsOf(score),matches=all.filter(b=>parseCapoText(b.text)!==null);
    if(matches.length!==1||matches[0]!==beat||String(beat.text).trim()!==row.raw||parseCapoText(beat.text)!==row.fret
        ||!near(beat.displayStart,a.offset)||!!beat.graceType!==a.grace||beat.isRest!==a.rest||beat.notes.length!==a.notes.length
        ||a.notes.some((n,i)=>beat.notes[i].string!==staff.tuning.length-n.string+1||beat.notes[i].fret!==n.fret)
        ||all.filter(b=>b.id===beat.id).length!==1)return{status:'skipped',reason:'source-model-anchor-mismatch'};
    const bounds=lookup?.findBeat(beat);
    if(bounds?.beat!==beat||!Number.isFinite(bounds.onNotesX))return{status:'skipped',reason:'beat-bounds-unverified'};
    return{status:'matched',row,staff,beat,bounds,label:`Capo ${row.fret}`};
}
export function chooseCapoPlacement({labelBox,area,obstacles=[],fontSize,mode}){
    if(!validBox(labelBox)||!validBox(area)||!Number.isFinite(fontSize)||fontSize<=0)return{moved:false,reason:'placement-input-invalid'};
    const nominal={...labelBox,x:area.x,y:Math.max(labelBox.y,area.y)},step=fontSize*CAPO_LAYOUT.stepEm,gap=fontSize*CAPO_LAYOUT.clearanceEm;
    if(!inside(nominal,area))return{moved:false,reason:'insufficient-header-space'};
    if(mode==='B')return{moved:true,box:nominal,collisions:obstacles.filter(b=>overlap(nominal,b,gap)).length};
    if(mode!=='C')throw Error('invalid-placement-mode');
    const xs=[nominal.x],ys=[nominal.y];
    for(let x=nominal.x+step;x+nominal.width<=area.x+area.width;x+=step)xs.push(x);
    for(let y=nominal.y+step;y+nominal.height<=area.y+area.height;y+=step)ys.push(y);
    for(const y of ys)for(const x of xs){const candidate={...nominal,x,y};if(!obstacles.some(o=>overlap(candidate,o,gap)))return{moved:true,box:candidate,collisions:0,adjusted:x!==nominal.x||y!==nominal.y};}
    return{moved:false,reason:'no-collision-free-position'};
}
const geometry=svg=>[...svg.querySelectorAll('text,path,rect,line,polyline,polygon,use')].filter(n=>!n.closest('defs,clipPath,[data-capo-measure]'));
function untransformed(node,svg){for(let n=node;n&&n!==svg;n=n.parentElement)if(n.hasAttribute('transform'))throw Error('transformed-svg-out-of-scope');}
function firstStaffTop(api,p,resolved,fontSize){
    const count=resolved.staff.tuning.length,rows=[];
    for(const n of geometry(p.svg).filter(n=>name(n)==='rect')){
        const b=box(n);if(b.width<fontSize*1.5||b.height<=0||b.height>fontSize*.2)continue;
        const y=b.y+b.height/2;if(!rows.some(v=>near(v,y)))rows.push(y);
    }
    rows.sort((a,b)=>a-b);
    const references=resolved.staff.bars[0].voices.flatMap(v=>v.beats.flatMap(bt=>bt.notes)).map(note=>{
        const list=api.renderer.boundsLookup.findBeat(note.beat)?.notes?.filter(b=>b.note===note);
        const b=list?.length===1?list[0].noteHeadBounds:null;
        return b&&[b.x,b.y,b.w,b.h].every(Number.isFinite)?{string:note.string,y:b.y+b.h/2-p.y}:null;
    }).filter(Boolean);
    if(!references.length)throw Error('staff-note-bounds-unavailable');
    const groups=[];
    for(const top of rows)for(const second of rows.filter(y=>y>top)){
        const gap=second-top;if(gap<fontSize*.4)continue;
        const ys=Array.from({length:count},(_,i)=>top+i*gap);
        if(ys.every(y=>rows.some(r=>near(r,y)))&&references.every(n=>near(n.y,ys[count-n.string])))groups.push(ys);
    }
    if(groups.length!==1)throw Error('staff-lines-not-unique');return groups[0][0];
}
function currentNativeText(p,resolved){
    const x=resolved.bounds.onNotesX-p.x;
    const matches=[...p.svg.querySelectorAll('text')].filter(n=>n.textContent.trim()===resolved.row.raw&&n.childElementCount===0
        &&near(Number(n.getAttribute('x')),x)&&(n.getAttribute('text-anchor')||'start')==='start');
    if(matches.length!==1)throw Error('native-capo-text-not-unique');untransformed(matches[0],p.svg);return matches[0];
}
function cardMapping(cards,p,target){
    if(!cards)return{first:null,others:[]};const result={first:null,others:[]},attrs=[...target.attributes].map(a=>[a.name,a.value]);
    for(const card of cards.querySelectorAll('.vertical-tab-card')){
        const bar=Number(card.dataset.barIndex),svg=card.querySelector('svg');
        const matches=[...svg.querySelectorAll('text')].filter(n=>n.textContent===target.textContent&&attrs.every(([k,v])=>n.getAttribute(k)===v));
        const expected=bar>=p.firstBarIndex&&bar<=p.lastBarIndex;
        if(matches.length!==(expected?1:0))throw Error('card-capo-copy-not-unique');
        if(!expected)continue;const node=matches[0];untransformed(node,svg);
        if(bar===0){
            const vb=svg.getAttribute('viewBox')?.trim().split(/\s+/).map(Number),clips=[...svg.querySelectorAll('clipPath rect')];
            if(vb?.length!==4||!vb.every(Number.isFinite)||clips.length!==1||!['x','y','width','height'].every((k,i)=>near(Number(clips[0].getAttribute(k)),vb[i])))throw Error('card-crop-unverified');
            result.first={svg,node,box:{x:vb[0],y:vb[1],width:vb[2],height:vb[3]}};
        }else result.others.push({svg,node});
    }
    if(!result.first)throw Error('first-card-unavailable');return result;
}
function journal(svg){if(!owned.has(svg))owned.set(svg,[]);return owned.get(svg);}
export function clearCapoPosition(svg){const changes=owned.get(svg);if(!changes)return;for(const undo of changes.reverse())undo();owned.delete(svg);}
function move(svg,node,label,dx,dy,key){
    const before={text:node.textContent,x:node.getAttribute('x'),y:node.getAttribute('y'),mark:node.getAttribute('data-capo-position')};
    journal(svg).push(()=>{node.textContent=before.text;for(const[k,v]of [['x',before.x],['y',before.y],['data-capo-position',before.mark]])v===null?node.removeAttribute(k):node.setAttribute(k,v);});
    node.textContent=label;node.setAttribute('x',String(Number(before.x)+dx));node.setAttribute('y',String(Number(before.y)+dy));node.setAttribute('data-capo-position',key);
}
export function alphabeticInkBox(metrics,{x=0,y=0,anchor='start',advance=metrics.width}={}){
    const keys=['width','actualBoundingBoxLeft','actualBoundingBoxRight','actualBoundingBoxAscent','actualBoundingBoxDescent'];
    if(!keys.every(k=>Number.isFinite(metrics[k]))||metrics.width<=0||!Number.isFinite(advance)||Math.abs(advance-metrics.width)>.15||!['start','middle','end'].includes(anchor))throw Error('music-ink-metrics-unverified');
    const shift=anchor==='middle'?-advance/2:anchor==='end'?-advance:0;
    return{x:x+shift-metrics.actualBoundingBoxLeft,y:y-metrics.actualBoundingBoxAscent,
        width:metrics.actualBoundingBoxLeft+metrics.actualBoundingBoxRight,height:metrics.actualBoundingBoxAscent+metrics.actualBoundingBoxDescent};
}
function obstacleBox(n){
    const raw=box(n);
    // SMuFL's full font-em bbox can span far beyond the painted clef/time glyph.
    // Refine only a simple alphabetic music glyph with verified SVG advance and real ink metrics.
    if(name(n)!=='text'||![...n.textContent].some(c=>c.codePointAt(0)>=0xe000&&c.codePointAt(0)<=0xf8ff))return raw;
    try{
        const style=getComputedStyle(n);
        if(n.childElementCount||['dx','dy','rotate','textLength'].some(k=>n.hasAttribute(k))||!['auto','alphabetic'].includes(style.dominantBaseline)
            ||style.writingMode!=='horizontal-tb'||style.direction!=='ltr'||!/alphaTab|Bravura/i.test(style.fontFamily))return raw;
        const relative=n.ownerSVGElement.getCTM().inverse().multiply(n.getCTM());
        if(Math.abs(relative.a-1)>1e-7||Math.abs(relative.d-1)>1e-7||Math.abs(relative.b)>1e-7||Math.abs(relative.c)>1e-7)return raw;
        const ctx=document.createElement('canvas').getContext('2d');ctx.font=style.font;ctx.textBaseline='alphabetic';ctx.textAlign='left';const m=ctx.measureText(n.textContent);
        if(Math.abs(m.width-n.getComputedTextLength())>.15)return raw;
        const local=alphabeticInkBox(m,{x:Number(n.getAttribute('x')||0),y:Number(n.getAttribute('y')||0),anchor:n.getAttribute('text-anchor')||'start',advance:n.getComputedTextLength()}),ink=rootBox(n,local);
        const screen=n.ownerSVGElement.getScreenCTM(),pixel=screen&&Math.abs(screen.a)>0?2/Math.abs(screen.a):NaN;
        if(!Number.isFinite(pixel)||pixel<=0||pixel>4)return raw;
        const expand=b=>({x:b.x-pixel,y:b.y-pixel,width:b.width+2*pixel,height:b.height+2*pixel});
        // Canvas and SVG ink metrics round independently in CSS pixels. Account for both
        // edges, then ADD that uncertainty to the obstacle. Unsupported transforms use raw bbox.
        return inside(ink,expand(raw))?expand(ink):raw;
    }catch{return raw;}
}
function obstacles(svg,except){return geometry(svg).filter(n=>n!==except).map(obstacleBox).filter(validBox);}
export function applyCapoPosition(api,partials,source,{mode='A',cards=null,expectedScore=api.score}={}){
    if(!['A','B','C'].includes(mode))throw Error('invalid-mode');
    const svgs=[...partials.map(p=>p.svg),...(cards?[...cards.querySelectorAll('.vertical-tab-card svg')]:[])];
    for(const svg of svgs)clearCapoPosition(svg);
    if(api.score!==expectedScore)return{mode,moved:false,reason:'stale-score'};
    const signature=musicSnapshot(api.score),resolved=resolveCapo(source,api.score,api.renderer.boundsLookup);
    const report={mode,moved:false,sourceCandidates:source.candidates.length,status:resolved.status,reason:resolved.reason};
    if(resolved.status!=='matched'||mode==='A')return report;
    try{
        const found=partials.filter(p=>p.firstBarIndex===0&&p.lastBarIndex>=0);if(found.length!==1)throw Error('first-partial-not-unique');
        const p=found[0];if(!p.svg.isConnected||![p.x,p.y].every(Number.isFinite))throw Error('partial-not-current');
        const target=currentNativeText(p,resolved),before=box(target),fontSize=parseFloat(getComputedStyle(target).fontSize),mapped=cardMapping(cards,p,target);
        const copy=target.cloneNode(true);copy.removeAttribute('id');copy.setAttribute('data-capo-measure','');copy.setAttribute('visibility','hidden');copy.textContent=resolved.label;p.svg.append(copy);
        let measured;try{measured=box(copy);}finally{copy.remove();}
        const master=api.renderer.boundsLookup.findMasterBarByIndex(0)?.realBounds;if(!master||![master.x,master.w].every(Number.isFinite))throw Error('master-bar-bounds-unverified');
        const svgBox={x:0,y:0,width:parseFloat(p.svg.getAttribute('width')),height:parseFloat(p.svg.getAttribute('height'))};
        const pad=fontSize*CAPO_LAYOUT.paddingEm,top=firstStaffTop(api,p,resolved,fontSize),crop=mapped.first?.box||svgBox;
        const left=Math.max(master.x-p.x,crop.x,svgBox.x)+pad,right=Math.min(resolved.bounds.onNotesX-p.x,master.x+master.w-p.x,crop.x+crop.width,svgBox.width)-pad;
        const area={x:left,y:Math.max(crop.y,svgBox.y)+pad,width:right-left,height:Math.min(top-pad,crop.y+crop.height,svgBox.height)-(Math.max(crop.y,svgBox.y)+pad)};
        const obs=obstacles(p.svg,target),cardObs=mapped.first?obstacles(mapped.first.svg,mapped.first.node):[],
            placement=chooseCapoPlacement({labelBox:measured,area,obstacles:[...obs,...cardObs],fontSize,mode});
        Object.assign(report,{sourceId:resolved.row.sourceId,beatId:resolved.beat.id,noteIds:resolved.beat.notes.map(n=>n.id),partIndex:resolved.row.partIndex,staffIndex:resolved.row.anchor.staffIndex,
            label:resolved.label,before,measured,area,staffTop:top,fontSize,placement,partialIndex:p.partialIndex});
        report.obstacleMeasurement='SVG bbox + advance-verified SMuFL painted-ink bounds; root-coordinate matrices';
        report.nearbyElements=geometry(p.svg).filter(n=>n!==target&&overlap({x:area.x,y:Math.max(measured.y,area.y),width:measured.width,height:measured.height},obstacleBox(n),fontSize*CAPO_LAYOUT.clearanceEm))
            .map(n=>({tag:name(n),box:obstacleBox(n),element:n.outerHTML.slice(0,250)}));
        if(!placement.moved){report.reason=placement.reason;return report;}
        const dx=placement.box.x-measured.x,dy=placement.box.y-measured.y;
        move(p.svg,target,resolved.label,dx,dy,resolved.row.sourceId);
        if(mapped.first)move(mapped.first.svg,mapped.first.node,resolved.label,dx,dy,resolved.row.sourceId);
        for(const {svg,node}of mapped.others){const placeholder=document.createComment('capo label only on first bar');node.replaceWith(placeholder);journal(svg).push(()=>placeholder.replaceWith(node));}
        const after=box(target),gap=fontSize*CAPO_LAYOUT.clearanceEm;
        report.after=after;
        if(!inside(after,area)||!inside(after,svgBox)||(mode==='C'&&obs.some(o=>overlap(after,o,gap))))throw Error('source-placement-validation-failed');
        if(mapped.first){const b=box(mapped.first.node);report.cardAfter=b;report.cardCollisions=geometry(mapped.first.svg).filter(n=>n!==mapped.first.node&&overlap(b,obstacleBox(n),gap)).map(n=>({tag:name(n),box:obstacleBox(n),element:n.outerHTML.slice(0,200),font:name(n)==='text'?getComputedStyle(n).font:null}));
            if(!inside(b,mapped.first.box)||(mode==='C'&&report.cardCollisions.length))throw Error('card-placement-validation-failed');}
        if(musicSnapshot(api.score)!==signature)throw Error('music-model-changed');
        Object.assign(report,{status:'moved',moved:true,after,dx,dy,otherCardCopiesRemoved:mapped.others.length,card:mapped.first?'inside-original-crop':'not-tested'});
    }catch(error){for(const svg of svgs)clearCapoPosition(svg);report.status='skipped';report.moved=false;report.reason=error.message;}
    return report;
}

// App lifecycle adapter. No DOM work runs for scores without a capo word and
// no timer/RAF/audio work is added. A skipped display correction never blocks ready.
export function createCapoPositionNotation({analyzeSource=analyzeCapoSource,apply=applyCapoPosition}={}){
    let state=null,serial=0;
    const owns=token=>!!token&&state?.token===token;
    const restoreState=current=>{
        for(const svg of current?.svgs||[])try{clearCapoPosition(svg);}catch{/* An obsolete/disconnected SVG cannot block the next score. */}
        current?.svgs.clear();
    };
    const clear=()=>{const previous=state;state=null;restoreState(previous);};
    return{
        begin({generation,stage,api}){
            clear();const token=Object.freeze({id:++serial,generation,stage,api});
            state={token,source:{status:'absent',candidates:[],diagnostics:[]},score:null,svgs:new Set(),result:null};return token;
        },
        tokenFor({generation,stage,api}){
            const token=state?.token;return token&&token.generation===generation&&token.stage===stage&&token.api===api?token:null;
        },
        capture(token,xml){
            if(!owns(token))return false;
            try{state.source=typeof xml==='string'&&/capo/i.test(xml)?analyzeSource(xml):{status:'absent',candidates:[],diagnostics:[]};}
            catch{state.source={status:'invalid',candidates:[],diagnostics:['source-analysis-failed']};}
            return true;
        },
        bindModel(token,score){if(!owns(token))return false;state.score=score;return true;},
        restore(token,api){if(!owns(token)||token.api!==api)return false;restoreState(state);return true;},
        annotate(token,api,partials,cards=null){
            if(!owns(token)||token.api!==api||state.score!==api.score)return false;
            const current=state;restoreState(current);
            if(!current.source.candidates?.length){current.result={moved:false,status:current.source.status==='invalid'?'skipped':'absent'};return true;}
            try{
                current.svgs=new Set([...partials.map(p=>p.svg),...(cards?[...cards.querySelectorAll('.vertical-tab-card svg')]:[])]);
                current.result=apply(api,partials,current.source,{mode:'C',cards,expectedScore:current.score});
                if(!owns(token)){restoreState(current);return false;}
            }catch(error){restoreState(current);current.result={moved:false,status:'skipped',reason:String(error?.message||'capo-position-failed')};}
            return true;
        },
        snapshot(){return state?{generation:state.token.generation,source:JSON.parse(JSON.stringify(state.source)),result:state.result?JSON.parse(JSON.stringify(state.result)):null}:null;},
        clear
    };
}
