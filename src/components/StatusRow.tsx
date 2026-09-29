import {ActivityIndicator, StyleSheet, View} from "react-native";
import {AppText as Text} from "./AppText";
import type {AppTheme} from "../theme";

type Props = {theme: AppTheme; text: string};

export default function StatusRow({theme, text}: Props) {
  return (
    <View style={[styles.row, {borderColor: theme.border}]}>
      <ActivityIndicator size="small" color={theme.primary} />
      <Text style={{color: theme.text}}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, padding: 10},
});
