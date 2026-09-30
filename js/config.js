// ==========================================
// ギター練習ナビ - 設定＆ステージ定義データ (js/config.js)
// ==========================================

// 【難易度1 : 音程入門編】
export const STAGES_LEVEL1 = [
    {
        id: 1, title: "EX 1: 6弦開放 (E2)", desc: "一番太い6弦の開放弦を弾いてみよう",
        guide: {
            title: "EX 1: 6弦開放弦ピッキングのコツ",
            content: "ギターで最も太い6弦は、ピックに伝わる手応えが大きいため初心者が最も力みやすい弦です。ピックを力いっぱい振り抜くのではなく、手首の重みを利用して上から下へポロンと落とすようにピッキングしてみましょう。隣の5弦に触れてしまわないよう注意してください。"
        },
        defaultNotes: [
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0 },
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0 },
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0 },
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0 }
        ]
    },
    {
        id: 2, title: "EX 2: 5弦開放 (A2)", desc: "5弦の開放弦を4回ピッキングしてみよう",
        guide: {
            title: "EX 2: 5弦を正確に狙い撃つコツ",
            content: "6弦のすぐ隣にある5弦を狙う練習です。弾こうとしたときに6弦をかすめてしまっていませんか？右手の前腕をギターのボディのフチに軽く当てて支点を作ると、右手の位置が安定して狙った弦だけを正確にヒットできるようになります。"
        },
        defaultNotes: [
            { midi: 45, name: "A", octave: 2, fullName: "A2", string: 5, fret: 0 },
            { midi: 45, name: "A", octave: 2, fullName: "A2", string: 5, fret: 0 },
            { midi: 45, name: "A", octave: 2, fullName: "A2", string: 5, fret: 0 },
            { midi: 45, name: "A", octave: 2, fullName: "A2", string: 5, fret: 0 }
        ]
    },
    {
        id: 3, title: "EX 3: 4弦開放 (D3)", desc: "4弦の開放弦をピッキング",
        guide: {
            title: "EX 3: 中音域への移動と深さコントロール",
            content: "4弦はギターのちょうど真ん中に位置する弦です。巻き弦のピッキングを均一な音量で鳴らせるように、ピックが弦に入り込む深さを毎回2〜3mmで一定にキープしましょう。"
        },
        defaultNotes: [
            { midi: 50, name: "D", octave: 3, fullName: "D3", string: 4, fret: 0 },
            { midi: 50, name: "D", octave: 3, fullName: "D3", string: 4, fret: 0 },
            { midi: 50, name: "D", octave: 3, fullName: "D3", string: 4, fret: 0 },
            { midi: 50, name: "D", octave: 3, fullName: "D3", string: 4, fret: 0 }
        ]
    },
    {
        id: 4, title: "EX 4: 3弦開放 (G3)", desc: "3弦の開放弦を鳴らしてみよう",
        guide: {
            title: "EX 4: プレーン弦特有の感触に慣れよう",
            content: "エレキギターでは3弦からプレーン弦になることが多く、太い巻き弦と比べてピックがツルッと滑りやすくなります。弦の芯をしっかり捉えて弾きましょう。"
        },
        defaultNotes: [
            { midi: 55, name: "G", octave: 3, fullName: "G3", string: 3, fret: 0 },
            { midi: 55, name: "G", octave: 3, fullName: "G3", string: 3, fret: 0 },
            { midi: 55, name: "G", octave: 3, fullName: "G3", string: 3, fret: 0 },
            { midi: 55, name: "G", octave: 3, fullName: "G3", string: 3, fret: 0 }
        ]
    },
    {
        id: 5, title: "EX 5: 2弦開放 (B3)", desc: "2弦の開放弦をクリアしよう",
        guide: {
            title: "EX 5: 繊細なタッチと脱力",
            content: "細い高音弦は力を入れすぎるとピッチが高くなってしまいます。ピックを握る力を緩め、弦を優しく弾くリラックスしたフォームを意識しましょう。"
        },
        defaultNotes: [
            { midi: 59, name: "B", octave: 3, fullName: "B3", string: 2, fret: 0 },
            { midi: 59, name: "B", octave: 3, fullName: "B3", string: 2, fret: 0 },
            { midi: 59, name: "B", octave: 3, fullName: "B3", string: 2, fret: 0 },
            { midi: 59, name: "B", octave: 3, fullName: "B3", string: 2, fret: 0 }
        ]
    },
    {
        id: 6, title: "EX 6: 1弦開放 (E4)", desc: "一番細い1弦の開放弦を弾こう",
        guide: {
            title: "EX 6: 1弦の引っかかりを防ぐ振り抜き",
            content: "一番外側の1弦は、ピックを下へ振り抜いたときに空振りしがちです。ピックは下方向に潜り込ませず、弦の表面を斜め下に向かってサラリと通過させましょう。"
        },
        defaultNotes: [
            { midi: 64, name: "E", octave: 4, fullName: "E4", string: 1, fret: 0 },
            { midi: 64, name: "E", octave: 4, fullName: "E4", string: 1, fret: 0 },
            { midi: 64, name: "E", octave: 4, fullName: "E4", string: 1, fret: 0 },
            { midi: 64, name: "E", octave: 4, fullName: "E4", string: 1, fret: 0 }
        ]
    },
    {
        id: 7, title: "EX 7: 低音弦コンボ (6〜4弦)", desc: "6弦 ➔ 5弦 ➔ 4弦 と順番に弾き分け",
        guide: {
            title: "EX 7: 弦移動（ストリング・トラッキング）の極意",
            content: "手首の角度だけで無理に届かせようとせず、右腕全体をほんの少し下へスライドさせて移動するのが安定のコツです。"
        },
        defaultNotes: [
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0 },
            { midi: 45, name: "A", octave: 2, fullName: "A2", string: 5, fret: 0 },
            { midi: 50, name: "D", octave: 3, fullName: "D3", string: 4, fret: 0 },
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0 }
        ]
    },
    {
        id: 8, title: "EX 8: 高音弦コンボ (3〜1弦)", desc: "3弦 ➔ 2弦 ➔ 1弦 を順番に弾こう",
        guide: {
            title: "EX 8: 高音弦での安定したピッキング往復",
            content: "ソロやアルペジオで頻繁に使う3〜1弦の移動です。前の音の響きを意識しながら次の弦へリズミカルにピックを当てていきましょう。"
        },
        defaultNotes: [
            { midi: 55, name: "G", octave: 3, fullName: "G3", string: 3, fret: 0 },
            { midi: 59, name: "B", octave: 3, fullName: "B3", string: 2, fret: 0 },
            { midi: 64, name: "E", octave: 4, fullName: "E4", string: 1, fret: 0 },
            { midi: 59, name: "B", octave: 3, fullName: "B3", string: 2, fret: 0 }
        ]
    },
    {
        id: 9, title: "EX 9: 全開放アルペジオ (6➔1弦)", desc: "6弦から1弦まで流れるようにピッキング！",
        guide: {
            title: "EX 9: 全弦を駆け抜けるピッキング",
            content: "6本の弦すべてを順番に弾く、難易度1の集大成です。一定のスピード・同じ音量で最後まで均一に弾ききれるかチャレンジしてください！"
        },
        defaultNotes: [
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0 },
            { midi: 45, name: "A", octave: 2, fullName: "A2", string: 5, fret: 0 },
            { midi: 50, name: "D", octave: 3, fullName: "D3", string: 4, fret: 0 },
            { midi: 55, name: "G", octave: 3, fullName: "G3", string: 3, fret: 0 },
            { midi: 59, name: "B", octave: 3, fullName: "B3", string: 2, fret: 0 },
            { midi: 64, name: "E", octave: 4, fullName: "E4", string: 1, fret: 0 }
        ]
    },
    {
        id: 10, title: "EX 10: 難易度1 卒業テスト", desc: "開放弦マスターの最終チャレンジ！",
        guide: {
            title: "EX 10: 難易度1 卒業テスト！",
            content: "6弦 ➔ 4弦 ➔ 2弦 ➔ 1弦 と弦をスキップして跳躍するテストです。手元を見ずに目的の弦を正確にヒットできたら合格です！"
        },
        defaultNotes: [
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0 },
            { midi: 50, name: "D", octave: 3, fullName: "D3", string: 4, fret: 0 },
            { midi: 59, name: "B", octave: 3, fullName: "B3", string: 2, fret: 0 },
            { midi: 64, name: "E", octave: 4, fullName: "E4", string: 1, fret: 0 }
        ]
    }
];

