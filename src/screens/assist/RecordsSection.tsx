import {useState} from "react";
import {ActivityIndicator, Pressable, StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text, AppTextInput as TextInput} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";
import {DECLINE_REASONS, type DeclineReason, type FeedTicket} from "../../api/dispatch";
import type {UserRating} from "../../api/ratings";
import Overlay from "../../components/overlay/Overlay";
import StatusRow from "../../components/ui/StatusRow";
import {formatPoint} from "../../api/places";
import {canAccept, canCancel, canEditWork, canRate, canRateRider} from "./recordActions";
import {RECORD_FILTERS, filterRecords, type RecordFilter} from "./recordFilter";
import {declineReasonLabel, ticketStatusLabel, ticketTitle, ticketTypeLabel} from "./ticketLabels";

export type WorkPatch = {workType: string; quoted: string; final: string};

type Props = {
  t: Strings;
  theme: AppTheme;
  tickets: FeedTicket[];
  loading: boolean;
  busy: boolean;
  selectedId: string | null;
  ratings: Record<string, UserRating[]>;
  onPick: (id: string) => void;
  onConfirmCancel: (id: string) => void;
  onRate: (ticket: FeedTicket) => void;
  onAccept: (ticket: FeedTicket) => void;
  onDecline: (ticket: FeedTicket, reason: DeclineReason, note: string | undefined) => void;
  onSaveWork: (ticket: FeedTicket, patch: WorkPatch) => void;
  onLoadRatings: (ticket: FeedTicket) => void;
  onReply: (ratingId: string, text: string) => void;
  onRateRider: (ticket: FeedTicket) => void;
};

function filterLabel(filter: RecordFilter, t: Strings): string {
  if (filter === "IN") return t.assist.filterIn;
  if (filter === "OUT") return t.assist.filterOut;
  return t.assist.filterAll;
}

