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
import {useEffect} from "react";
import {ensurePushConfigured, syncPushToken} from "./src/services/push";
import {warmAudio} from "./src/services/sound";

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
              <NavigationContainer theme={{...navTheme, colors: {...navTheme.colors, background: theme.background, card: theme.paper, text: theme.text, primary: theme.primary, border: theme.border}}}>
                <Stack.Navigator>
                  <Stack.Screen name="Tabs" component={Tabs} options={{headerShown: false}} />
                  <Stack.Screen name="Navigation" component={NavigationScreen} options={{headerShown: false, gestureEnabled: false}} />
                  <Stack.Screen name="Diagnostics" component={DiagnosticsScreen} />
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
