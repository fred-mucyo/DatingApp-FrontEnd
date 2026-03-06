import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabaseClient';

const MESSAGE_COUNT_KEY_PREFIX = 'message_count_';

export interface MatchItem {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
  other_user_id: string;
  other_user_name: string;
  other_user_age: number | null;
  other_user_date_of_birth?: string | null;
  other_user_photo: string | null;
  other_user_is_verified?: boolean | null;
  last_message_content: string | null;
  last_message_created_at: string | null;
  last_message_sender_id: string | null;
  last_message_delivered_at: string | null;
  last_message_read_at: string | null;
}

export interface ChatMessage {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
}

export interface PreMatchMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
}

export const DAILY_MESSAGE_LIMIT = 50;

const todayKey = () => new Date().toISOString().substring(0, 10); // YYYY-MM-DD

export const getMessageCountToday = async (userId: string): Promise<number> => {
  const key = `${MESSAGE_COUNT_KEY_PREFIX}${userId}_${todayKey()}`;
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as { count: number; date: string };
    if (parsed.date !== todayKey()) return 0;
    return parsed.count ?? 0;
  } catch {
    return 0;
  }
};

export const incrementMessageCount = async (userId: string): Promise<void> => {
  const key = `${MESSAGE_COUNT_KEY_PREFIX}${userId}_${todayKey()}`;
  const current = await getMessageCountToday(userId);
  const payload = { date: todayKey(), count: current + 1 };
  await AsyncStorage.setItem(key, JSON.stringify(payload));
};

export const verifyMatchExists = async (
  currentUserId: string,
  otherUserId: string,
): Promise<MatchItem | null> => {
  const { data, error } = await supabase
    .from('matches')
    .select('*, user1:profiles!matches_user1_id_fkey(*), user2:profiles!matches_user2_id_fkey(*)')
    .or(
      `and(user1_id.eq.${currentUserId},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${currentUserId})`,
    )
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const match = data as any;
  const other = match.user1_id === currentUserId ? match.user2 : match.user1;

  const rawProfilePhotos = other.profile_photos as string[] | null | undefined;
  const rawPhotos = (other as any).photos as string[] | null | undefined;
  const otherPhoto =
    (Array.isArray(rawProfilePhotos) && rawProfilePhotos[0]) ||
    (Array.isArray(rawPhotos) && rawPhotos[0]) ||
    null;

  return {
    id: match.id,
    user1_id: match.user1_id,
    user2_id: match.user2_id,
    created_at: match.created_at,
    other_user_id: other.id,
    other_user_name: other.name,
    other_user_age: other.age ?? null,
    other_user_date_of_birth: (other as any).date_of_birth ?? null,
    other_user_photo: otherPhoto,
    last_message_content: null,
    last_message_created_at: null,
    last_message_sender_id: null,
    last_message_delivered_at: null,
    last_message_read_at: null,
  };
};

export const fetchMatchesWithLastMessage = async (currentUserId: string): Promise<MatchItem[]> => {
  const { data, error } = await supabase
    .from('matches')
    .select('id, user1_id, user2_id, created_at, user1:profiles!matches_user1_id_fkey(*), user2:profiles!matches_user2_id_fkey(*)')
    .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  const matches = (data as any[]) ?? [];

  if (matches.length === 0) return [];

  const matchIds = matches.map((m) => m.id as string).filter(Boolean);

  // Fetch blocks once and filter matches client-side.
  const { data: blocksRes } = await supabase
    .from('blocks')
    .select('blocker_id, blocked_id')
    .or(`blocker_id.eq.${currentUserId},blocked_id.eq.${currentUserId}`);

  const blockedOtherUserIds = new Set<string>();
  for (const row of (blocksRes as any[]) ?? []) {
    const blocker = row.blocker_id as string;
    const blocked = row.blocked_id as string;
    const otherId = blocker === currentUserId ? blocked : blocker;
    if (otherId) blockedOtherUserIds.add(otherId);
  }

  // Fetch a batch of recent messages across all matches. We then pick the newest per match.
  // This avoids 1 query per match while keeping payload bounded.
  const messageFetchLimit = Math.min(500, Math.max(50, matchIds.length * 10));
  const { data: messagesRes } = await supabase
    .from('messages')
    .select('match_id, content, created_at, sender_id, delivered_at, read_at')
    .in('match_id', matchIds)
    .order('created_at', { ascending: false })
    .limit(messageFetchLimit);

  const lastMessageByMatchId = new Map<string, any>();
  for (const msg of (messagesRes as any[]) ?? []) {
    const mid = msg.match_id as string;
    if (mid && !lastMessageByMatchId.has(mid)) {
      lastMessageByMatchId.set(mid, msg);
    }
  }

  const result: MatchItem[] = [];

  for (const m of matches) {
    const other = m.user1_id === currentUserId ? m.user2 : m.user1;
    if (!other?.id) continue;
    if (blockedOtherUserIds.has(other.id as string)) continue;

    const rawProfilePhotos = other.profile_photos as string[] | null | undefined;
    const rawPhotos = (other as any).photos as string[] | null | undefined;
    const otherPhoto =
      (Array.isArray(rawProfilePhotos) && rawProfilePhotos[0]) ||
      (Array.isArray(rawPhotos) && rawPhotos[0]) ||
      null;

    const lastMsg = lastMessageByMatchId.get(m.id as string) ?? null;

    result.push({
      id: m.id,
      user1_id: m.user1_id,
      user2_id: m.user2_id,
      created_at: m.created_at,
      other_user_id: other.id,
      other_user_name: other.name,
      other_user_age: other.age ?? null,
      other_user_date_of_birth: (other as any).date_of_birth ?? null,
      other_user_photo: otherPhoto,
      other_user_is_verified: (other as any).is_verified ?? null,
      last_message_content: lastMsg?.content ?? null,
      last_message_created_at: lastMsg?.created_at ?? null,
      last_message_sender_id: lastMsg?.sender_id ?? null,
      last_message_delivered_at: lastMsg?.delivered_at ?? null,
      last_message_read_at: lastMsg?.read_at ?? null,
    });
  }

  // Sort by last message time (or match created_at if no messages)
  return result.sort((a, b) => {
    const aTime = a.last_message_created_at ?? a.created_at;
    const bTime = b.last_message_created_at ?? b.created_at;
    return aTime < bTime ? 1 : aTime > bTime ? -1 : 0;
  });
};

