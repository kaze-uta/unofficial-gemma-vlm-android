import { NativeModules, NativeEventEmitter } from 'react-native';

const { GemmaModule } = NativeModules;

interface GemmaModuleType {
  /** .litertlm モデルを読み込み LiteRT-LM エンジンを初期化（GPU→CPU フォールバック） */
  initializeModel(modelPath: string): Promise<boolean>;
  /** システムプロンプト付きでマルチターン会話を開始 */
  startConversation(systemPrompt: string): Promise<boolean>;
  /** function calling（組込みツール）有効な会話を開始 */
  startConversationWithTools(systemPrompt: string): Promise<boolean>;
  /** 会話履歴をリセット */
  resetConversation(): Promise<boolean>;
  /** テキスト送信（ストリーミング。完了時に全文を resolve） */
  sendMessage(text: string): Promise<string>;
  /** 画像／音声＋テキストのマルチモーダル送信（ストリーミング） */
  sendMultimodalMessage(
    text: string,
    imagePath: string | null,
    audioPath: string | null,
  ): Promise<string>;
  /** 生成中断 */
  stopGeneration(): Promise<boolean>;
  // NativeEventEmitter 用スタブ
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

if (!GemmaModule) {
  console.error('[GemmaModule] ネイティブモジュールが見つかりません。再ビルドしてください。');
}

/** ストリーミング応答イベント */
export const gemmaEvents = GemmaModule
  ? new NativeEventEmitter(GemmaModule)
  : null;

export type GemmaEvent = 'onToken' | 'onComplete' | 'onError' | 'onToolCall';

export default GemmaModule as GemmaModuleType;
