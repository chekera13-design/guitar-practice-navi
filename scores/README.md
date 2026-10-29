# 譜面原本のファイル名

ファイル名は「種類－CAGEDフォーム－キー」で内容を識別します。`db`はD♭、`fs`はF♯、`bb`はB♭です。教材表示のEX番号・保存IDとは別の情報です。

- `scores/scale/`：メジャー／自然短音階のユーザー作成原本。CAGEDフォームとキーを明記。Cm・Cフォームは`standard`と`low`で区別します。
- `scores/chord_tones/`直下：M7コードトーンの原本。`maj7`はメジャーセブンス。
- `scores/scales/`および`chord_tones/maj7/`配下：本番で使う生成済み各キー譜面。今回は改名していません。
- Tutorial・基礎・ソロ・基本コード・クロマチック：教材番号と対応する既存のEX名を維持。

改名は外側のファイル名だけです。MXL内部XML・音高・運指・音価・調号・教材の登録内容は変更していません。原本に調情報・綴り等の注意点がある場合も今回の名前整理では修正していません。

## 旧名との対応

| フォルダ | 旧名 | 現在のファイル名 | 小節／音数 | フレット範囲 |
| --- | --- | --- | --- | --- |
| scale | ex01.mxl | major-c-form-c.mxl | 9小節・65音 | 0〜3F |
| scale | ex02.mxl | major-c-form-db.mxl | 9小節・65音 | 1〜4F |
| scale | ex03.mxl | major-a-form-c.mxl | 9小節・65音 | 1〜5F |
| scale | ex04.mxl | major-a-form-b.mxl | 9小節・65音 | 0〜4F |
| scale | ex05.mxl | major-g-form-c.mxl | 9小節・65音 | 5〜9F |
| scale | ex06.mxl | major-g-form-g.mxl | 9小節・65音 | 0〜4F |
| scale | ex07.mxl | major-e-form-c.mxl | 9小節・65音 | 7〜10F |
| scale | ex08.mxl | major-e-form-f.mxl | 9小節・65音 | 0〜3F |
| scale | ex09.mxl | major-d-form-c.mxl | 9小節・67音 | 8〜13F |
| scale | ex10.mxl | major-d-form-e.mxl | 9小節・67音 | 0〜5F |
| scale | ex11.mxl | natural-minor-c-form-c-standard.mxl | 9小節・65音 | 11〜15F |
| scale | ex12.mxl | natural-minor-c-form-db.mxl | 9小節・65音 | 0〜4F |
| scale | ex13.mxl | natural-minor-a-form-c.mxl | 9小節・65音 | 3〜6F |
| scale | ex14.mxl | natural-minor-a-form-a.mxl | 9小節・65音 | 0〜3F |
| scale | ex15.mxl | natural-minor-g-form-c.mxl | 9小節・65音 | 4〜8F |
| scale | ex16.mxl | natural-minor-g-form-ab.mxl | 9小節・65音 | 0〜4F |
| scale | ex17.mxl | natural-minor-e-form-c.mxl | 9小節・65音 | 8〜12F |
| scale | ex18.mxl | natural-minor-e-form-e.mxl | 9小節・65音 | 0〜4F |
| scale | ex19.mxl | natural-minor-d-form-c.mxl | 9小節・65音 | 10〜13F |
| scale | ex20.mxl | natural-minor-d-form-d.mxl | 9小節・65音 | 0〜3F |
| scale | ex21.mxl | natural-minor-c-form-c-low.mxl | 9小節・65音 | 0〜4F |
| chord_tones | ex01.mxl | maj7-c-form-c.mxl | 5小節・37音 | 0〜3F |
| chord_tones | ex02.mxl | maj7-c-form-db.mxl | 5小節・37音 | 1〜4F |
| chord_tones | ex03.mxl | maj7-a-form-c.mxl | 5小節・37音 | 2〜7F |
| chord_tones | ex04.mxl | maj7-a-form-bb.mxl | 5小節・37音 | 0〜5F |
| chord_tones | ex05.mxl | maj7-g-form-c.mxl | 5小節・37音 | 5〜9F |
| chord_tones | ex06.mxl | maj7-g-form-g.mxl | 5小節・37音 | 0〜4F |
| chord_tones | ex07.mxl | maj7-e-form-c.mxl | 5小節・37音 | 7〜10F |
| chord_tones | ex08.mxl | maj7-e-form-f.mxl | 5小節・37音 | 0〜3F |
| chord_tones | ex09.mxl | maj7-d-form-c.mxl | 5小節・37音 | 8〜12F |
| chord_tones | ex10.mxl | maj7-d-form-e.mxl | 5小節・37音 | 0〜4F |

## m7コードトーン追加原本

新規ファイル置き場のcm7_*_form.mxlとcm7_c_form_low.mxlは、scores/chord_tones/sources/min7/へ内容を変えずコピーしています。標準5フォームとCm7・Cフォームのローで計6原本。旧M7原本・スケール原本とは独立です。実行用の標準60＋ロー1はchord_tones/min7/配下。原本・生成物の対応とSHAは同ディレクトリmanifest.jsonを参照してください。

## 7th・m7(♭5)コードトーン追加原本

新規ファイル置き場のc7_*_form.mxlとcm7b5_*_form.mxlは、scores/chord_tones/sources/dom7/とsources/m7b5/へバイト単位でそのままコピーしています。各タイプはC・A・G・E・Dの5原本を独立して持ち、M7・m7の運指は流用しません。

実行用はdom7/とm7b5/配下に各60譜面。コード構成音に合わせて異名同音を正規化し、原本と同じ弦・音順・リズムを維持して移調しています。Cキーは原本の位置を維持し、ほかのルートは負のフレットが生じない最も低い一律移調を採用します。各manifest.jsonに原本・移調量・小節数・SHAを記録しています。

7thのEフォーム（EX14）は原本どおり6小節・41音です。ほかの新規フォームは5小節。初期BPMは既存コードトーンと同じ60です。調号は非表示のルート長調／短調メタデータであり、スケール教材ではありません。構成音は7th＝ルート・長3度・完全5度・短7度、m7(♭5)＝ルート・短3度・減5度・短7度として各音のpitchで検証しています。
