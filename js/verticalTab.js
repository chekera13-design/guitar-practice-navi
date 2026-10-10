// ==========================================
// ギター練習ドットコム - 縦型TAB譜コントローラー (js/verticalTab.js)
// 統合元アプリ(App 2)完全互換・高精度小節クロップ版
// ==========================================

import { bindButtonActivation } from "./buttonInput.js";

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
 * 6弦geometryが取れない場合のYフォールバック。08のX終端判定にも従来の範囲を残す。
 */
function detectCropYBounds(svg) {
    const yList = [];
    svg.querySelectorAll("rect").forEach(r => {
        const w = parseFloat(r.getAttribute("width"));
        const h = parseFloat(r.getAttribute("height"));
        const y = parseFloat(r.getAttribute("y"));
        if ([w, h, y].every(Number.isFinite)) {
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
                const attributeX = parseFloat(t.getAttribute("x"));
                const x = Number.isFinite(attributeX) ? attributeX : t.getBBox?.().x;
                if (Number.isFinite(x)) {
                    markers.push({ barNumber: num, x });
                }
            }
        }
    });
    markers.sort((a, b) => a.barNumber - b.barNumber);
    return markers;
}

/**
 * TABの水平弦ラインの終端を使い、譜面外の余白やクレジットを除く。
 * 音符で分割された短い弦ラインも対象にする（1小節譜面でも同じ検出）。
 */
function detectContentEndX(sourceSvg, cropY, cropHeight, sourceRight) {
    const lineEnds = new Map();
    sourceSvg.querySelectorAll("rect").forEach(rect => {
        const x = parseFloat(rect.getAttribute("x"));
        const y = parseFloat(rect.getAttribute("y"));
        const width = parseFloat(rect.getAttribute("width"));
        const height = parseFloat(rect.getAttribute("height"));
        const right = x + width;
        if (![x, y, width, height, right].every(Number.isFinite)) return;
        if (height > 0 && height <= 3 && width > height
            && y >= cropY && y <= cropY + cropHeight && right <= sourceRight) {
            const key = right.toFixed(1);
            const group = lineEnds.get(key) || { right, ys: new Set() };
            group.right = Math.max(group.right, right);
            group.ys.add(y.toFixed(1));
            lineEnds.set(key, group);
        }
    });
    // 複数の弦ラインで確認できる場合だけ採用し、終止線用の既存余白を維持。
    const ends = [...lineEnds.values()].filter(group => group.ys.size >= 4).map(group => group.right);
    return ends.length ? Math.min(sourceRight, Math.max(...ends) + 12) : sourceRight;
}

