import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { styles } from '../theme/styles';

export const Header = ({ title, onBack, disabled }: { title: string; onBack: () => void; disabled: boolean }) => (
  <View style={styles.header}>
    <TouchableOpacity onPress={onBack} disabled={disabled}>
      <Text style={[styles.backButtonText, disabled && { color: '#aaa' }]}>← 戻る</Text>
    </TouchableOpacity>
    <Text style={styles.headerTitle}>{title}</Text>
    <View style={{ width: 60 }} />
  </View>
);
