// Display only. Tuplet subdivisions do not change the quarter-note beat count.
export function metronomeBeatCount(stage, session = null) {
    const beats = session?.beatsPerBar ?? stage?.timeSignature?.[0];
    return beats === 3 && stage?.timeSignature?.[1] === 4 ? 3 : 4;
}

export function syncMetronomeBeatDisplay(stage, session = null, documentRef = globalThis.document) {
    const container = documentRef?.querySelector('.beat-dots-container');
    const count = metronomeBeatCount(stage, session);
    if (!container?.children || container.children.length === count) return false;
    const dots = Array.from({ length: count }, (_, index) => {
        const dot = documentRef.createElement('div');
        dot.className = 'beat-dot';
        const label = documentRef.createElement('span');
        label.className = 'dot-num';
        label.textContent = String(index + 1);
        dot.append(label);
        return dot;
    });
    container.replaceChildren(...dots);
    return true;
}
