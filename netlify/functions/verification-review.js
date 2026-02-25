const { createClient } = require('@supabase/supabase-js');

const ALLOWED_EMAILS = new Set(['mucyofred00@gmail.com', 'omutimahelpcenter@gmail.com']);

const sendExpoPush = async (tokens, payload) => {
  if (!Array.isArray(tokens) || tokens.length === 0) return { ok: true, sent: 0 };

  const messages = tokens
    .filter((t) => typeof t === 'string' && t.startsWith('ExponentPushToken'))
    .map((to) => ({ to, sound: 'default', ...payload }));

  if (messages.length === 0) return { ok: true, sent: 0 };

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Expo push send failed (${res.status}): ${text}`);
  }

  return { ok: true, sent: messages.length };
};

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

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
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

  const requestId = typeof body.requestId === 'string' ? body.requestId : '';
  const decision = body.decision;
  const reviewNotes = typeof body.reviewNotes === 'string' ? body.reviewNotes : null;

  if (!requestId) return json(400, { error: 'requestId required' });
  if (decision !== 'approved' && decision !== 'rejected') {
    return json(400, { error: 'decision must be approved or rejected' });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const { data: reqRow, error: reqErr } = await admin
    .from('verification_requests')
    .select('id, user_id, status')
    .eq('id', requestId)
    .maybeSingle();

  if (reqErr) return json(400, { error: reqErr.message });
  if (!reqRow) return json(404, { error: 'Request not found' });

  const nowIso = new Date().toISOString();

  const { error: updateErr } = await admin
    .from('verification_requests')
    .update({
      status: decision,
      review_notes: reviewNotes,
      reviewed_at: nowIso,
      reviewed_by: email,
    })
    .eq('id', requestId);

  if (updateErr) return json(400, { error: updateErr.message });

  if (decision === 'approved') {
    const { error: pErr } = await admin
      .from('profiles')
      .update({ is_verified: true, verified_at: nowIso })
      .eq('id', reqRow.user_id);

    if (pErr) return json(400, { error: pErr.message });
  }

  if (decision === 'rejected') {
    const { error: pErr } = await admin
      .from('profiles')
      .update({ is_verified: false, verified_at: null })
      .eq('id', reqRow.user_id);

    if (pErr) return json(400, { error: pErr.message });
  }

  // Best-effort: notify user via Expo push (if they registered a token)
  try {
    const { data: tokenRows, error: tErr } = await admin
      .from('push_tokens')
      .select('token')
      .eq('user_id', reqRow.user_id);

    if (!tErr) {
      const tokens = (tokenRows || []).map((r) => r.token);
      const title = decision === 'approved' ? 'Verification approved' : 'Verification rejected';
      const bodyText =
        decision === 'approved'
          ? 'You are now verified.'
          : reviewNotes
            ? `Reason: ${reviewNotes}`
            : 'Please review your documents and try again.';

      await sendExpoPush(tokens, {
        title,
        body: bodyText,
        data: { type: 'verification_review', requestId, decision },
      });
    }
  } catch (e) {
    // Do not fail review if notification fails
    console.log('[verification-review] push notify failed:', e && e.message ? e.message : String(e));
  }

  return json(200, { success: true });
};
