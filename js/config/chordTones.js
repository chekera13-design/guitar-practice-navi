import { getPracticeFormLabel } from "../practiceFormLabels.js";
import { DOM7_FORMS, M7B5_FORMS } from "./seventhChordTones.js";
import { MIN7_ROOTS, MIN7_FORMS } from "./min7ChordTones.js";
import { getPracticePositions, getPracticePositionId } from "../practicePositions.js";

// 検証済みの静的MXLを選ぶ設定。タイプ・フォーム・ルート・教材IDは別の情報。
export const CHORD_TONE_ROOTS = [
    ["c", "C"], ["db", "D♭"], ["d", "D"], ["eb", "E♭"], ["e", "E"], ["f", "F"],
    ["fs", "F♯"], ["g", "G"], ["ab", "A♭"], ["a", "A"], ["bb", "B♭"], ["b", "B"]
].map(([id, label]) => ({ id, label }));

// 定義は教材登録ではない。各タイプの独立した基準・生成MXLが揃った場合だけ教材を追加する。
export const CHORD_TONE_TYPES = {
    maj7: { label: "M7" }, min7: { label: "m7" }, dom7: { label: "7", practiceLabel: "7th" }, m7b5: { label: "m7(♭5)" }
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
    const root = getChordToneRoots(typeId).find(item => item.id === rootId);
    const type = Object.hasOwn(CHORD_TONE_TYPES, typeId) && CHORD_TONE_TYPES[typeId];
    return root && type ? root.label + type.label : null;
}
const chordToneTitle = (stage, label) => stage.code + "：" + (CHORD_TONE_TYPES[stage.chordTypeId].practiceLabel || CHORD_TONE_TYPES[stage.chordTypeId].label) + "コードトーン／" + getPracticeFormLabel(stage.formId) + "・" + label;
const chordToneDescription = (form, label) => label + "の構成音を" + getPracticeFormLabel(form) + "で練習します。TABを確認し、一定のテンポで弾きましょう。";

