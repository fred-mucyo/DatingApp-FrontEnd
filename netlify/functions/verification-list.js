const { createClient } = require('@supabase/supabase-js');

const ALLOWED_EMAILS = new Set(['mucyofred00@gmail.com', 'omutimahelpcenter@gmail.com']);

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, authorization',
  },
  body: JSON.stringify(body),
});

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, authorization' }, body: 'ok' };
  }

  const user = context && context.clientContext && context.clientContext.user;
  const email = user && user.email;
  if (!email) return json(401, { error: 'Unauthorized' });
  if (!ALLOWED_EMAILS.has(email)) return json(403, { error: 'Forbidden' });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.PROJECT_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: 'Missing server configuration' });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const status = (event.queryStringParameters && event.queryStringParameters.status) || 'pending';
  const limitRaw = (event.queryStringParameters && event.queryStringParameters.limit) || '50';
  const limit = Math.max(1, Math.min(200, parseInt(limitRaw, 10) || 50));

  const { data, error } = await admin
    .from('verification_requests')
    .select('id, user_id, legal_name, document_type, status, review_notes, id_front_path, id_back_path, selfie_path, created_at, reviewed_at, reviewed_by')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return json(400, { error: error.message });

  return json(200, { requests: data || [] });
};
