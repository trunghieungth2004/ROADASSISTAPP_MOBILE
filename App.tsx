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
import {APP_FONTS} from "./src/components/ui/AppText";
import {darkTheme, lightTheme} from "./src/theme";
import Tabs from "./src/navigation/Tabs";
import NavigationScreen from "./src/screens/NavigationScreen";
import DiagnosticsScreen from "./src/screens/DiagnosticsScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import AboutScreen from "./src/screens/AboutScreen";
import PermissionsScreen from "./src/screens/PermissionsScreen";
import ProvidersScreen from "./src/screens/ProvidersScreen";
import {useEffect, useState} from "react";
import {ensurePushConfigured, syncPushToken} from "./src/services/push";
import {warmAudio} from "./src/services/sound";
import {shouldOfferUpdate, skipRelease, type AppRelease} from "./src/services/appUpdate";
import UpdateDialog from "./src/components/UpdateDialog";
import {useStrings} from "./src/context/LanguageContext";

const Stack = createNativeStackNavigator();

function PushSync() {
  const {token, uid} = useAuth();
  useEffect(() => {
    ensurePushConfigured();
    void warmAudio();
    void syncPushToken(token, uid);
  }, [token, uid]);
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
  const scheme = mode;
  const navTheme = scheme === "dark" ? DarkTheme : DefaultTheme;
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <ProfileProvider>
            <NavSessionProvider>
              <PushSync />
              <UpdateCheck />
              <NavigationContainer theme={{...navTheme, colors: {...navTheme.colors, background: theme.background, card: theme.paper, text: theme.text, primary: theme.primary, border: theme.border}}}>
                <Stack.Navigator>
                  <Stack.Screen name="Tabs" component={Tabs} options={{headerShown: false}} />
                  <Stack.Screen name="Navigation" component={NavigationScreen} options={{headerShown: false, gestureEnabled: false}} />
                  <Stack.Screen name="Diagnostics" component={DiagnosticsScreen} />
                  <Stack.Screen name="Settings" component={SettingsScreen} />
                  <Stack.Screen name="About" component={AboutScreen} />
                  <Stack.Screen name="Permissions" component={PermissionsScreen} />
                  <Stack.Screen name="Providers" component={ProvidersScreen} />
                </Stack.Navigator>
              </NavigationContainer>
              <StatusBar style={scheme === "dark" ? "light" : "dark"} />
            </NavSessionProvider>
          </ProfileProvider>
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
