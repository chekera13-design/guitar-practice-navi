// ==========================================
// ギター練習ナビ - メインアプリケーション (js/app.js)
// ==========================================

import { STAGES_LEVEL1, STAGES_LEVEL2, STAGES_LEVEL3, noteStrings, defaultTuning, SAVE_KEY } from './config.js';
import { 
    unlockAudioContext, setupMicrophoneStream, playTick, scheduleTick, playSuccessSound, 
    playVictoryFanfare, playDrumroll, playCymbalCrash, autoCorrelate, midiToFrequency,
    evaluateRecordedChordData, requestWakeLock, releaseWakeLock,
    audioContext, analyser, audioBuffer, prevRms, isWaitingForNewAttack, lastNoteClearedTime,
    setPrevRms, setIsWaitingForNewAttack, setLastNoteClearedTime,
    startPcmCapture, stopPcmCapture,
    evaluateProgressionPcmData,
    playTunerPing,
    setMetronomeVolume
} from './audioEngine.js';
import { 
    renderQueue, updateTargetUI, showRhythmJudge, renderStagesUI, 
    updateTunerUI, resetTunerSmoothing,
    triggerCountInPulse
} from './ui.js';

// --- 状態管理 & セーブデータ ---
let rawSave = localStorage.getItem(SAVE_KEY) || localStorage.getItem("guitar_app_save_data");
let parsedSave = {};
try { parsedSave = JSON.parse(rawSave) || {}; } catch(e) { parsedSave = {}; }

let saveData = {
    level1: Array.isArray(parsedSave.level1) ? parsedSave.level1 : (Array.isArray(parsedSave.cleared) ? parsedSave.cleared : []),
    level2: Array.isArray(parsedSave.level2) ? parsedSave.level2 : [],
    level3: Array.isArray(parsedSave.level3) ? parsedSave.level3 : []
};

let currentLevel = 1; // 1: 音程入門編, 2: リズム基礎編, 3: コード入門編
let currentStageIndex = 0;
let currentNotes = [];
let currentIndex = 0;
let isChallenging = false;

// 難易度2・3タイマーステート
let rhythmTimerIds = [];
let rhythmSongStartTime = 0;
let rhythmStats = { perfect: 0, good: 0, miss: 0 };
let isCountingIn = false;

// 録音ステート
let mediaRecorder = null;
let recordedChunks = [];
let recordedAudioUrl = null;
let microphoneStream = null;

// DOM要素取得
const levelTabs = document.querySelectorAll('.level-tab');
const headerLevelTitle = document.getElementById('headerLevelTitle');
const headerLevelDesc = document.getElementById('headerLevelDesc');
const progressLabelText = document.getElementById('progressLabelText');
const progressPercentEl = document.getElementById('progressPercent');
const progressBarFill = document.getElementById('progressBarFill');
const resetProgressBtn = document.getElementById('resetProgressBtn');

const stagesGrid = document.getElementById('stagesGrid');
const currentStageBadge = document.getElementById('currentStageBadge');
const bpmBadge = document.getElementById('bpmBadge');
const currentStageTitle = document.getElementById('currentStageTitle');
const currentStageDesc = document.getElementById('currentStageDesc');
const fileInput = document.getElementById('fileInput');
const startChallengeBtn = document.getElementById('startChallengeBtn');

// ポップアップモーダル関連DOM
const playModal = document.getElementById('playModal');
const playModalContent = document.getElementById('playModalContent');
const closePlayModalBtn = document.getElementById('closePlayModalBtn');
const guideToggleBtn = document.getElementById('guideToggleBtn');
const guideArrow = document.getElementById('guideArrow');
const guideTitle = document.getElementById('guideTitle');
const guideContent = document.getElementById('guideContent');

// メトロノーム音量スライダー DOM
const metroVolSlider = document.getElementById('metroVolSlider');
const metroVolVal = document.getElementById('metroVolVal');

// 判定HUD DOM
const hudCard = document.getElementById('hudCard');
const countInOverlay = document.getElementById('countInOverlay');
const countInNumber = document.getElementById('countInNumber');
const targetNoteEl = document.getElementById('targetNote');
const targetInfoEl = document.getElementById('targetInfo');
const rhythmJudgeBadge = document.getElementById('rhythmJudgeBadge');
const detectedPill = document.querySelector('.detected-pill');
const detectedNoteEl = document.getElementById('detectedNote');
const detectedHzEl = document.getElementById('detectedHz');
const notesQueueEl = document.getElementById('notesQueue');

// 動くTABカーソル
const scoreCursor = document.getElementById('scoreCursor');

// クリアモーダル DOM
const clearModal = document.getElementById('clearModal');
const modalTitle = document.getElementById('modalTitle');
const modalDesc = document.getElementById('modalDesc');
const modalScoreStats = document.getElementById('modalScoreStats');
const statPerfect = document.getElementById('statPerfect');
const statGood = document.getElementById('statGood');
const statMiss = document.getElementById('statMiss');
const modalAudioSection = document.getElementById('modalAudioSection');
const recordedPlayer = document.getElementById('recordedPlayer');
const nextStageBtn = document.getElementById('nextStageBtn');
const retryBtn = document.getElementById('retryBtn');

// チューナーDOM
const tunerHud = document.getElementById('tunerHud');
const tunerTargetLabel = document.getElementById('tunerTargetLabel');
const tunerStatusText = document.getElementById('tunerStatusText');
const tunerMeterPointer = document.getElementById('tunerMeterPointer');
const tunerHzDisplay = document.getElementById('tunerHzDisplay');
const tunerStringBtns = document.querySelectorAll('.tuner-string-btn');
let isTuning = false;
let currentTunerStringNum = null;
let tunerTargetFreq = 82.41;

