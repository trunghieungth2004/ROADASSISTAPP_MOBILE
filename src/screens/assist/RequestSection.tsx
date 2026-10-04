import type {ReactNode} from "react";
import {ActivityIndicator, Pressable, StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text, AppTextInput as TextInput} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";
import type {TicketType} from "../../api/dispatch";

type Props = {
  t: Strings;
  theme: AppTheme;
  ticketType: TicketType;
  onTicketType: (t: TicketType) => void;
  showMechanic: boolean;
  note: string;
  onNote: (s: string) => void;
  towDest: ReactNode | null;
  reqBusy: boolean;
  onRequest: () => void;
};

const KINDS: {id: TicketType; icon: "sos" | "local-shipping" | "car-repair"}[] = [
  {id: "SOS", icon: "sos"},
  {id: "TOW", icon: "local-shipping"},
  {id: "MECHANIC", icon: "car-repair"},
];

export default function RequestSection({t, theme, ticketType, onTicketType, showMechanic, note, onNote, towDest, reqBusy, onRequest}: Props) {
  const kinds = showMechanic ? KINDS : KINDS.filter((k) => k.id !== "MECHANIC");
  return (
    <View style={styles.wrap}>
      <View style={styles.typeGroup}>
        {kinds.map((kind) => {
          const selected = ticketType === kind.id;
          return (
            <Pressable
              key={kind.id}
              onPress={() => onTicketType(kind.id)}
              style={[styles.typeBtn, {borderColor: theme.primary, borderWidth: selected ? 2 : 1}, selected && {backgroundColor: theme.primary}]}
              accessibilityRole="button"
              accessibilityState={{checked: selected}}
              accessibilityLabel={kind.id === "SOS" ? t.assist.sos : kind.id === "TOW" ? t.assist.tow : t.assist.mechanic}
            >
              <MaterialIcons name={kind.icon} size={22} color={selected ? "#fff" : theme.primary} />
            </Pressable>
          );
        })}
      </View>
      <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} placeholder={t.assist.note} placeholderTextColor={theme.muted} value={note} onChangeText={onNote} />
      {ticketType === "TOW" ? towDest : null}
      <Pressable style={[styles.primary, {backgroundColor: theme.primary}, reqBusy && styles.disabled]} disabled={reqBusy} onPress={onRequest} accessibilityRole="button" accessibilityLabel={t.assist.request}>
        {reqBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t.assist.request}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {gap: 8},
  typeGroup: {flexDirection: "row", gap: 8},
  typeBtn: {borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", minWidth: 52, borderStyle: "solid"},
  input: {borderWidth: 1, borderRadius: 8, padding: 10},
  primary: {borderRadius: 8, padding: 12, alignItems: "center"},
  disabled: {opacity: 0.6},
  primaryText: {color: "#fff", fontWeight: "700"},
});
