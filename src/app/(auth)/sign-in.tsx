import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, emailFieldProps, Field, Notice, Screen, Txt, useTheme } from '@/components/ui';
import { authErrorMessage } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function SignIn() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setError('');
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    // On success the root layout switches to the app as soon as the session arrives.
    if (error) setError(authErrorMessage(error));
    setSubmitting(false);
  };

  return (
    <Screen>
      <Txt variant="title">Bons Assos</Txt>
      <Txt variant="secondary">Toutes les associations de votre ville.</Txt>

      <Field label="Email" value={email} onChangeText={setEmail} {...emailFieldProps} />
      <Field
        label="Mot de passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={submit}
      />
      <Notice kind="error">{error}</Notice>
      <Button
        title="Se connecter"
        onPress={submit}
        loading={submitting}
        disabled={!email.trim() || !password}
      />

      <View style={styles.links}>
        <Link href="/forgot-password" style={[styles.link, { color: theme.primary }]}>
          Mot de passe oublié ?
        </Link>
        <Link href="/sign-up" style={[styles.link, { color: theme.primary }]}>
          Créer un compte
        </Link>
      </View>

      <Txt variant="secondary">
        Responsable d’association ? Votre compte est créé sur invitation : ouvrez le lien reçu par
        email depuis ce téléphone.
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  links: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  link: { fontSize: 16, paddingVertical: 8 },
});
