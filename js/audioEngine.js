// ==========================================
// 超ギタートレーニング（超ギタトレ） - 音声処理エンジン (js/audioEngine.js)
// ==========================================

export let audioContext = null;
export let analyser = null;
export let audioBuffer = null;
let wakeLockSentinel = null;
let micSourceNode = null;

// --- 🔊 現在スケジュールされているオシレーターを管理する配列 ---
let activeOscillators = []; 

// --- 🔊 メトロノーム・マスターゲインノード（演奏中のリアルタイム音量調整用） ---
let metroMasterGain = null;

// --- メトロノーム音量ステート (0.0 〜 1.0、デフォルト 0.4 = 40%) ---
let metronomeVolume = 0.4;

function ensureMetroMasterGain() {
    if (!audioContext) return;
    if (!metroMasterGain) {
        metroMasterGain = audioContext.createGain();
        metroMasterGain.gain.setValueAtTime(metronomeVolume, audioContext.currentTime);
        metroMasterGain.connect(audioContext.destination);
    }
}

// ★ 演奏中いつでも即座にメトロノーム全体の音量を反映
export function setMetronomeVolume(val) {
    metronomeVolume = Math.max(0, Math.min(1, val));
    if (audioContext && metroMasterGain) {
        metroMasterGain.gain.cancelScheduledValues(audioContext.currentTime);
        metroMasterGain.gain.setTargetAtTime(metronomeVolume, audioContext.currentTime, 0.01);
    }
}

export function getMetronomeVolume() {
    return metronomeVolume;
}

export async function requestWakeLock() {
    if ("wakeLock" in navigator && !wakeLockSentinel) {
        try { wakeLockSentinel = await navigator.wakeLock.request("screen"); } catch (e) {}
    }
}

export function releaseWakeLock() {
    if (wakeLockSentinel) {
        wakeLockSentinel.release().catch(() => {});
        wakeLockSentinel = null;
    }
}

export async function unlockAudioContext() {
    if (!audioContext) {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioCtxClass();
    }
    if (audioContext.state === "suspended" || audioContext.state === "interrupted") {
        await audioContext.resume();
    }
    
    ensureMetroMasterGain();

    const buffer = audioContext.createBuffer(1, 1, 22050);
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
}

export async function setupMicrophoneStream(existingStream = null) {
    if (analyser && micSourceNode) return;

    const stream = existingStream || await navigator.mediaDevices.getUserMedia({
        audio: { 
            echoCancellation: false, 
            noiseSuppression: false, 
            autoGainControl: false 
        }
    });

    micSourceNode = audioContext.createMediaStreamSource(stream);

    // チューナー用フィルタ
    const lowpass = audioContext.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(2200, audioContext.currentTime);

    const highpass = audioContext.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.setValueAtTime(65, audioContext.currentTime);

    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;

    micSourceNode.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(analyser);

    audioBuffer = new Float32Array(analyser.fftSize);
}

// --- メトロノーム音生成 ---
export function scheduleTick(time, isAccent = false) {
    if (!audioContext) return;
    ensureMetroMasterGain();

    const safeTime = Math.max(time, audioContext.currentTime + 0.005);

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    // 40% (0.4) の時に従来の音量になるベースゲイン設計
    const baseGain = isAccent ? 0.40 : 0.225;

    // 1拍目は高音アクセント(triangle)、2〜4拍目は通常クリック音(sine)
    osc.type = isAccent ? "triangle" : "sine";
    osc.frequency.setValueAtTime(isAccent ? 1320 : 880, safeTime);
    gain.gain.setValueAtTime(baseGain, safeTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, safeTime + 0.045);

    // ★ マスターゲインノードに接続することで演奏中のリアルタイム音量変更を実現！
    osc.connect(gain);
    gain.connect(metroMasterGain);

    osc.start(safeTime);
    osc.stop(safeTime + 0.05);

    activeOscillators.push(osc);
    osc.onended = () => {
        activeOscillators = activeOscillators.filter(item => item !== osc);
    };
}

// --- 🛑 スケジュールされたすべての音を即座に強制停止する関数 ---
export function stopAllScheduledTicks() {
    activeOscillators.forEach(osc => {
        try {
            osc.stop();
        } catch (e) {}
    });
    activeOscillators = [];
}

// ==========================================
// ★ チューナー用 ピッチ検出エンジン ★
// ==========================================
const MAX_CORR_BUFFER_SIZE = 2048;
const corrBuffer = new Float32Array(MAX_CORR_BUFFER_SIZE);

export function autoCorrelate(buf, sampleRate, rms) {
    const SIZE = buf.length;
    if (rms < 0.003) return -1;

    const minPeriod = Math.floor(sampleRate / 1300);
    const maxPeriod = Math.ceil(sampleRate / 65);

    if (maxPeriod >= SIZE) return -1;

    const L = SIZE - maxPeriod;

    for (let i = minPeriod; i <= maxPeriod; i++) {
        let sum = 0;
        for (let j = 0; j < L; j++) {
            sum += buf[j] * buf[j + i];
        }
        corrBuffer[i] = sum;
    }

    let globalMax = -1;
    const peaks = [];
    for (let i = minPeriod + 1; i < maxPeriod - 1; i++) {
        const val = corrBuffer[i];
        if (val > corrBuffer[i - 1] && val > corrBuffer[i + 1] && val > 0) {
            peaks.push({ i, val });
            if (val > globalMax) {
                globalMax = val;
            }
        }
    }

    if (peaks.length === 0 || globalMax <= 0) return -1;

    let bestPeak = null;
    const threshold = globalMax * 0.82;
    for (const p of peaks) {
        if (p.val >= threshold) {
            bestPeak = p;
            break;
        }
    }
    if (!bestPeak) bestPeak = peaks[0];

    let T0 = bestPeak.i;

    const x1 = corrBuffer[T0 - 1];
    const x2 = corrBuffer[T0];
    const x3 = corrBuffer[T0 + 1];
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    if (a !== 0) {
        T0 = T0 - b / (2 * a);
    }

    return sampleRate / T0;
}

export function midiToFrequency(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

export function playTunerPing() {
    if (!audioContext) return;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const t = audioContext.currentTime;

    osc.type = "sine";
    osc.frequency.setValueAtTime(1046.5, t);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.start(t);
    osc.stop(t + 0.4);
}