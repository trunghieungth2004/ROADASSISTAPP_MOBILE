import {useEffect, useState} from "react";
import {StyleSheet, Text as NativeText, View} from "react-native";
import {AppTextInput as TextInput} from "../../components/ui/AppText";
import Overlay from "../../components/overlay/Overlay";
import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";

type Props = {
  visible: boolean;
  serviceName: string;
  t: Strings;
  theme: AppTheme;
  busy: boolean;
  error: string | null;
  onSubmit: (note: string) => void;
  onClose: () => void;
};

export default function WarrantyDisputeDialog({
  visible,
  serviceName,
  t,
  theme,
  busy,
  error,
  onSubmit,
  onClose,
}: Props) {
  const [note, setNote] = useState("");

  useEffect(() => {
    if (visible) setNote("");
  }, [visible, serviceName]);

  const ready = note.trim().length >= 5;
  return (
    <Overlay
      visible={visible}
      variant="dialog"
      title={`${t.provider.warrantyDisputeTitle} · ${serviceName}`}
      closeLabel={t.common.cancel}
      onClose={onClose}
      scrollable={false}
      actions={[{
        label: t.provider.warrantyDisputeSubmit,
        tone: "primary",
        busy,
        disabled: !ready,
        onPress: () => onSubmit(note.trim()),
      }]}
    >
      <View style={styles.body}>
        {error ? (
          <NativeText style={{color: theme.danger}}>{error}</NativeText>
        ) : null}
        <NativeText style={{color: theme.muted, fontSize: 12}}>
          {t.provider.warrantyDisputeHint}
        </NativeText>
        <TextInput
          style={[styles.input, {borderColor: theme.border, color: theme.text}]}
          value={note}
          onChangeText={setNote}
          placeholder={t.provider.warrantyDisputePlaceholder}
          placeholderTextColor={theme.muted}
          multiline
          maxLength={280}
        />
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  body: {gap: 8, width: "100%"},
  input: {borderWidth: 1, borderRadius: 8, padding: 10, minHeight: 100, textAlignVertical: "top"},
});
