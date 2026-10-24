// Passive observation only: no app setters, clocks, styles, playback, or scores are changed.
const $=id=>document.getElementById(id), frame=$('app');
let active=null, result=null;
const stats=a=>{const b=a.slice().sort((x,y)=>x-y);return {count:b.length,mean:b.length?a.reduce((x,y)=>x+y,0)/b.length:null,p50:b.length?b[Math.floor(b.length*.5)]:null,p95:b.length?b[Math.floor(b.length*.95)]:null,max:b.length?b[b.length-1]:null};};
function finish(reason='user'){
  const s=active;if(!s)return;
  active=null;s.w.cancelAnimationFrame(s.raf);s.w.clearTimeout(s.timeout);s.observer?.disconnect();
  s.w.document.removeEventListener('visibilitychange',s.visibility);s.w.removeEventListener('resize',s.resize);
  const rows=s.rows,dt=[],audio=[],dx=[],moving=[];
  for(let i=1;i<rows.length;i++){
    const a=rows[i-1],b=rows[i];if(a.left<=5||b.left>=s.maxScroll-5)continue;
    dt.push(b.time-a.time);if(a.audio!==null&&b.audio!==null)audio.push((b.audio-a.audio)*1000);dx.push(b.left-a.left);moving.push(b);
  }
  result={schema:'score-scroll-performance-v1',createdAt:new Date().toISOString(),reason,mode:s.mode,environment:s.environment,
    geometry:s.geometry,stage:s.stage,frameIntervalMs:stats(dt),gapsOver25ms:dt.filter(v=>v>25).length,gapsOver50ms:dt.filter(v=>v>50).length,
    audioStepMs:stats(audio),unchangedAudioFrames:audio.filter(v=>v===0).length,scrollStepPx:stats(dx),unchangedScrollFrames:dx.filter(v=>v===0).length,
    longTasks:s.tasks,events:s.events,rows};
  $('start').disabled=false;$('stop').disabled=true;$('save').disabled=false;$('tools').classList.remove('measuring');
  $('status').textContent=`終了：${dt.length}フレーム、25ms超 ${result.gapsOver25ms}回。ログを保存してください。`;
}
$('start').onclick=async()=>{
  if(active)return;const w=frame.contentWindow,d=w.document,wrapper=d.querySelector('.score-wrapper');
  if(!wrapper||d.getElementById('practiceModal')?.classList.contains('hidden')){$('status').textContent='先に基礎編EX5を開いてください。';return;}
  if(d.getElementById('practiceModal')?.classList.contains('vertical-tab-active')){$('status').textContent='横型TABで計測してください。スマホは横向きにしてください。';return;}
  let engine;try{engine=await w.eval('import('+JSON.stringify(new URL('../js/audioEngine.js',location.href).href)+')');}catch(e){$('status').textContent='音声時計の取得に失敗：'+e.message;return;}
  const initial=wrapper.scrollLeft;
  const s=active={w,engine,mode:$('mode').value,rows:[],events:[],tasks:[],raf:null,timeout:null,began:null,lastLeft:initial,maxScroll:wrapper.scrollWidth-wrapper.clientWidth,
    geometry:{clientWidth:wrapper.clientWidth,scrollWidth:wrapper.scrollWidth,clientHeight:wrapper.clientHeight},
    stage:d.getElementById('modalStageTitle')?.textContent,
    environment:{userAgent:w.navigator.userAgent,platform:w.navigator.userAgentData?.platform,width:w.innerWidth,height:w.innerHeight,dpr:w.devicePixelRatio,
      orientation:w.matchMedia('(orientation:landscape)').matches?'landscape':'portrait',deviceMemory:w.navigator.deviceMemory,hardwareConcurrency:w.navigator.hardwareConcurrency,url:w.location.href,viewportWidth:w.visualViewport?.width}};
  s.visibility=()=>s.events.push({type:'visibility',time:w.performance.now(),state:d.visibilityState});
  s.resize=()=>{s.events.push({type:'resize',time:w.performance.now(),width:w.innerWidth,height:w.innerHeight});finish('resize');};
  d.addEventListener('visibilitychange',s.visibility);w.addEventListener('resize',s.resize);
  try{s.observer=new w.PerformanceObserver(list=>{for(const e of list.getEntries())s.tasks.push({start:e.startTime,duration:e.duration});});s.observer.observe({type:'longtask',buffered:false});}catch{}
  function tick(time){
    if(active!==s)return;
    const left=wrapper.scrollLeft,a=engine.audioContext;
    if(s.began===null&&Math.abs(left-s.lastLeft)>.01){s.began=time;Object.assign(s.environment,{sampleRate:a?.sampleRate,audioState:a?.state,baseLatency:a?.baseLatency,outputLatency:a?.outputLatency});$('status').textContent='計測中：約30秒。画面の向き・倍率を保ってください。';}
    s.lastLeft=left;
    if(s.began!==null){s.rows.push({time,left,audio:a?.state==='running'?a.currentTime:null});if(time-s.began>=30000){finish('30-seconds');return;}}
    s.raf=w.requestAnimationFrame(tick);
  }
  s.timeout=w.setTimeout(()=>finish('90-second-timeout'),90000);s.raf=w.requestAnimationFrame(tick);
  $('start').disabled=true;$('stop').disabled=false;$('save').disabled=true;$('tools').classList.add('measuring');$('status').textContent='待機中。EX5の練習を開始してください。';
};
$('stop').onclick=()=>finish();
$('save').onclick=()=>{if(!result)return;const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='EX5-scroll-'+result.mode+'-'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
frame.addEventListener('load',()=>{if(active)finish('app-reloaded');});
window.addEventListener('pagehide',()=>finish('page-hidden'));
