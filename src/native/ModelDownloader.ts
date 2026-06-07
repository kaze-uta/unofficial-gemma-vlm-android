import * as FileSystem from 'expo-file-system/legacy';

// Gemma 4 QAT モバイル量子化版（約2.5GB, 2/4/8bit 混在）。LiteRT-LM 専用 .litertlm 形式。
// litert-community は Apache 2.0・ダウンロード制限なしで公開。通常はトークン不要だが、
// ネットワーク等で失敗する場合は HF トークンを付与するか、手動DL→adb push でも可
//（MODEL_FILE_NAME の場所へ配置）。
export const MODEL_URL =
  'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm';

export const MODEL_FILE_NAME = 'gemma-4-E2B-it.litertlm';

/** アプリ専用領域内のモデル保存先パス（全ファイルアクセス権限不要） */
export const MODEL_PATH = FileSystem.documentDirectory + MODEL_FILE_NAME;

export interface DownloadProgress {
  /** 0〜1 */
  progress: number;
  totalBytes: number;
  writtenBytes: number;
}

/** モデルが既にダウンロード済みか（サイズが妥当か）を確認 */
export async function isModelDownloaded(): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(MODEL_PATH);
  // 途中で失敗した壊れたファイルを弾くため、最低 500MB を閾値にする
  return info.exists && !info.isDirectory && (info.size ?? 0) > 500 * 1024 * 1024;
}

/** モデルを進捗付きでダウンロード（再開対応）。完了でローカルパスを返す */
export async function downloadModel(
  onProgress: (p: DownloadProgress) => void,
  hfToken?: string,
): Promise<string> {
  if (await isModelDownloaded()) {
    return MODEL_PATH;
  }

  const headers = hfToken ? { Authorization: `Bearer ${hfToken}` } : undefined;

  const downloadResumable = FileSystem.createDownloadResumable(
    MODEL_URL,
    MODEL_PATH,
    { headers },
    (data) => {
      const total = data.totalBytesExpectedToWrite;
      const written = data.totalBytesWritten;
      onProgress({
        progress: total > 0 ? written / total : 0,
        totalBytes: total,
        writtenBytes: written,
      });
    },
  );

  const result = await downloadResumable.downloadAsync();
  if (!result?.uri) {
    throw new Error('モデルのダウンロードに失敗しました');
  }
  return MODEL_PATH;
}

/** モデルファイルを削除（再DL用） */
export async function deleteModel(): Promise<void> {
  const info = await FileSystem.getInfoAsync(MODEL_PATH);
  if (info.exists) {
    await FileSystem.deleteAsync(MODEL_PATH, { idempotent: true });
  }
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
