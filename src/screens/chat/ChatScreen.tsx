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
  Image,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../context/AuthContext';
import {
  DAILY_MESSAGE_LIMIT,
  fetchRecentMessages,
  fetchMessages,
  getMessageCountToday,
  sendChatMessage,
  markMessagesAsDelivered,
  markMessagesAsRead,
  ChatMessage,
} from '../../services/chat';
import { supabase } from '../../config/supabaseClient';
import { submitReport, ReportReason } from '../../services/reports';
import { cacheService } from '../../services/cache';

export type ChatScreenProps = NativeStackScreenProps<RootStackParamList, 'Chat'>;

// Use ChatMessage from service
type MessageItem = ChatMessage;

export const ChatScreen: React.FC<ChatScreenProps> = ({ route, navigation }) => {
  const { matchId, otherUserName, otherUserId, otherUserPhoto } = route.params;
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [pendingMessages, setPendingMessages] = useState<MessageItem[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messagesLeft, setMessagesLeft] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason | null>(null);
  const [reportDescription, setReportDescription] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const flatListRef = useRef<FlatList<MessageItem>>(null);

  const handleUnmatch = async () => {
    if (!user) return;
    try {
      // Delete the match
      const { error } = await supabase
        .from('matches')
        .delete()
        .or(
          `and(user1_id.eq.${user.id},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${user.id})`,
        );

      if (error) {
        Alert.alert('Error', error.message ?? 'Failed to unmatch');
        return;
      }

      // Invalidate cache
      await cacheService.invalidate(`matches_${user.id}`);
      Alert.alert('Unmatched', 'You have unmatched with this user.');
      setShowMenu(false);
      navigation.popToTop();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to unmatch');
    }
  };

  const handleBlock = async () => {
    if (!user) return;
    try {
      const { error } = await supabase.from('blocks').insert({
        blocker_id: user.id,
        blocked_id: otherUserId,
      });
      if (error) {
        Alert.alert('Error', error.message ?? 'Failed to block');
        return;
      }
      // Invalidate cache
      await cacheService.invalidate(`matches_${user.id}`);
      Alert.alert('Blocked', 'You have blocked this user.');
      setShowMenu(false);
      navigation.popToTop();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to block');
    }
  };

  const handleReport = async () => {
    if (!user || !reportReason) return;

    setSubmittingReport(true);
    try {
      await submitReport(user.id, otherUserId, null, reportReason, reportDescription || undefined);
      Alert.alert('Report submitted', 'Thank you for your report. We will review it shortly.');
      setShowReportModal(false);
      setShowMenu(false);
      setReportReason(null);
      setReportDescription('');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to submit report');
    } finally {
      setSubmittingReport(false);
    }
  };

  const scrollToBottom = () => {
    flatListRef.current?.scrollToEnd({ animated: true });
  };

  const openHeaderMenu = () => {
    setShowMenu(true);
  };

  const reportReasons: { value: ReportReason; label: string }[] = [
    { value: 'harassment', label: 'Harassment' },
    { value: 'spam', label: 'Spam' },
    { value: 'fake_profile', label: 'Fake Profile' },
    { value: 'inappropriate_content', label: 'Inappropriate Content' },
    { value: 'scam', label: 'Scam' },
    { value: 'other', label: 'Other' },
  ];

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      
      // Load from cache first
      const cachedMessages = await cacheService.getMessages(matchId);
      if (cachedMessages && cachedMessages.length > 0) {
        setMessages(cachedMessages);
        setHasMoreMessages(cachedMessages.length >= 20);
        setTimeout(scrollToBottom, 50);
      }
      
      setLoading(true);
      try {
        const [msgs, count] = await Promise.all([
          fetchRecentMessages(matchId, 20),
          getMessageCountToday(user.id),
        ]);
        setMessages(msgs);
        await cacheService.setMessages(matchId, msgs);
        setMessagesLeft(Math.max(0, DAILY_MESSAGE_LIMIT - count));
        setHasMoreMessages(msgs.length >= 20);
        
        // Mark messages as delivered/read in background (don't wait)
        markMessagesAsDelivered(matchId, user.id).catch(() => {});
        markMessagesAsRead(matchId, user.id).catch(() => {});
        
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
        async (payload) => {
          const newMessage = payload.new as MessageItem;
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === newMessage.id)) return prev;
            const updated = [...prev, newMessage];
            // Update cache
            cacheService.setMessages(matchId, updated).catch(() => {});
            return updated;
          });
          
          // If message is from other user, mark as delivered immediately (don't wait)
          if (newMessage.sender_id !== user?.id) {
            markMessagesAsDelivered(matchId, user?.id || '').catch(() => {});
            markMessagesAsRead(matchId, user?.id || '').catch(() => {});
          }
          
          setTimeout(scrollToBottom, 50);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const updatedMessage = payload.new as MessageItem;
          setMessages((prev) =>
            prev.map((msg) => (msg.id === updatedMessage.id ? updatedMessage : msg)),
          );
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
    const optimisticMessage: MessageItem = {
      id: `optimistic-${Date.now()}`,
      match_id: matchId,
      sender_id: user.id,
      content: input,
      created_at: new Date().toISOString(),
      delivered_at: null,
      read_at: null,
    };
    setPendingMessages((prev) => [...prev, optimisticMessage]);
    setInput('');
    setTimeout(scrollToBottom, 50);
    try {
      const newMessage = await sendChatMessage(user.id, matchId, optimisticMessage.content);
      setPendingMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
      if (messagesLeft !== null) {
        setMessagesLeft(Math.max(0, messagesLeft - 1));
      }
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMessage.id)) return prev;
        const updated = [...prev, newMessage];
        cacheService.setMessages(matchId, updated).catch(() => {});
        return updated;
      });
      setTimeout(scrollToBottom, 50);
    } catch (e: any) {
      setPendingMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
      Alert.alert('Error', e.message ?? 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const loadMoreMessages = async () => {
    if (loadingMore || !hasMoreMessages || messages.length === 0) return;
    
    setLoadingMore(true);
    try {
      // Load older messages (before the oldest current message)
      const oldestMessage = messages[0];
      const moreMessages = await fetchMessages(matchId, 20, messages.length);
      
      if (moreMessages.length === 0 || moreMessages.length < 20) {
        setHasMoreMessages(false);
      }
      
      if (moreMessages.length > 0) {
        // Prepend older messages to the beginning
        setMessages((prev) => [...moreMessages, ...prev]);
      }
    } catch (e: any) {
      console.warn('Failed to load more messages:', e);
    } finally {
      setLoadingMore(false);
    }
  };

  // WhatsApp-style tick component
  const MessageTicks = ({ message }: { message: MessageItem }) => {
    const isMine = message.sender_id === user?.id;
    if (!isMine) return null; // Only show ticks for sent messages

    const isRead = !!message.read_at;
    const isDelivered = !!message.delivered_at;

    // 1 tick = sent, 2 ticks = delivered, 2 orange ticks = read
    const tickColor = isRead ? '#F97316' : '#9CA3AF'; // Primary color if read, gray if not
    const tickCount = isDelivered ? 2 : 1;

    return (
      <View style={styles.tickContainer}>
        {tickCount === 1 ? (
          <Text style={[styles.tick, { color: tickColor }]}>✓</Text>
        ) : (
          <>
            <Text style={[styles.tick, { color: tickColor }]}>✓</Text>
            <Text style={[styles.tick, { color: tickColor, marginLeft: -4 }]}>✓</Text>
          </>
        )}
      </View>
    );
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
          <View
            style={[
              styles.timestampRow,
              isMine ? styles.timestampRowMine : styles.timestampRowTheirs,
            ]}
          >
            <Text
              style={[
                styles.timestamp,
                isMine ? styles.timestampMine : styles.timestampTheirs,
              ]}
            >
              {timeLabel}
            </Text>
            {isMine && <MessageTicks message={item} />}
          </View>
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
              data={[...messages, ...pendingMessages]}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              onContentSizeChange={scrollToBottom}
              showsVerticalScrollIndicator={false}
              onScroll={(event) => {
                const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
                if (contentOffset.y < 200 && hasMoreMessages && !loadingMore && messages.length > 0) {
                  loadMoreMessages();
                }
              }}
              scrollEventThrottle={400}
              ListHeaderComponent={
                loadingMore ? (
                  <View style={styles.loadingMoreContainer}>
                    <ActivityIndicator size="small" color="#9CA3AF" />
                  </View>
                ) : null
              }
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

        {/* Conversation Options Menu Modal */}
        <Modal
          visible={showMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowMenu(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowMenu(false)}
          >
            <View style={styles.menuContainer} onStartShouldSetResponder={() => true}>
              <View style={styles.menuHeader}>
                <Text style={styles.menuTitle}>Conversation options</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowMenu(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  navigation.navigate('ViewUserProfile', { userId: otherUserId });
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.menuItemText}>View profile</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuItem, styles.menuItemDestructive]}
                onPress={handleUnmatch}
                activeOpacity={0.7}
              >
                <Text style={[styles.menuItemText, styles.menuItemTextDestructive]}>
                  Unmatch
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuItem, styles.menuItemDestructive]}
                onPress={handleBlock}
                activeOpacity={0.7}
              >
                <Text style={[styles.menuItemText, styles.menuItemTextDestructive]}>Block</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuItem, styles.menuItemDestructive, styles.menuItemLast]}
                onPress={() => {
                  setShowMenu(false);
                  setShowReportModal(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.menuItemText, styles.menuItemTextDestructive]}>Report</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Report Modal */}
        <Modal
          visible={showReportModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowReportModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowReportModal(false)}
          >
            <View style={styles.reportModalContainer} onStartShouldSetResponder={() => true}>
              <View style={styles.reportModalHeader}>
                <Text style={styles.reportModalTitle}>Report user</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => {
                    setShowReportModal(false);
                    setReportReason(null);
                    setReportDescription('');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.reportModalSubtitle}>
                Why are you reporting {otherUserName}?
              </Text>

              <View style={styles.reportReasonsContainer}>
                {reportReasons.map((reason) => (
                  <TouchableOpacity
                    key={reason.value}
                    style={[
                      styles.reportReasonButton,
                      reportReason === reason.value && styles.reportReasonButtonSelected,
                    ]}
                    onPress={() => setReportReason(reason.value)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.reportReasonText,
                        reportReason === reason.value && styles.reportReasonTextSelected,
                      ]}
                    >
                      {reason.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {reportReason === 'other' && (
                <TextInput
                  style={styles.reportDescriptionInput}
                  placeholder="Please provide more details..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={4}
                  value={reportDescription}
                  onChangeText={setReportDescription}
                  maxLength={500}
                />
              )}

              <TouchableOpacity
                style={[
                  styles.reportSubmitButton,
                  (!reportReason || submittingReport) && styles.reportSubmitButtonDisabled,
                ]}
                onPress={handleReport}
                disabled={!reportReason || submittingReport}
                activeOpacity={0.8}
              >
                {submittingReport ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.reportSubmitButtonText}>Submit report</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
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
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  timestampRowMine: {
    justifyContent: 'flex-end',
  },
  timestampRowTheirs: {
    justifyContent: 'flex-start',
  },
  timestamp: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  timestampMine: {
    textAlign: 'right',
  },
  timestampTheirs: {
    textAlign: 'left',
  },
  tickContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  tick: {
    fontSize: 14,
    fontWeight: '600',
  },
  loadingMoreContainer: {
    paddingVertical: 12,
    alignItems: 'center',
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '85%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#6B7280',
    fontWeight: '600',
  },
  menuItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuItemDestructive: {
    borderBottomColor: '#FEE2E2',
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  menuItemTextDestructive: {
    color: '#DC2626',
  },
  // Report modal styles
  reportModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  reportModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  reportModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  reportModalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  reportReasonsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  reportReasonButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  reportReasonButtonSelected: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F97316',
  },
  reportReasonText: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  reportReasonTextSelected: {
    color: '#F97316',
    fontWeight: '600',
  },
  reportDescriptionInput: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 14,
    color: '#111827',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  reportSubmitButton: {
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportSubmitButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  reportSubmitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
