import {createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode} from "react";
import {fetchMeBundle, setActiveVehicle as apiActivateVehicle, setOnboarded as apiSetOnboarded, type MeBundle, type MeUser, type MeVehicle} from "../api/users";
import {useAuth} from "./AuthContext";
type ProfileState = {bundle: MeBundle | null; loading: boolean; user: MeUser | null; vehicles: MeVehicle[]; activeVehicle: MeVehicle | null; hasVehicle: boolean; roleChosen: boolean; isRider: boolean; refresh: () => Promise<MeBundle | null>; activateVehicle: (profileId: string | null) => Promise<void>; markOnboarded: (service: string) => Promise<void>};
const ProfileContext = createContext<ProfileState | null>(null);
export function ProfileProvider({children}: {children: ReactNode}) {
  const {uid, token} = useAuth();
  const [bundle, setBundle] = useState<MeBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async (): Promise<MeBundle | null> => {
    if (!token) { setBundle(null); return null; }
    setLoading(true);
    try { const next = await fetchMeBundle(token); setBundle(next); return next; } catch { return bundle; } finally { setLoading(false); }
  }, [token]);
  useEffect(() => { if (token) void refresh(); else setBundle(null); }, [token, refresh]);
  const activateVehicle = useCallback(async (profileId: string | null) => { if (!token) return; await apiActivateVehicle({profileId}, token); await refresh(); }, [token, refresh]);
  const markOnboarded = useCallback(async (service: string) => {
    if (!token) return;
    const res = await apiSetOnboarded({service}, token);
    setBundle((prev) => prev ? {...prev, user: {...prev.user, onboarded: res.onboarded, services: res.services}} : prev);
  }, [token]);
  const value = useMemo<ProfileState>(() => {
    const vehicles = bundle?.vehicles ?? [];
    const services = bundle?.user.services ?? [];
    return {bundle, loading, user: bundle?.user ?? null, vehicles, activeVehicle: bundle?.activeVehicle ?? null, hasVehicle: vehicles.length > 0, roleChosen: bundle?.user.onboarded === true, isRider: services.includes("RIDER"), refresh, activateVehicle, markOnboarded};
  }, [bundle, loading, refresh, activateVehicle, markOnboarded]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}
export function useProfile(): ProfileState {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("ProfileProvider missing");
  return ctx;
}
