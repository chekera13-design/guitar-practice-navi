import { sortPracticePositions, resolvePracticePosition } from "./practicePositions.js";
import { createKeyDisclosure } from "./keyDisclosure.js";
import { getChordToneVariant, getChordToneLabel, getChordToneRoots, getChordTonePositions, CHORD_TONE_TYPES } from "./config/chordTones.js";

// 選択と回数表示だけを担当。保存・完走判定はpracticeProgressへ委ね、練習時計には触れない。
export function initChordTonePractice(root, stages, openStage, progress = null) {
    if (!root || !stages.length) return null;
    const typeName = stage => (CHORD_TONE_TYPES[stage.chordTypeId].practiceLabel || CHORD_TONE_TYPES[stage.chordTypeId].label) + "コードトーン";
    root.innerHTML = '<div class="scale-form-buttons" role="group" aria-label="CAGEDフォーム">'
        + stages.map(stage => '<button type="button" class="scale-choice" id="chord-tones-' + stage.id
            + '" data-chord-tone-id="' + stage.id + '" aria-pressed="false" aria-controls="chordToneDetails">'
            + '<strong>' + stage.code + '</strong><span>' + typeName(stage) + '</span><span>' + stage.formId + 'フォーム</span>'
            + '<span class="scale-form-count" data-chord-tone-total aria-hidden="true"></span>'
            + '<span class="scale-form-count" data-chord-tone-practiced aria-hidden="true"></span></button>').join("")
        + '</div><div id="chordToneDetails" class="scale-details" role="region" aria-label="選択中のコードトーン">'
        + '<h4 data-chord-tone-title></h4><p data-chord-tone-description></p><p data-chord-tone-meta></p>'
        + '<p class="scale-key-label">練習するコード：<strong data-chord-tone-root-label></strong></p>'
        + '<p class="practice-key-summary" data-chord-tone-selected-count aria-live="polite"></p>'
        + '<button id="chordToneKeyToggle" type="button" class="practice-key-toggle" aria-expanded="false" aria-controls="chordToneKeyPanel">ほかのコードで練習 ▼</button>'
        + '<div id="chordToneKeyPanel" class="practice-key-panel" hidden><div class="scale-key-buttons" role="group" aria-label="コード選択">'
        + getChordToneRoots(stages[0]).map(key => '<button type="button" class="scale-key-choice" data-chord-tone-root="' + key.id
            + '" aria-pressed="false" aria-label="' + getChordToneLabel(stages[0].chordTypeId, key.id) + '"><span data-chord-tone-name>' + getChordToneLabel(stages[0].chordTypeId, key.id) + '</span>'
            + '<span class="scale-key-count" data-chord-tone-count aria-hidden="true"></span></button>').join("")
        + '</div></div><div data-chord-tone-position-area hidden><p>ポジションを選択</p><div class="scale-position-buttons" data-chord-tone-positions role="group" aria-label="ポジション選択"></div></div><p data-chord-tone-range></p><button id="chordToneStartBtn" type="button" class="ex-start-btn">▶ 練習する</button>'
        + '</div><p class="scale-selection-status" role="status" data-chord-tone-status></p>';
    const forms = [...root.querySelectorAll("[data-chord-tone-id]")];
    const keys = [...root.querySelectorAll("[data-chord-tone-root]")];
    const start = root.querySelector("#chordToneStartBtn");
    const disclosure = createKeyDisclosure(root.querySelector("#chordToneKeyToggle"), root.querySelector("#chordToneKeyPanel"), {
        closedLabel: "ほかのコードで練習 ▼", openLabel: "コード一覧を閉じる ▲"
    });
    const positionArea = root.querySelector("[data-chord-tone-position-area]"), positionGroup = root.querySelector("[data-chord-tone-positions]");
    const selectedPositions = new Map();
    let positions = [], positionSignature = "";
    const selectedRoots = new Map(stages.map(stage => [stage, "c"]));
    let selected = stages[0], current = null, destroyed = false;
    function refreshCounts(changed) {
        if (destroyed || changed && !stages.some(stage => stage.lessonId === changed.lessonId)) return;
        forms.forEach((button, i) => {
            const stage = stages[i], summary = progress?.getChordToneSummary(stage) || { total: "0", practicedCodes: 0 };
            button.querySelector("[data-chord-tone-total]").textContent = "練習合計" + summary.total + "回";
            button.querySelector("[data-chord-tone-practiced]").textContent = "練習済み " + summary.practicedCodes + "/12";
            button.setAttribute("aria-label", stage.code + "、" + typeName(stage) + "、" + stage.formId + "フォーム、練習合計" + summary.total + "回、練習済み" + summary.practicedCodes + "/12コード");
        });
        const selectedCount = progress?.getChordToneRootCount?.(current, current.rootId) ?? String(progress?.getCount(current) || 0);
        const multiple = getChordTonePositions(selected, current.rootId).length > 1;
        root.querySelector("[data-chord-tone-selected-count]").textContent = (multiple ? "このコードの合計：" : "このコードの練習回数：") + (selectedCount !== "0" ? "✓ 練習" + selectedCount + "回" : "未練習（0回）") + (multiple ? "（全ポジション）" : "");
        keys.forEach((button, i) => {
            const key = getChordToneRoots(selected)[i], count = progress?.getChordToneRootCount?.(current, key.id) ?? String(progress?.getCount(getChordToneVariant(selected, key.id)) || 0);
            button.querySelector("[data-chord-tone-count]").textContent = count !== "0" ? (getChordTonePositions(selected, key.id).length > 1 ? "✓ 合計" : "✓ 練習") + count + "回" : "未練習";
            button.setAttribute("aria-label", getChordToneLabel(selected.chordTypeId, key.id) + "、" + (count !== "0" ? "練習" + count + "回" : "未練習"));
        });
        positions.forEach(button => {
            const variant = getChordToneVariant(selected, current.rootId, button.dataset.chordTonePosition), count = progress?.getCount(variant) || 0;
            button.querySelector("[data-chord-tone-position-count]").textContent = count ? "✓ 練習" + count + "回" : "未練習";
            button.setAttribute("aria-label", variant.positionLabel + "、" + variant.minFret + "〜" + variant.maxFret + "F、練習" + count + "回");
        });
    }
    const unsubscribe = progress?.subscribe(refreshCounts);
    function select(stage, rootId = selectedRoots.get(stage), updateHistory = false, requestedPosition) {
        if (destroyed) return;
        const available = sortPracticePositions(getChordTonePositions(stage, rootId), stage.positionPriority), memory = stage.lessonId + "/" + rootId;
        const wanted = requestedPosition ?? selectedPositions.get(memory);
        const position = resolvePracticePosition(available, wanted, stage.positionPriority);
        if (!position) return;
        const variant = getChordToneVariant(stage, rootId, position);
        if (!variant) return;
        if (stage !== selected) disclosure.close();
        selected = stage; selectedRoots.set(stage, rootId); selectedPositions.set(memory, position); current = variant;
        forms.forEach((button, i) => button.setAttribute("aria-pressed", String(stages[i] === selected)));
        keys.forEach((button, i) => {
            const key = getChordToneRoots(stage)[i]; button.dataset.chordToneRoot = key.id;
            button.querySelector("[data-chord-tone-name]").innerText = getChordToneLabel(stage.chordTypeId, key.id);
            button.setAttribute("aria-pressed", String(key.id === rootId));
        });
        const signature = available.length > 1 ? memory + "/" + available.map(v => v.positionId || "standard").join("/") : "";
        if (signature !== positionSignature) {
            positionGroup.innerHTML = available.length > 1 ? available.map(v => '<button type="button" class="scale-key-choice" data-chord-tone-position="' + (v.positionId || 'standard') + '" aria-pressed="false"><span>' + v.positionLabel + '（' + v.minFret + '〜' + v.maxFret + 'F）</span><span class="scale-key-count" data-chord-tone-position-count aria-hidden="true"></span></button>').join("") : "";
            positions = [...positionGroup.querySelectorAll("[data-chord-tone-position]")];
            bindChoices(positions, i => select(selected, current.rootId, false, positions[i].dataset.chordTonePosition));
            positionSignature = signature;
        }
        positionArea.hidden = available.length < 2;
        positions.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.chordTonePosition === position)));
        refreshCounts();
        root.querySelector("[data-chord-tone-title]").innerText = stage.code + "：" + typeName(stage) + "／" + stage.formId + "フォーム";
        root.querySelector("[data-chord-tone-description]").innerText = variant.desc;
        root.querySelector("[data-chord-tone-root-label]").innerText = variant.chordLabel;
        root.querySelector("[data-chord-tone-meta]").innerText = "BPM " + variant.bpm + "・" + variant.timeSignature.join("/") + "・" + variant.practiceBars + "小節";
        root.querySelector("[data-chord-tone-range]").innerText = "フレット範囲：" + variant.minFret + "〜" + variant.maxFret + "F" + (available.length > 1 ? "（" + variant.positionLabel + "）" : "");
        root.querySelector("[data-chord-tone-status]").innerText = stage.code + "、" + stage.formId + "フォーム、" + variant.chordLabel + "を選択";
        start.disabled = !variant.available;
        const hash = "#chord-tones-" + stage.id;
        if (updateHistory && window.location.hash !== hash) window.history.pushState(null, "", hash);
    }
    function fromHash() {
        const match = /^#chord-tones-([1-9]\d*)$/.exec(window.location?.hash || "");
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
            disclosure.destroy();
            unsubscribe?.();
            window.removeEventListener("hashchange", fromHash);
            window.removeEventListener("popstate", fromHash);
        }
    };
}
