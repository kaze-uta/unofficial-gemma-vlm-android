import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  PermissionsAndroid,
  Platform,
  Image,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import * as ImagePicker from 'expo-image-picker';
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  AudioModule,
} from 'expo-audio';
import GemmaModule, { gemmaEvents } from './src/native/GemmaModule';
import {
  MODEL_PATH,
  isModelDownloaded,
  downloadModel,
  deleteModel,
  formatBytes,
  type DownloadProgress,
} from './src/native/ModelDownloader';

// ── システムプロンプト ──────────────────────────────────────────────
// チャットはツール（function calling）を統合。通常会話に加え、必要なときだけ関数を呼ぶ。
const CHAT_SYSTEM_PROMPT =
  'あなたは親切で有能な日本語アシスタントです。質問には簡潔かつ正確に答えてください。' +
  '現在時刻の取得や数値計算など、提供された関数が本当に必要なときだけ関数を呼び出して正確に答えてください。' +
  '通常の会話では関数を使う必要はありません。';
const IMAGE_SYSTEM_PROMPT =
  'あなたは画像分析の専門家AIです。与えられた画像を注意深く・正確に観察し、ユーザーの質問に詳細かつ的確に答えてください。' +
  '画像から確認できない情報については「確認できません」と正直に伝えてください。';
const AUDIO_SYSTEM_PROMPT =
  'あなたは音声理解アシスタントです。与えられた音声の内容を正確に聞き取り、ユーザーの指示に答えてください。';

type AppState = 'checking' | 'downloading' | 'initializing' | 'ready' | 'error';
type Mode = null | 'chat' | 'image' | 'audio';

interface ChatMessage {
  role: 'user' | 'model' | 'tool';
  text: string;
}

// ── ストリーミング購読フック ────────────────────────────────────────
function useGemmaStream() {
  const [partial, setPartial] = useState('');
  const partialRef = useRef('');

  useEffect(() => {
    if (!gemmaEvents) return;
    const tok = gemmaEvents.addListener('onToken', (e: { token: string }) => {
      partialRef.current += e.token ?? '';
      setPartial(partialRef.current);
    });
    return () => {
      tok.remove();
    };
  }, []);

  const reset = useCallback(() => {
    partialRef.current = '';
    setPartial('');
  }, []);

  return { partial, reset };
}

