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
//   const [username, setUsername] = useState('');
//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const [confirmPassword, setConfirmPassword] = useState('');
//   const [loading, setLoading] = useState(false);
//   const [info, setInfo] = useState('');
//   const [showPassword, setShowPassword] = useState(false);
//   const [showConfirmPassword, setShowConfirmPassword] = useState(false);

//   const validatePassword = (value: string): string | null => {
//     if (value.length < 8) {
//       return 'Password must be at least 8 characters long.';
//     }
//     if (!/[A-Z]/.test(value)) {
//       return 'Password must include at least one uppercase letter.';
//     }
//     if (!/[a-z]/.test(value)) {
//       return 'Password must include at least one lowercase letter.';
//     }
//     if (!/[0-9]/.test(value)) {
//       return 'Password must include at least one number.';
//     }
//     return null;
//   };

//   const handleSignUp = async () => {
//     if (!username.trim()) {
//       setInfo('Please choose a username.');
//       return;
//     }

//     if (!email.includes('@')) {
//       setInfo('Please enter a valid email address.');
//       return;
//     }

//     if (!password || !confirmPassword) {
//       setInfo('Please fill in both password fields.');
//       return;
//     }

//     if (password !== confirmPassword) {
//       setInfo('Passwords do not match.');
//       return;
//     }

//     const passwordError = validatePassword(password);
//     if (passwordError) {
//       setInfo(passwordError);
//       return;
//     }

//     setLoading(true);
//     setInfo('');

//     try {
//       await signUpWithEmailPassword(email.trim().toLowerCase(), password, username.trim());
//       navigation.navigate('Login');
//     } catch {
//       // Error already handled by AuthContext via Alert.
//     } finally {
//       setLoading(false);
//     }
//   };

//   const usernameValidPattern = useMemo(
//     () => /^[a-zA-Z0-9_]+$/.test(username.trim()) && username.trim().length >= 3,
//     [username],
//   );

//   const emailLooksValid = useMemo(() => /.+@.+\..+/.test(email.trim()), [email]);

//   const passwordStrength = useMemo(() => {
//     if (!password) return { label: 'Weak', color: '#EF4444', value: 0 };
//     const lengthOk = password.length >= 8;
//     const hasUpper = /[A-Z]/.test(password);
//     const hasLower = /[a-z]/.test(password);
//     const hasNumber = /[0-9]/.test(password);
//     const score = [lengthOk, hasUpper, hasLower, hasNumber].filter(Boolean).length;
//     if (score <= 2) return { label: 'Weak', color: '#EF4444', value: 0.33 };
//     if (score === 3) return { label: 'Medium', color: '#F59E0B', value: 0.66 };
//     return { label: 'Strong', color: '#10B981', value: 1 };
//   }, [password]);

//   const passwordsMatch = confirmPassword.length > 0 && confirmPassword === password;

//   return (
//     <KeyboardAvoidingView
//       style={styles.container}
//       behavior={Platform.OS === 'ios' ? 'padding' : undefined}
//     >
//       <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
//         <View style={styles.gradientBackground}>
//           <ScrollView
//             contentContainerStyle={styles.scrollContent}
//             keyboardShouldPersistTaps="handled"
//           >
//             <View style={styles.headerArea}>
//               <Text style={styles.stepLabel}>Step 1 of 3</Text>
//               <View style={styles.stepDotsRow}>
//                 <View style={[styles.stepDot, styles.stepDotActive]} />
//                 <View style={styles.stepDot} />
//                 <View style={styles.stepDot} />
//               </View>
//             </View>

//             <View style={styles.card}>
//               <Text style={styles.cardTitle}>Create account</Text>
//               <Text style={styles.cardSubtitle}>
//                 Join thousands of students finding connections.
//               </Text>

//               <View style={styles.fieldGroup}>
//                 <Text style={styles.fieldLabel}>Username</Text>
//                 <View style={styles.inputRow}>
//                   <View style={styles.inputIconPlaceholder} />
//                   <TextInput
//                     style={styles.input}
//                     placeholder="Choose a unique username"
//                     placeholderTextColor="#9CA3AF"
//                     autoCapitalize="none"
//                     autoCorrect={false}
//                     value={username}
//                     onChangeText={setUsername}
//                   />
//                 </View>
//                 <Text style={styles.helperText}>Letters, numbers, and underscores only.</Text>
//                 {username.length > 0 && (
//                   <Text style={[styles.validationText, usernameValidPattern ? styles.valid : styles.invalid]}>
//                     {usernameValidPattern ? 'Looks good.' : 'Username should be at least 3 characters and use only letters, numbers, and underscores.'}
//                   </Text>
//                 )}
//               </View>

