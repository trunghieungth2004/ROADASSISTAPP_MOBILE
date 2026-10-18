import type {ReactNode} from "react";
import {Image, Pressable, ScrollView, StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text, AppTextInput as TextInput} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";
import type {TicketType} from "../../api/dispatch";
import Overlay from "../../components/overlay/Overlay";
import {TICKET_PHOTO_MAX} from "../../services/photos";
import {usePhotoViewer} from "../../components/ui/PhotoViewer";

type Props = {
  t: Strings;
  theme: AppTheme;
  ticketType: TicketType;
  note: string;
  onNote: (s: string) => void;
  towDest: ReactNode | null;
  busy: boolean;
  onSubmit: () => void;
  onClose: () => void;
  description?: string;
  onDescription?: (s: string) => void;
  photos?: string[];
  photosBusy?: boolean;
  onAddPhotos?: () => void;
  onRemovePhoto?: (index: number) => void;
  destError?: string | null;
};

function titleOf(ticketType: TicketType, t: Strings): string {
  if (ticketType === "TOW") return t.assist.tow;
  if (ticketType === "MECHANIC") return t.assist.mechanic;
  return t.assist.sos;
}

export default function TicketSheet({t, theme, ticketType, note, onNote, towDest, busy, onSubmit, onClose, description, onDescription, photos, photosBusy, onAddPhotos, onRemovePhoto, destError}: Props) {
  const showPhotos = photos !== undefined || onAddPhotos !== undefined;
  const list = photos ?? [];
  const photoViewer = usePhotoViewer(t.common.cancel);
  return (
    <Overlay
      visible
      variant="dialog"
      title={titleOf(ticketType, t)}
      closeLabel={t.common.cancel}
      onClose={onClose}
      scrollable={false}
      actions={[{label: t.assist.request, tone: "primary", busy, onPress: onSubmit}]}
    >
      <View style={styles.body}>
        <TextInput
          style={[styles.input, {borderColor: theme.border, color: theme.text}]}
          placeholder={t.assist.note}
          placeholderTextColor={theme.muted}
          value={note}
          onChangeText={onNote}
          autoFocus
        />
        {onDescription !== undefined ? (
          <TextInput
            style={[styles.input, styles.multiline, {borderColor: theme.border, color: theme.text}]}
            placeholder={t.assist.descriptionPlaceholder}
            placeholderTextColor={theme.muted}
            value={description ?? ""}
            onChangeText={onDescription}
            multiline
            maxLength={1000}
            accessibilityLabel={t.assist.description}
          />
        ) : null}
        {ticketType === "TOW" ? towDest : null}
        {destError ? <Text style={[styles.error, {color: theme.danger}]}>{destError}</Text> : null}
        {showPhotos ? (
          <View style={styles.photoBlock}>
            <Text style={[styles.photoLabel, {color: theme.muted}]}>{t.assist.photos} ({list.length}/{TICKET_PHOTO_MAX})</Text>
            <ScrollView style={styles.photoScroll} contentContainerStyle={styles.photoList} nestedScrollEnabled showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {list.map((uri, i) => (
                <View key={`${i}-${uri}`} style={styles.stripWrap}>
                  <Pressable onPress={() => photoViewer.open(uri)} accessibilityRole="button" accessibilityLabel={`${t.assist.photos} ${i + 1}`}>
                    <Image source={{uri}} style={styles.strip} />
                  </Pressable>
                  {onRemovePhoto ? (
                    <Pressable style={[styles.removeBtn, {backgroundColor: theme.danger}]} onPress={() => onRemovePhoto(i)} accessibilityRole="button" accessibilityLabel={t.common.delete}>
                      <MaterialIcons name="close" size={14} color="#fff" />
                    </Pressable>
                  ) : null}
                </View>
              ))}
              {onAddPhotos && list.length < TICKET_PHOTO_MAX ? (
                <Pressable style={[styles.addStrip, {borderColor: theme.primary}]} disabled={photosBusy === true} onPress={() => onAddPhotos()} accessibilityRole="button" accessibilityLabel={t.photos.take}>
                  <MaterialIcons name="photo-camera" size={16} color={theme.primary} />
                  <Text style={{color: theme.primary}}>{photosBusy === true ? t.common.loading : t.photos.take}</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </View>
        ) : null}
        {photoViewer.node}
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  body: {gap: 8, width: "100%"},
  input: {borderWidth: 1, borderRadius: 8, padding: 10},
  multiline: {minHeight: 72, textAlignVertical: "top"},
  photoBlock: {gap: 6},
  photoLabel: {fontSize: 12},
  photoScroll: {maxHeight: 188},
  photoList: {gap: 8},
  stripWrap: {position: "relative", width: "100%"},
  strip: {width: "100%", height: 56, borderRadius: 8},
  removeBtn: {position: "absolute", top: 6, right: 6, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center"},
  addStrip: {width: "100%", height: 56, minHeight: 56, borderWidth: 1, borderStyle: "dashed", borderRadius: 8, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6},
  error: {fontSize: 12},
});
