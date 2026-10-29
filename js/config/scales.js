import { getPracticeFormLabel } from "../practiceFormLabels.js";
import { NATURAL_MINOR_KEYS, NATURAL_MINOR_FORMS } from "./naturalMinorScales.js";
import { getPracticePositions, getPracticePositionId } from "../practicePositions.js";

// 検証済みMXLを選択する表示設定。音声・運指・MXLの動的生成は行わない。
export const SCALE_KEYS = [
    {
        "id": "c",
        "label": "C"
    },
    {
        "id": "db",
        "label": "D♭"
    },
    {
        "id": "d",
        "label": "D"
    },
    {
        "id": "eb",
        "label": "E♭"
    },
    {
        "id": "e",
        "label": "E"
    },
    {
        "id": "f",
        "label": "F"
    },
    {
        "id": "fs",
        "label": "F♯"
    },
    {
        "id": "g",
        "label": "G"
    },
    {
        "id": "ab",
        "label": "A♭"
    },
    {
        "id": "a",
        "label": "A"
    },
    {
        "id": "bb",
        "label": "B♭"
    },
    {
        "id": "b",
        "label": "B"
    }
];

const FORM_VARIANTS = [
    {
        "form": "C",
        "variants": [
            {
                "keyId": "c",
                "file": "scores/scales/c/c.mxl",
                "semitones": 0,
                "minFret": 0,
                "maxFret": 3,
                "notes": 65
            },
            {
                "keyId": "db",
                "file": "scores/scales/c/db.mxl",
                "semitones": 1,
                "minFret": 1,
                "maxFret": 4,
                "notes": 65
            },
            {
                "keyId": "d",
                "file": "scores/scales/c/d.mxl",
                "semitones": 2,
                "minFret": 2,
                "maxFret": 5,
                "notes": 65
            },
            {
                "keyId": "eb",
                "file": "scores/scales/c/eb.mxl",
                "semitones": 3,
                "minFret": 3,
                "maxFret": 6,
                "notes": 65
            },
            {
                "keyId": "e",
                "file": "scores/scales/c/e.mxl",
                "semitones": 4,
                "minFret": 4,
                "maxFret": 7,
                "notes": 65
            },
            {
                "keyId": "f",
                "file": "scores/scales/c/f.mxl",
                "semitones": 5,
                "minFret": 5,
                "maxFret": 8,
                "notes": 65
            },
            {
                "keyId": "fs",
                "file": "scores/scales/c/fs.mxl",
                "semitones": 6,
                "minFret": 6,
                "maxFret": 9,
                "notes": 65
            },
            {
                "keyId": "g",
                "file": "scores/scales/c/g.mxl",
                "semitones": 7,
                "minFret": 7,
                "maxFret": 10,
                "notes": 65
            },
            {
                "keyId": "ab",
                "file": "scores/scales/c/ab.mxl",
                "semitones": 8,
                "minFret": 8,
                "maxFret": 11,
                "notes": 65
            },
            {
                "keyId": "a",
                "file": "scores/scales/c/a.mxl",
                "semitones": 9,
                "minFret": 9,
                "maxFret": 12,
                "notes": 65
            },
            {
                "keyId": "bb",
                "file": "scores/scales/c/bb.mxl",
                "semitones": 10,
                "minFret": 10,
                "maxFret": 13,
                "notes": 65
            },
            {
                "keyId": "b",
                "file": "scores/scales/c/b.mxl",
                "semitones": 11,
                "minFret": 11,
                "maxFret": 14,
                "notes": 65
            }
        ]
    },
    {
        "form": "A",
        "variants": [
            {
                "keyId": "c",
                "file": "scores/scales/a/c.mxl",
                "semitones": 0,
                "minFret": 1,
                "maxFret": 5,
                "notes": 65
            },
            {
                "keyId": "db",
                "file": "scores/scales/a/db.mxl",
                "semitones": 1,
                "minFret": 2,
                "maxFret": 6,
                "notes": 65
            },
            {
                "keyId": "d",
                "file": "scores/scales/a/d.mxl",
                "semitones": 2,
                "minFret": 3,
                "maxFret": 7,
                "notes": 65
            },
            {
                "keyId": "eb",
                "file": "scores/scales/a/eb.mxl",
                "semitones": 3,
                "minFret": 4,
                "maxFret": 8,
                "notes": 65
            },
            {
                "keyId": "e",
                "file": "scores/scales/a/e.mxl",
                "semitones": 4,
                "minFret": 5,
                "maxFret": 9,
                "notes": 65
            },
            {
                "keyId": "f",
                "file": "scores/scales/a/f.mxl",
                "semitones": 5,
                "minFret": 6,
                "maxFret": 10,
                "notes": 65
            },
            {
                "keyId": "fs",
                "file": "scores/scales/a/fs.mxl",
                "semitones": 6,
                "minFret": 7,
                "maxFret": 11,
                "notes": 65
            },
            {
                "keyId": "g",
                "file": "scores/scales/a/g.mxl",
                "semitones": 7,
                "minFret": 8,
                "maxFret": 12,
                "notes": 65
            },
            {
                "keyId": "ab",
                "file": "scores/scales/a/ab.mxl",
                "semitones": 8,
                "minFret": 9,
                "maxFret": 13,
                "notes": 65
            },
            {
                "keyId": "a",
                "file": "scores/scales/a/a.mxl",
                "semitones": 9,
                "minFret": 10,
                "maxFret": 14,
                "notes": 65
            },
            {
                "keyId": "bb",
                "file": "scores/scales/a/bb.mxl",
                "semitones": 10,
                "minFret": 11,
                "maxFret": 15,
                "notes": 65
            },
            {
                "keyId": "b",
                "file": "scores/scales/a/b.mxl",
                "semitones": -1,
                "minFret": 0,
                "maxFret": 4,
                "notes": 65
            }
        ]
    },
    {
        "form": "G",
        "variants": [
            {
                "keyId": "c",
                "file": "scores/scales/g/c.mxl",
                "semitones": 0,
                "minFret": 5,
                "maxFret": 9,
                "notes": 65
            },
            {
                "keyId": "db",
                "file": "scores/scales/g/db.mxl",
                "semitones": 1,
                "minFret": 6,
                "maxFret": 10,
                "notes": 65
            },
            {
                "keyId": "d",
                "file": "scores/scales/g/d.mxl",
                "semitones": 2,
                "minFret": 7,
                "maxFret": 11,
                "notes": 65
            },
            {
                "keyId": "eb",
                "file": "scores/scales/g/eb.mxl",
                "semitones": 3,
                "minFret": 8,
                "maxFret": 12,
                "notes": 65
            },
            {
                "keyId": "e",
                "file": "scores/scales/g/e.mxl",
                "semitones": 4,
                "minFret": 9,
                "maxFret": 13,
                "notes": 65
            },
            {
                "keyId": "f",
                "file": "scores/scales/g/f.mxl",
                "semitones": 5,
                "minFret": 10,
                "maxFret": 14,
                "notes": 65
            },
            {
                "keyId": "fs",
                "file": "scores/scales/g/fs.mxl",
                "semitones": 6,
                "minFret": 11,
                "maxFret": 15,
                "notes": 65
            },
            {
                "keyId": "g",
                "file": "scores/scales/g/g.mxl",
                "semitones": -5,
                "minFret": 0,
                "maxFret": 4,
                "notes": 65
            },
            {
                "keyId": "ab",
                "file": "scores/scales/g/ab.mxl",
                "semitones": -4,
                "minFret": 1,
                "maxFret": 5,
                "notes": 65
            },
            {
                "keyId": "a",
                "file": "scores/scales/g/a.mxl",
                "semitones": -3,
                "minFret": 2,
                "maxFret": 6,
                "notes": 65
            },
            {
                "keyId": "bb",
                "file": "scores/scales/g/bb.mxl",
                "semitones": -2,
                "minFret": 3,
                "maxFret": 7,
                "notes": 65
            },
            {
                "keyId": "b",
                "file": "scores/scales/g/b.mxl",
                "semitones": -1,
                "minFret": 4,
                "maxFret": 8,
                "notes": 65
            }
        ]
    },
    {
        "form": "E",
        "variants": [
            {
                "keyId": "c",
                "file": "scores/scales/e/c.mxl",
                "semitones": 0,
                "minFret": 7,
                "maxFret": 10,
                "notes": 65
            },
            {
                "keyId": "db",
                "file": "scores/scales/e/db.mxl",
                "semitones": 1,
                "minFret": 8,
                "maxFret": 11,
                "notes": 65
            },
            {
                "keyId": "d",
                "file": "scores/scales/e/d.mxl",
                "semitones": 2,
                "minFret": 9,
                "maxFret": 12,
                "notes": 65
            },
            {
                "keyId": "eb",
                "file": "scores/scales/e/eb.mxl",
                "semitones": 3,
                "minFret": 10,
                "maxFret": 13,
                "notes": 65
            },
            {
                "keyId": "e",
                "file": "scores/scales/e/e.mxl",
                "semitones": 4,
                "minFret": 11,
                "maxFret": 14,
                "notes": 65
            },
            {
                "keyId": "f",
                "file": "scores/scales/e/f.mxl",
                "semitones": -7,
                "minFret": 0,
                "maxFret": 3,
                "notes": 65
            },
            {
                "keyId": "fs",
                "file": "scores/scales/e/fs.mxl",
                "semitones": -6,
                "minFret": 1,
                "maxFret": 4,
                "notes": 65
            },
            {
                "keyId": "g",
                "file": "scores/scales/e/g.mxl",
                "semitones": -5,
                "minFret": 2,
                "maxFret": 5,
                "notes": 65
            },
            {
                "keyId": "ab",
                "file": "scores/scales/e/ab.mxl",
                "semitones": -4,
                "minFret": 3,
                "maxFret": 6,
                "notes": 65
            },
            {
                "keyId": "a",
                "file": "scores/scales/e/a.mxl",
                "semitones": -3,
                "minFret": 4,
                "maxFret": 7,
                "notes": 65
            },
            {
                "keyId": "bb",
                "file": "scores/scales/e/bb.mxl",
                "semitones": -2,
                "minFret": 5,
                "maxFret": 8,
                "notes": 65
            },
            {
                "keyId": "b",
                "file": "scores/scales/e/b.mxl",
                "semitones": -1,
                "minFret": 6,
                "maxFret": 9,
                "notes": 65
            }
        ]
    },
    {
        "form": "D",
        "variants": [
            {
                "keyId": "c",
                "file": "scores/scales/d/c.mxl",
                "semitones": 0,
                "minFret": 8,
                "maxFret": 13,
                "notes": 67
            },
            {
                "keyId": "db",
                "file": "scores/scales/d/db.mxl",
                "semitones": 1,
                "minFret": 9,
                "maxFret": 14,
                "notes": 67
            },
            {
                "keyId": "d",
                "file": "scores/scales/d/d.mxl",
                "semitones": 2,
                "minFret": 10,
                "maxFret": 15,
                "notes": 67
            },
            {
                "keyId": "eb",
                "file": "scores/scales/d/eb.mxl",
                "semitones": 3,
                "minFret": 11,
                "maxFret": 16,
                "notes": 67
            },
            {
                "keyId": "e",
                "file": "scores/scales/d/e.mxl",
                "semitones": -8,
                "minFret": 0,
                "maxFret": 5,
                "notes": 67
            },
            {
                "keyId": "f",
                "file": "scores/scales/d/f.mxl",
                "semitones": -7,
                "minFret": 1,
                "maxFret": 6,
                "notes": 67
            },
            {
                "keyId": "fs",
                "file": "scores/scales/d/fs.mxl",
                "semitones": -6,
                "minFret": 2,
                "maxFret": 7,
                "notes": 67
            },
            {
                "keyId": "g",
                "file": "scores/scales/d/g.mxl",
                "semitones": -5,
                "minFret": 3,
                "maxFret": 8,
                "notes": 67
            },
            {
                "keyId": "ab",
                "file": "scores/scales/d/ab.mxl",
                "semitones": -4,
                "minFret": 4,
                "maxFret": 9,
                "notes": 67
            },
            {
                "keyId": "a",
                "file": "scores/scales/d/a.mxl",
                "semitones": -3,
                "minFret": 5,
                "maxFret": 10,
                "notes": 67
            },
            {
                "keyId": "bb",
                "file": "scores/scales/d/bb.mxl",
                "semitones": -2,
                "minFret": 6,
                "maxFret": 11,
                "notes": 67
            },
            {
                "keyId": "b",
                "file": "scores/scales/d/b.mxl",
                "semitones": -1,
                "minFret": 7,
                "maxFret": 12,
                "notes": 67
            }
        ]
    }
];

