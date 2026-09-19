import AsyncStorage from "@react-native-async-storage/async-storage";

const VOTED_KEY = "roadassist.votedFlags";
const DENIED_KEY = "roadassist.deniedFlags";
const MAX = 500;

async function readSet(key: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

async function writeSet(key: string, set: Set<string>): Promise<void> {
  const arr = Array.from(set).slice(-MAX);
  await AsyncStorage.setItem(key, JSON.stringify(arr));
}

export async function hasVoted(id: string): Promise<boolean> {
  return (await readSet(VOTED_KEY)).has(id);
}

export async function markVoted(id: string): Promise<void> {
  const s = await readSet(VOTED_KEY);
  s.add(id);
  await writeSet(VOTED_KEY, s);
}

export async function hasDenied(id: string): Promise<boolean> {
  return (await readSet(DENIED_KEY)).has(id);
}

export async function markDenied(id: string): Promise<void> {
  const s = await readSet(DENIED_KEY);
  s.add(id);
  await writeSet(DENIED_KEY, s);
}

export function hasVotedSync(set: Set<string>, id: string): boolean {
  return set.has(id);
}
