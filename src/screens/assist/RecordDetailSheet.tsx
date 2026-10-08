import {useState} from "react";
import {ActivityIndicator, Linking, Pressable, StyleSheet, View, useColorScheme} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text, AppTextInput as TextInput} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import {darkTheme, lightTheme, type AppTheme} from "../../theme";
import {DECLINE_REASONS, type DeclineReason, type FeedTicket} from "../../api/dispatch";
import type {UserRating} from "../../api/ratings";
import Overlay, {type OverlayAction} from "../../components/overlay/Overlay";
import {formatPoint} from "../../api/places";
import {distBetween} from "../navigation/navUtils";
import {timeAgoLabel} from "../hazards/hazardFilter";
import {canAccept, canApproveQuote, canCancel, canEditWork, canMarkReady, canRate, canRateRider, canResolve, canSendQuote, canStartWork} from "./recordActions";
import {declineReasonLabel, stageLabel, statusPillColor, statusStages, ticketStatusLabel, ticketTypeLabel} from "./ticketLabels";
import {directionOf} from "./recordFilter";
import StatusStepper from "./StatusStepper";
import RatingRow from "./RatingRow";
export type WorkPatch = {workType: string; quoted: string; final: string};

type Props = {
  t: Strings;
  ticket: FeedTicket;
  ratings: UserRating[];
  busy: boolean;
  gps: {lat: number; lng: number} | null;
  uid: string | null;
  hasRated: boolean;
  onClose: () => void;
  onConfirmCancel: (id: string) => void;
  onRate: (ticket: FeedTicket) => void;
  onAccept: (ticket: FeedTicket) => void;
  onDecline: (ticket: FeedTicket, reason: DeclineReason, note: string | undefined) => void;
  onSaveWork: (ticket: FeedTicket, patch: WorkPatch) => void;
  onSendQuote: (ticket: FeedTicket, patch: WorkPatch) => void;
  onApproveQuote: (ticket: FeedTicket) => void;
  onRouteShop: (ticket: FeedTicket) => void;
  onAdvance: (ticket: FeedTicket, status: string) => void;
  onReply: (ratingId: string, text: string) => void;
  onRateRider: (ticket: FeedTicket) => void;
};

type Party = {
  name: string;
  kind: string | null;
  label: string | null;
  openNow: boolean | null;
  ratingAvg: number | null;
  ratingCount: number | null;
  phone: string | null;
};

function partyOf(ticket: FeedTicket, fallback: string): Party {
  const raw = ticket.otherParty;
  if (typeof raw !== "object" || raw === null || typeof raw.name !== "string") {
    return {name: fallback, kind: null, label: null, openNow: null, ratingAvg: null, ratingCount: null, phone: null};
  }
  return {
    name: raw.name,
    kind: typeof raw.kind === "string" ? raw.kind : null,
    label: typeof raw.label === "string" ? raw.label : null,
    openNow: typeof raw.openNow === "boolean" ? raw.openNow : null,
    ratingAvg: typeof raw.ratingAvg === "number" ? raw.ratingAvg : null,
    ratingCount: typeof raw.ratingCount === "number" ? raw.ratingCount : null,
    phone: typeof raw.phone === "string" ? raw.phone : null,
  };
}

function CallRow({theme, phone}: {theme: AppTheme; phone: string}) {
  return (
    <Section theme={theme} icon="call">
      <Pressable onPress={() => void Linking.openURL(`tel:${phone}`)} accessibilityRole="link" accessibilityLabel={phone}>
        <Text style={[styles.coords, {color: theme.primary}]}>{phone}</Text>
      </Pressable>
    </Section>
  );
}

function PhoneLink({theme, phone}: {theme: AppTheme; phone: string}) {
  return (
    <Pressable style={styles.phoneRow} onPress={() => void Linking.openURL(`tel:${phone}`)} accessibilityRole="link" accessibilityLabel={phone}>
      <MaterialIcons name="call" size={14} color={theme.primary} />
      <Text style={[styles.coords, {color: theme.primary}]}>{phone}</Text>
    </Pressable>
  );
}

