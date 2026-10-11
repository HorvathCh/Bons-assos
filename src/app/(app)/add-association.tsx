import { useRouter } from 'expo-router';

import { AssociationForm, type AssociationFormValues } from '@/components/association-form';
import { supabase } from '@/lib/supabase';

/** Platform admin only: the route is guarded in the layout, the rule is enforced by the database. */
export default function AddAssociation() {
  const router = useRouter();

  const create = async (values: AssociationFormValues) => {
    const { data, error } = await supabase
      .from('associations')
      .insert(values)
      .select('id')
      .single();
    if (error) return error.message;
    // Straight to the new association, where its leader can be invited.
    router.replace({ pathname: '/association/[id]', params: { id: data.id } });
    return null;
  };

  return (
    <AssociationForm
      intro="Une fois l’association ajoutée, vous pourrez inviter son responsable."
      submitLabel="Ajouter l’association"
      onSubmit={create}
    />
  );
}
