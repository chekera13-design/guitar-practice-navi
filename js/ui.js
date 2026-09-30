// ==========================================
// ギター練習ナビ - UI制御・画面表示ロジック (js/ui.js)
// ==========================================

/**
 * 楽譜（alphaTab）の下部に表示される練習キュー（音符バッジ一覧）を描画
 */
export function renderQueue(currentNotes, currentIndex, notesQueueEl) {
    if (!notesQueueEl) return;
    notesQueueEl.innerHTML = '';
    currentNotes.forEach((n, idx) => {
        const badge = document.createElement('div');
        badge.className = 'note-badge';
        badge.innerText = `${idx + 1}. ${n.fullName}`;
        if (idx < currentIndex) badge.classList.add('cleared');
        if (idx === currentIndex) {
            badge.classList.add('current');
            // ★ 現在のターゲットが画面中央に来るように自動スクロール
            setTimeout(() => {
                badge.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }, 10);
        }
        notesQueueEl.appendChild(badge);
    });
}

/**
 * チャレンジ中に次に狙うべき「ターゲットの音名」と「弦・フレット情報」の表示を更新
 */
export function updateTargetUI(currentNotes, currentIndex, targetNoteEl, targetInfoEl) {
    const target = currentNotes[currentIndex];
    if (!target) return;
    if (targetNoteEl) targetNoteEl.innerText = target.fullName;
    if (targetInfoEl) {
        if (target.string === 0) {
            targetInfoEl.innerText = "すべての弦を一気に振り抜く！";
        } else {
            targetInfoEl.innerText = `${target.string}弦 ${target.fret}フレット`;
        }
    }
}

/**
 * リズムの判定結果（PERFECT / GOOD / MISS / STRUM）を画面中央に表示
 */
export function showRhythmJudge(rating, rhythmJudgeBadge) {
    if (!rhythmJudgeBadge) return;
    rhythmJudgeBadge.innerText = rating;
    rhythmJudgeBadge.className = `rhythm-judge ${rating.toLowerCase()}`;
}

/**
 * ステージ選択エリアのグリッドUIを一括描画・更新する
 */
export function renderStagesUI({
    stages,
    clearedList,
    currentStageIndex,
    stagesGrid,
    progressPercentEl,
    progressBarFill,
    onSelectStage
}) {
    if (!stagesGrid) return;
    stagesGrid.innerHTML = '';
    const maxUnlocked = clearedList.length + 1;

    stages.forEach((stage, idx) => {
        const isCleared = clearedList.includes(stage.id);
        const isLocked = stage.id > maxUnlocked;
        const isActive = idx === currentStageIndex;

        const btn = document.createElement('div');
        btn.className = `stage-btn ${isCleared ? 'cleared' : ''} ${isLocked ? 'locked' : ''} ${isActive ? 'active' : ''}`;

        let statusText = isCleared ? "💮 合格" : (isLocked ? "🔒 ロック" : "🟢 挑戦可能");

        btn.innerHTML = `
            <div class="stage-btn-top">
                <span>EX ${stage.id}</span>
                <span class="${isCleared ? 'cleared-status' : ''}">${statusText}</span>
            </div>
            <div class="stage-btn-title">${stage.title.split(': ')[1] || stage.title}</div>
        `;

        if (!isLocked && onSelectStage) {
            btn.addEventListener('click', () => onSelectStage(idx));
        }

        stagesGrid.appendChild(btn);
    });

    // クリア進捗バーの更新
    const percent = Math.round((clearedList.length / stages.length) * 100);
    if (progressPercentEl) progressPercentEl.innerText = `${percent}% (${clearedList.length} / ${stages.length})`;
    if (progressBarFill) progressBarFill.style.width = `${percent}%`;
}

// --- チューナー用スムージングステート ---
let smoothedCents = 0;
let lastInTuneSoundTime = 0;
let inTuneHoldFrames = 0;

/**
 * 簡易チューナー起動時、ピッチのズレ（セント）に合わせてメーターの針やテキストを動かす
 * - 6弦・5弦の倍音自動補正
 * - 針の滑らかな追従（EMAフィルタ）
 * - ピッタリ合ったときの効果音・緑発光
 */
// js/ui.js 内の updateTunerUI 関数内の冒頭を修正

export function updateTunerUI({
    freq,
    tunerTargetFreq,
    tunerHzDisplay,
    tunerMeterPointer,
    tunerStatusText,
    onInTunePing
}) {
    // 1. 【全弦対応オクターブ正規化】
    // マイクの特性で第2倍音（オクターブ上）やサブハーモニクスを拾った場合でも、
    // 目標弦の周波数帯（±600セント以内）に自動で引き寄せてピッチ比較を行う
    let actualFreq = freq;
    while (actualFreq < tunerTargetFreq * 0.7071) {
        actualFreq *= 2;
    }
    while (actualFreq > tunerTargetFreq * 1.4142) {
        actualFreq /= 2;
    }

    if (tunerHzDisplay) {
        tunerHzDisplay.innerText = `${actualFreq.toFixed(1)} Hz (生: ${freq.toFixed(1)} Hz)`;
    }

    // 周波数からセント（半音の1/100）のズレを計算
    const rawCents = 1200 * Math.log2(actualFreq / tunerTargetFreq);

    // 2. 【スムージング】急激なブレを抑えて滑らかに追従 (EMA)
    smoothedCents = smoothedCents * 0.65 + rawCents * 0.35;

    // メーターの針の位置（±50セントの範囲を 10% 〜 90% にマッピング）
    let pointerPos = 50 + (smoothedCents / 50) * 40;
    pointerPos = Math.max(8, Math.min(92, pointerPos));

    if (tunerMeterPointer) {
        tunerMeterPointer.style.left = `${pointerPos}%`;
    }

    if (!tunerStatusText || !tunerMeterPointer) return;

    // 3. 【判定フィードバック】
    const absCents = Math.abs(smoothedCents);

    if (absCents <= 6) {
        // ✨ ピッタリ（±6セント以内）
        inTuneHoldFrames++;
        tunerStatusText.innerText = "✨ ピッタリ合っています！";
        tunerStatusText.style.color = "#10b981";
        tunerMeterPointer.style.background = "#10b981";
        tunerMeterPointer.style.boxShadow = "0 0 12px #10b981";

        const now = Date.now();
        if (inTuneHoldFrames >= 3 && (now - lastInTuneSoundTime > 1500)) {
            lastInTuneSoundTime = now;
            if (onInTunePing) onInTunePing();
        }
    } else {
        inTuneHoldFrames = 0;
        tunerMeterPointer.style.boxShadow = "none";

        if (smoothedCents < -6) {
            tunerStatusText.innerText = "少し低い ➔ ペグを巻く ⤴";
            tunerStatusText.style.color = "#60a5fa";
            tunerMeterPointer.style.background = "#60a5fa";
        } else {
            tunerStatusText.innerText = "少し高い ➔ ペグを緩める ⤵";
            tunerStatusText.style.color = "#f87171";
            tunerMeterPointer.style.background = "#f87171";
        }
    }
}

/**
 * チューナー停止時や弦変更時にスムージング値をリセット
 */
export function resetTunerSmoothing() {
    smoothedCents = 0;
    inTuneHoldFrames = 0;
}
/**
 * カウントインの数字が切り替わったときに弾むアニメーションを再実行
 */
export function triggerCountInPulse(el, count) {
    if (!el) return;
    el.innerText = count;
    el.classList.remove('pulse');
    void el.offsetWidth; // リフローを強制してアニメーションをリセット
    el.classList.add('pulse');
}