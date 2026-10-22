// 原本/モデルの読み取りと、小音符専用の標準words保持・安全なSVGスラー補助。
// モデル・音声・既存曲線・cropには書き込まない。
const name = node => (node?.localName || node?.tagName || '').toLowerCase();
const children = (node, tag) => Array.from(node?.children || []).filter(n => name(n) === tag);
const child = (node, tag) => children(node, tag)[0];
const text = (node, tag) => child(node, tag)?.textContent?.trim() ?? null;
const numeric = (node, tag, fallback = null) => {
    const value = text(node, tag);
    return value === null ? fallback : value === '' ? NaN : Number(value);
};
const finite = Number.isFinite;
const close = (a, b) => finite(a) && finite(b) && Math.abs(a - b) < .01;
const decision = reasons => ({ eligible: reasons.length === 0, reasons: [...new Set(reasons)] });
const emptySource = status => ({ status, notes: [], beats: [], groups: [], words: [], slurs: [], ties: [], diagnostics: [] });
const issue = (result, reason, sourceId = null) => {
    if (result.diagnostics.length < 64) result.diagnostics.push({ reason, sourceId });
};
const marks = (node, tag) => children(node, tag).map(n => ({
    kind: tag, type: n.getAttribute('type'), number: n.getAttribute('number'), text: n.textContent?.trim() || null
}));

export function analyzeGraceSource(xml) {
    const result = emptySource('unavailable');
    try {
        if (typeof xml !== 'string') throw Error('xml-unavailable');
        // 通常譜面には補助DOM解析すら行わない。コメント内などの一致はDOMで再確認する。
        if (!/<(?:[\w.-]+:)?grace(?=[\s/>])/.test(xml)) return emptySource('absent');
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        if (doc.querySelector('parsererror') || name(doc.documentElement) !== 'score-partwise') throw Error('xml-invalid');
        const parts = children(doc.documentElement, 'part');
        const activeSlurs = new Map(), activeTies = new Map();
        let sourceOrder = 0;
        const connect = (row, entries, active, pairs, kind) => {
            for (const marker of [...entries].sort((a, b) => (a.type === 'stop' ? -1 : 0) - (b.type === 'stop' ? -1 : 0))) {
                const suffix = kind === 'tie' ? `${row.pitch?.step}:${row.pitch?.alter}:${row.pitch?.octave}:${row.string}:` : '';
                const key = `${row.partIndex}:${row.staffIndex}:${row.voiceIndex}:${suffix}${marker.number || '1'}`;
                if (marker.type === 'stop') {
                    const origin = active.get(key);
                    pairs.push({ id: `${kind}-${pairs.length}`, start: origin?.id ?? null, end: row.id,
                        number: marker.number, valid: !!origin && !origin.ambiguous });
                    if (!origin) issue(result, `${kind}-origin-missing`, row.id);
                    active.delete(key);
                } else if (marker.type === 'start') {
                    const duplicate = active.has(key);
                    if (duplicate) issue(result, `${kind}-origin-ambiguous`, row.id);
                    active.set(key, { id: row.id, ambiguous: duplicate });
                } else issue(result, `${kind}-marker-unsupported`, row.id);
            }
        };
        parts.forEach((part, partIndex) => {
            let divisions = 1;
            children(part, 'measure').forEach((measure, barIndex) => {
                let cursor = 0, previousNote = null;
                const lanes = new Map(), barWords = [];
                const barNotes = [];
                for (const [childIndex, node] of Array.from(measure.children).entries()) {
                    const tag = name(node);
                    if (tag === 'attributes') divisions = numeric(node, 'divisions', divisions);
                    if (!finite(divisions) || divisions <= 0) throw Error('divisions-invalid');
                    if (tag === 'backup' || tag === 'forward') {
                        const duration = numeric(node, 'duration');
                        if (!finite(duration) || duration < 0) throw Error('cursor-duration-invalid');
                        cursor += (tag === 'backup' ? -1 : 1) * duration * 960 / divisions;
                        previousNote = null;
                        if (cursor < -.01) throw Error('cursor-negative');
                    }
                    if (tag === 'direction') {
                        const directionType = child(node, 'direction-type');
                        for (const words of children(directionType, 'words')) {
                            const value = words.textContent?.trim() ?? '';
                            const word = { id: `word-${result.words.length}`, partIndex, barIndex, childIndex, raw: value,
                                label: /^[HS]$/i.test(value) ? value.toUpperCase() : null,
                                voice: numeric(node, 'voice'), staff: numeric(node, 'staff'),
                                offsetTicks: cursor + numeric(node, 'offset', 0) * 960 / divisions,
                                anchorBeatId: null, ambiguous: false };
                            result.words.push(word); barWords.push(word);
                        }
                    }
                    if (tag !== 'note') continue;
                    const staffIndex = numeric(node, 'staff', 1) - 1, voiceIndex = numeric(node, 'voice', 1) - 1;
                    if (![staffIndex, voiceIndex].every(n => Number.isInteger(n) && n >= 0)) throw Error('lane-invalid');
                    const laneKey = `${partIndex}:${staffIndex}:${barIndex}:${voiceIndex}`;
                    if (!lanes.has(laneKey)) lanes.set(laneKey, []);
                    const lane = lanes.get(laneKey), chord = !!child(node, 'chord'), grace = child(node, 'grace');
                    const rest = !!child(node, 'rest'), cue = !!child(node, 'cue');
                    const chordValid = !chord || previousNote?.laneKey === laneKey && !previousNote.rest;
                    const beat = chord && chordValid ? lane.at(-1) : {
                        id: `beat-${result.beats.length}`, laneKey, partIndex, staffIndex, voiceIndex, barIndex,
                        beatIndex: lane.length, offsetTicks: cursor, rest, cue, grace: !!grace, notes: [],
                        invalid: chordValid ? null : 'chord-origin-uncertain' };
                    if (!chord || !chordValid) { lane.push(beat); result.beats.push(beat); }
                    const notations = child(node, 'notations'), technical = child(notations, 'technical'), pitch = child(node, 'pitch');
                    const row = { id: `note-${sourceOrder}`, sourceOrder: sourceOrder++,
                        measureNumber: measure.getAttribute('number'), measureNoteIndex: barNotes.length,
                        childIndex,
                        partIndex, partId: part.getAttribute('id'), staff: numeric(node, 'staff'), voice: numeric(node, 'voice'), staffIndex, voiceIndex, barIndex, laneKey,
                        beatId: beat.id, beatIndex: beat.beatIndex, noteIndex: beat.notes.length,
                        offsetTicks: beat.offsetTicks, chord, rest, cue, grace: !!grace,
                        slash: grace?.getAttribute('slash') ?? null, makeTime: grace?.getAttribute('make-time') ?? null,
                        type: text(node, 'type'), duration: numeric(node, 'duration'), stem: text(node, 'stem'),
                        string: numeric(technical, 'string'), fret: numeric(technical, 'fret'),
                        pitch: pitch ? { step: text(pitch, 'step'), alter: numeric(pitch, 'alter', 0), octave: numeric(pitch, 'octave') } : null,
                        slurs: marks(notations, 'slur'), ties: marks(node, 'tie'), tied: marks(notations, 'tied'),
                        technical: [...marks(technical, 'hammer-on'), ...marks(technical, 'pull-off')], groupId: null };
                    if (!rest) beat.notes.push(row.id);
                    result.notes.push(row); barNotes.push(row); previousNote = row;
                    if (!chord) {
                        for (const word of barWords.filter(w => !w.anchorBeatId && close(w.offsetTicks, row.offsetTicks)
                            && (w.voice === null || w.voice === voiceIndex + 1) && (w.staff === null || w.staff === staffIndex + 1))) word.anchorBeatId = beat.id;
                        if (!grace) {
                            if (!finite(row.duration) || row.duration < 0) beat.invalid = 'note-duration-invalid';
                            else cursor += row.duration * 960 / divisions;
                        }
                    }
                    connect(row, row.slurs, activeSlurs, result.slurs, 'slur');
                    // インポータが読むtiedを優先。tieだけの存在もrow.tiesに原本どおり保持する。
                    connect(row, row.tied, activeTies, result.ties, 'tie');
                }
                const activeLanes = new Set(barNotes.filter(n => !n.rest).map(n => `${n.staffIndex}:${n.voiceIndex}`));
                for (const word of barWords) if (activeLanes.size > 1 && (word.voice === null || word.staff === null)) word.ambiguous = true;
                for (const lane of lanes.values()) {
                    let run = [];
                    const finish = following => {
                        if (!run.length) return;
                        const ids = run.flatMap(b => b.notes), group = { id: `grace-${result.groups.length}`,
                            beatIds: run.map(b => b.id), noteIds: ids, followingBeatId: following?.id ?? null,
                            kind: run.length > 1 ? 'sequence' : ids.length > 1 ? 'chord' : 'single' };
                        for (const n of barNotes.filter(n => ids.includes(n.id))) n.groupId = group.id;
                        result.groups.push(group); run = [];
                    };
                    for (const beat of lane) { if (beat.grace) run.push(beat); else finish(beat); } finish(null);
                }
            });
        });
        for (const [kind, active, pairs] of [['slur', activeSlurs, result.slurs], ['tie', activeTies, result.ties]]) {
            for (const origin of active.values()) { pairs.push({ id: `${kind}-${pairs.length}`, start: origin.id, end: null, valid: false }); issue(result, `${kind}-destination-missing`, origin.id); }
        }
        result.status = result.groups.length ? 'parsed' : 'absent';
        return result;
    } catch (error) {
        const failed = emptySource('unavailable'); issue(failed, String(error?.message || 'source-analysis-failed')); return failed;
    }
}