const MAJ7_STAGES = CHORD_TONE_FORM_DATA.map(([formId, min, max, shifts], index) => {
    const id = index + 1, code = "EX" + String(id).padStart(2, "0"), chordTypeId = "maj7";
    const variants = CHORD_TONE_ROOTS.map((root, i) => ({
        rootId: root.id, file: "scores/chord_tones/" + chordTypeId + "/" + formId.toLowerCase() + "/maj7-" + formId.toLowerCase() + "-" + root.id + ".mxl",
        semitones: shifts[i], minFret: min + shifts[i], maxFret: max + shifts[i], notes: 37
    }));
    const stage = {
        id, code, lessonId: "chord-tones-" + id, lessonType: "chord-tone", chordTypeId, formId,
        rootId: "c", rootLabel: "C", chordLabel: "CM7", stageBadge: "コードトーン練習 " + code,
        title: "", subTitle: "M7コードトーン・" + getPracticeFormLabel(formId) + "・CM7",
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

const MIN7_STAGES = MIN7_FORMS.map((form, index) => {
    const id = index + 6, code = "EX" + String(id).padStart(2, "0"), chordTypeId = "min7", formId = form.form;
    const variants = form.variants, standard = variants.find(v => v.rootId === "c" && v.positionId === "standard");
    const stage = {
        id, code, lessonId: "chord-tones-" + id, lessonType: "chord-tone", chordTypeId, formId,
        rootId: "c", rootLabel: "C", chordLabel: "Cm7", stageBadge: "コードトーン練習 " + code,
        subTitle: "m7コードトーン・" + getPracticeFormLabel(formId) + "・Cm7", desc: chordToneDescription(formId, "Cm7"),
        bpm: 60, timeSignature: [4, 4], countInBars: 1, practiceBars: 5, available: true, isPreview: false,
        ...standard, variants,
        guide: {
            title: "💡 練習のポイント", content: "選択したm7コードの構成音を、TABを見ながら一定のリズムで練習しましょう。",
            points: ["フォームとコード名を確認しましょう。m7はルート・短3度・完全5度・短7度の4構成音です。",
                "クリックは四分音符ごとです。音符の長さを確かめ、一定のテンポで弾きましょう。",
                "コードとポジションによって押さえる位置が変わります。無理のないテンポで練習しましょう。"]
        }
    };
    stage.title = chordToneTitle(stage, "Cm7");
    return stage;
});
// 各コードタイプの原本・小節数・運指は独立して保持する。
function createSeventhStages(forms, chordTypeId, firstId, toneDescription) {
    const type = CHORD_TONE_TYPES[chordTypeId], name = type.practiceLabel || type.label;
    return forms.map((form, index) => {
        const id = firstId + index, code = "EX" + String(id).padStart(2, "0"), formId = form.form;
        const variants = form.variants, standard = variants.find(v => v.rootId === "c" && v.positionId === "standard");
        const chordLabel = "C" + type.label;
        const stage = {
            id, code, lessonId: "chord-tones-" + id, lessonType: "chord-tone", chordTypeId, formId,
            rootId: "c", rootLabel: "C", chordLabel, stageBadge: "コードトーン練習 " + code,
            subTitle: name + "コードトーン・" + getPracticeFormLabel(formId) + "・" + chordLabel,
            desc: chordToneDescription(formId, chordLabel), bpm: 60, timeSignature: [4, 4], countInBars: 1,
            practiceBars: form.measures, available: true, isPreview: false, ...standard, variants,
            guide: {
                title: "💡 練習のポイント", content: "選択したコードの構成音を、TABを見ながら一定のリズムで練習しましょう。",
                points: ["フォームとコード名を確認しましょう。" + name + "は" + toneDescription + "の4構成音です。",
                    "クリックは四分音符ごとです。音符の長さを確かめ、一定のテンポで練習しましょう。",
                    "コードによって押さえる位置が変わります。無理のないテンポで練習しましょう。"]
            }
        };
        stage.title = chordToneTitle(stage, chordLabel);
        return stage;
    });
}
const DOM7_STAGES = createSeventhStages(DOM7_FORMS, "dom7", 11, "ルート・長3度・完全5度・短7度");
const M7B5_STAGES = createSeventhStages(M7B5_FORMS, "m7b5", 16, "ルート・短3度・減5度・短7度");
export const CHORD_TONE_STAGES = [...MAJ7_STAGES, ...MIN7_STAGES, ...DOM7_STAGES, ...M7B5_STAGES];
export function getChordToneRoots(value) {
    const type = typeof value === "string" ? value : value?.chordTypeId;
    return type === "min7" || type === "m7b5" ? MIN7_ROOTS : CHORD_TONE_ROOTS;
}
export const getChordTonePositions = (stage, rootId) => getPracticePositions(stage, rootId, "rootId");

const chordToneVariantCache = new WeakMap();
export function getChordToneVariant(stage, rootId = "c", positionId = "standard") {
    if (!CHORD_TONE_STAGES.includes(stage)) return null;
    const root = getChordToneRoots(stage).find(item => item.id === rootId);
    const variant = getChordTonePositions(stage, rootId).find(item => getPracticePositionId(item) === positionId);
    if (!root || !variant) return null;
    if (rootId === "c" && positionId === "standard") return stage;
    if (!chordToneVariantCache.has(stage)) chordToneVariantCache.set(stage, new Map());
    const cache = chordToneVariantCache.get(stage), id = rootId + "/" + positionId;
    if (!cache.has(id)) {
        const label = getChordToneLabel(stage.chordTypeId, rootId);
        cache.set(id, { ...stage, ...variant, rootLabel: root.label, chordLabel: label,
            title: chordToneTitle(stage, label) + (positionId === "standard" ? "" : "（" + variant.positionLabel + "）"),
            subTitle: (CHORD_TONE_TYPES[stage.chordTypeId].practiceLabel || CHORD_TONE_TYPES[stage.chordTypeId].label) + "コードトーン・" + getPracticeFormLabel(stage.formId) + "・" + label,
            desc: chordToneDescription(stage.formId, label) });
    }
    return cache.get(id);
}
