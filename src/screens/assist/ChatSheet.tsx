import {useCallback, useEffect, useState} from "react";
import {ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {MaterialIcons} from "@expo/vector-icons";
import {useAppMode} from "../../context/ThemeContext";
import {AppText as Text, AppTextInput as TextInput} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import {delayReasonLabel} from "./delayReasons";
import {darkTheme, lightTheme, onColor, type AppTheme} from "../../theme";
import Overlay from "../../components/overlay/Overlay";
import {chatMessages, openChat, sendChatMessage, type ChatMessage, type ChatScope} from "../../api/chat";
import {toMessage} from "../../api/client";
import {takePhoto, uploadPhotoPaths, resolvePhotoUrl} from "../../services/photos";
import PhotoThumb from "../../components/ui/PhotoThumb";
import {usePhotoViewer} from "../../components/ui/PhotoViewer";
import {statusPillColor, ticketStatusLabel, ticketTypeLabel, unfixableReasonLabel} from "./ticketLabels";
import {subscribeChatPush} from "../../services/push";

type Props = {
  t: Strings;
  token: string | null;
  uid: string | null;
  scope: ChatScope;
  refId: string;
  title: string;
  ticketType?: string;
  status?: string;
  otherName?: string | null;
  version?: number;
  archived?: boolean;
  readOnly?: boolean;
  onClose: () => void;
};

type IconName = "chat-bubble-outline" | "info-outline" | "check-circle" | "cancel" | "local-shipping" | "build" | "lock-outline" | "error-outline" | "request-quote" | "schedule";

function clockTime(iso: string): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return "";
  return new Date(at).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dayKey(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return `${at.getFullYear()}-${at.getMonth()}-${at.getDate()}`;
}

function dayLabel(iso: string, t: Strings): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(iso) === dayKey(today.toISOString())) return t.chat.today;
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return t.chat.yesterday;
  return at.toLocaleDateString(undefined, {month: "short", day: "numeric"});
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Avatar({name, theme, size = 32}: {name: string; theme: AppTheme; size?: number}) {
  return (
    <View style={[styles.avatar, {width: size, height: size, borderRadius: size / 2, backgroundColor: theme.border}]}>
      <Text style={[styles.avatarText, {color: theme.muted, fontSize: size * 0.32}]}>{initials(name)}</Text>
    </View>
  );
}

function MessagePhotos({paths, theme, label, onOpenPhoto}: {paths: string[]; theme: AppTheme; label: string; onOpenPhoto: (path: string) => void}) {
  if (paths.length === 0) return null;
  return (
    <View style={styles.photoRow}>
      {paths.map((path, index) => (
        <PhotoThumb key={`${path}-${index}`} path={path} theme={theme} style={styles.photo} accessibilityLabel={`${label} ${index + 1}`} onPress={onOpenPhoto} />
      ))}
    </View>
  );
}

function systemText(message: ChatMessage, t: Props["t"]): string {
  const event = message.event;
  const params = message.params ?? {};
  if (event === "STATUS_CHANGED" && typeof params.to === "string") {
    return ticketStatusLabel(params.to, t);
  }
  if (event === "UNFIXABLE" && typeof params.reason === "string") {
    return `${t.assist.unfixableTitle}: ${unfixableReasonLabel(params.reason, t)}`;
  }
  if (event === "TOW_OFFER") return t.assist.towOfferTitle;
  if (event === "TOW_ACCEPTED") return t.assist.acceptTow;
  if (event === "TOW_DECLINED") return t.assist.declineTow;
  if (event === "TOW_EXPIRED") return t.assist.towOfferExpired;
  if (event === "SOS_CONTINUED") return t.assist.continueSosSnack;
  if (event === "QUOTE_SENT") return t.assist.quoteSent;
  if (event === "QUOTE_UPDATED") return t.assist.quoteUpdated;
  if (event === "QUOTE_APPROVED") return t.assist.quoteApproved;
  if (event === "QUOTE_DECLINED") return t.assist.quoteDeclined;
  if (event === "MOBILE_FIX_QUOTED") return t.assist.fixQuoteSent;
  if (event === "MOBILE_FIX_APPROVED") return t.assist.fixQuoteApproved;
  if (event === "MOBILE_FIX_DECLINED") return t.assist.fixQuoteDeclined;
  if (event === "DELAY_REPORTED") {
    const reason = typeof params.reason === "string" ?
      delayReasonLabel(params.reason, t) :
      t.assist.holdOther;
    const note = typeof params.note === "string" && params.note !== "" ?
      ` · ${params.note}` :
      "";
    const eta = typeof params.etaAt === "string" && params.etaAt !== "" ?
      ` · ${t.assist.holdUntil} ${new Date(params.etaAt).toLocaleTimeString(undefined, {hour: "2-digit", minute: "2-digit"})}` :
      "";
    return `${t.assist.delayActive}: ${reason}${note}${eta}`;
  }
  if (event === "DELAY_CLEARED") return t.assist.delayCleared;
  return message.text ?? "";
}

