import {ScrollView, StyleSheet, Text, View, Pressable, useColorScheme} from "react-native";
import {useStrings} from "../context/LanguageContext";
import {darkTheme, lightTheme} from "../theme";
import ScreenContainer from "../components/ScreenContainer";
import {Card} from "../components/Card";
export default function HomeScreen() {
  const {t} = useStrings();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const actions = [
    {title: t.tabs.route, hint: t.common.routeFromHere, icon: "🧭"},
    {title: t.tabs.hazards, hint: t.hazards.pickHint, icon: "⚠️"},
    {title: t.tabs.vehicle, hint: t.vehicle.empty, icon: "🛵"},
    {title: t.more.savedRoutes, hint: t.common.save, icon: "🔖"},
  ];
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={[styles.container, {backgroundColor: theme.background}]}>
        <Text style={[styles.greeting, {color: theme.text}]}>{t.appName}</Text>
        <Text style={[styles.subtitle, {color: theme.muted}]}>{t.roles.subtitle}</Text>
        <View style={styles.grid}>
          {actions.map((a) => (
            <View key={a.title} style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}><Text>{a.icon}</Text><Text style={[styles.cardTitle, {color: theme.text}]}>{a.title}</Text><Text style={[styles.cardHint, {color: theme.muted}]}>{a.hint}</Text></View>
          ))}
        </View>
        <Card><Text style={[styles.cardTitle, {color: theme.text}]}>{t.hazards.myReports}</Text><Text style={{color: theme.muted}}>{t.hazards.empty}</Text></Card>
      </ScrollView>
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  container: {padding: 16, gap: 12},
  greeting: {fontSize: 22, fontWeight: "700"},
  subtitle: {fontSize: 13},
  grid: {flexDirection: "row", flexWrap: "wrap", gap: 12},
  card: {width: "48%", borderWidth: 1, borderRadius: 16, padding: 16, gap: 6},
  cardTitle: {fontWeight: "700"},
  cardHint: {fontSize: 12},
});
