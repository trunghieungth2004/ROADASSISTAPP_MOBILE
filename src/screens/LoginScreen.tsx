import {useState} from "react";
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "../components/AppText";
import {signInWithEmailAndPassword} from "firebase/auth";
import {auth} from "../auth/firebase";
import {register} from "../api/auth";
import {toMessage} from "../api/client";
import {useAuth} from "../context/AuthContext";
import {useProfile} from "../context/ProfileContext";
import {useStrings} from "../context/LanguageContext";
import {darkTheme, lightTheme} from "../theme";
import ScreenContainer from "../components/ScreenContainer";
export default function LoginScreen() {
  const {t} = useStrings();
  const {signIn} = useAuth();
  const {refresh} = useProfile();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function onSubmit() {
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
      <ScrollView contentContainerStyle={[styles.container, {backgroundColor: theme.background}]}>
        <Text style={[styles.title, {color: theme.text}]}>{t.appName}</Text>
        <View style={styles.tabs}>
          <Pressable style={[styles.tab, {borderColor: theme.border}, mode === "login" && {borderColor: theme.primary, borderWidth: 2}]} onPress={() => setMode("login")}><Text style={{color: theme.text}}>{t.auth.signIn}</Text></Pressable>
          <Pressable style={[styles.tab, {borderColor: theme.border}, mode === "register" && {borderColor: theme.primary, borderWidth: 2}]} onPress={() => setMode("register")}><Text style={{color: theme.text}}>{t.auth.createAccount}</Text></Pressable>
        </View>
        {mode === "register" ? <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} placeholder={t.auth.displayName} placeholderTextColor={theme.muted} value={displayName} onChangeText={setDisplayName} /> : null}
        {mode === "register" ? <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} placeholder={t.auth.phone} placeholderTextColor={theme.muted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" /> : null}
        <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} placeholder={t.auth.email} placeholderTextColor={theme.muted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} placeholder={t.auth.password} placeholderTextColor={theme.muted} value={password} onChangeText={setPassword} secureTextEntry />
        {error ? <Text style={[styles.error, {color: theme.danger}]}>{error}</Text> : null}
        <Pressable style={[styles.primary, {backgroundColor: theme.primary}, busy && styles.disabled]} disabled={busy} onPress={() => void onSubmit()}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{mode === "login" ? t.auth.signIn : t.auth.createAccount}</Text>}
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  container: {flexGrow: 1, padding: 20, justifyContent: "center", gap: 10},
  title: {fontSize: 28, fontWeight: "700", textAlign: "center", marginBottom: 12},
  tabs: {flexDirection: "row", gap: 8},
  tab: {flex: 1, padding: 10, borderWidth: 1, borderRadius: 8, alignItems: "center"},
  input: {borderWidth: 1, borderRadius: 8, padding: 10},
  error: {fontSize: 13},
  primary: {borderRadius: 8, padding: 12, alignItems: "center"},
  disabled: {opacity: 0.6},
  primaryText: {color: "#fff", fontWeight: "700"},
});
