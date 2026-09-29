// --- 1. ステージ定義 ---
const STAGES = [
    {
        id: 1, title: "EX 1: 6弦開放 (E2)", desc: "一番太い6弦の開放弦を弾いてみよう",
        guide: {
            title: "EX 1: 6弦開放弦ピッキングのコツ",
            content: "ギターで最も太い6弦は、ピックに伝わる手応えが大きいため初心者が最も力みやすい弦です。ピックを力いっぱい振り抜くのではなく、手首の重みを利用して上から下へポロンと落とすようにピッキングしてみましょう。隣の5弦に触れてしまわないよう注意してください。"
        },
        defaultNotes: [
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0 },
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0 },
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0 },
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0 }
        ]
    },
    {
        id: 2, title: "EX 2: 5弦開放 (A2)", desc: "5弦の開放弦を4回ピッキングしてみよう",
        guide: {
            title: "EX 2: 5弦を正確に狙い撃つコツ",
            content: "6弦のすぐ隣にある5弦を狙う練習です。弾こうとしたときに6弦をかすめてしまっていませんか？右手の前腕（肘の手前）をギターのボディのフチに軽く当てて支点を作ると、右手の位置が安定して狙った弦だけを正確にヒットできるようになります。"
        },
        defaultNotes: [
            { midi: 45, name: "A", octave: 2, fullName: "A2", string: 5, fret: 0 },
            { midi: 45, name: "A", octave: 2, fullName: "A2", string: 5, fret: 0 },
            { midi: 45, name: "A", octave: 2, fullName: "A2", string: 5, fret: 0 },
            { midi: 45, name: "A", octave: 2, fullName: "A2", string: 5, fret: 0 }
        ]
    },
    {
        id: 3, title: "EX 3: 4弦開放 (D3)", desc: "4弦の開放弦をピッキング",
        guide: {
            title: "EX 3: 中音域への移動と深さコントロール",
            content: "4弦はギターのちょうど真ん中に位置する弦です。巻き弦のピッキングを均一な音量で鳴らせるように、ピックが弦に入り込む深さを毎回2〜3mmで一定にキープしましょう。"
        },
        defaultNotes: [
            { midi: 50, name: "D", octave: 3, fullName: "D3", string: 4, fret: 0 },
            { midi: 50, name: "D", octave: 3, fullName: "D3", string: 4, fret: 0 },
            { midi: 50, name: "D", octave: 3, fullName: "D3", string: 4, fret: 0 },
            { midi: 50, name: "D", octave: 3, fullName: "D3", string: 4, fret: 0 }
        ]
    },
    {
        id: 4, title: "EX 4: 3弦開放 (G3)", desc: "3弦の開放弦を鳴らしてみよう",
        guide: {
            title: "EX 4: プレーン弦特有の感触に慣れよう",
            content: "エレキギターでは3弦からプレーン弦になることが多く、太い巻き弦と比べてピックがツルッと滑りやすくなります。弦の芯をしっかり捉えて弾きましょう。"
        },
        defaultNotes: [
            { midi: 55, name: "G", octave: 3, fullName: "G3", string: 3, fret: 0 },
            { midi: 55, name: "G", octave: 3, fullName: "G3", string: 3, fret: 0 },
            { midi: 55, name: "G", octave: 3, fullName: "G3", string: 3, fret: 0 },
            { midi: 55, name: "G", octave: 3, fullName: "G3", string: 3, fret: 0 }
        ]
    },
    {
        id: 5, title: "EX 5: 2弦開放 (B3)", desc: "2弦の開放弦をクリアしよう",
        guide: {
            title: "EX 5: 繊細なタッチと脱力",
            content: "細い高音弦は力を入れすぎるとピッチが高くなってしまいます。ピックを握る力を緩め、弦を優しく弾くリラックスしたフォームを意識しましょう。"
        },
        defaultNotes: [
            { midi: 59, name: "B", octave: 3, fullName: "B3", string: 2, fret: 0 },
            { midi: 59, name: "B", octave: 3, fullName: "B3", string: 2, fret: 0 },
            { midi: 59, name: "B", octave: 3, fullName: "B3", string: 2, fret: 0 },
            { midi: 59, name: "B", octave: 3, fullName: "B3", string: 2, fret: 0 }
        ]
    },
    {
        id: 6, title: "EX 6: 1弦開放 (E4)", desc: "一番細い1弦の開放弦を弾こう",
        guide: {
            title: "EX 6: 1弦の引っかかりを防ぐ振り抜き",
            content: "一番外側の1弦は、ピックを下へ振り抜いたときに空振りしがちです。ピックは下方向に潜り込ませず、弦の表面を斜め下に向かってサラリと通過させましょう。"
        },
        defaultNotes: [
            { midi: 64, name: "E", octave: 4, fullName: "E4", string: 1, fret: 0 },
            { midi: 64, name: "E", octave: 4, fullName: "E4", string: 1, fret: 0 },
            { midi: 64, name: "E", octave: 4, fullName: "E4", string: 1, fret: 0 },
            { midi: 64, name: "E", octave: 4, fullName: "E4", string: 1, fret: 0 }
        ]
    },
    {
        id: 7, title: "EX 7: 低音弦コンボ (6〜4弦)", desc: "6弦 ➔ 5弦 ➔ 4弦 と順番に弾き分け",
        guide: {
            title: "EX 7: 弦移動（ストリング・トラッキング）の極意",
            content: "弦から弦へと右手を移動させる練習です。手首の角度を変えて無理に届かせようとせず、右腕全体をほんの少し下へスライドさせて移動するのが安定のコツです。"
        },
        defaultNotes: [
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0 },
            { midi: 45, name: "A", octave: 2, fullName: "A2", string: 5, fret: 0 },
            { midi: 50, name: "D", octave: 3, fullName: "D3", string: 4, fret: 0 },
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0 }
        ]
    },
    {
        id: 8, title: "EX 8: 高音弦コンボ (3〜1弦)", desc: "3弦 ➔ 2弦 ➔ 1弦 を順番に弾こう",
        guide: {
            title: "EX 8: 高音弦での安定したピッキング往復",
            content: "ソロやアルペジオで頻繁に使う3〜1弦の移動です。音が途切れないように、前の音の響きを意識しながら次の弦へリズミカルにピックを当てていきましょう。"
        },
        defaultNotes: [
            { midi: 55, name: "G", octave: 3, fullName: "G3", string: 3, fret: 0 },
            { midi: 59, name: "B", octave: 3, fullName: "B3", string: 2, fret: 0 },
            { midi: 64, name: "E", octave: 4, fullName: "E4", string: 1, fret: 0 },
            { midi: 59, name: "B", octave: 3, fullName: "B3", string: 2, fret: 0 }
        ]
    },
    {
        id: 9, title: "EX 9: 全開放アルペジオ (6➔1弦)", desc: "6弦から1弦まで流れるようにピッキング！",
        guide: {
            title: "EX 9: 全弦を駆け抜けるピッキング",
            content: "6本の弦すべてを順番に弾く、難易度1の集大成です。一定のスピード・同じ音量で最後まで均一に弾ききれるかチャレンジしてください！"
        },
        defaultNotes: [
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0 },
            { midi: 45, name: "A", octave: 2, fullName: "A2", string: 5, fret: 0 },
            { midi: 50, name: "D", octave: 3, fullName: "D3", string: 4, fret: 0 },
            { midi: 55, name: "G", octave: 3, fullName: "G3", string: 3, fret: 0 },
            { midi: 59, name: "B", octave: 3, fullName: "B3", string: 2, fret: 0 },
            { midi: 64, name: "E", octave: 4, fullName: "E4", string: 1, fret: 0 }
        ]
    },
    {
        id: 10, title: "EX 10: 難易度1 卒業テスト", desc: "開放弦マスターの最終チャレンジ！",
        guide: {
            title: "EX 10: 難易度1 卒業テスト！",
            content: "6弦 ➔ 4弦 ➔ 2弦 ➔ 1弦 と弦をスキップして跳躍するテストです。手元を見ずに目的の弦を正確にヒットできたら難易度1クリアです！"
        },
        defaultNotes: [
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0 },
            { midi: 50, name: "D", octave: 3, fullName: "D3", string: 4, fret: 0 },
            { midi: 59, name: "B", octave: 3, fullName: "B3", string: 2, fret: 0 },
            { midi: 64, name: "E", octave: 4, fullName: "E4", string: 1, fret: 0 }
        ]
    }
];

