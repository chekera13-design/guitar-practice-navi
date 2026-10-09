// ==========================================
// ギター練習ドットコム - メインアプリケーション (js/app.js)
// ==========================================

import { TUTORIAL_STAGES, BASIC_STAGES } from "./config.js";
import { VerticalTabController } from "./verticalTab.js";
import { bindButtonActivation } from "./buttonInput.js";
import { 
    unlockAudioContext, setupMicrophoneStream, stopMicrophoneStream, scheduleTick,
    autoCorrelate, midiToFrequency,
    requestWakeLock, releaseWakeLock,
    audioContext, analyser, audioBuffer,
    setMetronomeVolume, getMetronomeVolume, playTunerPing,
    stopAllScheduledTicks
} from "./audioEngine.js";
import { 
    updateVisualMetronome, setPlayFinishedVisual, resetVisualMetronome,
    buildScoreBarLayouts, updateHighlightBar,
    startScoreContinuousScroll, stopScoreContinuousScroll,
    resetScoreFocusState, updateTunerUI, resetTunerSmoothing
} from "./ui.js";

// --- 状態管理 ---
let currentStage = BASIC_STAGES[0]; 
let isPracticing = false;
let isStartingPractice = false;
let practiceStartGeneration = 0;
let practiceSession = null;
let pendingPracticeMode = null;
let isFinalizingRecording = false;
let currentBpm = 60;
let practiceTimerIds = [];
let verticalTabController = null;
let currentPracticeBarIndex = 0;

// 単体メトロノーム状態
let isStandaloneMetroPlaying = false;
let isStartingStandaloneMetro = false;
let standaloneMetroStartGeneration = 0;
let standaloneMetroTimerId = null;
let standaloneMetroDisplayTimerIds = new Set();
let standaloneBeat = 0;
let standaloneNextTickTime = 0;

// 譜面描画状態
let isScoreRendered = false;
let modalOpenTimerId = null;
let scoreResizeObserver = null;
let practiceModalWasLandscape = false;
let practiceModalPositionFrame = null;
let alphaTabHealthCheckTimerId = null;
let scoreRenderInProgress = false;
let scoreLoadPending = false;
let scoreLoadConfirmed = false;
let scoreHealthCheckPending = false;
let scoreRepairAttempted = false;
let scoreRenderGeneration = 0;
let activeScoreRenderGeneration = 0;
let scoreRenderStartedAt = 0;
let scoreLoadState = "idle"; // idle / loading / ready / error
let preparedScore = null;

// スラー＆記号（H/P/S/C等）の検出データ
let detectedSlurPairs = [];

// 録音ステート
let recordingSession = null;
let recordingGeneration = 0;
let recordedAudioUrl = null;
let microphoneStream = null;

const TUTORIAL_COMPLETION_STORAGE_KEY = "chogita_tutorial_completed";
let completedTutorialStages = new Set();

// DOM要素取得
const exerciseGrid = document.getElementById("exerciseGrid");
const tutorialExerciseGrid = document.getElementById("tutorialExerciseGrid");
const practiceModal = document.getElementById("practiceModal");
const closePracticeModalBtn = document.getElementById("closePracticeModalBtn");
const modalStageBadge = document.getElementById("modalStageBadge");
const modalBpmBadge = document.getElementById("modalBpmBadge");
const modalBarsBadge = document.getElementById("modalBarsBadge");
const modalStageTitle = document.getElementById("modalStageTitle");
const modalStageDesc = document.getElementById("modalStageDesc");
const stageGuideTitle = document.getElementById("stageGuideTitle");
const stageGuideBody = document.getElementById("stageGuideBody");

const visualMetronomeBox = document.getElementById("visualMetronomeBox");
const mainActionBtn = document.getElementById("mainActionBtn");
const recordPracticeBtn = document.getElementById("recordPracticeBtn");
const practiceRepeatSelect = document.getElementById("practiceRepeatSelect");
const practiceStatus = document.getElementById("practiceStatus");
const scoreLoadStatus = document.getElementById("scoreLoadStatus");
const scoreLoadMessage = document.getElementById("scoreLoadMessage");
const retryScoreBtn = document.getElementById("retryScoreBtn");
const recordResultCard = document.getElementById("recordResultCard");
const recordedAudioPlayer = document.getElementById("recordedAudioPlayer");
const verticalTabWrapper = document.getElementById("verticalTabWrapper");

// 単体メトロノームボタンDOM
const standaloneMetroBtn = document.getElementById("standaloneMetroBtn");

// メトロノーム音量スライダーDOM
const metroVolContainer = document.getElementById("metroVolContainer");
const metroVolToggleBtn = document.getElementById("metroVolToggleBtn");
const metroVolSlider = document.getElementById("metroVolSlider");
const metroVolLabel = document.getElementById("metroVolLabel");
const metroVolIcon = document.getElementById("metroVolIcon");
let volCollapseTimer = null;

// チューナー関連DOM
const tunerDetails = document.querySelector(".tuner-details");
const tunerHud = document.getElementById("tunerHud");
const tunerTargetLabel = document.getElementById("tunerTargetLabel");
const tunerStatusText = document.getElementById("tunerStatusText");
const tunerMeterPointer = document.getElementById("tunerMeterPointer");
const tunerHzDisplay = document.getElementById("tunerHzDisplay");
const tunerStringBtns = document.querySelectorAll(".tuner-string-btn");
let isTuning = false;
let isStartingTuner = false;
let tunerStartGeneration = 0;
let tunerSession = null;
let currentTunerStringNum = null;
let tunerTargetFreq = 82.41;
let tunerAnimFrameId = null;
let tunerSilenceFrames = 0;

// インフォモーダルDOM
const infoModal = document.getElementById("infoModal");
const infoModalTitle = document.getElementById("infoModalTitle");
const infoModalBody = document.getElementById("infoModalBody");
const closeInfoModalBtn = document.getElementById("closeInfoModalBtn");
const openAboutBtn = document.getElementById("openAboutBtn");
const openPrivacyBtn = document.getElementById("openPrivacyBtn");
const openContactBtn = document.getElementById("openContactBtn");

// メトロノームSVGアイコンのテンプレート
const METRO_SVG_ICON = `
    <svg class="metro-icon-svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
        <path d="M12 2c-.4 0-.8.25-.95.63L4.6 19H3a1 1 0 100 2h18a1 1 0 100-2h-1.6L12.95 2.63c-.15-.38-.55-.63-.95-.63zm0 3.5l4.8 13.5H7.2L12 5.5zm-.5 3.5v5.2l-1.6-1.6-1.4 1.4 3 3a1 1 0 001.4 0l4-4-1.4-1.4-2.5 2.5V9h-1.5z"/>
    </svg>
`;

// ==========================================
// ★ 単体メトロノーム制御（ドリフトフリー高精度タイマー） ★
// ==========================================
async function toggleStandaloneMetronome() {
    if (isPracticing || isStartingPractice || isFinalizingRecording) return;

    if (isStandaloneMetroPlaying || isStartingStandaloneMetro) {
        stopStandaloneMetronome();
    } else {
        await startStandaloneMetronome();
    }
}

async function startStandaloneMetronome() {
    if (isStandaloneMetroPlaying || isStartingStandaloneMetro
        || isPracticing || isStartingPractice || isFinalizingRecording
        || practiceModal.classList.contains("hidden")) return;
    const generation = ++standaloneMetroStartGeneration;
    const isCurrentStart = () => generation === standaloneMetroStartGeneration
        && !isPracticing && !isStartingPractice && !isFinalizingRecording
        && !practiceModal.classList.contains("hidden");
    const displayTimerIds = new Set();
    standaloneMetroDisplayTimerIds = displayTimerIds;
    isStartingStandaloneMetro = true;
    if (standaloneMetroBtn) {
        standaloneMetroBtn.classList.add("active");
        standaloneMetroBtn.innerHTML = `<span>⏹</span><span class="metro-btn-text">準備を中止</span>`;
        standaloneMetroBtn.setAttribute("aria-busy", "true");
    }

    try {
        stopTuner();
        await unlockAudioContext();
        if (!isCurrentStart()) return;

        const currentVol = Number(metroVolSlider?.value || 40) / 100;
        setMetronomeVolume(currentVol);

        isStartingStandaloneMetro = false;
        isStandaloneMetroPlaying = true;
        standaloneBeat = 0;

        if (standaloneMetroBtn) {
            standaloneMetroBtn.classList.add("active");
            standaloneMetroBtn.innerHTML = `<span>⏹</span><span class="metro-btn-text">停止</span>`;
            standaloneMetroBtn.removeAttribute("aria-busy");
        }

        const beatsPerBar = (currentStage.timeSignature && currentStage.timeSignature[0]) || 4;
        const beatSec = 60 / currentBpm;
    
        standaloneNextTickTime = audioContext.currentTime + 0.05;

        function scheduler() {
            if (!isStandaloneMetroPlaying || !isCurrentStart()) return;
            standaloneMetroTimerId = null;

            while (standaloneNextTickTime < audioContext.currentTime + 0.1) {
                const beatInBar = (standaloneBeat % beatsPerBar) + 1;
                const isAccent = (beatInBar === 1);

                scheduleTick(standaloneNextTickTime, isAccent);

                const delayMs = Math.max(0, (standaloneNextTickTime - audioContext.currentTime) * 1000);
                const displayTimerId = setTimeout(() => {
                    displayTimerIds.delete(displayTimerId);
                    if (isStandaloneMetroPlaying && isCurrentStart()) {
                        updateVisualMetronome(beatInBar, isAccent, "METRO", "metro-solo");
                    }
                }, delayMs);
                displayTimerIds.add(displayTimerId);

                standaloneNextTickTime += beatSec;
                standaloneBeat++;
            }

            standaloneMetroTimerId = setTimeout(scheduler, 25);
        }

        scheduler();
    } catch (error) {
        if (generation !== standaloneMetroStartGeneration) return;
        console.warn("単体メトロノームを開始できませんでした:", error);
        stopStandaloneMetronome();
    }
}

