import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: any) => any) => void;
};

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

const getRequiredEnv = (key: string) => {
  const v = Deno.env.get(key);
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
};

const BUCKET = 'verification-docs';

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

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const nowIso = new Date().toISOString();

    const { data: rows, error: qErr } = await admin
      .from('verification_requests')
      .select('id, user_id, id_front_path, id_back_path, selfie_path')
      .lte('documents_delete_after', nowIso)
      .is('documents_deleted_at', null)
      .not('documents_delete_after', 'is', null)
      .limit(200);

    if (qErr) {
      return jsonResponse(400, { error: qErr.message });
    }

    const requests = (rows as any[]) ?? [];

    let deletedRequests = 0;
    let deletedFiles = 0;

    for (const r of requests) {
      const paths = [r.id_front_path, r.id_back_path, r.selfie_path]
        .filter((p: any) => typeof p === 'string' && p.length > 0);

      if (paths.length > 0) {
        const { error: delErr } = await admin.storage.from(BUCKET).remove(paths);
        if (!delErr) {
          deletedFiles += paths.length;
        }
      }

      const { error: uErr } = await admin
        .from('verification_requests')
        .update({ documents_deleted_at: nowIso })
        .eq('id', r.id);

      if (!uErr) {
        deletedRequests += 1;
      }
    }

    return jsonResponse(200, {
      success: true,
      scanned: requests.length,
      deleted_requests: deletedRequests,
      deleted_files: deletedFiles,
    });
  } catch (e) {
    return jsonResponse(500, { error: e instanceof Error ? e.message : String(e) });
  }
});
