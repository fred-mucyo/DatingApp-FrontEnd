import { supabase } from '../config/supabaseClient';
import { env } from '../config/env';

const safeDelete = async (promiseLike: PromiseLike<{ error: any }>) => {
  try {
    const { error } = await promiseLike;
    if (error) {
      // best-effort; caller decides whether to treat as fatal
    }
  } catch {
    // best-effort
  }
};

export const deleteMyAccount = async (userId: string): Promise<void> => {
  // 1) Delete public data best-effort.
  // Order chosen to reduce FK conflicts in common schemas.
  await safeDelete(supabase.from('push_tokens').delete().eq('user_id', userId));

  await safeDelete(
    supabase
      .from('pre_match_messages')
      .delete()
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
  );

  // messages are linked by match_id; delete by sender_id as a best-effort fallback.
  await safeDelete(supabase.from('messages').delete().eq('sender_id', userId));

  await safeDelete(
    supabase
      .from('matches')
      .delete()
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`),
  );

  await safeDelete(
    supabase
      .from('likes')
      .delete()
      .or(`liker_id.eq.${userId},liked_id.eq.${userId}`),
  );

  await safeDelete(
    supabase
      .from('blocks')
      .delete()
      .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`),
  );

  await safeDelete(supabase.from('reports').delete().eq('reporter_id', userId));

  await safeDelete(supabase.from('profiles').delete().eq('id', userId));

  // 2) Delete auth user (REQUIRES Edge Function).
  // The client cannot securely delete from auth.users.
  if (!env.supabaseAnonKey) {
    throw new Error(
      'Missing Supabase anon key. Set EXPO_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY) and fully restart the app/Metro bundler.',
    );
  }

  if (!env.supabaseUrl) {
    throw new Error(
      'Missing Supabase URL. Set EXPO_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and fully restart the app/Metro bundler.',
    );
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    throw new Error('Not authenticated. Please sign in again and retry.');
  }

  const accessToken = sessionData.session.access_token;
  // A valid Supabase access token is a JWT (typically starts with "eyJ").
  if (typeof accessToken !== 'string' || accessToken.length < 50 || !accessToken.startsWith('eyJ')) {
    throw new Error(
      'Invalid session token. Please sign out, sign in again, then retry Delete Account.',
    );
  }

  const functionUrl = `${env.supabaseUrl.replace(/\/$/, '')}/functions/v1/delete-account`;
  const res = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      'x-client-info': 'delete-account-flow',
    },
    body: JSON.stringify({ user_id: userId }),
  });

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // ignore
  }

  if (!res.ok) {
    const message =
      json?.error ||
      json?.message ||
      `Failed to delete auth account (status ${res.status}).`;
    throw new Error(message);
  }

  // 3) Finally sign out locally.
  await supabase.auth.signOut();
};

export const requestMyDataExport = async (): Promise<{ fileName: string; contents: string }> => {
  if (!env.supabaseAnonKey) {
    throw new Error(
      'Missing Supabase anon key. Set EXPO_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY) and fully restart the app/Metro bundler.',
    );
  }

  if (!env.supabaseUrl) {
    throw new Error(
      'Missing Supabase URL. Set EXPO_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and fully restart the app/Metro bundler.',
    );
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    throw new Error('Not authenticated. Please sign in again and retry.');
  }

  const accessToken = sessionData.session.access_token;
  if (typeof accessToken !== 'string' || accessToken.length < 50 || !accessToken.startsWith('eyJ')) {
    throw new Error('Invalid session token. Please sign out, sign in again, then retry.');
  }

  const functionUrl = `${env.supabaseUrl.replace(/\/$/, '')}/functions/v1/export-data`;
  const res = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      'x-client-info': 'export-data-flow',
    },
    body: JSON.stringify({}),
  });

  const contentDisposition = res.headers.get('content-disposition') ?? '';
  const fileNameMatch = /filename="?([^";]+)"?/i.exec(contentDisposition);
  const fileName = fileNameMatch?.[1] ?? `mutima-data-export.json`;

  const contents = await res.text();

  if (!res.ok) {
    let message = `Failed to request data export (status ${res.status}).`;
    try {
      const parsed = JSON.parse(contents);
      message = parsed?.error || parsed?.message || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return { fileName, contents };
};
