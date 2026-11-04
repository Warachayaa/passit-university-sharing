// screens/MyItemsScreen.jsx
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

// หมายเหตุ: โค้ดนี้เขียนขึ้นเพื่อใช้งานในสภาพแวดล้อม React Native (Expo)
// หากการพรีวิวใน Canvas แสดงข้อผิดพลาด "Could not resolve" นั่นเป็นเพราะระบบพรีวิวไม่รองรับไลบรารีของมือถือ
// แต่คุณสามารถคัดลอกโค้ดนี้ไปใช้งานในโปรเจกต์จริงของคุณได้ทันทีครับ
import {
  doc, getDoc, collection, getDocs,
  query, where, writeBatch, serverTimestamp, onSnapshot
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';

// 🌟 ปรับปรุง Bottom Bar ให้รับค่า undeliveredCount มาแสดง Badge
const MyItemsBottomBar = ({ navigation, undeliveredCount }) => {
  return (
    <View style={styles.bottomBar}>
      <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate("Home")}>
          <Ionicons name="home-outline" size={26} color="#B0A090" />
          <Text style={styles.tabLabel}>Home</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('MyItems')}>
        <View style={styles.iconWrapper}>
          <Feather name="shopping-bag" size={24} color="#5A3D2B" />
          {/* 🔴 แสดงเลขแจ้งเตือนเมื่อมีรายการที่ยังไม่ส่งของ (สถานะดีลไม่ใช่ completed) */}
          {undeliveredCount > 0 && (
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>{undeliveredCount > 99 ? '99+' : undeliveredCount}</Text>
            </View>
          )}
        </View>
        <Text style={styles.tabLabelActive}>My Items</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.centerButton} onPress={() => navigation.navigate('QRScan')} activeOpacity={0.85}>
        <View style={styles.centerButtonInner}>
          <MaterialCommunityIcons name="qrcode-scan" size={28} color="#FFF" />
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('Rewards')}>
        <MaterialCommunityIcons name="gift-outline" size={26} color="#B0A090" />
        <Text style={styles.tabLabel}>Rewards</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('Profile')}>
        <Feather name="user" size={24} color="#B0A090" />
        <Text style={styles.tabLabel}>Profile</Text>
      </TouchableOpacity>
    </View>
  );
};

