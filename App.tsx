import {StatusBar} from "expo-status-bar";
import {NavigationContainer, DarkTheme, DefaultTheme} from "@react-navigation/native";
import {createNativeStackNavigator} from "@react-navigation/native-stack";
import {SafeAreaProvider} from "react-native-safe-area-context";
import {useFonts} from "expo-font";
import {AuthProvider, useAuth} from "./src/context/AuthContext";
import {LanguageProvider} from "./src/context/LanguageContext";
import {ProfileProvider} from "./src/context/ProfileContext";
import {ThemeProvider, useThemeMode} from "./src/context/ThemeContext";
import {NavSessionProvider} from "./src/context/NavSessionContext";
import {BillsProvider} from "./src/context/BillsContext";
import {APP_FONTS} from "./src/components/ui/AppText";
import {darkTheme, lightTheme} from "./src/theme";
import Tabs from "./src/navigation/Tabs";
import NavigationScreen from "./src/screens/NavigationScreen";
import DiagnosticsScreen from "./src/screens/DiagnosticsScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import AboutScreen from "./src/screens/AboutScreen";
import PermissionsScreen from "./src/screens/PermissionsScreen";
import ProvidersScreen from "./src/screens/ProvidersScreen";
import BillsScreen from "./src/screens/BillsScreen";
import BillDetailScreen from "./src/screens/BillDetailScreen";
import PaymentsScreen from "./src/screens/PaymentsScreen";
import {useEffect, useRef, useState} from "react";
import {AppState} from "react-native";
import {ensurePushConfigured, drainPaymentLaunch, subscribePaymentPush, subscribePushTokenRefresh, syncPushTokenWithRetry, type PaymentPushData} from "./src/services/push";
import {navigationRef} from "./src/navigation/ref";
import {warmAudio} from "./src/services/sound";
import {shouldOfferUpdate, skipRelease, type AppRelease} from "./src/services/appUpdate";
import UpdateDialog from "./src/components/UpdateDialog";
import {useStrings} from "./src/context/LanguageContext";

const Stack = createNativeStackNavigator();

function PushSync() {
  const {token, uid, loaded} = useAuth();
  const registeredRef = useRef(false);
  useEffect(() => {
    if (!loaded) return;
    registeredRef.current = false;
    void ensurePushConfigured();
    void warmAudio();
    let alive = true;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();
    const sync = async (): Promise<void> => {
      if (!alive) return;
      if (retry !== null) {
        clearTimeout(retry);
        retry = null;
      }
      const ok = await syncPushTokenWithRetry(token, uid, 6, controller.signal);
      if (!alive) return;
      if (ok) registeredRef.current = true;
      if (ok) return;
      retry = setTimeout(() => {
        void sync();
      }, 30000);
    };
    void sync();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && !registeredRef.current) void sync();
    });
    const tokenSub = subscribePushTokenRefresh(token, uid);
    return () => {
      alive = false;
      controller.abort();
      if (retry !== null) clearTimeout(retry);
      sub.remove();
      tokenSub();
    };
  }, [token, uid, loaded]);
  return null;
}

function openPaymentPush(data: PaymentPushData): void {
  if (!navigationRef.isReady()) return;
  if (data.payoutId !== undefined || data.event === "PAYOUT_SETTLED") {
    navigationRef.navigate("Payments", {
      tab: "receive",
      ...(data.payoutId === undefined ? {} : {payoutId: data.payoutId}),
    });
    return;
  }
  if (data.ticketId !== "") {
    const payee = data.event === "PAYMENT_OPENED" || data.event === "PAYMENT_RECEIVED";
    navigationRef.navigate("BillDetail", {
      ticketId: data.ticketId,
      ...(payee ? {scope: "payee"} : {}),
    });
    return;
  }
  navigationRef.navigate("Payments");
}

function PaymentPushSync({navReady}: {navReady: boolean}) {
  const {uid, loaded} = useAuth();
  const [pending, setPending] = useState<PaymentPushData | null>(null);
  useEffect(() => {
    if (!loaded || !uid) return;
    let alive = true;
    void drainPaymentLaunch().then((data) => {
      if (alive && data) setPending(data);
    });
    const unsubscribe = subscribePaymentPush((data) => setPending(data), uid);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [loaded, uid]);
  useEffect(() => {
    if (!pending || !navReady || !navigationRef.isReady()) return;
    openPaymentPush(pending);
    setPending(null);
  }, [pending, navReady]);
  return null;
}
function UpdateCheck() {
  const {t} = useStrings();
  const [release, setRelease] = useState<AppRelease | null>(null);
  useEffect(() => {
    let alive = true;
    void shouldOfferUpdate().then((r) => {
      if (alive && r) setRelease(r);
    });
    return () => {
      alive = false;
    };
  }, []);
  if (!release) return null;
  return (
    <UpdateDialog
      t={t}
      release={release}
      onSkip={() => {
        void skipRelease(release.tag);
        setRelease(null);
      }}
      onClose={() => setRelease(null)}
    />
  );
}
export default function App() {
  const [fontsLoaded] = useFonts(APP_FONTS);
  if (!fontsLoaded) return null;
  return <ThemeProvider><ThemedApp /></ThemeProvider>;
}
function ThemedApp() {
  const {mode} = useThemeMode();
  const [navReady, setNavReady] = useState(false);
  const scheme = mode;
  const navTheme = scheme === "dark" ? DarkTheme : DefaultTheme;
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <ProfileProvider>
            <BillsProvider>
              <NavSessionProvider>
                <PushSync />
                <PaymentPushSync navReady={navReady} />
                <UpdateCheck />
                <NavigationContainer
                  ref={navigationRef}
                  onReady={() => setNavReady(true)}
                  theme={{...navTheme, colors: {...navTheme.colors, background: theme.background, card: theme.paper, text: theme.text, primary: theme.primary, border: theme.border}}}
                >
                  <Stack.Navigator>
                    <Stack.Screen name="Tabs" component={Tabs} options={{headerShown: false}} />
                    <Stack.Screen name="Navigation" component={NavigationScreen} options={{headerShown: false, gestureEnabled: false}} />
                    <Stack.Screen name="Diagnostics" component={DiagnosticsScreen} />
                    <Stack.Screen name="Settings" component={SettingsScreen} />
                    <Stack.Screen name="About" component={AboutScreen} />
                    <Stack.Screen name="Permissions" component={PermissionsScreen} />
                    <Stack.Screen name="Providers" component={ProvidersScreen} />
                    <Stack.Screen name="Bills" component={BillsScreen} />
                    <Stack.Screen name="Payments" component={PaymentsScreen} />
                    <Stack.Screen name="BillDetail" component={BillDetailScreen} />
                  </Stack.Navigator>
                </NavigationContainer>
                <StatusBar style={scheme === "dark" ? "light" : "dark"} />
              </NavSessionProvider>
            </BillsProvider>
          </ProfileProvider>
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
