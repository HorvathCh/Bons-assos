import { FunctionsHttpError } from '@supabase/supabase-js';
import { useState } from 'react';

import { Button, emailFieldProps, Field, Notice, Txt } from '@/components/ui';
import { authCallbackUrl } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type InviteResult = { alreadyRegistered: boolean; emailSent: boolean };

type Props = { associationId: string; onInvited: () => void };

/** Platform admin only: the rule is enforced by the `invite-leader` edge function. */
export function InviteLeaderForm({ associationId, onInvited }: Props) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setError('');
    setSuccess('');
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke<InviteResult>('invite-leader', {
      body: { email: email.trim(), associationId, redirectTo: authCallbackUrl() },
    });
    if (error || !data) {
      // The function explains refusals in the response body.
      const details =
        error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
      setError(details?.error ?? error?.message ?? "L'invitation a échoué.");
    } else {
      const who = email.trim();
      setSuccess(
        !data.alreadyRegistered
          ? `Invitation envoyée à ${who}.`
          : data.emailSent
            ? `${who} avait déjà un compte : il est maintenant responsable et reçoit un lien de connexion par email.`
            : `${who} avait déjà un compte : il est maintenant responsable. Aucun email n'a pu lui être envoyé, prévenez-le directement.`
      );
      setEmail('');
      onInvited();
    }
    setSubmitting(false);
  };

  return (
    <>
      <Txt variant="secondary">
        Le responsable reçoit un email d’invitation. En ouvrant le lien sur son téléphone, il
        choisit son mot de passe et devient responsable de l’association.
      </Txt>
      <Field
        label="Email du responsable"
        value={email}
        onChangeText={setEmail}
        {...emailFieldProps}
      />
      <Notice kind="error">{error}</Notice>
      <Notice kind="success">{success}</Notice>
      <Button
        title="Inviter le responsable"
        onPress={submit}
        loading={submitting}
        disabled={!email.trim()}
      />
    </>
  );
}