const ListingCard = ({ item, onEdit, onDelete, onView, isDeleting }) => {
  const getStatusStyle = (status, dealStatus) => {
    let style = { bg: '#F5F5F5', color: '#757575', text: status || 'Unknown', showDot: false };

    switch (status) {
      case 'Available':    style = { bg: '#E8F5E9', color: '#4CAF50', text: 'Available', showDot: false }; break;
      case 'Claimed':      style = { bg: '#FFF3E0', color: '#FF9800', text: 'Claimed', showDot: false }; break; 
      case 'Free Duck':    style = { bg: '#F3E5F5', color: '#9C27B0', text: 'Free Duck', showDot: false }; break;
      case 'Duck Request': style = { bg: '#FFFDE7', color: '#FBC02D', text: 'Duck Request', showDot: false }; break;
      case 'Quack Done':   style = { bg: '#E0F2F1', color: '#009688', text: 'Quack Done', showDot: false }; break;
    }

    if (status === 'Claimed' && dealStatus) {
      const ds = dealStatus.toLowerCase();
      if (ds === 'active' || ds === 'pending' || ds === 'ontheway') {
         style.showDot = true; 
      } 
    }
    return style;
  };

  const statusInfo = getStatusStyle(item.status, item.dealStatus);

  return (
    <View style={[cardStyles.container, isDeleting && { opacity: 0.5 }]}>
      <View style={cardStyles.topContent}>
        <Image
          source={{ uri: item.image || item.imageUrls?.[0] || 'https://via.placeholder.com/300' }}
          style={cardStyles.image}
        />
        <View style={cardStyles.infoContainer}>
          <Text style={cardStyles.title} numberOfLines={2}>{item.title}</Text>
          <View style={cardStyles.statusRow}>
            <Text style={cardStyles.statusLabel}>Status:</Text>
            <View style={[cardStyles.statusTag, { backgroundColor: statusInfo.bg }]}>
              {statusInfo.showDot && <View style={cardStyles.dotIndicator} />}
              <Text style={[cardStyles.statusText, { color: statusInfo.color }]}>{statusInfo.text}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={cardStyles.actionRow}>
        <TouchableOpacity style={cardStyles.viewButton} onPress={() => onView(item)} disabled={isDeleting}>
          <Feather name="eye" size={16} color="#5A7D5A" />
          <Text style={cardStyles.viewText}>View</Text>
        </TouchableOpacity>
        <TouchableOpacity style={cardStyles.editButton} onPress={() => onEdit(item)} disabled={isDeleting}>
          <Feather name="edit-3" size={16} color="#B08968" />
          <Text style={cardStyles.editText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={cardStyles.deleteButton} onPress={() => onDelete(item.id)} disabled={isDeleting}>
          {isDeleting ? <ActivityIndicator size="small" color="#F44336" /> : <Feather name="trash-2" size={16} color="#F44336" />}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function MyItemsScreen({ navigation }) {
  const [myListings, setMyListings] = useState([]);
  const [userData, setUserData]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  
  // 🌟 State สำหรับเก็บจำนวนรายการที่ตกลงกันแล้วแต่ยังไม่ส่งของ
  const [undeliveredCount, setUndeliveredCount] = useState(0);

  const uid = auth.currentUser?.uid;

  /* ------------------- REAL-TIME UNDELIVERED COUNT ------------------- */
  // คอยติดตามจำนวนรายการที่กำลังดำเนินการส่งมอบ ( giverId เป็นเรา และ status ไม่ใช่ completed/cancelled )
  useEffect(() => {
    if (!uid) return;

    const q = query(collection(db, 'deals'), where('giverId', '==', uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pendingDeals = snapshot.docs.filter(doc => {
        const status = (doc.data().status || '').toLowerCase();
        // นับเฉพาะดีลที่ตกลงกันแล้ว แต่ยังส่งไม่สำเร็จ
        return status !== 'completed' && status !== 'cancelled' && status !== 'closed';
      });
      setUndeliveredCount(pendingDeals.length);
    }, (error) => {
      console.error("Real-time count error:", error);
    });

    return () => unsubscribe();
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      const loadUserData = async () => {
        try {
          setLoading(true);
          if (!uid) throw new Error('No user UID');

          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) setUserData(userDoc.data());

          const itemsQuery = query(collection(db, 'items'), where('ownerId', '==', uid));
          const itemsSnapshot = await getDocs(itemsQuery);
          
          const itemsData = await Promise.all(
            itemsSnapshot.docs.map(async (d) => {
              const itemObj = { id: d.id, ...d.data() };
              if (itemObj.status !== 'Available') {
                try {
                  const dealsQuery = query(collection(db, 'deals'), where('itemId', '==', itemObj.id));
                  const dealsSnap = await getDocs(dealsQuery);
                  if (!dealsSnap.empty) {
                    const docsData = dealsSnap.docs.map(doc => doc.data());
                    const activeDeal = docsData.find(data => data.status !== 'cancelled' && data.status !== 'closed');
                    itemObj.dealStatus = activeDeal ? activeDeal.status : docsData[0].status;
                  }
                } catch (err) { console.log(err); }
              }
              return itemObj;
            })
          );
          setMyListings(itemsData);
        } catch (error) { console.error(error); } finally { setLoading(false); }
      };
      loadUserData();
    }, [uid])
  );

  const handleEdit = (item) => navigation.navigate('EditItem', { itemData: item });

  const handleViewDeal = async (item) => {
    if (item.status === 'Available') {
      Alert.alert("No Deal", "สินค้านี้ยังไม่มีการส่งคำขอหรือตกลงดีลครับ");
      return;
    }
    try {
      setLoading(true);
      const q = query(collection(db, 'deals'), where('itemId', '==', item.id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        navigation.navigate('ActiveDeal', { dealId: snap.docs[0].id });
      } else {
        Alert.alert("Not Found", "ไม่พบข้อมูลดีลที่เชื่อมโยงกับสินค้านี้");
      }
    } catch (error) { Alert.alert("Error", "ไม่สามารถเปิดหน้าดีลได้"); } finally { setLoading(false); }
  };

  const handleDelete = (itemId) => {
    const itemToDelete = myListings.find((i) => i.id === itemId);
    Alert.alert('Delete Item', `ต้องการลบ "${itemToDelete?.title}" ใช่หรือไม่?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(itemId);
          try {
            const batch = writeBatch(db);
            batch.delete(doc(db, 'items', itemId));
            const reqs = await getDocs(query(collection(db, 'requests'), where('itemId', '==', itemId)));
            reqs.docs.forEach(d => batch.update(d.ref, { status: 'closed', updatedAt: serverTimestamp() }));
            const deals = await getDocs(query(collection(db, 'deals'), where('itemId', '==', itemId)));
            deals.docs.forEach(d => batch.update(d.ref, { status: 'cancelled', updatedAt: serverTimestamp() }));
            await batch.commit();
            setMyListings(prev => prev.filter(x => x.id !== itemId));
            Alert.alert('Success', 'ลบสินค้าเรียบร้อยแล้ว');
          } catch (error) { Alert.alert('Error', 'เกิดข้อผิดพลาดในการลบ'); } finally { setDeletingId(null); }
        },
      },
    ]);
  };

  if (loading) return <View style={styles.container}><ActivityIndicator color="#D9A77C" size="large" style={{ marginTop: '50%' }} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}><Text style={styles.headerTitle}>My Items</Text></View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {userData && (
          <View style={styles.profileCard}>
            <View style={styles.profileInfo}>
              <Text style={styles.userName}>{userData.fullName}</Text>
              <View style={styles.levelBadge}><Text style={styles.levelText}>LV.{userData.level || 1}</Text><Text style={styles.rankText}>{userData.rank || 'TINYDUCK'}</Text></View>
            </View>
            <View style={styles.statsGrid}>
              <View style={styles.statBox}><View style={styles.statIconRow}><MaterialCommunityIcons name="hand-heart" size={20} color="#D9A77C" /><Text style={styles.statLabel}>Shared</Text></View><Text style={styles.statNumber}>{myListings.length}</Text><Text style={styles.statUnit}>Items</Text></View>
              <View style={styles.statBox}><View style={styles.statIconRow}><Feather name="clock" size={20} color="#6FBF73" /><Text style={styles.statLabel}>Active</Text></View><Text style={styles.statNumber}>{myListings.filter(i => i.status === 'Available').length}</Text><Text style={styles.statUnit}>Listings</Text></View>
            </View>
          </View>
        )}
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Recent Listings</Text><Text style={styles.totalCount}>{myListings.length} total</Text></View>
        <View style={styles.listContainer}>
          {myListings.length > 0 ? myListings.map((item) => <ListingCard key={item.id} item={item} onEdit={handleEdit} onDelete={handleDelete} onView={handleViewDeal} isDeleting={deletingId === item.id} />) : (
            <View style={styles.emptyState}><MaterialCommunityIcons name="gift-outline" size={60} color="#C49A79" /><Text style={styles.emptyText}>No items shared yet</Text><TouchableOpacity style={styles.addFirstBtn} onPress={() => navigation.navigate('AddItem')}><Feather name="plus" size={18} color="#FFF" /><Text style={styles.addFirstText}>Add Your First Item</Text></TouchableOpacity></View>
          )}
        </View>
      </ScrollView>
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddItem')} activeOpacity={0.8}><Feather name="plus" size={32} color="#FFF" /></TouchableOpacity>
      
      {/* 🌟 ส่ง undeliveredCount เข้าไปเพื่อแสดงป้ายแจ้งเตือนที่ปุ่ม My Items */}
      <MyItemsBottomBar navigation={navigation} undeliveredCount={undeliveredCount} />
    </View>
  );
}

const cardStyles = StyleSheet.create({
  container: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, marginBottom: 12, elevation: 3, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  topContent: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  image: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#F5F5F5' },
  infoContainer: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: '#5A3D2B', marginBottom: 6 },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusLabel: { fontSize: 13, color: '#8B7355', marginRight: 6 },
  statusTag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, flexDirection: 'row', alignItems: 'center' },
  statusText: { fontSize: 11, fontWeight: '700' },
  dotIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF5722', marginRight: 6 },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F5F0E6' },
  viewButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F7F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  viewText: { fontSize: 13, fontWeight: '700', color: '#5A7D5A', marginLeft: 4 },
  editButton: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E0CDB5', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  editText: { fontSize: 13, fontWeight: '600', color: '#B08968', marginLeft: 4 },
  deleteButton: { justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FFEBEE', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#FFEBEE' },
});

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#FFF8E7' },
  header:        { paddingHorizontal: 24, paddingTop: 50, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle:   { fontSize: 26, fontWeight: '800', color: '#5A3D2B' },
  scrollContent: { paddingBottom: 130 },
  profileCard:  { marginHorizontal: 20, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, elevation: 4, marginBottom: 16 },
  profileInfo:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  userName:     { fontSize: 20, fontWeight: '700', color: '#5A3D2B' },
  levelBadge:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF8E1', borderWidth: 1.5, borderColor: '#D4AF37', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  levelText:    { fontSize: 12, fontWeight: '800', color: '#D4AF37', marginRight: 4 },
  rankText:     { fontSize: 12, fontWeight: '700', color: '#8B6914' },
  statsGrid:    { flexDirection: 'row', gap: 12 },
  statBox:      { flex: 1, backgroundColor: '#FAF6EE', borderRadius: 14, padding: 14 },
  statIconRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  statLabel:    { fontSize: 13, fontWeight: '600', color: '#8B7355', marginLeft: 4 },
  statNumber:   { fontSize: 26, fontWeight: '900', color: '#5A3D2B' },
  statUnit:     { fontSize: 13, color: '#A89F91', marginTop: -4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle:  { fontSize: 20, fontWeight: '700', color: '#5A3D2B' },
  totalCount:    { fontSize: 14, fontWeight: '600', color: '#B08968' },
  listContainer: { paddingHorizontal: 20 },
  emptyState:    { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText:     { fontSize: 16, color: '#8B7355' },
  addFirstBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#6FBF73', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  addFirstText:  { color: '#FFF', fontWeight: '700', fontSize: 15 },
  fab: { position: 'absolute', bottom: 100, right: 20, width: 64, height: 64, backgroundColor: '#5A7D5A', borderRadius: 32, justifyContent: 'center', alignItems: 'center', elevation: 8, zIndex: 100 },
  
  // 🌟 Bottom Bar Styles
  bottomBar:       { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: '#FFF', paddingVertical: 8, paddingBottom: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, elevation: 10, position: 'absolute', bottom: 0, width: '100%', zIndex: 10 },
  tabItem:         { alignItems: 'center', justifyContent: 'center' },
  tabLabel:        { fontSize: 11, color: '#B0A090', marginTop: 2, fontWeight: '600' },
  tabLabelActive:  { fontSize: 11, color: '#5A3D2B', marginTop: 2, fontWeight: '800' },
  centerButton:    { marginTop: -30, alignItems: 'center', justifyContent: 'center' },
  centerButtonInner: { width: 64, height: 64, backgroundColor: '#5A7D5A', borderRadius: 18, justifyContent: 'center', alignItems: 'center', elevation: 10 },
  
  // 🔴 Styles สำหรับ Badge แจ้งเตือน
  iconWrapper: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeContainer: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: '#E74C3C',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
});