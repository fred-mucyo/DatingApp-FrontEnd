import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator, Image, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../config/supabaseClient';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { getDailySuggestions, SuggestionProfile, sendLike } from '../../services/matching';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { signOut, user, profile } = useAuth();

  // Daily suggestions / matching state
  const LIKE_LIMIT_KEY = 'matching.likes_today';
  const LIKE_LIMIT = 50;

  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [suggestions, setSuggestions] = useState<SuggestionProfile[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [liking, setLiking] = useState(false);
  const [likesToday, setLikesToday] = useState<{ date: string; count: number } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ id: string; username: string; name: string | null }>>([]);
  const [searchInfo, setSearchInfo] = useState('');

  const loadLikesToday = useCallback(async () => {
    const today = new Date().toISOString().substring(0, 10);
    const raw = await AsyncStorage.getItem(LIKE_LIMIT_KEY);
    if (raw) {
      try {
        const parsed: { date: string; count: number } = JSON.parse(raw);
        if (parsed.date === today) {
          setLikesToday(parsed);
          return;
        }
      } catch {
        // ignore parse errors
      }
    }
    const fresh = { date: today, count: 0 };
    setLikesToday(fresh);
    await AsyncStorage.setItem(LIKE_LIMIT_KEY, JSON.stringify(fresh));
  }, []);

  const incrementLikesToday = useCallback(async () => {
    const today = new Date().toISOString().substring(0, 10);
    const next = {
      date: today,
      count: (likesToday?.count ?? 0) + 1,
    };
    setLikesToday(next);
    await AsyncStorage.setItem(LIKE_LIMIT_KEY, JSON.stringify(next));
  }, [likesToday]);

  const loadSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    try {
      // 5 at a time on the client, 15–20 total suggestions per day from the backend
      const data = await getDailySuggestions(5, 20);
      setSuggestions(data);
      setSuggestionIndex(0);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to load suggestions');
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  useEffect(() => {
    loadLikesToday();
    loadSuggestions();
  }, [loadLikesToday, loadSuggestions]);

  const visibleSuggestions = suggestions.slice(suggestionIndex, suggestionIndex + 5);

  const handlePass = () => {
    if (suggestionIndex + 1 >= suggestions.length) {
      Alert.alert('End of feed', 'Come back tomorrow for new suggestions.');
    } else {
      setSuggestionIndex((prev) => prev + 1);
    }
  };

  const handleLike = async (profileToLike: SuggestionProfile) => {
    if (!user) return;
    const todayCount = likesToday?.count ?? 0;
    if (todayCount >= LIKE_LIMIT) {
      Alert.alert('Limit reached', 'You have reached your daily like limit.');
      return;
    }

    setLiking(true);
    try {
      const { isMatch } = await sendLike(profileToLike.id);
      await incrementLikesToday();

      if (isMatch) {
        Alert.alert("It's a match!", `You and ${profileToLike.name} like each other.`);
      }
      handlePass();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to send like');
    } finally {
      setLiking(false);
    }
  };

  const renderSuggestionItem = ({ item }: { item: SuggestionProfile }) => {
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
        <View style={styles.buttonRowSuggestions}>
          <Button title="Pass" onPress={handlePass} />
          <Button
            title={liking ? 'Liking...' : 'Like'}
            onPress={() => handleLike(item)}
            disabled={liking}
          />
        </View>
      </View>
    );
  };

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setSearchInfo('');
      return;
    }

    setSearchLoading(true);
    setSearchInfo('');
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, name')
        .ilike('username', `${q}%`)
        .limit(20);

      if (error) {
        setSearchInfo(error.message);
        return;
      }

      setSearchResults((data as any) ?? []);
      if (!data || data.length === 0) {
        setSearchInfo('No users found with that username.');
      }
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Uni Dating Beta</Text>
      <Text style={styles.beta}>BETA</Text>
      <Text style={styles.subtitle}>Welcome, {profile?.name || user?.email}!</Text>

      <View style={styles.suggestionsSection}>
        <Text style={styles.suggestionsHeader}>Today&apos;s suggestions</Text>
        {loadingSuggestions ? (
          <View style={styles.suggestionsLoadingRow}>
            <ActivityIndicator />
          </View>
        ) : suggestions.length === 0 ? (
          <Text style={styles.empty}>No suggestions right now. Come back later.</Text>
        ) : (
          <>
            <Text style={styles.subheaderSuggestions}>
              Showing {visibleSuggestions.length} of {suggestions.length} suggestions. Likes today:{' '}
              {likesToday?.count ?? 0}/{LIKE_LIMIT}
            </Text>
            <FlatList
              data={visibleSuggestions}
              keyExtractor={(item) => item.id}
              renderItem={renderSuggestionItem}
              contentContainerStyle={styles.listContent}
            />
          </>
        )}
      </View>

      <View style={styles.buttonRow}
      >
        <Button
          title="Explore"
          onPress={() => navigation.navigate('Explore')}
        />
      </View>

      <View style={styles.buttonRow}>
        <Button
          title="Messages (Beta)"
          onPress={() => navigation.navigate('Matches')}
        />
      </View>

      <View style={styles.buttonRow}>
        <Button
          title="My profile"
          onPress={() => navigation.navigate('MyProfile')}
        />
      </View>

      <View style={styles.buttonRow}>
        <Button title="Sign out" onPress={signOut} />
      </View>

      <View style={styles.searchSection}>
        <Text style={styles.searchLabel}>Search users by username</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Type a username..."
          autoCapitalize="none"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
        />
        <View style={styles.searchButtonRow}>
          <Button title="Search" onPress={handleSearch} disabled={searchLoading} />
        </View>
        {searchLoading && (
          <View style={styles.searchLoadingRow}>
            <ActivityIndicator size="small" />
          </View>
        )}
        {!!searchInfo && <Text style={styles.searchInfo}>{searchInfo}</Text>}

        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.searchResultRow}
              onPress={() => navigation.navigate('ViewUserProfile', { userId: item.id })}
            >
              <Text style={styles.searchResultUsername}>@{item.username}</Text>
              {!!item.name && <Text style={styles.searchResultName}>{item.name}</Text>}
            </TouchableOpacity>
          )}
          ListEmptyComponent={null}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  beta: {
    fontSize: 12,
    color: '#ef4444',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  suggestionsSection: {
    marginBottom: 16,
  },
  suggestionsHeader: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  subheaderSuggestions: {
    fontSize: 12,
    color: '#555',
    marginBottom: 8,
    textAlign: 'center',
  },
  suggestionsLoadingRow: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 8,
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
    height: 220,
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
  buttonRowSuggestions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  buttonRow: {
    marginTop: 12,
    alignItems: 'center',
  },
  searchSection: {
    marginTop: 24,
    width: '100%',
  },
  searchLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    width: 260,
    alignSelf: 'center',
  },
  searchButtonRow: {
    marginTop: 8,
    alignItems: 'center',
  },
  searchLoadingRow: {
    marginTop: 8,
    alignItems: 'center',
  },
  searchInfo: {
    marginTop: 8,
    textAlign: 'center',
    color: '#555',
  },
  searchResultRow: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignSelf: 'stretch',
  },
  searchResultUsername: {
    fontWeight: '600',
  },
  searchResultName: {
    marginTop: 2,
    color: '#555',
  },
  empty: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
  },
});
