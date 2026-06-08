import React, { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import GemmaModule from './src/native/GemmaModule';
import {
  MODEL_PATH,
  isModelDownloaded,
  downloadModel,
  deleteModel,
  type DownloadProgress,
} from './src/native/ModelDownloader';
import {
  CHAT_SYSTEM_PROMPT,
  IMAGE_SYSTEM_PROMPT,
  AUDIO_SYSTEM_PROMPT,
} from './src/prompts';
import type { AppState, Mode } from './src/types';
import { SetupScreen } from './src/features/setup/SetupScreen';
import { ModeSelectScreen } from './src/features/setup/ModeSelectScreen';
import { ChatScreen } from './src/features/chat/ChatScreen';
import { ImageScreen } from './src/features/image/ImageScreen';
import { AudioScreen } from './src/features/audio/AudioScreen';

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
    return (
      <SetupScreen
        appState={appState}
        statusMessage={statusMessage}
        dlProgress={dlProgress}
        onRetry={() => {
          setupCalled.current = true;
          bootstrap();
        }}
      />
    );
  }

  // ── モード選択画面 ─────────────────────────────────────────────────
  if (mode === null) {
    return <ModeSelectScreen onSelectMode={handleSelectMode} onRedownload={handleRedownload} />;
  }

  if (mode === 'chat') return <ChatScreen onBack={handleBack} />;
  if (mode === 'image') return <ImageScreen onBack={handleBack} />;
  return <AudioScreen onBack={handleBack} />;
};

export default App;
