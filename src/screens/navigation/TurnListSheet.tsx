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
  steps: RouteStep[];
  stepProg: number[];
  streets: Record<number, string>;
  progress: RouteProgress | null;
  onPreviewStep: (index: number) => void;
};

export default function TurnListSheet(props: Props) {
  const {t, theme} = props;
  return (
    <View style={styles.body}>
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
  );
}

const styles = StyleSheet.create({
  body: {gap: 0, width: "100%"},
  turnRow: {flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8},
  turnRowDone: {opacity: 0.55},
  turnMain: {flex: 1, minWidth: 0, gap: 2},
  turnText: {fontSize: 15, fontWeight: "600"},
  turnSub: {fontSize: 13},
});
