import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Button, StyleSheet, ActivityIndicator, Alert, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { getDailySuggestions, SuggestionProfile, sendLike } from '../../services/matching';
import { useAuth } from '../../context/AuthContext';

const LIKE_LIMIT_KEY = 'matching.likes_today';
const LIKE_LIMIT = 50;

export type DiscoveryScreenProps = NativeStackScreenProps<RootStackParamList, 'Discovery'>;

interface LikesTodayState {
  date: string; // YYYY-MM-DD
  count: number;
}

export const DiscoveryScreen: React.FC<DiscoveryScreenProps> = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<SuggestionProfile[]>([]);
  const [index, setIndex] = useState(0);
  const [liking, setLiking] = useState(false);
  const [likesToday, setLikesToday] = useState<LikesTodayState | null>(null);

  const loadLikesToday = useCallback(async () => {
    const today = new Date().toISOString().substring(0, 10);
    const raw = await AsyncStorage.getItem(LIKE_LIMIT_KEY);
    if (raw) {
      try {
        const parsed: LikesTodayState = JSON.parse(raw);
        if (parsed.date === today) {
          setLikesToday(parsed);
          return;
        }
      } catch {
        // ignore
      }
    }
    const fresh: LikesTodayState = { date: today, count: 0 };
    setLikesToday(fresh);
    await AsyncStorage.setItem(LIKE_LIMIT_KEY, JSON.stringify(fresh));
  }, []);

  const incrementLikesToday = useCallback(async () => {
    const today = new Date().toISOString().substring(0, 10);
    const next: LikesTodayState = {
      date: today,
      count: (likesToday?.count ?? 0) + 1,
    };
    setLikesToday(next);
    await AsyncStorage.setItem(LIKE_LIMIT_KEY, JSON.stringify(next));
  }, [likesToday]);

  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDailySuggestions(5, 20);
      setProfiles(data);
      setIndex(0);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLikesToday();
    loadSuggestions();
  }, [loadLikesToday, loadSuggestions]);

  const visibleProfiles = profiles.slice(index, index + 5);

  const handlePass = () => {
    if (index + 1 >= profiles.length) {
      Alert.alert('End of feed', 'Come back tomorrow for new suggestions.');
    } else {
      setIndex((prev) => prev + 1);
    }
  };

  const handleLike = async (profile: SuggestionProfile) => {
    if (!user) return;
    const todayCount = likesToday?.count ?? 0;
    if (todayCount >= LIKE_LIMIT) {
      Alert.alert('Limit reached', 'You have reached your daily like limit.');
      return;
    }

    setLiking(true);
    try {
      const { isMatch } = await sendLike(profile.id);
      await incrementLikesToday();

      if (isMatch) {
        Alert.alert("It's a match!", `You and ${profile.name} like each other.`);
      }
      handlePass();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to send like');
    } finally {
      setLiking(false);
    }
  };

  const renderItem = ({ item }: { item: SuggestionProfile }) => {
    const photo = item.profile_photos?.[0];
    return (
      <View style={styles.card}>
        {photo ? <Image source={{ uri: photo }} style={styles.photo} /> : null}
        <Text style={styles.name}>
          {item.name}, {item.age}
        </Text>
        <Text style={styles.meta}>
          {item.city}, {item.country}
        </Text>
        <Text style={styles.meta}>Score: {item.score}</Text>
        <View style={styles.buttonRow}>
          <Button title="Pass" onPress={handlePass} />
          <Button title={liking ? 'Liking...' : 'Like'} onPress={() => handleLike(item)} disabled={liking} />
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (profiles.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>No suggestions right now. Come back later.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Daily curated suggestions (Beta)</Text>
      <Text style={styles.subheader}>
        Showing {visibleProfiles.length} of {profiles.length} suggestions. Likes today: {likesToday?.count ?? 0}/
        {LIKE_LIMIT}
      </Text>
      <FlatList
        data={visibleProfiles}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subheader: {
    fontSize: 12,
    color: '#555',
    marginBottom: 8,
  },
  listContent: {
    paddingVertical: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  meta: {
    fontSize: 12,
    color: '#555',
    marginBottom: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  empty: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
  },
});
