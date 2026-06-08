import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  PermissionsAndroid,
  Platform,
  Image,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import * as ImagePicker from 'expo-image-picker';
import GemmaModule from '../../native/GemmaModule';
import { useGemmaStream } from '../../hooks/useGemmaStream';
import { Header } from '../../components/Header';
import { styles } from '../../theme/styles';

// ══ 画像解析 / OCR 画面（カメラ + ギャラリー）═════════════════════════
export const ImageScreen = ({ onBack }: { onBack: () => void }) => {
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const camera = useRef<Camera>(null);
  const { partial, reset } = useGemmaStream();

  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [useGallery, setUseGallery] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (Platform.OS === 'android') {
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
      }
      if (!hasPermission) await requestPermission();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const analyze = async (imagePath: string, question: string) => {
    setIsProcessing(true);
    setResult('');
    reset();
    try {
      const full = await GemmaModule.sendMultimodalMessage(question, imagePath, null);
      setResult(full);
    } catch (e) {
      setResult('エラー: ' + (e instanceof Error ? e.message : '不明なエラー'));
    } finally {
      setIsProcessing(false);
      reset();
    }
  };

  const takePhoto = async () => {
    if (!camera.current || isProcessing) return;
    try {
      const photo = await camera.current.takePhoto({ flash: 'off' });
      const uri = photo.path.startsWith('file://') ? photo.path : 'file://' + photo.path;
      setImageUri(uri);
      await analyze(photo.path, prompt.trim() || 'この画像を説明してください。');
    } catch (e) {
      setResult('エラー: ' + (e instanceof Error ? e.message : '不明なエラー'));
    }
  };

  const pickFromGallery = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 1,
    });
    if (!res.canceled && res.assets[0]) {
      setImageUri(res.assets[0].uri);
      await analyze(res.assets[0].uri, prompt.trim() || 'この画像を説明してください。');
    }
  };

  const displayed = isProcessing ? partial : result;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header title="画像解析 / OCR" onBack={onBack} disabled={isProcessing} />

        {/* ソース切替 */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, !useGallery && styles.tabActive]}
            onPress={() => setUseGallery(false)}
            disabled={isProcessing}
          >
            <Text style={[styles.tabText, !useGallery && styles.tabTextActive]}>カメラ</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, useGallery && styles.tabActive]}
            onPress={() => setUseGallery(true)}
            disabled={isProcessing}
          >
            <Text style={[styles.tabText, useGallery && styles.tabTextActive]}>ギャラリー</Text>
          </TouchableOpacity>
        </View>

        {!useGallery && device != null && (
          <View style={styles.cameraContainer}>
            <Camera
              ref={camera}
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={!isProcessing}
              photo={true}
            />
          </View>
        )}

        <View style={styles.resultContainer}>
          <ScrollView style={styles.scrollArea}>
            {imageUri && (
              <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
            )}
            <Text style={styles.resultHeader}>解析結果：</Text>
            <Text style={styles.resultText}>
              {displayed || (isProcessing ? '解析中...' : '画像を撮影／選択してください')}
            </Text>
          </ScrollView>
        </View>

        <View style={styles.promptContainer}>
          <Text style={styles.promptLabel}>質問・指示（任意 / OCR は「文字を抽出して」）</Text>
          <View style={styles.quickRow}>
            <TouchableOpacity style={styles.chip} onPress={() => setPrompt('この画像内の文字をすべて正確に書き出して')}>
              <Text style={styles.chipText}>OCR 文字抽出</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.chip} onPress={() => setPrompt('この画像に写っているものを詳しく説明して')}>
              <Text style={styles.chipText}>詳しく説明</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.promptInput}
            value={prompt}
            onChangeText={setPrompt}
            placeholder="例：この画像に写っているものを説明して"
            placeholderTextColor="#aaa"
            multiline
            editable={!isProcessing}
          />
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.actionButton, isProcessing && styles.disabledButton]}
            onPress={useGallery ? pickFromGallery : takePhoto}
            disabled={isProcessing}
          >
            <Text style={styles.buttonText}>
              {isProcessing ? '解析中...' : useGallery ? '画像を選んで解析' : '撮影して解析'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
