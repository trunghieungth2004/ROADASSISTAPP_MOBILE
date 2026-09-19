import {StyleSheet, View, useColorScheme} from "react-native";
import {darkTheme, lightTheme} from "../theme";
export function Card({children}: {children: React.ReactNode}) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  return <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>{children}</View>;
}
const styles = StyleSheet.create({card: {borderWidth: 1, borderRadius: 16, padding: 16}});
