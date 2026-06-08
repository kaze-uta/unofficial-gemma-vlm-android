import React, { useEffect, useRef, useState } from 'react';
import {
  Text,
  View,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import GemmaModule, { gemmaEvents } from '../../native/GemmaModule';
import { useGemmaStream } from '../../hooks/useGemmaStream';
import { Header } from '../../components/Header';
import { InputBar } from '../../components/InputBar';
import { styles } from '../../theme/styles';
import type { ChatMessage } from '../../types';

// ══ チャット画面（ストリーミング・マルチターン + ツール統合）═══════════
export const ChatScreen = ({ onBack }: { onBack: () => void }) => {
  const { partial, reset } = useGemmaStream();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // ツール呼び出し（function calling）イベントを会話履歴に差し込む
  useEffect(() => {
    if (!gemmaEvents) return;
    const sub = gemmaEvents.addListener('onToolCall', (e: { name: string; args: string }) => {
      setMessages((m) => [...m, { role: 'tool', text: `[ツール] ${e.name}(${e.args})` }]);
    });
    return () => sub.remove();
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || isProcessing) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text }]);
    setIsProcessing(true);
    reset();
    try {
      const full = await GemmaModule.sendMessage(text);
      setMessages((m) => [...m, { role: 'model', text: full }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'model', text: 'エラー: ' + (e instanceof Error ? e.message : '不明') }]);
    } finally {
      setIsProcessing(false);
      reset();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header title="チャット" onBack={onBack} disabled={false} />

        <ScrollView
          ref={scrollRef}
          style={styles.chatScroll}
          contentContainerStyle={styles.chatContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          <Text style={styles.toolsHint}>
            会話のほか「いま何時？」「3.5 と 12 と 7 を全部掛けて」などで自動的に関数を呼び出します
          </Text>
          {messages.map((m, i) => (
            <View
              key={i}
              style={[
                styles.bubble,
                m.role === 'user' ? styles.bubbleUser : m.role === 'tool' ? styles.bubbleTool : styles.bubbleModel,
              ]}
            >
              <Text
                style={
                  m.role === 'user'
                    ? styles.bubbleUserText
                    : m.role === 'tool'
                    ? styles.bubbleToolText
                    : styles.bubbleModelText
                }
              >
                {m.text}
              </Text>
            </View>
          ))}
          {isProcessing && (
            <View style={[styles.bubble, styles.bubbleModel]}>
              <Text style={styles.bubbleModelText}>{partial || '…'}</Text>
            </View>
          )}
        </ScrollView>

        <InputBar
          value={input}
          onChange={setInput}
          onSend={send}
          isProcessing={isProcessing}
          placeholder="メッセージを入力..."
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