// --- 2. 状態管理 & セーブデータ ---
const SAVE_KEY = "guitar_app_save_data";
let saveData = JSON.parse(localStorage.getItem(SAVE_KEY)) || { cleared: [], stars: {} };

let currentStageIndex = 0;
let currentNotes = [];
let currentIndex = 0;
let isChallenging = false;

let startTime = 0;
let timerInterval = null;

let audioContext, analyser, audioBuffer;
let prevRms = 0;
let isWaitingForNewAttack = false;
let lastNoteClearedTime = 0;
const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const defaultTuning = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 };

// DOM要素
const stagesGrid = document.getElementById('stagesGrid');
const progressPercentEl = document.getElementById('progressPercent');
const progressBarFill = document.getElementById('progressBarFill');
const resetProgressBtn = document.getElementById('resetProgressBtn');

const currentStageBadge = document.getElementById('currentStageBadge');
const currentStageTitle = document.getElementById('currentStageTitle');
const currentStageDesc = document.getElementById('currentStageDesc');
const fileInput = document.getElementById('fileInput');
const startChallengeBtn = document.getElementById('startChallengeBtn');

const guideTitle = document.getElementById('guideTitle');
const guideContent = document.getElementById('guideContent');

const hudCard = document.getElementById('hudCard');
const timerDisplay = document.getElementById('timerDisplay');
const targetNoteEl = document.getElementById('targetNote');
const targetInfoEl = document.getElementById('targetInfo');
const detectedBox = document.querySelector('.detected-box');
const detectedNoteEl = document.getElementById('detectedNote');
const detectedHzEl = document.getElementById('detectedHz');
const notesQueueEl = document.getElementById('notesQueue');

