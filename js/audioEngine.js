// ==========================================
// ギター練習ナビ - 音声処理・ピッチ検出エンジン (js/audioEngine.js)
// ==========================================
import { noteStrings } from './config.js';

export let audioContext = null;
export let analyser = null;
export let audioBuffer = null;
export let prevRms = 0;
export let isWaitingForNewAttack = false;
export let lastNoteClearedTime = 0;

let wakeLockSentinel = null;

export function setPrevRms(val) { prevRms = val; }
export function setIsWaitingForNewAttack(val) { isWaitingForNewAttack = val; }
export function setLastNoteClearedTime(val) { lastNoteClearedTime = val; }

export async function requestWakeLock() {
    if ('wakeLock' in navigator && !wakeLockSentinel) {
        try { wakeLockSentinel = await navigator.wakeLock.request('screen'); } catch (e) {}
    }
}

export function releaseWakeLock() {
    if (wakeLockSentinel) {
        wakeLockSentinel.release().catch(() => {});
        wakeLockSentinel = null;
    }
}

export function unlockAudioContext() {
    if (!audioContext) {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioCtxClass();
    }
    if (audioContext.state === 'suspended' || audioContext.state === 'interrupted') {
        audioContext.resume();
    }
    const buffer = audioContext.createBuffer(1, 1, 22050);
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
}

export async function setupMicrophoneStream(existingStream = null) {
    if (analyser) return;

    const stream = existingStream || await navigator.mediaDevices.getUserMedia({
        audio: { 
            echoCancellation: false, 
            noiseSuppression: false, 
            autoGainControl: false 
        }
    });

    const source = audioContext.createMediaStreamSource(stream);

    // ギターの音域（70Hz〜1200Hz）を通すバンドパス特性
    const lowpass = audioContext.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(1000, audioContext.currentTime);

    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;

    source.connect(lowpass);
    lowpass.connect(analyser);

    audioBuffer = new Float32Array(analyser.fftSize);
}

export function scheduleTick(time, isAccent = false) {
    if (!audioContext) return;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.frequency.setValueAtTime(isAccent ? 1200 : 800, time);
    gain.gain.setValueAtTime(0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.start(time);
    osc.stop(time + 0.045);
}

export function playTick(isAccent = false) {
    if (!audioContext) return;
    scheduleTick(audioContext.currentTime, isAccent);
}

export function playSuccessSound() {
    if (!audioContext) return;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const t = audioContext.currentTime;

    osc.frequency.setValueAtTime(880, t);
    gain.gain.setValueAtTime(0.09, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.start(t);
    osc.stop(t + 0.15);
}

export function playVictoryFanfare() {
    if (!audioContext) return;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const t = audioContext.currentTime + i * 0.1;
        const dur = (i === notes.length - 1) ? 0.5 : 0.12;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.16, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.start(t);
        osc.stop(t + dur);
    });
}

export function playDrumroll(duration = 1.3) {
    if (!audioContext) return;
    const now = audioContext.currentTime;
    const totalHits = Math.floor(duration * 20);

    for (let i = 0; i < totalHits; i++) {
        const time = now + (i / totalHits) * duration;
        const progress = i / totalHits;

        const bufferSize = Math.floor(audioContext.sampleRate * 0.04);
        const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        for (let j = 0; j < bufferSize; j++) {
            data[j] = (Math.random() * 2 - 1) * (1 - j / bufferSize);
        }

        const noise = audioContext.createBufferSource();
        noise.buffer = buffer;

        const filter = audioContext.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1800 + progress * 800, time);

        const gain = audioContext.createGain();
        const vol = 0.04 + progress * 0.16;
        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.038);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioContext.destination);

        noise.start(time);
    }
}

