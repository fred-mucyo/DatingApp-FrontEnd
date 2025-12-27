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
  other_user_photo: string | null;
  last_message_content: string | null;
  last_message_created_at: string | null;
}

export interface ChatMessage {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
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
    other_user_photo: otherPhoto,
    last_message_content: null,
    last_message_created_at: null,
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

  const result: MatchItem[] = [];

  for (const m of matches) {
    const other = m.user1_id === currentUserId ? m.user2 : m.user1;

    const rawProfilePhotos = other.profile_photos as string[] | null | undefined;
    const rawPhotos = (other as any).photos as string[] | null | undefined;
    const otherPhoto =
      (Array.isArray(rawProfilePhotos) && rawProfilePhotos[0]) ||
      (Array.isArray(rawPhotos) && rawPhotos[0]) ||
      null;

    // Skip blocked relationships (either direction)
    const { data: blocked } = await supabase
      .from('blocks')
      .select('id')
      .or(
        `and(blocker_id.eq.${currentUserId},blocked_id.eq.${other.id}),and(blocker_id.eq.${other.id},blocked_id.eq.${currentUserId})`,
      )
      .limit(1)
      .maybeSingle();

    if (blocked) continue;

    // fetch last message for this match
    const { data: lastMsg } = await supabase
      .from('messages')
      .select('id, content, created_at')
      .eq('match_id', m.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    result.push({
      id: m.id,
      user1_id: m.user1_id,
      user2_id: m.user2_id,
      created_at: m.created_at,
      other_user_id: other.id,
      other_user_name: other.name,
      other_user_age: other.age ?? null,
      other_user_photo: otherPhoto,
      last_message_content: lastMsg?.content ?? null,
      last_message_created_at: lastMsg?.created_at ?? null,
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
): Promise<ChatMessage[]> => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data as ChatMessage[]) ?? [];
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
  const trimmed = content.trim();
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
): Promise<void> => {
  const trimmed = content.trim();
  if (!trimmed) return;

  const countToday = await getMessageCountToday(userId);
  if (countToday >= DAILY_MESSAGE_LIMIT) {
    throw new Error("You've sent your daily limit of messages. Try again tomorrow.");
  }

  const recent = await fetchMessagesLastMinute(userId, matchId);
  if (recent.length >= 10) {
    throw new Error('You have sent too many messages in a short time. Please wait.');
  }

  const { error } = await supabase.from('messages').insert({
    match_id: matchId,
    sender_id: userId,
    content: trimmed,
  });

  if (error) throw error;

  await incrementMessageCount(userId);
};
