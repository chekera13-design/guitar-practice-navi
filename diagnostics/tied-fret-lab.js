import { applyTiedFrets, modelSignature, allNotes } from './tied-fret-lab-core.js';
import { VerticalTabController } from '../js/verticalTab.js';

const $=id=>document.getElementById(id), host=$('score'), shell=$('vertical');
let api=null, controller=null, generation=0, report=null, partials=[], ready=false, resizeTimer=null;
let viewportKey=`${innerWidth}:${innerHeight}`;
const noteForId=id=>allNotes(api.score).find(n=>n.id===id);
function zoomBar(bar) {
    if(!api || !ready)return;
    const record=report.aid.rows.find(r=>r.barIndex===bar&&!r.nativeNumber), p=partials.find(p=>p.firstBarIndex<=bar&&p.lastBarIndex>=bar);
    $('zoom').replaceChildren();if(!record||!p)return;
    const n=noteForId(record.noteId),b=api.renderer.boundsLookup.findBeat(n.beat).notes.find(b=>b.note===n).noteHeadBounds;
    const origin=api.renderer.boundsLookup.findBeat(n.tieOrigin.beat).notes.find(b=>b.note===n.tieOrigin).noteHeadBounds;
    const scale=api.settings.display.scale, svg=p.svg.cloneNode(true),x=origin.x-p.x-12*scale,y=b.y-p.y-30*scale,width=b.x-origin.x+38*scale;
    svg.setAttribute('viewBox',`${x} ${y} ${width} ${65*scale}`);svg.removeAttribute('height');svg.setAttribute('width','100%');svg.style.overflow='hidden';
    svg.style.width=`${width/(65*scale)*180}px`;svg.style.maxWidth='100%';svg.style.margin='auto';
    const nativeTexts=[...p.svg.querySelectorAll('text')];
    [...svg.querySelectorAll('text')].forEach((text,i)=>{
        const style=getComputedStyle(nativeTexts[i]);for(const k of ['fontFamily','fontSize','fontWeight','fontStyle'])text.style[k]=style[k];
    });
    svg.setAttribute('aria-label',`第${bar+1}小節のタイ終点の拡大`);$('zoom').append(svg);
}
function getPartials(instance,records) {
    const svgs=[...host.querySelectorAll('svg')];let next=0;
    const result=[...records.values()].filter(r=>r.firstMasterBarIndex>=0).sort((a,b)=>a.firstMasterBarIndex-b.firstMasterBarIndex).map((r,i)=>{
        const matches=svgs.filter(s=>s.parentElement.renderedResultId===r.id);
        if(matches.length!==1 || r.firstMasterBarIndex!==next)throw Error('partialとSVGを一意に照合できません');
        next=r.lastMasterBarIndex+1;return {svg:matches[0],x:r.x,y:r.y,partialIndex:i,firstBarIndex:r.firstMasterBarIndex,lastBarIndex:r.lastMasterBarIndex};
    });
    if(next!==instance.score.masterBars.length)throw Error('全小節のpartialが揃っていません');return result;
}
function finish(instance,records,token,sourceSignature) {
    if(token!==generation||api!==instance)return;
    try {
        partials=getPartials(instance,records);
        const dimensions=partials.map(p=>({width:p.svg.getAttribute('width'),height:p.svg.getAttribute('height'),viewBox:p.svg.getAttribute('viewBox')}));
        let cardError=null,cardBoxes=[];
        controller=new VerticalTabController(shell,{onBarChange:bar=>zoomBar(bar)});
        try {controller.createCardsFromRenderedPartials(partials,instance.score.masterBars.length);
            cardBoxes=[...shell.querySelectorAll('.vertical-tab-card svg')].map(s=>({viewBox:s.getAttribute('viewBox'),clip:s.querySelector('clipPath rect')?.outerHTML}));
        }catch(error){cardError=error.message;}
        const before=modelSignature(instance.score),aid=applyTiedFrets(instance,partials,{mode:$('condition').value,cards:cardError?null:shell});
        if(before!==modelSignature(instance.score)||before!==sourceSignature)throw Error('表示補助の前後でモデルが変化しました');
        const afterDimensions=partials.map(p=>({width:p.svg.getAttribute('width'),height:p.svg.getAttribute('height'),viewBox:p.svg.getAttribute('viewBox')}));
        const afterBoxes=[...shell.querySelectorAll('.vertical-tab-card svg')].map(s=>({viewBox:s.getAttribute('viewBox'),clip:s.querySelector('clipPath rect')?.outerHTML}));
        if(JSON.stringify(dimensions)!==JSON.stringify(afterDimensions)||JSON.stringify(cardBoxes)!==JSON.stringify(afterBoxes))throw Error('元SVG寸法またはカードcropが変わりました');
        ready=true;report={schema:'tied-fret-lab-v1',version:alphaTab.meta.version,commit:alphaTab.meta.commit,generation:token,
            scoreFile:$('scoreFile').value,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},scale:instance.settings.display.scale,
            bars:instance.score.masterBars.length,notes:allNotes(instance.score).length,partials:partials.map(({x,y,firstBarIndex,lastBarIndex})=>({x,y,firstBarIndex,lastBarIndex})),
            aid,cardError,cards:controller.barCount,dimensions,cardBoxes,modelUnchanged:true,dimensionsUnchanged:true,cropUnchanged:true};
        $('status').textContent=`${aid.mode} / ${report.bars}小節 / タイ終点${aid.rows.length}音 / 標準数字${aid.native}音 / 補助対象${aid.targets}音 / 追加${aid.rendered}音\n縦型カード：${cardError?'未検証（'+cardError+'）':controller.barCount+'枚・既存crop内'}`;
        $('modeNote').textContent=aid.mode==='B'?'Bは曲線・弦ラインとの干渉を観察する失敗例です。本番採用候補ではありません。':aid.mode==='C'?'C：白い背景抜きは使用しません。対象弦・符尾の線片分割と、照合済みタイ終端の調整です。':'A：alphaTab標準のSVGを変更しません。';
        $('modeNote').classList.toggle('warning',aid.mode==='B');$('report').textContent=JSON.stringify(report,null,2);$('copy').disabled=false;zoomBar(0);
    }catch(error){ready=false;$('status').textContent='検証を停止：'+error.message;report={error:error.message,generation:token};$('report').textContent=JSON.stringify(report,null,2);}
}
async function render() {
    const token=++generation;ready=false;report=null;$('copy').disabled=true;$('status').textContent='読み込み・描画中';$('report').textContent='';$('zoom').replaceChildren();
    controller?.destroy();controller=null;api?.destroy();api=null;host.replaceChildren();partials=[];
    const file=$('scoreFile').value;
    try {
        if(alphaTab.meta.version!=='1.8.4'||alphaTab.meta.commit!=='022a45c8e42370f9e12e68949d11eada370da83d')throw Error('固定1.8.4 build 34の実体ではありません');
        const response=await fetch(file);if(!response.ok)throw Error(`譜面取得失敗：${response.status}`);const bytes=new Uint8Array(await response.arrayBuffer());if(token!==generation)return;
        const instance=new alphaTab.AlphaTabApi(host,{core:{engine:'svg',enableLazyLoading:false,includeNoteBounds:true,useWorkers:false},
            display:{layoutMode:'horizontal',staveProfile:'Tab',scale:Number($('scale').value),barCountPerPartial:Number($('partialBars').value),resources:{graceFont:'11px Arial, sans-serif'}},
            notation:{elements:{scoreTitle:false,scoreSubTitle:false,scoreArtist:false,scoreAlbum:false,scoreWords:false,scoreMusic:false,scoreWordsAndMusic:false,scoreCopyright:false,trackNames:false,guitarTuning:false,chordDiagrams:false,barNumber:true}},
            player:{enablePlayer:false}});
        api=instance;const records=new Map();let scoreSignature=null;
        instance.renderStarted.on(()=>{if(token===generation)records.clear();});
        instance.renderer.partialLayoutFinished.on(r=>{if(token===generation)records.set(r.id,{id:r.id,x:r.x,y:r.y,firstMasterBarIndex:r.firstMasterBarIndex,lastMasterBarIndex:r.lastMasterBarIndex});});
        instance.postRenderFinished.on(()=>{if(token!==generation||api!==instance)return;Promise.resolve(document.fonts.ready).then(()=>finish(instance,records,token,scoreSignature));});
        instance.error.on(error=>{if(token===generation){ready=false;$('status').textContent='描画エラー：'+error.message;}});
        const score=alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes,instance.settings);scoreSignature=modelSignature(score);instance.renderScore(score);
    }catch(error){if(token===generation){ready=false;report={error:error.message};$('status').textContent='検証を停止：'+error.message;}}
}
for(const id of ['scoreFile','condition','scale','partialBars'])$(id).addEventListener('change',render);
$('redraw').addEventListener('click',render);
$('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(JSON.stringify(report,null,2));$('copy').textContent='コピーしました';}catch{$('report').closest('details').open=true;$('report').focus();}});
window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{
    const next=`${innerWidth}:${innerHeight}`;if(next===viewportKey)return;viewportKey=next;render();
},120);});
window.addEventListener('pagehide',()=>{++generation;clearTimeout(resizeTimer);controller?.destroy();api?.destroy();});
// Read-only diagnostic access; helpers rerender the independent lab, never the normal app.
window.__tiedFretLab={get ready(){return ready},get api(){return api},get report(){return report},get partials(){return partials},get controller(){return controller},render,
    reapply(){if(!ready)throw Error('not-ready');return applyTiedFrets(api,partials,{mode:$('condition').value,cards:report.cardError?null:shell});}};
render();
