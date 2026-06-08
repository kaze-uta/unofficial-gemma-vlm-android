// ── アプリ全体で共有する型 ──────────────────────────────────────────
export type AppState = 'checking' | 'downloading' | 'initializing' | 'ready' | 'error';
export type Mode = null | 'chat' | 'image' | 'audio';

export interface ChatMessage {
  role: 'user' | 'model' | 'tool';
  text: string;
}
