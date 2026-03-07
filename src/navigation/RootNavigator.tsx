import React, { Suspense } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';

const lazyNamed = <T extends React.ComponentType<any>>(
  importer: () => Promise<any>,
  exportName: string,
) =>
  React.lazy(async () => {
    const mod = await importer();
    const component = mod?.[exportName] ?? mod?.default;
    if (!component) {
      throw new Error(
        `Lazy-loaded screen export not found. Expected export "${exportName}" or a default export.`,
      );
    }
    return { default: component as T };
  });

const LoginScreen = lazyNamed(() => import('../screens/auth/LoginScreen'), 'LoginScreen');
const SignUpScreen = lazyNamed(() => import('../screens/auth/SignUpScreen'), 'SignUpScreen');
const OtpScreen = lazyNamed(() => import('../screens/auth/OtpScreen'), 'OtpScreen');
const ResetPasswordScreen = lazyNamed(
  () => import('../screens/auth/ResetPasswordScreen'),
  'ResetPasswordScreen',
);
const ProfileWizardScreen = lazyNamed(
  () => import('../screens/profile/ProfileWizardScreen'),
  'ProfileWizardScreen',
);
const HomeScreen = lazyNamed(() => import('../screens/home/HomeScreen'), 'HomeScreen');
const DiscoveryScreen = lazyNamed(() => import('../screens/discovery/DiscoveryScreen'), 'DiscoveryScreen');
const ExploreScreen = React.lazy(() => import('../screens/explore/ExploreScreen'));
const MatchesScreen = lazyNamed(() => import('../screens/chat/MatchesScreen'), 'MatchesScreen');
const LikesScreen = lazyNamed(() => import('../screens/chat/LikesScreen'), 'LikesScreen');
const ViewUserProfileScreen = lazyNamed(
  () => import('../screens/profile/ViewUserProfileScreen'),
  'ViewUserProfileScreen',
);
const MyProfileScreen = lazyNamed(() => import('../screens/profile/ProfileHubScreen'), 'ProfileHubScreen');
const ProfileBasicInfoScreen = lazyNamed(
  () => import('../screens/profile/ProfileBasicInfoScreen'),
  'ProfileBasicInfoScreen',
);
const ProfilePreferencesScreen = lazyNamed(
  () => import('../screens/profile/ProfilePreferencesScreen'),
  'ProfilePreferencesScreen',
);
const ProfilePhotosScreen = lazyNamed(
  () => import('../screens/profile/ProfilePhotosScreen'),
  'ProfilePhotosScreen',
);
const ProfileSupportPrivacyScreen = lazyNamed(
  () => import('../screens/profile/ProfileSupportPrivacyScreen'),
  'ProfileSupportPrivacyScreen',
);
const RequestVerificationScreen = lazyNamed(
  () => import('../screens/profile/RequestVerificationScreen'),
  'RequestVerificationScreen',
);
const ChatScreen = lazyNamed(() => import('../screens/chat/ChatScreen'), 'ChatScreen');
const SupportCenterScreen = lazyNamed(
  () => import('../screens/support/SupportCenterScreen'),
  'SupportCenterScreen',
);
const TermsOfServiceScreen = lazyNamed(
  () => import('../screens/legal/TermsOfServiceScreen'),
  'TermsOfServiceScreen',
);
const PrivacyPolicyScreen = lazyNamed(
  () => import('../screens/legal/PrivacyPolicyScreen'),
  'PrivacyPolicyScreen',
);