export function playCymbalCrash() {
    if (!audioContext) return;
    const now = audioContext.currentTime;
    const duration = 1.6;

    const bufferSize = Math.floor(audioContext.sampleRate * duration);
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noise = audioContext.createBufferSource();
    noise.buffer = buffer;

    const filter = audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(4500, now);

    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);

    noise.start(now);

    const kick = audioContext.createOscillator();
    const kickGain = audioContext.createGain();
    kick.frequency.setValueAtTime(130, now);
    kick.frequency.exponentialRampToValueAtTime(40, now + 0.2);
    kickGain.gain.setValueAtTime(0.2, now);
    kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    kick.connect(kickGain);
    kickGain.connect(audioContext.destination);
    kick.start(now);
    kick.stop(now + 0.2);
}

/**
 * 改良型自己相関法 (Autocorrelation) ピッチ検出
 */
export function autoCorrelate(buf, sampleRate, rms) {
    let SIZE = buf.length;
    if (rms < 0.018) return -1;

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
    if (T0 <= 0 || T0 >= SIZE - 1) return -1;

    // 低音弦（E2/A2等）の第2倍音トラップを回避するサブハーモニック検査
    const subT = Math.round(T0 * 2);
    if (subT < SIZE - 1) {
        let localMax = -1;
        let bestSub = subT;
        for (let offset = -4; offset <= 4; offset++) {
            const idx = subT + offset;
            if (idx > 0 && idx < SIZE && c[idx] > localMax) {
                localMax = c[idx];
                bestSub = idx;
            }
        }
        if (localMax > maxval * 0.72) {
            T0 = bestSub;
        }
    }

    let x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
    let a = (x1 + x3 - 2 * x2) / 2;
    let b = (x3 - x1) / 2;
    if (a) T0 = T0 - b / (2 * a);

    return sampleRate / T0;
}

