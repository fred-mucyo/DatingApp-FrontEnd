import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabaseClient';

const DAILY_SUGGESTIONS_KEY = 'matching.daily_suggestions';
const PASSED_IDS_KEY = 'matching.passed_ids';

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

// Very small helper: read list of profile ids the user has explicitly passed on (locally, per user).
const getPassedProfileIds = async (userId: string): Promise<string[]> => {
  const raw = await AsyncStorage.getItem(`${PASSED_IDS_KEY}:${userId}`);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// Mark a profile as passed so we can avoid suggesting it again (per user).
export const markProfilePassed = async (profileId: string): Promise<void> => {
  const { data: sessionData, error: sErr } = await supabase.auth.getSession();
  if (sErr || !sessionData.session) return;
  const userId = sessionData.session.user.id;

  const existing = await getPassedProfileIds(userId);
  if (existing.includes(profileId)) return;
  const next = [...existing, profileId];
  await AsyncStorage.setItem(`${PASSED_IDS_KEY}:${userId}`, JSON.stringify(next));
};

// Fetch a broad set of candidate profiles and apply *only* minimal filtering
// (self, blocked users, liked users, and locally passed users). Preferences
// like gender/location are used only for simple ordering, not to exclude.
const fetchLooseSuggestions = async (limit = 20): Promise<SuggestionProfile[]> => {
  const { data: sessionData, error: sErr } = await supabase.auth.getSession();
  if (sErr || !sessionData.session) throw new Error('Not authenticated');
  const me = sessionData.session.user.id;

  // Load current user's profile so we can order (not filter) by preferences.
  const { data: myProfile } = await supabase
    .from('profiles')
    .select('gender, gender_preference, city, country, relationship_goal, interests')
    .eq('id', me)
    .maybeSingle();

  const [profilesRes, likesRes, blocksRes, passedIds] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'id, name, age, gender, gender_preference, city, country, relationship_goal, bio, interests, profile_photos',
      ),
    supabase.from('likes').select('liked_id').eq('liker_id', me),
    supabase
      .from('blocks')
      .select('blocker_id, blocked_id')
      .or(`blocker_id.eq.${me},blocked_id.eq.${me}`),
    getPassedProfileIds(me),
  ]);

  const allProfiles = (profilesRes.data as any[]) ?? [];
  const likedIds = new Set(
    ((likesRes.data as any[]) ?? [])
      .map((row) => row.liked_id as string | null)
      .filter((id): id is string => !!id),
  );

  const blockedIds = new Set<string>();
  for (const row of (blocksRes.data as any[]) ?? []) {
    const blocker = row.blocker_id as string;
    const blocked = row.blocked_id as string;
    const other = blocker === me ? blocked : blocker;
    if (other) blockedIds.add(other);
  }

  const passedSet = new Set<string>(passedIds ?? []);

  const filtered = allProfiles.filter((p) => {
    const id = p.id as string;
    if (!id || id === me) return false;
    if (likedIds.has(id)) return false;
    if (blockedIds.has(id)) return false;
    if (passedSet.has(id)) return false;
    return true;
  });

  // If nothing left after minimal filtering, just return everyone except self
  // so the user still sees *something* in a tiny user base.
  const candidates = filtered.length > 0 ? filtered : allProfiles.filter((p) => p.id !== me);

  const myCity = (myProfile as any)?.city as string | null;
  const myCountry = (myProfile as any)?.country as string | null;
  const myGoal = (myProfile as any)?.relationship_goal as string | null;
  const myGenderPref = (myProfile as any)?.gender_preference as string | null;

  const scored = candidates.map((p) => {
    let score = 0;
    if (myCity && p.city === myCity) score += 4;
    if (!score && myCountry && p.country === myCountry) score += 2;
    if (myGoal && p.relationship_goal === myGoal) score += 1;
    if (myGenderPref && p.gender === myGenderPref) score += 1;
    return { profile: p as SuggestionProfile, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.profile);
};

export const getDailySuggestions = async (
  ageWindow = 5,
  limit = 20,
): Promise<SuggestionProfile[]> => {
  const { data: sessionData, error: sErr } = await supabase.auth.getSession();
  if (sErr || !sessionData.session) throw new Error('Not authenticated');
  const userId = sessionData.session.user.id;

  const today = new Date().toISOString().substring(0, 10); // YYYY-MM-DD
  const cacheKey = `${DAILY_SUGGESTIONS_KEY}:${userId}`;
  const raw = await AsyncStorage.getItem(cacheKey);

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

  // Use simplified, availability-first logic instead of strict RPC rules.
  const profiles = await fetchLooseSuggestions(limit);
  const payload: CachedSuggestions = {
    generatedAt: today,
    profiles,
  };
  await AsyncStorage.setItem(cacheKey, JSON.stringify(payload));
  return profiles;
};

export const clearDailySuggestionsCache = async () => {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user.id;
  if (!userId) return;
  await AsyncStorage.removeItem(`${DAILY_SUGGESTIONS_KEY}:${userId}`);
};

export const sendLike = async (targetProfileId: string) => {
  const { data: sessionData, error: sErr } = await supabase.auth.getSession();
  if (sErr || !sessionData.session) throw new Error('Not authenticated');
  const me = sessionData.session.user.id;

  const { data: existing, error: existingError } = await supabase
    .from('likes')
    .select('id')
    .eq('liker_id', me)
    .eq('liked_id', targetProfileId)
    .maybeSingle();

  if (!existing) {
    if (existingError) throw existingError;

    const { error: likeError } = await supabase.from('likes').insert({
      liker_id: me,
      liked_id: targetProfileId,
    });
    if (likeError) throw likeError;
  }

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