function Stars({theme, avg, count}: {theme: AppTheme; avg: number | null; count: number | null}) {
  if (avg === null || count === null) return null;
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((n) => (
        <MaterialIcons key={n} name={n <= Math.max(0, Math.min(5, Math.round(avg))) ? "star" : "star-border"} size={14} color="#f59e0b" />
      ))}
      <Text style={[styles.coords, {color: theme.muted}]}>{avg.toFixed(1)} ({count})</Text>
    </View>
  );
}

function agoOf(at: string, t: Strings): string {
  return timeAgoLabel(at, Date.now(), t.hazards) ?? at;
}

function Section({theme, icon, children}: {theme: AppTheme; icon: string; children: React.ReactNode}) {
  return (
    <View style={styles.section}>
      <MaterialIcons name={icon as never} size={16} color={theme.muted} />
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Timeline({t, theme, ticket}: {t: Strings; theme: AppTheme; ticket: FeedTicket}) {
  const history = Array.isArray(ticket.statusHistory) ? ticket.statusHistory : [];
  if (history.length === 0) {
    return <StatusStepper t={t} theme={theme} ticketType={ticket.ticketType} status={ticket.status} declineReason={typeof ticket.declineReason === "string" ? declineReasonLabel(ticket.declineReason, t) : null} />;
  }
  const stages = statusStages(ticket.ticketType);
  const seen = new Set(history.map((h) => h.status));
  const atOf = new Map(history.map((h) => [h.status, h.at] as [string, string]));
  const current = history[history.length - 1]?.status ?? ticket.status;
  const trailing = !stages.includes(current) ? [current] : [];
  const rows = [...stages.filter((s) => seen.has(s) || s === current), ...trailing];
  return (
    <View style={styles.rail}>
      {rows.map((status, i) => {
        const done = seen.has(status);
        const failed = !stages.includes(status);
        const dotColor = failed ? theme.danger : done ? theme.primary : theme.border;
        return (
          <View key={`${status}-${i}`} style={styles.railRow}>
            <View style={styles.railLeft}>
              <View style={[styles.dot, {backgroundColor: done || failed ? dotColor : "transparent", borderColor: dotColor}]} />
              {i < rows.length - 1 ? <View style={[styles.connector, {backgroundColor: theme.border}]} /> : null}
            </View>
            <View style={styles.railText}>
              <View style={[styles.stagePill, {backgroundColor: statusPillColor(status, theme), opacity: done || failed ? 1 : 0.45}]}>
                <Text style={styles.stageText}>{stageLabel(ticket.ticketType, status, t)}</Text>
              </View>
              {done && atOf.get(status) ? <Text style={[styles.coords, {color: theme.muted}]}>{agoOf(atOf.get(status) as string, t)}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function RecordDetailSheet({t, ticket, ratings, busy, gps, uid, hasRated, onClose, onConfirmCancel, onRate, onAccept, onDecline, onSaveWork, onSendQuote, onApproveQuote, onRouteShop, onAdvance, onReply, onRateRider}: Props) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const inbound = directionOf(ticket) === "in";
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState<DeclineReason>("FULL");
  const [declineNote, setDeclineNote] = useState("");
  const [workOpen, setWorkOpen] = useState(false);
  const [workType, setWorkType] = useState(typeof ticket.workType === "string" ? ticket.workType : "");
  const [quoted, setQuoted] = useState(typeof ticket.shopQuotedAmount === "number" ? String(ticket.shopQuotedAmount) : "");
  const [final, setFinal] = useState(typeof ticket.finalAmount === "number" ? String(ticket.finalAmount) : "");
  const [replyRatingId, setReplyRatingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const party = partyOf(ticket, t.assist.unassigned);
  const hasShop = (typeof ticket.assignedShopId === "string" && ticket.assignedShopId !== "") ||
    (typeof ticket.providerId === "string" && ticket.providerId !== "");
  const riderMeters = inbound && gps ? Math.round(distBetween(gps, {lat: ticket.lat, lng: ticket.lng})) : null;
  const riderDistance = riderMeters === null ? null : riderMeters < 1000 ? t.shop.radiusM.replace("{n}", String(riderMeters)) : t.shop.radiusKm.replace("{n}", (riderMeters / 1000).toFixed(1));
  const showShop = party.kind === "SHOP" && (party.label !== null || party.openNow !== null || (party.ratingAvg !== null && party.ratingCount !== null));
  const actions: OverlayAction[] = [];
  if (!inbound && canRate(ticket.status)) {
    actions.push({label: hasRated ? t.rating.editRating : t.assist.rate, tone: "primary", busy, onPress: () => onRate(ticket)});
  }
  if (!inbound && canCancel(ticket.status) && !confirmCancel) {
    actions.push({label: t.assist.cancel, tone: "danger", outline: true, onPress: () => setConfirmCancel(true)});
  }
  if (!inbound && canCancel(ticket.status) && confirmCancel) {
    actions.push({label: t.assist.keepRequest, tone: "neutral", outline: true, onPress: () => setConfirmCancel(false)});
    actions.push({label: t.assist.confirmCancel, tone: "danger", busy, onPress: () => onConfirmCancel(ticket.id)});
  }
  if (canAccept(ticket.direction, ticket.status) && !declineOpen) {
    actions.push({label: t.provider.decline, tone: "danger", outline: true, onPress: () => { setDeclineReason("FULL"); setDeclineNote(""); setDeclineOpen(true); }});
    actions.push({label: t.assist.accept, tone: "primary", busy, onPress: () => onAccept(ticket)});
  }
  if (declineOpen) {
    actions.push({label: t.provider.decline, tone: "danger", busy, onPress: () => { onDecline(ticket, declineReason, declineNote.trim() || undefined); setDeclineOpen(false); }});
  }
  const quoteReady = canSendQuote(ticket.direction, ticket.status, hasShop) && quoted.trim() !== "" && typeof ticket.shopQuotedAmount !== "number";
  if (workOpen && !quoteReady) {
    actions.push({label: t.provider.saveWork, tone: "primary", busy, onPress: () => { onSaveWork(ticket, {workType, quoted, final}); setWorkOpen(false); }});
  }
  if (quoteReady) {
    actions.push({label: t.assist.sendQuote, tone: "primary", busy, onPress: () => { onSendQuote(ticket, {workType, quoted, final}); setWorkOpen(false); }});
  }
  if (canApproveQuote(ticket.direction, ticket.status)) {
    actions.push({label: t.assist.approveQuote, tone: "primary", busy, onPress: () => onApproveQuote(ticket)});
  }
  if (canResolve(ticket.direction, ticket.status)) {
    actions.push({label: t.assist.resolved, tone: "primary", busy, onPress: () => onAdvance(ticket, "4")});
  }
  const formOpen = declineOpen || workOpen || confirmCancel;
  if (!formOpen && canStartWork(ticket.direction, ticket.status, ticket.ticketType, typeof ticket.shopQuotedAmount === "number", hasShop)) {
    actions.push({label: t.assist.startWork, tone: "primary", busy, onPress: () => onAdvance(ticket, "6")});
  }
  if (!formOpen && canMarkReady(ticket.direction, ticket.status, hasShop)) {
    actions.push({label: t.assist.markReady, tone: "primary", busy, onPress: () => onAdvance(ticket, "7")});
  }
  if (canRateRider(ticket.direction, ticket.status)) {
    actions.push({label: t.assist.rateRider, tone: "primary", onPress: () => onRateRider(ticket)});
  }
  return (
    <Overlay
      visible
      variant="sheet"
      title={ticketTypeLabel(ticket.ticketType, t)}
      right={
        <View style={[styles.pill, {backgroundColor: statusPillColor(ticket.status, theme)}]}>
          <Text style={styles.pillText}>{ticketStatusLabel(ticket.status, t)}</Text>
        </View>
      }
      closeLabel={t.common.cancel}
      onClose={onClose}
      actions={actions}
    >
      <View style={styles.body}>
        <View style={styles.hero}>
          <Text style={[styles.direction, {color: theme.primary}]} accessibilityLabel={inbound ? t.assist.incoming : t.assist.outgoing}>{inbound ? t.assist.filterIn : t.assist.filterOut}</Text>
          <Text style={[styles.heroName, {color: theme.text}]}>{party.name}</Text>
          <Text style={[styles.coords, {color: theme.muted}]}>{ticketTypeLabel(ticket.ticketType, t)}{typeof ticket.createdAt === "string" ? ` · ${agoOf(ticket.createdAt, t)}` : ""}</Text>
        </View>
        {showShop ? (
          <View style={styles.shopRow}>
            <View style={[styles.shopBlock, {borderColor: theme.border}]}>
              {party.label !== null ? (
                <Section theme={theme} icon="storefront">
                  <Text style={{color: theme.text}}>{party.label}</Text>
                </Section>
              ) : null}
              <Stars theme={theme} avg={party.ratingAvg} count={party.ratingCount} />
              <View style={[styles.metaRow, styles.spread]}>
                {party.phone !== null ? (
                  <PhoneLink theme={theme} phone={party.phone} />
                ) : (
                  <View style={styles.phoneTake} />
                )}
                {party.openNow !== null ? (
                  <View style={[styles.pill, {backgroundColor: party.openNow ? theme.primary : theme.danger}]}>
                    <Text style={styles.pillText}>{party.openNow ? t.shop.open : t.shop.closed}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <Pressable style={[styles.routeSquare, {borderColor: theme.border}]} onPress={() => onRouteShop(ticket)} accessibilityRole="button" accessibilityLabel={t.common.routeFromHere}>
              <MaterialIcons name="navigation" size={22} color={theme.primary} />
            </Pressable>
          </View>
        ) : null}
        <Section theme={theme} icon="place">
          <Text style={[styles.coords, {color: theme.muted}]}>{formatPoint(ticket.lat, ticket.lng)}</Text>
        </Section>
        {inbound ? (
          <View style={[styles.shopBlock, {borderColor: theme.border}]}>
            <Section theme={theme} icon="person-pin-circle">
              <Text style={{color: theme.text}}>{party.name}</Text>
              <Text style={[styles.coords, {color: theme.muted}]}>
                {formatPoint(ticket.lat, ticket.lng)}{riderDistance ? ` · ${riderDistance}` : ""}
              </Text>
            </Section>
            <Stars theme={theme} avg={party.ratingAvg} count={party.ratingCount} />
            {party.phone !== null ? <CallRow theme={theme} phone={party.phone} /> : null}
          </View>
        ) : null}
        {typeof ticket.note === "string" && ticket.note ? (
          <Section theme={theme} icon="notes">
            <Text style={{color: theme.text}}>{ticket.note}</Text>
          </Section>
        ) : null}
        {typeof ticket.declineReason === "string" && ticket.declineReason ? (
          <Section theme={theme} icon="error-outline">
            <Text style={[styles.coords, {color: theme.danger}]}>
              {declineReasonLabel(ticket.declineReason, t)}{typeof ticket.declineNote === "string" && ticket.declineNote ? ` · ${ticket.declineNote}` : ""}
            </Text>
          </Section>
        ) : null}
        {typeof ticket.workType === "string" && ticket.workType ? (
          <Section theme={theme} icon="build">
            <Text style={[styles.coords, {color: theme.text}]}>{t.provider.workType}: {ticket.workType}</Text>
          </Section>
        ) : null}
        {typeof ticket.shopQuotedAmount === "number" || typeof ticket.finalAmount === "number" ? (
          <Section theme={theme} icon="payments">
            <Text style={[styles.coords, {color: theme.text}]}>
              {typeof ticket.shopQuotedAmount === "number" ? `${t.assist.quote}: ${ticket.shopQuotedAmount.toLocaleString()} VND` : ""}
              {typeof ticket.shopQuotedAmount === "number" && typeof ticket.finalAmount === "number" ? " · " : ""}
              {typeof ticket.finalAmount === "number" ? `${t.assist.finalPrice}: ${ticket.finalAmount.toLocaleString()} VND` : ""}
            </Text>
          </Section>
        ) : null}
        {inbound && ticket.status === "9" ? (
          <Text style={[styles.coords, {color: theme.muted}]}>{t.assist.quoteAwaiting}</Text>
        ) : null}
        <Timeline t={t} theme={theme} ticket={ticket} />
        {ratings.filter((r) => r.targetKind !== "RIDER").length > 0 ? (
          <Text style={[styles.label, {color: theme.text}]}>{t.rating.yourRating}</Text>
        ) : null}
        {ratings.filter((r) => r.targetKind !== "RIDER").map((r) => {
          const mine = typeof r.byUserId === "string" && r.byUserId === uid;
          return (
          <View key={r.id} style={[styles.replyRow, {borderColor: theme.border}]}>
            <RatingRow
              theme={theme}
              rating={{id: r.id, score: r.score, text: r.text, reply: r.reply, authorName: r.byUserName, replyName: r.repliedByName}}
            />
            {!r.reply && replyRatingId === r.id ? (
              <>
                <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={replyText} onChangeText={setReplyText} placeholder={t.rating.replyPlaceholder} placeholderTextColor={theme.muted} maxLength={280} />
                <Pressable style={[styles.actionBtn, {backgroundColor: theme.primary}, busy && styles.disabled]} disabled={busy} onPress={() => { onReply(r.id, replyText.trim()); setReplyRatingId(null); }} accessibilityRole="button" accessibilityLabel={t.rating.sendReply}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>{t.rating.sendReply}</Text>}
                </Pressable>
              </>
            ) : null}
            {!r.reply && replyRatingId !== r.id && !mine ? (
              <Pressable style={[styles.chipBtn, {borderColor: theme.primary}]} onPress={() => { setReplyRatingId(r.id); setReplyText(""); }} accessibilityRole="button" accessibilityLabel={t.rating.sendReply}>
                <Text style={{color: theme.primary}}>{t.rating.sendReply}</Text>
              </Pressable>
            ) : null}
          </View>
          );
        })}
        {!inbound && canCancel(ticket.status) && confirmCancel ? (
          <Text style={[styles.coords, {color: theme.muted}]}>{t.assist.cancelMessage}</Text>
        ) : null}
        {declineOpen ? (
          <View style={styles.form}>
            <View style={styles.chipRow}>
              {DECLINE_REASONS.map((reason) => (
                <Pressable key={reason} onPress={() => setDeclineReason(reason)} style={[styles.chipBtn, {borderColor: theme.primary}, declineReason === reason && {backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{checked: declineReason === reason}} accessibilityLabel={declineReasonLabel(reason, t)}>
                  <Text style={{color: declineReason === reason ? "#fff" : theme.text}}>{declineReasonLabel(reason, t)}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={declineNote} onChangeText={setDeclineNote} placeholder={t.provider.declineNote} placeholderTextColor={theme.muted} maxLength={280} />
          </View>
        ) : null}
        {canEditWork(ticket.direction, ticket.status, hasShop) && !workOpen ? (
          <Pressable style={[styles.chipBtn, styles.selfStart, {borderColor: theme.primary}]} onPress={() => setWorkOpen(true)} accessibilityRole="button" accessibilityLabel={t.provider.saveWork}>
            <Text style={{color: theme.primary}}>{t.provider.saveWork}</Text>
          </Pressable>
        ) : null}
        {workOpen ? (
          <View style={styles.form}>
            <Text style={[styles.label, {color: theme.text}]}>{t.provider.workType}</Text>
            <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={workType} onChangeText={setWorkType} placeholder={t.provider.workPlaceholder} placeholderTextColor={theme.muted} />
            <Text style={[styles.label, {color: theme.text}]}>{t.provider.quotedAmount}</Text>
            {typeof ticket.shopQuotedAmount === "number" ? (
              <TextInput style={[styles.input, styles.locked, {borderColor: theme.border, color: theme.muted}]} value={ticket.shopQuotedAmount.toLocaleString()} editable={false} accessibilityLabel={t.provider.quotedAmount} />
            ) : (
              <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={quoted} onChangeText={setQuoted} placeholder={t.provider.quotedAmount} placeholderTextColor={theme.muted} keyboardType="numeric" />
            )}
            <Text style={[styles.label, {color: theme.text}]}>{t.provider.finalAmount}</Text>
            {typeof ticket.finalAmount === "number" ? (
              <TextInput style={[styles.input, styles.locked, {borderColor: theme.border, color: theme.muted}]} value={ticket.finalAmount.toLocaleString()} editable={false} accessibilityLabel={t.provider.finalAmount} />
            ) : (
              <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={final} onChangeText={setFinal} placeholder={t.provider.finalAmount} placeholderTextColor={theme.muted} keyboardType="numeric" />
            )}
          </View>
        ) : null}
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  body: {gap: 12, width: "100%"},
  pill: {borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10},
  pillText: {color: "#fff", fontSize: 12, fontWeight: "700"},
  hero: {gap: 2},
  direction: {fontSize: 12, fontWeight: "700"},
  heroName: {fontSize: 16, fontWeight: "700"},
  shopBlock: {borderWidth: 1, borderRadius: 12, padding: 10, gap: 6, flex: 1},
  shopRow: {flexDirection: "row", gap: 8, alignItems: "center"},
  routeSquare: {width: 48, alignSelf: "stretch", borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center"},
  section: {flexDirection: "row", gap: 8, alignItems: "flex-start"},
  sectionBody: {flex: 1, gap: 2},
  metaRow: {flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap"},
  spread: {justifyContent: "space-between", flexWrap: "nowrap"},
  phoneTake: {flex: 1},
  phoneRow: {flex: 1, flexDirection: "row", alignItems: "center", gap: 4},
  coords: {fontSize: 12},
  label: {fontSize: 13, fontWeight: "700"},
  rail: {gap: 0},
  railRow: {flexDirection: "row", gap: 10},
  railLeft: {width: 14, alignItems: "center"},
  dot: {width: 10, height: 10, borderRadius: 5, borderWidth: 2, marginTop: 3},
  connector: {width: 2, flex: 1, minHeight: 10},
  railText: {flex: 1, gap: 4, paddingBottom: 10, alignItems: "flex-start"},
  stagePill: {borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9},
  stageText: {color: "#fff", fontSize: 11, fontWeight: "700"},
  replyRow: {gap: 6, borderWidth: 1, borderRadius: 12, padding: 10},
  stars: {flexDirection: "row", gap: 1, alignItems: "center"},
  form: {gap: 8},
  actionBtn: {borderRadius: 8, padding: 10, alignItems: "center"},
  actionText: {color: "#fff", fontWeight: "700"},
  chipBtn: {borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12},
  selfStart: {alignSelf: "flex-start"},
  chipRow: {flexDirection: "row", gap: 8, flexWrap: "wrap"},
  input: {borderWidth: 1, borderRadius: 8, padding: 10},
  locked: {opacity: 0.7},
  disabled: {opacity: 0.6},
});
