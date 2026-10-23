import AsyncStorage from "@react-native-async-storage/async-storage";

const VOTED_KEY = "roadassist.votedFlags";
const DENIED_KEY = "roadassist.deniedFlags";
const MAX = 500;

function keyFor(base: string, uid: string | null | undefined): string | null {
  if (typeof uid !== "string" || uid === "") return null;
  return `${base}.${uid}`;
}

async function readSet(key: string | null): Promise<Set<string>> {
  if (key === null) return new Set();
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

async function writeSet(key: string | null, set: Set<string>): Promise<void> {
  if (key === null) return;
  try {
    const arr = Array.from(set).slice(-MAX);
    await AsyncStorage.setItem(key, JSON.stringify(arr));
  } catch {
    return;
  }
}

export async function markVoted(uid: string | null, id: string): Promise<void> {
  const key = keyFor(VOTED_KEY, uid);
  const s = await readSet(key);
  s.add(id);
  await writeSet(key, s);
}

export async function markDenied(uid: string | null, id: string): Promise<void> {
  const key = keyFor(DENIED_KEY, uid);
  const s = await readSet(key);
  s.add(id);
  await writeSet(key, s);
}

export async function hasVoted(uid: string | null, id: string): Promise<boolean> {
  const s = await readSet(keyFor(VOTED_KEY, uid));
  return s.has(id);
}

export async function isDenied(uid: string | null, id: string): Promise<boolean> {
  const s = await readSet(keyFor(DENIED_KEY, uid));
  return s.has(id);
}

export async function loadVotedIds(uid: string | null): Promise<Set<string>> {
  return readSet(keyFor(VOTED_KEY, uid));
}

export async function loadDeniedIds(uid: string | null): Promise<Set<string>> {
  return readSet(keyFor(DENIED_KEY, uid));
}

export async function loadVoted(uid: string | null): Promise<Set<string>> {
  return readSet(keyFor(VOTED_KEY, uid));
}

export async function loadDenied(uid: string | null): Promise<Set<string>> {
  return readSet(keyFor(DENIED_KEY, uid));
}

export async function load(uid: string | null, key: string): Promise<Set<string>> {
  return readSet(keyFor(key, uid));
}
