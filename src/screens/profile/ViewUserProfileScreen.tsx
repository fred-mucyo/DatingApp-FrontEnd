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
  const [myInterests, setMyInterests] = useState<string[]>([]);
  const scrollRef = useRef<ScrollView | null>(null);

  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

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
        <ActivityIndicator size="large" color="#F97316" />
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
        return 'Serious';
      case 'casual':
        return 'Casual';
      case 'both':
        return 'Both';
      default:
        return 'Open';
    }
  })();

  const genderPreferenceLabel = (() => {
    switch (profile.gender_preference) {
      case 'male':
        return 'Men';
      case 'female':
        return 'Women';
      case 'other':
        return 'Other';
      case 'all':
        return 'Everyone';
      default:
        return 'All';
    }
  })();

  const displayName = profile.name ?? 'Someone';
  const usernameLabel = profile.username ? `@${profile.username}` : undefined;
  const locationLabel = profile.city && profile.country ? `${profile.city}, ${profile.country}` : 'Location unknown';
  const interests = profile.interests && profile.interests.length > 0 ? profile.interests.slice(0, 6) : [];
  const sharedInterests =
    profile.interests && myInterests.length > 0
      ? profile.interests.filter((i) => myInterests.includes(i)).slice(0, 4)
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
        {/* Photo carousel with full screen coverage */}
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
                  {/* Bottom gradient for text readability */}
                  <View style={styles.bottomGradient} />
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderText}>No photos</Text>
              <View style={styles.bottomGradient} />
            </View>
          )}

          {/* Top bar */}
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

          {/* Photo pagination */}
          {photos.length > 1 && (
            <View style={styles.paginationContainer}>
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

          {/* Profile info overlay at bottom of photo */}
          <View style={styles.profileInfoOverlay}>
            <View style={styles.nameSection}>
              <View style={styles.nameRow}>
                <Text style={styles.nameText}>
                  {displayName}
                  {profile.age ? `, ${profile.age}` : ''}
                </Text>
              </View>
              {usernameLabel && <Text style={styles.usernameText}>{usernameLabel}</Text>}
              <View style={styles.locationRow}>
                <Text style={styles.locationIcon}>📍</Text>
                <Text style={styles.locationText}>{locationLabel}</Text>
              </View>
            </View>

            {/* Compact stats row */}
            <View style={styles.statsRowCompact}>
              <View style={styles.statItem}>
                <Text style={styles.statIcon}>💕</Text>
                <Text style={styles.statText}>{relationshipGoalLabel}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statIcon}>❤️</Text>
                <Text style={styles.statText}>{genderPreferenceLabel}</Text>
              </View>
            </View>

            {/* Bio section - condensed */}
            {profile.bio && (
              <View style={styles.bioSection}>
                <Text style={styles.bioText} numberOfLines={2}>
                  {profile.bio}
                </Text>
              </View>
            )}

            {/* Shared interests highlight */}
            {hasMatch && sharedInterests.length > 0 && (
              <View style={styles.sharedInterestsCompact}>
                <Text style={styles.sharedLabel}>✨ You both like: </Text>
                <Text style={styles.sharedText}>
                  {sharedInterests.slice(0, 3).join(', ')}
                </Text>
              </View>
            )}

            {/* Interests chips - compact */}
            {interests.length > 0 && (
              <View style={styles.interestsCompact}>
                {interests.map((interest) => (
                  <View key={interest} style={styles.interestChipCompact}>
                    <Text style={styles.interestTextCompact}>{interest}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Action buttons at bottom */}
        <View style={styles.bottomBar}>
          {hasMatch ? (
            <TouchableOpacity
              style={[styles.primaryButton, styles.fullWidthButton]}
              activeOpacity={0.9}
              onPress={handleStartChat}
              disabled={actionLoading}
            >
              <Text style={styles.primaryButtonText}>💬 Send Message</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.bottomButtonsRow}>
              <TouchableOpacity
                style={styles.passButton}
                activeOpacity={0.9}
                onPress={() => navigation.goBack()}
                disabled={actionLoading}
              >
                <Text style={styles.passButtonText}>✕</Text>
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

        {/* Menu modal */}
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

        {/* Match modal */}
        <Modal
          visible={likeMatchModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setLikeMatchModalVisible(false)}
        >
          <View style={styles.matchModalBackdrop}>
            <View style={styles.matchModalCard}>
              <Text style={styles.matchTitle}>🎉 It's a Match!</Text>
              <Text style={styles.matchSubtitle}>
                You and {displayName} like each other
              </Text>
              <View style={styles.matchButtonsRow}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  activeOpacity={0.9}
                  onPress={() => setLikeMatchModalVisible(false)}
                >
                  <Text style={styles.secondaryButtonText}>Keep Swiping</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primaryButton}
                  activeOpacity={0.9}
                  onPress={handleOpenChatFromModal}
                >
                  <Text style={styles.primaryButtonText}>Send Message</Text>
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
    backgroundColor: '#000000',
  },
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#000000',
  },
  empty: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  photoContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000000',
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
    backgroundColor: '#1F2937',
  },
  photoPlaceholderText: {
    color: '#6B7280',
    fontSize: 16,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 320,
    backgroundColor: 'transparent',
    background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.9))',
  },
  topBar: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  topBarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(10px)',
  },
  topBarIcon: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '600',
  },
  paginationContainer: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 3,
  },
  paginationDotActive: {
    backgroundColor: '#FFFFFF',
    width: 20,
  },
  profileInfoOverlay: {
    position: 'absolute',
    bottom: 110,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    zIndex: 5,
  },
  nameSection: {
    marginBottom: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  usernameText: {
    marginTop: 2,
    fontSize: 16,
    color: '#E5E7EB',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  locationIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  locationText: {
    fontSize: 15,
    color: '#F3F4F6',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  statsRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 10,
    alignSelf: 'flex-start',
    backdropFilter: 'blur(10px)',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  statText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 12,
  },
  bioSection: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backdropFilter: 'blur(10px)',
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#F3F4F6',
  },
  sharedInterestsCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    backdropFilter: 'blur(10px)',
  },
  sharedLabel: {
    fontSize: 13,
    color: '#6EE7B7',
    fontWeight: '600',
  },
  sharedText: {
    fontSize: 13,
    color: '#FFFFFF',
    flex: 1,
  },
  interestsCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    maxHeight: 60,
    overflow: 'hidden',
  },
  interestChipCompact: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(249, 115, 22, 0.25)',
    backdropFilter: 'blur(10px)',
  },
  interestTextCompact: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(20px)',
  },
  bottomButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  passButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  passButtonText: {
    fontSize: 24,
    color: '#EF4444',
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F97316',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fullWidthButton: {
    flex: 1,
  },
  primaryButtonText: {
    fontSize: 17,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: '#1F2937',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 24,
  },
  menuItem: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  menuItemText: {
    fontSize: 17,
    color: '#F3F4F6',
    fontWeight: '500',
  },
  menuCancelItem: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  menuCancelText: {
    fontSize: 17,
    color: '#9CA3AF',
    textAlign: 'center',
    fontWeight: '500',
  },
  matchModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  matchModalCard: {
    width: '100%',
    borderRadius: 24,
    backgroundColor: '#1F2937',
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
  },
  matchTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  matchSubtitle: {
    fontSize: 16,
    color: '#D1D5DB',
    textAlign: 'center',
    marginBottom: 24,
  },
  matchButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  secondaryButton: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  secondaryButtonText: {
    fontSize: 16,
    color: '#F3F4F6',
    fontWeight: '600',
  },
});