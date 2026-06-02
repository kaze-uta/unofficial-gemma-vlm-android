import { NativeModules } from 'react-native';

const { GemmaModule } = NativeModules;

interface GemmaModuleType {
  isExternalStorageManager(): Promise<boolean>;
  openStorageSettings(): Promise<boolean>;
  initializeModel(modelPath: string): Promise<boolean>;
  generateResponse(prompt: string): Promise<string>;
  generateResponseWithImage(prompt: string, imagePath: string): Promise<string>;
}

if (!GemmaModule) {
  console.error('[GemmaModule] ネイティブモジュールが見つかりません。再ビルドしてください。');
}

export default GemmaModule as GemmaModuleType;
