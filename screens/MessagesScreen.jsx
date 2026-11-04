import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StatusBar,
  Platform,
  SafeAreaView
} from "react-native";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// หมายเหตุ: โค้ดนี้ออกแบบมาเพื่อใช้งานในโปรเจกต์ React Native (Expo)
// ข้อผิดพลาด "Could not resolve" ในหน้าพรีวิวนี้เกิดจากระบบจำลองบนเว็บไม่รองรับไลบรารีเฉพาะทางของมือถือ
// คุณสามารถคัดลอกโค้ดนี้ไปใช้งานในไฟล์ screens/MessagesScreen.jsx ในโปรเจกต์ของคุณได้ทันทีครับ
import { auth, db } from "../config/firebase";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  getDoc 
} from "firebase/firestore";

// Cache สำหรับเก็บข้อมูลโปรไฟล์ผู้ใช้เพื่อลดการโหลดซ้ำ
const userProfileCache = {};

export default function MessagesScreen({ navigation }) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets(); // ใช้จัดการระยะขอบบนสำหรับรอยบาก

  const uid = auth?.currentUser?.uid;

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    // ดึงห้องแชทที่เกี่ยวข้องกับผู้ใช้ เรียงตามเวลาล่าสุด
    const q = query(
      collection(db, "chats"),
      where("users", "array-contains", uid),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rawDocs = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      const processMessages = async () => {
        const enrichedChats = [];

        for (const chatData of rawDocs) {
          const otherUserId = chatData.users?.find((id) => id !== uid);
          let otherUser = {
            id: otherUserId,
            name: "General User",
            avatar: "https://img2.pic.in.th/Unknown_User.jpg"
          };

          if (otherUserId) {
            if (userProfileCache[otherUserId]) {
              otherUser = userProfileCache[otherUserId];
            } else {
              try {
                const userSnap = await getDoc(doc(db, "users", otherUserId));
                if (userSnap.exists()) {
                  const userData = userSnap.data();
                  otherUser = {
                    id: otherUserId,
                    name: userData.fullName || userData.username || "User",
                    avatar: userData.photoURL || otherUser.avatar,
                  };
                  userProfileCache[otherUserId] = otherUser;
                }
              } catch (e) {
                console.warn("Fetch profile failed:", e);
              }
            }
          }

          let displayTime = "";
          if (chatData.updatedAt) {
            const date = chatData.updatedAt.toDate 
              ? chatData.updatedAt.toDate() 
              : new Date(chatData.updatedAt);
            displayTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
          } else {
            displayTime = "Just now";
          }

          const unreadKey = `unreadCount_${uid}`;
          const unreadCount = chatData[unreadKey] || 0;

          enrichedChats.push({
            ...chatData,
            otherUser,
            lastMessageTime: displayTime,
            unreadCount: unreadCount,
          });
        }

        setChats(enrichedChats);
        setLoading(false);
      };

      processMessages();
    }, (err) => {
      console.error("Snapshot error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [uid]);

  const renderChatItem = ({ item }) => (
    <TouchableOpacity
      style={styles.chatCard}
      activeOpacity={0.8}
      onPress={() => 
        navigation.navigate("Chat", { 
          chatId: item.id, 
          sellerName: item.otherUser.name,
          itemTitle: item.itemTitle || ""
        })
      }
    >
      <View style={styles.avatarContainer}>
        <Image source={{ uri: item.otherUser.avatar }} style={styles.avatar} />
      </View>

      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text style={styles.userName} numberOfLines={1}>{item.otherUser.name}</Text>
          <Text style={styles.timeText}>{item.lastMessageTime}</Text>
        </View>

        {item.itemTitle && (
          <View style={styles.itemBadge}>
            <Feather name="box" size={10} color="#A67B5B" />
            <Text style={styles.itemBadgeText} numberOfLines={1}> {item.itemTitle}</Text>
          </View>
        )}

        <Text 
          style={[
            styles.lastMessage, 
            item.unreadCount > 0 && styles.lastMessageUnread
          ]} 
          numberOfLines={1}
        >
          {item.lastMessage || "เริ่มการสนทนา..."}
        </Text>
      </View>

      <View style={styles.rightSection}>
        {item.unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>
              {item.unreadCount > 9 ? '9+' : item.unreadCount}
            </Text>
          </View>
        )}
        
        {item.itemImage ? (
          <View style={styles.itemImageFrame}>
            <Image source={{ uri: item.itemImage }} style={styles.itemThumb} />
          </View>
        ) : (
          <View style={[styles.itemImageFrame, styles.itemImagePlaceholder]}>
             <MaterialCommunityIcons name="image-off-outline" size={20} color="#E0D4C3" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) }]}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      
      {/* Header ที่ปรับความสูงและระยะห่างใหม่ */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backBtn} 
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <Ionicons name="chevron-back" size={30} color="#5A3D2B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={{ width: 44 }} /> 
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#D4A373" />
        </View>
      ) : chats.length === 0 ? (
        <View style={styles.emptyBox}>
          <MaterialCommunityIcons name="chat-processing-outline" size={80} color="#E8D5C4" />
          <Text style={styles.emptyTitle}>ไม่มีข้อความ</Text>
          <Text style={styles.emptySub}>คุณยังไม่มีประวัติการสนทนาในขณะนี้</Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          renderItem={renderChatItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF8E7" },
  loadingBox: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between", 
    paddingHorizontal: 10, 
    paddingBottom: 10,
    height: 56,
    // เพิ่มเส้นแบ่งเบาๆ เพื่อให้เห็นขอบเขต Header
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(212, 163, 115, 0.1)',
  },
  backBtn: { 
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { 
    fontSize: 20, 
    fontWeight: "900", 
    color: "#5A3D2B",
    textAlign: 'center'
  },

  listContainer: { paddingHorizontal: 16, paddingTop: 15, paddingBottom: 40 },
  chatCard: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 28,
    marginBottom: 16,
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  
  avatarContainer: { marginRight: 14 },
  avatar: { 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    backgroundColor: "#F9F5EB",
    borderWidth: 1,
    borderColor: "#F0E6D2"
  },
  
  chatContent: { flex: 1, justifyContent: 'center' },
  chatHeader: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    marginBottom: 4 
  },
  userName: { fontSize: 17, fontWeight: "800", color: "#5A3D2B", flex: 1 },
  timeText: { fontSize: 12, color: "#B0A090", fontWeight: "600" },

  itemBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF4E6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: "flex-start",
    marginBottom: 6,
    borderWidth: 0.5,
    borderColor: "#F5E6D3"
  },
  itemBadgeText: { fontSize: 11, color: "#A67B5B", fontWeight: "700", maxWidth: 140 },

  lastMessage: { fontSize: 15, color: "#8B7355", fontWeight: "500" },
  lastMessageUnread: { color: "#5A3D2B", fontWeight: "800" },

  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  unreadBadge: {
    backgroundColor: "#EF6B61",
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: '#FFF'
  },
  unreadText: { color: "#FFF", fontSize: 10, fontWeight: "900" },

  itemImageFrame: { 
    width: 64, 
    height: 64, 
    borderRadius: 14, 
    overflow: "hidden", 
    backgroundColor: "#F9F5EB",
    borderWidth: 1,
    borderColor: "#F0E6D2"
  },
  itemImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemThumb: { width: "100%", height: "100%", resizeMode: 'cover' },

  emptyBox: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: "#5A3D2B", marginTop: 20 },
  emptySub: { fontSize: 14, color: "#A89F91", textAlign: "center", marginTop: 8, lineHeight: 20 }
});