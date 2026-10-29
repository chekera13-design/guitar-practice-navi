// Explicit setup only. Normal tests never download anything.
const fs = require('node:fs'), path = require('node:path');
const { dependency, alphaFile, verifyAlphaTab } = require('../tests/helpers/alpha-tab.cjs');
async function main() {
    if (fs.existsSync(alphaFile)) {
        verifyAlphaTab(fs.readFileSync(alphaFile));
        console.log('Verified existing alphaTab 1.8.4 build 34; no network request.');
        return;
    }
    const args = process.argv.slice(2);
    if (args.length && !(args.length === 2 && args[0] === '--source')) throw Error('Usage: npm run test:setup [-- --source <local-file>]');
    let bytes;
    if (args[0] === '--source') bytes = fs.readFileSync(path.resolve(args[1]));
    else {
        const response = await fetch(dependency.url, { signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw Error('Dependency download failed: HTTP ' + response.status);
        bytes = Buffer.from(await response.arrayBuffer());
    }
    verifyAlphaTab(bytes); // Verify before writing or requiring downloaded code.
    fs.mkdirSync(path.dirname(alphaFile), { recursive: true });
    fs.writeFileSync(alphaFile, bytes, { flag: 'wx' });
    console.log('Installed verified alphaTab 1.8.4 build 34 for offline tests.');
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { main };
