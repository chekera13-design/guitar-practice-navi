// ==========================================
// 超ギタートレーニング（超ギタトレ） - 設定＆ステージ定義データ (js/config.js)
// ==========================================

export const BASIC_STAGES = [
    {
        id: 1,
        code: "EX 1",
        stageBadge: "基礎編 EX 1",
        title: "EX 1: 6弦開放 (E2) ピッキング",
        subTitle: "6弦開放 (E2)",
        desc: "一番太い6弦の開放弦を、メトロノームのビートに合わせて弾いてみよう！",
        bpm: 160,
        string: 6,
        noteName: "E2",
        timeSignature: [4, 4],  // 4/4拍子
        countInBars: 1,         // カウントイン 1小節
        practiceBars: 8,        // 練習小節数
        file: "scores/basic/ex01.mxl",
        available: true,
        guide: {
            title: "💡 6弦開放ピッキングのコツ & 練習のポイント",
            content: "ギターで最も太い6弦は、ピックに伝わる手応えが大きいため初心者が最も力みやすい弦です。ピックを力いっぱい振り抜くのではなく、手首の重みを利用して上から下へポロンと落とすようにピッキングしてみましょう。隣の5弦に触れてしまわないよう注意してください。",
            points: [
                "ピックの深さ: 先端2〜3mmだけを弦に当てて、手首をやわらかく使いましょう。",
                "リズムの合わせ方: クリック音を聴いてから慌てて弾くのではなく、カチッという音と「同時」に弦を通過させます。",
                "録音確認: 録音を聴き返して、音の大きさやタイミングが4回均一になっているか確かめましょう。"
            ]
        }
    },
    {
        id: 2,
        code: "EX 2",
        stageBadge: "基礎編 EX 2",
        title: "EX 2: 5弦開放 (A2) ピッキング",
        subTitle: "5弦開放 (A2)",
        desc: "5弦の開放弦を均一なタッチでピッキングする練習です。",
        bpm: 160,
        string: 5,
        noteName: "A2",
        timeSignature: [4, 4],
        countInBars: 1,
        practiceBars: 16,
        file: "scores/basic/ex02.mxl",
        available: true,
        guide: {
            title: "💡 5弦開放ピッキングのコツ & 練習のポイント",
            content: "5弦は6弦よりも少し細く、ピックが引っかかりにくくなります。手首を柔らかく使って、4回とも同じ音量・同じ音色で鳴らせるように意識しましょう。",
            points: [
                "ピックの角度: 弦に対してピックが斜めになりすぎないよう水平を保ちます。",
                "脱力: 肩や腕の力を抜いて、リラックスして弾きましょう。"
            ]
        }
    },
    {
        id: 3,
        code: "EX 3",
        stageBadge: "基礎編 EX 3",
        title: "EX 3: 4弦開放 (D3) ピッキング",
        subTitle: "4弦開放 (D3)",
        desc: "中音域の4弦のタッチ感を掴む練習です。",
        bpm: 160,
        string: 4,
        noteName: "D3",
        timeSignature: [4, 4],
        countInBars: 1,
        practiceBars: 8,
        file: "scores/basic/ex03.mxl",
        available: true,
        guide: {
            title: "💡 4弦開放ピッキングのコツ & 練習のポイント",
            content: "4弦は巻き弦の中で最も細い弦です。力任せに弾かず、芯のある澄んだ音を鳴らすことを意識してください。",
            points: [
                "振り幅のコントロール: 余計な弦を誤って触れてしまわないよう、ピッキングの振り幅をコンパクトに抑えましょう。"
            ]
        }
    },
    {
        id: 4,
        code: "EX 4",
        stageBadge: "基礎編 EX 4",
        title: "EX 4: 4小節連続開放弦ピッキング",
        subTitle: "4小節・弦移動 (6➔5➔4➔3弦)",
        desc: "【長尺練習】6弦から3弦へと1小節ずつ連続してピッキングしていく4小節の総合練習です！",
        bpm: 160,
        timeSignature: [4, 4],
        countInBars: 1,
        practiceBars: 16,
        file: "scores/basic/ex04.mxl",
        available: true,
        guide: {
            title: "💡 4小節連続ピッキングのコツ & 弦移動のポイント",
            content: "1小節ごとに弾く弦が変わります。小節の変わり目で慌てず、手首と前腕を少しずつ下方向（高音弦側）へスライドさせるように移動しましょう。",
            points: [
                "弦の狙い撃ち: 次の小節に入る直前に、視線を次の弦に移しておくのがスムーズな弦移動の秘訣です。",
                "テンポの維持: 弦が変わってもリズムが走ったりモタついたりせず、メトロノームと完全に同期させましょう。"
            ]
        }
    },
    {
        id: 5,
        code: "EX 5",
        stageBadge: "基礎編 EX 5",
        title: "EX 5: 4小節連続開放弦ピッキング",
        subTitle: "4小節・弦移動 (6➔5➔4➔3弦)",
        desc: "【長尺練習】6弦から3弦へと1小節ずつ連続してピッキングしていく4小節の総合練習です！",
        bpm: 160,
        timeSignature: [4, 4],
        countInBars: 1,
        practiceBars: 8,
        file: "scores/basic/ex05.mxl",
        available: true,
        guide: {
            title: "💡 4小節連続ピッキングのコツ & 弦移動のポイント",
            content: "1小節ごとに弾く弦が変わります。小節の変わり目で慌てず、手首と前腕を少しずつ下方向（高音弦側）へスライドさせるように移動しましょう。",
            points: [
                "弦の狙い撃ち: 次の小節に入る直前に、視線を次の弦に移しておくのがスムーズな弦移動の秘訣です。",
                "テンポの維持: 弦が変わってもリズムが走ったりモタついたりせず、メトロノームと完全に同期させましょう。"
            ]
        }
    },
    {
        id: 6,
        code: "EX 6",
        stageBadge: "基礎編 EX 6",
        title: "EX 6: 4小節連続開放弦ピッキング",
        subTitle: "4小節・弦移動 (6➔5➔4➔3弦)",
        desc: "【長尺練習】6弦から3弦へと1小節ずつ連続してピッキングしていく4小節の総合練習です！",
        bpm: 60,
        timeSignature: [4, 4],
        countInBars: 1,
        practiceBars: 16,
        file: "scores/basic/ex06.mxl",
        available: true,
        guide: {
            title: "💡 4小節連続ピッキングのコツ & 弦移動のポイント",
            content: "1小節ごとに弾く弦が変わります。小節の変わり目で慌てず、手首と前腕を少しずつ下方向（高音弦側）へスライドさせるように移動しましょう。",
            points: [
                "弦の狙い撃ち: 次の小節に入る直前に、視線を次の弦に移しておくのがスムーズな弦移動の秘訣です。",
                "テンポの維持: 弦が変わってもリズムが走ったりモタついたりせず、メトロノームと完全に同期させましょう。"
            ]
        }
    }
];

export const EX1_STAGE = BASIC_STAGES[0];
export const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const defaultTuning = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 };