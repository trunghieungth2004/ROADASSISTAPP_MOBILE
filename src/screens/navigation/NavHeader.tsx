import {ActivityIndicator, Pressable, StyleSheet, View} from "react-native";
import {AppText as Text} from "../../components/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import type {AppTheme} from "../../theme";
import type {Strings} from "../../i18n/en";
import {turnIcon, turnLabel} from "./navUtils";

type Props = {
  t: Strings;
  theme: AppTheme;
  topPad: number;
  next: {kind: string; street: string | undefined; toGo: number} | null;
  arrived: boolean;
  rerouting: boolean;
  hasPos: boolean;
  error: string | null;
  notice: string | null;
  onExit: () => void;
  onOpenList: () => void;
};

export default function NavHeader(props: Props) {
  const {t, theme} = props;
  return (
    <View style={[styles.header, {backgroundColor: theme.paper, borderColor: theme.border, paddingTop: props.topPad}]}>
      <View style={styles.headerRow}>
        <Pressable style={[styles.circleBtn, {borderColor: theme.border}]} onPress={props.onExit} accessibilityRole="button" accessibilityLabel={t.nav.exitNav}>
          <MaterialIcons name="close" size={22} color={theme.text} />
        </Pressable>
        <View style={styles.bannerWrap}>
          {props.next && !props.arrived ? (
            <View style={[styles.banner, {backgroundColor: theme.primary}]}>
              <MaterialIcons name={turnIcon(props.next.kind)} size={28} color="#fff" />
              <View style={styles.bannerCol}>
                <Text style={styles.bannerText}>{turnLabel(t.nav.turns as Record<string, string>, t.nav.turns.other, props.next.kind)}{props.next.street ? ` · ${props.next.street}` : ""}</Text>
              </View>
            </View>
          ) : null}
          {props.arrived ? (
            <View style={[styles.banner, {backgroundColor: theme.primary}]}>
              <MaterialIcons name="flag" size={28} color="#fff" />
              <Text style={styles.bannerText}>{t.nav.arrived}</Text>
            </View>
          ) : null}
        </View>
        <Pressable style={[styles.circleBtn, {borderColor: theme.border}]} onPress={props.onOpenList} accessibilityRole="button" accessibilityLabel="Turn list">
          <MaterialIcons name="list" size={22} color={theme.text} />
        </Pressable>
      </View>
      {props.rerouting ? (
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={{color: theme.text}}>{t.nav.rerouting}</Text>
        </View>
      ) : null}
      {!props.hasPos && !props.error ? (
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={{color: theme.text}}>{t.nav.locating}</Text>
        </View>
      ) : null}
      {props.error ? <Text style={{color: theme.danger}}>{props.error}</Text> : null}
      {props.notice ? <Text style={{color: theme.text}}>{props.notice}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {position: "absolute", top: 0, left: 0, right: 0, borderBottomWidth: 1, paddingHorizontal: 12, paddingBottom: 12, gap: 8},
  headerRow: {flexDirection: "row", alignItems: "center", gap: 8},
  circleBtn: {width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center"},
  bannerWrap: {flex: 1, minWidth: 0},
  banner: {flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, padding: 10},
  bannerCol: {flex: 1, gap: 2, minWidth: 0},
  bannerText: {color: "#fff", fontSize: 17, fontWeight: "700"},
  statusRow: {flexDirection: "row", alignItems: "center", gap: 8},
});
