import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Platform,
  Modal,
  TextInput,
  Animated,
  Easing,
  AppState,
  AppStateStatus,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { registerForPushNotificationsAsync } from '../../services/notifications';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { getDailySuggestions, SuggestionProfile, sendLike, markProfilePassed } from '../../services/matching';
import { verifyMatchExists, hasSentPreMatchMessage, sendPreMatchMessage, fetchMatchesWithLastMessage } from '../../services/chat';
import { fetchIncomingLikes } from '../../services/likes';
import { supabase } from '../../config/supabaseClient';
import { cacheService } from '../../services/cache';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const { width, height } = Dimensions.get('window');

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { user, profile } = useAuth();

  const LIKE_LIMIT_KEY = 'matching.likes_today';
  const LIKE_LIMIT = 50;
  const LAST_READ_KEY_PREFIX = 'last_read_';

  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [suggestions, setSuggestions] = useState<SuggestionProfile[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [liking, setLiking] = useState(false);
  const [likesToday, setLikesToday] = useState<{ date: string; count: number } | null>(null);
  const [locallyLikedIds, setLocallyLikedIds] = useState<string[]>([]);
  const [preMatchTarget, setPreMatchTarget] = useState<SuggestionProfile | null>(null);
  const [preMatchMessage, setPreMatchMessage] = useState('');
  const [preMatchSending, setPreMatchSending] = useState(false);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [newLikesCount, setNewLikesCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const greetingName = profile?.name || user?.email || 'there';

  // Shuffle array to rotate suggestions
  const shuffleArray = useCallback(<T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, []);

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
    if (!user) return;

    // Load cached suggestions immediately
    const cached = await cacheService.getSuggestions(user.id);
    const cachedIndex = await cacheService.getSuggestionIndex(user.id);
    
    if (cached && cached.length > 0) {
      // Rotate/shuffle suggestions for variety
      const shuffled = shuffleArray(cached);
      setSuggestions(shuffled);
      
      // Resume from last viewed index or random position
      const startIndex = cachedIndex !== null && cachedIndex < shuffled.length 
        ? cachedIndex 
        : Math.floor(Math.random() * Math.min(5, shuffled.length));
      setSuggestionIndex(startIndex);
      setLoadingSuggestions(false); // Show cached data immediately
    } else {
      setLoadingSuggestions(true);
    }

    try {
      // Load fresh suggestions in background
      const data = await getDailySuggestions(5, 20);
      
      // If RPC didn't include photos, enrich from profiles table (in batches for performance)
      const batchSize = 5;
      const enriched: SuggestionProfile[] = [];
      
      for (let i = 0; i < (data ?? []).length; i += batchSize) {
        const batch = (data ?? []).slice(i, i + batchSize);
        const enrichedBatch = await Promise.all(
          batch.map(async (p) => {
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
        enriched.push(...enrichedBatch);
      }
      
      // Rotate/shuffle for variety
      const shuffled = shuffleArray(enriched);
      setSuggestions(shuffled);
      await cacheService.setSuggestions(user.id, shuffled);
      
      // Set starting index (resume from last or random)
      const lastIndex = await cacheService.getSuggestionIndex(user.id);
      const startIndex = lastIndex !== null && lastIndex < shuffled.length 
        ? lastIndex 
        : Math.floor(Math.random() * Math.min(5, shuffled.length));
      setSuggestionIndex(startIndex);
      await cacheService.setSuggestionIndex(user.id, startIndex);
      
      setLocallyLikedIds([]);
    } catch (e: any) {
      console.log('HOME getDailySuggestions error:', e);
      if (!cached) {
        Alert.alert('Error', e?.message ?? 'Failed to load suggestions');
      }
    } finally {
      setLoadingSuggestions(false);
    }
  }, [user, shuffleArray]);

  useEffect(() => {
    if (!user) return;

    // Register for push notifications once a user is available
    registerForPushNotificationsAsync().catch(() => {});

    // Load immediately on mount
    const loadCached = async () => {
      await loadLikesToday();
      
      // Load cached suggestions immediately
      const cached = await cacheService.getSuggestions(user.id);
      const cachedIndex = await cacheService.getSuggestionIndex(user.id);
      
      if (cached && cached.length > 0) {
        const shuffled = shuffleArray(cached);
        setSuggestions(shuffled);
        const startIndex = cachedIndex !== null && cachedIndex < shuffled.length 
          ? cachedIndex 
          : Math.floor(Math.random() * Math.min(5, shuffled.length));
        setSuggestionIndex(startIndex);
        setLoadingSuggestions(false);
      }
      
      // Then load fresh data in background
      loadSuggestions();
    };
    
    loadCached();
  }, [user, loadLikesToday, loadSuggestions, shuffleArray]);

  // ---- Badge counts for bottom navigation ----

  const loadUnreadMessagesCount = useCallback(async () => {
    if (!user) {
      setUnreadMessagesCount(0);
      return;
    }
    try {
      const matches = await fetchMatchesWithLastMessage(user.id);
      let unread = 0;
      for (const m of matches) {
        // Only count if there's a last message AND it's from the other user (not you)
        const lastMessageFromOther = m.last_message_sender_id && m.last_message_sender_id !== user.id;
        
        if (lastMessageFromOther && m.last_message_created_at) {
          const lastKey = `${LAST_READ_KEY_PREFIX}${m.id}`;
          const lastRead = await AsyncStorage.getItem(lastKey);
          
          // Only count as unread if last message is from other user and hasn't been read
          if (!lastRead || new Date(lastRead) < new Date(m.last_message_created_at)) {
            unread += 1;
          }
        }
      }
      setUnreadMessagesCount(unread);
    } catch {
      // Soft-fail: don't block UI if badge count fails
    }
  }, [LAST_READ_KEY_PREFIX, user]);

  const loadNewLikesCount = useCallback(async () => {
    if (!user) {
      setNewLikesCount(0);
      return;
    }
    try {
      const incoming = await fetchIncomingLikes(user.id);
      setNewLikesCount(incoming.length);
    } catch {
      // Soft-fail
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadUnreadMessagesCount();
    loadNewLikesCount();
  }, [user?.id, loadUnreadMessagesCount, loadNewLikesCount]);

  // Auto-refresh badge counts every 30 seconds
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => {
      loadUnreadMessagesCount();
      loadNewLikesCount();
    }, 30000);

    return () => clearInterval(id);
  }, [user?.id, loadUnreadMessagesCount, loadNewLikesCount]);

  // Refresh when app returns to foreground
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active' && user) {
        loadUnreadMessagesCount();
        loadNewLikesCount();
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      sub.remove();
    };
  }, [user, loadUnreadMessagesCount, loadNewLikesCount]);

  const handlePullToRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([
        loadSuggestions(),
        loadLikesToday(),
        loadUnreadMessagesCount(),
        loadNewLikesCount(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, loadSuggestions, loadLikesToday, loadUnreadMessagesCount, loadNewLikesCount]);

  const visibleSuggestions = suggestions.slice(suggestionIndex, suggestionIndex + 5);

  const handlePass = async (profileToPass?: SuggestionProfile) => {
    // Marking a profile as passed is intentionally simple and local.
    if (profileToPass) {
      try {
        await markProfilePassed(profileToPass.id);
      } catch {
        // If this fails, we still advance locally; it's not critical.
      }
    }

    if (suggestionIndex + 1 >= suggestions.length) {
      Alert.alert('End of feed', 'Come back tomorrow for new suggestions.');
    } else {
      const newIndex = suggestionIndex + 1;
      setSuggestionIndex(newIndex);
      // Save current index for rotation
      if (user) {
        await cacheService.setSuggestionIndex(user.id, newIndex);
      }
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

      setLocallyLikedIds((prev) =>
        prev.includes(profileToLike.id) ? prev : [...prev, profileToLike.id],
      );

      if (isMatch) {
        Alert.alert("It's a match!", `You and ${profileToLike.name} like each other.`);
      }
      // After a like we advance, similar to a pass
      const newIndex = suggestionIndex + 1;
      setSuggestionIndex(newIndex);
      if (user) {
        await cacheService.setSuggestionIndex(user.id, newIndex);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to send like');
    } finally {
      setLiking(false);
    }
  };

  const handleShare = async () => {
    try {
      const url = 'https://hashye.online/mutima-info';
      await Share.share({
        message: `Check out this amazing dating app! Download now and find your match\n\nLearn more: ${url}`,
        title: 'Mutima',
      });
    } catch (error) {
      console.log('Error sharing:', error);
    }
  };

  const handleMessage = async (profileId: string) => {
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to send messages.');
      return;
    }

    // Navigate immediately, check match in background
    const target = suggestions.find((p) => p.id === profileId) ?? null;
    if (!target) {
      Alert.alert('Error', 'Could not open message composer for this profile.');
      return;
    }

    try {
      const match = await verifyMatchExists(user.id, profileId);
      if (match) {
        navigation.navigate('Chat', {
          matchId: match.id,
          otherUserId: match.other_user_id,
          otherUserName: match.other_user_name,
          otherUserPhoto: match.other_user_photo ?? undefined,
        });
        return;
      }

      const alreadySent = await hasSentPreMatchMessage(user.id, profileId);
      if (alreadySent) {
        Alert.alert(
          'Message sent',
          'You already sent a message to this person. You can chat freely once you match.',
        );
        return;
      }

      setPreMatchTarget(target);
      setPreMatchMessage('');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to open message composer');
    }
  };

  const handleSendPreMatch = async () => {
    if (!user) return;
    if (!preMatchTarget) return;

    const message = (preMatchMessage ?? '').trim();
    if (!message) {
      Alert.alert('Message required', 'Please enter a message before sending.');
      return;
    }

    setPreMatchSending(true);
    try {
      await sendPreMatchMessage(user.id, preMatchTarget.id, message);
      Alert.alert(
        'Message sent',
        `Your message was sent to ${preMatchTarget.name ?? 'this person'}. You can continue the conversation once you both match.`,
      );
      setPreMatchTarget(null);
      setPreMatchMessage('');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to send message');
    } finally {
      setPreMatchSending(false);
    }
  };

  const Badge: React.FC<{ count: number; color: string; accessibilityLabel: string }> = ({
    count,
    color,
    accessibilityLabel,
  }) => {
    const display = count > 9 ? '9+' : String(count);
    const scale = useRef(new Animated.Value(1)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const glow = useRef(new Animated.Value(0)).current;
    const prevCountRef = useRef<number>(0);

    useEffect(() => {
      const prev = prevCountRef.current;
      prevCountRef.current = count;

      if (count > 0) {
        const isIncrease = count > prev;

        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: false,
          }),
          Animated.sequence([
            Animated.timing(scale, {
              toValue: isIncrease ? 1.3 : 1.15,
              duration: 140,
              easing: Easing.out(Easing.ease),
              useNativeDriver: false,
            }),
            Animated.timing(scale, {
              toValue: 1,
              duration: 90,
              easing: Easing.in(Easing.ease),
              useNativeDriver: false,
            }),
          ]),
          Animated.sequence([
            Animated.timing(glow, {
              toValue: 1,
              duration: 150,
              useNativeDriver: false,
            }),
            Animated.timing(glow, {
              toValue: 0,
              duration: 250,
              useNativeDriver: false,
            }),
          ]),
        ]).start();
      } else {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: false,
        }).start();
      }
    }, [count, opacity, scale, glow]);

    if (count <= 0) return null;

    return (
      <Animated.View
        accessible
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.badge,
          {
            backgroundColor: color,
            opacity,
            shadowOpacity: glow.interpolate({
              inputRange: [0, 1],
              outputRange: [0.3, 0.7],
            }),
            transform: [
              {
                scale: scale.interpolate({
                  inputRange: [0.8, 1.2],
                  outputRange: [0.8, 1.2],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.badgeText}>{display}</Text>
      </Animated.View>
    );
  };

  // Icons
  const PassIcon = () => (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 6l12 12M18 6L6 18"
        stroke="#FFFFFF"
        strokeWidth={3}
        strokeLinecap="round"
      />
    </Svg>
  );

  const LikeIcon = () => (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12.001 5.5c-1.54-1.67-4.04-1.67-5.58 0-1.5 1.63-1.5 4.27 0 5.9l4.47 4.85a1 1 0 0 0 1.46 0l4.47-4.85c1.5-1.63 1.5-4.27 0-5.9-1.54-1.67-4.04-1.67-5.58 0Z"
        fill="#FFFFFF"
      />
    </Svg>
  );

  const MessageIcon = () => (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );

  const ShareIcon = () => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={18} cy={5} r={3} stroke="#1A1A1A" strokeWidth={2} />
      <Circle cx={6} cy={12} r={3} stroke="#1A1A1A" strokeWidth={2} />
      <Circle cx={18} cy={19} r={3} stroke="#1A1A1A" strokeWidth={2} />
      <Path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" stroke="#1A1A1A" strokeWidth={2} />
    </Svg>
  );

  const InfoIcon = () => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke="#1A1A1A" strokeWidth={2} />
      <Path d="M12 16v-4M12 8h.01" stroke="#1A1A1A" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );

  const LocationIcon = () => (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3a6 6 0 0 0-6 6c0 4.2 4.5 8.7 5.6 9.8a.6.6 0 0 0 .8 0C13.5 17.7 18 13.2 18 9a6 6 0 0 0-6-6Z"
        fill="#1A1A1A"
      />
      <Circle cx={12} cy={9} r={2} fill="#FFFFFF" />
    </Svg>
  );

  const HomeNavIcon = () => (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
        fill="#D4AF37"
        stroke="#D4AF37"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M9 22V12h6v10" stroke="#FFFFFF" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );

  const LikesNavIcon = () => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12.001 5.5c-1.54-1.67-4.04-1.67-5.58 0-1.5 1.63-1.5 4.27 0 5.9l4.47 4.85a1 1 0 0 0 1.46 0l4.47-4.85c1.5-1.63 1.5-4.27 0-5.9-1.54-1.67-4.04-1.67-5.58 0Z"
        fill="#FFFFFF"
      />
    </Svg>
  );

  const ExploreNavIcon = () => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke="#FFFFFF" strokeWidth={2} />
      <Path
        d="M10 14l1.2-3.8L15 9l-1.2 3.8L10 14Z"
        fill="#FFFFFF"
      />
    </Svg>
  );

  const ProfileNavIcon = () => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8.5} r={3.5} stroke="#FFFFFF" strokeWidth={2} />
      <Path
        d="M6 19c.8-2.4 3.1-4 6-4s5.2 1.6 6 4"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );

  const MessagesNavIcon = () => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );

  const getRelationshipGoalLabel = (goal: string | null | undefined): string => {
    if (!goal) return '';
    const goalMap: Record<string, string> = {
      serious: 'Serious',
      casual: 'Casual',
      both: 'Open',
    };
    return goalMap[goal.toLowerCase()] || goal.charAt(0).toUpperCase() + goal.slice(1);
  };

  const renderSuggestionItem = ({ item }: { item: SuggestionProfile }) => {
    const alreadyLiked = locallyLikedIds.includes(item.id);
    const anyItem: any = item as any;
    const rawProfilePhotos = anyItem.profile_photos;
    const rawPhotos = anyItem.photos;

    const photos: string[] = [];

    if (Array.isArray(rawProfilePhotos) && rawProfilePhotos.length > 0) {
      photos.push(...rawProfilePhotos.filter((p: any) => typeof p === 'string'));
    } else if (typeof rawProfilePhotos === 'string' && rawProfilePhotos) {
      photos.push(rawProfilePhotos);
    }

    if (photos.length === 0) {
      if (Array.isArray(rawPhotos) && rawPhotos.length > 0) {
        photos.push(...rawPhotos.filter((p: any) => typeof p === 'string'));
      } else if (typeof rawPhotos === 'string' && rawPhotos) {
        photos.push(rawPhotos);
      }
    }

    const primaryPhoto = photos.length > 0 ? photos[0] : null;
    const interests = Array.isArray(item.interests) ? item.interests.filter(Boolean) : [];
    const relationshipGoal = getRelationshipGoalLabel(item.relationship_goal);

    return (
      <View style={styles.cardWrapper}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
            {/* Photo Container */}
            <View style={styles.photoContainer}>
              {primaryPhoto ? (
                <View style={styles.imageWrapper}>
                  <Image source={{ uri: primaryPhoto }} style={styles.profilePhoto} resizeMode="cover" />
                </View>
              ) : (
                <View style={[styles.profilePhoto, styles.photoPlaceholder]}>
                  <Text style={styles.photoPlaceholderText}>No Photo</Text>
                </View>
              )}
              
              {/* Info Button (top-left) */}
              <TouchableOpacity
                style={styles.photoInfoButton}
                onPress={() => navigation.navigate('ViewUserProfile', { userId: item.id })}
              >
                <InfoIcon />
              </TouchableOpacity>

              {/* Share Button (top-right) */}
              <TouchableOpacity
                style={styles.photoShareButton}
                onPress={handleShare}
              >
                <ShareIcon />
              </TouchableOpacity>
            </View>

            {/* Profile Info */}
            <View style={styles.profileInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.profileName}>
                  {item.name}, {item.age}
                </Text>
                {relationshipGoal && (
                  <View style={styles.intentBadge}>
                    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" style={styles.intentBadgeIcon}>
                      <Path
                        d="M12.001 5.5c-1.54-1.67-4.04-1.67-5.58 0-1.5 1.63-1.5 4.27 0 5.9l4.47 4.85a1 1 0 0 0 1.46 0l4.47-4.85c1.5-1.63 1.5-4.27 0-5.9-1.54-1.67-4.04-1.67-5.58 0Z"
                        fill="#FFFFFF"
                      />
                    </Svg>
                    <Text style={styles.intentBadgeText}>{relationshipGoal}</Text>
                  </View>
                )}
              </View>

              <View style={styles.locationRow}>
                <LocationIcon />
                <Text style={styles.locationText}>
                  {item.city} / {item.country}
                </Text>
              </View>

              {item.bio && (
                <Text style={styles.bioText}>{item.bio}</Text>
              )}

              {interests.length > 0 && (
                <View style={styles.interestsContainer}>
                  {interests.slice(0, 4).map((interest, index) => (
                    <View key={index} style={styles.interestTag}>
                      <Text style={styles.interestTagText}>{interest}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.passButton]}
            onPress={() => handlePass(item)}
            disabled={liking}
          >
            <PassIcon />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.messageButton]}
            onPress={() => handleMessage(item.id)}
          >
            <MessageIcon />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.likeButton]}
            onPress={() => handleLike(item)}
            disabled={liking || alreadyLiked}
          >
            {liking ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : alreadyLiked ? (
              <Text style={styles.likedLabel}>Liked</Text>
            ) : (
              <LikeIcon />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.safeArea}>
      <View style={styles.container}>
        {loadingSuggestions ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#F97316" />
            <Text style={styles.loadingText}>Loading suggestions...</Text>
          </View>
        ) : suggestions.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyIcon}>💫</Text>
            <Text style={styles.emptyTitle}>You're All Caught Up!</Text>
            <Text style={styles.emptySubtitle}>
              Check back tomorrow for fresh connections
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
            contentContainerStyle={styles.carouselContent}
          />
        )}

        {/* Bottom Navigation Bar */}
        <View style={styles.bottomNavContainer}>
          <View style={styles.bottomNav}>
            <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
              <View style={styles.navIconCircle}>
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

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => {
                setNewLikesCount(0);
                navigation.navigate('Likes');
              }}
            >
              <View style={styles.navIconCircle}>
                <LikesNavIcon />
                <Badge
                  count={newLikesCount}
                  color="#EC4899"
                  accessibilityLabel={`${newLikesCount} new likes`}
                />
              </View>
              <Text style={styles.navLabel}>Likes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => {
                setUnreadMessagesCount(0);
                navigation.navigate('Matches');
              }}
            >
              <View style={styles.navIconCircle}>
                <MessagesNavIcon />
                <Badge
                  count={unreadMessagesCount}
                  color="#EF4444"
                  accessibilityLabel={`${unreadMessagesCount} unread messages`}
                />
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

        {/* Pre-match message composer modal */}
        <Modal
          transparent
          animationType="slide"
          visible={!!preMatchTarget}
          onRequestClose={() => {
            if (!preMatchSending) {
              setPreMatchTarget(null);
              setPreMatchMessage('');
            }
          }}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                Message {preMatchTarget?.name ?? 'this person'}
              </Text>
              <Text style={styles.modalSubtitle}>
                You can send one message before you match. Make it count.
              </Text>
              <TextInput
                style={styles.modalInput}
                multiline
                placeholder="Say hi..."
                placeholderTextColor="#9CA3AF"
                value={preMatchMessage}
                onChangeText={(text) => {
                  if (text.length <= 500) setPreMatchMessage(text);
                }}
              />
              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={() => {
                    if (preMatchSending) return;
                    setPreMatchTarget(null);
                    setPreMatchMessage('');
                  }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalSendButton]}
                  onPress={handleSendPreMatch}
                  disabled={preMatchSending}
                >
                  <Text style={styles.modalSendText}>{preMatchSending ? 'Sending…' : 'Send'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </View>
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
  skeletonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    gap: 16,
  },
  skeletonCard: {
    width: 220,
    height: 340,
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 16,
  },
  skeletonPhoto: {
    width: '100%',
    height: 200,
    backgroundColor: '#1F2937',
    borderRadius: 16,
    marginBottom: 18,
  },
  skeletonTextRow: {
    width: '70%',
    height: 18,
    backgroundColor: '#374151',
    borderRadius: 8,
    marginBottom: 10,
  },
  skeletonTextRowShort: {
    width: '45%',
    height: 14,
    backgroundColor: '#374151',
    borderRadius: 8,
  },
  carousel: {
    flex: 1,
  },
  carouselContent: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 0,
  },
  cardWrapper: {
    width: width,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 0,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C97A5F',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
    width: '100%',
    maxHeight: height * 0.78,
  },
  photoContainer: {
    width: '100%',
    height: height * 0.48,
    position: 'relative',
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
  },
  imageWrapper: {
    width: '100%',
    height: '120%',
    position: 'absolute',
    left: 0,
    overflow: 'hidden',
  },
  profilePhoto: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    fontSize: 16,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  photoInfoButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  photoShareButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  profileInfo: {
    padding: 16,
    paddingBottom: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 8,
  },
  profileName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  intentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  intentBadgeIcon: {
    width: 12,
    height: 12,
  },
  intentBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  locationText: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  bioText: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 18,
    marginBottom: 10,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  interestTag: {
    backgroundColor: '#F5F5DC',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  interestTagText: {
    fontSize: 12,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    marginTop: 16,
    marginBottom: 16,
  },
  actionButton: {
    width: 50,
    height: 50,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 70,
  },
  passButton: {
    backgroundColor: '#9CA3AF',
  },
  messageButton: {
    backgroundColor: '#6366F1',
  },
  likeButton: {
    backgroundColor: '#22C55E',
  },
  likedLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#1A1A1A',
    gap: 8,
  },
  emptyIcon: {
    fontSize: 72,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    marginBottom: 28,
    textAlign: 'center',
    letterSpacing: 0.2,
    fontWeight: '400',
  },
  exploreButton: {
    paddingHorizontal: 36,
    paddingVertical: 16,
    borderRadius: 28,
    backgroundColor: '#F97316',
    shadowColor: '#F97316',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
  exploreButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  bottomNavContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    // paddingTop: ,
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  bottomNav: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  navIconCircle: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  navLabel: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  navLabelActive: {
    color: '#D4AF37',
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1A1A1A',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
    paddingHorizontal: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  modalInput: {
    minHeight: 80,
    maxHeight: 160,
    borderRadius: 12,
    backgroundColor: '#1F2937',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  modalCancelButton: {
    backgroundColor: '#374151',
  },
  modalSendButton: {
    backgroundColor: '#F97316',
  },
  modalCancelText: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '500',
  },
  modalSendText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
