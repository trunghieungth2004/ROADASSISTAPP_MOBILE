import {useEffect, useRef, useState} from "react";
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
  const voiceReadyRef = useRef<Promise<boolean> | null>(null);
  const startedRef = useRef(false);
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
    startedRef.current = false;
    void (async () => {
      try {
        await (voiceReadyRef.current ?? Promise.resolve(false));
      } catch {}
      if (mutedRef.current) return;
      attempt(text, true, true);
    })();
  };
  const attempt = (text: string, withVoice: boolean, retryAllowed: boolean): void => {
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
    const retry = (withVoiceNext: boolean): void => {
      try {
        const opts = withVoiceNext && voiceRef.current ? {...base, voice: voiceRef.current} : base;
        const result = Speech.speak(text, {
          ...opts,
          onStart: () => {
            startedRef.current = true;
          },
          onDone: () => {
            endDuck();
          },
          onStopped: () => {
            endDuck();
          },
          onError: () => {
            if (withVoiceNext) {
              voiceRef.current = undefined;
              retry(false);
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
    retry(withVoice);
    if (retryAllowed) {
      setTimeout(() => {
        if (!startedRef.current && !mutedRef.current) {
          endDuck();
          retry(false);
        }
      }, 1500);
    }
  };
  async function warmEngine(): Promise<void> {
    try {
      await Speech.speak(" ", {language: lang === "vi" ? "vi-VN" : "en-US", volume: 0});
    } catch {
      return;
    }
  }
  async function resolveVoice(): Promise<boolean> {    try {
      const voices = await Speech.getAvailableVoicesAsync();
      const prefs = lang === "vi" ? ["vi-vn", "vi"] : ["en-us", "en"];
      const norm = (s: string): string => s.toLowerCase().replace("_", "-");
      for (const p of prefs) {
        const cands = voices.filter((v) => norm(v.language).startsWith(p));
        if (cands.length === 0) continue;
        voiceRef.current = (
          cands.find((v) => v.quality === Speech.VoiceQuality.Enhanced) ?? cands[0]
        ).identifier;
        await warmEngine();
        return true;
      }
      voiceRef.current = undefined;
      await warmEngine();
      return false;
    } catch {
      voiceRef.current = undefined;
      return false;
    }
  }
  useEffect(() => {
    voiceReadyRef.current = resolveVoice();
  }, []);
  const toggleMute = (): void => {    const next = !muted;
    setMuted(next);
    mutedRef.current = next;
    if (next) {
      void Speech.stop();
      void stopDuckHold();
    }
  };
  return {muted, toggleMute, speak, resolveVoice};
}