function stopStandaloneMetronome() {
    standaloneMetroStartGeneration++;
    isStartingStandaloneMetro = false;
    isStandaloneMetroPlaying = false;
    if (standaloneMetroTimerId !== null) {
        clearTimeout(standaloneMetroTimerId);
        standaloneMetroTimerId = null;
    }
    standaloneMetroDisplayTimerIds.forEach(id => clearTimeout(id));
    standaloneMetroDisplayTimerIds.clear();
    standaloneBeat = 0;
    standaloneNextTickTime = 0;

    stopAllScheduledTicks();

    if (standaloneMetroBtn) {
        standaloneMetroBtn.classList.remove("active");
        standaloneMetroBtn.innerHTML = `${METRO_SVG_ICON}<span class="metro-btn-text">クリック</span>`;
        standaloneMetroBtn.removeAttribute("aria-busy");
    }

    if (!isPracticing) {
        resetVisualMetronome();
    }
}

if (standaloneMetroBtn) {
    standaloneMetroBtn.addEventListener("click", toggleStandaloneMetronome);
}

// ==========================================
// ★ メトロノーム音量スライダー制御 ★
// ==========================================
function expandVolumeBar() {
    if (!metroVolContainer) return;
    metroVolContainer.classList.add("expanded");
    resetVolumeCollapseTimer();
}

function collapseVolumeBar() {
    if (!metroVolContainer) return;
    metroVolContainer.classList.remove("expanded");
    if (volCollapseTimer) {
        clearTimeout(volCollapseTimer);
        volCollapseTimer = null;
    }
}

function resetVolumeCollapseTimer() {
    if (volCollapseTimer) clearTimeout(volCollapseTimer);
    volCollapseTimer = setTimeout(() => {
        collapseVolumeBar();
    }, 3000);
}

function initVolumeControl() {
    if (!metroVolSlider) return;

    let initialVol = 40;
    try {
        const savedVol = localStorage.getItem("chogita_metro_vol");
        if (savedVol !== null && savedVol.trim() !== "") {
            const parsedVol = Number(savedVol);
            if (Number.isFinite(parsedVol) && parsedVol >= 0 && parsedVol <= 100) {
                initialVol = parsedVol;
            }
        }
    } catch (err) {
        // 保存領域を利用できなくても、既定音量で初期化を続ける。
    }

    metroVolSlider.value = initialVol;
    setMetronomeVolume(initialVol / 100);
    updateVolumeDisplay(initialVol);

    const pauseVolumeTimer = () => {
        if (volCollapseTimer) {
            clearTimeout(volCollapseTimer);
            volCollapseTimer = null;
        }
    };

    const resumeVolumeTimer = () => {
        resetVolumeCollapseTimer();
    };

    metroVolSlider.addEventListener("input", (e) => {
        const val = Number(e.target.value);
        setMetronomeVolume(val / 100);
        updateVolumeDisplay(val);
        pauseVolumeTimer(); 
        
        try {
            localStorage.setItem("chogita_metro_vol", String(val));
        } catch (err) {}
    });

    metroVolSlider.addEventListener("touchstart", pauseVolumeTimer, { passive: true });
    metroVolSlider.addEventListener("touchend", resumeVolumeTimer, { passive: true });
    metroVolSlider.addEventListener("mousedown", pauseVolumeTimer);
    
    document.addEventListener("mouseup", () => {
        if (metroVolContainer && metroVolContainer.classList.contains("expanded")) {
            resumeVolumeTimer();
        }
    });

    if (metroVolToggleBtn) {
        metroVolToggleBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (metroVolContainer.classList.contains("expanded")) {
                collapseVolumeBar();
            } else {
                expandVolumeBar();
            }
        });
    }

    document.addEventListener("click", (e) => {
        if (metroVolContainer && !metroVolContainer.contains(e.target)) {
            collapseVolumeBar();
        }
    });
}

function updateVolumeDisplay(val) {
    if (metroVolLabel) metroVolLabel.innerText = `${val}%`;
    if (metroVolIcon) {
        if (val === 0) metroVolIcon.innerText = "🔇";
        else if (val < 50) metroVolIcon.innerText = "🔉";
        else metroVolIcon.innerText = "🔊";
    }
}

// ==========================================
// ★ MuseScore 4 MusicXML 補正 & スラー・演奏記号（H/P/S/C等）の抽出 ★
// ==========================================
function fixMuseScoreXml(xmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    detectedSlurPairs = [];
    const activeSlurs = new Map();
    let globalFretIndex = 0;

    const measures = xmlDoc.querySelectorAll('measure');

    measures.forEach((measure, measureIdx) => {
        let currentDirectionLabel = null;

        Array.from(measure.children).forEach(child => {
            const tag = child.tagName.toLowerCase();

            if (tag === 'direction') {
                const words = child.querySelector('words');
                if (words && words.textContent) {
                    const text = words.textContent.trim().toUpperCase();
                    const validLabels = ['H', 'P', 'S', 'C', 'D', 'T', 'SL', 'SLIDE', 'HO', 'PO', 'CHO', 'BEND'];
                    if (validLabels.includes(text)) {
                        let displayLabel = text;
                        if (['SL', 'SLIDE'].includes(text)) displayLabel = 'S';
                        else if (text === 'HO') displayLabel = 'H';
                        else if (text === 'PO') displayLabel = 'P';
                        else if (['CHO', 'BEND'].includes(text)) displayLabel = 'C';

                        currentDirectionLabel = displayLabel;
                        // 自前でSVG描画するため、XML内のdirectionノードは削除（二重描画防止）
                        child.remove();
                    }
                }
            } else if (tag === 'note') {
                const isRest = !!child.querySelector('rest');
                if (isRest) {
                    return; // 休符はフレット音符カウントの対象外
                }

                const currentNoteIndex = globalFretIndex++;

                const notations = child.querySelector('notations');
                if (notations) {
                    // スラー開始の検出
                    const slurStarts = notations.querySelectorAll('slur[type="start"]');
                    slurStarts.forEach(s => {
                        const num = s.getAttribute('number') || '1';
                        let techLabel = null;
                        const ho = notations.querySelector('hammer-on[type="start"]');
                        const po = notations.querySelector('pull-off[type="start"]');
                        if (ho && ho.textContent) techLabel = ho.textContent.trim().toUpperCase();
                        else if (po && po.textContent) techLabel = po.textContent.trim().toUpperCase();

                        const label = currentDirectionLabel || techLabel || 'H';

                        activeSlurs.set(num, {
                            startIndex: currentNoteIndex,
                            measureIndex: measureIdx + 1,
                            label: label
                        });
                    });

                    if (slurStarts.length > 0) {
                        currentDirectionLabel = null;
                    }

                    // スラー終了の検出
                    const slurStops = notations.querySelectorAll('slur[type="stop"]');
                    slurStops.forEach(s => {
                        const num = s.getAttribute('number') || '1';
                        if (activeSlurs.has(num)) {
                            const slurInfo = activeSlurs.get(num);
                            activeSlurs.delete(num);

                            detectedSlurPairs.push({
                                startIndex: slurInfo.startIndex,
                                endIndex: currentNoteIndex,
                                measureIndex: slurInfo.measureIndex,
                                label: slurInfo.label
                            });
                        }
                    });
                }
            }
        });
    });

    console.info('[MusicXML解析完了] 検出されたスラーペア:', detectedSlurPairs);

    const serializer = new XMLSerializer();
    return serializer.serializeToString(xmlDoc);
}

// ==========================================
// ★ スラー弧線（上向き三日月）＆ 記号（H/P/S/C）の確実なSVG描画 ★
// ==========================================
function renderSlursAndLabelsInSvg() {
    const container = document.getElementById("alphaTab");
    if (!container) return;

    const svgs = container.querySelectorAll('svg');
    const SVG_NS = "http://www.w3.org/2000/svg";

    svgs.forEach(svg => {
        svg.querySelectorAll('.alphatab-custom-slur, .alphaTab-slur-label').forEach(el => el.remove());

        // フレット数字テキスト（0-9）をすべて抽出
        const allTexts = Array.from(svg.querySelectorAll('text'));
        const fretTexts = allTexts.filter(el => {
            const text = el.textContent.trim();
            if (!/^[0-9]+$/.test(text)) return false;
            const fill = (el.getAttribute('fill') || el.style.fill || '').toLowerCase();
            if (fill.includes('red') || fill.includes('c8') || fill.includes('rgb(200')) return false;
            return true;
        });

        // X座標昇順にソート（音符の時系列順）
        fretTexts.sort((a, b) => {
            try {
                return a.getBBox().x - b.getBBox().x;
            } catch (e) {
                return 0;
            }
        });

        // 解析された各スラーペアを描画
        detectedSlurPairs.forEach(pair => {
            const { startIndex, endIndex, label } = pair;
            if (startIndex >= fretTexts.length || endIndex >= fretTexts.length) return;

            try {
                const b1 = fretTexts[startIndex].getBBox();
                const b2 = fretTexts[endIndex].getBBox();

                const x1 = b1.x + b1.width * 0.5;
                const y1 = b1.y - 1;
                const x2 = b2.x + b2.width * 0.5;
                const y2 = b2.y - 1;

                const midX = (x1 + x2) * 0.5;
                const span = Math.abs(x2 - x1);

                // スラー弧線のアーチ高さ（音符間隔に応じて自然な高さを算出）
                const arch = Math.max(12, Math.min(22, span * 0.22));
                const topY = Math.min(y1, y2) - arch;
                const thickness = 2.0;

                // 上向きの三日月型スラー弧線パス（ベジェ曲線）
                const pathData = `M ${x1.toFixed(1)} ${y1.toFixed(1)} ` +
                                 `Q ${midX.toFixed(1)} ${(topY - thickness * 0.6).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)} ` +
                                 `Q ${midX.toFixed(1)} ${(topY + thickness * 0.6).toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)} Z`;

                const slurPath = document.createElementNS(SVG_NS, 'path');
                slurPath.setAttribute('d', pathData);
                slurPath.setAttribute('fill', '#1e293b');
                slurPath.setAttribute('class', 'alphatab-custom-slur');
                svg.appendChild(slurPath);

                // スラー弧線の頂点の真上に、H / P / S / C 等の演奏記号を配置
                if (label) {
                    const textEl = document.createElementNS(SVG_NS, 'text');
                    textEl.setAttribute('x', midX.toFixed(1));
                    textEl.setAttribute('y', (topY - 4).toFixed(1));
                    textEl.setAttribute('text-anchor', 'middle');
                    textEl.setAttribute('class', 'alphaTab-slur-label');
                    textEl.setAttribute('font-family', 'Georgia, "Times New Roman", serif');
                    textEl.setAttribute('font-style', 'italic');
                    textEl.setAttribute('font-weight', 'bold');
                    textEl.setAttribute('font-size', '15px');
                    textEl.setAttribute('fill', '#0f172a');
                    textEl.textContent = label;
                    svg.appendChild(textEl);
                }

            } catch (e) {
                console.warn('[スラー描画エラー]', e);
            }
        });
    });
}

