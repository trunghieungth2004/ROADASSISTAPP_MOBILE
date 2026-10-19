import {useCallback, useEffect, useState} from "react";
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, View} from "react-native";
import {AppText as Text} from "../components/ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {useFocusEffect, useNavigation} from "@react-navigation/native";
import {toMessage} from "../api/client";
import {myBills, type Bill} from "../api/bills";
import {useAuth} from "../context/AuthContext";
import {useStrings} from "../context/LanguageContext";
import {useThemeMode} from "../context/ThemeContext";
import {darkTheme, lightTheme} from "../theme";
import ScreenContainer from "../components/ui/ScreenContainer";
import {billDateLabel, billItemCount, billPayeeLabel, billStatusColor, billStatusLabel, billTitle} from "./bills/billLabels";

export default function BillsScreen() {
  const {t} = useStrings();
  const {token} = useAuth();
  const {mode} = useThemeMode();
  const navigation = useNavigation() as unknown as {navigate: (name: string, params?: Record<string, unknown>) => void; setOptions: (options: {title?: string; headerShown?: boolean}) => void};
  const theme = mode === "dark" ? darkTheme : lightTheme;
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (): Promise<void> => {
    if (!token) {
      setBills([]);
      setLoading(false);
      return;
    }
    try {
      setBills(await myBills(token));
      setError(null);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setLoading(false);
    }
  }, [token]);
  useEffect(() => {
    navigation.setOptions({title: t.bills.title});
  }, [navigation, t]);
  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));
  const openBill = (bill: Bill): void => {
    navigation.navigate("BillDetail", {ticketId: bill.ticketId});
  };
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={[styles.scroll, {backgroundColor: theme.background}]}>
        {loading && bills.length === 0 ? <ActivityIndicator style={styles.loader} color={theme.primary} /> : null}
        {error ? (
          <View style={[styles.errorCard, {backgroundColor: theme.paper, borderColor: theme.border}]}>
            <Text style={[styles.errorText, {color: theme.danger}]}>{error}</Text>
            <Pressable style={[styles.retryBtn, {borderColor: theme.primary}]} onPress={() => void load()} accessibilityRole="button" accessibilityLabel={t.common.retry}>
              <Text style={{color: theme.primary}}>{t.common.retry}</Text>
            </Pressable>
          </View>
        ) : null}
        {!loading && !error && bills.length === 0 ? (
          <View style={[styles.emptyCard, {backgroundColor: theme.paper, borderColor: theme.border}]}>
            <MaterialIcons name="receipt-long" size={32} color={theme.muted} />
            <Text style={[styles.emptyTitle, {color: theme.text}]}>{t.bills.empty}</Text>
            <Text style={[styles.emptyHint, {color: theme.muted}]}>{t.bills.emptyHint}</Text>
          </View>
        ) : null}
        {bills.map((bill) => {
          const payee = billPayeeLabel(bill);
          const meta = [billDateLabel(bill.createdAt), billItemCount(bill, t), payee].filter((value) => typeof value === "string" && value !== "").join(" · ");
          return (
            <Pressable
              key={bill.billId}
              style={[styles.row, {backgroundColor: theme.paper, borderColor: theme.border}]}
              onPress={() => openBill(bill)}
              accessibilityRole="button"
              accessibilityLabel={`${billTitle(bill, t)} ${bill.total.toLocaleString()} VND`}
            >
              <View style={[styles.rowIcon, {backgroundColor: `${theme.primary}22`}]}>
                <MaterialIcons name={bill.ticketType === "TOW" ? "local-shipping" : "build"} size={22} color={theme.primary} />
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.rowTitle, {color: theme.text}]}>{billTitle(bill, t)}</Text>
                <Text style={[styles.rowMeta, {color: theme.muted}]} numberOfLines={1}>{meta}</Text>
                <Text style={[styles.rowAmount, {color: theme.text}]}>{`${bill.total.toLocaleString()} VND`}</Text>
              </View>
              <View style={styles.rowSide}>
                <View style={[styles.pill, {backgroundColor: billStatusColor(bill.status, theme)}]}>
                  <Text style={styles.pillText}>{billStatusLabel(bill.status, t)}</Text>
                </View>
                {bill.due > 0 ? (
                  <Text style={[styles.rowDue, {color: "#d97706"}]}>{`${t.bills.due} ${bill.due.toLocaleString()}`}</Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {padding: 16, gap: 10, flexGrow: 1},
  loader: {marginTop: 24},
  errorCard: {borderWidth: 1, borderRadius: 12, padding: 12, gap: 8},
  errorText: {fontSize: 13},
  retryBtn: {borderWidth: 1, borderRadius: 8, paddingVertical: 8, alignItems: "center"},
  emptyCard: {borderWidth: 1, borderRadius: 16, padding: 24, alignItems: "center", gap: 8, marginTop: 24},
  emptyTitle: {fontWeight: "700", fontSize: 16},
  emptyHint: {fontSize: 13, textAlign: "center"},
  row: {borderWidth: 1, borderRadius: 16, padding: 12, flexDirection: "row", gap: 12, alignItems: "center"},
  rowIcon: {width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center"},
  rowBody: {flex: 1, gap: 2},
  rowTitle: {fontWeight: "700", fontSize: 15},
  rowMeta: {fontSize: 12},
  rowAmount: {fontWeight: "700", fontSize: 15, marginTop: 2},
  rowSide: {alignItems: "flex-end", gap: 6},
  rowDue: {fontSize: 11, fontWeight: "600"},
  pill: {borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8},
  pillText: {color: "#fff", fontSize: 11, fontWeight: "700"},
});
