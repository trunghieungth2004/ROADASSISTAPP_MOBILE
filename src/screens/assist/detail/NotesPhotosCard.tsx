import type {ReactNode} from "react";
import {StyleSheet, View} from "react-native";
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
  workType: string | null;
  showRequestPhotos: boolean;
  requestPaths: string[];
  evidencePaths: string[];
  unfixablePaths?: string[];
  right?: ReactNode;
  onOpenPhoto: (path: string) => void;
};

export default function NotesPhotosCard({t, theme, note, description, workType, showRequestPhotos, requestPaths, evidencePaths, unfixablePaths = [], right, onOpenPhoto}: Props) {
  const showRequest = showRequestPhotos && requestPaths.length > 0;
  return (
    <DetailCard theme={theme}>
      <CardHead theme={theme} icon="photo-library" title={t.assist.notesPhotos} right={right} />
      {note !== null ? <Text style={[styles.body, {color: theme.text}]}>{note}</Text> : null}
      {description !== null ? (
        <>
          {note !== null ? <View style={[detailStyles.divider, {backgroundColor: theme.divider}]} /> : null}
          <Text style={[styles.body, {color: theme.text}]}>{description}</Text>
        </>
      ) : null}
      {workType !== null ? (
        <View style={styles.workRow}>
          <MaterialIcons name="build" size={14} color={theme.muted} />
          <Text style={[styles.workText, {color: theme.muted}]}>{`${t.provider.workType}: ${workType}`}</Text>
        </View>
      ) : null}
      {showRequest ? (
        <>
          <Text style={[styles.subLabel, {color: theme.muted}]}>{t.assist.photos}</Text>
          <View style={detailStyles.photoRow}>
            {requestPaths.map((path, i) => (
              <PhotoThumb
                key={`${i}-${path}`}
                path={path}
                theme={theme}
                style={detailStyles.thumb}
                accessibilityLabel={`${t.assist.photos} ${i + 1}`}
                onPress={onOpenPhoto}
              />
            ))}
          </View>
        </>
      ) : null}
      {evidencePaths.length > 0 ? (
        <>
          <Text style={[styles.subLabel, {color: theme.muted}]}>{t.assist.photos}</Text>
          <View style={detailStyles.photoRow}>
            {evidencePaths.map((path, i) => (
              <PhotoThumb
                key={`${i}-${path}`}
                path={path}
                theme={theme}
                style={detailStyles.thumb}
                accessibilityLabel={`${t.assist.photos} ${i + 1}`}
                onPress={onOpenPhoto}
              />
            ))}
          </View>
        </>
      ) : null}
      {unfixablePaths.length > 0 ? (
        <>
          <Text style={[styles.subLabel, {color: theme.muted}]}>{t.assist.unfixablePhotos}</Text>
          <View style={detailStyles.photoRow}>
            {unfixablePaths.map((path, i) => (
              <PhotoThumb
                key={`${i}-${path}`}
                path={path}
                theme={theme}
                style={detailStyles.thumb}
                accessibilityLabel={`${t.assist.unfixablePhotos} ${i + 1}`}
                onPress={onOpenPhoto}
              />
            ))}
          </View>
        </>
      ) : null}
    </DetailCard>
  );
}

const styles = StyleSheet.create({
  body: {fontSize: 13, lineHeight: 18},
  workRow: {flexDirection: "row", alignItems: "center", gap: 6},
  workText: {fontSize: 12},
  subLabel: {fontSize: 11, fontWeight: "700"},
});
