import { Stack } from 'expo-router';

export const unstable_settings = { anchor: 'sign-in' };

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Retour' }}>
      <Stack.Screen name="sign-in" options={{ title: 'Connexion' }} />
      <Stack.Screen name="sign-up" options={{ title: 'Créer un compte' }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Mot de passe oublié' }} />
    </Stack>
  );
}
