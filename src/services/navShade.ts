import {requireNativeModule} from "expo-modules-core";

type NavNotificationNative = {
  update: (title: string, body: string, progress: number) => Promise<void>;
  clear: () => Promise<void>;
};

let cached: NavNotificationNative | null = null;
let attempted = false;

function get(): NavNotificationNative | null {
  if (cached || attempted) return cached;
  attempted = true;
  try {
    cached = requireNativeModule<NavNotificationNative>("NavNotification");
  } catch {
    cached = null;
  }
  return cached;
}

export async function updateNavShade(title: string, body: string, progress: number): Promise<void> {
  try {
    await get()?.update(title, body, Math.max(0, Math.min(1, progress)));
  } catch {
    return;
  }
}

export async function clearNavShade(): Promise<void> {
  try {
    await get()?.clear();
  } catch {
    return;
  }
}