export function matchGraceModel(source, score) {
    const result = { status: 'not-needed', notes: [], groups: [], slurs: [], ties: [], diagnostics: [] };
    if (source?.status !== 'parsed') { if (source?.status !== 'absent') result.status = 'unavailable'; return result; }
    try {
        result.status = 'matched';
        const sourceNotes = new Map(source.notes.map(n => [n.id, n])), sourceBeats = new Map(source.beats.map(b => [b.id, b]));
        const mapped = new Map(), models = new Map(), idCounts = new Map(), beatCounts = new Map();
        for (const track of score.tracks) for (const staff of track.staves) for (const bar of staff.bars) for (const voice of bar.voices) for (const beat of voice.beats) {
            beatCounts.set(beat.id, (beatCounts.get(beat.id) || 0) + 1);
            for (const note of beat.notes) idCounts.set(note.id, (idCounts.get(note.id) || 0) + 1);
        }
        const lanes = new Map();
        for (const b of source.beats) { if (!lanes.has(b.laneKey)) lanes.set(b.laneKey, []); lanes.get(b.laneKey).push(b); }
        for (const beats of lanes.values()) {
            const first = beats[0], staff = score.tracks[first.partIndex]?.staves[first.staffIndex];
            const actual = staff?.bars[first.barIndex]?.voices[first.voiceIndex]?.beats;
            if (!actual || actual.length !== beats.length || beats.some(b => b.cue)) { issue(result, 'lane-sequence-uncertain', first.id); continue; }
            for (const b of beats) {
                const beat = actual[b.beatIndex], rows = b.notes.map(id => sourceNotes.get(id));
                const valid = !b.invalid && beat && beat.index === b.beatIndex && beatCounts.get(beat.id) === 1
                    && close(beat.displayStart, b.offsetTicks) && !!beat.isRest === b.rest && !!beat.graceType === b.grace
                    && beat.notes.length === rows.length && rows.every((row, i) => {
                        const n = beat.notes[i];
                        return !row.cue && row.grace === b.grace && Number.isInteger(row.string) && row.string > 0 && row.string <= staff.tuning.length
                            && Number.isInteger(row.fret) && row.fret >= 0 && n.beat === beat && idCounts.get(n.id) === 1
                            && Number.isInteger(n.id) && Number.isInteger(beat.id) && n.string === staff.tuning.length - row.string + 1 && n.fret === row.fret;
                    });
                if (!valid) { issue(result, 'beat-note-sequence-uncertain', b.id); continue; }
                if (b.grace) {
                    const sourceGroup = source.groups.find(g => g.beatIds.includes(b.id));
                    const expectedBeats = sourceGroup?.beatIds.map(id => actual[sourceBeats.get(id)?.beatIndex]);
                    if (!sourceGroup || beat.graceIndex !== sourceGroup.beatIds.indexOf(b.id)
                        || beat.graceGroup?.beats.length !== expectedBeats.length
                        || expectedBeats.some((other, i) => !other || other.graceGroup !== beat.graceGroup
                            || beat.graceGroup.beats[i] !== other)) {
                        issue(result, 'grace-group-order-uncertain', b.id); continue;
                    }
                }
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i], note = beat.notes[i];
                    if (b.grace && (![1, 2].includes(beat.graceType) || !beat.graceGroup
                        || beat.graceGroup.beats[beat.graceIndex] !== beat)) { issue(result, 'grace-group-uncertain', row.id); continue; }
                    const item = { sourceNoteId: row.id, noteId: note.id, beatId: beat.id, graceType: beat.graceType,
                        graceIndex: beat.graceIndex, graceGroupId: beat.graceGroup?.id ?? null,
                        modelGroupBeatIds: beat.graceGroup?.beats.map(b => b.id) ?? [],
                        slurOriginId: note.slurOrigin?.id ?? null, slurDestinationId: note.slurDestination?.id ?? null,
                        tieOriginId: note.tieOrigin?.id ?? null, tieDestinationId: note.tieDestination?.id ?? null,
                        isTieOrigin: !!note.isTieOrigin, isTieDestination: !!note.isTieDestination, beatText: beat.text ?? null };
                    mapped.set(row.id, item); models.set(row.id, note); result.notes.push(item);
                }
            }
        }
        for (const group of source.groups) {
            const rows = group.noteIds.map(id => sourceNotes.get(id)), ms = group.noteIds.map(id => mapped.get(id));
            const reasons = [], first = models.get(group.noteIds[0]), follow = sourceBeats.get(group.followingBeatId);
            if (ms.some(n => !n)) reasons.push('mapping-unavailable');
            if (group.kind === 'sequence') reasons.push('sequence-symbols-out-of-scope');
            if (rows.some(n => n.type !== 'eighth')) reasons.push('duration-unsupported');
            const slash = rows.every(n => n.slash === 'yes') ? true : rows.every(n => n.slash === 'no') ? false : null;
            if (slash === null) reasons.push('slash-missing-or-inconsistent');
            if (rows.some(n => n.stem !== 'down')) reasons.push('stem-up-or-unspecified');
            if (!follow || follow.rest || !follow.notes.length || follow.notes.some(id => !mapped.has(id))) reasons.push('following-normal-beat-unavailable');
            const bar = first?.beat.voice.bar;
            if (bar && bar.voices.filter(v => v.beats.some(b => !b.isRest && !b.isEmpty)).length > 1) reasons.push('multiple-voices-unverified');
            if (first && (first.beat.duration !== 8 || !first.beat.graceGroup?.isComplete
                || first.beat.graceGroup.beats.length !== group.beatIds.length)) reasons.push('model-grace-group-inconsistent');
            if (rows.some(n => n.ties.length || n.tied.length || n.cue)
                || group.noteIds.some(id => { const n = models.get(id); return n && (n.isTieOrigin || n.isTieDestination || n.isDead || n.isGhost || n.hasBend); })) reasons.push('special-note-out-of-scope');
            result.groups.push({ sourceGroupId: group.id, kind: group.kind, slash,
                sourceNoteIds: group.noteIds, noteIds: ms.filter(Boolean).map(n => n.noteId), symbols: decision(reasons) });
        }
        for (const pair of source.slurs) {
            const a = sourceNotes.get(pair.start), b = sourceNotes.get(pair.end);
            if (!a?.grace && !b?.grace) continue; // 通常奏法には介入しない。
            const from = models.get(pair.start), to = models.get(pair.end), reasons = [];
            if (!pair.valid || !from || !to || from === to || from.slurDestination !== to || to.slurOrigin !== from) reasons.push('slur-connection-uncertain');
            if (!a?.grace || b?.grace) reasons.push('grace-to-normal-only');
            if (!a || !b || a.barIndex !== b.barIndex) reasons.push('cross-bar-slur-out-of-scope');
            const group = source.groups.find(g => g.id === a?.groupId);
            if (group?.kind === 'sequence') reasons.push('sequence-slur-unverified');
            if (from?.beat.voice.bar.voices.filter(v => v.beats.some(z => !z.isRest && !z.isEmpty)).length > 1) reasons.push('multiple-voices-unverified');
            const words = source.words.filter(w => w.anchorBeatId === a?.beatId && w.label && !w.ambiguous);
            if (words.length > 1) reasons.push('words-ambiguous');
            if (!words.length && a?.technical.some(t => t.type === 'start')) reasons.push('technical-label-only-out-of-scope');
            if (from?.isEffectSlurOrigin && from.effectSlurDestination === to) reasons.push('native-effect-slur-present');
            result.slurs.push({ sourceSlurId: pair.id, logical: { fromNoteId: from?.id ?? null, toNoteId: to?.id ?? null },
                visualReference: from && to ? { kind: 'beat-chord-top', fromBeatId: from.beat.id, toBeatId: to.beat.id } : null,
                wordId: words.length === 1 ? words[0].id : null, label: words.length === 1 ? words[0].label : null,
                slur: decision(reasons) });
        }
        for (const pair of source.ties) {
            const a = models.get(pair.start), b = models.get(pair.end);
            result.ties.push({ sourceTieId: pair.id, fromNoteId: a?.id ?? null, toNoteId: b?.id ?? null,
                verified: !!pair.valid && !!a && !!b && b.isTieDestination && b.tieOrigin === a && a.tieDestination === b,
                display: decision(['tie-number-display-out-of-scope']) });
        }
        return result;
    } catch (error) {
        const failed = { status: 'unavailable', notes: [], groups: [], slurs: [], ties: [], diagnostics: [] };
        issue(failed, String(error?.message || 'model-analysis-failed')); return failed;
    }
}

// 1.8.4の純TABでは通常slurを描かず、effect slur/tieは描く。
// この経路の外では標準曲線を推測で削除せず、独自曲線を見送る。
const GRACE_PATH_CLASS = 'alphatab-grace-slur';
const SVG_NS = 'http://www.w3.org/2000/svg';
export const GRACE_ARC = Object.freeze({ digitGap: 4, rise: 3, minRise: 1.5,
    thickness: 1.6, widthScale: 1.25, labelGap: 2, coordinateTolerance: .05,
    fittedLabelGap: 1, fittedDigitGap: .7, roundingGuard: .02, fittedMinRise: .75,
    color: '#0f172a', extensionRatios: Object.freeze([.15, .10]),
    shallowRatio: .22, compactDigitRatio: 1.5, obstacleGap: .25 });

const rectValid = b => b && [b.x, b.y, b.width, b.height].every(finite) && b.width >= 0 && b.height >= 0;
const boxDistance = (a, b) => Math.hypot(Math.max(a.x - b.x - b.width, b.x - a.x - a.width, 0),
    Math.max(a.y - b.y - b.height, b.y - a.y - a.height, 0));
