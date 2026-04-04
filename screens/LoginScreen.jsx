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
} from 'react-native';
import { Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

export default function LoginScreen({ navigation }) {
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = () => {
    // ใส่ API Login ของคุณตรงนี้
    console.log('Login:', { studentId, password });
    // navigation.navigate('Home');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        {/* โลโก้ */}
        <View style={styles.logoBox}>
          <Image
            source={require('../assets/logo.png')} // <-- เปลี่ยนเป็น path โลโก้ของคุณ
            style={styles.logo}
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
            onChangeText={setStudentId}
            autoCapitalize="characters"
          />
        </View>

        {/* Password */}
        <View style={styles.passwordRow}>
          <Text style={styles.label}>Password</Text>
          <TouchableOpacity onPress={() => navigation?.navigate('ForgotPassword')}>
            <Text style={styles.link}>Forget Password?</Text>
          </TouchableOpacity>
        </View>
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

        {/* ปุ่ม Sign In */}
        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>Sign In →</Text>
        </TouchableOpacity>

        {/* Register */}
        <View style={styles.registerBox}>
          <Text style={styles.registerText}>Don’t have an account? </Text>
          <TouchableOpacity onPress={() => navigation?.navigate('Register')}>
            <Text style={styles.registerLink}>Register Now</Text>
          </TouchableOpacity>
        </View>

        {/* SSO */}
        <View style={styles.ssoBox}>
          <Ionicons name="help-circle-outline" size={18} color="#A47551" />
          <Text style={styles.ssoText}>Protected by University SSO Verification</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8E7', // สีพื้นหลังครีมอ่อน
  },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  logoBox: {
    width: 190,
    height: 190,
    backgroundColor: '#FFE8B8',
    borderRadius: 30,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 50,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  logo: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
  },
  label: {
    fontSize: 18,
    fontWeight: '700',
    color: '#5A3D2B',
    marginBottom: 8,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#C49A79',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 56,
    marginBottom: 20,
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: '#5A3D2B',
  },
  passwordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  link: {
    color: '#6FBF73',
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  button: {
    backgroundColor: '#D9A77C',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 40,
    width: '85%',
    alignSelf: 'center',
  },
  buttonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4A3327',
  },
  registerBox: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 35,
  },
  registerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5A3D2B',
  },
  registerLink: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6FBF73',
    textDecorationLine: 'underline',
  },
  ssoBox: {
    flexDirection: 'row',
    backgroundColor: '#EADDC4',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 25,
    alignSelf: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  ssoText: {
    marginLeft: 6,
    color: '#A47551',
    fontSize: 13,
    fontWeight: '500',
  },
});