package com.gemmavlmapp

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.google.mediapipe.tasks.genai.llminference.LlmInference
import com.google.mediapipe.tasks.genai.llminference.LlmInferenceSession
import com.google.mediapipe.tasks.genai.llminference.GraphOptions
import com.google.mediapipe.framework.image.BitmapImageBuilder
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import java.io.File
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class GemmaModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private var llmInference: LlmInference? = null
    private val scope = CoroutineScope(Dispatchers.IO)

    override fun getName(): String = "GemmaModule"

    @ReactMethod
    fun isExternalStorageManager(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            promise.resolve(Environment.isExternalStorageManager())
        } else {
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun openStorageSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                data = Uri.parse("package:${reactApplicationContext.packageName}")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            val fallback = Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            reactApplicationContext.startActivity(fallback)
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun initializeModel(modelPath: String, promise: Promise) {
        scope.launch {
            try {
                val modelFile = File(modelPath)
                if (!modelFile.exists()) {
                    promise.reject("MODEL_NOT_FOUND", "Model file not found at: $modelPath")
                    return@launch
                }

                val inference = try {
                    val gpuOptions = LlmInference.LlmInferenceOptions.builder()
                        .setModelPath(modelPath)
                        .setMaxTokens(512)
                        .setMaxNumImages(1)
                        .setPreferredBackend(LlmInference.Backend.GPU)
                        .build()
                    android.util.Log.d("GemmaModule", "Trying GPU backend...")
                    LlmInference.createFromOptions(reactApplicationContext, gpuOptions)
                } catch (e: Exception) {
                    android.util.Log.w("GemmaModule", "GPU failed, falling back to CPU: ${e.message}")
                    val cpuOptions = LlmInference.LlmInferenceOptions.builder()
                        .setModelPath(modelPath)
                        .setMaxTokens(512)
                        .setMaxNumImages(1)
                        .setPreferredBackend(LlmInference.Backend.CPU)
                        .build()
                    LlmInference.createFromOptions(reactApplicationContext, cpuOptions)
                }

                llmInference = inference
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("INIT_ERROR", "Gemma Init Failed: ${e.message}")
            }
        }
    }

    private fun cleanResult(rawResult: String): String {
        val stopTokens = Regex("<end_of_turn>|<eos>|<start_of_turn>")
        val cleaned = rawResult.split(stopTokens)[0]
        return cleaned.lines()
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .joinToString("\n")
            .trim()
    }

    /**
     * inSampleSize を使って最初から小さくデコードする。
     * フル解像度を一度メモリに乗せてからリサイズする旧方式と違い、
     * ピーク使用メモリを大幅に削減できる。
     */
    private fun decodeSampledBitmap(imagePath: String, maxSize: Int = 512): Bitmap {
        // ① 画像サイズだけ取得（実データは読まない）
        val opts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(imagePath, opts)

        // ② 必要な縮小率を計算（2の累乗）
        var sampleSize = 1
        var w = opts.outWidth
        var h = opts.outHeight
        while (w > maxSize || h > maxSize) {
            sampleSize *= 2
            w /= 2
            h /= 2
        }

        // ③ 縮小しながらデコード（MediaPipe は ARGB_8888 必須）
        val decodeOpts = BitmapFactory.Options().apply {
            inSampleSize = sampleSize
            inJustDecodeBounds = false
            inPreferredConfig = Bitmap.Config.ARGB_8888
        }
        android.util.Log.d("GemmaModule", "decoding with sampleSize=$sampleSize (original ${opts.outWidth}x${opts.outHeight})")
        return BitmapFactory.decodeFile(imagePath, decodeOpts)
            ?: throw Exception("Failed to decode image.")
    }

    @ReactMethod
    fun generateResponse(prompt: String, promise: Promise) {
        scope.launch {
            try {
                val inference = llmInference ?: throw Exception("Model not initialized.")
                val result = inference.generateResponse(prompt)
                promise.resolve(cleanResult(result))
            } catch (e: Exception) {
                promise.reject("INFERENCE_ERROR", "${e.message}")
            }
        }
    }

    @ReactMethod
    fun generateResponseWithImage(prompt: String, imagePath: String, promise: Promise) {
        scope.launch {
            try {
                android.util.Log.d("GemmaModule", "=== generateResponseWithImage called ===")

                val inference = llmInference ?: throw Exception("Model not initialized.")

                val file = File(imagePath)
                if (!file.exists()) {
                    promise.reject("IMAGE_NOT_FOUND", "Image not found at: $imagePath")
                    return@launch
                }

                // 最初から 512px 以下でデコード（フル解像度をメモリに乗せない）
                val bitmap = decodeSampledBitmap(imagePath, 512)
                android.util.Log.d("GemmaModule", "image ready: ${bitmap.width}x${bitmap.height}")

                val sessionOptions = LlmInferenceSession.LlmInferenceSessionOptions.builder()
                    .setGraphOptions(
                        GraphOptions.builder()
                            .setEnableVisionModality(true)
                            .build()
                    )
                    .build()
                val session = LlmInferenceSession.createFromOptions(inference, sessionOptions)
                try {
                    // addImage までビットマップを生かしておく（BitmapImageBuilder は参照を保持するだけ）
                    val mpImage = BitmapImageBuilder(bitmap).build()
                    session.addQueryChunk(prompt)
                    session.addImage(mpImage)
                    // セッションがピクセルデータを読み込んだ後に解放
                    bitmap.recycle()

                    android.util.Log.d("GemmaModule", "generating response...")
                    val result = session.generateResponse()
                    android.util.Log.d("GemmaModule", "response: $result")

                    promise.resolve(cleanResult(result))
                } finally {
                    session.close()
                }
            } catch (e: Exception) {
                android.util.Log.e("GemmaModule", "ERROR: ${e.message}", e)
                promise.reject("VLM_ERROR", "VLM Error: ${e.message}")
            }
        }
    }
}
