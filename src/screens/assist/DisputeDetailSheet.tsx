import {useEffect, useState} from "react";
import {Image, Pressable, StyleSheet, View} from "react-native";
import {useAppMode} from "../../context/ThemeContext";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import {darkTheme, lightTheme, type AppTheme} from "../../theme";
import Overlay from "../../components/overlay/Overlay";
import {usePhotoViewer} from "../../components/ui/PhotoViewer";
import {resolvePhotoUrl} from "../../services/photos";
import {timeAgoLabel} from "../hazards/hazardFilter";
import {disputeLabel, disputeResultLabel} from "./disputeLabels";

type Dispute = {
  status: string;
  type: string;
  reasonCode: string;
  filedBy: string;
  filedByRole?: string | null;
  hold: boolean;
  note?: string | null;
  photoUrls?: string[];
  outcome?: string | null;
  resolution?: string | null;
  at: string;
  resolvedAt?: string | null;
};

function agoOf(at: string, t: Strings): string {
  return timeAgoLabel(at, Date.now(), t.hazards) ?? at;
}

function Photo({path, onPress}: {path: string; onPress: (url: string) => void}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void resolvePhotoUrl(path).then((next) => {
      if (alive) setUrl(next);
    });
    return () => {
      alive = false;
    };
  }, [path]);
  if (url === null) return null;
  return (
    <Pressable onPress={() => onPress(url)} accessibilityRole="button">
      <Image source={{uri: url}} style={styles.thumb} />
    </Pressable>
  );
}

function Cell({label, value, theme}: {label: string; value: string; theme: AppTheme}) {
  return (
    <View style={styles.cell}>
      <Text style={[styles.cellLabel, {color: theme.muted}]}>{label}</Text>
      <Text style={[styles.cellValue, {color: theme.text}]}>{value}</Text>
    </View>
  );
}

export default function DisputeDetailSheet({
  t,
  dispute,
  riderUid,
  onClose,
}: {
  t: Strings;
  dispute: Dispute;
  riderUid: string;
  onClose: () => void;
}) {
  const scheme = useAppMode();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const photoViewer = usePhotoViewer(t.common.cancel);
  const photos = (Array.isArray(dispute.photoUrls) ? dispute.photoUrls : []).slice(0, 5);
  const result = disputeResultLabel(dispute.status, dispute.outcome, t);
  const resultColor = dispute.status === "OPEN" ?
    theme.primary :
    dispute.status === "DISMISSED" ?
      theme.muted :
      dispute.outcome === "RIDER" ?
        theme.success :
        theme.primary;
  const resultIcon = dispute.status === "OPEN" ?
    "hourglass-empty" :
    dispute.status === "DISMISSED" ?
      "block" :
      dispute.outcome === "RIDER" ?
        "check-circle" :
        dispute.outcome === "PARTIAL" ?
          "balance" :
          "storefront";
  return (
    <Overlay
      visible
      variant="dialog"
      title={t.dispute.detailsTitle}
      right={
        <View style={[styles.statusPill, {
          backgroundColor: dispute.status === "OPEN" ?
            theme.danger :
            dispute.status === "RESOLVED" ?
              theme.success :
              theme.muted,
        }]}>
          <Text style={styles.statusPillText}>{dispute.status}</Text>
        </View>
      }
      closeLabel={t.common.cancel}
      onClose={onClose}
      actions={[{label: t.common.close, tone: "neutral", outline: true, onPress: onClose}]}
      scrollable={false}
    >
      <View style={styles.body}>
        <View style={[styles.hero, {backgroundColor: `${resultColor}1a`}]}>
          <MaterialIcons name={resultIcon as never} size={22} color={resultColor} />
          <View style={styles.heroText}>
            <Text style={[styles.heroTitle, {color: resultColor}]}>{result}</Text>
            <Text style={[styles.heroMeta, {color: theme.muted}]}>
              {`${t.dispute.filed}: ${agoOf(dispute.at, t)}`}
            </Text>
          </View>
        </View>
        <Text style={[styles.subject, {color: theme.text}]}>
          {disputeLabel(dispute.type, dispute.reasonCode, t)}
        </Text>
        <View style={styles.grid}>
          <Cell
            theme={theme}
            label={t.dispute.filedBy}
            value={dispute.filedByRole === "SYSTEM" ?
            t.dispute.autoFiled :
            dispute.filedBy === riderUid ? t.roles.rider : t.payments.providerParty}
          />
          <Cell
            theme={theme}
            label={t.dispute.filed}
            value={new Date(dispute.at).toLocaleDateString()}
          />
          {dispute.resolvedAt ? (
            <Cell
              theme={theme}
              label={t.dispute.resolvedAt}
              value={new Date(dispute.resolvedAt).toLocaleDateString()}
            />
          ) : null}
          {dispute.hold ? (
            <Cell theme={theme} label={t.dispute.resultOpen} value={t.assist.disputeUnderReview} />
          ) : null}
        </View>
        {dispute.note ? (
          <View style={styles.block}>
            <Text style={[styles.blockLabel, {color: theme.muted}]}>{t.dispute.note}</Text>
            <Text style={[styles.blockValue, {color: theme.text}]} numberOfLines={2}>
              {dispute.note}
            </Text>
          </View>
        ) : null}
        {dispute.resolution ? (
          <View style={styles.block}>
            <Text style={[styles.blockLabel, {color: theme.muted}]}>{t.dispute.resolution}</Text>
            <Text style={[styles.blockValue, {color: theme.text}]} numberOfLines={2}>
              {dispute.resolution}
            </Text>
          </View>
        ) : null}
        {photos.length > 0 ? (
          <View style={styles.block}>
            <Text style={[styles.blockLabel, {color: theme.muted}]}>
              {`${t.assist.photos} · ${photos.length}`}
            </Text>
            <View style={styles.photos}>
              {photos.map((path, index) => (
                <Photo
                  key={`${path}-${index}`}
                  path={path}
                  onPress={(url) => photoViewer.open(url)}
                />
              ))}
            </View>
          </View>
        ) : null}
        {photoViewer.node}
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  body: {gap: 10, width: "100%"},
  statusPill: {borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10},
  statusPillText: {fontSize: 10, fontWeight: "700", color: "#fff"},
  hero: {flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, padding: 12},
  heroText: {flex: 1, gap: 2},
  heroTitle: {fontSize: 15, fontWeight: "800"},
  heroMeta: {fontSize: 11},
  subject: {fontSize: 13, fontWeight: "600"},
  grid: {flexDirection: "row", flexWrap: "wrap", rowGap: 8, columnGap: 12},
  cell: {width: "47%", gap: 2},
  cellLabel: {fontSize: 10},
  cellValue: {fontSize: 12, fontWeight: "600"},
  block: {gap: 3},
  blockLabel: {fontSize: 10},
  blockValue: {fontSize: 12, lineHeight: 17},
  photos: {flexDirection: "row", gap: 6, flexWrap: "nowrap"},
  thumb: {width: 52, height: 52, borderRadius: 8},
});
