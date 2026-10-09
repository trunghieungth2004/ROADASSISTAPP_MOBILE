import {StyleSheet, View} from "react-native";
import {AppText as Text} from "../../components/ui/AppText";
import type {AppTheme} from "../../theme";

type Props = {
  theme: AppTheme;
  label: string;
};

export default function RouteMidPill({theme, label}: Props) {
  return (
    <View style={[styles.pill, {backgroundColor: theme.primary}]} pointerEvents="none" accessibilityLabel={label}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14},
  text: {color: "#fff", fontSize: 13, fontWeight: "700"},
});
