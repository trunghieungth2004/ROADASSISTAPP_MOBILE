import {createContext, useContext, useMemo, useState, type ReactNode} from "react";
import type {RouteOption} from "../api/routes";

export type NavSession = {
  route: RouteOption;
  dest: {lat: number; lng: number};
  stops: {lat: number; lng: number}[];
  seed: {lat: number; lng: number};
  width?: number;
  vehicleType?: string;
  checkIn?: {providerId: string; name: string};
  ticketId?: string;
};

type NavSessionState = {
  session: NavSession | null;
  start: (next: NavSession) => void;
  patch: (patch: Partial<NavSession>) => void;
  clear: () => void;
  checkedIn: boolean;
  setCheckedIn: (value: boolean) => void;
  navEnded: boolean;
  setNavEnded: (value: boolean) => void;
};

const NavSessionContext = createContext<NavSessionState | null>(null);

export function NavSessionProvider({children}: {children: ReactNode}) {
  const [session, setSession] = useState<NavSession | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [navEnded, setNavEnded] = useState(false);
  const value = useMemo<NavSessionState>(
    () => ({
      session,
      start: (next: NavSession) => setSession(next),
      patch: (patch: Partial<NavSession>) => setSession((prev) => (prev ? {...prev, ...patch} : prev)),
      clear: () => setSession(null),
      checkedIn,
      setCheckedIn,
      navEnded,
      setNavEnded,
    }),
    [session, checkedIn, navEnded],
  );
  return <NavSessionContext.Provider value={value}>{children}</NavSessionContext.Provider>;
}

export function useNavSession(): NavSessionState {
  const ctx = useContext(NavSessionContext);
  if (!ctx) throw new Error("NavSessionProvider missing");
  return ctx;
}
