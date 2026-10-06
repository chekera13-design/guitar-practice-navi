// ==========================================
// ギター練習ドットコム - メインアプリケーション (js/app.js)
// ==========================================

import { BASIC_STAGES } from "./config.js";
import { VerticalTabController } from "./verticalTab.js";
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
let isStartingPractice = false; // 連打防止ガードフラグ
let currentBpm = 60;
let practiceTimerIds = [];
let verticalTabController = null;
let currentPracticeBarIndex = 0;

// 単体メトロノーム状態
let isStandaloneMetroPlaying = false;
let standaloneMetroTimerId = null;
let standaloneBeat = 0;
let standaloneNextTickTime = 0;

// 譜面描画状態
let isScoreRendered = false;
let modalOpenTimerId = null; // レースコンディション防止用タイマーID
let scoreResizeObserver = null; // ★【ここに追記します】★
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
const mainActionBtn = document.getElementById("mainActionBtn");
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
let currentTunerStringNum = null;
let tunerTargetFreq = 82.41;
let tunerAnimFrameId = null;
let tunerSilenceFrames = 0; // 無音フレームカウンタ

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
// app.js 内の toggleStandaloneMetronome 関数を以下のように書き換えてください

async function toggleStandaloneMetronome() {
    // ★【修正】イベント直後の最も浅い階層で、非同期処理を挟まず同期的に呼び出す（Safari対策）
    // unlockAudioContextはPromiseを返しますが、関数自体の呼び出しを1行目に置くことが重要です
    unlockAudioContext().catch(() => {});

    if (isPracticing) return;

    if (isStandaloneMetroPlaying) {
        stopStandaloneMetronome();
    } else {
        await startStandaloneMetronome(); // startStandaloneMetronome内部のunlockAudioContextは削除しても問題ありません
    }
}


