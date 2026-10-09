// Invites the leader of an association by email. Callable by platform admins only.
//
// Body: { email, associationId? , associationName?, redirectTo? }
//   - associationId   : give the leader role on an existing association
//   - associationName : create the association first
//
// A new person receives the Supabase invitation email and sets their password from the
// link. Someone who already has an account gets the role right away, plus a sign-in link.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const authorization = req.headers.get('Authorization') ?? '';

  // Who is calling, checked with their own token.
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData } = await caller.auth.getUser(authorization.replace(/^Bearer /i, ''));
  const { data: isAdmin } = await caller.rpc('is_platform_admin');
  if (!userData.user || isAdmin !== true) {
    return json({ error: 'Réservé aux administrateurs de la plateforme.' }, 403);
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const associationId = typeof body?.associationId === 'string' ? body.associationId : null;
  const associationName =
    typeof body?.associationName === 'string' ? body.associationName.trim() : '';
  const redirectTo = typeof body?.redirectTo === 'string' ? body.redirectTo : undefined;

  if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'Adresse email invalide.' }, 400);
  if (!associationId && !associationName) {
    return json({ error: "Choisissez une association ou donnez le nom d'une nouvelle." }, 400);
  }

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  // Association: existing or new.
  let association: { id: string; name: string };
  if (associationId) {
    const { data, error } = await admin
      .from('associations')
      .select('id, name')
      .eq('id', associationId)
      .maybeSingle();
    if (error || !data) return json({ error: 'Association introuvable.' }, 404);
    association = data;
  } else {
    const { data, error } = await admin
      .from('associations')
      .insert({ name: associationName })
      .select('id, name')
      .single();
    if (error) return json({ error: error.message }, 500);
    association = data;
  }
  const rollback = async () => {
    if (!associationId) await admin.from('associations').delete().eq('id', association.id);
  };

  // Account: existing or invited.
  const { data: existingId, error: lookupError } = await admin.rpc('user_id_by_email', {
    p_email: email,
  });
  if (lookupError) {
    await rollback();
    return json({ error: lookupError.message }, 500);
  }

  let userId: string = existingId;
  let emailSent: boolean;
  if (!existingId) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (error || !data.user) {
      await rollback();
      return json({ error: error?.message ?? "L'invitation n'a pas pu être envoyée." }, 502);
    }
    userId = data.user.id;
    emailSent = true;
  } else {
    const { error } = await caller.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
    });
    emailSent = !error;
  }

  const { error: membershipError } = await admin.from('memberships').upsert(
    {
      association_id: association.id,
      user_id: userId,
      role: 'leader',
      status: 'active',
      validated_by: userData.user.id,
      validated_at: new Date().toISOString(),
    },
    { onConflict: 'association_id,user_id' },
  );
  if (membershipError) {
    await rollback();
    return json({ error: membershipError.message }, 500);
  }

  return json({ association, alreadyRegistered: Boolean(existingId), emailSent });
});
