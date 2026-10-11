import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Button, Loading, Notice, Screen, Txt, useTheme } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { membershipLabel, type Association, type Membership } from '@/lib/memberships';
import { supabase } from '@/lib/supabase';

type Subscription = Pick<Membership, 'role' | 'status'> & { association: Association | null };
type Loaded = { subscriptions: Subscription[]; error: string };

/** The associations the user follows or belongs to, by name. */
async function fetchSubscriptions(userId: string): Promise<Loaded> {
  const { data, error } = await supabase
    .from('memberships')
    .select('role, status, association:associations(id, name, description)')
    .eq('user_id', userId)
    .overrideTypes<Subscription[], { merge: false }>();
  const subscriptions = (data ?? [])
    .filter((subscription) => subscription.association)
    .sort((a, b) => a.association!.name.localeCompare(b.association!.name, 'fr'));
  return { subscriptions, error: error?.message ?? '' };
}

export default function MyAssociations() {
  const theme = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [loaded, setLoaded] = useState<Loaded | null>(null);

  // Reloaded each time the screen comes back to the front (after subscribing, leaving...).
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      fetchSubscriptions(userId).then((next) => {
        if (!cancelled) setLoaded(next);
      });
      return () => {
        cancelled = true;
      };
    }, [userId])
  );

  if (!loaded || !userId) return <Loading />;

  return (
    <Screen onRefresh={() => fetchSubscriptions(userId).then(setLoaded)}>
      <Notice kind="error">{loaded.error}</Notice>

      {loaded.subscriptions.length === 0 && !loaded.error ? (
        <Txt variant="secondary">Vous n’êtes abonné à aucune association pour le moment.</Txt>
      ) : null}

      {loaded.subscriptions.map(({ association, ...membership }) => (
        <Link
          key={association!.id}
          href={{ pathname: '/association/[id]', params: { id: association!.id } }}
          asChild>
          <Pressable
            accessibilityRole="link"
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: theme.surface },
              pressed && styles.pressed,
            ]}>
            <Txt variant="heading">{association!.name}</Txt>
            <Txt variant="secondary" style={{ color: theme.primary }}>
              {membershipLabel(membership)}
            </Txt>
          </Pressable>
        </Link>
      ))}

      <Button title="S’abonner à une association" onPress={() => router.push('/subscribe')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { borderRadius: 12, padding: 16, gap: 4 },
  pressed: { opacity: 0.6 },
});
