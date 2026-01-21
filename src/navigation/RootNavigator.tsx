import React, { Suspense } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';

const LoginScreen = React.lazy(() =>
  import('../screens/auth/LoginScreen').then((m) => ({ default: m.LoginScreen })),
);
const SignUpScreen = React.lazy(() =>
  import('../screens/auth/SignUpScreen').then((m) => ({ default: m.SignUpScreen })),
);
const ProfileWizardScreen = React.lazy(() =>
  import('../screens/profile/ProfileWizardScreen').then((m) => ({
    default: m.ProfileWizardScreen,
  })),
);
const HomeScreen = React.lazy(() =>
  import('../screens/home/HomeScreen').then((m) => ({ default: m.HomeScreen })),
);
const DiscoveryScreen = React.lazy(() =>
  import('../screens/discovery/DiscoveryScreen').then((m) => ({ default: m.DiscoveryScreen })),
);
const ExploreScreen = React.lazy(() =>
  import('../screens/explore/ExploreScreen').then((m) => ({ default: m.default })),
);
const MatchesScreen = React.lazy(() =>
  import('../screens/chat/MatchesScreen').then((m) => ({ default: m.MatchesScreen })),
);
const LikesScreen = React.lazy(() =>
  import('../screens/chat/LikesScreen').then((m) => ({ default: m.LikesScreen })),
);
const ViewUserProfileScreen = React.lazy(() =>
  import('../screens/profile/ViewUserProfileScreen').then((m) => ({
    default: m.ViewUserProfileScreen,
  })),
);
const MyProfileScreen = React.lazy(() =>
  import('../screens/profile/MyProfileScreen').then((m) => ({ default: m.MyProfileScreen })),
);
const ChatScreen = React.lazy(() =>
  import('../screens/chat/ChatScreen').then((m) => ({ default: m.ChatScreen })),
);
const SupportCenterScreen = React.lazy(() =>
  import('../screens/support/SupportCenterScreen').then((m) => ({
    default: m.SupportCenterScreen,
  })),
);

export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
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
