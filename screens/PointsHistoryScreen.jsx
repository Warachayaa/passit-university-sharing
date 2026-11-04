import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, Dimensions } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { db, auth } from '../config/firebase';

const { width } = Dimensions.get('window');

/**
 * 🦆 Cute Level Progression Logic (10 Levels)
 * Based on the progression: BabyDuck -> LegendaryDuck
 */
const getLevelInfo = (points) => {
  const safePoints = points || 0; 
  const levels = [
    { lv: 1, name: 'BabyDuck', min: 0, next: 1000 },
    { lv: 2, name: 'TinyDuck', min: 1000, next: 2000 },
    { lv: 3, name: 'HappyDuck', min: 2000, next: 3000 },
    { lv: 4, name: 'ChubbyDuck', min: 3000, next: 4000 },
    { lv: 5, name: 'SmartDuck', min: 4000, next: 5000 },
    { lv: 6, name: 'SuperDuck', min: 5000, next: 6000 },
    { lv: 7, name: 'MegaDuck', min: 6000, next: 7000 },
    { lv: 8, name: 'UltraDuck', min: 7000, next: 8000 },
    { lv: 9, name: 'GoldenDuck', min: 8000, next: 9000 },
    { lv: 10, name: 'LegendaryDuck', min: 9000, next: 999999 },
  ];
  
  for (let i = levels.length - 1; i >= 0; i--) {
    if (safePoints >= levels[i].min) return levels[i];
  }
  return levels[0];
};

/**
 * PointsHistoryScreen Component
 * Displays user's points, real-time level progress, and recent activity.
 */
