import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, SafeAreaView,
  Modal, Dimensions, ActivityIndicator, Alert, Linking, Platform
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps'; 
import { auth, db } from '../config/firebase';
import { doc, getDoc, updateDoc, onSnapshot, serverTimestamp, increment, collection, writeBatch, addDoc } from 'firebase/firestore';

const { width } = Dimensions.get('window');

// 🚨 หัวข้อสำหรับการรายงาน
const REPORT_REASONS = [
  "การหลอกลวง ฉ้อโกง หรือของไม่ตรงปก",
  "การเบี้ยวนัด / ไม่มาตามที่ตกลงกันไว้",
  "พฤติกรรมคุกคามหรือใช้คำหยาบคาย",
  "การปั๊มคะแนน (ส่งของปลอม/ไม่มีจริง)",
  "ขายหรือโปรโมทสินค้าที่ผิดกฎหมาย",
  "ฉันแค่ไม่ชอบสิ่งนี้ / อื่นๆ"
];

export default function DuckDealdetailScreen({ navigation, route }) {
  const { dealId, unlockQuackDone } = route.params || {}; 

  const [dealData, setDealData] = useState(null);
  const [partnerData, setPartnerData] = useState(null); 
  const [loading, setLoading] = useState(true);
  const [showDoneModal, setShowDoneModal] = useState(false);
  const [processingDone, setProcessingDone] = useState(false);
  
  const [showReportModal, setShowReportModal] = useState(false);

  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!dealId) return;
    const unsubDeal = onSnapshot(doc(db, 'deals', dealId), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        let dealInfo = { id: docSnap.id, ...data };
        if (data.itemId) {
          try {
            const itemSnap = await getDoc(doc(db, 'items', data.itemId));
            if (itemSnap.exists()) {
              const itemData = itemSnap.data();
              if (itemData.location) dealInfo.location = itemData.location;
            }
          } catch (err) { console.error(err); }
        }
        setDealData(dealInfo);

        if (currentUser && data.participants) {
          const partnerId = data.participants.find(id => id !== currentUser.uid);
          if (partnerId) {
            const partnerSnap = await getDoc(doc(db, 'users', partnerId));
            if (partnerSnap.exists()) setPartnerData({ id: partnerSnap.id, ...partnerSnap.data() });
          }
        }
      }
      setLoading(false);
    });
    return () => unsubDeal();
  }, [dealId, currentUser]);

  const handleOpenChat = () => {
    if (dealData?.chatId) {
      navigation.navigate('Chat', { chatId: dealData.chatId, sellerName: partnerData?.fullName || 'Partner', itemTitle: dealData.itemTitle });
    } else {
      Alert.alert("แจ้งเตือน", "ไม่พบข้อมูลห้องแชท");
    }
  };

  const handleNavigate = () => {
    const { lat, lng, name } = dealData?.location || {};
    if (!lat || !lng) return Alert.alert("ไม่พบตำแหน่ง", "ขออภัย ไม่พบพิกัดสำหรับนำทาง");
    const label = name || "จุดนัดรับสินค้า";
    const url = Platform.select({ ios: `maps:0,0?q=${label}@${lat},${lng}`, android: `geo:0,0?q=${lat},${lng}(${label})` });
    Linking.canOpenURL(url).then(supported => {
      if (supported) Linking.openURL(url);
      else Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
    });
  };

  const handleQuackDone = async () => {
    if (!unlockQuackDone) return Alert.alert("แจ้งเตือน", "กรุณาสแกน QR Code ก่อนกดปุ่มนี้");
    if (processingDone) return;
    setProcessingDone(true);
    try {
      const batch = writeBatch(db);
      const dealRef = doc(db, 'deals', dealId);
      batch.update(dealRef, { status: 'completed', updatedAt: serverTimestamp() });
      if (dealData.giverId) {
        batch.update(doc(db, 'users', dealData.giverId), { duckPoints: increment(150), lifetimePoints: increment(150) });
        batch.set(doc(collection(db, 'pointHistory')), { userId: dealData.giverId, title: `Deal Completed: ${dealData.itemTitle}`, points: 150, createdAt: serverTimestamp() });
      }
      if (dealData.receiverId) {
        batch.update(doc(db, 'users', dealData.receiverId), { duckPoints: increment(10), lifetimePoints: increment(10) });
        batch.set(doc(collection(db, 'pointHistory')), { userId: dealData.receiverId, title: `Received Item: ${dealData.itemTitle}`, points: 10, createdAt: serverTimestamp() });
      }
      await batch.commit();
      setShowDoneModal(true);
    } catch (error) { Alert.alert('Error', 'ไม่สามารถอัปเดตดีลได้'); } finally { setProcessingDone(false); }
  };

  const handleReport = async (reason) => {
    setShowReportModal(false);
    try {
      await addDoc(collection(db, 'reports'), {
        reporterId: currentUser?.uid,
        reportedId: partnerData?.id || 'unknown',
        dealId: dealId,
        reason: reason,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      Alert.alert("ขอบคุณที่รายงาน", "เราได้รับรายงานของคุณเรียบร้อยแล้ว ทีมงานจะดำเนินการตรวจสอบโดยเร็วที่สุด");
    } catch (error) { Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถส่งรายงานได้"); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#D4A373" /></View>;
  if (!dealData) return <View style={styles.center}><Text style={{ color: '#5A3D2B' }}>ไม่พบข้อมูลดีล</Text></View>;

  const isCompleted = dealData.status === 'completed';
  const locationName = dealData.location?.name || 'Unknown Location';
  const subAddress = dealData.location?.address || '';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#5A3D2B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Duck Deal</Text>
        <TouchableOpacity style={styles.moreBtn} onPress={() => setShowReportModal(true)}>
          <Feather name="more-vertical" size={24} color="#8B7355" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.statusBanner, isCompleted ? styles.statusBannerDone : {}]}>
          <Image source={{ uri: 'https://img2.pic.in.th/Complete.png' }} style={styles.bannerDuckIcon} />
          {isCompleted && <View style={styles.checkBadge}><Ionicons name="checkmark" size={12} color="#FFF" /></View>}
          <Text style={[styles.bannerText, isCompleted ? {color: '#2D6A4F'} : {}]}>
            {isCompleted ? 'Quack Completed!' : 'Quack Confirmed'}
          </Text>
        </View>

        <View style={styles.itemCard}>
          <Image source={{ uri: dealData.itemImage || 'https://via.placeholder.com/150' }} style={styles.itemImage} />
          <View style={styles.itemInfo}>
            <Text style={styles.itemTitle} numberOfLines={1}>{dealData.itemTitle}</Text>
            <Text style={styles.itemCategory}>{dealData.itemCategory || 'Other'}</Text>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Status: </Text>
              <View style={[styles.badgeContainer, isCompleted ? {backgroundColor: '#E8F5E9'} : {backgroundColor: '#D6EAF8'}]}>
                <Text style={[styles.badgeText, isCompleted ? {color: '#2D6A4F'} : {color: '#2874A6'}]}>
                  {isCompleted ? 'Quack Done' : 'Duck Active'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.profileRow}>
          <View style={styles.profileLeft}>
            <Image source={{ uri: partnerData?.photoURL || 'https://cdn-icons-png.flaticon.com/512/188/188333.png' }} style={styles.avatar} />
            <Text style={styles.username}>{partnerData?.fullName || partnerData?.username || 'Unknown User'}</Text>
          </View>
          <TouchableOpacity style={styles.messageBtn} onPress={handleOpenChat}>
            <Text style={styles.messageText}>Message</Text>
            <Ionicons name="chatbubble-outline" size={16} color="#6B8E6B" style={{marginLeft: 4}} />
          </TouchableOpacity>
        </View>

        <View style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <View style={styles.locationIconCircle}><Ionicons name="location" size={20} color="#6FBF73" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.locationLabelText}>Location</Text>
              <Text style={styles.locationNameText}>{locationName}</Text>
              {subAddress !== '' && <Text style={styles.locationSubText}>{subAddress}</Text>}
            </View>
          </View>
          <View style={styles.mapContainer}>
            {dealData.location?.lat && dealData.location?.lng ? (
              <MapView style={styles.mapView} initialRegion={{ latitude: dealData.location.lat, longitude: dealData.location.lng, latitudeDelta: 0.005, longitudeDelta: 0.005 }} scrollEnabled={false}>
                <Marker coordinate={{ latitude: dealData.location.lat, longitude: dealData.location.lng }}><Ionicons name="location" size={32} color="#E74C3C" /></Marker>
              </MapView>
            ) : (<View style={[styles.mapView, { backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' }]}><Text style={{ color: '#8B7355' }}>ไม่พบพิกัด GPS</Text></View>)}
            <TouchableOpacity style={styles.navigateFab} onPress={handleNavigate}><MaterialCommunityIcons name="navigation-variant" size={22} color="#FFF" /></TouchableOpacity>
          </View>
        </View>

        {!isCompleted && (
          <View style={styles.qrContainer}>
            <View style={styles.qrBox}><Image source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${dealData.id}` }} style={styles.qrImage} /></View>
            <Text style={styles.qrInstruction}>Show this to the duck{"\n"}to complete the deal</Text>
          </View>
        )}

        {!isCompleted && (
          <TouchableOpacity style={[styles.doneBtn, !unlockQuackDone && { backgroundColor: '#E0CDB5' }]} onPress={handleQuackDone} disabled={processingDone}>
            {processingDone ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.doneBtnText, !unlockQuackDone && { color: '#8B7355' }]}>{unlockQuackDone ? 'Quack Done!' : 'Scan QR to Unlock'}</Text>}
          </TouchableOpacity>
        )}

        {isCompleted && (
           <TouchableOpacity style={styles.viewButtonStyle} onPress={() => navigation.goBack()}>
             <Text style={styles.viewButtonText}>View Status</Text>
           </TouchableOpacity>
        )}
      </ScrollView>

      {/* Modal แจ้งจบดีล */}
      <Modal visible={showDoneModal} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.modalContainer}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => { setShowDoneModal(false); navigation.navigate('DuckDeals'); }}><Ionicons name="close" size={24} color="#A47551" /></TouchableOpacity>
            <Image source={{ uri: 'https://img2.pic.in.th/Complete.png' }} style={styles.modalDuckIcon} />
            <Text style={styles.modalTitle}>Done!</Text>
            <Text style={{ color: '#8B7355', marginTop: 10, textAlign: 'center' }}>คะแนนถูกเพิ่มเข้าบัญชีแล้ว 🎉</Text>
          </View>
        </View>
      </Modal>

      {/* 🌟 Modal สำหรับหน้ารายงาน */}
      <Modal visible={showReportModal} transparent animationType="slide">
        <View style={styles.reportOverlay}>
          <View style={styles.reportSheet}>
            <View style={styles.reportHeader}>
              <TouchableOpacity onPress={() => setShowReportModal(false)} style={styles.closeReportBtn}>
                <Feather name="x" size={24} color="#111" />
              </TouchableOpacity>
              <Text style={styles.reportTitle}>รายงาน</Text>
              <View style={{ width: 24 }} />
            </View>
            <Text style={styles.reportSubtitle}>ทำไมคุณจึงรายงานดีลนี้</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {REPORT_REASONS.map((reason, index) => (
                <TouchableOpacity key={index} style={styles.reportItem} onPress={() => handleReport(reason)}>
                  <Text style={styles.reportItemText}>{reason}</Text>
                  <Feather name="chevron-right" size={20} color="#CCC" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8E7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF8E7' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 60 },
  
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingHorizontal: 20, paddingBottom: 15 },
  backBtn: { padding: 4, marginLeft: -4 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#5A3D2B' },
  moreBtn: { padding: 4, marginRight: -4 },

  statusBanner: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 2, borderColor: '#6B8E6B', borderStyle: 'dashed', marginBottom: 20, position: 'relative' },
  statusBannerDone: { borderColor: '#82B282', backgroundColor: '#F0F9F0' },
  bannerDuckIcon: { width: 80, height: 80, resizeMode: 'contain', marginBottom: 8 },
  checkBadge: { position: 'absolute', top: 55, right: '42%', backgroundColor: '#6B8E6B', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  bannerText: { fontSize: 20, fontWeight: '800', color: '#6B8E6B' },

  itemCard: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 16, padding: 12, marginBottom: 15, elevation: 2 },
  itemImage: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#F5F5F5' },
  itemInfo: { flex: 1, marginLeft: 14, justifyContent: 'center' },
  itemTitle: { fontSize: 16, fontWeight: '800', color: '#5A3D2B' },
  itemCategory: { fontSize: 12, color: '#A47551', marginTop: 2, marginBottom: 6 },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusLabel: { fontSize: 12, color: '#8B7355', fontWeight: '600' },
  badgeContainer: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, marginLeft: 4 },
  badgeText: { fontSize: 12, fontWeight: '800' },

  profileRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, padding: 12, marginBottom: 20, elevation: 1 },
  profileLeft: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F5E6D3' },
  username: { marginLeft: 12, fontSize: 16, fontWeight: '700', color: '#5A3D2B' },
  messageBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  messageText: { fontSize: 15, fontWeight: '700', color: '#799351' },

  locationCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 25, elevation: 2 },
  locationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  locationIconCircle: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F0F5E9', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  locationLabelText:  { fontSize: 12, fontWeight: '800', color: '#D9A47F', textTransform: 'uppercase', marginBottom: 2 },
  locationNameText:   { fontSize: 18, fontWeight: '900', color: '#5A3D2B' },
  locationSubText:    { fontSize: 14, color: '#A67B5B', marginTop: 2 },
  mapContainer: { width: '100%', height: 180, borderRadius: 16, overflow: 'hidden', position: 'relative', backgroundColor: '#F5F5F5' },
  mapView: { width: '100%', height: '100%' },
  navigateFab: { position: 'absolute', bottom: 12, right: 12, width: 42, height: 42, borderRadius: 21, backgroundColor: '#A67B5B', justifyContent: 'center', alignItems: 'center', elevation: 4 },

  qrContainer: { alignItems: 'center', marginBottom: 30 },
  qrBox: { width: 160, height: 160, backgroundColor: '#FFF', borderRadius: 16, justifyContent: 'center', alignItems: 'center', padding: 10, elevation: 2, marginBottom: 15 },
  qrImage: { width: '100%', height: '100%', resizeMode: 'contain' },
  qrInstruction: { textAlign: 'center', fontSize: 16, fontWeight: '800', color: '#5A3D2B', marginBottom: 8 },

  doneBtn: { backgroundColor: '#6B8E6B', paddingVertical: 16, borderRadius: 16, alignItems: 'center', elevation: 2 },
  doneBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  viewButtonStyle: { backgroundColor: 'transparent', paddingVertical: 12, borderRadius: 24, borderWidth: 1.5, borderColor: '#D4A373', alignItems: 'center', marginTop: 10 },
  viewButtonText: { color: '#D4A373', fontWeight: '800', fontSize: 15 },

  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: width * 0.75, backgroundColor: '#FFF', borderRadius: 24, padding: 30, alignItems: 'center', position: 'relative', borderWidth: 2, borderColor: '#F5E6D3' },
  modalCloseBtn: { position: 'absolute', top: 12, right: 15 },
  modalDuckIcon: { width: 100, height: 100, resizeMode: 'contain', marginBottom: 15 },
  modalTitle: { fontSize: 24, fontWeight: '800', color: '#5A3D2B' },

  // 🌟 Styles Report Modal
  reportOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  reportSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 20, maxHeight: '85%' },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  closeReportBtn: { padding: 4 },
  reportTitle: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  reportSubtitle: { fontSize: 16, fontWeight: 'bold', color: '#111', paddingHorizontal: 20, paddingVertical: 16 },
  reportItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  reportItemText: { fontSize: 16, color: '#333' },
});