import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
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
  const { matchId, otherUserName, otherUserId } = route.params;
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

  useEffect(() => {
    navigation.setOptions({
      title: otherUserName,
      headerRight: () => (
        <Button title="Unmatch" onPress={handleBlockAndExit} />
      ),
    });
  }, [navigation, otherUserName, handleBlockAndExit]);

  const scrollToBottom = () => {
    flatListRef.current?.scrollToEnd({ animated: true });
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

  const renderItem = ({ item }: { item: MessageItem }) => {
    const isMine = item.sender_id === user?.id;
    return (
      <View style={[styles.messageRow, isMine ? styles.messageRowMine : styles.messageRowTheirs]}>
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
          <Text style={isMine ? styles.textMine : styles.textTheirs}>{item.content}</Text>
          <Text style={styles.timestamp}>{new Date(item.created_at).toLocaleTimeString()}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={scrollToBottom}
      />
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
            placeholder="Type a message..."
            multiline
          />
          <Button title={sending ? 'Sending...' : 'Send'} onPress={handleSend} disabled={sending || !input.trim()} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 12,
    paddingBottom: 80,
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
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bubbleMine: {
    backgroundColor: '#3b82f6',
    borderBottomRightRadius: 2,
  },
  bubbleTheirs: {
    backgroundColor: '#e5e7eb',
    borderBottomLeftRadius: 2,
  },
  textMine: {
    color: '#fff',
  },
  textTheirs: {
    color: '#111827',
  },
  timestamp: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 2,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 8,
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
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    maxHeight: 100,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
