import { supabase } from '../config/supabaseClient';

export interface IncomingLikeProfile {
  like_id: string;
  user_id: string;
  name: string | null;
  age: number | null;
  city: string | null;
  country: string | null;
  profile_photos: string[] | null;
  is_verified?: boolean | null;
}

export const fetchIncomingLikes = async (
  currentUserId: string,
  limit?: number,
  offset = 0,
): Promise<IncomingLikeProfile[]> => {
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

  let query = supabase
    .from('likes')
    .select('id, liker:profiles!likes_liker_id_fkey(id, name, age, city, country, profile_photos, photos, is_verified)')
    .eq('liked_id', currentUserId)
    .order('created_at', { ascending: false });

  if (typeof limit === 'number') {
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error } = await query;

  if (error) throw error;

  const rows = (data as any[]) ?? [];
  return rows
    .map((row) => {
      const liker = row.liker;
      if (!liker) {
        // If the liker profile no longer exists or is null, skip this row.
        return null;
      }

      if (blockedOtherUserIds.has(liker.id as string)) {
        return null;
      }

      const rawProfilePhotos = (liker.profile_photos as string[] | null | undefined) ?? null;
      const rawPhotos = (liker.photos as string[] | null | undefined) ?? null;
      const resolvedPhotos =
        (Array.isArray(rawProfilePhotos) && rawProfilePhotos.length > 0 && rawProfilePhotos) ||
        (Array.isArray(rawPhotos) && rawPhotos.length > 0 && rawPhotos) ||
        null;

      return {
        like_id: row.id as string,
        user_id: liker.id as string,
        name: (liker.name as string) ?? null,
        age: (liker.age as number) ?? null,
        city: (liker.city as string) ?? null,
        country: (liker.country as string) ?? null,
        profile_photos: resolvedPhotos,
        is_verified: (liker.is_verified as boolean) ?? null,
      } as IncomingLikeProfile;
    })
    .filter((item): item is IncomingLikeProfile => item !== null);
};

export const likeBackAndRemove = async (currentUserId: string, otherUserId: string, likeId: string) => {
  const { error: likeError } = await supabase.from('likes').insert({
    liker_id: currentUserId,
    liked_id: otherUserId,
  });
  if (likeError) throw likeError;

  // Remove the original like so it no longer appears in the incoming likes list
  await supabase.from('likes').delete().eq('id', likeId);
};

export const denyLike = async (likeId: string) => {
  // Simply delete the like so it no longer appears
  const { error } = await supabase.from('likes').delete().eq('id', likeId);
  if (error) throw error;
};
