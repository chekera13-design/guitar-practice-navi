import { CHROMATIC_STAGES } from "./chromatic.js";

// Display EX02 is one lesson. A permutation and a physical string identify its variant.
// Do not reuse the existing chromatic-1..24 identities or derive saved IDs from menu order.
export const CHROMATIC_HORIZONTAL_STAGES = Object.freeze(CHROMATIC_STAGES.flatMap(({ fingering, id: patternNumber }) =>
    [1, 2, 3, 4, 5, 6].map(stringNumber => Object.freeze({
        id: 2, code: "EX02", lessonId: "chromatic-horizontal", practiceType: "chromatic-horizontal",
        patternType: "horizontal", fingering, patternNumber, stringNumber,
        progressId: "chromatic-horizontal-" + fingering + "-string-" + stringNumber,
        stageBadge: "クロマチック練習② EX02・" + stringNumber + "弦",
        title: "EX02：クロマチック練習②・No." + String(patternNumber).padStart(2, "0") + " | " + fingering + "・" + stringNumber + "弦",
        desc: stringNumber + "弦だけを使い、4フレットの運指を1フレットずつずらして、1〜12フレットを往復します。",
        fretOrder: Object.freeze([...fingering].map(Number)),
        bpm: 80, timeSignature: Object.freeze([4, 4]), countInBars: 1, practiceBars: 18,
        file: "scores/chromatic/horizontal/string-" + stringNumber + "/pattern-" + fingering + ".mxl",
        available: true, isPreview: false,
        guide: {
            title: "💡 横移動の練習",
            content: stringNumber + "弦で運指" + fingering + "を各位置2回ずつ弾き、1フレットずつ移動しましょう。初期テンポは80 BPMです。",
            points: [
                "選択した弦だけで18小節を通して練習します。1拍に2音、8分音符で均等に弾きましょう。",
                "1〜4Fから9〜12Fまで進み、1〜4Fへ戻ります。戻るときも運指の順番は同じです。",
                "原本どおり、折り返しの9〜12Fは2小節続きます。難しい場合はテンポを下げましょう。"
            ]
        }
    }))));

export const CHROMATIC_HORIZONTAL_LESSON = Object.freeze({
    id: 2, code: "EX02", title: "EX02 クロマチック練習②",
    file: CHROMATIC_HORIZONTAL_STAGES[0].file, variants: CHROMATIC_HORIZONTAL_STAGES
});
