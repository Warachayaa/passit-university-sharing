// screens/LoginScreen.js
import React, { useState } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

import { useNavigation } from '@react-navigation/native';

export default function LoginScreen() {
  const navigation = useNavigation();

  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!studentId.trim() || !password) {
      return Alert.alert('Error', 'Please fill in Student ID and Password');
    }

    setLoading(true);
    try {
      const email = studentId.includes('@')
        ? studentId.trim().toLowerCase()
        : `${studentId.trim().toLowerCase()}@g.sut.ac.th`;

      // 1) Login Auth
      const cred = await signInWithEmailAndPassword(auth, email, password);

      // 2) Verify Firestore profile exists (กัน ghost)
      const uid = cred.user.uid;
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (!userDoc.exists()) {
        Alert.alert('ต้องลงทะเบียนก่อน', 'โปรไฟล์ในระบบไม่พบ กรุณากด Register ใหม่');
        // ทำให้ App.js จะกลับไปหน้า Login เพราะ user ถูก auth แล้ว
        // แต่เพื่อ UX ให้พาไป Profile ตั้งค่าก็ได้
        navigation.navigate('Register');
        return;
      }

      // App.js จะ onAuthStateChanged แล้วพาไป Home อัตโนมัติ
    } catch (error) {
      console.log('Login error:', error.code, error.message);

      let msg = error.message;
      if (error.code === 'auth/user-not-found') msg = 'ไม่พบบัญชีนี้';
      if (error.code === 'auth/wrong-password') msg = 'รหัสผ่านไม่ถูกต้อง';
      if (error.code === 'auth/invalid-credential') msg = 'Email หรือรหัสผ่านไม่ถูกต้อง';

      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inner}>
        <View style={styles.logoBox}>
          <Image source={require('../assets/images/logo.png')} style={styles.logo} />
        </View>

        <Text style={styles.label}>Student ID</Text>
        <View style={styles.inputBox}>
          <MaterialCommunityIcons name="card-account-details-outline" size={24} color="#B08968" />
          <TextInput
            style={styles.input}
            placeholder="B6XXXXXXX"
            placeholderTextColor="#D3C1B0"
            value={studentId}
            onChangeText={setStudentId}
            autoCapitalize="none"
            editable={!loading}
          />
        </View>

        <View style={styles.passwordRow}>
          <Text style={styles.label}>Password</Text>
          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={styles.link}>Forget Password?</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputBox}>
          <Feather name="lock" size={22} color="#B08968" />
          <TextInput
            style={styles.input}
            //placeholder="••••••••••"//
            placeholderTextColor="#D3C1B0"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            editable={!loading}
          />
          <TouchableOpacity onPress={() => setShowPassword((s) => !s)} disabled={loading}>
            <Feather name={showPassword ? 'eye' : 'eye-off'} size={22} color="#B08968" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.button, loading && { opacity: 0.6 }]} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#4A3327" />
          ) : (
            <Text style={styles.buttonText}>Sign In →</Text>
          )}
        </TouchableOpacity>

        <View style={styles.registerBox}>
          <Text style={styles.registerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.registerLink}>Register Now</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.ssoBox}>
          <Ionicons name="help-circle-outline" size={18} color="#A47551" />
          <Text style={styles.ssoText}>Protected by University SSO Verification</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8E7' },
  inner: { flex: 1, paddingHorizontal: 28, justifyContent: 'center' },
  logoBox: {
    width: 190, height: 190, backgroundColor: '#FFE8B8', borderRadius: 30,
    alignSelf: 'center', justifyContent: 'center', alignItems: 'center',
    marginBottom: 50, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  logo: { width: 150, height: 150, resizeMode: 'contain' },
  label: { fontSize: 18, fontWeight: '700', color: '#5A3D2B', marginBottom: 8 },
  inputBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#C49A79', borderRadius: 14,
    paddingHorizontal: 14, height: 56, marginBottom: 20,
  },
  input: { flex: 1, marginLeft: 10, fontSize: 16, color: '#5A3D2B' },
  passwordRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  link: { color: '#6FBF73', fontSize: 16, fontWeight: '600', textDecorationLine: 'underline' },
  button: { backgroundColor: '#D9A77C', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 40, width: '85%', alignSelf: 'center' },
  buttonText: { fontSize: 20, fontWeight: '700', color: '#4A3327' },
  registerBox: { flexDirection: 'row', justifyContent: 'center', marginTop: 35 },
  registerText: { fontSize: 16, fontWeight: '600', color: '#5A3D2B' },
  registerLink: { fontSize: 16, fontWeight: '700', color: '#6FBF73', textDecorationLine: 'underline' },
  ssoBox: { flexDirection: 'row', backgroundColor: '#EADDC4', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 25, alignSelf: 'center', alignItems: 'center', marginTop: 40 },
  ssoText: { marginLeft: 6, color: '#A47551', fontSize: 13, fontWeight: '500' },
});