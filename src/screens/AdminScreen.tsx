import {ScrollView, StyleSheet, Text, View, useColorScheme} from "react-native";
import {useStrings} from "../context/LanguageContext";
import {darkTheme, lightTheme} from "../theme";
import ScreenContainer from "../components/ScreenContainer";
import {Card} from "../components/Card";
export default function AdminScreen() {
  const {t} = useStrings();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={[styles.container, {backgroundColor: theme.background}]}>
        <Text style={[styles.title, {color: theme.text}]}>{t.tabs.home ?? "Admin"}</Text>
        <Card><Text style={{color: theme.text}}>{t.tabs.home ?? "Admin"} — {t.common.loading}</Text><Text style={{color: theme.muted}}>User / Flag / Alley moderation available on web.</Text></Card>
      </ScrollView>
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  container: {padding: 16, gap: 12},
  title: {fontSize: 20, fontWeight: "700"},
});
