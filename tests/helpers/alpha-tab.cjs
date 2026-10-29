// Test-only dependency. Never read an individual's TEMP cache or fetch at test time.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const dependency = Object.freeze(require('../dependencies.json').alphaTab);
const alphaFile = path.resolve(__dirname, '../..', dependency.file);
function verifyAlphaTab(bytes) {
    if (crypto.createHash('sha256').update(bytes).digest('hex') !== dependency.sha256)
        throw Error('alphaTab test dependency SHA-256 mismatch; restore the pinned file with npm run test:setup.');
    const header = bytes.toString('utf8', 0, 200);
    if (!header.includes('alphaTab v' + dependency.version) || !header.includes('build ' + dependency.build))
        throw Error('Unexpected alphaTab version/build.');
    return true;
}
let cached;
function loadAlphaTab() {
    if (cached) return cached;
    if (!fs.existsSync(alphaFile)) throw Error('Missing project-local alphaTab test dependency. Run node scripts/setup-test-dependencies.cjs (or npm run test:setup) once, or include tests/vendor in the development copy.');
    verifyAlphaTab(fs.readFileSync(alphaFile));
    const alpha = require(alphaFile);
    if (alpha.meta.version !== dependency.version) throw Error('Unexpected alphaTab runtime version.');
    cached = alpha;
    return alpha;
}
module.exports = { dependency, alphaFile, verifyAlphaTab, loadAlphaTab, get alpha() { return loadAlphaTab(); } };
