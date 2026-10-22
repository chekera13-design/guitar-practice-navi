// ソロギター教材。EX番号は基礎編から独立し、ホームではsolo-${id}で識別する。
export const SOLO_STAGES = [
    {
        id: 1,
        code: "EX1",
        stageBadge: "ソロギター EX1（表示検証用）",
        title: "EX1：小音符・奏法表示テスト",
        subTitle: "単独小音符・小音符和音・連続小音符",
        desc: "ソロギター用のTAB表示を確認するための検証フレーズです。",
        bpm: 60,
        timeSignature: [4, 4],
        countInBars: 1,
        practiceBars: 3,
        file: "scores/solo/test5.musicxml",
        available: true,
        isPreview: true,
        guide: {
            title: "💡 表示検証のポイント",
            content: "このEX1は表示検証用の仮教材です。正式な練習教材ではありません。通常の練習操作を使って、3小節のTAB表示を確認できます。",
            points: [
                "1小節目：単独小音符とH文字・スラーの表示を確認します。",
                "2小節目：小音符和音とS文字・スラーの表示を確認します。",
                "3小節目：連続小音符の標準表示を確認します。"
            ]
        }
    }
];
