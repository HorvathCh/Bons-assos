import type { AuthError, Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, use, useEffect, useState, type PropsWithChildren } from 'react';

import { supabase } from './supabase';

type Account = { userId: string; fullName: string; isAdmin: boolean };

type AuthState = {
  session: Session | null;
  /** True until the stored session has been read. */
  loading: boolean;
  /** False while the name and admin status of the signed-in user are being fetched. */
  accountLoaded: boolean;
  fullName: string;
  /** Platform admin: the only one allowed to invite association leaders. */
  isAdmin: boolean;
  refreshAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const value = use(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider />');
  return value;
}

async function fetchAccount(userId: string): Promise<Account> {
  const [profile, admin] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
    supabase.rpc('is_platform_admin'),
  ]);
  return {
    userId,
    fullName: profile.data?.full_name ?? '',
    isAdmin: admin.data === true,
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<Account | null>(null);

  useEffect(() => {
    // Fires once with the stored session, then on every sign-in / sign-out / refresh.
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchAccount(userId).then((next) => {
      if (!cancelled) setAccount(next);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Ignore the account of a previous user.
  const current = account && account.userId === userId ? account : null;

  const refreshAccount = async () => {
    if (userId) setAccount(await fetchAccount(userId));
  };

  return (
    <AuthContext
      value={{
        session,
        loading,
        accountLoaded: !userId || current !== null,
        fullName: current?.fullName ?? '',
        isAdmin: current?.isAdmin ?? false,
        refreshAccount,
      }}>
      {children}
    </AuthContext>
  );
}

/** Where the links of the emails sent by Supabase bring the user back. */
export function authCallbackUrl() {
  return Linking.createURL('/auth-callback');
}

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email ou mot de passe incorrect.',
  email_not_confirmed: "Confirmez d'abord votre adresse grâce au lien reçu par email.",
  user_already_exists: 'Un compte existe déjà avec cette adresse email.',
  email_exists: 'Un compte existe déjà avec cette adresse email.',
  weak_password: 'Ce mot de passe est trop faible.',
  same_password: "Le nouveau mot de passe doit être différent de l'ancien.",
  email_address_invalid: 'Adresse email invalide.',
  validation_failed: 'Adresse email invalide.',
  over_email_send_rate_limit: "Trop d'emails envoyés. Réessayez dans quelques minutes.",
  over_request_rate_limit: 'Trop de tentatives. Réessayez dans quelques minutes.',
  otp_expired: 'Ce lien a expiré ou a déjà été utilisé.',
};

export function authErrorMessage(error: AuthError) {
  return (error.code && MESSAGES[error.code]) || error.message;
}

export const MIN_PASSWORD_LENGTH = 8;
