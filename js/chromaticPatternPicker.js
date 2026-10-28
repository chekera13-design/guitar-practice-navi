// 運指選択と教材の起動だけを扱う。音声・保存データ・練習セッションには触れない。
export function initChromaticPatternPicker(root, stages, openStage, progress = null) {
    if (!root) return null;
    const singles = stages.filter(stage => stage.patternType === "single");
    root.innerHTML = '<div class="chromatic-pattern-grid" role="group" aria-label="単独運指パターン">'
        + singles.map(stage => '<button type="button" class="chromatic-pattern" id="chromatic-' + stage.id
            + '" data-chromatic-id="' + stage.id + '" aria-pressed="false" aria-controls="chromaticSelection">'
            + '<strong>' + stage.fingering + '</strong><span>' + stage.code + '</span>'
            + '<span class="practice-count" data-practice-count aria-hidden="true" hidden></span></button>').join("")
        + '</div><div id="chromaticSelection" class="chromatic-selection" role="region" aria-label="選択中の教材">'
        + '<span class="badge-tag">単独パターン</span><h4 data-chromatic-title></h4>'
        + '<p data-chromatic-meta></p><p data-chromatic-frets></p>'
        + '<button id="chromaticStartBtn" type="button" class="ex-start-btn">▶ 練習する</button></div>'
        + '<p class="chromatic-selection-status" role="status" data-chromatic-status></p>';
    const buttons = [...root.querySelectorAll("[data-chromatic-id]")];
    const start = root.querySelector("#chromaticStartBtn");
    const title = root.querySelector("[data-chromatic-title]");
    const meta = root.querySelector("[data-chromatic-meta]");
    const frets = root.querySelector("[data-chromatic-frets]");
    const status = root.querySelector("[data-chromatic-status]");
    const refreshCounts = changed => buttons.forEach((button, index) => {
        const stage = singles[index];
        if (changed && changed !== stage) return;
        const count = progress?.getCount(stage) || 0;
        const badge = button.querySelector?.("[data-practice-count]");
        if (badge) { badge.hidden = count === 0; badge.textContent = count ? "✓ 練習" + count + "回" : ""; }
        button.setAttribute("aria-label", stage.fingering + "、" + stage.code + "、練習" + count + "回");
    });
    refreshCounts();
    const unsubscribe = progress?.subscribe(refreshCounts);
    let selected = null;
    function select(stage, { navigate = false, focus = false } = {}) {
        if (!singles.includes(stage)) return;
        const changed = selected !== stage;
        selected = stage;
        for (const button of buttons) {
            const active = Number(button.dataset.chromaticId) === stage.id;
            button.setAttribute("aria-pressed", String(active));
            if (active && focus) button.focus({ preventScroll: true });
        }
        title.innerText = stage.title;
        meta.innerText = stage.code + "・運指 " + stage.fingering + "・BPM " + stage.bpm
            + "・" + stage.practiceBars + "小節・" + stage.timeSignature.join("/");
        frets.innerText = "フレット順：" + stage.fretOrder.join(" → ") + "（各弦2回）";
        start.disabled = !stage.available;
        if (changed) status.innerText = stage.code + "、運指" + stage.fingering + "を選択";
        if (navigate && window.location?.hash !== "#chromatic-" + stage.id) {
            // 表示位置は保ち、履歴だけを追加。戻る／進むは最新URLから再選択する。
            window.history.pushState(null, "", "#chromatic-" + stage.id);
        }
    }
    const fromHash = () => {
        const match = /^#chromatic-([1-9]\d*)$/.exec(window.location?.hash || "");
        if (match) select(singles.find(stage => stage.id === Number(match[1])));
    };
    buttons.forEach((button, index) => {
        button.addEventListener("click", () => select(singles[index], { navigate: true }));
        button.addEventListener("keydown", event => {
            let next;
            if (event.key === "ArrowRight") next = (index + 1) % singles.length;
            else if (event.key === "ArrowLeft") next = (index + singles.length - 1) % singles.length;
            else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = singles.length - 1;
            else if (event.key === "Enter" || event.key === " ") next = index;
            if (next === undefined) return;
            event.preventDefault();
            select(singles[next], { navigate: true, focus: true });
        });
    });
    start.addEventListener("click", () => {
        if (selected?.available) openStage(selected);
    });
    if (singles.length) select(singles[0]);
    fromHash();
    window.addEventListener("hashchange", fromHash);
    window.addEventListener("popstate", fromHash);
    return {
        get selected() { return selected; },
        destroy() {
            unsubscribe?.();
            window.removeEventListener("hashchange", fromHash);
            window.removeEventListener("popstate", fromHash);
        }
    };
}
