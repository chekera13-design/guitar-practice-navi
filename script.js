// ==========================================
// ギター練習ナビ - スクリプト (難易度1 & 難易度2)
// ==========================================

// --- 1. ステージ定義 ---

// 【難易度1 : 音程入門編】(テンポフリー・確実に音を出す練習)
const STAGES_LEVEL1 = [
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

// 【難易度2 : リズム基礎編】(メトロノーム・カウントイン・タイミング判定)
const STAGES_LEVEL2 = [
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

// --- 2. 状態管理 & セーブデータ ---
const SAVE_KEY = "guitar_app_save_data_v2";
let rawSave = localStorage.getItem(SAVE_KEY) || localStorage.getItem("guitar_app_save_data");
let parsedSave = {};
try { parsedSave = JSON.parse(rawSave) || {}; } catch(e) { parsedSave = {}; }

let saveData = {
    level1: Array.isArray(parsedSave.level1) ? parsedSave.level1 : (Array.isArray(parsedSave.cleared) ? parsedSave.cleared : []),
    level2: Array.isArray(parsedSave.level2) ? parsedSave.level2 : []
};

let currentLevel = 1; // 1: 音程入門編, 2: リズム基礎編
let currentStageIndex = 0;
let currentNotes = [];
let currentIndex = 0;
let isChallenging = false;

// オーディオ & ピッチ判定
let audioContext = null;
let analyser = null;
let audioBuffer = null;
let prevRms = 0;
let isWaitingForNewAttack = false;
let lastNoteClearedTime = 0;
const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const defaultTuning = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 };

// 難易度2（リズム）専用ステート
let rhythmTimerIds = [];
let rhythmSongStartTime = 0;
let rhythmStats = { perfect: 0, good: 0, miss: 0 };
let isCountingIn = false;

// DOM要素の取得
const levelTab1 = document.getElementById('levelTab1');
const levelTab2 = document.getElementById('levelTab2');
const headerLevelTitle = document.getElementById('headerLevelTitle');
const headerLevelDesc = document.getElementById('headerLevelDesc');
const progressLabelText = document.getElementById('progressLabelText');
const progressPercentEl = document.getElementById('progressPercent');
const progressBarFill = document.getElementById('progressBarFill');
const resetProgressBtn = document.getElementById('resetProgressBtn');

const stagesGrid = document.getElementById('stagesGrid');
const currentStageBadge = document.getElementById('currentStageBadge');
const bpmBadge = document.getElementById('bpmBadge');
const currentStageTitle = document.getElementById('currentStageTitle');
const currentStageDesc = document.getElementById('currentStageDesc');
const fileInput = document.getElementById('fileInput');
const startChallengeBtn = document.getElementById('startChallengeBtn');

const hudCard = document.getElementById('hudCard');
const countInOverlay = document.getElementById('countInOverlay');
const countInNumber = document.getElementById('countInNumber');
const targetNoteEl = document.getElementById('targetNote');
const targetInfoEl = document.getElementById('targetInfo');
const rhythmJudgeBadge = document.getElementById('rhythmJudgeBadge');
const detectedBox = document.querySelector('.detected-box');
const detectedNoteEl = document.getElementById('detectedNote');
const detectedHzEl = document.getElementById('detectedHz');
const notesQueueEl = document.getElementById('notesQueue');

const guideTitle = document.getElementById('guideTitle');
const guideContent = document.getElementById('guideContent');

const clearModal = document.getElementById('clearModal');
const modalTitle = document.getElementById('modalTitle');
const modalDesc = document.getElementById('modalDesc');
const modalScoreStats = document.getElementById('modalScoreStats');
const statPerfect = document.getElementById('statPerfect');
const statGood = document.getElementById('statGood');
const statMiss = document.getElementById('statMiss');
const nextStageBtn = document.getElementById('nextStageBtn');
const retryBtn = document.getElementById('retryBtn');

// チューナー関連DOM
const tunerHud = document.getElementById('tunerHud');
const tunerTargetLabel = document.getElementById('tunerTargetLabel');
const tunerStatusText = document.getElementById('tunerStatusText');
const tunerMeterPointer = document.getElementById('tunerMeterPointer');
const tunerHzDisplay = document.getElementById('tunerHzDisplay');
let isTuning = false;
let currentTunerStringNum = null;
let tunerTargetFreq = 82.41;

// インフォモーダル関連DOM
const infoModal = document.getElementById('infoModal');
const infoModalTitle = document.getElementById('infoModalTitle');
const infoModalBody = document.getElementById('infoModalBody');
const closeInfoModalBtn = document.getElementById('closeInfoModalBtn');
const openAboutBtn = document.getElementById('openAboutBtn');
const openPrivacyBtn = document.getElementById('openPrivacyBtn');
const openContactBtn = document.getElementById('openContactBtn');

// --- 3. alphaTab 設定 & 自動描画 ---
const api = new alphaTab.AlphaTabApi(document.getElementById('alphaTab'), {
    core: { engine: 'svg' },
    display: { staveProfile: 'Tab', scale: 1.0 }
});

let isUserUploadedXml = false;

api.scoreLoaded.on((score) => {
    if (isUserUploadedXml) {
        const extracted = extractNotesFromScore(score);
        if (extracted.length > 0) {
            currentNotes = extracted;
            renderQueue();
            alert(`MusicXMLから ${extracted.length} 音を読み込みました！`);
        }
        isUserUploadedXml = false;
    }
});

function extractNotesFromScore(score) {
    const list = [];
    if (!score.tracks || score.tracks.length === 0) return list;
    const track = score.tracks[0];
    let currentBeatOffset = 0;
    for (const staff of track.staves) {
        for (const bar of staff.bars) {
            for (const voice of bar.voices) {
                for (const beat of voice.beats) {
                    if (!beat.isRest) {
                        for (const note of beat.notes) {
                            const stringNum = note.string;
                            const fretNum = note.fret;
                            const midi = note.realValue ?? (defaultTuning[stringNum] + fretNum);
                            const name = noteStrings[midi % 12];
                            const octave = Math.floor(midi / 12) - 1;
                            list.push({
                                midi, name, octave,
                                fullName: `${name}${octave}`,
                                string: stringNum, fret: fretNum,
                                beat: currentBeatOffset
                            });
                        }
                    }
                    currentBeatOffset += (beat.duration / 4);
                }
            }
        }
    }
    return list;
}

function renderStageTab(stage) {
    if (stage.tex) {
        api.tex(stage.tex);
    } else {
        const notesTex = stage.defaultNotes.map(n => `${n.fret}.${n.string}`).join(' ');
        api.tex(`\\title "${stage.title}" . :4 ${notesTex} |`);
    }
}

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    isUserUploadedXml = true;
    const reader = new FileReader();
    reader.onload = (event) => api.load(new Uint8Array(event.target.result));
    reader.readAsArrayBuffer(file);
});