function systemIcon(event?: string): IconName {
  if (event === "STATUS_CHANGED") return "info-outline";
  if (event === "UNFIXABLE") return "build";
  if (event === "TOW_OFFER") return "local-shipping";
  if (event === "TOW_ACCEPTED") return "check-circle";
  if (event === "TOW_DECLINED" || event === "TOW_EXPIRED") return "cancel";
  if (event === "SOS_CONTINUED") return "chat-bubble-outline";
  if (event === "QUOTE_SENT" || event === "QUOTE_UPDATED" ||
    event === "MOBILE_FIX_QUOTED") return "request-quote";
  if (event === "QUOTE_APPROVED" || event === "MOBILE_FIX_APPROVED") {
    return "check-circle";
  }
  if (event === "QUOTE_DECLINED" || event === "MOBILE_FIX_DECLINED") {
    return "cancel";
  }
  if (event === "DELAY_REPORTED") return "schedule";
  if (event === "DELAY_CLEARED") return "check-circle";
  return "info-outline";
}

function systemColor(message: ChatMessage, theme: AppTheme): string {
  if (message.event === "STATUS_CHANGED" && typeof message.params?.to === "string") {
    return statusPillColor(message.params.to, theme);
  }
  if (message.event === "UNFIXABLE") return theme.danger;
  if (message.event === "TOW_ACCEPTED") return theme.success;
  if (message.event === "TOW_DECLINED" || message.event === "TOW_EXPIRED") return theme.danger;
  if (message.event === "QUOTE_DECLINED" ||
    message.event === "MOBILE_FIX_DECLINED") return theme.danger;
  if (message.event === "QUOTE_APPROVED" ||
    message.event === "MOBILE_FIX_APPROVED") return theme.success;
  if (message.event === "DELAY_CLEARED") return theme.success;
  return theme.primary;
}