// インフォモーダルDOM
const infoModal = document.getElementById('infoModal');
const infoModalTitle = document.getElementById('infoModalTitle');
const infoModalBody = document.getElementById('infoModalBody');
const closeInfoModalBtn = document.getElementById('closeInfoModalBtn');
const openAboutBtn = document.getElementById('openAboutBtn');
const openPrivacyBtn = document.getElementById('openPrivacyBtn');
const openContactBtn = document.getElementById('openContactBtn');

// --- メトロノーム音量初期化 (LocalStorage連動) ---
const savedVol = localStorage.getItem("guitar_metro_volume");
if (savedVol !== null) {
    const volNum = parseFloat(savedVol);
    setMetronomeVolume(volNum);
    if (metroVolSlider) metroVolSlider.value = volNum;
    if (metroVolVal) metroVolVal.innerText = `${Math.round(volNum * 100)}%`;
}

if (metroVolSlider) {
    metroVolSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        setMetronomeVolume(val);
        if (metroVolVal) metroVolVal.innerText = `${Math.round(val * 100)}%`;
        localStorage.setItem("guitar_metro_volume", val);
    });
}

// --- alphaTab 設定 ---
const api = new alphaTab.AlphaTabApi(document.getElementById('alphaTab'), {
    core: { engine: 'svg' },
    display: { staveProfile: 'Tab', scale: 1.0 }
});

let isUserUploadedXml = false;

api.scoreLoaded.on((score) => {
    if (isUserUploadedXml) {
        const extracted = extractNotesFromScore(score);
        if (extracted.length > 0) {
            currentNotes = extracted;
            renderQueue(currentNotes, currentIndex, notesQueueEl);
            alert(`MusicXMLから ${extracted.length} 音を読み込みました！`);
        }
        isUserUploadedXml = false;
    }
});

api.renderFinished.on(() => {
    if (isChallenging) {
        updateTabCursor(currentIndex);
    }
});

function extractNotesFromScore(score) {
    const list = [];
    if (!score.tracks || score.tracks.length === 0) return list;
    const track = score.tracks[0];
    let currentBeatOffset = 0;
    for (const staff of track.staves) {
        for (const bar of staff.bars) {
            for (const voice of bar.voices) {
                for (const beat of voice.beats) {
                    if (!beat.isRest) {
                        for (const note of beat.notes) {
                            const stringNum = note.string;
                            const fretNum = note.fret;
                            const midi = note.realValue ?? (defaultTuning[stringNum] + fretNum);
                            const name = noteStrings[midi % 12];
                            const octave = Math.floor(midi / 12) - 1;
                            list.push({
                                midi, name, octave,
                                fullName: `${name}${octave}`,
                                string: stringNum, fret: fretNum,
                                beat: currentBeatOffset
                            });
                        }
                    }
                    currentBeatOffset += (beat.duration / 4);
                }
            }
        }
    }
    return list;
}

function renderStageTab(stage) {
    if (!stage) return;
    if (stage.tex) {
        api.tex(stage.tex);
    } else {
        const notesTex = stage.defaultNotes.map(n => `${n.fret}.${n.string}`).join(' ');
        api.tex(`\\title "${stage.title}" . :4 ${notesTex} |`);
    }
}

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    isUserUploadedXml = true;
    const reader = new FileReader();
    reader.onload = (event) => api.load(new Uint8Array(event.target.result));
    reader.readAsArrayBuffer(file);
});

// --- 難易度切り替え ---
function getCurrentStages() {
    if (currentLevel === 1) return STAGES_LEVEL1;
    if (currentLevel === 2) return STAGES_LEVEL2;
    return STAGES_LEVEL3;
}

function getClearedList() {
    if (currentLevel === 1) return saveData.level1;
    if (currentLevel === 2) return saveData.level2;
    return saveData.level3;
}

function switchLevel(level) {
    if (currentLevel === level) return;
    currentLevel = level;

    closePlayModal();
    stopTuner();

    levelTabs.forEach(tab => {
        tab.classList.toggle('active', Number(tab.dataset.level) === currentLevel);
    });

    if (currentLevel === 1) {
        headerLevelTitle.innerText = "🎸 難易度 1 : 音程入門編";
        headerLevelDesc.innerText = "全ステージ合格を目指して、焦らず自分のペースでピッキングを身につけよう！";
        progressLabelText.innerText = "難易度1のクリア進捗";
        bpmBadge.classList.add('hidden');
        rhythmJudgeBadge.classList.add('hidden');
    } else if (currentLevel === 2) {
        headerLevelTitle.innerText = "⏱️ 難易度 2 : リズム基礎編";
        headerLevelDesc.innerText = "メトロノームのビートに合わせてカウントイン！正確なタイミングで弦をヒットしよう！";
        progressLabelText.innerText = "難易度2のクリア進捗";
        rhythmJudgeBadge.classList.remove('hidden');
        rhythmJudgeBadge.innerText = "READY";
        rhythmJudgeBadge.className = "rhythm-judge";
    } else {
        headerLevelTitle.innerText = "🎼 難易度 3 : コード入門編";
        headerLevelDesc.innerText = "基本コードをしっかり鳴らそう！ストロークとコードチェンジの響きをマスター！";
        progressLabelText.innerText = "難易度3のクリア進捗";
        bpmBadge.classList.add('hidden');
        rhythmJudgeBadge.classList.add('hidden');
    }

    currentStageIndex = 0;
    renderStages();
    selectStage(0);
}

levelTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const lvl = Number(tab.dataset.level);
        if (lvl) switchLevel(lvl);
    });
});

function renderStages() {
    renderStagesUI({
        stages: getCurrentStages(),
        clearedList: getClearedList(),
        currentStageIndex,
        stagesGrid,
        progressPercentEl,
        progressBarFill,
        onSelectStage: openPlayModal
    });
}