const scaleTitle = (stage, label) => stage.code + "：" + (stage.scaleType === "naturalMinor" ? "ナチュラルマイナー／" + getPracticeFormLabel(stage.formId) + "・" + label : "メジャースケール／" + getPracticeFormLabel(stage.formId) + "・" + label + "メジャー");
const scaleDescription = (form, label) => label + "メジャーを" + getPracticeFormLabel(form) + "で練習します。TABの弦とフレットを確認し、一定のテンポで弾きましょう。";

const MAJOR_SCALE_STAGES = FORM_VARIANTS.map((form, index) => {
    const id = index + 1, code = "EX" + String(id).padStart(2, "0"), c = form.variants.find(v => v.keyId === "c");
    const stage = {
        id, code, lessonId: "scales-" + id, lessonType: "major-scale", formId: form.form,
        keyId: "c", keyLabel: "C", stageBadge: "スケール練習 " + code,
        title: "", subTitle: getPracticeFormLabel(form.form) + "・Cメジャー",
        desc: scaleDescription(form.form, "C"), bpm: 60, timeSignature: [4, 4],
        countInBars: 1, practiceBars: 9, available: true, isPreview: false,
        ...c, variants: form.variants,
        guide: {
            title: "💡 練習のポイント",
            content: "選択したキーのTABを見ながら、メジャースケールを一定のリズムで練習しましょう。",
            points: [
                "フォーム番号は形の区別で、低い順・難易度順ではありません。画面のフォーム・キーとTABを確認しましょう。",
                "クリックは四分音符ごとです。8分音符を均等に弾き、上昇・下降の流れを保ちましょう。",
                "キーによって押さえる位置や開放弦が変わります。無理のないテンポで音を確かめましょう。"
            ]
        }
    };
    stage.title = scaleTitle(stage, "C");
    return stage;
});

