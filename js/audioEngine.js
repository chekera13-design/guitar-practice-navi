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

// --- 生PCMキャプチャ用ステート ---
let pcmCaptureNode = null;
let pcmSilentGain = null;
let pcmChunks = [];
let isCapturingPcm = false;

// --- メトロノーム音量ステート (0.0 〜 1.0) ---
let metronomeVolume = 0.5;

export function setMetronomeVolume(val) {
    metronomeVolume = Math.max(0, Math.min(1, val));
}

export function getMetronomeVolume() {
    return metronomeVolume;
}

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

let micSourceNode = null;

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

    // ★ 4弦〜1弦の微弱な高域をクリアに通すフィルター設定（遮断周波数を2000Hzへ引き上げ）
    const lowpass = audioContext.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(2200, audioContext.currentTime);

    // 低域のボワつき（エアコンや机の振動ノイズ）をカットして高音弦の抜けを良くするハイパス
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

// --- 生PCMキャプチャ ---
export function startPcmCapture() {
    if (!audioContext || !micSourceNode) return;
    pcmChunks = [];
    isCapturingPcm = true;

    if (!pcmCaptureNode) {
        pcmCaptureNode = audioContext.createScriptProcessor(4096, 1, 1);
        pcmSilentGain = audioContext.createGain();
        pcmSilentGain.gain.setValueAtTime(0, audioContext.currentTime);

        pcmCaptureNode.onaudioprocess = (e) => {
            if (!isCapturingPcm) return;
            const inputData = e.inputBuffer.getChannelData(0);
            pcmChunks.push(new Float32Array(inputData));
        };

        micSourceNode.connect(pcmCaptureNode);
        pcmCaptureNode.connect(pcmSilentGain);
        pcmSilentGain.connect(audioContext.destination);
    }
}

export function stopPcmCapture() {
    isCapturingPcm = false;
    if (pcmChunks.length === 0) return null;

    const totalLength = pcmChunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of pcmChunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
    }
    pcmChunks = [];
    return {
        channelData: merged,
        sampleRate: audioContext.sampleRate
    };
}

