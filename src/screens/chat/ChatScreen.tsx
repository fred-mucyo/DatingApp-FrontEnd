import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../context/AuthContext';
import { DAILY_MESSAGE_LIMIT, fetchMessages, getMessageCountToday, sendChatMessage } from '../../services/chat';
import { supabase } from '../../config/supabaseClient';

export type ChatScreenProps = NativeStackScreenProps<RootStackParamList, 'Chat'>;

interface MessageItem {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ route, navigation }) => {
  const { matchId, otherUserName, otherUserId, otherUserPhoto } = route.params;
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messagesLeft, setMessagesLeft] = useState<number | null>(null);
  const flatListRef = useRef<FlatList<MessageItem>>(null);

  const handleBlockAndExit = async () => {
    if (!user) return;
    try {
      const { error } = await supabase.from('blocks').insert({
        blocker_id: user.id,
        blocked_id: otherUserId,
      });
      if (error) {
        Alert.alert('Error', error.message ?? 'Failed to update');
        return;
      }
      Alert.alert('Done', 'You will no longer see this match or messages from this user.');
      navigation.popToTop();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to update');
    }
  };

  const scrollToBottom = () => {
    flatListRef.current?.scrollToEnd({ animated: true });
  };

  const openHeaderMenu = () => {
    Alert.alert(
      'Conversation options',
      undefined,
      [
        {
          text: 'View profile',
          onPress: () => navigation.navigate('ViewUserProfile', { userId: otherUserId }),
        },
        {
          text: 'Unmatch',
          style: 'destructive',
          onPress: handleBlockAndExit,
        },
        {
          text: 'Block & report',
          style: 'destructive',
          onPress: handleBlockAndExit,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
    );
  };

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const [msgs, count] = await Promise.all([
          fetchMessages(matchId, 100),
          getMessageCountToday(user.id),
        ]);
        setMessages(msgs);
        setMessagesLeft(Math.max(0, DAILY_MESSAGE_LIMIT - count));
        setTimeout(scrollToBottom, 100);
      } catch (e: any) {
        Alert.alert('Error', e.message ?? 'Failed to load chat');
      } finally {
        setLoading(false);
      }
    };

    load();

    const channel = supabase
      .channel(`chat:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const newMessage = payload.new as MessageItem;
          setMessages((prev) => [...prev, newMessage]);
          setTimeout(scrollToBottom, 50);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, user]);

  const handleSend = async () => {
    if (!user) return;
    if (!input.trim()) return;
    if (messagesLeft !== null && messagesLeft <= 0) {
      Alert.alert('Limit reached', 'You have reached your daily message limit.');
      return;
    }

    setSending(true);
    try {
      await sendChatMessage(user.id, matchId, input);
      setInput('');
      if (messagesLeft !== null) {
        setMessagesLeft(Math.max(0, messagesLeft - 1));
      }
      // Refresh messages so the newly-sent message appears immediately
      try {
        const updated = await fetchMessages(matchId, 100);
        setMessages(updated);
        setTimeout(scrollToBottom, 50);
      } catch (e: any) {
        // If this fails, the realtime subscription will still pick up the message,
        // so we just surface a soft error.
        // eslint-disable-next-line no-console
        console.warn('Failed to refresh messages after send', e?.message ?? e);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item, index }: { item: MessageItem; index: number }) => {
    const isMine = item.sender_id === user?.id;
    const prev = index > 0 ? messages[index - 1] : null;
    const next = index < messages.length - 1 ? messages[index + 1] : null;
    const sameAsPrev = prev && prev.sender_id === item.sender_id;
    const sameAsNext = next && next.sender_id === item.sender_id;
    const createdAt = new Date(item.created_at);

    const isFirstInGroup = !sameAsPrev;
    const isLastInGroup = !sameAsNext;

    const previousDate = prev ? new Date(prev.created_at) : null;
    const showDateSeparator =
      !previousDate || previousDate.toDateString() !== createdAt.toDateString();

    const timeLabel = createdAt.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });

    return (
      <View>
        {showDateSeparator && (
          <View style={styles.dateSeparatorWrapper}>
            <Text style={styles.dateSeparatorText}>
              {createdAt.toDateString() === new Date().toDateString()
                ? 'Today'
                : createdAt.toDateString() ===
                  new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString()
                ? 'Yesterday'
                : createdAt.toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
            </Text>
          </View>
        )}
        <View
          style={[
            styles.messageRow,
            isMine ? styles.messageRowMine : styles.messageRowTheirs,
          ]}
        >
          <View
            style={[
              styles.bubble,
              isMine ? styles.bubbleMine : styles.bubbleTheirs,
              isMine && isLastInGroup && styles.bubbleMineLast,
              !isMine && isFirstInGroup && styles.bubbleTheirsFirst,
            ]}
          >
            <Text style={isMine ? styles.textMine : styles.textTheirs}>
              {item.content}
            </Text>
          </View>
        </View>
        {isLastInGroup && (
          <Text
            style={[
              styles.timestamp,
              isMine ? styles.timestampMine : styles.timestampTheirs,
            ]}
          >
            {timeLabel}
          </Text>
        )}
      </View>
    );
  };

  const nearLimitBanner =
    messagesLeft !== null && messagesLeft > 0 && messagesLeft <= 5;
  const limitReached = messagesLeft !== null && messagesLeft <= 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={64}
      >
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.headerButton}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Matches')}
          >
            <Text style={styles.headerIcon}>←</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerCenter}
            activeOpacity={0.8}
            onPress={() =>
              navigation.navigate('ViewUserProfile', { userId: otherUserId })
            }
          >
            {otherUserPhoto ? (
              <Image source={{ uri: otherUserPhoto }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitial}>
                  {otherUserName?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View style={styles.headerTextBlock}>
              <Text style={styles.headerName} numberOfLines={1}>
                {otherUserName}
              </Text>
              <Text style={styles.headerStatus}>Active recently</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            activeOpacity={0.8}
            onPress={openHeaderMenu}
          >
            <Text style={styles.headerIcon}>⋯</Text>
          </TouchableOpacity>
        </View>

        {nearLimitBanner && !limitReached && (
          <View style={styles.limitBanner}>
            <Text style={styles.limitBannerText}>
              ⚠️ {messagesLeft} messages remaining today
            </Text>
          </View>
        )}
        {limitReached && (
          <View style={styles.limitBannerBlocked}>
            <Text style={styles.limitBannerBlockedText}>
              Daily message limit reached. Try again tomorrow.
            </Text>
          </View>
        )}

        <View style={styles.messagesArea}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator />
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.emptyWrapper}>
              {otherUserPhoto ? (
                <Image source={{ uri: otherUserPhoto }} style={styles.emptyAvatarImage} />
              ) : (
                <View style={styles.emptyAvatarLarge}>
                  <Text style={styles.emptyAvatarInitial}>
                    {otherUserName?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                </View>
              )}
              <Text style={styles.emptyTitle}>You matched with {otherUserName}!</Text>
              <Text style={styles.emptySubtitle}>Start the conversation</Text>
              <View style={styles.promptChipsRow}>
                {[
                  'Hey! 👋',
                  'What do you like to do for fun?',
                  'Tell me about yourself',
                ].map((prompt) => (
                  <TouchableOpacity
                    key={prompt}
                    style={styles.promptChip}
                    activeOpacity={0.9}
                    onPress={() => setInput(prompt)}
                  >
                    <Text style={styles.promptChipText}>{prompt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              onContentSizeChange={scrollToBottom}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>

        <View style={styles.inputContainer}>
          <View style={styles.inputMeta}>
            <Text style={styles.counter}>{input.length} / 500</Text>
            {messagesLeft !== null && (
              <Text style={styles.limit}>{messagesLeft} messages left today</Text>
            )}
          </View>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={(text) => {
                if (text.length <= 500) setInput(text);
              }}
              placeholder={`Message ${otherUserName}...`}
              multiline
              placeholderTextColor="#9CA3AF"
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (sending || !input.trim() || limitReached) && styles.sendButtonDisabled,
              ]}
              activeOpacity={0.9}
              onPress={handleSend}
              disabled={sending || !input.trim() || limitReached}
            >
              <Text style={styles.sendButtonIcon}>{sending ? '…' : '➤'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    height: 64,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 4,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    fontSize: 18,
    color: '#111827',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 8,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '600',
    color: '#7C2D12',
  },
  headerTextBlock: {
    flex: 1,
  },
  headerName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  headerStatus: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },
  limitBanner: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFEDD5',
  },
  limitBannerText: {
    fontSize: 13,
    color: '#EA580C',
    textAlign: 'center',
  },
  limitBannerBlocked: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FEE2E2',
  },
  limitBannerBlockedText: {
    fontSize: 13,
    color: '#B91C1C',
    textAlign: 'center',
  },
  messagesArea: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  messageRowMine: {
    justifyContent: 'flex-end',
  },
  messageRowTheirs: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleMine: {
    backgroundColor: '#F97316',
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: '#e5e7eb',
    borderBottomLeftRadius: 2,
  },
  bubbleMineLast: {
    borderBottomRightRadius: 18,
  },
  bubbleTheirsFirst: {
    borderBottomLeftRadius: 18,
  },
  textMine: {
    color: '#fff',
  },
  textTheirs: {
    color: '#111827',
  },
  timestamp: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  timestampMine: {
    textAlign: 'right',
  },
  timestampTheirs: {
    textAlign: 'left',
  },
  dateSeparatorWrapper: {
    alignItems: 'center',
    marginVertical: 8,
  },
  dateSeparatorText: {
    fontSize: 13,
    color: '#6B7280',
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 999,
  },
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#fff',
  },
  inputMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  counter: {
    fontSize: 10,
    color: '#6b7280',
  },
  limit: {
    fontSize: 10,
    color: '#6b7280',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 100,
    backgroundColor: '#F3F4F6',
    fontSize: 14,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F97316',
  },
  sendButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  sendButtonIcon: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyAvatarLarge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFE4E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyAvatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 24,
  },
  emptyAvatarInitial: {
    fontSize: 32,
    fontWeight: '700',
    color: '#9F1239',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    textAlign: 'center',
  },
  promptChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  promptChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    margin: 4,
  },
  promptChipText: {
    fontSize: 13,
    color: '#111827',
  },
});
