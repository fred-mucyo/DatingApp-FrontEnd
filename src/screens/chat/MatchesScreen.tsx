import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../context/AuthContext';
import { fetchMatchesWithLastMessage, MatchItem } from '../../services/chat';
import { cacheService } from '../../services/cache';

const LAST_READ_KEY_PREFIX = 'last_read_';

export type MatchesScreenProps = NativeStackScreenProps<RootStackParamList, 'Matches'>;

const formatTimeLabel = (isoString: string | null): string => {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMin / 60);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
};

export const MatchesScreen: React.FC<MatchesScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const loadMatches = useCallback(async (showLoading = false) => {
    if (!user) return;
    
    if (showLoading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      // Try to load from cache first
      const cachedMatches = await cacheService.getMatches(user.id);
      if (cachedMatches && cachedMatches.length > 0) {
        setMatches(cachedMatches);
        setHasLoadedOnce(true);
        // Calculate unread counts from cached data
        const counts: Record<string, number> = {};
        for (const m of cachedMatches) {
          const lastMessageFromOther = m.last_message_sender_id && m.last_message_sender_id !== user.id;
          if (lastMessageFromOther && m.last_message_created_at) {
            const lastKey = `${LAST_READ_KEY_PREFIX}${m.id}`;
            const lastRead = await AsyncStorage.getItem(lastKey);
            if (!lastRead || new Date(lastRead) < new Date(m.last_message_created_at)) {
              counts[m.id] = 1;
            }
          }
        }
        setUnreadCounts(counts);
      }

      // Fetch fresh data in background
      const data = await fetchMatchesWithLastMessage(user.id);
      setMatches(data);
      await cacheService.setMatches(user.id, data);

      // Calculate unread counts
      const counts: Record<string, number> = {};
      for (const m of data) {
        const lastMessageFromOther = m.last_message_sender_id && m.last_message_sender_id !== user.id;
        if (lastMessageFromOther && m.last_message_created_at) {
          const lastKey = `${LAST_READ_KEY_PREFIX}${m.id}`;
          const lastRead = await AsyncStorage.getItem(lastKey);
          if (!lastRead || new Date(lastRead) < new Date(m.last_message_created_at)) {
            counts[m.id] = 1;
          }
        }
      }
      setUnreadCounts(counts);
      setHasLoadedOnce(true);
    } catch (error) {
      console.warn('Failed to load matches:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Load cached data immediately on mount
  useEffect(() => {
    if (!user) return;
    
    const loadCached = async () => {
      const cached = await cacheService.getMatches(user.id);
      if (cached && cached.length > 0) {
        setMatches(cached);
        setHasLoadedOnce(true);
        // Calculate unread counts
        const counts: Record<string, number> = {};
        for (const m of cached) {
          const lastMessageFromOther = m.last_message_sender_id && m.last_message_sender_id !== user.id;
          if (lastMessageFromOther && m.last_message_created_at) {
            const lastKey = `${LAST_READ_KEY_PREFIX}${m.id}`;
            const lastRead = await AsyncStorage.getItem(lastKey);
            if (!lastRead || new Date(lastRead) < new Date(m.last_message_created_at)) {
              counts[m.id] = 1;
            }
          }
        }
        setUnreadCounts(counts);
      } else {
        // If no cache, show loading
        setLoading(true);
      }
      // Then refresh in background
      loadMatches(false);
    };
    
    loadCached();
  }, [user, loadMatches]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadMatches(false); // Refresh in background without showing loading
      }
    }, [user, loadMatches])
  );

  const handleOpenChat = async (m: MatchItem) => {
    if (!user) return;
    await AsyncStorage.setItem(`${LAST_READ_KEY_PREFIX}${m.id}`, new Date().toISOString());
    navigation.navigate('Chat', {
      matchId: m.id,
      otherUserId: m.other_user_id,
      otherUserName: m.other_user_name,
      otherUserPhoto: m.other_user_photo ?? undefined,
    });
  };

  // WhatsApp-style tick component for conversation list
  const MessageTicks = ({ item }: { item: MatchItem }) => {
    // Only show ticks if last message was sent by current user
    const isMyMessage = item.last_message_sender_id === user?.id;
    if (!isMyMessage || !item.last_message_content) return null;

    const isRead = !!item.last_message_read_at;
    const isDelivered = !!item.last_message_delivered_at;

    // 1 tick = sent, 2 ticks = delivered, 2 orange ticks = read
    const tickColor = isRead ? '#F97316' : '#9CA3AF'; // Primary color if read, gray if not
    const tickCount = isDelivered ? 2 : 1;

    return (
      <View style={styles.messageTicksContainer}>
        {tickCount === 1 ? (
          <Text style={[styles.messageTick, { color: tickColor }]}>✓</Text>
        ) : (
          <>
            <Text style={[styles.messageTick, { color: tickColor }]}>✓</Text>
            <Text style={[styles.messageTick, styles.messageTickSecond, { color: tickColor }]}>
              ✓
            </Text>
          </>
        )}
      </View>
    );
  };

  const renderItem = ({ item }: { item: MatchItem }) => {
    const unread = unreadCounts[item.id] ?? 0;
    const lastTimeLabel = formatTimeLabel(item.last_message_created_at ?? item.created_at ?? null);
    const lastMessagePreview = item.last_message_content || `Say hi to ${item.other_user_name} 👋`;

    return (
      <TouchableOpacity
        style={styles.cardRow}
        onPress={() => handleOpenChat(item)}
        activeOpacity={0.8}
      >
        <View style={styles.avatarWrapper}>
          {item.other_user_photo ? (
            <Image source={{ uri: item.other_user_photo }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]} />
          )}
        </View>

        <View style={styles.cardContent}>
          <View style={styles.cardTopRow}>
            <Text style={[styles.name, unread > 0 && styles.nameUnread]} numberOfLines={1}>
              {item.other_user_name}
            </Text>
            {!!lastTimeLabel && <Text style={styles.timeText}>{lastTimeLabel}</Text>}
          </View>

          <View style={styles.cardBottomRow}>
            <View style={styles.previewContainer}>
              <Text
                style={[styles.preview, unread > 0 && styles.previewUnread]}
                numberOfLines={2}
              >
                {lastMessagePreview}
              </Text>
              <MessageTicks item={item} />
            </View>
            <View style={styles.trailingIndicators}>
              {unread > 0 && <View style={styles.unreadDot} />}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const totalMatches = matches.length;
  const totalUnread = Object.values(unreadCounts).reduce((sum, v) => sum + (v > 0 ? 1 : 0), 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.statsBar}>
          <Text style={styles.statsText}>{totalMatches} matches</Text>
          <Text style={[styles.statsText, totalUnread > 0 && styles.statsUnreadText]}>
            {totalUnread > 0 ? `${totalUnread} unread` : 'No unread'}
          </Text>
        </View>

        <View style={styles.contentArea}>
          {loading && !hasLoadedOnce ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#F97316" />
            </View>
          ) : totalMatches === 0 && hasLoadedOnce && !refreshing ? (
            <View style={styles.emptyStateWrapper}>
              <View style={styles.emptyIllustration}>
                <Text style={styles.emptyIllustrationIcon}>💬</Text>
              </View>
              <Text style={styles.emptyTitle}>No matches yet</Text>
              <Text style={styles.emptySubtitle}>
                Start liking profiles to make connections!
              </Text>
              <TouchableOpacity
                style={styles.emptyCtaButton}
                activeOpacity={0.9}
                onPress={() => navigation.navigate('Home')}
              >
                <Text style={styles.emptyCtaText}>Discover profiles</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={matches}
              keyExtractor={(item) => item.id}
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
    backgroundColor: '#F9FAFB',
  },
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F3F4F6',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  statsText: {
    fontSize: 14,
    color: '#6B7280',
  },
  statsUnreadText: {
    color: '#F97316',
    fontWeight: '600',
  },
  contentArea: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 8,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  avatarWrapper: {
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#E5E7EB',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
  },
  cardContent: {
    flex: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  nameUnread: {
    fontWeight: '700',
  },
  timeText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  preview: {
    fontSize: 14,
    color: '#6B7280',
    flexShrink: 1,
  },
  previewUnread: {
    color: '#111827',
    fontWeight: '500',
  },
  previewContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  trailingIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
    marginRight: 8,
  },
  messageTicksContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
  },
  messageTick: {
    fontSize: 14,
    fontWeight: '600',
  },
  messageTickSecond: {
    marginLeft: -4,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  emptyStateWrapper: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIllustration: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFE4E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyIllustrationIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyCtaButton: {
    height: 48,
    borderRadius: 999,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F97316',
  },
  emptyCtaText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
