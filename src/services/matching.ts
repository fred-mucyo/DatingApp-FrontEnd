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
  is_verified?: boolean;
  score: number;
}

interface CachedSuggestions {
  generatedAt: string; // ISO date
  profiles: SuggestionProfile[];
}

const normalizePhotosField = (value: unknown): string[] => {
  const extractOne = (v: unknown): string | null => {
    if (!v) return null;
    if (typeof v === 'string') {
      const t = v.trim();
      return t ? t : null;
    }

    if (typeof v === 'object') {
      const anyV = v as any;
      const candidate =
        (typeof anyV.secure_url === 'string' && anyV.secure_url) ||
        (typeof anyV.url === 'string' && anyV.url) ||
        (typeof anyV.uri === 'string' && anyV.uri) ||
        (typeof anyV.path === 'string' && anyV.path) ||
        null;
      if (candidate && typeof candidate === 'string') {
        const t = candidate.trim();
        return t ? t : null;
      }
    }

    return null;
  };

  if (!value) return [];

  if (Array.isArray(value)) {
    const out: string[] = [];
    for (const entry of value) {
      const one = extractOne(entry);
      if (one) out.push(one);
    }
    return out;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    // Sometimes arrays are stored/returned as JSON strings.
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          const out: string[] = [];
          for (const entry of parsed) {
            const one = extractOne(entry);
            if (one) out.push(one);
          }
          return out;
        }
      } catch {
        // ignore
      }
    }

    // Otherwise treat as a single URL.
    return [trimmed];
  }

  const one = extractOne(value);
  return one ? [one] : [];
};

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
// Supports pagination with offset
const fetchLooseSuggestions = async (limit = 20, offset = 0): Promise<SuggestionProfile[]> => {
  const { data: sessionData, error: sErr } = await supabase.auth.getSession();
  if (sErr || !sessionData.session) throw new Error('Not authenticated');
  const me = sessionData.session.user.id;

  // Run the independent reads in parallel to minimize latency.
  const [myProfileRes, likesRes, blocksRes, passedIds] = await Promise.all([
    supabase
      .from('profiles')
      .select('gender, gender_preference, city, country, relationship_goal, interests')
      .eq('id', me)
      .maybeSingle(),
    supabase.from('likes').select('liked_id').eq('liker_id', me),
    supabase
      .from('blocks')
      .select('blocker_id, blocked_id')
      .or(`blocker_id.eq.${me},blocked_id.eq.${me}`),
    getPassedProfileIds(me),
  ]);

  const myProfile = myProfileRes?.data ?? null;

  const likedIds = ((likesRes.data as any[]) ?? [])
    .map((row) => row.liked_id as string | null)
    .filter((id): id is string => !!id);

  const blockedOtherIds: string[] = [];
  for (const row of (blocksRes.data as any[]) ?? []) {
    const blocker = row.blocker_id as string;
    const blocked = row.blocked_id as string;
    const other = blocker === me ? blocked : blocker;
    if (other) blockedOtherIds.push(other);
  }

  const passedList = (passedIds ?? []).filter((id) => typeof id === 'string');

  const toQuotedInList = (ids: string[]) => `(${ids.map((id) => `"${id}"`).join(',')})`;

  const myGenderPref = (myProfile as any)?.gender_preference as string | null;
  const strictGenderPref =
    myGenderPref === 'male' || myGenderPref === 'female' || myGenderPref === 'other' ? myGenderPref : null;

  let profilesQuery = supabase
    .from('profiles')
    .select(
      'id, name, age, gender, gender_preference, city, country, relationship_goal, bio, interests, profile_photos, photos, is_verified',
    )
    .neq('id', me)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (strictGenderPref) {
    profilesQuery = profilesQuery.eq('gender', strictGenderPref);
  }

  if (likedIds.length > 0) {
    profilesQuery = profilesQuery.not('id', 'in', toQuotedInList(likedIds));
  }
  if (blockedOtherIds.length > 0) {
    profilesQuery = profilesQuery.not('id', 'in', toQuotedInList(blockedOtherIds));
  }
  if (passedList.length > 0) {
    profilesQuery = profilesQuery.not('id', 'in', toQuotedInList(passedList));
  }

  const { data: profilesPage, error: profilesErr } = await profilesQuery;
  if (profilesErr) throw profilesErr;

  const rawCandidates = (profilesPage as any[]) ?? [];
  const candidates = rawCandidates.map((p) => {
    const rawProfilePhotos = (p as any).profile_photos as unknown;
    const rawPhotos = (p as any).photos as unknown;

    const profilePhotos = normalizePhotosField(rawProfilePhotos);
    const photos = normalizePhotosField(rawPhotos);

    const resolvedPhotos = profilePhotos.length > 0 ? profilePhotos : photos.length > 0 ? photos : null;

    return {
      ...(p as any),
      profile_photos: resolvedPhotos,
    } as SuggestionProfile;
  });

  const myCity = (myProfile as any)?.city as string | null;
  const myCountry = (myProfile as any)?.country as string | null;
  const myGoal = (myProfile as any)?.relationship_goal as string | null;
  const myGenderPrefForScore = myGenderPref;

  const scored = candidates.map((p) => {
    let score = 0;
    if (myCity && p.city === myCity) score += 4;
    if (!score && myCountry && p.country === myCountry) score += 2;
    if (myGoal && p.relationship_goal === myGoal) score += 1;
    if (myGenderPrefForScore && p.gender === myGenderPrefForScore) score += 1;
    return { profile: p as SuggestionProfile, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.profile);
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
  // Load all suggestions at once (scoring requires all candidates)
  const profiles = await fetchLooseSuggestions(limit, 0);
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
