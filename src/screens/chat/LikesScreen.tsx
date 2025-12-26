import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../config/supabaseClient';
import { denyLike, fetchIncomingLikes, IncomingLikeProfile, likeBackAndRemove } from '../../services/likes';

export type LikesScreenProps = NativeStackScreenProps<RootStackParamList, 'Likes'>;

export const LikesScreen: React.FC<LikesScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<IncomingLikeProfile[]>([]);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const loadLikes = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await fetchIncomingLikes(user.id);

      const enriched = await Promise.all(
        data.map(async (item) => {
          const hasPhotosArray = Array.isArray(item.profile_photos) && item.profile_photos.length > 0;

          if (hasPhotosArray) {
            return item;
          }

          try {
            const { data: prof, error } = await supabase
              .from('profiles')
              .select('photos')
              .eq('id', item.user_id)
              .maybeSingle();

            if (
              !error &&
              prof &&
              Array.isArray((prof as any).photos) &&
              (prof as any).photos.length > 0
            ) {
              return {
                ...item,
                profile_photos: (prof as any).photos as string[],
              };
            }
          } catch {
            // ignore enrichment errors and fall back to existing data
          }

          return item;
        }),
      );

      const userIds = enriched.map((item) => item.user_id);

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

      const filtered = enriched.filter((item) => !likedBackUserIds.has(item.user_id));

      setItems(filtered);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to load likes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLikes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleLikeBack = async (item: IncomingLikeProfile) => {
    if (!user) return;
    setActioningId(item.like_id);
    try {
      await likeBackAndRemove(user.id, item.user_id, item.like_id);
      setItems((prev) => prev.filter((p) => p.like_id !== item.like_id));
      Alert.alert("It's a match!", `You and ${item.name ?? 'this user'} like each other.`);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to like back');
    } finally {
      setActioningId(null);
    }
  };

  const handleDeny = async (item: IncomingLikeProfile) => {
    setActioningId(item.like_id);
    try {
      await denyLike(item.like_id);
      setItems((prev) => prev.filter((p) => p.like_id !== item.like_id));
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
            <Image source={{ uri: photo }} style={styles.avatar} />
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.headerButton}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.headerIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Likes</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.contentArea}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator />
            </View>
          ) : items.length === 0 ? (
            emptyState
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => item.like_id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerButton: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  headerIcon: {
    fontSize: 20,
    color: '#1A1A1A',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  headerSpacer: {
    width: 24,
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
