[English](README.md) | 日本語

# Gemma VLM App (Unofficial)

Google の **Gemma 4 E2B**（QAT モバイル量子化版）を Android 端末上で**完全オンデバイス実行**する React Native アプリです。
テキスト・画像・音声を、クラウドに送らず端末内だけで推論します（推論時は完全オフライン）。

> [!IMPORTANT]
> **非公式プロジェクト / Unofficial**
> このアプリは個人が開発した**非公式**のもので、**Google とは一切関係ありません**（提携・後援・承認なし）。
> "Gemma" は Google LLC の商標です。本リポジトリでは、利用しているモデルを指す説明的用法としてのみ使用しています。
> Gemma 4 モデルは **Apache License 2.0** で配布されています（[Gemma terms](https://ai.google.dev/gemma/terms)）。

## できること

- **テキストチャット** — マルチターン会話・**ストリーミング表示**（トークン逐次出力）。下記「ツール」も統合
- **画像解析 / OCR** — カメラ撮影 or ギャラリー選択した画像を解析。文字抽出(OCR)クイックボタン付き
- **音声入力** — マイク録音した音声をモデルに入力（Gemma 4 のマルチモーダル機能）
- **ツール / function calling** — チャット内で、モデルが組込み関数（現在時刻取得・数値計算）を必要時に自動呼び出し（LiteRT-LM の automaticToolCalling）

## 技術スタック

| 項目 | 内容 |
|---|---|
| フレームワーク | React Native 0.84 + Expo 55 |
| 推論エンジン | **LiteRT-LM 0.13.1**（MediaPipe tasks-genai の後継・公式推奨） |
| モデル | **`gemma-4-E2B-it`（QAT モバイル量子化, .litertlm, 約 2.5GB）** |
| ライセンス | アプリコード: MIT / モデル: Apache License 2.0 |
| カメラ / 画像 | react-native-vision-camera 4.7 + expo-image-picker |
| 音声 | expo-audio |
| 対応OS | Android 7.0 (API 24) 以上（GPU 加速対応端末を推奨） |

---

## クイックスタート

必要なもの: **Android 実機**（USB デバッグ有効）/ **Node.js 22+** / **Android Studio**

```bash
# 1. クローン & 依存関係インストール
git clone https://github.com/kaze-uta/unofficial-gemma-vlm-android.git
cd unofficial-gemma-vlm-android
npm install

# 2. ビルド & 起動（モデルは初回起動時にアプリが自動ダウンロード）
npx expo run:android
```

**`adb push` は不要です。** 初回起動時、アプリが Gemma 4 E2B（約2.5GB）をアプリ専用領域へ自動ダウンロードします（Wi-Fi 推奨）。
ダウンロードは進捗バー表示・中断後の再開に対応しています。

> [!NOTE]
> モデルは [HuggingFace の `litert-community`](https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm) で公開（Apache 2.0・ダウンロード制限なし）されています。
> ネットワーク等で自動DLが失敗する場合は、下記「モデルの手動配置」を参照してください。

---

## モデルの手動配置（自動DLが失敗した場合のみ）

1. [HuggingFace — litert-community/gemma-4-E2B-it-litert-lm](https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm) を開く
2. `gemma-4-E2B-it.litertlm`（約2.5GB）をダウンロード
3. アプリを一度起動してアプリ専用領域を作成後、`adb` で配置:

```bash
adb push gemma-4-E2B-it.litertlm /sdcard/Android/data/com.gemmavlmapp/files/gemma-4-E2B-it.litertlm
```

> モデルの保存先は `App.tsx`/`ModelDownloader.ts` の `MODEL_PATH`（`FileSystem.documentDirectory` 配下）です。
> 別のモデル(E4B 等)を使う場合は `src/native/ModelDownloader.ts` の `MODEL_URL` を変更してください。

---

## 使い方

メイン画面で「チャット」「画像解析 / OCR」「音声入力」の3つから選択します。

### チャット（ツール統合）
1. メイン画面で「チャット」を選択
2. メッセージを入力して「送信」→ 回答がストリーミング表示されます（前の発言を踏まえたマルチターン会話）
3. 「いま何時？」「3.5 と 12 と 7 を全部掛けて」などと入力すると、モデルが必要に応じて組込み関数を自動実行し（履歴に `[ツール]` 表示）、その結果を踏まえて回答します
   - ツールは `android/.../GemmaModule.kt` の `BuiltinToolSet`（`@Tool` 注釈）で定義。追加も容易です

### 画像解析 / OCR
1. メイン画面で「画像解析 / OCR」を選択
2. 「カメラ」or「ギャラリー」を選択
3. 質問・指示を入力（OCR は「OCR 文字抽出」チップが便利）
4. 「撮影して解析」/「画像を選んで解析」をタップ

### 音声入力
1. メイン画面で「音声入力」を選択
2. 「録音開始」→ 話す →「停止して解析」
3. 「要約」「文字起こし」「英訳」などのチップで指示を切り替えられます

---

## トラブルシューティング

| 症状 | 対処 |
|---|---|
| モデルDLが失敗する | ネットワーク（Wi-Fi）を確認し再試行。継続して失敗する場合は「モデルの手動配置」を参照 |
| `GemmaModule が見つかりません` | `npx expo run:android` でネイティブを**再ビルド**してください |
| 初期化が遅い／落ちる | 初回は 1〜2 分かかります。RAM の少ない端末では GPU 初期化に失敗し CPU にフォールバックします |
| 音声がうまく認識されない | 端末/録音形式によっては精度が落ちます（mono 推奨）。`AudioScreen` の録音プリセット調整を検討 |

---

## ライセンス

- 本アプリのコード: **MIT License**（[LICENSE](./LICENSE)）
- Gemma 4 モデル: **Apache License 2.0**（[Gemma terms](https://ai.google.dev/gemma/terms)）

"Gemma" は Google LLC の商標です。本プロジェクトは非公式であり、Google による提携・後援・承認はありません。
