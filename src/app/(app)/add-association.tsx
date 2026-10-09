import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Button, Field, Notice, Screen, Txt } from '@/components/ui';
import { supabase } from '@/lib/supabase';

/** Platform admin only: the route is guarded in the layout, the rule is enforced by the database. */
export default function AddAssociation() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setError('');
    setSubmitting(true);
    const { data, error } = await supabase
      .from('associations')
      .insert({ name: name.trim(), description: description.trim() })
      .select('id')
      .single();
    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }
    // Straight to the new association, where its leader can be invited.
    router.replace({ pathname: '/association/[id]', params: { id: data.id } });
  };

  return (
    <Screen>
      <Txt variant="secondary">
        Une fois l’association ajoutée, vous pourrez inviter son responsable.
      </Txt>
      <Field label="Nom de l’association" value={name} onChangeText={setName} />
      <Field
        label="Description (facultatif)"
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <Notice kind="error">{error}</Notice>
      <Button
        title="Ajouter l’association"
        onPress={submit}
        loading={submitting}
        disabled={!name.trim()}
      />
    </Screen>
  );
}
