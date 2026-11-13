import {Pressable, StyleSheet, View} from "react-native";
import type {Strings} from "../../i18n/en";
import type {AppealItem, EligibleAppeals} from "../../api/appeals";
import type {ReceivedRating, ReceivedRatings} from "../../api/ratings";
import {useAppMode} from "../../context/ThemeContext";
import {darkTheme, lightTheme} from "../../theme";
import Overlay from "../../components/overlay/Overlay";
import {AppText as Text} from "../../components/ui/AppText";
import RatingRow from "../assist/RatingRow";
import { caseImpact, caseTitle } from "./caseLabels";

function statusLabel(status: string | null, t: Strings): string | null {
  if (status === "OPEN") return t.more.removalRequested;
  if (status === "RESOLVED") return t.more.appealResolved;
  if (status === "DISMISSED") return t.more.appealDismissed;
  return null;
}

function statusColor(status: string | null): string {
  if (status === "OPEN") return "#b45309";
  if (status === "RESOLVED") return "#15803d";
  return "#737373";
}

export default function AppealsSheet({
  t,
  eligible,
  received,
  onClose,
  onOpen,
}: {
  t: Strings;
  eligible: EligibleAppeals;
  received: ReceivedRatings | null;
  onClose: () => void;
  onOpen: (item: AppealItem) => void;
}) {
  const scheme = useAppMode();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const sections = [
    {
      key: "ratings",
      title: t.more.appealSubjectRating,
      items: eligible.ratings,
    },
    {
      key: "reports",
      title: t.more.appealSubjectReport,
      items: eligible.reports,
    },
    {
      key: "disputes",
      title: t.more.appealSubjectDispute,
      items: eligible.disputes,
    },
  ];
  return (
    <Overlay
      visible
      variant="sheet"
      title={t.more.cases}
      closeLabel={t.common.cancel}
      onClose={onClose}
      scrollable
    >
      <View style={styles.body}>
        {received !== null &&
        (received.rider.count > 0 ||
          received.providers.some((provider) => provider.count > 0)) ? (
          <View style={[styles.summary, {borderColor: theme.border}]}>
            <Text style={[styles.summaryTitle, {color: theme.text}]}>
              {t.more.yourRatings}
            </Text>
            <Text style={[styles.summaryText, {color: theme.muted}]}>
              {[
                received.rider.count > 0 ?
                  `${t.more.ratingAsRider} ${received.rider.avg.toFixed(1)} (${received.rider.count})` :
                  null,
                ...received.providers
                  .filter((provider) => provider.count > 0)
                  .map((provider) => `${provider.name} ${provider.avg.toFixed(1)} (${provider.count})`),
              ].filter((part): part is string => part !== null).join(" · ")}
            </Text>
          </View>
        ) : null}
        {eligible.ratings.length + eligible.reports.length + eligible.disputes.length === 0 ? (
          <Text style={[styles.empty, {color: theme.muted}]}>{t.more.noAppeals}</Text>
        ) : null}
        {sections.map((section) => (
          <View key={section.key} style={styles.section}>
            <Text style={[styles.sectionTitle, {color: theme.text}]}>
              {section.title}
            </Text>
            {section.items.length === 0 ? (
              <Text style={[styles.empty, {color: theme.muted}]}>
                {t.more.noAppeals}
              </Text>
            ) : null}
            {section.items.map((item) => {
              const status = statusLabel(item.appealStatus, t);
              const impact = caseImpact(item, t, theme);
              const rating = item.subjectKind === "RATING" ?
                item.snapshot as unknown as ReceivedRating :
                null;
              return (
                <Pressable
                  key={`${item.subjectKind}-${item.subjectId}`}
                  onPress={() => onOpen(item)}
                  style={[styles.item, {borderColor: theme.border, borderLeftColor: impact?.color ?? theme.border}]}
                  accessibilityRole="button"
                  accessibilityLabel={t.more.viewDetails}
                >
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
                  ) : (
                    <Text style={[styles.itemLabel, {color: theme.text}]}>
                      {caseTitle(item, t)}
                    </Text>
                  )}
                  <View style={styles.foot}>
                    <Text style={[styles.date, {color: theme.muted}]}>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </Text>
                    {impact ? (
                      <View style={[styles.outcome, {backgroundColor: `${impact.color}1a`}]}>
                        <Text style={[styles.outcomeText, {color: impact.color}]}>
                          {impact.label}
                        </Text>
                      </View>
                    ) : null}
                    {status ? (
                      <Text style={[styles.statusText, {color: statusColor(item.appealStatus)}]}>
                        {status}
                      </Text>
                    ) : null}
                    <Text style={[styles.view, {color: theme.primary}]}>
                      {t.more.viewDetails}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  body: {gap: 14, width: "100%"},
  summary: {borderWidth: 1, borderRadius: 12, padding: 10, gap: 3},
  summaryTitle: {fontSize: 14, fontWeight: "700"},
  summaryText: {fontSize: 12, lineHeight: 17},
  section: {gap: 8},
  sectionTitle: {fontSize: 15, fontWeight: "700"},
  empty: {fontSize: 12},
  item: {borderWidth: 1, borderLeftWidth: 3, borderRadius: 12, padding: 10, gap: 6},
  itemLabel: {fontSize: 13, fontWeight: "600"},
  foot: {flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap"},
  date: {fontSize: 11},
  outcome: {borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8},
  outcomeText: {fontSize: 10, fontWeight: "700"},
  statusText: {fontSize: 10, fontWeight: "600"},
  view: {fontSize: 11, fontWeight: "600", marginLeft: "auto"},
});