function handleWatermark() {
    const container = document.getElementById("alphaTab");
    if (!container) return;
    const allTexts = container.querySelectorAll('text');
    allTexts.forEach(el => {
        if (el.textContent && el.textContent.includes('alphaTab') && !el.dataset.faded) {
            el.dataset.faded = 'true';
            el.style.transition = 'opacity 1s ease-out';
            el.style.opacity = '1';
            setTimeout(() => {
                el.style.opacity = '0';
                setTimeout(() => el.remove(), 1000);
            }, 2000);
        }
    });
}

// --- alphaTab 初期化 ---
let api = null;
function destroyAlphaTabApi() {
    const previousApi = api;
    api = null;
    try {
        previousApi?.destroy();
    } catch (e) {
        console.warn("alphaTab destroy error:", e);
    }
    document.getElementById("alphaTab")?.replaceChildren();
}

function isScoreReadyForPractice() {
    return scoreLoadState === "ready" && isScoreRendered
        && preparedScore?.generation === scoreRenderGeneration
        && preparedScore.stage === currentStage && preparedScore.api === api
        && preparedScore.bars > 0 && api?.score?.masterBars?.length === preparedScore.bars;
}

function setScoreLoadState(state) {
    scoreLoadState = state;
    if (state !== "ready") preparedScore = null;
    // 音声・マイク許可待ちの途中で譜面が無効になった場合も開始を取り消す。
    if (state !== "ready" && isStartingPractice) stopPractice();
    if (scoreLoadStatus) {
        scoreLoadStatus.hidden = state === "idle" || state === "ready";
        scoreLoadStatus.dataset.state = state;
        scoreLoadStatus.classList.toggle("is-error", state === "error");
    }
    if (scoreLoadMessage) scoreLoadMessage.innerText = state === "error"
        ? "譜面を読み込めませんでした" : "譜面を読み込んでいます";
    if (retryScoreBtn) retryScoreBtn.hidden = state !== "error";
    if (state === "error") verticalTabController?.setMessage("譜面を読み込めませんでした");
    updatePracticeControls();
}

function failScoreLoad(error, generation = scoreRenderGeneration) {
    if (generation !== scoreRenderGeneration || practiceModal.classList.contains("hidden")) return;
    console.error("譜面の準備に失敗:", error);
    scoreRenderGeneration++; // 失敗後に届く完了イベントも無効化する。
    scoreRenderInProgress = false;
    scoreLoadPending = false;
    scoreLoadConfirmed = false;
    activeScoreRenderGeneration = 0;
    isScoreRendered = false;
    scoreHealthCheckPending = false;
    if (alphaTabHealthCheckTimerId !== null) clearTimeout(alphaTabHealthCheckTimerId);
    alphaTabHealthCheckTimerId = null;
    setScoreLoadState("error");
}

function restartScoreLoading() {
    scoreRenderGeneration++;
    scoreRenderInProgress = false;
    scoreLoadPending = false;
    scoreLoadConfirmed = false;
    activeScoreRenderGeneration = 0;
    isScoreRendered = false;
    if (scoreResizeObserver) scoreResizeObserver.disconnect();
    scoreResizeObserver = null;
    if (alphaTabHealthCheckTimerId !== null) clearTimeout(alphaTabHealthCheckTimerId);
    alphaTabHealthCheckTimerId = null;
    scoreHealthCheckPending = false;
    setScoreLoadState("loading");
    destroyAlphaTabApi();
    verticalTabController?.destroy();
    verticalTabController = null;
    updatePracticeScoreLayout();
    return renderTab(currentStage);
}

function retryScoreLoad() {
    if (scoreLoadState !== "error" || practiceModal.classList.contains("hidden")
        || isPracticing || isStartingPractice || isFinalizingRecording) return;
    scoreRepairAttempted = false;
    return restartScoreLoading();
}

bindButtonActivation(retryScoreBtn, retryScoreLoad, { touchEnabled: shouldUseVerticalTabLayout });

function initAlphaTabIfNeeded() {
    if (!api && window.alphaTab) {
        const container = document.getElementById("alphaTab");
        if (!container || container.clientWidth === 0) return false;

        try {
            const apiInstance = new alphaTab.AlphaTabApi(container, {
                core: { 
                    engine: "svg",
                    enableLazyLoading: false
                },
                display: { 
                    layoutMode: "horizontal", 
                    staveProfile: "Tab", 
                    scale: 1.0
                },
                notation: {
                    rhythm: {
                        visible: true // ★ リズム符尾・休符記号を確実に表示
                    },
                    elements: {
                        trackNames: false,
                        guitarTuning: false,
                        scoreTitle: false,
                        scoreSubTitle: false,
                        chordDiagrams: false,
                        barNumber: true,
                        // 自前で美しい上向きスラー＆記号を描画するため、デフォルトの重なりテキストは無効化
                        [alphaTab.NotationElement?.EffectHammerOnPullOffText || 'EffectHammerOnPullOffText']: false,
                        'EffectHammerOnPullOffText': false,
                        'effectHammerOnPullOffText': false
                    }
                },
                player: {
                    enablePlayer: false // Web Audio APIスケジューラを使用するため無効化
                }
            });
            api = apiInstance;
            const generation = scoreRenderGeneration;
            const stage = currentStage;
            const isCurrentApi = () => api === apiInstance && generation === scoreRenderGeneration
                && stage === currentStage && !practiceModal.classList.contains("hidden");

            apiInstance.scoreLoaded.on((score) => {
                if (!isCurrentApi()) return;
                if (!score?.masterBars?.length) {
                    failScoreLoad(new Error("小節情報がありません"), generation);
                    return;
                }
                if (scoreRenderInProgress) scoreLoadConfirmed = true;
                if (score && score.masterBars && score.masterBars.length > 0) {
                    const bars = score.masterBars.length;
                    if (modalBarsBadge) modalBarsBadge.innerText = `${bars}小節`;
                }
            });

            // renderFinished直後はDOM配置が未完了の場合があるため、後処理完了を待つ。
            apiInstance.postRenderFinished.on(() => {
                if (!isCurrentApi() || (scoreLoadState === "loading" && !scoreLoadConfirmed)) return;
                try {
                    resetScoreFocusState();

                    // 1. スラー＆H/P/S/C文字のSVG描画
                    handleWatermark();
                    renderSlursAndLabelsInSvg();

                    const bars = apiInstance.score?.masterBars?.length;
                    if (!bars || !isAlphaTabDisplayHealthy(container) || !buildScoreBarLayouts(apiInstance, bars)) {
                        throw new Error("譜面の描画・小節配置が未確定です");
                    }
                    // 2. 完成した本物SVGから縦型TABカードを一括生成
                    const mainSvg = container.querySelector("svg");
                    if (mainSvg && verticalTabController) {
                        verticalTabController.createCardsFromRenderedSvg(
                            mainSvg,
                            apiInstance.boundsLookup || apiInstance.renderer?.boundsLookup,
                            bars
                        );
                        if (!verticalTabController.hasCards || verticalTabController.barCount !== bars) {
                            throw new Error("縦型TABの準備が完了していません");
                        }
                    }
                    if (shouldUseVerticalTabLayout() && stage.file && !verticalTabController?.hasCards) {
                        throw new Error("縦型TABがありません");
                    }
                    scoreRenderInProgress = false;
                    scoreLoadPending = false;
                    scoreLoadConfirmed = false;
                    activeScoreRenderGeneration = 0;
                    isScoreRendered = true;
                    preparedScore = { generation, stage, api: apiInstance, bars };
                    setScoreLoadState("ready");
                    // 新しい座標・TABの準備後、継続中の演奏時刻から位置を復元する。
                    resumePracticeScroll({ restoreImmediately: true });
                    scheduleAlphaTabHealthCheck();
                } catch (error) {
                    failScoreLoad(error, generation);
                }
            });

            apiInstance.error.on((error) => {
                if (!isCurrentApi()) return;
                failScoreLoad(error, generation);
            });

            return true;
        } catch (e) {
            console.warn("alphaTab初期化エラー:", e);
            return false;
        }
    }
    return !!api;
}

