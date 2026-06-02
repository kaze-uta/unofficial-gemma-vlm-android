# GemmaVlmApp

Google の **Gemma-3n** Vision Language Model を Android 端末上でオンデバイス実行する React Native アプリです。カメラで撮影した画像やテキストを端末内で完結して推論します。

## 機能

- **テキストチャット** — 自由な質問を Gemma に送信
- **画像解析** — カメラで撮影した画像を VLM で解析（人物・物体の説明など）

## 技術スタック

| 項目 | 内容 |
|---|---|
| フレームワーク | React Native 0.84 + Expo 55 |
| 推論エンジン | MediaPipe LLM Inference 0.10.33 |
| モデル | gemma-3n-e2b-it-int4 |
| カメラ | react-native-vision-camera 4.7 |
| 対応OS | Android 7.0 (API 24) 以上 |

---

## セットアップ

### 前提条件

- Android 実機
- USB デバッグを有効化済みのデバイス
- `adb` コマンド（[Android Studio](https://developer.android.com/studio) に同梱）
- Node.js 18 以上

### 1. モデルファイルの取得

1. [Kaggle Models — Gemma-3n](https://www.kaggle.com/models/google/gemma-3n/tfLite/gemma-3n-e4b-it-int4) を開く
2. Kaggle アカウントでログイン（無料）
3. **TF Lite** → **gemma-3n-e2b-it-int4** を選択してダウンロード
4. `gemma-3n-tflite-gemma-3n-e4b-it-int4-v1.tar.gz`が PC に保存される

### 2. tar.gz を解凍する

ダウンロードした `gemma-3n-tflite-gemma-3n-e4b-it-int4-v1.tar.gz` からモデルファイルを取り出します。  
**PowerShell（Windows）を開き、以下を実行してください。**


**Windows（PowerShell）:**
```powershell
cd $HOME\Downloads
tar -xzf gemma-3n-tflite-gemma-3n-e4b-it-int4-v1.tar.gz
```

実行後、同じフォルダ内に `gemma-3n-E2B-it-int4.task` が展開されます。

### 3. モデルをデバイスに転送

USB でデバイスを PC に接続し、以下を実行します。

```bash
adb push gemma-3n-E2B-it-int4.task /storage/emulated/0/gemma-3n-E2B-it-int4.task
```

> 転送には数分かかります。

### 4. 依存関係のインストール

```bash
npm install
```

### 5. ビルド＆起動

```bash
npx expo run:android
```

### 6. 初回起動時の権限設定

「全ファイルへのアクセス」の権限リクエストが表示されます。

1. 「設定を開く」をタップ
2. 「全ファイルへのアクセスを許可」をオンにする
3. アプリを再起動

---

## 使い方

### テキストチャット

1. プロンプト欄に質問を入力
2. 「テキストチャット」をタップ

### 画像解析

1. プロンプト欄に指示を入力（例：「この画像に写っているものを説明してください」）
2. 「撮影して解析」をタップ → カメラで撮影すると自動で解析が始まります

---

## ライセンス

本アプリのコードは MIT ライセンスです。

Gemma モデルの使用は [Gemma Terms of Use](https://ai.google.dev/gemma/terms) に従ってください。
