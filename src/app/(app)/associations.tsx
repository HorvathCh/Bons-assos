import { Link, Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Loading, Notice, Screen, Txt, useTheme } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { membershipLabel, type Association, type Membership } from '@/lib/memberships';
import { supabase } from '@/lib/supabase';

type MyMembership = Pick<Membership, 'association_id' | 'user_id' | 'role' | 'status'>;

export default function Associations() {
  const theme = useTheme();
  const router = useRouter();
  const { session, isAdmin } = useAuth();
  const userId = session?.user.id;

  const [associations, setAssociations] = useState<Association[] | null>(null);
  const [memberships, setMemberships] = useState<MyMembership[]>([]);
  const [error, setError] = useState('');

  // Reloaded each time the screen comes back to the front (after following, leaving...).
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      Promise.all([
        supabase.from('associations').select('id, name, description').order('name'),
        supabase
          .from('memberships')
          .select('association_id, user_id, role, status')
          .eq('user_id', userId),
      ]).then(([all, mine]) => {
        if (cancelled) return;
        setError(all.error?.message ?? mine.error?.message ?? '');
        setAssociations(all.data ?? []);
        setMemberships(mine.data ?? []);
      });
      return () => {
        cancelled = true;
      };
    }, [userId])
  );

  if (!associations) return <Loading />;

  const membershipOf = (associationId: string) =>
    memberships.find((membership) => membership.association_id === associationId);

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/account" style={[styles.headerLink, { color: theme.primary }]}>
              Mon compte
            </Link>
          ),
        }}
      />
      <Notice kind="error">{error}</Notice>

      {isAdmin ? (
        <Button title="Ajouter une association" onPress={() => router.push('/add-association')} />
      ) : null}

      {associations.length === 0 && !error ? (
        <Txt variant="secondary">Aucune association n’est encore inscrite.</Txt>
      ) : null}

      {associations.map((association) => {
        const membership = membershipOf(association.id);
        return (
          <Link
            key={association.id}
            href={{ pathname: '/association/[id]', params: { id: association.id } }}
            asChild>
            <Pressable
              accessibilityRole="link"
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: theme.surface },
                pressed && styles.pressed,
              ]}>
              <View style={styles.rowText}>
                <Txt variant="heading">{association.name}</Txt>
                {association.description ? (
                  <Txt variant="secondary" numberOfLines={2}>
                    {association.description}
                  </Txt>
                ) : null}
              </View>
              {membership ? (
                <Txt variant="secondary" style={{ color: theme.primary }}>
                  {membershipLabel(membership)}
                </Txt>
              ) : null}
            </Pressable>
          </Link>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerLink: { fontSize: 16, paddingVertical: 8 },
  row: { borderRadius: 12, padding: 16, gap: 8 },
  rowText: { gap: 4 },
  pressed: { opacity: 0.6 },
});
