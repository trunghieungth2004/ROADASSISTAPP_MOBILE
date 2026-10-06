import {useCallback, useEffect, useRef, useState} from "react";

const FALLBACK_CLEAR_MS = 2000;

export function useStyleVeil(scheme: string | null | undefined): {veiled: boolean; onStyleLoaded: () => void} {
  const [veiled, setVeiled] = useState(false);
  const mode = scheme === "dark" ? "dark" : "light";
  const stateRef = useRef({loaded: false, first: true, timer: null as ReturnType<typeof setTimeout> | null});
  useEffect(() => {
    const state = stateRef.current;
    if (state.first) {
      state.first = false;
      return;
    }
    if (!state.loaded) return;
    setVeiled(true);
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(() => setVeiled(false), FALLBACK_CLEAR_MS);
  }, [mode]);
  useEffect(() => () => {
    if (stateRef.current.timer) clearTimeout(stateRef.current.timer);
  }, []);
  const onStyleLoaded = useCallback(() => {
    stateRef.current.loaded = true;
    if (stateRef.current.timer) {
      clearTimeout(stateRef.current.timer);
      stateRef.current.timer = null;
    }
    setVeiled(false);
  }, []);
  return {veiled, onStyleLoaded};
}