const clearModal = document.getElementById('clearModal');
const modalTitle = document.getElementById('modalTitle');
const modalStars = document.getElementById('modalStars');
const clearTimeText = document.getElementById('clearTimeText');
const nextStageBtn = document.getElementById('nextStageBtn');
const retryBtn = document.getElementById('retryBtn');

// インフォモーダル関連DOM
const infoModal = document.getElementById('infoModal');
const infoModalTitle = document.getElementById('infoModalTitle');
const infoModalBody = document.getElementById('infoModalBody');
const closeInfoModalBtn = document.getElementById('closeInfoModalBtn');
const openAboutBtn = document.getElementById('openAboutBtn');
const openPrivacyBtn = document.getElementById('openPrivacyBtn');
const openContactBtn = document.getElementById('openContactBtn');

// alphaTab
const api = new alphaTab.AlphaTabApi(document.getElementById('alphaTab'), {
    core: { engine: 'svg' },
    display: { staveProfile: 'Tab', scale: 1.0 }
});

api.scoreLoaded.on((score) => {
    const extracted = extractNotesFromScore(score);
    if (extracted.length > 0) {
        currentNotes = extracted;
        renderQueue();
        alert(`MusicXMLから ${extracted.length} 音を読み込みました！`);
    }
});

function extractNotesFromScore(score) {
    const list = [];
    if (!score.tracks || score.tracks.length === 0) return list;
    const track = score.tracks[0];
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
                            list.push({ midi, name, octave, fullName: `${name}${octave}`, string: stringNum, fret: fretNum });
                        }
                    }
                }
            }
        }
    }
    return list;
}

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => api.load(new Uint8Array(event.target.result));
    reader.readAsArrayBuffer(file);
});

