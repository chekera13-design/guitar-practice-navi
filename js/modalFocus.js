// Focus only: the existing close buttons retain ownership of practice/audio cleanup.
const controllers = new WeakMap();
const selector = 'button,input,select,textarea,a[href],area[href],iframe,audio[controls],video[controls],summary,[contenteditable="true"],[tabindex]';
const visibilityClasses = ['hidden', 'expanded', 'vertical-tab-active'];

export function createModalFocusController(doc = globalThis.document) {
    if (!doc?.defaultView?.MutationObserver) return null;
    if (controllers.has(doc)) return controllers.get(doc);
    const win = doc.defaultView;
    const entries = [['practiceModal', 'closePracticeModalBtn'], ['infoModal', 'closeInfoModalBtn']]
        .map(([id, close]) => ({ root: doc.getElementById(id), close: doc.getElementById(close),
            open: false, opener: null, last: null, guards: [] })).filter(e => e.root);
    if (!entries.length) return null;
    let top = null, destroyed = false, queued = false, redirecting = false, watched = null;
    const blocked = new Map(), listeners = [], attributes = new Map();
    const visible = node => {
        if (!node?.isConnected || !node.getClientRects().length) return false;
        for (let p = node; p; p = p.parentElement) {
            if (p.hidden || p.classList.contains('hidden') || p.hasAttribute('inert') || p.getAttribute('aria-hidden') === 'true') return false;
        }
        const style = win.getComputedStyle(node);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse' && style.opacity !== '0';
    };
    const usable = (node, tabbable = false) => visible(node) && !node.hasAttribute('data-modal-focus-guard')
        && !node.matches(':disabled') && node.getAttribute('aria-disabled') !== 'true'
        && (!tabbable || node.tabIndex >= 0);
    // Inert dialogs can still be visually open underneath the top dialog.
    const isOpen = node => node.isConnected && !node.hidden && !node.classList.contains('hidden')
        && win.getComputedStyle(node).display !== 'none' && win.getComputedStyle(node).visibility !== 'hidden';
    const focus = (node, preventScroll = true) => {
        if (!node) return false;
        try { node.focus({ preventScroll }); } catch { try { node.focus(); } catch { return false; } }
        return doc.activeElement === node;
    };
    const candidates = entry => [...entry.root.querySelectorAll(selector)].filter(n => usable(n, true))
        .map((node, index) => ({ node, index })).sort((a, b) => {
            const aTab = a.node.tabIndex > 0 ? a.node.tabIndex : Infinity;
            const bTab = b.node.tabIndex > 0 ? b.node.tabIndex : Infinity;
            return aTab - bTab || a.index - b.index;
        }).map(item => item.node);
    const restoreBackground = () => {
        for (const [node, saved] of blocked) for (const [key, value] of Object.entries(saved)) {
            if (value === null) node.removeAttribute(key); else node.setAttribute(key, value);
        }
        blocked.clear();
    };
    const blockBackground = root => {
        for (let node = root; node && node !== doc.body; node = node.parentElement) {
            for (const sibling of node.parentElement?.children || []) {
                if (sibling === node || ['SCRIPT', 'STYLE', 'LINK'].includes(sibling.tagName)) continue;
                if (!blocked.has(sibling)) blocked.set(sibling, { inert: sibling.getAttribute('inert'), 'aria-hidden': sibling.getAttribute('aria-hidden') });
                sibling.setAttribute('inert', ''); sibling.setAttribute('aria-hidden', 'true');
            }
        }
    };
    function requestSync() {
        if (destroyed || queued) return;
        queued = true;
        win.queueMicrotask(() => { queued = false; if (!destroyed) sync(); });
    }
    const focusedObserver = new win.MutationObserver(records => {
        // Ignore decorative beat-flash/active classes; observe only visibility changes.
        if (records.some(r => r.type !== 'attributes' || r.attributeName !== 'class'
            || visibilityClasses.some(c => (r.oldValue || '').split(/\s+/).includes(c) !== r.target.classList.contains(c)))) requestSync();
    });
    function watchFocus() {
        const active = doc.activeElement;
        if (watched === active) return;
        focusedObserver.disconnect(); watched = active;
        if (!top?.root.contains(active)) return;
        if (usable(active)) top.last = active;
        // No subtree observation of the score/SVG and no per-frame work.
        for (let node = active; node && top.root.contains(node); node = node.parentElement) {
            focusedObserver.observe(node, { childList: true, attributes: true, attributeOldValue: true,
                attributeFilter: ['hidden', 'disabled', 'aria-disabled', 'tabindex', 'inert', 'style', 'class'] });
        }
    }
    function focusInside(preferred = null, last = false) {
        if (!top || redirecting) return;
        redirecting = true;
        try {
            const items = candidates(top);
            const target = preferred && top.root.contains(preferred) && usable(preferred) ? preferred
                : last ? items.at(-1) : (usable(top.close, true) ? top.close : items[0]);
            if (!focus(target, false)) focus(top.root, false);
        } finally { redirecting = false; watchFocus(); }
    }
    function returnFocus(entry) {
        const original = entry?.opener;
        const fallback = doc.querySelector('[data-practice-genre][aria-selected="true"]');
        if (usable(original) && focus(original)) return;
        if (usable(fallback) && focus(fallback)) return;
        const saved = doc.body.getAttribute('tabindex');
        doc.body.setAttribute('tabindex', '-1'); focus(doc.body);
        if (saved === null) doc.body.removeAttribute('tabindex'); else doc.body.setAttribute('tabindex', saved);
    }
    function sync() {
        if (destroyed) return;
        const previous = top;
        for (const entry of entries) {
            const open = isOpen(entry.root);
            if (open && !entry.open) {
                const active = doc.activeElement;
                entry.opener = active?.closest?.('.exercise-card') || active;
                entry.last = null;
            }
            entry.open = open;
        }
        // Both current modals are sibling fixed layers. Keep the existing z-index/DOM order.
        const open = entries.filter(e => e.open).sort((a, b) => {
            const delta = (Number.parseFloat(win.getComputedStyle(a.root).zIndex) || 0) - (Number.parseFloat(win.getComputedStyle(b.root).zIndex) || 0);
            return delta || ((a.root.compareDocumentPosition(b.root) & 4) ? -1 : 1);
        });
        const next = open.at(-1) || null;
        for (const entry of entries) entry.root.setAttribute('aria-modal', String(entry === next));
        if (next !== previous) {
            restoreBackground(); top = next; watched = null; focusedObserver.disconnect();
            if (top) {
                const returning = previous && !previous.open ? previous.opener : null;
                focusInside(returning && top.root.contains(returning) ? returning : top.last);
                blockBackground(top.root);
            } else if (previous) returnFocus(previous);
        } else if (top) {
            if (!top.root.contains(doc.activeElement) || !usable(doc.activeElement)) focusInside(top.last);
            blockBackground(top.root); watchFocus();
        }
    }
    function onFocus(event) {
        if (!top || redirecting) return;
        const guard = event.target.getAttribute?.('data-modal-focus-guard');
        if (guard) { const items = candidates(top); focusInside(guard === 'start' ? items.at(-1) : items[0]); return; }
        if (!top.root.contains(event.target)) { focusInside(top.last); return; }
        watchFocus();
    }
    function onKey(event) {
        if (!top || event.defaultPrevented) return;
        if (event.key === 'Tab') {
            // Native frame/media controls own their inner Tab order; guards catch their exit.
            if (['IFRAME', 'AUDIO', 'VIDEO'].includes(doc.activeElement?.tagName)) return;
            const items = candidates(top), index = items.indexOf(doc.activeElement);
            if (!items.length) { event.preventDefault(); focusInside(); }
            else if (index < 0 || (event.shiftKey ? index === 0 : index === items.length - 1)) {
                event.preventDefault(); focusInside(event.shiftKey ? items.at(-1) : items[0]);
            }
        } else if (['Enter', ' '].includes(event.key) && !top.root.contains(event.target)) {
            event.preventDefault(); event.stopImmediatePropagation(); focusInside(top.last);
        }
    }
    function onEscape(event) {
        if (!top || event.key !== 'Escape' || event.defaultPrevented || event.cancelBubble) return;
        const volume = doc.getElementById('metroVolContainer');
        if (top.root.contains(volume) && volume?.classList.contains('expanded')) return;
        if (!usable(top.close, true)) return; // Keep the existing Escape fallback if a close control is unavailable.
        event.preventDefault(); event.stopImmediatePropagation(); top.close?.click();
    }
    function onPointer(event) {
        if (top && !top.root.contains(event.target)) { event.preventDefault(); event.stopImmediatePropagation(); focusInside(top.last); }
    }
    const listen = (target, type, handler, capture = false) => {
        target.addEventListener(type, handler, capture); listeners.push(() => target.removeEventListener(type, handler, capture));
    };
    for (const entry of entries) {
        attributes.set(entry.root, Object.fromEntries(['role', 'aria-modal', 'tabindex'].map(key => [key, entry.root.getAttribute(key)])));
        entry.root.setAttribute('role', 'dialog');
        if (!entry.root.hasAttribute('tabindex')) entry.root.setAttribute('tabindex', '-1');
        for (const side of ['start', 'end']) {
            const guard = doc.createElement('span'); guard.tabIndex = 0; guard.setAttribute('data-modal-focus-guard', side);
            Object.assign(guard.style, { position: 'fixed', width: '1px', height: '1px', padding: '0', opacity: '0', pointerEvents: 'none', outline: 'none' });
            if (side === 'start') entry.root.prepend(guard); else entry.root.append(guard);
            entry.guards.push(guard);
        }
    }
    const observer = new win.MutationObserver(sync);
    for (const entry of entries) observer.observe(entry.root, { attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
    observer.observe(doc.body, { childList: true });
    // During native frame navigation activeElement can briefly be body. Repair on
    // focusin/actual DOM changes, not focusout, so Tab can leave the frame normally.
    listen(doc, 'focusin', onFocus, true);
    listen(doc, 'keydown', onKey, true); listen(doc, 'keydown', onEscape);
    listen(doc, 'pointerdown', onPointer, true); listen(doc, 'click', onPointer, true);
    listen(win, 'resize', requestSync);
    const controller = { refresh: sync, get activeModal() { return top?.root || null; }, destroy() {
        if (destroyed) return;
        destroyed = true; observer.disconnect(); focusedObserver.disconnect(); listeners.forEach(remove => remove());
        const previous = top; top = null; restoreBackground();
        for (const entry of entries) { entry.guards.forEach(guard => guard.remove());
            for (const [key, value] of Object.entries(attributes.get(entry.root))) {
                if (value === null) entry.root.removeAttribute(key); else entry.root.setAttribute(key, value);
            }
        }
        controllers.delete(doc); if (previous) returnFocus(previous);
    } };
    controllers.set(doc, controller); sync(); return controller;
}

// Independent UI bootstrap; no app/audio imports and no changes to the score pipeline.
if (typeof document !== 'undefined' && document.defaultView?.MutationObserver) createModalFocusController(document);
