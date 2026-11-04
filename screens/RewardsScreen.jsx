import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Dimensions,
  Alert,
  StatusBar,
  SafeAreaView,
  ActivityIndicator
} from 'react-native';
import { Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

// หมายเหตุสำหรับผู้ใช้: โค้ดนี้ถูกออกแบบมาเพื่อใช้งานในสภาพแวดล้อม React Native (Expo) จริงของคุณ
import { db, auth } from '../config/firebase';
import { 
  doc, 
  onSnapshot, 
  collection, 
  query, 
  where,
  updateDoc,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';

const { width } = Dimensions.get('window');

/**
 * 🦆 ระบบคำนวณระดับจากคะแนน
 */
const getLevelInfo = (points) => {
  const safePoints = points || 0;
  const levels = [
    { lv: 1, name: 'BabyDuck', min: 0 },
    { lv: 2, name: 'TinyDuck', min: 1000 },
    { lv: 3, name: 'HappyDuck', min: 2000 },
    { lv: 4, name: 'ChubbyDuck', min: 3000 },
    { lv: 5, name: 'SmartDuck', min: 4000 },
    { lv: 6, name: 'SuperDuck', min: 5000 },
    { lv: 7, name: 'MegaDuck', min: 6000 },
    { lv: 8, name: 'UltraDuck', min: 7000 },
    { lv: 9, name: 'GoldenDuck', min: 8000 },
    { lv: 10, name: 'LegendaryDuck', min: 9000 },
  ];
  for (let i = levels.length - 1; i >= 0; i--) {
    if (safePoints >= levels[i].min) return levels[i];
  }
  return levels[0];
};

const RewardCard = ({ item, onExchange }) => (
  <View style={styles.rewardCard}>
    <Image source={item.image} style={styles.rewardImage} />
    <View style={styles.rewardContent}>
      <Text style={styles.rewardTitle} numberOfLines={2}>{item.title}</Text>
      <Text style={styles.rewardPoints}>{item.points} pts</Text>
      <TouchableOpacity style={styles.exchangeBtn} onPress={onExchange}>
        <Text style={styles.exchangeText}>Exchange</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const RankItem = ({ item }) => (
  <View style={[styles.rankItem, { backgroundColor: item.color }]}>
    <View style={styles.rankLeft}>
      <Text style={styles.rankEmoji}>{item.avatar}</Text>
      <View>
        <Text style={styles.rankName}>{item.name}</Text>
        <Text style={styles.rankLevelName}>{item.levelName}</Text>
      </View>
    </View>
    <Text style={styles.rankPoints}>{item.points} pts</Text>
  </View>
);

export default function App({ navigation }) {
  const [duckPoints, setDuckPoints] = useState(0);
  const [rewards, setRewards] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 🌟 State สำหรับตัวเลขแจ้งเตือน My Items ที่ Bottom Bar
  const [undeliveredCount, setUndeliveredCount] = useState(0);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }
    const uid = user.uid;

    // 1. ดึงข้อมูลคะแนนปัจจุบัน (Real-time)
    const unsubUser = onSnapshot(doc(db, 'users', uid), (docSnap) => {
      if (docSnap.exists()) setDuckPoints(docSnap.data().duckPoints || 0);
    });

    // 2. ดึงรายการของรางวัล (Real-time)
    const unsubRewards = onSnapshot(collection(db, 'rewards'), (snapshot) => {
      setRewards(snapshot.docs.map(d => ({
        id: d.id,
        title: d.data().title,
        points: d.data().pointsRequired,
        image: { uri: d.data().imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80' }
      })));
    });

    // 3. 🏆 อันดับผู้ใช้งาน (Leaderboard)
    const unsubLeaderboard = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(d => {
        const data = d.data();
        const points = data.lifetimePoints !== undefined ? data.lifetimePoints : (data.duckPoints || 0);
        return { id: d.id, name: data.fullName || 'Anonymous', points };
      });
      usersData.sort((a, b) => b.points - a.points);
      const rankData = usersData.slice(0, 3).map((u, i) => ({
        ...u, levelName: getLevelInfo(u.points).name, avatar: ['🥇', '🥈', '🥉'][i], color: ['#FFE5B4', '#E8E8E8', '#FFDAB9'][i]
      }));
      setLeaderboard(rankData);
      setLoading(false);
    });

    // 🌟 4. ระบบ Badge: นับจำนวนรายการที่เรายังไม่ส่งของให้เพื่อน
    const qDeals = query(collection(db, 'deals'), where('giverId', '==', uid));
    const unsubDeals = onSnapshot(qDeals, (snap) => {
      const pendingCount = snap.docs.filter(d => {
        const s = (d.data().status || '').toLowerCase();
        // นับรายการที่ยังไม่ completed หรือถูกยกเลิก
        return s !== 'completed' && s !== 'cancelled' && s !== 'closed';
      }).length;
      setUndeliveredCount(pendingCount);
    });

    return () => { 
      unsubUser(); 
      unsubRewards(); 
      unsubLeaderboard(); 
      unsubDeals(); 
    };
  }, []);

  const handleExchange = (reward) => {
    // 1. เช็คก่อนว่าคะแนนพอไหม
    if (duckPoints < reward.points) {
      Alert.alert('คะแนนไม่พอ', 'คุณมี DuckPoints ไม่เพียงพอสำหรับแลกของรางวัลนี้ก้าบ 🦆');
      return;
    }

    // 2. ถามเพื่อยืนยันการแลก
    Alert.alert(
      'ยืนยันการแลกรางวัล',
      `คุณต้องการใช้ ${reward.points} pts เพื่อแลก "${reward.title}" ใช่หรือไม่?`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        { 
          text: 'ยืนยัน', 
          onPress: async () => {
            try {
              const user = auth.currentUser;
              if (!user) return;
              
              // 3. หักคะแนน DuckPoints ปัจจุบันของผู้ใช้
              const userRef = doc(db, 'users', user.uid);
              await updateDoc(userRef, {
                duckPoints: duckPoints - reward.points
              });

              // 4. บันทึกประวัติเพื่อให้ไปโชว์ในหน้า PointsHistory (แก้ไขชื่อคอลเลกชันและฟิลด์ให้ตรงกัน)
              await addDoc(collection(db, 'pointHistory'), {
                userId: user.uid,
                title: `Redeemed: ${reward.title}`, // ใช้คำว่า title ตามที่ PointsHistory ต้องการอ่าน
                points: -reward.points,
                createdAt: serverTimestamp(),
                type: 'redeem'
              });

              // 5. บันทึกของรางวัลลงในหน้า My Rewards
              await addDoc(collection(db, 'redeemed_rewards'), {
                userId: user.uid,
                rewardId: reward.id,
                title: reward.title,
                imageUrl: reward.image.uri || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80',
                pointsUsed: reward.points,
                status: 'ready',
                redeemedAt: serverTimestamp()
              });

              Alert.alert('สำเร็จ! 🎉', 'แลกของรางวัลเรียบร้อยแล้ว เช็คได้ที่ปุ่ม My Rewards เลยครับ');
            } catch (error) {
              console.error("Error exchanging reward:", error);
              Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถแลกรางวัลได้ กรุณาลองใหม่อีกครั้ง');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}><ActivityIndicator size="large" color="#5A3D2B" /></View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}><Text style={styles.headerTitle}>Points & Rewards</Text></View>
        
        <View style={styles.pointsCard}>
          <View style={styles.pointsLeft}>
            <Text style={styles.pointsLabel}>YOUR DUCKDUCK</Text>
            <View style={styles.pointsRow}>
              <Image source={{ uri: 'https://img2.pic.in.th/duck3.png' }} style={styles.duckIcon} />
              <Text style={styles.pointsValue}>{duckPoints} <Text style={styles.ptsUnit}>pts</Text></Text>
            </View>
          </View>
          <TouchableOpacity style={styles.viewHistoryBtn} onPress={() => navigation.navigate('PointsHistory')}>
            <Text style={styles.viewHistoryText}>History</Text>
            <Feather name="arrow-right" size={14} color="#8B7355" />
          </TouchableOpacity>
        </View>

        {/* 🌟 ส่วนที่เพิ่มใหม่: จัดกลุ่ม Title และปุ่ม My Rewards ไว้ด้วยกัน */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Available Rewards</Text>
          <TouchableOpacity 
            style={styles.myRewardsBtn} 
            onPress={() => navigation.navigate('MyRewards')}
          >
            <MaterialCommunityIcons name="bag-personal-outline" size={16} color="#8B7355" />
            <Text style={styles.myRewardsText}>My Rewards</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rewardsContainer}>
          {rewards.map(item => <RewardCard key={item.id} item={item} onExchange={() => handleExchange(item)} />)}
        </ScrollView>

        <View style={styles.rankHeader}><View style={styles.rankBadge}><Text style={styles.rankBadgeText}>RANK DUCK!!</Text></View></View>
        <View style={styles.rankList}>{leaderboard.map(item => <RankItem key={item.id} item={item} />)}</View>
      </ScrollView>

      {/* 🧭 Navigation Bottom Bar พร้อมระบบ Badge */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('Home')}>
          <Ionicons name="home-outline" size={26} color="#B0A090" />
          <Text style={styles.tabLabel}>Home</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('MyItems')}>
          <View style={styles.iconWrapper}>
            <Feather name="shopping-bag" size={24} color="#B0A090" />
            {/* 🔴 แก้ไขบัคหน้าแดงตรงนี้ (เปลี่ยนจาก && เป็น Ternary Operator) */}
            {undeliveredCount > 0 ? (
              <View style={styles.navBadge}>
                <Text style={styles.navBadgeText}>{undeliveredCount > 99 ? '99+' : undeliveredCount}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.tabLabel}>My Items</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.centerButton} onPress={() => navigation.navigate('QRScan')}>
          <View style={styles.centerButtonInner}>
            <MaterialCommunityIcons name="qrcode-scan" size={28} color="#FFF" />
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <MaterialCommunityIcons name="gift" size={26} color="#5A3D2B" />
          <Text style={styles.tabLabelActive}>Rewards</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('Profile')}>
          <Feather name="user" size={24} color="#B0A090" />
          <Text style={styles.tabLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8E7' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF8E7' },
  scrollContent: { paddingBottom: 120 },
  header: { alignItems: 'center', paddingTop: 50, paddingBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#5A3D2B' },
  pointsCard: { flexDirection: 'row', backgroundColor: '#FFF', marginHorizontal: 20, borderRadius: 20, padding: 20, justifyContent: 'space-between', alignItems: 'center', elevation: 2 },
  pointsLeft: { flex: 1 },
  pointsLabel: { fontSize: 11, color: '#D4A373', fontWeight: '700', marginBottom: 4 },
  pointsRow: { flexDirection: 'row', alignItems: 'center' },
  duckIcon: { width: 50, height: 50, marginRight: 8, resizeMode: 'contain' },
  pointsValue: { fontSize: 28, fontWeight: '800', color: '#5A3D2B' },
  ptsUnit: { fontSize: 16, fontWeight: '600', color: '#8B7355' },
  viewHistoryBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5E6D3', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 15 },
  viewHistoryText: { fontSize: 12, color: '#8B7355', marginRight: 4, fontWeight: '600' },
  
  // 🌟 สไตล์ที่เพิ่มใหม่สำหรับ Header ของส่วนรางวัล
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 25,
    marginBottom: 15,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#5A3D2B' },
  myRewardsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5E6D3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    gap: 4,
  },
  myRewardsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8B7355',
    marginLeft: 4,
  },

  rewardsContainer: { paddingLeft: 20, paddingRight: 10 },
  rewardCard: { width: 150, backgroundColor: '#FFF', borderRadius: 16, marginRight: 12, overflow: 'hidden', elevation: 2 },
  rewardImage: { width: '100%', height: 90, resizeMode: 'cover' },
  rewardContent: { padding: 12 },
  rewardTitle: { fontSize: 13, fontWeight: '700', color: '#5A3D2B', marginBottom: 4, minHeight: 34 },
  rewardPoints: { fontSize: 15, fontWeight: '800', color: '#D4A373', marginBottom: 8 },
  exchangeBtn: { backgroundColor: '#5A3D2B', paddingVertical: 6, borderRadius: 8, alignItems: 'center' },
  exchangeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  rankHeader: { marginHorizontal: 20, marginTop: 30, marginBottom: 15 },
  rankBadge: { backgroundColor: '#D4A373', alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 12 },
  rankBadgeText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  rankList: { marginHorizontal: 20, gap: 10 },
  rankItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16 },
  rankLeft: { flexDirection: 'row', alignItems: 'center' },
  rankEmoji: { fontSize: 24, marginRight: 12 },
  rankName: { fontSize: 15, fontWeight: '700', color: '#5A3D2B' },
  rankLevelName: { fontSize: 11, color: '#8B7355', fontWeight: '600' },
  rankPoints: { fontSize: 15, fontWeight: '800', color: '#5A3D2B' },
  bottomBar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: '#FFF', paddingVertical: 8, paddingBottom: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, elevation: 10, position: 'absolute', bottom: 0, width: '100%' },
  tabItem: { alignItems: 'center', width: 60 },
  tabLabel: { fontSize: 10, color: '#B0A090', marginTop: 4 },
  tabLabelActive: { fontSize: 10, color: '#5A3D2B', fontWeight: '700', marginTop: 4 },
  centerButton: { marginTop: -35 },
  centerButtonInner: { width: 64, height: 64, backgroundColor: '#5A7D5A', borderRadius: 18, justifyContent: 'center', alignItems: 'center', elevation: 10 },
  iconWrapper: { position: 'relative', justifyContent: 'center', alignItems: 'center' },
  navBadge: { position: 'absolute', top: -5, right: -8, backgroundColor: '#E76A6A', borderRadius: 10, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#FFF' },
  navBadgeText: { color: '#FFF', fontSize: 8, fontWeight: 'bold' },
});