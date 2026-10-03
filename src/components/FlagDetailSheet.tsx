import {StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text} from "./AppText";
import type {Flag} from "../api/flags";
import {FLAG_CONSENSUS_THRESHOLD} from "../api/flags";
import {flagActions, formatUntil, joinMeta} from "../screens/hazards/flagActions";
import {darkTheme, lightTheme} from "../theme";
import type {Strings} from "../i18n/en";

type Props = {
  t: Strings;
  flag: Flag | null;
  isOwn: boolean;
};

export default function FlagDetailSheet({t, flag, isOwn}: Props) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  if (!flag) return null;
  const showLocked = flagActions(flag.status, isOwn).includes("locked");
  const confirmers = typeof flag.confirmerCount === "number" ? flag.confirmerCount : Math.max(0, flag.voteCount ?? 0);
  const threshold = flag.consensusThreshold ?? FLAG_CONSENSUS_THRESHOLD;
  const progress = flag.status === "1" ? t.flag.confirmations.replace("{v}", String(confirmers)).replace("{t}", String(threshold)) : null;
  const until = formatUntil(flag.ttlExpiresAtMs, Date.now(), t.flag);
  const meta = joinMeta([flag.reporterHandle ?? null, `${flag.voteCount ?? 0} ${t.flag.votes}`, progress, until]);
  return (
    <View style={styles.body}>
      {showLocked ? <Text style={[styles.lockedNote, {color: theme.muted}]}>{t.flag.lockedNote}</Text> : null}
      <Text style={[styles.meta, {color: theme.muted}]}>{meta}</Text>
      {flag.note ? <Text style={{color: theme.text}}>{flag.note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {gap: 10, width: "100%"},
  lockedNote: {fontSize: 12},
  meta: {fontSize: 13},
});
