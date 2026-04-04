import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../config/firebase';

const COLORS = {
  background: '#F5EDD6',
  card:       '#FBF5E6',
  primary:    '#C8865A',
  border:     '#D9CAAA',
  text:       '#4A3728',
  placeholder:'#B5A48A',
  label:      '#6B4F3A',
  overlay:    'rgba(74, 55, 40, 0.5)',
  modalBg:    '#FFFFFF',
};

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const handleSend = async () => {
    if (!email) {
      Alert.alert('กรุณากรอกอีเมล');
      return;
    }
    if (!email.endsWith('@g.sut.ac.th')) {
      Alert.alert('กรุณาใช้อีเมลมหาวิทยาลัย (@g.sut.ac.th)');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setModalVisible(true);   // แสดง "Email Sent" popup
    } catch (error) {
      let msg = 'เกิดข้อผิดพลาด กรุณาลองใหม่';
      if (error.code === 'auth/user-not-found') msg = 'ไม่พบอีเมลนี้ในระบบ';
      Alert.alert('ไม่สำเร็จ', msg);
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
      <Text style={styles.title}>Find your Account</Text>
      <Text style={styles.subtitle}>Enter your University email address.</Text>
      <TouchableOpacity onPress={() => navigation.navigate('ResetPassword')}>
        <Text style={styles.link}>Can reset your password?</Text>
      </TouchableOpacity>

      {/* Email Input */}
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

      {/* Send Button */}
      <TouchableOpacity
        style={[styles.btn, loading && { opacity: 0.7 }]}
        onPress={handleSend}
        disabled={loading}
      >
        <Text style={styles.btnText}>{loading ? 'Sending...' : 'Send'}</Text>
      </TouchableOpacity>

      {/* ============ Email Sent Modal ============ */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            {/* Close Button */}
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => {
                setModalVisible(false);
                navigation.navigate('Login');
              }}
            >
              <Ionicons name="close" size={18} color={COLORS.text} />
            </TouchableOpacity>

            {/* Modal Content */}
            <Text style={styles.modalTitle}>Email Sent</Text>
            <Text style={styles.modalBody}>
              We sent an email to{' '}
              <Text style={styles.modalEmail}>{email}</Text>
              {' '}with a link to get back into your account.
            </Text>
          </View>
        </View>
      </Modal>
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
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.label,
    marginBottom: 2,
  },
  link: {
    fontSize: 13,
    color: COLORS.primary,
    textDecorationLine: 'underline',
    marginBottom: 28,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
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
    marginBottom: 24,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },

  /* Modal */
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modal: {
    width: '100%',
    backgroundColor: COLORS.modalBg,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
    marginRight: 24,
  },
  modalBody: {
    fontSize: 13,
    color: COLORS.label,
    lineHeight: 20,
  },
  modalEmail: {
    fontWeight: '600',
    color: COLORS.text,
  },
});
