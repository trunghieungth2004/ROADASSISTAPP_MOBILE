import {useState, type ReactNode} from "react";
import {ActivityIndicator, Pressable, StyleSheet, Text, View, useColorScheme} from "react-native";
import {createBottomTabNavigator} from "@react-navigation/bottom-tabs";
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
  const insets = useSafeAreaInsets();
  if (!loaded || (token && loading && !bundle)) return <View style={styles.center}><ActivityIndicator /></View>;
  if (!token) return <LoginScreen />;
  if (!roleChosen) return <OnboardingGate />;
  if (!isRider) return <UnsupportedRole />;
  return (
    <Tab.Navigator initialRouteName="Route" screenOptions={({route}) => ({headerShown: true, tabBarShowLabel: true, tabBarActiveTintColor: theme.primary, tabBarInactiveTintColor: theme.tabInactive, tabBarStyle: {backgroundColor: theme.paper, borderTopWidth: 1, borderTopColor: theme.divider, paddingBottom: insets.bottom}, headerStyle: {backgroundColor: theme.paper}, headerTintColor: theme.text, tabBarIcon: ({color, size}) => (TAB_ICONS[route.name] ?? (() => null))({color, size})})}>
      <Tab.Screen name="Route" component={RouteScreen} options={{title: t.tabs.route}} />
      <Tab.Screen name="Hazards" component={HazardScreen} options={{title: t.tabs.hazards}} />
      <Tab.Screen name="Assist" component={AssistScreen} options={{title: `${t.tabs.dispatch} · ${t.tabs.soon}`}} listeners={{tabPress: (e) => e.preventDefault()}} />
      <Tab.Screen name="Vehicle" component={VehicleScreen} options={{title: t.tabs.vehicle}} />
      <Tab.Screen name="More" component={MoreScreen} options={{title: t.tabs.more}} />
    </Tab.Navigator>
  );
}
const styles = StyleSheet.create({center: {flex: 1, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", gap: 12}, primary: {backgroundColor: "#0284c7", borderRadius: 8, padding: 12}, primaryText: {color: "#fff", fontWeight: "700"}});