// 【難易度2 : リズム基礎編】
export const STAGES_LEVEL2 = [
    {
        id: 1, title: "EX 1: 4分音符ピッキング (BPM 60)", desc: "カチッと鳴るメトロノームに合わせて6弦を4拍弾こう",
        bpm: 60,
        tex: '\\tempo 60 \\title "EX 1: 4分音符ピッキング (BPM 60)" . :4 0.6 0.6 0.6 0.6 |',
        guide: {
            title: "EX 1: メトロノームのビートに乗るコツ",
            content: "4拍のカウントイン（4・3・2・1）に合わせて準備しましょう。音を聴いてから慌てて弾くのではなく、クリック音と『同時』にピックが弦を通過する感覚を掴むのがポイントです。"
        },
        defaultNotes: [
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0, beat: 0 },
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0, beat: 1 },
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0, beat: 2 },
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0, beat: 3 }
        ]
    },
    {
        id: 2, title: "EX 2: テンポアップ (BPM 75)", desc: "テンポを少し上げて、軽快な4分音符に挑戦！",
        bpm: 75,
        tex: '\\tempo 75 \\title "EX 2: テンポアップ (BPM 75)" . :4 0.6 0.6 0.6 0.6 |',
        guide: {
            title: "EX 2: テンポが上がっても力まない",
            content: "速くなると力んでピックを強く握りがちです。手首の力を抜き、振り幅を少し小さくすると軽やかにリズムをキープできます。"
        },
        defaultNotes: [
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0, beat: 0 },
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0, beat: 1 },
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0, beat: 2 },
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0, beat: 3 }
        ]
    },
    {
        id: 3, title: "EX 3: 5弦 4分音符ピッキング (BPM 70)", desc: "5弦開放をビートに合わせて正確にヒット！",
        bpm: 70,
        tex: '\\tempo 70 \\title "EX 3: 5弦 4分音符ピッキング (BPM 70)" . :4 0.5 0.5 0.5 0.5 |',
        guide: {
            title: "EX 3: 弦が変わってもリズムをキープ",
            content: "狙う弦が変わっても焦らず、右手のフォームを安定させて4拍連続でジャストタイミングを狙いましょう。"
        },
        defaultNotes: [
            { midi: 45, name: "A", octave: 2, fullName: "A2", string: 5, fret: 0, beat: 0 },
            { midi: 45, name: "A", octave: 2, fullName: "A2", string: 5, fret: 0, beat: 1 },
            { midi: 45, name: "A", octave: 2, fullName: "A2", string: 5, fret: 0, beat: 2 },
            { midi: 45, name: "A", octave: 2, fullName: "A2", string: 5, fret: 0, beat: 3 }
        ]
    },
    {
        id: 4, title: "EX 4: 2弦 & 1弦 交互リズム (BPM 60)", desc: "高音弦を2拍ずつ交互にピッキング！",
        bpm: 60,
        tex: '\\tempo 60 \\title "EX 4: 2弦 & 1弦 交互リズム (BPM 60)" . :4 0.2 0.2 0.1 0.1 |',
        guide: {
            title: "EX 4: リズムに乗った弦移動",
            content: "2弦を2拍弾いた後、3拍目でスムーズに1弦へ移動します。拍の間に慌てず腕のポジションを整えましょう。"
        },
        defaultNotes: [
            { midi: 59, name: "B", octave: 3, fullName: "B3", string: 2, fret: 0, beat: 0 },
            { midi: 59, name: "B", octave: 3, fullName: "B3", string: 2, fret: 0, beat: 1 },
            { midi: 64, name: "E", octave: 4, fullName: "E4", string: 1, fret: 0, beat: 2 },
            { midi: 64, name: "E", octave: 4, fullName: "E4", string: 1, fret: 0, beat: 3 }
        ]
    },
    {
        id: 5, title: "EX 5: 2拍伸ばす 2分音符 (BPM 60)", desc: "1拍目と3拍目にピッキング。音をしっかり保とう",
        bpm: 60,
        tex: '\\tempo 60 \\title "EX 5: 2拍伸ばす 2分音符 (BPM 60)" . :2 0.6 0.6 |',
        guide: {
            title: "EX 5: 2拍分の長さを体感する",
            content: "1拍目を弾いたあと、2拍目は音を伸ばしてキープ。そして3拍目で次の音をピッキングします。弾かない拍も心の中で『イチ・ニ・サン・シ』と数えるのが大切です。"
        },
        defaultNotes: [
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0, beat: 0 },
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0, beat: 2 }
        ]
    },
    {
        id: 6, title: "EX 6: 4分休符を挟むリズム (BPM 60)", desc: "タン・ウン・タン・ウン（休符は弾かずに待つ！）",
        bpm: 60,
        tex: '\\tempo 60 \\title "EX 6: 4分休符に慣れる (BPM 60)" . :4 0.6 r 0.6 r |',
        guide: {
            title: "EX 6: 休符（休み）を恐れないピッキング",
            content: "音楽では『弾かない時間』もリズムの一部です。2拍目と4拍目の休符で焦って弾いてしまわないよう、しっかりクリックを聴いて待ちましょう。"
        },
        defaultNotes: [
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0, beat: 0 },
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0, beat: 2 }
        ]
    },
    {
        id: 7, title: "EX 7: 8分音符ダウンピッキング (BPM 60)", desc: "1拍に2回！『タタタタタタタタ』と8回連続ヒット",
        bpm: 60,
        tex: '\\tempo 60 \\title "EX 7: 8分音符ピッキング (BPM 60)" . :8 0.6 0.6 0.6 0.6 0.6 0.6 0.6 0.6 |',
        guide: {
            title: "EX 7: 8分音符の均等な刻み",
            content: "メトロノームの1クリックの間に2回ピッキングします。『1ト・2ト・3ト・4ト』と言葉を合わせながら、均一な音量・スピードで振り抜きましょう。"
        },
        defaultNotes: [
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0, beat: 0.0 },
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0, beat: 0.5 },
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0, beat: 1.0 },
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0, beat: 1.5 },
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0, beat: 2.0 },
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0, beat: 2.5 },
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0, beat: 3.0 },
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0, beat: 3.5 }
        ]
    },
    {
        id: 8, title: "EX 8: 低音弦ストロークリズム (BPM 65)", desc: "6弦 ➔ 5弦 ➔ 4弦 ➔ 6弦 を1拍ずつ弾き分け",
        bpm: 65,
        tex: '\\tempo 65 \\title "EX 8: 低音弦ストロークリズム (BPM 65)" . :4 0.6 0.5 0.4 0.6 |',
        guide: {
            title: "EX 8: リズムに乗せて弦を移動する",
            content: "弦を移動しながらも拍が遅れないように注意しましょう。前の音を鳴らした瞬間には、すでに次の弦へ右手を移動させる準備をしておきます。"
        },
        defaultNotes: [
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0, beat: 0 },
            { midi: 45, name: "A", octave: 2, fullName: "A2", string: 5, fret: 0, beat: 1 },
            { midi: 50, name: "D", octave: 3, fullName: "D3", string: 4, fret: 0, beat: 2 },
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0, beat: 3 }
        ]
    },
    {
        id: 9, title: "EX 9: 4分・8分リズムコンボ (BPM 70)", desc: "『タン・タタ・タン・タタ』の実践的リズム！",
        bpm: 70,
        tex: '\\tempo 70 \\title "EX 9: 実践リズムコンボ (BPM 70)" . :4 0.6 :8 0.6 0.6 :4 0.6 :8 0.6 0.6 |',
        guide: {
            title: "EX 9: ロックやポップスの定番リズム",
            content: "4分音符（1拍）と8分音符（半拍×2）が交互に現れるリズムです。右手の振りを一定に保ちながらピッキングのタイミングを切り替えましょう。"
        },
        defaultNotes: [
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0, beat: 0.0 },
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0, beat: 1.0 },
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0, beat: 1.5 },
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0, beat: 2.0 },
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0, beat: 3.0 },
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0, beat: 3.5 }
        ]
    },
    {
        id: 10, title: "EX 10: 難易度2 卒業テスト (BPM 75)", desc: "弦移動とリズム変化の総力戦！",
        bpm: 75,
        tex: '\\tempo 75 \\title "EX 10: 難易度2 卒業テスト (BPM 75)" . :4 0.6 0.5 :8 0.4 0.4 :4 0.6 |',
        guide: {
            title: "EX 10: リズム基礎編の最終テスト",
            content: "6弦(4分) ➔ 5弦(4分) ➔ 4弦(8分×2) ➔ 6弦(4分) の総合フレーズです。メトロノームのビートからズレずに弾き切れたら難易度2クリアです！"
        },
        defaultNotes: [
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0, beat: 0.0 },
            { midi: 45, name: "A", octave: 2, fullName: "A2", string: 5, fret: 0, beat: 1.0 },
            { midi: 50, name: "D", octave: 3, fullName: "D3", string: 4, fret: 0, beat: 2.0 },
            { midi: 50, name: "D", octave: 3, fullName: "D3", string: 4, fret: 0, beat: 2.5 },
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0, beat: 3.0 }
        ]
    }
];

