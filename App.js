// App.js
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { onAuthStateChanged } from 'firebase/auth';
import { ActivityIndicator, View } from 'react-native';

import { auth } from './config/firebase';

// 🌟 แก้ไข Path ให้ถูกต้องตาม Explorer ของคุณ (ไฟล์อยู่ในโฟลเดอร์ screens)
import { NotificationProvider } from './screens/NotificationContext';

// Screens
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import ResetPasswordScreen from './screens/ResetPasswordScreen';

import HomeScreen from './screens/HomeScreen';
import MyItemsScreen from './screens/MyItemsScreen';
import QRScanScreen from './screens/QRScanScreen';
import RewardsScreen from './screens/RewardsScreen';
import PointsHistoryScreen from './screens/PointsHistoryScreen';
import ProfileScreen from './screens/ProfileScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import MyRequestsScreen from './screens/MyRequestsScreen';
import ItemDataScreen from './screens/ItemDataScreen';
import ChatScreen from './screens/ChatScreen';
import AddItemScreen from './screens/AddItemScreen';
import PickLocationScreen from './screens/PickLocationScreen';
import EditItemScreen from './screens/EditItemScreen';
import ActiveDealScreen from './screens/ActiveDealScreen';
import ReceiverDealScreen from './screens/ReceiverDealScreen';
import MessagesScreen from './screens/MessagesScreen'; 
import ListDealScreen from './screens/ListDealScreen';
import DuckDealdetailScreen from './screens/DuckDealdetailScreen';
import MyRewardsScreen from './screens/MyRewardsScreen';
// ✅ นำเข้าหน้า Notification Settings ที่เพิ่งสร้างใหม่
import NotificationSettingsScreen from './screens/NotificationSettingsScreen';

import NotificationScreen from './screens/NotificationScreen';
const Stack = createStackNavigator();

export default function App() {
  const [user, setUser] = useState(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5EDD6' }}>
        <ActivityIndicator size="large" color="#C8865A" />
      </View>
    );
  }

  return (
    // 🔔 ต้องใช้ NotificationProvider ครอบ NavigationContainer ไว้
    <NotificationProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {user ? (
            <Stack.Group>
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="MyItems" component={MyItemsScreen} />
              <Stack.Screen name="QRScan" component={QRScanScreen} />
              <Stack.Screen name="Rewards" component={RewardsScreen} />
              <Stack.Screen name="PointsHistory" component={PointsHistoryScreen} />
              <Stack.Screen name="Profile" component={ProfileScreen} />
              <Stack.Screen name="EditProfile" component={EditProfileScreen} />
              <Stack.Screen name="MyRequests" component={MyRequestsScreen} />
              <Stack.Screen name="AddItem" component={AddItemScreen} />
              <Stack.Screen name="PickLocation" component={PickLocationScreen} />
              <Stack.Screen name="ItemData" component={ItemDataScreen} />
              <Stack.Screen name="Chat" component={ChatScreen} />
              <Stack.Screen name="EditItem" component={EditItemScreen} />
              <Stack.Screen name="DuckDeals" component={ListDealScreen} />
              <Stack.Screen name="DuckDealDetail" component={DuckDealdetailScreen} />
              <Stack.Screen name="MessagesScreen" component={MessagesScreen} />
              <Stack.Screen name="ActiveDeal" component={ActiveDealScreen} />
              <Stack.Screen name="ReceiverDeal" component={ReceiverDealScreen} />
              <Stack.Screen name="MyRewards" component={MyRewardsScreen} />
              {/* ✅ เพิ่มหน้า Notifications ลงในระบบ Routing (ชื่อสกรีนต้องตรงกับที่เรียกใน ProfileScreen) */}
              <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
              <Stack.Screen name="Notifications" component={NotificationScreen} />
            </Stack.Group>
          ) : (
            <Stack.Group>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
              <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
              <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
            </Stack.Group>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </NotificationProvider>
  );
}