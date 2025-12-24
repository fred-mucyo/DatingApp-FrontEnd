import React from 'react';
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
  ViewUserProfile: { userId: string };
  Chat: { matchId: string; otherUserId: string; otherUserName: string; otherUserPhoto?: string | null };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator = () => {
  const { session, profile, profileLoading } = useAuth();

  const needsProfile = !!session && (!profile || !profile.is_complete);

  return (
    <Stack.Navigator>
      {!session && (
        <>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ title: 'Uni Dating Beta - Login' }}
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
            options={{ title: 'Uni Dating Beta' }}
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
            options={{ title: 'Messages (Beta)' }}
          />
          <Stack.Screen
            name="MyProfile"
            component={MyProfileScreen}
            options={{ title: 'My profile' }}
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
