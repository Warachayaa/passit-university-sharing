import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  SafeAreaView,
  StatusBar
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';

// หมายเหตุ: โค้ดนี้ถูกออกแบบมาเพื่อใช้งานในโปรเจกต์ React Native (Expo) จริงของคุณ
// ข้อผิดพลาดในการคอมไพล์บนหน้าจอนี้เกิดจากระบบพรีวิวไม่รองรับไลบรารีเฉพาะทางของมือถือ
// คุณสามารถคัดลอกโค้ดทั้งหมดนี้ไปวางทับไฟล์ screens/ItemDataScreen.jsx ในเครื่องได้เลยครับ
import { auth, db } from '../config/firebase';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';

function timeAgo(ts) {
  try {
    const d = ts?.toDate?.();
    if (!d) return '';
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return '';
  }
}

const REPORT_REASONS = [
  "การหลอกลวง ฉ้อโกง หรือของไม่ตรงปก",
  "รูปภาพไม่เหมาะสม หรืออนาจาร",
  "ขายหรือโปรโมทสินค้าที่ผิดกฎหมาย",
  "การปั๊มคะแนน (สินค้าไม่มีจริง)",
  "ฉันแค่ไม่ชอบสิ่งนี้ / อื่นๆ"
];

export default function ItemDataScreen({ navigation, route }) {
  const { itemId } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState(null);
  const [owner, setOwner] = useState(null);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);
  
  const [showReportModal, setShowReportModal] = useState(false);

  const currentUser = auth.currentUser;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!itemId) throw new Error('Missing itemId');
        const snap = await getDoc(doc(db, 'items', itemId));
        if (!snap.exists()) throw new Error('Item not found');

        const data = snap.data();
        if (!mounted) return;
        setItem({ id: snap.id, ...data });

        if (data.ownerId) {
          const ownerSnap = await getDoc(doc(db, 'users', data.ownerId));
          if (ownerSnap.exists() && mounted) setOwner({ id: ownerSnap.id, ...ownerSnap.data()});
        }

        if (currentUser && currentUser.uid !== data.ownerId) {
          const reqQuery = query(
            collection(db, 'requests'), 
            where('buyerId', '==', currentUser.uid), 
            where('itemId', '==', itemId)
          );
          const reqSnap = await getDocs(reqQuery);
          if (!reqSnap.empty && mounted) setHasRequested(true);
        }
      } catch (e) {
        Alert.alert('Error', 'ไม่พบรายการนี้');
        navigation.goBack();
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [itemId, currentUser]);

  const imageUri = useMemo(() => (item ? (item.image || item.imageUrls?.[0] || null) : null), [item]);
  const isOwner  = currentUser && item && currentUser.uid === item.ownerId;

  /* ------------------- 1. ฟังก์ชันทักแชทเพื่อสอบถาม (ไม่สร้างคำขอ) ------------------- */
  const handleOpenChatOnly = async () => {
    if (!currentUser) return Alert.alert('แจ้งเตือน', 'กรุณาล็อกอินก่อนทักแชท');
    const buyerId  = currentUser.uid;
    const sellerId = item.ownerId;
    if (buyerId === sellerId) return Alert.alert('อ๊ะ!', 'นี่คือสินค้าของคุณเอง');

    setIsChatLoading(true);
    try {
      const chatsRef  = collection(db, 'chats');
      
      // ค้นหาห้องแชทที่มีอยู่แล้ว
      const chatQuery = query(
        chatsRef, 
        where('itemId', '==', item.id), 
        where('users', 'array-contains', buyerId)
      );
      
      const chatSnapshot  = await getDocs(chatQuery);
      let existingChatId  = null;

      chatSnapshot.forEach((chatDoc) => {
        const d = chatDoc.data();
        if (d.users?.includes(sellerId)) {
          existingChatId = chatDoc.id;
        }
      });

      let finalChatId = existingChatId;

      if (!finalChatId) {
        // 🌟 สร้างห้องแชทใหม่พร้อมฟิลด์สำคัญเพื่อให้เด้งในหน้า MessagesScreen ทันที
        const newChatDoc = await addDoc(chatsRef, {
          itemId: item.id,
          itemTitle: item.title,
          itemImage: imageUri || '', 
          sellerId: sellerId,
          participants: [buyerId, sellerId],
          users: [buyerId, sellerId],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(), // สำคัญ: เพื่อให้ query ใน MessagesScreen (orderBy updatedAt) ค้นเจอ
          lastMessageAt: serverTimestamp(),
          lastMessage: "เริ่มการสนทนา..."
        });
        finalChatId = newChatDoc.id;
      }

      navigation.navigate('Chat', { 
        chatId: finalChatId, 
        sellerName: owner?.fullName || owner?.username || 'User', 
        itemTitle: item.title 
      });
    } catch (error) { 
      console.error("Open chat error:", error);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถเข้าสู่ห้องแชทได้'); 
    } finally { 
      setIsChatLoading(false); 
    }
  };

  /* ------------------- 2. ฟังก์ชันส่งคำขอรับของ ------------------- */
  const handleRequestItem = async () => {
    if (!currentUser) return Alert.alert('แจ้งเตือน', 'กรุณาล็อกอินก่อนส่งคำขอ');
    const buyerId  = currentUser.uid;
    const sellerId = item.ownerId;
    if (buyerId === sellerId) return Alert.alert('อ๊ะ!', 'นี่คือสินค้าของคุณเอง');

    setIsChatLoading(true);
    try {
      const chatsRef  = collection(db, 'chats');
      const chatQuery = query(chatsRef, where('itemId', '==', item.id), where('users', 'array-contains', buyerId));
      const chatSnapshot  = await getDocs(chatQuery);
      let existingChatId  = null;

      chatSnapshot.forEach((chatDoc) => {
        if (chatDoc.data().users?.includes(sellerId)) existingChatId = chatDoc.id;
      });

      let finalChatId = existingChatId;
      if (!finalChatId) {
        const newChatDoc = await addDoc(chatsRef, {
          itemId: item.id,
          itemTitle: item.title,
          itemImage: imageUri || '',
          sellerId: sellerId,
          participants: [buyerId, sellerId], 
          users: [buyerId, sellerId],
          createdAt: serverTimestamp(), 
          updatedAt: serverTimestamp(),
          lastMessageAt: serverTimestamp(),
          lastMessage: "เริ่มการสนทนา..."
        });
        finalChatId = newChatDoc.id;
      }

      const reqQuery = query(collection(db, 'requests'), where('buyerId', '==', buyerId), where('itemId', '==', item.id));
      const reqSnapshot = await getDocs(reqQuery);

      if (reqSnapshot.empty) {
        await addDoc(collection(db, 'requests'), {
          itemId: item.id,
          itemTitle: item.title,
          itemImage: imageUri || '',
          itemLocation: item.location || null,
          buyerId: buyerId,
          sellerId: sellerId,
          participants: [buyerId, sellerId],
          chatId: finalChatId,
          status: 'pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setHasRequested(true);
        Alert.alert("ส่งคำขอแล้ว 🎉", "ระบบแจ้งเตือนเจ้าของแล้ว โปรดรอการอนุมัติ");
      } else { 
        setHasRequested(true); 
      }

      navigation.navigate('Chat', { 
        chatId: finalChatId, 
        sellerName: owner?.fullName || owner?.username || 'User', 
        itemTitle: item.title 
      });
    } catch (error) { 
      console.error("Request error:", error);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถส่งคำขอได้'); 
    } finally { 
      setIsChatLoading(false); 
    }
  };

  const handleReport = async (reason) => {
    setShowReportModal(false);
    try {
      await addDoc(collection(db, 'reports'), {
        reporterId: currentUser?.uid || 'unknown',
        reportedId: owner?.id || 'unknown',
        itemId: itemId,
        reason: reason,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      Alert.alert("ขอบคุณที่รายงาน", "เราได้รับรายงานของคุณเรียบร้อยแล้ว ทีมงานจะดำเนินการตรวจสอบโดยเร็วที่สุด");
    } catch (error) { 
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถส่งรายงานได้"); 
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#D9A77C" /></View>;
  if (!item) return <View style={styles.center}><Text style={{ color: '#5A3D2B' }}>No item</Text></View>;

  const postedText = timeAgo(item.createdAt) || 'Posted today';
  const locationName = item.location?.name || item.location?.address || '—';
  const lat = item.location?.lat;
  const lng = item.location?.lng;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>

        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="chevron-left" size={22} color="#A47551" />
          </TouchableOpacity>
          <Text style={styles.title}>Item Data</Text>
          <TouchableOpacity onPress={() => setShowReportModal(true)} style={styles.reportIcon}>
            <Feather name="flag" size={22} color="#A47551" />
          </TouchableOpacity>
        </View>

        <View style={styles.imageFrame}>
          <Image source={{ uri: imageUri || 'https://via.placeholder.com/600x300' }} style={styles.image} resizeMode="cover" />
        </View>

        <Text style={styles.itemTitle}>{item.title}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={16} color="#A89F91" />
            <Text style={styles.metaText}>{` ${postedText}`}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={16} color="#A89F91" />
            <Text style={styles.metaText}>{` ${locationName}`}</Text>
          </View>
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="tools" size={16} color="#A89F91" />
            <Text style={styles.metaText}>{` Condition: ${item.condition || '—'}`}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Description</Text>
        <Text style={styles.descriptionText}>{item.description || '—'}</Text>

        <View style={styles.listedRow}>
          <View style={styles.ownerBadge}>
             <Image 
                source={{ uri: owner?.photoURL || 'https://img2.pic.in.th/Unknown_User.jpg' }} 
                style={styles.ownerAvatar} 
              />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionLabelList}>Listed By</Text>
            <Text style={styles.ownerName}>{owner?.fullName || owner?.username || 'Unknown'}</Text>
          </View>
          
          {isOwner ? (
            <TouchableOpacity style={styles.viewRequestsBtn} onPress={() => navigation.navigate('MyRequests')}>
              <Feather name="inbox" size={18} color="#FFF" />
              <Text style={styles.viewRequestsText}>ดูคำขอ</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.messageBtn} onPress={handleOpenChatOnly} disabled={isChatLoading}>
              <Feather name="message-circle" size={18} color="#6FBF73" />
              <Text style={styles.messageText}>Message</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.sectionLabel}>Location</Text>
        <View style={styles.mapCard}>
          {typeof lat === 'number' && typeof lng === 'number' ? (
            <MapView 
              style={styles.map} 
              initialRegion={{ latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }} 
              scrollEnabled={false}
            >
              <Marker coordinate={{ latitude: lat, longitude: lng }} />
            </MapView>
          ) : (
            <Text style={{ color: '#8B7355', padding: 14 }}>Location not available</Text>
          )}
          <View style={styles.mapFooter}>
            <Ionicons name="location" size={16} color="#A47551" />
            <Text style={styles.mapAddress} numberOfLines={2}>{locationName}</Text>
          </View>
        </View>

        {!isOwner && (
          <TouchableOpacity 
            style={[styles.requestBtn, hasRequested && styles.requestBtnDisabled]} 
            onPress={hasRequested ? undefined : handleRequestItem} 
            disabled={isChatLoading || hasRequested}
          >
            {isChatLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.requestBtnText}>{hasRequested ? '✓ ส่งคำขอแล้ว' : 'Request Item'}</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

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

    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#FFF8E7' },
  center:             { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF8E7' },
  topBar:             { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 10, gap: 10 },
  backBtn:            { padding: 8, borderRadius: 12, backgroundColor: 'rgba(164,117,81,0.08)' },
  title:              { flex: 1, fontSize: 22, fontWeight: '900', color: '#5A3D2B', textAlign: 'center' },
  reportIcon:         { padding: 8 },
  imageFrame:         { marginHorizontal: 18, borderRadius: 18, borderWidth: 2, borderColor: '#D9A77C', overflow: 'hidden', backgroundColor: '#fff' },
  image:              { width: '100%', height: 210 },
  itemTitle:          { marginTop: 14, marginHorizontal: 18, fontSize: 22, fontWeight: '900', color: '#5A3D2B' },
  metaRow:            { marginTop: 10, marginHorizontal: 18, gap: 10 },
  metaItem:           { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText:           { color: '#8B7355', fontWeight: '700' },
  sectionLabel:       { marginTop: 18, marginHorizontal: 18, fontSize: 16, fontWeight: '900', color: '#5A3D2B' },
  sectionLabelList:   { fontSize: 14, fontWeight: '700', color: '#A89F91' },
  descriptionText:    { marginTop: 8, marginHorizontal: 18, fontSize: 14, color: '#8B7355', lineHeight: 20, backgroundColor: 'rgba(255,255,255,0.65)', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: 'rgba(217,167,124,0.7)' },
  listedRow:          { marginTop: 10, marginHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  ownerBadge:         { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 2, borderColor: '#E0CDB5', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  ownerAvatar:        { width: '100%', height: '100%' },
  ownerName:          { fontSize: 16, fontWeight: '900', color: '#5A3D2B' },
  messageBtn:         { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.5)', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#E0CDB5' },
  messageText:        { color: '#6FBF73', fontWeight: '800', fontSize: 12 },
  viewRequestsBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#D9A77C', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  viewRequestsText:   { color: '#FFF', fontWeight: '800', fontSize: 12 },
  mapCard:            { marginHorizontal: 18, marginTop: 10, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#D9A77C', backgroundColor: '#fff' },
  map:                { height: 170 },
  mapFooter:          { padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  mapAddress:         { flex: 1, color: '#8B7355', fontWeight: '700' },
  requestBtn:         { marginTop: 18, marginHorizontal: 18, backgroundColor: '#6FBF73', borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
  requestBtnDisabled: { backgroundColor: '#A8C9A8' },
  requestBtnText:     { color: '#fff', fontSize: 18, fontWeight: '900' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  reportSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 20, maxHeight: '85%' },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  closeReportBtn: { padding: 4 },
  reportTitle: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  reportSubtitle: { fontSize: 16, fontWeight: 'bold', color: '#111', paddingHorizontal: 20, paddingVertical: 16 },
  reportItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  reportItemText: { fontSize: 16, color: '#333' },
});