async function startStandaloneMetronome() {
    stopTuner();
    await unlockAudioContext();

    // ★【追加】消音状態を解除し、現在の設定音量（localStorage等から復元された値）を適用する
    const currentVol = Number(metroVolSlider?.value || 40) / 100;
    setMetronomeVolume(currentVol);

    isStandaloneMetroPlaying = true;
    standaloneBeat = 0;

    if (standaloneMetroBtn) {
        standaloneMetroBtn.classList.add("active");
        standaloneMetroBtn.innerHTML = `<span>⏹</span><span class="metro-btn-text">停止</span>`;
    }

    const beatsPerBar = (currentStage.timeSignature && currentStage.timeSignature[0]) || 4;
    const beatSec = 60 / currentBpm;
    
    standaloneNextTickTime = audioContext.currentTime + 0.05;

    function scheduler() {
        if (!isStandaloneMetroPlaying) return;

        while (standaloneNextTickTime < audioContext.currentTime + 0.1) {
            const beatInBar = (standaloneBeat % beatsPerBar) + 1;
            const isAccent = (beatInBar === 1);

            scheduleTick(standaloneNextTickTime, isAccent);

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

    // 1. ローカルストレージから前回の音量を復元、または初期値（40%）を適用
    const savedVol = localStorage.getItem("chogita_metro_vol");
    const initialVol = (savedVol !== null) ? Number(savedVol) : 40;

    metroVolSlider.value = initialVol;
    setMetronomeVolume(initialVol / 100);
    updateVolumeDisplay(initialVol);

    // 2. 自動収納タイマーを管理する関数群（一時停止 と 再開）
    // スライダーのつまみを触っている間は、タイマーをストップして勝手に閉じないようにする
    const pauseVolumeTimer = () => {
        if (volCollapseTimer) {
            clearTimeout(volCollapseTimer);
            volCollapseTimer = null;
        }
    };

    // つまみから指・マウスを離した瞬間に、そこから新しく3秒のカウントダウンを始める
    const resumeVolumeTimer = () => {
        resetVolumeCollapseTimer();
    };

    // 3. スライダーの値が変更された（ドラッグ中・キーボード操作中）ときの処理
    metroVolSlider.addEventListener("input", (e) => {
        const val = Number(e.target.value);
        setMetronomeVolume(val / 100);
        updateVolumeDisplay(val);
        
        // ★【追加】値が動いている（ドラッグ中）間も、徹底してタイマーを一時停止させて勝手に閉じるのを防ぐ
        pauseVolumeTimer(); 
        
        try {
            localStorage.setItem("chogita_metro_vol", String(val));
        } catch (err) {}
    });

    // 4. スマホ用（タッチイベント）のリスナー登録
    metroVolSlider.addEventListener("touchstart", pauseVolumeTimer, { passive: true });
    metroVolSlider.addEventListener("touchend", resumeVolumeTimer, { passive: true });

    // 5. PC用（マウスイベント）のリスナー登録
    metroVolSlider.addEventListener("mousedown", pauseVolumeTimer);
    
    // ★【バグ修正】metroVolSlider単体のmouseupではなく、document（画面全体）のmouseupを監視する
    // これにより、つまみを掴んだままマウスをスライダーの外側に大きく外して指を離しても、確実に「離した」ことを検知して3秒後に閉じます
    document.addEventListener("mouseup", () => {
        if (metroVolContainer && metroVolContainer.classList.contains("expanded")) {
            resumeVolumeTimer();
        }
    });

    // 6. 音量展開ボタン（スピーカーアイコン）が押されたときの開閉制御
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

    // 7. スライダー以外の画面の適当な場所をクリックしたときに閉じる
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
            const apiInstance = new alphaTab.AlphaTabApi(container, {
                core: { engine: "svg" },
                display: { 
                    layoutMode: "horizontal", 
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
            api = apiInstance;

            apiInstance.scoreLoaded.on((score) => {
                if (api !== apiInstance) return;
                if (scoreRenderInProgress) scoreLoadConfirmed = true;
                if (score && score.masterBars && score.masterBars.length > 0) {
                    const bars = score.masterBars.length;
                    if (modalBarsBadge) modalBarsBadge.innerText = `${bars}小節`;
                }
            });

            apiInstance.renderFinished.on(() => {
                if (api !== apiInstance) return;
                if (scoreRenderInProgress
                    && activeScoreRenderGeneration === scoreRenderGeneration
                    && (!scoreLoadPending || scoreLoadConfirmed)) {
                    scoreRenderInProgress = false;
                    scoreLoadPending = false;
                    scoreLoadConfirmed = false;
                    activeScoreRenderGeneration = 0;
                }
                isScoreRendered = true;
                resetScoreFocusState();
                const bars = getStagePracticeBars(currentStage);
                buildScoreBarLayouts(apiInstance, bars);
                scheduleAlphaTabHealthCheck();
            });

            // 楽譜ファイルロード失敗時のエラーハンドリング
            apiInstance.error.on((error) => {
                if (api !== apiInstance) return;
                console.error("alphaTab エラー:", error);
                if (scoreRenderInProgress) {
                    scoreRenderInProgress = false;
                    scoreLoadPending = false;
                    scoreLoadConfirmed = false;
                    activeScoreRenderGeneration = 0;
                }
                const scoreWrapper = document.querySelector(".score-wrapper");
                if (scoreWrapper) {
                    const prevErr = scoreWrapper.querySelector(".score-error-msg");
                    if (!prevErr) {
                        const errMsg = document.createElement("div");
                        errMsg.className = "score-error-msg";
                        errMsg.style.cssText = "color: #ef4444; font-size: 13px; text-align: center; padding: 20px;";
                        errMsg.innerText = "⚠️ 楽譜の読み込みに失敗しました。通信環境をご確認のうえ再試行してください。";
                        scoreWrapper.appendChild(errMsg);
                    }
                }
                if (scoreHealthCheckPending) scheduleAlphaTabHealthCheck();
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
    initAlphaTabIfNeeded();
    if (!api) return;
    if (scoreRenderInProgress) {
        scoreHealthCheckPending = true;
        return;
    }

    const scoreWrapper = document.querySelector(".score-wrapper");
    const prevErr = scoreWrapper?.querySelector(".score-error-msg");
    if (prevErr) prevErr.remove();

    const renderGeneration = ++scoreRenderGeneration;
    activeScoreRenderGeneration = renderGeneration;
    scoreRenderInProgress = true;
    scoreLoadPending = Boolean(stage.file);
    scoreLoadConfirmed = !scoreLoadPending;
    isScoreRendered = false;

    if (stage.file) {
        try {
            const loadStarted = api.load(stage.file);
            if (!loadStarted && activeScoreRenderGeneration === renderGeneration) {
                scoreRenderInProgress = false;
                scoreLoadPending = false;
                scoreLoadConfirmed = false;
                activeScoreRenderGeneration = 0;
                scoreRepairAttempted = false;
            }
            return;
        } catch (e) {
            console.error("alphaTab load error:", e);
            if (activeScoreRenderGeneration === renderGeneration) {
                scoreRenderInProgress = false;
                scoreLoadPending = false;
                scoreLoadConfirmed = false;
                activeScoreRenderGeneration = 0;
            }
        }
    }

    if (stage.tex) {
        try {
            api.tex(stage.tex);
        } catch (e) {
            console.warn("alphaTex レンダリング失敗:", e);
            if (activeScoreRenderGeneration === renderGeneration) {
                scoreRenderInProgress = false;
                scoreLoadPending = false;
                scoreLoadConfirmed = false;
                activeScoreRenderGeneration = 0;
            }
        }
    } else if (activeScoreRenderGeneration === renderGeneration) {
        scoreRenderInProgress = false;
        scoreLoadPending = false;
        scoreLoadConfirmed = false;
        activeScoreRenderGeneration = 0;
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
// ==========================================
// ★ 練習ポップアップモーダルの制御 ★
// ==========================================
function openPracticeModal(stage) {
    currentStage = stage;
    currentBpm = stage.bpm || 60;
    currentPracticeBarIndex = 0;
    isScoreRendered = false;
    scoreRenderInProgress = false;
    scoreLoadPending = false;
    scoreLoadConfirmed = false;
    scoreHealthCheckPending = false;
    scoreRepairAttempted = false;
    activeScoreRenderGeneration = 0;

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
    mainActionBtn.innerText = "▶ 練習する";
    mainActionBtn.classList.remove("btn-stop");
    mainActionBtn.disabled = false;

    if (standaloneMetroBtn) standaloneMetroBtn.disabled = false;

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
            for (let entry of entries) {
                if (entry.contentRect.width > 0 && !isScoreRendered) {
                    const initialized = initAlphaTabIfNeeded();
                    if (initialized) {
                        renderTab(stage);
                        scoreResizeObserver.disconnect();
                        scoreResizeObserver = null;
                    }
                }
            }
        });
        scoreResizeObserver.observe(targetContainer);
    }
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
        });
    }
    verticalTabController.load(currentStage.file)
        .then(() => {
            if (isPracticing) verticalTabController?.setCurrentBar(currentPracticeBarIndex, "practice-resume");
        })
        .catch((error) => console.error("[縦型TAB] load failed", error));
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
    if (!practiceModal || practiceModal.classList.contains("hidden") || !isPracticeModalLandscape()) return;
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

    // Use the visible viewport (including mobile browser chrome) for the modal's available height.
    updatePracticeModalAvailableHeight();

    if (modalContent.scrollHeight <= modalContent.clientHeight) return;

    const score = modalContent.querySelector(".score-wrapper");
    if (!score) return;

    // Center the score in the visible scroll area; clamp to valid scroll bounds.
    const contentRect = modalContent.getBoundingClientRect();
    const scoreRect = score.getBoundingClientRect();
    const scoreTop = modalContent.scrollTop + scoreRect.top - contentRect.top - modalContent.clientTop;
    const target = scoreTop - (modalContent.clientHeight - scoreRect.height) / 2;
    const maxScroll = modalContent.scrollHeight - modalContent.clientHeight;
    modalContent.scrollTop = Math.max(0, Math.min(maxScroll, target));
}

function requestPracticeModalInitialPosition() {
    if (practiceModalPositionFrame !== null) cancelAnimationFrame(practiceModalPositionFrame);
    // Wait for display/layout and alphaTab's initial sizing to settle before measuring DOM dimensions.
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
    if (!practiceModal || practiceModal.classList.contains("hidden")) return;
    if (shouldUseVerticalTabLayout()) return;
    scoreHealthCheckPending = true;
    if (alphaTabHealthCheckTimerId !== null) clearTimeout(alphaTabHealthCheckTimerId);

    alphaTabHealthCheckTimerId = setTimeout(() => {
        alphaTabHealthCheckTimerId = null;
        if (!practiceModal || practiceModal.classList.contains("hidden")) {
            scoreHealthCheckPending = false;
            return;
        }
        if (scoreRenderInProgress) return; // renderFinished will schedule the deferred check.

        scoreHealthCheckPending = false;
        const container = document.getElementById("alphaTab");
        if (isAlphaTabDisplayHealthy(container)) {
            scoreRepairAttempted = false;
            return;
        }

        if (scoreRepairAttempted) return;
        scoreRepairAttempted = true;
        renderTab(currentStage);
        if (!api) scoreRepairAttempted = false;
    }, 300);
}

function handlePracticeModalOrientationChange() {
    if (!practiceModal || practiceModal.classList.contains("hidden")) return;

    updatePracticeScoreLayout();

    // Coalesce orientationchange/resize bursts into one score health check.
    scheduleAlphaTabHealthCheck();
    const isLandscape = isPracticeModalLandscape();
    if (isLandscape === practiceModalWasLandscape) return;

    practiceModalWasLandscape = isLandscape;
    if (isLandscape) {
        updatePracticeModalAvailableHeight();
        requestPracticeModalInitialPosition();
    } else {
        // Restore the portrait CSS default without changing the user's scroll position.
        resetPracticeModalAvailableHeight();
    }
}

window.addEventListener("orientationchange", handlePracticeModalOrientationChange);
window.addEventListener("resize", handlePracticeModalOrientationChange);

if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", updatePracticeModalAvailableHeight);
}


function closePracticeModal() {
    // ★【追加】モーダルを閉じる際は、チューナーの状態やUI選択ハイライトも確実に完全初期化する
    stopTuner();

    if (isPracticing) {
        stopPractice();
    } else {
        stopRecording();
    }
    
    // ★【追加】チューナーも確実に完全停止させ、UIのactiveクラスを消去する
    stopTuner(); 

    if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
        recordedAudioUrl = null;
    }
    
    // ★【追加】モーダルが閉じられたらサイズ監視も強制終了
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

    if (api) {
        try {
            api.destroy();
        } catch (e) {
            console.warn("alphaTab destroy error:", e);
        }
        api = null;
    }

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


if (closePracticeModalBtn) closePracticeModalBtn.addEventListener("click", closePracticeModal);
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
async function startPractice() {
    // ボタン連打による多重起動の完全ガード
    if (isPracticing || isStartingPractice) return;
    resetPracticeBar();
    isStartingPractice = true;
    mainActionBtn.disabled = true;

    // ★【バグ修正】非同期処理 (await) に入る前の最も浅い階層で、
    // チューナーと単体メトロノームを同期的かつ最優先で完全停止・クリーンアップする
    stopTuner();
    stopStandaloneMetronome();

    // 前回の録音再生中であれば即座に停止＆巻き戻し（音の被り混入防止）
    if (recordedAudioPlayer) {
        recordedAudioPlayer.pause();
        recordedAudioPlayer.currentTime = 0;
    }

    collapseVolumeBar();
    
    await unlockAudioContext();
    await requestWakeLock();

    const scoreWrapper = document.querySelector(".score-wrapper");
    if (scoreWrapper) scoreWrapper.scrollLeft = 0;
    resetScoreFocusState();

    try {
        // ★【バグ修正】マイク取得からセットアップまでを一つの try ブロックで一貫して管理
        if (!microphoneStream || microphoneStream.getTracks().every(t => t.readyState === "ended")) {
            microphoneStream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
            });
        }
        await setupMicrophoneStream(microphoneStream);
    } catch (err) {
        console.error("マイク取得またはセットアップエラー:", err);
        alert("マイクへのアクセスに失敗したか、オーディオの初期化が拒否されました。ブラウザの設定でマイクを許可してください。");
        
        // 確実にステートを復元する
        isStartingPractice = false;
        mainActionBtn.disabled = false;
        return;
    }

    // --- 録音・演奏ステートの確定 ---
    isPracticing = true;
    isStartingPractice = false;
    mainActionBtn.disabled = false;
    mainActionBtn.innerText = "⏹️ 練習を終了";
    mainActionBtn.classList.add("btn-stop");
    if (recordResultCard) recordResultCard.classList.add("hidden");

    if (standaloneMetroBtn) standaloneMetroBtn.disabled = true;

    setupMediaRecorder(microphoneStream);
    
    // iOS制限対策＆カウント4拍を残すため、練習開始と同時に録音を走らせる
    startRecording();
    visualMetronomeBox.classList.add("recording");

    // ★【バグ修正】startRecording()（MediaRecorderの初期起動に伴うクロックジッター）完了の "後" に、
    // 最新の currentTime を取得して発音基準時刻を計算することで、2拍目以降の無音バグを完全に防止する
    const beatSec = 60 / currentBpm;
    const offsetSec = 0.3; // クロック変動を安全に吸収するため少し余裕を持たせる（0.25 -> 0.3）
    const startTime = audioContext.currentTime + offsetSec; 

    const beatsPerBar = (currentStage.timeSignature && currentStage.timeSignature[0]) || 4;
    const countInBars = currentStage.countInBars || 1;
    const countInBeats = countInBars * beatsPerBar;
    const practiceBars = getStagePracticeBars(currentStage);
    const practiceBeats = practiceBars * beatsPerBar;
    const totalBeats = countInBeats + practiceBeats;
    const ringOutBeats = Math.min(4, beatsPerBar);
    const totalSteps = totalBeats + ringOutBeats;

    buildScoreBarLayouts(api, practiceBars);

    // 1. メトロノーム発音スケジュール
    for (let b = 0; b < totalBeats; b++) {
        const isAccent = (b % beatsPerBar === 0);
        scheduleTick(startTime + (b * beatSec), isAccent);
    }

    // 2. 音声時刻と厳密に同期したビジュアルステップタイマー
    practiceTimerIds = [];
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
        setPracticeBar(barIndex, "practice");
        const currentPracticeBar = barIndex + 1;
        const recText = practiceBars > 1 ? `REC ${currentPracticeBar}/${practiceBars}` : "REC";

        updateVisualMetronome(beatInBar, isAccent, recText, "rec");

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
    isStartingPractice = false;
    resetPracticeBar();

    // 1. JavaScript側のすべてのタイマーを最優先でクリア
    practiceTimerIds.forEach(id => clearTimeout(id));
    practiceTimerIds = [];

    // 2. Web Audio API側の発音予約をすべて強制停止（先ほど強化した関数）
    stopAllScheduledTicks(); 
    
    stopRecording();
    releaseWakeLock();
    resetVisualMetronome();
    stopScoreContinuousScroll();
    resetScoreFocusState();

    if (standaloneMetroBtn) standaloneMetroBtn.disabled = false;

    mainActionBtn.innerText = "▶ 練習する";
    mainActionBtn.classList.remove("btn-stop");
    mainActionBtn.disabled = false;
}