export default function ChatSheet({t, token, uid, scope, refId, title, ticketType, status, otherName, version, archived = false, readOnly = false, onClose}: Props) {
  const scheme = useAppMode();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archivedNow, setArchivedNow] = useState(false);
  const photoViewer = usePhotoViewer(t.common.cancel);
  const effectiveReadOnly = readOnly || archived || archivedNow;
  const headerName = otherName !== null && otherName !== undefined && otherName.trim() !== "" ? otherName : title;
  const subtitle = archived || archivedNow ? t.chat.archived : scope === "HAZARD" ? t.chat.hazard : ticketType !== undefined ? ticketTypeLabel(ticketType, t) : t.chat.title;
  const canSend = draft.trim() !== "" || photos.length > 0;
  const openPhoto = (path: string): void => {
    void resolvePhotoUrl(path).then((uri) => {
      if (uri !== "") photoViewer.open(uri);
    });
  };
  const mergeMessages = useCallback((incoming: ChatMessage[]): void => {
    setMessages((prev) => {
      const byId = new Map(prev.map((message) => [message.id, message]));
      for (const message of incoming) byId.set(message.id, message);
      return [...byId.values()].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt));
    });
  }, []);
  const loadMessages = useCallback(async (): Promise<void> => {
    if (!token) return;
    try {
      mergeMessages(await chatMessages(scope, refId, token, version));
      setError(null);
    } catch (err) {
      setError(toMessage(err));
    }
  }, [mergeMessages, scope, refId, token, version]);
  const load = useCallback(async (): Promise<void> => {
    if (!token) return;
    try {
      const room = await openChat(scope, refId, token, version);
      setArchivedNow(room.closedAt !== null && room.closedAt !== undefined);
      setMessages(await chatMessages(scope, refId, token, version));
      setError(null);
    } catch (err) {
      setError(toMessage(err));
    }
  }, [scope, refId, token, version]);
  useEffect(() => {
    setMessages([]);
    setArchivedNow(false);
    void load();
  }, [load]);
  useEffect(() => {
    if (!token) return;
    const unsubscribe = subscribeChatPush(scope, refId, () => {
      void loadMessages();
    });
    const timer = setInterval(() => {
      void loadMessages();
    }, 4000);
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [loadMessages, refId, scope, token]);
  async function addPhoto(): Promise<void> {
    try {
      const picked = await takePhoto();
      if (picked.length > 0) setPhotos((prev) => [...prev, ...picked].slice(0, 3));
    } catch (err) {
      setError(toMessage(err));
    }
  }
  async function send(): Promise<void> {
    if (!token || busy || effectiveReadOnly || !canSend) return;
    setBusy(true);
    setError(null);
    try {
      const paths = photos.length > 0 ? await uploadPhotoPaths(`chat/${refId}`, photos) : [];
      const sent = await sendChatMessage(scope, refId, {
        ...(draft.trim() !== "" ? {text: draft.trim()} : {}),
        ...(paths.length > 0 ? {photoUrls: paths} : {}),
      }, token, version);
      setMessages((prev) => [...prev, sent]);
      setDraft("");
      setPhotos([]);
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
        <View style={[styles.header, {borderBottomColor: theme.divider}]}>
          <Pressable style={[styles.backBtn, {borderColor: theme.border, backgroundColor: theme.paper}]} onPress={onClose} accessibilityRole="button" accessibilityLabel={t.common.cancel}>
            <MaterialIcons name="arrow-back" size={22} color={theme.text} />
          </Pressable>
          <Avatar name={headerName} theme={theme} size={38} />
          <View style={styles.headerBody}>
            <Text style={[styles.headerTitle, {color: theme.text}]} numberOfLines={1}>{headerName}</Text>
            <Text style={[styles.headerSubtitle, {color: theme.muted}]} numberOfLines={1}>{subtitle}</Text>
          </View>
          {archived || archivedNow ? (
            <View style={[styles.statusPill, {backgroundColor: theme.muted}]}>
              <Text style={[styles.statusText, {color: onColor(theme.muted)}]} numberOfLines={1}>{t.chat.archived}</Text>
            </View>
          ) : status !== undefined ? (
            <View style={[styles.statusPill, {backgroundColor: statusPillColor(status, theme)}]}>
              <Text style={[styles.statusText, {color: onColor(statusPillColor(status, theme))}]} numberOfLines={1}>{ticketStatusLabel(status, t)}</Text>
            </View>
          ) : null}
        </View>
        {error ? (
          <View style={[styles.errorBanner, {borderColor: theme.danger, backgroundColor: theme.danger + "12"}]}>
            <MaterialIcons name="error-outline" size={16} color={theme.danger} />
            <Text style={[styles.errorText, {color: theme.danger}]}>{error}</Text>
          </View>
        ) : null}
        <ScrollView style={styles.messages} contentContainerStyle={styles.messagesBody} keyboardShouldPersistTaps="handled">
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="chat-bubble-outline" size={36} color={theme.muted} />
              <Text style={[styles.empty, {color: theme.muted}]}>{t.chat.empty}</Text>
            </View>
          ) : null}
          {messages.map((message, index) => {
            const prev = index > 0 ? messages[index - 1] : null;
            const next = index + 1 < messages.length ? messages[index + 1] : null;
            const showDay = prev === null || dayKey(prev.createdAt) !== dayKey(message.createdAt);
            const sameDay = prev !== null && dayKey(prev.createdAt) === dayKey(message.createdAt);
            const grouped = sameDay && prev !== null && prev.kind !== "SYSTEM" &&
              message.kind !== "SYSTEM" && prev.senderUid === message.senderUid &&
              Date.parse(message.createdAt) - Date.parse(prev.createdAt) < 5 * 60 * 1000;
            const nextGrouped = next !== null && next.kind !== "SYSTEM" &&
              message.kind !== "SYSTEM" && next.senderUid === message.senderUid &&
              dayKey(next.createdAt) === dayKey(message.createdAt) &&
              Date.parse(next.createdAt) - Date.parse(message.createdAt) < 5 * 60 * 1000;
            const showTime = !nextGrouped;
            const day = showDay ? (
              <View key={`day-${message.id}`} style={styles.dayRow}>
                <Text style={[styles.dayText, {color: theme.muted}]}>{dayLabel(message.createdAt, t)}</Text>
              </View>
            ) : null;
            if (message.kind === "SYSTEM") {
              return (
                <View key={message.id}>
                  {day}
                  <View style={styles.systemRow}>
                    <View style={[styles.systemChip, {borderColor: theme.border, backgroundColor: theme.paper}]}>
                      <MaterialIcons name={systemIcon(message.event)} size={13} color={systemColor(message, theme)} />
                      <Text style={[styles.systemText, {color: theme.muted}]}>{systemText(message, t)}</Text>
                      <Text style={[styles.systemTime, {color: theme.muted}]}>{clockTime(message.createdAt)}</Text>
                    </View>
                  </View>
                </View>
              );
            }
            const mine = uid !== null && message.senderUid === uid;
            const name = message.senderName ?? message.senderUid;
            return (
              <View key={message.id}>
                {day}
                <View style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowOther, grouped && styles.messageRowGrouped]}>
                  {!mine && !grouped ? <Avatar name={name} theme={theme} size={30} /> : null}
                  {!mine && grouped ? <View style={styles.avatarSpacer} /> : null}
                  <View style={[styles.bubbleWrap, mine ? styles.bubbleWrapMine : styles.bubbleWrapOther]}>
                    {!mine && !grouped ? <Text style={[styles.sender, {color: theme.muted}]}>{name}</Text> : null}
                    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther, {backgroundColor: mine ? theme.primary : theme.paper, borderColor: mine ? theme.primary : theme.border}]}>
                      {message.text ? <Text style={[styles.messageText, {color: mine ? "#fff" : theme.text}]}>{message.text}</Text> : null}
                      <MessagePhotos paths={message.photoUrls} theme={theme} label={t.chat.photo} onOpenPhoto={openPhoto} />
                      {showTime ? <Text style={[styles.time, {color: mine ? "#fff" : theme.muted}]}>{clockTime(message.createdAt)}</Text> : null}
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
        {effectiveReadOnly ? (
          <View style={[styles.closedBanner, {borderColor: theme.border, backgroundColor: theme.paper}]}>
            <MaterialIcons name="lock-outline" size={16} color={theme.muted} />
            <Text style={[styles.closedHint, {color: theme.muted}]}>{archived || archivedNow ? t.chat.archivedHint : t.chat.closed}</Text>
          </View>
        ) : (
          <View style={[styles.composerWrap, {borderTopColor: theme.divider}]}>
            {photos.length > 0 ? (
              <View style={styles.pendingPhotos}>
                {photos.map((path, index) => (
                  <View key={`${path}-${index}`} style={styles.pendingPhotoWrap}>
                    <Image source={{uri: path}} style={styles.pendingPhoto} />
                    <Pressable style={[styles.removePhoto, {backgroundColor: theme.danger}]} onPress={() => setPhotos((prev) => prev.filter((_, i) => i !== index))} accessibilityRole="button" accessibilityLabel={t.common.delete}>
                      <MaterialIcons name="close" size={12} color="#fff" />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
            <View style={styles.composer}>
              <Pressable onPress={() => void addPhoto()} style={[styles.iconBtn, {borderColor: theme.border, backgroundColor: theme.paper}]} accessibilityRole="button" accessibilityLabel={t.photos.take}>
                <MaterialIcons name="photo-camera" size={20} color={theme.primary} />
              </Pressable>
              <TextInput
                style={[styles.input, {borderColor: theme.border, color: theme.text, backgroundColor: theme.paper}]}
                value={draft}
                onChangeText={setDraft}
                placeholder={t.chat.placeholder}
                placeholderTextColor={theme.muted}
                maxLength={1000}
              />
              <Pressable onPress={() => void send()} style={[styles.sendBtn, {backgroundColor: theme.primary}, !canSend && styles.sendBtnDisabled]} disabled={!canSend || busy} accessibilityRole="button" accessibilityLabel={t.chat.send}>
                {busy ? <ActivityIndicator color="#fff" /> : <MaterialIcons name="send" size={20} color="#fff" />}
              </Pressable>
            </View>
          </View>
        )}
        {photoViewer.node}
      </KeyboardAvoidingView>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  body: {flex: 1, width: "100%"},
  header: {flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1},
  backBtn: {width: 40, height: 40, borderWidth: 1, borderRadius: 20, alignItems: "center", justifyContent: "center"},
  headerBody: {flex: 1, gap: 1},
  headerTitle: {fontSize: 16, fontWeight: "700"},
  headerSubtitle: {fontSize: 11, fontWeight: "600"},
  statusPill: {borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, maxWidth: 120},
  statusText: {fontSize: 11, fontWeight: "700"},
  messages: {flex: 1, paddingHorizontal: 16},
  messagesBody: {gap: 10, paddingBottom: 16, paddingTop: 10},
  emptyState: {alignItems: "center", gap: 8, paddingVertical: 48},
  empty: {fontSize: 13},
  dayRow: {alignItems: "center", paddingVertical: 6},
  dayText: {fontSize: 11, fontWeight: "700"},
  systemRow: {alignItems: "center", paddingVertical: 2},
  systemChip: {flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10, maxWidth: "92%"},
  systemText: {fontSize: 11, flexShrink: 1},
  systemTime: {fontSize: 9},
  messageRow: {flexDirection: "row", alignItems: "flex-end", gap: 8, width: "100%"},
  messageRowMine: {justifyContent: "flex-end"},
  messageRowOther: {justifyContent: "flex-start"},
  messageRowGrouped: {marginTop: -4},
  avatarSpacer: {width: 30},
  bubbleWrap: {maxWidth: "78%", gap: 2},
  bubbleWrapMine: {alignItems: "flex-end"},
  bubbleWrapOther: {alignItems: "flex-start"},
  bubble: {borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9, gap: 4},
  bubbleMine: {borderBottomRightRadius: 4},
  bubbleOther: {borderBottomLeftRadius: 4},
  messageText: {fontSize: 14, lineHeight: 20},
  avatar: {alignItems: "center", justifyContent: "center"},
  avatarText: {fontWeight: "700"},
  sender: {fontSize: 11, fontWeight: "700", marginLeft: 2},
  time: {fontSize: 10, alignSelf: "flex-end"},
  errorBanner: {flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 10, padding: 8, marginHorizontal: 16, marginTop: 8},
  errorText: {fontSize: 12, flexShrink: 1},
  closedBanner: {flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, padding: 10, marginHorizontal: 16, marginBottom: 8},
  closedHint: {fontSize: 12, flexShrink: 1},
  photoRow: {flexDirection: "row", gap: 6, flexWrap: "wrap"},
  photo: {width: 64, height: 64, borderRadius: 8},
  composerWrap: {borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 8, gap: 8},
  composer: {flexDirection: "row", alignItems: "center", gap: 8},
  iconBtn: {width: 42, height: 42, borderWidth: 1, borderRadius: 21, alignItems: "center", justifyContent: "center"},
  input: {flex: 1, borderWidth: 1, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 100},
  sendBtn: {width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center"},
  sendBtnDisabled: {opacity: 0.45},
  pendingPhotos: {flexDirection: "row", gap: 8, flexWrap: "wrap"},
  pendingPhotoWrap: {position: "relative"},
  pendingPhoto: {width: 56, height: 56, borderRadius: 10},
  removePhoto: {position: "absolute", top: -5, right: -5, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center"},
});
