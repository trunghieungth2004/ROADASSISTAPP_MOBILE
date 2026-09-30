import {useState} from "react";
import {ActivityIndicator, Keyboard, Platform, Pressable, StyleSheet, View, KeyboardAvoidingView} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "./AppText";
import type {AppTheme} from "../theme";
import type {Strings} from "../i18n/en";
import {suggestRouteName} from "../screens/route/routeSummary";

type Props = {
  t: Strings;
  theme: AppTheme;
  originText: string;
  destText: string;
  distanceM: number;
  durationSec: number;
  busy: boolean;
  onClose: () => void;
  onSave: (name: string | undefined) => void;
};

export default function SaveRouteSheet(props: Props) {
  const {t, theme} = props;
  const [name, setName] = useState(() => suggestRouteName(props.originText, props.destText));
  const dist = `${(props.distanceM / 1000).toFixed(props.distanceM < 10000 ? 1 : 0)} ${t.route.km}`;
  const mins = `${Math.max(1, Math.round(props.durationSec / 60))} ${t.route.min}`;
  function save(): void {
    Keyboard.dismiss();
    props.onSave(name.trim() || undefined);
  }
  function close(): void {
    Keyboard.dismiss();
    props.onClose();
  }
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.sheet, {backgroundColor: theme.paper, borderColor: theme.border}]}>
        <Text style={[styles.title, {color: theme.text}]}>{t.route.saveRoute}</Text>
        <Text style={[styles.summary, {color: theme.text}]} numberOfLines={1}>
          {props.originText} → {props.destText}
        </Text>
        <Text style={[styles.meta, {color: theme.muted}]}>
          {dist} · {mins}
        </Text>
        <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={name} onChangeText={setName} maxLength={120} autoFocus placeholder={t.route.routeName} placeholderTextColor={theme.muted} />
        <View style={styles.actionRow}>
          <Pressable style={[styles.actionBtn, {backgroundColor: theme.primary}, props.busy && styles.disabled]} disabled={props.busy} onPress={save} accessibilityRole="button" accessibilityLabel={t.common.save}>
            {props.busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>{t.common.save}</Text>}
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.outline, {borderColor: theme.border}]} onPress={close} accessibilityRole="button" accessibilityLabel={t.common.close}>
            <Text style={[styles.actionText, {color: theme.text}]}>{t.common.close}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  sheet: {borderRadius: 20, borderWidth: 1, padding: 12, gap: 8, maxHeight: "85%", overflow: "hidden", width: "100%"},
  title: {fontSize: 16, fontWeight: "700"},
  summary: {fontSize: 14, fontWeight: "600"},
  meta: {fontSize: 12},
  input: {borderWidth: 1, borderRadius: 8, padding: 8, fontSize: 14},
  actionRow: {flexDirection: "row", gap: 8},
  actionBtn: {flex: 1, borderRadius: 8, padding: 10, alignItems: "center"},
  outline: {borderWidth: 1, backgroundColor: "transparent"},
  actionText: {color: "#fff", fontWeight: "700"},
  disabled: {opacity: 0.6},
});