function selectStage(index) {
    currentStageIndex = index;
    const stages = getCurrentStages();
    const stage = stages[index];
    if (!stage) return;

    stopChallenge();

    currentStageBadge.innerText = `EX ${stage.id}`;
    currentStageTitle.innerText = stage.title;
    currentStageDesc.innerText = stage.desc;

    if (stage.bpm) {
        bpmBadge.innerText = `BPM ${stage.bpm}`;
        bpmBadge.classList.remove('hidden');
    } else {
        bpmBadge.classList.add('hidden');
    }

    guideTitle.innerText = `${stage.title.split(': ')[0]} の練習のコツ & 攻略ポイント`;
    guideContent.innerHTML = `
        <p style="margin-top: 0;">${stage.guide.content}</p>
        <div class="guide-point-box">
            <div class="guide-point-title">目標クリア基準</div>
            <div>${currentLevel === 3
                ? (stage.mode === 'patternA' 
                    ? `4カウントに合わせて、1拍目で『ジャラーン』！4拍間しっかり余韻を響かせましょう。`
                    : `メトロノームのビートに合わせて小節ごとにコードチェンジ！全小節綺麗にストロークしよう。`)
                : (currentLevel === 2 
                    ? `メトロノームのリズムに合わせて正確にヒット！PERFECT & GOOD判定をたくさん出してクリアしよう。`
                    : `全音を落ち着いて正確に鳴らすと合格！指をしっかり立てて綺麗な音を出しましょう。`)}</div>
        </div>
    `;

    guideContent.classList.add('hidden');
    guideArrow.innerText = "▼";

    currentNotes = [...stage.defaultNotes];
    currentIndex = 0;

    renderStages();
    renderQueue(currentNotes, currentIndex, notesQueueEl);
    renderStageTab(stage);
}

// ==========================================
// ★ 動くTAB譜面カーソル制御 ★
// ==========================================
function updateTabCursor(noteIndex) {
    if (!scoreCursor || !isChallenging) {
        if (scoreCursor) scoreCursor.classList.add('hidden');
        return;
    }

    try {
        const track = api.score?.tracks?.[0];
        if (track && api.renderer && api.renderer.boundsLookup) {
            const allBeats = [];
            for (const staff of track.staves) {
                for (const bar of staff.bars) {
                    for (const voice of bar.voices) {
                        for (const beat of voice.beats) {
                            if (!beat.isRest && beat.notes.length > 0) {
                                allBeats.push(beat);
                            }
                        }
                    }
                }
            }

            const targetBeat = allBeats[noteIndex];
            if (targetBeat) {
                const bounds = api.renderer.boundsLookup.getBeatBounds(targetBeat);
                if (bounds && bounds.visualBounds) {
                    const vb = bounds.visualBounds;
                    const scoreWrapper = document.querySelector('.score-wrapper');
                    const wrapperRect = scoreWrapper.getBoundingClientRect();
                    const alphaTabEl = document.getElementById('alphaTab');
                    const alphaRect = alphaTabEl.getBoundingClientRect();

                    const offsetX = alphaRect.left - wrapperRect.left;
                    const offsetY = alphaRect.top - wrapperRect.top;

                    scoreCursor.style.left = `${vb.x + offsetX - 6}px`;
                    scoreCursor.style.top = `${vb.y + offsetY - 4}px`;
                    scoreCursor.style.width = `${Math.max(26, vb.w + 12)}px`;
                    scoreCursor.style.height = `${Math.max(28, vb.h + 8)}px`;
                    scoreCursor.classList.remove('hidden');
                    return;
                }
            }
        }
    } catch (e) {}

    try {
        const texts = document.querySelectorAll('#alphaTab svg text');
        const fretTexts = Array.from(texts).filter(t => /^[0-9]+$/.test(t.textContent.trim()));
        if (fretTexts[noteIndex]) {
            const el = fretTexts[noteIndex];
            const rect = el.getBoundingClientRect();
            const wrapperRect = document.querySelector('.score-wrapper').getBoundingClientRect();

            scoreCursor.style.left = `${rect.left - wrapperRect.left - 6}px`;
            scoreCursor.style.top = `${rect.top - wrapperRect.top - 4}px`;
            scoreCursor.style.width = `${Math.max(24, rect.width + 12)}px`;
            scoreCursor.style.height = `${Math.max(26, rect.height + 8)}px`;
            scoreCursor.classList.remove('hidden');
            return;
        }
    } catch (err) {}
}

function triggerCursorHit() {
    if (!scoreCursor) return;
    scoreCursor.classList.add('hit');
    setTimeout(() => scoreCursor.classList.remove('hit'), 180);
}

// ==========================================
// ★ 演奏ポップアップモーダル開閉 ★
// ==========================================
function openPlayModal(index) {
    stopTuner();
    selectStage(index);
    playModal.classList.remove('hidden');

    setTimeout(() => {
        const stage = getCurrentStages()[index];
        renderStageTab(stage);
    }, 60);
}

function closePlayModal() {
    stopChallenge();
    playModal.classList.add('hidden');
    if (recordedPlayer) recordedPlayer.pause();
}

closePlayModalBtn.addEventListener('click', closePlayModal);

playModal.addEventListener('click', (e) => {
    if (e.target === playModal && !isChallenging) {
        closePlayModal();
    }
});

guideToggleBtn.addEventListener('click', () => {
    const isClosed = guideContent.classList.toggle('hidden');
    guideArrow.innerText = isClosed ? "▼" : "▲";
});

// --- 録音開始・停止処理 ---
function startRecording(stream) {
    if (!window.MediaRecorder || !stream) return;
    recordedChunks = [];
    try {
        let mimeType = '';
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
            mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            mimeType = 'audio/mp4';
        }

        mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            if (recordedChunks.length > 0) {
                const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
                if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
                recordedAudioUrl = URL.createObjectURL(blob);
                if (recordedPlayer) {
                    recordedPlayer.src = recordedAudioUrl;
                    if (modalAudioSection) modalAudioSection.classList.remove('hidden');
                }
            }
        };

        mediaRecorder.start();
    } catch (err) {
        console.warn("録音の初期化に失敗しました:", err);
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        try {
            mediaRecorder.stop();
        } catch (e) {
            console.warn("録音停止警告:", e);
        }
    }
}

