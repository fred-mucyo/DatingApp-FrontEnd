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
const MyProfileScreen = lazyNamed(() => import('../screens/profile/MyProfileScreen'), 'MyProfileScreen');
const ChatScreen = lazyNamed(() => import('../screens/chat/ChatScreen'), 'ChatScreen');
const SupportCenterScreen = lazyNamed(
  () => import('../screens/support/SupportCenterScreen'),
  'SupportCenterScreen',
);

export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ResetPassword: undefined;
  ProfileWizard: undefined;
  Home: undefined;
  Discovery: undefined;
  Explore: undefined;
  Likes: undefined;
  Matches: undefined;
  MyProfile: undefined;
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
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );
  }

  return (
    <Suspense fallback={<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color="#F97316" /></View>}>
      <Stack.Navigator>
      {!session && (
        <>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ title: 'MUTIMA - Login' }}
          />
          <Stack.Screen
            name="SignUp"
            component={SignUpScreen}
            options={{ title: 'Create Account' }}
          />
          <Stack.Screen
            name="ResetPassword"
            component={ResetPasswordScreen}
            options={{ title: 'Reset password' }}
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
            options={{ title: 'MUTIMA' }}
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
            name="SupportCenter"
            component={SupportCenterScreen}
            options={{ title: 'Support center' }}
          />
          <Stack.Screen
            name="ViewUserProfile"
            component={ViewUserProfileScreen}
            options={{ title: 'User profile' }}
          />
          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            options={{ title: 'Chat' }}
          />
        </>
      )}
      </Stack.Navigator>
    </Suspense>
  );
};
