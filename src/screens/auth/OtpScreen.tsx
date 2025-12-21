import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigation/RootNavigator';

export type OtpScreenProps = NativeStackScreenProps<RootStackParamList, 'Otp'>;

export const OtpScreen: React.FC<OtpScreenProps> = ({ route, navigation }) => {
  const { email } = route.params;
  const { verifyEmailOtp } = useAuth();
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState('');

  const handleVerify = async () => {
    if (!token) {
      setInfo('Enter the OTP from your email.');
      return;
    }
    setLoading(true);
    setInfo('');
    try {
      await verifyEmailOtp(email, token.trim());
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Enter OTP</Text>
        <Text style={styles.subtitle}>We sent a one-time code to {email}.</Text>

        <TextInput
          style={styles.input}
          placeholder="OTP code"
          autoCapitalize="none"
          keyboardType="number-pad"
          value={token}
          onChangeText={setToken}
        />

        {!!info && <Text style={styles.info}>{info}</Text>}

        <Button title={loading ? 'Verifying...' : 'Verify'} onPress={handleVerify} disabled={loading} />
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
    color: '#555',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  info: {
    marginBottom: 12,
    textAlign: 'center',
    color: '#333',
  },
});
