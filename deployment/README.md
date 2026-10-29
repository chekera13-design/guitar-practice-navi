# 一般公開に向けたファイル選別（準備のみ）

今回、既存の公開用フォルダ・公開dev・正式サイトは更新していない。以下は次工程で選別するための定義と確認手順。

## 配信するファイル

`public-files.json`の`files`を配信対象の許可リストとする。各行には相対パス、役割、SHA-256を記録した。

- index.html、参照CSS、HTMLとES Modulesからたどれる実行用JS・config。
- 登録63教材から参照する229譜面。メジャースケール60、自然短音階61（Cmロー含む）、M7コードトーン60パターンも含む。
- THIRD-PARTY-NOTICES.txtと4つのライセンス通知・原文。
- お問い合わせ・運営者情報・プライバシーポリシーは既存のapp.js内に含まれる。

既存の小音符・カポ・モーダルフォーカス・拍表示・連符枠補助・回数管理のモジュールも、importからたどって含める。実行時のMXLは既存configのvariant展開まで確認する。HTMLの静的参照・CSSのurlとJSのimport/exportも走査する。将来、別の動的参照方式を追加する際は一覧生成処理にも確認を追加する。

## 配信しないファイル

`excludedExistingFiles`は残したまま配信から除外するファイルの一覧。`.git/`は内部まで走査せず、ディレクトリ全体を除外対象とする。

- tests/、fixture、tests/vendor/のalphaTab、テスト依存情報。
- scripts/、diagnostics/、ラボ・比較資料、ログ・キャッシュ。
- package.json、TESTING.md、deployment/の手順・分類資料。
- 正式configに参照されない原本・検証譜面。`scores/scale/`内の原本（例：`major-c-form-c.mxl`）や`chord_tones/`直下の原本（例：`maj7-c-form-c.mxl`）は開発用として残し、生成済みの正式参照先だけを配信する。
- scale/chord-toneの開発用manifestはブラウザ実行から参照されないため除外。正式MXLはmanifest由来のハッシュとconfigを照合している。

元フォルダのファイルは削除しない。今後公開用フォルダを更新する際も、開発フォルダ全体の単純コピーではなく、この許可リストで新しい別フォルダを作成する工程を別途実施する。

## 配信先の安全性（設定は未確認・未変更）

`.git/`、tests/、scripts/、diagnostics/、fixtureやログがアップロード対象に含まれないことを最初に確認する。必要に応じ、配信先のアクセス制御で内部パスを拒否できるか確認する。Cloudflareのアカウント設定・デプロイ内容・実際のアクセス制御を今回確認したわけではない。

アップロード後は`.git/config`、`tests/tuner.test.cjs`、`diagnostics/scroll-ab.html`、未参照原本にアクセスし、元データが返らないことを確認する。HTTP 200だけで判断せず、応答本文とContent-Typeも確認する。Cloudflare Pagesでは404.htmlがない場合にSPAとしてトップHTMLが返ることがあるため、内部ファイルの実配信と混同しない。

一次資料：[Cloudflare Pagesの配信・Not Found仕様](https://developers.cloudflare.com/pages/configuration/serving-pages/)

## CDN・SRI・ライセンス

通常入口のライブラリは次の固定URLのまま。

- alphaTab 1.8.4 build 34：`https://cdn.jsdelivr.net/npm/@coderline/alphatab@1.8.4/dist/alphaTab.js`
- JSZip 3.10.1：`https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js`

alphaTabが使用するBravuraフォント等の関連リソースはCDN側から解決される。YouTubeは動画を開くときに外部プレーヤーを生成する。これらをローカル配信へ変更していない。アプリ側の広告・解析タグは未設置だが、外部サービスや配信事業者側の情報取扱いまで否定するものではない。

現行HTMLにはSRIを設定していない。SRIは取得内容の改変検出に有効だが、導入時は対象ファイルのハッシュとCDNのCORS対応を確認し、別作業で試験する。トップJSのSRIだけでフォント・worker・YouTube等の全通信を検証できるわけではない。自己ホスティングはCDN依存を減らせる一方、関連リソースの配置・更新・ライセンス管理が増える。今回はどちらも実装しない。CDN障害や通信制限時に読み込みへ影響する点は残る。

一次資料：[MDNのSRIとCORS](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Subresource_Integrity)

テスト用alphaTabはMPL-2.0、BravuraはOFL、JSZipはMITの選択肢を利用。元の権利表記・ライセンス原文は維持する。教材やアプリ固有のコードの権利状態をこれらの通知だけで判断しない。

## 次工程

1. ユーザーの確認後に、許可リストだけを使う公開用フォルダ更新を別作業で行う。
2. そこだけをHTTP配信し、参照切れ・内部ファイル除外・代表教材の動作を確認する。
3. 公開devへ反映するかはユーザーが判断する。
4. `device-checklist.md`の代表操作を実機で確認してから一般公開を判断する。

## 自然短音階・複数ポジション統合後

公開対象は266ファイル（229譜面＋実行用HTML/CSS/JS＋ライセンス）。新規js/config/naturalMinorScales.jsとjs/practicePositions.js、scores/scales/natural-minor/の61MXLを含む。Cmローの位置別記録も参照譜面と共に一覧へ含める。manifestは開発用で配信対象外。公開用フォルダは未更新。
