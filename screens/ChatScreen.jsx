import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar,
  Alert,
  Keyboard,
  Modal
} from "react-native";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { auth, db } from "../config/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  getDoc,
  increment,
  writeBatch,
  getDocs, // 🌟 เพิ่ม getDocs
  limit    // 🌟 เพิ่ม limit
} from "firebase/firestore";

const DEFAULT_AVATAR = 'https://img2.pic.in.th/Unknown_User.jpg';

const REPORT_REASONS = [
  "พฤติกรรมคุกคามหรือใช้คำหยาบคาย",
  "การหลอกลวง การฉ้อโกง หรือสแปม",
  "รูปภาพไม่เหมาะสม หรืออนาจาร",
  "อื่นๆ"
];

function ChatScreenContent({ navigation, route }) {
  const { chatId, sellerName, itemTitle } = route.params || {};
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [usersInfo, setUsersInfo] = useState({}); 
  const [partnerInfo, setPartnerInfo] = useState({ 
    id: "", 
    name: sellerName || "Loading...", 
    avatar: DEFAULT_AVATAR 
  });
  
  const [showReportModal, setShowReportModal] = useState(false);
  const flatListRef = useRef(null);
  const currentUser = auth.currentUser;
  const insets = useSafeAreaInsets(); 
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const keyboardShowListener = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    const keyboardHideListener = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      if (Platform.OS === 'android') {
        Keyboard.dismiss();
      }
    });

    return () => {
      keyboardShowListener.remove();
      keyboardHideListener.remove();
    };
  }, []);

  const markMessagesAsRead = async (msgs) => {
    if (!chatId || !currentUser) return;
    try {
      const unreadFromPartner = msgs.filter(
        m => m.senderId !== currentUser.uid && m.read === false && !m.isUnsent
      );
      if (unreadFromPartner.length > 0) {
        const batch = writeBatch(db);
        unreadFromPartner.forEach((msg) => {
          const msgRef = doc(db, "chats", chatId, "messages", msg.id);
          batch.update(msgRef, { read: true });
        });
        await batch.commit();
      }
    } catch (e) { console.warn(e); }
  };

  useEffect(() => {
    if (chatId && currentUser) {
      updateDoc(doc(db, "chats", chatId), {
        [`unreadCount_${currentUser.uid}`]: 0
      }).catch(e => console.warn(e));
    }
  }, [chatId, currentUser?.uid]);

  useEffect(() => {
    if (!chatId) {
      setLoading(false);
      return;
    }
    const fetchParticipants = async () => {
      try {
        const chatSnap = await getDoc(doc(db, "chats", chatId));
        if (chatSnap.exists()) {
          const { participants } = chatSnap.data();
          let tempUsersInfo = {};
          for (const uid of participants || []) {
            const userSnap = await getDoc(doc(db, "users", uid));
            if (userSnap.exists()) {
              const userData = userSnap.data();
              const profile = { id: uid, name: userData.fullName || "User", avatar: userData.photoURL || DEFAULT_AVATAR };
              tempUsersInfo[uid] = profile;
              if (uid !== currentUser?.uid) setPartnerInfo(profile);
            }
          }
          setUsersInfo(tempUsersInfo);
        }
      } catch (error) { console.error(error); }
    };
    fetchParticipants();

    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      setMessages(msgs);
      setLoading(false);
      markMessagesAsRead(msgs);
      
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
    });
    return () => unsubscribe();
  }, [chatId]);

  const handleSendText = async () => {
    if (inputText.trim() === "" || !currentUser || !chatId) return;
    const textToSend = inputText.trim();
    setInputText(""); 
    
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      await addDoc(collection(db, "chats", chatId, "messages"), {
        text: textToSend,
        senderId: currentUser.uid,
        createdAt: serverTimestamp(),
        read: false,
        isUnsent: false,
      });
      const chatRef = doc(db, "chats", chatId);
      const updateData = { lastMessage: textToSend, updatedAt: serverTimestamp() };
      const targetId = partnerInfo.id;
      if (targetId) updateData[`unreadCount_${targetId}`] = increment(1);
      await updateDoc(chatRef, updateData);
    } catch (error) { console.error(error); }
  };

  // 🌟 ฟังก์ชัน Unsend ข้อความที่ได้รับการปรับปรุงใหม่ 🌟
  const handleUnsend = (messageId, senderId) => {
    if (senderId !== currentUser.uid) return;
    Alert.alert(
      "ยกเลิกข้อความ", 
      "ข้อความนี้จะถูกลบออกจากการสนทนาของทั้งสองฝ่าย", 
      [
        { text: "ปิด", style: "cancel" },
        { 
          text: "ยกเลิกข้อความ", 
          style: "destructive",
          onPress: async () => {
            try {
              // 1. อัปเดตสถานะข้อความให้เป็น Unsent ในห้องแชท
              await updateDoc(doc(db, "chats", chatId, "messages", messageId), { 
                isUnsent: true, 
                text: null,
                imageUrl: null 
              });

              // 2. ดึงข้อความล่าสุดจากฐานข้อมูลโดยตรง เพื่ออัปเดตหน้า MessagesScreen ให้ถูกต้องแม่นยำ 100%
              const qLatest = query(
                collection(db, "chats", chatId, "messages"), 
                orderBy("createdAt", "desc"), 
                limit(1)
              );
              const snapLatest = await getDocs(qLatest);

              if (!snapLatest.empty) {
                const latestData = snapLatest.docs[0].data();
                
                // ตรวจสอบว่าข้อความล่าสุดคืออะไร
                let newLastMessage = latestData.text || "ส่งรูปภาพ";
                
                // หากข้อความล่าสุดเป็นข้อความที่ถูกยกเลิก ให้แสดงคำว่า "ยกเลิกข้อความแล้ว"
                if (latestData.isUnsent) {
                  newLastMessage = "ยกเลิกข้อความแล้ว";
                }

                // อัปเดตข้อมูลของห้องแชทรวม (นี่คือส่วนที่จะไปโชว์ในหน้า MessagesScreen)
                await updateDoc(doc(db, "chats", chatId), {
                  lastMessage: newLastMessage,
                });
              }
            } catch (error) {
              console.error("Error unsending message:", error);
            }
          }
        }
      ]
    );
  };

  const handleReport = async (reason) => {
    setShowReportModal(false);
    try {
      await addDoc(collection(db, 'reports'), {
        reporterId: currentUser?.uid,
        reportedId: partnerInfo.id,
        chatId, reason, status: 'pending', createdAt: serverTimestamp()
      });
      Alert.alert("Report Sent", "Thank you for your report.");
    } catch (e) { Alert.alert("Error", "Failed to send report."); }
  };

  const renderMessageItem = ({ item }) => {
    const isMe = item.senderId === currentUser?.uid;
    const sender = usersInfo[item.senderId] || { name: "...", avatar: DEFAULT_AVATAR };
    const msgTime = item.createdAt?.toDate ? 
      item.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : "";

    if (item.isUnsent) {
      return (
        <View style={[styles.messageRow, isMe ? styles.myMessageRow : styles.otherMessageRow]}>
          {!isMe && <Image source={{ uri: sender.avatar }} style={styles.messageAvatar} />}
          <View style={[styles.unsentContent, isMe ? styles.myUnsentBubble : styles.otherUnsentBubble]}>
             <Text style={styles.unsentText}>ยกเลิกข้อความแล้ว</Text>
          </View>
          {isMe && <Image source={{ uri: usersInfo[currentUser?.uid]?.avatar || DEFAULT_AVATAR }} style={styles.messageAvatar} />}
        </View>
      );
    }

    return (
      <View style={[styles.messageRow, isMe ? styles.myMessageRow : styles.otherMessageRow]}>
        {!isMe && <Image source={{ uri: sender.avatar }} style={styles.messageAvatar} />}
        
        {isMe && (
          <View style={styles.myMessageStatus}>
            {item.read && <Text style={styles.readReceiptText}>Read</Text>}
            <Text style={styles.messageTimeText}>{msgTime}</Text>
          </View>
        )}

        <View style={styles.messageBubbleContainer}>
          {!isMe && <Text style={styles.senderNameLabel}>{sender.name}</Text>}
          <TouchableOpacity 
            activeOpacity={0.8} 
            onLongPress={() => isMe && handleUnsend(item.id, item.senderId)} 
            style={[styles.messageBubble, isMe ? styles.myBubble : styles.otherBubble]}
          >
            {item.imageUrl && <Image source={{ uri: item.imageUrl }} style={styles.bubbleImage} />}
            {item.text && <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.otherMessageText]}>{item.text}</Text>}
          </TouchableOpacity>
        </View>

        {!isMe && (
          <View style={styles.otherMessageStatus}>
            <Text style={styles.messageTimeText}>{msgTime}</Text>
          </View>
        )}

        {isMe && <Image source={{ uri: usersInfo[currentUser?.uid]?.avatar || DEFAULT_AVATAR }} style={styles.messageAvatar} />}
      </View>
    );
  };

  const Wrapper = Platform.OS === 'ios' ? KeyboardAvoidingView : View;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#D4A373" />
      
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 40 : StatusBar.currentHeight + 10 }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <View style={styles.headerTitleRow}>
            <Image source={{ uri: partnerInfo.avatar }} style={styles.headerAvatar} />
            <Text style={styles.headerTitle} numberOfLines={1}>{partnerInfo.name.toUpperCase()}</Text>
          </View>
          {itemTitle && (
            <View style={styles.itemTag}>
              <Feather name="box" size={10} color="#FFF" />
              <Text style={styles.itemTagText} numberOfLines={1}> {itemTitle}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.headerBtnRight} onPress={() => setShowReportModal(true)}>
          <Feather name="flag" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <Wrapper 
        style={styles.keyboardView} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.chatArea}>
          {loading ? (
            <View style={styles.loadingBox}><ActivityIndicator color="#D4A373" size="large" /></View>
          ) : (
            <FlatList 
              ref={flatListRef} 
              data={messages} 
              keyExtractor={(item) => item.id} 
              renderItem={renderMessageItem} 
              contentContainerStyle={styles.messageList} 
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })} 
              showsVerticalScrollIndicator={false} 
              keyboardShouldPersistTaps="handled"
              removeClippedSubviews={false}
            />
          )}
        </View>

        <View style={[
          styles.inputWrapper, 
          { paddingBottom: Platform.OS === 'ios' ? (isKeyboardVisible ? 10 : 30) : 10 }
        ]}>
          <View style={styles.inputBar}>
            <TouchableOpacity style={styles.actionIcon}>
              <Feather name="camera" size={24} color="#A47551" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionIcon}>
              <Feather name="image" size={24} color="#A47551" />
            </TouchableOpacity>
            
            <View style={styles.inputBox}>
              <TextInput 
                style={styles.textInput} 
                placeholder="เขียนข้อความ..." 
                placeholderTextColor="#B0A090" 
                value={inputText} 
                onChangeText={setInputText} 
                multiline 
                maxLength={1000} 
                onFocus={() => {
                  setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
                }}
              />
            </View>
            
            <TouchableOpacity 
              style={[styles.sendIcon, !inputText.trim() && styles.disabledSend]} 
              onPress={handleSendText} 
              disabled={!inputText.trim()}
            >
              <Ionicons name="send" size={24} color={inputText.trim() ? "#A47551" : "#D9C5B2"} />
            </TouchableOpacity>
          </View>
        </View>
      </Wrapper>

      <Modal visible={showReportModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.reportSheet}>
            <View style={styles.reportHeader}>
              <TouchableOpacity onPress={() => setShowReportModal(false)}><Feather name="x" size={24} color="#111" /></TouchableOpacity>
              <Text style={styles.reportTitle}>รายงาน</Text><View style={{ width: 24 }} />
            </View>
            {REPORT_REASONS.map((reason, index) => (
              <TouchableOpacity key={index} style={styles.reportItem} onPress={() => handleReport(reason)}>
                <Text style={styles.reportItemText}>{reason}</Text>
                <Feather name="chevron-right" size={20} color="#CCC" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function App(props) {
  return (<SafeAreaProvider><ChatScreenContent {...props} /></SafeAreaProvider>);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF8E7" },
  header: { flexDirection: "row", alignItems: "center", backgroundColor: "#D4A373", paddingHorizontal: 15, paddingBottom: 15 },
  headerBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "flex-start" },
  headerBtnRight: { width: 44, height: 44, justifyContent: "center", alignItems: "flex-end" },
  headerContent: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  headerAvatar: { width: 34, height: 34, borderRadius: 17, marginRight: 10, borderWidth: 1.5, borderColor: "#FFF" },
  headerTitle: { fontSize: 17, fontWeight: "900", color: "#FFF", letterSpacing: 0.4 },
  itemTag: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, marginTop: 2 },
  itemTagText: { fontSize: 11, color: "#FFF", fontWeight: "700" },
  keyboardView: { flex: 1 },
  chatArea: { flex: 1 },
  loadingBox: { flex: 1, justifyContent: "center", alignItems: "center" },
  messageList: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 25 },
  messageRow: { flexDirection: "row", marginBottom: 18, alignItems: "flex-end" },
  myMessageRow: { justifyContent: "flex-end" },
  otherMessageRow: { justifyContent: "flex-start" },
  messageAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#E0D4C3", borderWidth: 1, borderColor: "#D4A373" },
  messageBubbleContainer: { maxWidth: "70%", marginHorizontal: 8 },
  senderNameLabel: { fontSize: 10, fontWeight: "700", color: "#8B7355", marginBottom: 3, marginLeft: 5 },
  messageBubble: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 20, backgroundColor: "#FFF", elevation: 1 },
  bubbleImage: { width: 200, height: 150, borderRadius: 12, marginBottom: 8 },
  myBubble: { borderBottomRightRadius: 2, backgroundColor: "#FFFBF2" },
  otherBubble: { borderBottomLeftRadius: 2, backgroundColor: "#FFF" },
  messageText: { fontSize: 15, color: "#5A3D2B", lineHeight: 22 },
  myMessageText: { fontWeight: "400" },
  otherMessageText: { fontWeight: "400" },
  unsentContent: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18, borderWidth: 1.5, borderColor: "#A67B5B", borderStyle: 'dashed', backgroundColor: 'rgba(166, 123, 91, 0.05)', marginVertical: 4, maxWidth: '70%', marginHorizontal: 8 },
  myUnsentBubble: { borderBottomRightRadius: 2 },
  otherUnsentBubble: { borderBottomLeftRadius: 2 },
  unsentText: { fontSize: 12, color: "#A67B5B", fontWeight: '700', letterSpacing: 0.5 },
  myMessageStatus: { alignItems: 'flex-end', marginRight: 4, marginBottom: 2 },
  otherMessageStatus: { alignItems: 'flex-start', marginLeft: 4, marginBottom: 2 },
  readReceiptText: { fontSize: 10, color: "#85A77B", fontWeight: "800" },
  messageTimeText: { fontSize: 9, color: "#B0A090" },
  inputWrapper: { backgroundColor: "#FFFFFF", borderTopWidth: 1.5, borderTopColor: "#F5E6D3" },
  inputBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 15, paddingVertical: 12 },
  inputBox: { flex: 1, backgroundColor: "#F9F5EB", borderRadius: 25, paddingHorizontal: 18, marginHorizontal: 12, borderWidth: 1.5, borderColor: "#E8D5C4", justifyContent: "center", paddingVertical: Platform.OS === 'ios' ? 8 : 0 },
  textInput: { fontSize: 15, color: "#5A3D2B", minHeight: 40, maxHeight: 120 },
  actionIcon: { padding: 6 },
  sendIcon: { padding: 6 },
  disabledSend: { opacity: 0.35 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  reportSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 20 },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  reportTitle: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  reportItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  reportItemText: { fontSize: 16, color: '#333' },
});