function getStagePracticeBars(stage) {
    if (api && api.score && api.score.masterBars && api.score.masterBars.length > 0) {
        return api.score.masterBars.length;
    }
    if (stage.practiceBars && stage.practiceBars > 0) {
        return stage.practiceBars;
    }
    return 1;
}

// ==========================================
// ★ 楽譜レンダリング（MXL解凍・MusicXML補正統合版） ★
// ==========================================
async function renderTab(stage = currentStage) {
    if (!stage || stage !== currentStage || practiceModal.classList.contains("hidden")) return;
    if (scoreRenderInProgress) {
        scoreHealthCheckPending = true;
        return;
    }

    const scoreWrapper = document.querySelector(".score-wrapper");
    const prevErr = scoreWrapper?.querySelector(".score-error-msg");
    if (prevErr) prevErr.remove();

    const renderGeneration = ++scoreRenderGeneration;
    setScoreLoadState("loading");
    if (api) destroyAlphaTabApi();
    if (!initAlphaTabIfNeeded()) {
        failScoreLoad(new Error("譜面表示を初期化できませんでした"), renderGeneration);
        return;
    }
    const renderApi = api;
    const isCurrentRender = () => api === renderApi
        && scoreRenderGeneration === renderGeneration
        && currentStage === stage
        && !practiceModal.classList.contains("hidden");
    activeScoreRenderGeneration = renderGeneration;
    scoreRenderStartedAt = performance.now();
    scoreRenderInProgress = true;
    scoreLoadPending = Boolean(stage.file);
    scoreLoadConfirmed = false;
    isScoreRendered = false;
    scheduleAlphaTabHealthCheck();

    if (stage.file) {
        try {
            const fileName = stage.file.toLowerCase();
            let xmlText = null;

            // .mxl または .xml の場合、フェッチして MusicXML 補正 & スラー解析を実行
            if (fileName.endsWith('.mxl') || fileName.endsWith('.xml') || fileName.endsWith('.musicxml')) {
                const res = await fetch(stage.file);
                if (!res.ok) throw new Error(`譜面取得エラー: ${res.status}`);
                if (res.ok) {
                    if (fileName.endsWith('.mxl') && window.JSZip) {
                        const arrayBuffer = await res.arrayBuffer();
                        const zip = await JSZip.loadAsync(arrayBuffer);
                        let targetEntry = null;
                        for (const path of Object.keys(zip.files)) {
                            if (path.endsWith('.xml') && !path.startsWith('META-INF/')) {
                                targetEntry = zip.files[path];
                                break;
                            }
                        }
                        if (targetEntry) {
                            xmlText = await targetEntry.async('text');
                        }
                    } else {
                        xmlText = await res.text();
                    }
                }
            }

            if (!isCurrentRender()) return;
            if (xmlText) {
                const fixedXml = fixMuseScoreXml(xmlText);
                const binaryData = new TextEncoder().encode(fixedXml);
                const loadStarted = renderApi.load(binaryData);
                if (!loadStarted && activeScoreRenderGeneration === renderGeneration) {
                    failScoreLoad(new Error("譜面の読み込みを開始できませんでした"), renderGeneration);
                }
                return;
            }

            // フォールバック: 通常のパス指定ロード
            const loadStarted = renderApi.load(stage.file);
            if (!loadStarted && activeScoreRenderGeneration === renderGeneration) {
                failScoreLoad(new Error("譜面の読み込みを開始できませんでした"), renderGeneration);
            }
            return;
        } catch (e) {
            if (!isCurrentRender()) return;
            failScoreLoad(e, renderGeneration);
            return;
        }
    }

    if (stage.tex) {
        try {
            detectedSlurPairs = [];
            renderApi.tex(stage.tex);
        } catch (e) {
            failScoreLoad(e, renderGeneration);
        }
    } else if (activeScoreRenderGeneration === renderGeneration) {
        failScoreLoad(new Error("譜面データがありません"), renderGeneration);
    }
}

// ==========================================
// ★ 練習カードの動的生成 ★
// ==========================================
function initTutorialCompletion() {
    try {
        const saved = JSON.parse(localStorage.getItem(TUTORIAL_COMPLETION_STORAGE_KEY) || "[]");
        completedTutorialStages = new Set(Array.isArray(saved)
            ? saved.filter(key => typeof key === "string" && /^tutorial-[1-9]\d*$/.test(key)) : []);
    } catch (err) {
        // 保存領域や保存値が使えない場合も、未完了の状態で起動を続ける。
        completedTutorialStages = new Set();
    }
}

function updateTutorialCompletionDisplay() {
    for (const stage of TUTORIAL_STAGES) {
        const badge = document.getElementById(`tutorial-${stage.id}-completion`);
        if (badge) badge.hidden = !completedTutorialStages.has(`tutorial-${stage.id}`);
    }
    const allCompleted = TUTORIAL_STAGES.length > 0
        && TUTORIAL_STAGES.every(stage => completedTutorialStages.has(`tutorial-${stage.id}`));
    const status = document.getElementById("tutorialCompletionStatus");
    if (status) status.hidden = !allCompleted;
    const categoryStatus = document.getElementById("tutorialCategoryStatus");
    if (categoryStatus) categoryStatus.innerText = allCompleted ? "✓ 完了" : "未完了";
}

function markTutorialCompleted(stage, mode) {
    if (!TUTORIAL_STAGES.includes(stage)) return;
    const requiredMode = stage.id === 3 ? "record" : (stage.id === 1 || stage.id === 2) ? "practice" : null;
    if (!requiredMode || mode !== requiredMode) return;
    const key = `tutorial-${stage.id}`;
    if (completedTutorialStages.has(key)) return;
    completedTutorialStages.add(key);
    try {
        localStorage.setItem(TUTORIAL_COMPLETION_STORAGE_KEY, JSON.stringify([...completedTutorialStages]));
    } catch (err) {
        // 保存できなくても、このセッション中の完了状態は保持する。
    }
    updateTutorialCompletionDisplay();
}

function renderExerciseCards() {
    renderStageCards(tutorialExerciseGrid, TUTORIAL_STAGES, "tutorial");
    renderStageCards(exerciseGrid, BASIC_STAGES, "basic");
    updateTutorialCompletionDisplay();
}

function renderStageCards(grid, stages, category) {
    if (!grid) return;

    grid.innerHTML = stages.map(stage => {
        const barsLabel = stage.practiceBars ? `${stage.practiceBars}小節` : "";
        return `
            <div class="exercise-card ${stage.available ? 'exercise-card-available' : 'exercise-card-locked'}"
                 data-stage-id="${stage.id}"
                 id="${category}-${stage.id}"
                 data-stage-category="${category}"
                 tabindex="${stage.available ? '0' : '-1'}">
                <div class="ex-card-content">
                    <div class="ex-badge-row">
                        <span class="ex-badge ${stage.available ? '' : 'badge-muted'}">${stage.code}</span>
                        ${category === "tutorial" ? `<span id="tutorial-${stage.id}-completion" class="tutorial-completion-badge" ${completedTutorialStages.has(`tutorial-${stage.id}`) ? '' : 'hidden'}>✓ 完了</span>` : ''}
                        ${stage.bpm ? `<span class="bpm-badge">BPM ${stage.bpm}</span>` : ''}
                        ${barsLabel ? `<span class="bars-badge">${barsLabel}</span>` : ''}
                        <span class="badge-tag ${stage.available ? '' : 'badge-tag-muted'}">${stage.subTitle || ''}</span>
                        ${!stage.available ? '<span class="badge-coming">近日追加予定</span>' : ''}
                    </div>
                    <h3 class="ex-title">${stage.title}</h3>
                    <p class="ex-desc">${stage.desc || ''}</p>
                </div>
                <div class="ex-card-action">
                    ${stage.available 
                        ? '<button class="ex-start-btn">▶ 練習する</button>' 
                        : '<span class="locked-label">準備中</span>'}
                </div>
            </div>
        `;
    }).join("");

    grid.querySelectorAll(".exercise-card-available").forEach(card => {
        const stageId = Number(card.dataset.stageId);
        const stage = stages.find(s => s.id === stageId);
        if (!stage) return;

        card.addEventListener("click", () => openPracticeModal(stage));
        card.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openPracticeModal(stage);
            }
        });
    });
}

