import {ActivityIndicator, StyleSheet, View} from "react-native";
import {AppText as Text} from "../ui/AppText";
import type {AppTheme} from "../../theme";

type Props = {theme: AppTheme; text: string; compact?: boolean};

export default function StatusRow({theme, text, compact}: Props) {
  if (compact === true) {
    return (
      <View style={styles.slim}>
        <ActivityIndicator size="small" color={theme.primary} />
        <Text style={{color: theme.muted}}>{text}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.row, {borderColor: theme.border}]}>
      <ActivityIndicator size="small" color={theme.primary} />
      <Text style={{color: theme.text}}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, padding: 10},
  slim: {flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 4},
});
