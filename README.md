English | [日本語](README.ja.md)

# Gemma VLM App (Unofficial)

A React Native app that runs Google's **Gemma 4 E2B** (QAT mobile-quantized) **fully on-device** on Android phones.
Text, image, and audio inputs are inferred entirely on the device, without sending anything to the cloud (inference is fully offline).

> [!IMPORTANT]
> **Unofficial project**
> This is an **unofficial** app built by an individual and is **not affiliated with Google** in any way (no partnership, sponsorship, or endorsement).
> "Gemma" is a trademark of Google LLC. It is used here only descriptively, to refer to the model the app runs.
> The Gemma 4 model is distributed under the **Apache License 2.0** ([Gemma terms](https://ai.google.dev/gemma/terms)).

## Features

- **Text chat** — Multi-turn conversation with **streaming output** (token-by-token). Integrates the tools described below.
- **Image analysis / OCR** — Analyze an image captured from the camera or picked from the gallery. Includes a quick OCR (text extraction) button.
- **Audio input** — Feed microphone recordings to the model (Gemma 4 multimodal capability).
- **Tools / function calling** — During chat, the model automatically calls built-in functions (current time, arithmetic) when needed, via LiteRT-LM's `automaticToolCalling`.

## Tech stack

| Item | Details |
|---|---|
| Framework | React Native 0.84 + Expo 55 |
| Inference engine | **LiteRT-LM 0.13.1** (successor to MediaPipe tasks-genai, officially recommended) |
| Model | **`gemma-4-E2B-it`** (QAT mobile-quantized, `.litertlm`, ~2.5 GB) |
| License | App code: MIT / Model: Apache License 2.0 |
| Camera / image | react-native-vision-camera 4.7 + expo-image-picker |
| Audio | expo-audio |
| Supported OS | Android 7.0 (API 24) or later (a GPU-accelerated device is recommended) |

---

## Quick start

You will need: a **physical Android device** (USB debugging enabled), **Node.js 22+**, and **Android Studio**.

```bash
# 1. Clone & install dependencies
git clone https://github.com/kaze-uta/unofficial-gemma-vlm-android.git
cd unofficial-gemma-vlm-android
npm install

# 2. Build & launch (the app auto-downloads the model on first launch)
npx expo run:android
```

**No `adb push` required.** On first launch, the app automatically downloads Gemma 4 E2B (~2.5 GB) into its app-private storage (Wi-Fi recommended).
The download shows a progress bar and resumes after interruptions.

> [!NOTE]
> The model is published on [HuggingFace `litert-community`](https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm) (Apache 2.0, no download restrictions).
> If the automatic download fails (e.g. due to network issues), see "Manual model placement" below.

---

## Manual model placement (only if the auto-download fails)

1. Open [HuggingFace — litert-community/gemma-4-E2B-it-litert-lm](https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm).
2. Download `gemma-4-E2B-it.litertlm` (~2.5 GB).
3. Launch the app once to create its app-private storage, then place the file with `adb`:

```bash
adb push gemma-4-E2B-it.litertlm /sdcard/Android/data/com.gemmavlmapp/files/gemma-4-E2B-it.litertlm
```

> The model path is `MODEL_PATH` in `App.tsx` / `ModelDownloader.ts` (under `FileSystem.documentDirectory`).
> To use a different model (e.g. E4B), change `MODEL_URL` in `src/native/ModelDownloader.ts`.

---

## Usage

From the main screen, choose one of three modes: "Chat", "Image analysis / OCR", or "Audio input".

### Chat (with tools)
1. Select "Chat" on the main screen.
2. Type a message and tap "Send" — the reply streams in (multi-turn conversation that takes prior turns into account).
3. Ask things like "What time is it?" or "Multiply 3.5, 12, and 7 together" — the model runs built-in functions as needed (shown as `[Tool]` in the history) and answers based on the result.
   - Tools are defined in `BuiltinToolSet` (`@Tool` annotations) in `android/.../GemmaModule.kt`. Adding more is easy.

### Image analysis / OCR
1. Select "Image analysis / OCR" on the main screen.
2. Choose "Camera" or "Gallery".
3. Enter a question or instruction (for OCR, the "OCR text extraction" chip is handy).
4. Tap "Capture & analyze" / "Pick image & analyze".

### Audio input
1. Select "Audio input" on the main screen.
2. "Start recording" → speak → "Stop & analyze".
3. Switch instructions with chips such as "Summarize", "Transcribe", or "Translate to English".

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Model download fails | Check your network (Wi-Fi) and retry. If it keeps failing, see "Manual model placement". |
| `GemmaModule not found` | **Rebuild** the native side with `npx expo run:android`. |
| Slow initialization / crashes | The first run takes 1-2 minutes. On low-RAM devices, GPU init may fail and fall back to CPU. |
| Audio not recognized well | Accuracy varies by device/recording format (mono recommended). Consider adjusting the recording preset in `AudioScreen`. |

---

## License

- App code: **MIT License** ([LICENSE](./LICENSE))
- Gemma 4 model: **Apache License 2.0** ([Gemma terms](https://ai.google.dev/gemma/terms))

"Gemma" is a trademark of Google LLC. This is an unofficial project, not affiliated with, sponsored by, or endorsed by Google.
