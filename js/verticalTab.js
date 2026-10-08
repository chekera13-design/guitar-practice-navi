// ==========================================
// ギター練習ドットコム - 縦型TAB譜コントローラー (js/verticalTab.js)
// 統合元アプリ(App 2)完全互換・高精度小節クロップ版
// ==========================================

const SVG_NS = "http://www.w3.org/2000/svg";

function preserveAlphaTabStyles(sourceSvg, extractedSvg) {
    const hasEmbeddedFont = [...sourceSvg.querySelectorAll("style")]
        .some((style) => /@font-face/i.test(style.textContent || ""));
    if (hasEmbeddedFont) return;

    const fontStyle = [...document.querySelectorAll("style")]
        .find((style) => /@font-face/i.test(style.textContent || "")
            && /alphaTab/i.test(style.textContent || ""));
    if (!fontStyle) return;

    const style = document.createElementNS(SVG_NS, "style");
    style.textContent = fontStyle.textContent;
    extractedSvg.insertBefore(style, extractedSvg.firstChild);
}

/**
 * 五線（TAB譜の6本の弦）の上下Y範囲を検出
 */
function detectStaffYBounds(svg) {
    const yList = [];
    svg.querySelectorAll("rect").forEach(r => {
        const w = parseFloat(r.getAttribute("width"));
        const h = parseFloat(r.getAttribute("height"));
        const y = parseFloat(r.getAttribute("y"));
        if (!isNaN(w) && !isNaN(h) && !isNaN(y)) {
            // 水平弦ライン: 高さが細く(<=3px)、幅が長い(>=70px)
            if (h <= 3 && w >= 70) {
                yList.push(y);
            }
        }
    });
    if (yList.length >= 4) {
        return {
            top: Math.min(...yList),
            bottom: Math.max(...yList)
        };
    }
    return { top: 38, bottom: 82 };
}

/**
 * 赤い小節番号テキスト（1, 2, 3...）から各小節の開始Xを検出
 */
function detectMeasureMarkersFromSvg(svg) {
    const markers = [];
    svg.querySelectorAll("text").forEach(t => {
        const txt = t.textContent.trim();
        if (/^\d+$/.test(txt)) {
            const fill = (t.getAttribute("fill") || t.style.fill || "").toLowerCase();
            const isRed = fill.includes("red") || fill.includes("c8") || fill.includes("c0") || fill.includes("rgb(200") || fill.includes("rgb(192") || fill.includes("#c");
            if (isRed) {
                const num = parseInt(txt, 10);
                const x = parseFloat(t.getAttribute("x")) || (t.getBBox ? t.getBBox().x : null);
                if (x !== null && !isNaN(x)) {
                    markers.push({ barNumber: num, x });
                }
            }
        }
    });
    markers.sort((a, b) => a.barNumber - b.barNumber);
    return markers;
}

/**
 * 各小節の正確な境界 [startX, endX] を高精度に算出
 * ※ 符幹（音符の棒）を排除し、赤い小節番号と本物の小節線から1小節ずつ美しく切り出す
 */