// --- 3. ステージ選択UI ---
function renderStages() {
    stagesGrid.innerHTML = '';
    const maxUnlocked = saveData.cleared.length + 1;

    STAGES.forEach((stage, idx) => {
        const isCleared = saveData.cleared.includes(stage.id);
        const isLocked = stage.id > maxUnlocked;
        const isActive = idx === currentStageIndex;
        const starCount = saveData.stars[stage.id] || 0;
        const starsStr = starCount > 0 ? "★".repeat(starCount) + "☆".repeat(3 - starCount) : "";

        const btn = document.createElement('div');
        btn.className = `stage-btn ${isCleared ? 'cleared' : ''} ${isLocked ? 'locked' : ''} ${isActive ? 'active' : ''}`;

        let statusText = isCleared ? "✅ クリア" : (isLocked ? "🔒 ロック" : "🟢 挑戦可能");

        btn.innerHTML = `
            <div class="stage-btn-top">
                <span>EX ${stage.id}</span>
                <span>${statusText}</span>
            </div>
            <div class="stage-btn-title">${stage.title.split(': ')[1] || stage.title}</div>
            ${starsStr ? `<div class="stage-stars">${starsStr}</div>` : ''}
        `;

        if (!isLocked) {
            btn.addEventListener('click', () => selectStage(idx));
        }

        stagesGrid.appendChild(btn);
    });

    const percent = Math.round((saveData.cleared.length / STAGES.length) * 100);
    progressPercentEl.innerText = `${percent}% (${saveData.cleared.length} / ${STAGES.length})`;
    progressBarFill.style.width = `${percent}%`;
}

function selectStage(index) {
    currentStageIndex = index;
    const stage = STAGES[index];

    currentStageBadge.innerText = `EX ${stage.id}`;
    currentStageTitle.innerText = stage.title;
    currentStageDesc.innerText = stage.desc;

    guideTitle.innerText = stage.guide.title;
    guideContent.innerHTML = `
        <p>${stage.guide.content}</p>
        <div class="guide-point-box">
            <div class="guide-point-title">目標クリア基準</div>
            <div>全${stage.defaultNotes.length}音を正確にピッキングすると自動クリア！手首を柔らかく使って挑戦しましょう。</div>
        </div>
    `;

    currentNotes = [...stage.defaultNotes];
    currentIndex = 0;
    isChallenging = false;
    clearInterval(timerInterval);
    hudCard.classList.add('hidden');
    startChallengeBtn.disabled = false;
    startChallengeBtn.innerText = "🎤 チャレンジ開始";

    renderStages();
    renderQueue();
}

// --- 4. チャレンジ開始 & 音声判定 ---
startChallengeBtn.addEventListener('click', async () => {
    if (isChallenging) return;
    await initAudio();
    isChallenging = true;
    currentIndex = 0;
    isWaitingForNewAttack = false;
    hudCard.classList.remove('hidden');
    startChallengeBtn.disabled = true;
    startChallengeBtn.innerText = "判定中...";

    startTime = Date.now();
    timerInterval = setInterval(() => {
        const sec = ((Date.now() - startTime) / 1000).toFixed(1);
        timerDisplay.innerText = sec;
    }, 100);

    renderQueue();
    updateTargetUI();
    detectPitchLoop();
});

async function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') await audioContext.resume();
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    audioBuffer = new Float32Array(analyser.fftSize);
}

function detectPitchLoop() {
    if (!isChallenging) return;

    analyser.getFloatTimeDomainData(audioBuffer);

    let sum = 0;
    for (let i = 0; i < audioBuffer.length; i++) sum += audioBuffer[i] * audioBuffer[i];
    const currentRms = Math.sqrt(sum / audioBuffer.length);

    const isAttack = (currentRms - prevRms > 0.015) && (currentRms > 0.02);
    if (currentRms < 0.015) isWaitingForNewAttack = false;

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

        if (roundedMidi === target.midi) {
            if (now - lastNoteClearedTime > 150) {
                if (!isWaitingForNewAttack || isAttack) {
                    playSuccessSound();
                    lastNoteClearedTime = now;
                    isWaitingForNewAttack = true;
                    nextNote();
                }
            }
        }
    }

    prevRms = currentRms * 0.6 + prevRms * 0.4;
    requestAnimationFrame(detectPitchLoop);
}

