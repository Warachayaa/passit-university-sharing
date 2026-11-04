import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';

// ✅ ตัด Firebase Storage ออก นำเข้าแค่ auth และ db (Firestore)
import { auth, db } from "../config/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";

import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';

const DEFAULT_AVATAR = "https://img2.pic.in.th/Unknown_User.jpg"; // URL รูปโปรไฟล์เริ่มต้น (ใช้รูปที่ดูเป็นกลางๆ)
const genderOptions = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

export default function EditProfileScreen({ navigation }) {
  const [fullName, setFullName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [gender, setGender] = useState("Prefer not to say");
  const [photoURL, setPhotoURL] = useState(DEFAULT_AVATAR);
  const [showGenderDropdown, setShowGenderDropdown] = useState(false);
  
  const [mapLocation, setMapLocation] = useState({
    latitude: 14.8818,
    longitude: 102.0172,
    address: "กำลังค้นหาตำแหน่ง...",
    subAddress: ""
  });

  const [loading, setLoading] = useState(true);

  const uid = auth.currentUser?.uid;

  /* ------------------- โหลดข้อมูลผู้ใช้ ------------------- */
  useEffect(() => {
    if (!uid) return;
    const loadUser = async () => {
      try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setStudentId(data.studentId || "B6XXXXXX");
          setFullName(data.fullName || "");
          setGender(data.gender || "Prefer not to say");
          setPhotoURL(data.photoURL || DEFAULT_AVATAR);

          if (data.location && data.location.lat && data.location.lng) {
            setMapLocation({
              latitude: data.location.lat,
              longitude: data.location.lng,
              address: data.location.address || "ตำแหน่งที่บันทึกไว้",
              subAddress: ""
            });
          } else {
            getCurrentLocation();
          }
        }
      } catch (error) {
        Alert.alert("Error", "ไม่สามารถดึงข้อมูลได้");
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, [uid]);

  /* ------------------- ระบบแผนที่ & ตำแหน่ง ------------------- */
  const getCurrentLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission to access location was denied');
      return;
    }

    let location = await Location.getCurrentPositionAsync({});
    updateAddressFromCoords(location.coords.latitude, location.coords.longitude);
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

  /* ------------------- 📸 เปลี่ยนรูปโปรไฟล์ (ไม่ใช้ Storage) ------------------- */
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'กรุณาอนุญาตการเข้าถึงรูปภาพ');
      return;
    }
    
    // ✅ ตั้งค่า base64: true เพื่อแปลงรูปเป็นตัวอักษร
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.3, // ⚠️ สำคัญ: ต้องตั้งให้ต่ำๆ (0.3) เพื่อไม่ให้ข้อความยาวเกินไปจน Firestore รับไม่ไหว
      allowsEditing: true, 
      aspect: [1, 1],
      base64: true, // <--- จุดสำคัญที่ทำให้ไม่ต้องใช้ Storage
    });

    if (!result.canceled && result.assets[0].base64) {
      // เอาข้อความ Base64 มาประกอบเป็น Data URI เพื่อให้ <Image> นำไปแสดงผลได้
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setPhotoURL(base64Image); // นำไปโชว์ที่หน้าจอทันที
    }
  };

  /* ------------------- 💾 บันทึกข้อมูล ------------------- */
  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert("เตือน", "กรุณากรอกชื่อแสดงผล");
      return;
    }
    try {
      setLoading(true);
      const docRef = doc(db, "users", uid);
      
      // ✅ บันทึกข้อความ Base64 (photoURL) ลง Firestore ไปพร้อมกับชื่อและที่อยู่เลย
      await updateDoc(docRef, {
        fullName: fullName.trim(),
        gender: gender,
        photoURL: photoURL, 
        location: {
          address: mapLocation.address,
          lat: mapLocation.latitude,
          lng: mapLocation.longitude
        }
      });
      Alert.alert('Success', 'อัปเดตโปรไฟล์สำเร็จ!');
      navigation.goBack(); 
    } catch (error) {
      Alert.alert("Error", "อัปเดตข้อมูลไม่สำเร็จ: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#6B8E6B" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#5A3D2B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <TouchableOpacity style={styles.avatarContainer} onPress={pickImage}>
            <Image source={{ uri: photoURL }} style={styles.avatar} />
            <View style={styles.editAvatarBtn}>
              <Feather name="camera" size={14} color="#FFF" />
            </View>
          </TouchableOpacity>
          <Text style={styles.changePhotoText}>Edit Profile</Text>
        </View>

        {/* Form */}
        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username *</Text>
            <View style={styles.readOnlyInput}>
              <Text style={styles.readOnlyText}>{studentId}</Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={styles.textInput}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter display name"
              placeholderTextColor="#C4A484"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Gender</Text>
            <TouchableOpacity 
              style={styles.dropdown}
              onPress={() => setShowGenderDropdown(!showGenderDropdown)}
            >
              <Text style={[styles.dropdownText, gender !== 'Prefer not to say' && {color: '#5A3D2B'}]}>
                {gender}
              </Text>
              <Feather name={showGenderDropdown ? "chevron-up" : "chevron-down"} size={20} color="#8B7355" />
            </TouchableOpacity>
            
            {showGenderDropdown && (
              <View style={styles.dropdownMenu}>
                {genderOptions.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setGender(option);
                      setShowGenderDropdown(false);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, gender === option && styles.dropdownItemActive]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Location Map */}
          <View style={styles.inputGroup}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={styles.label}>Location</Text>
              <TouchableOpacity onPress={getCurrentLocation}>
                <Text style={{ color: '#6B8E6B', fontWeight: '600' }}>📍 ตำแหน่งปัจจุบัน</Text>
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
            <Text style={{ fontSize: 12, color: '#8B7355', marginTop: 4 }}>* จิ้มบนแผนที่เพื่อระบุตำแหน่งของคุณ</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveText}>Save</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8E7' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 10 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#5A3D2B' },
  scrollContent: { padding: 20 },

  avatarSection: { alignItems: 'center', marginBottom: 30 },
  avatarContainer: { position: 'relative', width: 110, height: 110, marginBottom: 10 },
  avatar: { width: '100%', height: '100%', borderRadius: 55, borderWidth: 3, borderColor: '#D4A373', resizeMode: 'cover' },
  editAvatarBtn: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#6B8E6B', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  changePhotoText: { fontSize: 14, color: '#6B8E6B', fontWeight: '700' },

  formContainer: { marginBottom: 20 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 16, fontWeight: '700', color: '#5A3D2B', marginBottom: 8 },
  
  readOnlyInput: { backgroundColor: '#F5F5F5', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E0E0E0' },
  readOnlyText: { fontSize: 16, color: '#C4A484', fontWeight: '600' },
  
  textInput: { backgroundColor: '#FFF', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1.5, borderColor: '#E8D5C4', fontSize: 16, color: '#5A3D2B', fontWeight: '600' },
  
  dropdown: { backgroundColor: '#FFF', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1.5, borderColor: '#E8D5C4', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdownText: { fontSize: 16, color: '#C4A484', fontWeight: '600' },
  dropdownMenu: { backgroundColor: '#FFF', borderRadius: 12, marginTop: 8, borderWidth: 1, borderColor: '#E8D5C4', overflow: 'hidden' },
  dropdownItem: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  dropdownItemText: { fontSize: 16, color: '#5A3D2B' },
  dropdownItemActive: { color: '#6B8E6B', fontWeight: '700' },

  mapContainer: { height: 200, borderRadius: 16, overflow: 'hidden', position: 'relative', borderWidth: 1, borderColor: '#E8D5C4' },
  mapImage: { width: '100%', height: '100%' },
  locationLabel: { position: 'absolute', bottom: 15, left: 15, right: 15, backgroundColor: '#FFF', padding: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
  locationTitle: { fontSize: 14, fontWeight: '700', color: '#5A3D2B' },
  locationSub: { fontSize: 12, color: '#8B7355' },

  saveButton: { backgroundColor: '#6B8E6B', paddingVertical: 16, borderRadius: 16, alignItems: 'center', elevation: 4 },
  saveText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
});