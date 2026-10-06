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
  pill: {borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9},
  text: {color: "#fff", fontSize: 11, fontWeight: "700"},
});