//               <View style={styles.fieldGroup}>
//                 <Text style={styles.fieldLabel}>Email</Text>
//                 <View style={styles.inputRow}>
//                   <View style={styles.inputIconPlaceholder} />
//                   <TextInput
//                     style={styles.input}
//                     placeholder="Your email address"
//                     placeholderTextColor="#9CA3AF"
//                     autoCapitalize="none"
//                     keyboardType="email-address"
//                     value={email}
//                     onChangeText={setEmail}
//                   />
//                 </View>
//                 <Text style={styles.helperText}>We&apos;ll never share your email.</Text>
//                 {email.length > 0 && (
//                   <Text style={[styles.validationText, emailLooksValid ? styles.valid : styles.invalid]}>
//                     {emailLooksValid ? 'Email looks valid.' : 'Please enter a valid email address.'}
//                   </Text>
//                 )}
//               </View>

//               <View style={styles.fieldGroup}>
//                 <Text style={styles.fieldLabel}>Password</Text>
//                 <View style={styles.inputRow}>
//                   <View style={styles.inputIconPlaceholder} />
//                   <TextInput
//                     style={styles.input}
//                     placeholder="Create a strong password"
//                     placeholderTextColor="#9CA3AF"
//                     secureTextEntry={!showPassword}
//                     value={password}
//                     onChangeText={setPassword}
//                   />
//                   <TouchableOpacity
//                     onPress={() => setShowPassword((prev) => !prev)}
//                     disabled={loading}
//                     style={styles.inputTrailing}
//                   >
//                     <Text style={styles.inputTrailingText}>{showPassword ? 'Hide' : 'Show'}</Text>
//                   </TouchableOpacity>
//                 </View>

//                 <View style={styles.strengthBarBackground}>
//                   <View
//                     style={[
//                       styles.strengthBarFill,
//                       {
//                         width: `${passwordStrength.value * 100}%`,
//                         backgroundColor: passwordStrength.color,
//                       },
//                     ]}
//                   />
//                 </View>
//                 <Text style={[styles.helperText, { color: passwordStrength.color }]}>
//                   {passwordStrength.label} password
//                 </Text>

//                 <View style={styles.requirementsList}>
//                   <Text
//                     style={[
//                       styles.requirementItem,
//                       password.length >= 8 && styles.valid,
//                     ]}
//                   >
//                     • At least 8 characters
//                   </Text>
//                   <Text
//                     style={[
//                       styles.requirementItem,
//                       /[A-Z]/.test(password) && styles.valid,
//                     ]}
//                   >
//                     • One uppercase letter
//                   </Text>
//                   <Text
//                     style={[
//                       styles.requirementItem,
//                       /[0-9]/.test(password) && styles.valid,
//                     ]}
//                   >
//                     • One number
//                   </Text>
//                 </View>
//               </View>

//               <View style={styles.fieldGroup}>
//                 <Text style={styles.fieldLabel}>Confirm password</Text>
//                 <View style={styles.inputRow}>
//                   <View style={styles.inputIconPlaceholder} />
//                   <TextInput
//                     style={styles.input}
//                     placeholder="Confirm your password"
//                     placeholderTextColor="#9CA3AF"
//                     secureTextEntry={!showConfirmPassword}
//                     value={confirmPassword}
//                     onChangeText={setConfirmPassword}
//                   />
//                   <TouchableOpacity
//                     onPress={() => setShowConfirmPassword((prev) => !prev)}
//                     disabled={loading}
//                     style={styles.inputTrailing}
//                   >
//                     <Text style={styles.inputTrailingText}>{showConfirmPassword ? 'Hide' : 'Show'}</Text>
//                   </TouchableOpacity>
//                 </View>
//                 {confirmPassword.length > 0 && (
//                   <Text style={[styles.validationText, passwordsMatch ? styles.valid : styles.invalid]}>
//                     {passwordsMatch ? 'Passwords match.' : 'Passwords do not match.'}
//                   </Text>
//                 )}
//               </View>