// --- 4. 難易度切り替え (switchLevel) ---
function getCurrentStages() {
    return currentLevel === 1 ? STAGES_LEVEL1 : STAGES_LEVEL2;
}

function getClearedList() {
    return currentLevel === 1 ? saveData.level1 : saveData.level2;
}

window.switchLevel = function(level) {
    if (currentLevel === level) return;
    currentLevel = level;

    // 排他制御: 実行中の処理を停止
    stopChallenge();
    stopTuner();

    // タブの見た目更新
    levelTab1.classList.toggle('active', currentLevel === 1);
    levelTab2.classList.toggle('active', currentLevel === 2);

    // ヘッダータイトルの更新
    if (currentLevel === 1) {
        headerLevelTitle.innerText = "🎸 難易度 1 : 音程入門編";
        headerLevelDesc.innerText = "全ステージ合格を目指して、焦らず自分のペースでピッキングを身につけよう！";
        progressLabelText.innerText = "難易度1のクリア進捗";
        bpmBadge.classList.add('hidden');
        rhythmJudgeBadge.classList.add('hidden');
    } else {
        headerLevelTitle.innerText = "⏱️ 難易度 2 : リズム基礎編";
        headerLevelDesc.innerText = "メトロノームのビートに合わせてカウントイン！正確なタイミングで弦をヒットしよう！";
        progressLabelText.innerText = "難易度2のクリア進捗";
        rhythmJudgeBadge.classList.remove('hidden');
        rhythmJudgeBadge.innerText = "READY";
        rhythmJudgeBadge.className = "rhythm-judge";
    }

    currentStageIndex = 0;
    renderStages();
    selectStage(0);
};

