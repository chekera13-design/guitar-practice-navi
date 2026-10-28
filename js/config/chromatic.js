// EX番号はこの順序で固定。指番号1〜4は5〜8フレットに対応する。
const chromaticPatterns = [
    "1234", "1243", "1324", "1342", "1423", "1432",
    "2134", "2143", "2314", "2341", "2413", "2431",
    "3124", "3142", "3214", "3241", "3412", "3421",
    "4123", "4132", "4213", "4231", "4312", "4321"
];

// 単独運指のメタデータは教材IDと分離。将来の複合教材も既存IDを変えず追加できる。
export const CHROMATIC_STAGES = chromaticPatterns.map((fingering, index) => {
    const id = index + 1;
    const code = "EX" + String(id).padStart(2, "0");
    const fretOrder = [...fingering].map(finger => Number(finger) + 4);
    const frets = fretOrder.join("→");
    return {
        id, code, patternType: "single", fingering, fretOrder,
        stageBadge: "クロマチック " + code,
        title: id === 1 ? "EX01：5〜8フレットのクロマチック練習"
            : code + "：運指" + fingering + "のクロマチック練習",
        subTitle: "8分音符・弦移動・5〜8フレット",
        desc: id === 1
            ? "6弦から1弦へ進み、1弦から6弦へ戻りながら、各弦で5〜8フレットを2回ずつ弾きます。"
            : "運指" + fingering + "（" + frets + "フレット）を各弦で2回ずつ弾き、6弦から1弦、1弦から6弦へ戻ります。",
        bpm: 80, timeSignature: [4, 4], countInBars: 1, practiceBars: 12,
        file: "scores/chromatic/" + code.toLowerCase() + ".mxl",
        available: true, isPreview: false,
        guide: {
            title: "💡 練習のポイント",
            content: "各弦で" + frets + "フレットを2回ずつ、8分音符で均等に弾きましょう。初期テンポは80 BPMです。難しい場合はテンポを下げて、音とリズムをそろえることを優先してください。",
            points: [
                "5・6・7・8フレットを、それぞれ人差し指・中指・薬指・小指で押さえましょう。",
                "1拍に2音を弾き、ダウン・アップを交互に続けましょう。",
                "弦は6→5→4→3→2→1→1→2→3→4→5→6の順です。戻るときもフレットは" + frets + "の順で弾きます。"
            ]
        }
    };
});
