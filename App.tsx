import {StatusBar} from "expo-status-bar";
import {NavigationContainer, DarkTheme, DefaultTheme} from "@react-navigation/native";
import {SafeAreaProvider} from "react-native-safe-area-context";
import {useFonts} from "expo-font";
import {AuthProvider} from "./src/context/AuthContext";
import {LanguageProvider} from "./src/context/LanguageContext";
import {ProfileProvider} from "./src/context/ProfileContext";
import {ThemeProvider, useThemeMode} from "./src/context/ThemeContext";
import {APP_FONTS} from "./src/components/AppText";
import {darkTheme, lightTheme} from "./src/theme";
import Tabs from "./src/navigation/Tabs";
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
            <NavigationContainer theme={{...navTheme, colors: {...navTheme.colors, background: theme.background, card: theme.paper, text: theme.text, primary: theme.primary, border: theme.border}}}>
              <Tabs />
            </NavigationContainer>
            <StatusBar style={scheme === "dark" ? "light" : "dark"} />
          </ProfileProvider>
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