// ==========================================
// ★ 練習ポップアップモーダルの制御 ★
// ==========================================
function openPracticeModal(stage) {
    if (!practiceModal.classList.contains("hidden")) closePracticeModal();
    currentStage = stage;
    currentBpm = stage.bpm || 60;
    currentPracticeBarIndex = 0;
    detectedSlurPairs = [];

    isScoreRendered = false;
    scoreRenderInProgress = false;
    scoreLoadPending = false;
    scoreLoadConfirmed = false;
    scoreHealthCheckPending = false;
    scoreRepairAttempted = false;
    activeScoreRenderGeneration = 0;
    const openGeneration = ++scoreRenderGeneration;
    setScoreLoadState("loading");

    unlockAudioContext().catch(() => {});

    const scoreWrapper = document.querySelector(".score-wrapper");
    if (scoreWrapper) scoreWrapper.scrollLeft = 0;
    const modalContent = document.querySelector(".practice-modal-content");
    if (modalContent) modalContent.scrollTop = 0;

    stopStandaloneMetronome();
    collapseVolumeBar();
    resetScoreFocusState();

    const practiceBars = getStagePracticeBars(stage);

    if (modalStageBadge) modalStageBadge.innerText = stage.stageBadge || "基礎編";
    if (modalBpmBadge) modalBpmBadge.innerText = `BPM ${currentBpm}`;
    if (modalBarsBadge) modalBarsBadge.innerText = `${practiceBars}小節`;
    if (modalStageTitle) modalStageTitle.innerText = stage.title;
    if (modalStageDesc) modalStageDesc.innerText = stage.desc || "";

    if (stageGuideTitle && stageGuideBody) {
        if (stage.guide) {
            stageGuideTitle.innerText = stage.guide.title;
            let guideHtml = `<p>${stage.guide.content}</p>`;
            if (stage.guide.points && stage.guide.points.length > 0) {
                guideHtml += `
                    <div class="knowledge-item" style="margin-top: 10px;">
                        <h4>🎯 意識するポイント</h4>
                        <ul class="faq-list">
                             ${stage.guide.points.map(pt => `<li>${pt}</li>`).join("")}
                        </ul>
                    </div>
                `;
            }
            stageGuideBody.innerHTML = guideHtml;
        } else {
            stageGuideTitle.innerText = "💡 練習のポイント";
            stageGuideBody.innerHTML = "<p>メトロノームのリズムに合わせて正確にピッキングしてみましょう！</p>";
        }
    }

    if (recordResultCard) recordResultCard.classList.add("hidden");
    resetVisualMetronome();
    showPracticeStatus("");
    updatePracticeControls();

    practiceModal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    updatePracticeScoreLayout();
    practiceModalWasLandscape = isPracticeModalLandscape();
    if (practiceModalWasLandscape) requestPracticeModalInitialPosition();

    if (modalOpenTimerId) {
        clearTimeout(modalOpenTimerId);
        modalOpenTimerId = null;
    }
    if (scoreResizeObserver) {
        scoreResizeObserver.disconnect();
    }

    const targetContainer = document.getElementById("alphaTab");
    if (targetContainer) {
        scoreResizeObserver = new ResizeObserver((entries) => {
            if (currentStage !== stage || scoreRenderGeneration !== openGeneration
                || practiceModal.classList.contains("hidden")) return;
            for (let entry of entries) {
                if (entry.contentRect.width > 0 && !isScoreRendered) {
                    scoreResizeObserver.disconnect();
                    scoreResizeObserver = null;
                    renderTab(stage);
                    break;
                }
            }
        });
        scoreResizeObserver.observe(targetContainer);
    } else failScoreLoad(new Error("譜面表示領域がありません"));
}

function isPracticeModalLandscape() {
    return window.matchMedia
        ? window.matchMedia("(orientation: landscape)").matches
        : window.innerWidth > window.innerHeight;
}

function shouldUseVerticalTabLayout() {
    return !isPracticeModalLandscape()
        && Boolean(window.matchMedia?.("(max-width: 600px)")?.matches);
}

function updatePracticeScoreLayout() {
    if (!practiceModal || practiceModal.classList.contains("hidden")) return;

    const useVertical = Boolean(currentStage?.file && verticalTabWrapper && shouldUseVerticalTabLayout());
    practiceModal.classList.toggle("vertical-tab-active", useVertical);
    if (verticalTabWrapper) verticalTabWrapper.hidden = !useVertical;

    if (!useVertical) return;
    if (!verticalTabController) {
        verticalTabController = new VerticalTabController(verticalTabWrapper, {
            onError: (...details) => console.error("[縦型TAB]", ...details),
            onBarChange: (index) => { currentPracticeBarIndex = index; },
        });
        verticalTabController.updateControls();
        if (scoreLoadState === "error") verticalTabController.setMessage("譜面を読み込めませんでした");
    }

    // 既にSVGが描画されていれば、カードを抽出生成
    const container = document.getElementById("alphaTab");
    const mainSvg = container?.querySelector("svg");
    if (mainSvg && isScoreReadyForPractice() && (!verticalTabController.hasCards)) {
        try {
            verticalTabController.createCardsFromRenderedSvg(
                mainSvg,
                api.boundsLookup || api.renderer?.boundsLookup,
                getStagePracticeBars(currentStage)
            );
            if (!verticalTabController.hasCards || verticalTabController.barCount !== preparedScore.bars) {
                throw new Error("縦型TABの準備が完了していません");
            }
        } catch (error) {
            failScoreLoad(error);
        }
    }
    verticalTabController.setCurrentBar(currentPracticeBarIndex, "layout-update");
}

function setPracticeBar(index, source = "practice") {
    const maxIndex = Math.max(0, getStagePracticeBars(currentStage) - 1);
    currentPracticeBarIndex = Math.max(0, Math.min(maxIndex, Math.trunc(index)));
    verticalTabController?.setCurrentBar(currentPracticeBarIndex, source);
}

function resetPracticeBar() {
    currentPracticeBarIndex = 0;
    verticalTabController?.resetToFirstBar();
}

function getPracticeModalViewportHeight() {
    return window.visualViewport?.height || window.innerHeight;
}

function updatePracticeModalAvailableHeight() {
    if (!practiceModal || practiceModal.classList.contains("hidden")) return;
    const modalContent = practiceModal.querySelector(".practice-modal-content");
    if (!modalContent) return;
    modalContent.style.setProperty(
        "--practice-modal-max-height",
        `${Math.max(0, getPracticeModalViewportHeight() - 20)}px`
    );
}

function resetPracticeModalAvailableHeight() {
    const modalContent = practiceModal?.querySelector(".practice-modal-content");
    if (modalContent) modalContent.style.removeProperty("--practice-modal-max-height");
}

function adjustPracticeModalInitialPosition() {
    if (!practiceModal || practiceModal.classList.contains("hidden")) return;

    const modalContent = practiceModal.querySelector(".practice-modal-content");
    if (!modalContent) return;

    if (!isPracticeModalLandscape()) return;

    updatePracticeModalAvailableHeight();

    if (modalContent.scrollHeight <= modalContent.clientHeight) return;

    const score = modalContent.querySelector(".score-wrapper");
    if (!score) return;

    const contentRect = modalContent.getBoundingClientRect();
    const scoreRect = score.getBoundingClientRect();
    const scoreTop = modalContent.scrollTop + scoreRect.top - contentRect.top - modalContent.clientTop;
    const target = scoreTop - (modalContent.clientHeight - scoreRect.height) / 2;
    const maxScroll = modalContent.scrollHeight - modalContent.clientHeight;
    modalContent.scrollTop = Math.max(0, Math.min(maxScroll, target));
}

function requestPracticeModalInitialPosition() {
    if (practiceModalPositionFrame !== null) cancelAnimationFrame(practiceModalPositionFrame);
    practiceModalPositionFrame = requestAnimationFrame(() => {
        practiceModalPositionFrame = requestAnimationFrame(() => {
            practiceModalPositionFrame = null;
            adjustPracticeModalInitialPosition();
        });
    });
}

function isAlphaTabDisplayHealthy(container) {
    if (!container || container.clientWidth <= 0) return false;

    return Array.from(container.querySelectorAll("svg")).some((svg) => {
        const rect = svg.getBoundingClientRect();
        const style = window.getComputedStyle(svg);
        const hasNotation = svg.querySelector("path, text, line, polyline, polygon, rect, circle, use");
        return svg.isConnected
            && rect.width > 0
            && rect.height > 0
            && svg.childElementCount > 0
            && hasNotation
            && style.display !== "none"
            && style.visibility !== "hidden"
            && style.opacity !== "0";
    });
}

function scheduleAlphaTabHealthCheck() {
    if (!practiceModal || practiceModal.classList.contains("hidden") || scoreLoadState === "error") return;
    scoreHealthCheckPending = true;
    if (alphaTabHealthCheckTimerId !== null) clearTimeout(alphaTabHealthCheckTimerId);

    alphaTabHealthCheckTimerId = setTimeout(() => {
        alphaTabHealthCheckTimerId = null;
        if (!practiceModal || practiceModal.classList.contains("hidden")) {
            scoreHealthCheckPending = false;
            return;
        }
        const container = document.getElementById("alphaTab");
        if (!container || container.clientWidth <= 0) {
            scheduleAlphaTabHealthCheck();
            return;
        }
        if (scoreRenderInProgress && performance.now() - scoreRenderStartedAt < 8000) {
            scheduleAlphaTabHealthCheck();
            return;
        }

        scoreHealthCheckPending = false;
        if (!scoreRenderInProgress && isAlphaTabDisplayHealthy(container)) {
            scoreRepairAttempted = false;
            updatePracticeScoreLayout();
            return;
        }

        if (scoreRepairAttempted) {
            failScoreLoad(new Error("譜面の描画が完了しませんでした"));
            return;
        }
        scoreRepairAttempted = true;
        restartScoreLoading();
    }, 300);
}

function handlePracticeModalOrientationChange() {
    if (!practiceModal || practiceModal.classList.contains("hidden")) return;

    updatePracticeScoreLayout();
    scheduleAlphaTabHealthCheck();
    const isLandscape = isPracticeModalLandscape();
    if (isLandscape === practiceModalWasLandscape) return;

    practiceModalWasLandscape = isLandscape;
    if (isLandscape) {
        updatePracticeModalAvailableHeight();
        requestPracticeModalInitialPosition();
    } else {
        resetPracticeModalAvailableHeight();
    }
}

window.addEventListener("orientationchange", handlePracticeModalOrientationChange);
window.addEventListener("resize", handlePracticeModalOrientationChange);

if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", updatePracticeModalAvailableHeight);
}