const bbox = node => {
    const b = node.getBBox();
    if (!rectValid(b)) throw Error('svg-bbox-unavailable');
    return { x: b.x, y: b.y, width: b.width, height: b.height };
};
const untransformed = (node, svg) => {
    for (let p = node; p; p = p.parentElement) {
        if (p.getAttribute('transform')) throw Error('transformed-notation-unverified');
        if (p === svg) return;
    }
    throw Error('svg-owner-uncertain');
};
function measuredText(svg, value, x, y = null) {
    const matches = [...svg.querySelectorAll('text')].filter(n => n.textContent === value
        && n.getAttribute('x') !== null && Math.abs(Number(n.getAttribute('x')) - x) < GRACE_ARC.coordinateTolerance
        && (y === null || n.getAttribute('y') !== null && Math.abs(Number(n.getAttribute('y')) - y) < GRACE_ARC.coordinateTolerance));
    if (matches.length !== 1) throw Error('model-svg-text-uncertain');
    const node = matches[0]; untransformed(node, svg);
    const font = typeof getComputedStyle === 'function' ? getComputedStyle(node).font : null;
    if (font && document.fonts && !document.fonts.check(font)) throw Error('notation-font-not-ready');
    const box = bbox(node);
    if (box.width <= 0 || box.height <= 0) throw Error('text-bbox-empty');
    return { node, box };
}
function chordHeads(api, beat, mappedIds) {
    const bounds = api.renderer.boundsLookup.findBeat(beat);
    if (!bounds || !beat.notes.length) throw Error('beat-bounds-unavailable');
    const heads = beat.notes.map(note => {
        if (!mappedIds.has(note.id) || note.beat !== beat) throw Error('chord-model-uncertain');
        const entries = bounds.notes?.filter(b => b.note?.id === note.id) || [];
        if (entries.length !== 1) throw Error('note-bounds-ambiguous');
        const b = entries[0].noteHeadBounds;
        if (!b || ![b.x, b.y, b.w, b.h].every(finite) || b.w < 0 || b.h < 0) throw Error('note-bounds-invalid');
        if (note.isTieDestination && b.w === 0 && b.h === 0) return null;
        if (b.w <= 0 || b.h <= 0) throw Error('note-head-empty');
        return { note, x: b.x, y: b.y, w: b.w, h: b.h };
    }).filter(Boolean);
    if (!heads.length) throw Error('chord-heads-empty');
    return { heads, x: (Math.min(...heads.map(b => b.x)) + Math.max(...heads.map(b => b.x + b.w))) / 2,
        top: Math.min(...heads.map(b => b.y)) };
}

// ラボC方式の形状・上下の安全余白を使用。数字や標準wordsは動かさない。
export function chooseGraceArc({ x1, x2, preferredY, chordTop, digitTop, labelBox }) {
    const span = x2 - x1, thickness = GRACE_ARC.thickness * GRACE_ARC.widthScale;
    if (![x1, x2, preferredY, chordTop, digitTop].every(finite) || span <= GRACE_ARC.coordinateTolerance) throw Error('arc-endpoints-invalid');
    const labelBottom = labelBox ? labelBox.y + labelBox.height : null;
    const candidate = (y, rise, labelGap, fitted) => {
        const top = y - rise - thickness * .5, bottom = y + Math.max(0, -rise + thickness * .5);
        return finite(rise) && rise >= GRACE_ARC.fittedMinRise && top >= 0 && bottom < chordTop
            && digitTop - bottom >= GRACE_ARC.fittedDigitGap && (labelBottom === null || top - labelBottom >= labelGap)
            ? { y, rise, thickness, top, bottom, fitted } : null;
    };
    let rise = Math.min(GRACE_ARC.rise, span * .3);
    if (labelBottom !== null) rise = Math.min(rise, preferredY - labelBottom - GRACE_ARC.labelGap - thickness * .5 - .1);
    const initial = rise >= GRACE_ARC.minRise && candidate(preferredY, rise, GRACE_ARC.labelGap, false);
    if (initial) return initial;
    const desired = Math.min(GRACE_ARC.rise, span * .3), rises = [desired];
    for (let r = Math.floor(desired * 4) / 4; r >= GRACE_ARC.fittedMinRise; r -= .25) if (!rises.includes(r)) rises.push(r);
    for (const r of rises) {
        const lower = labelBottom === null ? 0 : labelBottom + GRACE_ARC.fittedLabelGap + r + thickness * .5 + GRACE_ARC.roundingGuard;
        const upper = Math.min(digitTop - GRACE_ARC.fittedDigitGap, chordTop - GRACE_ARC.roundingGuard)
            - Math.max(0, -r + thickness * .5) - GRACE_ARC.roundingGuard;
        if (lower > upper) continue;
        const result = candidate(Math.max(lower, Math.min(preferredY, upper)), r, GRACE_ARC.fittedLabelGap, true);
        if (result) return result;
    }
    throw Error('no-safe-arc-space');
}

function obstaclesIn(svg, includeGrace = false, includeNode = false) {
    const boxes = [];
    for (const node of svg.querySelectorAll('text, path, rect, line, polyline, polygon, circle, ellipse, use')) {
        if (!includeGrace && (node.getAttribute('class') || '').split(/\s+/).includes(GRACE_PATH_CLASS)) continue;
        let definition = false;
        for (let p = node; p && p !== svg; p = p.parentElement) if (['defs', 'clippath', 'mask'].includes(name(p))) definition = true;
        if (definition) continue;
        const b = bbox(node), style = getComputedStyle(node);
        const stroke = style.stroke && style.stroke !== 'none' ? Number.parseFloat(style.strokeWidth) * .5 : 0;
        if (!finite(stroke)) throw Error('obstacle-stroke-invalid');
        const matrix = svg.getCTM()?.inverse().multiply(node.getCTM());
        if (!matrix || ![matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f].every(finite)) throw Error('obstacle-transform-invalid');
        const points = [[b.x - stroke, b.y - stroke], [b.x + b.width + stroke, b.y - stroke],
            [b.x - stroke, b.y + b.height + stroke], [b.x + b.width + stroke, b.y + b.height + stroke]]
            .map(([x, y]) => ({ x: matrix.a * x + matrix.c * y + matrix.e, y: matrix.b * x + matrix.d * y + matrix.f }));
        const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y));
        boxes.push({ ...(includeNode ? { node } : {}), x, y, width: Math.max(...points.map(p => p.x)) - x, height: Math.max(...points.map(p => p.y)) - y,
            horizontalLine: name(node) === 'rect' && b.height > 0 && b.height <= 3 && b.width > b.height });
    }
    // 背景の6弦は、ラボの基準曲線でも横切り得る。等間隔の6本を確認できた線だけ区別する。
    // 文字・小節線・既存曲線は常に衝突対象。延長判定では背景弦も衝突対象のままにする。
    const rows = [...new Set(boxes.filter(b => b.horizontalLine).map(b => Number(b.y.toFixed(2))))].sort((a, b) => a - b);
    const strings = new Set();
    for (let i = 0; i + 5 < rows.length; i++) {
        const step = rows[i + 1] - rows[i];
        if (step >= 5 && step <= 30 && rows.slice(i, i + 6).every((y, n) => Math.abs(y - rows[i] - n * step) < .1)) {
            for (const y of rows.slice(i, i + 6)) strings.add(y);
        }
    }
    for (const b of boxes) b.staffLine = b.horizontalLine && strings.has(Number(b.y.toFixed(2)));
    return boxes;
}
const arcBox = (x1, x2, p) => ({ x: x1, y: p.top, width: x2 - x1, height: p.bottom - p.top });
function arcPath(x1, x2, p) {
    const mid = (x1 + x2) * .5, control = p.y - p.rise * 2;
    return `M ${x1.toFixed(2)} ${p.y.toFixed(2)} Q ${mid.toFixed(2)} ${(control - p.thickness).toFixed(2)} ${x2.toFixed(2)} ${p.y.toFixed(2)} Q ${mid.toFixed(2)} ${(control + p.thickness).toFixed(2)} ${x1.toFixed(2)} ${p.y.toFixed(2)} Z`;
}

// ラボ検証済みの形状だけに限定。中心線の標本距離ではなく、塗り全体を包含する凸包の距離下限を使う。
export const GRACE_COLLISION = Object.freeze({ gap:.25, flatness:.005, numericGuard:.01,
    maxDepth:14, maxLeaves:8192, maxHullVertices:512, maxCoordinate:1e6 });
