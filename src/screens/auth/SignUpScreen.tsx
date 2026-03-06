// import React, { useMemo, useState } from 'react';
// import {
//   View,
//   Text,
//   TextInput,
//   StyleSheet,
//   KeyboardAvoidingView,
//   Platform,
//   ActivityIndicator,
//   ScrollView,
//   TouchableOpacity,
//   TouchableWithoutFeedback,
//   Keyboard,
// } from 'react-native';
// import { NativeStackScreenProps } from '@react-navigation/native-stack';
// import { useAuth } from '../../context/AuthContext';
// import { RootStackParamList } from '../../navigation/RootNavigator';

// export type SignUpScreenProps = NativeStackScreenProps<RootStackParamList, 'SignUp'>;

// export const SignUpScreen: React.FC<SignUpScreenProps> = ({ navigation }) => {
//   const { signUpWithEmailPassword } = useAuth();
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigation/RootNavigator';

export type SignUpScreenProps = NativeStackScreenProps<RootStackParamList, 'SignUp'>;

export const SignUpScreen: React.FC<SignUpScreenProps> = ({ navigation }) => {
  const { signUpWithEmailPassword, getUsernameSuggestions } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState('');
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const [loadingUsernameSuggestions, setLoadingUsernameSuggestions] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const InputUserIcon = ({ color = '#9CA3AF' }: { color?: string }) => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 21c0-3.3137-3.5817-6-8-6s-8 2.6863-8 6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );

  const MailIcon = ({ color = '#9CA3AF' }: { color?: string }) => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 6h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path
        d="m22 8-10 7L2 8"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );

  const InputLockIcon = ({ color = '#9CA3AF' }: { color?: string }) => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 11V8a5 5 0 0 1 10 0v3"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M6.5 11h11A2.5 2.5 0 0 1 20 13.5v6A2.5 2.5 0 0 1 17.5 22h-11A2.5 2.5 0 0 1 4 19.5v-6A2.5 2.5 0 0 1 6.5 11Z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );

  const EyeIcon = ({ open, color = '#9CA3AF' }: { open: boolean; color?: string }) => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2.1 12.5C3.9 7.9 7.6 5 12 5s8.1 2.9 9.9 7.5c.1.3.1.7 0 1C20.1 18.1 16.4 21 12 21S3.9 18.1 2.1 13.5c-.1-.3-.1-.7 0-1Z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {open ? (
        <Path
          d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      ) : (
        <>
          <Path d="M4 4l16 16" stroke={color} strokeWidth={2} strokeLinecap="round" />
          <Path
            d="M14.2 14.2a2.5 2.5 0 0 1-3.4-3.4"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </>
      )}
    </Svg>
  );

  const BackgroundArt = () => (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 360 800" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#ff5f6d" />
            <Stop offset="1" stopColor="#ffc371" />
          </LinearGradient>

          <RadialGradient id="glow1" cx="20%" cy="18%" rx="60%" ry="60%" fx="20%" fy="18%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.28" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="glow2" cx="85%" cy="40%" rx="55%" ry="55%" fx="85%" fy="40%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.20" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Rect x="0" y="0" width="360" height="800" fill="url(#bg)" />
        <Rect x="0" y="0" width="360" height="800" fill="url(#glow1)" />
        <Rect x="0" y="0" width="360" height="800" fill="url(#glow2)" />

        <Circle cx="70" cy="150" r="36" fill="#fff" opacity="0.10" />
        <Circle cx="310" cy="240" r="46" fill="#fff" opacity="0.08" />
        <Circle cx="260" cy="120" r="22" fill="#fff" opacity="0.10" />
        <Circle cx="100" cy="320" r="26" fill="#fff" opacity="0.08" />
        <Circle cx="40" cy="580" r="40" fill="#fff" opacity="0.08" />
        <Circle cx="320" cy="640" r="34" fill="#fff" opacity="0.08" />

        <Path
          d="M62 94c-7-9-23-3-21 10 2 15 21 25 21 25s19-10 21-25c2-13-14-19-21-10Z"
          fill="#fff"
          opacity="0.14"
        />
        <Path
          d="M300 164c-6-8-20-2-18 9 2 12 18 20 18 20s16-8 18-20c2-11-12-17-18-9Z"
          fill="#fff"
          opacity="0.12"
        />
        <Path
          d="M72 690c-8-10-26-4-24 11 2 16 24 28 24 28s22-12 24-28c2-15-16-21-24-11Z"
          fill="#fff"
          opacity="0.12"
        />
        <Path
          d="M310 560c-7-9-23-3-21 10 2 15 21 25 21 25s19-10 21-25c2-13-14-19-21-10Z"
          fill="#fff"
          opacity="0.10"
        />
      </Svg>
    </View>
  );

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

    if (!acceptedTerms) {
      setInfo('Please accept the Terms and Privacy Policy to continue.');
      return;
    }

    setLoading(true);
    setInfo('');
    setUsernameSuggestions([]);

    try {
      await signUpWithEmailPassword(email.trim().toLowerCase(), password, username.trim());
      // AuthContext will update session, and RootNavigator will route into ProfileWizard.
    } catch (e: any) {
      const message = String(e?.message ?? '');
      if (message.toLowerCase().includes('username already')) {
        setLoadingUsernameSuggestions(true);
        try {
          const suggestions = await getUsernameSuggestions(username, 6);
          setUsernameSuggestions(suggestions);
        } finally {
          setLoadingUsernameSuggestions(false);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const usernameValidPattern = useMemo(
    () => /^[a-zA-Z0-9_.-]+$/.test(username.trim()) && username.trim().length >= 3,
    [username],
  );

  const emailLooksValid = useMemo(() => /.+@.+\..+/.test(email.trim()), [email]);

  const passwordStrength = useMemo(() => {
    if (!password) return { label: 'Weak', color: '#EF4444', value: 0 };
    const lengthOk = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const score = [lengthOk, hasUpper, hasLower, hasNumber].filter(Boolean).length;
    if (score <= 2) return { label: 'Weak', color: '#EF4444', value: 0.33 };
    if (score === 3) return { label: 'Medium', color: '#F59E0B', value: 0.66 };
    return { label: 'Strong', color: '#10B981', value: 1 };
  }, [password]);

  const passwordsMatch = confirmPassword.length > 0 && confirmPassword === password;

  const { width: SCREEN_W } = Dimensions.get('window');
  const CARD_MAX_W = Math.min(SCREEN_W - 40, 420);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.background}>
              <BackgroundArt />

              <View style={styles.centerWrap}>
                <View style={[styles.card, { width: CARD_MAX_W }]}>
                  <View style={styles.brandRow}>
                    <Text style={{ fontSize: 17, color: '#ff4b2b' }}>❤️</Text>
                    <Text style={styles.brandName}>Umutima</Text>
                  </View>
                  <Text style={styles.brandTagline}>Create your account</Text>

                  <View style={styles.welcomeBlock}>
                    <Text style={styles.welcomeTitle}>Join Umutima</Text>
                    <Text style={styles.welcomeSubtitle}>It only takes a minute</Text>
                  </View>

                  <View style={styles.fieldGroup}>
                    <View
                      style={[
                        styles.inputRow,
                        username.length > 0 && (usernameValidPattern ? styles.inputValid : styles.inputInvalid),
                      ]}
                    >
                      <View style={styles.leftIcon}>
                        <InputUserIcon />
                      </View>
                      <TextInput
                        style={styles.input}
                        placeholder="Username"
                        placeholderTextColor="#9CA3AF"
                        autoCapitalize="none"
                        autoCorrect={false}
                        value={username}
                        onChangeText={(text) => {
                          setUsername(text);
                          if (usernameSuggestions.length > 0) setUsernameSuggestions([]);
                        }}
                        editable={!loading}
                      />
                      {username.length > 0 && usernameValidPattern ? (
                        <View style={styles.rightAction}>
                          <Text style={styles.validIcon}>✓</Text>
                        </View>
                      ) : null}
                    </View>

                    {loadingUsernameSuggestions ? (
                      <View style={styles.usernameSuggestionsRow}>
                        <Text style={styles.usernameSuggestionsLabel}>Finding suggestions…</Text>
                      </View>
                    ) : usernameSuggestions.length > 0 ? (
                      <View style={styles.usernameSuggestionsRow}>
                        <Text style={styles.usernameSuggestionsLabel}>Try one of these:</Text>
                        <View style={styles.usernameChipRow}>
                          {usernameSuggestions.map((s) => (
                            <TouchableOpacity
                              key={s}
                              onPress={() => setUsername(s)}
                              disabled={loading}
                              activeOpacity={0.85}
                              style={styles.usernameChip}
                            >
                              <Text style={styles.usernameChipText}>{s}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.fieldGroup}>
                    <View
                      style={[
                        styles.inputRow,
                        email.length > 0 && (emailLooksValid ? styles.inputValid : styles.inputInvalid),
                      ]}
                    >
                      <View style={styles.leftIcon}>
                        <MailIcon />
                      </View>
                      <TextInput
                        style={styles.input}
                        placeholder="Email address"
                        placeholderTextColor="#9CA3AF"
                        autoCapitalize="none"
                        keyboardType="email-address"
                        value={email}
                        onChangeText={setEmail}
                        editable={!loading}
                      />
                      {email.length > 0 && emailLooksValid ? (
                        <View style={styles.rightAction}>
                          <Text style={styles.validIcon}>✓</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <View style={[styles.inputRow, password.length > 0 && styles.inputFocused]}>
                      <View style={styles.leftIcon}>
                        <InputLockIcon />
                      </View>
                      <TextInput
                        style={styles.input}
                        placeholder="Password (8+)"
                        placeholderTextColor="#9CA3AF"
                        secureTextEntry={!showPassword}
                        value={password}
                        onChangeText={setPassword}
                        editable={!loading}
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword((prev) => !prev)}
                        disabled={loading}
                        style={styles.rightAction}
                      >
                        <EyeIcon open={showPassword} />
                      </TouchableOpacity>
                    </View>
                    {password.length > 0 ? (
                      <View style={styles.strengthRow}>
                        <View style={styles.strengthBarBackground}>
                          <View
                            style={[
                              styles.strengthBarFill,
                              {
                                width: `${passwordStrength.value * 100}%`,
                                backgroundColor: passwordStrength.color,
                              },
                            ]}
                          />
                        </View>
                        <Text style={[styles.strengthLabel, { color: passwordStrength.color }]}>
                          {passwordStrength.label}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.fieldGroup}>
                    <View
                      style={[
                        styles.inputRow,
                        confirmPassword.length > 0 && (passwordsMatch ? styles.inputValid : styles.inputInvalid),
                      ]}
                    >
                      <View style={styles.leftIcon}>
                        <InputLockIcon />
                      </View>
                      <TextInput
                        style={styles.input}
                        placeholder="Confirm password"
                        placeholderTextColor="#9CA3AF"
                        secureTextEntry={!showConfirmPassword}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        editable={!loading}
                      />
                      <TouchableOpacity
                        onPress={() => setShowConfirmPassword((prev) => !prev)}
                        disabled={loading}
                        style={styles.rightAction}
                      >
                        <EyeIcon open={showConfirmPassword} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {!!info ? <Text style={styles.errorInfo}>{info}</Text> : null}

                  <TouchableOpacity
                    onPress={() => setAcceptedTerms((v) => !v)}
                    disabled={loading}
                    style={styles.consentRow}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                      {acceptedTerms ? <Text style={styles.checkboxMark}>✓</Text> : null}
                    </View>
                    <Text style={styles.consentText}>
                      I agree to the{' '}
                      <Text
                        style={styles.termsLink}
                        onPress={() => navigation.navigate('TermsOfService')}
                        suppressHighlighting
                      >
                        Terms of Service
                      </Text>
                      {' '}and{' '}
                      <Text
                        style={styles.termsLink}
                        onPress={() => navigation.navigate('PrivacyPolicy')}
                        suppressHighlighting
                      >
                        Privacy Policy
                      </Text>
                      .
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleSignUp}
                    disabled={loading}
                    activeOpacity={0.9}
                    style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Create account</Text>
                    )}
                  </TouchableOpacity>

                  <View style={styles.footerRowCard}>
                    <Text style={styles.footerTextCard}>Already have an account?</Text>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('Login')}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.footerLinkTextCard}>Sign in</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.bottomText}>Safe. Verified. Romantic. Umutima ❤️</Text>
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ff5f6d',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 24,
  },
  background: {
    flex: 1,
    paddingHorizontal: 20,
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 25,
    elevation: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    gap: 8,
  },
  brandName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: 0.2,
  },
  brandTagline: {
    textAlign: 'center',
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 16,
    fontWeight: '600',
  },
  welcomeBlock: {
    alignItems: 'center',
    marginBottom: 18,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  welcomeSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  fieldGroup: {
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
    backgroundColor: '#FFFFFF',
  },
  inputFocused: {
    borderColor: '#D1D5DB',
  },
  inputValid: {
    borderColor: '#10B981',
  },
  inputInvalid: {
    borderColor: '#EF4444',
  },
  leftIcon: {
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
  },
  rightAction: {
    padding: 6,
    marginLeft: 6,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  validIcon: {
    fontSize: 16,
    color: '#10B981',
  },
  usernameSuggestionsRow: {
    marginTop: 8,
  },
  usernameSuggestionsLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 8,
  },
  usernameChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  usernameChip: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  usernameChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  strengthBarBackground: {
    flex: 1,
    height: 3,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
    marginRight: 8,
  },
  strengthBarFill: {
    height: 3,
    borderRadius: 999,
  },
  strengthLabel: {
    fontSize: 11,
    fontWeight: '600',
    minWidth: 50,
  },
  errorInfo: {
    marginTop: 4,
    marginBottom: 8,
    fontSize: 12,
    color: '#EF4444',
    textAlign: 'center',
  },
  primaryButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#ff4b2b',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 10,
    elevation: 5,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  termsText: {
    marginTop: 12,
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 14,
  },
  termsLink: {
    color: '#ff4b2b',
    fontWeight: '700',
  },
  footerRowCard: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerTextCard: {
    fontSize: 13,
    color: '#6B7280',
    marginRight: 4,
    fontWeight: '600',
  },
  footerLinkTextCard: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ff4b2b',
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: '#ff4b2b',
    borderColor: '#ff4b2b',
  },
  checkboxMark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  consentText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: '#4B5563',
  },
  bottomText: {
    marginTop: 18,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 16,
  },
});