import { renderPracticeCount, renderPracticeTotal } from "./practiceCountDisplay.js";
import { CHORD_PROGRESSION_TITLE } from "./config/chordProgressions.js";

// Selection and presentation only. The existing modal fixes the stage and completion destination.
export function initChordProgressionPractice(root, stages, openStage, progress = null) {
    if (!root || !stages.length) return null;
    const ids = [...new Set(stages.map(s => s.id))];
    if (ids.length > 1) {
        root.innerHTML = "";
        const controllers = ids.map(id => {
            const host = document.createElement("div");
            root.appendChild(host);
            return initChordProgressionPractice(host, stages.filter(s => s.id === id), openStage, progress);
        });
        return {
            get selected() {
                return (controllers.find(c => window.location.hash === "#chord-progression-" + c.selected.id + "-" + c.selected.variantId) || controllers[0]).selected;
            },
            destroy() { controllers.forEach(c => c.destroy()); }
        };
    }
    const first = stages[0], cardId = "chord-progression-" + first.id;
    const cardTitle = first.cardTitle || CHORD_PROGRESSION_TITLE;
    const titleId = "chordProgressionTitle" + first.id;
    root.innerHTML = '<article id="' + cardId + '" class="practice-type-card chord-progression-card practice-count-card" data-chord-progression-card aria-labelledby="' + titleId + '">'
        + '<header class="practice-type-header"><h3 id="' + titleId + '">' + cardTitle + '</h3><span class="practice-type-total" data-progression-total></span></header>'
        + '<div class="chord-progression-choices" role="group" aria-label="循環コードの種類">'
        + stages.map(s => '<button type="button" id="' + cardId + '-' + s.variantId + '" data-progression-variant="' + s.variantId + '" aria-pressed="false">' + s.variantLabel + '</button>').join("")
        + '</div><p class="chord-progression-roman" data-progression-roman>' + first.roman + '</p><p class="chord-progression-flow" data-progression-flow></p>'
        + '<p class="chord-progression-meta" data-progression-meta></p><p class="practice-key-summary practice-current-count" data-progression-count aria-live="polite"></p>'
        + '<button type="button" class="ex-start-btn" data-progression-start>▶ 練習する</button></article>';
    const buttons = [...root.querySelectorAll("[data-progression-variant]")], flow = root.querySelector("[data-progression-flow]"),
        meta = root.querySelector("[data-progression-meta]"), count = root.querySelector("[data-progression-count]"),
        total = root.querySelector("[data-progression-total]"), start = root.querySelector("[data-progression-start]");
    let selected = stages[0];
    function refresh() {
        const n = progress?.getCount(selected) || 0;
        renderPracticeCount(count, n);
        renderPracticeTotal(total, stages.reduce((sum, s) => sum + BigInt(progress?.getCount(s) || 0), 0n), first.code + "の全バリエーションの練習合計");
    }
    function select(stage, navigate = false) {
        if (!stages.includes(stage)) return;
        selected = stage;
        buttons.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.progressionVariant === selected.variantId)));
        const roman = root.querySelector("[data-progression-roman]");
        if (roman) roman.textContent = selected.roman;
        flow.textContent = selected.progression.join(" → ");
        meta.textContent = "BPM " + selected.bpm + "・" + selected.timeSignature.join("/") + "・" + selected.practiceBars + "小節・" + (selected.rhythmLabel || "2分音符（終止は全音符）");
        start.disabled = !selected.available;
        refresh();
        const hash = "#" + cardId + "-" + selected.variantId;
        if (navigate && window.location.hash !== hash) window.history.pushState(null, "", hash);
    }
    const fromHash = () => {
        const stage = stages.find(s => window.location.hash === "#" + cardId + "-" + s.variantId);
        if (stage) select(stage);
    };
    buttons.forEach(button => button.addEventListener("click", () => select(stages.find(s => s.variantId === button.dataset.progressionVariant), true)));
    start.addEventListener("click", () => { if (selected.available) openStage(selected); });
    const unsubscribe = progress?.subscribe(refresh);
    select(stages[0]); fromHash();
    window.addEventListener("hashchange", fromHash); window.addEventListener("popstate", fromHash);
    return { get selected() { return selected; }, destroy() { unsubscribe?.(); window.removeEventListener("hashchange", fromHash); window.removeEventListener("popstate", fromHash); } };
}