const collisionPoint=(x,y)=>({x,y}), collisionSame=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<1e-7;
const collisionCross=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
const collisionMid=(a,b)=>collisionPoint((a.x+b.x)/2,(a.y+b.y)/2);
export function parseGraceLens(d) {
    if(typeof d!=='string'||d.length>4096)throw Error('unsupported-path');
    const token=d.match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g)||[];
    if(d.replace(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g,'').replace(/[\s,]/g,''))throw Error('unsupported-path');
    let i=0;const command=()=>token[i++],number=()=>{const n=Number(token[i++]);if(!Number.isFinite(n)||Math.abs(n)>GRACE_COLLISION.maxCoordinate)throw Error('invalid-coordinate');return n;},read=()=>collisionPoint(number(),number());
    if(command()!=='M')throw Error('unsupported-path');const start=read(),kind=command();
    if(!['Q','C'].includes(kind))throw Error('unsupported-path');
    const count=kind==='Q'?2:3,a=[start];for(let k=0;k<count;k++)a.push(read());
    if(command()!==kind)throw Error('unsupported-path');const b=[a.at(-1)];for(let k=0;k<count;k++)b.push(read());
    if(!['z','Z'].includes(command())||i!==token.length||!collisionSame(b.at(-1),start)||collisionSame(start,a.at(-1)))throw Error('unsupported-closed-lens');
    return {kind,start,end:a.at(-1),segments:[a,b]};
}
function collisionSegmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy,t=den?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/den)):0;return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
function collisionSubdivide(points){const left=[points[0]],right=[points.at(-1)];let row=points;while(row.length>1){row=row.slice(1).map((p,i)=>collisionMid(row[i],p));left.push(row[0]);right.unshift(row.at(-1));}return[left,right];}
export function graceConservativeHull(lens){
    const points=[];let leaves=0;
    const visit=(p,depth)=>{const flat=Math.max(...p.slice(1,-1).map(q=>collisionSegmentDistance(q,p[0],p.at(-1))));
        if(flat<=GRACE_COLLISION.flatness){if(++leaves>GRACE_COLLISION.maxLeaves)throw Error('subdivision-limit');points.push(...p);return;}
        if(depth>=GRACE_COLLISION.maxDepth)throw Error('subdivision-limit');for(const half of collisionSubdivide(p))visit(half,depth+1);};
    lens.segments.forEach(p=>visit(p,0));
    const sorted=points.sort((a,b)=>a.x-b.x||a.y-b.y).filter((p,i,a)=>!i||!collisionSame(p,a[i-1]));
    const chain=arr=>{const out=[];for(const p of arr){while(out.length>=2&&collisionCross(out.at(-2),out.at(-1),p)<=0)out.pop();out.push(p);}return out;};
    const a=chain(sorted),b=chain([...sorted].reverse());a.pop();b.pop();const hull=a.concat(b);
    if(hull.length<3)throw Error('degenerate-fill');if(hull.length>GRACE_COLLISION.maxHullVertices)throw Error('hull-complexity-limit');return hull;
}
function collisionIntersects(a,b,c,d){
    const ca=collisionCross(a,b,c),da=collisionCross(a,b,d),ac=collisionCross(c,d,a),bc=collisionCross(c,d,b);
    if(((ca>0&&da<0)||(ca<0&&da>0))&&((ac>0&&bc<0)||(ac<0&&bc>0)))return true;
    return collisionSegmentDistance(c,a,b)<1e-8||collisionSegmentDistance(d,a,b)<1e-8||collisionSegmentDistance(a,c,d)<1e-8||collisionSegmentDistance(b,c,d)<1e-8;
}
function collisionInside(p,hull){let sign=0;for(let i=0;i<hull.length;i++){const c=collisionCross(hull[i],hull[(i+1)%hull.length],p);if(Math.abs(c)<1e-8)continue;const s=Math.sign(c);if(sign&&s!==sign)return false;sign=s;}return true;}
export function graceFilledCurveDistance(first,second){
    const a=graceConservativeHull(parseGraceLens(first)),b=graceConservativeHull(parseGraceLens(second));let distance=Infinity;
    if(collisionInside(a[0],b)||collisionInside(b[0],a))distance=0;
    else for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++){
        const p=a[i],q=a[(i+1)%a.length],r=b[j],s=b[(j+1)%b.length];
        if(collisionIntersects(p,q,r,s))return{hullDistance:0,lowerBound:0,safe:false,guard:GRACE_COLLISION.numericGuard};
        distance=Math.min(distance,collisionSegmentDistance(p,r,s),collisionSegmentDistance(q,r,s),collisionSegmentDistance(r,p,q),collisionSegmentDistance(s,p,q));
    }
    const lowerBound=Math.max(0,distance-GRACE_COLLISION.numericGuard);
    return{hullDistance:distance,lowerBound,safe:lowerBound>=GRACE_COLLISION.gap,guard:GRACE_COLLISION.numericGuard};
}

// 二次判定はラボで検証した無変換・不透明fill・strokeなしの閉曲線だけ。
function graceSimpleFill(node, svg) {
    if (name(node) !== 'path') return false;
    let owner = false;
    for (let n = node; n; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (n.hasAttribute('transform') || s.transform && s.transform !== 'none'
            || s.clipPath && s.clipPath !== 'none' || s.mask && s.mask !== 'none'
            || s.filter && s.filter !== 'none' || Number(s.opacity) !== 1
            || s.display === 'none' || s.visibility !== 'visible') return false;
        if (n === svg) { owner = true; break; }
    }
    if (!owner) return false;
    const s = getComputedStyle(node), m = svg.getCTM()?.inverse().multiply(node.getCTM());
    return !!m && ['a', 'b', 'c', 'd', 'e', 'f'].every((k, i) => Math.abs(m[k] - [1, 0, 0, 1, 0, 0][i]) < 1e-9)
        && !!s.fill && s.fill !== 'none' && !s.fill.includes('url(') && Number(s.fillOpacity) === 1
        && s.stroke === 'none' && ['markerStart', 'markerMid', 'markerEnd'].every(k => !s[k] || s[k] === 'none');
}
// 既存の原本解析・モデル照合結果を利用し、描画数字の順番には依存しない。
export function certifyGraceTiePaths(state, api, partial) {
    const matches = [], { svg, x, y } = partial;
    if (state.source?.status !== 'parsed' || state.model?.status !== 'matched' || ![x, y].every(finite)) return new Set();
    const source = new Map(state.source.notes.map(n => [n.id, n])), notes = new Map(), duplicates = new Set();
    for (const track of api.score.tracks) for (const staff of track.staves) for (const bar of staff.bars) for (const voice of bar.voices) for (const beat of voice.beats) for (const n of beat.notes) {
        if (notes.has(n.id)) duplicates.add(n.id); notes.set(n.id, n);
    }
    const head = n => {
        const bs = api.renderer.boundsLookup.findBeat(n.beat)?.notes?.filter(b => b.note === n && b.note.id === n.id);
        const b = bs?.length === 1 ? bs[0].noteHeadBounds : null;
        if (!b || ![b.x, b.y, b.w, b.h].every(finite) || b.w < 0 || b.h < 0) throw Error('tie-bounds-uncertain');
        return { x: b.x + b.w * .5 - x, y: b.y + (n.string > 3 ? 0 : b.h) - y };
    };
    const tied = (row, type) => row.ties.filter(t => t.type === type).length === 1 && row.tied.filter(t => t.type === type).length === 1;
    const ties = [];
    for (const edge of state.model.ties.filter(e => e.verified)) {
        try {
            const pairs = state.source.ties.filter(p => p.id === edge.sourceTieId && p.valid);
            if (pairs.length !== 1) continue;
            const a = source.get(pairs[0].start), b = source.get(pairs[0].end), from = notes.get(edge.fromNoteId), to = notes.get(edge.toNoteId);
            const mapped = (row, note) => state.model.notes.filter(m => m.sourceNoteId === row.id && m.noteId === note.id && m.beatId === note.beat.id).length === 1;
            if (!a || !b || !from || !to || from === to || duplicates.has(from.id) || duplicates.has(to.id)
                || !mapped(a, from) || !mapped(b, to) || !tied(a, 'start') || !tied(b, 'stop')
                || !from.isTieOrigin || !to.isTieDestination || from.tieDestination !== to || to.tieOrigin !== from
                || from.beat.graceType || to.beat.graceType || a.grace || b.grace || a.cue || b.cue
                || from.string !== to.string || from.fret !== to.fret
                || ['partIndex', 'staffIndex', 'voiceIndex'].some(k => a[k] !== b[k])
                || a.barIndex < partial.firstBarIndex || b.barIndex > partial.lastBarIndex) continue;
            ties.push({ from, to, start: head(from), end: head(to) });
        } catch { /* 原本・モデル・座標のいずれかが不確実ならbbox保護のまま。 */ }
    }
    for (const node of svg.querySelectorAll('path')) {
        try {
            if (!graceSimpleFill(node, svg)) continue;
            const path = parseGraceLens(node.getAttribute('d'));
            if (path.kind !== 'C') continue;
            const candidates = ties.filter(t => Math.hypot(path.start.x - t.start.x, path.start.y - t.start.y) < .005
                && Math.hypot(path.end.x - t.end.x, path.end.y - t.end.y) < .005);
            if (candidates.length === 1) matches.push({ node, tie: candidates[0] });
        } catch { /* 未対応pathは救済しない。 */ }
    }
    return new Set(matches.filter(m => matches.filter(o => o.tie.from === m.tie.from && o.tie.to === m.tie.to).length === 1).map(m => m.node));
}
export function safeGraceArc(path, box, limits, obstacles, certified) {
    if (!rectValid(box) || ![limits.left, limits.right, limits.top, limits.bottom].every(finite)
        || limits.right <= limits.left || limits.bottom <= limits.top || box.x < limits.left || box.x + box.width > limits.right
        || box.y < limits.top || box.y + box.height > limits.bottom) return false;
    return obstacles.every(o => {
        if (!rectValid(o)) return false;
        if (boxDistance(box, o) >= GRACE_ARC.obstacleGap) return true;
        try {
            if (!o.node || !certified().has(o.node) || !graceSimpleFill(path, path.ownerSVGElement)
                || !graceSimpleFill(o.node, path.ownerSVGElement)) return false;
            return graceFilledCurveDistance(path.getAttribute('d'), o.node.getAttribute('d')).lowerBound >= GRACE_ARC.obstacleGap;
        } catch { return false; }
    });
}

function keptDirections(state, doc, xml) {
    const keep = new Set();
    if (state.rawXml !== xml || state.source.status !== 'parsed') return keep;
    const source = state.source, parts = children(doc.documentElement, 'part');
    for (const word of source.words) {
        if (!word.label || word.ambiguous || source.words.filter(w => w.anchorBeatId === word.anchorBeatId && w.label).length !== 1) continue;
        const beat = source.beats.find(b => b.id === word.anchorBeatId);
        if (!beat?.grace || beat.invalid || beat.cue) continue;
        const row = source.notes.find(n => n.id === beat.notes[0]);
        const measure = children(parts[word.partIndex], 'measure')[word.barIndex];
        const all = Array.from(measure?.children || []), direction = all[word.childIndex], note = all[row?.childIndex];
        const types = children(direction, 'direction-type'), words = children(types[0], 'words');
        // XML上の同じ要素位置・次の非和音note・voice/staffとgraceを照合。時刻だけで保護しない。
        if (name(direction) !== 'direction' || types.length !== 1 || types[0].children.length !== 1
            || words.length !== 1 || words[0].textContent.trim() !== word.raw || name(note) !== 'note'
            || !child(note, 'grace') || child(note, 'chord') || !row || word.childIndex >= row.childIndex
            || all.slice(word.childIndex + 1, row.childIndex).some(n => name(n) === 'note')
            || numeric(note, 'voice', 1) !== row.voiceIndex + 1 || numeric(note, 'staff', 1) !== row.staffIndex + 1
            || numeric(child(child(note, 'notations'), 'technical'), 'string') !== row.string
            || numeric(child(child(note, 'notations'), 'technical'), 'fret') !== row.fret) continue;
        keep.add(direction); state.keptWordIds.add(word.id);
    }
    return keep;
}

