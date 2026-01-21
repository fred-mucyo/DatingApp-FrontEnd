import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../config/supabaseClient';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const registerForPushNotificationsAsync = async (): Promise<string | null> => {
  if (!Device.isDevice) {
    console.log('[notifications] Skipping push registration on simulator/emulator');
    return null;
  }

  let finalStatus = 'undetermined';
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
  } catch (err) {
    console.warn('[notifications] Permission error:', err);
    return null;
  }

  if (finalStatus !== 'granted') {
    console.log('[notifications] Permission not granted, status =', finalStatus);
    return null;
  }

  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getSession();
    userId = data.session?.user.id ?? null;
  } catch (err) {
    console.warn('[notifications] Session fetch error:', err);
    return null;
  }
  if (!userId) {
    console.log('[notifications] No authenticated user, skipping push registration');
    return null;
  }

  const projectId =
    (Constants.expoConfig && (Constants.expoConfig as any).extra?.eas?.projectId) ||
    (Constants.easConfig && (Constants.easConfig as any).projectId) ||
    undefined;

  let pushToken: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );
      pushToken = tokenData.data;
      break;
    } catch (err) {
      console.warn(
        `[notifications] Push token fetch error (attempt ${attempt + 1}):`,
        err,
      );
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }

  if (!pushToken) {
    console.log('[notifications] Failed to obtain Expo push token after retries');
    return null;
  }

  try {
    await supabase
      .from('push_tokens')
      .upsert(
        { user_id: userId, token: pushToken, platform: Platform.OS },
        { onConflict: 'user_id,token' },
      );
  } catch (err) {
    console.warn('[notifications] Failed to persist push token:', err);
    return null;
  }

  return pushToken;
};
