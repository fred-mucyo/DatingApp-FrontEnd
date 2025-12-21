import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../context/AuthContext';
import { fetchMatchesWithLastMessage, MatchItem } from '../../services/chat';

const LAST_READ_KEY_PREFIX = 'last_read_';

export type MatchesScreenProps = NativeStackScreenProps<RootStackParamList, 'Matches'>;

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
    return (
      <TouchableOpacity style={styles.row} onPress={() => handleOpenChat(item)}>
        {item.other_user_photo ? (
          <Image source={{ uri: item.other_user_photo }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>{item.other_user_name.charAt(0)}</Text>
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.name}>{item.other_user_name}</Text>
          {item.last_message_content ? (
            <Text style={styles.preview} numberOfLines={1}>
              {item.last_message_content}
            </Text>
          ) : (
            <Text style={styles.preview}>Say hi 👋</Text>
          )}
        </View>
        {unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (matches.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>No matches yet. Keep swiping in Discovery!</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={matches}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  preview: {
    fontSize: 12,
    color: '#6b7280',
  },
  badge: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  empty: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});
