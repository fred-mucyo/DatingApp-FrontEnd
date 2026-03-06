import 'react-native-url-polyfill/auto';
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Montserrat_900Black } from '@expo-google-fonts/montserrat';
import { AuthProvider } from './src/context/AuthContext';
import { ToastProvider } from './src/components/Toast';
import { RootNavigator } from './src/navigation/RootNavigator';
import * as Notifications from 'expo-notifications';
import { navigationRef } from './src/navigation/navigationRef';
import * as Linking from 'expo-linking';
import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './src/navigation/RootNavigator';

export default function App() {
  const [fontsLoaded] = useFonts({
    Montserrat_900Black,
  });

  const linking: LinkingOptions<RootStackParamList> = {
    prefixes: [Linking.createURL('/')],
    config: {
      screens: {
        ResetPassword: 'reset-password',
      },
    },
  };

  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const data = response.notification.request.content.data as any;
        handleNotificationNavigation(data);
      }
    });

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;
      handleNotificationNavigation(data);
    });
    return () => {
      sub.remove();
    };
  }, []);

  const handleNotificationNavigation = (data: any) => {
    if (!data) return;

    if (data.type === 'match' && data.matchId && data.otherUserId) {
      navigationRef.current?.navigate('Chat', {
        matchId: data.matchId,
        otherUserId: data.otherUserId,
        otherUserName: data.otherUserName,
        otherUserPhoto: data.otherUserPhoto ?? undefined,
      });
    } else if (data.type === 'like') {
      navigationRef.current?.navigate('Likes');
    } else if (data.type === 'message' && data.matchId && data.senderId) {
      navigationRef.current?.navigate('Chat', {
        matchId: data.matchId,
        otherUserId: data.senderId,
        otherUserName: data.senderName,
        otherUserPhoto: data.senderPhoto,
      });
    }
  };

  // If the font hasn't loaded yet, we still render the app.
  // Text using Montserrat_900Black will temporarily fall back to the system font.
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <AuthProvider>
          <NavigationContainer ref={navigationRef} linking={linking}>
            <RootNavigator />
            <StatusBar style="dark" />
          </NavigationContainer>
        </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
