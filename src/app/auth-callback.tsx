import type { EmailOtpType } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { Button, Field, Loading, Notice, Screen, Txt } from '@/components/ui';
import { authErrorMessage, MIN_PASSWORD_LENGTH, useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

/** Supabase puts its parameters after `#` (default) or `?` depending on the flow. */
function linkParams(url: string) {
  const params: Record<string, string> = {};
  const [beforeHash, hash = ''] = url.split('#');
  const query = beforeHash.split('?')[1] ?? '';
  for (const part of [query, hash]) {
    new URLSearchParams(part).forEach((value, key) => {
      params[key] = value;
    });
  }
  return params;
}

/** Opens the session carried by the link. Returns an error message, or null. */
async function openSession(params: Record<string, string>) {
  if (params.error_description || params.error) {
    return params.error_code === 'otp_expired'
      ? 'Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau.'
      : (params.error_description ?? params.error);
  }
  let result;
  if (params.access_token && params.refresh_token) {
    result = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
  } else if (params.token_hash && params.type) {
    result = await supabase.auth.verifyOtp({
      token_hash: params.token_hash,
      type: params.type as EmailOtpType,
    });
  } else if (params.code) {
    result = await supabase.auth.exchangeCodeForSession(params.code);
  } else {
    return 'Ce lien est incomplet. Ouvrez-le directement depuis votre email.';
  }
  return result.error ? authErrorMessage(result.error) : null;
}

type Step = 'opening' | 'choose-password' | 'done' | 'failed';

export default function AuthCallback() {
  const router = useRouter();
  const url = Linking.useLinkingURL();
  const { session, fullName: savedName, refreshAccount } = useAuth();
  const handledUrl = useRef<string | null>(null);

  const [step, setStep] = useState<Step>('opening');
  const [linkError, setLinkError] = useState('');
  const [invited, setInvited] = useState(false);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!url || handledUrl.current === url) return;
    handledUrl.current = url;
    const params = linkParams(url);
    openSession(params).then((message) => {
      if (message) {
        setLinkError(message);
        setStep('failed');
      } else if (params.type === 'invite' || params.type === 'recovery') {
        // Invited leaders have no password yet; a recovery link is there to change it.
        setInvited(params.type === 'invite');
        setStep('choose-password');
      } else {
        setStep('done');
      }
    });
  }, [url]);

  // Leave only once the session has reached the root layout, so that "/" is the app.
  useEffect(() => {
    if (step === 'done' && session) router.replace('/');
  }, [step, session, router]);

  const submit = async () => {
    setError('');
    setSubmitting(true);
    const { data, error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(authErrorMessage(error));
      setSubmitting(false);
      return;
    }
    if (invited && fullName.trim()) {
      await supabase
        .from('profiles')
        .update({ full_name: fullName.trim() })
        .eq('id', data.user.id);
      await refreshAccount();
    }
    setStep('done');
  };

  if (step === 'failed') {
    return (
      <Screen>
        <Txt variant="title">Lien inutilisable</Txt>
        <Notice kind="error">{linkError}</Notice>
        <Button title="Continuer" variant="secondary" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  if (step !== 'choose-password') return <Loading />;

  return (
    <Screen>
      <Txt variant="title">{invited ? 'Bienvenue !' : 'Nouveau mot de passe'}</Txt>
      <Txt variant="secondary">
        {invited
          ? 'Vous avez été invité comme responsable d’association. Choisissez un mot de passe pour activer votre compte.'
          : 'Choisissez le nouveau mot de passe de votre compte.'}
      </Txt>
      {invited && !savedName ? (
        <Field
          label="Prénom et nom"
          value={fullName}
          onChangeText={setFullName}
          autoComplete="name"
          textContentType="name"
        />
      ) : null}
      <Field
        label={`Mot de passe (${MIN_PASSWORD_LENGTH} caractères minimum)`}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <Notice kind="error">{error}</Notice>
      <Button
        title="Enregistrer"
        onPress={submit}
        loading={submitting}
        disabled={
          password.length < MIN_PASSWORD_LENGTH || (invited && !savedName && !fullName.trim())
        }
      />
    </Screen>
  );
}
