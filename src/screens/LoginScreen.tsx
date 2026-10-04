import {useState} from "react";
import {ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "../components/ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {signInWithEmailAndPassword} from "firebase/auth";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {auth} from "../auth/firebase";
import {register} from "../api/auth";
import {toMessage} from "../api/client";
import {useAuth} from "../context/AuthContext";
import {useProfile} from "../context/ProfileContext";
import {useStrings} from "../context/LanguageContext";
import {darkTheme, lightTheme} from "../theme";
import ScreenContainer from "../components/ui/ScreenContainer";
import Snack from "../components/ui/Snack";
import {SNACK_GAP} from "../components/ui/snackOffset";
export default function LoginScreen() {
  const {t} = useStrings();
  const {signIn} = useAuth();
  const {refresh} = useProfile();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const [mode, setModeState] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  function setMode(next: "login" | "register"): void {
    setError(null);
    setShowPassword(false);
    if (next === mode) return;
    setModeState(next);
  }
  async function onSubmit() {
    if (email.trim() === "") {
      setError(t.auth.emailRequired);
      return;
    }
    if (password === "") {
      setError(t.auth.passwordRequired);
      return;
    }
    if (password.length < 6) {
      setError(t.auth.passwordShort);
      return;
    }
    setError(null); setBusy(true);
    try {
      if (mode === "register") { await register({email: email.trim(), password, displayName: displayName.trim() || undefined, phone: phone.trim()}); }
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const token = await cred.user.getIdToken();
      await signIn(cred.user.uid, token);
      await refresh();
    } catch (err) { setError(toMessage(err)); } finally { setBusy(false); }
  }
  return (
    <ScreenContainer>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.avoid}>
      <ScrollView contentContainerStyle={[styles.container, {backgroundColor: theme.background}]} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, {color: theme.text}]}>{t.appName}</Text>
        <View style={[styles.segment, {borderColor: theme.border}]}>
          <Pressable style={[styles.segmentBtn, mode === "login" && {backgroundColor: theme.primary}]} onPress={() => setMode("login")} accessibilityRole="tab" accessibilityState={{selected: mode === "login"}}>
            <Text style={[styles.segmentText, {color: mode === "login" ? "#fff" : theme.text}]}>{t.auth.signIn}</Text>
          </Pressable>
          <Pressable style={[styles.segmentBtn, mode === "register" && {backgroundColor: theme.primary}]} onPress={() => setMode("register")} accessibilityRole="tab" accessibilityState={{selected: mode === "register"}}>
            <Text style={[styles.segmentText, {color: mode === "register" ? "#fff" : theme.text}]}>{t.auth.createAccount}</Text>
          </Pressable>
        </View>
        {mode === "register" ? <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} placeholder={t.auth.displayName} placeholderTextColor={theme.muted} value={displayName} onChangeText={setDisplayName} autoComplete="name" textContentType="name" /> : null}
        {mode === "register" ? <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} placeholder={t.auth.phone} placeholderTextColor={theme.muted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" /> : null}
        <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} placeholder={t.auth.email} placeholderTextColor={theme.muted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType={mode === "register" ? "emailAddress" : "username"} />
        <View style={styles.passwordRow}>
          <TextInput style={[styles.input, styles.passwordInput, {borderColor: theme.border, color: theme.text}]} placeholder={t.auth.password} placeholderTextColor={theme.muted} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoComplete="password" textContentType={mode === "register" ? "newPassword" : "password"} />
          <Pressable style={[styles.eyeBtn, {borderColor: theme.border}]} onPress={() => setShowPassword((v) => !v)} accessibilityRole="button" accessibilityLabel={showPassword ? t.auth.hidePassword : t.auth.showPassword}>
            <MaterialIcons name={showPassword ? "visibility-off" : "visibility"} size={20} color={theme.muted} />
          </Pressable>
        </View>
        <Pressable style={[styles.primary, {backgroundColor: theme.primary}, busy && styles.disabled]} disabled={busy} onPress={() => void onSubmit()}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{mode === "login" ? t.auth.signIn : t.auth.createAccount}</Text>}
        </Pressable>
      </ScrollView>
      </KeyboardAvoidingView>
      <Snack message={error} severity="error" sticky bottom={insets.bottom + SNACK_GAP} dangerColor={theme.danger} onHide={() => setError(null)} />
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  avoid: {flex: 1},
  container: {flexGrow: 1, padding: 20, justifyContent: "center", gap: 10},
  title: {fontSize: 28, fontWeight: "700", textAlign: "center", marginBottom: 12},
  segment: {flexDirection: "row", borderWidth: 1, borderRadius: 999, padding: 4, gap: 4},
  segmentBtn: {flex: 1, borderRadius: 999, paddingVertical: 8, alignItems: "center"},
  segmentText: {fontWeight: "700", fontSize: 14},
  input: {borderWidth: 1, borderRadius: 8, padding: 10},
  passwordRow: {flexDirection: "row", gap: 8, alignItems: "center"},
  passwordInput: {flex: 1, minWidth: 0},
  eyeBtn: {width: 46, height: 46, borderWidth: 1, borderRadius: 8, alignItems: "center", justifyContent: "center"},
  primary: {borderRadius: 8, padding: 12, alignItems: "center"},
  disabled: {opacity: 0.6},
  primaryText: {color: "#fff", fontWeight: "700"},
});