/** 短い線片を同じYごとに統合し、6本の弦とそれらを横切る小節線を共通検出。 */
function detectTabGeometry(sourceSvg, sourceLeft, sourceRight) {
    const coordinateTolerance = Number.EPSILON * Math.max(1, Math.abs(sourceLeft), Math.abs(sourceRight)) * 8;
    const rects = [...sourceSvg.querySelectorAll("rect")].map(rect => {
        // この検出はSVG内の座標を使用する。変換された線は無理に推定しない。
        for (let node = rect; node && node !== sourceSvg; node = node.parentElement) {
            if (node.getAttribute("transform")) return null;
        }
        const [x, y, width, height] = ["x", "y", "width", "height"]
            .map(name => Number.parseFloat(rect.getAttribute(name)));
        return [x, y, width, height, x + width].every(Number.isFinite) && width > 0 && height > 0
            && x >= sourceLeft && x + width <= sourceRight + coordinateTolerance
            ? { x, y, width, height } : null;
    }).filter(Boolean);
    const lines = rects.filter(rect => rect.height <= 3 && rect.width > rect.height);
    const groups = new Map();
    for (const line of lines) {
        const key = line.y.toFixed(1);
        const group = groups.get(key) || { y: line.y, lines: [] };
        group.lines.push(line);
        groups.set(key, group);
    }
    const rows = [...groups.values()].sort((a, b) => a.y - b.y);
    for (const row of rows) {
        const intervals = [];
        for (const line of row.lines.sort((a, b) => a.x - b.x)) {
            const last = intervals.at(-1);
            if (last && line.x <= last.end) last.end = Math.max(last.end, line.x + line.width);
            else intervals.push({ start: line.x, end: line.x + line.width });
        }
        row.left = intervals[0].start;
        row.right = intervals.at(-1).end;
        row.coverage = intervals.reduce((sum, interval) => sum + interval.end - interval.start, 0);
    }
    // 装飾線が混ざっても、等間隔の6本・共通するX範囲・十分な線片量で弦を識別。
    const staffs = new Map();
    for (let top = 0; top < rows.length; top++) {
        for (let second = top + 1; second < rows.length; second++) {
            const spacing = rows[second].y - rows[top].y;
            if (spacing <= 3) continue;
            const staffRows = Array.from({ length: 6 }, (_, index) =>
                rows.find(row => Math.abs(row.y - rows[top].y - spacing * index) <= 1));
            if (staffRows.some(row => !row)) continue;
            const left = Math.max(...staffRows.map(row => row.left));
            const right = Math.min(...staffRows.map(row => row.right));
            const support = Math.min(right - left, ...staffRows.map(row => row.coverage));
            if (support < spacing * 2) continue;
            staffs.set(staffRows.map(row => row.y).join(','), { rows: staffRows, left, right, support });
        }
    }
    const ranked = [...staffs.values()].sort((a, b) => b.support - a.support);
    // 同程度の別の弦領域がある場合は推定せず、既存のフォールバックへ。
    if (!ranked.length || (ranked[1] && Math.abs(ranked[0].support - ranked[1].support) < 0.1)) return null;
    const staff = ranked[0];
    const ys = staff.rows.map(row => row.y);
    const spansStaff = rect => Math.abs(rect.y - ys[0]) <= 3
        && rect.y <= ys[0] + 0.1 && rect.y + rect.height >= ys[5]
        && Math.abs(rect.height - (ys[5] - ys[0])) <= 5;
    const barlines = rects.filter(rect => rect.width <= 4 && spansStaff(rect)
        && staff.rows.every(row => row.lines.some(line =>
            line.x <= rect.x + rect.width && line.x + line.width >= rect.x)));
    // 終止線は小節間の境界に含めない。最終小節の右端計算は既存処理のまま。
    const internalBarlines = barlines.filter(rect => rect.x > staff.left + rect.width
        && rect.x + rect.width < staff.right - 0.1
        && !rects.some(end => end.width > 4 && spansStaff(end)
            && end.x + end.width >= staff.right - 0.1
            && end.x >= rect.x + rect.width && end.x - rect.x - rect.width <= 5));
    return { lines: staff.rows.flatMap(row => row.lines), ys, barlines, internalBarlines };
}

/** 第1小節の左端は、従来どおり全6弦の開始位置と照合する。 */
function detectLeftBarlineX(geometry) {
    if (!geometry) return null;
    const candidates = geometry.barlines.filter(rect => geometry.ys.every(y =>
        geometry.lines.some(line => Math.abs(line.y - y) <= 0.1
            && line.x >= rect.x - 0.1 && line.x <= rect.x + rect.width)));
    return candidates.length ? Math.min(...candidates.map(rect => rect.x)) : null;
}