function detectMeasureBoundaries(sourceSvg, totalBars, sourceWidth, sourceHeight) {
    const staff = detectStaffYBounds(sourceSvg);
    const staffHeight = staff.bottom - staff.top;

    // 上部（スラー弧線・H/P/S/C文字）と下部（符幹・旗）を収める安全なY範囲
    const cropY = Math.max(0, staff.top - 38);
    const cropBottom = Math.min(sourceHeight, staff.bottom + 46);
    const cropHeight = Math.max(90, cropBottom - cropY);

    // 1. 赤い小節番号の位置
    const measureMarkers = detectMeasureMarkersFromSvg(sourceSvg);

    // 2. 本物の小節線（五線の上端から下端までぴったり渡る垂直矩形のみ。符幹は除外）
    const trueBarlines = [];
    sourceSvg.querySelectorAll("rect").forEach(r => {
        const w = parseFloat(r.getAttribute("width"));
        const h = parseFloat(r.getAttribute("height"));
        const x = parseFloat(r.getAttribute("x"));
        const y = parseFloat(r.getAttribute("y"));
        if (!isNaN(w) && !isNaN(h) && !isNaN(x) && !isNaN(y)) {
            // 幅 <= 4px、Yが五線上端付近、高さが五線の高さ（±5px）
            if (w <= 4 && Math.abs(y - staff.top) <= 5 && Math.abs(h - staffHeight) <= 5) {
                trueBarlines.push(x);
            }
        }
    });
    trueBarlines.sort((a, b) => a - b);
    const clusteredBarlines = [];
    for (const x of trueBarlines) {
        if (clusteredBarlines.length === 0 || Math.abs(x - clusteredBarlines[clusteredBarlines.length - 1]) > 5) {
            clusteredBarlines.push(x);
        }
    }
    const internalBarlines = clusteredBarlines.filter(x => x > 65);

    console.info(`[縦型TAB] 境界解析: 小節番号X=[${measureMarkers.map(m => Math.round(m.x)).join(", ")}], 本物小節線=[${internalBarlines.map(Math.round).join(", ")}]`);

    // ★ パターンA: 赤い小節番号が totalBars 個存在する場合（最も確実・高精度）
    if (measureMarkers.length >= totalBars) {
        const splitXs = [];
        for (let i = 1; i < totalBars; i++) {
            const markerX = measureMarkers[i].x;
            // markerX の手前 35px 以内にある本物の小節線を探す
            const nearBarline = internalBarlines.find(bx => bx >= markerX - 35 && bx <= markerX);
            const boundaryX = nearBarline !== undefined ? nearBarline : (markerX - 10);
            splitXs.push(boundaryX);
        }
        // 最終小節の終端：終止線の太い部分まで含める
        const lastBarline = internalBarlines.find(bx => bx > measureMarkers[totalBars - 1].x);
        const endX = lastBarline !== undefined
            ? Math.min(sourceWidth, lastBarline + 12)
            : sourceWidth;

        const boundaries = [];
        for (let i = 0; i < totalBars; i++) {
            let startX, stopX;
            if (i === 0) {
                // 第1小節: 左端(0)から、第2小節の開始線まで（TAB記号・4/4を含む）
                startX = 0;
                stopX = splitXs[0] + 1;
            } else {
                // 第2小節以降: 前の小節線から、次の小節線まで（余計なTAB記号を含めずカード幅いっぱいに拡大）
                startX = splitXs[i - 1] - 1;
                stopX = (i < totalBars - 1) ? (splitXs[i] + 1) : endX;
            }
            boundaries.push({
                x: Math.max(0, startX),
                y: cropY,
                width: Math.max(60, stopX - startX),
                height: cropHeight
            });
        }
        return boundaries;
    }

    // ★ パターンB: 本物の小節線から分割
    if (internalBarlines.length >= totalBars - 1 && internalBarlines.length > 0) {
        const splitXs = internalBarlines.slice(0, totalBars - 1);
        const endX = internalBarlines[totalBars - 1] !== undefined
            ? Math.min(sourceWidth, internalBarlines[totalBars - 1] + 12)
            : sourceWidth;
        const boundaries = [];
        for (let i = 0; i < totalBars; i++) {
            let startX, stopX;
            if (i === 0) {
                startX = 0;
                stopX = splitXs[0] + 1;
            } else {
                startX = splitXs[i - 1] - 1;
                stopX = (i < totalBars - 1) ? (splitXs[i] + 1) : endX;
            }
            boundaries.push({
                x: Math.max(0, startX),
                y: cropY,
                width: Math.max(60, stopX - startX),
                height: cropHeight
            });
        }
        return boundaries;
    }

    // フォールバック
    const barWidth = sourceWidth / totalBars;
    const boundaries = [];
    for (let i = 0; i < totalBars; i++) {
        boundaries.push({
            x: i * barWidth,
            y: cropY,
            width: barWidth,
            height: cropHeight
        });
    }
    return boundaries;
}

