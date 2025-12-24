import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  SafeAreaView,
  ScrollView,
  Share,
  Dimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { getDailySuggestions, SuggestionProfile, sendLike } from '../../services/matching';
import { supabase } from '../../config/supabaseClient';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const { width, height } = Dimensions.get('window');

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { user, profile } = useAuth();

  const LIKE_LIMIT_KEY = 'matching.likes_today';
  const LIKE_LIMIT = 50;

  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [suggestions, setSuggestions] = useState<SuggestionProfile[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [liking, setLiking] = useState(false);
  const [likesToday, setLikesToday] = useState<{ date: string; count: number } | null>(null);

  const greetingName = profile?.name || user?.email || 'there';

  const { greetingLine, greetingSubtext } = useMemo(() => {
    const now = new Date();
    const hours = now.getHours();
    let sub = 'Ready to discover new connections?';
    if (hours >= 5 && hours < 12) {
      sub = 'Ready to start your day right?';
    } else if (hours >= 12 && hours < 17) {
      sub = 'Ready to discover new connections?';
    } else {
      sub = 'Ready to meet someone special?';
    }

    const weekday = now.toLocaleDateString(undefined, { weekday: 'long' });
    const month = now.toLocaleDateString(undefined, { month: 'long' });
    const day = now.getDate();
    const dateString = `${weekday}, ${month} ${day}`;

    return {
      greetingLine: `Hi, ${greetingName}!`,
      greetingSubtext: `${sub}  ·  ${dateString}`,
    };
  }, [greetingName]);

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
    const data = await getDailySuggestions(5, 20);
    console.log('HOME getDailySuggestions result:', {
      count: data?.length ?? 0,
      first: data && data.length > 0 ? data[0] : null,
    });

    // If RPC didn't include photos, enrich from profiles table
    const enriched = await Promise.all(
      (data ?? []).map(async (p) => {
        const anyP: any = p as any;
        const rawProfilePhotos = anyP.profile_photos;

        const hasPhotosArray =
          Array.isArray(rawProfilePhotos) && rawProfilePhotos.length > 0;
        const hasPhotosString =
          typeof rawProfilePhotos === 'string' && !!rawProfilePhotos;

        if (hasPhotosArray || hasPhotosString) {
          return p;
        }

        try {
          const { data: prof, error } = await supabase
            .from('profiles')
            .select('photos')
            .eq('id', p.id)
            .maybeSingle();

          if (
            !error &&
            prof &&
            Array.isArray(prof.photos) &&
            prof.photos.length > 0
          ) {
            return {
              ...p,
              profile_photos: prof.photos,
            } as SuggestionProfile;
          }
        } catch (err) {
          console.log('HOME enrich suggestion error:', { id: p.id, err });
        }

        return p;
      }),
    );

    setSuggestions(enriched);
    setSuggestionIndex(0);
  } catch (e: any) {
    console.log('HOME getDailySuggestions error:', e);
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

  const handleShare = async () => {
    try {
      await Share.share({
        message: 'Check out this amazing dating app! Download now and find your match.',
        title: 'Share App',
      });
    } catch (error) {
      console.log('Error sharing:', error);
    }
  };

  const handleMessage = (profileId: string) => {
    Alert.alert('Send Message', 'This will open chat with this user.');
  };

  const PassIcon = () => (
    <Svg width={42} height={42} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 6l12 12M18 6L6 18"
        stroke="#F87171"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
    </Svg>
  );

  const LikeIcon = () => (
    <Svg width={44} height={44} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12.001 5.5c-1.54-1.67-4.04-1.67-5.58 0-1.5 1.63-1.5 4.27 0 5.9l4.47 4.85a1 1 0 0 0 1.46 0l4.47-4.85c1.5-1.63 1.5-4.27 0-5.9-1.54-1.67-4.04-1.67-5.58 0Z"
        fill="#22C55E"
      />
    </Svg>
  );

  const MessageIcon = () => (
    <Svg width={42} height={42} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 5l16 7-16 7 3-7-3-7z"
        fill="#38BDF8"
        transform="rotate(-40 12 12)"
      />
    </Svg>
  );

  const HomeNavIcon = () => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 5.5C7.8 4 9.2 3 11 3c1.9 0 3.2 1.2 3.8 2.4.6 1.2.7 2.5.5 3.6-.3 1.5-1.1 2.8-2.2 3.9-.6.6-.9 1.4-.9 2.2V19a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.3C8 15.1 7.4 13.7 6.6 12.5 5.6 11 5 9.7 5 8.3c0-1.1.4-2.1 1-2.8Z"
        fill="#F97316"
      />
      <Path
        d="M11.5 9.5C12.2 8.3 13.2 7.5 14.5 7.5c1.3 0 2.3.8 2.7 1.8.4 1 .3 2-.1 2.9-.5 1.1-1.4 2.1-2.4 3-.3.3-.7.7-.7 1.3V18a.8.8 0 0 1-.8.8h-1a.8.8 0 0 1-.8-.8v-1.5c0-1-.3-1.9-.7-2.7-.4-.8-.7-1.6-.7-2.4 0-.8.3-1.6.8-1.9Z"
        fill="#FACC15"
      />
    </Svg>
  );

  const LikesNavIcon = () => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12.001 5.5c-1.54-1.67-4.04-1.67-5.58 0-1.5 1.63-1.5 4.27 0 5.9l4.47 4.85a1 1 0 0 0 1.46 0l4.47-4.85c1.5-1.63 1.5-4.27 0-5.9-1.54-1.67-4.04-1.67-5.58 0Z"
        fill="#FFFFFF"
      />
    </Svg>
  );

  const ExploreNavIcon = () => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z"
        stroke="#FFFFFF"
        strokeWidth={1.6}
      />
      <Path
        d="M10 14l1.2-3.8L15 9l-1.2 3.8L10 14Z"
        fill="#FFFFFF"
      />
    </Svg>
  );

  const ProfileNavIcon = () => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="#FFFFFF"
        strokeWidth={1.8}
      />
      <Path
        d="M6 19c.8-2.4 3.1-4 6-4s5.2 1.6 6 4"
        stroke="#FFFFFF"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );

  const MessagesNavIcon = () => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 6h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-6.5L8 20v-4H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
        stroke="#FFFFFF"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 11h6"
        stroke="#FFFFFF"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </Svg>
  );

  const LocationIcon = () => (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3a6 6 0 0 0-6 6c0 4.2 4.5 8.7 5.6 9.8a.6.6 0 0 0 .8 0C13.5 17.7 18 13.2 18 9a6 6 0 0 0-6-6Z"
        stroke="#FFFFFF"
        strokeWidth={1.8}
      />
      <Path
        d="M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
        stroke="#FFFFFF"
        strokeWidth={1.8}
      />
    </Svg>
  );

  const renderSuggestionItem = ({ item }: { item: SuggestionProfile }) => {
    const anyItem: any = item as any;
    const rawProfilePhotos = anyItem.profile_photos;
    const rawPhotos = anyItem.photos;

    let photo: string | undefined;

    if (Array.isArray(rawProfilePhotos) && rawProfilePhotos.length > 0) {
      photo = rawProfilePhotos[0];
    } else if (typeof rawProfilePhotos === 'string' && rawProfilePhotos) {
      photo = rawProfilePhotos;
    } else if (Array.isArray(rawPhotos) && rawPhotos.length > 0) {
      photo = rawPhotos[0];
    } else if (typeof rawPhotos === 'string' && rawPhotos) {
      photo = rawPhotos;
    }

    if (!photo) {
      console.log('HOME renderSuggestionItem: no photo for item', {
        id: item.id,
        name: item.name,
        profile_photos: rawProfilePhotos,
        photos: rawPhotos,
      });
    } else {
      console.log('HOME renderSuggestionItem: using photo', {
        id: item.id,
        name: item.name,
        photo,
      });
    }
    return (
      <View style={styles.cardContainer}>
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={styles.fullScreenImage}
            onError={(e) => {
              console.log('HOME Image failed to load', {
                id: item.id,
                name: item.name,
                photo,
                error: e.nativeEvent,
              });
            }}
          />
        ) : (
          <View style={[styles.fullScreenImage, styles.placeholderImage]}>
            <Text style={styles.placeholderText}>No Photo</Text>
          </View>
        )}
        
        {/* Bottom gradient overlay */}
        <View style={styles.bottomGradient} />

        {/* Profile info floating on image */}
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>
            {item.name} <Text style={styles.profileAge}>{item.age}</Text>
          </Text>
          <View style={styles.locationRow}>
            <LocationIcon />
            <Text style={styles.profileLocation}>
              {item.city}, {item.country}
            </Text>
          </View>
        </View>

        {/* Action buttons floating on image */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={[styles.roundActionButton, styles.passButton]}
            onPress={handlePass}
            disabled={liking}
          >
            <PassIcon />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.roundActionButton, styles.likeButton]}
            onPress={() => handleLike(item)}
            disabled={liking}
          >
            {liking ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <LikeIcon />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.roundActionButton, styles.messageButton]}
            onPress={() => handleMessage(item.id)}
          >
            <MessageIcon />
          </TouchableOpacity>
        </View>

        {/* Info button (top right) */}
        <TouchableOpacity style={styles.infoButton}>
          <Text style={styles.infoButtonIcon}>ⓘ</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <View style={styles.shareIconCircle}>
              <Text style={styles.shareIcon}>➤</Text>
            </View>
          </TouchableOpacity>
        </View>

        {loadingSuggestions ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF6B6B" />
            <Text style={styles.loadingText}>Finding matches for you...</Text>
          </View>
        ) : suggestions.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyIcon}>😊</Text>
            <Text style={styles.emptyTitle}>You've seen everyone for today!</Text>
            <Text style={styles.emptySubtitle}>
              Come back tomorrow for fresh matches
            </Text>
            <TouchableOpacity
              style={styles.exploreButton}
              onPress={() => navigation.navigate('Explore')}
            >
              <Text style={styles.exploreButtonText}>Explore More</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={visibleSuggestions}
            keyExtractor={(item) => item.id}
            renderItem={renderSuggestionItem}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.carousel}
          />
        )}

        {/* Bottom Navigation Bar */}
        <View style={styles.bottomNavContainer}>
          <View style={styles.bottomNav}>
            <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
              <View style={[styles.navIconCircle, styles.navIconActive]}>
                <HomeNavIcon />
              </View>
              <Text style={[styles.navLabel, styles.navLabelActive]}>Home</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Explore')}>
              <View style={styles.navIconCircle}>
                <ExploreNavIcon />
              </View>
              <Text style={styles.navLabel}>Explore</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Matches')}>
              <View style={styles.navIconCircle}>
                <LikesNavIcon />
              </View>
              <Text style={styles.navLabel}>Likes</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Matches')}>
              <View style={styles.navIconCircle}>
                <MessagesNavIcon />
              </View>
              <Text style={styles.navLabel}>Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('MyProfile')}>
              <View style={styles.navIconCircle}>
                <ProfileNavIcon />
              </View>
              <Text style={styles.navLabel}>Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  topBar: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  shareButton: {
    padding: 0,
  },
  shareIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    backdropFilter: 'blur(10px)',
  },
  shareIcon: {
    fontSize: 20,
    color: '#FFFFFF',
    transform: [{ rotate: '-45deg' }],
  },
  carousel: {
    flex: 1,
  },
  cardContainer: {
    width: width,
    height: height - 100,
    position: 'relative',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderImage: {
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 18,
    color: '#666666',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 280,
    backgroundColor: 'transparent',
    background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)',
  },
  profileInfo: {
    position: 'absolute',
    bottom: 160,
    left: 20,
    right: 20,
  },
  profileName: {
    fontSize: 34,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  profileAge: {
    fontSize: 30,
    fontWeight: '400',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  profileLocation: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  actionButtonsRow: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  roundActionButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  passButton: {
  },
  likeButton: {
  },
  messageButton: {
  },
  infoButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoButtonIcon: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#FFFFFF',
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#1A1A1A',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#999999',
    marginBottom: 24,
    textAlign: 'center',
  },
  exploreButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    backgroundColor: '#FF6B6B',
  },
  exploreButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  bottomNavContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 32,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
  },
  navIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
    position: 'relative',
  },
  navIconActive: {
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
  },
  navIconText: {
    fontSize: 18,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    zIndex: 1,
  },
  badgeText: {
    fontSize: 11,
    color: '#1A1A1A',
    fontWeight: '700',
  },
  navLabel: {
    fontSize: 10,
    color: '#999999',
    fontWeight: '500',
    marginTop: 2,
  },
  navLabelActive: {
    color: '#FF6B6B',
    fontWeight: '700',
  },
});