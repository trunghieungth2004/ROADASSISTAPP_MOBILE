import {StyleSheet, View} from "react-native";
import {AppText as Text} from "../../../components/ui/AppText";
import type {Strings} from "../../../i18n/en";
import type {AppTheme} from "../../../theme";
import type {FeedTicket} from "../../../api/dispatch";
import {timeAgoLabel} from "../../hazards/hazardFilter";
import {stageLabel, statusPillColor, statusStages} from "../ticketLabels";
import {CardHead, DetailCard} from "./parts";

function agoOf(at: string, t: Strings): string {
  return timeAgoLabel(at, Date.now(), t.hazards) ?? at;
}

export default function StatusCard({t, theme, ticket}: {t: Strings; theme: AppTheme; ticket: FeedTicket}) {
  const history = Array.isArray(ticket.statusHistory) ? ticket.statusHistory : [];
  const stages = statusStages(ticket.ticketType);
  const seen = new Set(history.map((h) => h.status));
  const atOf = new Map(history.map((h) => [h.status, h.at] as [string, string]));
  const current = ticket.status;
  const trailing = !stages.includes(current) ? [current] : [];
  const rows = [...stages.filter((s) => seen.has(s) || s === current), ...trailing];
  const currentAt = atOf.get(current) ?? history[history.length - 1]?.at ?? null;
  const tint = statusPillColor(current, theme);
  const summary = rows.map((status) => {
    const at = atOf.get(status);
    const label = stageLabel(ticket.ticketType, status, t);
    return at !== undefined && at !== "" ? `${label} ${agoOf(at, t)}` : label;
  }).join(", ");
  return (
    <DetailCard theme={theme}>
      <CardHead theme={theme} icon="timeline" title={t.assist.statusTitle} />
      <View style={styles.history} accessible accessibilityLabel={summary}>
        {rows.map((status, i) => {
          const failed = !stages.includes(status);
          const filled = seen.has(status) || status === current;
          const dotColor = failed ? theme.danger : filled ? statusPillColor(status, theme) : theme.border;
          return (
            <View key={`${status}-${i}`} style={styles.historyStep}>
              {i > 0 ? <View style={[styles.historyLine, {backgroundColor: theme.border}]} /> : null}
              <View style={[styles.historyDot, {borderColor: dotColor, backgroundColor: filled || failed ? dotColor : "transparent"}]} />
            </View>
          );
        })}
        <Text numberOfLines={1} style={[styles.historyLabel, {color: tint}]}>{stageLabel(ticket.ticketType, current, t)}</Text>
        {currentAt !== null ? <Text numberOfLines={1} style={[styles.historyTime, {color: theme.muted}]}>{` · ${agoOf(currentAt, t)}`}</Text> : null}
      </View>
    </DetailCard>
  );
}

const styles = StyleSheet.create({
  history: {flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap"},
  historyStep: {flexDirection: "row", alignItems: "center", gap: 4},
  historyLine: {width: 8, height: 2, borderRadius: 1},
  historyDot: {width: 9, height: 9, borderRadius: 4.5, borderWidth: 1.5},
  historyLabel: {fontSize: 12, fontWeight: "700", marginLeft: 2},
  historyTime: {fontSize: 11},
});
