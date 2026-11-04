import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  FlatList,
  Alert
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { auth, db } from '../config/firebase';
import { collection, query, where, onSnapshot, getDoc, doc, deleteDoc } from 'firebase/firestore';

const TABS = ['All Deal', 'Pending', 'Active', 'Cancelled', 'Completed'];

// 🦆 กำหนดสีและข้อความของป้ายสถานะ
const getStatusBadge = (status) => {
  const s = (status || '').toLowerCase();
  if (s === 'completed') {
    return { bg: '#E8F5E9', text: '#2D6A4F', label: 'Quack Done' };
  }
  if (s === 'cancelled' || s === 'closed') {
    return { bg: '#FFDADA', text: '#C0392B', label: 'Cancelled' };
  }
  if (s === 'pending') {
    return { bg: '#FFFDE7', text: '#FBC02D', label: 'Pending' };
  }
  // Default (active, ontheway)
  return { bg: '#D6EAF8', text: '#2874A6', label: 'Duck Active' };
};

// ══════════════════════════════════════
// Deal Card Component
// ══════════════════════════════════════
const DealCard = ({ item, onPress, onDelete }) => {
  const badge = getStatusBadge(item.status);
  
  let dateStr = "N/A";
  if (item.createdAt) {
    const d = item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
    dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + 
              d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  return (
    <View style={styles.card}>
      <Image 
        source={{ uri: item.itemImage || item.image || 'https://via.placeholder.com/150' }} 
        style={styles.cardImage} 
      />
      <View style={styles.cardContent}>
        <Text style={styles.title} numberOfLines={1}>{item.itemTitle || item.title || 'Unknown Item'}</Text>
        
        {/* Status Row */}
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Status: </Text>
          <View style={[styles.badgeContainer, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>

        {/* Date Row */}
        <View style={styles.dateRow}>
          <Feather name="calendar" size={14} color="#A47551" />
          <Text style={styles.dateText}>{dateStr}</Text>
        </View>

        {/* 🌟 View Button & Delete Button สำหรับสถานะต่างๆ */}
        {item.isDeal ? (
          <TouchableOpacity 
            style={[styles.viewButton, item.status === 'completed' && styles.viewButtonCompleted]} 
            onPress={onPress}
          >
            <Text style={[styles.viewButtonText, item.status === 'completed' && styles.viewButtonTextCompleted]}>
              {item.status === 'completed' ? 'View' : 'Go to Duck Deal'}
            </Text>
          </TouchableOpacity>
        ) : item.status === 'pending' ? (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 'auto' }}>
            <View style={[styles.viewButton, { backgroundColor: '#F9F5EB', borderWidth: 0, flex: 1 }]}>
              <Text style={[styles.viewButtonText, { color: '#8B7355' }]}>Waiting for Owner</Text>
            </View>
            <TouchableOpacity style={styles.deleteRequestBtn} onPress={() => onDelete(item.id)}>
              <Feather name="trash-2" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.viewButton, { backgroundColor: '#FFF5F5', borderWidth: 0 }]}>
            <Text style={[styles.viewButtonText, { color: '#C0392B' }]}>Request Cancelled</Text>
          </View>
        )}
      </View>
    </View>
  );
};

