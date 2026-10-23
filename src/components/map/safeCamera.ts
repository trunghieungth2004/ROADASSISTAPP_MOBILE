import type {CameraRef} from "@maplibre/maplibre-react-native";

export function safeCameraCall(call: () => void | Promise<void>): void {
  try {
    const result = call();
    if (result && typeof (result as Promise<void>).catch === "function") {
      void (result as Promise<void>).catch(() => undefined);
    }
  } catch {
    return;
  }
}

export function safeCameraReady(ready: boolean, call: () => void | Promise<void>): void {
  if (!ready) return;
  safeCameraCall(call);
}