// --- 5. ステージ選択UI & 進捗更新 ---
function renderStages() {
    stagesGrid.innerHTML = '';
    const stages = getCurrentStages();
    const clearedList = getClearedList();
    const maxUnlocked = clearedList.length + 1;

    stages.forEach((stage, idx) => {
        const isCleared = clearedList.includes(stage.id);
        const isLocked = stage.id > maxUnlocked;
        const isActive = idx === currentStageIndex;

        const btn = document.createElement('div');
        btn.className = `stage-btn ${isCleared ? 'cleared' : ''} ${isLocked ? 'locked' : ''} ${isActive ? 'active' : ''}`;

        let statusText = isCleared ? "💮 合格" : (isLocked ? "🔒 ロック" : "🟢 挑戦可能");

        btn.innerHTML = `
            <div class="stage-btn-top">
                <span>EX ${stage.id}</span>
                <span class="${isCleared ? 'cleared-status' : ''}">${statusText}</span>
            </div>
            <div class="stage-btn-title">${stage.title.split(': ')[1] || stage.title}</div>
        `;

        if (!isLocked) {
            btn.addEventListener('click', () => selectStage(idx));
        }

        stagesGrid.appendChild(btn);
    });

    const percent = Math.round((clearedList.length / stages.length) * 100);
    progressPercentEl.innerText = `${percent}% (${clearedList.length} / ${stages.length})`;
    progressBarFill.style.width = `${percent}%`;
}

function selectStage(index) {
    currentStageIndex = index;
    const stages = getCurrentStages();
    const stage = stages[index];

    stopChallenge();
    stopTuner();

    currentStageBadge.innerText = `EX ${stage.id}`;
    currentStageTitle.innerText = stage.title;
    currentStageDesc.innerText = stage.desc;

    if (currentLevel === 2 && stage.bpm) {
        bpmBadge.innerText = `BPM ${stage.bpm}`;
        bpmBadge.classList.remove('hidden');
    } else {
        bpmBadge.classList.add('hidden');
    }

    guideTitle.innerText = stage.guide.title;
    guideContent.innerHTML = `
        <p>${stage.guide.content}</p>
        <div class="guide-point-box">
            <div class="guide-point-title">目標クリア基準</div>
            <div>${currentLevel === 1 
                ? `全${stage.defaultNotes.length}音を落ち着いて正確に鳴らすと合格！焦らず自分のペースでピッキングしましょう。`
                : `メトロノームのリズムに合わせて正確にヒット！PERFECT & GOOD判定をたくさん出してクリアしよう。`}</div>
        </div>
    `;

    currentNotes = [...stage.defaultNotes];
    currentIndex = 0;

    renderStages();
    renderQueue();
    renderStageTab(stage);
}

