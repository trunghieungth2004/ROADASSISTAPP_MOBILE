import {createContext, useContext, useEffect, useMemo, useState, type ReactNode} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {en, type Strings} from "../i18n/en";
import {vi} from "../i18n/vi";
export type Lang = "en" | "vi";
const strings: Record<Lang, Strings> = {en, vi};
const LANG_KEY = "roadassist.lang";
type LanguageState = {lang: Lang; t: Strings; toggle: () => void};
const LanguageContext = createContext<LanguageState | null>(null);
export function LanguageProvider({children}: {children: ReactNode}) {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(LANG_KEY).then((saved) => {
      if (!mounted) return;
      if (saved === "en" || saved === "vi") setLang(saved);
    }).catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);
  const value = useMemo<LanguageState>(() => ({lang, t: strings[lang], toggle: () => setLang((prev) => {
    const next = prev === "en" ? "vi" : "en";
    void AsyncStorage.setItem(LANG_KEY, next).catch(() => undefined);
    return next;
  })}), [lang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
export function useStrings() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("LanguageProvider missing");
  return ctx;
}