function drawGraceSlurs(state, api, partials) {
    const report = [];
    if (state.model?.status !== 'matched') return report;
    const edges = state.model.slurs;
    if (!edges.length) return report;
    // ScoreTab等の標準五線スラーと重なる可能性がある設定では追加しない。
    if (api.settings.display.staveProfile !== 3) throw Error('pure-tab-profile-required');
    const notes = new Map(), duplicates = new Set();
    for (const track of api.score.tracks) for (const staff of track.staves) for (const bar of staff.bars) for (const voice of bar.voices) for (const beat of voice.beats) for (const note of beat.notes) {
        if (notes.has(note.id)) duplicates.add(note.id);
        notes.set(note.id, note);
    }
    const mappedIds = new Set(state.model.notes.map(n => n.noteId)), obstacleCache = new Map(), tieCache = new Map();
    for (const edge of edges) {
        const entry = { sourceSlurId: edge.sourceSlurId, rendered: false };
        let path = null;
        report.push(entry);
        try {
            if (!edge.slur.eligible) throw Error(edge.slur.reasons.join(','));
            const pair = state.source.slurs.find(p => p.id === edge.sourceSlurId);
            const row = state.source.notes.find(n => n.id === pair.start);
            const group = state.source.groups.find(g => g.id === row.groupId);
            if (!group || group.kind === 'sequence' || group.noteIds.some(id => state.source.notes.find(n => n.id === id).stem !== 'down')) throw Error('unverified-grace-stem');
            const from = notes.get(edge.logical.fromNoteId), to = notes.get(edge.logical.toNoteId);
            if (!from || !to || duplicates.has(from.id) || duplicates.has(to.id) || from === to || from.slurDestination !== to || to.slurOrigin !== from
                || !from.beat.graceType || to.beat.graceType || from.beat.id !== edge.visualReference.fromBeatId || to.beat.id !== edge.visualReference.toBeatId) throw Error('current-model-connection-uncertain');
            if (from.isEffectSlurOrigin || to.isEffectSlurDestination || from.isTieOrigin || to.isTieDestination) throw Error('native-curve-overlap-unverified');
            const matches = partials.filter(p => p.firstBarIndex <= row.barIndex && p.lastBarIndex >= row.barIndex);
            if (matches.length !== 1) throw Error('partial-ambiguous');
            const partial = matches[0], { svg, x, y } = partial;
            if (!svg?.isConnected || ![x, y].every(finite)) throw Error('partial-not-current');
            const width = Number.parseFloat(svg.getAttribute('width')), height = Number.parseFloat(svg.getAttribute('height'));
            if (![width, height].every(finite) || width <= 0 || height <= 0) throw Error('partial-size-invalid');
            const a = chordHeads(api, from.beat, mappedIds), b = chordHeads(api, to.beat, mappedIds);
            const digitBoxes = [...a.heads, ...b.heads].map(h => measuredText(svg, String(h.note.fret), h.x - x, h.y + h.h * .5 - y).box);
            let labelBox = null;
            if (edge.wordId) {
                const word = state.source.words.find(w => w.id === edge.wordId);
                if (!state.keptWordIds.has(word.id) || from.beat.text !== word.raw) throw Error('standard-words-not-confirmed');
                const head = a.heads.find(h => h.note.id === from.id);
                labelBox = measuredText(svg, word.raw, head.x + head.w * .5 - x).box;
            }
            const x1 = a.x - x, x2 = b.x - x, chordTop = Math.min(a.top, b.top) - y;
            const placement = chooseGraceArc({ x1, x2, preferredY: chordTop - GRACE_ARC.digitGap,
                chordTop, digitTop: Math.min(...digitBoxes.map(z => z.y)), labelBox });
            const bar = api.renderer.boundsLookup.findMasterBarByIndex(row.barIndex)?.realBounds;
            if (!bar || ![bar.x, bar.w].every(finite) || bar.w <= 0) throw Error('bar-bounds-unavailable');
            const limits = { left: Math.max(0, bar.x - x), right: Math.min(width, bar.x + bar.w - x), top: 0, bottom: height };
            if (!obstacleCache.has(svg)) obstacleCache.set(svg, obstaclesIn(svg, false, true));
            const obstacles = obstacleCache.get(svg);
            const foreground = obstacles.filter(b => !b.staffLine);
            const certified = () => {
                if (!tieCache.has(svg)) tieCache.set(svg, certifyGraceTiePaths(state, api, partial));
                return tieCache.get(svg);
            };
            path = document.createElementNS(SVG_NS, 'path');
            path.setAttribute('class', GRACE_PATH_CLASS); path.setAttribute('fill', GRACE_ARC.color);
            path.setAttribute('data-grace-slur-id', edge.sourceSlurId); path.setAttribute('data-grace-bar', String(row.barIndex));
            svg.appendChild(path); state.owned.add(path);
            // 全候補で最新dと実bboxを使う。基本長が危険なら延長候補で救済しない。
            const safeCandidate = (left, right, blockers) => {
                path.setAttribute('d', arcPath(left, right, placement));
                return safeGraceArc(path, arcBox(left, right, placement), limits, blockers, certified)
                    && safeGraceArc(path, bbox(path), limits, blockers, certified);
            };
            if (!safeCandidate(x1, x2, foreground)) throw Error('base-arc-obstacle');
            let left = x1, right = x2, ratio = 0;
            const span = x2 - x1, glyphWidth = Math.max(...digitBoxes.map(d => d.width));
            const shallow = placement.rise / span <= GRACE_ARC.shallowRatio && span <= glyphWidth * GRACE_ARC.compactDigitRatio;
            if (shallow) for (const r of GRACE_ARC.extensionRatios) {
                const l = x1 - span * r * .5, end = x2 + span * r * .5;
                if (l < Math.min(...digitBoxes.map(d => d.x)) || end > Math.max(...digitBoxes.map(d => d.x + d.width))) continue;
                if (safeCandidate(l, end, obstacles)) { left = l; right = end; ratio = r; break; }
            }
            path.setAttribute('d', arcPath(left, right, placement));
            const box = bbox(path);
            obstacles.push(box);
            Object.assign(entry, { rendered: true, barIndex: row.barIndex, partialIndex: partial.partialIndex,
                fromNoteId: from.id, toNoteId: to.id, x1: left, x2: right, placement, extensionRatio: ratio, labelBox, digitBoxes, box, crop: 'not-assessed' });
        } catch (error) { if (path) path.remove(); entry.reason = String(error?.message || 'grace-draw-skipped'); }
    }
    return report;
}

// ラボの改善形状。符尾の上端だけを短くし、旗・斜線の接合座標は維持する。
export const GRACE_SYMBOL = Object.freeze({ stemLength: 1.72, stemWidth: .85, inkOverlap: .2,
    flagWidth: .85, flagHeight: .72, slashWidth: .95, slashHeight: .29, slashPosition: .32,
    gap: 2, obstacleGap: .25, color: '#0f172a' });
const GRACE_SYMBOL_CLASS = 'alphatab-grace-symbol';

export function graceInkBounds(digit, metrics, svgReference = null) {
    const keys = ['actualBoundingBoxAscent', 'actualBoundingBoxDescent', 'fontBoundingBoxAscent',
        'fontBoundingBoxDescent', 'actualBoundingBoxLeft', 'actualBoundingBoxRight', 'width'];
    if (!rectValid(digit) || !keys.every(k => finite(metrics[k]))) throw Error('digit-ink-metrics-uncertain');
    if (svgReference) {
        // SVG bboxはズームで画素丸めされる。実際のbaselineと論理advanceを照合する。
        const pixelScale = svgReference.pixelScale;
        const samePixelAdvance = finite(pixelScale) && pixelScale >= .5 && pixelScale <= 8
            && Math.round(svgReference.advance * pixelScale) === Math.round(metrics.width * pixelScale);
        if (![svgReference.baseline, svgReference.advance].every(finite) || svgReference.advance <= 0
            || metrics.width <= 0 || Math.abs(svgReference.advance - metrics.width) > .1 && !samePixelAdvance
            || metrics.fontBoundingBoxAscent < 0 || metrics.fontBoundingBoxDescent < 0
            || metrics.actualBoundingBoxAscent > metrics.fontBoundingBoxAscent
            || metrics.actualBoundingBoxDescent > metrics.fontBoundingBoxDescent) throw Error('digit-ink-metrics-uncertain');
    } else if (Math.abs(metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent - digit.height) > .1
        || Math.abs(metrics.width - digit.width) > .1) throw Error('digit-ink-metrics-uncertain');
    const baseline = svgReference ? svgReference.baseline : digit.y + metrics.fontBoundingBoxAscent;
    const ink = { x: digit.x - metrics.actualBoundingBoxLeft, y: baseline - metrics.actualBoundingBoxAscent,
        width: metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight,
        height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent };
    if (!rectValid(ink) || ink.width <= 0 || ink.height <= 0 || (svgReference
        ? boxDistance(ink, digit) > 0
        : ink.x < digit.x - .1 || ink.x + ink.width > digit.x + digit.width + .1
            || ink.y < digit.y - .1 || ink.y + ink.height > digit.y + digit.height + .1)) throw Error('digit-ink-outside-bbox');
    return ink;
}