// チャレンジの停止・リセット
function stopChallenge() {
    isChallenging = false;
    isCountingIn = false;

    releaseWakeLock();
    stopRecording();
    stopPcmCapture();

    rhythmTimerIds.forEach(id => clearTimeout(id));
    rhythmTimerIds = [];

    if (playModalContent) playModalContent.classList.remove('playing');
    if (scoreCursor) scoreCursor.classList.add('hidden');

    hudCard.classList.add('hidden');
    countInOverlay.classList.add('hidden');
    startChallengeBtn.innerText = "🎤 チャレンジ開始";
    startChallengeBtn.classList.remove('btn-stop');
    currentIndex = 0;
    renderQueue(currentNotes, currentIndex, notesQueueEl);
}

function stopTuner() {
    isTuning = false;
    currentTunerStringNum = null;
    tunerHud.classList.add('hidden');
    tunerStringBtns.forEach(btn => btn.classList.remove('active'));
}

// --- チャレンジボタン制御 ---
['click', 'touchstart'].forEach(eventType => {
    startChallengeBtn.addEventListener(eventType, async (e) => {
        if (e.type === 'click' && 'ontouchstart' in window) return;
        if (e.type === 'touchstart') e.preventDefault();

        if (isChallenging) {
            stopChallenge();
            return;
        }

        stopTuner();
        unlockAudioContext();
        await requestWakeLock();

        try {
            if (!microphoneStream) {
                microphoneStream = await navigator.mediaDevices.getUserMedia({
                    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
                });
            }
            await setupMicrophoneStream(microphoneStream);

            isChallenging = true;
            currentIndex = 0;
            setIsWaitingForNewAttack(false);

            if (playModalContent) playModalContent.classList.add('playing');

            hudCard.classList.remove('hidden');
            startChallengeBtn.innerText = "⏹️ チャレンジ中止";
            startChallengeBtn.classList.add('btn-stop');

            renderQueue(currentNotes, currentIndex, notesQueueEl);
            updateTargetUI(currentNotes, currentIndex, targetNoteEl, targetInfoEl);
            updateTabCursor(currentIndex);

            startRecording(microphoneStream);

            const stage = getCurrentStages()[currentStageIndex];

            if (currentLevel === 3) {
                if (stage.mode === 'patternA') {
                    startPatternAChallenge(stage);
                } else {
                    startPatternBChallenge(stage);
                }
            } else if (currentLevel === 2) {
                startLevel2RhythmChallenge();
            } else {
                countInOverlay.classList.add('hidden');
                rhythmJudgeBadge.classList.add('hidden');
                detectPitchLoopLevel1();
            }
        } catch (err) {
            console.error("マイク初期化失敗:", err);
            alert("マイクへのアクセスが拒否されたか、利用できません。ブラウザの設定でマイクを許可してください。");
            stopChallenge();
        }
    }, { passive: false });
});

// ==========================================
// 難易度3 パターンA：1コードずつ丁寧にクリア
// ==========================================
let patternAChordIndex = 0;

function runSingleChordStep(stage) {
    if (!isChallenging) return;

    const chordName = stage.chords[patternAChordIndex];
    const bpm = stage.bpm || 60;
    const beatSec = 60 / bpm;
    const beatMs = beatSec * 1000;

    isCountingIn = true;
    countInOverlay.classList.remove('hidden');

    targetNoteEl.innerText = chordName;
    targetInfoEl.innerText = `1拍目でジャラーン！ (${patternAChordIndex + 1} / ${stage.chords.length})`;

    rhythmJudgeBadge.classList.remove('hidden');
    rhythmJudgeBadge.innerText = "READY";
    rhythmJudgeBadge.className = "rhythm-judge";

    renderQueue(currentNotes, patternAChordIndex, notesQueueEl);
    updateTabCursor(patternAChordIndex);

    let count = 4;
    triggerCountInPulse(countInNumber, count);

    const startTime = audioContext.currentTime + 0.05;
    for (let i = 0; i < 4; i++) {
        scheduleTick(startTime + i * beatSec, i === 0);
    }

    const countInterval = setInterval(() => {
        if (!isChallenging) { clearInterval(countInterval); return; }
        count--;
        if (count > 0) {
            triggerCountInPulse(countInNumber, count);
        } else {
            clearInterval(countInterval);
            countInOverlay.classList.add('hidden');
            isCountingIn = false;

            startPcmCapture();

            scheduleTick(audioContext.currentTime, true);
            showRhythmJudge("STRUM!", rhythmJudgeBadge);
            triggerCursorHit();

            const strumStart = audioContext.currentTime;
            for (let b = 1; b < 4; b++) {
                scheduleTick(strumStart + b * beatSec, false);
            }

            const endTimer = setTimeout(() => {
                if (isChallenging) {
                    finishSingleChordStep(stage, chordName);
                }
            }, 4 * beatMs + 1000);
            rhythmTimerIds.push(endTimer);
        }
    }, beatMs);

    rhythmTimerIds.push(countInterval);
}

function startPatternAChallenge(stage) {
    patternAChordIndex = 0;
    runSingleChordStep(stage);
}

// ★ 難易度3 パターンA：ドラムロール演出を追加 ★
function finishSingleChordStep(stage, chordName) {
    const pcmData = stopPcmCapture();

    rhythmJudgeBadge.classList.remove('hidden');
    rhythmJudgeBadge.innerText = "JUDGING... 🥁";
    rhythmJudgeBadge.className = "rhythm-judge judging";
    playDrumroll(1.1);

    setTimeout(() => {
        playCymbalCrash();
        const evalResult = evaluateRecordedChordData(pcmData, { chordName });

        if (evalResult.isPass) {
            patternAChordIndex++;
            if (patternAChordIndex < stage.chords.length) {
                playSuccessSound();
                triggerCursorHit();
                showRhythmJudge("GOOD!", rhythmJudgeBadge);
                targetInfoEl.innerText = `ナイス！次は ${stage.chords[patternAChordIndex]} をセットしよう...`;
                
                const waitTimer = setTimeout(() => {
                    if (isChallenging) runSingleChordStep(stage);
                }, 2500);
                rhythmTimerIds.push(waitTimer);
            } else {
                handleChordStageClear(evalResult, stage);
            }
        } else {
            handleChordStageClear(evalResult, stage);
        }
    }, 1100);
}

