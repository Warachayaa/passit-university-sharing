import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
  Platform
} from "react-native";
import {
  Feather,
  MaterialIcons,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

// หมายเหตุสำหรับผู้ใช้: โค้ดนี้เขียนขึ้นเพื่อใช้งานในสภาพแวดล้อม React Native (Expo) จริงของคุณ
// หากคุณเห็นข้อผิดพลาด "Could not resolve" ในหน้าพรีวิว Canvas เกิดจากระบบพรีวิวบนเว็บไม่รองรับโมดูลของมือถือ
import { signOut } from "firebase/auth";
import { auth, db } from "../config/firebase";
import { doc, getDoc, collection, query, where, onSnapshot } from "firebase/firestore";

/* ─────────────────────── MENU DATA ─────────────────────── */
const MENU_ITEMS = [
  { id: "1", icon: "bell", label: "My Requests", type: "feather", screen: "MyRequests" },
  { id: "2", icon: "heart", label: "List Duck Deal", type: "feather", screen: "DuckDeals" },
  { id: "3", icon: "message-circle", label: "Messages", type: "feather", screen: "MessagesScreen" },
];

const ACCOUNT_ITEMS = [
  { id: "4", icon: "user", label: "Edit Profile", type: "feather", screen: "EditProfile" },
  { id: "5", icon: "settings", label: "Notification Setting", type: "feather", screen: "Notifications" },
];

const DEFAULT_AVATAR = "https://img2.pic.in.th/Unknown_User.jpg";

export default function ProfileScreen({ navigation }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [photoURL, setPhotoURL] = useState(DEFAULT_AVATAR);
  const [loading, setLoading] = useState(true);

  // States สำหรับตัวเลขแจ้งเตือนในหน้า Profile
  const [pendingRequests, setPendingRequests] = useState(0);
  const [activeDeals, setActiveDeals] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  
  // 🌟 State สำหรับตัวเลขแจ้งเตือน "My Items" ที่ Bottom Bar
  const [undeliveredCount, setUndeliveredCount] = useState(0);

  const uid = auth.currentUser?.uid;

  /* ------------------- โหลดข้อมูลผู้ใช้ ------------------- */
  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      const fetchUserData = async () => {
        try {
          const docRef = doc(db, "users", uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setFullName(data.fullName || "Unknown User");
            setEmail(data.email ?? auth.currentUser?.email ?? "");
            setPhotoURL(data.photoURL || DEFAULT_AVATAR);
          }
        } catch (error) {
          console.error("Fetch user error:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchUserData();
    }, [uid])
  );

  /* ------------------- ระบบนับแจ้งเตือนแบบ Real-time ------------------- */
  useEffect(() => {
    // 🌟 หากไม่มี UID (Logout แล้ว) ให้ไม่สร้าง Listener
    if (!uid) return;

    // 🦆 ฟังก์ชันจัดการ Error เพื่อป้องกัน Permission Denied ตอน Logout
    const handleSnapshotError = (error) => {
      if (error.code === 'permission-denied') {
        // ข้าม Error นี้เพราะเกิดขึ้นปกติขณะกำลังเคลียร์ Listener ตอน Logout
        return;
      }
      console.error("Firestore Snapshot Error:", error);
    };

    // 1. My Requests
    const qReq = query(
      collection(db, "requests"),
      where("sellerId", "==", uid),
      where("status", "==", "pending")
    );
    const unsubReq = onSnapshot(qReq, (snap) => setPendingRequests(snap.size), handleSnapshotError);

    // 2. List Duck Deal
    let buyerPendingCount = 0;
    let buyerActiveCount = 0;

    const qMyBuyerReqs = query(
      collection(db, "requests"),
      where("buyerId", "==", uid),
      where("status", "==", "pending")
    );
    const unsubBuyerReqs = onSnapshot(qMyBuyerReqs, (snap) => {
      buyerPendingCount = snap.size;
      setActiveDeals(buyerPendingCount + buyerActiveCount);
    }, handleSnapshotError);

    const qMyActiveDeals = query(
      collection(db, "deals"),
      where("receiverId", "==", uid),
      where("status", "==", "active")
    );
    const unsubActiveDeals = onSnapshot(qMyActiveDeals, (snap) => {
      buyerActiveCount = snap.size;
      setActiveDeals(buyerPendingCount + buyerActiveCount);
    }, handleSnapshotError);

    // 3. Messages Unread
    const unsubChats = onSnapshot(
      query(collection(db, "chats"), where("users", "array-contains", uid)),
      (snapshot) => {
        let totalUnread = 0;
        snapshot.forEach(doc => {
          const data = doc.data();
          totalUnread += (data[`unreadCount_${uid}`] || 0);
        });
        setUnreadMessages(totalUnread);
      }, handleSnapshotError
    );

    // 🌟 4. ระบบ Badge: รายการที่เราต้องส่งของให้คนอื่น (giverId) และยังไม่สำเร็จ
    const unsubUndelivered = onSnapshot(
      query(collection(db, 'deals'), where('giverId', '==', uid)),
      (snapshot) => {
        const count = snapshot.docs.filter(d => {
          const s = (d.data().status || '').toLowerCase();
          // นับรายการที่ตกลงกันแล้วแต่ยังไม่ completed หรือถูกยกเลิก
          return s !== 'completed' && s !== 'cancelled' && s !== 'closed';
        }).length;
        setUndeliveredCount(count);
      }, handleSnapshotError
    );

    return () => {
      unsubReq();
      unsubBuyerReqs();
      unsubActiveDeals();
      unsubChats();
      unsubUndelivered();
    };
  }, [uid]);

  const MenuItem = ({ item }) => {
    let count = 0;
    if (item.id === "1") count = pendingRequests;
    else if (item.id === "2") count = activeDeals;
    else if (item.id === "3") count = unreadMessages;

    return (
      <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate(item.screen)}>
        <View style={styles.menuLeft}>
          <View style={styles.iconWrapper}>
            <Feather name={item.icon} size={22} color="#5A3D2B" />
            {count > 0 && (
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text>
              </View>
            )}
          </View>
          <Text style={styles.menuText}>{item.label}</Text>
        </View>
        <Feather name="chevron-right" size={24} color="#C4A484" />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#5A3D2B" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Profile</Text>
        </View>

        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: photoURL }} style={styles.avatar} />
          </View>
          <Text style={styles.username}>{fullName}</Text>
          <Text style={styles.email}>{email}</Text>
        </View>

        <View style={styles.menuContainer}>
          {MENU_ITEMS.map((item) => (
            <MenuItem key={item.id} item={item} />
          ))}
        </View>

        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.menuContainer}>
          {ACCOUNT_ITEMS.map((item) => (
            <MenuItem key={item.id} item={item} />
          ))}
        </View>

        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={() => {
            Alert.alert("ออกจากระบบ", "ต้องการออกจากระบบใช่หรือไม่?", [
              { text: "ยกเลิก", style: "cancel" },
              { text: "ออกจากระบบ", style: "destructive", onPress: () => signOut(auth) }
            ]);
          }}
        >
          <Text style={styles.logoutText}>Log Out</Text>
          <MaterialCommunityIcons name="logout" size={22} color="#E74C3C" />
        </TouchableOpacity>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* 🧭 Bottom Navigation พร้อมระบบ Badge */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate("Home")}>
          <Ionicons name="home-outline" size={26} color="#B0A090" />
          <Text style={styles.tabLabel}>Home</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate("MyItems")}>
          <View style={styles.bottomIconWrapper}>
            <Feather name="shopping-bag" size={24} color="#B0A090" />
            {/* 🔴 ตัวเลขแจ้งเตือนรายการที่ยังไม่ส่งมอบของ */}
            {undeliveredCount > 0 && (
              <View style={styles.navBadge}>
                <Text style={styles.navBadgeText}>{undeliveredCount > 99 ? '99+' : undeliveredCount}</Text>
              </View>
            )}
          </View>
          <Text style={styles.tabLabel}>My Items</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.centerButton} onPress={() => navigation.navigate("QRScan")}>
          <View style={styles.centerButtonInner}>
            <MaterialCommunityIcons name="qrcode-scan" size={28} color="#FFF" />
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate("Rewards")}>
          <MaterialCommunityIcons name="gift-outline" size={26} color="#B0A090" />
          <Text style={styles.tabLabel}>Rewards</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.tabItem}>
          <Feather name="user" size={24} color="#5A3D2B" />
          <Text style={styles.tabLabelActive}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF8E7" },
  scrollContent: { paddingTop: 20 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: { alignItems: "center", paddingTop: 40, paddingBottom: 20 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#5A3D2B" },

  profileSection: { alignItems: "center", marginBottom: 30 },
  avatarContainer: {
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 4, borderColor: "#D4A373", padding: 3, marginBottom: 12,
  },
  avatar: { width: "100%", height: "100%", borderRadius: 50 },
  username: { fontSize: 20, fontWeight: "800", color: "#5A3D2B", marginBottom: 4 },
  email: { fontSize: 14, color: "#8B7355", fontWeight: "600" },

  sectionLabel: { fontSize: 16, fontWeight: "700", color: "#5A3D2B", marginHorizontal: 20, marginTop: 20, marginBottom: 10 },
  menuContainer: { backgroundColor: "#FFF", marginHorizontal: 20, borderRadius: 16, overflow: "hidden", elevation: 2 },
  menuItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: "#F5F5F5" },
  menuLeft: { flexDirection: "row", alignItems: "center" },
  menuText: { fontSize: 16, color: "#5A3D2B", marginLeft: 12, fontWeight: "600" },

  iconWrapper: { position: "relative", justifyContent: "center", alignItems: "center" },
  badgeContainer: {
    position: "absolute",
    top: -6,
    right: -8,
    backgroundColor: "#E74C3C", 
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "#FFF",
  },
  badgeText: { color: "#FFF", fontSize: 10, fontWeight: "bold" },

  logoutButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#FFF", marginHorizontal: 20, marginTop: 30, paddingVertical: 16, borderRadius: 16, borderWidth: 1.5, borderColor: "#FFE5E5" },
  logoutText: { fontSize: 16, fontWeight: "700", color: "#E74C3C", marginRight: 8 },

  bottomBar: { 
    flexDirection: "row", 
    justifyContent: "space-around", 
    alignItems: "center", 
    backgroundColor: "#FFF", 
    paddingVertical: 8, 
    paddingBottom: Platform.OS === 'ios' ? 30 : 20, 
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24, 
    elevation: 10, 
    position: "absolute", 
    bottom: 0, 
    width: "100%" 
  },
  tabItem: { alignItems: "center", width: 60 },
  tabLabel: { fontSize: 10, color: "#B0A090", marginTop: 4 },
  tabLabelActive: { fontSize: 10, color: "#5A3D2B", fontWeight: "700", marginTop: 4 },
  centerButton: { marginTop: -35 },
  centerButtonInner: { width: 64, height: 64, backgroundColor: "#5A7D5A", borderRadius: 18, justifyContent: "center", alignItems: "center", elevation: 10 },
  
  bottomIconWrapper: { position: 'relative', justifyContent: 'center', alignItems: 'center' },
  navBadge: { 
    position: 'absolute', 
    top: -5, 
    right: -8, 
    backgroundColor: '#E76A6A', 
    borderRadius: 10, 
    minWidth: 16, 
    height: 16, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1.5, 
    borderColor: '#FFF' 
  },
  navBadgeText: { color: '#FFF', fontSize: 8, fontWeight: 'bold' },
});