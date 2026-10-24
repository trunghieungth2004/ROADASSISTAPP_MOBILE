import {useCallback, useEffect, useState} from "react";
import {ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {MaterialIcons} from "@expo/vector-icons";
import {useAppMode} from "../../context/ThemeContext";
import {AppText as Text, AppTextInput as TextInput} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import {darkTheme, lightTheme, type AppTheme} from "../../theme";
import Overlay from "../../components/overlay/Overlay";
import {chatMessages, openChat, sendChatMessage, type ChatMessage, type ChatScope} from "../../api/chat";
import {toMessage} from "../../api/client";
import {takePhoto, uploadPhotoPaths, usePhotoUrls} from "../../services/photos";

type Props = {
  t: Strings;
  token: string | null;
  uid: string | null;
  scope: ChatScope;
  refId: string;
  title: string;
  onClose: () => void;
};

function relativeTime(iso: string): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return "";
  const mins = Math.max(0, Math.round((Date.now() - at) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Avatar({name, theme}: {name: string; theme: AppTheme}) {
  return (
    <View style={[styles.avatar, {backgroundColor: theme.border}]}>
      <Text style={[styles.avatarText, {color: theme.muted}]}>{initials(name)}</Text>
    </View>
  );
}

function MessagePhotos({paths}: {paths: string[]}) {
  const urls = usePhotoUrls(paths);
  if (paths.length === 0) return null;
  return (
    <View style={styles.photoRow}>
      {urls.map((uri, index) => (
        <Image key={`${uri}-${index}`} source={{uri}} style={styles.photo} />
      ))}
    </View>
  );
}

export default function ChatSheet({t, token, uid, scope, refId, title, onClose}: Props) {
  const scheme = useAppMode();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (): Promise<void> => {
    if (!token) return;
    try {
      await openChat(scope, refId, token);
      setMessages(await chatMessages(scope, refId, token));
      setError(null);
    } catch (err) {
      setError(toMessage(err));
    }
  }, [scope, refId, token]);
  useEffect(() => {
    void load();
  }, [load]);
  async function addPhoto(): Promise<void> {
    try {
      const picked = await takePhoto();
      if (picked.length > 0) setPhotos((prev) => [...prev, ...picked].slice(0, 3));
    } catch (err) {
      setError(toMessage(err));
    }
  }
  async function send(): Promise<void> {
    if (!token || busy) return;
    if (draft.trim() === "" && photos.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const paths = photos.length > 0 ? await uploadPhotoPaths(`chat/${refId}-${Date.now()}`, photos) : [];
      await sendChatMessage(scope, refId, {
        ...(draft.trim() !== "" ? {text: draft.trim()} : {}),
        ...(paths.length > 0 ? {photoUrls: paths} : {}),
      }, token);
      setDraft("");
      setPhotos([]);
      await load();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Overlay
      visible
      variant="fullScreen"
      title={`${t.chat.title} · ${title}`}
      closeLabel={t.common.cancel}
      onClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.body, {paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8}]}
      >
        <View style={styles.header}>
          <Pressable style={[styles.backBtn, {borderColor: theme.border}]} onPress={onClose} accessibilityRole="button" accessibilityLabel={t.common.cancel}>
            <MaterialIcons name="arrow-back" size={22} color={theme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, {color: theme.text}]}>{`${t.chat.title} · ${title}`}</Text>
        </View>
        {error ? <Text style={[styles.error, {color: theme.danger}]}>{error}</Text> : null}
        <ScrollView style={styles.messages} contentContainerStyle={styles.messagesBody} keyboardShouldPersistTaps="handled">
          {messages.length === 0 ? <Text style={[styles.empty, {color: theme.muted}]}>{t.chat.empty}</Text> : null}
          {messages.map((message) => {
            const mine = uid !== null && message.senderUid === uid;
            const name = message.senderName ?? message.senderUid;
            return (
              <View key={message.id} style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowOther]}>
                {!mine ? <Avatar name={name} theme={theme} /> : null}
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther, {backgroundColor: mine ? theme.primary : theme.paper, borderColor: mine ? theme.primary : theme.border}]}>
                  {!mine ? <Text style={[styles.sender, {color: theme.muted}]}>{name}</Text> : null}
                  {message.text ? <Text style={[styles.messageText, {color: mine ? "#fff" : theme.text}]}>{message.text}</Text> : null}
                  <MessagePhotos paths={message.photoUrls} />
                  <Text style={[styles.time, {color: mine ? "#fff" : theme.muted}]}>{relativeTime(message.createdAt)}</Text>
                </View>
                {mine ? <Avatar name={name} theme={theme} /> : null}
              </View>
            );
          })}
        </ScrollView>
        {photos.length > 0 ? (
          <View style={styles.photoRow}>
            {photos.map((path, index) => (
              <Pressable key={`${path}-${index}`} onPress={() => setPhotos((prev) => prev.filter((_, i) => i !== index))} accessibilityRole="button" accessibilityLabel={t.common.delete}>
                <Image source={{uri: path}} style={styles.photo} />
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={styles.composer}>
          <Pressable onPress={() => void addPhoto()} style={[styles.iconBtn, {borderColor: theme.border}]} accessibilityRole="button" accessibilityLabel={t.photos.take}>
            <MaterialIcons name="photo-camera" size={20} color={theme.primary} />
          </Pressable>
          <TextInput
            style={[styles.input, {borderColor: theme.border, color: theme.text}]}
            value={draft}
            onChangeText={setDraft}
            placeholder={t.chat.placeholder}
            placeholderTextColor={theme.muted}
            maxLength={1000}
          />
          <Pressable onPress={() => void send()} style={[styles.sendBtn, {backgroundColor: theme.primary}]} disabled={busy} accessibilityRole="button" accessibilityLabel={t.chat.send}>
            {busy ? <ActivityIndicator color="#fff" /> : <MaterialIcons name="send" size={20} color="#fff" />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  body: {flex: 1, gap: 8, width: "100%"},
  header: {flexDirection: "row", alignItems: "center", gap: 10},
  backBtn: {width: 40, height: 40, borderWidth: 1, borderRadius: 8, alignItems: "center", justifyContent: "center"},
  headerTitle: {flex: 1, fontSize: 17, fontWeight: "700"},
  messages: {flex: 1},
  messagesBody: {gap: 10, paddingBottom: 16},
  empty: {fontSize: 13},
  messageRow: {flexDirection: "row", alignItems: "flex-end", gap: 8, width: "100%"},
  messageRowMine: {justifyContent: "flex-end"},
  messageRowOther: {justifyContent: "flex-start"},
  bubble: {maxWidth: "75%", borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8, gap: 4},
  bubbleMine: {borderBottomRightRadius: 4},
  bubbleOther: {borderBottomLeftRadius: 4},
  messageText: {fontSize: 14, lineHeight: 20},
  avatar: {width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center"},
  avatarText: {fontSize: 11, fontWeight: "700"},
  sender: {fontSize: 11, fontWeight: "700"},
  time: {fontSize: 10, alignSelf: "flex-end"},
  error: {fontSize: 13},
  photoRow: {flexDirection: "row", gap: 6, flexWrap: "wrap"},
  photo: {width: 64, height: 64, borderRadius: 8},
  composer: {flexDirection: "row", alignItems: "center", gap: 6},
  iconBtn: {width: 40, height: 40, borderWidth: 1, borderRadius: 8, alignItems: "center", justifyContent: "center"},
  input: {flex: 1, borderWidth: 1, borderRadius: 8, padding: 10},
  sendBtn: {width: 40, height: 40, borderRadius: 8, alignItems: "center", justifyContent: "center"},
});