export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  Otp: { email: string };
  ResetPassword: undefined;
  TermsOfService: undefined;
  PrivacyPolicy: undefined;
  ProfileWizard: undefined;
  Home: undefined;
  Discovery: undefined;
  Explore: undefined;
  Likes: undefined;
  Matches: undefined;
  MyProfile: undefined;
  ProfileBasicInfo: undefined;
  ProfilePreferences: undefined;
  ProfilePhotos: undefined;
  ProfileSupportPrivacy: undefined;
  RequestVerification: undefined;
  SupportCenter: undefined;
  ViewUserProfile: { userId: string };
  Chat: { matchId: string; otherUserId: string; otherUserName: string; otherUserPhoto?: string | null };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator = () => {
  const { session, profile, profileLoading, loading } = useAuth();

  const needsProfile = !!session && !profileLoading && (!profile || !profile.is_complete);

  // While we are still determining the auth session or loading the profile,
  // avoid rendering either the ProfileWizard or Home to prevent flicker.
  if (loading || profileLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#ff4b2b" />
      </View>
    );
  }

  return (
    <Suspense fallback={<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color="#ff4b2b" /></View>}>
      <Stack.Navigator>
      {!session && (
        <>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ title: 'Umutima - Login' }}
          />
          <Stack.Screen
            name="SignUp"
            component={SignUpScreen}
            options={{ title: 'Create Account' }}
          />
          <Stack.Screen
            name="Otp"
            component={OtpScreen}
            options={{ title: 'Verify email' }}
          />
          <Stack.Screen
            name="ResetPassword"
            component={ResetPasswordScreen}
            options={{ title: 'Reset password' }}
          />
          <Stack.Screen
            name="TermsOfService"
            component={TermsOfServiceScreen}
            options={{ title: 'Terms of Service' }}
          />
          <Stack.Screen
            name="PrivacyPolicy"
            component={PrivacyPolicyScreen}
            options={{ title: 'Privacy Policy' }}
          />
        </>
      )}

      {session && needsProfile && (
        <Stack.Screen
          name="ProfileWizard"
          component={ProfileWizardScreen}
          options={{
            headerBackVisible: false,
            title: 'Complete Profile',
          }}
        />
      )}

      {session && !needsProfile && (
        <>
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: 'Umutima' }}
          />
          <Stack.Screen
            name="ResetPassword"
            component={ResetPasswordScreen}
            options={{ title: 'Reset password' }}
          />
          <Stack.Screen
            name="Discovery"
            component={DiscoveryScreen}
            options={{ title: 'Browse Matches (Beta)' }}
          />
          <Stack.Screen
            name="Explore"
            component={ExploreScreen}
            options={{ title: 'Explore' }}
          />
          <Stack.Screen
            name="Likes"
            component={LikesScreen}
            options={{ title: 'Likes' }}
          />
          <Stack.Screen
            name="Matches"
            component={MatchesScreen}
            options={{ title: 'Messages' }}
          />
          <Stack.Screen
            name="MyProfile"
            component={MyProfileScreen}
            options={{ title: 'My profile' }}
          />
          <Stack.Screen
            name="ProfileBasicInfo"
            component={ProfileBasicInfoScreen}
            options={{ title: 'Basic information' }}
          />
          <Stack.Screen
            name="ProfilePreferences"
            component={ProfilePreferencesScreen}
            options={{ title: 'Preferences' }}
          />
          <Stack.Screen
            name="ProfilePhotos"
            component={ProfilePhotosScreen}
            options={{ title: 'Photos' }}
          />
          <Stack.Screen
            name="ProfileSupportPrivacy"
            component={ProfileSupportPrivacyScreen}
            options={{ title: 'Support & privacy' }}
          />
          <Stack.Screen
            name="RequestVerification"
            component={RequestVerificationScreen}
            options={{ title: 'Request verification' }}
          />
          <Stack.Screen
            name="SupportCenter"
            component={SupportCenterScreen}
            options={{ title: 'Support center' }}
          />
          <Stack.Screen
            name="TermsOfService"
            component={TermsOfServiceScreen}
            options={{ title: 'Terms of Service' }}
          />
          <Stack.Screen
            name="PrivacyPolicy"
            component={PrivacyPolicyScreen}
            options={{ title: 'Privacy Policy' }}
          />
          <Stack.Screen
            name="ViewUserProfile"
            component={ViewUserProfileScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            options={{ headerShown: false }}
          />
        </>
      )}
      </Stack.Navigator>
    </Suspense>
  );
};