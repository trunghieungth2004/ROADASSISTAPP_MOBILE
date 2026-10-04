import {useEffect, useState, type ReactNode} from "react";
import {ActivityIndicator, AppState, Platform, Pressable, StyleSheet, View, useColorScheme} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {AppText as Text} from "../components/ui/AppText";
import {createBottomTabNavigator, type BottomTabBarProps} from "@react-navigation/bottom-tabs";
import {MaterialCommunityIcons, MaterialIcons} from "@expo/vector-icons";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {toMessage} from "../api/client";
import {useAuth} from "../context/AuthContext";
import {useProfile} from "../context/ProfileContext";
import {useStrings} from "../context/LanguageContext";
import {darkTheme, lightTheme} from "../theme";
import LoginScreen from "../screens/LoginScreen";
import OnboardingScreen, {type ShopDraft, type TowDraft} from "../screens/OnboardingScreen";
import PermissionGateScreen from "../screens/PermissionGateScreen";
import {getPermissionStates, openAppSettings, openBatterySettings, requestBackgroundLocationPermission, requestNotificationPermission, type AppPermissionStates} from "../services/permissions";
import {syncPushToken} from "../services/push";
import {normalizeTowPlate, parseTowWidth, validateTowDraft} from "../services/towPlates";
import {createProvider} from "../api/providers";
import RouteScreen from "../screens/RouteScreen";
import HazardScreen from "../screens/HazardScreen";
import AssistScreen from "../screens/AssistScreen";
import VehicleScreen from "../screens/VehicleScreen";
import MoreScreen from "../screens/MoreScreen";
const Tab = createBottomTabNavigator();
type IconProps = {color: string; size: number};
const TAB_ICONS: Record<string, (props: IconProps) => ReactNode> = {
  Route: (p) => <MaterialIcons name="route" {...p} />,
  Hazards: (p) => <MaterialIcons name="warning-amber" {...p} />,
  Assist: (p) => <MaterialIcons name="build" {...p} />,
  Vehicle: (p) => <MaterialCommunityIcons name="motorbike" {...p} />,
  More: (p) => <MaterialIcons name="more-horiz" {...p} />,
};
function TabBar({state, descriptors, navigation}: BottomTabBarProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const focusedOptions = descriptors[state.routes[state.index].key]?.options as {tabBarStyle?: {display?: string}} | undefined;
  if (focusedOptions?.tabBarStyle?.display === "none") return null;
  return <View style={[styles.tabBar, {backgroundColor: theme.paper, borderTopColor: theme.divider, paddingBottom: insets.bottom}]}>{state.routes.map((route, index) => {
    const focused = state.index === index;
    const options = descriptors[route.key].options;
    const color = focused ? theme.primary : theme.tabInactive;
    const onPress = () => {
      const event = navigation.emit({type: "tabPress", target: route.key, canPreventDefault: true});
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
    };
    return <Pressable key={route.key} accessibilityRole="tab" accessibilityState={{selected: focused}} onPress={onPress} style={styles.tabItem}>
      <View style={[styles.iconSlot, focused && {backgroundColor: `${theme.primary}33`}]}>{(TAB_ICONS[route.name] ?? (() => null))({color, size: 22})}</View>
      <Text numberOfLines={1} style={[styles.tabLabel, {color}]}>{options.title ?? route.name}</Text>
    </Pressable>;
  })}</View>;
}
function UnsupportedRole() {
  const {t} = useStrings();
  const {signOut} = useAuth();
  const {refresh, loading} = useProfile();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  return (
    <View style={[styles.center, {backgroundColor: theme.background}]}>
      <Text style={{color: theme.text}}>{t.roles.unsupported}</Text>
      <Pressable style={[styles.primary, {backgroundColor: theme.primary}, loading && styles.disabled]} disabled={loading} onPress={() => void refresh()}>
        <Text style={styles.primaryText}>{t.common.retry}</Text>
      </Pressable>
      <Pressable style={styles.primary} onPress={() => void signOut()}><Text style={styles.primaryText}>{t.more.signOut}</Text></Pressable>
    </View>
  );
}
function PermissionGate({onDone}: {onDone: () => void}) {
  const {t} = useStrings();
  const {token, uid} = useAuth();
  const [states, setStates] = useState<AppPermissionStates | null>(null);
  const [busy, setBusy] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const showBackground = Platform.OS === "android";
  const refresh = (): void => {
    void getPermissionStates().then(setStates).catch(() => undefined);
  };
  useEffect(refresh, []);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => sub.remove();
  }, []);
  const canDone = !!states && states.notifications.granted && (!showBackground || states.backgroundLocation.granted);
  const finish = (): void => {
    void AsyncStorage.setItem("roadassist.permGate", "done").catch(() => undefined);
    onDone();
  };
  const grant = (fn: () => Promise<{granted: boolean; canAskAgain: boolean}>, register: boolean): void => {
    if (busy) return;
    setBusy(true);
    setGrantError(null);
    void (async () => {
      try {
        const next = await fn();
        if (!next.granted && !next.canAskAgain) openAppSettings();
        await getPermissionStates().then(setStates).catch(() => undefined);
        if (next.granted && register) await syncPushToken(token, uid);
      } catch {
        setGrantError(t.more.gateFailed);
      } finally {
        setBusy(false);
      }
    })();
  };
  return (
    <PermissionGateScreen
      t={t}
      states={states}
      busy={busy}
      showBackground={showBackground}
      canDone={canDone}
      grantError={grantError}
      onHideGrantError={() => setGrantError(null)}
      onGrantNotifications={() => grant(requestNotificationPermission, true)}
      onGrantBackground={() => grant(requestBackgroundLocationPermission, false)}
      onOpenBattery={() => openBatterySettings()}
      onSkip={finish}
      onDone={finish}
    />
  );
}
function OnboardingGate() {
  const {t, lang} = useStrings();
  const {token} = useAuth();
  const {markOnboarded, refresh} = useProfile();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function finishGate(services: string[], shop: ShopDraft | null, tow: TowDraft | null) {
    setBusy(true); setError(null);
    try {
      if (tow) {
        const bad = validateTowDraft({plate: tow.plate, vehicleType: tow.vehicleType, width: tow.width});
        if (bad) throw new Error(t.tow.invalid);
      }
      for (const service of services) { await markOnboarded(service); }
      if (token) {
        if (shop) {
          try {
            await createProvider({kind: "SHOP", name: shop.name.trim(), lat: shop.lat, lng: shop.lng, ...(shop.label ? {label: shop.label} : {}), ...(shop.openHours ? {openHours: shop.openHours} : {})}, token);
          } catch (err) {
            throw new Error(`${t.provider.createShopFailed} ${toMessage(err)}`);
          }
        }
        if (tow) {
          try {
            await createProvider({kind: "TOW", name: tow.name.trim(), lat: tow.lat, lng: tow.lng, plate: normalizeTowPlate(tow.plate), vehicleType: tow.vehicleType, vehicleWidth: parseTowWidth(tow.width) ?? undefined}, token);
          } catch (err) {
            throw new Error(`${t.provider.createTowFailed} ${toMessage(err)}`);
          }
        }
      }
      await refresh();
    } catch (err) { setError(toMessage(err)); } finally { setBusy(false); }
  }
  async function skipGate() { setBusy(true); try { await markOnboarded("RIDER"); await refresh(); } finally { setBusy(false); } }
  return <OnboardingScreen t={t} lang={lang} token={token} busy={busy} error={error} onFinish={(services, shop, tow) => void finishGate(services, shop, tow)} onSkip={() => void skipGate()} />;
}
export default function Tabs() {
  const {t} = useStrings();
  const {token, loaded} = useAuth();
  const {loading, roleChosen, isRider, bundle} = useProfile();
  const [permsDone, setPermsDone] = useState(false);
  useEffect(() => {
    if (!token) {
      setPermsDone(false);
      return;
    }
    void AsyncStorage.getItem("roadassist.permGate").then((v) => {
      if (v === "done") setPermsDone(true);
    }).catch(() => undefined);
  }, [token]);
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  if (!loaded || (token && loading && !bundle)) return <View style={styles.center}><ActivityIndicator /></View>;
  if (!token) return <LoginScreen />;
  if (!roleChosen) return <OnboardingGate />;
  if (!isRider) return <UnsupportedRole />;
  if (!permsDone) return <PermissionGate onDone={() => setPermsDone(true)} />;
  return (
    <Tab.Navigator initialRouteName="Route" tabBar={(props) => <TabBar {...props} />} screenOptions={{headerShown: true, headerStyle: {backgroundColor: theme.paper}, headerTintColor: theme.text}}>
      <Tab.Screen name="Route" component={RouteScreen} options={{title: t.tabs.route}} />
      <Tab.Screen name="Hazards" component={HazardScreen} options={{title: t.tabs.hazards}} />
      <Tab.Screen name="Assist" component={AssistScreen} options={{title: t.tabs.dispatch}} />
      <Tab.Screen name="Vehicle" component={VehicleScreen} options={{title: t.tabs.vehicle}} />
      <Tab.Screen name="More" component={MoreScreen} options={{title: t.tabs.more}} />
    </Tab.Navigator>
  );
}
const styles = StyleSheet.create({center: {flex: 1, alignItems: "center", justifyContent: "center", gap: 12}, primary: {borderRadius: 8, padding: 12}, disabled: {opacity: 0.6}, primaryText: {color: "#fff", fontWeight: "700"}, tabBar: {flexDirection: "row", borderTopWidth: 1, paddingTop: 6}, tabItem: {flex: 1, alignItems: "center", justifyContent: "center", minHeight: 58, gap: 3}, iconSlot: {width: 48, height: 32, borderRadius: 999, overflow: "hidden", alignItems: "center", justifyContent: "center"}, tabLabel: {fontSize: 11, fontWeight: "600", maxWidth: "100%"}});
