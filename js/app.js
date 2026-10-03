// ==========================================
// 超ギタートレーニング（超ギタトレ） - メインアプリケーション (js/app.js)
// ==========================================

import { BASIC_STAGES, EX1_STAGE, noteStrings, defaultTuning } from "./config.js";
import { 
    unlockAudioContext, setupMicrophoneStream, scheduleTick,
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
let currentBpm = 60;
let practiceTimerIds = [];

// 単体メトロノーム状態
let isStandaloneMetroPlaying = false;
let standaloneMetroTimerId = null;
let standaloneBeat = 0;
let standaloneNextTickTime = 0;

// 譜面描画状態
let isScoreRendered = false;

// 録音ステート
let mediaRecorder = null;
let recordedChunks = [];
let recordedAudioUrl = null;
let microphoneStream = null;

// DOM要素取得
const exerciseGrid = document.getElementById("exerciseGrid");
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
const recordingLiveBadge = document.getElementById("recordingLiveBadge");
const landscapeRecordingHud = document.getElementById("landscapeRecordingHud");
const landscapeControlsLayer = document.getElementById("landscapeControlsLayer");
const landscapeControlsToggle = document.getElementById("landscapeControlsToggle");
const landscapeBpmBadge = document.getElementById("landscapeBpmBadge");
const mainActionBtn = document.getElementById("mainActionBtn");
const recordResultCard = document.getElementById("recordResultCard");
const recordedAudioPlayer = document.getElementById("recordedAudioPlayer");

// 単体メトロノームボタンDOM
const standaloneMetroBtn = document.getElementById("standaloneMetroBtn");

// メトロノーム音量スライダーDOM
const metroVolContainer = document.getElementById("metroVolContainer");
const metroVolToggleBtn = document.getElementById("metroVolToggleBtn");
const metroVolSlider = document.getElementById("metroVolSlider");
const metroVolLabel = document.getElementById("metroVolLabel");
const metroVolIcon = document.getElementById("metroVolIcon");
let volCollapseTimer = null;

function setLandscapeControlsOpen(isOpen) {
    if (!landscapeControlsLayer || !landscapeControlsToggle) return;
    landscapeControlsLayer.classList.toggle("controls-open", isOpen);
    landscapeControlsToggle.setAttribute("aria-expanded", String(isOpen));
    landscapeControlsToggle.setAttribute("aria-label", isOpen ? "演奏中の操作を閉じる" : "演奏中の操作を開く");
}

if (landscapeControlsToggle) {
    landscapeControlsToggle.addEventListener("click", () => {
        setLandscapeControlsOpen(!landscapeControlsLayer.classList.contains("controls-open"));
    });
}

// チューナー関連DOM
const tunerDetails = document.querySelector(".tuner-details");
const tunerHud = document.getElementById("tunerHud");
const tunerTargetLabel = document.getElementById("tunerTargetLabel");
const tunerStatusText = document.getElementById("tunerStatusText");
const tunerMeterPointer = document.getElementById("tunerMeterPointer");
const tunerHzDisplay = document.getElementById("tunerHzDisplay");
const tunerStringBtns = document.querySelectorAll(".tuner-string-btn");
let isTuning = false;
let currentTunerStringNum = null;
let tunerTargetFreq = 82.41;
let tunerAnimFrameId = null; // 修正: 多重ループ防止用のアニメーションフレームID

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
    if (isPracticing) return;

    if (isStandaloneMetroPlaying) {
        stopStandaloneMetronome();
    } else {
        await startStandaloneMetronome();
    }
}

