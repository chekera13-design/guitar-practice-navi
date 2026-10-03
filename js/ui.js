// ==========================================
// 超ギタートレーニング（超ギタトレ） - UI制御・画面表示ロジック (js/ui.js)
// ==========================================

// --- ビジュアルメトロノーム表示更新 ---
export function updateVisualMetronome(beat, isAccent, phaseText, phaseClass) {
    const dots = document.querySelectorAll(".beat-dot");
    const countDisplay = document.getElementById("metroBigCount");
    const phaseBadge = document.getElementById("metroPhaseBadge");
    const visualBox = document.getElementById("visualMetronomeBox");

    dots.forEach((dot, index) => {
        const dotBeat = index + 1;
        dot.classList.remove("active", "accent", "flash");
        if (dotBeat === beat) {
            dot.classList.add("active");
            if (isAccent) dot.classList.add("accent");
            void dot.offsetWidth;
            dot.classList.add("flash");
        }
    });

    if (countDisplay) {
        countDisplay.innerText = beat || "-";
        countDisplay.className = "metro-count-chip " + (isAccent ? "accent pulse" : "pulse");
    }

    if (phaseBadge) {
        phaseBadge.innerText = phaseText;
        phaseBadge.className = "metro-phase-badge " + (phaseClass || "");
    }

    if (visualBox) {
        visualBox.classList.remove("beat-flash", "accent-flash");
        void visualBox.offsetWidth;
        visualBox.classList.add(isAccent ? "accent-flash" : "beat-flash");
    }
}

export function setPlayFinishedVisual(message = "演奏終了") {
    const dots = document.querySelectorAll(".beat-dot");
    const countDisplay = document.getElementById("metroBigCount");
    const phaseBadge = document.getElementById("metroPhaseBadge");
    const visualBox = document.getElementById("visualMetronomeBox");

    dots.forEach(dot => dot.classList.remove("active", "accent", "flash"));

    if (countDisplay) {
        countDisplay.innerText = "✓";
        countDisplay.className = "metro-count-chip finished";
    }

    if (phaseBadge) {
        phaseBadge.innerText = message;
        phaseBadge.className = "metro-phase-badge finished";
    }

    if (visualBox) {
        visualBox.classList.remove("beat-flash", "accent-flash", "recording");
    }
}

export function resetVisualMetronome() {
    const dots = document.querySelectorAll(".beat-dot");
    const countDisplay = document.getElementById("metroBigCount");
    const phaseBadge = document.getElementById("metroPhaseBadge");
    const visualBox = document.getElementById("visualMetronomeBox");

    dots.forEach(dot => dot.classList.remove("active", "accent", "flash"));
    if (countDisplay) {
        countDisplay.innerText = "-";
        countDisplay.className = "metro-count-chip";
    }
    if (phaseBadge) {
        phaseBadge.innerText = "STANDBY";
        phaseBadge.className = "metro-phase-badge";
    }
    if (visualBox) {
        visualBox.classList.remove("beat-flash", "accent-flash", "recording");
    }
}

// ==========================================
// ★ 譜面ハイライト & スムーズ連続自動スクロール ★
// ==========================================
let cachedBarLayouts = [];
let cachedScoreEndX = 0;
let lastFocusedBar = -1;
let continuousScrollFrameId = null;

export function resetScoreFocusState() {
    lastFocusedBar = -1;
    stopScoreContinuousScroll();
    const highlight = document.getElementById("scoreBarHighlight");
    if (highlight) highlight.classList.add("hidden");
    cachedBarLayouts = [];
    cachedScoreEndX = 0;
}

function isUsableBounds(bounds) {
    return !!bounds && Number.isFinite(bounds.x) && Number.isFinite(bounds.y) &&
        Number.isFinite(bounds.w) && Number.isFinite(bounds.h) && bounds.w > 0 && bounds.h > 0;
}

function getNodeBounds(node) {
    if (!node) return null;
    const bounds = isUsableBounds(node.realBounds) ? node.realBounds : node.visualBounds;
    return isUsableBounds(bounds) ? bounds : null;
}

function mergeBounds(nodes) {
    const rects = nodes.map(getNodeBounds).filter(Boolean);
    if (rects.length === 0) return null;
    const left = Math.min(...rects.map(rect => rect.x));
    const top = Math.min(...rects.map(rect => rect.y));
    const right = Math.max(...rects.map(rect => rect.x + rect.w));
    const bottom = Math.max(...rects.map(rect => rect.y + rect.h));
    return { x: left, y: top, w: right - left, h: bottom - top };
}

