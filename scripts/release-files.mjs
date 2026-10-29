// Inventory only. Never copies, deletes, builds or deploys a public directory.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { TUTORIAL_STAGES, BASIC_STAGES, SOLO_STAGES, CHROMATIC_STAGES, CHORD_STAGES, SCALE_STAGES, CHORD_TONE_STAGES } from '../js/config.js';
import { getScaleVariant } from '../js/config/scales.js';
import { getChordToneVariant } from '../js/config/chordTones.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const definition = 'deployment/public-files.json';
const licenses = ['THIRD-PARTY-NOTICES.txt', 'licenses/alphaTab-1.8.4-LICENSE.txt',
    'licenses/alphaTab-1.8.4-LICENSE.header.txt', 'licenses/Bravura-OFL.txt', 'licenses/JSZip-3.10.1-LICENSE.txt'];
const groups = { tutorial: TUTORIAL_STAGES, basic: BASIC_STAGES, solo: SOLO_STAGES,
    chromatic: CHROMATIC_STAGES, chords: CHORD_STAGES, scales: SCALE_STAGES, 'chord-tones': CHORD_TONE_STAGES };
const slash = p => p.split(path.sep).join('/');
const deny = p => /^(?:\.git|tests|scripts|diagnostics|deployment|node_modules)(?:\/|$)/.test(p);

export function collectReleaseFiles() {
    const selected = new Map(), external = new Set(), pending = [];
    function add(name, role) {
        const full = path.resolve(root, name), rel = slash(path.relative(root, full));
        if (!rel || rel.startsWith('../') || path.isAbsolute(rel) || deny(rel)) throw Error('Unsafe release path: ' + name);
        if (!fs.statSync(full).isFile()) throw Error('Missing release file: ' + rel);
        const real = slash(path.relative(fs.realpathSync(root), fs.realpathSync(full)));
        if (real.startsWith('../') || path.isAbsolute(real)) throw Error('Release file escapes project: ' + rel);
        if (!selected.has(rel)) { selected.set(rel, role); pending.push(rel); }
    }
    function reference(value, owner, role) {
        if (/^https?:/.test(value)) { external.add(value); return; }
        if (/^(?:data:|#)/.test(value)) return;
        if (/^[a-z]+:/i.test(value)) throw Error('Unsupported asset URL: ' + value);
        add(path.join(path.dirname(owner), value.split(/[?#]/)[0]), role);
    }
    add('index.html', 'entry');
    for (const stage of Object.values(groups).flat()) add(stage.file, 'score');
    for (const stage of SCALE_STAGES) for (const v of stage.variants) add(getScaleVariant(stage, v.keyId, v.positionId).file, 'score');
    for (const stage of CHORD_TONE_STAGES) for (const v of stage.variants) add(getChordToneVariant(stage, v.rootId, v.positionId).file, 'score');
    for (const license of licenses) add(license, 'license');
    while (pending.length) {
        const name = pending.shift(), text = /\.(?:html|css|js)$/.test(name) ? fs.readFileSync(path.join(root, name), 'utf8') : '';
        if (name.endsWith('.html')) {
            for (const m of text.matchAll(/<(?:script|link|img|source)\b[^>]*\b(?:src|href)=["']([^"']+)["']/g)) reference(m[1], name, /\.css(?:[?#]|$)/.test(m[1]) ? 'style' : 'runtime');
        }
        if (name.endsWith('.js')) {
            if (/\bimport\s*\(/.test(text)) throw Error('Dynamic import needs explicit inventory review: ' + name);
            for (const m of text.matchAll(/(?:import\s+(?:[^;]*?\s+from\s*)?|export\s+(?:\{[^}]*\}|\*)\s+from\s*)["']([^"']+)["']/g)) reference(m[1], name, 'module');
        }
        if (name.endsWith('.css')) for (const m of text.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g)) reference(m[1], name, 'asset');
    }
    const all = new Set([definition]);
    function walk(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.name === '.git') continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (entry.isFile()) all.add(slash(path.relative(root, full)));
        }
    }
    walk(root);
    const files = [...selected].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([name, role]) => ({ path: name, role,
        sha256: createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex') }));
    const excluded = [...all].filter(name => !selected.has(name)).sort();
    return { schema: 'guitar-practice-public-files-v1', purpose: 'File selection only; no public directory was updated',
        lessonCounts: Object.fromEntries(Object.entries(groups).map(([name, stages]) => [name, stages.length])),
        lessonCount: Object.values(groups).flat().length, scoreCount: files.filter(f => f.role === 'score').length,
        fileCount: files.length, files, excludedFileCount: excluded.length, excludedExistingFiles: excluded,
        excludedDirectoryPrefixes: ['.git/', 'tests/', 'scripts/', 'diagnostics/', 'deployment/', 'node_modules/'],
        externalScripts: [...external].sort(),
        externalRuntimeNotes: ['alphaTab resolves its Bravura font from its CDN directory at runtime; it is not a local asset.',
            'YouTube iframe is created only when a guide video is opened. Contact/YouTube links remain external.',
            'Library versions, SRI/CSP and hosting rules were not modified; production access restrictions are unverified.'] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    const report = collectReleaseFiles();
    if (process.argv.slice(2).length && !(process.argv.length === 3 && process.argv[2] === '--write')) throw Error('Usage: npm run release:list or npm run release:refresh-list');
    if (process.argv[2] === '--write') {
        fs.mkdirSync(path.join(root, 'deployment'), { recursive: true });
        fs.writeFileSync(path.join(root, definition), JSON.stringify(report, null, 2) + '\n');
        console.log(`${report.lessonCount} lessons / ${report.scoreCount} referenced scores / ${report.fileCount} public files. Definition saved; public folder unchanged.`);
    } else console.log(JSON.stringify(report, null, 2));
}