// ==========================================
// 難易度3 パターンB：小節ごとのストローク進行
// ==========================================
function startPatternBChallenge(stage) {
    const bpm = stage.bpm || 60;
    const beatSec = 60 / bpm;
    const beatMs = beatSec * 1000;
    const progression = stage.progression;
    const totalBeats = progression.length * 4;

    isCountingIn = true;
    countInOverlay.classList.remove('hidden');

    targetNoteEl.innerText = progression[0].chord;
    targetInfoEl.innerText = `1小節目: ${progression[0].chord}`;

    rhythmJudgeBadge.classList.remove('hidden');
    rhythmJudgeBadge.innerText = "READY";
    rhythmJudgeBadge.className = "rhythm-judge";

    let count = 4;
    triggerCountInPulse(countInNumber, count);

    const startTime = audioContext.currentTime + 0.05;
    for (let i = 0; i < 4; i++) {
        scheduleTick(startTime + i * beatSec, i === 0);
    }

    const countInterval = setInterval(() => {
        if (!isChallenging) { clearInterval(countInterval); return; }
        count--;
        if (count > 0) {
            triggerCountInPulse(countInNumber, count);
        } else {
            clearInterval(countInterval);
            countInOverlay.classList.add('hidden');
            isCountingIn = false;

            startPcmCapture();

            const songStart = audioContext.currentTime;

            for (let b = 0; b < totalBeats; b++) {
                const isBarStart = (b % 4 === 0);
                scheduleTick(songStart + b * beatSec, isBarStart);
            }

            progression.forEach((item, idx) => {
                const changeTimer = setTimeout(() => {
                    if (!isChallenging) return;
                    targetNoteEl.innerText = item.chord;
                    targetInfoEl.innerText = `${item.bar}小節目: ${item.chord}`;
                    showRhythmJudge("STRUM!", rhythmJudgeBadge);
                    renderQueue(currentNotes, idx, notesQueueEl);
                    updateTabCursor(idx);
                    triggerCursorHit();
                }, idx * 4 * beatMs);
                rhythmTimerIds.push(changeTimer);
            });

            const endTimer = setTimeout(() => {
                if (isChallenging) {
                    finishPatternBChallenge(stage);
                }
            }, totalBeats * beatMs + 1200);
            rhythmTimerIds.push(endTimer);
        }
    }, beatMs);

    rhythmTimerIds.push(countInterval);
}

function finishPatternBChallenge(stage) {
    isChallenging = false;
    stopRecording();
    const pcmData = stopPcmCapture();

    rhythmJudgeBadge.classList.remove('hidden');
    rhythmJudgeBadge.innerText = "JUDGING... 🥁";
    rhythmJudgeBadge.className = "rhythm-judge judging";

    playDrumroll(1.3);

    setTimeout(() => {
        playCymbalCrash();
        const evalResult = evaluateProgressionPcmData(pcmData, stage);
        handleChordStageClear(evalResult, stage);
    }, 1300);
}

function handleChordStageClear(evalResult, stage) {
    stopChallenge();

    const { isPass, score, detail } = evalResult;
    const clearedList = getClearedList();
    const hanamaruContainer = document.querySelector('.hanamaru-container');
    const hanamaruIcon = document.querySelector('.hanamaru-icon');
    const hanamaruText = document.querySelector('.hanamaru-text');

    if (isPass) {
        if (!clearedList.includes(stage.id)) {
            clearedList.push(stage.id);
            localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
        }

        renderStages();

        if (window.confetti) {
            window.confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 } });
        }
        playVictoryFanfare();

        if (hanamaruContainer) hanamaruContainer.classList.remove('retry');
        if (hanamaruIcon) hanamaruIcon.innerText = "💮";
        if (hanamaruText) hanamaruText.innerText = "たいへんよくできました！";

        // 修正後（ステージ名がキレイに入るよう改善）
const stageName = stage.title.split(': ')[1] || stage.title;
modalTitle.innerText = `🎉 ${stageName} 習得完了！（スコア: ${score}点）`;
        modalDesc.innerText = detail;

        const isLast = currentStageIndex === getCurrentStages().length - 1;
        if (isLast) nextStageBtn.classList.add('hidden');
        else nextStageBtn.classList.remove('hidden');
    } else {
        if (hanamaruContainer) hanamaruContainer.classList.add('retry');
        if (hanamaruIcon) hanamaruIcon.innerText = "💪";
        if (hanamaruText) hanamaruText.innerText = "あと一歩！もう一度！";

        modalTitle.innerText = `RETRY CHALLENGE（スコア: ${score}点）`;
        modalDesc.innerText = detail;
        nextStageBtn.classList.add('hidden');
    }

    modalScoreStats.classList.add('hidden');
    clearModal.classList.remove('hidden');
}

// --- 難易度1 ピッチ判定ループ ---
// js/app.js 内の detectPitchLoopLevel1

