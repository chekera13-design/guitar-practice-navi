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

// 【難易度3 : はじめてのコード入門編】
export const STAGES_LEVEL3 = [
    {
        id: 1, 
        title: "EX 1: Em コードストローク (全音符)", 
        desc: "4カウント後、1拍目でEmを一気に『ジャラーン』！4拍伸ばそう",
        type: "chord_strum",
        chordName: "Em",
        bpm: 60,
        // Em構成音: E2(40), B2(47), E3(52), G3(55), B3(59), E4(64)
        targetMidis: [40, 47, 52, 55, 59, 64],
        tex: '\\tempo 60 \\title "EX 1: Em ストローク" . :1 (0.6 2.5 2.4 0.3 0.2 0.1) |',
        guide: {
            title: "EX 1: 4拍伸ばすEmストロークのコツ",
            content: "4カウント（4・3・2・1）に合わせて準備し、1拍目で上から下へ一気にピックを振り抜きます！すべての弦が均一に鳴るように手首をやわらかく振り、4拍目まで音を響かせましょう。"
        },
        defaultNotes: [
            { midi: 40, name: "Em", fullName: "Em Chord", string: 0, fret: 0 }
        ]
    },
    {
        id: 2, title: "EX 2: 哀愁の響き「Am」", desc: "Emの形を1段下へずらし、人差し指を足すAmコード",
        tex: '\\title "EX 2: Am コード" . :4 0.5 2.4 2.3 1.2 |',
        guide: {
            title: "EX 2: Amコードの指立てと親指の位置",
            content: "5弦は開放弦、4弦2f(中指)、3弦2f(薬指)、2弦1f(人差し指)です。人差し指の腹が1弦に当たらないように、ネック裏の親指を少し下げて手のひらに空間を作りましょう。"
        },
        defaultNotes: [
            { midi: 45, name: "A", octave: 2, fullName: "A2", string: 5, fret: 0 },
            { midi: 52, name: "E", octave: 3, fullName: "E3", string: 4, fret: 2 },
            { midi: 57, name: "A", octave: 3, fullName: "A3", string: 3, fret: 2 },
            { midi: 60, name: "C", octave: 4, fullName: "C4", string: 2, fret: 1 }
        ]
    },
    {
        id: 3, title: "EX 3: Em ⇄ Am コードチェンジ", desc: "基本コードの切り替えに挑戦！指の形を保ったまま移動しよう",
        tex: '\\title "EX 3: Em ⇄ Am チェンジ" . :4 0.6 2.5 0.5 1.2 |',
        guide: {
            title: "EX 3: コードチェンジを素早くするコツ",
            content: "中指と薬指の「指の幅」を崩さず、そのまま1段下（または上）にスライドさせるイメージで動かします。指を一本ずつ探して押さえるのではなく、同時に着地できるように練習しましょう。"
        },
        defaultNotes: [
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0 },
            { midi: 47, name: "B", octave: 2, fullName: "B2", string: 5, fret: 2 },
            { midi: 45, name: "A", octave: 2, fullName: "A2", string: 5, fret: 0 },
            { midi: 60, name: "C", octave: 4, fullName: "C4", string: 2, fret: 1 }
        ]
    },
    {
        id: 4, title: "EX 4: 明るく力強い「E (メジャー)」", desc: "Amと全く同じ指の形を1段上に戻すと「E」になる！",
        tex: '\\title "EX 4: E メジャーコード" . :4 0.6 2.5 2.4 1.3 |',
        guide: {
            title: "EX 4: EコードとAmコードの深い関係",
            content: "Amを押さえたフォームのまま、すべての指を1弦ずつ上（6〜3弦側）に移動させるとEコードになります。ギターのコードフォームはこうして形ごと連動して覚えられます！"
        },
        defaultNotes: [
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0 },
            { midi: 47, name: "B", octave: 2, fullName: "B2", string: 5, fret: 2 },
            { midi: 52, name: "E", octave: 3, fullName: "E3", string: 4, fret: 2 },
            { midi: 56, name: "G#", octave: 3, fullName: "G#3", string: 3, fret: 1 }
        ]
    },
    {
        id: 5, title: "EX 5: ポップスの王道「Cmaj7 (シーメジャーセブン)」", desc: "指2本だけ！都会的でおしゃれな響きのコード",
        tex: '\\title "EX 5: Cmaj7 コード" . :4 3.5 2.4 0.3 0.2 |',
        guide: {
            title: "EX 5: Cコードの前にCmaj7で指を慣らす",
            content: "薬指で5弦3f、中指で4弦2fを押さえます。3弦・2弦は開放弦です。薬指の第一関節をしっかり立てて、開放弦に触れない綺麗な響きを作りましょう。"
        },
        defaultNotes: [
            { midi: 48, name: "C", octave: 3, fullName: "C3", string: 5, fret: 3 },
            { midi: 52, name: "E", octave: 3, fullName: "E3", string: 4, fret: 2 },
            { midi: 55, name: "G", octave: 3, fullName: "G3", string: 3, fret: 0 },
            { midi: 59, name: "B", octave: 3, fullName: "B3", string: 2, fret: 0 }
        ]
    },
    {
        id: 6, title: "EX 6: 初心者の登竜門「C (メジャー)」", desc: "Cmaj7に人差し指を足すだけ！超重要コード「C」",
        tex: '\\title "EX 6: C メジャーコード" . :4 3.5 2.4 0.3 1.2 |',
        guide: {
            title: "EX 6: Cコードの1弦・3弦音詰まり解消法",
            content: "さきほどのCmaj7に、人差し指で2弦1fを足すと「Cコード」の完成です。初心者が最も詰まりやすいのは3弦と1弦です。手首を軽く前に突き出すようにすると指が垂直に立ちます。"
        },
        defaultNotes: [
            { midi: 48, name: "C", octave: 3, fullName: "C3", string: 5, fret: 3 },
            { midi: 52, name: "E", octave: 3, fullName: "E3", string: 4, fret: 2 },
            { midi: 55, name: "G", octave: 3, fullName: "G3", string: 3, fret: 0 },
            { midi: 60, name: "C", octave: 4, fullName: "C4", string: 2, fret: 1 }
        ]
    },
    {
        id: 7, title: "EX 7: 高音弦の三角形「D (メジャー)」", desc: "1〜3弦の高音を軽やかに鳴らすDコード",
        tex: '\\title "EX 7: D メジャーコード" . :4 0.4 2.3 3.2 2.1 |',
        guide: {
            title: "EX 7: 1弦と2弦が詰まらないように注意",
            content: "4弦開放、3弦2f(人差し指)、2弦3f(薬指)、1弦2f(中指)を押さえます。3本の指で小さな三角形を作るイメージです。薬指が寝て1弦に触れないよう、指先でピンポイントに押さえましょう。"
        },
        defaultNotes: [
            { midi: 50, name: "D", octave: 3, fullName: "D3", string: 4, fret: 0 },
            { midi: 57, name: "A", octave: 3, fullName: "A3", string: 3, fret: 2 },
            { midi: 62, name: "D", octave: 4, fullName: "D4", string: 2, fret: 3 },
            { midi: 66, name: "F#", octave: 4, fullName: "F#4", string: 1, fret: 2 }
        ]
    },
    {
        id: 8, title: "EX 8: 広がりを感じる「G (メジャー)」", desc: "指を大きく開いて6弦・5弦・1弦を押さえるGコード",
        tex: '\\title "EX 8: G メジャーコード" . :4 3.6 2.5 0.3 3.1 |',
        guide: {
            title: "EX 8: Gコードで指を広げるコツ",
            content: "中指で6弦3f、人差し指で5弦2f、薬指(または小指)で1弦3fを押さえます。手が届きにくい場合は、ギターのネックを少し斜め上に持ち上げて構えてみてください。"
        },
        defaultNotes: [
            { midi: 43, name: "G", octave: 2, fullName: "G2", string: 6, fret: 3 },
            { midi: 47, name: "B", octave: 2, fullName: "B2", string: 5, fret: 2 },
            { midi: 55, name: "G", octave: 3, fullName: "G3", string: 3, fret: 0 },
            { midi: 67, name: "G", octave: 4, fullName: "G4", string: 1, fret: 3 }
        ]
    },
    {
        id: 9, title: "EX 9: 王道3大コードチェンジ (G ➔ C ➔ D)", desc: "世界中の名曲で使われる黄金の3コード進行！",
        tex: '\\title "EX 9: G - C - D チェンジ" . :4 3.6 3.5 0.4 2.1 |',
        guide: {
            title: "EX 9: 代表的なコード進行にチャレンジ",
            content: "Gのルート(6弦3f) ➔ Cのルート(5弦3f) ➔ Dのルート(4弦開放) ➔ Dの1弦(1弦2f) と順番に弾いていきます。コードの移り変わりのスムーズさを意識しましょう。"
        },
        defaultNotes: [
            { midi: 43, name: "G", octave: 2, fullName: "G2", string: 6, fret: 3 },
            { midi: 48, name: "C", octave: 3, fullName: "C3", string: 5, fret: 3 },
            { midi: 50, name: "D", octave: 3, fullName: "D3", string: 4, fret: 0 },
            { midi: 66, name: "F#", octave: 4, fullName: "F#4", string: 1, fret: 2 }
        ]
    },
    {
        id: 10, title: "EX 10: 難易度3 卒業テスト (カノン進行)", desc: "C ➔ G ➔ Am ➔ Em のヒット曲の王道進行を完奏！",
        tex: '\\title "EX 10: 難易度3 卒業テスト" . :4 3.5 3.6 0.5 0.6 |',
        guide: {
            title: "EX 10: カノン進行のルート音を制覇！",
            content: "Cコード(5弦3f) ➔ Gコード(6弦3f) ➔ Amコード(5弦開放) ➔ Emコード(6弦開放) とコードの響きを感じながらピッキング。全弦綺麗な音で鳴らし切れたらコード入門卒業です！"
        },
        defaultNotes: [
            { midi: 48, name: "C", octave: 3, fullName: "C3", string: 5, fret: 3 },
            { midi: 43, name: "G", octave: 2, fullName: "G2", string: 6, fret: 3 },
            { midi: 45, name: "A", octave: 2, fullName: "A2", string: 5, fret: 0 },
            { midi: 40, name: "E", octave: 2, fullName: "E2", string: 6, fret: 0 }
        ]
    }
];

// 音名とデフォルトチューニング設定
export const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const defaultTuning = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 };
export const SAVE_KEY = "guitar_app_save_data_v2";