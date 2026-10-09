import { useState } from 'react';

import { Button, emailFieldProps, Field, Notice, Screen, Txt } from '@/components/ui';
import { authCallbackUrl, authErrorMessage, MIN_PASSWORD_LENGTH } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function SignUp() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmationSentTo, setConfirmationSentTo] = useState('');

  const submit = async () => {
    setError('');
    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() }, emailRedirectTo: authCallbackUrl() },
    });
    if (error) setError(authErrorMessage(error));
    // Without a session, the address still has to be confirmed from the email.
    else if (!data.session) setConfirmationSentTo(email.trim());
    setSubmitting(false);
  };

  if (confirmationSentTo) {
    return (
      <Screen>
        <Txt variant="title">Vérifiez vos emails</Txt>
        <Txt>
          Un lien de confirmation a été envoyé à {confirmationSentTo}. Ouvrez-le depuis ce
          téléphone pour activer votre compte.
        </Txt>
      </Screen>
    );
  }

  return (
    <Screen>
      <Txt variant="secondary">
        Créez votre compte pour suivre les actualités des associations, ou vous déclarer membre
        actif de l’une d’elles.
      </Txt>
      <Field
        label="Prénom et nom"
        value={fullName}
        onChangeText={setFullName}
        autoComplete="name"
        textContentType="name"
      />
      <Field label="Email" value={email} onChangeText={setEmail} {...emailFieldProps} />
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
        title="Créer mon compte"
        onPress={submit}
        loading={submitting}
        disabled={!fullName.trim() || !email.trim() || password.length < MIN_PASSWORD_LENGTH}
      />
    </Screen>
  );
}
