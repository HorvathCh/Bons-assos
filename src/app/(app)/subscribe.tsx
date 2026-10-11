import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Field, Loading, Notice, Screen, Txt, useTheme } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { OWN_LEVELS, setOwnLevel, type Association } from '@/lib/memberships';
import { supabase } from '@/lib/supabase';

type Loaded = { associations: Association[]; error: string };

/** The associations the user is not subscribed to yet. */
async function fetchAvailable(userId: string): Promise<Loaded> {
  const [all, mine] = await Promise.all([
    supabase.from('associations').select('id, name, description').order('name'),
    supabase.from('memberships').select('association_id').eq('user_id', userId),
  ]);
  const subscribed = new Set((mine.data ?? []).map((row) => row.association_id));
  return {
    associations: (all.data ?? []).filter((association) => !subscribed.has(association.id)),
    error: all.error?.message ?? mine.error?.message ?? '',
  };
}

/** Lower case without accents, so that "eclair" finds "Éclair". */
const searchable = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function Subscribe() {
  const theme = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [level, setLevel] = useState<(typeof OWN_LEVELS)[number]['role']>('follower');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchAvailable(userId).then((next) => {
      if (!cancelled) setLoaded(next);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!loaded || !userId) return <Loading />;

  const words = searchable(search).split(/\s+/).filter(Boolean);
  const matches = loaded.associations.filter((association) => {
    const text = searchable(`${association.name} ${association.description}`);
    return words.every((word) => text.includes(word));
  });
  const selected = loaded.associations.find((association) => association.id === selectedId);

  const submit = async () => {
    if (!selected) {
      setError('Choisissez une association dans la liste.');
      return;
    }
    setError('');
    setSubmitting(true);
    const { error } = await setOwnLevel(selected.id, userId, level);
    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }
    router.back();
  };

  return (
    <Screen>
      <Field
        label="Rechercher une association"
        value={search}
        onChangeText={setSearch}
        placeholder="Nom ou activité"
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
      />
      <Notice kind="error">{loaded.error}</Notice>

      {matches.length === 0 && !loaded.error ? (
        <Txt variant="secondary">
          {loaded.associations.length === 0
            ? 'Vous êtes déjà abonné à toutes les associations.'
            : 'Aucune association ne correspond à cette recherche.'}
        </Txt>
      ) : null}

      <View style={styles.list}>
        {matches.map((association) => {
          const isSelected = association.id === selectedId;
          return (
            <Pressable
              key={association.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              onPress={() => setSelectedId(association.id)}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: theme.surface,
                  borderColor: isSelected ? theme.primary : theme.surface,
                },
                pressed && styles.pressed,
              ]}>
              <Txt variant="heading">{association.name}</Txt>
              {association.description ? (
                <Txt variant="secondary" numberOfLines={2}>
                  {association.description}
                </Txt>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {selected ? (
        <View style={styles.group}>
          <Txt variant="secondary">Votre lien avec « {selected.name} »</Txt>
          <View style={styles.choices}>
            {OWN_LEVELS.map((option) => (
              <Button
                key={option.role}
                title={option.label}
                variant={level === option.role ? 'primary' : 'secondary'}
                compact
                onPress={() => setLevel(option.role)}
              />
            ))}
          </View>
        </View>
      ) : null}

      <Notice kind="error">{error}</Notice>
      <Button
        title={selected ? `S’abonner à ${selected.name}` : 'S’abonner'}
        onPress={submit}
        loading={submitting}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  row: { borderRadius: 12, borderWidth: 2, padding: 14, gap: 4 },
  pressed: { opacity: 0.6 },
  group: { gap: 8 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
