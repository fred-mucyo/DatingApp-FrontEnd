import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabaseClient';

const DAILY_SUGGESTIONS_KEY = 'matching.daily_suggestions';

export interface SuggestionProfile {
  id: string;
  name: string;
  age: number;
  gender: string;
  gender_preference: string;
  city: string;
  country: string;
  relationship_goal: string;
  bio: string | null;
  interests: string[] | null;
  profile_photos: string[] | null;
  score: number;
}

interface CachedSuggestions {
  generatedAt: string; // ISO date
  profiles: SuggestionProfile[];
}

export const fetchSuggestionsRpc = async (
  ageWindow = 5,
  limit = 20,
): Promise<SuggestionProfile[]> => {
  const { data: sessionData, error: sErr } = await supabase.auth.getSession();
  if (sErr || !sessionData.session) throw new Error('Not authenticated');
  const userId = sessionData.session.user.id;

  const { data, error } = await supabase.rpc('get_suggestions', {
    p_user_id: userId,
    p_age_window: ageWindow,
    p_limit: limit,
  });

  if (error) throw error;
  return (data as SuggestionProfile[]) ?? [];
};

export const getDailySuggestions = async (
  ageWindow = 5,
  limit = 20,
): Promise<SuggestionProfile[]> => {
  const today = new Date().toISOString().substring(0, 10); // YYYY-MM-DD
  const raw = await AsyncStorage.getItem(DAILY_SUGGESTIONS_KEY);

  if (raw) {
    try {
      const parsed: CachedSuggestions = JSON.parse(raw);
      if (parsed.generatedAt === today) {
        return parsed.profiles;
      }
    } catch {
      // ignore and regenerate
    }
  }

  const profiles = await fetchSuggestionsRpc(ageWindow, limit);
  const payload: CachedSuggestions = {
    generatedAt: today,
    profiles,
  };
  await AsyncStorage.setItem(DAILY_SUGGESTIONS_KEY, JSON.stringify(payload));
  return profiles;
};

export const clearDailySuggestionsCache = async () => {
  await AsyncStorage.removeItem(DAILY_SUGGESTIONS_KEY);
};

export const sendLike = async (targetProfileId: string) => {
  const { data: sessionData, error: sErr } = await supabase.auth.getSession();
  if (sErr || !sessionData.session) throw new Error('Not authenticated');
  const me = sessionData.session.user.id;

  const { error: likeError } = await supabase.from('likes').insert({
    liker_id: me,
    liked_id: targetProfileId,
  });
  if (likeError) throw likeError;

  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('*')
    .or(
      `and(user1_id.eq.${me},user2_id.eq.${targetProfileId}),and(user1_id.eq.${targetProfileId},user2_id.eq.${me})`,
    )
    .maybeSingle();

  if (matchError) throw matchError;

  const isMatch = !!match;
  return { isMatch, match };
};
