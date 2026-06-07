package com.gemmavlmapp

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.Conversation
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.SamplerConfig
import com.google.ai.edge.litertlm.Tool
import com.google.ai.edge.litertlm.ToolParam
import com.google.ai.edge.litertlm.ToolSet
import com.google.ai.edge.litertlm.tool
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import java.io.File
import java.io.ByteArrayOutputStream
import java.io.BufferedOutputStream
import java.io.DataOutputStream
import java.io.FileOutputStream
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.collect

/**
 * LiteRT-LM を用いた Gemma 4 オンデバイス推論モジュール。
 *
 * MediaPipe tasks-genai（非推奨）から移行。Gemma 4 QAT モバイル量子化（.litertlm, 約1GB）を
 * GPU/CPU バックエンドで実行し、テキスト・画像・音声のマルチモーダル入力に対応する。
 * 応答は Flow ストリーミングで JS 側へ逐次イベント送出する。
 */
class GemmaModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private var engine: Engine? = null
    private var conversation: Conversation? = null
    private var currentJob: Job? = null
    private val scope = CoroutineScope(Dispatchers.IO)

    override fun getName(): String = "GemmaModule"

    // ── RN イベントエミッタ ─────────────────────────────────────────────
    private fun sendEvent(eventName: String, payload: com.facebook.react.bridge.WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, payload)
    }

    // NativeEventEmitter が要求するスタブ（未指定だと警告が出る）
    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}

    // ── モデル初期化 ────────────────────────────────────────────────────
    @ReactMethod
    fun initializeModel(modelPath: String, promise: Promise) {
        scope.launch {
            try {
                // JS からは file:// スキーム付き URI が渡るため、生のファイルパスに正規化する
                val resolvedPath = modelPath.removePrefix("file://")
                val modelFile = File(resolvedPath)
                if (!modelFile.exists()) {
                    promise.reject("MODEL_NOT_FOUND", "Model file not found at: $resolvedPath")
                    return@launch
                }

                // 既存エンジンがあれば破棄
                conversation?.close(); conversation = null
                engine?.close(); engine = null

                val cacheDir = reactApplicationContext.cacheDir.absolutePath

                // GPU 優先、失敗時は CPU フォールバック（音声は CPU が安定）
                val created = try {
                    android.util.Log.d("GemmaModule", "Trying GPU backend...")
                    val gpuConfig = EngineConfig(
                        modelPath = resolvedPath,
                        backend = Backend.GPU(),
                        visionBackend = Backend.GPU(),
                        audioBackend = Backend.CPU(),
                        cacheDir = cacheDir,
                    )
                    Engine(gpuConfig).also { it.initialize() }
                } catch (e: Exception) {
                    android.util.Log.w("GemmaModule", "GPU failed, falling back to CPU: ${e.message}")
                    val cpuConfig = EngineConfig(
                        modelPath = resolvedPath,
                        backend = Backend.CPU(),
                        visionBackend = Backend.CPU(),
                        audioBackend = Backend.CPU(),
                        cacheDir = cacheDir,
                    )
                    Engine(cpuConfig).also { it.initialize() }
                }

                engine = created
                promise.resolve(true)
            } catch (e: Exception) {
                android.util.Log.e("GemmaModule", "INIT_ERROR", e)
                promise.reject("INIT_ERROR", "Gemma Init Failed: ${e.message}")
            }
        }
    }

    // ── 会話セッション ──────────────────────────────────────────────────
    @ReactMethod
    fun startConversation(systemPrompt: String, promise: Promise) {
        scope.launch {
            try {
                val eng = engine ?: throw Exception("Model not initialized.")
                conversation?.close()
                val config = if (systemPrompt.isNotBlank()) {
                    ConversationConfig(
                        systemInstruction = Contents.of(Content.Text(systemPrompt)),
                        samplerConfig = SamplerConfig(topK = 40, topP = 0.95, temperature = 0.8),
                    )
                } else {
                    ConversationConfig(
                        samplerConfig = SamplerConfig(topK = 40, topP = 0.95, temperature = 0.8),
                    )
                }
                conversation = eng.createConversation(config)
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("CONV_ERROR", "Failed to start conversation: ${e.message}")
            }
        }
    }

    /** function calling（ツール）有効な会話を開始。ツール実行は LiteRT-LM がネイティブで自動処理する */
    @ReactMethod
    fun startConversationWithTools(systemPrompt: String, promise: Promise) {
        scope.launch {
            try {
                val eng = engine ?: throw Exception("Model not initialized.")
                conversation?.close()
                val sys = systemPrompt.ifBlank {
                    "あなたはツールを使えるアシスタントです。必要に応じて提供された関数を呼び出して正確に答えてください。"
                }
                // ツールが呼ばれたら JS へ通知（UI 表示用）
                val tools = BuiltinToolSet { name, args ->
                    sendEvent("onToolCall", Arguments.createMap().apply {
                        putString("name", name)
                        putString("args", args)
                    })
                }
                val config = ConversationConfig(
                    systemInstruction = Contents.of(Content.Text(sys)),
                    tools = listOf(tool(tools)),
                    samplerConfig = SamplerConfig(topK = 40, topP = 0.95, temperature = 0.8),
                )
                conversation = eng.createConversation(config)
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("CONV_ERROR", "Failed to start tool conversation: ${e.message}")
            }
        }
    }

    @ReactMethod
    fun resetConversation(promise: Promise) {
        scope.launch {
            try {
                conversation?.close()
                conversation = null
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("CONV_ERROR", "Failed to reset conversation: ${e.message}")
            }
        }
    }

    /** 会話が無ければデフォルト会話を遅延生成する */
    private fun ensureConversation(): Conversation {
        val eng = engine ?: throw Exception("Model not initialized.")
        conversation?.let { return it }
        val config = ConversationConfig(
            samplerConfig = SamplerConfig(topK = 40, topP = 0.95, temperature = 0.8),
        )
        return eng.createConversation(config).also { conversation = it }
    }

    // ── テキスト送信（ストリーミング）──────────────────────────────────
    @ReactMethod
    fun sendMessage(text: String, promise: Promise) {
        streamContents(Contents.of(Content.Text(text)), promise)
    }

    // ── マルチモーダル送信（画像／音声＋テキスト, ストリーミング）──────
    @ReactMethod
    fun sendMultimodalMessage(text: String, imagePath: String?, audioPath: String?, promise: Promise) {
        try {
            val parts = mutableListOf<Content>()
            imagePath?.takeIf { it.isNotBlank() }?.let {
                val path = it.removePrefix("file://")
                if (!File(path).exists()) {
                    promise.reject("IMAGE_NOT_FOUND", "Image not found at: $path"); return
                }
                parts.add(Content.ImageFile(path))
            }
            audioPath?.takeIf { it.isNotBlank() }?.let {
                val path = it.removePrefix("file://")
                if (!File(path).exists()) {
                    promise.reject("AUDIO_NOT_FOUND", "Audio not found at: $path"); return
                }
                // LiteRT-LM の miniaudio デコーダは WAV/MP3/FLAC のみ対応で AAC(.m4a) を読めない。
                // 録音は AAC のため、PCM16 の WAV に変換してから渡す。
                val wavPath = try {
                    decodeToWavFile(path)
                } catch (e: Exception) {
                    promise.reject("AUDIO_DECODE_ERROR", "音声の変換に失敗しました: ${e.message}"); return
                }
                parts.add(Content.AudioFile(wavPath))
            }
            parts.add(Content.Text(text))
            streamContents(Contents.of(*parts.toTypedArray()), promise)
        } catch (e: Exception) {
            promise.reject("VLM_ERROR", "Failed to build multimodal message: ${e.message}")
        }
    }

    /** Flow<Message> を購読し onToken / onComplete / onError を JS へ送出。Promise は完了時に全文を resolve */
    private fun streamContents(contents: Contents, promise: Promise) {
        currentJob?.cancel()
        currentJob = scope.launch {
            try {
                val conv = ensureConversation()
                val sb = StringBuilder()
                var streamError: Throwable? = null
                conv.sendMessageAsync(contents)
                    .catch { e -> streamError = e }
                    .collect { msg ->
                        val chunk = msg.toString()
                        sb.append(chunk)
                        sendEvent("onToken", Arguments.createMap().apply { putString("token", chunk) })
                    }
                // フロー内のエラーは握りつぶさず JS に伝える（旧実装は空文字を resolve していた）
                streamError?.let { throw it }
                val full = cleanResult(sb.toString())
                sendEvent("onComplete", Arguments.createMap().apply { putString("text", full) })
                promise.resolve(full)
            } catch (e: kotlinx.coroutines.CancellationException) {
                sendEvent("onComplete", Arguments.createMap().apply { putString("text", "") })
                promise.resolve("")
            } catch (e: Exception) {
                android.util.Log.e("GemmaModule", "INFERENCE_ERROR", e)
                sendEvent("onError", Arguments.createMap().apply { putString("message", e.message ?: "error") })
                promise.reject("INFERENCE_ERROR", "${e.message}")
            }
        }
    }

    @ReactMethod
    fun stopGeneration(promise: Promise) {
        currentJob?.cancel()
        currentJob = null
        promise.resolve(true)
    }

    private fun cleanResult(raw: String): String {
        val stopTokens = Regex("<end_of_turn>|<eos>|<start_of_turn>")
        return raw.split(stopTokens)[0].trim()
    }

    /**
     * 任意の音声ファイル（AAC/.m4a 等）を MediaExtractor + MediaCodec で PCM16 にデコードし、
     * miniaudio が読める WAV ファイルへ書き出してそのパスを返す。
     */
    private fun decodeToWavFile(inputPath: String): String {
        val extractor = MediaExtractor()
        extractor.setDataSource(inputPath)
        var trackIndex = -1
        var inputFormat: MediaFormat? = null
        for (i in 0 until extractor.trackCount) {
            val f = extractor.getTrackFormat(i)
            if (f.getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true) {
                trackIndex = i; inputFormat = f; break
            }
        }
        val format = inputFormat ?: run { extractor.release(); throw Exception("音声トラックが見つかりません") }
        extractor.selectTrack(trackIndex)

        val mime = format.getString(MediaFormat.KEY_MIME)!!
        var sampleRate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
        var channelCount = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)

        val codec = MediaCodec.createDecoderByType(mime)
        codec.configure(format, null, null, 0)
        codec.start()

        val pcm = ByteArrayOutputStream()
        val info = MediaCodec.BufferInfo()
        var sawInputEOS = false
        var sawOutputEOS = false
        try {
            while (!sawOutputEOS) {
                if (!sawInputEOS) {
                    val inIndex = codec.dequeueInputBuffer(10_000)
                    if (inIndex >= 0) {
                        val inBuf = codec.getInputBuffer(inIndex)!!
                        val size = extractor.readSampleData(inBuf, 0)
                        if (size < 0) {
                            codec.queueInputBuffer(inIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                            sawInputEOS = true
                        } else {
                            codec.queueInputBuffer(inIndex, 0, size, extractor.sampleTime, 0)
                            extractor.advance()
                        }
                    }
                }
                when (val outIndex = codec.dequeueOutputBuffer(info, 10_000)) {
                    MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                        val of = codec.outputFormat
                        sampleRate = of.getInteger(MediaFormat.KEY_SAMPLE_RATE)
                        channelCount = of.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
                    }
                    MediaCodec.INFO_TRY_AGAIN_LATER -> { /* 次ループ */ }
                    else -> {
                        if (outIndex >= 0) {
                            val outBuf = codec.getOutputBuffer(outIndex)!!
                            val chunk = ByteArray(info.size)
                            outBuf.get(chunk)
                            outBuf.clear()
                            pcm.write(chunk)
                            codec.releaseOutputBuffer(outIndex, false)
                            if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) sawOutputEOS = true
                        }
                    }
                }
            }
        } finally {
            codec.stop(); codec.release(); extractor.release()
        }

        val wavFile = File(reactApplicationContext.cacheDir, "gemma_audio_${System.currentTimeMillis()}.wav")
        writeWav(wavFile, pcm.toByteArray(), sampleRate, channelCount, 16)
        return wavFile.absolutePath
    }

    /** PCM16 リトルエンディアンのバイト列を WAV ファイルとして書き出す。 */
    private fun writeWav(file: File, pcm: ByteArray, sampleRate: Int, channels: Int, bitsPerSample: Int) {
        val byteRate = sampleRate * channels * bitsPerSample / 8
        val blockAlign = channels * bitsPerSample / 8
        val dataLen = pcm.size
        DataOutputStream(BufferedOutputStream(FileOutputStream(file))).use { out ->
            fun intLE(v: Int) { out.write(v and 0xff); out.write((v ushr 8) and 0xff); out.write((v ushr 16) and 0xff); out.write((v ushr 24) and 0xff) }
            fun shortLE(v: Int) { out.write(v and 0xff); out.write((v ushr 8) and 0xff) }
            out.writeBytes("RIFF"); intLE(36 + dataLen); out.writeBytes("WAVE")
            out.writeBytes("fmt "); intLE(16); shortLE(1); shortLE(channels)
            intLE(sampleRate); intLE(byteRate); shortLE(blockAlign); shortLE(bitsPerSample)
            out.writeBytes("data"); intLE(dataLen); out.write(pcm)
        }
    }
}

/**
 * Gemma 4 の function calling デモ用組込みツール群。
 * @Tool 注釈の関数を LiteRT-LM がリフレクションで自動実行する（automaticToolCalling）。
 * onCall: ツール呼び出し時に (関数名, 引数) を JS へ通知するコールバック。
 */
class BuiltinToolSet(private val onCall: (String, String) -> Unit) : ToolSet {

    @Tool(description = "現在の日付と時刻を取得する。今が何時か・今日の日付を問われたら使う。")
    fun getCurrentDateTime(): String {
        onCall("getCurrentDateTime", "{}")
        val fmt = java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss (EEE)", java.util.Locale.JAPAN)
        return fmt.format(java.util.Date())
    }

    @Tool(description = "数値のリストの合計を計算する。")
    fun sum(
        @ToolParam(description = "合計する数値の配列（小数可）") numbers: List<Double>,
    ): Double {
        onCall("sum", numbers.toString())
        return numbers.sum()
    }

    @Tool(description = "数値のリストの積を計算する。")
    fun product(
        @ToolParam(description = "掛け合わせる数値の配列（小数可）") numbers: List<Double>,
    ): Double {
        onCall("product", numbers.toString())
        return numbers.fold(1.0) { acc, n -> acc * n }
    }
}
