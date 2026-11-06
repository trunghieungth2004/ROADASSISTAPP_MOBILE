import {useCallback, useState} from "react";
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View} from "react-native";
import {useFocusEffect} from "@react-navigation/native";
import {AppText as Text} from "../components/ui/AppText";
import ScreenContainer from "../components/ui/ScreenContainer";
import Snack from "../components/ui/Snack";
import {snackBottom} from "../components/ui/snackOffset";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {useAuth} from "../context/AuthContext";
import {useStrings} from "../context/LanguageContext";
import {useAppMode} from "../context/ThemeContext";
import {darkTheme, lightTheme} from "../theme";
import {toMessage} from "../api/client";
import {
  createSupportTicket,
  mySupportTickets,
  type SupportCategory,
  type SupportTicket,
} from "../api/support";

const CATEGORIES: SupportCategory[] = [
  "PAYMENT",
  "SAFETY",
  "APP",
  "PROVIDER",
  "OTHER",
];

export default function SupportScreen() {
  const {t} = useStrings();
  const {token} = useAuth();
  const scheme = useAppMode();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<SupportTicket[]>([]);
  const [category, setCategory] = useState<SupportCategory>("APP");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    void mySupportTickets(token)
      .then((res) => setRows(res.tickets))
      .catch((err) => setError(toMessage(err)))
      .finally(() => setLoading(false));
  }, [token]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  async function send(): Promise<void> {
    if (!token || busy || message.trim().length < 10) return;
    setBusy(true);
    setError(null);
    try {
      await createSupportTicket({category, message: message.trim()}, token);
      setMessage("");
      setNotice(t.support.sent);
      load();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const categoryLabel = (value: SupportCategory): string =>
    value === "PAYMENT" ? t.support.categoryPayment :
      value === "SAFETY" ? t.support.categorySafety :
        value === "PROVIDER" ? t.support.categoryProvider :
          value === "OTHER" ? t.support.categoryOther :
            t.support.categoryApp;

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={[styles.scroll, {backgroundColor: theme.background}]}>
        <Text style={[styles.title, {color: theme.text}]}>{t.support.title}</Text>
        <Text style={[styles.hint, {color: theme.muted}]}>{t.support.hint}</Text>
        <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <View style={styles.chips}>
            {CATEGORIES.map((item) => {
              const active = item === category;
              return (
                <Pressable key={item} onPress={() => setCategory(item)} style={[styles.chip, {borderColor: active ? theme.primary : theme.border, backgroundColor: active ? `${theme.primary}22` : "transparent"}]} accessibilityRole="button">
                  <Text style={[styles.chipText, {color: active ? theme.primary : theme.text}]}>{categoryLabel(item)}</Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder={t.support.placeholder}
            placeholderTextColor={theme.muted}
            multiline
            style={[styles.input, {borderColor: theme.border, color: theme.text}]}
          />
          {error ? <Text style={[styles.hint, {color: theme.danger}]}>{error}</Text> : null}
          <Pressable disabled={busy || message.trim().length < 10} onPress={() => void send()} style={[styles.submit, {backgroundColor: theme.primary, opacity: busy || message.trim().length < 10 ? 0.5 : 1}]} accessibilityRole="button">
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{t.support.send}</Text>}
          </Pressable>
        </View>
        {loading ? <ActivityIndicator color={theme.primary} /> : null}
        {rows.length > 0 ? <Text style={[styles.section, {color: theme.muted}]}>{t.support.history.toUpperCase()}</Text> : null}
        {rows.map((row) => (
          <View key={row.id} style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
            <View style={styles.rowHead}>
              <Text style={[styles.rowCategory, {color: theme.text}]}>{categoryLabel(row.category)}</Text>
              <Text style={[styles.rowStatus, {color: row.status === "OPEN" ? theme.primary : theme.muted}]}>{row.status}</Text>
            </View>
            <Text style={[styles.message, {color: theme.text}]}>{row.message}</Text>
            {row.answer ? (
              <View style={[styles.answer, {borderColor: theme.border}]}>
                <Text style={[styles.answerLabel, {color: theme.muted}]}>{t.support.reply}</Text>
                <Text style={[styles.message, {color: theme.text}]}>{row.answer}</Text>
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
      <Snack message={notice} severity="confirm" bottom={snackBottom(insets.bottom)} accentColor={theme.primary} onHide={() => setNotice(null)} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {padding: 16, gap: 12},
  title: {fontSize: 22, fontWeight: "800"},
  hint: {fontSize: 12, lineHeight: 18},
  card: {borderWidth: 1, borderRadius: 16, padding: 14, gap: 10},
  chips: {flexDirection: "row", flexWrap: "wrap", gap: 8},
  chip: {borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12},
  chipText: {fontSize: 12, fontWeight: "600"},
  input: {borderWidth: 1, borderRadius: 10, padding: 10, minHeight: 110, textAlignVertical: "top"},
  submit: {borderRadius: 10, paddingVertical: 11, alignItems: "center"},
  submitText: {color: "#fff", fontSize: 14, fontWeight: "700"},
  section: {fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginTop: 8},
  rowHead: {flexDirection: "row", justifyContent: "space-between", gap: 8},
  rowCategory: {fontSize: 14, fontWeight: "700"},
  rowStatus: {fontSize: 12, fontWeight: "700"},
  message: {fontSize: 13, lineHeight: 19},
  answer: {borderWidth: 1, borderRadius: 10, padding: 10, gap: 4},
  answerLabel: {fontSize: 11, fontWeight: "700", letterSpacing: 0.5},
});
