import {Platform} from "react-native";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";

export type PermissionState = {
  granted: boolean;
  canAskAgain: boolean;
};

export type AppPermissionStates = {
  notifications: PermissionState;
  backgroundLocation: PermissionState;
};

export async function getPermissionStates(): Promise<AppPermissionStates> {
  let notifications: PermissionState = {granted: false, canAskAgain: true};
  let backgroundLocation: PermissionState = {granted: false, canAskAgain: true};
  try {
    const n = await Notifications.getPermissionsAsync();
    notifications = {granted: n.granted, canAskAgain: n.canAskAgain ?? !n.granted};
  } catch {
    return {notifications, backgroundLocation};
  }
  try {
    if (Platform.OS === "android") {
      const b = await Location.getBackgroundPermissionsAsync();
      backgroundLocation = {granted: b.granted, canAskAgain: b.canAskAgain ?? !b.granted};
    } else {
      const f = await Location.getForegroundPermissionsAsync();
      backgroundLocation = {granted: f.granted, canAskAgain: f.canAskAgain ?? !f.granted};
    }
  } catch {}
  return {notifications, backgroundLocation};
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  try {
    const r = await Notifications.requestPermissionsAsync();
    return {granted: r.granted, canAskAgain: r.canAskAgain ?? !r.granted};
  } catch {
    return {granted: false, canAskAgain: false};
  }
}

export async function requestBackgroundLocationPermission(): Promise<PermissionState> {
  try {
    const f = await Location.requestForegroundPermissionsAsync();
    if (f.status !== "granted") return {granted: false, canAskAgain: f.canAskAgain};
    if (Platform.OS !== "android") return {granted: true, canAskAgain: true};
    const b = await Location.requestBackgroundPermissionsAsync();
    return {granted: b.granted, canAskAgain: b.canAskAgain};
  } catch {
    return {granted: false, canAskAgain: false};
  }
}

export function openAppSettings(): void {
  void Linking.openSettings().catch(() => undefined);
}
