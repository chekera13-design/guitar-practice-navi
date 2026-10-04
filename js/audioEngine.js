// ==========================================
// ギター練習ドットコム - 音声処理エンジン (js/audioEngine.js)
// ==========================================

export let audioContext = null;
export let analyser = null;
export let audioBuffer = null;
let wakeLockSentinel = null;
let micSourceNode = null;
let activeMicStream = null;

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

// 演奏中いつでも即座にメトロノーム全体の音量を反映
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

// ==========================================
// ★ マイクストリームの作成と接続（サンプリングレート自動適応版） ★
// ==========================================
export async function setupMicrophoneStream(existingStream = null) {
    // すでに存在し、かつ現在の環境に適したfftSizeが設定されている場合はスキップ
    if (analyser && micSourceNode && activeMicStream) return activeMicStream;

    const stream = existingStream || await navigator.mediaDevices.getUserMedia({
        audio: { 
            echoCancellation: false, 
            noiseSuppression: false, 
            autoGainControl: false 
        }
    });

    activeMicStream = stream;
    micSourceNode = audioContext.createMediaStreamSource(stream);

    // チューナー用フィルタ
    const lowpass = audioContext.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(2200, audioContext.currentTime);

    const highpass = audioContext.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.setValueAtTime(65, audioContext.currentTime);

    analyser = audioContext.createAnalyser();
    
    // ★【修正】サンプリング周波数に応じて fftSize を動的に変更
    // 44.1k/48k ➔ 2048, 96k ➔ 4096, 192k ➔ 8192 とすることで低音域を確実にカバー
    if (audioContext.sampleRate >= 192000) {
        analyser.fftSize = 8192;
    } else if (audioContext.sampleRate >= 96000) {
        analyser.fftSize = 4096;
    } else {
        analyser.fftSize = 2048;
    }

    micSourceNode.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(analyser);

    // ★【重要】拡張された fftSize に合わせてFloat32Arrayのサイズを確保
    audioBuffer = new Float32Array(analyser.fftSize);
    return stream;
}

// マイクのトラックを停止してバッテリー消費・マイク常時使用を抑える
export function stopMicrophoneStream() {
    if (activeMicStream) {
        activeMicStream.getTracks().forEach(track => track.stop());
        activeMicStream = null;
    }
    if (micSourceNode) {
        try { micSourceNode.disconnect(); } catch (e) {}
        micSourceNode = null;
    }
    analyser = null;
    audioBuffer = null;
}

// --- メトロノーム音生成 ---
export function scheduleTick(time, isAccent = false) {
    if (!audioContext) return;
    ensureMetroMasterGain();

    const safeTime = Math.max(time, audioContext.currentTime + 0.005);

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    // 停止時に0になったマスター音量を、現在の設定値（metronomeVolume）に一瞬で戻す
    metroMasterGain.gain.setValueAtTime(metronomeVolume, audioContext.currentTime);

    // 40% (0.4) の時に従来の音量になるベースゲイン設計
    const baseGain = isAccent ? 0.40 : 0.225;

    // 1拍目は高音アクセント(triangle)、2〜4拍目は通常クリック音(sine)
    osc.type = isAccent ? "triangle" : "sine";
    osc.frequency.setValueAtTime(isAccent ? 1320 : 880, safeTime);
    gain.gain.setValueAtTime(baseGain, safeTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, safeTime + 0.045);

    osc.connect(gain);
    gain.connect(metroMasterGain);

    osc.start(safeTime);
    osc.stop(safeTime + 0.05);

    activeOscillators.push(osc);
    osc.onended = () => {
        activeOscillators = activeOscillators.filter(item => item !== osc);
    };
}


// スケジュールされたすべての音を即座に強制停止する関数
export function stopAllScheduledTicks() {
    // 1. 発音中のオシレーターをすべて停止
    activeOscillators.forEach(osc => {
        try {
            osc.stop();
            osc.disconnect(); 
        } catch (e) {}
    });
    activeOscillators = [];

    // 2. 音量ノードに予約されている未来の音量変化スケジュールをすべてキャンセル
    if (metroMasterGain && audioContext) {
        try {
            metroMasterGain.gain.cancelScheduledValues(audioContext.currentTime);
            // 未来の予約音を確実に消音するため、現在の時間で音量を一度0にする
            metroMasterGain.gain.setValueAtTime(0, audioContext.currentTime);
        } catch (e) {}
    }
}



// ==========================================
// ★ チューナー用 ピッチ検出エンジン ★
// ==========================================
const MAX_CORR_BUFFER_SIZE = 8192; 
const corrBuffer = new Float32Array(MAX_CORR_BUFFER_SIZE);

export function autoCorrelate(buf, sampleRate, rms) {
    const SIZE = buf.length; 
    if (rms < 0.003) return -1;

    const minPeriod = Math.floor(sampleRate / 1300);
    let maxPeriod = Math.min(MAX_CORR_BUFFER_SIZE - 1, Math.ceil(sampleRate / 65));

    // ★【修正】常に一律リターンするのではなく、配列の最大サイズを超えないよう安全に丸め込む
    if (maxPeriod >= SIZE) {
        maxPeriod = SIZE - 1;
    }
    
    // 念のため、最小周期が最大周期を逆転してしまった場合のみ安全にリターンする
    if (minPeriod >= maxPeriod) return -1;

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

    if (Math.abs(a) > 1e-5) {
        T0 = T0 - b / (2 * a);
    }

    if (!T0 || T0 <= 0 || !Number.isFinite(T0)) return -1;

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