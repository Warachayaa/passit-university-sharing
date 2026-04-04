import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';

export default function DashboardScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.sub}>🎉 Login สำเร็จแล้ว! พร้อมพัฒนาต่อ</Text>
      <TouchableOpacity style={styles.btn} onPress={() => signOut(auth)}>
        <Text style={styles.btnText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#F5EDD6', justifyContent:'center', alignItems:'center', gap:16 },
  title:     { fontSize:24, fontWeight:'700', color:'#4A3728' },
  sub:       { fontSize:14, color:'#6B4F3A' },
  btn:       { backgroundColor:'#C8865A', paddingHorizontal:32, paddingVertical:12, borderRadius:10 },
  btnText:   { color:'#fff', fontWeight:'600' },
});
