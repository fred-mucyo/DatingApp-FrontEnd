import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
  Linking,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigation/RootNavigator';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

export type LoginScreenProps = NativeStackScreenProps<RootStackParamList, 'Login'>;

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const { signInWithIdentifierPassword } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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
    setInfo('');
    await Linking.openURL('https://mutima-reset.netlify.app/reset-password');
  };

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
          <Path
            d="M4 4l16 16"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
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

  const HeartIcon = ({ size = 22, color = '#ff4b2b' }: { size?: number; color?: string }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21s-7-4.4-9.2-9.2C1.2 8 3.5 5.5 6.4 5.5c1.7 0 3.2.9 3.9 2 .7-1.1 2.2-2 3.9-2 2.9 0 5.2 2.5 3.6 6.3C19 16.6 12 21 12 21Z"
        fill={color}
        opacity={0.95}
      />
    </Svg>
  );

  const { width: SCREEN_W } = Dimensions.get('window');
  const CARD_MAX_W = Math.min(SCREEN_W - 40, 420);

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

        {/* Bokeh */}
        <Circle cx="70" cy="150" r="36" fill="#fff" opacity="0.10" />
        <Circle cx="310" cy="240" r="46" fill="#fff" opacity="0.08" />
        <Circle cx="260" cy="120" r="22" fill="#fff" opacity="0.10" />
        <Circle cx="100" cy="320" r="26" fill="#fff" opacity="0.08" />
        <Circle cx="40" cy="580" r="40" fill="#fff" opacity="0.08" />
        <Circle cx="320" cy="640" r="34" fill="#fff" opacity="0.08" />

        {/* Hearts */}
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
                  {/* Branding */}
                  <View style={styles.brandRow}>
                    <Text style={{ fontSize: 17, color: '#ff4b2b' }}>❤️</Text>
                    <Text style={styles.brandName}>Umutima</Text>
                  </View>
                  <Text style={styles.brandTagline}>Find Your Match</Text>

                  {/* Welcome */}
                  <View style={styles.welcomeBlock}>
                    <Text style={styles.welcomeTitle}>Welcome Back</Text>
                    <Text style={styles.welcomeSubtitle}>Sign in to continue</Text>
                  </View>

                  {/* Inputs */}
                  <View style={styles.fieldGroup}>
                    <View style={styles.inputRow}>
                      <View style={styles.leftIcon}>
                        <InputUserIcon />
                      </View>
                      <TextInput
                        style={styles.input}
                        placeholder="Email or username"
                        placeholderTextColor="#9CA3AF"
                        autoCapitalize="none"
                        autoCorrect={false}
                        value={identifier}
                        onChangeText={setIdentifier}
                        editable={!loading}
                        autoFocus
                      />
                      {identifier.length > 0 ? (
                        <TouchableOpacity
                          onPress={() => setIdentifier('')}
                          disabled={loading}
                          style={styles.rightAction}
                        >
                          <Text style={styles.rightActionText}>×</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <View style={styles.inputRow}>
                      <View style={styles.leftIcon}>
                        <InputLockIcon />
                      </View>
                      <TextInput
                        style={styles.input}
                        placeholder="Password"
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
                  </View>

                  {!!info ? <Text style={styles.info}>{info}</Text> : null}

                  <TouchableOpacity
                    onPress={handleForgotPassword}
                    disabled={loading}
                    style={styles.forgotRow}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.forgotText}>Forgot password?</Text>
                  </TouchableOpacity>

                  {/* CTA button */}
                  <TouchableOpacity
                    onPress={handleSignIn}
                    disabled={loading}
                    activeOpacity={0.9}
                    style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
                  >
                    <View style={styles.primaryButtonGradient} />
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Sign in</Text>
                    )}
                  </TouchableOpacity>

                  {/* Create account */}
                  <View style={styles.footerRow}>
                    <Text style={styles.footerText}>New here?</Text>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('SignUp')}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.footerLinkText}>Create account</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Bottom marketing + footer */}
                <Text style={styles.bottomText}>
                  Thousands have already found love on Umutima ❤️{"\n"}Join them today.
                </Text>

                <Text style={styles.legalText}>
                  <Text
                    style={styles.legalLink}
                    onPress={() => navigation.navigate('TermsOfService')}
                    suppressHighlighting
                  >
                    Terms
                  </Text>
                  {' · '}
                  <Text
                    style={styles.legalLink}
                    onPress={() => navigation.navigate('PrivacyPolicy')}
                    suppressHighlighting
                  >
                    Privacy Policy
                  </Text>
                </Text>
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
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  background: {
    flex: 1,
    minHeight: 720,
    paddingHorizontal: 20,
    paddingVertical: 24,
    justifyContent: 'center',
  },
  centerWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 28,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 25,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  brandName: {
    marginLeft: 10,
    fontSize: 26,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: -0.4,
  },
  brandTagline: {
    textAlign: 'center',
    color: '#6B7280',
    fontWeight: '700',
    marginBottom: 18,
  },
  welcomeBlock: {
    alignItems: 'center',
    marginBottom: 18,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
  },
  welcomeSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 54,
    backgroundColor: '#F7F7F7',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
  },
  leftIcon: {
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
  },
  rightAction: {
    padding: 6,
    marginLeft: 6,
  },
  rightActionText: {
    fontSize: 24,
    color: '#9CA3AF',
    fontWeight: '300',
    marginTop: -2,
  },
  info: {
    marginTop: 4,
    marginBottom: 8,
    fontSize: 12,
    color: '#EF4444',
    textAlign: 'center',
    fontWeight: '600',
  },
  forgotRow: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  forgotText: {
    fontSize: 13,
    color: '#ff4b2b',
    fontWeight: '700',
  },
  primaryButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: '#ff4b2b',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 6,
    overflow: 'hidden',
  },
  primaryButtonGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ff4b2b',
    opacity: 1,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  footerText: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 4,
    fontWeight: '600',
  },
  footerLinkText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ff4b2b',
  },
  legalText: {
    marginTop: 16,
    fontSize: 12,
    color: 'rgba(255,255,255,0.90)',
    textAlign: 'center',
    fontWeight: '700',
  },
  legalLink: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '900',
  },
  bottomText: {
    marginTop: 16,
    fontSize: 13,
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
    fontWeight: '700',
    lineHeight: 18,
  },
});