function nextNote() {
    detectedBox.classList.add('match');
    setTimeout(() => detectedBox.classList.remove('match'), 150);

    currentIndex++;

    if (currentIndex >= currentNotes.length) {
        handleStageClear();
    } else {
        renderQueue();
        updateTargetUI();
    }
}

function handleStageClear() {
    isChallenging = false;
    clearInterval(timerInterval);
    const elapsedSec = (Date.now() - startTime) / 1000;
    clearTimeText.innerText = `${elapsedSec.toFixed(1)} 秒`;

    const currentStage = STAGES[currentStageIndex];

    const noteCount = currentNotes.length;
    let stars = 1;
    if (elapsedSec <= noteCount * 1.5) {
        stars = 3;
    } else if (elapsedSec <= noteCount * 2.5) {
        stars = 2;
    }

    if (!saveData.cleared.includes(currentStage.id)) {
        saveData.cleared.push(currentStage.id);
    }
    const prevStars = saveData.stars[currentStage.id] || 0;
    saveData.stars[currentStage.id] = Math.max(prevStars, stars);
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));

    renderStages();

    if (window.confetti) {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    }

    playVictoryFanfare();

    modalTitle.innerText = `🎉 EX ${currentStage.id} 合格！`;
    modalStars.innerText = "★".repeat(stars) + "☆".repeat(3 - stars);

    const isLast = currentStageIndex === STAGES.length - 1;
    if (isLast) {
        nextStageBtn.classList.add('hidden');
    } else {
        nextStageBtn.classList.remove('hidden');
    }

    clearModal.classList.remove('hidden');
}

function updateTargetUI() {
    const target = currentNotes[currentIndex];
    targetNoteEl.innerText = target.fullName;
    targetInfoEl.innerText = `${target.string}弦 ${target.fret}フレット`;
}

function renderQueue() {
    notesQueueEl.innerHTML = '';
    currentNotes.forEach((n, idx) => {
        const badge = document.createElement('div');
        badge.className = 'note-badge';
        badge.innerText = `${idx + 1}. ${n.fullName}`;
        if (idx < currentIndex) badge.classList.add('cleared');
        if (idx === currentIndex) badge.classList.add('current');
        notesQueueEl.appendChild(badge);
    });
}

function playSuccessSound() {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.frequency.setValueAtTime(880, audioContext.currentTime);
    gain.gain.setValueAtTime(0.08, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start();
    osc.stop(audioContext.currentTime + 0.15);
}

function playVictoryFanfare() {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const t = audioContext.currentTime + i * 0.1;
        const dur = (i === notes.length - 1) ? 0.5 : 0.12;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.start(t);
        osc.stop(t + dur);
    });
}

nextStageBtn.addEventListener('click', () => {
    clearModal.classList.add('hidden');
    selectStage(currentStageIndex + 1);
});

retryBtn.addEventListener('click', () => {
    clearModal.classList.add('hidden');
    selectStage(currentStageIndex);
});

resetProgressBtn.addEventListener('click', () => {
    if (confirm("クリア進捗と★記録をすべてリセットしますか？")) {
        saveData = { cleared: [], stars: {} };
        localStorage.removeItem(SAVE_KEY);
        selectStage(0);
    }
});

function autoCorrelate(buf, sampleRate, rms) {
    let SIZE = buf.length;
    if (rms < 0.015) return -1;
    let r1 = 0, r2 = SIZE - 1, thres = 0.2;
    for (let i = 0; i < SIZE / 2; i++) {
        if (Math.abs(buf[i]) < thres) { r1 = i; break; }
    }
    for (let i = 1; i < SIZE / 2; i++) {
        if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
    }
    buf = buf.slice(r1, r2);
    SIZE = buf.length;
    let c = new Float32Array(SIZE);
    for (let i = 0; i < SIZE; i++) {
        for (let j = 0; j < SIZE - i; j++) c[i] = c[i] + buf[j] * buf[j + i];
    }
    let d = 0;
    while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < SIZE; i++) {
        if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
    }
    let T0 = maxpos;
    let x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
    let a = (x1 + x3 - 2 * x2) / 2;
    let b = (x3 - x1) / 2;
    if (a) T0 = T0 - b / (2 * a);
    return sampleRate / T0;
}

