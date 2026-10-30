export const PRACTICE_COUNT_STORAGE_KEY = "chogita_practice_counts_v1";

// 同じ保存キーの更新だけを直列化する。非対応環境では同期更新し、順次保存を保護する。
// ロック取得や保存が失敗した場合、無排他の書き直しはせず未保存分を呼び出し元に残す。
export function createProgressWriter(storageKey, write, hasPending, environment = globalThis) {
    let running = null, error = null;
    function attempt() {
        try { write(); error = null; return true; }
        catch (err) { error = err; return false; }
    }
    function flush() {
        if (running) return running;
        if (!hasPending()) return Promise.resolve(true);
        try {
            const locks = environment.navigator?.locks;
            if (!locks?.request) return Promise.resolve(attempt());
            running = Promise.resolve(locks.request(storageKey, attempt)).then(ok => {
                running = null;
                // ロック解放までの間に新しい完走分が加わった場合も取りこぼさない。
                return ok && hasPending() ? flush() : ok;
            }, err => { running = null; error = err; return false; });
            return running;
        } catch (err) { error = err; return Promise.resolve(false); }
    }
    return { flush, get error() { return error; } };
}

// 既存セッションの音声時刻を観測するだけで、タイマーや音声処理は持たない。
export function createPracticeProgress(groups, getStorage = () => globalThis.localStorage, environment = globalThis) {
    const keys = new Map(), allowed = new Set(), counts = Object.create(null), scaleForms = new Map(), chordToneForms = new Map();
    for (const category of ["chromatic", "chords", "basic", "solo", "tutorial"]) {
        for (const stage of groups[category] || []) {
            if (!Number.isSafeInteger(stage.id) || stage.id < 1) continue;
            const key = category + "-" + stage.id;
            keys.set(stage, key); allowed.add(key);
        }
    }
    for (const stage of groups.chromaticHorizontal || []) {
        if (stage.id !== 2 || stage.practiceType !== "chromatic-horizontal" || stage.lessonId !== "chromatic-horizontal"
            || !Number.isInteger(stage.stringNumber) || stage.stringNumber < 1 || stage.stringNumber > 6
            || typeof stage.fingering !== "string" || [...stage.fingering].sort().join("") !== "1234"
            || stage.progressId !== "chromatic-horizontal-" + stage.fingering + "-string-" + stage.stringNumber) continue;
        keys.set(stage, stage.progressId); allowed.add(stage.progressId);
    }
    for (const stage of groups.chordProgressions || []) {
        if (!Number.isSafeInteger(stage.id) || stage.id < 1 || stage.practiceType !== "chord-progression"
            || stage.lessonId !== "chord-progressions-" + stage.id
            || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(stage.variantId || "")
            || stage.progressId !== stage.lessonId + "-" + stage.variantId) continue;
        keys.set(stage, stage.progressId); allowed.add(stage.progressId);
    }
    for (const stage of groups.scales || []) {
        if (!Number.isSafeInteger(stage.id) || stage.id < 1 || stage.lessonId !== "scales-" + stage.id
            || !/^[a-z]+$/.test(stage.keyId || "") || !stage.variants?.some(v => v.keyId === stage.keyId)) continue;
        const positionId = stage.positionId || "standard";
        if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(positionId)
            || !stage.variants.some(v => v.keyId === stage.keyId && (v.positionId || "standard") === positionId)) continue;
        const key = stage.lessonId + "-" + stage.keyId + (positionId === "standard" ? "" : "-position-" + positionId);
        keys.set(stage, key); allowed.add(key);
        if (!scaleForms.has(stage.lessonId)) scaleForms.set(stage.lessonId, new Map());
        scaleForms.get(stage.lessonId).set(key, stage.keyId);
    }
    for (const stage of groups.chordTones || []) {
        if (!Number.isSafeInteger(stage.id) || stage.id < 1 || stage.lessonId !== "chord-tones-" + stage.id
            || !["maj7", "min7", "dom7", "m7b5"].includes(stage.chordTypeId) || !["C", "A", "G", "E", "D"].includes(stage.formId)
            || !/^[a-z]+$/.test(stage.rootId || "") || !stage.variants?.some(v => v.rootId === stage.rootId)) continue;
        const positionId = stage.positionId || "standard";
        if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(positionId)
            || !stage.variants.some(v => v.rootId === stage.rootId && (v.positionId || "standard") === positionId)) continue;
        const formKey = stage.chordTypeId + "-" + stage.formId.toLowerCase();
        const key = "chord-tones-" + formKey + "-" + stage.rootId + (positionId === "standard" ? "" : "-position-" + positionId);
        keys.set(stage, key); allowed.add(key);
        if (!chordToneForms.has(formKey)) chordToneForms.set(formKey, new Map());
        chordToneForms.get(formKey).set(key, stage.rootId);
    }
    const validCount = value => Number.isSafeInteger(value) && value >= 0;
    const pending = Object.create(null);
    let persisted = Object.create(null);
    function readCounts(storage) {
        const raw = storage.getItem(PRACTICE_COUNT_STORAGE_KEY);
        let saved;
        try { saved = JSON.parse(raw || "null"); } catch { return null; }
        if (saved?.version !== 1 || !saved.counts || typeof saved.counts !== "object" || Array.isArray(saved.counts)) return null;
        const result = Object.create(null);
        for (const key of allowed) if (validCount(saved.counts[key])) result[key] = saved.counts[key];
        return result;
    }
    function refreshCounts() {
        for (const key of allowed) {
            const count = Math.min(Number.MAX_SAFE_INTEGER, (persisted[key] || 0) + (pending[key] || 0));
            if (count || key in persisted || key in pending) counts[key] = count;
            else delete counts[key];
        }
    }
    try { persisted = readCounts(getStorage()) || persisted; } catch { /* 保存不能でも練習を継続する。 */ }
    refreshCounts();
    function notify(stage) {
        for (const listener of listeners) {
            try { listener(stage); } catch { /* 表示補助の失敗で練習を中断しない。 */ }
        }
    }
    const hasPending = () => Object.keys(pending).length > 0;
    const writer = createProgressWriter(PRACTICE_COUNT_STORAGE_KEY, () => {
        const storage = getStorage();
        if (!storage) throw Error("Practice storage is unavailable");
        const latest = readCounts(storage) || persisted;
        const next = { ...latest };
        for (const key of Object.keys(pending)) next[key] = Math.min(Number.MAX_SAFE_INTEGER, (latest[key] || 0) + pending[key]);
        storage.setItem(PRACTICE_COUNT_STORAGE_KEY, JSON.stringify({ version: 1, counts: next }));
        // 書き込み成功後だけ増分を消す。失敗時は次回完走・画面復帰で再試行できる。
        for (const key of Object.keys(pending)) delete pending[key];
        persisted = next;
        refreshCounts();
        notify();
    }, hasPending, environment);
    function onStorage(event) {
        try {
            if ((event.key !== PRACTICE_COUNT_STORAGE_KEY && event.key !== null) || event.storageArea !== getStorage()) return;
            // 遅延したイベントの値ではなく現在値を読む。取り込みから保存は呼ばない。
            const latest = readCounts(getStorage());
            if (latest) { persisted = latest; refreshCounts(); notify(); }
        } catch { /* 未保存分と現在の表示を維持する。 */ }
    }
    const retry = () => { if (hasPending()) void writer.flush(); };
    environment.addEventListener?.("storage", onStorage);
    environment.addEventListener?.("focus", retry);
    const observed = new WeakMap(), listeners = new Set(), sessions = new WeakMap();
    function beginSession(session) {
        if (!session || typeof session !== "object" || sessions.has(session)) return;
        sessions.set(session, { key: keys.get(session.stage), stage: session.stage });
    }
    return {
        getCount(stage) { return counts[keys.get(stage)] || 0; },
        getScaleSummary(stage) {
            let total = 0n;
            const practicedRoots = new Set();
            for (const [key, rootId] of keys.has(stage) ? scaleForms.get(stage.lessonId) || [] : []) {
                const count = counts[key] || 0;
                total += BigInt(count);
                if (count > 0) practicedRoots.add(rootId);
            }
            const practicedKeys = practicedRoots.size;
            // 合計は表示用文字列。大きな回数も桁落ちせず集計し、重複保存しない。
            return { total: total.toString(), practicedKeys };
        },
        getScaleKeyCount(stage, rootId) {
            let total = 0n;
            for (const [key, root] of keys.has(stage) ? scaleForms.get(stage.lessonId) || [] : []) {
                if (root === rootId) total += BigInt(counts[key] || 0);
            }
            return total.toString();
        },
        getChordToneSummary(stage) {
            let total = 0n;
            const roots = new Set();
            const formKey = stage?.chordTypeId + "-" + stage?.formId?.toLowerCase();
            for (const [key, rootId] of keys.has(stage) ? chordToneForms.get(formKey) || [] : []) {
                const count = counts[key] || 0;
                total += BigInt(count);
                if (count > 0) roots.add(rootId);
            }
            return { total: total.toString(), practicedCodes: roots.size };
        },
        getChordToneRootCount(stage, rootId) {
            let total = 0n;
            const formKey = stage?.chordTypeId + "-" + stage?.formId?.toLowerCase();
            for (const [key, root] of keys.has(stage) ? chordToneForms.get(formKey) || [] : []) {
                if (root === rootId) total += BigInt(counts[key] || 0);
            }
            return total.toString();
        },
        beginSession,
        flush: writer.flush,
        getSaveStatus() { return { pending: hasPending(), error: writer.error }; },
        destroy() { environment.removeEventListener?.("storage", onStorage); environment.removeEventListener?.("focus", retry); listeners.clear(); },
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
        recordCompletedLaps(session, now) {
            beginSession(session);
            const { key, stage } = sessions.get(session) || {};
            if (!key || !["practice", "record"].includes(session.mode)
                || !Number.isFinite(now) || !Number.isFinite(session.startTime)
                || !Number.isFinite(session.beatSec) || session.beatSec <= 0
                || !Number.isSafeInteger(session.practiceBeats) || session.practiceBeats < 1
                || !Number.isSafeInteger(session.countInBeats) || session.countInBeats < 0
                || !(session.repeatCount === Infinity
                    || Number.isSafeInteger(session.repeatCount) && session.repeatCount > 0)) return;
            const lapSeconds = session.practiceBeats * session.beatSec;
            const elapsed = now - session.startTime - session.countInBeats * session.beatSec;
            const completed = Math.min(session.repeatCount, Math.max(0, Math.floor((elapsed + 1e-8) / lapSeconds)));
            const previous = observed.get(session) || 0;
            if (completed <= previous || !Number.isSafeInteger(completed)) return;
            observed.set(session, completed);
            pending[key] = Math.min(Number.MAX_SAFE_INTEGER, (pending[key] || 0) + completed - previous);
            refreshCounts();
            notify(stage);
            void writer.flush();
        }
    };
}
