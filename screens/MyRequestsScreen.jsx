import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  ScrollView, SafeAreaView, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

// หมายเหตุ: ไฟล์นี้ถูกออกแบบมาเพื่อใช้งานในโปรเจกต์ React Native (Expo) ของคุณ
// การแจ้งเตือน Error บนหน้าจอนี้เกิดจากระบบพรีวิวไม่รองรับไลบรารีของมือถือ
// แต่โค้ดนี้สามารถนำไปใช้งานในโปรเจกต์จริงของคุณได้ตามปกติครับ
import { auth, db } from '../config/firebase';
import {
  collection, query, where, getDocs,
  doc, getDoc, updateDoc,
  serverTimestamp, writeBatch, increment, addDoc
} from 'firebase/firestore';

const TABS = [
  { id: 'all',       label: 'All' },
  { id: 'pending',   label: 'Pending' },
  { id: 'approved',  label: 'Approved' },
  { id: 'cancelled', label: 'Cancelled' }, 
];

function timeAgo(ts) {
  try {
    const d = ts?.toDate?.();
    if (!d) return '';
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} mins ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hours ago`;
    const days = Math.floor(hrs / 24);
    return `${days} days ago`;
  } catch { return ''; }
}

export default function MyRequestsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('all');
  const [requests, setRequests]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [chatLoadingId, setChatLoadingId] = useState(null);

  const currentUser = auth.currentUser;

  const fetchRequests = async () => {
    if (!currentUser) { setLoading(false); return; }
    setLoading(true);

    try {
      const snapshot = await getDocs(
        query(
          collection(db, 'requests'),
          where('sellerId', '==', currentUser.uid)
        )
      );

      const fetchedRequests = [];

      for (const reqDoc of snapshot.docs) {
        const reqData = reqDoc.data();
        const otherId = reqData.buyerId; 

        const [itemSnap, userSnap] = await Promise.all([
          getDoc(doc(db, 'items', reqData.itemId)),
          otherId ? getDoc(doc(db, 'users', otherId)) : Promise.resolve(null),
        ]);

        if (!itemSnap.exists()) {
          await updateDoc(reqDoc.ref, { status: 'cancelled', updatedAt: serverTimestamp() });
          continue;
        }

        const itemData = itemSnap.data();
        const userData = userSnap?.exists() ? userSnap.data() : null;

        let type = reqData.status || 'pending';
        if (type === 'cancelled' || type === 'closed') {
          type = 'cancelled';
        }
        
        if (itemData.status === 'Claimed') {
          type = itemData.claimedBy === reqData.buyerId ? 'approved' : 'cancelled';
        }

        fetchedRequests.push({
          id:          reqDoc.id,
          chatId:      reqData.chatId,
          itemId:      reqData.itemId,
          otherUserId: otherId,
          type,
          title:       itemData.title || 'No Title',
          subtitle:    itemData.location?.address || itemData.location?.name || 'Unknown Location',
          location:    reqData.itemLocation || itemData.location || null,
          timeAgo:     timeAgo(reqData.updatedAt || reqData.createdAt),
          timestamp:   reqData.updatedAt || reqData.createdAt,
          user:        userData?.fullName || userData?.username || 'Unknown User',
          userAvatar:  userData?.photoURL || 'https://img2.pic.in.th/Unknown_User.jpg',
          image:       reqData.itemImage || itemData.image || itemData.imageUrls?.[0] || 'https://via.placeholder.com/150',
          isOwner:     true, 
        });
      }

      fetchedRequests.sort((a, b) => (b.timestamp?.toDate?.() || 0) - (a.timestamp?.toDate?.() || 0));
      setRequests(fetchedRequests);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    const unsub = navigation.addListener('focus', fetchRequests);
    return unsub;
  }, [navigation]);

  const handleGoToDeal = async (item) => {
    setActionLoading(item.id);
    try {
      const dealSnap = await getDocs(
        query(
          collection(db, 'deals'),
          where('itemId', '==', item.itemId),
          where('participants', 'array-contains', currentUser.uid)
        )
      );

      if (dealSnap.empty) {
        return Alert.alert('ไม่พบดีล', 'กรุณาลองรีเฟรชหน้านี้');
      }

      const targetDeal = dealSnap.docs[0];
      navigation.navigate('ActiveDeal', { dealId: targetDeal.id });
    } catch (error) {
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถเปิดหน้าดีลได้');
    } finally {
      setActionLoading(null);
    }
  };

  // 🌟 ปรับปรุงให้ค้นหาหรือสร้างห้องแชทอัตโนมัติ
  const handleOpenChat = async (item) => {
    if (!currentUser) return;
    setChatLoadingId(item.id);

    try {
      const partnerId = item.otherUserId;
      if (!partnerId) {
        Alert.alert("แจ้งเตือน", "ไม่พบข้อมูลคู่สนทนา");
        return;
      }

      const chatsRef = collection(db, 'chats');
      const chatQuery = query(
        chatsRef,
        where('itemId', '==', item.itemId),
        where('users', 'array-contains', currentUser.uid)
      );

      const chatSnapshot = await getDocs(chatQuery);
      let existingChatId = null;

      chatSnapshot.forEach((chatDoc) => {
        const d = chatDoc.data();
        if (d.users?.includes(partnerId)) {
          existingChatId = chatDoc.id;
        }
      });

      let finalChatId = existingChatId;

      if (!finalChatId) {
        const newChatDoc = await addDoc(chatsRef, {
          itemId: item.itemId,
          itemTitle: item.title || "Item",
          sellerId: partnerId,
          users: [currentUser.uid, partnerId],
          participants: [currentUser.uid, partnerId],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMessageAt: serverTimestamp(),
        });
        finalChatId = newChatDoc.id;
      }

      navigation.navigate('Chat', { 
        chatId: finalChatId,
        sellerName: item.user || 'User',
        itemTitle: item.title
      });

    } catch (error) {
      console.error('Error opening chat:', error);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถเปิดห้องแชทได้');
    } finally {
      setChatLoadingId(null);
    }
  };

  const handleAccept = async (item) => {
    try {
      const dealsRef = collection(db, 'deals');
      const q = query(dealsRef, where('giverId', '==', currentUser.uid));
      const snap = await getDocs(q);

      let hasActive = false;
      for (const d of snap.docs) {
        const data = d.data();
        if (data.status === 'active' || data.status === 'ontheway') {
          hasActive = true;
          break;
        }
      }

      if (hasActive) {
        return Alert.alert('⚠️ ไม่สามารถอนุมัติได้', 'คุณมีดีลที่กำลังดำเนินการอยู่\nกรุณาส่งมอบก่อน');
      }

      Alert.alert(
        'ยืนยันการอนุมัติ',
        `ต้องการมอบ "${item.title}" ให้ "${item.user}" จริงหรือไม่?`,
        [
          { text: 'ยกเลิก', style: 'cancel' },
          {
            text: 'ยืนยัน',
            onPress: async () => {
              try {
                const batch = writeBatch(db);
                batch.update(doc(db, 'items', item.itemId), {
                  status: 'Claimed',
                  claimedBy: item.otherUserId,
                  updatedAt: serverTimestamp(),
                });

                const reqsQuery = query(collection(db, 'requests'), where('itemId', '==', item.itemId));
                const reqsSnap = await getDocs(reqsQuery);
                reqsSnap.docs.forEach(reqDoc => {
                  if (reqDoc.id === item.id) {
                    batch.update(reqDoc.ref, { status: 'approved', updatedAt: serverTimestamp() });
                  } else {
                    batch.update(reqDoc.ref, { status: 'cancelled', updatedAt: serverTimestamp() });
                  }
                });

                const newDealRef = doc(collection(db, 'deals'));
                batch.set(newDealRef, {
                  itemId: item.itemId,
                  itemTitle: item.title,
                  itemImage: item.image,
                  giverId: currentUser.uid,
                  receiverId: item.otherUserId,
                  participants: [currentUser.uid, item.otherUserId],
                  status: 'active',
                  chatId: item.chatId || '',
                  location: item.location || {},
                  qrToken: Math.random().toString(36).substring(2, 15),
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });

                batch.update(doc(db, 'users', currentUser.uid), {
                  duckPoints: increment(50),
                  lifetimePoints: increment(50),
                });

                await batch.commit();
                fetchRequests();
                Alert.alert('🎉 สำเร็จ!', 'อนุมัติคำขอเรียบร้อยแล้ว');
              } catch (err) {
                Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถอนุมัติได้');
              }
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถตรวจสอบสถานะได้');
    }
  };

  const handleDelete = (requestId) => {
    Alert.alert('ปฏิเสธคำขอ', 'ต้องการปฏิเสธคำขอนี้ใช่หรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ปฏิเสธ',
        style: 'destructive',
        onPress: async () => {
          try {
            await updateDoc(doc(db, 'requests', requestId), { 
              status: 'cancelled', 
              updatedAt: serverTimestamp() 
            });
            setRequests(prev => prev.map(r => r.id === requestId ? { ...r, type: 'cancelled' } : r));
          } catch {
            Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถปฏิเสธได้');
          }
        },
      },
    ]);
  };

  const filteredRequests = useMemo(() => {
    if (activeTab === 'all') return requests;
    return requests.filter(r => r.type === activeTab);
  }, [activeTab, requests]);

  // 🌟 ฟังก์ชันดึงไอคอนและสไตล์ป้ายสถานะที่มีความโปร่งใสตามรูปภาพ
  const getBadgeContent = (type) => {
    switch (type) {
      case 'pending':
        return { 
          icon: <Feather name="clock" size={14} color="#FFF" style={{ marginRight: 5 }} />,
          text: 'Pending',
          style: styles.statusBadge_pending,
          textStyle: styles.statusText_pending
        };
      case 'approved':
        return { 
          // 🌟 ใช้ check-decagram (ตราประทับ) เพื่อให้แสดงผลไอคอนแน่นอน
          icon: <MaterialCommunityIcons name="check-decagram" size={18} color="#5A3D2B" style={{ marginRight: 5 }} />,
          text: 'Approved',
          style: styles.statusBadge_approved,
          textStyle: styles.statusText_approved
        };
      case 'cancelled':
        return { 
          icon: <Feather name="x-circle" size={14} color="#C0392B" style={{ marginRight: 5 }} />,
          text: 'Cancelled',
          style: styles.statusBadge_cancelled,
          textStyle: styles.statusText_cancelled
        };
      default:
        return { icon: null, text: type, style: styles.statusBadge_cancelled, textStyle: styles.statusText_cancelled };
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#F9F5EB" barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="chevron-left" size={26} color="#A47551" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Requests</Text>
        <TouchableOpacity onPress={fetchRequests} style={styles.refreshBtn}>
          <Feather name="refresh-cw" size={20} color="#5A3D2B" />
        </TouchableOpacity>
      </View>

      {/* 🌟 TabContainer ปรับให้ทุกปุ่มกว้างเท่ากันเป๊ะ (flex: 1) และไม่ใช้ ScrollView */}
      <View style={styles.tabContainer}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tabBtn, activeTab === tab.id && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#C8865A" />
        </View>
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          {filteredRequests.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>ไม่มีคำขอในขณะนี้</Text>
            </View>
          ) : (
            filteredRequests.map(item => {
              const badge = getBadgeContent(item.type);
              return (
                <View key={item.id} style={styles.card}>
                  <View style={styles.imageContainer}>
                    <Image source={{ uri: item.image }} style={styles.cardImage} />
                    {/* ป้ายสถานะแบบโปร่งใสเล็กน้อย */}
                    <View style={[styles.badgeBase, badge.style]}>
                      {badge.icon}
                      <Text style={[styles.badgeTextBase, badge.textStyle]}>
                        {badge.text}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardContent}>
                    <View style={styles.titleRow}>
                      <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.timeAgo}>{item.timeAgo}</Text>
                    </View>
                    <View style={styles.locationRow}>
                      <Feather name="map-pin" size={14} color="#85A77B" />
                      <Text style={styles.subtitle} numberOfLines={1}>{item.subtitle}</Text>
                    </View>
                    <View style={styles.userBox}>
                      <Image source={{ uri: item.userAvatar }} style={styles.avatar} />
                      <Text style={styles.username} numberOfLines={1}>{item.user ? item.user.toUpperCase() : 'UNKNOWN'}</Text>
                      <TouchableOpacity style={styles.messageBtn} onPress={() => handleOpenChat(item)} disabled={chatLoadingId === item.id}>
                        <Text style={styles.messageText}>Message</Text>
                        <Feather name="message-circle" size={16} color="#85A77B" />
                      </TouchableOpacity>
                    </View>

                    {item.type === 'pending' && (
                      <View style={styles.actionBtnRow}>
                        <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(item)}>
                          <Text style={styles.actionBtnText}>Accept</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
                          <Text style={styles.actionBtnText}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {item.type === 'approved' && (
                      <TouchableOpacity
                        style={[styles.dealBtn, actionLoading === item.id && { opacity: 0.6 }]}
                        onPress={() => handleGoToDeal(item)}
                        disabled={actionLoading === item.id}
                      >
                        {actionLoading === item.id ? <ActivityIndicator color="#FFF" /> : <Text style={styles.dealBtnText}>Go to Active Deal</Text>}
                      </TouchableOpacity>
                    )}

                    {item.type === 'cancelled' && (
                      <View style={styles.cancelledBox}>
                        <Text style={styles.cancelledText}>คำขอนี้ถูกยกเลิก หรือสินค้ามอบให้ผู้อื่นแล้ว</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F5EB' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 15 },
  backButton: { marginRight: 12, padding: 4 },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: '900', color: '#5A3D2B' },
  refreshBtn: { padding: 6 },

  // 🌟 ปรับปรุง TabContainer ให้กระจายตัวกว้างเท่ากันทุกปุ่ม (Equal Width)
  tabContainer: { 
    flexDirection: 'row', 
    paddingHorizontal: 16, 
    marginBottom: 15, 
    gap: 6
  },
  tabBtn: { 
    flex: 1, // 🌟 ทำให้ทุกปุ่มกว้างเท่ากัน
    backgroundColor: '#FFF', 
    paddingVertical: 10, 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: '#E8D5C4',
    justifyContent: 'center',
    alignItems: 'center'
  },
  tabBtnActive: { backgroundColor: '#D9A77C', borderColor: '#D9A77C' },
  tabText: { color: '#8B7355', fontWeight: '700', fontSize: 12 }, // 🌟 ขนาดฟอนต์ 12 เพื่อให้ Approved ไม่ล้น
  tabTextActive: { color: '#FFF' },

  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyBox: { alignItems: 'center', marginTop: 80 },
  emptyTitle: { fontSize: 16, color: '#8B7355', fontWeight: '600' },

  scrollView: { flex: 1 },
  card: { backgroundColor: '#FFF', marginHorizontal: 20, marginBottom: 20, borderRadius: 16, overflow: 'hidden', elevation: 2 },
  imageContainer: { height: 140, position: 'relative' },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  
  badgeBase: {
    position: 'absolute', 
    top: 12, 
    right: 12, 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  badgeTextBase: {
    fontWeight: '800', 
    fontSize: 12
  },

  // 🌟 ปรับปรุงสไตล์ป้ายสถานะให้โปร่งใส (rgba 0.9)
  statusBadge_pending:   { backgroundColor: 'rgba(212, 163, 115, 0.92)' }, 
  statusBadge_approved:  { backgroundColor: 'rgba(245, 230, 211, 0.92)', borderWidth: 1.5, borderColor: '#5A3D2B' }, 
  statusBadge_cancelled: { backgroundColor: 'rgba(255, 218, 218, 0.92)' },
  
  statusText_pending:    { color: '#FFF' }, 
  statusText_approved:   { color: '#5A3D2B' }, 
  statusText_cancelled:  { color: '#C0392B' },

  roleBadgeOwner: { position: 'absolute', top: 12, left: 12, backgroundColor: '#D9A77C', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  roleBadgeText:  { color: '#FFF', fontWeight: '700', fontSize: 11 },

  cardContent: { padding: 16 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#5A3D2B' },
  timeAgo: { fontSize: 10, fontWeight: '800', color: '#A47551', textTransform: 'uppercase', marginLeft: 8 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 16 },
  subtitle: { fontSize: 13, fontWeight: '600', color: '#8B7355', marginLeft: 6, flex: 1 },
  userBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E8D5C4', padding: 10, borderRadius: 14, marginBottom: 16 },
  avatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  username: { flex: 1, fontSize: 14, fontWeight: '800', color: '#5A3D2B' },
  messageBtn: { flexDirection: 'row', alignItems: 'center' },
  messageText: { fontSize: 13, fontWeight: '700', color: '#85A77B', marginRight: 4 },

  actionBtnRow: { flexDirection: 'row', gap: 12 },
  acceptBtn: { flex: 1, backgroundColor: '#85A77B', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  deleteBtn: { flex: 1, backgroundColor: '#D65E5E', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  actionBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },

  dealBtn: { width: '100%', backgroundColor: '#574343', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  dealBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  cancelledBox: { backgroundColor: '#FFF5F5', padding: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#FFDADA' },
  cancelledText: { color: '#C0392B', fontWeight: '700', fontSize: 13 },
});