// --- 6. オーディオ初期化 & 低音域フィルタリング ---
function unlockAudioContext() {
    if (!audioContext) {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

async function setupMicrophoneStream() {
    if (analyser) return;
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
    const source = audioContext.createMediaStreamSource(stream);

    // ギターの基音（82Hz〜330Hz）を際立たせるローパスフィルタ（倍音飛びや高周波ノイズをカット）
    const lowpass = audioContext.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(700, audioContext.currentTime);

    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;

    source.connect(lowpass);
    lowpass.connect(analyser);

    audioBuffer = new Float32Array(analyser.fftSize);
}

// メトロノーム音生成 (Web Audio API)
function playTick(isAccent = false) {
    if (!audioContext) return;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;

    osc.frequency.setValueAtTime(isAccent ? 1200 : 800, now);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.start(now);
    osc.stop(now + 0.04);
}

// チャレンジの停止・リセット
function stopChallenge() {
    isChallenging = false;
    isCountingIn = false;

    // リズムタイマーの破棄
    rhythmTimerIds.forEach(id => clearTimeout(id));
    rhythmTimerIds = [];

    hudCard.classList.add('hidden');
    countInOverlay.classList.add('hidden');
    startChallengeBtn.innerText = "🎤 チャレンジ開始";
    startChallengeBtn.classList.remove('btn-stop');
    currentIndex = 0;
    renderQueue();
}

// チューナーの停止
function stopTuner() {
    isTuning = false;
    currentTunerStringNum = null;
    tunerHud.classList.add('hidden');
    document.querySelectorAll('.tuner-string-btn').forEach(btn => btn.classList.remove('active'));
}

// チャレンジボタン押下時（トグル機能：開始 / 停止）
['click', 'touchstart'].forEach(eventType => {
    startChallengeBtn.addEventListener(eventType, async (e) => {
        if (e.type === 'click' && 'ontouchstart' in window) return;
        if (e.type === 'touchstart') e.preventDefault();

        if (isChallenging) {
            stopChallenge();
            return;
        }

        stopTuner();
        unlockAudioContext();

        try {
            await setupMicrophoneStream();

            isChallenging = true;
            currentIndex = 0;
            isWaitingForNewAttack = false;

            hudCard.classList.remove('hidden');
            startChallengeBtn.innerText = "⏹️ チャレンジ中止";
            startChallengeBtn.classList.add('btn-stop');

            renderQueue();
            updateTargetUI();

            if (currentLevel === 1) {
                countInOverlay.classList.add('hidden');
                rhythmJudgeBadge.classList.add('hidden');
                detectPitchLoopLevel1();
            } else {
                startLevel2RhythmChallenge();
            }
        } catch (err) {
            console.error("マイクの初期化に失敗しました:", err);
            alert("マイクへのアクセスが拒否されたか、利用できません。ブラウザの設定でマイクを許可してください。");
        }
    }, { passive: false });
});

// --- 7. 難易度1 判定ループ (音程チェック) ---
function detectPitchLoopLevel1() {
    if (!isChallenging || currentLevel !== 1) return;

    analyser.getFloatTimeDomainData(audioBuffer);

    let sum = 0;
    for (let i = 0; i < audioBuffer.length; i++) sum += audioBuffer[i] * audioBuffer[i];
    const currentRms = Math.sqrt(sum / audioBuffer.length);

    const isAttack = (currentRms - prevRms > 0.015) && (currentRms > 0.02);
    if (currentRms < 0.015) isWaitingForNewAttack = false;

    const freq = autoCorrelate(audioBuffer, audioContext.sampleRate, currentRms);

    if (freq > 60 && freq < 1200) {
        const midiNum = 12 * (Math.log2(freq / 440)) + 69;
        const roundedMidi = Math.round(midiNum);
        const name = noteStrings[roundedMidi % 12];
        const octave = Math.floor(roundedMidi / 12) - 1;

        detectedNoteEl.innerText = `${name}${octave}`;
        detectedHzEl.innerText = freq.toFixed(1) + " Hz";

        const target = currentNotes[currentIndex];
        const now = Date.now();

        // オクターブ倍音誤差の許容
        const isOctaveMatch = (target.midi === 40 && roundedMidi === 52) || (target.midi === 45 && roundedMidi === 57);

        if (roundedMidi === target.midi || isOctaveMatch) {
            if (now - lastNoteClearedTime > 150) {
                if (!isWaitingForNewAttack || isAttack) {
                    playSuccessSound();
                    lastNoteClearedTime = now;
                    isWaitingForNewAttack = true;
                    nextNoteLevel1();
                }
            }
        }
    }

    prevRms = currentRms * 0.6 + prevRms * 0.4;
    requestAnimationFrame(detectPitchLoopLevel1);
}

function nextNoteLevel1() {
    detectedBox.classList.add('match');
    setTimeout(() => detectedBox.classList.remove('match'), 150);

    currentIndex++;

    if (currentIndex >= currentNotes.length) {
        handleFinishSequence();
    } else {
        renderQueue();
        updateTargetUI();
    }
}

// --- 8. 難易度2 リズム判定ロジック ---
function startLevel2RhythmChallenge() {
    const stage = getCurrentStages()[currentStageIndex];
    const bpm = stage.bpm || 60;
    const beatSec = 60 / bpm;

    rhythmStats = { perfect: 0, good: 0, miss: 0 };
    isCountingIn = true;
    countInOverlay.classList.remove('hidden');

    rhythmJudgeBadge.classList.remove('hidden');
    rhythmJudgeBadge.innerText = "READY";
    rhythmJudgeBadge.className = "rhythm-judge";

    // 4拍カウントイン (4 ➔ 3 ➔ 2 ➔ 1)
    let count = 4;
    countInNumber.innerText = count;
    playTick(true);

    const countInterval = setInterval(() => {
        if (!isChallenging) {
            clearInterval(countInterval);
            return;
        }
        count--;
        if (count > 0) {
            countInNumber.innerText = count;
            playTick(false);
        } else {
            clearInterval(countInterval);
            countInOverlay.classList.add('hidden');
            isCountingIn = false;
            startRhythmPlayback(bpm, beatSec);
        }
    }, beatSec * 1000);

    rhythmTimerIds.push(countInterval);
}

function startRhythmPlayback(bpm, beatSec) {
    rhythmSongStartTime = audioContext.currentTime;

    const totalBeats = 4;
    for (let b = 0; b < totalBeats; b++) {
        const tId = setTimeout(() => {
            if (!isChallenging) return;
            playTick(b === 0);
        }, b * beatSec * 1000);
        rhythmTimerIds.push(tId);
    }

    detectPitchLoopLevel2(beatSec);
    scheduleMissCheck(beatSec);
}

function showRhythmJudge(rating) {
    rhythmJudgeBadge.innerText = rating;
    rhythmJudgeBadge.className = `rhythm-judge ${rating.toLowerCase()}`;
}

function detectPitchLoopLevel2(beatSec) {
    if (!isChallenging || currentLevel !== 2 || isCountingIn) return;

    analyser.getFloatTimeDomainData(audioBuffer);

    let sum = 0;
    for (let i = 0; i < audioBuffer.length; i++) sum += audioBuffer[i] * audioBuffer[i];
    const currentRms = Math.sqrt(sum / audioBuffer.length);

    const isAttack = (currentRms - prevRms > 0.015) && (currentRms > 0.02);
    if (currentRms < 0.015) isWaitingForNewAttack = false;

    const freq = autoCorrelate(audioBuffer, audioContext.sampleRate, currentRms);

    if (freq > 60 && freq < 1200) {
        const midiNum = 12 * (Math.log2(freq / 440)) + 69;
        const roundedMidi = Math.round(midiNum);
        const name = noteStrings[roundedMidi % 12];
        const octave = Math.floor(roundedMidi / 12) - 1;

        detectedNoteEl.innerText = `${name}${octave}`;
        detectedHzEl.innerText = freq.toFixed(1) + " Hz";

        if (currentIndex < currentNotes.length) {
            const target = currentNotes[currentIndex];
            const isOctaveMatch = (target.midi === 40 && roundedMidi === 52) || (target.midi === 45 && roundedMidi === 57);

            if ((roundedMidi === target.midi || isOctaveMatch) && (!isWaitingForNewAttack || isAttack)) {
                const nowSec = audioContext.currentTime;
                const expectedSec = rhythmSongStartTime + (target.beat * beatSec);
                const diff = nowSec - expectedSec;

                // タイミング判定ウィンドウ (±280ms以内)
                if (Math.abs(diff) <= 0.28) {
                    isWaitingForNewAttack = true;
                    if (Math.abs(diff) <= 0.12) {
                        rhythmStats.perfect++;
                        showRhythmJudge("PERFECT");
                    } else {
                        rhythmStats.good++;
                        showRhythmJudge("GOOD");
                    }

                    playSuccessSound();
                    advanceNoteLevel2();
                }
            }
        }
    }

    prevRms = currentRms * 0.6 + prevRms * 0.4;
    requestAnimationFrame(() => detectPitchLoopLevel2(beatSec));
}

// 拍を通り過ぎて弾けなかった音をMISS判定にする
function scheduleMissCheck(beatSec) {
    const checkInterval = setInterval(() => {
        if (!isChallenging || currentLevel !== 2 || isCountingIn) {
            clearInterval(checkInterval);
            return;
        }

        if (currentIndex < currentNotes.length) {
            const target = currentNotes[currentIndex];
            const nowSec = audioContext.currentTime;
            const expectedSec = rhythmSongStartTime + (target.beat * beatSec);

            if (nowSec > expectedSec + 0.32) {
                rhythmStats.miss++;
                showRhythmJudge("MISS");
                advanceNoteLevel2();
            }
        } else {
            clearInterval(checkInterval);
        }
    }, 50);

    rhythmTimerIds.push(checkInterval);
}

function advanceNoteLevel2() {
    detectedBox.classList.add('match');
    setTimeout(() => detectedBox.classList.remove('match'), 150);

    currentIndex++;

    if (currentIndex >= currentNotes.length) {
        handleFinishSequence();
    } else {
        renderQueue();
        updateTargetUI();
    }
}

// --- 9. 演奏終了ドラムロール ＆ ステージクリア処理 ---

// ドラムロールSE（フィニッシュ〜判定待ちの緊張感演出）
function playDrumroll(duration = 1.3) {
    if (!audioContext) return;
    const now = audioContext.currentTime;
    const totalHits = Math.floor(duration * 20); // 1秒あたり約20打の高速ロール

    for (let i = 0; i < totalHits; i++) {
        const time = now + (i / totalHits) * duration;
        const progress = i / totalHits;

        const bufferSize = Math.floor(audioContext.sampleRate * 0.04);
        const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        for (let j = 0; j < bufferSize; j++) {
            data[j] = (Math.random() * 2 - 1) * (1 - j / bufferSize);
        }

        const noise = audioContext.createBufferSource();
        noise.buffer = buffer;

        const filter = audioContext.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1800 + progress * 800, time);

        const gain = audioContext.createGain();
        const vol = 0.04 + progress * 0.16; // クレッシェンド
        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.038);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioContext.destination);

        noise.start(time);
    }
}

