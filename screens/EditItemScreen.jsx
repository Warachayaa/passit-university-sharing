// screens/EditItemScreen.jsx
import React, { useState, useEffect } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context'; 
import { Feather, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

// ✅ นำเข้าแผนที่และระบบระบุตำแหน่ง
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';

import { db } from '../config/firebase';
import { doc, updateDoc } from 'firebase/firestore';

import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

const CONDITIONS = ['New', 'Excellent', 'Good', 'Fair'];
// ✅ เปลี่ยนหมวดหมู่ให้เหมือนกับหน้า AddItemScreen
const CATEGORIES = [
  'Books', 'Notes', 'Tech', 'Clothes', 'Dorm', 
  'Food', 'Beauty', 'Free', 'Fun', 'Other'
];

export default function EditItemScreen({ navigation, route }) {
  // รับข้อมูลเดิมที่ส่งมาจาก MyItemsScreen
  const { itemData } = route.params;
  const insets = useSafeAreaInsets();
  
  // กำหนด State โดยดึงค่าเดิมมาแสดง (นำ status ออกแล้ว)
  const [title, setTitle] = useState(itemData.title || '');
  const [category, setCategory] = useState(itemData.category || '');
  const [condition, setCondition] = useState(itemData.condition || 'New');
  const [description, setDescription] = useState(itemData.description || '');
  const [image, setImage] = useState(itemData.image || itemData.imageUrls?.[0] || null);
  
  const [loading, setLoading] = useState(false);

  // ✅ State สำหรับ Location (ดึงค่าเดิมมาตั้งต้น)
  const [mapLocation, setMapLocation] = useState({
    latitude: itemData.location?.lat || 14.8818,
    longitude: itemData.location?.lng || 102.0172,
    address: itemData.location?.name || "ไม่ทราบชื่อสถานที่",
    subAddress: itemData.location?.address || ""
  });

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

  /* ------------------- เปลี่ยนรูปภาพ (Base64) ------------------- */
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow media access.');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (res.canceled) return;

      setLoading(true); 
      const asset = res.assets[0];

      // บีบอัดรูปเพื่อไม่ให้หนัก Firestore
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 800 } }], 
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
      );

      const base64 = await FileSystem.readAsStringAsync(manipulated.uri, {
        encoding: 'base64',
      });

      setImage(`data:image/jpeg;base64,${base64}`);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Cannot pick photo');
    } finally {
      setLoading(false);
    }
  };

  /* ------------------- อัปเดตข้อมูลลง Firestore ------------------- */
  const handleUpdate = async () => {
    if (!title.trim()) return Alert.alert('Error', 'Please enter item title');
    if (!category.trim()) return Alert.alert('Error', 'Please enter category');
    if (!description.trim()) return Alert.alert('Error', 'Please enter description');

    setLoading(true);
    try {
      const itemRef = doc(db, 'items', itemData.id);

      await updateDoc(itemRef, {
        title: title.trim(),
        category: category.trim(),
        condition,
        description: description.trim(),
        // ✅ บันทึกตำแหน่งที่อัปเดตใหม่
        location: {
          name: mapLocation.address || '',
          address: mapLocation.subAddress || '',
          lat: mapLocation.latitude,
          lng: mapLocation.longitude,
        },
        image: image, // รูปใหม่ (ถ้ามีการเปลี่ยน)
      });

      Alert.alert('Success', 'Item updated successfully! ✅', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (e) {
      console.error('❌ UPDATE ITEM ERROR:', e);
      Alert.alert('Error', 'Cannot update item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 50 }} showsVerticalScrollIndicator={false}>
      
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="chevron-left" size={22} color="#A47551" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Item</Text>
      </View>

      {/* Photo Section */}
      <Text style={styles.sectionTitle}>Item Photo</Text>
      <TouchableOpacity style={styles.imageContainer} onPress={pickImage} disabled={loading}>
        {image ? (
          <>
            <Image source={{ uri: image }} style={styles.image} />
            <View style={styles.editImageOverlay}>
              <Feather name="camera" size={24} color="#FFF" />
              <Text style={{ color: '#FFF', fontWeight: 'bold', marginTop: 4 }}>Change Photo</Text>
            </View>
          </>
        ) : (
          <View style={styles.photoCard}>
            <View style={styles.photoIconCircle}>
              <Feather name="camera" size={20} color="#5A3D2B" />
            </View>
            <Text style={styles.photoTitle}>Tap to add image</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Details Section */}
      <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Details</Text>

      <Text style={styles.label}>Item Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g., Introduction to Physics Textbook"
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

      <Text style={styles.label}>Item Condition</Text>
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

      {/* Information Section */}
      <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Information</Text>
      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, { height: 110, textAlignVertical: 'top' }]}
        value={description}
        onChangeText={setDescription}
        placeholder="Please provide product details."
        multiline
        editable={!loading}
      />

      {/* ✅ Location Section (แผนที่ฝังในตัว) */}
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
      <Text style={styles.mapHint}>* จิ้มบนแผนที่เพื่อเปลี่ยนตำแหน่งส่งมอบสินค้า</Text>

      {/* Submit Button */}
      <TouchableOpacity style={styles.submitBtn} onPress={handleUpdate} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Save Changes</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8E7', paddingHorizontal: 18, paddingTop: 40 },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  backBtn: { padding: 6, borderRadius: 10, backgroundColor: 'rgba(164,117,81,0.08)' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 22, fontWeight: '900', color: '#5A3D2B', marginRight: 32 },

  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#5A3D2B', marginTop: 10, marginBottom: 10 },

  imageContainer: {
    height: 200,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 10,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#C49A79',
  },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  editImageOverlay: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  photoCard: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: '#D9A77C',
    borderStyle: 'dashed',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
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
    marginTop: 30,
    backgroundColor: '#5A7D5A',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    elevation: 3,
    marginBottom: 50,
  },
  submitText: { color: '#fff', fontWeight: '900', fontSize: 18 },
});