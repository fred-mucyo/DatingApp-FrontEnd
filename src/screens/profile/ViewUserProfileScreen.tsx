import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView,
  Alert,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  Modal,
  Share,
} from 'react-native';
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
  relationship_goal?: string | null;
  gender_preference?: string | null;
  created_at?: string | null;
  interests?: string[] | null;
}

export const ViewUserProfileScreen: React.FC<ViewUserProfileScreenProps> = ({ route, navigation }) => {
  const { userId } = route.params;
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ViewProfile | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [hasMatch, setHasMatch] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [likeMatchModalVisible, setLikeMatchModalVisible] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [myInterests, setMyInterests] = useState<string[]>([]);
  const scrollRef = useRef<ScrollView | null>(null);

  const screenWidth = Dimensions.get('window').width;

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, name, age, city, country, bio, photos, relationship_goal, gender_preference, created_at, interests')
          .eq('id', userId)
          .maybeSingle();

        if (error) {
          Alert.alert('Error', error.message);
          return;
        }

        setProfile((data as ViewProfile) ?? null);

        if (user && user.id !== userId) {
          try {
            const match = await verifyMatchExists(user.id, userId);
            setHasMatch(!!match);
          } catch {
            // ignore match check errors for UI
          }
          try {
            const { data: me, error: meErr } = await supabase
              .from('profiles')
              .select('interests')
              .eq('id', user.id)
              .maybeSingle();
            if (!meErr && me && Array.isArray((me as any).interests)) {
              setMyInterests(((me as any).interests as string[]).filter(Boolean));
            }
          } catch {
            // ignore own interests loading errors
          }
        }
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
  const photos = profile.photos && profile.photos.length > 0 ? profile.photos : mainPhoto ? [mainPhoto] : [];

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
          setHasMatch(true);
          setLikeMatchModalVisible(true);
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

  const handleShareProfile = async () => {
    if (!profile) return;
    try {
      const name = profile.name ?? 'shuu user';
      const username = profile.username ? `@${profile.username}` : '';
      await Share.share({
        message: `Check out ${name} ${username} on shuu.`.trim(),
      });
    } catch {
      // ignore share errors
    }
  };

  const handleOpenChatFromModal = async () => {
    if (!user) return;
    try {
      const match = await verifyMatchExists(user.id, userId);
      if (!match) {
        setLikeMatchModalVisible(false);
        Alert.alert('No match found', 'Please try again.');
        return;
      }

      setLikeMatchModalVisible(false);
      navigation.navigate('Chat', {
        matchId: match.id,
        otherUserId: match.other_user_id,
        otherUserName: match.other_user_name,
        otherUserPhoto: match.other_user_photo ?? undefined,
      });
    } catch (e: any) {
      setLikeMatchModalVisible(false);
      Alert.alert('Error', e?.message ?? 'Failed to open chat');
    }
  };

  const handlePhotoScroll = (event: any) => {
    const x = event.nativeEvent.contentOffset.x;
    const index = Math.round(x / screenWidth);
    if (index !== currentPhotoIndex) {
      setCurrentPhotoIndex(index);
    }
  };

  const relationshipGoalLabel = (() => {
    switch (profile.relationship_goal) {
      case 'serious':
        return 'Serious relationship';
      case 'casual':
        return 'Casual dating';
      case 'both':
        return 'Open to both';
      default:
        return 'Not specified';
    }
  })();

  const genderPreferenceLabel = (() => {
    switch (profile.gender_preference) {
      case 'male':
        return 'Men';
      case 'female':
        return 'Women';
      case 'other':
        return 'Other genders';
      case 'all':
        return 'Everyone';
      default:
        return 'Not specified';
    }
  })();

  const memberSinceLabel = profile.created_at
    ? new Date(profile.created_at).toLocaleString(undefined, {
        month: 'short',
        year: 'numeric',
      })
    : 'Recently';

  const displayName = profile.name ?? 'Someone';
  const usernameLabel = profile.username ? `@${profile.username}` : undefined;
  const locationLabel = profile.city && profile.country ? `${profile.city}, ${profile.country}` : undefined;
  const interests = profile.interests && profile.interests.length > 0 ? profile.interests.slice(0, 10) : [];
  const sharedInterests =
    profile.interests && myInterests.length > 0
      ? profile.interests.filter((i) => myInterests.includes(i)).slice(0, 6)
      : [];

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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.root}>
        <View style={styles.photoContainer}>
          {photos.length > 0 ? (
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handlePhotoScroll}
            >
              {photos.map((uri, index) => (
                <View key={uri + index} style={{ width: screenWidth }}>
                  <Image source={{ uri }} style={styles.mainPhoto} />
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderText}>No photos yet</Text>
            </View>
          )}

          <View style={styles.topOverlayGradient} />

          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.topBarButton}
              activeOpacity={0.8}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.topBarIcon}>←</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.topBarButton}
              activeOpacity={0.8}
              onPress={() => setMenuVisible(true)}
            >
              <Text style={styles.topBarIcon}>⋯</Text>
            </TouchableOpacity>
          </View>

          {photos.length > 1 && (
            <View style={styles.paginationPill}>
              {photos.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.paginationDot,
                    index === currentPhotoIndex && styles.paginationDotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentCard}>
            <View style={styles.basicHeaderRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.nameText}>
                    {displayName}
                    {profile.age ? `, ${profile.age}` : ''}
                  </Text>
                </View>
                {usernameLabel && <Text style={styles.usernameText}>{usernameLabel}</Text>}
                {locationLabel && (
                  <View style={styles.locationRow}>
                    <Text style={styles.locationIcon}>📍</Text>
                    <Text style={styles.locationText}>{locationLabel}</Text>
                  </View>
                )}
                <Text style={styles.statusText}>Active recently</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statIcon}>💕</Text>
                <Text style={styles.statLabel}>Looking for</Text>
                <Text style={styles.statValue}>{relationshipGoalLabel}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statIcon}>❤️</Text>
                <Text style={styles.statLabel}>Interested in</Text>
                <Text style={styles.statValue}>{genderPreferenceLabel}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statIcon}>📅</Text>
                <Text style={styles.statLabel}>Member since</Text>
                <Text style={styles.statValue}>{memberSinceLabel}</Text>
              </View>
            </View>

            {profile.bio ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>About {displayName}</Text>
                <Text
                  style={styles.sectionBody}
                  numberOfLines={bioExpanded ? undefined : 4}
                >
                  {profile.bio}
                </Text>
                {profile.bio.length > 160 && (
                  <TouchableOpacity
                    onPress={() => setBioExpanded((prev) => !prev)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.readMoreText}>{bioExpanded ? 'Show less' : 'Read more'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}

            {hasMatch && sharedInterests.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sharedCard}>
                  <Text style={styles.sharedIcon}>✨</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sharedTitle}>You both like</Text>
                    <View style={styles.sharedChipsWrap}>
                      {sharedInterests.map((interest) => (
                        <View key={interest} style={styles.sharedChip}>
                          <Text style={styles.sharedChipText}>{interest}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </View>
            )}

            {interests.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Interests</Text>
                <View style={styles.interestsWrap}>
                  {interests.map((interest) => (
                    <View key={interest} style={styles.interestChip}>
                      <Text style={styles.interestText}>{interest}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {locationLabel && (
              <View style={styles.section}>
                <View style={styles.distanceCard}>
                  <Text style={styles.distanceIcon}>📍</Text>
                  <Text style={styles.distanceText}>Near {locationLabel}</Text>
                </View>
              </View>
            )}

            <View style={styles.section}>
              <TouchableOpacity
                style={styles.safetyHeaderRow}
                activeOpacity={0.8}
              >
                <Text style={styles.sectionTitle}>Safety tips</Text>
                <Text style={styles.safetyInfoIcon}>ℹ️</Text>
              </TouchableOpacity>
              <View style={styles.safetyCard}>
                <View style={styles.safetyTipRow}>
                  <Text style={styles.safetyBullet}>✓</Text>
                  <Text style={styles.safetyTipText}>Meet in public places</Text>
                </View>
                <View style={styles.safetyTipRow}>
                  <Text style={styles.safetyBullet}>✓</Text>
                  <Text style={styles.safetyTipText}>Tell a friend your plans</Text>
                </View>
                <View style={styles.safetyTipRow}>
                  <Text style={styles.safetyBullet}>✓</Text>
                  <Text style={styles.safetyTipText}>Trust your instincts</Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          {hasMatch ? (
            <TouchableOpacity
              style={[styles.primaryButton, styles.fullWidthButton]}
              activeOpacity={0.9}
              onPress={handleStartChat}
              disabled={actionLoading}
            >
              <Text style={styles.primaryButtonText}>💬 Send message</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.bottomButtonsRow}>
              <TouchableOpacity
                style={styles.passButton}
                activeOpacity={0.9}
                onPress={() => navigation.goBack()}
                disabled={actionLoading}
              >
                <Text style={styles.passButtonText}>✕ Pass</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryButton}
                activeOpacity={0.9}
                onPress={handleLike}
                disabled={actionLoading}
              >
                <Text style={styles.primaryButtonText}>❤️ Like</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Modal
          visible={menuVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setMenuVisible(false)}
        >
          <TouchableOpacity
            style={styles.menuBackdrop}
            activeOpacity={1}
            onPress={() => setMenuVisible(false)}
          >
            <View style={styles.menuSheet}>
              <TouchableOpacity style={styles.menuItem} activeOpacity={0.8}>
                <Text style={styles.menuItemText}>🚩 Report user</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} activeOpacity={0.8}>
                <Text style={styles.menuItemText}>⛔ Block user</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                activeOpacity={0.8}
                onPress={handleShareProfile}
              >
                <Text style={styles.menuItemText}>📤 Share profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.menuItem, styles.menuCancelItem]}
                activeOpacity={0.8}
                onPress={() => setMenuVisible(false)}
              >
                <Text style={styles.menuCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal
          visible={likeMatchModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setLikeMatchModalVisible(false)}
        >
          <View style={styles.matchModalBackdrop}>
            <View style={styles.matchModalCard}>
              <Text style={styles.matchTitle}>It&apos;s a match!</Text>
              <Text style={styles.matchSubtitle}>
                You and {displayName} like each other.
              </Text>
              <View style={styles.matchButtonsRow}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  activeOpacity={0.9}
                  onPress={() => setLikeMatchModalVisible(false)}
                >
                  <Text style={styles.secondaryButtonText}>Keep swiping</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primaryButton}
                  activeOpacity={0.9}
                  onPress={handleOpenChatFromModal}
                >
                  <Text style={styles.primaryButtonText}>Send message</Text>
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
    backgroundColor: '#020617',
  },
  root: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
  photoContainer: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: '#020617',
    position: 'relative',
  },
  mainPhoto: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1F2933',
  },
  photoPlaceholderText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  topOverlayGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  topBar: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarIcon: {
    color: '#F9FAFB',
    fontSize: 20,
  },
  paginationPill: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(249, 250, 251, 0.7)',
    backgroundColor: 'transparent',
    marginHorizontal: 3,
  },
  paginationDotActive: {
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingTop: 16,
    paddingBottom: 120,
  },
  contentCard: {
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    marginTop: -32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
  },
  basicHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
  },
  usernameText: {
    marginTop: 4,
    fontSize: 15,
    color: '#6B7280',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  locationIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  locationText: {
    fontSize: 15,
    color: '#4B5563',
  },
  statusText: {
    marginTop: 4,
    fontSize: 13,
    color: '#9CA3AF',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
    justifyContent: 'space-between',
  },
  statIcon: {
    fontSize: 16,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 13,
    color: '#111827',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  sectionBody: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1F2933',
  },
  readMoreText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#F97316',
  },
  interestsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  interestChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(248, 113, 113, 0.08)',
    marginRight: 8,
    marginBottom: 8,
  },
  interestText: {
    fontSize: 13,
    color: '#EA580C',
  },
  sharedCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  sharedIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  sharedTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#065F46',
    marginBottom: 6,
  },
  sharedChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  sharedChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#059669',
    marginRight: 6,
    marginBottom: 6,
  },
  sharedChipText: {
    fontSize: 12,
    color: '#ECFDF5',
  },
  distanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  distanceIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  distanceText: {
    fontSize: 14,
    color: '#4B5563',
  },
  safetyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  safetyInfoIcon: {
    fontSize: 16,
  },
  safetyCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    padding: 12,
  },
  safetyTipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  safetyBullet: {
    fontSize: 14,
    color: '#10B981',
    marginRight: 8,
  },
  safetyTipText: {
    fontSize: 13,
    color: '#4B5563',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 10,
  },
  bottomButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  passButton: {
    flexBasis: '30%',
    height: 52,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#F97373',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  passButtonText: {
    fontSize: 16,
    color: '#EF4444',
    fontWeight: '600',
  },
  primaryButton: {
    flexBasis: '65%',
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F97316',
  },
  fullWidthButton: {
    flexBasis: '100%',
  },
  primaryButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
  },
  menuItem: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  menuItemText: {
    fontSize: 16,
    color: '#111827',
  },
  menuCancelItem: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  menuCancelText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  matchModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  matchModalCard: {
    width: '100%',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },
  matchTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  matchSubtitle: {
    fontSize: 15,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 20,
  },
  matchButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
  },
  secondaryButton: {
    flexBasis: '48%',
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
});