// --- メトロノーム音生成（音量スライダー連動） ---
export function scheduleTick(time, isAccent = false) {
    if (!audioContext || metronomeVolume <= 0) return;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    const targetGain = (isAccent ? 0.28 : 0.18) * metronomeVolume;

    osc.frequency.setValueAtTime(isAccent ? 1200 : 800, time);
    gain.gain.setValueAtTime(targetGain, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);

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

// ==========================================
// ★ 高速版 自己相関ピッチ検出エンジン ★
// ==========================================
const MAX_CORR_BUFFER_SIZE = 2048;
const corrBuffer = new Float32Array(MAX_CORR_BUFFER_SIZE);

// js/audioEngine.js 内の autoCorrelate 関数を以下に差し替え

export function autoCorrelate(buf, sampleRate, rms) {
    const SIZE = buf.length;
    // ★ 1弦〜2弦の繊細な生音も確実に拾えるよう感度を 0.003 に向上
    if (rms < 0.003) return -1;

    const minPeriod = Math.floor(sampleRate / 1300); // 約33 (1300Hz)
    const maxPeriod = Math.ceil(sampleRate / 65);    // 約679 (65Hz)

    if (maxPeriod >= SIZE) return -1;

    const L = SIZE - maxPeriod;

    // 相関値を計算
    for (let i = minPeriod; i <= maxPeriod; i++) {
        let sum = 0;
        for (let j = 0; j < L; j++) {
            sum += buf[j] * buf[j + i];
        }
        corrBuffer[i] = sum;
    }

    // すべての極大値（ピーク）と全体の最大値を収集
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

    // ★ 改善：最大ピークの82%以上の高さを持つ「最初の山（最小周期＝真の基音）」を選択！
    // これにより4弦〜1弦が2倍周期（オクターブ下）に誤認されるのを完全に防止
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

    // 放物線補間（サブサンプル精度で周波数を割り出し）
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

// ==========================================
// ★ コード解析エンジン ★
// ==========================================
export const CHORD_PITCH_CLASSES = {
    "Em":    [4, 7, 11],
    "Am":    [9, 0, 4],
    "E":     [4, 8, 11],
    "C":     [0, 4, 7],
    "Cmaj7": [0, 4, 7, 11],
    "G":     [7, 11, 2],
    "D":     [2, 6, 9]
};

export function evaluateRecordedChordData(pcmData, stage) {
    if (!pcmData || !pcmData.channelData || pcmData.channelData.length === 0) {
        return { 
            score: 0, 
            isPass: false, 
            detail: "音が検知されませんでした。マイクに向かってストロークしてください。" 
        };
    }

    const channelData = pcmData.channelData;
    const sampleRate = pcmData.sampleRate;
    const totalSamples = channelData.length;

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

    if (maxRms < 0.05) {
        return { 
            score: 0, 
            isPass: false, 
            detail: "ギターの音が検知されませんでした。1拍目でしっかりストロークしてみましょう！" 
        };
    }

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
    const hasSustain = sustainRms > (maxRms * 0.12) && sustainRms > 0.012;

    const startAnalysis = Math.min(totalSamples - 4096, maxIndex + Math.floor(sampleRate * 0.1));
    const analysisWindow = channelData.slice(startAnalysis, startAnalysis + 4096);

    const chroma = new Float32Array(12);

    for (let midi = 40; midi <= 64; midi++) {
        const freq = midiToFrequency(midi);
        const pitchClass = midi % 12;
        const mag = calculateDFTBin(analysisWindow, sampleRate, freq);
        chroma[pitchClass] += mag;
    }

    const chordName = stage.chordName || "Em";
    const targetPitches = CHORD_PITCH_CLASSES[chordName] || [4, 7, 11];

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
    const chordMatchRatio = totalEnergy > 0 ? (targetEnergy / totalEnergy) : 0;

    let calculatedScore = 0;
    if (chordMatchRatio < 0.33) {
        calculatedScore = Math.floor(chordMatchRatio * 70);
        return {
            score: calculatedScore,
            isPass: false,
            detail: `${chordName} の構成音が綺麗に響いていません。押さえる弦や指の位置を確認しましょう！`
        };
    }

    calculatedScore = Math.floor(40 + (chordMatchRatio - 0.33) * 115);
    if (hasSustain) calculatedScore += 12;
    if (maxRms > 0.10) calculatedScore += 6;

    calculatedScore = Math.min(98, Math.max(0, calculatedScore));
    const isPass = calculatedScore >= 65;

    return {
        score: calculatedScore,
        isPass: isPass,
        detail: isPass 
            ? `力強いストローク！${chordName} の和音が美しく響いています。` 
            : `惜しい！音が少し小さかったか、一部の弦がミュートされています。もう一度しっかり鳴らしてみましょう。`
    };
}

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

export function evaluateChordWindow(channelData, sampleRate, startSample, windowSize, chordName) {
    const end = Math.min(channelData.length, startSample + windowSize);
    const count = end - startSample;
    if (count <= 0) return { score: 0, isPass: false };

    let sum = 0;
    for (let i = startSample; i < end; i++) {
        sum += channelData[i] * channelData[i];
    }
    const rms = Math.sqrt(sum / count);
    if (rms < 0.04) {
        return { score: 0, isPass: false, chordName, detail: "音が弱すぎるか、弾かれていません" };
    }

    const analysisWindow = channelData.slice(startSample, startSample + Math.min(4096, count));
    const chroma = new Float32Array(12);
    for (let midi = 40; midi <= 64; midi++) {
        const freq = midiToFrequency(midi);
        const pitchClass = midi % 12;
        chroma[pitchClass] += calculateDFTBin(analysisWindow, sampleRate, freq);
    }

    const targetPitches = CHORD_PITCH_CLASSES[chordName] || [4, 7, 11];
    let targetEnergy = 0;
    let otherEnergy = 0;
    for (let i = 0; i < 12; i++) {
        if (targetPitches.includes(i)) targetEnergy += chroma[i];
        else otherEnergy += chroma[i];
    }
    const totalEnergy = targetEnergy + otherEnergy;
    const ratio = totalEnergy > 0 ? (targetEnergy / totalEnergy) : 0;

    let score = 0;
    if (ratio < 0.33) {
        score = Math.floor(ratio * 70);
    } else {
        score = Math.floor(40 + (ratio - 0.33) * 115);
        if (rms > 0.10) score += 8;
        score = Math.min(98, Math.max(0, score));
    }
    return {
        score,
        isPass: score >= 60,
        chordName
    };
}

export function evaluateProgressionPcmData(pcmData, stage) {
    if (!pcmData || !pcmData.channelData) {
        return { score: 0, isPass: false, detail: "音声が取得できませんでした。" };
    }

    const channelData = pcmData.channelData;
    const sampleRate = pcmData.sampleRate;
    const bpm = stage.bpm || 60;
    const beatSec = 60 / bpm;
    const progression = stage.progression;

    let totalScore = 0;
    let passCount = 0;
    const details = [];

    progression.forEach((item) => {
        const strikeTimeSec = item.beat * beatSec;
        const startSample = Math.floor((strikeTimeSec + 0.15) * sampleRate);
        const windowSize = Math.floor(0.6 * sampleRate);

        const result = evaluateChordWindow(channelData, sampleRate, startSample, windowSize, item.chord);
        totalScore += result.score;
        if (result.isPass) passCount++;
        details.push(`${item.chord}: ${result.score}点`);
    });

    const avgScore = Math.round(totalScore / progression.length);
    const isOverallPass = (avgScore >= 62) && (passCount >= Math.ceil(progression.length * 0.75));

    return {
        score: avgScore,
        isPass: isOverallPass,
        detail: isOverallPass 
            ? `見事なコードチェンジ！全小節しっかり鳴らせています（${details.join(' / ')}）`
            : `惜しい！一部のコードで指の移動が遅れたか音が詰まりました（${details.join(' / ')}）`
    };
}

export function playTunerPing() {
    if (!audioContext) return;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const t = audioContext.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046.5, t);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.start(t);
    osc.stop(t + 0.5);
}