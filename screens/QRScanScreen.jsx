import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

// 🌟 นำเข้า Database tools เพื่อมาบวกคะแนน
import { auth, db } from '../config/firebase';
import { doc, getDoc, collection, serverTimestamp, writeBatch, increment } from 'firebase/firestore';

const { width } = Dimensions.get('window');
const SCAN_BOX_SIZE = width * 0.75;

export default function QRScanScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [scanData, setScanData] = useState('');

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>กำลังขอสิทธิ์กล้อง...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>ต้องการสิทธิ์เข้าถึงกล้อง</Text>
        <TouchableOpacity style={styles.backButton} onPress={requestPermission}>
          <Text style={styles.backButtonText}>อนุญาตใช้กล้อง</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.backButton, { marginTop: 10, backgroundColor: '#999' }]} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>กลับหน้าหลัก</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 🌟 ฟังก์ชันจัดการเมื่อสแกน QR เจอ
  const handleBarCodeScanned = async ({ type, data }) => {
    if (scanned || processing) return;
    setScanned(true);
    setProcessing(true); // เริ่มขึ้นสถานะกำลังประมวลผล

    try {
      // 1. ค้นหาข้อมูลดีลจาก QR Code ที่สแกนมา (data = dealId)
      const dealRef = doc(db, 'deals', data);
      const dealSnap = await getDoc(dealRef);

      if (!dealSnap.exists()) {
        Alert.alert("ข้อผิดพลาด", "ไม่พบข้อมูลดีลนี้ หรือ QR Code ไม่ถูกต้อง", [
          { text: "สแกนใหม่", onPress: () => { setScanned(false); setProcessing(false); } }
        ]);
        return;
      }

      const dealData = dealSnap.data();

      // 2. เช็คก่อนว่าดีลนี้เคยรับของไปแล้วหรือยัง
      if (dealData.status === 'completed') {
        Alert.alert("แจ้งเตือน", "ดีลนี้ทำรายการเสร็จสิ้นไปแล้ว!", [
          { text: "ตกลง", onPress: () => { setScanned(false); setProcessing(false); } }
        ]);
        return;
      }

      // 3. เริ่มขั้นตอนอัปเดตข้อมูลแบบมัดรวม (Batch) เพื่อให้ชัวร์ว่าไม่พลาดตรงไหนไป
      const batch = writeBatch(db);

      // 3.1) เปลี่ยนสถานะดีลเป็น Completed
      batch.update(dealRef, {
        status: 'completed',
        updatedAt: serverTimestamp()
      });

      // 3.2) ให้คะแนนคนแจก (Giver) +150 แต้ม
      if (dealData.giverId) {
        const giverRef = doc(db, 'users', dealData.giverId);
        batch.update(giverRef, {
          duckPoints: increment(150),
          lifetimePoints: increment(150)
        });
        
        // บันทึกประวัติ
        const historyGiverRef = doc(collection(db, 'pointHistory'));
        batch.set(historyGiverRef, {
          userId: dealData.giverId,
          title: `Quack done`, 
          points: 150,
          createdAt: serverTimestamp()
        });
      }

      // 3.3) ให้คะแนนคนรับ (Receiver) +10 แต้ม
      if (dealData.receiverId) {
        const receiverRef = doc(db, 'users', dealData.receiverId);
        batch.update(receiverRef, {
          duckPoints: increment(10),
          lifetimePoints: increment(10)
        });

        // บันทึกประวัติ
        const historyReceiverRef = doc(collection(db, 'pointHistory'));
        batch.set(historyReceiverRef, {
          userId: dealData.receiverId,
          title: `Quack done (Received)`,
          points: 10,
          createdAt: serverTimestamp()
        });
      }

      // 4. สั่งรันคำสั่งทั้งหมดเข้า Database!
      await batch.commit();

      // 5. พอทำทุกอย่างเสร็จ ให้เปิด Modal สแกนสำเร็จขึ้นมา!
      setScanData(data);
      setShowSuccessModal(true);

    } catch (error) {
      console.error("Scan Error:", error);
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถอัปเดตข้อมูลได้ กรุณาลองใหม่", [
         { text: "ตกลง", onPress: () => { setScanned(false); setProcessing(false); } }
      ]);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
          <Ionicons name="close" size={32} color="#5A3D2B" />
        </TouchableOpacity>
        <Text style={styles.title}>Scan QR Code</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Camera */}
      <View style={styles.cameraContainer}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        />

        {/* Overlay */}
        <View style={styles.overlay}>
          <View style={styles.scanBox}>
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
          </View>
          
          {processing ? (
            <View style={styles.processingBox}>
               <ActivityIndicator size="small" color="#4CAF50" />
               <Text style={[styles.instructionText, { backgroundColor: 'transparent', marginTop: 10 }]}>
                 กำลังประมวลผลดีล...
               </Text>
            </View>
          ) : (
            <Text style={styles.instructionText}>วาง QR Code ไว้ภายในกรอบ</Text>
          )}
        </View>
      </View>

      <View style={styles.bottomContainer}>
        <Text style={styles.bottomText}>
          {processing ? 'กรุณารอสักครู่...' : 'กำลังสแกน QR Code...'}
        </Text>
      </View>

      {/* ──────────────── Modal: สแกนสำเร็จ! ──────────────── */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            
            <Text style={styles.modalTitle}>🎉 สแกนสำเร็จ!</Text>
            <Text style={styles.modalDataText}>ข้อมูล: {scanData}</Text>
            <Text style={{color: '#4CAF50', fontWeight: 'bold', marginBottom: 20}}>+150 Points ถูกเพิ่มแล้ว!</Text>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity onPress={() => { setShowSuccessModal(false); setScanned(false); }}>
                <Text style={styles.modalLinkBtn}>สแกนใหม่</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {
                setShowSuccessModal(false);
                navigation.navigate('Home'); // กลับหน้าหลัก
              }}>
                <Text style={styles.modalLinkBtn}>กลับหน้าหลัก</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8E7' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#FFF8E7',
  },
  closeButton: { padding: 5 },
  title: { fontSize: 22, fontWeight: '800', color: '#5A3D2B' },
  cameraContainer: { flex: 1, position: 'relative' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanBox: {
    width: SCAN_BOX_SIZE,
    height: SCAN_BOX_SIZE,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderColor: '#4CAF50',
  },
  cornerTopLeft: {
    top: 0, left: 0,
    borderTopWidth: 8, borderLeftWidth: 8,
    borderTopLeftRadius: 16,
  },
  cornerTopRight: {
    top: 0, right: 0,
    borderTopWidth: 8, borderRightWidth: 8,
    borderTopRightRadius: 16,
  },
  cornerBottomLeft: {
    bottom: 0, left: 0,
    borderBottomWidth: 8, borderLeftWidth: 8,
    borderBottomLeftRadius: 16,
  },
  cornerBottomRight: {
    bottom: 0, right: 0,
    borderBottomWidth: 8, borderRightWidth: 8,
    borderBottomRightRadius: 16,
  },
  instructionText: {
    marginTop: 40,
    fontSize: 16,
    color: '#5A3D2B',
    fontWeight: '600',
    backgroundColor: 'rgba(255,248,231,0.9)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  processingBox: {
    marginTop: 40,
    backgroundColor: 'rgba(255,248,231,0.9)',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 20,
    alignItems: 'center'
  },
  bottomContainer: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: '#FFF8E7',
  },
  bottomText: { fontSize: 15, color: '#8B7355', fontWeight: '500' },
  centerContainer: {
    flex: 1,
    backgroundColor: '#FFF8E7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { fontSize: 18, color: '#5A3D2B' },
  errorText: { fontSize: 18, color: 'red', marginBottom: 20 },
  backButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 12,
  },
  backButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: width * 0.8, backgroundColor: '#FFF', borderRadius: 12, padding: 25, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  modalDataText: { fontSize: 16, color: '#555', marginBottom: 10 },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 10 },
  modalLinkBtn: { fontSize: 16, color: '#2874A6', fontWeight: 'bold' },
});