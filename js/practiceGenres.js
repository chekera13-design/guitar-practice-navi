// ホームだけの表示状態。教材・練習セッション・完了データ・URL履歴には書き込まない。
export function initPracticeGenres(root) {
    if (!root) return null;
    const tabs = [...root.querySelectorAll('[role="tab"][data-practice-genre]')];
    const panels = [...root.querySelectorAll('[role="tabpanel"][data-practice-panel]')];
    const entries = tabs.map(tab => ({ tab, key: tab.dataset.practiceGenre,
        panel: panels.find(panel => panel.id === tab.getAttribute('aria-controls')
            && panel.dataset.practicePanel === tab.dataset.practiceGenre) })).filter(entry => entry.panel);
    if (!entries.length) return null;
    const positions = new Map();
    let selected = null;
    const select = (entry, { focus = false, restoreScroll = true } = {}) => {
        if (selected !== entry) {
            if (selected) positions.set(selected.key, window.scrollY || 0);
            for (const item of entries) {
                const active = item === entry;
                item.tab.setAttribute('aria-selected', String(active));
                item.tab.tabIndex = active ? 0 : -1;
                item.panel.hidden = !active;
            }
            selected = entry;
            if (restoreScroll && positions.has(entry.key)) window.scrollTo?.({ top: positions.get(entry.key), behavior: 'instant' });
        }
        if (focus) entry.tab.focus();
    };
    for (const [index, entry] of entries.entries()) {
        entry.tab.addEventListener('click', () => select(entry));
        entry.tab.addEventListener('keydown', event => {
            let next;
            if (event.key === 'ArrowRight') next = (index + 1) % entries.length;
            else if (event.key === 'ArrowLeft') next = (index + entries.length - 1) % entries.length;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = entries.length - 1;
            if (next === undefined) return; // Enter/Spaceはbutton本来の操作を使う。
            event.preventDefault();
            select(entries[next], { focus: true });
        });
    }
    const revealHash = () => {
        let id;
        try { id = decodeURIComponent((window.location?.hash || '').slice(1)); } catch { return; }
        if (!id) return;
        const target = document.getElementById(id);
        const entry = entries.find(item => target && item.panel.contains(target));
        if (!entry) return;
        select(entry, { restoreScroll: false });
        target.scrollIntoView?.({ block: 'start' });
    };
    select(entries[0]);
    window.addEventListener('hashchange', revealHash);
    revealHash();
    return { get selected() { return selected.key; } };
}
