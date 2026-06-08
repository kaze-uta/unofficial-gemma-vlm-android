import React from 'react';
import { View, TextInput, TouchableOpacity, Text } from 'react-native';
import { styles } from '../theme/styles';

export const InputBar = ({
  value,
  onChange,
  onSend,
  isProcessing,
  placeholder,
}: {
  value: string;
  onChange: (t: string) => void;
  onSend: () => void;
  isProcessing: boolean;
  placeholder: string;
}) => (
  <View style={styles.inputBar}>
    <TextInput
      style={styles.inputBarField}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#aaa"
      multiline
      editable={!isProcessing}
    />
    <TouchableOpacity
      style={[styles.sendButton, (isProcessing || !value.trim()) && styles.disabledButton]}
      onPress={onSend}
      disabled={isProcessing || !value.trim()}
    >
      <Text style={styles.sendButtonText}>{isProcessing ? '…' : '送信'}</Text>
    </TouchableOpacity>
  </View>
);