// シンバルクラッシュSE（合否発表のジャーン！）
function playCymbalCrash() {
    if (!audioContext) return;
    const now = audioContext.currentTime;
    const duration = 1.6;

    const bufferSize = Math.floor(audioContext.sampleRate * duration);
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noise = audioContext.createBufferSource();
    noise.buffer = buffer;

    const filter = audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(4500, now);

    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);

    noise.start(now);

    // 重厚なバスドラムキック
    const kick = audioContext.createOscillator();
    const kickGain = audioContext.createGain();
    kick.frequency.setValueAtTime(130, now);
    kick.frequency.exponentialRampToValueAtTime(40, now + 0.2);
    kickGain.gain.setValueAtTime(0.2, now);
    kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    kick.connect(kickGain);
    kickGain.connect(audioContext.destination);
    kick.start(now);
    kick.stop(now + 0.2);
}

// 演奏終了時のドラムロール＆シンバル判定シーケンス
function handleFinishSequence() {
    // 1. 演奏およびメトロノームの停止
    isChallenging = false;
    isCountingIn = false;
    rhythmTimerIds.forEach(id => clearTimeout(id));
    rhythmTimerIds = [];

    // 2. HUDに緊張感のある「判定中...」ドラムロール演出を表示
    rhythmJudgeBadge.classList.remove('hidden');
    rhythmJudgeBadge.innerText = "FINISH! 🥁";
    rhythmJudgeBadge.className = "rhythm-judge judging";

    // 3. ドラムロールSE再生（1.3秒間）
    playDrumroll(1.3);

    // 4. 1.3秒のタメの後、シンバルクラッシュ音とともに結果表示！
    setTimeout(() => {
        playCymbalCrash();
        handleStageClear();
    }, 1300);
}