export const fetchMessages = async (
  matchId: string,
  limit = 50,
  offset = 0,
): Promise<ChatMessage[]> => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  // Reverse to show oldest first (ascending order)
  return ((data as ChatMessage[]) ?? []).reverse();
};

// Optimized: Fetch only recent messages initially
export const fetchRecentMessages = async (
  matchId: string,
  limit = 20,
): Promise<ChatMessage[]> => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  // Reverse to show oldest first
  return ((data as ChatMessage[]) ?? []).reverse();
};

// --- Pre-match messaging helpers ---

/**
 * Check whether the current user has already sent a pre-match message
 * to the given receiver. This relies on a `pre_match_messages` table
 * in Supabase with at least sender_id, receiver_id, content, created_at.
 */
export const hasSentPreMatchMessage = async (
  senderId: string,
  receiverId: string,
): Promise<boolean> => {
  const { data, error } = await supabase
    .from('pre_match_messages')
    .select('id')
    .eq('sender_id', senderId)
    .eq('receiver_id', receiverId)
    .limit(1)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return !!data;
};

/**
 * Send a single pre-match message from sender to receiver.
 * Enforces one-message-per-sender/receiver pair in app logic.
 */
export const sendPreMatchMessage = async (
  senderId: string,
  receiverId: string,
  content: string,
): Promise<PreMatchMessage> => {
  const trimmed = (content ?? '').trim();
  if (!trimmed) {
    throw new Error('Message cannot be empty.');
  }

  // Basic length guard to avoid abuse
  if (trimmed.length > 500) {
    throw new Error('Message is too long. Please keep it under 500 characters.');
  }

  // Enforce one pre-match message per sender/receiver in app logic
  const alreadySent = await hasSentPreMatchMessage(senderId, receiverId);
  if (alreadySent) {
    throw new Error('You have already sent a message to this person.');
  }

  const { data, error } = await supabase
    .from('pre_match_messages')
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      content: trimmed,
    })
    .select('*')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as PreMatchMessage;
};

export const fetchMessagesLastMinute = async (
  userId: string,
  matchId: string,
): Promise<ChatMessage[]> => {
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('match_id', matchId)
    .eq('sender_id', userId)
    .gte('created_at', oneMinuteAgo);

  if (error) throw error;
  return (data as ChatMessage[]) ?? [];
};

export const sendChatMessage = async (
  userId: string,
  matchId: string,
  content: string,
): Promise<ChatMessage> => {
  const trimmed = (content ?? '').trim();
  if (!trimmed) throw new Error('Message cannot be empty');

  const countToday = await getMessageCountToday(userId);
  if (countToday >= DAILY_MESSAGE_LIMIT) {
    throw new Error("You've sent your daily limit of messages. Try again tomorrow.");
  }

  const recent = await fetchMessagesLastMinute(userId, matchId);
  if (recent.length >= 10) {
    throw new Error('You have sent too many messages in a short time. Please wait.');
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      match_id: matchId,
      sender_id: userId,
      content: trimmed,
      delivered_at: null,
      read_at: null,
    })
    .select('*')
    .single();

  if (error) throw error;

  await incrementMessageCount(userId);
  return data as ChatMessage;
};

// Mark messages as delivered when recipient opens chat
export const markMessagesAsDelivered = async (
  matchId: string,
  recipientId: string,
): Promise<void> => {
  const { error } = await supabase
    .from('messages')
    .update({ delivered_at: new Date().toISOString() })
    .eq('match_id', matchId)
    .neq('sender_id', recipientId) // Only mark messages NOT sent by recipient
    .is('delivered_at', null); // Only update if not already delivered

  if (error) {
    console.warn('Failed to mark messages as delivered:', error);
    // Don't throw - this is not critical
  }
};

// Mark messages as read when recipient views them
export const markMessagesAsRead = async (
  matchId: string,
  recipientId: string,
): Promise<void> => {
  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('match_id', matchId)
    .neq('sender_id', recipientId) // Only mark messages NOT sent by recipient
    .is('read_at', null); // Only update if not already read

  if (error) {
    console.warn('Failed to mark messages as read:', error);
    // Don't throw - this is not critical
  }
};
