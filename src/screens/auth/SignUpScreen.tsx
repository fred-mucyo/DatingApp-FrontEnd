import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigation/RootNavigator';

export type SignUpScreenProps = NativeStackScreenProps<RootStackParamList, 'SignUp'>;

export const SignUpScreen: React.FC<SignUpScreenProps> = ({ navigation }) => {
  const { signUpWithEmailPassword } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState('');

  const validatePassword = (value: string): string | null => {
    if (value.length < 8) {
      return 'Password must be at least 8 characters long.';
    }
    if (!/[A-Z]/.test(value)) {
      return 'Password must include at least one uppercase letter.';
    }
    if (!/[a-z]/.test(value)) {
      return 'Password must include at least one lowercase letter.';
    }
    if (!/[0-9]/.test(value)) {
      return 'Password must include at least one number.';
    }
    return null;
  };

  const handleSignUp = async () => {
    if (!username.trim()) {
      setInfo('Please choose a username.');
      return;
    }

    if (!email.includes('@')) {
      setInfo('Please enter a valid email address.');
      return;
    }

    if (!password || !confirmPassword) {
      setInfo('Please fill in both password fields.');
      return;
    }

    if (password !== confirmPassword) {
      setInfo('Passwords do not match.');
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setInfo(passwordError);
      return;
    }

    setLoading(true);
    setInfo('');

    try {
      await signUpWithEmailPassword(email.trim().toLowerCase(), password, username.trim());
      navigation.navigate('Login');
    } catch {
      // Error already handled by AuthContext via Alert.
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>
          Sign up with your email, a unique username, and a secure password. You will be able to sign in immediately.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Username"
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />

        <TextInput
          style={styles.input}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TextInput
          style={styles.input}
          placeholder="Confirm password"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        {!!info && <Text style={styles.info}>{info}</Text>}

        <View style={styles.buttonWrapper}>
          <Button title={loading ? 'Creating account...' : 'Sign Up'} onPress={handleSignUp} disabled={loading} />
        </View>

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" />
          </View>
        )}

        <Text style={styles.passwordHint}>
          Password must be at least 8 characters and include upper and lower case letters and a number.
        </Text>

        <Button title="Back to Sign In" onPress={() => navigation.navigate('Login')} disabled={loading} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: {
    flexGrow: 1,
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
    color: '#c00',
  },
  buttonWrapper: {
    marginBottom: 12,
  },
  loadingRow: {
    marginBottom: 12,
    alignItems: 'center',
  },
  passwordHint: {
    fontSize: 12,
    color: '#555',
    marginBottom: 16,
    textAlign: 'center',
  },
});
