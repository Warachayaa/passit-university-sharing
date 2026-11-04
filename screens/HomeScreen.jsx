import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Modal,
  TextInput,
  Dimensions,
  Alert,
  Platform,
  FlatList,
  ActivityIndicator
} from 'react-native';
import { Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

import { auth, db } from '../config/firebase';
import { 
  doc, getDoc, setDoc, updateDoc, serverTimestamp, getDocs, 
  collection, query, orderBy, limit, increment, addDoc, 
  where, onSnapshot 
} from 'firebase/firestore';
import * as Location from 'expo-location';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2; 

const categories = [
  { id: 'All', label: 'All', icon: 'paw' },
  { id: 'Books', label: 'Books', icon: 'book-open-variant' },
  { id: 'Notes', label: 'Notes', icon: 'notebook-outline' },
  { id: 'Tech', label: 'Tech', icon: 'laptop' },
  { id: 'Clothes', label: 'Clothes', icon: 'tshirt-crew-outline' },
  { id: 'Dorm', label: 'Dorm', icon: 'bed-outline' },
  { id: 'Food', label: 'Food', icon: 'silverware-fork-knife' },
  { id: 'Beauty', label: 'Beauty', icon: 'lipstick' },
  { id: 'Free', label: 'Free', icon: 'gift-outline' },
  { id: 'Fun', label: 'Fun', icon: 'gamepad-variant-outline' },
  { id: 'Other', label: 'Other', icon: 'dots-horizontal' },
];

const statusBadge = (status) => {
  switch (status) {
    case 'Available': return { bg: '#E8F5E9', color: '#4CAF50', text: 'Available' };
    case 'Duck Request': return { bg: '#FFFDE7', color: '#FBC02D', text: 'Duck Request' };
    case 'Claimed': return { bg: '#FFF3E0', color: '#FF9800', text: 'Claimed' };
    default: return { bg: '#F5F5F5', color: '#757575', text: status || 'Unknown' };
  }
};

const getImageUri = (item) => {
  return item?.image || item?.imageUrls?.[0] || null;
};

const haversineKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const ItemCard = ({ item, distanceText, onPress, style }) => {
  const badge = statusBadge(item.status);
  return (
    <TouchableOpacity style={[styles.card, style]} activeOpacity={0.85} onPress={onPress}>
      <Image source={{ uri: getImageUri(item) || 'https://via.placeholder.com/400x300' }} style={styles.cardImage} />
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <View style={styles.cardFooter}>
          <View style={styles.distanceRow}><Ionicons name="location-outline" size={14} color="#6B8E6B" /><Text style={styles.distanceText}>{distanceText || '— km'}</Text></View>
          <View style={[styles.availableBadge, { backgroundColor: badge.bg }]}><Text style={[styles.availableText, { color: badge.color }]}>{badge.text}</Text></View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const DailySignInModal = ({ visible, onClose, claimedDays, onClaim, hasClaimedToday, isClaiming }) => {
  const nextDay = claimedDays.length + 1;
  let btnText = 'Claim +15 pts';
  let isDisabled = false;
  if (hasClaimedToday) { btnText = 'Come back tomorrow 🐥'; isDisabled = true; } 
  else if (nextDay > 7) { btnText = 'All Days Claimed 🎉'; isDisabled = true; } 
  else if (isClaiming) { btnText = 'Claiming... 🦆'; isDisabled = true; }
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <TouchableOpacity style={modalStyles.closeButton} onPress={onClose}><Text style={{ fontSize: 28, color: '#5A3D2B', fontWeight: '700' }}>×</Text></TouchableOpacity>
          <Text style={modalStyles.title}>7 Daily Sign-in DuckPoint</Text>
          <Text style={{ color: '#8B7355', marginBottom: 15, marginTop: 1 }}>+15 pts per day</Text>
          <View style={modalStyles.daysContainer}>
            <View style={modalStyles.row}>
              {[1, 2, 3, 4].map((day) => {
                const isClaimed = claimedDays.includes(day);
                const isNext = !hasClaimedToday && day === nextDay;
                return (
                  <View key={day} style={modalStyles.dayItem}>
                    <View style={[modalStyles.duckCircle, isClaimed && modalStyles.duckCircleClaimed, isNext && modalStyles.duckCircleNext]}><Text style={modalStyles.duck}>{isClaimed ? '🌟' : '🐥'}</Text></View>
                    <Text style={[modalStyles.dayText, isClaimed && modalStyles.dayTextClaimed]}>Day {day}</Text>
                  </View>
                );
              })}
            </View>
            <View style={modalStyles.row}>
              {[5, 6, 7].map((day) => {
                const isClaimed = claimedDays.includes(day);
                const isNext = !hasClaimedToday && day === nextDay;
                return (
                  <View key={day} style={modalStyles.dayItem}>
                    <View style={[modalStyles.duckCircle, isClaimed && modalStyles.duckCircleClaimed, isNext && modalStyles.duckCircleNext]}><Text style={modalStyles.duck}>{isClaimed ? '🌟' : '🐥'}</Text></View>
                    <Text style={[modalStyles.dayText, isClaimed && modalStyles.dayTextClaimed]}>Day {day}</Text>
                  </View>
                );
              })}
            </View>
          </View>
          <TouchableOpacity style={[modalStyles.claimButton, isDisabled && modalStyles.claimButtonDisabled]} onPress={onClaim} disabled={isDisabled}><Text style={modalStyles.claimText}>{btnText}</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default function HomeScreen({ navigation }) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchText, setSearchText] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showAllAvailableModal, setShowAllAvailableModal] = useState(false);
  const [claimedDays, setClaimedDays] = useState([]);
  const [hasClaimedToday, setHasClaimedToday] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [loadingHome, setLoadingHome] = useState(true);
  const [allItems, setAllItems] = useState([]);
  const [userCoords, setUserCoords] = useState(null);
  const [undeliveredCount, setUndeliveredCount] = useState(0);
  const [banNotifCount, setBanNotifCount] = useState(0); // ✅ ย้ายมาอยู่ในนี้

  const user = auth?.currentUser;

  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      try {
        const docRef = doc(db, 'dailySignIn', user.uid);
        const snap = await getDoc(docRef);
        const today = new Date();
        const todayStr = today.toDateString();
        if (snap.exists()) {
          const data = snap.data();
          const currentClaimedDays = data.claimedDays || [];
          const lastClaim = data.lastClaimDate || '';
          setClaimedDays(currentClaimedDays);
          if (currentClaimedDays.length >= 7) { setHasClaimedToday(true); return; }
          if (lastClaim === todayStr) { setHasClaimedToday(true); } 
          else { setHasClaimedToday(false); setTimeout(() => setShowModal(true), 600); }
        } else {
          await setDoc(docRef, { uid: user.uid, claimedDays: [], lastClaimDate: null, createdAt: serverTimestamp() });
          setClaimedDays([]); setHasClaimedToday(false); setTimeout(() => setShowModal(true), 600);
        }
      } catch (e) { console.log(e); }
    })();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    
    // requests listener
    const qReq = query(collection(db, 'requests'), where('sellerId', '==', user.uid), where('status', '==', 'pending'));
    const unsubReq = onSnapshot(qReq, (snap) => { 
      setPendingRequestsCount(snap.size); 
    });

    // deals listener
    const qDeals = query(collection(db, 'deals'), where('giverId', '==', user.uid));
    const unsubDeals = onSnapshot(qDeals, (snap) => {
      const pending = snap.docs.filter(d => {
        const s = (d.data().status || '').toLowerCase();
        return s !== 'completed' && s !== 'cancelled' && s !== 'closed';
      });
      setUndeliveredCount(pending.length);
    });

    // ✅ ban notifications listener
    const qBan = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('isRead', '==', false)
    );
    const unsubBan = onSnapshot(qBan, (snap) => {
      setBanNotifCount(snap.size);
    });

    return () => { unsubReq(); unsubDeals(); unsubBan(); };
  }, [user?.uid]);

  const handleClaim = async () => {
    if (!user?.uid || isClaiming || hasClaimedToday) return;
    let nextDay = claimedDays.length + 1;
    if (nextDay > 7) return;
    setIsClaiming(true);
    const updatedClaimedDays = [...claimedDays, nextDay];
    const todayStr = new Date().toDateString();
    const pointsToGive = 15;
    try {
      const dailyRef = doc(db, 'dailySignIn', user.uid);
      const userRef = doc(db, 'users', user.uid);
      const historyRef = collection(db, 'pointHistory');
      await updateDoc(dailyRef, { claimedDays: updatedClaimedDays, lastClaimDate: todayStr });
      await setDoc(userRef, { duckPoints: increment(pointsToGive), lifetimePoints: increment(pointsToGive) }, { merge: true });
      await addDoc(historyRef, { userId: user.uid, title: `Streak: Daily Sign-in Day ${nextDay}`, points: pointsToGive, createdAt: serverTimestamp() });
      setClaimedDays(updatedClaimedDays); setHasClaimedToday(true);
      Alert.alert('Quack! 🎉', `You received ${pointsToGive} DuckPoints!`);
      setTimeout(() => setShowModal(false), 1200);
    } catch (error) { Alert.alert("Error", "Could not claim points."); } finally { setIsClaiming(false); }
  };

  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS !== 'web') {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const pos = await Location.getCurrentPositionAsync({});
            setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          }
        }
      } catch (locError) {
        console.log("Location fetch failed, ignoring: ", locError.message);
      }

      try {
        const q = query(collection(db, 'items'), orderBy('createdAt', 'desc'), limit(50));
        const snap = await getDocs(q);
        setAllItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (itemError) { 
        console.log("Error fetching items: ", itemError); 
      } finally { 
        setLoadingHome(false); 
      }
    })();
  }, []);

  const filteredItems = useMemo(() => {
    return allItems.filter(it => it.status === 'Available')
      .filter(it => selectedCategory === 'All' ? true : it.category === selectedCategory)
      .filter(it => !searchText.trim() ? true : (it.title || '').toLowerCase().includes(searchText.trim().toLowerCase()));
  }, [allItems, selectedCategory, searchText]);

  const distanceForItem = (it) => {
    if (!userCoords || typeof it?.location?.lat !== 'number') return null;
    return `${haversineKm(userCoords.lat, userCoords.lng, it.location.lat, it.location.lng).toFixed(1)} km`;
  };

  if (loadingHome) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF8E7' }}><ActivityIndicator size="large" color="#D4A373" /></View>;

  const totalNotifCount = pendingRequestsCount + banNotifCount; // ✅ รวม badge

  return (
    <View style={styles.container}>
      <DailySignInModal visible={showModal} onClose={() => setShowModal(false)} claimedDays={claimedDays} onClaim={handleClaim} hasClaimedToday={hasClaimedToday} isClaiming={isClaiming} />
      
      <Modal visible={showAllAvailableModal} animationType="slide"><View style={{ flex: 1, backgroundColor: '#FFF8E7' }}><SafeAreaView /><View style={styles.modalHeader}><TouchableOpacity onPress={() => setShowAllAvailableModal(false)}><Feather name="arrow-left" size={24} color="#5A3D2B" /></TouchableOpacity><Text style={styles.modalTitle}>All Items</Text></View><FlatList data={filteredItems} numColumns={2} keyExtractor={item => item.id} contentContainerStyle={{ padding: 20 }} columnWrapperStyle={{ justifyContent: 'space-between' }} renderItem={({ item }) => <ItemCard item={item} distanceText={distanceForItem(item)} onPress={() => { setShowAllAvailableModal(false); navigation?.navigate('ItemData', { itemId: item.id }); }} />} /></View></Modal>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.navigate('Home')}>
            <View style={styles.logoBox}>
              <Image 
                source={require('../assets/logo.png')} 
                style={styles.logo} 
                onError={() => {}} 
              />
            </View>
          </TouchableOpacity>

          {/* ✅ bell กด → Notifications, badge รวมทั้งคู่ */}
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.bellIconContainer}>
            <MaterialCommunityIcons name="bell-outline" size={26} color="#5A3D2B" />
            {totalNotifCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {totalNotifCount > 9 ? '9+' : totalNotifCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}><View style={styles.searchBox}><Feather name="search" size={20} color="#B08968" /><TextInput style={styles.searchInput} placeholder="Search items" placeholderTextColor="#B08968" value={searchText} onChangeText={setSearchText} /></View></View>

        {/* Categories */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryContainer}>{categories.map(cat => <TouchableOpacity key={cat.id} style={[styles.categoryChip, selectedCategory === cat.id && styles.categoryChipActive]} onPress={() => setSelectedCategory(cat.id)}><MaterialCommunityIcons name={cat.icon} size={18} color={selectedCategory === cat.id ? '#FFF' : '#8B7355'} /><Text style={[styles.categoryText, selectedCategory === cat.id && styles.categoryTextActive]}>{cat.label}</Text></TouchableOpacity>)}</ScrollView>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Duck Picks</Text><TouchableOpacity onPress={() => setShowAllAvailableModal(true)}><Text style={styles.seeAll}>See All</Text></TouchableOpacity></View>
        
        {filteredItems.length === 0 ? (
           <View style={{ padding: 40, alignItems: 'center' }}>
             <MaterialCommunityIcons name="duck" size={48} color="#D4A373" />
             <Text style={{ color: '#8B7355', marginTop: 10, textAlign: 'center' }}>No items found yet.</Text>
           </View>
        ) : (
          <FlatList data={filteredItems.slice(0, 10)} horizontal showsHorizontalScrollIndicator={false} keyExtractor={item => item.id} contentContainerStyle={{ paddingHorizontal: 20 }} renderItem={({ item }) => <ItemCard item={item} distanceText={distanceForItem(item)} onPress={() => navigation?.navigate('ItemData', { itemId: item.id })} style={{ marginRight: 12 }} />} />
        )}

        <View style={styles.sectionHeader}><View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={styles.sectionTitle}>Recently Added</Text><Feather name="clock" size={15} color="#B08968" style={{ marginLeft: 6 }} /></View></View>
        <FlatList data={filteredItems} numColumns={2} keyExtractor={item => item.id} scrollEnabled={false} contentContainerStyle={{ paddingHorizontal: 20 }} columnWrapperStyle={{ justifyContent: 'space-between' }} renderItem={({ item }) => <ItemCard item={item} distanceText={distanceForItem(item)} onPress={() => navigation?.navigate('ItemData', { itemId: item.id })} />} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => navigation?.navigate('AddItem')}><Feather name="plus" size={28} color="#FFF" /></TouchableOpacity>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.tabItem}><Ionicons name="home" size={26} color="#5A3D2B" /><Text style={styles.tabLabelActive}>Home</Text></TouchableOpacity>
        
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation?.navigate('MyItems')}>
          <View style={styles.iconWrapper}>
            <Feather name="shopping-bag" size={24} color="#B0A090" />
            {undeliveredCount > 0 && <View style={styles.navBadge}><Text style={styles.navBadgeText}>{undeliveredCount > 99 ? '99+' : undeliveredCount}</Text></View>}
          </View>
          <Text style={styles.tabLabel}>My Items</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.centerButton} onPress={() => navigation?.navigate('QRScan')}><View style={styles.centerButtonInner}><MaterialCommunityIcons name="qrcode-scan" size={28} color="#FFF" /></View></TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation?.navigate('Rewards')}><MaterialCommunityIcons name="gift-outline" size={26} color="#B0A090" /><Text style={styles.tabLabel}>Rewards</Text></TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation?.navigate('Profile')}><Feather name="user" size={24} color="#B0A090" /><Text style={styles.tabLabel}>Profile</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const modalStyles = StyleSheet.create({ overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' }, container: { width: width * 0.88, backgroundColor: '#FFF8E7', borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 3, borderColor: '#D9A77C' }, closeButton: { position: 'absolute', top: 12, right: 16 }, title: { fontSize: 18, fontWeight: '800', color: '#5A3D2B', marginTop: 10, textAlign: 'center' }, daysContainer: { marginBottom: 20 }, row: { flexDirection: 'row', justifyContent: 'center', marginBottom: 16, gap: 18 }, dayItem: { alignItems: 'center' }, duckCircle: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#F5E6D3', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#E0C8A0' }, duckCircleClaimed: { backgroundColor: '#FFEB3B', borderColor: '#FFC107' }, duckCircleNext: { borderColor: '#4CAF50', borderWidth: 3.5 }, duck: { fontSize: 32 }, dayText: { marginTop: 6, fontSize: 13, fontWeight: '600', color: '#8B7355' }, dayTextClaimed: { color: '#4CAF50' }, claimButton: { backgroundColor: '#4CAF50', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 16 }, claimButtonDisabled: { backgroundColor: '#A5D6A7' }, claimText: { color: '#FFF', fontSize: 16, fontWeight: '700' } });

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8E7' },
  scrollContent: { paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 10 },
  logoBox: { backgroundColor: '#FDE4B4', borderRadius: 14, padding: 6, elevation: 3 },
  logo: { width: 42, height: 42, resizeMode: 'contain' },
  bellIconContainer: { position: 'relative', padding: 4 },
  notificationBadge: { position: 'absolute', right: 0, top: 2, backgroundColor: '#E76A6A', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#FFF8E7' },
  notificationBadgeText: { color: '#FFF', fontSize: 9, fontWeight: 'bold' },
  searchContainer: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 16 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 14, height: 48, borderWidth: 1, borderColor: '#EFD9B4' },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: '#5A3D2B' },
  categoryContainer: { paddingHorizontal: 20, paddingBottom: 10 },
  categoryChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#EFD9B4', marginRight: 10 },
  categoryChipActive: { backgroundColor: '#8B7355', borderColor: '#8B7355' },
  categoryText: { fontSize: 15, fontWeight: '600', color: '#8B7355' },
  categoryTextActive: { color: '#FFF' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#5A3D2B' },
  seeAll: { color: '#5A7D5A', fontWeight: '600' },
  card: { width: CARD_WIDTH, backgroundColor: '#FFF', borderRadius: 16, marginBottom: 16, overflow: 'hidden', elevation: 4 },
  cardImage: { width: '100%', height: 130, resizeMode: 'cover' },
  cardBody: { padding: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#5A3D2B', marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  distanceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  distanceText: { fontSize: 13, color: '#6B8E6B' },
  availableBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  availableText: { fontSize: 12, fontWeight: '700' },
  fab: { position: 'absolute', bottom: 85, right: 20, width: 56, height: 56, backgroundColor: '#5A7D5A', borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 8, zIndex: 50 },
  bottomBar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: '#FFF', paddingVertical: 8, paddingBottom: 18, borderTopLeftRadius: 24, borderTopRightRadius: 24, elevation: 10, position: 'absolute', bottom: 0, width: '100%', zIndex: 100 },
  tabItem: { alignItems: 'center', width: 60 },
  tabLabel: { fontSize: 10, color: '#B0A090', marginTop: 4 },
  tabLabelActive: { fontSize: 10, color: '#5A3D2B', marginTop: 4, fontWeight: 'bold' },
  centerButton: { marginTop: -35 },
  centerButtonInner: { width: 64, height: 64, backgroundColor: '#5A7D5A', borderRadius: 18, justifyContent: 'center', alignItems: 'center', elevation: 10 },
  iconWrapper: { position: 'relative', justifyContent: 'center', alignItems: 'center' },
  navBadge: { position: 'absolute', top: -5, right: -8, backgroundColor: '#E76A6A', borderRadius: 10, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#FFF' },
  navBadgeText: { color: '#FFF', fontSize: 8, fontWeight: 'bold' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 40, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#EFD9B4', backgroundColor: '#FFF8E7' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#5A3D2B', marginLeft: 12 },
});