import { useState } from 'react';

import { Button, Card, Field, Notice, Screen, Txt } from '@/components/ui';
import { authErrorMessage, MIN_PASSWORD_LENGTH, useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type Feedback = { kind: 'error' | 'success'; text: string } | null;

export default function Account() {
  const { session, fullName: savedName, isAdmin, refreshAccount } = useAuth();
  const user = session?.user;

  const [fullName, setFullName] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<Feedback>(null);
  const [passwordFeedback, setPasswordFeedback] = useState<Feedback>(null);
  const [confirmingDeletion, setConfirmingDeletion] = useState(false);
  const [deletionError, setDeletionError] = useState('');

  if (!user) return null;

  // Shows the saved name until the user starts typing.
  const name = fullName ?? savedName;

  const saveProfile = async () => {
    setBusy(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: name.trim() })
      .eq('id', user.id);
    if (!error) await refreshAccount();
    setProfileFeedback(
      error ? { kind: 'error', text: error.message } : { kind: 'success', text: 'Profil enregistré.' }
    );
    setBusy(false);
  };

  const savePassword = async () => {
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) setPassword('');
    setPasswordFeedback(
      error
        ? { kind: 'error', text: authErrorMessage(error) }
        : { kind: 'success', text: 'Mot de passe modifié.' }
    );
    setBusy(false);
  };

  const deleteAccount = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('delete_own_account');
    if (error) {
      setDeletionError(error.message);
      setBusy(false);
      return;
    }
    // The account no longer exists: only the local session is left to clear.
    await supabase.auth.signOut({ scope: 'local' });
  };

  return (
    <Screen>
      <Card>
        <Txt variant="heading">Profil</Txt>
        <Txt variant="secondary">
          {user.email}
          {isAdmin ? ' · Administrateur de la plateforme' : ''}
        </Txt>
        <Field
          label="Prénom et nom"
          value={name}
          onChangeText={setFullName}
          autoComplete="name"
          textContentType="name"
        />
        <Notice kind={profileFeedback?.kind ?? 'error'}>{profileFeedback?.text}</Notice>
        <Button
          title="Enregistrer"
          onPress={saveProfile}
          disabled={busy || !name.trim() || name.trim() === savedName}
        />
      </Card>

      <Card>
        <Txt variant="heading">Mot de passe</Txt>
        <Field
          label={`Nouveau mot de passe (${MIN_PASSWORD_LENGTH} caractères minimum)`}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <Notice kind={passwordFeedback?.kind ?? 'error'}>{passwordFeedback?.text}</Notice>
        <Button
          title="Changer le mot de passe"
          variant="secondary"
          onPress={savePassword}
          disabled={busy || password.length < MIN_PASSWORD_LENGTH}
        />
      </Card>

      <Button
        title="Se déconnecter"
        variant="secondary"
        disabled={busy}
        onPress={() => supabase.auth.signOut()}
      />

      <Card>
        <Txt variant="heading">Supprimer mon compte</Txt>
        <Txt variant="secondary">
          Votre profil, vos abonnements et vos adhésions seront définitivement supprimés.
        </Txt>
        <Notice kind="error">{deletionError}</Notice>
        {confirmingDeletion ? (
          <>
            <Button
              title="Oui, supprimer définitivement"
              variant="danger"
              loading={busy}
              onPress={deleteAccount}
            />
            <Button
              title="Annuler"
              variant="secondary"
              disabled={busy}
              onPress={() => setConfirmingDeletion(false)}
            />
          </>
        ) : (
          <Button
            title="Supprimer mon compte"
            variant="danger"
            disabled={busy}
            onPress={() => setConfirmingDeletion(true)}
          />
        )}
      </Card>
    </Screen>
  );
}
