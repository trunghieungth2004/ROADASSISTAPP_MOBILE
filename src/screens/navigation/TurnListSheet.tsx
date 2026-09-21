import {Pressable, StyleSheet, View} from "react-native";
import {AppText as Text} from "../../components/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import type {AppTheme} from "../../theme";
import type {Strings} from "../../i18n/en";
import type {RouteStep} from "../../api/routes";
import type {RouteProgress} from "../../services/navigation";
import {formatDist, turnIcon, turnLabel} from "./navUtils";

type Props = {
  t: Strings;
  theme: AppTheme;
  bottomPad: number;
  steps: RouteStep[];
  stepProg: number[];
  streets: Record<number, string>;
  progress: RouteProgress | null;
  remainingMeters: number;
  onClose: () => void;
  onPreviewStep: (index: number) => void;
};

export default function TurnListSheet(props: Props) {
  const {t, theme} = props;
  return (
    <View style={styles.sheetRoot}>
      <Pressable style={StyleSheet.absoluteFill} onPress={props.onClose} accessibilityRole="button" accessibilityLabel={t.common.close} />
      <View style={[styles.sheet, {backgroundColor: theme.paper, borderColor: theme.border, paddingBottom: props.bottomPad}]}>
        <View style={styles.sheetHead}>
          <Text style={[styles.sheetTitle, {color: theme.text}]}>{formatDist(props.remainingMeters, t.route.km, t.nav.m)}</Text>
          <Pressable onPress={props.onClose} accessibilityRole="button" accessibilityLabel={t.common.close}>
            <MaterialIcons name="close" size={22} color={theme.text} />
          </Pressable>
        </View>
        {props.steps.map((s, i) => {
          const street = s.street ?? props.streets[i];
          const behind = props.progress !== null && props.stepProg[i] <= props.progress.progressMeters + 5;
          const toGo = props.progress !== null ? Math.max(0, props.stepProg[i] - props.progress.progressMeters) : 0;
          return (
            <Pressable key={i} style={[styles.turnRow, behind && styles.turnRowDone]} onPress={() => props.onPreviewStep(i)}>
              <MaterialIcons name={turnIcon(s.kind)} size={24} color={behind ? theme.muted : theme.primary} />
              <View style={styles.turnMain}>
                <Text style={[styles.turnText, {color: behind ? theme.muted : theme.text}]} numberOfLines={1}>
                  {turnLabel(t.nav.turns as Record<string, string>, t.nav.turns.other, s.kind)}{street ? ` · ${street}` : ""}
                </Text>
                {!behind ? <Text style={[styles.turnSub, {color: theme.muted}]}>{formatDist(toGo, t.route.km, t.nav.m)}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetRoot: {position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)"},
  sheet: {borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, padding: 12, gap: 8, maxHeight: "70%"},
  sheetHead: {flexDirection: "row", alignItems: "center", gap: 8},
  sheetTitle: {flex: 1, fontSize: 18, fontWeight: "700"},
  turnRow: {flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8},
  turnRowDone: {opacity: 0.55},
  turnMain: {flex: 1, minWidth: 0, gap: 2},
  turnText: {fontSize: 15, fontWeight: "600"},
  turnSub: {fontSize: 13},
});
