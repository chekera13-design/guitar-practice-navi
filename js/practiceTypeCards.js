// Presentation groups are separate from lesson IDs, variant identities and score data.
export function groupPracticeStages(stages, typeId, typeName) {
    const groups = [];
    for (const stage of stages) {
        const id = typeId(stage);
        let group = groups.find(item => item.id === id);
        if (!group) { group = { id, displayCode: "EX" + String(groups.length + 1).padStart(2, "0"), name: typeName(stage), stages: [] }; groups.push(group); }
        group.stages.push(stage);
    }
    return groups;
}

export function getPracticeTypeTotal(stages, summary) {
    return stages.reduce((n, stage) => n + BigInt(summary(stage).total), 0n).toString();
}

export function createPracticeTypeCards(root, stages, openStage, progress, adapter) {
    if (!root || !stages.length) return null;
    const groups = groupPracticeStages(stages, adapter.typeId, adapter.typeName), cards = [];
    let initializing = true, active = null, destroyed = false;
    root.innerHTML = "";
    root.classList.add("practice-type-grid");
    for (const group of groups) {
        const suffix = group.id, prefix = adapter.kind === "scale" ? "scale" : "chordTone", data = adapter.kind;
        const article = document.createElement("article"), id = adapter.category + "-type-" + suffix;
        article.className = "practice-type-card"; article.id = id;
        article.setAttribute("data-practice-type-card", suffix); article.setAttribute("aria-labelledby", id + "-title");
        article.innerHTML = '<header class="practice-type-header"><h3 id="' + id + '-title">' + group.displayCode + ' ' + group.name + '</h3><span class="practice-type-total" data-type-total></span></header>'
            + '<div class="practice-type-form"><div><label for="' + id + '-form">フォーム</label><small id="' + id + '-summary" data-form-summary></small></div>'
            + '<select id="' + id + '-form" aria-label="' + group.name + 'のフォーム" aria-describedby="' + id + '-summary">'
            + group.stages.map(s => '<option value="' + s.id + '">' + adapter.getPracticeFormLabel(s.formId) + '</option>').join("") + '</select></div><div data-type-body></div>';
        root.appendChild(article);
        const select = article.querySelector("select"), summary = article.querySelector("[data-form-summary]"), total = article.querySelector("[data-type-total]");
        const card = { group, element: article, view: null }; cards.push(card);
        let positionSelect = null, availablePositions = [], selectedPosition = null, choosePosition = null;
        const presentation = {
            suffix, displayCode: group.displayCode, compactPositions: true,
            arrange(body) {
                // Keep the old per-lesson IDs as hidden URL targets, never as duplicate visible cards.
                body.querySelector(".scale-form-buttons").hidden = true;
                body.querySelector(".scale-form-buttons").setAttribute("aria-hidden", "true");
                const details = body.querySelector(".scale-details"), title = body.querySelector("[data-" + data + "-title]"), form = body.querySelector("[data-" + data + "-form-label]");
                title.hidden = true; form.hidden = true;
                const label = body.querySelector(".scale-key-label"), count = body.querySelector(".practice-key-summary"), toggle = body.querySelector(".practice-key-toggle");
                label.firstChild.textContent = adapter.kind === "scale" ? "キー：" : "コード：";
                const row = document.createElement("div"), chosen = document.createElement("div"); row.className = "practice-type-key-row";
                details.insertBefore(row, label); row.appendChild(chosen); chosen.appendChild(label); chosen.appendChild(count); const actions = document.createElement("div"); actions.className = "practice-type-key-actions";
                row.appendChild(actions); actions.appendChild(toggle);
                positionSelect = document.createElement("select"); positionSelect.className = "practice-position-select";
                positionSelect.hidden = true; positionSelect.setAttribute("aria-label", group.name + "のポジション");
                const range = body.querySelector("[data-" + data + "-range]"); range.id = id + "-range";
                positionSelect.setAttribute("aria-describedby", range.id); actions.appendChild(positionSelect);
                positionSelect.addEventListener("change", () => {
                    if (!destroyed && availablePositions.some(v => (v.positionId || "standard") === positionSelect.value)) choosePosition(positionSelect.value);
                    else positionSelect.value = selectedPosition;
                });
                const meta = body.querySelector(".scale-selection-meta"), start = body.querySelector("#" + prefix + "StartBtn-" + suffix);
                details.insertBefore(meta, start);
            },
            positions(current, available, choose) {
                const signature = available.map(v => v.positionId || "standard").join("/");
                if (signature !== positionSelect.dataset.positions) {
                    positionSelect.replaceChildren(...available.map(v => {
                        const option = document.createElement("option"); option.value = v.positionId || "standard"; return option;
                    }));
                    positionSelect.dataset.positions = signature;
                }
                availablePositions = available; choosePosition = choose; selectedPosition = current.positionId || "standard";
                positionSelect.value = selectedPosition; positionSelect.hidden = available.length < 2;
            },
            counts(stage) {
                const selectedSummary = adapter.summary(stage);
                summary.textContent = "計" + selectedSummary.total + "回・" + (selectedSummary.practicedKeys ?? selectedSummary.practicedCodes) + "/12" + (adapter.kind === "scale" ? "キー" : "コード");
                const sum = getPracticeTypeTotal(group.stages, adapter.summary);
                total.textContent = "種類計" + sum + "回";
                for (const [index, variant] of availablePositions.entries()) {
                    const name = variant.positionId === "low" ? "ロー" : !variant.positionId || variant.positionId === "standard" ? "標準" : variant.positionLabel;
                    positionSelect.options[index].textContent = name + "（" + (progress?.getCount(adapter.positionVariant(stage, variant)) || 0) + "回）";
                }
            },
            selection(stage) { select.value = String(stage.id); if (!initializing) active = card; },
            modal(variant) {
                return { stageBadge: (adapter.kind === "scale" ? "スケール練習 " : "コードトーン練習 ") + group.displayCode,
                    title: group.displayCode + "：" + group.name + "・" + adapter.getPracticeFormLabel(variant.formId) + "・" + adapter.keyLabel(variant)
                        + (variant.positionId && variant.positionId !== "standard" ? "・" + variant.positionLabel : "") };
            }
        };
        card.view = adapter.initialize(article.querySelector("[data-type-body]"), group.stages, openStage, progress, presentation);
        select.addEventListener("change", () => {
            if (destroyed) return;
            const next = group.stages.find(s => String(s.id) === select.value);
            if (!next) { select.value = String(card.view.selected.id); return; }
            const key = adapter.keyId(card.view.selected), valid = adapter.keys(next);
            card.view.selectStage(next, valid.includes(key) ? key : valid[0]); active = card;
            const hash = "#" + adapter.category + "-" + next.id;
            if (window.location.hash !== hash) window.history.pushState(null, "", hash);
        });
    }
    initializing = false;
    const hash = window.location.hash, matched = cards.find(c => c.group.stages.some(s => hash === "#" + adapter.category + "-" + s.id));
    active = matched || cards[0];
    return { get selected() { return active?.view.selected; }, cards,
        destroy() { destroyed = true; for (const card of cards) card.view.destroy(); } };
}
