// Independent SVG experiment for alphaTab 1.8.4 build 34. Never changes the score.
const NS = 'http://www.w3.org/2000/svg';
export const TIED_FRET = Object.freeze({ tolerance: .08, padding: .65, curveGap: 1, clearance: .3, flatness: .01 });
const journals = new WeakMap();
const near = (a, b) => Math.abs(a - b) <= TIED_FRET.tolerance;
const tag = n => n.localName?.toLowerCase();
const finiteBox = b => b && [b.x,b.y,b.w,b.h].every(Number.isFinite);
const rect = n => { const b=n.getBBox(); return {x:b.x,y:b.y,width:b.width,height:b.height}; };
const expand = (b,p) => ({x:b.x-p,y:b.y-p,width:b.width+2*p,height:b.height+2*p});
export const overlaps = (a,b) => a.x < b.x+b.width && a.x+a.width > b.x && a.y < b.y+b.height && a.y+a.height > b.y;
const inside = (a,b) => a.x >= b.x && a.y >= b.y && a.x+a.width <= b.x+b.width && a.y+a.height <= b.y+b.height;
const el = (name,attrs) => { const n=document.createElementNS(NS,name); for(const [k,v] of Object.entries(attrs)) n.setAttribute(k,String(v)); return n; };
const bounds = (lookup,n) => {
    const found=lookup?.findBeat(n.beat)?.notes?.filter(b=>b.note===n && b.note.id===n.id);
    if(found?.length!==1 || !finiteBox(found[0].noteHeadBounds)) throw Error('note-bounds-ambiguous');
    return found[0].noteHeadBounds;
};
export function allNotes(score) {
    return score.tracks.flatMap(t=>t.staves.flatMap(s=>s.bars.flatMap(b=>b.voices.flatMap(v=>v.beats.flatMap(b=>b.notes)))));
}
export function modelSignature(score) {
    return JSON.stringify(allNotes(score).map(n=>[n.id,n.beat.id,n.beat.voice.bar.index,n.beat.voice.index,n.beat.index,
        n.string,n.fret,n.beat.displayStart,n.beat.playbackStart,n.beat.playbackDuration,n.isTieDestination,n.tieOrigin?.id,n.tieDestination?.id]));
}
export function collectTieTargets(score, lookup) {
    const notes=allNotes(score), ids=new Set(), rows=[], targets=[];
    for(const n of notes) { if(ids.has(n.id)) throw Error('duplicate-note-id'); ids.add(n.id); }
    for(const note of notes.filter(n=>n.isTieDestination)) {
        const origin=note.tieOrigin, row={noteId:note.id,beatId:note.beat.id,barIndex:note.beat.voice.bar.index,
            voiceIndex:note.beat.voice.index,beatIndex:note.beat.index,fret:note.fret,originNoteId:origin?.id,rendered:false}; rows.push(row);
        try {
            if(!origin || origin.tieDestination!==note || !notes.includes(origin) || origin.string!==note.string || origin.fret!==note.fret
                || origin.beat.voice.bar.staff!==note.beat.voice.bar.staff || origin.beat.voice.index!==note.beat.voice.index) throw Error('tie-links-unverified');
            const b=bounds(lookup,note); row.bounds={x:b.x,y:b.y,w:b.w,h:b.h};
            if(b.w>0 && b.h>0) {row.nativeNumber=true; continue;}
            if(b.w!==0 || b.h!==0) throw Error('empty-number-unverified');
            if(note.beat.graceType || origin.beat.graceType || note.isGhost || note.isDead || note.hasBend || origin.hasBend
                || note.harmonicType || note.beat.hasWhammyBar || !note.isVisible || note.beat.voice.bar.staff.transpositionPitch
                || note.beat.voice.bar!==origin.beat.voice.bar || origin.beat.index>=note.beat.index || note.tieDestination || note.slurOrigin || note.slurDestination
                || note.isEffectSlurDestination || note.isEffectSlurOrigin) throw Error('special-or-out-of-scope-note');
            if(!Number.isInteger(note.fret) || note.fret<0) throw Error('fret-unverified');
            targets.push({note,origin,row});
        } catch(error) {row.reason=error.message;}
    }
    return {rows,targets};
}
export function parseTieLens(d) {
    if(!/^\s*M[^A-Za-z]*C[^A-Za-z]*C[^A-Za-z]*z\s*$/i.test(d||'')) return null;
    const p=d.match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi)?.map(Number);
    return p?.length===14 && p.every(Number.isFinite) && near(p[0],p[12]) && near(p[1],p[13]) ? p : null;
}
export const lensPath = p => `M${p[0]},${p[1]} C${p.slice(2,8).join(',')} C${p.slice(8).join(',')} z`;
export function moveTieEnd(p,y) {
    const q=p.slice(), delta=y-p[7];
    // Keep the origin and taper, smoothly shift the two cubic edges toward the new endpoint.
    for(const [i,weight] of [[3,1/3],[5,2/3],[7,1],[9,2/3],[11,1/3]]) q[i]+=delta*weight;
    return q;
}
const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
export function flattenLens(p) {
    const out=[[p[0],p[1]]];
    const split=(c,depth=0)=>{
        const [a,b,d,e]=c, len=Math.hypot(e[0]-a[0],e[1]-a[1]);
        const distance=q=>len?Math.abs((q[0]-a[0])*(e[1]-a[1])-(q[1]-a[1])*(e[0]-a[0]))/len:Math.hypot(q[0]-a[0],q[1]-a[1]);
        if(depth>=16 || Math.max(distance(b),distance(d))<TIED_FRET.flatness) {out.push(e);return;}
        const ab=mid(a,b),bc=mid(b,d),cd=mid(d,e),abc=mid(ab,bc),bcd=mid(bc,cd),m=mid(abc,bcd);
        split([a,ab,abc,m],depth+1);split([m,bcd,cd,e],depth+1);
    };
    split([[p[0],p[1]],[p[2],p[3]],[p[4],p[5]],[p[6],p[7]]]);
    split([[p[6],p[7]],[p[8],p[9]],[p[10],p[11]],[p[12],p[13]]]); return out;
}
const segmentDistance=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
const crosses=(a,b,c,d)=>{const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);return cross(a,b,c)*cross(a,b,d)<0 && cross(c,d,a)*cross(c,d,b)<0;};
const pointInside=(p,polygon)=>{let yes=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>p[1])!==(b[1]>p[1]) && p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
export function polygonDistance(a,b) {
    if(pointInside(a[0],b)||pointInside(b[0],a))return 0;let distance=Infinity;
    for(let i=1;i<a.length;i++)for(let j=1;j<b.length;j++) {
        const [p,q,r,s]=[a[i-1],a[i],b[j-1],b[j]]; if(crosses(p,q,r,s))return 0;
        distance=Math.min(distance,segmentDistance(p,r,s),segmentDistance(q,r,s),segmentDistance(r,p,q),segmentDistance(s,p,q));
    }return distance;
}
const boxPoly=b=>[[b.x,b.y],[b.x+b.width,b.y],[b.x+b.width,b.y+b.height],[b.x,b.y+b.height],[b.x,b.y]];
export const lensHitsBox=(p,b,gap=0)=>polygonDistance(flattenLens(p),boxPoly(b))<=gap+2*TIED_FRET.flatness;
export function splitLine(b,hole,axis='x') {
    const start=axis==='x'?b.x:b.y,length=axis==='x'?b.width:b.height,lo=axis==='x'?hole.x:hole.y,hi=lo+(axis==='x'?hole.width:hole.height);
    return [[start,Math.min(lo,start+length)],[Math.max(hi,start),start+length]].filter(([a,c])=>c-a>.02).map(([a,c])=>axis==='x'?{...b,x:a,width:c-a}:{...b,y:a,height:c-a});
}
function noTransform(n,svg) {for(let p=n;p&&p!==svg;p=p.parentElement)if(p.hasAttribute('transform'))throw Error('transformed-svg-out-of-scope');}
function geometryNodes(svg) {return [...svg.querySelectorAll('text,path,rect,line,polyline,polygon,use')].filter(n=>!n.closest('defs,clipPath,[data-tied-fret]'));}
function lineShape(n,scale) {const b=rect(n);return tag(n)==='rect' && b.height>0 && b.height<=2*scale && b.width>8*scale;}
function nativePair(api,p,c) {
    const a=bounds(api.renderer.boundsLookup,c.origin), b=bounds(api.renderer.boundsLookup,c.note),direction=c.origin.string>3?-1:1;
    const x1=a.x+a.w/2-p.x,y1=a.y+(direction<0?0:a.h)-p.y,x2=b.x-p.x,y2=b.y-p.y;
    const matches=geometryNodes(p.svg).filter(n=>tag(n)==='path').map(node=>({node,points:parseTieLens(node.getAttribute('d'))}))
        .filter(q=>q.points && near(q.points[0],x1)&&near(q.points[1],y1)&&near(q.points[6],x2)&&near(q.points[7],y2));
    if(matches.length!==1)throw Error('native-tie-path-not-unique');
    noTransform(matches[0].node,p.svg);
    const points=matches[0].points;
    if(x2<=x1 || (points[3]-y1)*direction<=0)throw Error('native-tie-direction-unverified');
    return {...matches[0],direction,originBounds:a};
}
function makeText(api,p,c) {
    const b=bounds(api.renderer.boundsLookup,c.note),scale=api.settings.display.scale;
    const text=el('text',{x:b.x-p.x,y:b.y-p.y,'text-anchor':'middle',fill:api.settings.display.resources.mainGlyphColor.rgba,
        style:`stroke:none;font:${api.settings.display.resources.tablatureFont.toCssString(scale)};dominant-baseline:middle;`});
    text.textContent=`(${c.note.fret})`;text.setAttribute('visibility','hidden');p.svg.append(text);
    let box;try{box=rect(text);}finally{text.remove();text.removeAttribute('visibility');}
    if(![...Object.values(box)].every(Number.isFinite)||box.width<=0||box.height<=0)throw Error('text-measurement-unavailable');
    return {text,box,x:b.x-p.x,y:b.y-p.y};
}
function findClone(svg,n) {
    const attrs=[...n.attributes].map(a=>[a.name,a.value]);
    const matches=geometryNodes(svg).filter(q=>tag(q)===tag(n)&&attrs.every(([k,v])=>q.getAttribute(k)===v));
    if(matches.length!==1)throw Error('card-native-element-not-unique');return matches[0];
}
function cardFor(cards,bar) {
    if(!cards)return null;
    const found=[...cards.querySelectorAll('.vertical-tab-card')].filter(n=>Number(n.dataset.barIndex)===bar);
    if(found.length!==1)throw Error('card-not-unique'); const svg=found[0].querySelector('svg');
    const a=svg?.getAttribute('viewBox')?.trim().split(/\s+/).map(Number),clips=[...svg.querySelectorAll('clipPath rect')];
    if(a?.length!==4 || !a.every(Number.isFinite)||clips.length!==1)throw Error('card-crop-unverified');
    if(!['x','y','width','height'].every((k,i)=>near(Number(clips[0].getAttribute(k)),a[i])))throw Error('card-clip-mismatch');
    const groups=[...svg.querySelectorAll('g[clip-path]')];if(groups.length!==1)throw Error('card-clip-group-unverified');
    return {svg,parent:groups[0],box:{x:a[0],y:a[1],width:a[2],height:a[3]}};
}
function plan(api,p,c,mode,card) {
    const scale=api.settings.display.scale, measured=makeText(api,p,c),hole=expand(measured.box,TIED_FRET.padding*scale);
    c.row.measurement={box:measured.box,hole};
    if(card && !inside(hole,card.box))throw Error('outside-original-card-crop');
    const source={x:0,y:0,width:parseFloat(p.svg.getAttribute('width')),height:parseFloat(p.svg.getAttribute('height'))};
    if(!inside(hole,source))throw Error('outside-original-svg');
    const base={...measured,hole,lines:[],mode,c,p,card};if(mode==='B')return base;
    const incoming=nativePair(api,p,c), endY=incoming.direction<0?measured.box.y-TIED_FRET.curveGap*scale:measured.box.y+measured.box.height+TIED_FRET.curveGap*scale;
    const curve=moveTieEnd(incoming.points,endY),guard=TIED_FRET.clearance*scale,poly=flattenLens(curve),curveBox={x:Math.min(...poly.map(v=>v[0])),y:Math.min(...poly.map(v=>v[1]))};
    curveBox.width=Math.max(...poly.map(v=>v[0]))-curveBox.x;curveBox.height=Math.max(...poly.map(v=>v[1]))-curveBox.y;
    if((endY-incoming.points[7])*incoming.direction<0 || lensHitsBox(curve,measured.box,guard))throw Error('new-curve-touches-number');
    if(!inside(curveBox,source)||(card&&!inside(curveBox,card.box)))throw Error('curve-outside-original-crop');
    const master=api.renderer.boundsLookup.findMasterBarByIndex(c.row.barIndex)?.realBounds;
    if(!master || hole.x<master.x-p.x || hole.x+hole.width>master.x+master.w-p.x)throw Error('number-outside-model-bar');
    const all=geometryNodes(p.svg),originTexts=all.filter(n=>tag(n)==='text'&&near(Number(n.getAttribute('x')),incoming.originBounds.x-p.x)&&near(Number(n.getAttribute('y')),incoming.originBounds.y+incoming.originBounds.h/2-p.y));
    if(originTexts.length!==1)throw Error('origin-glyph-not-unique');
    for(const n of all) {
        if(n===incoming.node)continue; const b=rect(n);if(b.width<=0||b.height<=0)continue;
        const numberHit=overlaps(hole,b), curveNear=overlaps(expand(curveBox,guard),b);
        if(!numberHit&&!curveNear)continue;noTransform(n,p.svg);
        if(lineShape(n,scale)) {
            if(numberHit) {
                if(!near(b.y+b.height/2,measured.y))throw Error('number-touches-neighbour-string');
                base.lines.push({node:n,segments:splitLine(b,hole),axis:'x'});
            }continue;
        }
        if(n===originTexts[0]&&!numberHit)continue; // Native origin contact is retained; curve moves away from that digit.
        if(numberHit && tag(n)==='rect' && b.width<=2*scale && near(b.x,measured.x) && b.y>=measured.y-.1
            && b.height>10*scale && c.note.beat.notes.length===1) {
            base.lines.push({node:n,segments:splitLine(b,hole,'y'),axis:'y'});continue;
        }
        const lens=tag(n)==='path'?parseTieLens(n.getAttribute('d')):null;
        if(lens) {
            if(numberHit&&lensHitsBox(lens,hole,guard))throw Error('number-touches-other-curve');
            if(curveNear&&polygonDistance(poly,flattenLens(lens))<=guard+2*TIED_FRET.flatness)throw Error('curve-touches-other-curve');
        } else {
            if(numberHit){c.row.obstacle={tag:tag(n),box:b,element:n.outerHTML};throw Error('number-touches-other-'+tag(n));}
            if(curveNear&&lensHitsBox(curve,b,guard))throw Error('curve-touches-other-'+tag(n));
        }
    }
    if(base.lines.filter(l=>l.axis==='x').length!==1 || base.lines.filter(l=>l.axis==='y').length>1)throw Error('string-or-stem-not-unique');
    if(card) {base.cardCurve=findClone(card.svg,incoming.node);for(const l of base.lines)l.cardNode=findClone(card.svg,l.node);}
    return {...base,incoming,curve,curveBox};
}
function journal(svg) {if(!journals.has(svg))journals.set(svg,{added:[],attrs:[]});return journals.get(svg);}
export function clearTiedFrets(svg) {
    const j=journals.get(svg);if(!j)return;
    for(const n of j.added)n.remove();for(const [n,k,v] of j.attrs.reverse())v===null?n.removeAttribute(k):n.setAttribute(k,v);
    journals.delete(svg);
}
function set(svg,n,k,v) {journal(svg).attrs.push([n,k,n.getAttribute(k)]);n.setAttribute(k,v);}
function commit(plan,svg,parent,copy=false) {
    const g=el('g',{'data-tied-fret':plan.c.note.id,'data-tied-bar':plan.c.row.barIndex,'data-tied-mode':plan.mode,'pointer-events':'none'});
    if(plan.mode==='C') {
        set(svg,copy?plan.cardCurve:plan.incoming.node,'d',lensPath(plan.curve));
        for(const line of plan.lines) {
            const n=copy?line.cardNode:line.node;set(svg,n,'display','none');
            for(const b of line.segments) {const segment=n.cloneNode(false);segment.removeAttribute('display');segment.removeAttribute('id');for(const [k,v]of Object.entries(b))segment.setAttribute(k,v);segment.setAttribute('data-tied-line',line.axis);g.append(segment);}
        }
    }
    g.append(plan.text.cloneNode(true));parent.append(g);journal(svg).added.push(g);
}
export function applyTiedFrets(api,partials,{mode='A',cards=null}={}) {
    if(!['A','B','C'].includes(mode))throw Error('invalid-mode');
    const cardSvgs=cards?[...cards.querySelectorAll('.vertical-tab-card svg')]:[];
    for(const svg of [...partials.map(p=>p.svg),...cardSvgs])clearTiedFrets(svg);
    const signature=modelSignature(api.score),resolved=collectTieTargets(api.score,api.renderer.boundsLookup), report={mode,rows:resolved.rows};
    if(mode!=='A')for(const c of resolved.targets)try {
        const matches=partials.filter(p=>p.firstBarIndex<=c.row.barIndex&&p.lastBarIndex>=c.row.barIndex);
        if(matches.length!==1)throw Error('partial-not-unique');const p=matches[0];
        if(![p.x,p.y].every(Number.isFinite))throw Error('partial-offset-unverified');
        const card=cardFor(cards,c.row.barIndex),work=plan(api,p,c,mode,card);
        commit(work,p.svg,p.svg);if(card)commit(work,card.svg,card.parent,true);
        Object.assign(c.row,{rendered:true,partialIndex:p.partialIndex,box:work.box,hole:work.hole,
            originalCurve:work.incoming?.node && journal(p.svg).attrs.find(([n,k])=>n===work.incoming.node&&k==='d')?.[2],
            curve:work.curve||null,lines:work.lines.map(l=>({axis:l.axis,segments:l.segments})),card:card?'inside-original-crop':'not-tested',
            method:mode==='B'?'unsafe-number-only':'split-string-and-stem; retarget-identified-native-curve; no-white-mask'});
    }catch(error){c.row.reason=error.message;}
    if(modelSignature(api.score)!==signature)throw Error('model-changed');
    report.targets=resolved.targets.length;report.native=resolved.rows.filter(r=>r.nativeNumber).length;report.rendered=resolved.rows.filter(r=>r.rendered).length;
    return report;
}