export class VerticalTabController {
    constructor(wrapper, { 
        animationMs = 220, 
        onError = console.error, 
        onBarChange = () => {}
    } = {}) {
        this.wrapper = wrapper;
        this.animationMs = animationMs;
        this.onError = onError;
        this.onBarChange = onBarChange;
        this.barCount = 0;
        this.currentBarIndex = 0;
        this.swipe = null;

        this.viewport = wrapper.querySelector(".vertical-tab-viewport");
        this.track = wrapper.querySelector(".vertical-tab-cards");
        this.previousButton = wrapper.querySelector("[data-action='previous']");
        this.nextButton = wrapper.querySelector("[data-action='next']");
        this.indicator = wrapper.querySelector(".vertical-bar-indicator");
        this.bindControls();
        this.setMessage("譜面を読み込み中です。");
    }

    get hasCards() {
        return this.barCount > 0 && Boolean(this.track?.children.length);
    }

    bindControls() {
        this.controlEvents = new AbortController();
        const options = { signal: this.controlEvents.signal };
        this.previousButton?.addEventListener("click", () => this.setCurrentBar(this.currentBarIndex - 1, "button"), options);
        this.nextButton?.addEventListener("click", () => this.setCurrentBar(this.currentBarIndex + 1, "button"), options);
        if (!this.viewport) return;

        this.viewport.style.setProperty("--vertical-tab-animation", `${this.animationMs}ms`);
        const finishSwipe = () => {
            const swipe = this.swipe;
            this.swipe = null;
            this.viewport.classList.remove("is-dragging");
            if (swipe && this.viewport.hasPointerCapture?.(swipe.id)) {
                this.viewport.releasePointerCapture(swipe.id);
            }
            return swipe;
        };
        this.viewport.addEventListener("pointerdown", (event) => {
            if (event.pointerType === "mouse" && event.button !== 0) return;
            if (this.swipe) return;
            this.swipe = { x: event.clientX, y: event.clientY, id: event.pointerId, axis: null, dragged: false };
            this.viewport.setPointerCapture?.(event.pointerId);
        }, options);
        this.viewport.addEventListener("pointermove", (event) => {
            if (!this.swipe || this.swipe.id !== event.pointerId) return;
            const dx = event.clientX - this.swipe.x;
            const dy = event.clientY - this.swipe.y;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 5) return;
            this.swipe.axis ??= Math.abs(dy) >= Math.abs(dx) ? "vertical" : "horizontal";
            if (this.swipe.axis === "vertical") {
                const nextIndex = this.currentBarIndex + (dy < 0 ? 1 : -1);
                if (nextIndex < 0 || nextIndex >= this.barCount) {
                    if (this.swipe.dragged) {
                        this.renderPosition(false);
                        this.swipe.dragged = false;
                    }
                    return;
                }
                const pitch = Math.max(100, this.viewport.clientHeight / 2.6);
                const drag = Math.max(-0.75, Math.min(0.75, dy / pitch));
                this.viewport.classList.add("is-dragging");
                this.swipe.dragged = true;
                this.renderPosition(false, drag);
            }
        }, options);
        this.viewport.addEventListener("pointerup", (event) => {
            if (!this.swipe || this.swipe.id !== event.pointerId) return;
            const { x, y, dragged } = finishSwipe();
            const dx = event.clientX - x;
            const dy = event.clientY - y;
            if (Math.abs(dy) >= 38 && Math.abs(dy) > Math.abs(dx)) {
                const nextIndex = this.currentBarIndex + (dy < 0 ? 1 : -1);
                if (nextIndex >= 0 && nextIndex < this.barCount) {
                    this.setCurrentBar(nextIndex, "swipe");
                } else if (dragged) {
                    this.renderPosition(false);
                }
            } else if (dragged) {
                this.renderPosition(true);
            }
        }, options);
        const cancel = (event) => {
            if (!this.swipe || this.swipe.id !== event.pointerId) return;
            const { dragged } = finishSwipe();
            if (dragged) this.renderPosition(true);
        };
        this.viewport.addEventListener("pointercancel", cancel, options);
        this.viewport.addEventListener("lostpointercapture", cancel, options);
    }

    /**
     * 横スクロール側で完成したSVGから、各小節カードを隣接干渉なく高精度に抽出生成する
     */
    createCardsFromRenderedSvg(sourceSvg, boundsLookup, totalBars) {
        if (!sourceSvg || !this.track) return;

        this.barCount = totalBars;
        this.currentBarIndex = Math.max(0, Math.min(this.barCount - 1, this.currentBarIndex));
        this.track.replaceChildren();

        const viewBox = sourceSvg.viewBox?.baseVal;
        const sourceWidth = viewBox?.width || Number.parseFloat(sourceSvg.getAttribute("width")) || sourceSvg.getBoundingClientRect().width;
        const sourceHeight = viewBox?.height || Number.parseFloat(sourceSvg.getAttribute("height")) || sourceSvg.getBoundingClientRect().height;

        console.info(`[縦型TAB] ソースSVGからカード生成開始: 全${totalBars}小節, SVGサイズ: ${sourceWidth}x${sourceHeight}`);

        const boundaries = detectMeasureBoundaries(sourceSvg, totalBars, sourceWidth, sourceHeight);

        for (let index = 0; index < totalBars; index++) {
            const b = boundaries[index];
            const x = b.x;
            const y = b.y;
            const width = b.width;
            const height = b.height;

            // 小節SVGの複製
            const cardSvg = sourceSvg.cloneNode(true);
            preserveAlphaTabStyles(sourceSvg, cardSvg);

            // ★音楽記号（休符・音符の旗・拍子記号など）に alphaTab 音楽フォントを直接適用
            cardSvg.querySelectorAll("text").forEach(textEl => {
                const text = textEl.textContent || "";
                const isMusicGlyph = [...text].some(ch => {
                    const cp = ch.codePointAt(0);
                    return cp >= 0xe000 && cp <= 0xf8ff;
                });
                if (isMusicGlyph) {
                    textEl.style.fontFamily = "alphaTab, Bravura, sans-serif";
                    textEl.style.fontSize = "170%";
                }
            });

            // ★縦型TABカードのみ赤い小節番号（1, 2, 3...）を非表示
            cardSvg.querySelectorAll("text").forEach(textEl => {
                const text = textEl.textContent?.trim() || "";
                if (/^[0-9]+$/.test(text)) {
                    const fill = (textEl.getAttribute("fill") || textEl.style.fill || "").toLowerCase();
                    if (fill.includes("red") || fill.includes("c8") || fill.includes("rgb(200")) {
                        textEl.remove();
                    }
                }
            });

            // ★厳密なクリッピングパス（clipPath）をカードに適用し、隣接小節の食い込みを100%遮断
            const clipId = `vtab-clip-${index}-${Date.now()}`;
            let defs = cardSvg.querySelector("defs");
            if (!defs) {
                defs = document.createElementNS(SVG_NS, "defs");
                cardSvg.insertBefore(defs, cardSvg.firstChild);
            }
            const clipPath = document.createElementNS(SVG_NS, "clipPath");
            clipPath.setAttribute("id", clipId);
            const clipRect = document.createElementNS(SVG_NS, "rect");
            clipRect.setAttribute("x", x.toFixed(1));
            clipRect.setAttribute("y", y.toFixed(1));
            clipRect.setAttribute("width", width.toFixed(1));
            clipRect.setAttribute("height", height.toFixed(1));
            clipPath.appendChild(clipRect);
            defs.appendChild(clipPath);

            // 全描画要素をクリップ適用グループで囲む
            const group = document.createElementNS(SVG_NS, "g");
            group.setAttribute("clip-path", `url(#${clipId})`);
            const children = Array.from(cardSvg.childNodes).filter(node => node !== defs);
            children.forEach(node => group.appendChild(node));
            cardSvg.appendChild(group);

            cardSvg.setAttribute("viewBox", `${x.toFixed(1)} ${y.toFixed(1)} ${width.toFixed(1)} ${height.toFixed(1)}`);
            cardSvg.setAttribute("width", "100%");
            cardSvg.removeAttribute("height");
            cardSvg.style.width = "100%";
            cardSvg.style.height = "auto";
            cardSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
            cardSvg.setAttribute("role", "img");
            cardSvg.setAttribute("aria-label", `小節 ${index + 1} のTAB譜`);

            const card = document.createElement("article");
            card.className = "vertical-tab-card";
            card.dataset.barIndex = String(index);

            card.append(cardSvg);
            this.track.append(card);

            console.info(`[縦型TAB] 小節 ${index + 1} カード生成完了:`, { x, y, width, height });
        }

        this.setMessage("");
        this.renderPosition(false);
        this.updateControls();
    }

    setMessage(message) {
        const element = this.wrapper.querySelector(".vertical-tab-message");
        if (element) {
            element.textContent = message;
            element.hidden = !message;
        }
    }

    setCurrentBar(index, source = "practice") {
        if (!this.barCount) {
            this.currentBarIndex = Math.max(0, index);
            return;
        }
        const next = Math.max(0, Math.min(this.barCount - 1, Math.trunc(index)));
        if (next === this.currentBarIndex) return;
        const previous = this.currentBarIndex;
        this.currentBarIndex = next;
        this.onBarChange(next, source);
        console.info(`[縦型TAB] ${source}: ${previous + 1} → ${next + 1}`);
        this.renderPosition(true);
    }

    resetToFirstBar() {
        this.setCurrentBar(0, "reset");
        this.currentBarIndex = 0;
        this.renderPosition(true);
    }

    renderPosition(animate = true, drag = 0) {
        const pitch = Math.max(110, (this.viewport?.clientHeight || 360) / 2.7);
        for (const card of this.track?.querySelectorAll(".vertical-tab-card") || []) {
            const index = Number(card.dataset.barIndex);
            const relative = index - this.currentBarIndex + drag;
            const visible = Math.abs(relative) <= 1.05;
            const current = Math.abs(relative) < 0.5;
            card.hidden = !visible;
            card.classList.toggle("is-current", current);
            card.classList.toggle("is-before", relative < 0);
            card.classList.toggle("is-after", relative > 0);
            card.style.setProperty("--bar-y", `${relative * pitch}px`);
            card.style.setProperty("--bar-opacity", current ? "1" : "0.58");
            card.style.zIndex = current ? "3" : "2";
            card.setAttribute("aria-current", current ? "step" : "false");
        }
        if (animate) this.viewport?.classList.remove("is-dragging");
        this.updateControls();
    }

    updateControls() {
        if (this.previousButton) {
            const disabled = this.currentBarIndex <= 0;
            if (this.previousButton.disabled !== disabled) this.previousButton.disabled = disabled;
        }
        if (this.nextButton) {
            const disabled = this.currentBarIndex >= this.barCount - 1;
            if (this.nextButton.disabled !== disabled) this.nextButton.disabled = disabled;
        }
        if (this.indicator) {
            const text = this.barCount > 0
                ? `小節 ${this.currentBarIndex + 1} / ${this.barCount}`
                : "小節 - / -";
            if (this.indicator.textContent !== text) this.indicator.textContent = text;
        }
    }

    destroy() {
        this.controlEvents?.abort();
        this.swipe = null;
        this.viewport?.classList.remove("is-dragging");
        if (this.track) this.track.replaceChildren();
        this.barCount = 0;
        this.currentBarIndex = 0;
    }
}
