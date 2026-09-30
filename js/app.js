// ==========================================
// ギター練習ナビ - メインアプリケーション (js/app.js)
// ==========================================

import { STAGES_LEVEL1, STAGES_LEVEL2, STAGES_LEVEL3, noteStrings, defaultTuning, SAVE_KEY } from './config.js';
import { 
    unlockAudioContext, setupMicrophoneStream, playTick, scheduleTick, playSuccessSound, 
    playVictoryFanfare, playDrumroll, playCymbalCrash, autoCorrelate, midiToFrequency,
    evaluateRecordedChordData, requestWakeLock, releaseWakeLock,
    audioContext, analyser, audioBuffer, prevRms, isWaitingForNewAttack, lastNoteClearedTime,
    setPrevRms, setIsWaitingForNewAttack, setLastNoteClearedTime
} from './audioEngine.js';
import { renderQueue, updateTargetUI, showRhythmJudge, renderStagesUI, updateTunerUI } from './ui.js';

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

const hudCard = document.getElementById('hudCard');
const countInOverlay = document.getElementById('countInOverlay');
const countInNumber = document.getElementById('countInNumber');
const targetNoteEl = document.getElementById('targetNote');
const targetInfoEl = document.getElementById('targetInfo');
const rhythmJudgeBadge = document.getElementById('rhythmJudgeBadge');
const detectedBox = document.querySelector('.detected-box');
const detectedNoteEl = document.getElementById('detectedNote');
const detectedHzEl = document.getElementById('detectedHz');
const notesQueueEl = document.getElementById('notesQueue');

const guideTitle = document.getElementById('guideTitle');
const guideContent = document.getElementById('guideContent');

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

// --- 難易度切り替え (switchLevel) ---
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

    stopChallenge();
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

// 難易度タブのイベント登録
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
        onSelectStage: selectStage
    });
}

function selectStage(index) {
    currentStageIndex = index;
    const stages = getCurrentStages();
    const stage = stages[index];

    stopChallenge();
    stopTuner();

    currentStageBadge.innerText = `EX ${stage.id}`;
    currentStageTitle.innerText = stage.title;
    currentStageDesc.innerText = stage.desc;

    if (stage.bpm) {
        bpmBadge.innerText = `BPM ${stage.bpm}`;
        bpmBadge.classList.remove('hidden');
    } else {
        bpmBadge.classList.add('hidden');
    }

    guideTitle.innerText = stage.guide.title;
    guideContent.innerHTML = `
        <p>${stage.guide.content}</p>
        <div class="guide-point-box">
            <div class="guide-point-title">目標クリア基準</div>
            <div>${stage.type === 'chord_strum'
                ? `4カウントに合わせて、1拍目で『ジャラーン』！4拍間しっかり余韻を響かせましょう。`
                : (currentLevel === 2 
                    ? `メトロノームのリズムに合わせて正確にヒット！PERFECT & GOOD判定をたくさん出してクリアしよう。`
                    : `全音を落ち着いて正確に鳴らすと合格！指をしっかり立てて綺麗な音を出しましょう。`)}</div>
        </div>
    `;

    currentNotes = [...stage.defaultNotes];
    currentIndex = 0;

    renderStages();
    renderQueue(currentNotes, currentIndex, notesQueueEl);
    renderStageTab(stage);
}

// --- 録音開始・停止処理 (iOS Safari フォールバック対応) ---
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

    rhythmTimerIds.forEach(id => clearTimeout(id));
    rhythmTimerIds = [];

    hudCard.classList.add('hidden');
    countInOverlay.classList.add('hidden');
    startChallengeBtn.innerText = "🎤 チャレンジ開始";
    startChallengeBtn.classList.remove('btn-stop');
    currentIndex = 0;
    renderQueue(currentNotes, currentIndex, notesQueueEl);
}

