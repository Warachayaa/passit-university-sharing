import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, SafeAreaView, StatusBar, ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

import { auth, db } from '../config/firebase';
import {
  collection, query, where, onSnapshot,
  orderBy, updateDoc, doc, writeBatch,
} from 'firebase/firestore';

// ─── helpers ──────────────────────────────────────────────────────────────────
function timeAgo(ts) {
  try {
    const d = ts?.toDate?.();
    if (!d) return '';
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs} hr ago`;
    return `${Math.floor(hrs / 24)} days ago`;
  } catch { return ''; }
}

const TYPE_CONFIG = {
  ban: {
    icon: 'shield-off-outline',
    iconColor: '#E74C3C',
    bg: '#FFF5F5',
    border: '#FFCDD2',
    label: 'Post Banned',
  },
  unban: {
    icon: 'shield-check-outline',
    iconColor: '#27AE60',
    bg: '#F0FFF4',
    border: '#C8E6C9',
    label: 'Post Restored',
  },
  approved: {
    icon: 'check-circle-outline',
    iconColor: '#2980B9',
    bg: '#F0F8FF',
    border: '#BBDEFB',
    label: 'Approved',
  },
  default: {
    icon: 'bell-outline',
    iconColor: '#D4A373',
    bg: '#FFF8F0',
    border: '#F0DCC8',
    label: 'Notification',
  },
};

const getConfig = (type) => TYPE_CONFIG[type] || TYPE_CONFIG.default;

// ─── NotifCard ─────────────────────────────────────────────────────────────────
const NotifCard = ({ item, onPress }) => {
  const cfg = getConfig(item.type);
  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: cfg.bg, borderLeftColor: cfg.border },
        !item.isRead && styles.cardUnread,
      ]}
      onPress={() => onPress(item)}
      activeOpacity={0.8}
    >
      <View style={[styles.iconCircle, { backgroundColor: cfg.border }]}>
        <MaterialCommunityIcons name={cfg.icon} size={22} color={cfg.iconColor} />
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.cardTime}>{timeAgo(item.createdAt)}</Text>
        </View>
        <Text style={styles.cardMsg} numberOfLines={3}>{item.message}</Text>
        {!item.isRead && <View style={styles.unreadDot} />}
      </View>
    </TouchableOpacity>
  );
};

// ─── RequestCard ───────────────────────────────────────────────────────────────
const RequestCard = ({ item }) => (
  <View style={[styles.card, { backgroundColor: '#FFF8F0', borderLeftColor: '#F0DCC8' }]}>
    <View style={[styles.iconCircle, { backgroundColor: '#F0DCC8' }]}>
      <MaterialCommunityIcons name="inbox-outline" size={22} color="#D4A373" />
    </View>
    <View style={styles.cardBody}>
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle} numberOfLines={1}>New Request</Text>
        <Text style={styles.cardTime}>{timeAgo(item.createdAt)}</Text>
      </View>
      <Text style={styles.cardMsg} numberOfLines={2}>
        มีคนส่งคำขอมาสำหรับสินค้าของคุณ
      </Text>
    </View>
  </View>
);

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function NotificationScreen({ navigation }) {
  const [activeTab, setActiveTab]     = useState('system');
  const [sysNotifs, setSysNotifs]     = useState([]);
  const [reqNotifs, setReqNotifs]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);

  const user = auth?.currentUser;

  // ── listen to notifications ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }

    // System notifications (ban / unban / etc.)
    const qSys = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubSys = onSnapshot(qSys, (snap) => {
      setSysNotifs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      if (err.code !== 'permission-denied') console.error('notif error:', err);
      setLoading(false);
    });

    // Pending requests (เหมือน MyRequests)
    const qReq = query(
      collection(db, 'requests'),
      where('sellerId', '==', user.uid),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    const unsubReq = onSnapshot(qReq, (snap) => {
      setReqNotifs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      if (err.code !== 'permission-denied') console.error('req error:', err);
    });

    return () => { unsubSys(); unsubReq(); };
  }, [user?.uid]);

  // ── mark as read ─────────────────────────────────────────────────────────────
  const markRead = useCallback(async (item) => {
    if (item.isRead) return;
    try {
      await updateDoc(doc(db, 'notifications', item.id), { isRead: true });
    } catch (e) { console.error('mark read error:', e); }
  }, []);

  // ── mark all read ────────────────────────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    const unread = sysNotifs.filter(n => !n.isRead);
    if (!unread.length) return;
    const batch = writeBatch(db);
    unread.forEach(n => batch.update(doc(db, 'notifications', n.id), { isRead: true }));
    await batch.commit();
  }, [sysNotifs]);

  const unreadSys = sysNotifs.filter(n => !n.isRead).length;
  const unreadReq = reqNotifs.length;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#FFF8E7" barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="chevron-left" size={26} color="#A47551" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {activeTab === 'system' && unreadSys > 0 ? (
          <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 90 }} />
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {/* System tab */}
        <TouchableOpacity
          style={[styles.tab, activeTab === 'system' && styles.tabActive]}
          onPress={() => setActiveTab('system')}
        >
          <Text style={[styles.tabText, activeTab === 'system' && styles.tabTextActive]}>
            System
          </Text>
          {unreadSys > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadSys > 9 ? '9+' : unreadSys}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Requests tab */}
        <TouchableOpacity
          style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
          onPress={() => setActiveTab('requests')}
        >
          <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
            Requests
          </Text>
          {unreadReq > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadReq > 9 ? '9+' : unreadReq}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#D4A373" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D4A373" />}
        >
          {activeTab === 'system' ? (
            sysNotifs.length === 0 ? (
              <View style={styles.emptyBox}>
                <MaterialCommunityIcons name="bell-sleep-outline" size={56} color="#D4A373" />
                <Text style={styles.emptyText}>ไม่มีการแจ้งเตือน</Text>
              </View>
            ) : (
              sysNotifs.map(n => (
                <NotifCard key={n.id} item={n} onPress={markRead} />
              ))
            )
          ) : (
            reqNotifs.length === 0 ? (
              <View style={styles.emptyBox}>
                <MaterialCommunityIcons name="inbox-outline" size={56} color="#D4A373" />
                <Text style={styles.emptyText}>ไม่มีคำขอใหม่</Text>
                <TouchableOpacity
                  style={styles.goReqBtn}
                  onPress={() => navigation.navigate('MyRequests')}
                >
                  <Text style={styles.goReqText}>ดูคำขอทั้งหมด</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {reqNotifs.map(r => <RequestCard key={r.id} item={r} />)}
                <TouchableOpacity
                  style={styles.goReqBtn}
                  onPress={() => navigation.navigate('MyRequests')}
                >
                  <Text style={styles.goReqText}>จัดการคำขอทั้งหมด →</Text>
                </TouchableOpacity>
              </>
            )
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#FFF8E7' },

  header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 16 },
  backBtn:        { marginRight: 12, padding: 4 },
  headerTitle:    { flex: 1, fontSize: 22, fontWeight: '900', color: '#5A3D2B' },
  markAllBtn:     { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#F0DCC8', borderRadius: 10 },
  markAllText:    { fontSize: 12, color: '#A47551', fontWeight: '700' },

  tabRow:         { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 16, gap: 10 },
  tab:            { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 10, borderRadius: 20, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E8D5C4', gap: 6 },
  tabActive:      { backgroundColor: '#D9A77C', borderColor: '#D9A77C' },
  tabText:        { fontSize: 14, fontWeight: '700', color: '#8B7355' },
  tabTextActive:  { color: '#FFF' },
  badge:          { backgroundColor: '#E74C3C', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  badgeText:      { color: '#FFF', fontSize: 10, fontWeight: 'bold' },

  scroll:         { flex: 1, paddingHorizontal: 20 },

  card:           { flexDirection: 'row', borderRadius: 14, padding: 14, marginBottom: 12, borderLeftWidth: 4, elevation: 1 },
  cardUnread:     { elevation: 3 },
  iconCircle:     { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardBody:       { flex: 1, position: 'relative' },
  cardTop:        { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle:      { flex: 1, fontSize: 15, fontWeight: '800', color: '#5A3D2B' },
  cardTime:       { fontSize: 11, color: '#A47551', marginLeft: 8, marginTop: 2 },
  cardMsg:        { fontSize: 13, color: '#7A6352', lineHeight: 18 },
  unreadDot:      { position: 'absolute', top: 0, right: 0, width: 8, height: 8, borderRadius: 4, backgroundColor: '#E74C3C' },

  centerBox:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyBox:       { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText:      { fontSize: 16, color: '#8B7355', fontWeight: '600' },
  goReqBtn:       { marginTop: 8, backgroundColor: '#5A7D5A', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, alignSelf: 'center' },
  goReqText:      { color: '#FFF', fontWeight: '700', fontSize: 14 },
});