import {createContext, useContext, useEffect, useMemo, useState, type ReactNode} from "react";
import {Appearance, useColorScheme} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeMode = "light" | "dark" | "amoled";
type ThemeState = {mode: ThemeMode; setMode: (mode: ThemeMode) => void; toggle: () => void};
const ThemeContext = createContext<ThemeState | null>(null);
const THEME_KEY = "roadassist.theme";

export function ThemeProvider({children}: {children: ReactNode}) {
  const systemMode = useColorScheme() === "dark" ? "dark" : "light";
  const [mode, setMode] = useState<ThemeMode>(systemMode);
  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (!mounted) return;
      const next = saved === "dark" || saved === "light" || saved === "amoled" ? saved : systemMode;
      setMode(next);
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    Appearance.setColorScheme(mode === "light" ? "light" : "dark");
  }, [mode]);
  const setPersistedMode = (next: ThemeMode): void => {
    setMode(next);
    void AsyncStorage.setItem(THEME_KEY, next).catch(() => undefined);
  };
  const toggle = () => setPersistedMode(mode === "dark" ? "light" : "dark");
  const value = useMemo(() => ({mode, setMode: setPersistedMode, toggle}), [mode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("ThemeProvider missing");
  return ctx;
}

export function useAppMode(): ThemeMode {
  const systemMode: ThemeMode = useColorScheme() === "dark" ? "dark" : "light";
  const ctx = useContext(ThemeContext);
  if (!ctx) return systemMode;
  return ctx.mode;
}
