import { useState } from 'react';

import { Button, emailFieldProps, Field, Notice, Screen, Txt } from '@/components/ui';
import { authCallbackUrl, authErrorMessage } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setError('');
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: authCallbackUrl(),
    });
    if (error) setError(authErrorMessage(error));
    else setSent(true);
    setSubmitting(false);
  };

  if (sent) {
    return (
      <Screen>
        <Txt variant="title">Vérifiez vos emails</Txt>
        <Txt>
          Si un compte existe pour {email.trim()}, un lien vient d’être envoyé. Ouvrez-le depuis ce
          téléphone pour choisir un nouveau mot de passe.
        </Txt>
      </Screen>
    );
  }

  return (
    <Screen>
      <Txt variant="secondary">
        Indiquez l’adresse de votre compte : vous recevrez un lien pour choisir un nouveau mot de
        passe.
      </Txt>
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        onSubmitEditing={submit}
        {...emailFieldProps}
      />
      <Notice kind="error">{error}</Notice>
      <Button
        title="Envoyer le lien"
        onPress={submit}
        loading={submitting}
        disabled={!email.trim()}
      />
    </Screen>
  );
}
