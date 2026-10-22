export const DIAGNOSTIC_VERSION = 'grace-device-20261023-v1';
export function symbolCounts(root) {
    function count(selector) { return root && root.querySelectorAll ? root.querySelectorAll(selector).length : 0; }
    return { groups:count('.alphatab-grace-symbol'),stem:count('[data-symbol-part="stem"]'),flag:count('[data-symbol-part="flag"]'),slash:count('[data-symbol-part="slash"]') };
}
export function insideRect(b,v) {
    return !!b && Array.isArray(v) && v.length===4 && [b.x,b.y,b.width,b.height].concat(v).every(Number.isFinite)
        && v[2]>0 && v[3]>0 && b.x>=v[0] && b.y>=v[1] && b.x+b.width<=v[0]+v[2] && b.y+b.height<=v[1]+v[3];
}
export function metricComparison(b,m) {
    function has(k){return Number.isFinite(m[k]);}
    const needed=['width','fontBoundingBoxAscent','fontBoundingBoxDescent','actualBoundingBoxLeft','actualBoundingBoxRight','actualBoundingBoxAscent','actualBoundingBoxDescent'];
    return {missing:needed.filter(k=>!has(k)),
        productionHeightDifference:has('fontBoundingBoxAscent')&&has('fontBoundingBoxDescent')?Math.abs(m.fontBoundingBoxAscent+m.fontBoundingBoxDescent-b.height):null,
        productionWidthDifference:has('width')?Math.abs(m.width-b.width):null,
        productionTolerance:.1,
        note:'本番graceInkBoundsの有限値・幅/高さ一致条件を読むための値。ここでは記号を追加・修正しない。'};
}
function safe(fn){try{return fn();}catch(e){return {unavailable:String(e && e.message || e)};}}
function rectangle(r){return {x:r.x,y:r.y,width:r.width,height:r.height,finite:[r.x,r.y,r.width,r.height].every(Number.isFinite)};}
function styleObject(w,n){const s=w.getComputedStyle(n),out={};['display','visibility','opacity','fill','fillOpacity','stroke','strokeWidth','transform','transformOrigin','clipPath','mask','filter','overflow','pointerEvents','backgroundColor','font','fontSize','fontFamily','textAnchor','dominantBaseline','letterSpacing'].forEach(k=>out[k]=s[k] || '不明');return out;}
function pathOf(n){if(!n || n.nodeType!==1)return null;const parts=[];for(let node=n;node && parts.length<9;node=node.parentElement){if(node.id){parts.unshift('#'+node.id);break;}let index=1;for(let s=node.previousElementSibling;s;s=s.previousElementSibling)if(s.tagName===node.tagName)index++;parts.unshift(node.tagName.toLowerCase()+':nth-of-type('+index+')');}return parts.join(' > ');}
function matrix(m){return m?{a:m.a,b:m.b,c:m.c,d:m.d,e:m.e,f:m.f}:null;}
export function createObserver(w,options) {
    const doc=w.document, mode=options.mode,ids=new WeakMap(),apis=new WeakSet(),wrapped=[],listeners=[],fonts=doc.fonts;
    let nextId=0,scope=null,active=true,scheduled=false,serial=0,mutationSerial=0,autoCount=0;
    const events=[],snapshots=[],errors=[],started=new Date().toISOString();
    function id(o){if(!o || typeof o!=='object')return null;if(!ids.has(o))ids.set(o,++nextId);return ids.get(o);}
    function log(kind,detail){events.push({kind,time:new Date().toISOString(),elapsedMs:Math.round(w.performance.now()),detail:detail || null});if(events.length>240)events.shift();}
    function on(target,type,fn){target.addEventListener(type,fn);listeners.push(()=>target.removeEventListener(type,fn));}
    function state(){return scope?safe(scope.read):null;}
    function metadata(){const s=state();return s && s.service?safe(()=>s.service.snapshot()):null;}
    function domCounts(){return {source:symbolCounts(doc.getElementById('alphaTab')),cards:symbolCounts(doc.getElementById('verticalTabWrapper'))};}
    function owner(){const s=state();return s && !s.unavailable?{generation:s.generation,apiId:id(s.api),scoreId:id(s.api && s.api.score),stage:s.stage && s.stage.file,scoreLoadState:s.scoreLoadState}:null;}
    function error(kind,e){const row={kind,time:new Date().toISOString(),message:String(e && (e.message || e.reason && e.reason.message || e.reason) || e),file:e && e.filename || null,line:e && e.lineno || null,resource:e && e.target && (e.target.src || e.target.href) || null,stack:e && e.error && e.error.stack || null};errors.push(row);if(errors.length>40)errors.shift();log(kind,row);}
    on(w,'error',e=>error('javascript-error',e));on(w,'unhandledrejection',e=>error('unhandled-promise',e));
    function ancestors(n){const a=[];for(let p=n;p && a.length<9;p=p.parentElement)a.push({path:pathOf(p),style:safe(()=>styleObject(w,p)),screen:safe(()=>rectangle(p.getBoundingClientRect()))});return a;}
    function visibility(n){const chain=ancestors(n),r=safe(()=>rectangle(n.getBoundingClientRect())),reasons=[];
        chain.forEach(p=>{if(p.style.display==='none')reasons.push(p.path+':display:none');if(['hidden','collapse'].includes(p.style.visibility))reasons.push(p.path+':visibility:'+p.style.visibility);if(Number(p.style.opacity)===0)reasons.push(p.path+':opacity:0');});
        if(!r.finite || r.width<=0 || r.height<=0)reasons.push('画面bboxが不正/0');
        if(r.x+r.width<=0 || r.y+r.height<=0 || r.x>=w.innerWidth || r.y>=w.innerHeight)reasons.push('viewport外');
        return {layoutVisibleCandidate:reasons.length===0,hiddenReasons:reasons,paintVerified:false,note:'CSS/座標の候補判定。実際の描画や他要素による遮蔽の証明ではない。',chain};
    }
    function nodeInfo(n,svg){const b=safe(()=>rectangle(n.getBBox())),r=safe(()=>rectangle(n.getBoundingClientRect())),css=safe(()=>styleObject(w,n)),vv=w.visualViewport,scale=vv?vv.scale:1,dpr=w.devicePixelRatio;
        const info={id:id(n),path:pathOf(n),parent:pathOf(n.parentElement),tag:n.tagName,role:n.getAttribute('data-symbol-part'),d:n.getAttribute('d'),bbox:b,screen:r,css,ctm:safe(()=>matrix(n.getCTM())),screenCtm:safe(()=>matrix(n.getScreenCTM())),visibility:visibility(n),
            physicalBoundingRectangleEstimate:r.finite?{width:r.width*dpr*scale,height:r.height*dpr*scale,area:r.width*r.height*dpr*dpr*scale*scale,note:'外接矩形の概算。塗り面積・可視性の証明ではない。'}:null};
        if(n.tagName.toLowerCase()==='path')info.pathSupport={nonFiniteToken:/NaN|Infinity/.test(info.d || ''),totalLength:safe(()=>n.getTotalLength()),path2D:safe(()=>typeof w.Path2D==='function'?(new w.Path2D(info.d),'構文を受理'):'APIなし')};
        if(r.finite && r.x>=0 && r.y>=0 && r.x+r.width<w.innerWidth && r.y+r.height<w.innerHeight)info.hitTest=safe(()=>({point:'bbox中央（塗り領域とは限らない）',nodes:(doc.elementsFromPoint?doc.elementsFromPoint(r.x+r.width/2,r.y+r.height/2):[]).slice(0,5).map(pathOf),note:'pointer-events:noneやbbox内の空白があるため、この結果だけで遮蔽と断定しない。'}));
        if(svg)info.localSvg=id(svg);return info;
    }
    function svgInfo(svg,kind,partial){const clips=Array.from(svg.querySelectorAll('clipPath rect')).map(r=>({path:pathOf(r),id:r.parentElement.id,rect:['x','y','width','height'].map(k=>Number(r.getAttribute(k)))}));
        const raw=svg.getAttribute('viewBox'),view=raw?raw.trim().split(/[ ,]+/).map(Number):[0,0,parseFloat(svg.getAttribute('width')),parseFloat(svg.getAttribute('height'))];
        return {id:id(svg),path:pathOf(svg),parent:pathOf(svg.parentElement),kind,partial:partial?{index:partial.partialIndex,x:partial.x,y:partial.y,firstBar:partial.firstBarIndex+1,lastBar:partial.lastBarIndex+1}:null,
            width:svg.getAttribute('width'),height:svg.getAttribute('height'),viewBox:raw,resolvedViewBox:view,clipRects:clips,counts:symbolCounts(svg),visibility:visibility(svg),screen:safe(()=>rectangle(svg.getBoundingClientRect())),
            groups:Array.from(svg.querySelectorAll('.alphatab-grace-symbol')).map(g=>({id:id(g),beat:g.getAttribute('data-grace-symbol'),bar:g.getAttribute('data-grace-symbol-bar'),notes:g.getAttribute('data-grace-symbol-notes'),parent:pathOf(g.parentElement),
                parts:Array.from(g.querySelectorAll('[data-symbol-part]')).map(n=>{const info=nodeInfo(n,svg),half=info.css.stroke!=='none'?(parseFloat(info.css.strokeWidth)||0)/2:0;const ink=info.bbox.finite?{x:info.bbox.x-half,y:info.bbox.y-half,width:info.bbox.width+2*half,height:info.bbox.height+2*half}:null;info.strokeExpandedBBox=ink;info.insideViewBox=insideRect(ink,view);info.insideClipRects=clips.length?clips.map(c=>insideRect(ink,c.rect)):null;info.clipCaveat='ローカルrect比較。transform・mask・非rectクリップはCSS/CTMと併せて評価する。';return info;})}))};
    }
    function digits(svg){return Array.from(svg.querySelectorAll('text')).filter(n=>/^[0-9]+$/.test(n.textContent) && parseFloat(w.getComputedStyle(n).fontSize)===11).slice(0,32).map(n=>safe(()=>{
        const css=w.getComputedStyle(n),b=rectangle(n.getBBox()),ctx=doc.createElement('canvas').getContext('2d');if(!ctx)throw Error('Canvas 2Dなし');ctx.font=css.font;ctx.textBaseline='alphabetic';const m=ctx.measureText(n.textContent),metrics={},types={};
        ['width','actualBoundingBoxAscent','actualBoundingBoxDescent','fontBoundingBoxAscent','fontBoundingBoxDescent','actualBoundingBoxLeft','actualBoundingBoxRight'].forEach(k=>{metrics[k]=Number.isFinite(m[k])?m[k]:null;types[k]=typeof m[k];});
        return {svgId:id(svg),text:n.textContent,x:n.getAttribute('x'),y:n.getAttribute('y'),bbox:b,font:css.font,fontFamily:css.fontFamily,dominantBaseline:css.dominantBaseline,fontReady:fonts?safe(()=>fonts.check(css.font)):'APIなし',canvas:metrics,metricTypes:types,comparison:metricComparison(b,m)};
    }));}
    function models(s){if(!s || !s.api || !s.api.score)return null;return safe(()=>{
        const rows=[],api=s.api,lookup=api.renderer && api.renderer.boundsLookup;
        api.score.tracks.forEach(t=>t.staves.forEach(staff=>staff.bars.forEach(bar=>bar.voices.forEach(v=>v.beats.forEach(beat=>{if(!beat.graceType)return;beat.notes.forEach(n=>{
            const beatBounds=lookup && lookup.findBeat(beat),matches=beatBounds && beatBounds.notes?beatBounds.notes.filter(b=>b.note===n):[],h=matches.length===1?matches[0].noteHeadBounds:null;
            rows.push({part:t.index,staff:staff.index,bar:bar.index+1,voice:v.index,beatIndex:beat.index,beatId:beat.id,noteId:n.id,string:staff.tuning.length-n.string+1,fret:n.fret,graceType:beat.graceType,graceIndex:beat.graceIndex,graceGroup:beat.graceGroup && beat.graceGroup.id,noteBoundsMatches:matches.length,noteHeadBounds:h?{x:h.x,y:h.y,w:h.w,h:h.h,finite:[h.x,h.y,h.w,h.h].every(Number.isFinite)}:null,slurDestination:n.slurDestination && n.slurDestination.id,tieDestination:n.tieDestination && n.tieDestination.id});
        });})))));return rows;
    });}
    function environment(){const v=w.visualViewport,nav=w.navigator;return {userAgent:nav.userAgent,platform:nav.platform || '不明',browserTokens:(nav.userAgent.match(/(?:Silk|Chrome|Chromium|Firefox|SamsungBrowser|EdgA?|Version|Safari)\/[0-9.]+/g)||[]),browserIdentityNote:'UAの申告値。実機名や実ブラウザを推測で補完しない。',uaClientHints:nav.userAgentData?{brands:nav.userAgentData.brands,mobile:nav.userAgentData.mobile,platform:nav.userAgentData.platform}:'取得APIなし',innerWidth:w.innerWidth,innerHeight:w.innerHeight,outerWidth:w.outerWidth,outerHeight:w.outerHeight,devicePixelRatio:w.devicePixelRatio,visualViewport:v?{width:v.width,height:v.height,scale:v.scale,offsetLeft:v.offsetLeft,offsetTop:v.offsetTop}:null,screen:{width:w.screen.width,height:w.screen.height,availWidth:w.screen.availWidth,availHeight:w.screen.availHeight,colorDepth:w.screen.colorDepth,orientation:w.screen.orientation?{type:w.screen.orientation.type,angle:w.screen.orientation.angle}:null},orientationMedia:w.matchMedia('(orientation: landscape)').matches?'landscape':'portrait',pageUrl:w.location.href,baseUrl:doc.baseURI,secureContext:w.isSecureContext,localTime:new Date().toLocaleString(),timezone:safe(()=>Intl.DateTimeFormat().resolvedOptions().timeZone),pageZoomNote:'visualViewport.scaleはピンチ倍率。Chromeのメニュー倍率やOSスケールを単独で確定できない。',fonts:fonts?{status:fonts.status,size:fonts.size}:'APIなし'};}
    function capture(reason){if(!active)return null;const startEvents=events.length,beforeMutations=mutationSerial,s=state(),partials=s && s.partials || [],root=doc.getElementById('alphaTab'),vertical=doc.getElementById('verticalTabWrapper');
        const sources=root?Array.from(root.querySelectorAll('svg')).filter(n=>!n.parentElement.closest('svg')).map(svg=>svgInfo(svg,'source',partials.find(p=>p.svg===svg))):[];
        const cards=vertical?Array.from(vertical.querySelectorAll('.vertical-tab-card')).map(c=>({id:id(c),bar:Number(c.dataset.barIndex)+1,current:c.classList.contains('is-current'),path:pathOf(c),visibility:visibility(c),svgs:Array.from(c.querySelectorAll('svg')).map(svg=>svgInfo(svg,'card'))})):[];
        const sourceGroups=[].concat.apply([],sources.map(svg=>svg.groups));
        cards.forEach(card=>card.svgs.forEach(svg=>svg.groups.forEach(group=>{const matching=sourceGroups.filter(g=>g.beat===group.beat && g.bar===group.bar && g.notes===group.notes);group.sourceAssociation={matches:matching.length,sourceGroupId:matching.length===1?matching[0].id:null,basis:'描画済みbeat/bar/note ID属性。文字列のフレット番号や座標では照合しない。'};})));
        const summary=domCounts(),meta=metadata(),stamp=new Date().toISOString();
        const snapshot={id:++serial,time:stamp,reason,mode,environment:environment(),owner:owner(),alphaTab:safe(()=>w.alphaTab?w.alphaTab.meta:'ライブラリ未取得'),counts:summary,sources,cards,
            displayedCandidates:{sourceSvgIds:sources.filter(a=>a.visibility.layoutVisibleCandidate).map(a=>a.id),layoutVisibleCardCount:cards.filter(c=>c.visibility.layoutVisibleCandidate).length,layoutVisibleCardIds:cards.filter(c=>c.visibility.layoutVisibleCandidate).map(c=>c.id),currentCards:cards.filter(c=>c.current).map(c=>({bar:c.bar,cardId:c.id,layoutVisibleCandidate:c.visibility.layoutVisibleCandidate,counts:c.svgs.map(x=>x.counts)})),note:'CSS/配置と現在カードの識別。親のclip・遮蔽を含む描画済みという断定ではない。'},
            graceMetadata:meta,graceModelBounds:models(s),fontMetrics:root?[].concat.apply([],Array.from(root.querySelectorAll('svg')).map(digits)):[],
            scriptTags:Array.from(doc.scripts).map(n=>({src:n.src,type:n.type})),errors:errors.slice(),eventTail:events.slice(-80),
            observation:{requestedRedraw:false,requestedResize:false,eventsDuringCapture:events.slice(startEvents),mutationSerialBefore:beforeMutations,mutationSerialAfter:mutationSerial,observerMayAffectTiming:true,earlyErrorsObservable:mode==='instrumented',internalReasonsAvailable:!!scope,drawCallEvidence:'private drawGraceSymbolsへの直接hookなし。addSymbolsの戻り値trueとsymbols結果で呼出を確認する。'}};
        snapshots.push(snapshot);if(snapshots.length>8)snapshots.shift();if(options.onSnapshot)safe(()=>options.onSnapshot(snapshot));return snapshot;
    }
    function schedule(reason){if(!active || scheduled || autoCount>=40)return;scheduled=true;w.requestAnimationFrame(()=>{scheduled=false;if(active){autoCount++;safe(()=>capture(reason));}});}
    function observeApi(api){if(!api || apis.has(api))return;apis.add(api);['renderStarted','renderFinished','postRenderFinished','scoreLoaded','error'].forEach(name=>{if(api[name] && api[name].on)api[name].on(value=>{if(!active)return;log('alphatab-'+name,{apiId:id(api),scoreId:id(api.score),owner:owner(),error:name==='error'?String(value):null});if(name==='postRenderFinished')schedule('描画完了後の自動記録');});});}
    function setScope(provider){scope=provider;const s=state();if(!s || !s.service){log('scope-unavailable',s);return;}const service=s.service;
        ['begin','capture','bindModel','annotate','validateCards','removeSymbols','addSymbols','restoreLabels','positionLabels','clear'].forEach(name=>{const original=service[name];if(typeof original!=='function')return;
            const wrapper=function(){if(name==='begin')observeApi(arguments[0] && arguments[0].api);const before=domCounts();try{const result=original.apply(this,arguments);const meta=name==='addSymbols'?metadata():null;log('service-'+name,{owner:owner(),before,after:domCounts(),result:typeof result==='boolean'?result:null,symbolResults:meta && meta.symbols || null});if(name==='addSymbols')schedule('記号追加処理後の自動記録');return result;}catch(e){log('service-throw-'+name,{message:String(e.message || e)});throw e;}};
            service[name]=wrapper;wrapped.push(()=>{if(service[name]===wrapper)service[name]=original;});
        });observeApi(s.api);log('scope-installed',{owner:owner(),note:'既存関数を同じ引数・thisで一度呼び、結果を観測。描画アルゴリズムは差し替えない。'});
    }
    const observer=new w.MutationObserver(records=>{if(!active)return;const changes=[];records.forEach(r=>{
        const target=r.target.nodeType===1?r.target:r.target.parentElement;if(!target)return;const area=target.closest('#alphaTab')?'source':target.closest('#verticalTabWrapper')?'cards':null;
        if(!area)return;function nodes(list){return Array.from(list).filter(n=>n.nodeType===1).map(n=>({id:id(n),tag:n.tagName,svgCount:(n.tagName.toLowerCase()==='svg'?1:0)+(n.querySelectorAll?n.querySelectorAll('svg').length:0),counts:symbolCounts(n),selfRole:n.getAttribute('data-symbol-part'),selfGroup:n.matches('.alphatab-grace-symbol')}));}
        const added=nodes(r.addedNodes),removed=nodes(r.removedNodes);if(added.length||removed.length||r.type==='attributes')changes.push({area,type:r.type,target:pathOf(target),attribute:r.attributeName,added,removed});
    });if(changes.length){mutationSerial++;log('dom-mutation',{serial:mutationSerial,changes:changes.slice(0,30),truncated:changes.length>30});if(changes.some(c=>c.added.length||c.removed.length))schedule('SVG/記号の追加・削除後の自動記録');}});
    observer.observe(doc.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','viewBox','width','height','clip-path','transform']});
    ['resize','orientationchange'].forEach(name=>on(w,name,()=>{log(name,{width:w.innerWidth,height:w.innerHeight,dpr:w.devicePixelRatio});schedule(name+'後の自動記録');}));
    if(fonts && fonts.addEventListener)on(fonts,'loadingdone',()=>{log('fonts-loadingdone',{status:fonts.status});schedule('フォント読込後の自動記録');});
    log('observer-start',{mode,earlyErrorsObservable:mode==='instrumented',note:'通常モードはiframe load後から観測。初期読込エラーは取り逃す可能性あり。'});
    return {capture,setScope,environment,read(){return {version:DIAGNOSTIC_VERSION,mode,started,events:events.slice(),errors:errors.slice(),snapshots:snapshots.slice()};},stop(){active=false;observer.disconnect();listeners.forEach(fn=>safe(fn));wrapped.forEach(fn=>safe(fn));}};
}
