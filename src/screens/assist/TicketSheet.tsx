import type {ReactNode} from "react";
import {StyleSheet, View} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";
import type {TicketType} from "../../api/dispatch";
import Overlay from "../../components/overlay/Overlay";

type Props = {
  t: Strings;
  theme: AppTheme;
  ticketType: TicketType;
  note: string;
  onNote: (s: string) => void;
  towDest: ReactNode | null;
  busy: boolean;
  onSubmit: () => void;
  onClose: () => void;
};

function titleOf(ticketType: TicketType, t: Strings): string {
  if (ticketType === "TOW") return t.assist.tow;
  if (ticketType === "MECHANIC") return t.assist.mechanic;
  return t.assist.sos;
}

export default function TicketSheet({t, theme, ticketType, note, onNote, towDest, busy, onSubmit, onClose}: Props) {
  return (
    <Overlay
      visible
      variant="dialog"
      title={titleOf(ticketType, t)}
      closeLabel={t.common.cancel}
      onClose={onClose}
      scrollable={false}
      actions={[{label: t.assist.request, tone: "primary", busy, onPress: onSubmit}]}
    >
      <View style={styles.body}>
        <TextInput
          style={[styles.input, {borderColor: theme.border, color: theme.text}]}
          placeholder={t.assist.note}
          placeholderTextColor={theme.muted}
          value={note}
          onChangeText={onNote}
          autoFocus
        />
        {ticketType === "TOW" ? towDest : null}
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  body: {gap: 8, width: "100%"},
  input: {borderWidth: 1, borderRadius: 8, padding: 10},
});
