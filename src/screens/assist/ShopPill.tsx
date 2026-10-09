import {Pressable, StyleSheet} from "react-native";
import {AppText as Text} from "../../components/ui/AppText";
import type {AppTheme} from "../../theme";

type Props = {
  theme: AppTheme;
  label: string;
  selected: boolean;
  onPress: () => void;
};

export default function ShopPill({theme, label, selected, onPress}: Props) {
  return (
    <Pressable
      style={[styles.pill, {backgroundColor: selected ? theme.primary : "#334155"}]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14},
  text: {color: "#fff", fontSize: 13, fontWeight: "700"},
});