function detectPitchLoopLevel1() {
    if (!isChallenging || (currentLevel !== 1 && currentLevel !== 3)) return;

    analyser.getFloatTimeDomainData(audioBuffer);

    let sum = 0;
    for (let i = 0; i < audioBuffer.length; i++) sum += audioBuffer[i] * audioBuffer[i];
    const currentRms = Math.sqrt(sum / audioBuffer.length);

    // ★ 4弦〜1弦のやさしいタッチでもアタックと判定できるよう感度調整
    const isAttack = (currentRms - prevRms > 0.005) && (currentRms > 0.008);
    if (currentRms < 0.007) setIsWaitingForNewAttack(false);

    const freq = autoCorrelate(audioBuffer, audioContext.sampleRate, currentRms);

    if (freq > 60 && freq < 1200) {
        const midiNum = 12 * (Math.log2(freq / 440)) + 69;
        const roundedMidi = Math.round(midiNum);
        const name = noteStrings[roundedMidi % 12];
        const octave = Math.floor(roundedMidi / 12) - 1;

        detectedNoteEl.innerText = `${name}${octave}`;
        detectedHzEl.innerText = freq.toFixed(1) + " Hz";

        const target = currentNotes[currentIndex];
        const now = Date.now();

        const isOctaveMatch = (target.midi === 40 && roundedMidi === 52) || (target.midi === 45 && roundedMidi === 57);

        if (roundedMidi === target.midi || isOctaveMatch) {
            if (now - lastNoteClearedTime > 150) {
                if (!isWaitingForNewAttack || isAttack) {
                    playSuccessSound();
                    triggerCursorHit();
                    setLastNoteClearedTime(now);
                    setIsWaitingForNewAttack(true);
                    nextNoteLevel1();
                }
            }
        }
    }

    setPrevRms(currentRms * 0.6 + prevRms * 0.4);
    requestAnimationFrame(detectPitchLoopLevel1);
}

function nextNoteLevel1() {
    if (detectedPill) {
        detectedPill.classList.add('match');
        setTimeout(() => detectedPill.classList.remove('match'), 150);
    }

    currentIndex++;

    if (currentIndex >= currentNotes.length) {
        isChallenging = false;
        renderQueue(currentNotes, currentIndex, notesQueueEl);
        targetNoteEl.innerText = "✨";
        targetInfoEl.innerText = "ナイス！";
        if (scoreCursor) scoreCursor.classList.add('hidden');

        setTimeout(() => {
            handleFinishSequence();
        }, 1800);
    } else {
        renderQueue(currentNotes, currentIndex, notesQueueEl);
        updateTargetUI(currentNotes, currentIndex, targetNoteEl, targetInfoEl);
        updateTabCursor(currentIndex);
    }
}

// --- 難易度2 リズム判定ロジック ---
function startLevel2RhythmChallenge() {
    const stage = getCurrentStages()[currentStageIndex];
    const bpm = stage.bpm || 60;
    const beatSec = 60 / bpm;

    rhythmStats = { perfect: 0, good: 0, miss: 0 };
    isCountingIn = true;
    countInOverlay.classList.remove('hidden');

    rhythmJudgeBadge.classList.remove('hidden');
    rhythmJudgeBadge.innerText = "READY";
    rhythmJudgeBadge.className = "rhythm-judge";

    let count = 4;
    triggerCountInPulse(countInNumber, count);

    const startTime = audioContext.currentTime + 0.05;
    for (let i = 0; i < 4; i++) {
        scheduleTick(startTime + i * beatSec, i === 0);
    }

    const countInterval = setInterval(() => {
        if (!isChallenging) { clearInterval(countInterval); return; }
        count--;
        if (count > 0) {
            triggerCountInPulse(countInNumber, count);
        } else {
            clearInterval(countInterval);
            countInOverlay.classList.add('hidden');
            isCountingIn = false;
            updateTabCursor(currentIndex);
            startRhythmPlayback(bpm, beatSec);
        }
    }, beatSec * 1000);

    rhythmTimerIds.push(countInterval);
}

function startRhythmPlayback(bpm, beatSec) {
    rhythmSongStartTime = audioContext.currentTime;

    const totalBeats = 4;
    for (let b = 0; b < totalBeats; b++) {
        scheduleTick(rhythmSongStartTime + b * beatSec, b === 0);
    }

    detectPitchLoopLevel2(beatSec);
    scheduleMissCheck(beatSec);
}

// js/app.js 内の detectPitchLoopLevel2

function detectPitchLoopLevel2(beatSec) {
    if (!isChallenging || currentLevel !== 2 || isCountingIn) return;

    analyser.getFloatTimeDomainData(audioBuffer);

    let sum = 0;
    for (let i = 0; i < audioBuffer.length; i++) sum += audioBuffer[i] * audioBuffer[i];
    const currentRms = Math.sqrt(sum / audioBuffer.length);

    // ★ 感度向上
    const isAttack = (currentRms - prevRms > 0.005) && (currentRms > 0.008);
    if (currentRms < 0.007) setIsWaitingForNewAttack(false);

    const freq = autoCorrelate(audioBuffer, audioContext.sampleRate, currentRms);

    if (freq > 60 && freq < 1200) {
        const midiNum = 12 * (Math.log2(freq / 440)) + 69;
        const roundedMidi = Math.round(midiNum);
        const name = noteStrings[roundedMidi % 12];
        const octave = Math.floor(roundedMidi / 12) - 1;

        detectedNoteEl.innerText = `${name}${octave}`;
        detectedHzEl.innerText = freq.toFixed(1) + " Hz";

        if (currentIndex < currentNotes.length) {
            const target = currentNotes[currentIndex];
            const isOctaveMatch = (target.midi === 40 && roundedMidi === 52) || (target.midi === 45 && roundedMidi === 57);

            if ((roundedMidi === target.midi || isOctaveMatch) && (!isWaitingForNewAttack || isAttack)) {
                const nowSec = audioContext.currentTime;
                const expectedSec = rhythmSongStartTime + (target.beat * beatSec);
                const diff = nowSec - expectedSec;

                if (Math.abs(diff) <= 0.28) {
                    setIsWaitingForNewAttack(true);
                    if (Math.abs(diff) <= 0.12) {
                        rhythmStats.perfect++;
                        showRhythmJudge("PERFECT", rhythmJudgeBadge);
                    } else {
                        rhythmStats.good++;
                        showRhythmJudge("GOOD", rhythmJudgeBadge);
                    }

                    playSuccessSound();
                    triggerCursorHit();
                    advanceNoteLevel2();
                }
            }
        }
    }

    setPrevRms(currentRms * 0.6 + prevRms * 0.4);
    requestAnimationFrame(() => detectPitchLoopLevel2(beatSec));
}