export function midiToFrequency(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

// ==========================================
// ★ 本格コード解析（FFTクロマベクトル解析） ★
// ==========================================

/**
 * コード名から構成音（ピッチクラス 0:C, 1:C# ... 11:B）を定義
 */
const CHORD_PITCH_CLASSES = {
    "Em": [4, 7, 11], // E(4), G(7), B(11)
    "Am": [9, 0, 4],  // A(9), C(0), E(4)
    "E":  [4, 8, 11], // E(4), G#(8), B(11)
    "C":  [0, 4, 7],  // C(0), E(4), G(7)
    "G":  [7, 11, 2], // G(7), B(11), D(2)
    "D":  [2, 6, 9]   // D(2), F#(6), A(9)
};

/**
 * 録音された波形データを本格周波数解析
 * @param {AudioBuffer} audioBufferObj 
 * @param {object} stage 
 */
export function evaluateRecordedChordData(audioBufferObj, stage) {
    const channelData = audioBufferObj.getChannelData(0);
    const sampleRate = audioBufferObj.sampleRate;
    const totalSamples = channelData.length;

    // 1. RMS最大値（アタック検知）と暗騒音チェック
    let maxRms = 0;
    let maxIndex = 0;
    const windowSize = 2048;

    for (let i = 0; i < totalSamples - windowSize; i += 512) {
        let sum = 0;
        for (let j = 0; j < windowSize; j++) {
            const val = channelData[i + j];
            sum += val * val;
        }
        const rms = Math.sqrt(sum / windowSize);
        if (rms > maxRms) {
            maxRms = rms;
            maxIndex = i;
        }
    }

    // ★ 何も弾いていない場合（マイクの部屋ノイズのみ）は即座に0点！
    // ギターをストロークすると通常 0.08 〜 0.40 以上のRMSが出ます。
    if (maxRms < 0.055) {
        return { 
            score: 0, 
            isPass: false, 
            detail: "ギターの音が検知されませんでした。1拍目でしっかりストロークしてみましょう！" 
        };
    }

    // 2. 減衰チェック（ギターの生音・余韻が鳴り続いているか）
    // 手拍子や咳なら100msで消えるが、ギター弦は0.8秒後も振動が残る
    const offsetAfter800ms = maxIndex + Math.floor(sampleRate * 0.8);
    let sustainRms = 0;
    if (offsetAfter800ms + windowSize < totalSamples) {
        let sum = 0;
        for (let j = 0; j < windowSize; j++) {
            const val = channelData[offsetAfter800ms + j];
            sum += val * val;
        }
        sustainRms = Math.sqrt(sum / windowSize);
    }

    const hasSustain = sustainRms > (maxRms * 0.15) && sustainRms > 0.015;

    // 3. FFT（クロマベクトル）による構成音の検出
    // アタック直後（響きが安定した100ms後〜600ms後）の波形を切り出す
    const startAnalysis = Math.min(totalSamples - 4096, maxIndex + Math.floor(sampleRate * 0.1));
    const analysisWindow = channelData.slice(startAnalysis, startAnalysis + 4096);

    // 12半音（C〜B）ごとのエネルギー蓄積バッファ
    const chroma = new Float32Array(12);

    // ギターの音域（70Hz 〜 800Hz）の各音高エネルギーを計算
    for (let midi = 40; midi <= 64; midi++) { // E2(40) 〜 E4(64)
        const freq = midiToFrequency(midi);
        const pitchClass = midi % 12;
        const mag = calculateDFTBin(analysisWindow, sampleRate, freq);
        chroma[pitchClass] += mag;
    }

    // コード構成音の一致度スコアを計算
    const chordName = stage.chordName || "Em";
    const targetPitches = CHORD_PITCH_CLASSES[chordName] || [4, 7, 11]; // デフォルト: Em(E,G,B)

    let targetEnergy = 0;
    let otherEnergy = 0;

    for (let i = 0; i < 12; i++) {
        if (targetPitches.includes(i)) {
            targetEnergy += chroma[i];
        } else {
            otherEnergy += chroma[i];
        }
    }

    const totalEnergy = targetEnergy + otherEnergy;
    let chordMatchRatio = totalEnergy > 0 ? (targetEnergy / totalEnergy) : 0;

    // 4. 厳格なスコアリング
    // 手拍子や環境音、無関係な音の場合、chordMatchRatioは0.3以下になります（12音中3音なので均等だと0.25）
    // Emが綺麗に鳴っていると 0.50 〜 0.75 以上になります。
    let calculatedScore = 0;

    if (chordMatchRatio < 0.35) {
        // 構成音が合っていない（別のコードまたは雑音・手拍子）
        calculatedScore = Math.floor(chordMatchRatio * 70); // 20〜25点程度
        return {
            score: calculatedScore,
            isPass: false,
            detail: `${chordName}の構成音（E, G, B）が綺麗に響いていません。別の弦を押さえていないか確認しましょう！`
        };
    }

    // 構成音が合っている場合：一致率と音量・余韻から算出
    calculatedScore = Math.floor(40 + (chordMatchRatio - 0.35) * 110); // 40〜85点
    if (hasSustain) calculatedScore += 12; // 余韻ボーナス
    if (maxRms > 0.12) calculatedScore += 5; // 音量ボーナス

    calculatedScore = Math.min(96, Math.max(0, calculatedScore));
    const isPass = calculatedScore >= 65;

    return {
        score: calculatedScore,
        isPass: isPass,
        detail: isPass 
            ? `力強いストローク！${chordName}の構成音（E・G・B）が美しく響いています。` 
            : `惜しい！音が少し小さかったか、一部の弦がミュートされています。もう一度しっかり鳴らしてみましょう。`
    };
}

/**
 * 指定周波数の強度（振幅）をピンポイント算出するDFT
 */
function calculateDFTBin(samples, sampleRate, freq) {
    const N = samples.length;
    const k = (2 * Math.PI * freq) / sampleRate;
    let real = 0;
    let imag = 0;
    for (let n = 0; n < N; n++) {
        const angle = k * n;
        real += samples[n] * Math.cos(angle);
        imag -= samples[n] * Math.sin(angle);
    }
    return Math.sqrt(real * real + imag * imag) / N;
}