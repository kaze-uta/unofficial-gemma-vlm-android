import React, { useState } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  AudioModule,
} from 'expo-audio';
import GemmaModule from '../../native/GemmaModule';
import { useGemmaStream } from '../../hooks/useGemmaStream';
import { Header } from '../../components/Header';
import { styles } from '../../theme/styles';

// ══ 音声入力画面 ════════════════════════════════════════════════════
export const AudioScreen = ({ onBack }: { onBack: () => void }) => {
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
