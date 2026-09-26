import {createAudioPlayer, setAudioModeAsync, type AudioPlayer} from "expo-audio";

export type EventSound = "hazard" | "reroute" | "arrived";

const SOURCES = {
  hazard: require("../../assets/sound/hazard.wav"),
  reroute: require("../../assets/sound/reroute.wav"),
  arrived: require("../../assets/sound/arrived.wav"),
} as const;

const SILENCE_SOURCE = require("../../assets/sound/silence.wav");

let configured = false;
const players = new Map<EventSound, AudioPlayer>();
let duckPlayer: AudioPlayer | null = null;
let duckHolds = 0;
let duckTimer: ReturnType<typeof setTimeout> | null = null;
let lastSound: {name: EventSound; at: number} | null = null;
const DUCK_MIN_MS_PER_CHAR = 70;
const DUCK_GRACE_MS = 3000;

async function ensureMode(): Promise<void> {
  if (configured) return;
  configured = true;
  await setAudioModeAsync({playsInSilentMode: true, interruptionMode: "duckOthers"});
}

export async function playEventSound(name: EventSound): Promise<void> {
  try {
    await ensureMode();
    let player = players.get(name);
    if (!player) {
      player = createAudioPlayer(SOURCES[name]);
      player.volume = 1;
      players.set(name, player);
    }
    await player.seekTo(0);
    player.play();
    lastSound = {name, at: Date.now()};
  } catch {
    return;
  }
}

export function getDuckHolds(): number {
  return duckHolds;
}

export function getLastSound(): {name: EventSound; at: number} | null {
  return lastSound;
}

export async function unloadEventSounds(): Promise<void> {
  for (const player of players.values()) {
    try {
      player.remove();
    } catch {}
  }
  players.clear();
  await releaseDuckHold(true);
  configured = false;
}

export async function startDuckHold(textLength: number): Promise<void> {
  duckHolds += 1;
  try {
    await ensureMode();
    if (!duckPlayer) {
      duckPlayer = createAudioPlayer(SILENCE_SOURCE);
      duckPlayer.volume = 0;
      duckPlayer.loop = true;
    }
    duckPlayer.play();
    if (duckTimer) clearTimeout(duckTimer);
    duckTimer = setTimeout(() => {
      void releaseDuckHold(true);
    }, textLength * DUCK_MIN_MS_PER_CHAR + DUCK_GRACE_MS);
  } catch {
    return;
  }
}

export async function stopDuckHold(): Promise<void> {
  duckHolds = Math.max(0, duckHolds - 1);
  if (duckHolds > 0) return;
  await releaseDuckHold(false);
}

async function releaseDuckHold(force: boolean): Promise<void> {
  if (force) duckHolds = 0;
  if (duckTimer) {
    clearTimeout(duckTimer);
    duckTimer = null;
  }
  if (duckPlayer) {
    try {
      duckPlayer.pause();
      if (force) {
        duckPlayer.remove();
        duckPlayer = null;
      }
    } catch {}
  }
}
