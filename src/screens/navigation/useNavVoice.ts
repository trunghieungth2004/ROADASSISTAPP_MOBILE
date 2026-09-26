import {useRef, useState} from "react";
import * as Speech from "expo-speech";
import {startDuckHold, stopDuckHold} from "../../services/sound";

export function useNavVoice(lang: string, onError?: () => void): {
  muted: boolean;
  toggleMute: () => void;
  speak: (text: string) => void;
  resolveVoice: () => Promise<boolean>;
} {
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  const voiceRef = useRef<string | undefined>(undefined);
  const errorRef = useRef(onError);
  errorRef.current = onError;
  const lastReportRef = useRef(0);
  const report = (): void => {
    const now = Date.now();
    if (now - lastReportRef.current < 10000) return;
    lastReportRef.current = now;
    errorRef.current?.();
  };
  const speak = (text: string): void => {
    if (mutedRef.current) return;
    if (__DEV__) console.log("[voice] speak", text);
    try {
      void Speech.stop();
    } catch {}
    void startDuckHold(text.length);
    const endDuck = (): void => {
      void stopDuckHold();
    };
    const base = {
      language: lang === "vi" ? "vi-VN" : "en-US",
      rate: lang === "vi" ? 0.95 : 1.0,
    };
    const attempt = (withVoice: boolean): void => {
      try {
        const opts = withVoice && voiceRef.current ? {...base, voice: voiceRef.current} : base;
        if (__DEV__) console.log("[voice] attempt", withVoice ? "voice" : "bare");
        const result = Speech.speak(text, {
          ...opts,
          onDone: () => {
            if (__DEV__) console.log("[voice] done");
            endDuck();
          },
          onStopped: () => {
            if (__DEV__) console.log("[voice] stopped");
            endDuck();
          },
          onError: () => {
            if (__DEV__) console.log("[voice] error, retry-bare:", withVoice);
            if (withVoice) {
              voiceRef.current = undefined;
              attempt(false);
            } else {
              endDuck();
              report();
            }
          },
        });
        void Promise.resolve(result).catch(() => {
          endDuck();
          report();
        });
      } catch {
        endDuck();
        report();
      }
    };
    attempt(true);
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
    if (next) {
      void Speech.stop();
      void stopDuckHold();
    }
  };
  return {muted, toggleMute, speak, resolveVoice};
}
