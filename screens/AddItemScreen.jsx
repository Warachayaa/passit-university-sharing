import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';

import { Feather, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

// ✅ นำเข้าแผนที่และระบบระบุตำแหน่ง
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';

import { auth, db } from '../config/firebase';
// 🌟 เพิ่ม getDoc และ updateDoc สำหรับระบบแจ้งเตือน/แบนบัญชี
import { doc, collection, setDoc, serverTimestamp, increment, writeBatch, getDoc, updateDoc } from 'firebase/firestore';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

const MAX_PHOTOS = 1;
const CONDITIONS = ['New', 'Excellent', 'Good', 'Fair'];
const CATEGORIES = [
  'Books', 'Notes', 'Tech', 'Clothes', 'Dorm', 
  'Food', 'Beauty', 'Free', 'Fun', 'Other'
];

export default function AddItemScreen({ navigation }) {
  const [photos, setPhotos] = useState([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState('New');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  // ✅ State สำหรับ Location
  const [mapLocation, setMapLocation] = useState({
    latitude: 14.8818, // ค่าเริ่มต้น (มทส.)
    longitude: 102.0172,
    address: "กำลังค้นหาตำแหน่ง...",
    subAddress: ""
  });

  // ขอ permission รูป และ ตำแหน่ง ตอนเปิดหน้านี้ครั้งแรก
  useEffect(() => {
    (async () => {
      // ขอสิทธิ์รูปภาพ
      const { status: imgStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (imgStatus !== 'granted') {
        Alert.alert('Permission required', 'Please allow media access.');
      }
      
      // ✅ ดึงตำแหน่งปัจจุบันอัตโนมัติ
      getCurrentLocation();
    })();
  }, []);

  /* ------------------- ระบบแผนที่ & ตำแหน่ง ------------------- */
  const getCurrentLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('แจ้งเตือน', 'แอปพลิเคชันไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง');
      return;
    }

    let loc = await Location.getCurrentPositionAsync({});
    updateAddressFromCoords(loc.coords.latitude, loc.coords.longitude);
  };

  const updateAddressFromCoords = async (lat, lng) => {
    setMapLocation(prev => ({ ...prev, latitude: lat, longitude: lng, address: "กำลังโหลดชื่อสถานที่..." }));
    try {
      let geocode = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (geocode.length > 0) {
        const place = geocode[0];
        const mainAddr = place.name || place.street || "ไม่ทราบชื่อสถานที่";
        const subAddr = `${place.subregion || ''} ${place.region || ''}`.trim();
        
        setMapLocation({
          latitude: lat,
          longitude: lng,
          address: mainAddr,
          subAddress: subAddr
        });
      }
    } catch (error) {
      setMapLocation(prev => ({ ...prev, address: "ไม่สามารถระบุที่อยู่ได้" }));
    }
  };

  const handleMapPress = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    updateAddressFromCoords(latitude, longitude);
  };

  /* ------------------- ระบบเลือกรูปภาพ ------------------- */
  const pickPhotos = async () => {
    try {
      if (!auth.currentUser) return Alert.alert('Error', 'Not logged in');

      const remaining = MAX_PHOTOS - photos.length;
      if (remaining <= 0) return Alert.alert('Limit reached', `Max ${MAX_PHOTOS} photo(s)`);

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.9,
      });

      if (res.canceled) return;

      const assets = res.assets ?? [];
      setPhotos((prev) => [...prev, ...assets]);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Cannot pick photos');
    }
  };

  /* ------------------- บันทึกข้อมูลลง Firestore ------------------- */
  const uploadPhotosAndCreateItem = async () => {
    const user = auth.currentUser;
    if (!user) return Alert.alert('Error', 'Not logged in');

    if (!photos || photos.length === 0) return Alert.alert('Error', 'Please add item photo(s)');
    if (!title.trim()) return Alert.alert('Error', 'Please enter item title');
    if (!category.trim()) return Alert.alert('Error', 'Please enter category');
    if (!condition) return Alert.alert('Error', 'Please select item condition');
    if (!description.trim()) return Alert.alert('Error', 'Please enter description');

    setLoading(true);
    try {
      // 🌟 1. ระบบตรวจเช็คโควต้าและแบนบัญชี (Anti-Spam)
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      let currentCount = 0;
      const todayStr = new Date().toDateString();

      if (userSnap.exists()) {
        const userData = userSnap.data();

        // 1.1 เช็คว่าบัญชีโดนแบนอยู่หรือไม่
        if (userData.isBanned) {
          Alert.alert('❌ บัญชีถูกระงับ', 'บัญชีของคุณถูกแบนเนื่องจากละเมิดกฎการใช้งาน (ปั้มคะแนน)');
          setLoading(false);
          return;
        }

        // 1.2 คำนวณจำนวนโพสต์ของวันนี้
        currentCount = (userData.lastPostDate === todayStr) ? (userData.dailyPostCount || 0) : 0;

        // 1.3 ถ้าโพสต์ครบ 3 ครั้งแล้ว ให้ตักเตือน หรือ แบนทันที
        if (currentCount >= 3) {
          if (!userData.warningCount) {
            // เตือนครั้งแรก
            await updateDoc(userRef, { warningCount: 1 });
            Alert.alert(
              '⚠️ แจ้งเตือนการปั้มคะแนน', 
              'คุณโพสต์ครบ 3 ครั้งแล้วในวันนี้\nนี่คือการแจ้งเตือนครั้งแรก หากพยายามโพสต์เกินอีกบัญชีจะถูกแบนทันที!'
            );
          } else {
            // แบนบัญชี
            await updateDoc(userRef, { isBanned: true });
            Alert.alert(
              '🚫 บัญชีถูกแบน', 
              'คุณพยายามโพสต์เกินกำหนดซ้ำซาก บัญชีของคุณถูกระงับการใช้งานเรียบร้อยแล้ว'
            );
          }
          setLoading(false);
          return;
        }
      }

      // 🌟 2. ถ้าผ่านเงื่อนไข ค่อยเริ่มกระบวนการอัปโหลดและสร้างไอเทม
      const itemRef = doc(collection(db, 'items'));
      const itemId = itemRef.id;

      const imageDataUris = [];

      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];

        const manipulated = await ImageManipulator.manipulateAsync(
          p.uri,
          [{ resize: { width: 1000 } }], // บีบขนาดกัน Base64 ยาวเกิน
          { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
        );

        const base64 = await FileSystem.readAsStringAsync(manipulated.uri, {
          encoding: 'base64',
        });

        imageDataUris.push(`data:image/jpeg;base64,${base64}`);
      }

      const image = imageDataUris[0];

      // ใช้ writeBatch เพื่อรวมคำสั่งบันทึกไอเทมและแจกคะแนนเข้าด้วยกัน
      const batch = writeBatch(db);

      // สร้าง Item ใหม่
      batch.set(itemRef, {
        ownerId: user.uid,
        title: title.trim(),
        category: category.trim(),
        condition,
        description: description.trim(),
        
        location: {
          name: mapLocation.address || '',
          address: mapLocation.subAddress || '',
          lat: mapLocation.latitude,
          lng: mapLocation.longitude,
        },

        imageUrls: imageDataUris,
        image, 
        status: 'Available', 
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        itemId,
      });

      // บวกคะแนนให้คนที่โพสต์ของ (+20) และ อัปเดตโควต้าโพสต์รายวัน
      batch.update(userRef, {
        duckPoints: increment(20),
        lifetimePoints: increment(20),
        dailyPostCount: currentCount + 1, // 🌟 นับเพิ่ม
        lastPostDate: todayStr          // 🌟 บันทึกวันที่
      });

      // บันทึกประวัติคะแนนลงใน pointHistory
      const historyRef = doc(collection(db, 'pointHistory'));
      batch.set(historyRef, {
        userId: user.uid,
        title: 'Duck posted an item',
        points: 20,
        createdAt: serverTimestamp()
      });

      // สั่งทำงานทั้งหมดพร้อมกัน
      await batch.commit();

      Alert.alert('Success 🎉', 'Add item complete!\nได้รับ +20 DuckPoints');
      navigation.goBack();
    } catch (e) {
      console.error('❌ ADD ITEM ERROR:', e);
      Alert.alert('Upload failed', e?.message || 'Cannot add item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="chevron-left" size={22} color="#A47551" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add New Item</Text>
      </View>

      {/* Photo */}
      <Text style={styles.sectionTitle}>Item Photo</Text>

      <TouchableOpacity style={styles.photoCard} onPress={pickPhotos} disabled={loading}>
        <View style={styles.photoIconCircle}>
          <Feather name="camera" size={20} color="#5A3D2B" />
        </View>
        <Text style={styles.photoTitle}>Tap to add image</Text>
        <Text style={styles.photoHint}>บีบรูปให้เล็กก่อน เพื่อให้ส่งได้ใน Firestore</Text>
        <Text style={styles.photoLimit}>Max {MAX_PHOTOS} photo(s)</Text>
      </TouchableOpacity>

      {photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
          {photos.map((p, idx) => (
            <Image key={idx} source={{ uri: p.uri }} style={styles.photoThumb} />
          ))}
        </ScrollView>
      )}

      {/* Details */}
      <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Details</Text>

      <Text style={styles.label}>Item Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="เช่น หนังสือเรียนวิชาฟิสิกส์"
        editable={!loading}
      />

      <Text style={styles.label}>Category</Text>
      <View style={styles.chipsRow}>
        {CATEGORIES.map((c) => {
          const active = c === category;
          return (
            <TouchableOpacity
              key={c}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setCategory(c)}
              disabled={loading}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>Item condition</Text>
      <View style={styles.chipsRow}>
        {CONDITIONS.map((c) => {
          const active = c === condition;
          return (
            <TouchableOpacity
              key={c}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setCondition(c)}
              disabled={loading}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Information */}
      <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Information</Text>
      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, { height: 110, textAlignVertical: 'top' }]}
        value={description}
        onChangeText={setDescription}
        placeholder="กรุณากรอกรายละเอียด"
        multiline
        editable={!loading}
      />

      {/* ✅ Location Map (แบบฝังในหน้าเลย) */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
        <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 0 }]}>Location</Text>
        <TouchableOpacity onPress={getCurrentLocation}>
          <Text style={{ color: '#5A7D5A', fontWeight: '700' }}>📍 ตำแหน่งปัจจุบัน</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mapContainer}>
        <MapView
          style={styles.mapImage}
          region={{
            latitude: mapLocation.latitude,
            longitude: mapLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          onPress={handleMapPress}
        >
          <Marker 
            coordinate={{ latitude: mapLocation.latitude, longitude: mapLocation.longitude }} 
            pinColor="#E74C3C"
          />
        </MapView>

        <View style={styles.locationLabel}>
          <MaterialIcons name="location-on" size={24} color="#E74C3C" />
          <View style={{ marginLeft: 8, flex: 1 }}>
            <Text style={styles.locationTitle} numberOfLines={1}>{mapLocation.address}</Text>
            {mapLocation.subAddress ? (
              <Text style={styles.locationSub} numberOfLines={1}>{mapLocation.subAddress}</Text>
            ) : null}
          </View>
        </View>
      </View>
      <Text style={styles.mapHint}>* จิ้มบนแผนที่เพื่อระบุตำแหน่งส่งมอบสินค้า</Text>

      {/* Submit */}
      <TouchableOpacity style={styles.submitBtn} onPress={uploadPhotosAndCreateItem} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Add Item</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8E7', paddingHorizontal: 18, paddingTop: 40 },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  backBtn: { padding: 6, borderRadius: 10, backgroundColor: 'rgba(164,117,81,0.08)' , marginTop: 20},
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 22, fontWeight: '900', color: '#5A3D2B', marginRight: 32 , marginTop: 20},

  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#5A3D2B', marginTop: 10, marginBottom: 10 },

  photoCard: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: '#D9A77C',
    borderStyle: 'dashed',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
  },
  photoIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(217,167,124,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  photoTitle: { fontSize: 16, fontWeight: '800', color: '#5A3D2B' },
  photoHint: { marginTop: 8, color: '#8B7355', textAlign: 'center' },
  photoLimit: { marginTop: 12, color: '#A89F91', fontWeight: '600' },

  photoThumb: {
    width: 90,
    height: 90,
    marginTop: 12,
    marginHorizontal: 6,
    borderRadius: 14,
  },

  label: { fontSize: 15, fontWeight: '800', color: '#5A3D2B', marginTop: 14, marginBottom: 8 },

  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#C49A79',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#5A3D2B',
  },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C49A79',
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: '#D9A77C', borderColor: '#D9A77C' },
  chipText: { color: '#5A3D2B', fontWeight: '900' },
  chipTextActive: { color: '#fff' },

  /* สไตล์แผนที่ */
  mapContainer: { 
    height: 200, 
    borderRadius: 16, 
    overflow: 'hidden', 
    position: 'relative', 
    borderWidth: 1, 
    borderColor: '#C49A79',
    marginTop: 10 
  },
  mapImage: { width: '100%', height: '100%' },
  locationLabel: { 
    position: 'absolute', 
    bottom: 15, 
    left: 15, 
    right: 15, 
    backgroundColor: '#FFF', 
    padding: 12, 
    borderRadius: 12, 
    flexDirection: 'row', 
    alignItems: 'center', 
    elevation: 5, 
    shadowColor: '#000', 
    shadowOpacity: 0.1, 
    shadowRadius: 4 
  },
  locationTitle: { fontSize: 14, fontWeight: '700', color: '#5A3D2B' },
  locationSub: { fontSize: 12, color: '#8B7355' },
  mapHint: { fontSize: 12, color: '#8B7355', marginTop: 6 },

  submitBtn: {
    marginTop: 25,
    backgroundColor: '#5A7D5A',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    elevation: 3,
    marginBottom: 50,
  },
  submitText: { color: '#fff', fontWeight: '900', fontSize: 18 },
});