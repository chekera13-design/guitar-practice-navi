# dev専用・小音符の旗の実機診断（2026-10-23 / v1）

これは修正版アプリではありません。通常のdev版の状態を記録するための独立した診断入口です。Fire HD 10 / AQUOSの結果はまだ取得していません。PCの成功を実機の解決として扱わないでください。

## 公開するもの（5ファイル）

- diagnostics/grace-device.html
- diagnostics/grace-device.js
- diagnostics/grace-device-observer.js
- diagnostics/local-reference.json
- diagnostics/README.md（この説明）

本番アプリ・ラボ・既存譜面には配置・変更していません。診断フォルダ以外のファイルを書き換える必要はありません。

## dev環境への配置手順

1. 現在devとして使っている `https://guitar-practice-navi.pages.dev/` の公開用ファイルを、dev専用の作業コピーで用意してください。本番公開環境・本番用ブランチとは分けてください。
2. ZIPを展開し、`diagnostics`フォルダを、そのコピーの`index.html`と同じ階層へ追加してください。index.html / js / css / scoresの既存ファイルは書き換えません。
3. 普段のdev公開手順で、そのdev用コピーを公開してください。Pagesが一式の再デプロイを必要とする場合は既存ファイルを省略せず、現在と同じ内容を含めてください。この診断フォルダを本番へ配信する設定には追加しないでください。
4. 配置後のURLは `https://guitar-practice-navi.pages.dev/diagnostics/grace-device.html` です。公開サブディレクトリ構成の場合は、アプリのindex.html直下のdiagnosticsとして配置します。
5. Codexからのアップロードは行っていません。実機ログ取得後、不要になった診断フォルダだけをdev公開用コピーから外せます。

CSP・X-Frame-Options等でiframe/Blob起動が拒否される場合、セキュリティ設定を緩めず、画面のエラーとスクリーンショットを送ってください。

## 各端末での操作

まずPCのdev、次にFire HD 10、AQUOSで、同じ手順を行います。キャッシュ削除・ブラウザ変更をする前の状態を優先してください。

1. 診断URLを開き「通常配信を開く」を押します。
2. いつもどおり「ソロギター」→EX1を開きます。診断バーは画面下端に重なりますが、アプリの表示幅・高さを縮めません。
3. 実際に旗が「見える／見えない」を下端で選択し「記録」を押します。記録番号・時刻付きのスクリーンショットを撮ります。
4. 「結果」→「JSONを保存」または「JSONをコピー」。コピーが使えない場合は「全テキストを選択」から長押しコピーできます。JSONは長いためファイル保存を推奨します。
5. 「アプリへ戻る」→回転→「記録」→スクリーンショット→JSON保存。同じ向きでの再読込も別途記録できます。再読込はページ/アプリ本来の動作で、診断の「記録」は再描画を要求しません。
6. 「入口へ」→「生成理由を詳しく記録」。同じEX1で縦・横それぞれ記録します。
7. 送るもの：端末名、通常/詳細、縦/横が分かるJSONとスクリーンショット。日時と記録番号で対応付けます。

ブラウザ名・バージョンはログのUser-Agent/Client Hintsから確認します。不明値は不明のまま保持します。診断結果は自動送信しません。URL、端末・ブラウザ情報、譜面情報を含むため送信先を確認してください。localStorageの保存内容や録音データは取得しません。

## 通常と詳細の違い

- 通常：公開index.htmlを同一originのiframeでそのまま開く。元のmodule URLで動作する。DOM・SVG・フォント計測・追加削除・回転後を観測する。内部の閉じた変数は取得できず、初期load以前のJSエラーは取り逃す可能性がある。
- 詳細：同じ公開HTML・app.js・graceNotation.jsを取得し、メモリー内の診断入口で起動する。graceNotation.jsは取得bytesをそのまま実行。app.jsはimportの参照先を元URLへ解決し、末尾に観測用接続だけを追加する。serviceを同じ引数・thisで1度呼ぶラッパーから、見送り理由・世代・API・scoreを記録する。
- 詳細入口ではHTMLのbase/早期観測、app/graceのmodule URL、起動タイミングが通常と異なる。「詳細では表示された」だけで問題解決とはしない。
- どちらもiframe化による起動条件・referrer・観測の負荷等の差があり、通常URLを直接開く場合と完全同一とは保証しない。直開きとの表示差も報告してください。
- render()/resize()、旗の再追加、フォント読込待ちの挿入、安全判定や記号形状の変更は行わない。

## 主なログの読み方

- `latestSnapshot.counts.source`：元SVGの記号数（非表示の元SVGも含む）。`counts.cards`：全カード内の記号数。この2つを足して「旗の数」と判断しない。
- `sources / cards`：各SVGのDOMパス、個体ID、viewBox、clip、CSS・祖先・CTM、path d、bbox、物理ピクセル概算。`displayedCandidates`で現在カードと画面上の候補を区別する。CSS/座標による候補判定は、描画の証明ではない。
- カード内groupの`sourceAssociation`はbeat/bar/note属性による元SVGとの照合。唯一の場合だけ元group IDを確定する。
- `graceMetadata.symbols`：詳細入口での本体の生成/見送り結果。連続小音符の意図的な対象外と、他の見送り理由を区別する。
- `graceModelBounds`：小音符のnote/beat/part/staff/voice/弦/フレット/NoteBounds等。
- `fontMetrics`：11px数字のSVG bboxとCanvasの実測。未対応プロパティはnullとtypeofを残す。高さ/幅差の本体基準は0.1 SVG pxで変更しない。
- `observation.events`：描画、service、DOM追加削除、回転、resize、フォントイベント。自動記録は最大40回、最新8snapshotとイベント最大240件を保持する。出力は最新snapshotの全詳細と履歴一覧。古い詳細を残したい場合は回転/再起動前に保存する。
- `run.assets`：診断時の再取得URL/HTTPヘッダ/byte数/SHA256。再取得hashは既に実行済みmoduleの全bytesの証明ではない。詳細入口のapp/grace原本応答は実行に利用した取得物。`instrumentation`に元appと観測追記appの別hashを記録する。
- `matchesLocalReference`：ローカルraw bytes比較。`matchesNormalizedLocalText`：BOM除去/CRLF→LF後の比較。`matchesDevReference`：今回独立取得したdev応答とのraw比較。正規化一致とバイト完全一致は別のもの。
- `environmentExtras`：Service Worker controller/登録、Cache Storage名、Client Hints。Cache Storage名だけで利用実態やHTTPキャッシュ内容を断定しない。
- 記録にはエラー・取得不可もそのまま残る。`ResizeObserver loop completed with undelivered notifications.`はPCでも検出されており、実機問題と同じ原因かは未確定。

## 次に判断すること

実機JSONで、配信内容、元SVGの生成有無、見送り理由、生成後の削除、表示中カードへの複製、clip/CSS/ピクセル寸法を比較します。現時点の原因分類はF（未確定）。安全条件を緩めたり旗を拡大したりせず、証拠に応じて最小修正案を検討します。
