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
        if (idx === currentIndex) badge.classList.add('current');
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

/**
 * 簡易チューナー起動時、ピッチのズレ（セント）に合わせてメーターの針やテキストを動かす
 */
export function updateTunerUI({
    freq,
    tunerTargetFreq,
    tunerHzDisplay,
    tunerMeterPointer,
    tunerStatusText
}) {
    if (tunerHzDisplay) tunerHzDisplay.innerText = `${freq.toFixed(1)} Hz`;

    // 周波数からセント（音程のズレの単位）を計算
    const cents = 1200 * Math.log2(freq / tunerTargetFreq);

    // メーターの針（ポインター）の位置を計算 (5% 〜 95% の間に収める)
    let pointerPos = 50 + (cents / 50) * 40;
    pointerPos = Math.max(5, Math.min(95, pointerPos));
    
    if (tunerMeterPointer) {
        tunerMeterPointer.style.left = `${pointerPos}%`;
    }

    if (!tunerStatusText || !tunerMeterPointer) return;

    // ズレ具合に合わせたテキストと色のフィードバック
    if (Math.abs(cents) <= 8) {
        tunerStatusText.innerText = "✨ ピッタリ合っています！";
        tunerStatusText.style.color = "#10b981";
        tunerMeterPointer.style.background = "#10b981";
    } else if (cents < -8) {
        tunerStatusText.innerText = "少し低い ➔ ペグを巻く ⤴";
        tunerStatusText.style.color = "#60a5fa";
        tunerMeterPointer.style.background = "#60a5fa";
    } else {
        tunerStatusText.innerText = "少し高い ➔ ペグを緩める ⤵";
        tunerStatusText.style.color = "#f87171";
        tunerMeterPointer.style.background = "#f87171";
    }
}