//               {!!info && <Text style={styles.errorInfo}>{info}</Text>}

//               <TouchableOpacity
//                 onPress={handleSignUp}
//                 disabled={loading}
//                 style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
//               >
//                 {loading ? (
//                   <ActivityIndicator color="#FFFFFF" />
//                 ) : (
//                   <Text style={styles.primaryButtonText}>Create Account</Text>
//                 )}
//               </TouchableOpacity>

//               <Text style={styles.termsText}>
//                 By signing up, you agree to our
//                 <Text style={styles.termsLink}> Terms of Service </Text>
//                 and
//                 <Text style={styles.termsLink}> Privacy Policy</Text>.
//               </Text>
//             </View>

//             <View style={styles.footerRow}>
//               <Text style={styles.footerText}>Already have an account?</Text>
//               <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={loading}>
//                 <Text style={styles.footerLinkText}>Sign in</Text>
//               </TouchableOpacity>
//             </View>
//           </ScrollView>
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
//     backgroundColor: '#FF6B6B',
//   },
//   scrollContent: {
//     paddingBottom: 24,
//   },
//   headerArea: {
//     marginBottom: 24,
//     alignItems: 'flex-start',
//   },
//   stepLabel: {
//     fontSize: 13,
//     color: 'rgba(255,255,255,0.9)',
//     marginBottom: 8,
//   },
//   stepDotsRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },
//   stepDot: {
//     width: 8,
//     height: 8,
//     borderRadius: 4,
//     backgroundColor: 'rgba(255,255,255,0.4)',
//     marginRight: 6,
//   },
//   stepDotActive: {
//     backgroundColor: '#FFFFFF',
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
//     fontWeight: '700',
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
//   helperText: {
//     marginTop: 4,
//     fontSize: 12,
//     color: '#6B7280',
//   },
//   validationText: {
//     marginTop: 4,
//     fontSize: 12,
//   },
//   valid: {
//     color: '#10B981',
//   },
//   invalid: {
//     color: '#EF4444',
//   },
//   strengthBarBackground: {
//     marginTop: 8,
//     height: 4,
//     borderRadius: 999,
//     backgroundColor: '#E5E7EB',
//     overflow: 'hidden',
//   },
//   strengthBarFill: {
//     height: 4,
//     borderRadius: 999,
//   },
//   requirementsList: {
//     marginTop: 8,
//   },
//   requirementItem: {
//     fontSize: 12,
//     color: '#6B7280',
//   },
//   errorInfo: {
//     marginTop: 8,
//     fontSize: 13,
//     color: '#EF4444',
//   },
//   primaryButton: {
//     height: 52,
//     borderRadius: 8,
//     backgroundColor: '#F97316',
//     justifyContent: 'center',
//     alignItems: 'center',
//     marginTop: 24,
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
//   termsText: {
//     marginTop: 16,
//     fontSize: 11,
//     color: '#6B7280',
//     textAlign: 'center',
//   },
//   termsLink: {
//     color: '#6366F1',
//     fontWeight: '500',
//   },
//   footerRow: {
//     marginTop: 24,
//     flexDirection: 'row',
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   footerText: {
//     fontSize: 14,
//     color: '#E5E7EB',
//     marginRight: 4,
//   },
//   footerLinkText: {
//     fontSize: 14,
//     fontWeight: '600',
//     color: '#FFFFFF',
//   },
// });










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
//   const [username, setUsername] = useState('');
//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const [confirmPassword, setConfirmPassword] = useState('');
//   const [loading, setLoading] = useState(false);
//   const [info, setInfo] = useState('');
//   const [showPassword, setShowPassword] = useState(false);
//   const [showConfirmPassword, setShowConfirmPassword] = useState(false);

//   const validatePassword = (value: string): string | null => {
//     if (value.length < 8) {
//       return 'Password must be at least 8 characters long.';
//     }
//     if (!/[A-Z]/.test(value)) {
//       return 'Password must include at least one uppercase letter.';
//     }
//     if (!/[a-z]/.test(value)) {
//       return 'Password must include at least one lowercase letter.';
//     }
//     if (!/[0-9]/.test(value)) {
//       return 'Password must include at least one number.';
//     }
//     return null;
//   };

//   const handleSignUp = async () => {
//     if (!username.trim()) {
//       setInfo('Please choose a username.');
//       return;
//     }

//     if (!email.includes('@')) {
//       setInfo('Please enter a valid email address.');
//       return;
//     }

//     if (!password || !confirmPassword) {
//       setInfo('Please fill in both password fields.');
//       return;
//     }

//     if (password !== confirmPassword) {
//       setInfo('Passwords do not match.');
//       return;
//     }

//     const passwordError = validatePassword(password);
//     if (passwordError) {
//       setInfo(passwordError);
//       return;
//     }

//     setLoading(true);
//     setInfo('');

//     try {
//       await signUpWithEmailPassword(email.trim().toLowerCase(), password, username.trim());
//       navigation.navigate('Login');
//     } catch {
//       // Error already handled by AuthContext via Alert.
//     } finally {
//       setLoading(false);
//     }
//   };

//   const usernameValidPattern = useMemo(
//     () => /^[a-zA-Z0-9_]+$/.test(username.trim()) && username.trim().length >= 3,
//     [username],
//   );

//   const emailLooksValid = useMemo(() => /.+@.+\..+/.test(email.trim()), [email]);

//   const passwordStrength = useMemo(() => {
//     if (!password) return { label: 'Weak', color: '#EF4444', value: 0 };
//     const lengthOk = password.length >= 8;
//     const hasUpper = /[A-Z]/.test(password);
//     const hasLower = /[a-z]/.test(password);
//     const hasNumber = /[0-9]/.test(password);
//     const score = [lengthOk, hasUpper, hasLower, hasNumber].filter(Boolean).length;
//     if (score <= 2) return { label: 'Weak', color: '#EF4444', value: 0.33 };
//     if (score === 3) return { label: 'Medium', color: '#F59E0B', value: 0.66 };
//     return { label: 'Strong', color: '#10B981', value: 1 };
//   }, [password]);

//   const passwordsMatch = confirmPassword.length > 0 && confirmPassword === password;

//   return (
//     <KeyboardAvoidingView
//       style={styles.container}
//       behavior={Platform.OS === 'ios' ? 'padding' : undefined}
//     >
//       <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
//         <View style={styles.gradientBackground}>
//           <ScrollView
//             contentContainerStyle={styles.scrollContent}
//             keyboardShouldPersistTaps="handled"
//             showsVerticalScrollIndicator={false}
//           >
//             {/* Compact Header */}
//             <View style={styles.headerArea}>
//               <View style={styles.stepDotsRow}>
//                 <View style={[styles.stepDot, styles.stepDotActive]} />
//                 <View style={styles.stepDot} />
//                 <View style={styles.stepDot} />
//               </View>
//             </View>

//             <View style={styles.card}>
//               {/* Compact Title */}
//               <Text style={styles.cardTitle}>Create Account</Text>
//               <Text style={styles.cardSubtitle}>Join thousands of students</Text>

//               {/* Username Field - Compact */}
//               <View style={styles.fieldGroup}>
//                 <View style={[
//                   styles.inputRow,
//                   username.length > 0 && (usernameValidPattern ? styles.inputValid : styles.inputInvalid)
//                 ]}>
//                   <Text style={styles.inputIcon}>@</Text>
//                   <TextInput
//                     style={styles.input}
//                     placeholder="Username"
//                     placeholderTextColor="#9CA3AF"
//                     autoCapitalize="none"
//                     autoCorrect={false}
//                     value={username}
//                     onChangeText={setUsername}
//                   />
//                   {username.length > 0 && usernameValidPattern && (
//                     <Text style={styles.validIcon}>✓</Text>
//                   )}
//                 </View>
//               </View>

//               {/* Email Field - Compact */}
//               <View style={styles.fieldGroup}>
//                 <View style={[
//                   styles.inputRow,
//                   email.length > 0 && (emailLooksValid ? styles.inputValid : styles.inputInvalid)
//                 ]}>
//                   <Text style={styles.inputIcon}>✉</Text>
//                   <TextInput
//                     style={styles.input}
//                     placeholder="Email address"
//                     placeholderTextColor="#9CA3AF"
//                     autoCapitalize="none"
//                     keyboardType="email-address"
//                     value={email}
//                     onChangeText={setEmail}
//                   />
//                   {email.length > 0 && emailLooksValid && (
//                     <Text style={styles.validIcon}>✓</Text>
//                   )}
//                 </View>
//               </View>

//               {/* Password Field - Compact with inline strength */}
//               <View style={styles.fieldGroup}>
//                 <View style={[styles.inputRow, password.length > 0 && styles.inputFocused]}>
//                   <Text style={styles.inputIcon}>🔒</Text>
//                   <TextInput
//                     style={styles.input}
//                     placeholder="Password (8+ chars, uppercase, number)"
//                     placeholderTextColor="#9CA3AF"
//                     secureTextEntry={!showPassword}
//                     value={password}
//                     onChangeText={setPassword}
//                   />
//                   <TouchableOpacity
//                     onPress={() => setShowPassword((prev) => !prev)}
//                     disabled={loading}
//                     style={styles.eyeButton}
//                   >
//                     <Text style={styles.eyeIcon}>{showPassword ? '👁' : '👁‍🗨'}</Text>
//                   </TouchableOpacity>
//                 </View>
//                 {/* Compact strength indicator - only show when typing */}
//                 {password.length > 0 && (
//                   <View style={styles.strengthRow}>
//                     <View style={styles.strengthBarBackground}>
//                       <View
//                         style={[
//                           styles.strengthBarFill,
//                           {
//                             width: `${passwordStrength.value * 100}%`,
//                             backgroundColor: passwordStrength.color,
//                           },
//                         ]}
//                       />
//                     </View>
//                     <Text style={[styles.strengthLabel, { color: passwordStrength.color }]}>
//                       {passwordStrength.label}
//                     </Text>
//                   </View>
//                 )}
//               </View>

//               {/* Confirm Password Field - Compact */}
//               <View style={styles.fieldGroup}>
//                 <View style={[
//                   styles.inputRow,
//                   confirmPassword.length > 0 && (passwordsMatch ? styles.inputValid : styles.inputInvalid)
//                 ]}>
//                   <Text style={styles.inputIcon}>🔒</Text>
//                   <TextInput
//                     style={styles.input}
//                     placeholder="Confirm password"
//                     placeholderTextColor="#9CA3AF"
//                     secureTextEntry={!showConfirmPassword}
//                     value={confirmPassword}
//                     onChangeText={setConfirmPassword}
//                   />
//                   <TouchableOpacity
//                     onPress={() => setShowConfirmPassword((prev) => !prev)}
//                     disabled={loading}
//                     style={styles.eyeButton}
//                   >
//                     <Text style={styles.eyeIcon}>{showConfirmPassword ? '👁' : '👁‍🗨'}</Text>
//                   </TouchableOpacity>
//                   {confirmPassword.length > 0 && passwordsMatch && (
//                     <Text style={styles.validIcon}>✓</Text>
//                   )}
//                 </View>
//               </View>

//               {/* Error message - only when present */}
//               {!!info && <Text style={styles.errorInfo}>{info}</Text>}

//               {/* Primary Button */}
//               <TouchableOpacity
//                 onPress={handleSignUp}
//                 disabled={loading}
//                 style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
//               >
//                 {loading ? (
//                   <ActivityIndicator color="#FFFFFF" />
//                 ) : (
//                   <Text style={styles.primaryButtonText}>Create Account</Text>
//                 )}
//               </TouchableOpacity>

//               {/* Compact Terms */}
//               <Text style={styles.termsText}>
//                 By signing up, you agree to our <Text style={styles.termsLink}>Terms</Text> and <Text style={styles.termsLink}>Privacy Policy</Text>
//               </Text>
//             </View>

//             {/* Footer */}
//             <View style={styles.footerRow}>
//               <Text style={styles.footerText}>Already have an account?</Text>
//               <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={loading}>
//                 <Text style={styles.footerLinkText}>Sign in</Text>
//               </TouchableOpacity>
//             </View>
//           </ScrollView>
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
//     paddingHorizontal: 20,
//     paddingTop: 16,
//     paddingBottom: 16,
//     backgroundColor: '#FF6B6B',
//   },
//   scrollContent: {
//     flexGrow: 1,
//   },
//   headerArea: {
//     marginBottom: 12,
//     alignItems: 'center',
//   },
//   stepDotsRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },
//   stepDot: {
//     width: 8,
//     height: 8,
//     borderRadius: 4,
//     backgroundColor: 'rgba(255,255,255,0.4)',
//     marginHorizontal: 3,
//   },
//   stepDotActive: {
//     backgroundColor: '#FFFFFF',
//     width: 24,
//   },
//   card: {
//     backgroundColor: '#FFFFFF',
//     borderRadius: 16,
//     padding: 16,
//     shadowColor: '#000000',
//     shadowOpacity: 0.06,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 8,
//     elevation: 2,
//   },
//   cardTitle: {
//     fontSize: 24,
//     fontWeight: '700',
//     color: '#1A1A1A',
//     textAlign: 'center',
//   },
//   cardSubtitle: {
//     marginTop: 2,
//     fontSize: 13,
//     color: '#666666',
//     marginBottom: 20,
//     textAlign: 'center',
//   },
//   fieldGroup: {
//     marginBottom: 12,
//   },
//   inputRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     borderWidth: 1.5,
//     borderColor: '#E5E7EB',
//     borderRadius: 10,
//     paddingHorizontal: 12,
//     height: 46,
//     backgroundColor: '#FFFFFF',
//   },
//   inputFocused: {
//     borderColor: '#D1D5DB',
//   },
//   inputValid: {
//     borderColor: '#10B981',
//   },
//   inputInvalid: {
//     borderColor: '#EF4444',
//   },
//   inputIcon: {
//     fontSize: 18,
//     marginRight: 8,
//   },
//   input: {
//     flex: 1,
//     fontSize: 15,
//     color: '#1A1A1A',
//   },
//   eyeButton: {
//     padding: 4,
//     marginLeft: 4,
//   },
//   eyeIcon: {
//     fontSize: 18,
//   },
//   validIcon: {
//     fontSize: 16,
//     color: '#10B981',
//     marginLeft: 4,
//   },
//   strengthRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginTop: 6,
//   },
//   strengthBarBackground: {
//     flex: 1,
//     height: 3,
//     borderRadius: 999,
//     backgroundColor: '#E5E7EB',
//     overflow: 'hidden',
//     marginRight: 8,
//   },
//   strengthBarFill: {
//     height: 3,
//     borderRadius: 999,
//   },
//   strengthLabel: {
//     fontSize: 11,
//     fontWeight: '600',
//     minWidth: 50,
//   },
//   errorInfo: {
//     marginTop: 4,
//     marginBottom: 8,
//     fontSize: 12,
//     color: '#EF4444',
//     textAlign: 'center',
//   },
//   primaryButton: {
//     height: 48,
//     borderRadius: 10,
//     backgroundColor: '#F97316',
//     justifyContent: 'center',
//     alignItems: 'center',
//     marginTop: 16,
//     shadowColor: '#000000',
//     shadowOpacity: 0.08,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 4,
//     elevation: 2,
//   },
//   primaryButtonDisabled: {
//     opacity: 0.6,
//   },
//   primaryButtonText: {
//     fontSize: 16,
//     fontWeight: '600',
//     color: '#FFFFFF',
//   },
//   termsText: {
//     marginTop: 12,
//     fontSize: 10,
//     color: '#6B7280',
//     textAlign: 'center',
//     lineHeight: 14,
//   },
//   termsLink: {
//     color: '#6366F1',
//     fontWeight: '500',
//   },
//   footerRow: {
//     marginTop: 16,
//     flexDirection: 'row',
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   footerText: {
//     fontSize: 13,
//     color: '#E5E7EB',
//     marginRight: 4,
//   },
//   footerLinkText: {
//     fontSize: 13,
//     fontWeight: '600',
//     color: '#FFFFFF',
//   },
// });








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
} from 'react-native';
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  const usernameValidPattern = useMemo(
    () => /^[a-zA-Z0-9_]+$/.test(username.trim()) && username.trim().length >= 3,
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.gradientBackground}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Compact Header */}
            <View style={styles.headerArea}>
              <View style={styles.headerTopRow}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Login')}
                  disabled={loading}
                  style={styles.backButton}
                >
                  <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>
                <View style={styles.stepDotsRow}>
                  <View style={[styles.stepDot, styles.stepDotActive]} />
                  <View style={styles.stepDot} />
                  <View style={styles.stepDot} />
                </View>
              </View>
            </View>

            <View style={styles.card}>
              {/* Compact Title */}
              <Text style={styles.cardTitle}>Create Account</Text>
              <Text style={styles.cardSubtitle}>Join thousands of students</Text>

              {/* Username Field - Compact */}
              <View style={styles.fieldGroup}>
                <View style={[
                  styles.inputRow,
                  username.length > 0 && (usernameValidPattern ? styles.inputValid : styles.inputInvalid)
                ]}>
                  <Text style={styles.inputIcon}>@</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Username"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={username}
                    onChangeText={setUsername}
                  />
                  {username.length > 0 && usernameValidPattern && (
                    <Text style={styles.validIcon}>✓</Text>
                  )}
                </View>
              </View>

              {/* Email Field - Compact */}
              <View style={styles.fieldGroup}>
                <View style={[
                  styles.inputRow,
                  email.length > 0 && (emailLooksValid ? styles.inputValid : styles.inputInvalid)
                ]}>
                  <Text style={styles.inputIcon}>✉</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Email address"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                  />
                  {email.length > 0 && emailLooksValid && (
                    <Text style={styles.validIcon}>✓</Text>
                  )}
                </View>
              </View>

              {/* Password Field - Compact with inline strength */}
              <View style={styles.fieldGroup}>
                <View style={[styles.inputRow, password.length > 0 && styles.inputFocused]}>
                  <Text style={styles.inputIcon}>🔒</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Password (8+)"
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
                {/* Compact strength indicator - only show when typing */}
                {password.length > 0 && (
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
                )}
              </View>

              {/* Confirm Password Field - Compact */}
              <View style={styles.fieldGroup}>
                <View style={[
                  styles.inputRow,
                  confirmPassword.length > 0 && (passwordsMatch ? styles.inputValid : styles.inputInvalid)
                ]}>
                  <Text style={styles.inputIcon}>🔒</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm password"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showConfirmPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword((prev) => !prev)}
                    disabled={loading}
                    style={styles.eyeButton}
                  >
                    <Text style={styles.eyeIcon}>{showConfirmPassword ? '👁' : '👁‍🗨'}</Text>
                  </TouchableOpacity>
                  {confirmPassword.length > 0 && passwordsMatch && (
                    <Text style={styles.validIcon}>✓</Text>
                  )}
                </View>
              </View>

              {/* Error message - only when present */}
              {!!info && <Text style={styles.errorInfo}>{info}</Text>}

              {/* Primary Button */}
              <TouchableOpacity
                onPress={handleSignUp}
                disabled={loading}
                style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Create Account</Text>
                )}
              </TouchableOpacity>

              {/* Compact Terms */}
              <Text style={styles.termsText}>
                By signing up, you agree to our <Text style={styles.termsLink}>Terms</Text> and <Text style={styles.termsLink}>Privacy Policy</Text>
              </Text>
            </View>

            {/* Footer */}
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already have an account?</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={loading}>
                <Text style={styles.footerLinkText}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientBackground: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#FF6B6B',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  headerArea: {
    marginBottom: 12,
    alignItems: 'center',
  },
  stepDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
    marginHorizontal: 3,
  },
  stepDotActive: {
    backgroundColor: '#FFFFFF',
    width: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  cardSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: '#666666',
    marginBottom: 20,
    textAlign: 'center',
  },
  fieldGroup: {
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
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
  inputIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
  },
  eyeButton: {
    padding: 4,
    marginLeft: 4,
  },
  eyeIcon: {
    fontSize: 18,
  },
  validIcon: {
    fontSize: 16,
    color: '#10B981',
    marginLeft: 4,
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
    height: 48,
    borderRadius: 10,
    backgroundColor: '#F97316',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
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
    color: '#6366F1',
    fontWeight: '500',
  },
  footerRow: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: '#E5E7EB',
    marginRight: 4,
  },
  footerLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});