// ステージクリア / リトライ処理
function handleStageClear() {
    stopChallenge();

    const stages = getCurrentStages();
    const currentStage = stages[currentStageIndex];
    const clearedList = getClearedList();

    const hanamaruContainer = document.querySelector('.hanamaru-container');
    const hanamaruIcon = document.querySelector('.hanamaru-icon');
    const hanamaruText = document.querySelector('.hanamaru-text');

    // 難易度2の場合、成績判定（半数以上ヒットしていればクリア）
    let isSuccess = true;
    if (currentLevel === 2) {
        const hitCount = rhythmStats.perfect + rhythmStats.good;
        const total = currentNotes.length;
        if (hitCount < Math.ceil(total * 0.5)) {
            isSuccess = false;
        }
    }

    if (isSuccess) {
        if (!clearedList.includes(currentStage.id)) {
            clearedList.push(currentStage.id);
            localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
        }

        renderStages();

        if (window.confetti) {
            confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 } });
        }
        playVictoryFanfare();

        if (hanamaruContainer) hanamaruContainer.classList.remove('retry');
        if (hanamaruIcon) hanamaruIcon.innerText = "💮";
        if (hanamaruText) hanamaruText.innerText = "たいへんよくできました！";

        modalTitle.innerText = `🎉 EX ${currentStage.id} 習得完了！`;
        modalDesc.innerText = currentLevel === 1 
            ? "ナイスピッキング！音程が正確に鳴らせています。"
            : "リズム感バッチリ！メトロノームに合わせたピッキングが身についています。";

        const isLast = currentStageIndex === stages.length - 1;
        if (isLast) {
            nextStageBtn.classList.add('hidden');
        } else {
            nextStageBtn.classList.remove('hidden');
        }
    } else {
        // 不合格（リトライ促し）
        if (hanamaruContainer) hanamaruContainer.classList.add('retry');
        if (hanamaruIcon) hanamaruIcon.innerText = "💪";
        if (hanamaruText) hanamaruText.innerText = "あと一歩！もう一度！";

        modalTitle.innerText = "RETRY CHALLENGE";
        modalDesc.innerText = "惜しい！メトロノームのビートに合わせてリトライしてみよう！";
        nextStageBtn.classList.add('hidden');
    }

    if (currentLevel === 2) {
        modalScoreStats.classList.remove('hidden');
        statPerfect.innerText = rhythmStats.perfect;
        statGood.innerText = rhythmStats.good;
        statMiss.innerText = rhythmStats.miss;
    } else {
        modalScoreStats.classList.add('hidden');
    }

    clearModal.classList.remove('hidden');
}

