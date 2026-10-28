import { CHORD_TONE_ROOTS, getChordToneVariant, getChordToneLabel } from "./config/chordTones.js";

// 選択と回数表示だけを担当。保存・完走判定はpracticeProgressへ委ね、練習時計には触れない。
export function initChordTonePractice(root, stages, openStage, progress = null) {
    if (!root || !stages.length) return null;
    root.innerHTML = '<div class="scale-form-buttons" role="group" aria-label="CAGEDフォーム">'
        + stages.map(stage => '<button type="button" class="scale-choice" id="chord-tones-' + stage.id
            + '" data-chord-tone-id="' + stage.id + '" aria-pressed="false" aria-controls="chordToneDetails">'
            + '<strong>' + stage.code + '</strong><span>M7コードトーン</span><span>' + stage.formId + 'フォーム</span>'
            + '<span class="scale-form-count" data-chord-tone-total aria-hidden="true"></span>'
            + '<span class="scale-form-count" data-chord-tone-practiced aria-hidden="true"></span></button>').join("")
        + '</div><div id="chordToneDetails" class="scale-details" role="region" aria-label="選択中のコードトーン">'
        + '<h4 data-chord-tone-title></h4><p data-chord-tone-description></p><p data-chord-tone-meta></p>'
        + '<p class="scale-key-label">選択コード：<strong data-chord-tone-root-label></strong></p>'
        + '<div class="scale-key-buttons" role="group" aria-label="コード選択">'
        + CHORD_TONE_ROOTS.map(key => '<button type="button" class="scale-key-choice" data-chord-tone-root="' + key.id
            + '" aria-pressed="false" aria-label="' + getChordToneLabel(stages[0].chordTypeId, key.id) + '"><span>' + getChordToneLabel(stages[0].chordTypeId, key.id) + '</span>'
            + '<span class="scale-key-count" data-chord-tone-count aria-hidden="true"></span></button>').join("")
        + '</div><p data-chord-tone-range></p><button id="chordToneStartBtn" type="button" class="ex-start-btn">▶ 練習する</button>'
        + '</div><p class="scale-selection-status" role="status" data-chord-tone-status></p>';
    const forms = [...root.querySelectorAll("[data-chord-tone-id]")];
    const keys = [...root.querySelectorAll("[data-chord-tone-root]")];
    const start = root.querySelector("#chordToneStartBtn");
    const selectedRoots = new Map(stages.map(stage => [stage, "c"]));
    let selected = stages[0], current = null, destroyed = false;
    function refreshCounts(changed) {
        if (destroyed || changed && !stages.some(stage => stage.lessonId === changed.lessonId)) return;
        forms.forEach((button, i) => {
            const stage = stages[i], summary = progress?.getChordToneSummary(stage) || { total: "0", practicedCodes: 0 };
            button.querySelector("[data-chord-tone-total]").textContent = "練習合計" + summary.total + "回";
            button.querySelector("[data-chord-tone-practiced]").textContent = "練習済み " + summary.practicedCodes + "/12";
            button.setAttribute("aria-label", stage.code + "、M7コードトーン、" + stage.formId + "フォーム、練習合計" + summary.total + "回、練習済み" + summary.practicedCodes + "/12コード");
        });
        keys.forEach((button, i) => {
            const key = CHORD_TONE_ROOTS[i], count = progress?.getCount(getChordToneVariant(selected, key.id)) || 0;
            button.querySelector("[data-chord-tone-count]").textContent = count ? "✓ 練習" + count + "回" : "未練習";
            button.setAttribute("aria-label", getChordToneLabel(selected.chordTypeId, key.id) + "、" + (count ? "練習" + count + "回" : "未練習"));
        });
    }
    const unsubscribe = progress?.subscribe(refreshCounts);
    function select(stage, rootId = selectedRoots.get(stage), updateHistory = false) {
        if (destroyed) return;
        const variant = getChordToneVariant(stage, rootId);
        if (!variant) return;
        selected = stage; selectedRoots.set(stage, rootId); current = variant;
        forms.forEach((button, i) => button.setAttribute("aria-pressed", String(stages[i] === selected)));
        keys.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.chordToneRoot === rootId)));
        refreshCounts();
        root.querySelector("[data-chord-tone-title]").innerText = stage.code + "：M7コードトーン／" + stage.formId + "フォーム";
        root.querySelector("[data-chord-tone-description]").innerText = variant.desc;
        root.querySelector("[data-chord-tone-root-label]").innerText = variant.chordLabel;
        root.querySelector("[data-chord-tone-meta]").innerText = "BPM " + variant.bpm + "・" + variant.timeSignature.join("/") + "・" + variant.practiceBars + "小節";
        root.querySelector("[data-chord-tone-range]").innerText = "フレット範囲：" + variant.minFret + "〜" + variant.maxFret + "F";
        root.querySelector("[data-chord-tone-status]").innerText = stage.code + "、" + stage.formId + "フォーム、" + variant.chordLabel + "を選択";
        start.disabled = !variant.available;
        const hash = "#chord-tones-" + stage.id;
        if (updateHistory && window.location.hash !== hash) window.history.pushState(null, "", hash);
    }
    function fromHash() {
        const match = /^#chord-tones-([1-9]\d*)$/.exec(window.location?.hash || "");
        const stage = match && stages.find(s => s.id === Number(match[1]));
        if (stage) select(stage);
    }
    function bindChoices(buttons, choose) {
        buttons.forEach((button, index) => {
            button.addEventListener("click", () => choose(index));
            button.addEventListener("keydown", event => {
                let next;
                if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % buttons.length;
                else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index + buttons.length - 1) % buttons.length;
                else if (event.key === "Home") next = 0;
                else if (event.key === "End") next = buttons.length - 1;
                if (next === undefined) return; // Enter/Spaceはbutton標準の操作。
                event.preventDefault(); buttons[next].focus(); choose(next);
            });
        });
    }
    bindChoices(forms, index => select(stages[index], selectedRoots.get(stages[index]), true));
    bindChoices(keys, index => select(selected, keys[index].dataset.chordToneRoot));
    start.addEventListener("click", () => { if (!destroyed && current?.available) openStage(current); });
    select(selected); fromHash();
    window.addEventListener("hashchange", fromHash);
    window.addEventListener("popstate", fromHash);
    return {
        get selected() { return current; },
        destroy() {
            destroyed = true;
            unsubscribe?.();
            window.removeEventListener("hashchange", fromHash);
            window.removeEventListener("popstate", fromHash);
        }
    };
}