const minorDescription = (form, label) => label + "のナチュラルマイナースケールを" + getPracticeFormLabel(form) + "で練習します。TABの弦とフレットを確認し、一定のテンポで弾きましょう。";
const MINOR_SCALE_STAGES = NATURAL_MINOR_FORMS.map((form, index) => {
    const id = index + 6, code = "EX" + String(id).padStart(2, "0");
    const c = form.variants.find(v => v.keyId === "c" && v.positionId === "standard");
    const stage = {
        id, code, lessonId: "scales-" + id, lessonType: "natural-minor-scale", scaleType: "naturalMinor", formId: form.form,
        keyId: "c", keyLabel: "Cm", stageBadge: "スケール練習 " + code,
        subTitle: getPracticeFormLabel(form.form) + "・Cm", desc: minorDescription(form.form, "Cm"),
        bpm: 60, timeSignature: [4, 4], countInBars: 1, practiceBars: 9, available: true, isPreview: false,
        ...c, variants: form.variants,
        guide: { title: "💡 練習のポイント", content: "選択したキーとポジションのTABを見ながら、自然短音階を一定のリズムで練習しましょう。",
            points: ["フォーム名、キー、ポジションは別の情報です。選択中の譜面を確認しましょう。", "クリックは四分音符ごとです。8分音符を均等に弾きましょう。", "無理のないテンポで上昇・下降の流れを確かめましょう。"] }
    };
    stage.title = scaleTitle(stage, "Cm");
    return stage;
});
export const SCALE_STAGES = [...MAJOR_SCALE_STAGES, ...MINOR_SCALE_STAGES];
export const getScaleKeys = stage => stage?.scaleType === "naturalMinor" ? NATURAL_MINOR_KEYS : SCALE_KEYS;
export const getScalePositions = (stage, keyId) => getPracticePositions(stage, keyId);

// 同じ教材・キー・ポジションは同じオブジェクト。実行中の設定を選択操作で変質させない。
const scaleVariantCache = new WeakMap();
export function getScaleVariant(stage, keyId = "c", positionId = "standard") {
    if (!SCALE_STAGES.includes(stage)) return null;
    const key = getScaleKeys(stage).find(item => item.id === keyId);
    const variant = getScalePositions(stage, keyId).find(item => getPracticePositionId(item) === positionId);
    if (!key || !variant) return null;
    if (keyId === "c" && positionId === "standard") return stage;
    if (!scaleVariantCache.has(stage)) scaleVariantCache.set(stage, new Map());
    const cache = scaleVariantCache.get(stage), id = keyId + "/" + positionId;
    if (!cache.has(id)) cache.set(id, {
        ...stage, ...variant, keyLabel: key.label,
        title: scaleTitle(stage, key.label),
        subTitle: getPracticeFormLabel(stage.formId) + "・" + key.label + (stage.scaleType === "naturalMinor" ? "" : "メジャー"),
        desc: stage.scaleType === "naturalMinor" ? minorDescription(stage.formId, key.label) : scaleDescription(stage.formId, key.label)
    });
    return cache.get(id);
}
