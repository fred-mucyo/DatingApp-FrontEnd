import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
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
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { getDailySuggestions, SuggestionProfile, sendLike, markProfilePassed } from '../../services/matching';
import { verifyMatchExists, hasSentPreMatchMessage, sendPreMatchMessage } from '../../services/chat';
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
  const [locallyLikedIds, setLocallyLikedIds] = useState<string[]>([]);
  const [preMatchTarget, setPreMatchTarget] = useState<SuggestionProfile | null>(null);
  const [preMatchMessage, setPreMatchMessage] = useState('');
  const [preMatchSending, setPreMatchSending] = useState(false);

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
      console.log('HOME suggestions length after enrich:', enriched.length);
      setLocallyLikedIds([]);
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

      setLocallyLikedIds((prev) =>
        prev.includes(profileToLike.id) ? prev : [...prev, profileToLike.id],
      );

      if (isMatch) {
        Alert.alert("It's a match!", `You and ${profileToLike.name} like each other.`);
      }
      // After a like we advance, similar to a pass; no extra tracking needed
      // because likes are already excluded in the simplified suggestion query.
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

  const handleMessage = async (profileId: string) => {
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to send messages.');
      return;
    }

    try {
      const match = await verifyMatchExists(user.id, profileId);
      if (!match) {
        const alreadySent = await hasSentPreMatchMessage(user.id, profileId);
        if (alreadySent) {
          Alert.alert(
            'Message sent',
            'You already sent a message to this person. You can chat freely once you match.',
          );
          return;
        }

        const target = suggestions.find((p) => p.id === profileId) ?? null;
        if (!target) {
          Alert.alert('Error', 'Could not open message composer for this profile.');
          return;
        }

        setPreMatchTarget(target);
        setPreMatchMessage('');
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
    }
  };

  const handleSendPreMatch = async () => {
    if (!user || !preMatchTarget) return;
    if (!preMatchMessage.trim()) {
      Alert.alert('Message required', 'Please write a short message first.');
      return;
    }

    setPreMatchSending(true);
    try {
      await sendPreMatchMessage(user.id, preMatchTarget.id, preMatchMessage);
      Alert.alert(
        'Message sent',
        `Your message was sent to ${preMatchTarget.name}. You can continue the conversation once you both match.`,
      );
      setPreMatchTarget(null);
      setPreMatchMessage('');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to send message');
    } finally {
      setPreMatchSending(false);
    }
  };

  const PassIcon = () => (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 6l12 12M18 6L6 18"
        stroke="#EF4444"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </Svg>
  );

  const LikeIcon = () => (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12.001 5.5c-1.54-1.67-4.04-1.67-5.58 0-1.5 1.63-1.5 4.27 0 5.9l4.47 4.85a1 1 0 0 0 1.46 0l4.47-4.85c1.5-1.63 1.5-4.27 0-5.9-1.54-1.67-4.04-1.67-5.58 0Z"
        fill="#22C55E"
      />
    </Svg>
  );

  const MessageIcon = () => (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
        stroke="#6366F1"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );

  const HomeNavIcon = () => (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
        fill="#F97316"
        stroke="#F97316"
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
        fill="#666666"
      />
    </Svg>
  );

  const ExploreNavIcon = () => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke="#666666" strokeWidth={2} />
      <Path
        d="M10 14l1.2-3.8L15 9l-1.2 3.8L10 14Z"
        fill="#666666"
      />
    </Svg>
  );

  const ProfileNavIcon = () => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8.5} r={3.5} stroke="#666666" strokeWidth={2} />
      <Path
        d="M6 19c.8-2.4 3.1-4 6-4s5.2 1.6 6 4"
        stroke="#666666"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );

  const MessagesNavIcon = () => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
        stroke="#666666"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );

  const LocationIcon = () => (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3a6 6 0 0 0-6 6c0 4.2 4.5 8.7 5.6 9.8a.6.6 0 0 0 .8 0C13.5 17.7 18 13.2 18 9a6 6 0 0 0-6-6Z"
        fill="#FFFFFF"
        opacity={0.9}
      />
      <Circle cx={12} cy={9} r={2} fill="#1A1A1A" />
    </Svg>
  );

  const ShareIcon = () => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={18} cy={5} r={3} stroke="#FFFFFF" strokeWidth={2} />
      <Circle cx={6} cy={12} r={3} stroke="#FFFFFF" strokeWidth={2} />
      <Circle cx={18} cy={19} r={3} stroke="#FFFFFF" strokeWidth={2} />
      <Path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" stroke="#FFFFFF" strokeWidth={2} />
    </Svg>
  );

  const InfoIcon = () => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke="#FFFFFF" strokeWidth={2} />
      <Path d="M12 16v-4M12 8h.01" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );

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

    if (photos.length === 0) {
      console.log('HOME renderSuggestionItem: no photo for item', {
        id: item.id,
        name: item.name,
        profile_photos: rawProfilePhotos,
        photos: rawPhotos,
      });
    } else {
      console.log('HOME renderSuggestionItem: using photos', {
        id: item.id,
        name: item.name,
        count: photos.length,
      });
    }

    return (
      <View style={styles.cardContainer}>
        {photos.length > 0 ? (
          // Local, lightweight photo swiping per profile using a ScrollView pager.
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.photoPager}
          >
            {photos.map((uri) => (
              <Image
                key={uri}
                source={{ uri }}
                style={styles.fullScreenImage}
                onError={(e) => {
                  console.log('HOME Image failed to load', {
                    id: item.id,
                    name: item.name,
                    photo: uri,
                    error: e.nativeEvent,
                  });
                }}
              />
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.fullScreenImage, styles.placeholderImage]}>
            <Text style={styles.placeholderText}>No Photo</Text>
          </View>
        )}
        
        {/* Bottom gradient overlay */}
<LinearGradient
  colors={['transparent', 'rgba(0, 0, 0, 7)', 'rgba(0, 0, 0, 6)']}
  locations={[0, 0.4, 1]}
  style={styles.bottomGradient}
/>

        {/* Profile info floating on image */}
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>
            {item.name}{' '}
            <Text style={styles.profileAge}>{item.age}</Text>
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
            onPress={() => handlePass(item)}
            disabled={liking}
          >
            <PassIcon />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.roundActionButton, styles.likeButton]}
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

          <TouchableOpacity
            style={[styles.roundActionButton, styles.messageButton]}
            onPress={() => handleMessage(item.id)}
          >
            <MessageIcon />
          </TouchableOpacity>
        </View>

        {/* Info button (top left) */}
        <TouchableOpacity style={styles.infoButton}>
          <InfoIcon />
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
            <ShareIcon />
          </TouchableOpacity>
        </View>

        {loadingSuggestions ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#F97316" />
            <Text style={styles.loadingText}>Finding your perfect match...</Text>
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

            <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Likes')}>
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
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 20,
    zIndex: 10,
  },
  shareButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    width: width,
    height: height - 100,
    resizeMode: 'cover',
  },
  photoPager: {
    width: width,
    height: height - 100,
  },
  placeholderImage: {
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 300,

  },
  profileInfo: {
    position: 'absolute',
    bottom: 170,
    left: 24,
    right: 24,
  },
  profileName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  profileAge: {
    fontSize: 28,
    fontWeight: '400',
    letterSpacing: -0.3,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profileLocation: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
    letterSpacing: 0.2,
    opacity: 0.95,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  actionButtonsRow: {
    position: 'absolute',
    bottom: 90,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 24,
  },
  roundActionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
    backgroundColor: '#FFFFFF',
  },
  passButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  likeButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  messageButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  infoButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    bottom: 20,
    left: 16,
    right: 16,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 30,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 10,
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
    color: '#666666',
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  navLabelActive: {
    color: '#F97316',
    fontWeight: '700',
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
