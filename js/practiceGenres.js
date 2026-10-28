// ホームのカテゴリとURL履歴だけを扱い、練習セッションや保存データは変更しない。
export function initPracticeGenres(root) {
    if (!root) return null;
    const tabs = [...root.querySelectorAll('[role="tab"][data-practice-genre]')];
    const panels = [...root.querySelectorAll('[role="tabpanel"][data-practice-panel]')];
    const entries = tabs.map(tab => ({ tab, key: tab.dataset.practiceGenre,
        panel: panels.find(panel => panel.id === tab.getAttribute('aria-controls')
            && panel.dataset.practicePanel === tab.dataset.practiceGenre) })).filter(entry => entry.panel);
    if (!entries.length) return null;
    const categories = [...root.querySelectorAll("[data-exercise-category]")]
        .filter(section => section.dataset.exerciseCategory)
        .map(section => ({ section, key: section.dataset.exerciseCategory,
            anchor: section.getAttribute("aria-labelledby"),
            entry: entries.find(item => item.panel.contains(section)) }))
        .filter(category => category.entry);
    const links = [...root.querySelectorAll("[data-category-link]")];
    const lastCategory = new Map();
    const defaultCategory = entry => categories.find(category =>
        category.key === lastCategory.get(entry.key)) || categories.find(category =>
        category.entry === entry && category.key === entry.key)
        || categories.find(category => category.entry === entry);
    let selectedCategory = null;
    const showCategory = category => {
        if (!category) return;
        for (const item of categories) item.section.hidden = item !== category;
        for (const link of links) {
            if (link.getAttribute("href") === "#" + category.anchor) link.setAttribute("aria-current", "true");
            else link.removeAttribute("aria-current");
        }
        selectedCategory = category;
        lastCategory.set(category.entry.key, category.key);
    };
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
    const selectGenre = (entry, options) => {
        select(entry, options);
        const category = defaultCategory(entry);
        showCategory(category);
        if (category && window.location.hash !== "#" + category.anchor) {
            window.history.pushState(null, "", "#" + category.anchor);
        }
    };
    for (const [index, entry] of entries.entries()) {
        entry.tab.addEventListener('click', () => selectGenre(entry));
        entry.tab.addEventListener('keydown', event => {
            let next;
            if (event.key === 'ArrowRight') next = (index + 1) % entries.length;
            else if (event.key === 'ArrowLeft') next = (index + entries.length - 1) % entries.length;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = entries.length - 1;
            if (next === undefined) return; // Enter/Spaceはbutton本来の操作を使う。
            event.preventDefault();
            selectGenre(entries[next], { focus: true });
        });
    }
    const revealHash = () => {
        let id;
        try { id = decodeURIComponent((window.location?.hash || '').slice(1)); } catch { return; }
        if (!id) {
            select(entries[0], { restoreScroll: false });
            showCategory(categories.find(category => category.key === "basic") || defaultCategory(entries[0]));
            return;
        }
        const target = document.getElementById(id);
        const entry = entries.find(item => target && item.panel.contains(target));
        if (!entry) return;
        select(entry, { restoreScroll: false });
        showCategory(categories.find(category => category.section.contains(target)) || defaultCategory(entry));
        target.scrollIntoView?.({ block: 'start' });
    };
    select(entries[0]);
    showCategory(defaultCategory(entries[0]));
    window.addEventListener('hashchange', revealHash);
    window.addEventListener('popstate', revealHash);
    revealHash();
    return { get selected() { return selected.key; },
        get category() { return selectedCategory?.key || null; } };
}
