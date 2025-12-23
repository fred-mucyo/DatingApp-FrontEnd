// import React, { useState } from 'react';
// import {
//   View,
//   Text,
//   TextInput,
//   StyleSheet,
//   KeyboardAvoidingView,
//   Platform,
//   TouchableOpacity,
//   ActivityIndicator,
//   TouchableWithoutFeedback,
//   Keyboard,
// } from 'react-native';
// import { NativeStackScreenProps } from '@react-navigation/native-stack';
// import { useAuth } from '../../context/AuthContext';
// import { RootStackParamList } from '../../navigation/RootNavigator';

// export type LoginScreenProps = NativeStackScreenProps<RootStackParamList, 'Login'>;

// export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
//   const { signInWithIdentifierPassword, resetPasswordForEmail } = useAuth();
//   const [identifier, setIdentifier] = useState('');
//   const [password, setPassword] = useState('');
//   const [loading, setLoading] = useState(false);
//   const [info, setInfo] = useState('');
//   const [showPassword, setShowPassword] = useState(false);

//   const handleSignIn = async () => {
//     if (!identifier.trim()) {
//       setInfo('Please enter your email or username.');
//       return;
//     }
//     if (!password) {
//       setInfo('Please enter your password.');
//       return;
//     }

//     setLoading(true);
//     setInfo('');
//     try {
//       await signInWithIdentifierPassword(identifier.trim(), password);
//     } catch {
//       // Error already surfaced via Alert in AuthContext
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleForgotPassword = async () => {
//     if (!identifier.trim() || !identifier.includes('@')) {
//       setInfo('Please enter the email you registered with to reset your password.');
//       return;
//     }

//     setLoading(true);
//     setInfo('');
//     try {
//       await resetPasswordForEmail(identifier.trim().toLowerCase());
//     } catch {
//       // Error already surfaced via Alert
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <KeyboardAvoidingView
//       style={styles.container}
//       behavior={Platform.OS === 'ios' ? 'padding' : undefined}
//     >
//       <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
//         <View style={styles.gradientBackground}>
//           <View style={styles.headerArea}>
//             <View style={styles.logoCircle}>
//               <Text style={styles.logoText}>s</Text>
//             </View>
//             <Text style={styles.appName}>shuu</Text>
//             <Text style={styles.tagline}>chat & love</Text>
//             <View style={styles.betaBadge}>
//               <Text style={styles.betaText}>BETA</Text>
//             </View>
//           </View>

//           <View style={styles.card}>
//             <Text style={styles.cardTitle}>Welcome back!</Text>
//             <Text style={styles.cardSubtitle}>Sign in to continue your journey</Text>

//             <View style={styles.fieldGroup}>
//               <Text style={styles.fieldLabel}>Email or username</Text>
//               <View style={styles.inputRow}>
//                 <View style={styles.inputIconPlaceholder} />
//                 <TextInput
//                   style={styles.input}
//                   placeholder="Email or username"
//                   placeholderTextColor="#9CA3AF"
//                   autoCapitalize="none"
//                   autoCorrect={false}
//                   value={identifier}
//                   onChangeText={setIdentifier}
//                   autoFocus
//                 />
//                 {identifier.length > 0 && (
//                   <TouchableOpacity
//                     onPress={() => setIdentifier('')}
//                     disabled={loading}
//                     style={styles.inputTrailing}
//                   >
//                     <Text style={styles.inputTrailingText}>Clear</Text>
//                   </TouchableOpacity>
//                 )}
//               </View>
//             </View>

//             <View style={styles.fieldGroup}>
//               <Text style={styles.fieldLabel}>Password</Text>
//               <View style={styles.inputRow}>
//                 <View style={styles.inputIconPlaceholder} />
//                 <TextInput
//                   style={styles.input}
//                   placeholder="Password"
//                   placeholderTextColor="#9CA3AF"
//                   secureTextEntry={!showPassword}
//                   value={password}
//                   onChangeText={setPassword}
//                 />
//                 <TouchableOpacity
//                   onPress={() => setShowPassword((prev) => !prev)}
//                   disabled={loading}
//                   style={styles.inputTrailing}
//                 >
//                   <Text style={styles.inputTrailingText}>{showPassword ? 'Hide' : 'Show'}</Text>
//                 </TouchableOpacity>
//               </View>
//             </View>

//             {!!info && <Text style={styles.info}>{info}</Text>}

//             <TouchableOpacity
//               onPress={handleForgotPassword}
//               disabled={loading}
//               style={styles.forgotRow}
//             >
//               <Text style={styles.forgotText}>Forgot password?</Text>
//             </TouchableOpacity>

//             <TouchableOpacity
//               onPress={handleSignIn}
//               disabled={loading}
//               style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
//             >
//               {loading ? (
//                 <ActivityIndicator color="#FFFFFF" />
//               ) : (
//                 <Text style={styles.primaryButtonText}>Sign in</Text>
//               )}
//             </TouchableOpacity>

//             <View style={styles.dividerRow}>
//               <View style={styles.dividerLine} />
//               <Text style={styles.dividerText}>or</Text>
//               <View style={styles.dividerLine} />
//             </View>

//             <View style={styles.footerRow}>
//               <Text style={styles.footerText}>New to shuu?</Text>
//               <TouchableOpacity onPress={() => navigation.navigate('SignUp')} disabled={loading}>
//                 <Text style={styles.footerLinkText}>Create account</Text>
//               </TouchableOpacity>
//             </View>
//           </View>

//           <View style={styles.bottomArea}>
//             <Text style={styles.bottomText}>Sign in to meet new people on campus.</Text>
//           </View>
//         </View>
//       </TouchableWithoutFeedback>
//     </KeyboardAvoidingView>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//   },
//   gradientBackground: {
//     flex: 1,
//     paddingHorizontal: 24,
//     paddingVertical: 32,
//     backgroundColor: '#FF6B6B', // fallback base
//   },
//   headerArea: {
//     alignItems: 'center',
//     marginBottom: 32,
//   },
//   logoCircle: {
//     width: 56,
//     height: 56,
//     borderRadius: 28,
//     backgroundColor: 'rgba(255,255,255,0.15)',
//     justifyContent: 'center',
//     alignItems: 'center',
//     marginBottom: 12,
//   },
//   logoText: {
//     fontSize: 28,
//     fontWeight: '700',
//     color: '#FFFFFF',
//   },
//   appName: {
//     fontSize: 28,
//     fontWeight: '700',
//     color: '#FFFFFF',
//   },
//   tagline: {
//     marginTop: 4,
//     fontSize: 13,
//     color: 'rgba(255,255,255,0.85)',
//   },
//   betaBadge: {
//     position: 'absolute',
//     right: 0,
//     top: 0,
//     backgroundColor: 'rgba(0,0,0,0.25)',
//     borderRadius: 999,
//     paddingHorizontal: 10,
//     paddingVertical: 4,
//   },
//   betaText: {
//     fontSize: 11,
//     fontWeight: '600',
//     color: '#FFFFFF',
//   },
//   card: {
//     backgroundColor: '#FFFFFF',
//     borderRadius: 16,
//     padding: 20,
//     shadowColor: '#000000',
//     shadowOpacity: 0.06,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 8,
//     elevation: 2,
//   },
//   cardTitle: {
//     fontSize: 24,
//     fontWeight: '600',
//     color: '#1A1A1A',
//   },
//   cardSubtitle: {
//     marginTop: 4,
//     fontSize: 14,
//     color: '#666666',
//     marginBottom: 24,
//   },
//   fieldGroup: {
//     marginBottom: 16,
//   },
//   fieldLabel: {
//     fontSize: 13,
//     color: '#4B5563',
//     marginBottom: 4,
//   },
//   inputRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     borderWidth: 1,
//     borderColor: '#E5E7EB',
//     borderRadius: 12,
//     paddingHorizontal: 12,
//     height: 48,
//     backgroundColor: '#FFFFFF',
//   },
//   inputIconPlaceholder: {
//     width: 24,
//     height: 24,
//     marginRight: 8,
//   },
//   input: {
//     flex: 1,
//     fontSize: 15,
//     color: '#1A1A1A',
//   },
//   inputTrailing: {
//     marginLeft: 8,
//   },
//   inputTrailingText: {
//     fontSize: 13,
//     color: '#6366F1',
//   },
//   info: {
//     marginTop: 4,
//     fontSize: 12,
//     color: '#EF4444',
//   },
//   forgotRow: {
//     alignItems: 'flex-end',
//     marginTop: 8,
//     marginBottom: 16,
//   },
//   forgotText: {
//     fontSize: 14,
//     color: '#6366F1',
//   },
//   primaryButton: {
//     height: 52,
//     borderRadius: 8,
//     backgroundColor: '#F97316',
//     justifyContent: 'center',
//     alignItems: 'center',
//     marginBottom: 24,
//     shadowColor: '#000000',
//     shadowOpacity: 0.08,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 4,
//     elevation: 2,
//   },
//   primaryButtonDisabled: {
//     opacity: 0.7,
//   },
//   primaryButtonText: {
//     fontSize: 16,
//     fontWeight: '600',
//     color: '#FFFFFF',
//   },
//   dividerRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginBottom: 24,
//   },
//   dividerLine: {
//     flex: 1,
//     height: 1,
//     backgroundColor: '#E5E7EB',
//   },
//   dividerText: {
//     marginHorizontal: 8,
//     fontSize: 12,
//     color: '#9CA3AF',
//   },
//   footerRow: {
//     flexDirection: 'row',
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   footerText: {
//     fontSize: 14,
//     color: '#6B7280',
//     marginRight: 4,
//   },
//   footerLinkText: {
//     fontSize: 14,
//     fontWeight: '600',
//     color: '#6366F1',
//   },
//   bottomArea: {
//     marginTop: 24,
//     alignItems: 'center',
//   },
//   bottomText: {
//     fontSize: 12,
//     color: 'rgba(255,255,255,0.85)',
//     textAlign: 'center',
//   },
// });










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
} from 'react-native';
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
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.gradientBackground}>
            {/* Compact Header */}
            <View style={styles.headerArea}>
              <View style={styles.logoCircle}>
                <Text style={styles.logoText}>s</Text>
              </View>
              <Text style={styles.appName}>shuu</Text>
              <View style={styles.betaBadge}>
                <Text style={styles.betaText}>BETA</Text>
              </View>
            </View>

            {/* Compact Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Welcome Back</Text>
              <Text style={styles.cardSubtitle}>Sign in to continue</Text>

              {/* Email/Username Field */}
              <View style={styles.fieldGroup}>
                <View style={styles.inputRow}>
                  <Text style={styles.inputIcon}>👤</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Email or username"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={identifier}
                    onChangeText={setIdentifier}
                    autoFocus
                  />
                  {identifier.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setIdentifier('')}
                      disabled={loading}
                      style={styles.clearButton}
                    >
                      <Text style={styles.clearIcon}>×</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Password Field */}
              <View style={styles.fieldGroup}>
                <View style={styles.inputRow}>
                  <Text style={styles.inputIcon}>🔒</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((prev) => !prev)}
                    disabled={loading}
                    style={styles.eyeButton}
                  >
                    <Text style={styles.eyeIcon}>{showPassword ? '👁' : '👁‍🗨'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Error Message */}
              {!!info && <Text style={styles.info}>{info}</Text>}

              {/* Forgot Password */}
              <TouchableOpacity
                onPress={handleForgotPassword}
                disabled={loading}
                style={styles.forgotRow}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>

              {/* Sign In Button */}
              <TouchableOpacity
                onPress={handleSignIn}
                disabled={loading}
                style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Sign in</Text>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Sign Up Link */}
              <View style={styles.footerRow}>
                <Text style={styles.footerText}>New here?</Text>
                <TouchableOpacity onPress={() => navigation.navigate('SignUp')} disabled={loading}>
                  <Text style={styles.footerLinkText}>Create account</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Bottom Tagline */}
            <Text style={styles.bottomText}>Find your campus connection</Text>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  gradientBackground: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: '#FF6B6B',
  },
  headerArea: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  betaBadge: {
    position: 'absolute',
    right: 0,
    top: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  betaText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  cardSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#666666',
    marginBottom: 24,
    textAlign: 'center',
  },
  fieldGroup: {
    marginBottom: 14,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
    backgroundColor: '#FAFAFA',
  },
  inputIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
  },
  clearButton: {
    padding: 4,
    marginLeft: 4,
  },
  clearIcon: {
    fontSize: 24,
    color: '#9CA3AF',
    fontWeight: '300',
  },
  eyeButton: {
    padding: 4,
    marginLeft: 4,
  },
  eyeIcon: {
    fontSize: 18,
  },
  info: {
    marginTop: 4,
    marginBottom: 8,
    fontSize: 12,
    color: '#EF4444',
    textAlign: 'center',
  },
  forgotRow: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  forgotText: {
    fontSize: 13,
    color: '#6366F1',
    fontWeight: '500',
  },
  primaryButton: {
    height: 50,
    borderRadius: 12,
    backgroundColor: '#F97316',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#F97316',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 4,
  },
  footerLinkText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6366F1',
  },
  bottomText: {
    marginTop: 20,
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    fontWeight: '500',
  },
});