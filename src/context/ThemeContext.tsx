import {createContext, useContext, useEffect, useMemo, useState, type ReactNode} from "react";
import {Appearance, useColorScheme} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

type ThemeMode = "light" | "dark";
type ThemeState = {mode: ThemeMode; toggle: () => void};
const ThemeContext = createContext<ThemeState | null>(null);
const THEME_KEY = "roadassist.theme";

export function ThemeProvider({children}: {children: ReactNode}) {
  const systemMode = useColorScheme() === "dark" ? "dark" : "light";
  const [mode, setMode] = useState<ThemeMode>(systemMode);
  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (!mounted) return;
      const next = saved === "dark" || saved === "light" ? saved : systemMode;
      setMode(next);
      Appearance.setColorScheme(next);
    });
    return () => { mounted = false; };
  }, [systemMode]);
  const toggle = () => {
    setMode((current) => {
      const next = current === "dark" ? "light" : "dark";
      Appearance.setColorScheme(next);
      void AsyncStorage.setItem(THEME_KEY, next);
      return next;
    });
  };
  const value = useMemo(() => ({mode, toggle}), [mode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("ThemeProvider missing");
  return ctx;
}
