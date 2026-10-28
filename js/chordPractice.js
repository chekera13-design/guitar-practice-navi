import { createChordDiagram, chordFormText } from "./chordDiagram.js";

// コードの検索・選択と既存モーダルへの接続だけを担当。音声や練習時計は変更しない。
export function initChordPractice(root, stages, forms, openStage, progress = null) {
    if (!root) return null;
    const entries = stages.filter(stage => stage.practiceType === "single-chord")
        .map(stage => ({ stage, form: forms.find(form => form.id === stage.formId) }))
        .filter(entry => entry.form);
    root.innerHTML = '<div class="chord-search-controls"><label for="chordSearch">コード名で検索'
        + '<input id="chordSearch" type="search" placeholder="例：C、Am" autocomplete="off"></label>'
        + '<label for="chordQuality">種類<select id="chordQuality"><option value="all">すべて</option>'
        + '<option value="major">メジャー</option><option value="minor">マイナー</option></select></label></div>'
        + '<div class="chord-buttons" role="group" aria-label="基本コード">'
        + entries.map(({stage, form}) => '<button type="button" class="chord-choice" id="chords-' + stage.id
            + '" data-chord-stage-id="' + stage.id + '" aria-pressed="false" aria-controls="chordDetails">'
            + '<span>' + form.name + '</span><span class="practice-count" data-practice-count aria-hidden="true" hidden></span></button>').join("")
        + '</div><p data-chord-empty hidden>該当するコードがありません。検索条件を変えてください。</p>'
        + '<div id="chordDetails" class="chord-details" role="region" aria-label="選択中のコード">'
        + '<div data-chord-diagram></div><div class="chord-details-copy"><h4 data-chord-title></h4>'
        + '<p data-chord-quality></p><p data-chord-form></p><p data-chord-meta></p>'
        + '<button id="chordStartBtn" type="button" class="ex-start-btn">▶ 練習する</button></div></div>'
        + '<p class="chord-selection-status" role="status" data-chord-status></p>';
    const query = root.querySelector("#chordSearch"), quality = root.querySelector("#chordQuality");
    const buttons = [...root.querySelectorAll("[data-chord-stage-id]")];
    const details = root.querySelector("#chordDetails"), start = root.querySelector("#chordStartBtn");
    const empty = root.querySelector("[data-chord-empty]"), status = root.querySelector("[data-chord-status]");
    const refreshCounts = changed => buttons.forEach((button, index) => {
        const {stage, form} = entries[index];
        if (changed && changed !== stage) return;
        const count = progress?.getCount(stage) || 0;
        const badge = button.querySelector?.("[data-practice-count]");
        if (badge) { badge.hidden = count === 0; badge.textContent = count ? "✓ 練習" + count + "回" : ""; }
        button.setAttribute("aria-label", form.name + "、" + stage.code + "、練習" + count + "回");
    });
    refreshCounts();
    const unsubscribe = progress?.subscribe(refreshCounts);
    query.value = ""; quality.value = "all";
    let selected = null;
    const updateUrl = (entry, mode) => {
        const hash = entry ? "#chords-" + entry.stage.id : "#chordExercises";
        if (window.location?.hash !== hash) window.history[mode + "State"](null, "", hash);
    };
    function select(entry, mode = null) {
        selected = entry || null;
        for (const [index, button] of buttons.entries()) {
            button.setAttribute("aria-pressed", String(entries[index] === selected));
        }
        details.hidden = !selected;
        start.disabled = !selected?.stage.available;
        if (selected) {
            const {stage, form} = selected;
            root.querySelector("[data-chord-title]").innerText = form.name;
            root.querySelector("[data-chord-quality]").innerText = (form.quality === "minor" ? "マイナー" : "メジャー") + "・ローコード";
            root.querySelector("[data-chord-form]").innerText = "フォーム（6弦→1弦）：" + chordFormText(form);
            root.querySelector("[data-chord-meta]").innerText = stage.code + "・BPM " + stage.bpm + "・"
                + stage.timeSignature.join("/") + "・" + stage.practiceBars + "小節・全音符";
            root.querySelector("[data-chord-diagram]").innerHTML = createChordDiagram(form);
            status.innerText = form.name + "、フォーム " + chordFormText(form) + "を選択";
        } else status.innerText = "検索結果0件";
        if (mode) updateUrl(selected, mode);
    }
    function filter(updateSelection = true) {
        const text = query.value.trim().toLowerCase();
        const visible = entries.filter(({form}) => form.name.toLowerCase().includes(text)
            && (quality.value === "all" || form.quality === quality.value));
        for (const [index, button] of buttons.entries()) button.hidden = !visible.includes(entries[index]);
        empty.hidden = visible.length > 0;
        if (updateSelection && !visible.includes(selected)) select(visible[0], "replace");
        return visible;
    }
    const fromHash = () => {
        const match = /^#chords-([1-9]\d*)$/.exec(window.location?.hash || "");
        const entry = match && entries.find(item => item.stage.id === Number(match[1]));
        if (!entry) return;
        query.value = ""; quality.value = "all"; filter(false); select(entry);
    };
    buttons.forEach((button, index) => button.addEventListener("click", () => select(entries[index], "push")));
    query.addEventListener("input", () => filter());
    quality.addEventListener("change", () => filter());
    start.addEventListener("click", () => { if (selected?.stage.available) openStage(selected.stage); });
    select(entries[0]); filter(false); fromHash();
    window.addEventListener("hashchange", fromHash);
    window.addEventListener("popstate", fromHash);
    return {
        get selected() { return selected?.stage || null; },
        destroy() {
            unsubscribe?.();
            window.removeEventListener("hashchange", fromHash);
            window.removeEventListener("popstate", fromHash);
        }
    };
}