// ══════════════════════════════════════
// Main Screen Component
// ══════════════════════════════════════
export default function DuckDealsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('All Deal');
  const [deals, setDeals] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // 💡 1. ดึงข้อมูล Deal ที่เราเป็นคนรับ
    const qDeals = query(collection(db, 'deals'), where('receiverId', '==', user.uid));
    const unsubDeals = onSnapshot(qDeals, (snap) => {
      setDeals(snap.docs.map(doc => ({ id: doc.id, ...doc.data(), isDeal: true })));
    });

    // 💡 2. ดึงข้อมูล Request ที่เราเป็นคนขอ 
    const qReqs = query(collection(db, 'requests'), where('buyerId', '==', user.uid));
    const unsubReqs = onSnapshot(qReqs, async (snap) => {
      const reqList = [];
      for (const docSnap of snap.docs) {
        const reqData = docSnap.data();
        let title = reqData.itemTitle || 'Requested Item';
        let image = reqData.itemImage || 'https://via.placeholder.com/150';
        let currentStatus = reqData.status || 'pending';

        try {
          const itemSnap = await getDoc(doc(db, 'items', reqData.itemId));
          if (itemSnap.exists()) {
            const itemData = itemSnap.data();
            title = itemData.title || title;
            image = itemData.image || itemData.imageUrls?.[0] || image;
            
            // เช็คว่าถ้าไอเทมมีคนอื่นรับไปแล้ว ให้สถานะเราเป็น cancelled อัตโนมัติ
            if (itemData.status === 'Claimed' && itemData.claimedBy !== user.uid) {
              currentStatus = 'cancelled';
            }
          } else {
             // ไอเทมถูกลบไปแล้ว
             currentStatus = 'cancelled';
          }
        } catch (e) {
          console.log(e);
        }
        
        reqList.push({ 
          id: docSnap.id, 
          ...reqData, 
          isDeal: false, 
          itemTitle: title, 
          itemImage: image,
          status: currentStatus
        });
      }
      setRequests(reqList);
      setLoading(false);
    });

    return () => { unsubDeals(); unsubReqs(); };
  }, []);

  // 🌟 ฟังก์ชันลบ/ยกเลิกคำขอ
  const handleDeleteRequest = (requestId) => {
    Alert.alert(
      'ยกเลิกคำขอ',
      'ต้องการยกเลิกและลบคำขอนี้ใช่หรือไม่?',
      [
        { text: 'ปิด', style: 'cancel' },
        {
          text: 'ใช่, ยกเลิกคำขอ',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'requests', requestId));
            } catch (error) {
              Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถยกเลิกคำขอได้');
            }
          }
        }
      ]
    );
  };

  // 🦆 รวมข้อมูลคำขอและดีลเข้าด้วยกัน
  const combinedList = useMemo(() => {
    const dealItemIds = new Set(deals.map(d => d.itemId));
    const results = [];
    
    requests.forEach(req => {
      // ซ่อน Request ธรรมดาออกไป หากว่าสินค้านั้นสร้างเป็น Deal สำหรับเราเรียบร้อยแล้ว
      if (dealItemIds.has(req.itemId) && req.status === 'approved') return;
      results.push(req);
    });

    deals.forEach(deal => results.push(deal));

    // จัดเรียงตามเวลาที่ล่าสุด
    results.sort((a, b) => {
      const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : tA;
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : tB;
      return timeB - timeA;
    });

    return results;
  }, [deals, requests]);

  // 🦆 กรองข้อมูลด้วยแถบ Tabs (Filter)
  const filteredDeals = combinedList.filter(item => {
    if (activeTab === 'All Deal') return true;
    const s = (item.status || '').toLowerCase();
    
    if (activeTab === 'Pending' && s === 'pending') return true;
    if (activeTab === 'Active' && (s === 'active' || s === 'ontheway')) return true;
    if (activeTab === 'Completed' && s === 'completed') return true;
    if (activeTab === 'Cancelled' && (s === 'cancelled' || s === 'closed')) return true;
    
    return false;
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#5A3D2B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>List Duck Deal</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity 
                key={tab} 
                style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#D4A373" />
        </View>
      ) : filteredDeals.length > 0 ? (
        <FlatList
          data={filteredDeals}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <DealCard 
              item={item} 
              onPress={() => {
                if (item.isDeal) {
                  navigation.navigate('DuckDealDetail', { dealId: item.id });
                }
              }} 
              onDelete={handleDeleteRequest} 
            />
          )}
        />
      ) : (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No deals or requests found 🦆</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8E7' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 15 },
  backBtn: { padding: 4, marginLeft: -4 , marginTop: 30},
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#5A3D2B' , marginTop: 30},
  
  tabContainer: { marginBottom: 15 },
  tabScroll: { paddingHorizontal: 20, gap: 8 },
  tabBtn: { backgroundColor: '#FFF', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#E0CDB5' },
  tabBtnActive: { backgroundColor: '#C8865A', borderColor: '#C8865A' },
  tabText: { color: '#8B7355', fontWeight: '700', fontSize: 13 },
  tabTextActive: { color: '#FFF' },
  
  listContainer: { paddingHorizontal: 20, paddingBottom: 40 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#8B7355', fontSize: 16, fontWeight: '500' },
  
  card: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 16, padding: 12, marginBottom: 16, elevation: 2 },
  cardImage: { width: 90, height: 90, borderRadius: 12, backgroundColor: '#F5F5F5' },
  cardContent: { flex: 1, marginLeft: 14, justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '800', color: '#5A3D2B', marginBottom: 6 },
  
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  statusLabel: { fontSize: 12, color: '#8B7355', fontWeight: '600' },
  badgeContainer: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 4 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  
  dateRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  dateText: { fontSize: 12, color: '#A47551', marginLeft: 6, fontWeight: '600' },
  
  viewButton: { backgroundColor: '#5A3D2B', paddingVertical: 8, borderRadius: 10, alignItems: 'center', marginTop: 'auto', borderWidth: 1.5, borderColor: '#5A3D2B' },
  viewButtonCompleted: { backgroundColor: 'transparent', borderColor: '#D9A77C' }, // พื้นหลังโปร่งใสและขอบสีน้ำตาลอ่อน
  viewButtonText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  viewButtonTextCompleted: { color: '#D9A77C' }, // สีข้อความตรงกับสีขอบ

  // 🌟 สไตล์ของปุ่มลบคำขอ
  deleteRequestBtn: { 
    backgroundColor: '#E76A6A', 
    paddingHorizontal: 14, 
    borderRadius: 8, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
});