async function startStandaloneMetronome() {
    stopTuner();
    await unlockAudioContext();

    isStandaloneMetroPlaying = true;
    standaloneBeat = 0;

    if (standaloneMetroBtn) {
        standaloneMetroBtn.classList.add("active");
        standaloneMetroBtn.innerHTML = `<span>⏹</span><span class="metro-btn-text">停止</span>`;
    }

    const beatsPerBar = (currentStage.timeSignature && currentStage.timeSignature[0]) || 4;
    const beatSec = 60 / currentBpm;
    
    // Web Audio の正確なタイムラインを基準にする（累積遅延ゼロ）
    standaloneNextTickTime = audioContext.currentTime + 0.05;

    function scheduler() {
        if (!isStandaloneMetroPlaying) return;

        // 0.1秒先までスケジュール
        while (standaloneNextTickTime < audioContext.currentTime + 0.1) {
            const beatInBar = (standaloneBeat % beatsPerBar) + 1;
            const isAccent = (beatInBar === 1);

            scheduleTick(standaloneNextTickTime, isAccent);

            // 音声発音時刻に合わせた視覚更新のタイマー
            const delayMs = Math.max(0, (standaloneNextTickTime - audioContext.currentTime) * 1000);
            setTimeout(() => {
                if (isStandaloneMetroPlaying) {
                    updateVisualMetronome(beatInBar, isAccent, "METRO", "metro-solo");
                }
            }, delayMs);

            standaloneNextTickTime += beatSec;
            standaloneBeat++;
        }

        standaloneMetroTimerId = setTimeout(scheduler, 25);
    }

    scheduler();
}

function stopStandaloneMetronome() {
    isStandaloneMetroPlaying = false;
    if (standaloneMetroTimerId) {
        clearTimeout(standaloneMetroTimerId);
        standaloneMetroTimerId = null;
    }

    stopAllScheduledTicks();

    if (standaloneMetroBtn) {
        standaloneMetroBtn.classList.remove("active");
        standaloneMetroBtn.innerHTML = `${METRO_SVG_ICON}<span class="metro-btn-text">クリック</span>`;
    }

    if (!isPracticing) {
        resetVisualMetronome();
    }
}

if (standaloneMetroBtn) {
    standaloneMetroBtn.addEventListener("click", toggleStandaloneMetronome);
}

// ==========================================
// ★ メトロノーム音量スライダー制御（スマホ展開 ＆ 3秒自動収納） ★
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

    const savedVol = localStorage.getItem("chogita_metro_vol");
    const initialVol = (savedVol !== null) ? Number(savedVol) : 40;

    metroVolSlider.value = initialVol;
    setMetronomeVolume(initialVol / 100);
    updateVolumeDisplay(initialVol);

    metroVolSlider.addEventListener("input", (e) => {
        const val = Number(e.target.value);
        setMetronomeVolume(val / 100);
        updateVolumeDisplay(val);
        resetVolumeCollapseTimer();
        try {
            localStorage.setItem("chogita_metro_vol", String(val));
        } catch (err) {}
    });

    metroVolSlider.addEventListener("touchstart", () => {
        resetVolumeCollapseTimer();
    }, { passive: true });

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

