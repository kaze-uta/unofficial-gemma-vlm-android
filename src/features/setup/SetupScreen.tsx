import React from 'react';
import { Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { formatBytes, type DownloadProgress } from '../../native/ModelDownloader';
import { styles } from '../../theme/styles';
import type { AppState } from '../../types';

// ── セットアップ画面（DL / 初期化 / エラー）─────────────────────────
export const SetupScreen = ({
  appState,
  statusMessage,
  dlProgress,
  onRetry,
}: {
  appState: AppState;
  statusMessage: string;
  dlProgress: DownloadProgress | null;
  onRetry: () => void;
}) => {
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
        <TouchableOpacity style={styles.backButton} onPress={onRetry}>
          <Text style={styles.backButtonText}>再試行</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};
