# Gemma VLM App (Unofficial)

Google の **Gemma-3n** Vision Language Model を Android 端末上で**オンデバイス実行**する React Native アプリです。
カメラで撮影した画像やテキストを、クラウドに送らず端末内だけで推論します。

> [!IMPORTANT]
> **非公式プロジェクト / Unofficial**
> このアプリは個人が開発した**非公式**のもので、**Google とは一切関係ありません**（提携・後援・承認なし）。
> "Gemma" は Google LLC の商標です。モデルの利用は [Gemma Terms of Use](https://ai.google.dev/gemma/terms) に従ってください。

## できること

- 💬 **テキストチャット** — Gemma に自由に質問
- 📷 **画像解析** — カメラで撮影した画像を VLM で解析（物体・人物・シーンの説明など）

## 技術スタック

| 項目 | 内容 |
|---|---|
| フレームワーク | React Native 0.84 + Expo 55 |
| 推論エンジン | MediaPipe LLM Inference 0.10.33 |
| モデル | `gemma-3n-e2b-it-int4`（約 3GB） |
| カメラ | react-native-vision-camera 4.7 |
| 対応OS | Android 7.0 (API 24) 以上 |

---

## クイックスタート

必要なもの: **Android 実機**（USB デバッグ有効）/ **Node.js 22+** / **Android Studio**（`adb` 同梱）

```bash
# 1. クローン & 依存関係インストール
git clone https://github.com/<your-name>/<repo-name>.git
cd <repo-name>
npm install

# 2. モデルを取得・展開（下記「モデルの準備」参照）
#    → gemma-3n-E2B-it-int4.task を用意

# 3. モデルを端末へ転送（USB 接続した状態で）
adb push gemma-3n-E2B-it-int4.task /storage/emulated/0/gemma-3n-E2B-it-int4.task

# 4. ビルド & 起動
npx expo run:android
```

初回起動時に「全ファイルへのアクセス」権限を求められます → 許可してアプリを再起動すれば完了です。

---

## モデルの準備

モデルファイルはライセンス上リポジトリに含めていません。各自で取得してください（無料）。

1. [Kaggle Models — Gemma-3n (TF Lite)](https://www.kaggle.com/models/google/gemma-3n/tfLite/gemma-3n-e2b-it-int4) を開く
2. Kaggle アカウントでログイン（無料）
3. **`gemma-3n-e2b-it-int4`** を選択してダウンロード
4. `gemma-3n-tflite-gemma-3n-e2b-it-int4-v1.tar.gz` がダウンロードされる

**展開する（`.task` ファイルを取り出す）:**

```powershell
# Windows (PowerShell)
cd $HOME\Downloads
tar -xzf gemma-3n-tflite-gemma-3n-e2b-it-int4-v1.tar.gz
```

```bash
# macOS / Linux
cd ~/Downloads
tar -xzf gemma-3n-tflite-gemma-3n-e2b-it-int4-v1.tar.gz
```

展開すると `gemma-3n-E2B-it-int4.task` が出てきます。これをクイックスタート手順 3 の `adb push` で端末に転送してください（転送に数分かかります）。

> モデルの配置先パスはアプリ側で `/storage/emulated/0/gemma-3n-E2B-it-int4.task` に固定されています（`App.tsx` の `MODEL_PATH`）。

---

## 使い方

### 💬 チャット
1. メイン画面で「チャット」を選択
2. メッセージを入力して「送信」

### 📷 画像解析
1. メイン画面で「画像解析」を選択
2. 画像への質問・指示を入力（例：「この画像に写っているものを説明して」）
3. 「撮影して解析」をタップ → 撮影すると自動で解析が始まります

---

## トラブルシューティング

| 症状 | 対処 |
|---|---|
| 「モデルが見つかりません」 | `adb push` の転送先パスが `/storage/emulated/0/gemma-3n-E2B-it-int4.task` か確認 |
| 「全ファイルへのアクセス」を許可しても進まない | 許可後に**アプリを再起動**してください |
| `GemmaModule が見つかりません` | `npx expo run:android` でネイティブを**再ビルド**してください |
| 初期化が遅い／落ちる | 初回は 1〜2 分かかります。RAM の少ない端末では GPU 初期化に失敗し CPU にフォールバックします |

---

## ライセンス

- 本アプリのコード: **MIT License**
- Gemma モデル: [Gemma Terms of Use](https://ai.google.dev/gemma/terms) に従って利用してください
