// 検証済みの静的MXLを選ぶ設定。タイプ・フォーム・ルート・教材IDは別の情報。
export const CHORD_TONE_ROOTS = [
    ["c", "C"], ["db", "D♭"], ["d", "D"], ["eb", "E♭"], ["e", "E"], ["f", "F"],
    ["fs", "F♯"], ["g", "G"], ["ab", "A♭"], ["a", "A"], ["bb", "B♭"], ["b", "B"]
].map(([id, label]) => ({ id, label }));

// 定義は教材登録ではない。各タイプの独立した基準・生成MXLが揃った場合だけ教材を追加する。
export const CHORD_TONE_TYPES = {
    maj7: { label: "M7" }, min7: { label: "m7" }, dom7: { label: "7" }, m7b5: { label: "m7(♭5)" }
};

// ラボのmanifestに確定したフォーム別配置。スケール用の移調量とは共有しない。
const CHORD_TONE_FORM_DATA = [
    ["C", 0, 3, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]],
    ["A", 2, 7, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, -2, -1]],
    ["G", 5, 9, [0, 1, 2, 3, 4, 5, 6, -5, -4, -3, -2, -1]],
    ["E", 7, 10, [0, 1, 2, 3, 4, -7, -6, -5, -4, -3, -2, -1]],
    ["D", 8, 12, [0, 1, 2, 3, -8, -7, -6, -5, -4, -3, -2, -1]]
];
export function getChordToneLabel(typeId, rootId) {
    const root = CHORD_TONE_ROOTS.find(item => item.id === rootId);
    const type = Object.hasOwn(CHORD_TONE_TYPES, typeId) && CHORD_TONE_TYPES[typeId];
    return root && type ? root.label + type.label : null;
}
const chordToneTitle = (stage, label) => stage.code + "：M7コードトーン／" + stage.formId + "フォーム・" + label;
const chordToneDescription = (form, label) => label + "の構成音をCAGEDの" + form + "フォームで練習します。TABを確認し、一定のテンポで弾きましょう。";

export const CHORD_TONE_STAGES = CHORD_TONE_FORM_DATA.map(([formId, min, max, shifts], index) => {
    const id = index + 1, code = "EX" + String(id).padStart(2, "0"), chordTypeId = "maj7";
    const variants = CHORD_TONE_ROOTS.map((root, i) => ({
        rootId: root.id, file: "scores/chord_tones/" + chordTypeId + "/" + formId.toLowerCase() + "/maj7-" + formId.toLowerCase() + "-" + root.id + ".mxl",
        semitones: shifts[i], minFret: min + shifts[i], maxFret: max + shifts[i], notes: 37
    }));
    const stage = {
        id, code, lessonId: "chord-tones-" + id, lessonType: "chord-tone", chordTypeId, formId,
        rootId: "c", rootLabel: "C", chordLabel: "CM7", stageBadge: "コードトーン練習 " + code,
        title: "", subTitle: "M7コードトーン・CAGED " + formId + "フォーム・CM7",
        desc: chordToneDescription(formId, "CM7"), bpm: 60, timeSignature: [4, 4], countInBars: 1,
        practiceBars: 5, available: true, isPreview: false, ...variants[0], variants,
        guide: {
            title: "💡 練習のポイント", content: "選択したコードの構成音を、TABを見ながら一定のリズムで練習しましょう。",
            points: ["フォームとコード名を確認しましょう。M7はルート・長3度・完全5度・長7度の4構成音です。",
                "クリックは四分音符ごとです。8分音符を均等に弾きましょう。",
                "コードによって押さえる位置や開放弦が変わります。無理のないテンポで練習しましょう。"]
        }
    };
    stage.title = chordToneTitle(stage, stage.chordLabel);
    return stage;
});

const chordToneVariantCache = new WeakMap();
export function getChordToneVariant(stage, rootId = "c") {
    if (!CHORD_TONE_STAGES.includes(stage)) return null;
    const root = CHORD_TONE_ROOTS.find(item => item.id === rootId);
    const variant = stage.variants.find(item => item.rootId === rootId);
    if (!root || !variant) return null;
    if (rootId === "c") return stage;
    if (!chordToneVariantCache.has(stage)) chordToneVariantCache.set(stage, new Map());
    const cache = chordToneVariantCache.get(stage);
    if (!cache.has(rootId)) {
        const label = getChordToneLabel(stage.chordTypeId, rootId);
        cache.set(rootId, { ...stage, ...variant, rootLabel: root.label, chordLabel: label,
            title: chordToneTitle(stage, label), subTitle: "M7コードトーン・CAGED " + stage.formId + "フォーム・" + label,
            desc: chordToneDescription(stage.formId, label) });
    }
    return cache.get(rootId);
}
