const { createClient } = require('@supabase/supabase-js');

const ALLOWED_EMAILS = new Set(['mucyofred00@gmail.com', 'omutimahelpcenter@gmail.com']);
const BUCKET = 'verification-docs';

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

  let body;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const paths = Array.isArray(body.paths) ? body.paths.filter((p) => typeof p === 'string' && p.length > 0) : [];
  if (paths.length === 0) return json(400, { error: 'paths[] required' });

  const expiresIn = Math.max(60, Math.min(3600, Number(body.expiresIn || 600)));

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const results = {};
  for (const p of paths) {
    const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(p, expiresIn);
    if (error) {
      results[p] = { error: error.message };
    } else {
      results[p] = { url: data.signedUrl };
    }
  }

  return json(200, { results });
};