function closePracticeModal() {
    stopTuner();

    stopPractice();
    
    stopTuner(); 

    if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
        recordedAudioUrl = null;
    }
    
    if (scoreResizeObserver) {
        scoreResizeObserver.disconnect();
        scoreResizeObserver = null;
    }

    if (alphaTabHealthCheckTimerId !== null) {
        clearTimeout(alphaTabHealthCheckTimerId);
        alphaTabHealthCheckTimerId = null;
    }
    scoreHealthCheckPending = false;
    scoreRenderInProgress = false;
    scoreLoadPending = false;
    scoreLoadConfirmed = false;
    activeScoreRenderGeneration = 0;
    scoreRenderGeneration++;
    setScoreLoadState("idle");

    if (modalOpenTimerId) {
        clearTimeout(modalOpenTimerId);
        modalOpenTimerId = null;
    }

    if (recordedAudioPlayer) {
        recordedAudioPlayer.pause();
        recordedAudioPlayer.currentTime = 0;
        recordedAudioPlayer.src = "";
    }
    
    stopStandaloneMetronome();
    collapseVolumeBar();
    stopScoreContinuousScroll();
    resetScoreFocusState();

    if (microphoneStream) {
        microphoneStream.getTracks().forEach(t => t.stop());
        microphoneStream = null;
    }
    stopMicrophoneStream();

    destroyAlphaTabApi();

    verticalTabController?.destroy();
    verticalTabController = null;
    currentPracticeBarIndex = 0;
    practiceModal.classList.remove("vertical-tab-active");
    if (verticalTabWrapper) verticalTabWrapper.hidden = true;

    practiceModal.classList.add("hidden");
    document.body.style.overflow = "";
    const modalContent = practiceModal.querySelector(".practice-modal-content");
    if (modalContent) modalContent.style.removeProperty("--practice-modal-max-height");
    if (practiceModalPositionFrame !== null) {
        cancelAnimationFrame(practiceModalPositionFrame);
        practiceModalPositionFrame = null;
    }
}

bindButtonActivation(closePracticeModalBtn, closePracticeModal, {
    touchEnabled: shouldUseVerticalTabLayout
});
if (practiceModal) {
    practiceModal.addEventListener("click", (e) => {
        if (e.target === practiceModal) closePracticeModal();
    });
}
window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        if (!practiceModal.classList.contains("hidden")) closePracticeModal();
        if (!infoModal.classList.contains("hidden")) infoModal.classList.add("hidden");
    }
});

// ==========================================
// ★ 練習 & 録音 シーケンス制御（完全同期タイマー） ★
// ==========================================
function showPracticeStatus(text, isError = false) {
    if (!practiceStatus) return;
    practiceStatus.innerText = text;
    practiceStatus.hidden = !text;
    practiceStatus.classList.toggle("is-error", isError);
}

function updatePracticeControls() {
    const mode = practiceSession?.mode || pendingPracticeMode;
    const busy = isPracticing || isStartingPractice || isFinalizingRecording;
    for (const [button, buttonMode, label] of [
        [mainActionBtn, "practice", "▶ 練習"],
        [recordPracticeBtn, "record", "● 録音練習"]
    ]) {
        if (!button) continue;
        button.classList.toggle("btn-stop", isPracticing && mode === buttonMode);
        button.disabled = isStartingPractice || isFinalizingRecording
            || (isPracticing && mode !== buttonMode)
            || (!isPracticing && !isScoreReadyForPractice());
        if (isPracticing && mode === buttonMode) button.innerText = "⏹ 練習を終了";
        else if (isStartingPractice && mode === buttonMode) button.innerText = "準備中…";
        else if (isFinalizingRecording && buttonMode === "record") button.innerText = "録音を処理中…";
        else if (buttonMode === "record" && !recordResultCard.classList.contains("hidden")) {
            button.innerText = "▶ もう一度録音練習";
        } else button.innerText = label;
    }
    if (practiceRepeatSelect) {
        practiceRepeatSelect.disabled = busy || !isScoreReadyForPractice();
        practiceRepeatSelect.hidden = busy;
    }
    if (standaloneMetroBtn) standaloneMetroBtn.disabled = busy;
    if (retryScoreBtn) retryScoreBtn.disabled = busy;
}

function clearRecordingResult() {
    if (recordedAudioPlayer) {
        recordedAudioPlayer.pause();
        recordedAudioPlayer.removeAttribute("src");
        recordedAudioPlayer.load();
    }
    if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
    recordedAudioUrl = null;
    recordResultCard?.classList.add("hidden");
}

function releasePracticeMicrophone() {
    if (microphoneStream) {
        microphoneStream.getTracks().forEach(track => track.stop());
        microphoneStream = null;
    }
    stopMicrophoneStream();
}

async function startPractice(mode = "practice") {
    if (isPracticing || isStartingPractice || isFinalizingRecording
        || practiceModal.classList.contains("hidden") || !isScoreReadyForPractice()) return;
    const startScore = preparedScore;
    const startGeneration = ++practiceStartGeneration;
    const isCurrentStart = () => startGeneration === practiceStartGeneration
        && !practiceModal.classList.contains("hidden")
        && isScoreReadyForPractice() && preparedScore.generation === startScore.generation;
    const repeatValue = practiceRepeatSelect?.value;
    const repeatCount = mode === "record" ? 1
        : repeatValue === "unlimited" ? Infinity
        : ["1", "3", "5"].includes(repeatValue) ? Number(repeatValue) : 1;

    resetPracticeBar();
    isStartingPractice = true;
    pendingPracticeMode = mode;
    stopTuner();
    stopStandaloneMetronome();
    discardRecordingSession();
    clearRecordingResult();
    showPracticeStatus("");
    updatePracticeControls();
    collapseVolumeBar();

    try {
        await unlockAudioContext();
        if (!isCurrentStart()) return;
        await requestWakeLock();
        if (!isCurrentStart()) return;

        const scoreWrapper = document.querySelector(".score-wrapper");
        if (scoreWrapper) scoreWrapper.scrollLeft = 0;
        resetScoreFocusState();

        // マイク取得・Recorder準備は録音練習のみ。
        if (mode === "record") {
            if (!microphoneStream || microphoneStream.getTracks().every(t => t.readyState === "ended")) {
                const requestedStream = await navigator.mediaDevices.getUserMedia({
                    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
                });
                if (!isCurrentStart()) {
                    requestedStream.getTracks().forEach(track => track.stop());
                    return;
                }
                microphoneStream = requestedStream;
            }
            await setupMicrophoneStream(microphoneStream);
            if (!isCurrentStart()) return;
            setupMediaRecorder(microphoneStream, startGeneration);
        }

        const beatSec = 60 / currentBpm;
        const beatsPerBar = (currentStage.timeSignature && currentStage.timeSignature[0]) || 4;
        const countInBars = currentStage.countInBars || 1;
        const countInBeats = countInBars * beatsPerBar;
        const practiceBars = startScore.bars;
        const practiceBeats = practiceBars * beatsPerBar;
        const totalBeats = countInBeats + practiceBeats * repeatCount;
        // 録音練習の余韻と停止タイミングは従来どおり。
        const ringOutBeats = mode === "record" ? Math.min(4, beatsPerBar) : 0;
        const totalSteps = totalBeats + ringOutBeats;
        const startTime = audioContext.currentTime + 0.3;
        practiceSession = {
            generation: startGeneration, stage: startScore.stage, mode, repeatCount, beatSec, beatsPerBar,
            countInBars, countInBeats, practiceBars, practiceBeats, totalBeats, totalSteps,
            startTime, finishTime: startTime + totalSteps * beatSec + (mode === "record" ? 0.1 : 0),
            nextBeat: 0, lastStep: -1, scrollStarted: false
        };
        buildScoreBarLayouts(api, practiceBars);
        isPracticing = true;
        isStartingPractice = false;
        pendingPracticeMode = null;
        updatePracticeControls();
        runPracticeScheduler(practiceSession);
    } catch (err) {
        if (!isCurrentStart()) return;
        failPractice(mode === "record"
            ? "録音練習を開始できませんでした。マイクの許可・録音対応を確認して、もう一度お試しください。"
            : "音声を初期化できませんでした。もう一度お試しください。", err);
    }
}

// 周回をまたいでも同じ時刻原点と、1本の先読みタイマーを使う。
function runPracticeScheduler(session) {
    if (practiceSession !== session || !isPracticing
        || session.generation !== practiceStartGeneration) return;
    practiceTimerIds = [];
    try {
        const now = audioContext.currentTime;
        const elapsed = now - session.startTime;
        const step = Math.floor((elapsed + 1e-8) / session.beatSec);
        const lookAheadSec = Math.max(1, session.beatSec * session.beatsPerBar);
        // 遅れて起床したとき、過去のクリックをまとめて鳴らさない。
        if (session.startTime + session.nextBeat * session.beatSec < now - 0.05) {
            session.nextBeat = Math.max(session.nextBeat, Math.ceil(elapsed / session.beatSec));
        }
        while (session.nextBeat < session.totalBeats
            && session.startTime + session.nextBeat * session.beatSec < now + lookAheadSec) {
            scheduleTick(session.startTime + session.nextBeat * session.beatSec,
                session.nextBeat % session.beatsPerBar === 0);
            session.nextBeat++;
        }

        if (session.mode === "record" && step >= session.countInBeats
            && recordingSession?.status === "ready") {
            if (step >= session.totalBeats) throw new Error("録音開始前に演奏時間を過ぎました");
            startRecording(recordingSession);
            if (practiceSession !== session) return;
            visualMetronomeBox.classList.add("recording");
        }
        if (step >= 0 && step !== session.lastStep) {
            session.lastStep = step;
            handleBeatStep(step, session);
        }
        if (practiceSession !== session) return;
        if (session.mode === "record" && step >= session.totalSteps - 1) {
            stopRecording();
            visualMetronomeBox.classList.remove("recording");
        }
        if (practiceSession !== session) return;
        if (now + 1e-8 >= session.finishTime) {
            finishPractice();
            return;
        }
        practiceTimerIds.push(setTimeout(() => runPracticeScheduler(session), 25));
    } catch (err) {
        failPractice(session.mode === "record"
            ? "録音に失敗しました。もう一度録音練習をお試しください。"
            : "練習を続けられませんでした。もう一度お試しください。", err);
    }
}