function getMasterBarBounds(lookup, barIndex) {
    const indexed = lookup?.findMasterBarByIndex?.(barIndex);
    if (getNodeBounds(indexed)) return indexed;

    const systems = Array.from(lookup?.staffSystems || []);
    for (const system of systems) {
        const masterBar = Array.from(system?.bars || []).find(item => item?.index === barIndex);
        if (masterBar && (getNodeBounds(masterBar) || mergeBounds(Array.from(masterBar.bars || [])))) {
            return masterBar;
        }
    }
    return null;
}

// 全小節のレイアウト座標を一括構築・キャッシュ
export function buildScoreBarLayouts(api, totalBars) {
    cachedBarLayouts = [];
    cachedScoreEndX = 0;
    const wrapper = document.querySelector(".score-wrapper");
    const svg = document.querySelector("#alphaTab svg");
    if (!wrapper || !svg || !api) return false;

    const lookup = api?.boundsLookup || api?.renderer?.boundsLookup;
    if (!lookup) return false;

    const svgRect = svg.getBoundingClientRect();
    const viewBox = svg.viewBox?.baseVal;
    const viewWidth = viewBox?.width || Number.parseFloat(svg.getAttribute("width")) || svgRect.width;
    const viewHeight = viewBox?.height || Number.parseFloat(svg.getAttribute("height")) || svgRect.height;
    const scaleX = (viewWidth > 0 && svgRect.width > 0) ? (svgRect.width / viewWidth) : 1;
    const scaleY = (viewHeight > 0 && svgRect.height > 0) ? (svgRect.height / viewHeight) : 1;
    const viewBoxX = viewBox?.x || 0;
    const viewBoxY = viewBox?.y || 0;

    let totalMeasuredWidth = 0;
    let measuredCount = 0;
    const rawLayouts = [];

    for (let i = 0; i < totalBars; i++) {
        const masterBarBounds = getMasterBarBounds(lookup, i);
        const bounds = getNodeBounds(masterBarBounds) || (masterBarBounds?.bars ? mergeBounds(Array.from(masterBarBounds.bars)) : null);

        if (bounds) {
            const left = (bounds.x - viewBoxX) * scaleX;
            const top = (bounds.y - viewBoxY) * scaleY;
            const width = bounds.w * scaleX;
            const height = bounds.h * scaleY;
            rawLayouts[i] = { left, top, width, height };
            totalMeasuredWidth += width;
            measuredCount++;
        } else {
            rawLayouts[i] = null;
        }
    }

    const fallbackWidth = measuredCount > 0 ? (totalMeasuredWidth / measuredCount) : 260;
    const defaultHeight = (wrapper.clientHeight && wrapper.clientHeight > 40) ? (wrapper.clientHeight - 20) : 180;

    let currentCursorX = 0;
    for (let i = 0; i < totalBars; i++) {
        if (rawLayouts[i]) {
            cachedBarLayouts[i] = rawLayouts[i];
            currentCursorX = rawLayouts[i].left + rawLayouts[i].width;
        } else {
            const prev = cachedBarLayouts[i - 1];
            const left = prev ? (prev.left + prev.width) : currentCursorX;
            const top = prev ? prev.top : 10;
            const width = prev ? prev.width : fallbackWidth;
            const height = prev ? prev.height : defaultHeight;
            cachedBarLayouts[i] = { left, top, width, height };
            currentCursorX = left + width;
        }
    }

    if (cachedBarLayouts.length > 0) {
        const last = cachedBarLayouts[cachedBarLayouts.length - 1];
        cachedScoreEndX = last.left + last.width;
    }
    return true;
}

// 小節ハイライト枠の位置更新
export function updateHighlightBar(barIndex) {
    const highlight = document.getElementById("scoreBarHighlight");
    if (!highlight || barIndex < 0) {
        if (highlight) highlight.classList.add("hidden");
        return;
    }

    const rect = cachedBarLayouts[barIndex];
    if (!rect) return;

    if (barIndex !== lastFocusedBar) {
        highlight.style.left = `${rect.left}px`;
        highlight.style.top = `${rect.top}px`;
        highlight.style.width = `${rect.width}px`;
        highlight.style.height = `${rect.height}px`;
        highlight.classList.remove("hidden");
        lastFocusedBar = barIndex;
    }
}

