import {StyleSheet, View} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "../ui/AppText";
import type {AppTheme} from "../../theme";
import type {Strings} from "../../i18n/en";

type Props = {
  t: Strings;
  theme: AppTheme;
  originText: string;
  destText: string;
  distanceM: number;
  durationSec: number;
  name: string;
  onNameChange: (next: string) => void;
};

export default function SaveRouteSheet(props: Props) {
  const {t, theme} = props;
  const dist = `${(props.distanceM / 1000).toFixed(props.distanceM < 10000 ? 1 : 0)} ${t.route.km}`;
  const mins = `${Math.max(1, Math.round(props.durationSec / 60))} ${t.route.min}`;
  return (
    <View style={styles.body}>
      <Text style={[styles.summary, {color: theme.text}]} numberOfLines={1}>
        {props.originText} → {props.destText}
      </Text>
      <Text style={[styles.meta, {color: theme.muted}]}>
        {dist} · {mins}
      </Text>
      <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={props.name} onChangeText={props.onNameChange} maxLength={120} autoFocus placeholder={t.route.routeName} placeholderTextColor={theme.muted} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: {gap: 8, width: "100%"},
  summary: {fontSize: 14, fontWeight: "600"},
  meta: {fontSize: 12},
  input: {borderWidth: 1, borderRadius: 8, padding: 8, fontSize: 14},
});
