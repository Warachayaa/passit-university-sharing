import React, { useState, useEffect } from 'react';
import {
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Image, 
  ScrollView,
  Alert, 
  ActivityIndicator, 
  Platform, 
  Linking,
  SafeAreaView,
  Modal
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { auth, db } from '../config/firebase';
import { doc, getDoc, onSnapshot, collection, addDoc, serverTimestamp } from 'firebase/firestore';

// 🚨 หัวข้อสำหรับการรายงาน (ปรับให้เข้ากับแอป)
const REPORT_REASONS = [
  "การหลอกลวง ฉ้อโกง หรือของไม่ตรงปก",
  "การเบี้ยวนัด / ไม่มาตามที่ตกลงกันไว้",
  "พฤติกรรมคุกคามหรือใช้คำหยาบคาย",
  "การปั๊มคะแนน (ส่งของปลอม/ไม่มีจริง)",
  "ขายหรือโปรโมทสินค้าที่ผิดกฎหมาย",
  "ฉันแค่ไม่ชอบสิ่งนี้ / อื่นๆ"
];

export default function ActiveDealScreen({ navigation, route }) {
  const { dealId } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [deal, setDeal] = useState(null);
  const [otherUser, setOtherUser] = useState(null);

  const [timeLeft, setTimeLeft] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  // 🌟 State สำหรับเปิด/ปิดหน้ารายงาน
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
              if (itemData.location) {
                dealInfo.location = itemData.location;
              }
            }
          } catch (err) {
            console.error("Error fetching item location:", err);
          }
        }

        setDeal(dealInfo);

        if (currentUser && data.participants) {
          const partnerId = data.participants.find(id => id !== currentUser.uid);
          if (partnerId) {
            const partnerSnap = await getDoc(doc(db, 'users', partnerId));
            if (partnerSnap.exists()) {
              setOtherUser({ id: partnerSnap.id, ...partnerSnap.data() });
            }
          }
        }
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching deal:", error);
      setLoading(false);
    });

    return () => unsubDeal();
  }, [dealId, currentUser]);

  useEffect(() => {
    if (!deal?.createdAt || deal.status === 'completed') return;

    const calculateTimeLeft = () => {
      const createdAtDate = deal.createdAt?.toDate ? deal.createdAt.toDate() : new Date(deal.createdAt);
      const deadline = new Date(createdAtDate.getTime() + 5 * 24 * 60 * 60 * 1000);
      const now = new Date();
      const diff = deadline - now;

      if (diff <= 0) {
        setIsExpired(true);
        setTimeLeft('เลยกำหนดเวลาส่งมอบแล้ว!');
        return;
      }

      setIsExpired(false);
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / 1000 / 60) % 60);

      setTimeLeft(`${d} วัน ${h} ชั่วโมง ${m} นาที`);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 60000);

    return () => clearInterval(interval);
  }, [deal?.createdAt, deal?.status]);

  const handleNavigate = () => {
    const { lat, lng, name } = deal?.location || {};
    if (!lat || !lng) {
      Alert.alert('ไม่พบตำแหน่ง', 'ขออภัย ไม่พบพิกัดสำหรับนำทาง');
      return;
    }
    const label = name || "จุดนัดรับสินค้า";
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${lat},${lng}`,
      android: `geo:0,0?q=${lat},${lng}(${label})`
    });

    Linking.canOpenURL(url).then(supported => {
      if (supported) Linking.openURL(url);
      else Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
    });
  };

  const handleOpenChat = () => {
    if (deal?.chatId) {
      navigation.navigate('Chat', {
        chatId: deal.chatId,
        sellerName: otherUser?.fullName || otherUser?.username || 'Partner',
        itemTitle: deal.itemTitle,
      });
    } else {
      Alert.alert("แจ้งเตือน", "ไม่พบข้อมูลห้องแชท");
    }
  };

  // 🌟 ฟังก์ชันส่งรายงานลง Firebase
  const handleReport = async (reason) => {
    setShowReportModal(false);
    try {
      await addDoc(collection(db, 'reports'), {
        reporterId: currentUser?.uid,
        reportedId: otherUser?.id || 'unknown',
        dealId: dealId,
        reason: reason,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      Alert.alert("ขอบคุณที่รายงาน", "เราได้รับรายงานของคุณเรียบร้อยแล้ว ทีมงานจะรีบตรวจสอบและดำเนินการโดยเร็วที่สุด");
    } catch (error) {
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถส่งรายงานได้ในขณะนี้");
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#D9A47F" />
      </View>
    );
  }

  if (!deal) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#5A3D2B' }}>ไม่พบข้อมูลดีล</Text>
      </View>
    );
  }

  const isDone = deal.status === 'completed';
  const locationName = deal.location?.name || 'Unknown Location';
  const locationDetail = deal.location?.address || deal.location?.detail || '';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="chevron-left" size={26} color="#8B7355" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Active Deal</Text>
        {/* 🌟 ปุ่มจุดสามจุดสำหรับเปิดหน้ารายงาน */}
        <TouchableOpacity style={styles.moreBtn} onPress={() => setShowReportModal(true)}>
          <Feather name="more-vertical" size={24} color="#8B7355" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        
        {isDone ? (
          <View style={styles.statusBannerDone}>
            <Image source={{ uri: 'https://img2.pic.in.th/Complete.png' }} style={styles.bannerDuckIcon} />
            <Text style={styles.bannerSmallText}>Confirmed!</Text>
            <Text style={styles.bannerText}>Quack Confirmed</Text>
          </View>
        ) : (
          <View style={[styles.countdownBanner, isExpired ? styles.countdownExpired : {}]}>
            <View style={styles.countdownHeaderRow}>
              <Ionicons name="timer-outline" size={20} color={isExpired ? '#C0392B' : '#E67E22'} />
              <Text style={[styles.countdownTitle, isExpired ? { color: '#C0392B' } : {}]}>
                {isExpired ? 'Account Suspension Warning' : 'Delivery Deadline'}
              </Text>
            </View>
            <Text style={[styles.countdownTimeText, isExpired ? { color: '#C0392B' } : {}]}>{timeLeft}</Text>
            <Text style={styles.countdownSubtitle}>
              กรุณาส่งมอบสินค้าภายในเวลาที่กำหนด หากเกินเวลา บัญชีของคุณจะถูกระงับ 7 วัน เพื่อป้องกันการปั้มคะแนนและการเบี้ยวนัด
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.itemRow}>
            <Image source={{ uri: deal.itemImage || 'https://via.placeholder.com/150' }} style={styles.itemImage} />
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle} numberOfLines={1}>{deal.itemTitle || 'Item'}</Text>
              <Text style={styles.itemCategory}>{deal.itemCategory || 'Other'}</Text>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabelText}>Status: </Text>
                <View style={[styles.pillBadge, isDone ? {backgroundColor: '#E8F5E9'} : {backgroundColor: '#D6EAF8'}]}>
                  <Text style={[styles.pillBadgeText, isDone ? {color: '#2D6A4F'} : {color: '#2874A6'}]}>
                    {isDone ? 'Quack Done' : 'Duck Active'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.card, styles.userCard]}>
          <View style={styles.userLeft}>
            <Image source={{ uri: otherUser?.photoURL || 'https://img2.pic.in.th/Unknown_User.jpg' }} style={styles.avatar} />
            <Text style={styles.userName}>{otherUser?.fullName || otherUser?.username || 'Unknown User'}</Text>
          </View>
          <TouchableOpacity style={styles.messageBtn} onPress={handleOpenChat}>
            <Text style={styles.messageText}>Message</Text>
            <Ionicons name="chatbubble-outline" size={18} color="#799351" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.locationHeader}>
            <View style={styles.locationIconBox}>
              <Ionicons name="location-outline" size={22} color="#799351" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.labelSmall}>Location</Text>
              <Text style={styles.locationName}>{locationName}</Text>
              {locationDetail !== '' && <Text style={styles.locationDetail}>{locationDetail}</Text>}
            </View>
          </View>

          {deal.location?.lat && deal.location?.lng ? (
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                initialRegion={{ latitude: deal.location.lat, longitude: deal.location.lng, latitudeDelta: 0.005, longitudeDelta: 0.005 }}
                scrollEnabled={false} 
              >
                <Marker coordinate={{ latitude: deal.location.lat, longitude: deal.location.lng }}>
                  <Ionicons name="location" size={32} color="#E74C3C" />
                </Marker>
              </MapView>
              <TouchableOpacity style={styles.navButton} onPress={handleNavigate}>
                <MaterialCommunityIcons name="navigation-variant" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.mapContainer, { backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ color: '#8B7355' }}>ไม่พบพิกัดแผนที่</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* 🌟 Modal สำหรับหน้ารายงาน (Bottom Sheet) */}
      <Modal visible={showReportModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.reportSheet}>
            <View style={styles.reportHeader}>
              <TouchableOpacity onPress={() => setShowReportModal(false)} style={styles.closeReportBtn}>
                <Feather name="x" size={24} color="#111" />
              </TouchableOpacity>
              <Text style={styles.reportTitle}>รายงาน</Text>
              <View style={{ width: 24 }} />
            </View>

            <Text style={styles.reportSubtitle}>ทำไมคุณจึงรายงานโพสต์นี้</Text>
            
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

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 15 },
  backBtn: { padding: 4, marginLeft: -4 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#5A3D2B' },
  moreBtn: { padding: 4 },

  scrollView: { flex: 1, paddingHorizontal: 20 },

  statusBannerDone: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 2, borderColor: '#6B8E6B', borderStyle: 'dashed', marginBottom: 20 },
  bannerDuckIcon: { width: 80, height: 80, resizeMode: 'contain', marginBottom: 4 },
  bannerSmallText: { fontSize: 13, fontWeight: '800', color: '#5A3D2B', marginBottom: 4 },
  bannerText: { fontSize: 22, fontWeight: '800', color: '#6B8E6B' },

  countdownBanner: { backgroundColor: '#FFF4E5', borderRadius: 20, padding: 18, marginBottom: 16, borderWidth: 1.5, borderColor: '#FFD3B6', elevation: 2 },
  countdownExpired: { backgroundColor: '#FDEDEC', borderColor: '#FADBD8' },
  countdownHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  countdownTitle: { fontSize: 14, fontWeight: '800', color: '#E67E22', marginLeft: 6 },
  countdownTimeText: { fontSize: 24, fontWeight: '900', color: '#5A3D2B', marginBottom: 8 },
  countdownSubtitle: { fontSize: 13, color: '#8B7355', lineHeight: 18, fontWeight: '500' },

  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 16, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  itemRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  itemImage: { width: 90, height: 90, borderRadius: 16, backgroundColor: '#F5F5F5' },
  itemInfo: { flex: 1, justifyContent: 'center' },
  itemTitle: { fontSize: 18, fontWeight: '800', color: '#5A3D2B', marginBottom: 4 },
  itemCategory: { fontSize: 14, color: '#A67B5B', fontWeight: '500', marginBottom: 10 },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusLabelText: { fontSize: 14, fontWeight: '700', color: '#8B7355', marginRight: 6 },
  pillBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16 },
  pillBadgeText: { fontSize: 12, fontWeight: '800' },

  userCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  userLeft: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F5E6D3' },
  userName: { marginLeft: 12, fontSize: 18, fontWeight: '800', color: '#5A3D2B' },
  messageBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  messageText: { fontSize: 15, fontWeight: '700', color: '#799351' },

  locationHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  locationIconBox: { width: 40, height: 40, backgroundColor: '#F0F5E9', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  labelSmall: { fontSize: 12, fontWeight: '800', color: '#D9A47F', textTransform: 'uppercase', marginBottom: 2 },
  locationName: { fontSize: 18, fontWeight: '800', color: '#5A3D2B' },
  locationDetail: { fontSize: 14, color: '#A67B5B', marginTop: 2 },

  mapContainer: { height: 180, borderRadius: 16, overflow: 'hidden', position: 'relative', backgroundColor: '#F5F5F5' },
  map: { flex: 1 },
  navButton: { position: 'absolute', bottom: 12, right: 12, backgroundColor: '#A67B5B', width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', elevation: 4 },

  // 🌟 Styles สำหรับ Report Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  reportSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 20, maxHeight: '85%' },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  closeReportBtn: { padding: 4 },
  reportTitle: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  reportSubtitle: { fontSize: 16, fontWeight: 'bold', color: '#111', paddingHorizontal: 20, paddingVertical: 16 },
  reportItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  reportItemText: { fontSize: 16, color: '#333' },
});