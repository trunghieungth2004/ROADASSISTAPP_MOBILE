import type {ReactNode} from "react";
import {ScrollView, StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../../components/ui/AppText";
import type {Strings} from "../../../i18n/en";
import type {AppTheme} from "../../../theme";
import {CardHead, DetailCard, detailStyles} from "./parts";
import PhotoThumb from "../../../components/ui/PhotoThumb";

type Props = {
  t: Strings;
  theme: AppTheme;
  note: string | null;
  description: string | null;
  showRequestPhotos: boolean;
  requestPaths: string[];
  evidencePaths: string[];
  unfixablePaths?: string[];
  loadedPaths?: string[];
  receivedPaths?: string[];
  right?: ReactNode;
  onOpenPhoto: (path: string) => void;
};

function unique(paths: string[]): string[] {
  return [...new Set(paths.filter((path) => path !== ""))];
}

function PhotoLane({theme, label, icon, paths, onOpenPhoto}: {
  theme: AppTheme;
  label: string;
  icon: string;
  paths: string[];
  onOpenPhoto: (path: string) => void;
}) {
  if (paths.length === 0) return null;
  return (
    <View style={styles.lane}>
      <View style={[styles.laneBadge, {borderColor: theme.border, backgroundColor: theme.paper}]}>
        <MaterialIcons name={icon as never} size={12} color={theme.primary} />
        <Text style={[styles.laneText, {color: theme.text}]}>{`${label} · ${paths.length}`}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.laneRow}>
        {paths.map((path, index) => (
          <PhotoThumb
            key={`${label}-${index}-${path}`}
            path={path}
            theme={theme}
            style={detailStyles.thumb}
            accessibilityLabel={`${label} ${index + 1}`}
            onPress={onOpenPhoto}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export default function NotesPhotosCard({t, theme, note, description, showRequestPhotos, requestPaths, evidencePaths, unfixablePaths = [], loadedPaths = [], receivedPaths = [], right, onOpenPhoto}: Props) {
  const riderPaths = unique([
    ...(showRequestPhotos ? requestPaths : []),
    ...receivedPaths,
  ]);
  const shopPaths = unique(evidencePaths);
  const towPaths = unique(loadedPaths);
  const mobilePaths = unique(unfixablePaths);
  if (note === null && description === null &&
    riderPaths.length === 0 && shopPaths.length === 0 &&
    towPaths.length === 0 && mobilePaths.length === 0) return null;
  return (
    <DetailCard theme={theme}>
      <CardHead theme={theme} icon="photo-library" title={t.assist.notesPhotos} right={right} />
      <View style={styles.content}>
        {note !== null ? <Text style={[styles.body, {color: theme.text}]}>{note}</Text> : null}
        {description !== null ? (
          <>
            {note !== null ? <View style={[detailStyles.divider, {backgroundColor: theme.divider}]} /> : null}
            <Text style={[styles.body, {color: theme.text}]}>{description}</Text>
          </>
        ) : null}
        <PhotoLane theme={theme} label={t.payments.rider} icon="person" paths={riderPaths} onOpenPhoto={onOpenPhoto} />
        <PhotoLane theme={theme} label={t.roles.shop} icon="storefront" paths={shopPaths} onOpenPhoto={onOpenPhoto} />
        <PhotoLane theme={theme} label={t.roles.tow} icon="local-shipping" paths={towPaths} onOpenPhoto={onOpenPhoto} />
        <PhotoLane theme={theme} label={t.roles.mobileShop} icon="build" paths={mobilePaths} onOpenPhoto={onOpenPhoto} />
      </View>
    </DetailCard>
  );
}

const styles = StyleSheet.create({
  content: {gap: 6},
  body: {fontSize: 13, lineHeight: 18},
  workRow: {flexDirection: "row", alignItems: "center", gap: 6},
  workText: {fontSize: 12},
  lane: {gap: 4},
  laneBadge: {flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", borderWidth: 1, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8},
  laneText: {fontSize: 10, fontWeight: "700"},
  laneRow: {gap: 8, paddingRight: 4},
});
