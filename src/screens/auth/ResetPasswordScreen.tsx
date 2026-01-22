import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import * as Linking from 'expo-linking';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { supabase } from '../../config/supabaseClient';

export type ResetPasswordScreenProps = NativeStackScreenProps<RootStackParamList, 'ResetPassword'>;

const parseHashParams = (url: string): Record<string, string> => {
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return {};
  const hash = url.slice(hashIndex + 1);
  const params = new URLSearchParams(hash);
  const out: Record<string, string> = {};
  params.forEach((value, key) => {
    out[key] = value;
  });
  return out;
};

const parseQueryParams = (url: string): Record<string, string> => {
  try {
    const u = new URL(url);
    const out: Record<string, string> = {};
    u.searchParams.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  } catch {
    // Fallback for custom schemes that may not parse in older JS engines
    const qIndex = url.indexOf('?');
    if (qIndex === -1) return {};
    const queryPart = url.slice(qIndex + 1).split('#')[0];
    const params = new URLSearchParams(queryPart);
    const out: Record<string, string> = {};
    params.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
};

export const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({ navigation }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const withTimeout = async <T,>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
    let timeoutId: any;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), ms);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId);
    }
  };

  useEffect(() => {
    const initFromUrl = async (url: string | null) => {
      setInitError(null);
      try {
        if (!url) {
          setInitError('Missing recovery URL. Please open the latest reset link from your email.');
          return;
        }

        const hashParams = parseHashParams(url);
        const queryParams = parseQueryParams(url);

        const linkError =
          hashParams.error_description ||
          hashParams.error ||
          queryParams.error_description ||
          queryParams.error;
        if (linkError) {
          setInitError(String(linkError));
          Alert.alert('Recovery link error', String(linkError));
          return;
        }

        // PKCE flow (recommended by Supabase): ?code=...
        const code = queryParams.code;
        if (code) {
          try {
            const { error } = await withTimeout(
              supabase.auth.exchangeCodeForSession(code),
              12000,
              'Timed out while exchanging recovery code. Please check your internet connection and try again.',
            );
            if (error) {
              setInitError(error.message);
              Alert.alert('Recovery error', error.message);
            }
          } catch (e: any) {
            const msg = e?.message ?? 'Failed to exchange recovery code';
            setInitError(msg);
            Alert.alert('Recovery error', msg);
          }
          return;
        }

        // Implicit flow: #access_token=...&refresh_token=...&type=recovery
        const type = hashParams.type;
        const access_token = hashParams.access_token;
        const refresh_token = hashParams.refresh_token;

        if (type === 'recovery' && access_token && refresh_token) {
          try {
            await withTimeout(
              supabase.auth.setSession({ access_token, refresh_token }),
              12000,
              'Timed out while opening recovery session. Please try again.',
            );
          } catch (e: any) {
            const msg = e?.message ?? 'Failed to open recovery session';
            setInitError(msg);
            Alert.alert('Recovery error', msg);
          }
          return;
        }

        setInitError(
          'This reset link does not contain a valid recovery code. Please request a new password reset email.',
        );
      } finally {
        setReady(true);
      }
    };

    Linking.getInitialURL().then((url) => {
      initFromUrl(url);
    });

    const sub = Linking.addEventListener('url', (event) => {
      initFromUrl(event.url);
    });

    return () => {
      sub.remove();
    };
  }, []);

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Invalid password', 'Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Please make sure both passwords match.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        Alert.alert('Reset failed', error.message);
        return;
      }

      Alert.alert('Password updated', 'You can now log in with your new password.');
      navigation.replace('Login');
    } catch (e: any) {
      Alert.alert('Reset failed', e?.message ?? 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Reset password</Text>

        {!ready ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#F97316" />
          </View>
        ) : (
          <>
            {!!initError && (
              <Text style={styles.errorText}>{initError}</Text>
            )}
            <TextInput
              style={styles.input}
              placeholder="New password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              activeOpacity={0.9}
              onPress={handleUpdatePassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Update password</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 16,
    color: '#111827',
    marginBottom: 12,
  },
  errorText: {
    color: '#B91C1C',
    textAlign: 'center',
    marginBottom: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#F97316',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
});