// --- alphaTab 初期化 ---
let api = null;
function initAlphaTabIfNeeded() {
    if (!api && window.alphaTab) {
        const container = document.getElementById("alphaTab");
        if (!container || container.clientWidth === 0) return false;

        try {
            api = new alphaTab.AlphaTabApi(container, {
                core: { engine: "svg" },
                display: { 
                    layoutMode: "horizontal", // 横1行固定
                    staveProfile: "Tab", 
                    scale: 1.0
                },
                notation: {
                    elements: {
                        trackNames: false,
                        guitarTuning: false,
                        scoreTitle: false,
                        scoreSubTitle: false,
                        chordDiagrams: false,
                        barNumber: true
                    }
                }
            });

            api.scoreLoaded.on((score) => {
                if (score && score.masterBars && score.masterBars.length > 0) {
                    const bars = score.masterBars.length;
                    if (modalBarsBadge) modalBarsBadge.innerText = `${bars}小節`;
                }
            });

            api.renderFinished.on(() => {
                isScoreRendered = true;
                resetScoreFocusState();
                const bars = getStagePracticeBars(currentStage);
                buildScoreBarLayouts(api, bars);
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
// ★ 楽譜レンダリング ★
// ==========================================
function renderTab(stage = currentStage) {
    if (!stage) return;
    isScoreRendered = false;
    initAlphaTabIfNeeded();
    if (!api) return;

    if (stage.file) {
        try {
            api.load(stage.file);
            return;
        } catch (e) {
            console.error("alphaTab load error:", e);
        }
    }

    if (stage.tex) {
        try {
            api.tex(stage.tex);
        } catch (e) {
            console.warn("alphaTex レンダリング失敗:", e);
        }
    }
}

// ==========================================
// ★ 練習カードの動的生成 ★
// ==========================================
function renderExerciseCards() {
    if (!exerciseGrid) return;

    exerciseGrid.innerHTML = BASIC_STAGES.map(stage => {
        const barsLabel = stage.practiceBars ? `${stage.practiceBars}小節` : "";
        return `
            <div class="exercise-card ${stage.available ? 'exercise-card-available' : 'exercise-card-locked'}"
                 data-stage-id="${stage.id}"
                 tabindex="${stage.available ? '0' : '-1'}">
                <div class="ex-card-content">
                    <div class="ex-badge-row">
                        <span class="ex-badge ${stage.available ? '' : 'badge-muted'}">${stage.code}</span>
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

    exerciseGrid.querySelectorAll(".exercise-card-available").forEach(card => {
        const stageId = Number(card.dataset.stageId);
        const stage = BASIC_STAGES.find(s => s.id === stageId);
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
    currentStage = stage;
    practiceModal.classList.remove("is-playing");
    setLandscapeControlsOpen(false);
    currentBpm = stage.bpm || 60;
    isScoreRendered = false;

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
    if (landscapeBpmBadge) landscapeBpmBadge.innerText = `BPM ${currentBpm}`;
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
    mainActionBtn.innerText = "▶ 練習スタート (カウントイン & 録音)";
    mainActionBtn.classList.remove("btn-stop");

    if (standaloneMetroBtn) standaloneMetroBtn.disabled = false;

    practiceModal.classList.remove("hidden");
    document.body.style.overflow = "hidden";

    setTimeout(() => {
        initAlphaTabIfNeeded();
        renderTab(stage);
    }, 150);
}

function closePracticeModal() {
    if (isPracticing) {
        stopPractice();
    }
    
    stopStandaloneMetronome();
    collapseVolumeBar();
    stopScoreContinuousScroll();
    resetScoreFocusState();

    if (api) {
        try {
            api.destroy();
        } catch (e) {
            console.warn("alphaTab destroy error:", e);
        }
        api = null;
    }

    practiceModal.classList.add("hidden");
    practiceModal.classList.remove("is-playing");
    setLandscapeControlsOpen(false);
    document.body.style.overflow = "";
}

if (closePracticeModalBtn) closePracticeModalBtn.addEventListener("click", closePracticeModal);
if (practiceModal) {
    practiceModal.addEventListener("click", (e) => {
        if (landscapeControlsLayer?.classList.contains("controls-open") && !landscapeControlsLayer.contains(e.target)) {
            setLandscapeControlsOpen(false);
        }
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
async function startPractice() {
    if (isStandaloneMetroPlaying) {
        stopStandaloneMetronome();
    }

    collapseVolumeBar();
    stopTuner();
    await unlockAudioContext();
    await requestWakeLock();

    const scoreWrapper = document.querySelector(".score-wrapper");
    if (scoreWrapper) scoreWrapper.scrollLeft = 0;
    resetScoreFocusState();

    try {
        if (!microphoneStream) {
            microphoneStream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
            });
        }
        await setupMicrophoneStream(microphoneStream);
    } catch (err) {
        console.error("マイク取得エラー:", err);
        alert("マイクへのアクセスが拒否されました。ブラウザの設定でマイクを許可してください。");
        return;
    }

    isPracticing = true;
    practiceModal.classList.add("is-playing");
    setLandscapeControlsOpen(false);
    mainActionBtn.innerText = "⏹️ 練習中止";
    mainActionBtn.classList.add("btn-stop");
    if (recordResultCard) recordResultCard.classList.add("hidden");

    if (standaloneMetroBtn) standaloneMetroBtn.disabled = true;

    setupMediaRecorder(microphoneStream);

    const beatsPerBar = (currentStage.timeSignature && currentStage.timeSignature[0]) || 4;
    const countInBars = currentStage.countInBars || 1;
    const countInBeats = countInBars * beatsPerBar;
    const practiceBars = getStagePracticeBars(currentStage);
    const practiceBeats = practiceBars * beatsPerBar;
    const totalBeats = countInBeats + practiceBeats;
    const ringOutBeats = Math.min(4, beatsPerBar);
    const totalSteps = totalBeats + ringOutBeats;

    const beatSec = 60 / currentBpm;
    const offsetSec = 0.25; // 250msの安定オフセット
    const startTime = audioContext.currentTime + offsetSec;

    buildScoreBarLayouts(api, practiceBars);

    // 1. メトロノーム発音スケジュール（Web Audio API クロックで厳密に確定）
    for (let b = 0; b < totalBeats; b++) {
        const isAccent = (b % beatsPerBar === 0);
        scheduleTick(startTime + (b * beatSec), isAccent);
    }

    // 2. 音声時刻と厳密に同期したビジュアルステップタイマー（ドリフト補正付き）
    for (let step = 0; step < totalSteps; step++) {
        const stepTime = startTime + (step * beatSec);
        const delayMs = Math.max(0, (stepTime - audioContext.currentTime) * 1000);

        const timerId = setTimeout(() => {
            if (!isPracticing) return;
            handleBeatStep(step, { beatsPerBar, countInBars, countInBeats, practiceBars, practiceBeats, totalBeats, totalSteps, beatSec });
        }, delayMs);
        practiceTimerIds.push(timerId);
    }

    // 3. 終了タイマー
    const finishTime = startTime + (totalSteps * beatSec) + 0.1;
    const finishDelayMs = Math.max(0, (finishTime - audioContext.currentTime) * 1000);
    const endTimerId = setTimeout(() => {
        if (!isPracticing) return;
        finishPractice();
    }, finishDelayMs);
    practiceTimerIds.push(endTimerId);
}

function handleBeatStep(step, config) {
    const { beatsPerBar, countInBars, countInBeats, practiceBars, totalBeats, totalSteps, beatSec } = config;
    const beatInBar = (step % beatsPerBar) + 1;
    const isAccent = (beatInBar === 1);

    if (step < countInBeats) {
        // --- カウントインフェーズ ---
        const currentCountInBar = Math.floor(step / beatsPerBar) + 1;
        const recStartStep = Math.max(0, countInBeats - 2);
        if (step === recStartStep) {
            startRecording();
            visualMetronomeBox.classList.add("recording");
        }
        
        const countInText = countInBars > 1 
            ? `COUNT IN (${currentCountInBar}/${countInBars})` 
            : "COUNT IN";

        updateVisualMetronome(beatInBar, isAccent, countInText, "count-in");
        updateHighlightBar(-1);
    } 
    else if (step < totalBeats) {
        // --- 演奏練習フェーズ ---
        const noteIndex = step - countInBeats;
        const barIndex = Math.floor(noteIndex / beatsPerBar);
        const currentPracticeBar = barIndex + 1;
        const recText = practiceBars > 1 ? `REC ${currentPracticeBar}/${practiceBars}` : "REC";

        updateVisualMetronome(beatInBar, isAccent, recText, "rec");

        // 演奏開始の最初の1拍目で、滑らかなスイーっと自動スクロールループを開始
        if (noteIndex === 0) {
            startScoreContinuousScroll({
                api,
                totalBars: practiceBars,
                beatsPerBar,
                beatSec
            });
        }
    } 
    else {
        // --- 余韻・録音完了フェーズ ---
        setPlayFinishedVisual("演奏終了");

        if (step === totalSteps - 1) {
            stopRecording();
            visualMetronomeBox.classList.remove("recording");
        }
    }
}

function stopPractice() {
    isPracticing = false;
    practiceModal.classList.remove("is-playing");
    setLandscapeControlsOpen(false);
    practiceTimerIds.forEach(id => clearTimeout(id));
    practiceTimerIds = [];

    stopAllScheduledTicks(); 
    stopRecording();
    releaseWakeLock();
    resetVisualMetronome();
    stopScoreContinuousScroll();
    resetScoreFocusState();

    if (standaloneMetroBtn) standaloneMetroBtn.disabled = false;

    mainActionBtn.innerText = "▶ 練習スタート (カウントイン & 録音)";
    mainActionBtn.classList.remove("btn-stop");
}

function finishPractice() {
    isPracticing = false;
    practiceModal.classList.remove("is-playing");
    setLandscapeControlsOpen(false);
    practiceTimerIds.forEach(id => clearTimeout(id));
    practiceTimerIds = [];

    stopRecording();
    visualMetronomeBox.classList.remove("recording");

    releaseWakeLock();
    resetVisualMetronome();
    stopScoreContinuousScroll();
    resetScoreFocusState();

    if (standaloneMetroBtn) standaloneMetroBtn.disabled = false;

    mainActionBtn.innerText = "▶ もう一度練習する";
    mainActionBtn.classList.remove("btn-stop");

    if (recordResultCard) {
        recordResultCard.classList.remove("hidden");
        recordResultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
}

mainActionBtn.addEventListener("click", () => {
    if (isPracticing) stopPractice();
    else startPractice();
});

function setupMediaRecorder(stream) {
    if (!window.MediaRecorder || !stream) return;
    recordedChunks = [];
    try {
        let mimeType = "";
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) mimeType = "audio/webm;codecs=opus";
        else if (MediaRecorder.isTypeSupported("audio/webm")) mimeType = "audio/webm";
        else if (MediaRecorder.isTypeSupported("audio/mp4")) mimeType = "audio/mp4";

        mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (e) => { 
            if (e.data && e.data.size > 0) recordedChunks.push(e.data); 
        };
        mediaRecorder.onstop = () => {
            if (recordedChunks.length > 0) {
                const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || "audio/webm" });
                if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
                recordedAudioUrl = URL.createObjectURL(blob);
                if (recordedAudioPlayer) recordedAudioPlayer.src = recordedAudioUrl;
            }
        };
    } catch (e) { 
        console.warn("MediaRecorder初期化失敗:", e); 
    }
}

function startRecording() { 
    if (mediaRecorder && mediaRecorder.state === "inactive") {
        mediaRecorder.start();
        if (recordingLiveBadge) recordingLiveBadge.classList.remove("hidden");
        if (landscapeRecordingHud) landscapeRecordingHud.classList.remove("hidden");
    }
}

function stopRecording() { 
    if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
    if (recordingLiveBadge) recordingLiveBadge.classList.add("hidden");
    if (landscapeRecordingHud) landscapeRecordingHud.classList.add("hidden");
}

// ==========================================
// ★ 簡易チューナー（多重ループ完全防止） ★
// ==========================================
async function selectTunerString(stringNum, midi, noteName) {
    if (isTuning && currentTunerStringNum === stringNum) { 
        stopTuner(); 
        return; 
    }
    
    // 一旦既存のチューナー処理を完全停止
    stopTuner();

    if (isPracticing) stopPractice();
    stopStandaloneMetronome();
    resetTunerSmoothing();

    currentTunerStringNum = stringNum;
    tunerTargetFreq = midiToFrequency(midi);
    tunerTargetLabel.innerText = `${stringNum}弦 (${noteName}) 目標: ${tunerTargetFreq.toFixed(1)}Hz`;
    tunerStatusText.innerText = "音をポロンと鳴らしてください";
    tunerStatusText.style.color = "#fbbf24";
    tunerMeterPointer.style.left = "50%";
    tunerHud.classList.remove("hidden");

    tunerStringBtns.forEach(btn => btn.classList.toggle("active", Number(btn.dataset.string) === stringNum));
    
    await unlockAudioContext();
    try {
        if (!microphoneStream) {
            microphoneStream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
            });
        }
        await setupMicrophoneStream(microphoneStream);
        isTuning = true;
        tunePitchLoop();
    } catch (err) { 
        alert("マイクの利用を許可してください。"); 
        stopTuner(); 
    }
}

function stopTuner() {
    isTuning = false;
    currentTunerStringNum = null;
    if (tunerAnimFrameId !== null) {
        cancelAnimationFrame(tunerAnimFrameId);
        tunerAnimFrameId = null;
    }
    if (tunerHud) tunerHud.classList.add("hidden");
    tunerStringBtns.forEach(btn => btn.classList.remove("active"));
}

tunerStringBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        const sNum = Number(btn.dataset.string);
        const midi = Number(btn.dataset.midi);
        const note = btn.dataset.note;
        if (sNum && midi && note) selectTunerString(sNum, midi, note);
    });
});

if (tunerDetails) tunerDetails.addEventListener("toggle", () => { if (!tunerDetails.open) stopTuner(); });

function tunePitchLoop() {
    if (!isTuning || !analyser || !audioBuffer || !audioContext) return;
    
    analyser.getFloatTimeDomainData(audioBuffer);
    let sum = 0;
    for (let i = 0; i < audioBuffer.length; i++) sum += audioBuffer[i] * audioBuffer[i];
    const rms = Math.sqrt(sum / audioBuffer.length);
    if (rms > 0.003) {
        const freq = autoCorrelate(audioBuffer, audioContext.sampleRate, rms);
        if (freq > 50 && freq < 1000) {
            updateTunerUI({ freq, tunerTargetFreq, tunerHzDisplay, tunerMeterPointer, tunerStatusText, onInTunePing: playTunerPing });
        }
    }
    tunerAnimFrameId = requestAnimationFrame(tunePitchLoop);
}

// ==========================================
// ★ 運営情報モーダル ★
// ==========================================
if (openAboutBtn) {
    openAboutBtn.addEventListener("click", () => {
        infoModalTitle.innerText = "運営者情報";
        infoModalBody.innerHTML = `<p>超ギタートレーニング 運営事務局</p>`;
        infoModal.classList.remove("hidden");
    });
}
if (openPrivacyBtn) {
    openPrivacyBtn.addEventListener("click", () => {
        infoModalTitle.innerText = "プライバシーポリシー";
        infoModalBody.innerHTML = `<p>音声データは端末内でのみ処理され、外部送信されません。</p>`;
        infoModal.classList.remove("hidden");
    });
}
if (openContactBtn) {
    openContactBtn.addEventListener("click", () => {
        infoModalTitle.innerText = "お問い合わせ";
        infoModalBody.innerHTML = `<p>ご意見等はフォームよりお寄せください。</p>`;
        infoModal.classList.remove("hidden");
    });
}
if (closeInfoModalBtn) closeInfoModalBtn.addEventListener("click", () => infoModal.classList.add("hidden"));
if (infoModal) infoModal.addEventListener("click", (e) => { if (e.target === infoModal) infoModal.classList.add("hidden"); });

// --- アプリケーション起動時の初期描画 ---
initVolumeControl();
renderExerciseCards();