function resumePracticeScroll({ restoreImmediately = false } = {}) {
    const session = practiceSession;
    if (!session || !isPracticing || session.generation !== practiceStartGeneration
        || practiceModal.classList.contains("hidden") || !isScoreReadyForPractice()) return;
    const performanceStart = session.startTime + session.countInBeats * session.beatSec;
    const now = audioContext.currentTime;
    if (now < performanceStart || now >= session.finishTime) return;
    if (restoreImmediately) {
        const beats = (now - performanceStart) / session.beatSec;
        const barIndex = beats >= session.practiceBeats * session.repeatCount
            ? session.practiceBars - 1
            : Math.floor((beats % session.practiceBeats) / session.beatsPerBar);
        setPracticeBar(barIndex, "render-restore");
    }
    const scrollApi = api;
    session.scrollStarted = true;
    startScoreContinuousScroll({
        api, totalBars: session.practiceBars, beatsPerBar: session.beatsPerBar,
        beatSec: session.beatSec, repeatCount: session.repeatCount,
        getElapsedSeconds: () => audioContext.currentTime - performanceStart,
        restoreImmediately,
        isActive: () => practiceSession === session && isPracticing
            && session.generation === practiceStartGeneration && api === scrollApi
            && !practiceModal.classList.contains("hidden") && isScoreReadyForPractice()
    });
}

function handleBeatStep(step, session) {
    const { beatsPerBar, countInBars, countInBeats, practiceBars, practiceBeats, totalBeats } = session;
    const beatInBar = step % beatsPerBar + 1;
    if (step < countInBeats) {
        const currentCountInBar = Math.floor(step / beatsPerBar) + 1;
        updateVisualMetronome(beatInBar, beatInBar === 1,
            countInBars > 1 ? "COUNT IN (" + currentCountInBar + "/" + countInBars + ")" : "COUNT IN",
            "count-in");
        updateHighlightBar(-1);
    } else if (step < totalBeats) {
        const noteIndex = step - countInBeats;
        const barIndex = Math.floor((noteIndex % practiceBeats) / beatsPerBar);
        const lap = Math.floor(noteIndex / practiceBeats) + 1;
        setPracticeBar(barIndex, "practice");
        if (session.mode === "record") {
            updateVisualMetronome(beatInBar, beatInBar === 1,
                practiceBars > 1 ? "REC " + (barIndex + 1) + "/" + practiceBars : "REC", "rec");
        } else {
            const lapText = "練習 " + lap + "/" + (session.repeatCount === Infinity ? "∞" : session.repeatCount);
            updateVisualMetronome(beatInBar, beatInBar === 1, lapText, "practice");
        }
        if (!session.scrollStarted) resumePracticeScroll();
    } else if (session.mode === "record") {
        setPlayFinishedVisual("演奏終了");
    }
}

function stopPractice() {
    practiceStartGeneration++;
    isPracticing = false;
    isStartingPractice = false;
    isFinalizingRecording = false;
    practiceSession = null;
    pendingPracticeMode = null;
    practiceTimerIds.forEach(id => clearTimeout(id));
    practiceTimerIds = [];
    stopAllScheduledTicks();
    discardRecordingSession();
    releasePracticeMicrophone();
    releaseWakeLock();
    resetVisualMetronome();
    visualMetronomeBox.classList.remove("recording");
    stopScoreContinuousScroll();
    resetScoreFocusState();
    resetPracticeBar();
    const wrapper = document.querySelector(".score-wrapper");
    if (wrapper) wrapper.scrollLeft = 0;
    showPracticeStatus("");
    updatePracticeControls();
}

function finishPractice() {
    const session = practiceSession;
    if (!session) return;
    const recording = session.mode === "record" ? recordingSession : null;
    if (recording) recording.timelineFinished = true;
    isPracticing = false;
    isStartingPractice = false;
    practiceSession = null;
    isFinalizingRecording = session.mode === "record";
    practiceTimerIds.forEach(id => clearTimeout(id));
    practiceTimerIds = [];
    stopAllScheduledTicks();
    releaseWakeLock();
    resetVisualMetronome();
    visualMetronomeBox.classList.remove("recording");
    stopScoreContinuousScroll();
    resetScoreFocusState();

    if (recording) {
        stopRecording();
        publishRecordingResult(recording);
    } else {
        showPracticeStatus("");
        if (session.mode === "practice") markTutorialCompleted(session.stage, "practice");
    }
    updatePracticeControls();
}

function handlePracticeAction(mode) {
    if (isStartingPractice || isFinalizingRecording) return;
    if (isPracticing) {
        if (practiceSession?.mode === mode) stopPractice();
        return;
    }
    // 従来の聴き返し後の操作を維持：まず結果カードを閉じて譜面へ戻す。
    if (mode === "record" && !recordResultCard.classList.contains("hidden")) {
        clearRecordingResult();
        discardRecordingSession();
        if (isPracticeModalLandscape()) requestPracticeModalInitialPosition();
        else practiceModal.querySelector(".practice-modal-content")?.scrollTo({ top: 0, behavior: "smooth" });
        updatePracticeControls();
        return;
    }
    startPractice(mode);
}

bindButtonActivation(mainActionBtn, () => handlePracticeAction("practice"),
    { touchEnabled: shouldUseVerticalTabLayout });
bindButtonActivation(recordPracticeBtn, () => handlePracticeAction("record"),
    { touchEnabled: shouldUseVerticalTabLayout });

function isCurrentRecording(session) {
    return recordingSession === session && session.id === recordingGeneration
        && session.generation === practiceStartGeneration
        && !practiceModal.classList.contains("hidden");
}

function setupMediaRecorder(stream, generation) {
    discardRecordingSession();
    if (!window.MediaRecorder || !stream) throw new Error("MediaRecorderを利用できません");
    let mimeType = "";
    if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) mimeType = "audio/webm;codecs=opus";
    else if (MediaRecorder.isTypeSupported("audio/webm")) mimeType = "audio/webm";
    else if (MediaRecorder.isTypeSupported("audio/mp4")) mimeType = "audio/mp4";
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    const session = {
        id: ++recordingGeneration, generation, stage: currentStage, recorder, chunks: [], status: "ready",
        blob: null, timelineFinished: false, stopTimerId: null
    };
    recordingSession = session;
    recorder.ondataavailable = event => {
        if (isCurrentRecording(session) && event.data?.size > 0) session.chunks.push(event.data);
    };
    recorder.onstop = () => {
        if (!isCurrentRecording(session)) return;
        clearTimeout(session.stopTimerId);
        session.stopTimerId = null;
        try {
            if (session.status !== "stopping") throw new Error("録音が予定より前に停止しました");
            const blob = new Blob(session.chunks, { type: recorder.mimeType || "audio/webm" });
            if (!blob.size) throw new Error("録音データが生成されませんでした");
            session.blob = blob;
            session.chunks = [];
            session.status = "complete";
            releasePracticeMicrophone();
            publishRecordingResult(session);
        } catch (err) {
            failPractice("録音データを保存できませんでした。もう一度録音練習をお試しください。", err, session);
        }
    };
    recorder.onerror = event => {
        failPractice("録音に失敗しました。もう一度録音練習をお試しください。",
            event.error || new Error("MediaRecorderエラー"), session);
    };
}

function startRecording(session) {
    if (!isCurrentRecording(session) || session.status !== "ready") return;
    session.recorder.start();
    if (isCurrentRecording(session)) session.status = "recording";
}

function stopRecording() {
    const session = recordingSession;
    if (!session || !isCurrentRecording(session) || session.status !== "recording") return;
    session.status = "stopping";
    // stopが成功してもイベントが届かない場合に操作不能のまま残さない。
    session.stopTimerId = setTimeout(() => {
        failPractice("録音データの確定に失敗しました。もう一度録音練習をお試しください。",
            new Error("MediaRecorder stop timeout"), session);
    }, 5000);
    session.recorder.stop();
}

function discardRecordingSession() {
    const session = recordingSession;
    recordingSession = null;
    recordingGeneration++;
    if (!session) return;
    clearTimeout(session.stopTimerId);
    session.recorder.ondataavailable = null;
    session.recorder.onstop = null;
    session.recorder.onerror = null;
    try {
        if (session.recorder.state !== "inactive") session.recorder.stop();
    } catch (err) {
        console.warn("録音の破棄時に停止できませんでした:", err);
    }
    session.chunks = [];
    session.blob = null;
}

function publishRecordingResult(session) {
    if (!isCurrentRecording(session) || session.status !== "complete"
        || !session.timelineFinished || !session.blob?.size) return;
    try {
        if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
        recordedAudioUrl = URL.createObjectURL(session.blob);
        recordedAudioPlayer.src = recordedAudioUrl;
        recordResultCard.classList.remove("hidden");
        recordResultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
        isFinalizingRecording = false;
        showPracticeStatus("");
        updatePracticeControls();
        markTutorialCompleted(session.stage, "record");
    } catch (err) {
        failPractice("録音結果を表示できませんでした。もう一度録音練習をお試しください。", err, session);
    }
}

function failPractice(message, error, recording = null) {
    if (recording && !isCurrentRecording(recording)) return;
    console.warn(message, error);
    stopPractice();
    clearRecordingResult();
    showPracticeStatus(message, true);
}

// ==========================================
// ★ 簡易チューナー ★
// ==========================================
function isCurrentTunerSession(session) {
    return session === tunerSession && session?.generation === tunerStartGeneration
        && session.stringNum === currentTunerStringNum
        && (!tunerDetails || tunerDetails.open)
        && !isPracticing && !isStartingPractice && !isFinalizingRecording;
}

