import {useState, type ReactNode} from "react";
import {ActivityIndicator, Pressable, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text} from "../components/AppText";
import {createBottomTabNavigator, type BottomTabBarProps} from "@react-navigation/bottom-tabs";
import {MaterialCommunityIcons, MaterialIcons} from "@expo/vector-icons";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {toMessage} from "../api/client";
import {useAuth} from "../context/AuthContext";
import {useProfile} from "../context/ProfileContext";
import {useStrings} from "../context/LanguageContext";
import {darkTheme, lightTheme} from "../theme";
import LoginScreen from "../screens/LoginScreen";
import OnboardingScreen from "../screens/OnboardingScreen";
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
  const {signOut} = useAuth();
  return <View style={styles.center}><Text>Role not supported on mobile yet.</Text><Pressable style={styles.primary} onPress={() => void signOut()}><Text style={styles.primaryText}>Sign out</Text></Pressable></View>;
}
function OnboardingGate() {
  const {t} = useStrings();
  const {markOnboarded, refresh} = useProfile();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function finishGate(services: string[]) {
    setBusy(true); setError(null);
    try { for (const service of services) { await markOnboarded(service); } await refresh(); } catch (err) { setError(toMessage(err)); } finally { setBusy(false); }
  }
  async function skipGate() { setBusy(true); try { await markOnboarded("RIDER"); await refresh(); } finally { setBusy(false); } }
  return <OnboardingScreen t={t} busy={busy} error={error} onFinish={(services) => void finishGate(services)} onSkip={() => void skipGate()} />;
}
export default function Tabs() {
  const {t} = useStrings();
  const {token, loaded} = useAuth();
  const {loading, roleChosen, isRider, bundle} = useProfile();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  if (!loaded || (token && loading && !bundle)) return <View style={styles.center}><ActivityIndicator /></View>;
  if (!token) return <LoginScreen />;
  if (!roleChosen) return <OnboardingGate />;
  if (!isRider) return <UnsupportedRole />;
  return (
    <Tab.Navigator initialRouteName="Route" tabBar={(props) => <TabBar {...props} />} screenOptions={{headerShown: true, headerStyle: {backgroundColor: theme.paper}, headerTintColor: theme.text}}>
      <Tab.Screen name="Route" component={RouteScreen} options={{title: t.tabs.route}} />
      <Tab.Screen name="Hazards" component={HazardScreen} options={{title: t.tabs.hazards}} />
      <Tab.Screen name="Assist" component={AssistScreen} options={{title: `${t.tabs.dispatch} · ${t.tabs.soon}`}} listeners={{tabPress: (e) => e.preventDefault()}} />
      <Tab.Screen name="Vehicle" component={VehicleScreen} options={{title: t.tabs.vehicle}} />
      <Tab.Screen name="More" component={MoreScreen} options={{title: t.tabs.more}} />
    </Tab.Navigator>
  );
}
const styles = StyleSheet.create({center: {flex: 1, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", gap: 12}, primary: {backgroundColor: "#0284c7", borderRadius: 8, padding: 12}, primaryText: {color: "#fff", fontWeight: "700"}, tabBar: {flexDirection: "row", borderTopWidth: 1, paddingTop: 6}, tabItem: {flex: 1, alignItems: "center", justifyContent: "center", minHeight: 58, gap: 3}, iconSlot: {width: 48, height: 32, borderRadius: 999, overflow: "hidden", alignItems: "center", justifyContent: "center"}, tabLabel: {fontSize: 11, fontWeight: "600", maxWidth: "100%"}});
