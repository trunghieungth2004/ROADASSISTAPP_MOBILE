import {StyleSheet, View} from "react-native";
import {useAppMode} from "../../context/ThemeContext";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import {darkTheme, lightTheme} from "../../theme";
import Overlay from "../../components/overlay/Overlay";

type Props = {
  t: Strings;
  ticketLabel: string;
  attempt: number;
  callOutTotal: number;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function SosContinuationSheet({t, ticketLabel, attempt, callOutTotal, busy, error, onConfirm, onCancel}: Props) {
  const scheme = useAppMode();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const body = t.assist.continueSosBody
    .replace("{n}", String(attempt))
    .replace("{total}", `${callOutTotal.toLocaleString()} VND`);
  return (
    <Overlay
      visible
      variant="dialog"
      title={`${t.assist.continueSosTitle} · ${ticketLabel}`}
      closeLabel={t.common.cancel}
      onClose={onCancel}
      scrollable={false}
      actions={[
        {label: t.assist.continueSosCancel, tone: "neutral", outline: true, onPress: onCancel},
        {label: t.assist.continueSosConfirm, tone: "primary", busy, onPress: onConfirm},
      ]}
    >
      <View style={styles.body}>
        <View style={styles.row}>
          <MaterialIcons name="build" size={18} color={theme.primary} />
          <Text style={[styles.title, {color: theme.text}]}>{t.assist.continueSosTitle}</Text>
        </View>
        <Text style={[styles.hint, {color: theme.muted}]}>{body}</Text>
        <Text style={[styles.hint, {color: theme.muted}]}>{t.assist.newCallOut}</Text>
        {error ? <Text style={[styles.hint, {color: theme.danger}]}>{error}</Text> : null}
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  body: {gap: 8, width: "100%"},
  row: {flexDirection: "row", alignItems: "center", gap: 8},
  title: {fontSize: 15, fontWeight: "700"},
  hint: {fontSize: 13, lineHeight: 19},
});
