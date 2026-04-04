import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { confirmPasswordReset } from 'firebase/auth';
import { auth } from '../config/firebase';

const COLORS = {
  background: '#F5EDD6',
  card:       '#FBF5E6',
  primary:    '#C8865A',
  border:     '#D9CAAA',
  text:       '#4A3728',
  placeholder:'#B5A48A',
  label:      '#6B4F3A',
  underline:  '#8B7355',
};

export default function ResetPasswordScreen({ navigation, route }) {
  // oobCode มาจาก Deep Link ที่ Firebase ส่งให้ทาง Email
  const oobCode = route?.params?.oobCode ?? '';

  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);

  const handleConfirm = async () => {
    if (!password || password.length < 6) {
      Alert.alert('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    setLoading(true);
    try {
      if (oobCode) {
        // กรณีมาจาก Email Link ของ Firebase
        await confirmPasswordReset(auth, oobCode, password);
      }
      Alert.alert('เปลี่ยนรหัสผ่านสำเร็จ!', 'กรุณา Login ด้วยรหัสใหม่', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (error) {
      Alert.alert('ไม่สำเร็จ', 'Link หมดอายุหรือไม่ถูกต้อง กรุณาขอ Reset ใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Back Button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back" size={16} color={COLORS.label} />
        <Text style={styles.backText}>Back to Login</Text>
      </TouchableOpacity>

      {/* Header */}
      <Text style={styles.title}>Reset Password</Text>
      {/* เส้นใต้ชื่อ (สไตล์จาก Figma) */}
      <View style={styles.titleUnderline} />
      <Text style={styles.subtitle}>Enter your email address to reset your password.</Text>

      {/* Email */}
      <Text style={styles.label}>University Email</Text>
      <View style={styles.inputRow}>
        <Ionicons name="mail-outline" size={16} color={COLORS.placeholder} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="B6XXXXXX@g.sut.ac.th"
          placeholderTextColor={COLORS.placeholder}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      {/* New Password */}
      <Text style={styles.label}>Password</Text>
      <View style={styles.inputRow}>
        <Ionicons name="lock-closed-outline" size={16} color={COLORS.placeholder} style={styles.inputIcon} />
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="••••••••••"
          placeholderTextColor={COLORS.placeholder}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
          <Ionicons
            name={showPassword ? 'eye-outline' : 'eye-off-outline'}
            size={18}
            color={COLORS.placeholder}
          />
        </TouchableOpacity>
      </View>

      {/* Confirm Button */}
      <TouchableOpacity
        style={[styles.btn, loading && { opacity: 0.7 }]}
        onPress={handleConfirm}
        disabled={loading}
      >
        <Text style={styles.btnText}>{loading ? 'Confirming...' : 'Confirm'}</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 28,
    paddingTop: 56,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  backText: {
    fontSize: 13,
    color: COLORS.label,
    marginLeft: 2,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  titleUnderline: {
    height: 2,
    width: 160,
    backgroundColor: COLORS.underline,
    borderRadius: 2,
    marginBottom: 10,
    opacity: 0.4,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.label,
    marginBottom: 28,
    lineHeight: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
    marginTop: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    height: 46,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },
  eyeBtn: {
    padding: 4,
  },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
  btnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
