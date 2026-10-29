// キー／ルートとポジションを分離するデータ参照。音声・保存・教材生成は持たない。
export function getPracticePositions(stage, rootId, rootProperty = "keyId") {
    return (stage?.variants || []).filter(variant => variant[rootProperty] === rootId);
}
export function getPracticePositionId(variant) {
    return variant?.positionId || "standard";
}

// 表示順と初回選択の優先順位。教材データや保存IDの並びは変更しない。
export const PRACTICE_POSITION_PRIORITY = Object.freeze(["low", "standard"]);
export function sortPracticePositions(positions, priority = PRACTICE_POSITION_PRIORITY) {
    const order = Array.isArray(priority) ? priority : PRACTICE_POSITION_PRIORITY;
    const rank = variant => {
        const index = order.indexOf(getPracticePositionId(variant));
        return index < 0 ? order.length : index;
    };
    return (positions || []).map((variant, index) => ({ variant, index }))
        .sort((a, b) => rank(a.variant) - rank(b.variant) || a.index - b.index)
        .map(item => item.variant);
}
export function resolvePracticePosition(positions, remembered, priority = PRACTICE_POSITION_PRIORITY) {
    if (positions.some(variant => getPracticePositionId(variant) === remembered)) return remembered;
    const first = sortPracticePositions(positions, priority)[0];
    return first ? getPracticePositionId(first) : null;
}
