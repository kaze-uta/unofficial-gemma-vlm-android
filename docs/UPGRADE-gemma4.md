# Gemma 4 スマホ対応アップグレード — 進捗記録

最終更新: 2026-06-07 / ブランチ: `gemma4`

## 背景・目的

旧構成は **Gemma-3n** を **MediaPipe `tasks-genai` 0.10.33** で動かしていたが、
- MediaPipe LLM Inference API が Android/iOS で**非推奨**化（後継は LiteRT-LM）
- **Gemma 4**（2026/4）登場、さらに **Gemma 4 QAT モバイル量子化版（約1GB, 2/4/8bit混在）**（2026/6/5発表）が公開

を受け、**LiteRT-LM + Gemma 4 QAT モバイル E2B** へ移行し、モデルが持つ機能を全部スマホUIから使えるようにした。
推論は完全オンデバイス／オフライン（通信は初回モデルDLのみ）。

## できること（4モード）

- 💬 **チャット** — ストリーミング表示 + マルチターン会話（文脈保持）
- 📷 **画像解析 / OCR** — カメラ撮影 / ギャラリー選択、OCR(文字抽出)クイックチップ
- 🎤 **音声入力** — マイク録音した音声をモデルへ
- 🔧 **ツール / function calling** — 組込み関数（現在時刻・合計・積）をモデルが自動実行

## 技術スタック

| 項目 | 旧 | 新 |
|---|---|---|
| 推論エンジン | MediaPipe tasks-genai 0.10.33 | **LiteRT-LM 0.13.1** |
| モデル | gemma-3n-e2b-it-int4 (.task, ~3GB) | **gemma-4-E2B-it QAT (.litertlm, ~1GB)** |
| モデル配置 | adb push + 全ファイルアクセス権限 | **アプリ内自動DL**（アプリ専用領域） |
| 画像 | vision-camera のみ | vision-camera + **expo-image-picker** |
| 音声 | なし | **expo-audio** |
| 出力 | 一括 | **ストリーミング**（Flow→イベント） |

## 主な変更ファイル

- `android/app/build.gradle` — LiteRT-LM 0.13.1 へ差し替え、coroutines 追加、Kotlin メタデータ版チェックskipフラグ
- `android/app/src/main/java/com/gemmavlmapp/GemmaModule.kt` — LiteRT-LM `Engine`/`Conversation` API へ全面書き換え、ストリーミング・マルチモーダル・`BuiltinToolSet`（function calling）
- `android/app/src/main/AndroidManifest.xml` — `RECORD_AUDIO`/`READ_MEDIA_IMAGES` 追加、全ファイルアクセス系を削除
- `src/native/GemmaModule.ts` — 新API（会話セッション・ストリーミングイベント・ツール）
- `src/native/ModelDownloader.ts` — 新規。`expo-file-system` で進捗付き・再開対応のモデルDL
- `App.tsx` — DL画面、4モードUI、ストリーミング、チャット履歴、画像タブ、録音、ツール
- `package.json` — `expo-image-picker` / `expo-audio` 追加
- `README.md` — 手順を LiteRT-LM / アプリ内DL に更新

## 動作フロー

1. 起動 → モデル有無を確認 → 無ければ進捗バー付きDL → エンジン初期化（GPU優先, 失敗時CPU）→ 準備完了
2. モード選択で会話をリセットし、モード別システムプロンプトで会話開始（ツールのみ組込み関数を登録）
3. 送信 → `sendMessageAsync` が `Flow<Message>` を返す → `onToken` 逐次表示 → 完了で確定（会話はnative側で生存＝文脈保持）
4. 画像/音声はファイルパスを `sendMultimodalMessage` へ → `Contents.of(...)` を組んで同様にストリーミング
5. ツールはモデルが必要時に Kotlin `@Tool` 関数を自動実行（🔧表示）し、結果を使って回答

## 検証状況（2026-06-07 時点）

- ✅ TypeScript 型チェック: エラーなし
- ✅ Android Kotlin コンパイル: LiteRT-LM 0.13.1 実APIに対し成功
- ✅ フルAPKビルド `assembleDebug`: 成功（`app-debug.apk` 約178MB）
- ✅ マージ済みManifest: `RECORD_AUDIO` あり / 全ファイルアクセスなし

### 実機でのみ要確認（ビルドは通るがランタイム未検証）

- [ ] ストリーミングの `Message.toString()` がトークン**差分か累積か**（二重表示が出たらnative側で調整）
- [ ] 音声形式（expo-audio の m4a が受理されるか / mono wav 変換の要否）
- [ ] HuggingFace `litert-community` の**ライセンスゲート**（401/403 時は README の手動配置にフォールバック）

### ビルド時に解決した問題

- LiteRT-LM 0.13.1 は Kotlin 2.3.0 メタデータ。RN 0.84 のKotlinコンパイラ(2.1.x)では読めずビルド失敗
  → `android/app/build.gradle` に `-Xskip-metadata-version-check` を追加して解決
  （`kotlinVersion` ext の引き上げはRNプラグインに上書きされ効果なし）

## 次の一手

- 実機（USBデバッグ）で `npx expo run:android` → 上記チェックリストを確認
- 必要に応じてストリーミング表示・音声形式を調整
- ツールの拡充（天気・電卓・端末情報など `BuiltinToolSet` に `@Tool` 追加）
