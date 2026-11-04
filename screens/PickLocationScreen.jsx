// screens/PickLocationScreen.jsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRoute } from '@react-navigation/native';
import { auth, db, storage } from '../config/firebase';


const DEFAULT_REGION = {
  latitude: 14.9798,   // โคราช (fallback)
  longitude: 102.0975,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

export default function PickLocationScreen({ navigation }) {
  const route = useRoute();
  const initial = route.params?.initialLocation; // {lat,lng,name,address} optional

  const [region, setRegion] = useState(null);
  const [picked, setPicked] = useState(initial || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // 1) ถ้ามี initialLocation มาแล้ว ใช้เลย
        if (initial?.lat && initial?.lng) {
          const r = {
            latitude: initial.lat,
            longitude: initial.lng,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          };
          if (!mounted) return;
          setRegion(r);
          setPicked((p) => p || { lat: initial.lat, lng: initial.lng });
          return;
        }

        // 2) ขอ permission ก่อนเสมอ
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!mounted) return;

        if (perm.status !== 'granted') {
          Alert.alert(
            'Location permission denied',
            'ใช้ตำแหน่งเริ่มต้นแทนได้'
          );
          setRegion(DEFAULT_REGION);
          setPicked({ lat: DEFAULT_REGION.latitude, lng: DEFAULT_REGION.longitude });
          return;
        }

        // 3) ดึง location พร้อม timeout กันค้าง
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeout: 8000,       // กันค้าง
          maximumAge: 20000,   // ใช้ค่าเก่าถ้ามี
        });

        if (!mounted) return;

        const r = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        };

        setRegion(r);
        setPicked({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch (e) {
        console.log('PickLocationScreen error:', e?.message || e);

        // 4) fallback เสมอเพื่อไม่ให้ loading ค้าง
        if (!mounted) return;
        setRegion(DEFAULT_REGION);
        setPicked({ lat: DEFAULT_REGION.latitude, lng: DEFAULT_REGION.longitude });
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [initial]);

  const confirm = async () => {
    if (!picked) return;

    // reverse geocode อาจล้มเหลวได้ ไม่อยากให้ค้าง/เด้งซ้ำ
    let name = '';
    let address = '';
    try {
      const results = await Location.reverseGeocodeAsync({
        latitude: picked.lat,
        longitude: picked.lng,
      });

      const r = results?.[0];
      if (r) {
        name = [r.name, r.street].filter(Boolean).join(' ') || '';
        address = [
          r.subdistrict, r.district, r.region, r.postalCode, r.country,
        ].filter(Boolean).join(' ') || '';
      }
    } catch {
      // ถ้า reverseGeocode fail ก็ยังไปต่อด้วย lat/lng ได้
    }

    navigation.navigate('AddItem', {
      selectedLocation: {
        name,
        address,
        lat: picked.lat,
        lng: picked.lng,
      },
    });
  };

  if (loading || !region) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#D9A77C" />
        <Text style={{ marginTop: 10, color: '#5A3D2B', fontWeight: '700' }}>
          Loading map...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={{ flex: 1 }}
        region={region}
        onPress={(e) => {
          const { latitude, longitude } = e.nativeEvent.coordinate;
          setPicked({ lat: latitude, lng: longitude });
        }}
      >
        {picked && <Marker coordinate={{ latitude: picked.lat, longitude: picked.lng }} />}
      </MapView>

      <View style={styles.bottom}>
        <TouchableOpacity style={styles.btn} onPress={confirm} disabled={!picked}>
          <Text style={styles.btnText}>Confirm location</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: '#EFD9B4' }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.btnText, { color: '#5A3D2B' }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8E7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF8E7' },
  bottom: {
    padding: 16,
    backgroundColor: '#FFF8E7',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    gap: 10,
    flexDirection: 'row',
  },
  btn: {
    flex: 1,
    backgroundColor: '#4CAF50',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});