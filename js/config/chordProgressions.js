// Display EX01 identifies the progression; these stable variant/progress IDs never reuse chords-1..8.
export const CHORD_PROGRESSION_TITLE = "EX01 循環コード練習（I–vi–ii–V）";
export const CHORD_PROGRESSION_STAGES = [
    { variantId: "basic", variantLabel: "基本コード", progression: ["C", "Am", "Dm", "G", "C"],
        roman: "I–vi–ii–V–I", file: "scores/chords/progressions/i-vi-ii-v-basic.mxl" },
    { variantId: "seventh", variantLabel: "7thコード", progression: ["CM7", "Am7", "Dm7", "G7", "CM7"],
        roman: "Imaj7–vi7–ii7–V7–Imaj7", file: "scores/chords/progressions/i-vi-ii-v-seventh.mxl" }
].map(variant => Object.freeze({
    ...variant, progression: Object.freeze(variant.progression), id: 1, code: "EX01",
    lessonId: "chord-progressions-1", progressId: "chord-progressions-1-" + variant.variantId,
    practiceType: "chord-progression", stageBadge: "コード練習 EX01・" + variant.variantLabel,
    title: CHORD_PROGRESSION_TITLE + "・" + variant.variantLabel,
    desc: variant.progression.join(" → ") + "。前半4小節は2分音符2回、最後のコードは全音符で伸ばします。",
    bpm: 70, timeSignature: Object.freeze([4, 4]), countInBars: 1, practiceBars: 5, available: true,
    guide: {title: "💡 コードチェンジの練習", content: "I–vi–ii–V–Iの流れを練習しましょう。",
        points: ["カウントイン4拍のあと、1拍目と3拍目にコードを鳴らします。", "最後のC／CM7は4拍伸ばします。", "コードが変わる前に、次の押さえ方を準備しましょう。"]}
}));


// EX02 has one supplied basic score. Keep all EX01 IDs and objects unchanged.
CHORD_PROGRESSION_STAGES.push(Object.freeze({
    id: 2, code: "EX02", lessonId: "chord-progressions-2", progressId: "chord-progressions-2-basic",
    variantId: "basic", variantLabel: "基本コード", practiceType: "chord-progression",
    progression: Object.freeze(["F", "G", "Em", "Am"]), roman: "IV–V–iii–vi",
    cardTitle: "EX02 循環コード練習（IV–V–iii–vi）", stageBadge: "コード練習 EX02・基本コード",
    title: "EX02 循環コード練習（IV–V–iii–vi）・基本コード",
    file: "scores/chords/progressions/iv-v-iii-vi-basic.mxl",
    desc: "F → G → Em → Am。各小節で2分音符を2回鳴らします。",
    bpm: 70, timeSignature: Object.freeze([4, 4]), countInBars: 1, practiceBars: 4, available: true,
    rhythmLabel: "2分音符（各小節2回）",
    guide: { title: "💡 コードチェンジの練習", content: "IV–V–iii–viの流れを練習しましょう。",
        points: ["カウントイン4拍のあと、各小節の1拍目と3拍目にコードを鳴らします。", "F・Gはメジャー、Em・Amはマイナーです。", "最後のAmも2分音符を2回鳴らします。"] }
}));
