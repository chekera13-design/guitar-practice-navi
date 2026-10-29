// 表示専用。フォーム番号は形の識別であり、難易度やポジションではない。
const PRACTICE_FORM_LABELS = Object.freeze({
    C: "フォーム1（C型）", A: "フォーム2（A型）", G: "フォーム3（G型）",
    E: "フォーム4（E型）", D: "フォーム5（D型）"
});
export function getPracticeFormLabel(formId) {
    return Object.hasOwn(PRACTICE_FORM_LABELS, formId) ? PRACTICE_FORM_LABELS[formId] : null;
}
