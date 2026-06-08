import { StyleSheet, Platform } from 'react-native';

export const styles = StyleSheet.create({
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
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#1C1C1E', padding: 8, paddingBottom: 60 },
  inputBarField: { flex: 1, backgroundColor: '#2C2C2E', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#fff', maxHeight: 100 },
  sendButton: { marginLeft: 8, backgroundColor: '#007AFF', borderRadius: 18, paddingHorizontal: 18, paddingVertical: 11 },
  sendButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});