function updateTargetUI() {
    const target = currentNotes[currentIndex];
    if (!target) return;
    targetNoteEl.innerText = target.fullName;
    targetInfoEl.innerText = `${target.string}弦 ${target.fret}フレット`;
}

function renderQueue() {
    notesQueueEl.innerHTML = '';
    currentNotes.forEach((n, idx) => {
        const badge = document.createElement('div');
        badge.className = 'note-badge';
        badge.innerText = `${idx + 1}. ${n.fullName}`;
        if (idx < currentIndex) badge.classList.add('cleared');
        if (idx === currentIndex) badge.classList.add('current');
        notesQueueEl.appendChild(badge);
    });
}

function playSuccessSound() {
    if (!audioContext) return;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.frequency.setValueAtTime(880, audioContext.currentTime);
    gain.gain.setValueAtTime(0.08, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start();
    osc.stop(audioContext.currentTime + 0.15);
}

function playVictoryFanfare() {
    if (!audioContext) return;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const t = audioContext.currentTime + i * 0.1;
        const dur = (i === notes.length - 1) ? 0.5 : 0.12;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.start(t);
        osc.stop(t + dur);
    });
}

nextStageBtn.addEventListener('click', () => {
    clearModal.classList.add('hidden');
    selectStage(currentStageIndex + 1);
});

retryBtn.addEventListener('click', () => {
    clearModal.classList.add('hidden');
    selectStage(currentStageIndex);
});

resetProgressBtn.addEventListener('click', () => {
    const levelName = currentLevel === 1 ? "難易度1" : "難易度2";
    if (confirm(`${levelName}のクリア進捗をリセットしますか？`)) {
        if (currentLevel === 1) saveData.level1 = [];
        else saveData.level2 = [];
        localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
        selectStage(0);
    }
});

// --- 10. 簡易チューナー機能 ---
function midiToFrequency(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

window.selectTunerString = async function(stringNum, midi, noteName) {
    if (isTuning && currentTunerStringNum === stringNum) {
        stopTuner();
        return;
    }

    stopChallenge();

    currentTunerStringNum = stringNum;
    tunerTargetFreq = midiToFrequency(midi);

    tunerTargetLabel.innerText = `${stringNum}弦 (${noteName}) に合わせ中 (目標: ${tunerTargetFreq.toFixed(1)}Hz)`;
    tunerStatusText.innerText = "音をポロンと鳴らしてください";
    tunerStatusText.style.color = "#fbbf24";
    tunerMeterPointer.style.left = "50%";
    tunerHud.classList.remove('hidden');

    document.querySelectorAll('.tuner-string-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.innerText.includes(`${stringNum}弦`)) {
            btn.classList.add('active');
        }
    });

    unlockAudioContext();
    try {
        await setupMicrophoneStream();
        if (!isTuning) {
            isTuning = true;
            tunePitchLoop();
        }
    } catch (err) {
        alert("マイクの利用を許可してください。");
        stopTuner();
    }
};

function tunePitchLoop() {
    if (!isTuning) return;

    analyser.getFloatTimeDomainData(audioBuffer);

    let sum = 0;
    for (let i = 0; i < audioBuffer.length; i++) sum += audioBuffer[i] * audioBuffer[i];
    const rms = Math.sqrt(sum / audioBuffer.length);

    if (rms > 0.02) {
        const freq = autoCorrelate(audioBuffer, audioContext.sampleRate, rms);

        if (freq > 50 && freq < 1000) {
            tunerHzDisplay.innerText = `${freq.toFixed(1)} Hz`;

            const cents = 1200 * Math.log2(freq / tunerTargetFreq);

            let pointerPos = 50 + (cents / 50) * 40;
            pointerPos = Math.max(5, Math.min(95, pointerPos));
            tunerMeterPointer.style.left = `${pointerPos}%`;

            if (Math.abs(cents) <= 8) {
                tunerStatusText.innerText = "✨ ピッタリ合っています！";
                tunerStatusText.style.color = "#10b981";
                tunerMeterPointer.style.background = "#10b981";
            } else if (cents < -8) {
                tunerStatusText.innerText = "少し低い ➔ ペグを巻く ⤴";
                tunerStatusText.style.color = "#60a5fa";
                tunerMeterPointer.style.background = "#60a5fa";
            } else {
                tunerStatusText.innerText = "少し高い ➔ ペグを緩める ⤵";
                tunerStatusText.style.color = "#f87171";
                tunerMeterPointer.style.background = "#f87171";
            }
        }
    }

    requestAnimationFrame(tunePitchLoop);
}

