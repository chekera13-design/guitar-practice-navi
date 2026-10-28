import { CHORD_FORMS } from "./chordForms.js";

// フォームIDと教材IDを分離し、同名の別フォームや将来のコードチェンジから再利用できる。
export const CHORD_STAGES = CHORD_FORMS.map((form, index) => {
    const id = index + 1;
    const code = "EX" + String(id).padStart(2, "0");
    const quality = form.quality === "minor" ? "マイナー" : "メジャー";
    return {
        id, code, formId: form.id, practiceType: "single-chord",
        stageBadge: "コード練習 " + code,
        title: code + "：" + form.name + "コードの練習",
        subTitle: quality + "・ローコード・全音符",
        desc: form.name + "コードを各小節の1拍目に鳴らし、4拍分伸ばしましょう。同じコードを2小節練習します。",
        bpm: 70, timeSignature: [4, 4], countInBars: 1, practiceBars: 2,
        file: "scores/chords/" + code.toLowerCase() + ".mxl",
        available: true, isPreview: false,
        guide: {
            title: "💡 練習のポイント",
            content: "カウントイン4拍の後、各小節の1拍目に" + form.name + "コードを鳴らし、4拍分の響きを聴きましょう。",
            points: [
                "「×」の弦は鳴らさず、「○」の弦は開放弦で鳴らします。",
                "ダイアグラムとTABを見て、押さえた弦と開放弦の音がきれいに鳴るか確かめましょう。",
                "1拍ごとに弾き直さず、全音符1つを4拍分伸ばします。初期テンポは70 BPMです。"
            ]
        }
    };
});
