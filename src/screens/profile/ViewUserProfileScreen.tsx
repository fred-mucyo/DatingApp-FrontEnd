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
  TextInput,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { sendLike } from '../../services/matching';
import { hasSentPreMatchMessage, sendPreMatchMessage, verifyMatchExists } from '../../services/chat';
import { submitReport, ReportReason } from '../../services/reports';
import { cacheService } from '../../services/cache';

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
  const [preMatchVisible, setPreMatchVisible] = useState(false);
  const [preMatchMessage, setPreMatchMessage] = useState('');
  const [preMatchSending, setPreMatchSending] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason | null>(null);
  const [reportDescription, setReportDescription] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [myInterests, setMyInterests] = useState<string[]>([]);
  const scrollRef = useRef<ScrollView | null>(null);

  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  useEffect(() => {
    const run = async () => {
      // Load from cache first
      const cachedProfile = await cacheService.getProfile(userId);
      if (cachedProfile) {
        setProfile(cachedProfile);
        setLoading(false); // Show cached data immediately
      } else {
        setLoading(true);
      }

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

        const profileData = (data as ViewProfile) ?? null;
        setProfile(profileData);
        if (profileData) {
          await cacheService.setProfile(userId, profileData);
        }

        if (user && user.id !== userId) {
          // Load match status and interests in parallel (don't block UI)
          Promise.all([
            verifyMatchExists(user.id, userId).then((match) => {
              setHasMatch(!!match);
            }),
            (async () => {
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
                // ignore
              }
            })(),
          ]);
        }
      } catch (error) {
        console.warn('Failed to load profile:', error);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [userId, user]);

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

  const handleOpenPreMatchComposer = async () => {
    if (!user) return;
    if (user.id === userId) {
      Alert.alert('Info', 'You cannot message yourself.');
      return;
    }

    setActionLoading(true);
    try {
      const match = await verifyMatchExists(user.id, userId);
      if (match) {
        navigation.navigate('Chat', {
          matchId: match.id,
          otherUserId: match.other_user_id,
          otherUserName: match.other_user_name,
          otherUserPhoto: match.other_user_photo ?? undefined,
        });
        return;
      }

      const alreadySent = await hasSentPreMatchMessage(user.id, userId);
      if (alreadySent) {
        Alert.alert(
          'Message sent',
          'You already sent a message to this person. You can chat freely once you match.',
        );
        return;
      }

      setPreMatchMessage('');
      setPreMatchVisible(true);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to open message composer');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendPreMatch = async () => {
    if (!user) return;
    if (user.id === userId) return;

    const message = (preMatchMessage ?? '').trim();
    if (!message) {
      Alert.alert('Message required', 'Please enter a message before sending.');
      return;
    }

    setPreMatchSending(true);
    try {
      await sendPreMatchMessage(user.id, userId, message);
      Alert.alert(
        'Message sent',
        `Your message was sent to ${displayName}. You can continue the conversation once you both match.`,
      );
      setPreMatchVisible(false);
      setPreMatchMessage('');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to send message');
    } finally {
      setPreMatchSending(false);
    }
  };

  const handleShareProfile = async () => {
    if (!profile) return;
    try {
      const name = profile.name ?? 'MUTIMA user';
      const username = profile.username ? `@${profile.username}` : '';
      await Share.share({
        message: `Check out ${name} ${username} on MUTIMA.`.trim(),
      });
    } catch {
      // ignore share errors
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

  const handleBlockUser = async () => {
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to block users.');
      return;
    }
    if (user.id === userId) {
      Alert.alert('Info', 'You cannot block yourself.');
      return;
    }

    Alert.alert(
      'Block user',
      `Are you sure you want to block ${displayName}? You will no longer see each other.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            setMenuVisible(false);
            setActionLoading(true);
            try {
              const { error } = await supabase.from('blocks').insert({
                blocker_id: user.id,
                blocked_id: userId,
              });
              if (error) {
                Alert.alert('Error', error.message ?? 'Failed to block user');
                return;
              }

              await Promise.all([
                cacheService.invalidate(`matches_${user.id}`),
                cacheService.invalidate(`likes_${user.id}`),
                cacheService.invalidate(`suggestions_${user.id}`),
              ]);

              Alert.alert('Blocked', `${displayName} has been blocked.`);
              navigation.goBack();
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Failed to block user');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  };

  const openReportFlow = () => {
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to report users.');
      return;
    }
    if (user.id === userId) {
      Alert.alert('Info', 'You cannot report yourself.');
      return;
    }
    setMenuVisible(false);
    setReportReason(null);
    setReportDescription('');
    setReportVisible(true);
  };

  const handleSubmitReport = async () => {
    if (!user || !reportReason) return;
    setReportSubmitting(true);
    try {
      await submitReport(user.id, userId, null, reportReason, reportDescription || undefined);
      Alert.alert('Report submitted', 'Thank you. We will review your report.');
      setReportVisible(false);
      setReportReason(null);
      setReportDescription('');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to submit report');
    } finally {
      setReportSubmitting(false);
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
                  <Image source={{ uri }} style={styles.mainPhoto} resizeMode="cover" />
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
                style={styles.messageButton}
                activeOpacity={0.9}
                onPress={handleOpenPreMatchComposer}
                disabled={actionLoading}
              >
                <Text style={styles.messageButtonText}>💬</Text>
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
          transparent
          animationType="slide"
          visible={preMatchVisible}
          onRequestClose={() => {
            if (!preMatchSending) {
              setPreMatchVisible(false);
              setPreMatchMessage('');
            }
          }}
        >
          <View style={styles.preMatchBackdrop}>
            <View style={styles.preMatchCard}>
              <Text style={styles.preMatchTitle}>Message {displayName}</Text>
              <Text style={styles.preMatchSubtitle}>
                You can send one message before you match. Make it count.
              </Text>

              <TextInput
                style={styles.preMatchInput}
                multiline
                placeholder="Say hi..."
                placeholderTextColor="#9CA3AF"
                value={preMatchMessage}
                onChangeText={(text) => {
                  if (text.length <= 500) setPreMatchMessage(text);
                }}
              />

              <View style={styles.preMatchActionsRow}>
                <TouchableOpacity
                  style={[styles.preMatchButton, styles.preMatchCancelButton]}
                  onPress={() => {
                    if (preMatchSending) return;
                    setPreMatchVisible(false);
                    setPreMatchMessage('');
                  }}
                >
                  <Text style={styles.preMatchCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.preMatchButton, styles.preMatchSendButton]}
                  onPress={handleSendPreMatch}
                  disabled={preMatchSending}
                >
                  <Text style={styles.preMatchSendText}>{preMatchSending ? 'Sending…' : 'Send'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

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
              <TouchableOpacity
                style={styles.menuItem}
                activeOpacity={0.8}
                onPress={openReportFlow}
              >
                <Text style={styles.menuItemText}>🚩 Report user</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                activeOpacity={0.8}
                onPress={handleBlockUser}
              >
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
          visible={reportVisible}
          transparent
          animationType="slide"
          onRequestClose={() => {
            if (!reportSubmitting) {
              setReportVisible(false);
              setReportReason(null);
              setReportDescription('');
            }
          }}
        >
          <TouchableOpacity
            style={styles.preMatchBackdrop}
            activeOpacity={1}
            onPress={() => {
              if (!reportSubmitting) {
                setReportVisible(false);
                setReportReason(null);
                setReportDescription('');
              }
            }}
          >
            <View style={styles.preMatchCard} onStartShouldSetResponder={() => true}>
              <Text style={styles.preMatchTitle}>Report {displayName}</Text>
              <Text style={styles.preMatchSubtitle}>Choose a reason (optional details below).</Text>

              <View style={styles.preMatchActionsRow}>
                {([
                  'harassment',
                  'spam',
                  'fake_profile',
                  'inappropriate_content',
                  'scam',
                  'other',
                ] as ReportReason[]).map((reason) => (
                  <TouchableOpacity
                    key={reason}
                    style={[
                      styles.preMatchButton,
                      reportReason === reason ? styles.preMatchSendButton : styles.preMatchCancelButton,
                    ]}
                    onPress={() => setReportReason(reason)}
                    disabled={reportSubmitting}
                  >
                    <Text
                      style={
                        reportReason === reason ? styles.preMatchSendText : styles.preMatchCancelText
                      }
                    >
                      {reason.replace(/_/g, ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.preMatchInput}
                multiline
                placeholder="Details (optional)"
                placeholderTextColor="#9CA3AF"
                value={reportDescription}
                onChangeText={(text) => {
                  if (text.length <= 500) setReportDescription(text);
                }}
              />

              <View style={styles.preMatchActionsRow}>
                <TouchableOpacity
                  style={[styles.preMatchButton, styles.preMatchCancelButton]}
                  onPress={() => {
                    if (reportSubmitting) return;
                    setReportVisible(false);
                    setReportReason(null);
                    setReportDescription('');
                  }}
                >
                  <Text style={styles.preMatchCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.preMatchButton,
                    styles.preMatchSendButton,
                    (!reportReason || reportSubmitting) && { opacity: 0.6 },
                  ]}
                  onPress={handleSubmitReport}
                  disabled={!reportReason || reportSubmitting}
                >
                  <Text style={styles.preMatchSendText}>
                    {reportSubmitting ? 'Submitting…' : 'Submit'}
                  </Text>
                </TouchableOpacity>
              </View>
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
  messageButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  messageButtonText: {
    fontSize: 20,
    color: '#FFFFFF',
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
  preMatchBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  preMatchCard: {
    backgroundColor: '#111827',
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  preMatchTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  preMatchSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 10,
  },
  preMatchInput: {
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#0B1220',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    minHeight: 90,
    marginBottom: 12,
  },
  preMatchActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  preMatchButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preMatchCancelButton: {
    backgroundColor: '#1F2937',
  },
  preMatchSendButton: {
    backgroundColor: '#F97316',
  },
  preMatchCancelText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  preMatchSendText: {
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