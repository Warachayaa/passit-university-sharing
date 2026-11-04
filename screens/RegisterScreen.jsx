import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';

import { Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

import { createUserWithEmailAndPassword, updateProfile, deleteUser } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import { auth, db } from '../config/firebase';

export default function RegisterScreen({ navigation }) {
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState(''); // จะ auto-fill
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    const normalizedFullName = fullName.trim();
    const normalizedStudentId = studentId.trim().toUpperCase();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password;

    if (!normalizedFullName || !normalizedStudentId || !normalizedEmail || !normalizedPassword) {
      return Alert.alert('ข้อผิดพลาด', 'กรุณากรอกข้อมูลให้ครบทุกช่อง');
    }
    if (normalizedPassword.length < 6) {
      return Alert.alert('ข้อผิดพลาด', 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
    }
    if (!normalizedEmail.includes('@')) {
      return Alert.alert('ข้อผิดพลาด', 'Email ไม่ถูกต้อง');
    }

    setLoading(true);
    try {
      // 1) Create Auth user
      const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, normalizedPassword);

      // 2) update displayName (Auth)
      await updateProfile(cred.user, { displayName: normalizedFullName });

      // 3) Create Firestore profile (CRITICAL)
      const uid = cred.user.uid;

      await setDoc(doc(db, 'users', uid), {
        uid,
        fullName: normalizedFullName,
        studentId: normalizedStudentId,
        email: normalizedEmail,

        level: 1,
        rank: 'TINYDUCK',

        duckPoints: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 4) Create daily sign-in doc
      await setDoc(doc(db, 'dailySignIn', uid), {
        uid,
        claimedDays: [],
        totalPoints: 0,
        lastClaimDate: null,
        lastResetDate: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // ถ้าทุกอย่างสำเร็จ App.js จะพาไป Home อัตโนมัติ
      Alert.alert('สำเร็จ', 'สมัครสมาชิกสำเร็จแล้ว ✅');

    } catch (error) {
      console.error('Register error:', error);

      // Rollback เพื่อกัน Ghost users:
      // ถ้าสร้าง Auth แล้วแต่ Firestore ล้มเหลว ให้ลบ Auth ทิ้ง
      try {
        if (auth.currentUser) {
          await deleteUser(auth.currentUser);
        }
      } catch (e) {
        console.warn('Rollback deleteUser failed:', e);
      }

      Alert.alert('สมัครสมาชิกไม่สำเร็จ', error.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
          {/* Back */}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color="#A47551" />
            <Text style={styles.backText}>Back to Login</Text>
          </TouchableOpacity>

          {/* Logo */}
          <View style={styles.logoBox}>
            <Image source={require('../assets/images/logo.png')} style={styles.logo} />
          </View>

          {/* Full Name */}
          <Text style={styles.label}>Full Name</Text>
          <View style={styles.inputBox}>
            <Feather name="user" size={22} color="#B08968" />
            <TextInput
              style={styles.input}
              placeholder="Enter your name"
              placeholderTextColor="#D3C1B0"
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          {/* Student ID */}
          <Text style={styles.label}>Student ID</Text>
          <View style={styles.inputBox}>
            <MaterialCommunityIcons name="card-account-details-outline" size={24} color="#B08968" />
            <TextInput
              style={styles.input}
              placeholder="B6XXXXXXX"
              placeholderTextColor="#D3C1B0"
              value={studentId}
              onChangeText={(text) => {
                setStudentId(text);
                // auto-fill email ตาม studentId
                const t = text.trim();
                if (!t) setEmail('');
                else setEmail(`${t.toLowerCase()}@g.sut.ac.th`);
              }}
              autoCapitalize="characters"
            />
          </View>

          {/* University Email */}
          <Text style={styles.label}>University Email</Text>
          <View style={styles.inputBox}>
            <Feather name="mail" size={22} color="#B08968" />
            <TextInput
              style={styles.input}
              placeholder="B6XXXXXXX@g.sut.ac.th"
              placeholderTextColor="#D3C1B0"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Password */}
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputBox}>
            <Feather name="lock" size={22} color="#B08968" />
            <TextInput
              style={styles.input}
              /*placeholder="••••••••••"*/
              placeholderTextColor="#D3C1B0"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword((s) => !s)}>
              <Feather name={showPassword ? 'eye' : 'eye-off'} size={22} color="#B08968" />
            </TouchableOpacity>
          </View>

          {/* Submit */}
          <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#4A3327" />
            ) : (
              <Text style={styles.buttonText}>Create Account →</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8E7' },
  inner: { flexGrow: 1, paddingHorizontal: 28, paddingBottom: 30 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 30, marginBottom: 10 },
  backText: { marginLeft: 4, color: '#A47551', fontSize: 16, fontWeight: '600' },

  logoBox: {
    width: 170,
    height: 170,
    backgroundColor: '#FFE8B8',
    borderRadius: 30,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 25,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  logo: { width: 140, height: 140, resizeMode: 'contain' },

  label: { fontSize: 18, fontWeight: '700', color: '#5A3D2B', marginBottom: 8 },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#C49A79',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 56,
    marginBottom: 18,
  },
  input: { flex: 1, marginLeft: 10, fontSize: 16, color: '#5A3D2B' },

  button: {
    backgroundColor: '#D9A77C',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 30,
    width: '85%',
    alignSelf: 'center',
  },
  buttonText: { fontSize: 20, fontWeight: '700', color: '#4A3327' },
});