function measuredGraceDigit(svg, digit, style, ctx) {
    const metrics = ctx.measureText(digit.node.textContent);
    try { return { ink: graceInkBounds(digit.box, metrics), geometryBox: digit.box, measurement: 'bbox-verified' }; }
    catch (error) {
        if (!['digit-ink-metrics-uncertain', 'digit-ink-outside-bbox'].includes(error.message)) throw error;
    }
    const node = digit.node, y = Number(node.getAttribute('y'));
    if (!finite(y) || node.children.length || ['dx', 'dy', 'rotate'].some(k => node.hasAttribute(k))
        || !['middle', 'alphabetic'].includes(style.dominantBaseline)
        || style.writingMode !== 'horizontal-tb' || style.direction !== 'ltr'
        || style.baselineShift && !['0px', 'baseline'].includes(style.baselineShift)
        || typeof node.getComputedTextLength !== 'function') throw Error('symbol-svg-baseline-unverified');
    const probe = node.cloneNode(true);
    try {
        probe.removeAttribute('id');
        probe.style.setProperty('dominant-baseline', 'alphabetic', 'important');
        probe.style.setProperty('opacity', '0', 'important');
        probe.setAttribute('pointer-events', 'none');
        svg.appendChild(probe);
        const alphabetic = bbox(probe), advance = node.getComputedTextLength();
        // 同じ文字・font・座標系でbaselineだけ変更したことを確認する。
        if (getComputedStyle(probe).font !== style.font
            || ['x', 'width', 'height'].some(k => Math.abs(alphabetic[k] - digit.box[k]) > .05)) throw Error('symbol-svg-baseline-unverified');
        const baseline = y + digit.box.y - alphabetic.y;
        const matrix = svg.getScreenCTM();
        if (!matrix || ![matrix.a, matrix.b, matrix.c, matrix.d].every(finite)
            || matrix.a <= 0 || Math.abs(matrix.b) > 1e-9 || Math.abs(matrix.c) > 1e-9
            || Math.abs(matrix.a - matrix.d) > 1e-9) throw Error('symbol-svg-baseline-unverified');
        const pixelScale = matrix.a * window.devicePixelRatio;
        return { ink: graceInkBounds(digit.box, metrics, { baseline, advance, pixelScale }),
            geometryBox: { ...digit.box, width: metrics.width, height: metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent },
            measurement: 'svg-baseline', baseline, advance };
    } finally { probe.remove(); }
}

export function graceSymbolGeometry(digit, ink, { slash, flagWidthScale = 1, stemLengthScale = 1, anchorShift = 0 } = {}) {
    if (!rectValid(digit) || !rectValid(ink) || Math.min(digit.width, digit.height, ink.width, ink.height) <= 0
        || ![.9, 1].includes(flagWidthScale) || ![1, 1.04, .98, .96].includes(stemLengthScale)
        || ![0, -.125, .125].includes(anchorShift) || Math.abs(anchorShift) > ink.width * .05
        || typeof slash !== 'boolean') throw Error('symbol-dimensions-unverified');
    const s = GRACE_SYMBOL, x = ink.x + ink.width * .5 + anchorShift, anchorY = ink.y + ink.height - s.inkOverlap,
        y = ink.y + ink.height + s.gap, bottom = anchorY + digit.height * s.stemLength * stemLengthScale,
        half = s.stemWidth * .5, w = digit.width * s.flagWidth * flagWidthScale, h = digit.height * s.flagHeight,
        sw = digit.width * s.slashWidth, sh = digit.height * s.slashHeight,
        sy = anchorY + (bottom - anchorY) * s.slashPosition;
    if (y >= bottom - h) throw Error('two-pixel-gap-leaves-no-flag-join');
    return { x, y, bottom, inkGap: s.gap, anchorShift, stemLengthScale,
        stem: `M ${x-half} ${y} H ${x+half} V ${bottom} H ${x-half} Z`,
        flag: `M ${x-half} ${bottom} C ${x+w*.25} ${bottom-h*.15} ${x+w} ${bottom-h*.45} ${x+w*.83} ${bottom-h*.72} C ${x+w*.7} ${bottom-h*.93} ${x+w*.35} ${bottom-h} ${x+.1} ${bottom-h} C ${x+w*.65} ${bottom-h*.6} ${x+w*.55} ${bottom-h*.35} ${x-half} ${bottom-h*.35} Z`,
        ...(slash ? { slash: `M ${x-sw*.5} ${sy+sh*.5} L ${x+sw*.5} ${sy-sh*.5}` } : {}) };
}

const insideBox = (b, v) => rectValid(b) && v.length === 4 && v.every(finite) && v[2] > 0 && v[3] > 0
    && b.x >= v[0] && b.y >= v[1] && b.x + b.width <= v[0] + v[2] && b.y + b.height <= v[1] + v[3];

function existingGraceCard(track, barIndex) {
    const all = [...(track?.querySelectorAll('.vertical-tab-card') || [])];
    if (!all.length) return null; // 横型の初回描画はカードを必要としない。
    const cards = all.filter(c => Number(c.dataset.barIndex) === barIndex);
    if (cards.length !== 1) throw Error('symbol-card-ambiguous');
    const svg = cards[0].querySelector('svg'), clips = [...(svg?.querySelectorAll('clipPath rect') || [])],
        groups = [...(svg?.querySelectorAll('g') || [])].filter(n => n.getAttribute('clip-path')),
        viewBox = svg?.getAttribute('viewBox')?.trim().split(/\s+/).map(Number);
    if (!viewBox || !insideBox({ x: viewBox[0], y: viewBox[1], width: 0, height: 0 }, viewBox)
        || clips.length !== 1 || groups.length !== 1) throw Error('symbol-card-crop-unverified');
    const clip = ['x', 'y', 'width', 'height'].map(k => Number(clips[0].getAttribute(k)));
    if (!clip.every((v, i) => close(v, viewBox[i]))) throw Error('symbol-card-clip-mismatch');
    return { group: groups[0], viewBox, svg };
}

function clearGraceSymbols(state) {
    if (!state) return;
    for (const n of state.symbolOwned) { try { n.remove(); } catch { /* 標準SVGには触らない。 */ } }
    state.symbolOwned.clear(); state.symbols = [];
}