const App = () => {
  const [appState, setAppState] = useState<AppState>('checking');
  const [mode, setMode] = useState<Mode>(null);
  const [statusMessage, setStatusMessage] = useState('準備中...');
  const [dlProgress, setDlProgress] = useState<DownloadProgress | null>(null);
  const setupCalled = useRef(false);

  useEffect(() => {
    if (!setupCalled.current) {
      setupCalled.current = true;
      bootstrap();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bootstrap = async () => {
    if (!GemmaModule) {
      setAppState('error');
      setStatusMessage('【エラー】GemmaModule が見つかりません。再ビルドしてください。');
      return;
    }

    try {
      // ① モデルの有無を確認 → 無ければアプリ内DL
      const exists = await isModelDownloaded();
      if (!exists) {
        setAppState('downloading');
        setStatusMessage('Gemma 4 モデルをダウンロード中...');
        await downloadModel((p) => setDlProgress(p));
      }

      // ② エンジン初期化
      setAppState('initializing');
      setStatusMessage('モデルを初期化中...\n（初回は1〜2分かかる場合があります）');
      await GemmaModule.initializeModel(MODEL_PATH);
      setAppState('ready');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setAppState('error');
      if (msg.includes('401') || msg.includes('403')) {
        setStatusMessage(
          'モデルのダウンロードに失敗しました（ネットワーク／アクセス制限の可能性）。\n' +
            'README「モデルの手動配置」の手順でモデルを取得し配置してください。\n\n配置先: ' +
            MODEL_PATH,
        );
      } else {
        setStatusMessage('初期化失敗: ' + msg);
      }
    }
  };

  const handleSelectMode = async (selected: Mode) => {
    // モード切替時に会話コンテキストをリセットして混線を防ぐ
    try {
      await GemmaModule.resetConversation();
      if (selected === 'chat') {
        // チャットはツール統合: function calling を有効化
        await GemmaModule.startConversationWithTools(CHAT_SYSTEM_PROMPT);
      } else {
        const sys = selected === 'image' ? IMAGE_SYSTEM_PROMPT : AUDIO_SYSTEM_PROMPT;
        await GemmaModule.startConversation(sys);
      }
    } catch {
      /* noop */
    }
    setMode(selected);
  };

  const handleBack = async () => {
    try {
      await GemmaModule.stopGeneration();
    } catch {
      /* noop */
    }
    setMode(null);
  };

  const handleRedownload = () => {
    Alert.alert('モデルを再ダウンロード', 'モデルファイルを削除して再取得します。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '実行',
        style: 'destructive',
        onPress: async () => {
          await deleteModel();
          setupCalled.current = false;
          setMode(null);
          setAppState('checking');
          setupCalled.current = true;
          bootstrap();
        },
      },
    ]);
  };

  // ── セットアップ画面（DL / 初期化 / エラー）─────────────────────────
  if (appState !== 'ready') {
    const pct = dlProgress ? Math.round(dlProgress.progress * 100) : 0;
    return (
      <View style={styles.centerScreen}>
        {(appState === 'initializing' || appState === 'checking') && (
          <ActivityIndicator size="large" color="#007AFF" style={{ marginBottom: 20 }} />
        )}
        <Text style={styles.statusText}>{statusMessage}</Text>

        {appState === 'downloading' && dlProgress && (
          <View style={styles.progressWrap}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {pct}% （{formatBytes(dlProgress.writtenBytes)} / {formatBytes(dlProgress.totalBytes)}）
            </Text>
          </View>
        )}

        {appState === 'error' && (
          <TouchableOpacity style={styles.backButton} onPress={() => { setupCalled.current = true; bootstrap(); }}>
            <Text style={styles.backButtonText}>再試行</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // ── モード選択画面 ─────────────────────────────────────────────────
  if (mode === null) {
    return (
      <SafeAreaView style={styles.modeSelectSafe}>
        <View style={styles.modeSelectScreen}>
          <Text style={styles.modeTitle}>Gemma 4 · オンデバイス</Text>

          <TouchableOpacity style={styles.modeButton} onPress={() => handleSelectMode('chat')}>
            <Text style={styles.modeButtonText}>チャット</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modeButton} onPress={() => handleSelectMode('image')}>
            <Text style={styles.modeButtonText}>画像解析 / OCR</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modeButton} onPress={() => handleSelectMode('audio')}>
            <Text style={styles.modeButtonText}>音声入力</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkButton} onPress={handleRedownload}>
            <Text style={styles.linkButtonText}>モデルを再ダウンロード</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (mode === 'chat') return <ChatScreen onBack={handleBack} />;
  if (mode === 'image') return <ImageScreen onBack={handleBack} />;
  return <AudioScreen onBack={handleBack} />;
};

// ══ チャット画面（ストリーミング・マルチターン + ツール統合）═══════════
const ChatScreen = ({ onBack }: { onBack: () => void }) => {
  const { partial, reset } = useGemmaStream();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // ツール呼び出し（function calling）イベントを会話履歴に差し込む
  useEffect(() => {
    if (!gemmaEvents) return;
    const sub = gemmaEvents.addListener('onToolCall', (e: { name: string; args: string }) => {
      setMessages((m) => [...m, { role: 'tool', text: `[ツール] ${e.name}(${e.args})` }]);
    });
    return () => sub.remove();
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || isProcessing) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text }]);
    setIsProcessing(true);
    reset();
    try {
      const full = await GemmaModule.sendMessage(text);
      setMessages((m) => [...m, { role: 'model', text: full }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'model', text: 'エラー: ' + (e instanceof Error ? e.message : '不明') }]);
    } finally {
      setIsProcessing(false);
      reset();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header title="チャット" onBack={onBack} disabled={false} />

        <ScrollView
          ref={scrollRef}
          style={styles.chatScroll}
          contentContainerStyle={styles.chatContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          <Text style={styles.toolsHint}>
            会話のほか「いま何時？」「3.5 と 12 と 7 を全部掛けて」などで自動的に関数を呼び出します
          </Text>
          {messages.map((m, i) => (
            <View
              key={i}
              style={[
                styles.bubble,
                m.role === 'user' ? styles.bubbleUser : m.role === 'tool' ? styles.bubbleTool : styles.bubbleModel,
              ]}
            >
              <Text
                style={
                  m.role === 'user'
                    ? styles.bubbleUserText
                    : m.role === 'tool'
                    ? styles.bubbleToolText
                    : styles.bubbleModelText
                }
              >
                {m.text}
              </Text>
            </View>
          ))}
          {isProcessing && (
            <View style={[styles.bubble, styles.bubbleModel]}>
              <Text style={styles.bubbleModelText}>{partial || '…'}</Text>
            </View>
          )}
        </ScrollView>

        <InputBar
          value={input}
          onChange={setInput}
          onSend={send}
          isProcessing={isProcessing}
          placeholder="メッセージを入力..."
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ══ 画像解析 / OCR 画面（カメラ + ギャラリー）═════════════════════════
const ImageScreen = ({ onBack }: { onBack: () => void }) => {
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const camera = useRef<Camera>(null);
  const { partial, reset } = useGemmaStream();

  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [useGallery, setUseGallery] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (Platform.OS === 'android') {
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
      }
      if (!hasPermission) await requestPermission();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const analyze = async (imagePath: string, question: string) => {
    setIsProcessing(true);
    setResult('');
    reset();
    try {
      const full = await GemmaModule.sendMultimodalMessage(question, imagePath, null);
      setResult(full);
    } catch (e) {
      setResult('エラー: ' + (e instanceof Error ? e.message : '不明なエラー'));
    } finally {
      setIsProcessing(false);
      reset();
    }
  };

  const takePhoto = async () => {
    if (!camera.current || isProcessing) return;
    try {
      const photo = await camera.current.takePhoto({ flash: 'off' });
      const uri = photo.path.startsWith('file://') ? photo.path : 'file://' + photo.path;
      setImageUri(uri);
      await analyze(photo.path, prompt.trim() || 'この画像を説明してください。');
    } catch (e) {
      setResult('エラー: ' + (e instanceof Error ? e.message : '不明なエラー'));
    }
  };

  const pickFromGallery = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 1,
    });
    if (!res.canceled && res.assets[0]) {
      setImageUri(res.assets[0].uri);
      await analyze(res.assets[0].uri, prompt.trim() || 'この画像を説明してください。');
    }
  };

  const displayed = isProcessing ? partial : result;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header title="画像解析 / OCR" onBack={onBack} disabled={isProcessing} />

        {/* ソース切替 */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, !useGallery && styles.tabActive]}
            onPress={() => setUseGallery(false)}
            disabled={isProcessing}
          >
            <Text style={[styles.tabText, !useGallery && styles.tabTextActive]}>カメラ</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, useGallery && styles.tabActive]}
            onPress={() => setUseGallery(true)}
            disabled={isProcessing}
          >
            <Text style={[styles.tabText, useGallery && styles.tabTextActive]}>ギャラリー</Text>
          </TouchableOpacity>
        </View>

        {!useGallery && device != null && (
          <View style={styles.cameraContainer}>
            <Camera
              ref={camera}
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={!isProcessing}
              photo={true}
            />
          </View>
        )}

        <View style={styles.resultContainer}>
          <ScrollView style={styles.scrollArea}>
            {imageUri && (
              <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
            )}
            <Text style={styles.resultHeader}>解析結果：</Text>
            <Text style={styles.resultText}>
              {displayed || (isProcessing ? '解析中...' : '画像を撮影／選択してください')}
            </Text>
          </ScrollView>
        </View>

        <View style={styles.promptContainer}>
          <Text style={styles.promptLabel}>質問・指示（任意 / OCR は「文字を抽出して」）</Text>
          <View style={styles.quickRow}>
            <TouchableOpacity style={styles.chip} onPress={() => setPrompt('この画像内の文字をすべて正確に書き出して')}>
              <Text style={styles.chipText}>OCR 文字抽出</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.chip} onPress={() => setPrompt('この画像に写っているものを詳しく説明して')}>
              <Text style={styles.chipText}>詳しく説明</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.promptInput}
            value={prompt}
            onChangeText={setPrompt}
            placeholder="例：この画像に写っているものを説明して"
            placeholderTextColor="#aaa"
            multiline
            editable={!isProcessing}
          />
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.actionButton, isProcessing && styles.disabledButton]}
            onPress={useGallery ? pickFromGallery : takePhoto}
            disabled={isProcessing}
          >
            <Text style={styles.buttonText}>
              {isProcessing ? '解析中...' : useGallery ? '画像を選んで解析' : '撮影して解析'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ══ 音声入力画面 ════════════════════════════════════════════════════
const AudioScreen = ({ onBack }: { onBack: () => void }) => {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const recState = useAudioRecorderState(recorder, 100);
  const { partial, reset } = useGemmaStream();
  const [prompt, setPrompt] = useState('この音声の内容を要約して、要点を答えて');
  const [result, setResult] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // 録音の経過時間（mm:ss）と入力レベル（0〜1）を表示用に算出
  const elapsedSec = Math.floor((recState.durationMillis ?? 0) / 1000);
  const mmss = `${String(Math.floor(elapsedSec / 60)).padStart(2, '0')}:${String(elapsedSec % 60).padStart(2, '0')}`;
  const level =
    recState.metering == null ? 0 : Math.max(0, Math.min(1, (recState.metering + 60) / 60));

  const startRec = async () => {
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('マイク権限が必要です', '設定から許可してください。');
      return;
    }
    await recorder.prepareToRecordAsync();
    recorder.record();
    setIsRecording(true);
  };

  const stopAndAnalyze = async () => {
    setIsRecording(false);
    setIsProcessing(true);
    setResult('');
    reset();
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) {
        throw new Error('録音ファイルを取得できませんでした');
      }
      const full = await GemmaModule.sendMultimodalMessage(prompt.trim() || 'この音声の内容を答えて', null, uri);
      setResult(full);
    } catch (e) {
      setResult('エラー: ' + (e instanceof Error ? e.message : '不明なエラー'));
    } finally {
      setIsProcessing(false);
      reset();
    }
  };

  const displayed = isProcessing ? partial : result;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header title="音声入力" onBack={onBack} disabled={isProcessing || isRecording} />

        {isRecording && (
          <View style={styles.recBanner}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>録音中 {mmss}</Text>
            <View style={styles.levelBarBg}>
              <View style={[styles.levelBarFill, { width: `${Math.round(level * 100)}%` }]} />
            </View>
          </View>
        )}

        <View style={[styles.resultContainer, { flex: 1, borderTopLeftRadius: 0, borderTopRightRadius: 0 }]}>
          <ScrollView style={styles.scrollArea}>
            <Text style={styles.resultHeader}>結果：</Text>
            <Text style={styles.resultText}>
              {displayed || (isProcessing ? '解析中...' : '録音して送信してください')}
            </Text>
          </ScrollView>
        </View>

        <View style={styles.promptContainer}>
          <Text style={styles.promptLabel}>音声への指示（指示を変えると出力が変わります）</Text>
          <View style={[styles.quickRow, { flexWrap: 'wrap' }]}>
            <TouchableOpacity style={[styles.chip, { marginBottom: 6 }]} onPress={() => setPrompt('この音声の内容を要約して、要点を答えて')}>
              <Text style={styles.chipText}>要約</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.chip, { marginBottom: 6 }]} onPress={() => setPrompt('この音声で聞かれている質問に答えて')}>
              <Text style={styles.chipText}>内容に答える</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.chip, { marginBottom: 6 }]} onPress={() => setPrompt('この音声の内容を英訳して')}>
              <Text style={styles.chipText}>英訳</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.chip, { marginBottom: 6 }]} onPress={() => setPrompt('この音声の内容を一字一句正確に文字起こしして')}>
              <Text style={styles.chipText}>文字起こし</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.promptInput}
            value={prompt}
            onChangeText={setPrompt}
            placeholder="例：この音声の内容を要約して"
            placeholderTextColor="#aaa"
            multiline
            editable={!isProcessing && !isRecording}
          />
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              isRecording ? styles.recordingButton : null,
              isProcessing && styles.disabledButton,
            ]}
            onPress={isRecording ? stopAndAnalyze : startRec}
            disabled={isProcessing}
          >
            <Text style={styles.buttonText}>
              {isProcessing ? '解析中...' : isRecording ? '停止して解析' : '録音開始'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ══ 共通コンポーネント ══════════════════════════════════════════════
const Header = ({ title, onBack, disabled }: { title: string; onBack: () => void; disabled: boolean }) => (
  <View style={styles.header}>
    <TouchableOpacity onPress={onBack} disabled={disabled}>
      <Text style={[styles.backButtonText, disabled && { color: '#aaa' }]}>← 戻る</Text>
    </TouchableOpacity>
    <Text style={styles.headerTitle}>{title}</Text>
    <View style={{ width: 60 }} />
  </View>
);

const InputBar = ({
  value,
  onChange,
  onSend,
  isProcessing,
  placeholder,
}: {
  value: string;
  onChange: (t: string) => void;
  onSend: () => void;
  isProcessing: boolean;
  placeholder: string;
}) => (
  <View style={styles.inputBar}>
    <TextInput
      style={styles.inputBarField}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#aaa"
      multiline
      editable={!isProcessing}
    />
    <TouchableOpacity
      style={[styles.sendButton, (isProcessing || !value.trim()) && styles.disabledButton]}
      onPress={onSend}
      disabled={isProcessing || !value.trim()}
    >
      <Text style={styles.sendButtonText}>{isProcessing ? '…' : '送信'}</Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  centerScreen: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: 32 },
  statusText: { color: '#fff', fontSize: 15, lineHeight: 24, textAlign: 'center' },
  container: { flex: 1, backgroundColor: '#111' },
  keyboardView: { flex: 1 },

  // 進捗バー
  progressWrap: { width: '100%', marginTop: 28, alignItems: 'center' },
  progressBarBg: { width: '100%', height: 10, backgroundColor: '#333', borderRadius: 5, overflow: 'hidden' },
  progressBarFill: { height: 10, backgroundColor: '#007AFF' },
  progressText: { color: '#bbb', fontSize: 13, marginTop: 10 },

  // モード選択
  modeSelectSafe: { flex: 1, backgroundColor: '#fff' },
  modeSelectScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, backgroundColor: '#fff' },
  modeTitle: { fontSize: 18, color: '#999', marginBottom: 40, letterSpacing: 1 },
  modeButton: { width: '100%', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingVertical: 18, marginBottom: 12, alignItems: 'center', backgroundColor: '#fff' },
  modeButtonText: { fontSize: 16, color: '#222', fontWeight: '500' },
  linkButton: { marginTop: 24, paddingVertical: 8 },
  linkButtonText: { color: '#888', fontSize: 13, textDecorationLine: 'underline' },

  // ヘッダー
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1C1C1E', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#333' },
  headerTitle: { fontSize: 17, fontWeight: 'bold', color: '#fff' },
  backButton: { marginTop: 24, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#333', borderRadius: 10 },
  backButtonText: { color: '#007AFF', fontSize: 16, fontWeight: '600' },

  // タブ
  tabRow: { flexDirection: 'row', backgroundColor: '#1C1C1E' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#007AFF' },
  tabText: { color: '#888', fontSize: 14 },
  tabTextActive: { color: '#fff', fontWeight: '600' },

  // カメラ
  cameraContainer: { flex: 2, width: '100%', overflow: 'hidden' },

  // チャット
  chatScroll: { flex: 1, backgroundColor: '#111' },
  chatContent: { padding: 12 },
  toolsHint: { color: '#777', fontSize: 12, textAlign: 'center', marginBottom: 12 },
  bubble: { maxWidth: '85%', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10 },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: '#007AFF' },
  bubbleModel: { alignSelf: 'flex-start', backgroundColor: '#2C2C2E' },
  bubbleTool: { alignSelf: 'center', backgroundColor: '#3A3A1E', borderWidth: 1, borderColor: '#7a6a2a' },
  bubbleUserText: { color: '#fff', fontSize: 15, lineHeight: 21 },
  bubbleModelText: { color: '#eee', fontSize: 15, lineHeight: 21 },
  bubbleToolText: { color: '#e8d98a', fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  // 結果エリア
  resultContainer: { width: '100%', flex: 1, backgroundColor: '#fff', padding: 15, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  scrollArea: { flex: 1 },
  resultHeader: { fontWeight: 'bold', fontSize: 16, marginBottom: 8, color: '#333' },
  resultText: { fontSize: 14, color: '#444', lineHeight: 20 },
  previewImage: { width: '100%', height: 200, borderRadius: 8, marginBottom: 12, backgroundColor: '#f0f0f0' },

  // 録音インジケーター
  recBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2C1414', paddingHorizontal: 16, paddingVertical: 10 },
  recDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FF3B30', marginRight: 10 },
  recText: { color: '#fff', fontSize: 14, fontWeight: '600', width: 110 },
  levelBarBg: { flex: 1, height: 8, backgroundColor: '#444', borderRadius: 4, overflow: 'hidden' },
  levelBarFill: { height: 8, backgroundColor: '#FF3B30' },

  // プロンプト入力
  promptContainer: { width: '100%', backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, borderTopWidth: 1, borderTopColor: '#eee' },
  promptLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  promptInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: '#333', minHeight: 60, maxHeight: 100, textAlignVertical: 'top' },
  quickRow: { flexDirection: 'row', marginBottom: 6 },
  chip: { backgroundColor: '#EEF3FF', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  chipText: { color: '#007AFF', fontSize: 12, fontWeight: '600' },

  // ボタン
  buttonContainer: { width: '100%', backgroundColor: '#fff', paddingTop: 8, paddingBottom: 44, paddingHorizontal: 20, alignItems: 'center' },
  actionButton: { backgroundColor: '#007AFF', paddingVertical: 15, paddingHorizontal: 50, borderRadius: 30, elevation: 5, minWidth: 200, alignItems: 'center' },
  recordingButton: { backgroundColor: '#FF3B30' },
  disabledButton: { backgroundColor: '#ccc' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  // チャット入力バー
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#1C1C1E', padding: 8, paddingBottom: 40 },
  inputBarField: { flex: 1, backgroundColor: '#2C2C2E', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#fff', maxHeight: 100 },
  sendButton: { marginLeft: 8, backgroundColor: '#007AFF', borderRadius: 18, paddingHorizontal: 18, paddingVertical: 11 },
  sendButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});

export default App;
