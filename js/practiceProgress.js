export const PRACTICE_COUNT_STORAGE_KEY = "chogita_practice_counts_v1";

// 既存セッションの音声時刻を観測するだけで、タイマーや音声処理は持たない。
export function createPracticeProgress(groups, getStorage = () => globalThis.localStorage) {
    const keys = new Map(), allowed = new Set(), counts = Object.create(null), scaleForms = new Map(), chordToneForms = new Map();
    for (const category of ["chromatic", "chords"]) {
        for (const stage of groups[category] || []) {
            if (!Number.isSafeInteger(stage.id) || stage.id < 1) continue;
            const key = category + "-" + stage.id;
            keys.set(stage, key); allowed.add(key);
        }
    }
    for (const stage of groups.scales || []) {
        if (!Number.isSafeInteger(stage.id) || stage.id < 1 || stage.lessonId !== "scales-" + stage.id
            || !/^[a-z]+$/.test(stage.keyId || "") || !stage.variants?.some(v => v.keyId === stage.keyId)) continue;
        const key = stage.lessonId + "-" + stage.keyId;
        keys.set(stage, key); allowed.add(key);
        if (!scaleForms.has(stage.lessonId)) scaleForms.set(stage.lessonId, new Set());
        scaleForms.get(stage.lessonId).add(key);
    }
    for (const stage of groups.chordTones || []) {
        if (!Number.isSafeInteger(stage.id) || stage.id < 1 || stage.lessonId !== "chord-tones-" + stage.id
            || !["maj7", "min7", "dom7", "m7b5"].includes(stage.chordTypeId) || !["C", "A", "G", "E", "D"].includes(stage.formId)
            || !/^[a-z]+$/.test(stage.rootId || "") || !stage.variants?.some(v => v.rootId === stage.rootId)) continue;
        const formKey = stage.chordTypeId + "-" + stage.formId.toLowerCase();
        const key = "chord-tones-" + formKey + "-" + stage.rootId;
        keys.set(stage, key); allowed.add(key);
        if (!chordToneForms.has(formKey)) chordToneForms.set(formKey, new Set());
        chordToneForms.get(formKey).add(key);
    }
    const validCount = value => Number.isSafeInteger(value) && value >= 0;
    try {
        const saved = JSON.parse(getStorage()?.getItem(PRACTICE_COUNT_STORAGE_KEY) || "null");
        if (saved?.version === 1 && saved.counts && typeof saved.counts === "object" && !Array.isArray(saved.counts)) {
            for (const key of allowed) if (validCount(saved.counts[key])) counts[key] = saved.counts[key];
        }
    } catch { /* 保存不能・破損時も初期値0で練習を継続する。 */ }
    const observed = new WeakMap(), listeners = new Set(), sessions = new WeakMap();
    function beginSession(session) {
        if (!session || typeof session !== "object" || sessions.has(session)) return;
        sessions.set(session, { key: keys.get(session.stage), stage: session.stage });
    }
    return {
        getCount(stage) { return counts[keys.get(stage)] || 0; },
        getScaleSummary(stage) {
            let total = 0n, practicedKeys = 0;
            for (const key of keys.has(stage) ? scaleForms.get(stage.lessonId) || [] : []) {
                const count = counts[key] || 0;
                total += BigInt(count);
                if (count > 0) practicedKeys++;
            }
            // 合計は表示用文字列。大きな回数も桁落ちせず集計し、重複保存しない。
            return { total: total.toString(), practicedKeys };
        },
        getChordToneSummary(stage) {
            let total = 0n, practicedCodes = 0;
            const formKey = stage?.chordTypeId + "-" + stage?.formId?.toLowerCase();
            for (const key of keys.has(stage) ? chordToneForms.get(formKey) || [] : []) {
                const count = counts[key] || 0;
                total += BigInt(count);
                if (count > 0) practicedCodes++;
            }
            return { total: total.toString(), practicedCodes };
        },
        beginSession,
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
            counts[key] = Math.min(Number.MAX_SAFE_INTEGER, (counts[key] || 0) + completed - previous);
            try {
                getStorage()?.setItem(PRACTICE_COUNT_STORAGE_KEY, JSON.stringify({ version: 1, counts }));
            } catch { /* 保存できない場合も、このページ内の回数と練習は維持する。 */ }
            for (const listener of listeners) {
                try { listener(stage); } catch { /* 表示補助の失敗で練習を中断しない。 */ }
            }
        }
    };
}
