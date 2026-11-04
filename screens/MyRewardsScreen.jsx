import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  ActivityIndicator,
  SafeAreaView,
  Modal
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { db, auth } from '../config/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function MyRewardsScreen({ navigation }) {
  const [myRewards, setMyRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State สำหรับควบคุม Popup รายละเอียด
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedReward, setSelectedReward] = useState(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // ดึงข้อมูลคอลเลกชันประวัติการแลกรางวัลของผู้ใช้คนนี้
    const q = query(
      collection(db, 'redeemed_rewards'), 
      where('userId', '==', user.uid)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // เรียงลำดับจากล่าสุดไปเก่าสุด
      items.sort((a, b) => (b.redeemedAt?.seconds || 0) - (a.redeemedAt?.seconds || 0));
      
      setMyRewards(items);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ฟังก์ชันช่วยจัดรูปแบบวันที่
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // เปิด Popup และกำหนดของรางวัลที่ถูกเลือก
  const openRewardDetails = (item) => {
    setSelectedReward(item);
    setModalVisible(true);
  };

  // สร้าง Card สำหรับแสดงรายการของรางวัล
  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => openRewardDetails(item)}
      activeOpacity={0.7}
    >
      <Image 
        source={{ uri: item.imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80' }} 
        style={styles.image} 
      />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.date}>แลกเมื่อ: {formatDate(item.redeemedAt)}</Text>
        
        <View style={styles.bottomRow}>
          <Text style={styles.pointsUsed}>-{item.pointsUsed} pts</Text>
          <View style={[
            styles.statusBadge, 
            item.status === 'used' ? styles.statusUsed : styles.statusReady
          ]}>
            <Text style={styles.statusText}>
              {item.status === 'used' ? 'ใช้งานแล้ว' : 'พร้อมใช้งาน'}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="chevron-left" size={28} color="#5A3D2B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Rewards</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#5A3D2B" />
        </View>
      ) : myRewards.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="gift-off-outline" size={64} color="#D4A373" />
          <Text style={styles.emptyTitle}>No Rewards</Text>
          <Text style={styles.emptyDesc}>คุณยังไม่ได้แลกของรางวัลใดๆ กลับไปสะสมคะแนน DuckPoints แล้วมาแลกกันนะ!</Text>

          <TouchableOpacity 
            style={styles.goBackBtn} 
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.goBackText}>ดูของรางวัลที่น่าสนใจ</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={myRewards}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* --- Modal แสดงรายละเอียดของรางวัล --- */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedReward && (
              <>
                <Image 
                  source={{ uri: selectedReward.imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80' }} 
                  style={styles.modalImage} 
                />
                
                <View style={[
                  styles.modalStatusBadge, 
                  selectedReward.status === 'used' ? styles.statusUsed : styles.statusReady
                ]}>
                  <Text style={styles.statusText}>
                    {selectedReward.status === 'used' ? 'Used' : 'Ready to Use'}
                  </Text>
                </View>

                <Text style={styles.modalTitle}>{selectedReward.title}</Text>
                
                <View style={styles.modalDetailsBox}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Redemption Date:</Text>
                    <Text style={styles.detailValue}>{formatDate(selectedReward.redeemedAt)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Points Used:</Text>
                    <Text style={styles.detailValuePoints}>-{selectedReward.pointsUsed} pts</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Reference Code:</Text>
                    <Text style={styles.detailValue}>{selectedReward.id.substring(0, 8).toUpperCase()}</Text>
                  </View>
                </View>

                {/* 🌟 การสร้าง QR Code จริงด้วย API 🌟 */}
                <View style={styles.qrCodeContainer}>
                  {selectedReward.status === 'used' ? (
                     <View style={styles.qrCodeOverlay}>
                       <MaterialCommunityIcons name="check-circle" size={48} color="#FFF" />
                       <Text style={styles.qrCodeUsedText}>Used</Text>
                     </View>
                  ) : null}
                  <Image 
                    // ใช้ API แปลงรหัสไอดีเป็นรูป QR Code ทันที
                    source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${selectedReward.id}` }} 
                    style={[styles.qrCodeImage, selectedReward.status === 'used' && styles.qrCodeFaded]}
                  />
                  <Text style={styles.qrCodeHint}>แสดง QR Code นี้ให้พนักงาน</Text>
                </View>

                <TouchableOpacity 
                  style={styles.modalCloseBtn} 
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.modalCloseText}>Close Window</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8E7' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 20, 
    paddingTop: 10,
    paddingBottom: 20 
  },
  backBtn: { padding: 4 , marginTop: 50},
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#5A3D2B', marginTop: 50 },
  list: { paddingHorizontal: 20, paddingBottom: 30 },
  card: { 
    flexDirection: 'row', 
    backgroundColor: '#FFF', 
    borderRadius: 16, 
    padding: 12, 
    marginBottom: 15, 
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  image: { width: 80, height: 80, borderRadius: 12, marginRight: 15, backgroundColor: '#F5E6D3' },
  info: { flex: 1, justifyContent: 'space-between', paddingVertical: 4 },
  title: { fontSize: 15, fontWeight: '700', color: '#5A3D2B', marginBottom: 4 },
  date: { fontSize: 12, color: '#8B7355', marginBottom: 8 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pointsUsed: { fontSize: 13, fontWeight: '800', color: '#E76A6A' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusReady: { backgroundColor: '#5A7D5A' },
  statusUsed: { backgroundColor: '#D4A373' },
  statusText: { fontSize: 10, color: '#FFF', fontWeight: 'bold' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#5A3D2B', marginTop: 20, marginBottom: 10 },
  emptyDesc: { fontSize: 14, color: '#8B7355', textAlign: 'center', lineHeight: 22, marginBottom: 30 },
  goBackBtn: { backgroundColor: '#5A3D2B', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 },
  goBackText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },

  // --- Modal Styles ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  modalImage: {
    width: 120,
    height: 120,
    borderRadius: 16,
    marginBottom: 15,
    backgroundColor: '#F5E6D3'
  },
  modalStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 15
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#5A3D2B',
    textAlign: 'center',
    marginBottom: 20
  },
  modalDetailsBox: {
    width: '100%',
    backgroundColor: '#FFF8E7',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  detailLabel: {
    fontSize: 13,
    color: '#8B7355',
    fontWeight: '600'
  },
  detailValue: {
    fontSize: 13,
    color: '#5A3D2B',
    fontWeight: '700'
  },
  detailValuePoints: {
    fontSize: 14,
    color: '#E76A6A',
    fontWeight: '800'
  },
  qrCodeContainer: {
    alignItems: 'center',
    marginBottom: 25,
    position: 'relative',
    backgroundColor: '#FFF',
    padding: 10,
    borderRadius: 12,
  },
  qrCodeImage: {
    width: 160,
    height: 160,
    marginBottom: 10,
  },
  qrCodeFaded: {
    opacity: 0.2
  },
  qrCodeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 163, 115, 0.8)',
    borderRadius: 12,
    zIndex: 1,
  },
  qrCodeUsedText: {
    color: '#FFF',
    fontWeight: 'bold',
    marginTop: 8,
    fontSize: 16
  },
  qrCodeHint: {
    fontSize: 12,
    color: '#B0A090'
  },
  modalCloseBtn: {
    backgroundColor: '#5A3D2B',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center'
  },
  modalCloseText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16
  }
});