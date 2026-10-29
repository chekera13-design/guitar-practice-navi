import { createPracticeTypeCards } from "./practiceTypeCards.js";
import { getPracticeFormLabel } from "./practiceFormLabels.js";
import { sortPracticePositions, resolvePracticePosition } from "./practicePositions.js";
import { createKeyDisclosure } from "./keyDisclosure.js";
import { SCALE_KEYS, getScaleVariant, getScaleKeys, getScalePositions } from "./config/scales.js";

// 選択と回数の表示だけを担当。譜面取得・音声・練習時計は既存の開始処理へ委ねる。
export function initScalePractice(root, stages, openStage, progress = null, presentation = null) {
    if (!root || !stages.length) return null;
    const find = selector => root.querySelector(presentation?.suffix ? selector.replace(/#([A-Za-z][A-Za-z0-9]*)/g, (_, id) => "#" + id + "-" + presentation.suffix) : selector);
    const typeName = stage => stage.scaleType === "naturalMinor" ? "ナチュラルマイナー" : "メジャースケール";
    const keyName = (stage, key) => key.label + (stage.scaleType === "naturalMinor" ? "" : "メジャー");
    root.innerHTML = '<div class="scale-form-buttons" role="group" aria-label="スケール教材・フォーム">'
        + stages.map(stage => '<button type="button" class="scale-choice" id="scales-' + stage.id
            + '" data-scale-id="' + stage.id + '" aria-pressed="false" aria-controls="scaleDetails">'
            + '<strong class="scale-choice-title">' + stage.code + ' <span>' + typeName(stage) + '</span></strong><span class="scale-form-label">' + getPracticeFormLabel(stage.formId) + '</span><span class="scale-choice-counts">'
            + '<span class="scale-form-count" data-scale-total aria-hidden="true"></span>'
            + '<span class="scale-form-count" data-scale-practiced aria-hidden="true"></span></span></button>').join("")
        + '</div><div id="scaleDetails" class="scale-details" role="region" aria-label="選択中のスケール">'
        + '<h4 data-scale-title></h4><p class="scale-selected-form" data-scale-form-label></p><p data-scale-description hidden></p><div class="scale-selection-meta"><span data-scale-meta></span><span data-scale-range></span></div>'
        + '<p class="scale-key-label">練習するキー：<strong data-scale-key-label></strong></p>'
        + '<p class="practice-key-summary" data-scale-selected-count aria-live="polite"></p>'
        + '<button id="scaleKeyToggle" type="button" class="practice-key-toggle" aria-expanded="false" aria-controls="scaleKeyPanel">ほかのキーで練習 ▼</button>'
        + '<div id="scaleKeyPanel" class="practice-key-panel" hidden><div class="scale-key-buttons" role="group" aria-label="スケールのキー">'
        + SCALE_KEYS.map(key => '<button type="button" class="scale-key-choice" data-scale-key="' + key.id
            + '" aria-pressed="false"><span data-scale-key-name>' + key.label + '</span>'
            + '<span class="scale-key-count" data-scale-count aria-hidden="true"></span></button>').join("")
        + '</div></div><div data-scale-position-area hidden><p>ポジションを選択</p>'
        + '<div class="scale-position-buttons" data-scale-positions role="group" aria-label="ポジション選択"></div></div>'
        + '<button id="scaleStartBtn" type="button" class="ex-start-btn">▶ 練習する</button>'
        + '</div><p class="scale-selection-status" role="status" data-scale-status></p>';
    if (presentation) {
        let markup = root.innerHTML;
        for (const id of ["scaleStartBtn", "scaleDetails", "scaleKeyToggle", "scaleKeyPanel"]) markup = markup.replaceAll('"' + id + '"', '"' + id + '-' + presentation.suffix + '"');
        root.innerHTML = markup;
        presentation.arrange(root);
    }
    const forms = [...root.querySelectorAll("[data-scale-id]")];
    const keys = [...root.querySelectorAll("[data-scale-key]")];
    const start = find("#scaleStartBtn"), positionArea = find("[data-scale-position-area]"), positionGroup = find("[data-scale-positions]");
    const disclosure = createKeyDisclosure(find("#scaleKeyToggle"), find("#scaleKeyPanel"), {
        closedLabel: presentation ? "キーを変更 ▼" : "ほかのキーで練習 ▼", openLabel: "キー一覧を閉じる ▲"
    });
    const selectedKeys = new Map(stages.map(stage => [stage, "c"])), selectedPositions = new Map();
    let selected = stages[0], current = null, destroyed = false, positions = [], positionSignature = "";
    function refreshCounts(changed) {
        if (destroyed || changed && !stages.some(stage => stage.lessonId === changed.lessonId)) return;
        forms.forEach((button, i) => {
            const stage = stages[i], summary = progress?.getScaleSummary(stage) || { total: "0", practicedKeys: 0 };
            button.querySelector("[data-scale-total]").textContent = "合計" + summary.total + "回";
            button.querySelector("[data-scale-practiced]").textContent = summary.practicedKeys + "/12";
            button.setAttribute("aria-label", stage.code + "、" + typeName(stage) + "、" + getPracticeFormLabel(stage.formId) + "、練習合計" + summary.total + "回、練習済み" + summary.practicedKeys + "/12キー");
        });
        keys.forEach((button, i) => {
            const key = getScaleKeys(selected)[i], variants = getScalePositions(selected, key.id);
            const count = progress?.getScaleKeyCount?.(current || selected, key.id) ?? String(progress?.getCount(getScaleVariant(selected, key.id)) || 0);
            const done = count !== "0", label = (done ? (variants.length > 1 ? "✓ 合計" : "✓ 練習") + count + "回" : "未練習");
            button.querySelector("[data-scale-count]").textContent = label;
            button.setAttribute("aria-label", keyName(selected, key) + "、" + (done ? "練習" + count + "回" : "未練習"));
        });
        const selectedTotal = progress?.getScaleKeyCount?.(current, current.keyId) ?? String(progress?.getCount(current) || 0);
        const allPositions = getScalePositions(selected, current.keyId).length > 1;
        find("[data-scale-selected-count]").textContent = "このキーの合計：" + (selectedTotal === "0" ? "未練習（0回）" : "✓ 練習" + selectedTotal + "回") + (allPositions ? "（全ポジション）" : "");
        if (presentation) {
            const exact = progress?.getCount(current) || 0;
            find("[data-scale-selected-count]").textContent = (exact ? "✓ 練習" + exact + "回" : "未練習（0回）");
        }
        positions.forEach(button => {
            const variant = getScaleVariant(selected, current.keyId, button.dataset.scalePosition), count = progress?.getCount(variant) || 0;
            button.querySelector("[data-scale-position-count]").textContent = count ? "✓ 練習" + count + "回" : "未練習";
            button.setAttribute("aria-label", variant.positionLabel + "、" + variant.minFret + "〜" + variant.maxFret + "F、練習" + count + "回");
        });
        presentation?.counts(selected, current);
    }
    const unsubscribe = progress?.subscribe(refreshCounts);
    function select(stage, keyId = selectedKeys.get(stage), updateHistory = false, requestedPosition) {
        if (destroyed) return;
        const available = sortPracticePositions(getScalePositions(stage, keyId), stage.positionPriority), memory = stage.lessonId + "/" + keyId;
        const wanted = requestedPosition ?? selectedPositions.get(memory);
        const position = resolvePracticePosition(available, wanted, stage.positionPriority);
        if (!position) return;
        const variant = getScaleVariant(stage, keyId, position);
        if (!variant) return;
        if (stage !== selected) disclosure.close();
        selected = stage; selectedKeys.set(stage, keyId); selectedPositions.set(memory, position); current = variant;
        forms.forEach((button, i) => button.setAttribute("aria-pressed", String(stages[i] === selected)));
        keys.forEach((button, i) => {
            const key = getScaleKeys(stage)[i]; button.dataset.scaleKey = key.id;
            button.querySelector("[data-scale-key-name]").innerText = key.label;
            button.setAttribute("aria-pressed", String(key.id === keyId));
        });
        const signature = available.length > 1 ? memory + "/" + available.map(v => v.positionId || "standard").join("/") : "";
        if (signature !== positionSignature) {
            positionGroup.innerHTML = available.length > 1 ? available.map(v => '<button type="button" class="scale-key-choice" data-scale-position="' + (v.positionId || 'standard') + '" aria-pressed="false"><span>' + (v.positionId === 'low' ? 'ロー' : v.positionId === 'standard' || !v.positionId ? '標準' : v.positionLabel) + '（' + v.minFret + '〜' + v.maxFret + 'F）</span><span class="scale-key-count" data-scale-position-count aria-hidden="true"></span></button>').join("") : "";
            positions = [...positionGroup.querySelectorAll("[data-scale-position]")];
            bindChoices(positions, index => select(selected, current.keyId, false, positions[index].dataset.scalePosition));
            positionSignature = signature;
        }
        positionArea.hidden = available.length < 2 || !!presentation?.compactPositions;
        positions.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.scalePosition === position)));
        presentation?.positions(current, available, position => select(selected, current.keyId, false, position));
        refreshCounts();
        find("[data-scale-title]").innerText = stage.code + "：" + typeName(stage);
        find("[data-scale-form-label]").innerText = getPracticeFormLabel(stage.formId);
        find("[data-scale-description]").innerText = variant.desc;
        const displayKey = keyName(stage, { label: variant.keyLabel });
        find("[data-scale-key-label]").innerText = displayKey;
        find("[data-scale-meta]").innerText = "BPM " + variant.bpm + "・" + variant.timeSignature.join("/") + "・" + variant.practiceBars + "小節";
        find("[data-scale-range]").innerText = "フレット範囲：" + variant.minFret + "〜" + variant.maxFret + "F" + (available.length > 1 ? "（" + variant.positionLabel + "）" : "");
        find("[data-scale-range]").hidden = available.length > 1 && !presentation?.compactPositions;
        find("[data-scale-status]").innerText = (presentation?.displayCode || stage.code) + "、" + getPracticeFormLabel(stage.formId) + "、" + displayKey + (available.length > 1 ? "、" + variant.positionLabel : "") + "を選択";
        start.disabled = !variant.available;
        presentation?.selection(stage, variant);
        const hash = "#scales-" + stage.id;
        if (updateHistory && window.location.hash !== hash) window.history.pushState(null, "", hash);
    }
    function fromHash() {
        const match = /^#scales-([1-9]\d*)$/.exec(window.location?.hash || "");
        const stage = match && stages.find(s => s.id === Number(match[1]));
        if (stage) select(stage);
        else disclosure.close();
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
                if (next === undefined) return;
                event.preventDefault(); buttons[next].focus(); choose(next);
            });
        });
    }
    bindChoices(forms, index => select(stages[index], selectedKeys.get(stages[index]), true));
    bindChoices(keys, index => select(selected, keys[index].dataset.scaleKey));
    start.addEventListener("click", () => { if (!destroyed && current?.available) openStage(current, presentation?.modal(current)); });
    select(selected); fromHash();
    window.addEventListener("hashchange", fromHash); window.addEventListener("popstate", fromHash);
    return { get selected() { return current; }, selectStage(stage, keyId) { select(stage, keyId, false); }, destroy() { destroyed = true; disclosure.destroy(); unsubscribe?.(); window.removeEventListener("hashchange", fromHash); window.removeEventListener("popstate", fromHash); } };
}

export function initScalePracticeCards(root, stages, openStage, progress = null) {
    return createPracticeTypeCards(root, stages, openStage, progress, {
        kind: "scale", category: "scales", typeId: s => s.scaleType || "major",
        typeName: s => s.scaleType === "naturalMinor" ? "ナチュラルマイナー" : "メジャースケール",
        summary: s => progress?.getScaleSummary(s) || { total: "0", practicedKeys: 0 },
        keys: s => getScaleKeys(s).map(k => k.id),
        keyId: v => v.keyId, keyLabel: v => v.keyLabel + (v.scaleType === "naturalMinor" ? "" : "メジャー"),
        positionVariant: (s, v) => getScaleVariant(s, v.keyId, v.positionId || "standard"),
        initialize: initScalePractice, getPracticeFormLabel
    });
}