function finishPractice() {
    isPracticing = false;
    isStartingPractice = false;
    resetPracticeBar();
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
    mainActionBtn.disabled = false;

    if (recordResultCard) {
        recordResultCard.classList.remove("hidden");
        recordResultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
}

mainActionBtn.addEventListener("click", () => {
    // ★【修正】クリックされた瞬間に最優先で解凍
    unlockAudioContext().catch(() => {});

    if (isPracticing) stopPractice();
    else startPractice();
});

// app.js 内の setupMediaRecorder 関数を以下のように書き換えてください

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
            // ★【修正】データ切り出し時にすでにモーダルが閉じられていたら、後続のUI操作を安全にスキップする
            if (!practiceModal || practiceModal.classList.contains("hidden")) {
                recordedChunks = []; // メモリ解放
                return;
            }

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
    if (mediaRecorder && mediaRecorder.state === "inactive") mediaRecorder.start(); 
}

function stopRecording() { 
    if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop(); 
}

// ==========================================
// ★ 簡易チューナー（多重ループ完全防止） ★
// ==========================================
// app.js 内の selectTunerString 関数を以下のようにアップデートしてください

async function selectTunerString(stringNum, midi, noteName) {
    if (isTuning && currentTunerStringNum === stringNum) { 
        stopTuner(); 
        return; 
    }
    
    // ★【修正】練習中であれば最優先で練習を完全停止する
    if (isPracticing) {
        stopPractice();
    }
    
    stopTuner();
    stopStandaloneMetronome();
    resetTunerSmoothing();
    tunerSilenceFrames = 0;

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
        // ★【修正】ストリームを安全に初期化
        if (!microphoneStream || microphoneStream.getTracks().every(t => t.readyState === "ended")) {
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
    tunerSilenceFrames = 0;
    if (tunerAnimFrameId !== null) {
        cancelAnimationFrame(tunerAnimFrameId);
        tunerAnimFrameId = null;
    }
    if (tunerHud) tunerHud.classList.add("hidden");
    tunerStringBtns.forEach(btn => btn.classList.remove("active"));

    // チューナー停止時にマイクも解放（練習中でなければ）
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
        // ★【修正】クリックした瞬間に最優先で解凍を走らせる
        unlockAudioContext().catch(() => {});

        const sNum = Number(btn.dataset.string);
        const midi = Number(btn.dataset.midi);
        const note = btn.dataset.note;
        if (sNum && midi && note) selectTunerString(sNum, midi, note);
    });
});

if (tunerDetails) {
    tunerDetails.addEventListener("toggle", () => { 
        if (!tunerDetails.open) stopTuner(); 
    });
}

function tunePitchLoop() {
    // ★【修正】フラグが折れている場合は即座に完全に終了し、再帰予約を遮断する
    if (!isTuning || !analyser || !audioBuffer || !audioContext) {
        return;
    }
    
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
        // 無音状態が続いた（約0.3秒）場合は針・ステータスを初期状態に戻す
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
    tunerAnimFrameId = requestAnimationFrame(tunePitchLoop);
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
                        当アプリ内の「練習機能（自動録音）」および「簡易チューナー」で使用されるマイク入力音声は、**すべてお客様のご利用端末（ブラウザ内部）でのみリアルタイム処理**されます。音声データが外部のサーバーに送信・蓄積されることは一切ありません。
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
renderExerciseCards();
