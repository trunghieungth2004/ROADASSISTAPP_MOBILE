import {useEffect, useState} from "react";
import {Pressable, StyleSheet, View} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "../../components/ui/AppText";
import Overlay from "../../components/overlay/Overlay";
import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";
import {
  WARRANTY_DECLINE_REASONS,
  type WarrantyDeclineReason,
} from "../../api/warranty";

type Props = {
  visible: boolean;
  serviceName: string;
  t: Strings;
  theme: AppTheme;
  busy: boolean;
  error: string | null;
  onSubmit: (reasonCode: WarrantyDeclineReason, note: string) => void;
  onClose: () => void;
};

export default function WarrantyDeclineDialog({
  visible,
  serviceName,
  t,
  theme,
  busy,
  error,
  onSubmit,
  onClose,
}: Props) {
  const [reasonCode, setReasonCode] = useState<WarrantyDeclineReason | null>(
    null,
  );
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!visible) return;
    setReasonCode(null);
    setNote("");
  }, [visible, serviceName]);

  const ready = reasonCode !== null && note.trim().length >= 5;
  return (
    <Overlay
      visible={visible}
      variant="dialog"
      title={`${t.provider.warrantyDeclineTitle} · ${serviceName}`}
      closeLabel={t.common.cancel}
      onClose={onClose}
      scrollable={false}
      actions={[{
        label: t.provider.warrantyDeclineSubmit,
        tone: "danger",
        busy,
        disabled: !ready,
        onPress: () => {
          if (reasonCode !== null) onSubmit(reasonCode, note.trim());
        },
      }]}
    >
      <View style={styles.body}>
        {error ? (
          <Text style={[styles.hint, {color: theme.danger}]}>{error}</Text>
        ) : null}
        <Text style={[styles.label, {color: theme.muted}]}>
          {t.provider.warrantyDeclineReason}
        </Text>
        <View style={styles.chips}>
          {WARRANTY_DECLINE_REASONS.map((value) => {
            const selected = reasonCode === value;
            return (
              <Pressable
                key={value}
                style={[styles.chip, {
                  borderColor: selected ? theme.danger : theme.border,
                }, selected && {backgroundColor: `${theme.danger}22`}]}
                onPress={() => setReasonCode(value)}
                accessibilityRole="button"
                accessibilityState={{selected}}
                accessibilityLabel={t.provider.warrantyDeclineReasons[value]}
              >
                <Text style={{
                  color: selected ? theme.danger : theme.text,
                  fontSize: 12,
                }}>
                  {t.provider.warrantyDeclineReasons[value]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.label, {color: theme.muted}]}>
          {t.provider.warrantyDeclineNote}
        </Text>
        <TextInput
          style={[styles.input, {borderColor: theme.border, color: theme.text}]}
          value={note}
          onChangeText={setNote}
          placeholder={t.provider.warrantyDeclineNotePlaceholder}
          placeholderTextColor={theme.muted}
          multiline
          maxLength={280}
        />
        <Text style={[styles.hint, {color: theme.muted}]}>
          {t.provider.warrantyDeclineHint}
        </Text>
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  body: {gap: 8, width: "100%"},
  label: {fontSize: 11, fontWeight: "700"},
  hint: {fontSize: 11, lineHeight: 16},
  chips: {flexDirection: "row", flexWrap: "wrap", gap: 6},
  chip: {borderWidth: 1, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10},
  input: {borderWidth: 1, borderRadius: 8, padding: 10, minHeight: 82, textAlignVertical: "top"},
});
