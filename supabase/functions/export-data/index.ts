import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-authorization',
};

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const fileResponse = (fileName: string, json: string) =>
  new Response(json, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });

const getRequiredEnv = (key: string) => {
  const v = Deno.env.get(key);
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const supabaseUrl = getRequiredEnv('PROJECT_URL');
    const serviceRoleKey = getRequiredEnv('SERVICE_ROLE_KEY');

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) {
      return jsonResponse(401, { error: 'Missing Authorization header' });
    }

    const userClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonResponse(401, { error: 'Invalid token' });
    }

    const userId = userData.user.id;
    const userEmail = userData.user.email;
    if (!userEmail) {
      return jsonResponse(400, { error: 'Missing user email' });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const [profileRes, likesRes, matchesRes, messagesRes, blocksRes, reportsRes, preMatchRes] =
      await Promise.all([
        admin.from('profiles').select('*').eq('id', userId).maybeSingle(),
        admin.from('likes').select('*').or(`liker_id.eq.${userId},liked_id.eq.${userId}`),
        admin.from('matches').select('*').or(`user1_id.eq.${userId},user2_id.eq.${userId}`),
        admin.from('messages').select('*').eq('sender_id', userId),
        admin.from('blocks').select('*').or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`),
        admin.from('reports').select('*').eq('reporter_id', userId),
        admin
          .from('pre_match_messages')
          .select('*')
          .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
      ]);

    const exportPayload = {
      generated_at: new Date().toISOString(),
      user: { id: userId, email: userEmail },
      profile: profileRes.data ?? null,
      likes: likesRes.data ?? [],
      matches: matchesRes.data ?? [],
      messages: messagesRes.data ?? [],
      blocks: blocksRes.data ?? [],
      reports: reportsRes.data ?? [],
      pre_match_messages: preMatchRes.data ?? [],
    };

    const json = JSON.stringify(exportPayload, null, 2);
    const safeDate = new Date().toISOString().slice(0, 10);
    const fileName = `mutima-data-export-${safeDate}.json`;
    return fileResponse(fileName, json);
  } catch (e) {
    return jsonResponse(500, { error: e instanceof Error ? e.message : String(e) });
  }
});