// --- 5. 運営情報・プライバシーポリシー・お問い合わせモーダル ---
openAboutBtn.addEventListener('click', () => {
    infoModalTitle.innerText = "運営者情報";
    infoModalBody.innerHTML = `
        <p>当サイト「ギター練習ナビ」をご利用いただきありがとうございます。</p>
        <table class="info-table">
            <tr>
                <th>サイト名</th>
                <td>ギター練習ナビ (Guitar Practice Navi)</td>
            </tr>
            <tr>
                <th>運営者</th>
                <td>ギター練習ナビ 運営事務局</td>
            </tr>
            <tr>
                <th>サイトの目的</th>
                <td>ギターを始めたばかりの初心者が、ゲーム感覚で基礎ピッキングを楽しく習得できる練習環境の提供。</td>
            </tr>
            <tr>
                <th>開設日</th>
                <td>2025年</td>
            </tr>
        </table>
    `;
    infoModal.classList.remove('hidden');
});

openPrivacyBtn.addEventListener('click', () => {
    infoModalTitle.innerText = "プライバシーポリシー & 免責事項";
    infoModalBody.innerHTML = `
        <h4>1. マイク音声データの取り扱いについて</h4>
        <p>当サイトでは音高（ピッチ）のリアルタイム判定のためにマイク機能を使用しますが、音声データはすべてご利用の端末（ブラウザ）内でのみ計算・破棄され、サーバーへ送信・保存されることは一切ありません。</p>

        <h4>2. 広告の配信について</h4>
        <p>当サイトでは第三者配信の広告サービス（Google AdSense等）を利用する場合があります。広告配信事業者は、利用者の興味に応じた商品やサービスの広告を表示するため、Cookie（クッキー）を使用することがあります。</p>

        <h4>3. アクセス解析について</h4>
        <p>サイトの改善を目的としてGoogle Analytics等のアクセス解析ツールを使用する場合があります。これらはトラフィックデータの収集のためにCookieを使用しますが、個人を特定する情報は含まれません。</p>

        <h4>4. 免責事項</h4>
        <p>当サイトの掲載情報や練習コンテンツの利用によって生じたいかなる損害についても、運営者は一切の責任を負いかねます。あらかじめご了承ください。</p>
    `;
    infoModal.classList.remove('hidden');
});

openContactBtn.addEventListener('click', () => {
    infoModalTitle.innerText = "お問い合わせ";
    infoModalBody.innerHTML = `
        <p>ご意見・不具合のご報告・ご要望などは下記フォームよりお気軽にお寄せください。</p>
        <form id="contactForm" class="contact-form">
            <div class="form-group">
                <label>お名前 (ニックネーム可)</label>
                <input type="text" class="form-control" required placeholder="例: ギター太郎">
            </div>
            <div class="form-group">
                <label>メールアドレス</label>
                <input type="email" class="form-control" required placeholder="name@example.com">
            </div>
            <div class="form-group">
                <label>お問い合わせ内容</label>
                <textarea class="form-control" rows="4" required placeholder="不具合報告やリクエストなどをご記入ください"></textarea>
            </div>
            <button type="submit" class="contact-submit-btn">送信する</button>
        </form>
    `;
    infoModal.classList.remove('hidden');

    document.getElementById('contactForm').addEventListener('submit', (e) => {
        e.preventDefault();
        alert("お問い合わせありがとうございます！メッセージを受け付けました。（※本番公開時はFormspreeやGoogleフォームと連携して自動受信できます）");
        infoModal.classList.add('hidden');
    });
});

closeInfoModalBtn.addEventListener('click', () => {
    infoModal.classList.add('hidden');
});

infoModal.addEventListener('click', (e) => {
    if (e.target === infoModal) {
        infoModal.classList.add('hidden');
    }
});

// 初期実行
selectStage(0);