function scheduleMissCheck(beatSec) {
    const checkInterval = setInterval(() => {
        if (!isChallenging || currentLevel !== 2 || isCountingIn) {
            clearInterval(checkInterval);
            return;
        }

        if (currentIndex < currentNotes.length) {
            const target = currentNotes[currentIndex];
            const nowSec = audioContext.currentTime;
            const expectedSec = rhythmSongStartTime + (target.beat * beatSec);

            if (nowSec > expectedSec + 0.32) {
                rhythmStats.miss++;
                showRhythmJudge("MISS", rhythmJudgeBadge);
                advanceNoteLevel2();
            }
        } else {
            clearInterval(checkInterval);
        }
    }, 50);

    rhythmTimerIds.push(checkInterval);
}

function advanceNoteLevel2() {
    if (detectedPill) {
        detectedPill.classList.add('match');
        setTimeout(() => detectedPill.classList.remove('match'), 150);
    }

    currentIndex++;

    if (currentIndex >= currentNotes.length) {
        isChallenging = false;
        renderQueue(currentNotes, currentIndex, notesQueueEl);
        targetNoteEl.innerText = "✨";
        targetInfoEl.innerText = "演奏終了！";
        if (scoreCursor) scoreCursor.classList.add('hidden');

        setTimeout(() => {
            handleFinishSequence();
        }, 1500);
    } else {
        renderQueue(currentNotes, currentIndex, notesQueueEl);
        updateTargetUI(currentNotes, currentIndex, targetNoteEl, targetInfoEl);
        updateTabCursor(currentIndex);
    }
}

// 演奏終了判定シーケンス
function handleFinishSequence() {
    isChallenging = false;
    isCountingIn = false;
    rhythmTimerIds.forEach(id => clearTimeout(id));
    rhythmTimerIds = [];

    rhythmJudgeBadge.classList.remove('hidden');
    rhythmJudgeBadge.innerText = "FINISH! 🥁";
    rhythmJudgeBadge.className = "rhythm-judge judging";

    playDrumroll(1.3);

    setTimeout(() => {
        stopRecording();
        playCymbalCrash();
        handleStageClear();
    }, 1200);
}

// ステージクリア / リトライ処理
function handleStageClear() {
    stopChallenge();

    const stages = getCurrentStages();
    const currentStage = stages[currentStageIndex];
    const clearedList = getClearedList();

    const hanamaruContainer = document.querySelector('.hanamaru-container');
    const hanamaruIcon = document.querySelector('.hanamaru-icon');
    const hanamaruText = document.querySelector('.hanamaru-text');

    let isSuccess = true;
    if (currentLevel === 2) {
        const hitCount = rhythmStats.perfect + rhythmStats.good;
        const total = currentNotes.length;
        if (hitCount < Math.ceil(total * 0.5)) {
            isSuccess = false;
        }
    }

    if (isSuccess) {
        if (!clearedList.includes(currentStage.id)) {
            clearedList.push(currentStage.id);
            localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
        }

        renderStages();

        if (window.confetti) {
            window.confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 } });
        }
        playVictoryFanfare();

        if (hanamaruContainer) hanamaruContainer.classList.remove('retry');
        if (hanamaruIcon) hanamaruIcon.innerText = "💮";
        if (hanamaruText) hanamaruText.innerText = "たいへんよくできました！";

        modalTitle.innerText = `🎉 EX ${currentStage.id} 習得完了！`;
        if (currentLevel === 1) {
            modalDesc.innerText = "ナイスピッキング！音程が正確に鳴らせています。";
        } else if (currentLevel === 2) {
            modalDesc.innerText = "リズム感バッチリ！メトロノームに合わせたピッキングが身についています。";
        } else {
            modalDesc.innerText = "コードフォームがバッチリ！綺麗な和音が響いています。";
        }

        const isLast = currentStageIndex === stages.length - 1;
        if (isLast) nextStageBtn.classList.add('hidden');
        else nextStageBtn.classList.remove('hidden');
    } else {
        if (hanamaruContainer) hanamaruContainer.classList.add('retry');
        if (hanamaruIcon) hanamaruIcon.innerText = "💪";
        if (hanamaruText) hanamaruText.innerText = "あと一歩！もう一度！";

        modalTitle.innerText = "RETRY CHALLENGE";
        modalDesc.innerText = "惜しい！指をしっかり立ててリトライしてみよう！";
        nextStageBtn.classList.add('hidden');
    }

    if (currentLevel === 2) {
        modalScoreStats.classList.remove('hidden');
        statPerfect.innerText = rhythmStats.perfect;
        statGood.innerText = rhythmStats.good;
        statMiss.innerText = rhythmStats.miss;
    } else {
        modalScoreStats.classList.add('hidden');
    }

    clearModal.classList.remove('hidden');
}

// クリアモーダル操作
nextStageBtn.addEventListener('click', () => {
    if (recordedPlayer) recordedPlayer.pause();
    clearModal.classList.add('hidden');
    openPlayModal(currentStageIndex + 1);
});

retryBtn.addEventListener('click', () => {
    if (recordedPlayer) recordedPlayer.pause();
    clearModal.classList.add('hidden');
    selectStage(currentStageIndex);
});

resetProgressBtn.addEventListener('click', () => {
    const levelNames = { 1: "難易度1", 2: "難易度2", 3: "難易度3" };
    const levelName = levelNames[currentLevel] || `難易度${currentLevel}`;
    if (confirm(`${levelName}のクリア進捗をリセットしますか？`)) {
        if (currentLevel === 1) saveData.level1 = [];
        else if (currentLevel === 2) saveData.level2 = [];
        else saveData.level3 = [];
        localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
        closePlayModal();
        selectStage(0);
    }
});