function releaseStaleTunerStream(stream) {
    stream?.getTracks().forEach(track => track.stop());
}

async function selectTunerString(stringNum, midi, noteName) {
    if (tunerDetails && !tunerDetails.open) return;
    if ((isTuning || isStartingTuner) && currentTunerStringNum === stringNum) {
        stopTuner(); 
        return; 
    }
    
    if (isPracticing || isStartingPractice || isFinalizingRecording) {
        stopPractice();
    }
    
    stopTuner();
    stopStandaloneMetronome();
    resetTunerSmoothing();
    tunerSilenceFrames = 0;
    const session = { generation: ++tunerStartGeneration, stringNum, stream: null };
    tunerSession = session;
    isStartingTuner = true;

    currentTunerStringNum = stringNum;
    tunerTargetFreq = midiToFrequency(midi);
    tunerTargetLabel.innerText = `${stringNum}弦 (${noteName}) 目標: ${tunerTargetFreq.toFixed(1)}Hz`;
    tunerStatusText.innerText = "音をポロンと鳴らしてください";
    tunerStatusText.style.color = "#fbbf24";
    tunerMeterPointer.style.left = "50%";
    tunerHud.classList.remove("hidden");
    tunerHud.setAttribute("aria-busy", "true");

    tunerStringBtns.forEach(btn => btn.classList.toggle("active", Number(btn.dataset.string) === stringNum));
    
    try {
        await unlockAudioContext();
        if (!isCurrentTunerSession(session)) return;
        let stream = microphoneStream;
        if (!microphoneStream || microphoneStream.getTracks().every(t => t.readyState === "ended")) {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
            });
        }
        if (!isCurrentTunerSession(session)) {
            releaseStaleTunerStream(stream);
            return;
        }
        session.stream = stream;
        microphoneStream = stream;
        // 取得済みストリームを渡す。世代確認前に共通関数へマイク取得を任せない。
        await setupMicrophoneStream(stream);
        if (!isCurrentTunerSession(session)) {
            releaseStaleTunerStream(stream);
            return;
        }
        isStartingTuner = false;
        isTuning = true;
        tunerHud.removeAttribute("aria-busy");
        tunePitchLoop(session);
    } catch (err) {
        if (!isCurrentTunerSession(session)) {
            releaseStaleTunerStream(session.stream);
            return;
        }
        alert("マイクの利用を許可してください。"); 
        stopTuner(); 
    }
}

function stopTuner() {
    tunerStartGeneration++;
    tunerSession = null;
    isStartingTuner = false;
    isTuning = false;
    currentTunerStringNum = null;
    tunerSilenceFrames = 0;
    if (tunerAnimFrameId !== null) {
        cancelAnimationFrame(tunerAnimFrameId);
        tunerAnimFrameId = null;
    }
    if (tunerHud) {
        tunerHud.classList.add("hidden");
        tunerHud.removeAttribute("aria-busy");
    }
    tunerStringBtns.forEach(btn => btn.classList.remove("active"));

    if (!isPracticing) {
        if (microphoneStream) {
            microphoneStream.getTracks().forEach(t => t.stop());
            microphoneStream = null;
        }
        stopMicrophoneStream();
    }
}

tunerStringBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        const sNum = Number(btn.dataset.string);
        const midi = Number(btn.dataset.midi);
        const note = btn.dataset.note;
        if (sNum && midi && note) selectTunerString(sNum, midi, note);
    });
});

if (tunerDetails) {
    // toggleイベントが閉じる→開くでまとめられても、閉じるクリック時点で無効化する。
    tunerDetails.querySelector("summary")?.addEventListener("click", () => {
        if (tunerDetails.open) stopTuner();
    });
    tunerDetails.addEventListener("toggle", () => { 
        if (!tunerDetails.open) stopTuner(); 
    });
}

function tunePitchLoop(session = tunerSession) {
    if (!isTuning || !isCurrentTunerSession(session) || !analyser || !audioBuffer || !audioContext) {
        return;
    }
    tunerAnimFrameId = null;
    
    analyser.getFloatTimeDomainData(audioBuffer);
    let sum = 0;
    for (let i = 0; i < audioBuffer.length; i++) sum += audioBuffer[i] * audioBuffer[i];
    const rms = Math.sqrt(sum / audioBuffer.length);

    if (rms > 0.003) {
        tunerSilenceFrames = 0;
        const freq = autoCorrelate(audioBuffer, audioContext.sampleRate, rms);
        if (freq > 50 && freq < 1000) {
            updateTunerUI({ freq, tunerTargetFreq, tunerHzDisplay, tunerMeterPointer, tunerStatusText, onInTunePing: playTunerPing });
        }
    } else {
        tunerSilenceFrames++;
        if (tunerSilenceFrames > 20) {
            if (tunerStatusText) {
                tunerStatusText.innerText = "音をポロンと鳴らしてください";
                tunerStatusText.style.color = "#fbbf24";
            }
            if (tunerMeterPointer) {
                tunerMeterPointer.style.boxShadow = "none";
            }
        }
    }
    tunerAnimFrameId = requestAnimationFrame(() => tunePitchLoop(session));
}

// ==========================================
// ★ 運営情報モーダル ★
// ==========================================
if (openAboutBtn) {
    openAboutBtn.addEventListener("click", () => {
        infoModalTitle.innerText = "運営者情報";
        infoModalBody.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 10px;">
                <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.6;">
                    「ギター練習ドットコム」をご利用いただきありがとうございます。当アプリは、ギタリストの基礎トレーニングをブラウザ上で快適にサポートするために開発・運営されています。
                </p>
                <table style="width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 13px;">
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <th style="padding: 10px 6px; text-align: left; color: #475569; width: 30%; font-weight: 700;">運営元</th>
                        <td style="padding: 10px 6px; color: #1e293b;">ギター練習ドットコム 運営事務局</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <th style="padding: 10px 6px; text-align: left; color: #475569; font-weight: 700;">主な活動</th>
                        <td style="padding: 10px 6px; color: #1e293b;">Webオーディオ技術を活用した音楽学習支援ツールの開発、およびメンテナンス</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <th style="padding: 10px 6px; text-align: left; color: #475569; font-weight: 700;">公式URL</th>
                        <td style="padding: 10px 6px; color: #2563eb; word-break: break-all;">（※アプリを公開しているURLをここに記載）</td>
                    </tr>
                    <tr>
                        <th style="padding: 10px 6px; text-align: left; color: #475569; font-weight: 700;">お問い合わせ</th>
                        <td style="padding: 10px 6px; color: #1e293b;">フッターの「お問い合わせ」リンクよりお寄せください。</td>
                    </tr>
                </table>
            </div>
        `;
        infoModal.classList.remove("hidden");
    });
}

if (openPrivacyBtn) {
    openPrivacyBtn.addEventListener("click", () => {
        infoModalTitle.innerText = "プライバシーポリシー";
        infoModalBody.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 14px; margin-top: 10px; max-height: 55vh; overflow-y: auto; padding-right: 4px;">
                <div>
                    <h4 style="margin: 0 0 4px 0; font-size: 13px; color: #0f172a; font-weight: 700;">1. 音声データの取り扱いについて</h4>
                    <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.6;">
                        当アプリ内の「録音練習」および「簡易チューナー」で使用されるマイク入力音声は、**すべてお客様のご利用端末（ブラウザ内部）でのみリアルタイム処理**されます。音声データが外部のサーバーに送信・蓄積されることは一切ありません。
                    </p>
                </div>
                <div>
                    <h4 style="margin: 0 0 4px 0; font-size: 13px; color: #0f172a; font-weight: 700;">2. ローカルストレージの利用</h4>
                    <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.6;">
                        当アプリでは、お客様が設定されたメトロノームの音量設定などを保持するため、ブラウザのLocalStorage機能を使用しています。このデータも端末内にのみ保存されます。
                    </p>
                </div>
                <div>
                    <h4 style="margin: 0 0 4px 0; font-size: 13px; color: #0f172a; font-weight: 700;">3. 免責事項</h4>
                    <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.6;">
                        当アプリの利用により生じたトラブルや不利益について、運営事務局は一切の責任を負いかねます。あらかじめご了承の上、毎日の楽しい練習にお役立てください。
                    </p>
                </div>
            </div>
        `;
        infoModal.classList.remove("hidden");
    });
}

if (openContactBtn) {
    openContactBtn.addEventListener("click", () => {
        infoModalTitle.innerText = "お問い合わせ";
        infoModalBody.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 10px;">
                <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.6;">
                    アプリへのご意見、バグ報告、応援メッセージなど、何かございましたら以下の方法でお気軽にご連絡ください！
                </p>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; font-size: 12px; color: #334155;">
                    <strong style="color: #0f172a; display: block; margin-bottom: 4px;">📩 連絡先・方法について</strong>
                    現在は、外部のGoogleフォームや、運営者のSNS（X/GitHub等）のDM・Issueにて個別に対応させていただいております。
                    <br><br>
                    <a href="（※ここにGoogleフォームやSNSのリンクを入れる）" target="_blank" rel="noopener noreferrer" 
                       style="display: inline-block; background: #2563eb; color: white; padding: 6px 12px; border-radius: 6px; text-decoration: none; font-weight: 700; margin-top: 4px;">
                        👉 お問い合わせフォームを開く
                    </a>
                </div>
            </div>
        `;
        infoModal.classList.remove("hidden");
    });
}

if (closeInfoModalBtn) closeInfoModalBtn.addEventListener("click", () => infoModal.classList.add("hidden"));
if (infoModal) infoModal.addEventListener("click", (e) => { if (e.target === infoModal) infoModal.classList.add("hidden"); });

// --- アプリケーション起動時の初期描画 ---
initVolumeControl();
initTutorialCompletion();
renderExerciseCards();
