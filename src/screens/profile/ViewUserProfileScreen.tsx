import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image, ScrollView, Alert, Button } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { sendLike } from '../../services/matching';
import { verifyMatchExists } from '../../services/chat';

export type ViewUserProfileScreenProps = NativeStackScreenProps<RootStackParamList, 'ViewUserProfile'>;

interface ViewProfile {
  id: string;
  username: string | null;
  name: string | null;
  age: number | null;
  city: string | null;
  country: string | null;
  bio: string | null;
  photos: string[] | null;
}

export const ViewUserProfileScreen: React.FC<ViewUserProfileScreenProps> = ({ route, navigation }) => {
  const { userId } = route.params;
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ViewProfile | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, name, age, city, country, bio, photos')
          .eq('id', userId)
          .maybeSingle();

        if (error) {
          Alert.alert('Error', error.message);
          return;
        }

        setProfile((data as ViewProfile) ?? null);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [userId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>User not found.</Text>
      </View>
    );
  }

  const mainPhoto = profile.photos?.[0];

  const handleLike = async () => {
    if (!user) return;
    if (user.id === userId) {
      Alert.alert('Info', 'You cannot like your own profile.');
      return;
    }

    setActionLoading(true);
    try {
      const { isMatch } = await sendLike(userId);
      if (isMatch) {
        const match = await verifyMatchExists(user.id, userId);
        if (match) {
          Alert.alert(
            "It's a match!",
            `You and ${profile.name ?? 'this user'} like each other.`,
            [
              { text: 'OK' },
              {
                text: 'Open chat',
                onPress: () =>
                  navigation.navigate('Chat', {
                    matchId: match.id,
                    otherUserId: match.other_user_id,
                    otherUserName: match.other_user_name,
                    otherUserPhoto: match.other_user_photo ?? undefined,
                  }),
              },
            ],
          );
        } else {
          Alert.alert("It's a match!", 'You and this user like each other.');
        }
      } else {
        Alert.alert('Like sent', 'If they like you back, it will be a match.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to send like');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartChat = async () => {
    if (!user) return;
    if (user.id === userId) {
      Alert.alert('Info', 'You cannot start a chat with yourself.');
      return;
    }

    setActionLoading(true);
    try {
      const match = await verifyMatchExists(user.id, userId);
      if (!match) {
        Alert.alert('No match yet', 'You can start a chat after you both like each other.');
        return;
      }

      navigation.navigate('Chat', {
        matchId: match.id,
        otherUserId: match.other_user_id,
        otherUserName: match.other_user_name,
        otherUserPhoto: match.other_user_photo ?? undefined,
      });
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to open chat');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {mainPhoto ? <Image source={{ uri: mainPhoto }} style={styles.photo} /> : null}
      <Text style={styles.username}>@{profile.username ?? 'unknown'}</Text>
      {!!profile.name && (
        <Text style={styles.name}>
          {profile.name}
          {profile.age ? `, ${profile.age}` : ''}
        </Text>
      )}
      {!!profile.city && !!profile.country && (
        <Text style={styles.location}>
          {profile.city}, {profile.country}
        </Text>
      )}
      {!!profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}

      <View style={styles.actionsRow}>
        <Button title="Like" onPress={handleLike} disabled={actionLoading} />
        <View style={{ width: 12 }} />
        <Button title="Start chat" onPress={handleStartChat} disabled={actionLoading} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
    alignItems: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  empty: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
  },
  photo: {
    width: 200,
    height: 200,
    borderRadius: 16,
    marginBottom: 16,
  },
  username: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    marginBottom: 4,
  },
  location: {
    fontSize: 14,
    color: '#555',
    marginBottom: 12,
  },
  bio: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  actionsRow: {
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
