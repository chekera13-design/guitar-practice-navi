import { analyzeCapoSource, applyCapoPosition, musicSnapshot } from './capo-position-lab-core.js';
import { VerticalTabController } from '../js/verticalTab.js';
const $=id=>document.getElementById(id),host=$('score'),shell=$('vertical');
let api=null,controller=null,source=null,report=null,partials=[],ready=false,generation=0,timer=null,viewportKey=`${innerWidth}:${innerHeight}`;
const xmlEscape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
// New virtual fixtures only. Never transform or overwrite a teaching score.
function fixtureXml(key){
    const labels={'fixture-1':['capo1'],'fixture-2':['Capo 2'],'fixture-3':['CAPO 3'],'fixture-5':['capo 5'],
        'fixture-duplicate':['capo2','capo2'],'fixture-conflict':['capo2','CAPO 3'],'fixture-general':['Play softly']};
    if(!labels[key])throw Error('unknown-fixture');
    const tuning=[['E',2],['A',2],['D',3],['G',3],['B',3],['E',4]].map(([step,octave],i)=>`<staff-tuning line="${i+1}"><tuning-step>${step}</tuning-step><tuning-octave>${octave}</tuning-octave></staff-tuning>`).join('');
    return `<?xml version="1.0"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Virtual capo fixture</part-name></score-part></part-list><part id="P1">`+[0,1].map(bar=>`<measure number="${bar+1}">${bar===0?`<attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>TAB</sign></clef><staff-details><staff-lines>6</staff-lines>${tuning}</staff-details></attributes>`:''}<harmony><root><root-step>${bar===0?'E':'B'}</root-step></root><kind text="m">minor</kind></harmony>${bar===0?labels[key].map(text=>`<direction placement="above"><direction-type><words>${xmlEscape(text)}</words></direction-type></direction>`).join(''):''}`+[['E',2,6,0],['G',3,3,0],['B',3,2,0],['E',4,1,0]].map(([step,octave,string,fret])=>`<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>1</duration><voice>1</voice><type>quarter</type><notations><technical><string>${string}</string><fret>${fret}</fret></technical></notations></note>`).join('')+'</measure>').join('')+'</part></score-partwise>';
}
async function scoreInput(key){
    if(key.startsWith('fixture-')){const xml=fixtureXml(key);return{xml,bytes:new TextEncoder().encode(xml),origin:'virtual-new-input'};}
    const file=key==='ex03'?'../scores/solo/ex03.mxl':key==='none'?'../scores/solo/ex01.mxl':null;if(!file)throw Error('unknown-score');
    const response=await fetch(file);if(!response.ok)throw Error('譜面取得失敗：'+response.status);const bytes=new Uint8Array(await response.arrayBuffer());
    const zip=await JSZip.loadAsync(bytes),container=zip.file('META-INF/container.xml');let entry;
    if(container){const doc=new DOMParser().parseFromString(await container.async('string'),'application/xml'),roots=[...doc.querySelectorAll('rootfile')];if(roots.length!==1)throw Error('MXLの原本XMLが一意ではありません');entry=zip.file(roots[0].getAttribute('full-path'));}
    else{const entries=Object.values(zip.files).filter(f=>!f.dir&&!f.name.startsWith('META-INF/')&&/\.(xml|musicxml)$/i.test(f.name));if(entries.length!==1)throw Error('MXLの原本XMLが一意ではありません');entry=entries[0];}
    if(!entry)throw Error('MXL原本XMLが見つかりません');return{bytes,xml:await entry.async('string'),origin:file};
}
function getPartials(instance,records){
    const svgs=[...host.querySelectorAll('svg')];let next=0;
    const result=[...records.values()].filter(p=>p.firstMasterBarIndex>=0).sort((a,b)=>a.firstMasterBarIndex-b.firstMasterBarIndex).map((p,i)=>{
        const matches=svgs.filter(s=>s.parentElement.renderedResultId===p.id);
        if(matches.length!==1||p.firstMasterBarIndex!==next)throw Error('partialとSVGが一意ではありません');next=p.lastMasterBarIndex+1;
        return{svg:matches[0],x:p.x,y:p.y,firstBarIndex:p.firstMasterBarIndex,lastBarIndex:p.lastMasterBarIndex,partialIndex:i};
    });if(next!==instance.score.masterBars.length)throw Error('全小節のpartialが揃っていません');return result;
}
const dimensions=ps=>ps.map(p=>({width:p.svg.getAttribute('width'),height:p.svg.getAttribute('height'),viewBox:p.svg.getAttribute('viewBox')}));
const cropBoxes=()=>[...shell.querySelectorAll('.vertical-tab-card svg')].map(s=>({viewBox:s.getAttribute('viewBox'),clip:s.querySelector('clipPath rect')?.outerHTML}));
function showZoom(){
    $('zoom').replaceChildren();const p=partials.find(p=>p.firstBarIndex===0),card=shell.querySelector('.vertical-tab-card[data-bar-index="0"] svg');if(!p||!card)return;
    const vb=card.getAttribute('viewBox').split(/\s+/).map(Number),scale=api.settings.display.scale,font=12*scale;
    const width=Math.min(vb[2],Math.max(font*12,report.aid.area?.width||0)),height=Math.min(vb[3],font*6),svg=p.svg.cloneNode(true),native=[...p.svg.querySelectorAll('text')];
    [...svg.querySelectorAll('text')].forEach((n,i)=>{const s=getComputedStyle(native[i]);for(const k of ['fontFamily','fontSize','fontStyle','fontWeight'])n.style[k]=s[k];});
    svg.setAttribute('viewBox',`${vb[0]} ${vb[1]} ${width} ${height}`);svg.removeAttribute('height');svg.setAttribute('width','100%');svg.style.width=`${width/height*180}px`;svg.setAttribute('aria-label','譜面先頭のカポ表記とコード名の拡大');$('zoom').append(svg);
}
function finish(instance,records,token,input,signature){
    if(token!==generation||api!==instance)return;
    try{
        partials=getPartials(instance,records);const beforeDimensions=dimensions(partials);let cardError=null;
        controller=new VerticalTabController(shell);
        try{controller.createCardsFromRenderedPartials(partials,instance.score.masterBars.length);}catch(error){cardError=error.message;}
        const beforeCrop=cropBoxes(),aid=applyCapoPosition(instance,partials,source,{mode:$('condition').value,cards:cardError?null:shell,expectedScore:instance.score});
        if(musicSnapshot(instance.score)!==signature)throw Error('音楽モデルが変化しました');
        if(JSON.stringify(dimensions(partials))!==JSON.stringify(beforeDimensions)||JSON.stringify(cropBoxes())!==JSON.stringify(beforeCrop))throw Error('元寸法またはcropが変化しました');
        report={schema:'capo-position-lab-v1',version:alphaTab.meta.version,commit:alphaTab.meta.commit,generation:token,input:$('scoreFile').value,origin:input.origin,
            viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},scale:instance.settings.display.scale,source,aid,
            bars:instance.score.masterBars.length,partials:partials.map(({x,y,firstBarIndex,lastBarIndex})=>({x,y,firstBarIndex,lastBarIndex})),
            cards:controller.barCount,cardError,dimensions:beforeDimensions,crop:beforeCrop,modelUnchanged:true,dimensionsUnchanged:true,cropUnchanged:true};
        ready=true;$('copy').disabled=false;$('status').textContent=`${aid.mode} / 認識${aid.sourceCandidates}件 / 移動${aid.moved?1:0}件${aid.reason?' / '+aid.reason:''}\n縦型：${cardError?'未検証（'+cardError+'）':controller.barCount+'カード・元のcropを維持'}`;
        $('modeNote').textContent=aid.mode==='A'?'A：元のSVG文字位置を変更しません。':aid.mode==='B'?'B：左上へ移動し、Capo Nに統一。周辺要素との衝突判定を省いた比較です。':'C：実bboxとカード領域を確認。空間が確保できない場合は元表示を維持します。';
        $('report').textContent=JSON.stringify(report,null,2);showZoom();
    }catch(error){ready=false;report={error:error.message,generation:token};$('status').textContent='検証を停止：'+error.message;$('report').textContent=JSON.stringify(report,null,2);}
}
async function render(){
    const token=++generation;ready=false;report=null;$('copy').disabled=true;$('status').textContent='読み込み・描画中';$('report').textContent='';$('zoom').replaceChildren();
    controller?.destroy();controller=null;api?.destroy();api=null;host.replaceChildren();partials=[];
    try{
        if(alphaTab.meta.version!=='1.8.4'||alphaTab.meta.commit!=='022a45c8e42370f9e12e68949d11eada370da83d')throw Error('固定1.8.4 build 34ではありません');
        const input=await scoreInput($('scoreFile').value);if(token!==generation)return;source=analyzeCapoSource(input.xml);
        const instance=new alphaTab.AlphaTabApi(host,{core:{engine:'svg',enableLazyLoading:false,includeNoteBounds:true,useWorkers:false},
            display:{layoutMode:'horizontal',staveProfile:'Tab',scale:Number($('scale').value),barCountPerPartial:Number($('partialBars').value),resources:{graceFont:'11px Arial, sans-serif'}},
            notation:{elements:{scoreTitle:false,scoreSubTitle:false,scoreArtist:false,scoreAlbum:false,scoreWords:false,scoreMusic:false,scoreWordsAndMusic:false,scoreCopyright:false,trackNames:false,guitarTuning:false,chordDiagrams:false,barNumber:true}},player:{enablePlayer:false}});
        api=instance;const records=new Map();let signature;
        instance.renderStarted.on(()=>{if(token===generation)records.clear();});
        instance.renderer.partialLayoutFinished.on(p=>{if(token===generation)records.set(p.id,{id:p.id,x:p.x,y:p.y,firstMasterBarIndex:p.firstMasterBarIndex,lastMasterBarIndex:p.lastMasterBarIndex});});
        instance.postRenderFinished.on(()=>{if(token!==generation||api!==instance)return;Promise.resolve(document.fonts.ready).then(()=>finish(instance,records,token,input,signature));});
        instance.error.on(error=>{if(token===generation){ready=false;$('status').textContent='描画エラー：'+error.message;}});
        const score=alphaTab.importer.ScoreLoader.loadScoreFromBytes(input.bytes,instance.settings);signature=musicSnapshot(score);instance.renderScore(score);
    }catch(error){if(token===generation){ready=false;report={error:error.message};$('status').textContent='検証を停止：'+error.message;}}
}
for(const id of ['scoreFile','condition','scale','partialBars'])$(id).addEventListener('change',render);
$('redraw').addEventListener('click',render);
$('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(JSON.stringify(report,null,2));$('copy').textContent='コピーしました';}catch{$('report').closest('details').open=true;}});
window.addEventListener('resize',()=>{clearTimeout(timer);timer=setTimeout(()=>{const key=`${innerWidth}:${innerHeight}`;if(key===viewportKey)return;viewportKey=key;render();},120);});
window.addEventListener('pagehide',()=>{++generation;clearTimeout(timer);controller?.destroy();api?.destroy();});
window.__capoPositionLab={get ready(){return ready},get api(){return api},get report(){return report},get source(){return source},get partials(){return partials},get controller(){return controller},render,
    reapply(mode=$('condition').value){if(!ready)throw Error('not-ready');return applyCapoPosition(api,partials,source,{mode,cards:report.cardError?null:shell,expectedScore:api.score});}};
render();
