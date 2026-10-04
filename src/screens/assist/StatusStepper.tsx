import {StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";
import {DISPATCH_STATUS} from "../../api/dispatch";
import {stageLabel, statusStages, statusTone} from "./ticketLabels";

type Props = {
  t: Strings;
  theme: AppTheme;
  ticketType: string;
  status: string;
  declineReason?: string | null;
};

export default function StatusStepper({t, theme, ticketType, status, declineReason}: Props) {
  const tone = statusTone(status);
  if (tone === "failed") {
    return (
      <View style={styles.failedRow}>
        <MaterialIcons name="cancel" size={18} color={theme.danger} />
        <View style={styles.failedText}>
          <Text style={[styles.stageLabel, {color: theme.text}]}>{stageLabel(ticketType, status, t)}</Text>
          {declineReason ? <Text style={[styles.coords, {color: theme.muted}]}>{declineReason}</Text> : null}
        </View>
      </View>
    );
  }
  const stages = statusStages(ticketType);
  const at = Math.max(0, stages.indexOf(status));
  return (
    <View>
      {stages.map((stage, i) => {
        const done = i < at || status === DISPATCH_STATUS.RESOLVED;
        const current = i === at && status !== DISPATCH_STATUS.RESOLVED;
        return (
          <View key={stage} style={styles.row}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  {borderColor: done || current ? theme.primary : theme.border},
                  done && {backgroundColor: theme.primary},
                  current && {borderWidth: 3},
                ]}
              >
                {done ? <MaterialIcons name="check" size={12} color="#fff" /> : null}
              </View>
              {i < stages.length - 1 ? <View style={[styles.line, {backgroundColor: theme.border}]} /> : null}
            </View>
            <Text style={[styles.stageLabel, {color: done || current ? theme.text : theme.muted}]}>{stageLabel(ticketType, stage, t)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: "row", alignItems: "flex-start", gap: 10, minHeight: 30},
  rail: {alignItems: "center", width: 18},
  dot: {width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: "center", justifyContent: "center"},
  line: {width: 2, flex: 1, minHeight: 8},
  stageLabel: {fontSize: 13, fontWeight: "600", paddingTop: 1},
  coords: {fontSize: 12},
  failedRow: {flexDirection: "row", alignItems: "flex-start", gap: 10},
  failedText: {gap: 2, flex: 1},
});
