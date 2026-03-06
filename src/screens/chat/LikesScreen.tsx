import React, { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Image,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../config/supabaseClient';
import { denyLike, fetchIncomingLikes, IncomingLikeProfile, likeBackAndRemove } from '../../services/likes';
import { cacheService } from '../../services/cache';
import { resolveAge } from '../../utils/age';

export type LikesScreenProps = NativeStackScreenProps<RootStackParamList, 'Likes'>;

export const LikesScreen: React.FC<LikesScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<IncomingLikeProfile[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 20;
  const [actioning, setActioning] = useState<Record<string, 'deny' | 'likeBack' | null>>({});
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const LikeIcon = ({ color = '#ff4b2b' }: { color?: string }) => (
    <Svg width={44} height={44} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12.001 5.5c-1.54-1.67-4.04-1.67-5.58 0-1.5 1.63-1.5 4.27 0 5.9l4.47 4.85a1 1 0 0 0 1.46 0l4.47-4.85c1.5-1.63 1.5-4.27 0-5.9-1.54-1.67-4.04-1.67-5.58 0Z"
        fill={color}
      />
    </Svg>
  );

  const VerifiedIcon = ({ color = '#ff4b2b' }: { color?: string }) => (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 6 9 17l-5-5"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );

  const loadLikes = useCallback(async (showLoading = false, pageNum = 0) => {
    if (!user) return;
    
    if (showLoading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const offset = pageNum * PAGE_SIZE;
      const data = await fetchIncomingLikes(user.id, PAGE_SIZE, offset);

      const userIds = data.map((item) => item.user_id);

      let likedBackUserIds = new Set<string>();
      if (userIds.length > 0) {
        const { data: outgoingLikes, error: likesError } = await supabase
          .from('likes')
          .select('liked_id')
          .eq('liker_id', user.id)
          .in('liked_id', userIds);

        if (!likesError && Array.isArray(outgoingLikes)) {
          likedBackUserIds = new Set(
            outgoingLikes
              .map((row: any) => row.liked_id as string)
              .filter((id): id is string => !!id),
          );
        }
      }

      const filtered = data.filter((item) => !likedBackUserIds.has(item.user_id));

      if (pageNum === 0) {
        setItems(filtered);
      } else {
        setItems((prev) => [...prev, ...filtered]);
      }
      setHasMore(data.length === PAGE_SIZE);
      if (pageNum === 0) {
        await cacheService.setLikes(user.id, filtered);
      }
      setHasLoadedOnce(true);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to load likes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Load cached data immediately
  useEffect(() => {
    if (!user) return;
    setPage(0);
    const loadCached = async () => {
      const cached = await cacheService.getLikes(user.id);
      if (cached && cached.length > 0) {
        setItems(cached);
        setHasLoadedOnce(true);
      } else {
        setLoading(true);
      }
      loadLikes(false, 0);
    };
    loadCached();
  }, [user, loadLikes]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user) {
        setPage(0);
        loadLikes(false, 0);
      }
    }, [user, loadLikes])
  );

  const handleLikeBack = async (item: IncomingLikeProfile) => {
    if (!user) return;
    setActioning((prev) => ({ ...prev, [item.like_id]: 'likeBack' }));
    try {
      await likeBackAndRemove(user.id, item.user_id, item.like_id);
      setItems((prev) => prev.filter((p) => p.like_id !== item.like_id));
      // Invalidate caches
      await cacheService.invalidate(`likes_${user.id}`);
      await cacheService.invalidate(`matches_${user.id}`);
      Alert.alert("It's a match!", `You and ${item.name ?? 'this user'} like each other.`);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to like back');
    } finally {
      setActioning((prev) => ({ ...prev, [item.like_id]: null }));
    }
  };

  const handleDeny = async (item: IncomingLikeProfile) => {
    if (!user) return;
    setActioning((prev) => ({ ...prev, [item.like_id]: 'deny' }));
    try {
      await denyLike(item.like_id);
      setItems((prev) => prev.filter((p) => p.like_id !== item.like_id));
      // Invalidate cache
      await cacheService.invalidate(`likes_${user.id}`);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to remove like');
    } finally {
      setActioning((prev) => ({ ...prev, [item.like_id]: null }));
    }
  };

  const renderItem = ({ item }: { item: IncomingLikeProfile }) => {
    const photo = item.profile_photos && item.profile_photos[0];
    const currentAction = actioning[item.like_id] ?? null;
    const busyDeny = currentAction === 'deny';
    const busyLikeBack = currentAction === 'likeBack';
    const anyBusy = !!currentAction;
    const resolvedAge = resolveAge({ age: item.age, date_of_birth: item.date_of_birth });

    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardMain}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('ViewUserProfile', { userId: item.user_id })}
        >
          {photo ? (
            <Image source={{ uri: photo }} style={styles.avatar} resizeMode="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>
                {(item.name || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <View style={styles.cardInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {(item.name ?? 'Unknown user')}
                {resolvedAge ? `, ${resolvedAge}` : ''}
              </Text>
              {item.is_verified ? (
                <View style={styles.verifiedIconWrap}>
                  <VerifiedIcon />
                </View>
              ) : null}
            </View>
            {!!(item.city || item.country) && (
              <Text style={styles.location} numberOfLines={1}>
                {[item.city, item.country].filter(Boolean).join(', ')}
              </Text>
            )}
            <Text style={styles.subtitle}>Liked you recently</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.denyButton]}
            activeOpacity={0.8}
            disabled={anyBusy}
            onPress={() => handleDeny(item)}
          >
            {busyDeny ? (
              <ActivityIndicator size="small" color="#111827" />
            ) : (
              <Text style={styles.denyText}>Deny</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.likeBackButton]}
            activeOpacity={0.8}
            disabled={anyBusy}
            onPress={() => handleLikeBack(item)}
          >
            {busyLikeBack ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.likeBackText}>Like back</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const emptyState = (
    <View style={styles.emptyWrapper}>
      <View style={styles.emptyIllustration}>
        <LikeIcon />
      </View>
      <Text style={styles.emptyTitle}>No likes yet</Text>
      <Text style={styles.emptySubtitle}>
        When someone likes you, they will appear here so you can like back or deny.
      </Text>
      <TouchableOpacity
        style={styles.emptyCtaButton}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('Home')}
      >
        <Text style={styles.emptyCtaText}>Discover profiles</Text>
      </TouchableOpacity>
    </View>
  );

  const handleEndReached = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadLikes(false, nextPage);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.contentArea}>
          {loading && !hasLoadedOnce ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#ff4b2b" />
            </View>
          ) : items.length === 0 && hasLoadedOnce && !refreshing ? (
            emptyState
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => item.like_id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              onEndReached={handleEndReached}
              onEndReachedThreshold={0.5}
              refreshing={refreshing}
              onRefresh={() => {
                setPage(0);
                loadLikes(true, 0);
              }}
              ListFooterComponent={loading && hasLoadedOnce ? <ActivityIndicator size="small" color="#ff4b2b" /> : null}
            />
          )}
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
  },
  contentArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: '#ff4b2b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  cardInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  verifiedIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFF1F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  location: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  denyButton: {
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  likeBackButton: {
    backgroundColor: '#ff4b2b',
    marginLeft: 8,
  },
  denyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  likeBackText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIllustration: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFE4E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyCtaButton: {
    backgroundColor: '#ff4b2b',
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyCtaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
