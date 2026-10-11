import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Field, Loading, Notice, Screen, Txt, useTheme } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import {
  deleteMembership,
  membershipLabel,
  OWN_LEVELS,
  setOwnLevel,
  type Association,
  type Membership,
} from '@/lib/memberships';
import { supabase } from '@/lib/supabase';

type Subscription = Pick<Membership, 'association_id' | 'role' | 'status'>;
type Loaded = { associations: Association[]; subscriptions: Subscription[]; error: string };

/** What the user can pick for an association: one of their own levels, or no subscription. */
type Choice = (typeof OWN_LEVELS)[number]['role'] | 'none';

/** Every association, with the user's current subscriptions. */
async function fetchAll(userId: string): Promise<Loaded> {
  const [all, mine] = await Promise.all([
    supabase.from('associations').select('id, name, description').order('name'),
    supabase.from('memberships').select('association_id, role, status').eq('user_id', userId),
  ]);
  return {
    associations: all.data ?? [],
    subscriptions: mine.data ?? [],
    error: all.error?.message ?? mine.error?.message ?? '',
  };
}

/** Lower case without accents, so that "eclair" finds "Éclair". */
const searchable = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function ManageSubscriptions() {
  const theme = useTheme();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [choice, setChoice] = useState<Choice>('follower');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchAll(userId).then((next) => {
      if (!cancelled) setLoaded(next);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!loaded || !userId) return <Loading />;

  const subscriptionTo = (associationId: string) =>
    loaded.subscriptions.find((subscription) => subscription.association_id === associationId);

  const words = searchable(search).split(/\s+/).filter(Boolean);
  const matches = loaded.associations.filter((association) => {
    const text = searchable(`${association.name} ${association.description}`);
    return words.every((word) => text.includes(word));
  });

  const selected = loaded.associations.find((association) => association.id === selectedId);
  const current = selected ? subscriptionTo(selected.id) : undefined;
  // Leaders are named by the platform admin and cannot change their own level.
  const isLeader = current?.role === 'leader';
  const unchanged = current ? choice === current.role : choice === 'none';

  const select = (associationId: string) => {
    const role = subscriptionTo(associationId)?.role;
    setSelectedId(associationId);
    setChoice(role === 'follower' || role === 'member' ? role : 'follower');
    setError('');
    setSuccess('');
  };

  const submit = async () => {
    if (!selected) {
      setError('Choisissez une association dans la liste.');
      return;
    }
    setError('');
    setSuccess('');
    setSubmitting(true);
    const { error } =
      choice === 'none'
        ? await deleteMembership(selected.id, userId)
        : await setOwnLevel(selected.id, userId, choice);
    if (error) {
      setError(error.message);
    } else {
      setSuccess(
        choice === 'none'
          ? `Vous n’êtes plus abonné à ${selected.name}.`
          : current
            ? `Votre abonnement à ${selected.name} est mis à jour.`
            : `Vous êtes abonné à ${selected.name}.`
      );
      setLoaded(await fetchAll(userId));
      // After leaving, the remaining choice is to subscribe again.
      if (choice === 'none') setChoice('follower');
    }
    setSubmitting(false);
  };

  const submitLabel = !selected
    ? 'S’abonner'
    : choice === 'none'
      ? `Se désabonner de ${selected.name}`
      : current
        ? 'Enregistrer'
        : `S’abonner à ${selected.name}`;

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
            ? 'Aucune association n’est encore inscrite.'
            : 'Aucune association ne correspond à cette recherche.'}
        </Txt>
      ) : null}

      <View style={styles.list}>
        {matches.map((association) => {
          const isSelected = association.id === selectedId;
          const subscription = subscriptionTo(association.id);
          return (
            <Pressable
              key={association.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              onPress={() => select(association.id)}
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
              {subscription ? (
                <Txt variant="secondary" style={{ color: theme.primary }}>
                  {membershipLabel(subscription)}
                </Txt>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {selected && isLeader ? (
        <Txt variant="secondary">
          Vous êtes responsable de « {selected.name} » : votre abonnement ne peut pas être modifié
          ici.
        </Txt>
      ) : null}

      {selected && !isLeader ? (
        <View style={styles.group}>
          <Txt variant="secondary">Votre lien avec « {selected.name} »</Txt>
          <View style={styles.choices}>
            {OWN_LEVELS.map((option) => (
              <Button
                key={option.role}
                title={option.label}
                variant={choice === option.role ? 'primary' : 'secondary'}
                compact
                onPress={() => setChoice(option.role)}
              />
            ))}
            {current ? (
              <Button
                title="Se désabonner"
                variant={choice === 'none' ? 'primary' : 'danger'}
                compact
                onPress={() => setChoice('none')}
              />
            ) : null}
          </View>
          {current?.role === 'committee' ? (
            <Txt variant="secondary">
              Vous êtes membre du comité : choisir l’une de ces options vous le fait quitter.
            </Txt>
          ) : null}
        </View>
      ) : null}

      <Notice kind="error">{error}</Notice>
      <Notice kind="success">{success}</Notice>
      {isLeader ? null : (
        <Button
          title={submitLabel}
          variant={choice === 'none' && selected ? 'danger' : 'primary'}
          onPress={submit}
          loading={submitting}
          disabled={Boolean(selected) && unchanged}
        />
      )}
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
