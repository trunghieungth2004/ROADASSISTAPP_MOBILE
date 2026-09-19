import {createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode} from "react";
import {onIdTokenChanged, signOut as firebaseSignOut} from "firebase/auth";
import * as SecureStore from "expo-secure-store";
import {auth} from "../auth/firebase";

type Session = {uid: string; token: string};
type AuthState = {uid: string | null; token: string | null; loaded: boolean; signIn: (uid: string, token: string) => Promise<void>; signOut: () => Promise<void>; refreshToken: () => Promise<string | null>};
const AuthContext = createContext<AuthState | null>(null);
const SESSION_KEY = "roadassist.session";
async function readSession(): Promise<Session | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch { return null; }
}
export function AuthProvider({children}: {children: ReactNode}) {
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    void readSession().then((saved) => { setSession(saved); setLoaded(true); });
    const unsub = onIdTokenChanged(auth, async (user) => {
      if (!user) { setSession(null); await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => undefined); return; }
      const token = await user.getIdToken();
      const next = {uid: user.uid, token};
      setSession(next);
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next)).catch(() => undefined);
    });
    return unsub;
  }, []);
  const signIn = useCallback(async (nextUid: string, nextToken: string) => {
    const next = {uid: nextUid, token: nextToken};
    setSession(next);
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next)).catch(() => undefined);
  }, []);
  const signOut = useCallback(async () => {
    setSession(null);
    await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => undefined);
    await firebaseSignOut(auth).catch(() => undefined);
  }, []);
  const refreshToken = useCallback(async (): Promise<string | null> => {
    const user = auth.currentUser;
    if (!user) return null;
    const token = await user.getIdToken(true);
    await signIn(user.uid, token);
    return token;
  }, [signIn]);
  const value = useMemo<AuthState>(() => ({uid: session?.uid ?? null, token: session?.token ?? null, loaded, signIn, signOut, refreshToken}), [session, loaded, signIn, signOut, refreshToken]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("AuthProvider missing");
  return ctx;
}
