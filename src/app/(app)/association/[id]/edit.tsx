import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { AssociationForm, type AssociationFormValues } from '@/components/association-form';
import { Loading, Notice, Screen } from '@/components/ui';
import { ASSOCIATION_DETAILS_COLUMNS, type AssociationDetails } from '@/lib/memberships';
import { supabase } from '@/lib/supabase';

type Loaded = { association: AssociationDetails | null; error: string };

/** Leaders of the association and platform admins only: the rule is enforced by the database. */
export default function EditAssociation() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('associations')
      .select(ASSOCIATION_DETAILS_COLUMNS)
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!cancelled) setLoaded({ association: data, error: error?.message ?? '' });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!loaded) return <Loading />;
  if (!loaded.association) {
    return (
      <Screen>
        <Notice kind="error">{loaded.error || 'Association introuvable.'}</Notice>
      </Screen>
    );
  }

  const save = async (values: AssociationFormValues) => {
    const { data, error } = await supabase
      .from('associations')
      .update(values)
      .eq('id', id)
      .select('id');
    if (error) return error.message;
    // Without the right to edit, the database changes nothing and reports no error.
    if (data.length === 0) {
      return 'Seuls les responsables de l’association peuvent modifier ces informations.';
    }
    router.back();
    return null;
  };

  return <AssociationForm initial={loaded.association} submitLabel="Enregistrer" onSubmit={save} />;
}