function drawGraceSymbols(state, api, partials, track) {
    const records = [];
    if (state.model?.status !== 'matched') return records;
    const mappedIds = new Set(state.model.notes.map(n => n.noteId)), notes = new Map(), duplicates = new Set();
    for (const t of api.score.tracks) for (const s of t.staves) for (const b of s.bars) for (const v of b.voices)
        for (const beat of v.beats) for (const n of beat.notes) { if (notes.has(n.id)) duplicates.add(n.id); notes.set(n.id, n); }
    const accepted = new Set();
    for (const mapped of state.model.groups) {
        const record = { sourceGroupId: mapped.sourceGroupId, kind: mapped.kind, rendered: false, slash: mapped.slash };
        records.push(record); let group = null;
        try {
            if (!mapped.symbols.eligible) throw Error(mapped.symbols.reasons.join(','));
            if (api.settings.display.staveProfile !== 3 || api.settings.display.resources.graceFont.size !== 11) throw Error('symbol-render-settings-unverified');
            const source = state.source.groups.find(g => g.id === mapped.sourceGroupId),
                rows = source?.noteIds.map(id => state.source.notes.find(n => n.id === id)),
                currentNotes = mapped.noteIds.map(id => notes.get(id)), beat = currentNotes[0]?.beat;
            // 解析時のIDだけでなく、今回のモデル所属とgroupを再確認する。
            if (!rows?.length || !beat || accepted.has(beat.id) || mapped.kind === 'sequence'
                || !beat.graceType || beat.duration !== 8 || beat.graceIndex !== 0
                || !beat.graceGroup?.isComplete || beat.graceGroup.beats.length !== 1 || beat.graceGroup.beats[0] !== beat
                || currentNotes.length !== beat.notes.length || new Set(mapped.noteIds).size !== beat.notes.length
                || currentNotes.some((n, i) => !n || duplicates.has(n.id) || n.beat !== beat || !beat.notes.includes(n)
                    || n.fret !== rows[i].fret || n.string !== beat.voice.bar.staff.tuning.length - rows[i].string + 1
                    || n.isTieOrigin || n.isTieDestination || n.isDead || n.isGhost || n.hasBend)
                || beat.voice.bar.index !== rows[0].barIndex) throw Error('symbol-current-model-uncertain');
            const barIndex = rows[0].barIndex;
            Object.assign(record, { barIndex, beatId: beat.id, noteIds: mapped.noteIds });
            const matching = partials.filter(p => p.firstBarIndex <= barIndex && p.lastBarIndex >= barIndex);
            if (matching.length !== 1) throw Error('symbol-partial-ambiguous');
            const partial = matching[0], { svg, x, y } = partial;
            if (!svg?.isConnected || ![x, y].every(finite)) throw Error('symbol-partial-not-current');
            const width = parseFloat(svg.getAttribute('width')), height = parseFloat(svg.getAttribute('height')),
                bar = api.renderer.boundsLookup.findMasterBarByIndex(barIndex)?.realBounds;
            if (![width, height, bar?.x, bar?.w].every(finite) || width <= 0 || height <= 0 || bar.w <= 0) throw Error('symbol-source-bounds-invalid');
            const sourceView = [Math.max(0, bar.x - x), 0, Math.min(width, bar.x + bar.w - x) - Math.max(0, bar.x - x), height];
            const card = existingGraceCard(track, barIndex);
            const digits = chordHeads(api, beat, mappedIds).heads.map(h => {
                const d = measuredText(svg, String(h.note.fret), h.x - x, h.y + h.h * .5 - y), style = getComputedStyle(d.node);
                if (parseFloat(style.fontSize) !== 11 || style.textAnchor !== 'start' || parseFloat(style.letterSpacing)
                    || d.node.getAttribute('textLength') !== null) throw Error('symbol-digit-font-unverified');
                const ctx = document.createElement('canvas').getContext('2d');
                if (!ctx || !style.font) throw Error('symbol-font-metrics-unavailable');
                ctx.font = style.font; ctx.textBaseline = 'alphabetic';
                return { ...d, ...measuredGraceDigit(svg, d, style, ctx), noteId: h.note.id };
            });
            const digit = [...digits].sort((a, b) => b.ink.y + b.ink.height - a.ink.y - a.ink.height)[0],
                centers = digits.map(d => d.ink.x + d.ink.width * .5);
            if (Math.max(...centers) - Math.min(...centers) > Math.max(...digits.map(d => d.box.width))) throw Error('symbol-chord-column-uncertain');
            const obstacles = obstaclesIn(svg, true, true);
            if (obstacles.filter(o => o.staffLine).length < 6) throw Error('symbol-string-geometry-unverified');
            let geometry, parts, reason;
            // 従来候補を優先。衝突時だけ短縮/最大1/8pxの水平調整。全候補を同じ安全判定に通す。
            const fits = [[1, 1], [.9, 1], [1, 1.04], [.9, 1.04], [1, .98], [.9, .98], [1, .96], [.9, .96]];
            for (const [flagWidthScale, stemLengthScale, anchorShift] of [0, -.125, .125].filter(shift => Math.abs(shift) <= digit.ink.width * .05).flatMap(shift => fits.map(fit => [...fit, shift]))) {
                geometry = graceSymbolGeometry(digit.geometryBox, digit.ink, { slash: mapped.slash, flagWidthScale, stemLengthScale, anchorShift });
                group = document.createElementNS(SVG_NS, 'g');
                for (const [k, v] of Object.entries({ class: GRACE_SYMBOL_CLASS, 'data-grace-symbol': beat.id,
                    'data-grace-symbol-bar': barIndex, 'data-grace-symbol-notes': mapped.noteIds.join(','), 'pointer-events': 'none' })) group.setAttribute(k, String(v));
                for (const role of ['stem', 'flag', 'slash'].filter(r => geometry[r])) {
                    const path = document.createElementNS(SVG_NS, 'path');
                    for (const [k, v] of Object.entries({ 'data-symbol-part': role, d: geometry[role],
                        fill: role === 'slash' ? 'none' : GRACE_SYMBOL.color, stroke: role === 'slash' ? GRACE_SYMBOL.color : 'none',
                        'stroke-width': GRACE_SYMBOL.stemWidth, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })) path.setAttribute(k, String(v));
                    group.appendChild(path);
                }
                svg.appendChild(group);
                parts = [...group.children].map(n => {
                    const box = bbox(n), stroke = n.getAttribute('data-symbol-part') === 'slash' ? GRACE_SYMBOL.stemWidth * .5 : 0;
                    return { role: n.getAttribute('data-symbol-part'), box: { x: box.x - stroke, y: box.y - stroke,
                        width: box.width + stroke * 2, height: box.height + stroke * 2 } };
                });
                reason = null;
                for (const p of parts) {
                    if (!insideBox(p.box, sourceView) || card && !insideBox(p.box, card.viewBox)) { reason = 'symbol-outside-existing-crop'; break; }
                    if (obstacles.some(o => !(p.role === 'stem' && (o.node === digit.node || o.staffLine))
                        && boxDistance(p.box, o) < GRACE_SYMBOL.obstacleGap)) { reason = 'symbol-native-element-collision'; break; }
                }
                if (!reason) break;
                group.remove(); group = null;
            }
            if (!group) throw Error(reason || 'symbol-no-safe-two-pixel-gap');
            state.symbolOwned.add(group);
            if (card) { const copy = group.cloneNode(true); card.group.appendChild(copy); state.symbolOwned.add(copy); }
            accepted.add(beat.id);
            Object.assign(record, { rendered: true, partialIndex: partial.partialIndex, inkGap: geometry.inkGap,
                anchorNoteId: digit.noteId, ink: digit.ink, digit: digit.box, geometry, parts, measurement: digit.measurement,
                crop: card ? 'inside-existing-crop' : 'horizontal-no-card' });
        } catch (error) { group?.remove(); record.reason = String(error?.message || 'symbol-skipped'); }
    }
    return records;
}

// ラボC方式の文字配置だけを使用。描画済みの曲線・音符・cropは変更しない。
export const GRACE_LABEL = Object.freeze({ gap: 2, obstacleGap: .35, step: 1, maxShift: 6 });
export function chooseGraceLabel({ curve, label, obstacles, viewBox }) {
    if (![curve, label, ...obstacles].every(rectValid) || curve.width <= 0 || curve.height <= 0
        || label.width <= 0 || label.height <= 0 || !insideBox({ x: viewBox?.[0], y: viewBox?.[1], width: 0, height: 0 }, viewBox || [])) throw Error('label-placement-bounds-invalid');
    const shifts = [0], trials = [], max = Math.min(GRACE_LABEL.maxShift, curve.width * .5);
    for (let shift = GRACE_LABEL.step; shift <= max; shift += GRACE_LABEL.step) shifts.push(-shift, shift);
    for (const shift of shifts) {
        const box = { x: curve.x + curve.width * .5 - label.width * .5 + shift,
            y: curve.y - GRACE_LABEL.gap - label.height, width: label.width, height: label.height };
        const reason = !insideBox(box, viewBox) ? 'label-outside-existing-crop'
            : obstacles.some(o => boxDistance(box, o) < GRACE_LABEL.obstacleGap) ? 'label-obstacle' : null;
        trials.push({ shift, reason });
        if (!reason) return { moved: true, box, shift, trials };
    }
    return { moved: false, box: label, reason: 'no-safe-label-space', trials };
}
function restoreGraceLabels(state) {
    if (!state) return;
    for (const [node, saved] of state.labelOwned) {
        try {
            node.setAttribute('x', saved.x); node.setAttribute('y', saved.y);
            if (saved.mark === null) node.removeAttribute('data-grace-label-id');
            else node.setAttribute('data-grace-label-id', saved.mark);
        } catch { /* 破棄済みSVGの復元失敗を、新しい譜面へ伝播させない。 */ }
    }
    state.labelOwned.clear(); state.labels = [];
}
function positionGraceLabels(state, api, partials, track) {
    const records = [];
    if (state.model?.status !== 'matched') return records;
    const notes = new Map(), duplicates = new Set(), mappedIds = new Set(state.model.notes.map(n => n.noteId));
    for (const t of api.score.tracks) for (const s of t.staves) for (const b of s.bars) for (const v of b.voices) for (const beat of v.beats) for (const n of beat.notes) {
        if (notes.has(n.id)) duplicates.add(n.id); notes.set(n.id, n);
    }
    for (const edge of state.model.slurs) {
        if (!['H', 'S'].includes(edge.label) || !edge.wordId) continue;
        const record = { sourceSlurId: edge.sourceSlurId, wordId: edge.wordId, label: edge.label, moved: false };
        records.push(record); const changed = [];
        try {
            if (!edge.slur.eligible || state.model.slurs.filter(e => e.wordId === edge.wordId).length !== 1) throw Error('label-source-slur-ambiguous');
            const sourcePair = state.source.slurs.find(p => p.id === edge.sourceSlurId), row = state.source.notes.find(n => n.id === sourcePair?.start),
                destination = state.source.notes.find(n => n.id === sourcePair?.end), word = state.source.words.find(w => w.id === edge.wordId),
                group = state.source.groups.find(g => g.id === row?.groupId);
            if (!row?.grace || destination?.grace || row.barIndex !== destination?.barIndex || group?.kind === 'sequence'
                || !word || word.ambiguous || !state.keptWordIds.has(word.id) || word.anchorBeatId !== row.beatId
                || word.partIndex !== row.partIndex || word.barIndex !== row.barIndex || word.childIndex >= row.childIndex
                || !close(word.offsetTicks, row.offsetTicks)) throw Error('label-source-not-confirmed');
            const from = notes.get(edge.logical.fromNoteId), to = notes.get(edge.logical.toNoteId);
            if (!from || !to || duplicates.has(from.id) || duplicates.has(to.id) || from === to || from.slurDestination !== to || to.slurOrigin !== from
                || api.score.tracks[row.partIndex]?.staves[row.staffIndex]?.bars[row.barIndex]?.voices[row.voiceIndex]?.beats[row.beatIndex]?.notes[row.noteIndex] !== from
                || api.score.tracks[destination.partIndex]?.staves[destination.staffIndex]?.bars[destination.barIndex]?.voices[destination.voiceIndex]?.beats[destination.beatIndex]?.notes[destination.noteIndex] !== to
                || from.beat.id !== edge.visualReference?.fromBeatId || to.beat.id !== edge.visualReference?.toBeatId
                || !from.beat.graceType || to.beat.graceType || from.beat.graceGroup?.beats.length !== 1
                || from.beat.graceGroup.beats[from.beat.graceIndex] !== from.beat || from.beat.text !== word.raw
                || from.beat.voice.bar.index !== row.barIndex || from.fret !== row.fret
                || from.string !== from.beat.voice.bar.staff.tuning.length - row.string + 1
                || to.fret !== destination.fret || to.string !== to.beat.voice.bar.staff.tuning.length - destination.string + 1
                || from.beat.voice.bar.voices.filter(v => v.beats.some(b => !b.isRest && !b.isEmpty)).length !== 1) throw Error('label-current-model-uncertain');
            const rendered = state.render.filter(r => r.sourceSlurId === edge.sourceSlurId && r.rendered),
                matching = partials.filter(p => p.firstBarIndex <= row.barIndex && p.lastBarIndex >= row.barIndex);
            if (rendered.length !== 1 || matching.length !== 1) throw Error('label-rendered-slur-unavailable');
            const partial = matching[0], { svg, x, y } = partial, entry = rendered[0];
            if (!svg?.isConnected || ![x, y].every(finite) || entry.fromNoteId !== from.id || entry.toNoteId !== to.id
                || entry.partialIndex !== partial.partialIndex) throw Error('label-partial-not-current');
            const paths = [...svg.querySelectorAll('.' + GRACE_PATH_CLASS)].filter(n => n.getAttribute('data-grace-slur-id') === edge.sourceSlurId && state.owned.has(n));
            if (paths.length !== 1) throw Error('label-slur-svg-ambiguous');
            untransformed(paths[0], svg);
            const curve = bbox(paths[0]), a = chordHeads(api, from.beat, mappedIds), head = a.heads.find(h => h.note === from);
            chordHeads(api, to.beat, mappedIds); // 終点の最新NoteBoundsも確認する。
            if (!head) throw Error('label-note-bounds-unavailable');
            const native = measuredText(svg, word.raw, head.x + head.w * .5 - x), { node, box: before } = native;
            if (node.getAttribute('data-grace-label-id') !== null) throw Error('label-svg-already-owned');
            const width = parseFloat(svg.getAttribute('width')), height = parseFloat(svg.getAttribute('height')),
                bar = api.renderer.boundsLookup.findMasterBarByIndex(row.barIndex)?.realBounds;
            if (![width, height, bar?.x, bar?.w].every(finite) || width <= 0 || height <= 0 || bar.w <= 0) throw Error('label-bar-bounds-unavailable');
            const left = Math.max(0, bar.x - x), right = Math.min(width, bar.x + bar.w - x);
            let viewBox = [left, 0, right - left, height];
            const card = existingGraceCard(track, row.barIndex), targets = [node];
            if (card) {
                const v = card.viewBox, l = Math.max(left, v[0]), r = Math.min(right, v[0] + v[2]), top = Math.max(0, v[1]), bottom = Math.min(height, v[1] + v[3]);
                viewBox = [l, top, r - l, bottom - top];
                const copies = [...card.svg.querySelectorAll('text')].filter(n => n.textContent === word.raw
                    && n.getAttribute('x') === node.getAttribute('x') && n.getAttribute('y') === node.getAttribute('y')
                    && ['font-family', 'font-size', 'font-style', 'font-weight', 'text-anchor', 'style', 'class'].every(k => n.getAttribute(k) === node.getAttribute(k)));
                if (copies.length !== 1) throw Error('label-card-copy-ambiguous');
                untransformed(copies[0], card.svg); targets.push(copies[0]);
            }
            const obstacles = obstaclesIn(svg, true, true).filter(o => o.node !== node && !o.staffLine && o.width > 0 && o.height > 0),
                placement = chooseGraceLabel({ curve, label: before, obstacles, viewBox });
            Object.assign(record, { barIndex: row.barIndex, partialIndex: partial.partialIndex, fromNoteId: from.id, toNoteId: to.id,
                fromBeatId: from.beat.id, toBeatId: to.beat.id, before, after: before, curve, viewBox, extensionRatio: entry.extensionRatio, ...placement });
            if (!placement.moved) continue;
            const dx = placement.box.x - before.x, dy = placement.box.y - before.y;
            for (const target of targets) {
                const saved = { x: target.getAttribute('x'), y: target.getAttribute('y'), mark: target.getAttribute('data-grace-label-id') };
                changed.push({ target, saved });
                target.setAttribute('x', String(Number(saved.x) + dx)); target.setAttribute('y', String(Number(saved.y) + dy));
                target.setAttribute('data-grace-label-id', word.id);
            }
            const after = bbox(node), gap = curve.y - after.y - after.height;
            if (!insideBox(after, viewBox) || !close(gap, GRACE_LABEL.gap) || obstacles.some(o => boxDistance(after, o) < GRACE_LABEL.obstacleGap - .001)) throw Error('label-measured-placement-unsafe');
            for (const { target, saved } of changed) state.labelOwned.set(target, saved);
            Object.assign(record, { after, gap, copies: targets.length - 1 });
        } catch (error) {
            for (const { target, saved } of changed) {
                target.setAttribute('x', saved.x); target.setAttribute('y', saved.y);
                if (saved.mark === null) target.removeAttribute('data-grace-label-id'); else target.setAttribute('data-grace-label-id', saved.mark);
                state.labelOwned.delete(target);
            }
            record.moved = false; record.reason = String(error?.message || 'label-placement-skipped');
        }
    }
    return records;
}

