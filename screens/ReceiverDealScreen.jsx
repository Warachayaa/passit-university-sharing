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
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import QRCode from 'react-native-qrcode-svg';
import * as Location from 'expo-location';
import { getDistance } from 'geolib';

import { auth, db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function ReceiverDealScreen({ navigation, route }) {
  const { dealId } = route.params || {};

  const [deal, setDeal] = useState(null);
  const [giver, setGiver] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [distance, setDistance] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDealData();
    getCurrentLocation();
  }, [dealId]);

  // โหลดข้อมูลดีลและผู้ส่ง
  const loadDealData = async () => {
    try {
      const dealSnap = await getDoc(doc(db, 'deals', dealId));
      if (dealSnap.exists()) {
        const data = dealSnap.data();
        setDeal(data);

        const giverSnap = await getDoc(doc(db, 'users', data.giverId));
        if (giverSnap.exists()) setGiver(giverSnap.data());
      }
    } catch (error) {
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  // ขอตำแหน่งปัจจุบันของผู้รับเพื่อคำนวณระยะทาง
  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({});
      setUserLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    } catch (error) {
      console.error('Location Error:', error);
    }
  };

  // คำนวณระยะทางและเวลาที่เหลือ
  useEffect(() => {
    if (!deal || !userLocation || !deal.location?.lat) return;

    // คำนวณระยะทาง (หน่วยกิโลเมตร)
    const distMeters = getDistance(
      { latitude: userLocation.latitude, longitude: userLocation.longitude },
      { latitude: deal.location.lat, longitude: deal.location.lng }
    );
    setDistance((distMeters / 1000).toFixed(1) + ' km');

    // คำนวณเวลาที่เหลือจนกว่าจะถึงนัด
    if (deal.meetingTime) calculateTimeLeft(deal.meetingTime);
  }, [deal, userLocation]);

  const calculateTimeLeft = (meetingTimeStr) => {
    const now = new Date();
    const [hours, minutes] = meetingTimeStr.split(':').map(Number);

    let meetingDate = new Date(now);
    meetingDate.setHours(hours, minutes, 0, 0);

    if (meetingDate < now) {
      meetingDate.setDate(meetingDate.getDate() + 1); // ถ้าเลยเวลาแล้ว ให้เป็นวันถัดไป
    }

    const diffMs = meetingDate - now;
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 60) {
      setTimeLeft(`${diffMinutes} Mins`);
    } else {
      const hoursLeft = Math.floor(diffMinutes / 60);
      setTimeLeft(`${hoursLeft} Hours`);
    }
  };

  const handleQuackDone = () => {
    Alert.alert(
      'ยืนยันการรับสินค้า',
      'คุณต้องการกด "Quack Done" เพื่อยืนยันการรับสินค้าหรือไม่?',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'Quack Done ✓',
          onPress: () => {
            Alert.alert(
              '🎉 Done!',
              'ดีลเสร็จสมบูรณ์แล้ว\nขอบคุณที่ใช้ Duck Deal 🦆',
              [{ text: 'ตกลง', onPress: () => navigation.goBack() }]
            );
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#85A77B" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="chevron-left" size={28} color="#A67B5B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Duck Deal</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Quack Confirmed + Duck Image */}
        <View style={styles.statusContainer}>
          <View style={styles.quackConfirmedBox}>
            <Text style={styles.quackConfirmedText}>Quack Confirmed</Text>
          </View>
          <Image
            source={require('../assets/duck-confirmed.png')} // เปลี่ยนเป็นรูปเป็ดจริงของคุณ
            style={styles.duckIcon}
          />
        </View>

        {/* Item */}
        <View style={styles.card}>
          <Image source={{ uri: deal?.itemImage }} style={styles.itemImage} />
          <Text style={styles.itemTitle}>{deal?.itemTitle}</Text>
          <Text style={styles.itemCategory}>{deal?.itemCategory || 'Other'}</Text>
        </View>

        {/* Giver Profile + Message Button */}
        <View style={styles.card}>
          <View style={styles.userRow}>
            <Image
              source={{ uri: giver?.photoURL || 'https://cdn-icons-png.flaticon.com/512/188/188333.png' }}
              style={styles.avatar}
            />
            <Text style={styles.giverName}>{giver?.fullName || 'ผู้ส่งสินค้า'}</Text>

            <TouchableOpacity
              style={styles.messageBtn}
              onPress={() => navigation.navigate('Chat', { chatId: deal?.chatId })}
            >
              <Text style={styles.messageText}>Message</Text>
              <Feather name="message-circle" size={20} color="#85A77B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Meeting Time */}
        <View style={styles.card}>
          <View style={styles.meetingRow}>
            <View style={styles.iconBox}>
              <Feather name="calendar" size={24} color="#D9A47F" />
            </View>
            <View>
              <Text style={styles.label}>Meeting</Text>
              <Text style={styles.meetingText}>
                {deal?.meetingDate || '—'} • {deal?.meetingTime || '—'}
              </Text>
            </View>
          </View>
        </View>

        {/* Location + Map */}
        <View style={styles.card}>
          <View style={styles.meetingRow}>
            <View style={styles.iconBox}>
              <Ionicons name="location" size={24} color="#85A77B" />
            </View>
            <View>
              <Text style={styles.label}>Location</Text>
              <Text style={styles.locationName}>{deal?.location?.name || 'SUT Library'}</Text>
              <Text style={styles.locationDetail}>
                {deal?.location?.detail || 'Main Entrance, Lobby Area'}
              </Text>
            </View>
          </View>

          {deal?.location?.lat && deal?.location?.lng && (
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                initialRegion={{
                  latitude: deal.location.lat,
                  longitude: deal.location.lng,
                  latitudeDelta: 0.012,
                  longitudeDelta: 0.012,
                }}
              >
                <Marker coordinate={{ latitude: deal.location.lat, longitude: deal.location.lng }} />
              </MapView>
            </View>
          )}
        </View>

        {/* Distance & Time Left */}
        <View style={styles.distanceContainer}>
          <View style={styles.distanceBox}>
            <Feather name="clock" size={22} color="#A67B5B" />
            <Text style={styles.distanceText}>{timeLeft || '—'}</Text>
          </View>
          <View style={styles.distanceBox}>
            <Ionicons name="location-outline" size={22} color="#DB6565" />
            <Text style={styles.distanceText}>{distance || '—'}</Text>
          </View>
        </View>

        {/* QR Code */}
        <View style={styles.qrCard}>
          <Text style={styles.qrTitle}>Show this to the duck to complete the deal</Text>
          <View style={styles.qrContainer}>
            <QRCode
              value={deal?.qrToken || deal?.id}
              size={200}
              color="#574343"
              backgroundColor="#FFFFFF"
            />
          </View>
          <Text style={styles.qrSubtitle}>
            The deal completes instantly after the duck scan
          </Text>
        </View>
      </ScrollView>

      {/* Quack Done Button */}
      <TouchableOpacity style={styles.quackDoneBtn} onPress={handleQuackDone}>
        <Text style={styles.quackDoneText}>Quack Done</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF4D0' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 55,
    paddingBottom: 10,
  },
  backBtn: { padding: 5 },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#574343',
    marginLeft: 20,
  },

  statusContainer: { alignItems: 'center', marginVertical: 15 },
  quackConfirmedBox: {
    backgroundColor: '#85A77B',
    paddingHorizontal: 25,
    paddingVertical: 8,
    borderRadius: 25,
  },
  quackConfirmedText: { color: '#FFF', fontSize: 22, fontWeight: '700' },

  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 21,
    marginTop: 14,
    borderRadius: 15,
    borderWidth: 3,
    borderColor: '#FCEEC1',
    padding: 16,
  },

  itemImage: { width: '100%', height: 160, borderRadius: 12, borderWidth: 1, borderColor: '#A67B5B' },
  itemTitle: { fontSize: 20, fontWeight: '700', color: '#574343', marginTop: 12 },
  itemCategory: { fontSize: 15, color: '#D9A47F', marginTop: 4 },

  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: '#D9A47F' },
  giverName: { flex: 1, fontSize: 20, fontWeight: '700', color: '#574343' },
  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  messageText: { color: '#85A77B', fontWeight: '700', textDecorationLine: 'underline' },

  meetingRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  iconBox: {
    width: 42,
    height: 42,
    backgroundColor: '#FCEEC1',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: { fontSize: 15, color: '#D9A47F', fontWeight: '700' },
  meetingText: { fontSize: 18, fontWeight: '700', color: '#574343' },

  locationName: { fontSize: 19, fontWeight: '700', color: '#574343', marginTop: 4 },
  locationDetail: { fontSize: 16, color: '#A67B5B' },

  mapContainer: {
    height: 200,
    marginTop: 12,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#A67B5B',
  },
  map: { flex: 1 },

  distanceContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginVertical: 15,
  },
  distanceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#FCEEC1',
    gap: 6,
  },
  distanceText: { fontSize: 15, fontWeight: '700', color: '#574343' },

  qrCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 21,
    marginTop: 20,
    borderRadius: 15,
    borderWidth: 3,
    borderColor: '#FCEEC1',
    padding: 20,
    alignItems: 'center',
  },
  qrTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#574343',
    textAlign: 'center',
    marginBottom: 16,
  },
  qrContainer: {
    padding: 15,
    backgroundColor: '#FFF',
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#D9A47F',
  },
  qrSubtitle: {
    marginTop: 16,
    fontSize: 15,
    color: '#D9A47F',
    textAlign: 'center',
    fontWeight: '600',
  },

  quackDoneBtn: {
    marginHorizontal: 30,
    marginVertical: 25,
    backgroundColor: '#85A77B',
    height: 58,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    elevation: 6,
  },
  quackDoneText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});