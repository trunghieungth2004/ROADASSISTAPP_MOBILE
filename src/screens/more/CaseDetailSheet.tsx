import type {ComponentProps} from "react";
import {StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import type {Strings} from "../../i18n/en";
import type {AppealItem} from "../../api/appeals";
import type {ReceivedRating} from "../../api/ratings";
import {useAppMode} from "../../context/ThemeContext";
import {darkTheme, lightTheme} from "../../theme";
import Overlay from "../../components/overlay/Overlay";
import {AppText as Text} from "../../components/ui/AppText";
import RatingRow from "../assist/RatingRow";
import {
  appealResolutionLabel,
  caseImpact,
  caseTitle,
  disputeOutcomeLabel,
  disputeTypeLabel,
  reportActionLabel,
  reportReasonLabel,
} from "./caseLabels";

function statusLabel(status: string | null, t: Strings): string {
  if (status === "OPEN") return t.more.removalRequested;
  if (status === "RESOLVED") return t.more.appealResolved;
  if (status === "DISMISSED") return t.more.appealDismissed;
  return t.more.noAppeal;
}

function Row({label, value, color}: {label: string; value: string; color?: string}) {
  if (value === "") return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, color ? {color} : null]}>{value}</Text>
    </View>
  );
}

export default function CaseDetailSheet({
  t,
  item,
  onClose,
  onAppeal,
}: {
  t: Strings;
  item: AppealItem;
  onClose: () => void;
  onAppeal: (item: AppealItem) => void;
}) {
  const scheme = useAppMode();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const snapshot = item.snapshot;
  const rating = item.subjectKind === "RATING" ?
    snapshot as unknown as ReceivedRating :
    null;
  const text = (key: string): string =>
    typeof snapshot[key] === "string" || typeof snapshot[key] === "number" ?
      String(snapshot[key]) :
      "";
  const status = statusLabel(item.appealStatus, t);
  const impact = caseImpact(item, t, theme);
  const icon = impact?.icon as ComponentProps<typeof MaterialIcons>["name"] | undefined;
  const kind = item.subjectKind === "RATING" ?
    t.more.appealSubjectRating :
    item.subjectKind === "REPORT" ?
      t.more.appealSubjectReport :
      t.more.appealSubjectDispute;
  const title = item.subjectKind === "RATING" ?
    t.more.appealSubjectRating :
    caseTitle(item, t);
  return (
    <Overlay
      visible
      variant="sheet"
      title={t.more.caseDetails}
      closeLabel={t.common.close}
      onClose={onClose}
      actions={item.canAppeal ? [{
        label: item.subjectKind === "RATING" ?
          t.more.requestRemoval :
          t.more.appealAction,
        tone: "primary" as const,
        onPress: () => onAppeal(item),
      }] : []}
      scrollable
    >
      <View style={styles.body}>
        <View style={[styles.hero, {borderColor: theme.border}]}>
          <Text style={[styles.heroKind, {color: theme.muted}]}>{kind}</Text>
          <Text style={[styles.heroTitle, {color: theme.text}]}>{title}</Text>
          <Text style={[styles.heroMeta, {color: theme.muted}]}>
            {`${t.more.appealDate}: ${new Date(item.createdAt).toLocaleDateString()}`}
          </Text>
        </View>
        {impact && icon ? (
          <View style={[styles.impact, {borderColor: impact.color, backgroundColor: `${impact.color}14`}]}>
            <MaterialIcons name={icon} size={20} color={impact.color} />
            <View style={styles.impactText}>
              <Text style={[styles.impactTitle, {color: impact.color}]}>{impact.label}</Text>
              <Text style={[styles.impactBody, {color: theme.muted}]}>{impact.body}</Text>
            </View>
            {impact.delta ? (
              <Text style={[styles.impactDelta, {color: impact.color}]}>{impact.delta}</Text>
            ) : null}
          </View>
        ) : null}
        <Text style={[styles.section, {color: theme.text}]}>{t.more.originalCase}</Text>
        {rating ? (
          <RatingRow
            theme={theme}
            rating={{
              id: rating.id,
              score: rating.score,
              text: rating.text,
              authorName: rating.byUserName,
            }}
          />
        ) : item.subjectKind === "REPORT" ? (
          <>
            <Row label={t.more.caseReason} value={reportReasonLabel(text("reason"), t)} />
            <Row label={t.more.caseAction} value={reportActionLabel(text("action"), t)} />
            <Row label={t.more.caseDecisionNote} value={text("actionNote")} />
            <Row label={t.more.caseNote} value={text("note")} />
          </>
        ) : (
          <>
            <Row label={t.more.caseReason} value={disputeTypeLabel(text("type"), t)} />
            <Row label={t.more.caseOutcome} value={disputeOutcomeLabel(text("outcome"), t)} />
            <Row label={t.more.caseResolution} value={text("resolution")} />
          </>
        )}
        <View style={[styles.statusRow, {borderColor: theme.border}]}>
          <MaterialIcons name="gavel" size={16} color={theme.primary} />
          <Text style={[styles.statusText, {color: theme.text}]}>
            {`${t.more.appealStatus}: ${status}`}
          </Text>
        </View>
        {item.appealStatus ? (
          <>
            <Row label={t.more.appealReasonTitle} value={item.appealReason ?? ""} />
            <Row label={t.more.appealNote} value={item.appealNote ?? ""} />
            <Row
              label={t.more.caseOutcome}
              value={item.appealResolution ? appealResolutionLabel(item.appealResolution, t) : ""}
            />
            <Row
              label={t.more.appealDate}
              value={item.appealCreatedAt ?
                new Date(item.appealCreatedAt).toLocaleDateString() :
                ""}
            />
            <Row
              label={t.more.appealDecided}
              value={item.appealDecidedAt ?
                new Date(item.appealDecidedAt).toLocaleDateString() :
                ""}
            />
          </>
        ) : !item.canAppeal ? (
          <Text style={[styles.hint, {color: theme.muted}]}>
            {t.more.appealWindowClosed}
          </Text>
        ) : null}
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  body: {gap: 8, width: "100%"},
  hero: {borderWidth: 1, borderRadius: 12, padding: 10, gap: 2},
  heroKind: {fontSize: 10, fontWeight: "700", textTransform: "uppercase"},
  heroTitle: {fontSize: 14, fontWeight: "700"},
  heroMeta: {fontSize: 11},
  impact: {flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 12, padding: 10},
  impactText: {flex: 1, gap: 2},
  impactTitle: {fontSize: 13, fontWeight: "700"},
  impactBody: {fontSize: 11, lineHeight: 15},
  impactDelta: {fontSize: 12, fontWeight: "700"},
  section: {fontSize: 13, fontWeight: "700", marginTop: 4},
  row: {flexDirection: "row", alignItems: "flex-start", gap: 12},
  rowLabel: {width: 120, fontSize: 11, color: "#737373"},
  rowValue: {flex: 1, fontSize: 12},
  statusRow: {flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, padding: 8},
  statusText: {fontSize: 12, fontWeight: "600"},
  hint: {fontSize: 11},
});