// チューナーの停止
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

            hudCard.classList.remove('hidden');
            startChallengeBtn.innerText = "⏹️ チャレンジ中止";
            startChallengeBtn.classList.add('btn-stop');

            renderQueue(currentNotes, currentIndex, notesQueueEl);
            updateTargetUI(currentNotes, currentIndex, targetNoteEl, targetInfoEl);

            startRecording(microphoneStream);

            const stage = getCurrentStages()[currentStageIndex];

            if (stage.type === 'chord_strum') {
                startChordStrumChallenge(stage);
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
// 難易度3用：和音ストローク判定ロジック
// ==========================================
function startChordStrumChallenge(stage) {
    const bpm = stage.bpm || 60;
    const beatSec = 60 / bpm;
    const beatMs = beatSec * 1000;

    rhythmStats = { perfect: 0, good: 0, miss: 0 };
    isCountingIn = true;
    countInOverlay.classList.remove('hidden');

    targetNoteEl.innerText = stage.chordName || "Chord";
    targetInfoEl.innerText = "1拍目でジャラーン！";

    rhythmJudgeBadge.classList.remove('hidden');
    rhythmJudgeBadge.innerText = "READY";
    rhythmJudgeBadge.className = "rhythm-judge";

    let count = 4;
    countInNumber.innerText = count;

    // 先行スケジューリングで正確な拍を打診
    const startTime = audioContext.currentTime + 0.05;
    for (let i = 0; i < 4; i++) {
        scheduleTick(startTime + i * beatSec, i === 0);
    }

    const countInterval = setInterval(() => {
        if (!isChallenging) { clearInterval(countInterval); return; }
        count--;
        if (count > 0) {
            countInNumber.innerText = count;
        } else {
            clearInterval(countInterval);
            countInOverlay.classList.add('hidden');
            isCountingIn = false;

            // 1拍目「ジャラーン」
            scheduleTick(audioContext.currentTime, true);
            showRhythmJudge("STRUM!", rhythmJudgeBadge);

            // 残り3拍のクリック音を先行予約
            const strumStart = audioContext.currentTime;
            for (let b = 1; b < 4; b++) {
                scheduleTick(strumStart + b * beatSec, false);
            }

            // 4拍＋余韻待機後に総合判定へ
            const endTimer = setTimeout(() => {
                if (isChallenging) {
                    finishChordStrumChallenge(stage);
                }
            }, 4 * beatMs + 1500);
            rhythmTimerIds.push(endTimer);
        }
    }, beatMs);

    rhythmTimerIds.push(countInterval);
}

// ストローク演奏終了 ➔ 録音解析 ➔ 合否
async function finishChordStrumChallenge(stage) {
    isChallenging = false;
    stopRecording();

    rhythmJudgeBadge.classList.remove('hidden');
    rhythmJudgeBadge.innerText = "JUDGING... 🥁";
    rhythmJudgeBadge.className = "rhythm-judge judging";

    playDrumroll(1.3);

    setTimeout(async () => {
        playCymbalCrash();
        const evalResult = await evaluateRecordedChord(stage);
        handleChordStageClear(evalResult, stage);
    }, 1300);
}

// 録音データの本格解析（Safari対応 decodeAudioData ラップ）
async function evaluateRecordedChord(stage) {
    // 録音データがない場合は無音と判定して0点！
    if (!recordedChunks || recordedChunks.length === 0) {
        return { 
            score: 0, 
            isPass: false, 
            detail: "音が検知されませんでした。マイクに向かってストロークしてください。" 
        };
    }

    try {
        const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        const arrayBuffer = await blob.arrayBuffer();

        // iOS Safari互換のPromiseラップ
        const decodedBuffer = await new Promise((resolve, reject) => {
            audioContext.decodeAudioData(arrayBuffer, resolve, reject);
        });

        // 本格周波数・クロマベクトル解析を実行
        return evaluateRecordedChordData(decodedBuffer, stage);
    } catch (e) {
        console.warn("録音解析エラー:", e);
        // エラー時も安易に合格にせず、再試行を促す
        return { 
            score: 0, 
            isPass: false, 
            detail: "音声の解析に失敗しました。もう一度鳴らしてください。" 
        };
    }
}

// ストローク専用クリアモーダル表示
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

        modalTitle.innerText = `🎉 ${stage.chordName || 'コード'} 習得完了！（スコア: ${score}点）`;
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
function detectPitchLoopLevel1() {
    if (!isChallenging || (currentLevel !== 1 && currentLevel !== 3)) return;

    analyser.getFloatTimeDomainData(audioBuffer);

    let sum = 0;
    for (let i = 0; i < audioBuffer.length; i++) sum += audioBuffer[i] * audioBuffer[i];
    const currentRms = Math.sqrt(sum / audioBuffer.length);

    const isAttack = (currentRms - prevRms > 0.015) && (currentRms > 0.02);
    if (currentRms < 0.015) setIsWaitingForNewAttack(false);

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

        // 6弦(40)・5弦(45)の1オクターブ上への共振にも柔軟に対応
        const isOctaveMatch = (target.midi === 40 && roundedMidi === 52) || (target.midi === 45 && roundedMidi === 57);

        if (roundedMidi === target.midi || isOctaveMatch) {
            if (now - lastNoteClearedTime > 150) {
                if (!isWaitingForNewAttack || isAttack) {
                    playSuccessSound();
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
    detectedBox.classList.add('match');
    setTimeout(() => detectedBox.classList.remove('match'), 150);

    currentIndex++;

    if (currentIndex >= currentNotes.length) {
        isChallenging = false;
        renderQueue(currentNotes, currentIndex, notesQueueEl);
        targetNoteEl.innerText = "✨";
        targetInfoEl.innerText = "ナイス！そのまま余韻を響かせよう...";

        setTimeout(() => {
            handleFinishSequence();
        }, 2000);
    } else {
        renderQueue(currentNotes, currentIndex, notesQueueEl);
        updateTargetUI(currentNotes, currentIndex, targetNoteEl, targetInfoEl);
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
    countInNumber.innerText = count;

    // カウントインクリック音の先行スケジューリング
    const startTime = audioContext.currentTime + 0.05;
    for (let i = 0; i < 4; i++) {
        scheduleTick(startTime + i * beatSec, i === 0);
    }

    const countInterval = setInterval(() => {
        if (!isChallenging) { clearInterval(countInterval); return; }
        count--;
        if (count > 0) {
            countInNumber.innerText = count;
        } else {
            clearInterval(countInterval);
            countInOverlay.classList.add('hidden');
            isCountingIn = false;
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

function detectPitchLoopLevel2(beatSec) {
    if (!isChallenging || currentLevel !== 2 || isCountingIn) return;

    analyser.getFloatTimeDomainData(audioBuffer);

    let sum = 0;
    for (let i = 0; i < audioBuffer.length; i++) sum += audioBuffer[i] * audioBuffer[i];
    const currentRms = Math.sqrt(sum / audioBuffer.length);

    const isAttack = (currentRms - prevRms > 0.015) && (currentRms > 0.02);
    if (currentRms < 0.015) setIsWaitingForNewAttack(false);

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
    detectedBox.classList.add('match');
    setTimeout(() => detectedBox.classList.remove('match'), 150);

    currentIndex++;

    if (currentIndex >= currentNotes.length) {
        isChallenging = false;
        renderQueue(currentNotes, currentIndex, notesQueueEl);
        targetNoteEl.innerText = "✨";
        targetInfoEl.innerText = "演奏終了！余韻を響かせよう...";

        setTimeout(() => {
            handleFinishSequence();
        }, 1500);
    } else {
        renderQueue(currentNotes, currentIndex, notesQueueEl);
        updateTargetUI(currentNotes, currentIndex, targetNoteEl, targetInfoEl);
    }
}

// 演奏終了判定シーケンス（難易度1・2用）
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

nextStageBtn.addEventListener('click', () => {
    if (recordedPlayer) recordedPlayer.pause();
    clearModal.classList.add('hidden');
    selectStage(currentStageIndex + 1);
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
        selectStage(0);
    }
});

// --- 簡易チューナー機能 (モダンイベントハンドリング) ---
async function selectTunerString(stringNum, midi, noteName) {
    if (isTuning && currentTunerStringNum === stringNum) {
        stopTuner();
        return;
    }

    stopChallenge();

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

function tunePitchLoop() {
    if (!isTuning) return;

    analyser.getFloatTimeDomainData(audioBuffer);

    let sum = 0;
    for (let i = 0; i < audioBuffer.length; i++) sum += audioBuffer[i] * audioBuffer[i];
    const rms = Math.sqrt(sum / audioBuffer.length);

    if (rms > 0.02) {
        const freq = autoCorrelate(audioBuffer, audioContext.sampleRate, rms);

        if (freq > 50 && freq < 1000) {
            updateTunerUI({
                freq,
                tunerTargetFreq,
                tunerHzDisplay,
                tunerMeterPointer,
                tunerStatusText
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

// 初期実行: 難易度1のステージ1を選択
selectStage(0);