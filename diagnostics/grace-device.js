import { createObserver, DIAGNOSTIC_VERSION } from './grace-device-observer.js';
const $=id=>document.getElementById(id),frame=$('appFrame'),appUrl=new URL('../index.html',location.href),baseUrl=new URL('./',appUrl),runs=[],blobs=[];
let current=null,observer=null,generation=0;
const assetPaths=['index.html','js/app.js','js/graceNotation.js','js/verticalTab.js','js/ui.js','js/config.js','js/config/index.js','js/config/solo.js','css/style.css','scores/solo/test5.musicxml'];
const safeAsync=async fn=>{try{return await fn();}catch(e){return {unavailable:String(e.message || e)};}};
export async function sha256(bytes,cryptoObject){if(!cryptoObject || !cryptoObject.subtle)return null;const digest=await cryptoObject.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest)).map(n=>n.toString(16).padStart(2,'0')).join('');}
export function instrumentModule(source,moduleUrl,graceBlobUrl){
    let imports=0,graceImports=0;
    const rewritten=source.replace(/(from\s*["'])(\.[^"']+)(["'])/g,(all,a,spec,b)=>{imports++;const url=new URL(spec,moduleUrl);if(url.pathname===new URL('./graceNotation.js',moduleUrl).pathname){graceImports++;return a+graceBlobUrl+b;}return a+url.href+b;});
    if(!imports || graceImports!==1)throw Error('app.jsのimport構造が想定と異なります。診断起動を見送りました。');
    if(/\bimport\s*\(|\bimport\.meta\b/.test(source))throw Error('動的import/import.metaを含む入口は今回の診断方式では未対応です。');
    return {imports,graceImports,source:rewritten+'\n;parent.__graceDeviceScope(window,{read:()=>({generation:scoreRenderGeneration,stage:currentStage,api,service:graceNotation,scoreLoadState,partials:preparedScore?.partials||[]})});\n'};
}
function objectUrl(bytes,type){const u=URL.createObjectURL(new Blob([bytes],{type:type}));blobs.push(u);return u;}
function stamp(snapshot){$('recordStamp').textContent='記録 #'+snapshot.id+' '+snapshot.time.slice(11,19)+'Z / 元flag '+snapshot.counts.source.flag+'・カードflag '+snapshot.counts.cards.flag;}
function evidenceNote(mode,path){return mode==='instrumented' && ['js/app.js','js/graceNotation.js'].includes(path)?'詳細入口が取得して実行した原本応答。app.jsはimport URL変更と観測追記あり。':'診断時に同じURLを再取得した応答。実行済みモジュールの全バイト列の証明ではない。';}
async function fetchAsset(path,mode){const url=new URL(path,baseUrl).href,start=performance.now(),r=await fetch(url,{cache:'default',credentials:'same-origin'}),bytes=await r.arrayBuffer(),headers={};['cache-control','etag','last-modified','age','vary','content-type','content-length','date','cf-cache-status','x-cache','content-security-policy'].forEach(k=>headers[k]=r.headers.get(k));
    const normalized=new TextDecoder().decode(bytes).replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');
    return {path,url:r.url,requestedUrl:url,status:r.status,headers,byteLength:bytes.byteLength,sha256:await sha256(bytes,window.crypto),normalizedTextSha256:await sha256(new TextEncoder().encode(normalized),window.crypto),elapsedMs:performance.now()-start,evidence:evidenceNote(mode,path),bytes};
}
function publicAsset(a){const out={};Object.keys(a).filter(k=>k!=='bytes').forEach(k=>out[k]=a[k]);return out;}
async function environmentExtras(child){const n=child.navigator;
    return {uaHighEntropy:await safeAsync(()=>n.userAgentData?n.userAgentData.getHighEntropyValues(['architecture','bitness','model','platformVersion','uaFullVersion','fullVersionList']):Promise.resolve('取得APIなし')),
        serviceWorkers:await safeAsync(async()=>{if(!n.serviceWorker)return 'APIなし';const regs=await n.serviceWorker.getRegistrations();return {controller:n.serviceWorker.controller?{url:n.serviceWorker.controller.scriptURL,state:n.serviceWorker.controller.state}:null,registrations:regs.map(r=>({scope:r.scope,active:r.active && r.active.scriptURL,waiting:r.waiting && r.waiting.scriptURL,installing:r.installing && r.installing.scriptURL}))};}),
        cacheStorage:await safeAsync(async()=>child.caches?{names:await child.caches.keys(),note:'Cache Storage名のみ。HTTPキャッシュ内容や利用の証明ではない。'}:'APIなし')};
}
function attach(child,mode){if(!current || child!==frame.contentWindow)return;
    if(mode==='instrumented'){const marker=child.document.querySelector('meta[name="grace-device-run"]');if(!marker || marker.content!==current.id)return;}
    if(observer)observer.stop();const run=current;observer=createObserver(child,{mode,onSnapshot:snapshot=>{if(current!==run)return;stamp(snapshot);run.lastSnapshotAt=snapshot.time;}});run.environmentExtras={pending:true};environmentExtras(child).then(r=>{if(current===run)run.environmentExtras=r;});}
window.__graceDeviceAttach=child=>attach(child,'instrumented');
window.__graceDeviceScope=(child,scope)=>{if(child===frame.contentWindow && observer)observer.setScope(scope);};
async function fileEvidence(run,seed){
    const ref=await safeAsync(async()=>{const r=await fetch('./local-reference.json',{cache:'no-store'});if(!r.ok)throw Error('ローカル比較用一覧を取得できません');return r.json();});run.localReference=ref;
    const list=await Promise.all(assetPaths.map(async path=>{try{const a=seed && seed[path] || await fetchAsset(path,run.mode);const row=publicAsset(a),expected=ref && ref.files && ref.files.find(f=>f.path===path);row.matchesLocalReference=expected && row.sha256?row.sha256===expected.sha256:null;row.matchesNormalizedLocalText=expected && row.normalizedTextSha256?row.normalizedTextSha256===expected.normalizedTextSha256:null;row.matchesDevReference=expected && expected.devSha256 && row.sha256?row.sha256===expected.devSha256:null;return row;}catch(e){return {path,error:String(e.message || e)};}}));run.assets=list;run.evidenceComplete=true;
}
function stop(){if(observer){if(current)current.observation=observer.read();observer.stop();observer=null;}frame.onload=null;frame.src='about:blank';frame.removeAttribute('srcdoc');blobs.splice(0).forEach(u=>URL.revokeObjectURL(u));}
async function start(mode){
    const token=++generation;stop();$('launchStatus').textContent='診断入口を準備中';$('normal').disabled=true;$('instrumented').disabled=true;
    current={id:Date.now()+'-'+token,mode,started:new Date().toISOString(),appUrl:appUrl.href,diagnosticUrl:location.href,version:DIAGNOSTIC_VERSION,assets:[],evidenceComplete:false,viewingAssessment:'unknown',runToken:null,
        limitations:['iframeで開くため、直接アプリを開いた場合のviewport・referrer等と差があり得る。','画面の見た目はユーザーのスクリーンショットと照合する。','PCの結果はFire/AQUOSの取得結果として扱わない。']};current.runToken=current.id;runs.push(current);
    const run=current;
    try{
        if(appUrl.origin!==location.origin)throw Error('同一originのdev配信だけを対象にしてください');
        if(mode==='normal'){
            frame.onload=()=>{if(token!==generation)return;try{if(frame.contentWindow.location.href==='about:blank')return;attach(frame.contentWindow,'normal');observer.capture('通常配信の初期記録（EXを開く前の場合あり）');fileEvidence(run).catch(e=>run.evidenceError=String(e));}catch(e){run.error=String(e.message || e);$('launchStatus').textContent='観測できません：'+run.error;}};frame.src=appUrl.href;
            run.loadedCodeProof='元のindex.htmlをそのままiframeで開く。再取得ハッシュは実行済みモジュールの証明と区別する。';
        }else{
            const fetched=await Promise.all(['index.html','js/app.js','js/graceNotation.js'].map(p=>fetchAsset(p,'instrumented')));
            if(token!==generation)return;if(fetched.some(a=>a.status!==200))throw Error('公開HTML/JSの取得に失敗しました');const seed={};fetched.forEach(a=>seed[a.path]=a);
            const html=new TextDecoder().decode(seed['index.html'].bytes),documentCopy=new DOMParser().parseFromString(html,'text/html'),appModuleUrl=new URL('js/app.js',baseUrl).href;
            if(documentCopy.querySelector('base'))throw Error('既存base要素があるため診断起動を見送り');
            const entries=Array.from(documentCopy.querySelectorAll('script[type="module"][src]')).filter(s=>new URL(s.getAttribute('src'),appUrl).href===appModuleUrl);if(entries.length!==1)throw Error('app.jsの入口を一意に特定できません');
            const graceBlob=objectUrl(seed['js/graceNotation.js'].bytes,'text/javascript'),built=instrumentModule(new TextDecoder().decode(seed['js/app.js'].bytes),appModuleUrl,graceBlob),appBlob=objectUrl(built.source,'text/javascript');entries[0].setAttribute('src',appBlob);
            const base=documentCopy.createElement('base');base.href=baseUrl.href;documentCopy.head.prepend(base);const marker=documentCopy.createElement('meta');marker.name='grace-device-run';marker.content=run.id;base.after(marker);const early=documentCopy.createElement('script');early.textContent='parent.__graceDeviceAttach(window);';marker.after(early);
            run.instrumentation={importsRebased:built.imports,graceImports:built.graceImports,originalAppSha256:seed['js/app.js'].sha256,executedAppSha256:await sha256(new TextEncoder().encode(built.source),window.crypto),graceBytesUnchanged:true,originalHtmlSha256:seed['index.html'].sha256,
                changes:['HTMLのbaseと早期エラー観測を診断メモリー内で追加','app.jsのimportを元URLへ解決し、graceNotationは取得した原本bytesのBlobを使用','app.js末尾へ既存serviceの観測開始を追加'],note:'通常入口との起動条件差あり。描画ロジックの修正ではない。CSPがBlob/srcdocを拒否する場合は動作しない。'};
            frame.onload=()=>{if(token!==generation)return;const marker=frame.contentDocument.querySelector('meta[name="grace-device-run"]');if(!marker || marker.content!==run.id)return;if(observer)observer.capture('詳細入口の初期読込後');else{run.error='観測初期化を確認できません。CSP/iframe制約や初期JSエラーを確認してください。';$('recordStamp').textContent=run.error;}};
            frame.srcdoc='<!doctype html>\n'+documentCopy.documentElement.outerHTML;run.loadedCodeProof='app/graceNotationの原本応答hashを記録。graceNotationの実行bytesは原本と同一。appは観測用追記・import URL変更あり。';fileEvidence(run,seed).catch(e=>run.evidenceError=String(e));
        }
        $('intro').hidden=true;frame.hidden=false;$('toolbar').hidden=false;$('results').hidden=true;$('visual').value='unknown';$('recordStamp').textContent='アプリ内でソロギターEX1を開いてください';$('launchStatus').textContent='起動中';
    }catch(e){run.error=String(e.message || e);$('launchStatus').textContent='起動できません：'+run.error;}
    finally{$('normal').disabled=false;$('instrumented').disabled=false;}
}
function report(){const data=observer?observer.read():current && current.observation || null,latest=data && data.snapshots.length?data.snapshots[data.snapshots.length-1]:null;
    return {schema:'grace-device-diagnostic-v1',createdAt:new Date().toISOString(),diagnosticVersion:DIAGNOSTIC_VERSION,classification:'F：原因未確定。実機・PCログと目視を照合して判断する。',run:current,
        currentVisualAssessment:$('visual').value,latestSnapshot:latest,observation:data?{mode:data.mode,started:data.started,events:data.events,errors:data.errors,snapshotIndex:data.snapshots.map(s=>({id:s.id,time:s.time,reason:s.reason,counts:s.counts,owner:s.owner}))}:null,
        previousRuns:runs.filter(r=>r!==current).map(r=>({id:r.id,mode:r.mode,started:r.started,assets:r.assets,errors:r.observation && r.observation.errors,snapshotIndex:r.observation?r.observation.snapshots.map(s=>({id:s.id,time:s.time,reason:s.reason,counts:s.counts})):[]})),
        ui:{resultPanelOpen:!$('results').hidden,toolbarRect:rectangleForUi($('toolbar').getBoundingClientRect()),note:'親ページの診断バーがアプリに重なる。DOMの表示候補と実際の目視は別に記録。'},
        caveat:'実機ログ未取得をPCの正常値で補完しない。hashは証拠レベルを確認し、同じファイル名だけでコード一致としない。'};
}
function rectangleForUi(b){return {x:b.x,y:b.y,width:b.width,height:b.height};}
function showResults(){const r=report();$('output').value=JSON.stringify(r,null,2);const s=r.latestSnapshot;$('summary').textContent=s?'記録 #'+s.id+' '+s.time+' / '+(current.mode==='normal'?'通常配信':'詳細入口')+' / 元SVG flag '+s.counts.source.flag+' / 全カード flag '+s.counts.cards.flag+'。目視：'+$('visual').selectedOptions[0].textContent:'まだ記録がありません。アプリでEX1を開いて「記録」を押してください。';$('health').textContent=JSON.stringify({runError:current && current.error,evidenceComplete:current && current.evidenceComplete,serviceObservation:s && s.observation,fonts:s && s.environment.fonts,errors:s && s.errors},null,2);$('results').hidden=false;}
$('normal').onclick=()=>start('normal');$('instrumented').onclick=()=>start('instrumented');
$('record').onclick=()=>{if(!observer){$('recordStamp').textContent='観測準備ができていません。「結果」を確認してください。';return;}current.viewingAssessment=$('visual').value;const s=observer.capture('ユーザーの記録ボタン（描画を要求しない）');if(s)s.userVisualAssessment=$('visual').value;};
$('showResults').onclick=showResults;$('back').onclick=()=>{$('results').hidden=true;};$('exit').onclick=()=>{generation++;stop();frame.hidden=true;$('toolbar').hidden=true;$('results').hidden=true;$('intro').hidden=false;};
$('selectText').onclick=()=>{$('output').focus();$('output').select();$('output').setSelectionRange(0,$('output').value.length);$('copyStatus').textContent='全選択しました。長押しメニューからコピーできます。';};
$('copy').onclick=async()=>{try{if(!navigator.clipboard || !navigator.clipboard.writeText)throw Error('Clipboard APIなし');await navigator.clipboard.writeText($('output').value);$('copyStatus').textContent='コピーしました。スクリーンショットと一緒に送ってください。';}catch(e){$('output').focus();$('output').select();$('output').setSelectionRange(0,$('output').value.length);let copied=false;try{copied=document.execCommand('copy');}catch(ignore){}$('copyStatus').textContent=copied?'コピーしました。':'自動コピーできません。選択済みテキストを長押しコピーするか、JSONを保存してください。';}};
$('download').onclick=()=>{const u=objectUrl($('output').value,'application/json'),a=document.createElement('a');a.href=u;a.download='grace-device-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';a.click();};
window.graceDeviceDiagnostic={start,report,capture:()=>observer && observer.capture('PC診断テストからの観測'),ready:()=>!!observer};
window.addEventListener('pagehide',()=>{generation++;stop();});
