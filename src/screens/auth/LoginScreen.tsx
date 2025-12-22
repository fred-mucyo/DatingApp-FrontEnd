import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigation/RootNavigator';

export type LoginScreenProps = NativeStackScreenProps<RootStackParamList, 'Login'>;

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const { signInWithIdentifierPassword, resetPasswordForEmail } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState('');

  const handleSignIn = async () => {
    if (!identifier.trim()) {
      setInfo('Please enter your email or username.');
      return;
    }
    if (!password) {
      setInfo('Please enter your password.');
      return;
    }

    setLoading(true);
    setInfo('');
    try {
      await signInWithIdentifierPassword(identifier.trim(), password);
    } catch {
      // Error already surfaced via Alert in AuthContext
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!identifier.trim() || !identifier.includes('@')) {
      setInfo('Please enter the email you registered with to reset your password.');
      return;
    }

    setLoading(true);
    setInfo('');
    try {
      await resetPasswordForEmail(identifier.trim().toLowerCase());
    } catch {
      // Error already surfaced via Alert
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
        <Text style={styles.title}>Uni Dating Beta</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>

        <TextInput
          style={styles.input}
          placeholder="Email or username"
          autoCapitalize="none"
          value={identifier}
          onChangeText={setIdentifier}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {!!info && <Text style={styles.info}>{info}</Text>}

        <View style={styles.buttonWrapper}>
          <Button title={loading ? 'Please wait...' : 'Sign In'} onPress={handleSignIn} disabled={loading} />
        </View>

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" />
          </View>
        )}

        <TouchableOpacity onPress={handleForgotPassword} disabled={loading}>
          <Text style={styles.link}>Forgot password?</Text>
        </TouchableOpacity>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Don&apos;t have an account?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignUp')} disabled={loading}>
            <Text style={styles.link}>Sign up</Text>
          </TouchableOpacity>
        </View>
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
    fontSize: 28,
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
  buttonWrapper: {
    marginBottom: 12,
  },
  loadingRow: {
    marginBottom: 12,
    alignItems: 'center',
  },
  link: {
    color: '#0066cc',
    textAlign: 'center',
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  footerText: {
    marginRight: 4,
    color: '#555',
  },
});