/** 通常のフレット数字だけをSVGローカル座標で取得する。音楽フォントや見出しは含めない。 */
function detectTabDigitBounds(sourceSvg, geometry) {
    const digits = [];
    for (const text of sourceSvg.querySelectorAll("text")) {
        if (!/^\d+$/.test(text.textContent?.trim() || "")) continue;
        const style = typeof getComputedStyle === "function" ? getComputedStyle(text) : text.style;
        const inline = text.getAttribute("style") || "";
        const baseline = style?.dominantBaseline || text.getAttribute("dominant-baseline")
            || inline.match(/dominant-baseline\s*:\s*([^;]+)/i)?.[1]?.trim();
        const font = style?.fontFamily || text.getAttribute("font-family") || inline;
        const fill = (style?.fill || text.getAttribute("fill") || "").toLowerCase();
        // alphaTabの通常TAB数字はmiddle。番号・コード名は別baseline、拍子は音楽フォント。
        if (baseline !== "middle" || /alphaTab|Bravura/i.test(font)
            || /red|#c8|#c0|rgb\(\s*(?:200|192)\s*,/.test(fill)) continue;
        const x = Number.parseFloat(text.getAttribute("x"));
        const y = Number.parseFloat(text.getAttribute("y"));
        if (![x, y].every(Number.isFinite)) continue;
        if (geometry && !geometry.ys.some(rowY =>
            Math.abs(rowY - y) <= (geometry.ys[1] - geometry.ys[0]) / 4)) continue;
        let transformed = false;
        for (let node = text; node && node !== sourceSvg; node = node.parentElement) {
            if (node.getAttribute("transform")) { transformed = true; break; }
        }
        if (transformed) continue;
        try {
            const box = text.getBBox();
            const bottom = box.y + box.height;
            if ([box.x, box.y, box.width, box.height, bottom].every(Number.isFinite)
                && box.width > 0 && box.height > 0) digits.push({ x, top: box.y, bottom });
        } catch { /* bboxが取れない数字は推定せず、弦geometryの余白を使用する。 */ }
    }
    return digits;
}

/** 小節内の数字がはみ出した場合だけ拡張し、丸めでも切れない有効なY範囲にする。 */
function getCardCropY(staff, digits, startX, stopX, sourceHeight) {
    let top = Math.max(0, Math.min(sourceHeight, staff.top - 38));
    let bottom = Math.min(sourceHeight, Math.max(staff.bottom + 46, top + 90));
    for (const digit of digits) {
        if (digit.x < startX || digit.x >= stopX) continue;
        top = Math.max(0, Math.min(top, digit.top));
        bottom = Math.min(sourceHeight, Math.max(bottom, digit.bottom));
    }
    const y = Math.floor(top * 10) / 10;
    const roundedBottom = Math.ceil(bottom * 10) / 10;
    // sourceHeightが小数の場合も、丸めで元SVGの高さを超えない。
    const height = roundedBottom <= sourceHeight
        ? Math.min(Number((roundedBottom - y).toFixed(1)), sourceHeight - y) : sourceHeight - y;
    if (![y, height].every(Number.isFinite) || y < 0 || height <= 0 || y + height > sourceHeight) {
        throw new Error("縦型TABのY切り抜き座標が不正です");
    }
    return { y, height };
}

/**
 * 各小節の正確な境界 [startX, endX] を高精度に算出
 * ※ 符幹（音符の棒）を排除し、赤い小節番号と本物の小節線から1小節ずつ美しく切り出す
 */
function detectMeasureBoundaries(sourceSvg, totalBars, sourceWidth, sourceHeight, sourceLeft = 0,
    { firstBarIndex = 0, isFinalPartial = true } = {}) {
    const legacyStaff = detectCropYBounds(sourceSvg);
    const geometry = detectTabGeometry(sourceSvg, sourceLeft, sourceLeft + sourceWidth);
    const staff = geometry?.ys.length === 6 && geometry.ys.every((y, index, ys) =>
        Number.isFinite(y) && y >= 0 && y <= sourceHeight && (index === 0 || y > ys[index - 1]))
        ? { top: geometry.ys[0], bottom: geometry.ys[5] } : legacyStaff;
    const digits = detectTabDigitBounds(sourceSvg, geometry);

    // Yの補正を08の最終小節X終端へ波及させないため、X検出の入力範囲は変更しない。
    const endCropY = Math.max(0, legacyStaff.top - 38);
    const endCropHeight = Math.max(90, Math.min(sourceHeight, legacyStaff.bottom + 46) - endCropY);
    const sourceRight = sourceLeft + sourceWidth;
    // partial末尾は次partialとの実小節線。本当の譜面末尾だけ08の終端検出を使用。
    const partialEnd = geometry?.barlines.filter(rect =>
        Math.abs(rect.x + rect.width - sourceRight) <= 0.1).at(-1);
    const endX = isFinalPartial
        ? detectContentEndX(sourceSvg, endCropY, endCropHeight, sourceRight)
        : partialEnd && partialEnd.x + partialEnd.width;
    if (!Number.isFinite(endX)) throw new Error("縦型TABのpartial終端小節線を取得できません");
    const leftBarlineX = detectLeftBarlineX(geometry);

    const createBoundaries = splitXs => {
        if (splitXs.some((x, index) => !Number.isFinite(x) || (index > 0 && x <= splitXs[index - 1]))) {
            throw new Error("縦型TABの小節境界の座標・順序が不正です");
        }
        return Array.from({ length: totalBars }, (_, index) => {
            const stopX = splitXs[index] !== undefined ? splitXs[index] + 1 : endX;
            const startX = index === 0
                ? (firstBarIndex === 0 && leftBarlineX !== null && leftBarlineX < stopX ? leftBarlineX : sourceLeft)
                : splitXs[index - 1] - 1;
            const width = stopX - startX;
            const crop = getCardCropY(staff, digits, startX, stopX, sourceHeight);
            if (![startX, stopX, width].every(Number.isFinite)
                || startX < sourceLeft || stopX > sourceRight || width <= 0
                || Number(width.toFixed(1)) <= 0) {
                throw new Error(`縦型TABの小節 ${index + 1} の切り抜き座標が不正です`);
            }
            return { x: startX, y: crop.y, width, height: crop.height };
        });
    };

    // 1. 赤い小節番号の位置
    const measureMarkers = detectMeasureMarkersFromSvg(sourceSvg);

    // 2. 全6弦を横切る本物の小節線。短い弦ラインも含む共通検出を使用。
    const trueBarlines = (geometry?.internalBarlines || []).map(rect => rect.x);
    trueBarlines.sort((a, b) => a - b);
    const clusteredBarlines = [];
    for (const x of trueBarlines) {
        if (clusteredBarlines.length === 0 || Math.abs(x - clusteredBarlines[clusteredBarlines.length - 1]) > 5) {
            clusteredBarlines.push(x);
        }
    }
    const internalBarlines = clusteredBarlines;

    console.info(`[縦型TAB] 境界解析: 小節番号X=[${measureMarkers.map(m => Math.round(m.x)).join(", ")}], 本物小節線=[${internalBarlines.map(Math.round).join(", ")}]`);

    if (measureMarkers.length >= totalBars && measureMarkers.slice(0, totalBars).some((marker, index) =>
        marker.x < sourceLeft || marker.x >= endX || (index > 0 && marker.x <= measureMarkers[index - 1].x))) {
        throw new Error("縦型TABの小節番号の座標・順序が不正です");
    }

    // 全境界を実線から確定できる場合は、番号ラベルの位置によらず実線を優先。
    if (internalBarlines.length === totalBars - 1) return createBoundaries(internalBarlines);

    // ★ パターンA: 検出できた実線を優先し、見つからない境界だけ番号から推定。
    if (measureMarkers.length >= totalBars) {
        const splitXs = [];
        for (let i = 1; i < totalBars; i++) {
            const markerX = measureMarkers[i].x;
            // markerX の手前 35px 以内にある本物の小節線を探す
            const previous = splitXs.at(-1) ?? (leftBarlineX ?? sourceLeft);
            const nearBarline = internalBarlines.filter(bx => bx > previous && bx >= markerX - 35 && bx <= markerX).at(-1);
            const boundaryX = nearBarline !== undefined ? nearBarline : (markerX - 10);
            splitXs.push(boundaryX);
        }
        return createBoundaries(splitXs);
    }

    // ★ パターンB: 本物の小節線から分割
    if (internalBarlines.length >= totalBars - 1 && internalBarlines.length > 0) {
        const splitXs = internalBarlines.slice(0, totalBars - 1);
        return createBoundaries(splitXs);
    }

    // 境界が不要な単独小節はコンテンツ終端まで。境界不明の複数小節は捏造しない。
    if (totalBars === 1) return createBoundaries([]);
    throw new Error("縦型TABの小節境界を取得できません");
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
        bindButtonActivation(this.previousButton, () => this.setCurrentBar(this.currentBarIndex - 1, "button"), options);
        bindButtonActivation(this.nextButton, () => this.setCurrentBar(this.currentBarIndex + 1, "button"), options);
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
        return this.createCardsFromRenderedPartials([
            { svg: sourceSvg, partialIndex: 0, firstBarIndex: 0, lastBarIndex: totalBars - 1 }
        ], totalBars);
    }

    createCardsFromRenderedPartials(partials, totalBars) {
        try {
            return this.buildCardsFromRenderedPartials(partials, totalBars);
        } catch (error) {
            this.barCount = 0;
            this.track?.replaceChildren();
            this.updateControls();
            throw error;
        }
    }

    buildCardsFromRenderedPartials(partials, totalBars) {
        if (!this.track) return;
        if (!Number.isInteger(totalBars) || totalBars <= 0 || !partials?.length) {
            throw new Error("縦型TABの譜面サイズ・小節数が不正です");
        }
        const cards = [];
        const seenSvgs = new Set();
        let nextBarIndex = 0;
        for (const partial of partials) {
            const { svg: sourceSvg, firstBarIndex, lastBarIndex } = partial;
            if (!sourceSvg || seenSvgs.has(sourceSvg)
                || !Number.isInteger(firstBarIndex) || !Number.isInteger(lastBarIndex)
                || firstBarIndex !== nextBarIndex || lastBarIndex < firstBarIndex || lastBarIndex >= totalBars) {
                throw new Error("縦型TABのpartial小節範囲が不正です");
            }
            seenSvgs.add(sourceSvg);
            const partialBars = lastBarIndex - firstBarIndex + 1;

            const viewBox = sourceSvg.viewBox?.baseVal;
            const sourceWidth = viewBox?.width || Number.parseFloat(sourceSvg.getAttribute("width")) || sourceSvg.getBoundingClientRect().width;
            const sourceHeight = viewBox?.height || Number.parseFloat(sourceSvg.getAttribute("height")) || sourceSvg.getBoundingClientRect().height;
            const sourceLeft = viewBox?.x ?? 0;
            if (!Number.isInteger(totalBars) || totalBars <= 0
                || ![sourceLeft, sourceWidth, sourceHeight, sourceLeft + sourceWidth].every(Number.isFinite)
                || sourceWidth <= 0 || sourceHeight <= 0) {
                throw new Error("縦型TABの譜面サイズ・小節数が不正です");
            }

            console.info(`[縦型TAB] ソースSVGからカード生成開始: 全${totalBars}小節, SVGサイズ: ${sourceWidth}x${sourceHeight}`);

            const boundaries = detectMeasureBoundaries(sourceSvg, partialBars, sourceWidth, sourceHeight, sourceLeft,
                { firstBarIndex, isFinalPartial: lastBarIndex === totalBars - 1 });

            for (let localIndex = 0; localIndex < partialBars; localIndex++) {
                const index = firstBarIndex + localIndex;
                const b = boundaries[localIndex];
                const x = b.x;
                const y = b.y;
                const width = b.width;
                const height = b.height;
                // 第1小節の小節線を丸めで削らない。後続小節の属性の丸めは従来どおり。
                const preserveFirstX = index === 0 && Number(x.toFixed(1)) !== x;
                const svgX = preserveFirstX ? String(x) : x.toFixed(1);
                const svgWidth = preserveFirstX ? String(width) : width.toFixed(1);

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
                clipRect.setAttribute("x", svgX);
                const svgY = String(y), svgHeight = String(height);
                clipRect.setAttribute("y", svgY);
                clipRect.setAttribute("width", svgWidth);
                clipRect.setAttribute("height", svgHeight);
                clipPath.appendChild(clipRect);
                defs.appendChild(clipPath);

                // 全描画要素をクリップ適用グループで囲む
                const group = document.createElementNS(SVG_NS, "g");
                group.setAttribute("clip-path", `url(#${clipId})`);
                const children = Array.from(cardSvg.childNodes).filter(node => node !== defs);
                children.forEach(node => group.appendChild(node));
                cardSvg.appendChild(group);

                cardSvg.setAttribute("viewBox", `${svgX} ${svgY} ${svgWidth} ${svgHeight}`);
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
                cards.push(card);

                console.info(`[縦型TAB] 小節 ${index + 1} カード生成完了:`, { x, y, width, height });
            }
            nextBarIndex = lastBarIndex + 1;
        }
        if (nextBarIndex !== totalBars || cards.length !== totalBars) {
            throw new Error("縦型TABの全小節が揃っていません");
        }
        // 途中のpartialに問題があっても、半分だけのカードを表示しない。
        this.track.replaceChildren(...cards);
        this.barCount = totalBars;
        this.currentBarIndex = Math.max(0, Math.min(this.barCount - 1, this.currentBarIndex));

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
