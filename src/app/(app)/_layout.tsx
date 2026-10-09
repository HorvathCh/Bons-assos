import { Stack } from 'expo-router';

import { useAuth } from '@/lib/auth';

export default function AppLayout() {
  const { isAdmin } = useAuth();
  return (
    <Stack screenOptions={{ headerBackTitle: 'Retour' }}>
      <Stack.Screen name="index" options={{ title: 'Associations' }} />
      <Stack.Screen name="association/[id]/index" options={{ title: 'Association' }} />
      <Stack.Screen name="association/[id]/members" options={{ title: 'Membres' }} />
      <Stack.Screen name="association/[id]/new-event" options={{ title: 'Nouvel événement' }} />
      <Stack.Screen name="account" options={{ title: 'Mon compte' }} />
      <Stack.Protected guard={isAdmin}>
        <Stack.Screen name="add-association" options={{ title: 'Ajouter une association' }} />
      </Stack.Protected>
    </Stack>
  );
}
