// screens/NotificationContext.jsx
import React, { createContext, useState, useEffect, useRef } from 'react';

/**
 * ⚠️ หมายเหตุสำหรับสภาพแวดล้อม Preview:
 * ข้อผิดพลาด "Could not resolve" สำหรับ 'expo-av' และ '../config/firebase'
 * เกิดจากระบบจำลองบนเว็บไม่มีไฟล์เหล่านี้ แต่โค้ดนี้ถูกต้องและพร้อมใช้งาน
 * ในโปรเจกต์ React Native / Expo จริงของคุณครับ
 */

import { Audio } from 'expo-av';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../config/firebase'; 

export const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [pendingCount, setPendingCount] = useState(0);
  
  // Refs สำหรับจดจำจำนวนก่อนหน้าเพื่อเทียบหาของใหม่
  const prevPendingCount = useRef(0);
  const prevApprovedCount = useRef(0);
  const prevUnreadMessages = useRef(0);
  
  const isFirstLoad = useRef(true);

  // 🔊 ฟังก์ชันเล่นเสียงแจ้งเตือนแยกตามประเภท
  const playNotificationSound = async (soundType) => {
    try {
      // ตั้งค่า Audio Mode เพื่อให้เสียงดังแม้จะเปิดโหมดเงียบ (สำหรับ iOS/Android)
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      let soundFile;
      if (soundType === 'NEW_REQUEST') {
        // 📥 เสียงเมื่อมีคนส่งคำขอมาหาเรา
        soundFile = require('../assets/notification.mp3'); 
      } else if (soundType === 'REQUEST_APPROVED') {
        // ✅ เสียงเมื่อเจ้าของของอนุมัติคำขอเรา (เปลี่ยนเป็น notification.mp3 ตามที่ต้องการ)
        soundFile = require('../assets/notification.mp3'); 
      } else if (soundType === 'NEW_CHAT') {
        // 💬 เสียงเมื่อมีคนทักแชทมา
        soundFile = require('../assets/ChatNotic.mp3'); 
      }

      if (soundFile) {
        const { sound } = await Audio.Sound.createAsync(soundFile, { shouldPlay: true });
        await sound.playAsync();
        
        // คืนหน่วยความจำเมื่อเล่นจบ
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) {
            sound.unloadAsync();
          }
        });
      }
    } catch (error) {
      console.log("Sound play error (อาจเกิดจากยังไม่มีไฟล์ใน assets):", error);
    }
  };

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        const uid = user.uid;

        // 1. [ฝั่งคนให้] ฟังคำขอใหม่ที่ส่งมาหาเรา (Pending Requests)
        const qPending = query(
          collection(db, 'requests'),
          where('sellerId', '==', uid),
          where('status', '==', 'pending')
        );
        const unsubPending = onSnapshot(qPending, (snap) => {
          const count = snap.size;
          if (!isFirstLoad.current && count > prevPendingCount.current) {
            playNotificationSound('NEW_REQUEST');
          }
          prevPendingCount.current = count;
          setPendingCount(count);
        }, (error) => {
          // ซ่อน Permission Error เพื่อไม่ให้กวนใจขณะสลับหน้า
          if (error.code !== 'permission-denied') console.error("Pending Snapshot Error:", error);
        });

        // 2. [ฝั่งคนขอ] ฟังเมื่อคำขอของเราถูกอนุมัติ (Approved Requests)
        const qApproved = query(
          collection(db, 'requests'),
          where('buyerId', '==', uid),
          where('status', '==', 'approved')
        );
        const unsubApproved = onSnapshot(qApproved, (snap) => {
          const count = snap.size;
          if (!isFirstLoad.current && count > prevApprovedCount.current) {
            playNotificationSound('REQUEST_APPROVED');
          }
          prevApprovedCount.current = count;
        }, (error) => {
          if (error.code !== 'permission-denied') console.error("Approved Snapshot Error:", error);
        });

        // 3. [แชท] ฟังเมื่อมีข้อความใหม่ (Unread Messages)
        const qChats = query(
          collection(db, 'chats'),
          where('users', 'array-contains', uid)
        );
        const unsubChats = onSnapshot(qChats, (snap) => {
          let totalUnread = 0;
          snap.forEach(doc => {
            const data = doc.data();
            totalUnread += (data[`unreadCount_${uid}`] || 0);
          });

          if (!isFirstLoad.current && totalUnread > prevUnreadMessages.current) {
            playNotificationSound('NEW_CHAT');
          }
          prevUnreadMessages.current = totalUnread;
        }, (error) => {
          if (error.code !== 'permission-denied') console.error("Chat Snapshot Error:", error);
        });

        // หน่วงเวลาเล็กน้อยเพื่อให้ Listener ทำงานครบถ้วนก่อนเริ่มตรวจจับความเปลี่ยนแปลง
        const timer = setTimeout(() => { 
          isFirstLoad.current = false; 
        }, 3000);

        return () => {
          clearTimeout(timer);
          unsubPending();
          unsubApproved();
          unsubChats();
        };
      } else {
        isFirstLoad.current = true;
        setPendingCount(0);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  return (
    <NotificationContext.Provider value={{ pendingCount }}>
      {children}
    </NotificationContext.Provider>
  );
};