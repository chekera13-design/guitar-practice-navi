import { renderPracticeCount, renderPracticeTotal } from "./practiceCountDisplay.js";

// 運指選択と教材の起動だけを扱う。音声・保存データ・練習セッションには触れない。
export function initChromaticPatternPicker(root, stages, openStage, progress = null, presentation = null) {
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
    presentation?.arrange(root, singles);
    let selected = null, destroyed = false;
    const buttons = [...root.querySelectorAll("[data-chromatic-id]")];
    const start = root.querySelector("#chromaticStartBtn");
    const title = root.querySelector("[data-chromatic-title]");
    const meta = root.querySelector("[data-chromatic-meta]");
    const frets = root.querySelector("[data-chromatic-frets]");
    const status = root.querySelector("[data-chromatic-status]");
    const refreshCounts = changed => {
        if (destroyed || changed && !singles.includes(changed)) return;
        buttons.forEach((button, index) => {
            const stage = singles[index];
            if (changed && changed !== stage) return;
            const count = progress?.getCount(stage) || 0;
            const badge = button.querySelector?.("[data-practice-count]");
            if (badge) { badge.hidden = count === 0; badge.textContent = count ? "✓ 練習" + count + "回" : ""; }
            button.setAttribute("aria-label", stage.fingering + "、" + stage.code + "、練習" + count + "回");
        });
        if (selected) presentation?.counts(selected);
    };
    refreshCounts();
    const unsubscribe = progress?.subscribe(refreshCounts);
    function select(stage, { navigate = false, focus = false } = {}) {
        if (destroyed || !singles.includes(stage)) return;
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
        presentation?.selection(stage); presentation?.counts(stage);
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
        if (!destroyed && selected?.available) openStage(selected, presentation?.modal(selected));
    });
    if (singles.length) select(singles[0]);
    fromHash();
    window.addEventListener("hashchange", fromHash);
    window.addEventListener("popstate", fromHash);
    return {
        get selected() { return selected; },
        selectStage: select,
        destroy() {
            destroyed = true;
            unsubscribe?.();
            window.removeEventListener("hashchange", fromHash);
            window.removeEventListener("popstate", fromHash);
        }
    };
}

// The display card groups the existing permutations; lesson identities stay unchanged.
export function initChromaticPracticeCard(root, stages, openStage, progress = null) {
    if (!root || !stages.some(s => s.patternType === "single")) return null;
    let controller, select, count, total, meta, previous, next;
    const presentation = {
        arrange(body, singles) {
            const grid = body.querySelector(".chromatic-pattern-grid"), detail = body.querySelector(".chromatic-selection"), status = body.querySelector("[data-chromatic-status]");
            grid.hidden = true; grid.setAttribute("aria-hidden", "true");
            const card = document.createElement("article"); card.className = "practice-type-card chromatic-practice-card practice-count-card"; card.id = "chromatic-type-card";
            card.setAttribute("data-chromatic-card", "single"); card.setAttribute("aria-labelledby", "chromaticCardTitle");
            card.innerHTML = '<header class="practice-type-header"><h3 id="chromaticCardTitle">EX01 クロマチック練習①</h3><span class="practice-type-total" data-chromatic-total></span></header>'
                + '<label class="chromatic-pattern-label" for="chromaticPatternSelect">練習内容</label><div class="chromatic-navigation" role="group" aria-label="運指の切り替え"><button type="button" class="chromatic-step" data-chromatic-previous aria-label="前の運指" aria-controls="chromaticPatternSelect"><span aria-hidden="true">←</span></button><select id="chromaticPatternSelect" data-chromatic-select aria-controls="chromaticSelection">'
                + singles.map((s, index) => '<option value="' + s.id + '">No.' + String(index + 1).padStart(2, '0') + ' | ' + s.fingering + '</option>').join("") + '</select><button type="button" class="chromatic-step" data-chromatic-next aria-label="次の運指" aria-controls="chromaticPatternSelect"><span aria-hidden="true">→</span></button></div>';
            body.insertBefore(card, grid); card.appendChild(grid); card.appendChild(detail); card.appendChild(status);
            detail.querySelector(".badge-tag").hidden = true; detail.querySelector("h4").hidden = true;
            select = card.querySelector("select"); total = card.querySelector("[data-chromatic-total]"); meta = detail.querySelector("[data-chromatic-meta]");
            count = document.createElement("p"); count.className = "practice-key-summary practice-current-count"; count.setAttribute("data-chromatic-selected-count", ""); count.setAttribute("aria-live", "polite");
            detail.insertBefore(count, detail.querySelector(".ex-start-btn"));
            previous = card.querySelector("[data-chromatic-previous]"); next = card.querySelector("[data-chromatic-next]");
            const step = delta => {
                const index = select.selectedIndex + delta;
                if (select.disabled || index < 0 || index >= select.options.length || select.options[index].disabled) return;
                select.selectedIndex = index;
                select.dispatchEvent(new Event("change", { bubbles: true }));
            };
            previous.addEventListener("click", () => step(-1)); next.addEventListener("click", () => step(1));
            select.addEventListener("change", () => {
                const next = singles.find(s => String(s.id) === select.value);
                if (next) controller.selectStage(next, { navigate: true });
                else select.value = String(controller.selected.id);
            });
        },
        selection(stage) {
            select.value = String(stage.id);
            previous.disabled = select.selectedIndex <= 0;
            next.disabled = select.selectedIndex >= select.options.length - 1;
            meta.textContent = "BPM " + stage.bpm + "・" + stage.timeSignature.join("/") + "・" + stage.practiceBars + "小節";
        },
        counts(stage) {
            const n = progress?.getCount(stage) || 0;
            renderPracticeCount(count, n);
            const sum = stages.filter(s => s.patternType === "single").reduce((a, s) => a + BigInt(progress?.getCount(s) || 0), 0n);
            renderPracticeTotal(total, sum, "このカードの24運指全体の練習合計");
        },
        modal(stage) {
            return { stageBadge: "クロマチック練習① EX01", title: "EX01：クロマチック練習①・運指" + stage.fingering + "（" + stage.code + "）" };
        }
    };
    controller = initChromaticPatternPicker(root, stages, openStage, progress, presentation);
    return controller;
}
