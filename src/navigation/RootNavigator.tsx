import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignUpScreen } from '../screens/auth/SignUpScreen';
import { ProfileWizardScreen } from '../screens/profile/ProfileWizardScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { DiscoveryScreen } from '../screens/discovery/DiscoveryScreen';
import { ExploreScreen } from '../screens/explore/ExploreScreen';
import { MatchesScreen } from '../screens/chat/MatchesScreen';
import { LikesScreen } from '../screens/chat/LikesScreen';
import { ViewUserProfileScreen } from '../screens/profile/ViewUserProfileScreen';
import { MyProfileScreen } from '../screens/profile/MyProfileScreen';
import { ChatScreen } from '../screens/chat/ChatScreen';
import { SupportCenterScreen } from '../screens/support/SupportCenterScreen';

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
  );
};
