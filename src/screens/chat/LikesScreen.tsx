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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../config/supabaseClient';
import { denyLike, fetchIncomingLikes, IncomingLikeProfile, likeBackAndRemove } from '../../services/likes';
import { cacheService } from '../../services/cache';

export type LikesScreenProps = NativeStackScreenProps<RootStackParamList, 'Likes'>;

export const LikesScreen: React.FC<LikesScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<IncomingLikeProfile[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 20;
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

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
    setActioningId(item.like_id);
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
      setActioningId(null);
    }
  };

  const handleDeny = async (item: IncomingLikeProfile) => {
    if (!user) return;
    setActioningId(item.like_id);
    try {
      await denyLike(item.like_id);
      setItems((prev) => prev.filter((p) => p.like_id !== item.like_id));
      // Invalidate cache
      await cacheService.invalidate(`likes_${user.id}`);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to remove like');
    } finally {
      setActioningId(null);
    }
  };

  const renderItem = ({ item }: { item: IncomingLikeProfile }) => {
    const photo = item.profile_photos && item.profile_photos[0];
    const busy = actioningId === item.like_id;

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
            <Text style={styles.name} numberOfLines={1}>
              {item.name ?? 'Unknown user'}
              {item.age ? `, ${item.age}` : ''}
            </Text>
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
            disabled={busy}
            onPress={() => handleDeny(item)}
          >
            <Text style={styles.denyText}>{busy ? 'Removing...' : 'Deny'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.likeBackButton]}
            activeOpacity={0.8}
            disabled={busy}
            onPress={() => handleLikeBack(item)}
          >
            <Text style={styles.likeBackText}>{busy ? 'Matching...' : 'Like back'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const emptyState = (
    <View style={styles.emptyWrapper}>
      <View style={styles.emptyIllustration}>
        <Text style={styles.emptyIcon}>❤️</Text>
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
              <ActivityIndicator size="large" color="#F97316" />
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
              ListFooterComponent={loading && hasLoadedOnce ? <ActivityIndicator size="small" color="#F97316" /> : null}
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
    backgroundColor: '#FAFAFA',
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
    backgroundColor: '#F97316',
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
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
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
    backgroundColor: '#F97316',
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
    color: '#1A1A1A',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyCtaButton: {
    backgroundColor: '#F97316',
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