// ★ 演奏開始に合わせて滑らかに自動スクロールするループを開始
export function startScoreContinuousScroll({
    api,
    totalBars,
    beatsPerBar = 4,
    beatSec = 0.5,
    onProgress
}) {
    stopScoreContinuousScroll();

    const wrapper = document.querySelector(".score-wrapper");
    if (!wrapper) return;

    if (cachedBarLayouts.length < totalBars) {
        buildScoreBarLayouts(api, totalBars);
    }

    const totalDurationSec = totalBars * beatsPerBar * beatSec;
    const startTime = performance.now();

    function frame(now) {
        const elapsedSec = (now - startTime) / 1000;
        if (elapsedSec < 0) {
            continuousScrollFrameId = requestAnimationFrame(frame);
            return;
        }

        const currentTotalBeats = elapsedSec / beatSec;
        const currentBarIndex = Math.min(totalBars - 1, Math.floor(currentTotalBeats / beatsPerBar));
        const progressInBar = Math.max(0, Math.min(1, (currentTotalBeats % beatsPerBar) / beatsPerBar));

        const barRect = cachedBarLayouts[currentBarIndex];
        let currentX = 0;
        if (barRect) {
            currentX = barRect.left + (barRect.width * progressInBar);
            updateHighlightBar(currentBarIndex);
        }

        const maxScroll = Math.max(0, wrapper.scrollWidth - wrapper.clientWidth);
        const maxTargetForScoreEnd = Math.max(0, (cachedScoreEndX || wrapper.scrollWidth) - wrapper.clientWidth + 30);
        const desiredTarget = currentX - (wrapper.clientWidth * 0.28);
        const targetScrollLeft = Math.max(0, Math.min(desiredTarget, maxTargetForScoreEnd, maxScroll));

        wrapper.scrollLeft = targetScrollLeft;

        if (onProgress) {
            onProgress(currentBarIndex, Math.floor(currentTotalBeats % beatsPerBar) + 1);
        }

        if (elapsedSec < totalDurationSec + 0.5) {
            continuousScrollFrameId = requestAnimationFrame(frame);
        } else {
            continuousScrollFrameId = null;
        }
    }

    continuousScrollFrameId = requestAnimationFrame(frame);
}

// 連続スクロール停止
export function stopScoreContinuousScroll() {
    if (continuousScrollFrameId !== null) {
        cancelAnimationFrame(continuousScrollFrameId);
        continuousScrollFrameId = null;
    }
}

// ==========================================
// ★ 簡易チューナー UI 制御 ★
// ==========================================
let smoothedCents = 0;
let lastInTuneSoundTime = 0;
let inTuneHoldFrames = 0;

export function updateTunerUI({
    freq,
    tunerTargetFreq,
    tunerHzDisplay,
    tunerMeterPointer,
    tunerStatusText,
    onInTunePing
}) {
    let actualFreq = freq;
    while (actualFreq < tunerTargetFreq * 0.7071) {
        actualFreq *= 2;
    }
    while (actualFreq > tunerTargetFreq * 1.4142) {
        actualFreq /= 2;
    }

    if (tunerHzDisplay) {
        tunerHzDisplay.innerText = `${actualFreq.toFixed(1)} Hz (生: ${freq.toFixed(1)} Hz)`;
    }

    const rawCents = 1200 * Math.log2(actualFreq / tunerTargetFreq);
    smoothedCents = smoothedCents * 0.65 + rawCents * 0.35;

    let pointerPos = 50 + (smoothedCents / 50) * 40;
    pointerPos = Math.max(8, Math.min(92, pointerPos));

    if (tunerMeterPointer) {
        tunerMeterPointer.style.left = `${pointerPos}%`;
    }

    if (!tunerStatusText || !tunerMeterPointer) return;

    const absCents = Math.abs(smoothedCents);

    if (absCents <= 6) {
        inTuneHoldFrames++;
        tunerStatusText.innerText = "✨ ピッタリ合っています！";
        tunerStatusText.style.color = "#10b981";
        tunerMeterPointer.style.background = "#10b981";
        tunerMeterPointer.style.boxShadow = "0 0 12px #10b981";

        const now = Date.now();
        if (inTuneHoldFrames >= 3 && (now - lastInTuneSoundTime > 1500)) {
            lastInTuneSoundTime = now;
            if (onInTunePing) onInTunePing();
        }
    } else {
        inTuneHoldFrames = 0;
        tunerMeterPointer.style.boxShadow = "none";

        if (smoothedCents < -6) {
            tunerStatusText.innerText = "少し低い ➔ ペグを巻く ⤴";
            tunerStatusText.style.color = "#60a5fa";
            tunerMeterPointer.style.background = "#60a5fa";
        } else {
            tunerStatusText.innerText = "少し高い ➔ ペグを緩める ⤵";
            tunerStatusText.style.color = "#f87171";
            tunerMeterPointer.style.background = "#f87171";
        }
    }
}

export function resetTunerSmoothing() {
    smoothedCents = 0;
    inTuneHoldFrames = 0;
}