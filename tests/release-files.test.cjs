const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),modulePromise=import(pathToFileURL(path.join(root,'scripts/release-files.mjs')).href);
test('公開定義は実際の78教材・290参照譜面と静的依存グラフに一致する',async()=>{
 const {collectReleaseFiles}=await modulePromise,actual=collectReleaseFiles(),saved=JSON.parse(fs.readFileSync(path.join(root,'deployment/public-files.json'),'utf8'));
 assert.deepEqual(actual,saved);assert.equal(actual.lessonCount,78);assert.equal(actual.scoreCount,410);
 assert.deepEqual(Object.values(actual.lessonCounts),[3,10,3,24,8,10,20]);
});
test('公開対象は必要モジュールとライセンスを含み、開発コード・fixture・秘密ディレクトリを含まない',async()=>{
 const {files}= (await modulePromise).collectReleaseFiles(),names=files.map(f=>f.path);
 for(const name of ['index.html','css/style.css','js/modalFocus.js','js/capoPositionNotation.js','js/chordTonePractice.js','js/practiceProgress.js','js/config/chordTones.js','THIRD-PARTY-NOTICES.txt'])assert.ok(names.includes(name),name);
 for(const name of names)assert.doesNotMatch(name,/^(?:\.git|tests|scripts|diagnostics|deployment|node_modules)\//);
 assert.equal(names.filter(n=>n.startsWith('licenses/')).length,4);assert.equal(new Set(names).size,names.length);
});
test('未参照の開発譜面は除外し、元ファイルは残す',async()=>{
 const report=(await modulePromise).collectReleaseFiles(),names=new Set(report.files.map(f=>f.path));
 for(const name of ['scores/chord_tones/maj7-c-form-c.mxl','scores/chord_tones/maj7-d-form-e.mxl','scores/scale/major-c-form-c.mxl','scores/scale/major-d-form-e.mxl']){
  assert.equal(fs.existsSync(path.join(root,name)),true);assert.equal(names.has(name),false);assert.ok(report.excludedExistingFiles.includes(name));
 }
 assert.ok(report.excludedDirectoryPrefixes.includes('.git/'));assert.ok(report.excludedExistingFiles.includes('tests/vendor/alphaTab-1.8.4.cjs'));
});