// 【難易度3 : コード入門編（ストローク主体）】
export const STAGES_LEVEL3 = [
    // --- パターンA: 1コードずつ丁寧に鳴らす（EX 1〜5） ---
    {
        id: 1,
        title: "EX 1: Em コードストローク",
        desc: "ギターの基本！6本すべての弦を一気にジャラーンと響かせよう",
        mode: "patternA",
        chords: ["Em"],
        bpm: 60,
        tex: '\\tempo 60 \\title "EX 1: Em ストローク" . :1 (0.6 2.5 2.4 0.3 0.2 0.1) |',
        guide: {
            title: "EX 1: 4拍伸ばすEmストロークのコツ",
            content: "4カウント（4・3・2・1）に合わせて準備し、1拍目で上から下へ一気にピックを振り抜きます！すべての弦が均一に鳴るように手首をやわらかく振り、4拍目まで音を響かせましょう。"
        },
        defaultNotes: [{ midi: 40, name: "Em", fullName: "Em Chord", string: 0, fret: 0 }]
    },
    {
        id: 2,
        title: "EX 2: 哀愁の響き「Am」",
        desc: "5弦から下を優しくストローク！人差し指をしっかり立てて鳴らそう",
        mode: "patternA",
        chords: ["Am"],
        bpm: 60,
        tex: '\\tempo 60 \\title "EX 2: Am ストローク" . :1 (0.5 2.4 2.3 1.2 0.1) |',
        guide: {
            title: "EX 2: Amコードのストロークのコツ",
            content: "Amは5弦から1弦に向かって弾きます（6弦は鳴らしません）。人差し指の腹が1弦に当たると1弦がミュートされてしまうので、指の関節をしっかり曲げて立てましょう。"
        },
        defaultNotes: [{ midi: 45, name: "Am", fullName: "Am Chord", string: 0, fret: 0 }]
    },
    {
        id: 3,
        title: "EX 3: Em ⇄ Am コードチェンジ",
        desc: "まずEmをストローク ➔ 落ち着いてAmを押さえ直してストローク！",
        mode: "patternA",
        chords: ["Em", "Am"],
        bpm: 60,
        tex: '\\tempo 60 \\title "EX 3: Em ⇄ Am チェンジ" . :1 (0.6 2.5 2.4 0.3 0.2 0.1) | :1 (0.5 2.4 2.3 1.2 0.1) |',
        guide: {
            title: "EX 3: 指のフォームを保った移動",
            content: "Emを鳴らして合格したら、次のカウントに合わせてAmを押さえます。中指と薬指の幅をキープしたまま1段下へずらし、人差し指を足すイメージで移動しましょう。"
        },
        defaultNotes: [
            { midi: 40, name: "Em", fullName: "1. Em", string: 0, fret: 0 },
            { midi: 45, name: "Am", fullName: "2. Am", string: 0, fret: 0 }
        ]
    },
    {
        id: 4,
        title: "EX 4: 明るく力強い「E (メジャー)」",
        desc: "Amの指の形のまま1弦ずつ上へ！力強いメジャーコードを鳴らそう",
        mode: "patternA",
        chords: ["E"],
        bpm: 60,
        tex: '\\tempo 60 \\title "EX 4: E メジャー" . :1 (0.6 2.5 2.4 1.3 0.2 0.1) |',
        guide: {
            title: "EX 4: Eメジャーコードの響き",
            content: "Amを押さえた形のまま、すべての指を1本ずつ太い弦（6〜3弦側）へ平行移動するとEになります。全弦パワフルに振り抜きましょう！"
        },
        defaultNotes: [{ midi: 40, name: "E", fullName: "E Chord", string: 0, fret: 0 }]
    },
    {
        id: 5,
        title: "EX 5: ポップスの王道「Cmaj7」",
        desc: "指2本だけ！都会的でおしゃれな響きのCmaj7ストローク",
        mode: "patternA",
        chords: ["Cmaj7"],
        bpm: 60,
        tex: '\\tempo 60 \\title "EX 5: Cmaj7" . :1 (3.5 2.4 0.3 0.2 0.1) |',
        guide: {
            title: "EX 5: 開放弦を活かすCmaj7",
            content: "薬指（5弦3f）と中指（4弦2f）の2本だけで押さえます。3・2・1弦が綺麗な開放弦として鳴るよう、押さえた指が触れないように注意しましょう。"
        },
        defaultNotes: [{ midi: 48, name: "Cmaj7", fullName: "Cmaj7 Chord", string: 0, fret: 0 }]
    },

    // --- パターンB: リズムに合わせて進行を弾ききる（EX 6〜10） ---
    {
        id: 6,
        title: "EX 6: 初心者の登竜門「C」2小節ストローク",
        desc: "メトロノームに合わせて、2小節連続で1拍目に『ジャラーン』！",
        mode: "patternB",
        bpm: 60,
        progression: [
            { chord: "C", bar: 1, beat: 0 },
            { chord: "C", bar: 2, beat: 4 }
        ],
        tex: '\\tempo 60 \\title "EX 6: C リズムストローク" . :1 (3.5 2.4 0.3 1.2 0.1) | :1 (3.5 2.4 0.3 1.2 0.1) |',
        guide: {
            title: "EX 6: リズムに乗せて鳴らすCコード",
            content: "4カウントイン後、1小節目・2小節目の各1拍目でCコードをストロークします。2〜4拍目は音をしっかり伸ばしてビートを体感しましょう。"
        },
        defaultNotes: [
            { midi: 48, name: "C", fullName: "1小節目: C", string: 0, fret: 0 },
            { midi: 48, name: "C", fullName: "2小節目: C", string: 0, fret: 0 }
        ]
    },
    {
        id: 7,
        title: "EX 7: 高音弦の三角形「D」リズムストローク",
        desc: "高音弦（4〜1弦）を軽快にストローク！2小節続けて鳴らそう",
        mode: "patternB",
        bpm: 60,
        progression: [
            { chord: "D", bar: 1, beat: 0 },
            { chord: "D", bar: 2, beat: 4 }
        ],
        tex: '\\tempo 60 \\title "EX 7: D リズムストローク" . :1 (0.4 2.3 3.2 2.1) | :1 (0.4 2.3 3.2 2.1) |',
        guide: {
            title: "EX 7: 4弦から下をコンパクトに振る",
            content: "Dコードは太い6弦・5弦を鳴らさないのがポイントです。4弦から下に向かって手首のスナップでサラリと振り抜きましょう。"
        },
        defaultNotes: [
            { midi: 50, name: "D", fullName: "1小節目: D", string: 0, fret: 0 },
            { midi: 50, name: "D", fullName: "2小節目: D", string: 0, fret: 0 }
        ]
    },
    {
        id: 8,
        title: "EX 8: 広がりを感じる「G」リズムストローク",
        desc: "指をしっかり広げて6弦〜1弦までダイナミックに2小節ストローク！",
        mode: "patternB",
        bpm: 60,
        progression: [
            { chord: "G", bar: 1, beat: 0 },
            { chord: "G", bar: 2, beat: 4 }
        ],
        tex: '\\tempo 60 \\title "EX 8: G リズムストローク" . :1 (3.6 2.5 0.4 0.3 0.2 3.1) | :1 (3.6 2.5 0.4 0.3 0.2 3.1) |',
        guide: {
            title: "EX 8: 全弦鳴らすGコードの迫力",
            content: "6弦3f、5弦2f、1弦3fを押さえます。ネックの角度を少し高めに構えると、小指や薬指が1弦に届きやすくなります。"
        },
        defaultNotes: [
            { midi: 43, name: "G", fullName: "1小節目: G", string: 0, fret: 0 },
            { midi: 43, name: "G", fullName: "2小節目: G", string: 0, fret: 0 }
        ]
    },
    {
        id: 9,
        title: "EX 9: 王道3大コードチェンジ (G ➔ C ➔ D ➔ G)",
        desc: "世界中の名曲で使われるコード進行をメトロノームに合わせて完奏！",
        mode: "patternB",
        bpm: 60,
        progression: [
            { chord: "G", bar: 1, beat: 0 },
            { chord: "C", bar: 2, beat: 4 },
            { chord: "D", bar: 3, beat: 8 },
            { chord: "G", bar: 4, beat: 12 }
        ],
        tex: '\\tempo 60 \\title "EX 9: G - C - D チェンジ" . :1 (3.6 2.5 0.4 0.3 0.2 3.1) | :1 (3.5 2.4 0.3 1.2 0.1) | :1 (0.4 2.3 3.2 2.1) | :1 (3.6 2.5 0.4 0.3 0.2 3.1) |',
        guide: {
            title: "EX 9: 拍に遅れないコードチェンジ",
            content: "4拍目の余韻の間に、左手の力をふっと抜いて次のコードの形を空中で作り、次の1拍目ジャストに指を着地させてストロークします。"
        },
        defaultNotes: [
            { midi: 43, name: "G", fullName: "1. G", string: 0, fret: 0 },
            { midi: 48, name: "C", fullName: "2. C", string: 0, fret: 0 },
            { midi: 50, name: "D", fullName: "3. D", string: 0, fret: 0 },
            { midi: 43, name: "G", fullName: "4. G", string: 0, fret: 0 }
        ]
    },
    {
        id: 10,
        title: "EX 10: 難易度3 卒業テスト (カノン進行)",
        desc: "C ➔ G ➔ Am ➔ Em！感動の王道コード進行をリズムに乗せて弾き切ろう！",
        mode: "patternB",
        bpm: 60,
        progression: [
            { chord: "C",  bar: 1, beat: 0 },
            { chord: "G",  bar: 2, beat: 4 },
            { chord: "Am", bar: 3, beat: 8 },
            { chord: "Em", bar: 4, beat: 12 }
        ],
        tex: '\\tempo 60 \\title "EX 10: カノン進行" . :1 (3.5 2.4 0.3 1.2 0.1) | :1 (3.6 2.5 0.4 0.3 0.2 3.1) | :1 (0.5 2.4 2.3 1.2 0.1) | :1 (0.6 2.5 2.4 0.3 0.2 0.1) |',
        guide: {
            title: "EX 10: コード入門の集大成！",
            content: "初心者が最初に習得すべき4大コードがすべて登場します。メトロノームのビートに乗って、すべての小節で美しく響かせたら難易度3クリアです！"
        },
        defaultNotes: [
            { midi: 48, name: "C",  fullName: "1. C",  string: 0, fret: 0 },
            { midi: 43, name: "G",  fullName: "2. G",  string: 0, fret: 0 },
            { midi: 45, name: "Am", fullName: "3. Am", string: 0, fret: 0 },
            { midi: 40, name: "Em", fullName: "4. Em", string: 0, fret: 0 }
        ]
    }
];

export const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const defaultTuning = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 };
export const SAVE_KEY = "guitar_app_save_data_v2";