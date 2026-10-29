const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
module.exports = vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '../../js/practiceProgress.js'), 'utf8').replace(/^export /gm, '')
    + '\n({createPracticeProgress, PRACTICE_COUNT_STORAGE_KEY});'
);
