const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
module.exports = {
    ...vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../js/practiceFormLabels.js'), 'utf8').replace(/^export /gm, '') + '\n({getPracticeFormLabel});'),
    ...vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../js/keyDisclosure.js'), 'utf8').replace(/^export /gm, '') + '\n({createKeyDisclosure});'),
    ...vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../js/practicePositions.js'), 'utf8').replace(/^export /gm, '') + '\n({sortPracticePositions,resolvePracticePosition});')
};
