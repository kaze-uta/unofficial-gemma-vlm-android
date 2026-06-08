import React from 'react';
import { Text, View, TouchableOpacity, SafeAreaView } from 'react-native';
import { styles } from '../../theme/styles';
import type { Mode } from '../../types';

// ── モード選択画面 ─────────────────────────────────────────────────
export const ModeSelectScreen = ({
  onSelectMode,
  onRedownload,
}: {
  onSelectMode: (selected: Mode) => void;
  onRedownload: () => void;
}) => (
  <SafeAreaView style={styles.modeSelectSafe}>
    <View style={styles.modeSelectScreen}>
      <Text style={styles.modeTitle}>Gemma 4 · オンデバイス</Text>

      <TouchableOpacity style={styles.modeButton} onPress={() => onSelectMode('chat')}>
        <Text style={styles.modeButtonText}>チャット</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.modeButton} onPress={() => onSelectMode('image')}>
        <Text style={styles.modeButtonText}>画像解析 / OCR</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.modeButton} onPress={() => onSelectMode('audio')}>
        <Text style={styles.modeButtonText}>音声入力</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.linkButton} onPress={onRedownload}>
        <Text style={styles.linkButtonText}>モデルを再ダウンロード</Text>
      </TouchableOpacity>
    </View>
  </SafeAreaView>
);
