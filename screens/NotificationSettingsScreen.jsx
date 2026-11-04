// หมายเหตุสำหรับผู้ใช้: โค้ดนี้ถูกออกแบบมาเพื่อใช้งานในสภาพแวดล้อม React Native (Expo) จริงของคุณ
// หากคุณเห็นข้อผิดพลาด "Could not resolve" ในหน้าพรีวิว Canvas นี้ เกิดจากระบบพรีวิวบนเว็บไม่รองรับโมดูลของมือถือ
// แต่โค้ดนี้ถูกต้องและพร้อมใช้งานในโปรเจกต์ของคุณทันทีครับ
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Platform,
  Alert
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function NotificationSettingsScreen({ navigation }) {
  // States สำหรับการเปิด/ปิดแจ้งเตือนแต่ละประเภท
  const [pushEnabled, setPushEnabled] = useState(true);
  const [itemRequests, setItemRequests] = useState(true);
  const [requestApprovals, setRequestApprovals] = useState(true);
  const [chatMessages, setChatMessages] = useState(true);
  const [dealUpdates, setDealUpdates] = useState(true);
  const [dailyReminders, setDailyReminders] = useState(true);

  const toggleMasterSwitch = (value) => {
    setPushEnabled(value);
    // ถ้าปิด Master ให้ปิดทั้งหมด ถ้าเปิด Master ให้เปิดทั้งหมด
    setItemRequests(value);
    setRequestApprovals(value);
    setChatMessages(value);
    setDealUpdates(value);
    setDailyReminders(value);
  };

  const handleSave = () => {
    // ในโปรเจกต์จริง สามารถนำค่า State เหล่านี้ไปบันทึกใน Firestore (ใน collection users) หรือ AsyncStorage
    Alert.alert("Success", "บันทึกการตั้งค่าการแจ้งเตือนเรียบร้อยแล้ว", [
      { text: "OK", onPress: () => navigation.goBack() }
    ]);
  };

  // คอมโพเนนต์สำหรับแต่ละแถวการตั้งค่า
  const SettingRow = ({ icon, iconFamily = 'Feather', title, subtitle, value, onValueChange, disabled = false }) => {
    const IconComponent = iconFamily === 'Ionicons' ? Ionicons : 
                          iconFamily === 'MaterialCommunityIcons' ? MaterialCommunityIcons : Feather;

    return (
      <View style={[styles.settingRow, disabled && { opacity: 0.5 }]}>
        <View style={styles.iconBox}>
          <IconComponent name={icon} size={20} color="#8B7355" />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle ? <Text style={styles.settingSubtitle}>{subtitle}</Text> : null}
        </View>
        <Switch
          trackColor={{ false: "#E8D5C4", true: "#85A77B" }}
          thumbColor={Platform.OS === 'ios' ? "#FFF" : value ? "#FFF" : "#F4F3F4"}
          ios_backgroundColor="#E8D5C4"
          onValueChange={onValueChange}
          value={value}
          disabled={disabled}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8E7" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#5A3D2B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Master Switch */}
        <View style={styles.masterCard}>
          <View style={styles.masterTextContainer}>
            <Text style={styles.masterTitle}>Push Notifications</Text>
            <Text style={styles.masterSubtitle}>เปิดรับการแจ้งเตือนทั้งหมดจากแอป Passitu</Text>
          </View>
          <Switch
            trackColor={{ false: "#E8D5C4", true: "#D9A77C" }}
            thumbColor={Platform.OS === 'ios' ? "#FFF" : pushEnabled ? "#FFF" : "#F4F3F4"}
            ios_backgroundColor="#E8D5C4"
            onValueChange={toggleMasterSwitch}
            value={pushEnabled}
            style={{ transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }] }}
          />
        </View>

        {/* Section: Activity */}
        <Text style={styles.sectionHeader}>Activity</Text>
        <View style={styles.cardGroup}>
          <SettingRow 
            icon="inbox" 
            title="Item Requests" 
            subtitle="เมื่อมีคนส่งคำขอรับของจากคุณ"
            value={itemRequests} 
            onValueChange={setItemRequests}
            disabled={!pushEnabled}
          />
          <View style={styles.divider} />
          <SettingRow 
            icon="check-circle" 
            title="Request Approvals" 
            subtitle="เมื่อเจ้าของของอนุมัติคำขอของคุณ"
            value={requestApprovals} 
            onValueChange={setRequestApprovals}
            disabled={!pushEnabled}
          />
        </View>

        {/* Section: Communication & Deals */}
        <Text style={styles.sectionHeader}>Communication & Deals</Text>
        <View style={styles.cardGroup}>
          <SettingRow 
            icon="message-circle" 
            title="Chat Messages" 
            subtitle="เมื่อมีข้อความใหม่ในห้องแชท"
            value={chatMessages} 
            onValueChange={setChatMessages}
            disabled={!pushEnabled}
          />
          <View style={styles.divider} />
          <SettingRow 
            icon="heart" 
            title="Deal Updates" 
            subtitle="การนัดหมาย, เวลาใกล้หมด, และดีลสำเร็จ"
            value={dealUpdates} 
            onValueChange={setDealUpdates}
            disabled={!pushEnabled}
          />
        </View>

        {/* Section: System & Rewards */}
        <Text style={styles.sectionHeader}>System & Rewards</Text>
        <View style={styles.cardGroup}>
          <SettingRow 
            icon="gift-outline"
            iconFamily="MaterialCommunityIcons"
            title="Daily DuckPoints" 
            subtitle="แจ้งเตือนให้เข้ามารับแต้มทุกวัน"
            value={dailyReminders} 
            onValueChange={setDailyReminders}
            disabled={!pushEnabled}
          />
        </View>

        {/* Info Text */}
        <Text style={styles.infoText}>
          หากคุณปิดการแจ้งเตือน คุณอาจพลาดการนัดรับของที่สำคัญ ซึ่งอาจนำไปสู่การถูกระงับบัญชีได้
        </Text>

      </ScrollView>

      {/* Save Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Save Changes</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8E7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
    paddingBottom: 15,
  },
  backBtn: {
    padding: 4,
    marginLeft: -4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#5A3D2B',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  
  masterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#5A3D2B',
    padding: 20,
    borderRadius: 20,
    marginTop: 10,
    marginBottom: 25,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  masterTextContainer: {
    flex: 1,
    paddingRight: 15,
  },
  masterTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 4,
  },
  masterSubtitle: {
    fontSize: 13,
    color: '#E8D5C4',
    lineHeight: 18,
  },

  sectionHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: '#8B7355',
    marginBottom: 10,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  cardGroup: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    marginBottom: 25,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F0E6D2',
    elevation: 1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFF8E7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    paddingRight: 10,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#5A3D2B',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 12,
    color: '#A47551',
  },
  divider: {
    height: 1,
    backgroundColor: '#F5E6D3',
    marginLeft: 68, // ให้เส้นกั้นเริ่มตรงกับ Text
  },

  infoText: {
    fontSize: 13,
    color: '#A47551',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 10,
    paddingHorizontal: 10,
    fontStyle: 'italic',
  },

  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF8E7',
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: Platform.OS === 'ios' ? 35 : 20,
    borderTopWidth: 1,
    borderTopColor: '#F5E6D3',
  },
  saveBtn: {
    backgroundColor: '#6B8E6B',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#6B8E6B',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
});