// 自己相関法 (Autocorrelation) ピッチ検出
function autoCorrelate(buf, sampleRate, rms) {
    let SIZE = buf.length;
    if (rms < 0.015) return -1;
    let r1 = 0, r2 = SIZE - 1, thres = 0.2;
    for (let i = 0; i < SIZE / 2; i++) {
        if (Math.abs(buf[i]) < thres) { r1 = i; break; }
    }
    for (let i = 1; i < SIZE / 2; i++) {
        if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
    }
    buf = buf.slice(r1, r2);
    SIZE = buf.length;
    let c = new Float32Array(SIZE);
    for (let i = 0; i < SIZE; i++) {
        for (let j = 0; j < SIZE - i; j++) c[i] = c[i] + buf[j] * buf[j + i];
    }
    let d = 0;
    while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < SIZE; i++) {
        if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
    }
    let T0 = maxpos;
    let x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
    let a = (x1 + x3 - 2 * x2) / 2;
    let b = (x3 - x1) / 2;
    if (a) T0 = T0 - b / (2 * a);
    return sampleRate / T0;
}

// --- 11. 運営情報・利用規約モーダル ---
openAboutBtn.addEventListener('click', () => {
    infoModalTitle.innerText = "運営者情報";
    infoModalBody.innerHTML = `
        <p>当サイト「ギター練習ナビ」をご利用いただきありがとうございます。</p>
        <table class="info-table">
            <tr><th>サイト名</th><td>ギター練習ナビ (Guitar Practice Navi)</td></tr>
            <tr><th>運営者</th><td>ギター練習ナビ 運営事務局</td></tr>
            <tr><th>サイトの目的</th><td>ギター初心者が焦らず楽しく基礎ピッキングとリズム感を習得できる無料練習Webアプリ。</td></tr>
            <tr><th>開設日</th><td>2025年</td></tr>
        </table>
    `;
    infoModal.classList.remove('hidden');
});

openPrivacyBtn.addEventListener('click', () => {
    infoModalTitle.innerText = "プライバシーポリシー & 免責事項";
    infoModalBody.innerHTML = `
        <h4>1. マイク音声データの取り扱いについて</h4>
        <p>当サイトでは音高（ピッチ）判定のためにマイク機能を使用しますが、音声データはすべてご利用の端末（ブラウザ）内でのみ計算・破棄され、サーバーへ送信・保存されることは一切ありません。</p>
        <h4>2. 広告の配信について</h4>
        <p>当サイトでは第三者配信の広告サービスを利用する場合があります。利用者の興味に応じた商品やサービスの広告を表示するため、Cookie（クッキー）を使用することがあります。</p>
        <h4>3. 免責事項</h4>
        <p>当サイトの掲載情報や練習コンテンツの利用によって生じたいかなる損害についても、運営者は一切の責任を負いかねます。</p>
    `;
    infoModal.classList.remove('hidden');
});

openContactBtn.addEventListener('click', () => {
    infoModalTitle.innerText = "お問い合わせ";
    infoModalBody.innerHTML = `
        <p>ご意見・不具合のご報告・ご要望などは下記フォームよりお気軽にお寄せください。</p>
        <form id="contactForm" class="contact-form">
            <div class="form-group"><label>お名前</label><input type="text" class="form-control" required placeholder="例: ギター太郎"></div>
            <div class="form-group"><label>メールアドレス</label><input type="email" class="form-control" required placeholder="name@example.com"></div>
            <div class="form-group"><label>内容</label><textarea class="form-control" rows="4" required placeholder="ご自由にご記入ください"></textarea></div>
            <button type="submit" class="contact-submit-btn">送信する</button>
        </form>
    `;
    infoModal.classList.remove('hidden');
    document.getElementById('contactForm').addEventListener('submit', (e) => {
        e.preventDefault();
        alert("お問い合わせありがとうございます！メッセージを受け付けました。");
        infoModal.classList.add('hidden');
    });
});

closeInfoModalBtn.addEventListener('click', () => infoModal.classList.add('hidden'));
infoModal.addEventListener('click', (e) => { if (e.target === infoModal) infoModal.classList.add('hidden'); });

// 初期実行: 難易度1のステージ1を選択
selectStage(0);