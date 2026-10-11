import { Stack } from 'expo-router';

import { useAuth } from '@/lib/auth';

export default function AppLayout() {
  const { isAdmin } = useAuth();
  return (
    <Stack screenOptions={{ headerBackTitle: 'Retour' }}>
      <Stack.Screen name="index" options={{ title: 'Mes événements' }} />
      <Stack.Screen name="associations" options={{ title: 'Associations' }} />
      <Stack.Screen name="my-associations" options={{ title: 'Mes associations' }} />
      <Stack.Screen name="subscribe" options={{ title: 'Gérer les abonnements' }} />
      <Stack.Screen name="event/[eventId]" options={{ title: 'Événement' }} />
      <Stack.Screen name="association/[id]/index" options={{ title: 'Association' }} />
      <Stack.Screen name="association/[id]/edit" options={{ title: 'Informations' }} />
      <Stack.Screen name="association/[id]/members" options={{ title: 'Membres' }} />
      <Stack.Screen name="association/[id]/member/[userId]" options={{ title: 'Membre' }} />
      <Stack.Screen name="association/[id]/new-event" options={{ title: 'Nouvel événement' }} />
      <Stack.Screen
        name="association/[id]/event/[eventId]"
        options={{ title: 'Modifier l’événement' }}
      />
      <Stack.Screen name="account" options={{ title: 'Mon compte' }} />
      <Stack.Protected guard={isAdmin}>
        <Stack.Screen name="add-association" options={{ title: 'Ajouter une association' }} />
      </Stack.Protected>
    </Stack>
  );
}
