import {Pressable, StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../components/ui/AppText";
import Overlay from "../../components/overlay/Overlay";
import type {Strings} from "../../i18n/en";
import {useAppMode} from "../../context/ThemeContext";
import {themeForMode} from "../../theme";

type Props = {
  t: Strings;
  busy: boolean;
  error: string | null;
  onCancelTicket: () => void;
  onChangeShop: () => void;
  onClose: () => void;
};

export default function SosCancelSheet({
  t,
  busy,
  error,
  onCancelTicket,
  onChangeShop,
  onClose,
}: Props) {
  const scheme = useAppMode();
  const theme = themeForMode(scheme);
  return (
    <Overlay
      visible
      variant="dialog"
      title={t.assist.sosCancelTitle}
      closeLabel={t.common.close}
      onClose={onClose}
      scrollable={false}
    >
      <View style={styles.body}>
        <Text style={[styles.bodyText, {color: theme.muted}]}>{t.assist.sosCancelBody}</Text>
        {error ? <Text style={[styles.error, {color: theme.danger}]}>{error}</Text> : null}
        <Pressable
          style={[styles.option, {borderColor: theme.danger, backgroundColor: theme.paper}]}
          disabled={busy}
          onPress={onCancelTicket}
          accessibilityRole="button"
          accessibilityLabel={t.assist.sosCancelWhole}
        >
          <MaterialIcons name="close" size={22} color={theme.danger} />
          <View style={styles.optionText}>
            <Text style={[styles.optionTitle, {color: theme.danger}]}>{t.assist.sosCancelWhole}</Text>
            <Text style={[styles.optionHint, {color: theme.muted}]}>{t.assist.sosCancelWholeHint}</Text>
          </View>
        </Pressable>
        <Pressable
          style={[styles.option, {borderColor: theme.primary, backgroundColor: theme.paper}]}
          disabled={busy}
          onPress={onChangeShop}
          accessibilityRole="button"
          accessibilityLabel={t.assist.sosChangeShop}
        >
          <MaterialIcons name="storefront" size={22} color={theme.primary} />
          <View style={styles.optionText}>
            <Text style={[styles.optionTitle, {color: theme.primary}]}>{t.assist.sosChangeShop}</Text>
            <Text style={[styles.optionHint, {color: theme.muted}]}>{t.assist.sosChangeShopHint}</Text>
          </View>
        </Pressable>
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  body: {gap: 10, width: "100%"},
  bodyText: {fontSize: 13, lineHeight: 19},
  error: {fontSize: 12},
  option: {borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: "row", gap: 12, alignItems: "flex-start"},
  optionText: {flex: 1, gap: 3},
  optionTitle: {fontSize: 14, fontWeight: "700"},
  optionHint: {fontSize: 11, lineHeight: 16},
});
