const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
// Use the actual standalone control/scheduler with the existing controllable audio clock.
const source=fs.readFileSync(path.join(__dirname,'standalone-metronome.test.cjs'),'utf8');
const make=vm.runInNewContext(source.slice(0,source.indexOf("test('開始関数"))+'\nharness;',{require,__dirname,Blob});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≈ ${b}`);
function suspended(h,to){
 h.c.audioContext.currentTime=to;
 // Unlike advance(), overdue callbacks all observe the CURRENT time after a stall.
 let count=0;
 while(true){const next=[...h.timers].filter(([,v])=>v.at<=to+1e-10).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;
  assert.ok(++count<100,'resume must not drain a backlog of per-beat callbacks');h.timers.delete(next[0]);next[1].fn();
 }
}
for(const [bpm,now,first,index]of [[60,3.4,4.05,4],[200,3.2,3.35,11],[70,8.7,0.05+11*60/70,11]]){
 test(`${bpm} BPM: skip missed beats after suspension and preserve grid/accent`,async()=>{
  const h=make({bpm});await h.c.startStandaloneMetronome();suspended(h,now);
  assert.equal(h.ticks.length,1,'no missed audio ticks are scheduled on wake');assert.equal(h.updates.length,0,'no old beat flashes on wake');
  near(h.read('standaloneNextTickTime'),first);assert.equal(h.read('standaloneBeat'),index);
  h.advance(first+60/bpm*4+.02);const ticks=h.ticks.slice(1);assert.equal(ticks.length,5);
  ticks.forEach((t,i)=>{near(t.time,first+i*60/bpm);assert.equal(t.accent,(index+i)%4===0);});
  assert.deepEqual(Array.from(h.updates,u=>u[0]),Array.from({length:5},(_,i)=>(index+i)%4+1));
  assert.equal(h.audioRequests(),1);assert.equal(h.timers.size,1);h.c.stopStandaloneMetronome();assert.equal(h.timers.size,0);
 });
}
test('exact 200 BPM beat boundary is not skipped by floating-point rounding',async()=>{
 const h=make({bpm:200});await h.c.startStandaloneMetronome();suspended(h,3.35);
 assert.equal(h.ticks.length,2);near(h.ticks[1].time,3.35);assert.equal(h.ticks[1].accent,false);
 assert.equal(h.read('standaloneBeat'),12);near(h.read('standaloneNextTickTime'),3.65);
 assert.deepEqual(Array.from(h.updates,u=>u[0]),[4]);h.c.stopStandaloneMetronome();
});
test('normal 30ms jitter keeps a single due beat within the existing 50ms tolerance',async()=>{
 const h=make({bpm:200});await h.c.startStandaloneMetronome();h.advance(.06);suspended(h,.38);
 assert.equal(h.ticks.length,2);near(h.ticks[1].time,.35);assert.equal(h.updates.at(-1)[0],2);
 near(h.read('standaloneNextTickTime'),.65);h.c.stopStandaloneMetronome();
});
test('ten-minute suspension uses one resumed scheduler and keeps the correct beat number',async()=>{
 const h=make({bpm:200});await h.c.startStandaloneMetronome();suspended(h,600.2);
 assert.equal(h.ticks.length,1);assert.equal(h.read('standaloneBeat'),2001);near(h.read('standaloneNextTickTime'),600.35);
 assert.equal(h.timers.size,1);h.advance(600.37);assert.equal(h.ticks.length,2);assert.equal(h.updates.at(-1)[0],2);
 assert.equal(h.audioRequests(),1);h.c.stopStandaloneMetronome();
});
test('a delayed display callback does not flash an obsolete beat before scheduler recovery',async()=>{
 const h=make();await h.c.startStandaloneMetronome();const [id,timer]=[...h.timers].find(([,t])=>Math.abs(t.at-.05)<1e-8);
 h.c.audioContext.currentTime=3.4;h.timers.delete(id);timer.fn();assert.equal(h.updates.length,0);
 suspended(h,3.4);h.advance(4.07);assert.deepEqual(Array.from(h.updates,u=>u[0]),[1]);h.c.stopStandaloneMetronome();
});
for(const beforeScheduler of [true,false])test(`tempo change ${beforeScheduler?'before':'after'} recovery preserves missed-beat count and fractional phase`,async()=>{
 const h=make();await h.c.startStandaloneMetronome();
 if(beforeScheduler)h.c.audioContext.currentTime=3.4;else suspended(h,3.4);
 h.c.changePracticeTempo(5);near(h.read('standaloneNextTickTime'),4);assert.equal(h.read('standaloneBeat'),4);
 if(beforeScheduler)suspended(h,3.4);
 h.advance(4.02);assert.equal(h.ticks.length,2);near(h.ticks[1].time,4);assert.equal(h.ticks[1].accent,true);assert.equal(h.updates.at(-1)[0],1);
 h.advance(5);near(h.ticks[2].time-h.ticks[1].time,60/65);assert.equal(h.audioRequests(),1);h.c.stopStandaloneMetronome();
});
test('tempo change after recovery retains the already reserved upcoming accent exactly once',async()=>{
 const h=make();await h.c.startStandaloneMetronome();suspended(h,3.99);
 assert.equal(h.ticks.length,2);near(h.ticks[1].time,4.05);assert.equal(h.ticks[1].accent,true);
 h.c.changePracticeTempo(5);near(h.read('standaloneNextTickTime'),4.05+60/65);
 h.advance(5.1);assert.equal(h.ticks.filter(t=>Math.abs(t.time-4.05)<1e-8).length,1);near(h.ticks[2].time,4.05+60/65);
 assert.deepEqual(Array.from(h.updates,u=>u[0]),[1,2]);h.c.stopStandaloneMetronome();
});
test('stop/restart after a stall rejects old callbacks and restarts at beat 1 of the new meter',async()=>{
 const h=make({bpm:200});await h.c.startStandaloneMetronome();const stale=[...h.timers.values()].map(t=>t.fn);
 suspended(h,3.2);h.c.stopStandaloneMetronome();assert.equal(h.timers.size,0);assert.equal(h.sounds.size,0);
 h.c.currentBpm=120;h.c.currentStage={bpm:120,timeSignature:[3,4]};await h.c.startStandaloneMetronome();
 const timer=h.read('standaloneMetroTimerId'),count=h.ticks.length;stale.forEach(fn=>fn());assert.equal(h.read('standaloneMetroTimerId'),timer);assert.equal(h.ticks.length,count);
 h.advance(4.8);assert.deepEqual(Array.from(h.ticks.slice(count-1),t=>t.accent),[true,false,false,true]);
 h.c.stopStandaloneMetronome();assert.equal(h.timers.size,0);
});
test('repeated stalls retain one audio context/scheduler without accumulating audio/display backlog',async()=>{
 const h=make({bpm:200});await h.c.startStandaloneMetronome();
 for(const now of [3.2,7.1,20.04]){const n=h.ticks.length;suspended(h,now);assert.ok(h.ticks.length-n<=1);assert.ok(h.timers.size<=2);
  assert.ok(h.read('standaloneNextTickTime')>=now-.000001);assert.ok(h.ticks.slice(n).every(t=>t.time>=now-.05));}
 assert.equal(h.audioRequests(),1);h.c.stopStandaloneMetronome();assert.equal(h.timers.size,0);
});