export default function RecordsSection({t, theme, tickets, loading, busy, selectedId, ratings, onPick, onConfirmCancel, onRate, onAccept, onDecline, onSaveWork, onLoadRatings, onReply, onRateRider}: Props) {
  const [filter, setFilter] = useState<RecordFilter>("ALL");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [declineFor, setDeclineFor] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState<DeclineReason>("FULL");
  const [declineNote, setDeclineNote] = useState("");
  const [workFor, setWorkFor] = useState<string | null>(null);
  const [workType, setWorkType] = useState("");
  const [quoted, setQuoted] = useState("");
  const [final, setFinal] = useState("");
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyRatingId, setReplyRatingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const visible = filterRecords(tickets, filter);
  function openWork(ticket: FeedTicket): void {
    setWorkFor(ticket.id);
    setWorkType(typeof ticket.workType === "string" ? ticket.workType : "");
    setQuoted(typeof ticket.shopQuotedAmount === "number" ? String(ticket.shopQuotedAmount) : "");
    setFinal(typeof ticket.finalAmount === "number" ? String(ticket.finalAmount) : "");
  }
  return (
    <View style={styles.wrap}>
      <View style={styles.filterRow}>
        {RECORD_FILTERS.map((f) => {
          const selected = filter === f;
          return (
            <Pressable key={f} onPress={() => setFilter(f)} style={[styles.filterChip, {borderColor: theme.primary}, selected && {backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{selected}} accessibilityLabel={filterLabel(f, t)}>
              <Text style={{color: selected ? "#fff" : theme.text}}>{filterLabel(f, t)}</Text>
            </Pressable>
          );
        })}
      </View>
      {loading && tickets.length === 0 ? (
        <StatusRow theme={theme} text={t.common.loading} />
      ) : visible.length === 0 ? (
        <Text style={[styles.hint, {color: theme.muted}]}>{t.assist.emptyRecords}</Text>
      ) : (
        visible.map((item) => {
          const inbound = item.direction === "in";
          const itemRatings = ratings[item.id] ?? [];
          return (
            <View key={item.id} style={[styles.innerCard, {backgroundColor: theme.paper, borderColor: selectedId === item.id ? theme.primary : theme.border}]}>
              <Pressable onPress={() => onPick(item.id)} accessibilityRole="button" accessibilityLabel={ticketTitle(item, t)}>
                <View style={styles.titleRow}>
                  <MaterialIcons name={inbound ? "arrow-downward" : "arrow-upward"} size={16} color={inbound ? theme.primary : theme.muted} />
                  <Text style={[styles.cardTitle, {color: theme.text}]}>{ticketTitle(item, t)}</Text>
                </View>
              </Pressable>
              <View style={styles.metaRow}>
                <Text style={[styles.chip, {color: theme.primary}]}>{ticketTypeLabel(item.ticketType, t)}</Text>
                <Text style={[styles.chip, {color: inbound ? theme.primary : theme.muted}]} accessibilityLabel={inbound ? t.assist.incoming : t.assist.outgoing}>{inbound ? t.assist.filterIn : t.assist.filterOut}</Text>
                <Text style={[styles.coords, {color: theme.muted}]}>{ticketStatusLabel(item.status, t)}</Text>
              </View>
              {typeof item.note === "string" && item.note ? <Text style={{color: theme.text}}>{item.note}</Text> : null}
              {typeof item.declineReason === "string" && item.declineReason ? (
                <Text style={[styles.coords, {color: theme.danger}]}>
                  {declineReasonLabel(item.declineReason, t)}{typeof item.declineNote === "string" && item.declineNote ? ` · ${item.declineNote}` : ""}
                </Text>
              ) : null}
              {typeof item.shopQuotedAmount === "number" || typeof item.finalAmount === "number" ? (
                <Text style={[styles.coords, {color: theme.text}]}>
                  {typeof item.shopQuotedAmount === "number" ? `${t.assist.quote}: ${item.shopQuotedAmount} VND` : ""}
                  {typeof item.shopQuotedAmount === "number" && typeof item.finalAmount === "number" ? " · " : ""}
                  {typeof item.finalAmount === "number" ? `${t.assist.finalPrice}: ${item.finalAmount} VND` : ""}
                </Text>
              ) : null}
              <Text style={[styles.coords, {color: theme.muted}]}>{formatPoint(item.lat, item.lng)}</Text>
              {!inbound && canRate(item.status) ? (
                <View style={styles.actionRow}>
                  <Pressable style={[styles.actionBtn, {backgroundColor: theme.primary}]} onPress={() => onRate(item)} accessibilityRole="button" accessibilityLabel={t.assist.rate}>
                    <Text style={styles.actionText}>{t.assist.rate}</Text>
                  </Pressable>
                </View>
              ) : null}
              {!inbound && canCancel(item.status) ? (
                <View style={styles.actionRow}>
                  <Pressable style={[styles.chipBtn, {borderColor: theme.primary}]} onPress={() => setConfirmId(item.id)} accessibilityRole="button" accessibilityLabel={t.assist.cancel}>
                    <Text style={{color: theme.primary}}>{t.assist.cancel}</Text>
                  </Pressable>
                </View>
              ) : null}
              {canAccept(item.direction, item.status) ? (
                <View style={styles.actionRow}>
                  <Pressable style={[styles.actionBtn, {backgroundColor: theme.primary}, busy && styles.disabled]} disabled={busy} onPress={() => onAccept(item)} accessibilityRole="button" accessibilityLabel={t.assist.accept}>
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>{t.assist.accept}</Text>}
                  </Pressable>
                  <Pressable style={[styles.chipBtn, {borderColor: theme.danger}]} onPress={() => { setDeclineFor(item.id); setDeclineReason("FULL"); setDeclineNote(""); }} accessibilityRole="button" accessibilityLabel={t.provider.decline}>
                    <Text style={{color: theme.danger}}>{t.provider.decline}</Text>
                  </Pressable>
                </View>
              ) : null}
              {declineFor === item.id ? (
                <View style={styles.form}>
                  <View style={styles.chipRow}>
                    {DECLINE_REASONS.map((reason) => (
                      <Pressable key={reason} onPress={() => setDeclineReason(reason)} style={[styles.chipBtn, {borderColor: theme.primary}, declineReason === reason && {backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{checked: declineReason === reason}} accessibilityLabel={declineReasonLabel(reason, t)}>
                        <Text style={{color: declineReason === reason ? "#fff" : theme.text}}>{declineReasonLabel(reason, t)}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={declineNote} onChangeText={setDeclineNote} placeholder={t.provider.declineNote} placeholderTextColor={theme.muted} maxLength={280} />
                  <Pressable style={[styles.actionBtn, {backgroundColor: theme.danger}, busy && styles.disabled]} disabled={busy} onPress={() => { onDecline(item, declineReason, declineNote.trim() || undefined); setDeclineFor(null); }} accessibilityRole="button" accessibilityLabel={t.provider.decline}>
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>{t.provider.decline}</Text>}
                  </Pressable>
                </View>
              ) : null}
              {canEditWork(item.direction, item.status) ? (
                workFor === item.id ? (
                  <View style={styles.form}>
                    <Text style={[styles.label, {color: theme.text}]}>{t.provider.workType}</Text>
                    <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={workType} onChangeText={setWorkType} placeholder={t.provider.workPlaceholder} placeholderTextColor={theme.muted} />
                    <Text style={[styles.label, {color: theme.text}]}>{t.provider.quotedAmount}</Text>
                    <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={quoted} onChangeText={setQuoted} placeholder={t.provider.quotedAmount} placeholderTextColor={theme.muted} keyboardType="numeric" />
                    <Text style={[styles.label, {color: theme.text}]}>{t.provider.finalAmount}</Text>
                    <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={final} onChangeText={setFinal} placeholder={t.provider.finalAmount} placeholderTextColor={theme.muted} keyboardType="numeric" />
                    <Pressable style={[styles.actionBtn, {backgroundColor: theme.primary}, busy && styles.disabled]} disabled={busy} onPress={() => { onSaveWork(item, {workType, quoted, final}); setWorkFor(null); }} accessibilityRole="button" accessibilityLabel={t.provider.saveWork}>
                      {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>{t.provider.saveWork}</Text>}
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.actionRow}>
                    <Pressable style={[styles.chipBtn, {borderColor: theme.primary}]} onPress={() => openWork(item)} accessibilityRole="button" accessibilityLabel={t.provider.saveWork}>
                      <Text style={{color: theme.primary}}>{t.provider.saveWork}</Text>
                    </Pressable>
                  </View>
                )
              ) : null}
              {canRateRider(item.direction, item.status) ? (
                <View style={styles.actionRow}>
                  <Pressable style={[styles.chipBtn, {borderColor: theme.primary}]} onPress={() => onRateRider(item)} accessibilityRole="button" accessibilityLabel={t.assist.rate}>
                    <Text style={{color: theme.primary}}>{t.assist.rate}</Text>
                  </Pressable>
                  <Pressable style={[styles.chipBtn, {borderColor: theme.primary}]} onPress={() => { setReplyFor(item.id); setReplyRatingId(null); setReplyText(""); onLoadRatings(item); }} accessibilityRole="button" accessibilityLabel={t.rating.replyTitle}>
                    <Text style={{color: theme.primary}}>{t.rating.replyTitle}</Text>
                  </Pressable>
                </View>
              ) : null}
              {replyFor === item.id ? (
                <View style={styles.form}>
                  {itemRatings.filter((r) => r.targetKind !== "RIDER").map((r) => (
                    <View key={r.id} style={styles.replyRow}>
                      <Text style={[styles.coords, {color: theme.muted}]}>{r.score} / 5</Text>
                      {typeof r.reply === "string" && r.reply ? (
                        <Text style={[styles.coords, {color: theme.text}]}>{r.reply}</Text>
                      ) : replyRatingId === r.id ? (
                        <>
                          <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={replyText} onChangeText={setReplyText} placeholder={t.rating.replyPlaceholder} placeholderTextColor={theme.muted} maxLength={280} />
                          <Pressable style={[styles.actionBtn, {backgroundColor: theme.primary}, busy && styles.disabled]} disabled={busy} onPress={() => { onReply(r.id, replyText.trim()); setReplyRatingId(null); }} accessibilityRole="button" accessibilityLabel={t.rating.sendReply}>
                            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>{t.rating.sendReply}</Text>}
                          </Pressable>
                        </>
                      ) : (
                        <Pressable style={[styles.chipBtn, {borderColor: theme.primary}]} onPress={() => { setReplyRatingId(r.id); setReplyText(""); }} accessibilityRole="button" accessibilityLabel={t.rating.sendReply}>
                          <Text style={{color: theme.primary}}>{t.rating.sendReply}</Text>
                        </Pressable>
                      )}
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })
      )}
      <Overlay
        visible={confirmId !== null}
        variant="dialog"
        title={t.assist.cancelTitle}
        closeLabel={t.assist.keepRequest}
        onClose={() => setConfirmId(null)}
        actions={[{label: t.assist.confirmCancel, tone: "danger", onPress: () => {
          if (confirmId) onConfirmCancel(confirmId);
          setConfirmId(null);
        }}]}
      >
        <Text style={[styles.hint, {color: theme.muted}]}>{t.assist.cancelMessage}</Text>
      </Overlay>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {gap: 8},
  filterRow: {flexDirection: "row", gap: 8},
  filterChip: {borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 14},
  innerCard: {borderWidth: 1, borderRadius: 12, padding: 12, gap: 6},
  titleRow: {flexDirection: "row", alignItems: "center", gap: 6},
  cardTitle: {fontWeight: "700", flex: 1},
  metaRow: {flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap"},
  coords: {fontSize: 12},
  hint: {fontSize: 12},
  label: {fontSize: 13, fontWeight: "700"},
  chip: {fontSize: 12, fontWeight: "700"},
  actionRow: {flexDirection: "row", gap: 8},
  actionBtn: {flex: 1, borderRadius: 8, padding: 10, alignItems: "center"},
  actionText: {color: "#fff", fontWeight: "700"},
  chipBtn: {borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12},
  chipRow: {flexDirection: "row", gap: 8, flexWrap: "wrap"},
  form: {gap: 8},
  replyRow: {gap: 6},
  input: {borderWidth: 1, borderRadius: 8, padding: 10},
  disabled: {opacity: 0.6},
});
