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
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../config/firebase';

export default function RegisterScreen({ navigation }) {
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName || !studentId || !email || !password) {
      return Alert.alert('ข้อผิดพลาด', 'กรุณากรอกข้อมูลให้ครบทุกช่อง');
    }
    if (password.length < 6) {
      return Alert.alert('ข้อผิดพลาด', 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
    }

    setLoading(true);
    try {
      // สมัครสมาชิกด้วย Email & Password
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      // เก็บชื่อไว้ใน displayName
      await updateProfile(cred.user, { displayName: fullName });

      // ถ้าต้องการเก็บ StudentID ลง Firestore ด้วย ให้เพิ่มโค้ดนี้
      // import { doc, setDoc } from 'firebase/firestore';
      // import { db } from '../config/firebase';
      // await setDoc(doc(db, 'users', cred.user.uid), { fullName, studentId, email });

      // ไม่ต้อง navigate เอง เพราะ onAuthStateChanged ใน App.js จะพาไป Dashboard ให้อัตโนมัติ
    } catch (error) {
      Alert.alert('สมัครสมาชิกไม่สำเร็จ', error.message);
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
          
          {/* ปุ่มย้อนกลับ */}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color="#A47551" />
            <Text style={styles.backText}>Back to Login</Text>
          </TouchableOpacity>

          {/* โลโก้ */}
          <View style={styles.logoBox}>
            <Image source={require('../assets/logo.png')} style={styles.logo} />
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
      // Update email ทันทีตาม Student ID ที่กำลังพิมพ์
      setEmail(text.toLowerCase() + '@g.sut.ac.th'); 
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
              placeholder="••••••••••"
              placeholderTextColor="#D3C1B0"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Feather name={showPassword ? 'eye' : 'eye-off'} size={22} color="#B08968" />
            </TouchableOpacity>
          </View>

          {/* ปุ่มสมัคร */}
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
  backBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 10 },
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