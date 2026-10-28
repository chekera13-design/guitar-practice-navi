// Display only: measure a completed render, never the scroll RAF.
export function heightCandidate({ height, clipBottom, inkBottom, guard = 2, maxGrowth = 40 }) {
    if (![height, clipBottom, inkBottom, guard, maxGrowth].every(Number.isFinite)) return null;
    const growth = Math.max(0, Math.ceil(inkBottom + guard - clipBottom));
    return growth <= maxGrowth ? { height: Math.ceil(height + growth), growth } : null;
}

export function measureTupletViewport(document) {
    const win = document.defaultView, wrapper = document.querySelector('.score-wrapper');
    const root = document.getElementById('alphaTab');
    if (!win || !wrapper || !root) return null;
    const style = win.getComputedStyle(wrapper), box = wrapper.getBoundingClientRect();
    const number = value => parseFloat(value) || 0;
    const clipTop = box.top + number(style.borderTopWidth);
    const clipBottom = clipTop + wrapper.clientHeight;
    const canvas = document.createElement('canvas'), context = canvas.getContext('2d');
    if (!context) return null;
    const glyphs = [];
    for (const node of root.querySelectorAll('text')) {
        if (!['\ue883', '\ue886'].includes(node.textContent)) continue;
        const computed = win.getComputedStyle(node), matrix = node.getScreenCTM();
        if (!matrix || Math.abs(matrix.b) > 1e-6 || Math.abs(matrix.c) > 1e-6 || matrix.d <= 0) return null;
        context.font = [computed.fontStyle, computed.fontWeight, computed.fontSize, computed.fontFamily].join(' ');
        const metrics = context.measureText(node.textContent);
        const y = node.y.baseVal[0]?.value ?? 0;
        const top = matrix.d * (y - metrics.actualBoundingBoxAscent) + matrix.f;
        const bottom = matrix.d * (y + metrics.actualBoundingBoxDescent) + matrix.f;
        if (![top, bottom].every(Number.isFinite) || bottom <= top) return null;
        const svg = node.ownerSVGElement.getBoundingClientRect();
        glyphs.push({ number: node.textContent === '\ue886' ? 6 : 3, top, bottom, svgTop: svg.top, svgBottom: svg.bottom });
    }
    if (!glyphs.length) return null;
    // Separate SVG rows require another layout policy; do not grow a horizontal frame to page height.
    if (Math.max(...glyphs.map(g => g.svgTop)) - Math.min(...glyphs.map(g => g.svgTop)) > 2) return null;
    const modal = document.querySelector('.practice-modal-content');
    return { height: box.height, clientHeight: wrapper.clientHeight, clipTop, clipBottom,
        inkTop: Math.min(...glyphs.map(g => g.top)), inkBottom: Math.max(...glyphs.map(g => g.bottom)),
        glyphs, paddingTop: number(style.paddingTop), paddingBottom: number(style.paddingBottom),
        borderTop: number(style.borderTopWidth), borderBottom: number(style.borderBottomWidth),
        horizontalScrollbar: wrapper.offsetHeight - wrapper.clientHeight - number(style.borderTopWidth) - number(style.borderBottomWidth),
        overflowY: style.overflowY, modalClientHeight: modal?.clientHeight, modalScrollHeight: modal?.scrollHeight,
        measurement: 'glyph ink estimated from loaded font metrics and SVG screen CTM' };
}

export function createTupletScoreViewport(documentRef) {
    let active = null, key = null, target = null, original = null;
    function restore() {
        if (target && original) {
            if (original.value) target.style.setProperty('min-height', original.value, original.priority);
            else target.style.removeProperty('min-height');
        }
        target = null; original = null;
    }
    const matches = token => active && token && active.generation === token.generation
        && active.api === token.api && active.stage === token.stage;
    function clear() { restore(); active = null; key = null; }
    function begin(token) { clear(); active = { ...token }; return active; }
    function reset(token) { if (matches(token)) { restore(); key = null; } }
    function apply(token, { score, render, vertical = false } = {}) {
        if (!matches(token) || token.api?.score !== score) return null;
        // A rotation updates the modal height after its first layout pass. Inline constraint
        // changes invalidate the cached measurement even when the SVG and viewport are unchanged.
        const modalHeight = documentRef.querySelector('.practice-modal-content')?.style
            ?.getPropertyValue('--practice-modal-max-height') ?? null;
        const stamp = [score, render, vertical, documentRef.defaultView?.innerWidth, documentRef.defaultView?.innerHeight, modalHeight];
        if (key && stamp.every((value, index) => value === key[index])) return null;
        restore(); key = stamp;
        if (vertical) return null;
        const hasTuplet = score?.tracks?.some(t => t.staves.some(s => s.bars.some(b => b.voices.some(v =>
            v.beats.some(beat => [3, 6].includes(beat.tupletNumerator))))));
        if (!hasTuplet) return null;
        try {
            const before = measureTupletViewport(documentRef);
            if (!before || before.inkTop < before.clipTop) return null;
            const plan = heightCandidate(before);
            if (!plan?.growth) return null;
            target = documentRef.querySelector('.score-wrapper');
            original = { value: target.style.getPropertyValue('min-height'), priority: target.style.getPropertyPriority('min-height') };
            target.style.setProperty('min-height', plan.height + 'px');
            const after = measureTupletViewport(documentRef);
            if (!after || after.inkBottom + 1 > after.clipBottom) { restore(); return null; }
            return { applied: true };
        } catch {
            restore();
            return null;
        }
    }
    return { begin, reset, clear, apply };
}