// --- 簡易チューナー機能 ---
async function selectTunerString(stringNum, midi, noteName) {
    if (isTuning && currentTunerStringNum === stringNum) {
        stopTuner();
        return;
    }

    closePlayModal();
    resetTunerSmoothing();

    currentTunerStringNum = stringNum;
    tunerTargetFreq = midiToFrequency(midi);

    tunerTargetLabel.innerText = `${stringNum}弦 (${noteName}) に合わせ中 (目標: ${tunerTargetFreq.toFixed(1)}Hz)`;
    tunerStatusText.innerText = "音をポロンと鳴らしてください";
    tunerStatusText.style.color = "#fbbf24";
    tunerMeterPointer.style.left = "50%";
    tunerHud.classList.remove('hidden');

    tunerStringBtns.forEach(btn => {
        btn.classList.toggle('active', Number(btn.dataset.string) === stringNum);
    });

    unlockAudioContext();
    try {
        if (!microphoneStream) {
            microphoneStream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
            });
        }
        await setupMicrophoneStream(microphoneStream);

        if (!isTuning) {
            isTuning = true;
            tunePitchLoop();
        }
    } catch (err) {
        alert("マイクの利用を許可してください。");
        stopTuner();
    }
}

tunerStringBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const sNum = Number(btn.dataset.string);
        const midi = Number(btn.dataset.midi);
        const note = btn.dataset.note;
        if (sNum && midi && note) selectTunerString(sNum, midi, note);
    });
});

// js/app.js 内の tunePitchLoop

// js/app.js 内の tunePitchLoop を修正

function tunePitchLoop() {
    if (!isTuning) return;

    analyser.getFloatTimeDomainData(audioBuffer);

    let sum = 0;
    for (let i = 0; i < audioBuffer.length; i++) sum += audioBuffer[i] * audioBuffer[i];
    const rms = Math.sqrt(sum / audioBuffer.length);

    // ★ 0.007 -> 0.003 に引き下げて、1弦〜2弦の小さな生音でも即座にメーターが反応するように改善
    if (rms > 0.003) {
        const freq = autoCorrelate(audioBuffer, audioContext.sampleRate, rms);

        if (freq > 50 && freq < 1000) {
            updateTunerUI({
                freq,
                tunerTargetFreq,
                tunerHzDisplay,
                tunerMeterPointer,
                tunerStatusText,
                onInTunePing: playTunerPing
            });
        }
    }

    requestAnimationFrame(tunePitchLoop);
}

// --- 運営情報・利用規約モーダル ---
openAboutBtn.addEventListener('click', () => {
    infoModalTitle.innerText = "運営者情報";
    infoModalBody.innerHTML = `
        <p>当サイト「ギター練習ナビ」をご利用いただきありがとうございます。</p>
        <table class="info-table">
            <tr><th>サイト名</th><td>ギター練習ナビ (Guitar Practice Navi)</td></tr>
            <tr><th>運営者</th><td>ギター練習ナビ 運営事務局</td></tr>
            <tr><th>サイトの目的</th><td>ギター初心者が焦らず楽しく基礎ピッキングとリズム感を習得できる無料練習Webアプリ。</td></tr>
            <tr><th>開設日</th><td>2025年</td></tr>
        </table>
    `;
    infoModal.classList.remove('hidden');
});

openPrivacyBtn.addEventListener('click', () => {
    infoModalTitle.innerText = "プライバシーポリシー & 免責事項";
    infoModalBody.innerHTML = `
        <h4>1. マイク音声データの取り扱いについて</h4>
        <p>当サイトでは音高（ピッチ）判定のためにマイク機能を使用しますが、音声データはすべてご利用の端末（ブラウザ）内でのみ計算・破棄され、サーバーへ送信・保存されることは一切ありません。</p>
        <h4>2. 広告の配信について</h4>
        <p>当サイトでは第三者配信の広告サービスを利用する場合があります。利用者の興味に応じた商品やサービスの広告を表示するため、Cookie（クッキー）を使用することがあります。</p>
        <h4>3. 免責事項</h4>
        <p>当サイトの掲載情報や練習コンテンツの利用によって生じたいかなる損害についても、運営者は一切の責任を負いかねます。</p>
    `;
    infoModal.classList.remove('hidden');
});

openContactBtn.addEventListener('click', () => {
    infoModalTitle.innerText = "お問い合わせ";
    infoModalBody.innerHTML = `
        <p>ご意見・不具合のご報告・ご要望などは下記フォームよりお気軽にお寄せください。</p>
        <form id="contactForm" class="contact-form">
            <div class="form-group"><label>お名前</label><input type="text" class="form-control" required placeholder="例: ギター太郎"></div>
            <div class="form-group"><label>メールアドレス</label><input type="email" class="form-control" required placeholder="name@example.com"></div>
            <div class="form-group"><label>内容</label><textarea class="form-control" rows="4" required placeholder="ご自由にご記入ください"></textarea></div>
            <button type="submit" class="contact-submit-btn">送信する</button>
        </form>
    `;
    infoModal.classList.remove('hidden');
    document.getElementById('contactForm').addEventListener('submit', (e) => {
        e.preventDefault();
        alert("お問い合わせありがとうございます！メッセージを受け付けました。");
        infoModal.classList.add('hidden');
    });
});

closeInfoModalBtn.addEventListener('click', () => {
    if (recordedPlayer) recordedPlayer.pause();
    infoModal.classList.add('hidden');
});
infoModal.addEventListener('click', (e) => { 
    if (e.target === infoModal) {
        if (recordedPlayer) recordedPlayer.pause();
        infoModal.classList.add('hidden'); 
    }
});

// 初期実行: 難易度1のステージデータを準備
selectStage(0);