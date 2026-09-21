import {useRef, useState} from "react";
import * as Speech from "expo-speech";

export function useNavVoice(lang: string): {
  muted: boolean;
  toggleMute: () => void;
  speak: (text: string) => void;
  resolveVoice: () => Promise<boolean>;
} {
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  const voiceRef = useRef<string | undefined>(undefined);
  const speak = (text: string): void => {
    if (mutedRef.current) return;
    void Speech.speak(text, {
      language: lang === "vi" ? "vi-VN" : "en-US",
      ...(voiceRef.current ? {voice: voiceRef.current} : {}),
      rate: lang === "vi" ? 0.95 : 1.0,
    });
  };
  async function resolveVoice(): Promise<boolean> {
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      const prefs = lang === "vi" ? ["vi-vn", "vi"] : ["en-us", "en"];
      const norm = (s: string): string => s.toLowerCase().replace("_", "-");
      for (const p of prefs) {
        const cands = voices.filter((v) => norm(v.language).startsWith(p));
        if (cands.length === 0) continue;
        voiceRef.current = (
          cands.find((v) => v.quality === Speech.VoiceQuality.Enhanced) ?? cands[0]
        ).identifier;
        return true;
      }
      voiceRef.current = undefined;
      return false;
    } catch {
      voiceRef.current = undefined;
      return false;
    }
  }
  const toggleMute = (): void => {
    const next = !muted;
    setMuted(next);
    mutedRef.current = next;
    if (next) void Speech.stop();
  };
  return {muted, toggleMute, speak, resolveVoice};
}
