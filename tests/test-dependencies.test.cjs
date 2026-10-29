const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { dependency, alphaFile, verifyAlphaTab, loadAlphaTab } = require('./helpers/alpha-tab.cjs');

test('プロジェクト内のalphaTabは固定SHA-256・1.8.4 build 34に一致し、元の権利表記を維持', () => {
    assert.equal(dependency.version, '1.8.4'); assert.equal(dependency.build, 34);
    assert.equal(verifyAlphaTab(fs.readFileSync(alphaFile)), true);
    const text = fs.readFileSync(alphaFile, 'utf8');
    assert.match(text.slice(0, 300), /Mozilla Public/); assert.match(text, /Integrated Libraries/);
    assert.equal(loadAlphaTab().meta.version, '1.8.4'); assert.equal(loadAlphaTab(), loadAlphaTab());
});
test('改変されたテスト依存は実行せず拒否する', () => {
    const broken = Buffer.from(fs.readFileSync(alphaFile)); broken[broken.length - 1] ^= 1;
    assert.throws(() => verifyAlphaTab(broken), /SHA-256 mismatch/);
    assert.throws(() => verifyAlphaTab(Buffer.from('alphaTab v1.8.4 build 34')), /SHA-256 mismatch/);
});
test('テスト依存の欠落はskipや一時キャッシュへのフォールバックにせず、取得手順を示して失敗する', () => {
    const helper = fs.readFileSync(path.join(__dirname, 'helpers/alpha-tab.cjs'), 'utf8');
    const fakeRequire = name => name === 'node:fs' ? { existsSync: () => false } : name === '../dependencies.json' ? { alphaTab: dependency } : require(name);
    const context = { require: fakeRequire, __dirname: path.join(__dirname, 'helpers'), module: { exports: {} } };
    vm.runInNewContext(helper, context);
    assert.throws(() => context.module.exports.loadAlphaTab(), /npm run test:setup/);
    assert.doesNotMatch(helper, /tmpdir|process\.env|fetch\(|https\.get|skip\(/);
});
test('8テストは共有ローダーを使い、調査フォルダ・一時キャッシュがなくても監視を継続する', () => {
    for (const name of ['chord-practice', 'chromatic-patterns', 'chromatic', 'grace-labels', 'grace-notation', 'grace-slur', 'grace-symbols', 'rhythm-display']) {
        const text = fs.readFileSync(path.join(__dirname, name + '.test.cjs'), 'utf8');
        assert.match(text, /helpers\/alpha-tab\.cjs/); assert.doesNotMatch(text, /notation-lab-alphaTab|alphaTab調査|t\.skip\(/);
    }
});