export function createGraceNotation() {
    let current = null;
    const owns = token => token !== null && current?.token === token;
    const clearDrawing = state => {
        if (!state) return;
        restoreGraceLabels(state);
        clearGraceSymbols(state);
        for (const node of state.owned) { try { node.remove(); } catch { /* 所有要素の破棄も譜面処理を妨げない。 */ } }
        state.owned.clear(); state.render = [];
    };
    return {
        begin({ generation, stage, api }) {
            clearDrawing(current);
            const token = Object.freeze({ generation, stage, api });
            current = { token, source: emptySource('unavailable'), model: null, score: null,
                rawXml: null, keptWordIds: new Set(), owned: new Set(), render: [], symbolOwned: new Set(), symbols: [], labelOwned: new Map(), labels: [] }; return token;
        },
        tokenFor(owner) {
            const token = current?.token;
            return token && token.generation === owner.generation && token.stage === owner.stage && token.api === owner.api ? token : null;
        },
        capture(token, xml) {
            if (!owns(token)) return false;
            const source = analyzeGraceSource(xml);
            if (!owns(token)) return false;
            clearDrawing(current); current.keptWordIds.clear();
            current.rawXml = xml; current.source = source; current.model = null; current.score = null; return true;
        },
        wordsToKeep(token, doc, xml) {
            if (!owns(token)) return new Set();
            try { return keptDirections(current, doc, xml); }
            catch { current.keptWordIds.clear(); issue(current.source, 'standard-words-preservation-skipped'); return new Set(); }
        },
        bindModel(token, score) {
            if (!owns(token)) return false;
            const model = matchGraceModel(current.source, score);
            if (!owns(token)) return false;
            current.model = model; current.score = score; return true;
        },
        annotate(token, api, partials) {
            if (!owns(token) || token.api !== api || current.score !== api.score) return false;
            clearDrawing(current);
            try { current.render = drawGraceSlurs(current, api, partials); }
            catch (error) { clearDrawing(current); current.render = [{ rendered: false, reason: String(error?.message || 'grace-render-skipped') }]; }
            return true;
        },
        validateCards(token, api, track) {
            if (!owns(token) || token.api !== api || current.score !== api.score || !track?.querySelectorAll) return false;
            // cropは変更しない。既存viewBox/clipに収まらない追加曲線だけ、元SVG・全複製から撤回する。
            try {
                for (const entry of current.render.filter(r => r.rendered)) {
                    try {
                        const cards = [...track.querySelectorAll('.vertical-tab-card')].filter(c => Number(c.dataset.barIndex) === entry.barIndex);
                        if (cards.length !== 1) throw Error('vertical-card-ambiguous');
                        const svg = cards[0].querySelector('svg'), vb = svg?.getAttribute('viewBox')?.trim().split(/\s+/).map(Number);
                        const clips = svg ? [...svg.querySelectorAll('clipPath rect')] : [];
                        if (vb?.length !== 4 || !vb.every(finite) || vb[2] <= 0 || vb[3] <= 0 || clips.length !== 1) throw Error('vertical-crop-unverified');
                        const clip = ['x', 'y', 'width', 'height'].map(k => Number(clips[0].getAttribute(k)));
                        if (!clip.every((n, i) => close(n, vb[i]))) throw Error('vertical-clip-mismatch');
                        const b = entry.box;
                        if (b.x < vb[0] || b.x + b.width > vb[0] + vb[2] || b.y < vb[1] || b.y + b.height > vb[1] + vb[3]) throw Error('arc-outside-existing-crop');
                        entry.crop = 'inside-existing-crop';
                    } catch (error) {
                        entry.rendered = false; entry.crop = String(error?.message || 'vertical-crop-unverified'); entry.reason = entry.crop;
                    }
                    const copies = [...track.querySelectorAll('.' + GRACE_PATH_CLASS)].filter(n => n.getAttribute('data-grace-slur-id') === entry.sourceSlurId);
                    for (const node of copies) current.owned.add(node);
                    if (!entry.rendered) for (const node of current.owned) if (node.getAttribute('data-grace-slur-id') === entry.sourceSlurId) node.remove();
                }
                return true;
            } catch {
                clearDrawing(current);
                current.render = [{ rendered: false, reason: 'vertical-validation-unavailable' }];
                return false;
            }
        },
        removeSymbols(token, api) {
            if (!owns(token) || token.api !== api || current.score !== api.score) return false;
            clearGraceSymbols(current); return true;
        },
        addSymbols(token, api, partials, track = null) {
            if (!owns(token) || token.api !== api || current.score !== api.score) return false;
            clearGraceSymbols(current);
            try { current.symbols = drawGraceSymbols(current, api, partials, track); }
            catch (error) { clearGraceSymbols(current); current.symbols = [{ rendered: false, reason: String(error?.message || 'symbols-unavailable') }]; }
            return true; // 装飾の見送りはscoreReadyに影響させない。
        },
        restoreLabels(token, api) {
            if (!owns(token) || token.api !== api || current.score !== api.score) return false;
            restoreGraceLabels(current); return true;
        },
        positionLabels(token, api, partials, track = null) {
            if (!owns(token) || token.api !== api || current.score !== api.score) return false;
            restoreGraceLabels(current);
            try { current.labels = positionGraceLabels(current, api, partials, track); }
            catch (error) { restoreGraceLabels(current); current.labels = [{ moved: false, reason: String(error?.message || 'labels-unavailable') }]; }
            return true; // 文字配置の見送りはscoreReadyに影響させない。
        },
        clear() { clearDrawing(current); current = null; },
        snapshot() {
            if (!current) return null;
            // 利用側が診断情報を編集しても、本体のメタデータやモデルには影響させない。
            return JSON.parse(JSON.stringify({ generation: current.token.generation,
                source: current.source, model: current.model, render: current.render, symbols: current.symbols, labels: current.labels }));
        }
    };
}
