const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'../../js',name),'utf8').replace(/^export /gm,'');
const beats=vm.runInNewContext(read('metronomeBeatDisplay.js')+'\n({metronomeBeatCount,syncMetronomeBeatDisplay});');
const viewport=vm.runInNewContext(read('tupletScoreViewport.js')+'\n({heightCandidate,measureTupletViewport,createTupletScoreViewport});');
module.exports={...beats,...viewport};
