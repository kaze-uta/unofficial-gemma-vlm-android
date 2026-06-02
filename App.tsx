import React, { useEffect, useRef, useState } from 'react';
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
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import GemmaModule from './src/native/GemmaModule';

// ── モデルパス（adb push でここに配置）──────────────────────────────────
const MODEL_PATH = '/storage/emulated/0/gemma-3n-E2B-it-int4.task';

// ── 画像解析用システムプロンプト ──────────────────────────────────────────
const IMAGE_SYSTEM_PROMPT =
  'あなたは画像分析の専門家AIです。与えられた画像を注意深く・正確に観察し、ユーザーの質問に対して詳細かつ的確に答えてください。' +
  '推測が必要な場合は根拠を明示した上で回答し、画像から確認できない情報については「確認できません」と正直に伝えてください。';


type AppState = 'loading' | 'initializing' | 'ready';
type Mode = null | 'image' | 'chat';

const App = () => {
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const camera = useRef<Camera>(null);
  const setupCalled = useRef(false);

  const [appState, setAppState] = useState<AppState>('loading');
  const [mode, setMode] = useState<Mode>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [userPrompt, setUserPrompt] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState('起動中...');

  useEffect(() => {
    if (!setupCalled.current) {
      setupCalled.current = true;
      setup();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setup = async () => {
    if (!GemmaModule) {
      setStatusMessage('【エラー】GemmaModule が見つかりません。再ビルドしてください。');
      return;
    }

    // カメラ権限（画像解析で使用するため事前取得）
    if (Platform.OS === 'android') {
      const cameraGranted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
      );
      if (cameraGranted !== PermissionsAndroid.RESULTS.GRANTED) {
        setStatusMessage('カメラの権限が必要です。設定から許可してください。');
        return;
      }
    }

    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) {
        setStatusMessage('カメラの権限が必要です。設定から許可してください。');
        return;
      }
    }

    // Android 11+ は全ファイルアクセス権限が必要
    if (Platform.OS === 'android' && Platform.Version >= 30) {
      const hasStorageAccess = await GemmaModule.isExternalStorageManager();
      if (!hasStorageAccess) {
        Alert.alert(
          'ストレージ権限が必要',
          'モデルファイルを読み込むために「全ファイルへのアクセス」を許可してください。',
          [
            {
              text: '設定を開く',
              onPress: async () => {
                await GemmaModule.openStorageSettings();
                setStatusMessage('設定で「全ファイルへのアクセス」を許可後、アプリを再起動してください。');
              },
            },
            { text: 'キャンセル', style: 'cancel' },
          ],
        );
        return;
      }
    }

    setAppState('initializing');
    setStatusMessage('モデルを初期化中...\n（初回は1〜2分かかる場合があります）');

    try {
      await GemmaModule.initializeModel(MODEL_PATH);
      setAppState('ready');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('MODEL_NOT_FOUND') || msg.includes('not found')) {
        setStatusMessage(
          '【モデルが見つかりません】\n\n' +
          'README の手順に従ってモデルファイルを配置してください。\n\n' +
          `配置先: ${MODEL_PATH}`,
        );
      } else {
        setStatusMessage('モデル初期化失敗: ' + msg);
      }
      setAppState('loading');
    }
  };

  const handleSelectMode = (selected: Mode) => {
    setMode(selected);
    setAnalysisResult('');
    setUserPrompt('');
  };

  const handleBack = () => {
    setMode(null);
    setAnalysisResult('');
    setUserPrompt('');
  };

  const takePhoto = async () => {
    if (!camera.current || appState !== 'ready' || isProcessing) return;

    try {
      // ① カメラがアクティブなうちに先に撮影する
      const photo = await camera.current.takePhoto({
        flash: 'off',
        qualityPrioritization: 'speed',
      });

      // ② 撮影完了後に isProcessing = true → カメラが閉じる（GPU 解放）
      setIsProcessing(true);
      setAnalysisResult('Gemma 3で画像を解析中...');

      const prompt = `<start_of_turn>user\n<image>\n${IMAGE_SYSTEM_PROMPT}\n\n${userPrompt.trim()}<end_of_turn>\n<start_of_turn>model\n`;
      const response = await GemmaModule.generateResponseWithImage(prompt, photo.path);
      setAnalysisResult(response);
    } catch (error) {
      setAnalysisResult('エラー: ' + (error instanceof Error ? error.message : '不明なエラー'));
    } finally {
      setIsProcessing(false);
    }
  };

  const sendChat = async () => {
    if (appState !== 'ready' || isProcessing || !userPrompt.trim()) return;

    try {
      setIsProcessing(true);
      setAnalysisResult('考え中...');
      const prompt = `<start_of_turn>user\n${userPrompt.trim()}<end_of_turn>\n<start_of_turn>model\n`;
      const response = await GemmaModule.generateResponse(prompt);
      setAnalysisResult(response);
    } catch (error) {
      setAnalysisResult('エラー: ' + (error instanceof Error ? error.message : '不明なエラー'));
    } finally {
      setIsProcessing(false);
    }
  };

  // ── loading / initializing 画面 ────────────────────────────────────────
  if (appState !== 'ready') {
    return (
      <View style={styles.centerScreen}>
        {appState === 'initializing' && (
          <ActivityIndicator size="large" color="#007AFF" style={{ marginBottom: 20 }} />
        )}
        <Text style={styles.statusText}>{statusMessage}</Text>
      </View>
    );
  }

  // ── モード選択画面 ─────────────────────────────────────────────────────
  if (mode === null) {
    return (
      <SafeAreaView style={styles.modeSelectSafe}>
        <View style={styles.modeSelectScreen}>
          <Text style={styles.modeTitle}>Gemma 3</Text>

          <TouchableOpacity
            style={styles.modeButton}
            onPress={() => handleSelectMode('image')}
          >
            <Text style={styles.modeButtonText}>画像解析</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.modeButton}
            onPress={() => handleSelectMode('chat')}
          >
            <Text style={styles.modeButtonText}>チャット</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── 画像解析画面 ───────────────────────────────────────────────────────
  if (mode === 'image') {
    if (device == null) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.centerScreen}>
            <Text style={styles.statusText}>カメラデバイスが見つかりません</Text>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Text style={styles.backButtonText}>← 戻る</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* ヘッダー */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} disabled={isProcessing}>
              <Text style={[styles.backButtonText, isProcessing && { color: '#aaa' }]}>← 戻る</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>📷 画像解析</Text>
            <View style={{ width: 60 }} />
          </View>

          {/* カメラ */}
          <View style={styles.cameraContainer}>
            <Camera
              ref={camera}
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={!isProcessing}   // 解析中はプレビュー停止 → GPU/RAM 競合を防ぐ
              photo={true}
            />
          </View>

          {/* 結果 */}
          <View style={styles.resultContainer}>
            <ScrollView style={styles.scrollArea}>
              <Text style={styles.resultHeader}>解析結果：</Text>
              {isProcessing ? (
                <ActivityIndicator size="small" color="#0000ff" />
              ) : (
                <Text style={styles.resultText}>{analysisResult || '撮影して解析してください'}</Text>
              )}
            </ScrollView>
          </View>

          {/* プロンプト入力 */}
          <View style={styles.promptContainer}>
            <Text style={styles.promptLabel}>画像への質問・指示（任意）</Text>
            <TextInput
              style={styles.promptInput}
              value={userPrompt}
              onChangeText={setUserPrompt}
              placeholder="例：この画像に写っているものを説明して"
              placeholderTextColor="#aaa"
              multiline
              editable={!isProcessing}
            />
          </View>

          {/* 撮影ボタン */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.actionButton, isProcessing && styles.disabledButton]}
              onPress={takePhoto}
              disabled={isProcessing}
            >
              <Text style={styles.buttonText}>
                {isProcessing ? '解析中...' : '📷 撮影して解析'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── チャット画面 ────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* ヘッダー */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} disabled={isProcessing}>
            <Text style={[styles.backButtonText, isProcessing && { color: '#aaa' }]}>← 戻る</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>💬 チャット</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* 結果 */}
        <View style={[styles.resultContainer, { flex: 1, borderTopLeftRadius: 0, borderTopRightRadius: 0 }]}>
          <ScrollView style={styles.scrollArea}>
            <Text style={styles.resultHeader}>Gemma 3 の回答：</Text>
            {isProcessing ? (
              <ActivityIndicator size="small" color="#0000ff" />
            ) : (
              <Text style={styles.resultText}>{analysisResult || '質問を入力して送信してください'}</Text>
            )}
          </ScrollView>
        </View>

        {/* プロンプト入力 */}
        <View style={styles.promptContainer}>
          <Text style={styles.promptLabel}>メッセージ</Text>
          <TextInput
            style={styles.promptInput}
            value={userPrompt}
            onChangeText={setUserPrompt}
            placeholder="質問や指示を入力..."
            placeholderTextColor="#aaa"
            multiline
            editable={!isProcessing}
          />
        </View>

        {/* 送信ボタン */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.chatButton,
              (isProcessing || !userPrompt.trim()) && styles.disabledButton,
            ]}
            onPress={sendChat}
            disabled={isProcessing || !userPrompt.trim()}
          >
            <Text style={styles.buttonText}>
              {isProcessing ? '考え中...' : '送信'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // ── 共通 ──────────────────────────────────────────────────────────────
  centerScreen: {
    flex: 1, backgroundColor: '#000',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  statusText: { color: '#fff', fontSize: 15, lineHeight: 24, textAlign: 'center' },
  container: { flex: 1, backgroundColor: '#111' },
  keyboardView: { flex: 1 },

  // ── モード選択画面 ─────────────────────────────────────────────────────
  modeSelectSafe: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modeSelectScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#fff',
  },
  modeTitle: {
    fontSize: 18,
    color: '#999',
    marginBottom: 40,
    letterSpacing: 1,
  },
  modeButton: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingVertical: 18,
    marginBottom: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  modeButtonText: {
    fontSize: 16,
    color: '#222',
    fontWeight: '500',
  },

  // ── ヘッダー ──────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#fff',
  },
  backButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#333',
    borderRadius: 10,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // ── カメラ ────────────────────────────────────────────────────────────
  cameraContainer: { flex: 2, width: '100%', overflow: 'hidden' },

  // ── 結果エリア ────────────────────────────────────────────────────────
  resultContainer: {
    width: '100%',
    flex: 1,
    backgroundColor: '#fff',
    padding: 15,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  scrollArea: { flex: 1 },
  resultHeader: { fontWeight: 'bold', fontSize: 16, marginBottom: 8, color: '#333' },
  resultText: { fontSize: 14, color: '#444', lineHeight: 20 },

  // ── プロンプト入力 ─────────────────────────────────────────────────────
  promptContainer: {
    width: '100%',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  promptLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  promptInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#333',
    minHeight: 60,
    maxHeight: 100,
    textAlignVertical: 'top',
  },

  // ── ボタン ────────────────────────────────────────────────────────────
  buttonContainer: {
    width: '100%',
    backgroundColor: '#fff',
    paddingTop: 8,
    paddingBottom: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  actionButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 50,
    borderRadius: 30,
    elevation: 5,
    minWidth: 200,
    alignItems: 'center',
  },
  chatButton: {
    backgroundColor: '#34C759',
  },
  disabledButton: { backgroundColor: '#ccc' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

export default App;