export default function PointsHistoryScreen({ navigation }) {
  const [userData, setUserData] = useState({ duckPoints: 0, lifetimePoints: 0 });
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // 1. Real-time User Data Listener
    const unsubUser = db.collection('users').doc(user.uid).onSnapshot((doc) => {
      if (doc.exists) {
        setUserData(doc.data());
      }
    });

    // 2. Real-time Activity History Listener
    const unsubHistory = db.collection('pointHistory')
      .where('userId', '==', user.uid)
      .orderBy('createdAt', 'desc')
      .onSnapshot((snapshot) => {
        setActivities(snapshot.docs.map(doc => {
          const data = doc.data();
          let dateStr = "Just now";
          if (data.createdAt) {
            const d = data.createdAt.toDate();
            // English Format for Global Audience
            dateStr = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) + ', ' + 
                     d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          }
          
          // Icon mapping based on transaction type
          let icon = 'star';
          const t = (data.title || '').toLowerCase();
          if (t.includes('redeem')) icon = 'gift';
          else if (t.includes('post')) icon = 'add-circle';
          else if (t.includes('deal')) icon = 'checkmark-circle';
          else if (t.includes('streak')) icon = 'calendar';
          
          return { id: doc.id, ...data, date: dateStr, icon };
        }));
      }, (error) => {
        console.error("Firebase History Query Error:", error);
      });

    return () => {
      unsubUser();
      unsubHistory();
    };
  }, []);

  // 🦆 Real-time Progression Calculations
  const xp = (userData.lifetimePoints !== undefined) ? userData.lifetimePoints : (userData.duckPoints || 0);
  const levelInfo = getLevelInfo(xp);
  
  // Progress bar within the current level range
  const range = levelInfo.next - levelInfo.min;
  const earnedInCurrentLevel = xp - levelInfo.min;
  const progressPercent = Math.max(0, Math.min((earnedInCurrentLevel / range) * 100, 100));
  const pointsToNext = Math.max(levelInfo.next - xp, 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#5A3D2B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Point</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Points Summary Card (Figma Layout) */}
        <View style={styles.pointsCard}>
          <View style={styles.pointsLeft}>
            <Text style={styles.pointsLabel}>YOUR DUCKDUCK</Text>
            <View style={styles.pointsRow}>
              <Image 
                source={{ uri: 'https://img2.pic.in.th/duck3.png' }} 
                style={styles.duckIcon} 
              />
              <Text style={styles.pointsValue}>{userData.duckPoints || 0} <Text style={styles.ptsUnit}>pts</Text></Text>
            </View>
          </View>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>LV.{levelInfo.lv} {levelInfo.name.toUpperCase()}</Text>
          </View>
        </View>

        {/* Active Goals & Real-time Progress Bar */}
        <View style={styles.goalsSection}>
          <View style={styles.goalHeaderRow}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#5A3D2B" />
            <Text style={styles.goalHeader}>Active Goals</Text>
          </View>
          
          <View style={styles.milestoneHeader}>
            <Text style={styles.milestoneText}>Next Milestone</Text>
            <Text style={styles.milestoneValue}>{xp}/{levelInfo.next} pts</Text>
          </View>

          {/* Progress Bar Container */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBackground}>
              <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
            </View>
          </View>

          {/* Badge Info */}
          <View style={styles.badgeRow}>
            <Ionicons name="gift-outline" size={20} color="#5A7D5A" style={{marginRight: 10}} />
            <View>
              <Text style={styles.badgeTitle}>Duck Leader Badge</Text>
              <Text style={styles.badgeSubtitle}>
                {levelInfo.lv === 10 ? 'MAX Level Reached!' : `${pointsToNext} points until you level up!`}
              </Text>
            </View>
          </View>
        </View>

        {/* Recent Activity Section */}
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.activityList}>
          {activities.length > 0 ? (
            activities.map((item) => (
              <View key={item.id} style={styles.activityItem}>
                <View style={styles.activityLeft}>
                  <View style={styles.iconCircle}>
                    <Ionicons name={item.icon} size={20} color="#D4A373" />
                  </View>
                  <View>
                    <Text style={styles.activityTitle}>{item.title}</Text>
                    <Text style={styles.activityDate}>{item.date}</Text>
                  </View>
                </View>
                <Text style={[styles.activityPoints, item.points > 0 ? styles.positive : styles.negative]}>
                  {item.points > 0 ? `+${item.points}` : item.points}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No recent activity yet 🦆</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8E7' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingBottom: 10 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#5A3D2B' },
  
  pointsCard: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 24, padding: 20, justifyContent: 'space-between', alignItems: 'center', elevation: 2, marginBottom: 25 },
  pointsLeft: { flex: 1 },
  pointsLabel: { fontSize: 13, color: '#D4A373', fontWeight: '700', marginBottom: 8 },
  pointsRow: { flexDirection: 'row', alignItems: 'center' },
  duckIcon: { width: 65, height: 65, marginRight: 12, resizeMode: 'contain' },
  pointsValue: { fontSize: 32, fontWeight: '800', color: '#5A3D2B' },
  ptsUnit: { fontSize: 18, fontWeight: '600', color: '#8B7355' },
  levelBadge: { backgroundColor: '#F5E6D3', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: '#D4A373' },
  levelText: { fontSize: 12, fontWeight: '800', color: '#8B7355' },

  goalsSection: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, marginBottom: 25 },
  goalHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  goalHeader: { fontSize: 16, fontWeight: '700', color: '#5A3D2B', marginLeft: 8 },
  milestoneHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  milestoneText: { fontSize: 14, fontWeight: '600', color: '#5A3D2B' },
  milestoneValue: { fontSize: 14, fontWeight: '700', color: '#8B7355' },
  
  progressContainer: { marginBottom: 10 },
  progressBackground: { height: 12, backgroundColor: '#E0E0E0', borderRadius: 10, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#6B8E6B', borderRadius: 10 },
  
  badgeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9F5EB', padding: 12, borderRadius: 12, marginTop: 15 },
  badgeTitle: { fontSize: 14, fontWeight: '700', color: '#5A3D2B' },
  badgeSubtitle: { fontSize: 12, color: '#8B7355', marginTop: 2 },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#5A3D2B', marginBottom: 15 },
  activityList: { gap: 12 },
  activityItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', padding: 16, borderRadius: 16, marginBottom: 10 },
  activityLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5E6D3', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  activityTitle: { fontSize: 15, fontWeight: '600', color: '#5A3D2B' },
  activityDate: { fontSize: 13, color: '#8B7355', marginTop: 2 },
  activityPoints: { fontSize: 16, fontWeight: '700' },
  positive: { color: '#4CAF50' },
  negative: { color: '#5A3D2B' },
  emptyText: { textAlign: 'center', color: '#8B7355', marginTop: 20, fontSize: 14 }
});