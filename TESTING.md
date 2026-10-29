# テスト環境の再現方法

Node.js 24系以降で実行する。npmのパッケージ追加・インストールやビルドは不要。Nodeだけの環境でも実行できる。

```text
node --test --experimental-test-isolation=none tests/*.test.cjs
```

通常テストはネットワークを使わない。`tests/vendor/alphaTab-1.8.4.cjs`を開発用ファイルに同梱し、SHA-256・バージョン・buildを確認してから読み込む。`tests/fixtures/rhythm/`は連符・拍子の元の検証条件を保った4譜面で、隣のラボには依存しない。チューナーのVMも本物のpracticeProgressを読み込む。テスト数を減らすskipや例外の握りつぶしは行わない。

npmがある環境では`npm test`も同じ処理を呼び出す。

## alphaTabの復旧・初回取得

固定情報は`tests/dependencies.json`。取得元は本番と同じjsDelivrの1.8.4/dist/alphaTab.js、build 34。

```text
node scripts/setup-test-dependencies.cjs
```

既存ファイルがあればハッシュだけ確認し、通信しない。欠落時だけ固定URLから取得するため、この工程にはネット接続が必要。取得した内容を検証してから保存する。ハッシュが違う既存ファイルは勝手に上書きせずエラーにする。版や期待ハッシュをテスト成功のためだけに変えない。

同じファイルを別途保管している場合はオフラインでも配置できる。

```text
node scripts/setup-test-dependencies.cjs --source <保管済みファイルのパス>
```

テスト中にライブラリが欠落・改変していれば、skipや個人のTEMPキャッシュへのフォールバックでなく、明確に失敗する。改変されたファイルは確認のうえ、検証済みの正しいファイルに復旧する。

## 別の場所へ移して確認する場合

開発用コピーには、`index.html`、`css/`、`js/`、`scores/`、`tests/`（vendor・fixturesを含む）、`scripts/`、`package.json`、`deployment/`、ライセンス通知・原文を含める。`.git/`は不要。コピー先で上記のNodeコマンド、またはnpmがあれば`npm test`を実行する。配信用に絞ったファイルだけでは、開発用テストの原本・fixtureが足りない。

録音・チューナーテストには制御時計と疑似マイクを使う。テスト成功は実機・実マイクの音質や許可画面の確認を代替しない。

## 公開対象の一覧

```text
node scripts/release-files.mjs
node scripts/release-files.mjs --write
```

前者はJSONを表示するだけ。後者も`deployment/public-files.json`を更新するだけで、公開用フォルダの作成・上書き・配信・ZIP作成は行わない。npmがある場合は`npm run release:list` / `npm run release:refresh-list`も使用できる。詳しくは`deployment/README.md`。
