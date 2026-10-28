import { SCALE_KEYS, getScaleVariant } from "./config/scales.js";

// 選択と回数表示だけを担当。保存・完走判定はpracticeProgressへ委ね、練習時計には触れない。
export function initScalePractice(root, stages, openStage, progress = null) {
    if (!root || !stages.length) return null;
    root.innerHTML = '<div class="scale-form-buttons" role="group" aria-label="CAGEDフォーム">'
        + stages.map(stage => '<button type="button" class="scale-choice" id="scales-' + stage.id
            + '" data-scale-id="' + stage.id + '" aria-pressed="false" aria-controls="scaleDetails">'
            + '<strong>' + stage.code + '</strong><span>メジャースケール</span><span>' + stage.formId + 'フォーム</span>'
            + '<span class="scale-form-count" data-scale-total aria-hidden="true"></span>'
            + '<span class="scale-form-count" data-scale-practiced aria-hidden="true"></span></button>').join("")
        + '</div><div id="scaleDetails" class="scale-details" role="region" aria-label="選択中のスケール">'
        + '<h4 data-scale-title></h4><p data-scale-description></p><p data-scale-meta></p>'
        + '<p class="scale-key-label">選択キー：<strong data-scale-key-label></strong></p>'
        + '<div class="scale-key-buttons" role="group" aria-label="メジャースケールのキー">'
        + SCALE_KEYS.map(key => '<button type="button" class="scale-key-choice" data-scale-key="' + key.id
            + '" aria-pressed="false" aria-label="' + key.label + 'メジャー"><span>' + key.label + '</span>'
            + '<span class="scale-key-count" data-scale-count aria-hidden="true"></span></button>').join("")
        + '</div><p data-scale-range></p><button id="scaleStartBtn" type="button" class="ex-start-btn">▶ 練習する</button>'
        + '</div><p class="scale-selection-status" role="status" data-scale-status></p>';
    const forms = [...root.querySelectorAll("[data-scale-id]")];
    const keys = [...root.querySelectorAll("[data-scale-key]")];
    const start = root.querySelector("#scaleStartBtn");
    const selectedKeys = new Map(stages.map(stage => [stage, "c"]));
    let selected = stages[0], current = null, destroyed = false;
    function refreshCounts(changed) {
        if (destroyed || changed && !stages.some(stage => stage.lessonId === changed.lessonId)) return;
        forms.forEach((button, i) => {
            const stage = stages[i], summary = progress?.getScaleSummary(stage) || { total: "0", practicedKeys: 0 };
            button.querySelector("[data-scale-total]").textContent = "練習合計" + summary.total + "回";
            button.querySelector("[data-scale-practiced]").textContent = "練習済み " + summary.practicedKeys + "/12";
            button.setAttribute("aria-label", stage.code + "、メジャースケール、" + stage.formId + "フォーム、練習合計" + summary.total + "回、練習済み" + summary.practicedKeys + "/12キー");
        });
        keys.forEach((button, i) => {
            const key = SCALE_KEYS[i], count = progress?.getCount(getScaleVariant(selected, key.id)) || 0;
            button.querySelector("[data-scale-count]").textContent = count ? "✓ 練習" + count + "回" : "未練習";
            button.setAttribute("aria-label", key.label + "メジャー、" + (count ? "練習" + count + "回" : "未練習"));
        });
    }
    const unsubscribe = progress?.subscribe(refreshCounts);
    function select(stage, keyId = selectedKeys.get(stage), updateHistory = false) {
        if (destroyed) return;
        const variant = getScaleVariant(stage, keyId);
        if (!variant) return;
        selected = stage; selectedKeys.set(stage, keyId); current = variant;
        forms.forEach((button, i) => button.setAttribute("aria-pressed", String(stages[i] === selected)));
        keys.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.scaleKey === keyId)));
        refreshCounts();
        root.querySelector("[data-scale-title]").innerText = stage.code + "：メジャースケール／" + stage.formId + "フォーム";
        root.querySelector("[data-scale-description]").innerText = variant.desc;
        root.querySelector("[data-scale-key-label]").innerText = variant.keyLabel + "メジャー";
        root.querySelector("[data-scale-meta]").innerText = "BPM " + variant.bpm + "・" + variant.timeSignature.join("/") + "・" + variant.practiceBars + "小節";
        root.querySelector("[data-scale-range]").innerText = "フレット範囲：" + variant.minFret + "〜" + variant.maxFret + "F";
        root.querySelector("[data-scale-status]").innerText = stage.code + "、" + stage.formId + "フォーム、" + variant.keyLabel + "メジャーを選択";
        start.disabled = !variant.available;
        const hash = "#scales-" + stage.id;
        if (updateHistory && window.location.hash !== hash) window.history.pushState(null, "", hash);
    }
    function fromHash() {
        const match = /^#scales-([1-9]\d*)$/.exec(window.location?.hash || "");
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
    bindChoices(forms, index => select(stages[index], selectedKeys.get(stages[index]), true));
    bindChoices(keys, index => select(selected, keys[index].dataset.scaleKey));
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
