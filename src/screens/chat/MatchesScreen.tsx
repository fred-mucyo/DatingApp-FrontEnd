import React, { useEffect, useState } from 'react';
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
import { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../context/AuthContext';
import { fetchMatchesWithLastMessage, MatchItem } from '../../services/chat';

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
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const run = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const data = await fetchMatchesWithLastMessage(user.id);
        setMatches(data);

        // Approximate unread state using last_read timestamps in AsyncStorage
        const counts: Record<string, number> = {};
        for (const m of data) {
          const lastKey = `${LAST_READ_KEY_PREFIX}${m.id}`;
          const lastRead = await AsyncStorage.getItem(lastKey);
          const lastMessageTime = m.last_message_created_at;
          if (lastMessageTime) {
            if (!lastRead || new Date(lastRead) < new Date(lastMessageTime)) {
              counts[m.id] = 1;
            }
          }
        }
        setUnreadCounts(counts);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [user]);

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
            <Text
              style={[styles.preview, unread > 0 && styles.previewUnread]}
              numberOfLines={2}
            >
              {lastMessagePreview}
            </Text>
            <View style={styles.trailingIndicators}>
              {unread > 0 && <View style={styles.unreadDot} />}
              <Text style={styles.chevron}>{'>'}</Text>
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
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.headerButton}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.headerIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Messages</Text>
          <TouchableOpacity style={styles.headerButton} activeOpacity={0.8}>
            <Text style={styles.headerIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsBar}>
          <Text style={styles.statsText}>{totalMatches} matches</Text>
          <Text style={[styles.statsText, totalUnread > 0 && styles.statsUnreadText]}>
            {totalUnread > 0 ? `${totalUnread} unread` : 'No unread'}
          </Text>
        </View>

        <View style={styles.contentArea}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator />
            </View>
          ) : totalMatches === 0 ? (
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
  headerBar: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    fontSize: 18,
    color: '#111827',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
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
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
  },
  previewUnread: {
    color: '#111827',
    fontWeight: '500',
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
  chevron: {
    fontSize: 18,
    color: '#D1D5DB',
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
