import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { onAuthStateChanged } from 'firebase/auth';
import { ActivityIndicator, View } from 'react-native';
import { auth } from './config/firebase';

// ===== Import Screens =====
import LoginScreen          from './screens/LoginScreen';
import RegisterScreen       from './screens/RegisterScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import ResetPasswordScreen  from './screens/ResetPasswordScreen';
import DashboardScreen      from './screens/DashboardScreen';

const Stack = createStackNavigator();

export default function App() {
  const [user, setUser]       = useState(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log('Auth state:', currentUser?.email ?? 'not logged in');
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
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login"          component={LoginScreen} />
            <Stack.Screen name="Register"       component={RegisterScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="ResetPassword"  component={ResetPasswordScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}