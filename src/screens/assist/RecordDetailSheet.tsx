import {useEffect, useState} from "react";
import {ActivityIndicator, Image, Linking, Pressable, StyleSheet, View, useColorScheme} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text, AppTextInput as TextInput} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import {darkTheme, lightTheme, type AppTheme} from "../../theme";
import {DECLINE_REASONS, DISPATCH_STATUS, isTerminal, type DeclineReason, type FeedTicket} from "../../api/dispatch";
import {paymentMethodLabel, paymentStatusLabel} from "../../api/payments";
import type {UserRating} from "../../api/ratings";
import Overlay, {type OverlayAction} from "../../components/overlay/Overlay";
import {formatPoint, reverseLabel} from "../../api/places";
import {distBetween} from "../navigation/navUtils";
import {timeAgoLabel} from "../hazards/hazardFilter";
import {canAccept, canApproveQuote, canCancel, canDeclineDestination, canDispute, canDisputeResolved, canEditDestination, canEditWork, canMarkReady, canRate, canRateRider, canResolve, canSendEstimate, canSendQuote, canStartWork, estimateStateOf} from "./recordActions";
import {formatAmountInput} from "./money";
import {declineReasonLabel, stageLabel, statusPillColor, statusStages, ticketStatusLabel, ticketTitle, ticketTypeLabel} from "./ticketLabels";
import {directionOf} from "./recordFilter";
import StatusStepper from "./StatusStepper";
import RatingRow from "./RatingRow";
import {usePhotoUrls} from "../../services/photos";
import {usePhotoViewer} from "../../components/ui/PhotoViewer";
export type WorkPatch = {workType: string; quoted: string; final: string};

export type TicketPaymentView = {
  method?: string | null;
  status?: string | null;
  checkoutUrl?: string | null;
  id?: string | null;
};

type Props = {
  t: Strings;
  lang: string;
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
  onDecline: ((ticket: FeedTicket, reason: DeclineReason, note: string | undefined) => void) | null;
  onSaveWork: (ticket: FeedTicket, patch: WorkPatch) => void;
  onSendQuote: (ticket: FeedTicket, patch: WorkPatch) => void;
  onOpenEstimate?: ((ticket: FeedTicket) => void) | null;
  onApproveQuote: (ticket: FeedTicket) => void;
  onOpenShop: (ticket: FeedTicket) => void;
  onOpenDestination: (ticket: FeedTicket) => void;
  onNavigateJob: ((ticket: FeedTicket) => void) | null;
  acceptHidden: boolean;
  acceptOffDuty: boolean;
  towPreview: {ready: boolean; summary: string | null; fareEstimate?: number | null; busy: boolean; error: string | null} | null;
  onPreviewTowRoute: ((ticket: FeedTicket) => void) | null;
  linked: FeedTicket | null;
  onOpenLinked: (ticket: FeedTicket) => void;
  onAdvance: (ticket: FeedTicket, status: string) => void;
  onReply: (ratingId: string, text: string) => void;
  onRateRider: (ticket: FeedTicket) => void;
  ownShopIds: Set<string>;
  showRequestPhotos: boolean;
  onDeclineDestination: (ticket: FeedTicket) => void;
  onEditDestination: ((ticket: FeedTicket) => void) | null;
  allowTowerCancel: boolean;
  onApproveEstimate?: ((ticket: FeedTicket) => void) | null;
  onDeclineEstimate?: ((ticket: FeedTicket) => void) | null;
  onApproveFinal?: ((ticket: FeedTicket) => void) | null;
  onConfirmCash?: ((ticket: FeedTicket) => void) | null;
  onPayNow?: ((ticket: FeedTicket) => void) | null;
  onOpenDispute?: ((ticket: FeedTicket) => void) | null;
  onRequeue?: ((ticket: FeedTicket) => void) | null;
  payment?: TicketPaymentView | null;
  waiting?: {waitingMinutes: number; waitingFee: number} | null;
  onMarkUnfixable?: ((ticket: FeedTicket) => void) | null;
};

type Party = {
  id: string | null;
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
    return {id: null, name: fallback, kind: null, label: null, openNow: null, ratingAvg: null, ratingCount: null, phone: null};
  }
  return {
    id: typeof raw.id === "string" ? raw.id : null,
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

function PlaceLabel({theme, lat, lng, lang}: {theme: AppTheme; lat: number; lng: number; lang: string}) {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void reverseLabel(lat, lng, lang).then((resolved) => {
      if (alive) setLabel(resolved);
    });
    return () => {
      alive = false;
    };
  }, [lat, lng, lang]);
  const coords = formatPoint(lat, lng);
  return (
    <View style={{gap: 2}}>
      <Text style={[styles.coords, {color: theme.text}]}>{label ?? coords}</Text>
      {label !== null && label !== coords ? (
        <Text style={[styles.coords, {color: theme.muted}]}>{coords}</Text>
      ) : null}
    </View>
  );
}

type ShopCardData = {
  name: string;
  label: string | null;
  avg: number | null;
  count: number | null;
  phone: string | null;
  openNow: boolean | null;
};

function ShopCard({theme, t, shop, onPress}: {theme: AppTheme; t: Strings; shop: ShopCardData; onPress: (() => void) | null}) {
  return (
    <Pressable
      style={[styles.shopBlock, {borderColor: theme.border}]}
      onPress={onPress ?? undefined}
      disabled={onPress === null}
      accessibilityRole="button"
      accessibilityLabel={shop.name}
    >
      <Text style={[styles.shopName, {color: theme.text}]}>{shop.name}</Text>
      {shop.label !== null ? (
        <Section theme={theme} icon="storefront">
          <Text style={{color: theme.text}}>{shop.label}</Text>
        </Section>
      ) : null}
      <Stars theme={theme} avg={shop.avg} count={shop.count} />
      <View style={[styles.metaRow, styles.spread]}>
        {shop.phone !== null ? (
          onPress === null ? (
            <PhoneLink theme={theme} phone={shop.phone} />
          ) : (
            <Text style={[styles.coords, {color: theme.primary}]}>{shop.phone}</Text>
          )
        ) : (
          <View style={styles.phoneTake} />
        )}
        {shop.openNow !== null ? (
          <View style={[styles.pill, {backgroundColor: shop.openNow ? theme.primary : theme.danger}]}>
            <Text style={styles.pillText}>{shop.openNow ? t.shop.open : t.shop.closed}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
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

export default function RecordDetailSheet({t, lang, ticket, ratings, busy, gps, uid, hasRated, onClose, onConfirmCancel, onRate, onAccept, onDecline, onSaveWork, onSendQuote, onOpenEstimate, onApproveQuote, onOpenShop, onOpenDestination, onNavigateJob, acceptHidden, acceptOffDuty, towPreview, onPreviewTowRoute, linked, onOpenLinked, onAdvance, onReply, onRateRider, ownShopIds, showRequestPhotos, onDeclineDestination, onEditDestination, allowTowerCancel, onApproveEstimate, onDeclineEstimate, onApproveFinal, onConfirmCash, onPayNow, onOpenDispute, onRequeue, payment, waiting, onMarkUnfixable}: Props) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const inbound = directionOf(ticket) === "in";
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState<DeclineReason>("FULL");
  const [declineNote, setDeclineNote] = useState("");
  const [workOpen, setWorkOpen] = useState(false);
  const [workType, setWorkType] = useState(typeof ticket.workType === "string" ? ticket.workType : "");
  const [quoted, setQuoted] = useState(typeof ticket.shopQuotedAmount === "number" ? formatAmountInput(String(ticket.shopQuotedAmount)) : "");
  const [final, setFinal] = useState(typeof ticket.finalAmount === "number" ? formatAmountInput(String(ticket.finalAmount)) : "");
  const [replyRatingId, setReplyRatingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const photoViewer = usePhotoViewer(t.common.cancel);
  const party = partyOf(ticket, t.assist.unassigned);
  const hasShop = (typeof ticket.assignedShopId === "string" && ticket.assignedShopId !== "" && ownShopIds.has(ticket.assignedShopId)) ||
    (typeof ticket.providerId === "string" && ticket.providerId !== "" && ownShopIds.has(ticket.providerId));
  const riderMeters = inbound && gps ? Math.round(distBetween(gps, {lat: ticket.lat, lng: ticket.lng})) : null;
  const riderDistance = riderMeters === null ? null : riderMeters < 1000 ? t.shop.radiusM.replace("{n}", String(riderMeters)) : t.shop.radiusKm.replace("{n}", (riderMeters / 1000).toFixed(1));
  const showShop = party.kind === "SHOP" && (party.label !== null || party.openNow !== null || (party.ratingAvg !== null && party.ratingCount !== null));
  const roleLabel = party.kind === "SHOP" ? t.roles.shop : party.kind === "TOW" ? t.roles.tow : party.kind === "VOLUNTEER" ? t.roles.volunteer : party.kind === "RIDER" ? t.roles.rider : null;
  const displayName = roleLabel !== null && party.name === t.assist.unassigned ? roleLabel : party.name;
  const etaInMin = (iso: string | null | undefined): number | null => {
    if (typeof iso !== "string" || iso === "") return null;
    const mins = Math.round((Date.parse(iso) - Date.now()) / 60000);
    return mins > 0 ? mins : null;
  };
  const pickupIn = ticket.ticketType === "TOW" ? etaInMin(ticket.etaPickupAt) : null;
  const dropoffIn = ticket.ticketType === "TOW" ? etaInMin(ticket.etaDropoffAt) : null;
  const previewFresh = towPreview && towPreview.summary && (ticket.status === "1" || ticket.status === "2" || ticket.status === "3");
  const towerFix = ticket.ticketType === "TOW" && ticket.towerFix !== null && typeof ticket.towerFix === "object" &&
    typeof ticket.towerFix.lat === "number" && typeof ticket.towerFix.lng === "number" ?
    {lat: ticket.towerFix.lat, lng: ticket.towerFix.lng} :
    null;
  const towerMeters = towerFix ? Math.round(distBetween(towerFix, {lat: ticket.lat, lng: ticket.lng})) : null;
  const towerDistance = towerMeters === null ? null : towerMeters < 1000 ? t.shop.radiusM.replace("{n}", String(towerMeters)) : t.shop.radiusKm.replace("{n}", (towerMeters / 1000).toFixed(1));
  const etaPickupText = pickupIn !== null ? t.shop.etaPickup.replace("{n}", String(pickupIn)) : null;
  const etaPill = previewFresh ? towPreview.summary : etaPickupText !== null && towerDistance !== null ? `${towerDistance} · ${etaPickupText}` : etaPickupText;
  const destSnap = ticket.destinationSnapshot ?? null;
  const destLat = typeof destSnap?.lat === "number" ? destSnap.lat : typeof ticket.destinationPoint?.lat === "number" ? ticket.destinationPoint.lat : null;
  const destLng = typeof destSnap?.lng === "number" ? destSnap.lng : typeof ticket.destinationPoint?.lng === "number" ? ticket.destinationPoint.lng : null;
  const destName = typeof destSnap?.name === "string" && destSnap.name !== "" ? destSnap.name : null;
  const destLabel = typeof destSnap?.label === "string" && destSnap.label !== "" ? destSnap.label : typeof ticket.destinationPoint?.label === "string" && ticket.destinationPoint.label !== "" ? ticket.destinationPoint.label : null;
  const destParty = ticket.destinationParty ?? null;
  const destShop = destParty !== null && typeof destParty === "object" && typeof destParty.name === "string" && destParty.kind === "SHOP" ? {
    id: typeof destParty.id === "string" ? destParty.id : null,
    name: destParty.name,
    label: typeof destParty.label === "string" ? destParty.label : null,
    avg: typeof destParty.ratingAvg === "number" ? destParty.ratingAvg : null,
    count: typeof destParty.ratingCount === "number" ? destParty.ratingCount : null,
    phone: typeof destParty.phone === "string" ? destParty.phone : null,
    openNow: typeof destParty.openNow === "boolean" ? destParty.openNow : null,
  } : null;
  const placeHeader = ticket.ticketType === "WALK_IN" ? t.assist.startPoint : ticket.ticketType === "TOW" || ticket.ticketType === "SOS" || ticket.ticketType === "MECHANIC" ? t.assist.pickup : null;
  const canDeclineDest = canDeclineDestination(ticket.status, ticket.destinationShopId, ownShopIds);
  const estimateAmount = typeof ticket.estimateAmount === "number" ? ticket.estimateAmount : typeof ticket.shopQuotedAmount === "number" ? ticket.shopQuotedAmount : null;
  const estimateNote = typeof ticket.estimateNote === "string" && ticket.estimateNote !== "" ? ticket.estimateNote : typeof ticket.workType === "string" && ticket.workType !== "" ? ticket.workType : null;
  const faultPhotos = usePhotoUrls(ticket.faultPhotos);
  const ticketPhotoPaths = showRequestPhotos && Array.isArray(ticket.photoUrls) ? ticket.photoUrls.filter((path): path is string => typeof path === "string" && path !== "") : [];
  const ticketPhotos = usePhotoUrls(showRequestPhotos ? ticket.photoUrls : null);
  const fareWaitingFee = ticket.towFare !== null && typeof ticket.towFare === "object" && typeof ticket.towFare.waitingFee === "number" ? ticket.towFare.waitingFee : null;
  const waitingFee = typeof waiting?.waitingFee === "number" ? waiting.waitingFee : typeof ticket.waitingFee === "number" ? ticket.waitingFee : fareWaitingFee;
  const fareWaitingMinutes = ticket.towFare !== null && typeof ticket.towFare === "object" && typeof ticket.towFare.waitingMinutes === "number" ? ticket.towFare.waitingMinutes : null;
  const sinceMinutes = typeof ticket.waitingSince === "string" && ticket.waitingSince !== "" ? Math.max(0, Math.round((Date.now() - Date.parse(ticket.waitingSince)) / 60000)) : null;
  const waitingMinutes = typeof waiting?.waitingMinutes === "number" ? waiting.waitingMinutes : typeof ticket.waitingMinutes === "number" ? ticket.waitingMinutes : fareWaitingMinutes ?? sinceMinutes;
  const showWaiting = (waitingMinutes !== null && waitingMinutes > 0) || (waitingFee !== null && waitingFee > 0);
  const payMethod = typeof payment?.method === "string" ? payment.method : typeof ticket.paymentMethod === "string" ? ticket.paymentMethod : null;
  const payStatus = typeof payment?.status === "string" ? payment.status : typeof ticket.paymentStatus === "string" ? ticket.paymentStatus : null;
  const qrUri = typeof ticket.qrUrl === "string" && ticket.qrUrl !== "" ? ticket.qrUrl : typeof payment?.checkoutUrl === "string" && payment.checkoutUrl !== "" ? payment.checkoutUrl : typeof ticket.checkoutUrl === "string" && ticket.checkoutUrl !== "" ? ticket.checkoutUrl : null;
  const towerCancelled = ticket.direction === "out" && typeof ticket.cancelledBy === "string" && ticket.cancelledBy !== "" && !isTerminal(ticket.status);
  const declinedLegs = Array.isArray(ticket.towLegs) ? ticket.towLegs.filter((leg) => typeof leg?.toShopId === "string" && (leg as {toShopId: string}).toShopId !== "") : [];
  const shopDeclinedMid = declinedLegs.length > 0 && !isTerminal(ticket.status);
  const showEstimateCard = estimateAmount !== null;
  const showFinalCard = typeof ticket.finalAmount === "number";
  const showUnfixable = ticket.unfixable === true;
  const estimateState = estimateStateOf(ticket);
  const destinationMine = typeof ticket.destinationShopId === "string" && ticket.destinationShopId !== "" && ownShopIds.has(ticket.destinationShopId);
  const canEstimate = onOpenEstimate !== undefined && onOpenEstimate !== null && canSendEstimate(ticket.direction, ticket.ticketType, ticket.status, destinationMine, estimateState);
  const disputeCovered = towerCancelled || shopDeclinedMid || showFinalCard;
  const showDisputeFoot = onOpenDispute !== undefined && onOpenDispute !== null && ticket.direction === "out" && !disputeCovered && (canDispute(ticket.status) || canDisputeResolved(ticket));
  const actions: OverlayAction[] = [];
  if (!inbound && canRate(ticket.status)) {
    actions.push({label: hasRated ? t.rating.editRating : t.assist.rate, tone: "primary", busy, onPress: () => onRate(ticket)});
  }
  const showCancel = (!inbound && canCancel(ticket.status)) || allowTowerCancel;
  if (showCancel && !confirmCancel) {
    actions.push({label: t.assist.cancel, tone: "danger", outline: true, onPress: () => setConfirmCancel(true)});
  }
  if (showCancel && confirmCancel) {
    actions.push({label: t.assist.keepRequest, tone: "neutral", outline: true, onPress: () => setConfirmCancel(false)});
    actions.push({label: t.assist.confirmCancel, tone: "danger", busy, onPress: () => onConfirmCancel(ticket.id)});
  }
  if (canAccept(ticket.direction, ticket.status) && !declineOpen) {
    if (onDecline && ticket.ticketType === "WALK_IN") {
      actions.push({label: t.provider.decline, tone: "danger", outline: true, onPress: () => { setDeclineReason("FULL"); setDeclineNote(""); setDeclineOpen(true); }});
    }
    if (!acceptHidden) {
      actions.push({label: t.assist.accept, tone: "primary", busy, onPress: () => onAccept(ticket)});
    }
    if (towPreview && onPreviewTowRoute) {
      actions.push({label: t.assist.towRoutePreview, tone: "neutral", outline: true, disabled: !towPreview.ready || towPreview.busy, onPress: () => onPreviewTowRoute(ticket)});
    }
  }
  if (declineOpen && onDecline) {
    actions.push({label: t.provider.decline, tone: "danger", busy, onPress: () => { onDecline(ticket, declineReason, declineNote.trim() || undefined); setDeclineOpen(false); }});
  }
  const quoteReady = canSendQuote(ticket.direction, ticket.status, hasShop) && quoted.trim() !== "" && typeof ticket.shopQuotedAmount !== "number";
  if (workOpen && !quoteReady) {
    actions.push({label: t.provider.saveWork, tone: "primary", busy, onPress: () => { onSaveWork(ticket, {workType, quoted, final}); setWorkOpen(false); }});
  }
  if (quoteReady) {
    actions.push({label: t.assist.sendQuote, tone: "primary", busy, onPress: () => { onSendQuote(ticket, {workType, quoted, final}); setWorkOpen(false); }});
  }
  const unfixableReady = onMarkUnfixable !== undefined && onMarkUnfixable !== null && ticket.direction === "in" && hasShop && !showUnfixable &&
    (ticket.status === DISPATCH_STATUS.ARRIVED || ticket.status === DISPATCH_STATUS.QUOTED || ticket.status === DISPATCH_STATUS.IN_SHOP || ticket.status === DISPATCH_STATUS.FINAL_QUOTED);
  if (unfixableReady) {
    actions.push({label: t.assist.unfixableAction, tone: "danger", outline: true, busy, onPress: () => onMarkUnfixable(ticket)});
  }
  if (canApproveQuote(ticket.direction, ticket.status)) {
    actions.push({label: t.assist.approveQuote, tone: "primary", busy, onPress: () => onApproveQuote(ticket)});
  }
  if (canResolve(ticket.direction, ticket.status)) {
    actions.push({label: t.assist.resolved, tone: "primary", busy, onPress: () => onAdvance(ticket, "4")});
  }
  if (ticket.direction === "out" && ticket.status === "2") {
    actions.push({label: t.assist.arrived, tone: "primary", busy, onPress: () => onAdvance(ticket, "3")});
  }
  if (ticket.direction === "out" && ticket.status === "3") {
    actions.push({label: t.assist.resolved, tone: "primary", busy, onPress: () => onAdvance(ticket, "4")});
  }
  if (onNavigateJob) {
    actions.push({label: t.common.routeFromHere, tone: "primary", busy, onPress: () => onNavigateJob(ticket)});
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
  if (canEstimate) {
    actions.push({label: t.assist.sendEstimate, tone: "neutral", outline: true, onPress: () => onOpenEstimate?.(ticket)});
  }
  if (canDeclineDest) {
    actions.push({label: t.assist.declineDestination, tone: "danger", outline: true, busy, onPress: () => onDeclineDestination(ticket)});
  }
  if (onEditDestination && canEditDestination(ticket.direction, ticket.status, ticket.ticketType)) {
    actions.push({label: t.assist.changeDropOff, tone: "neutral", outline: true, busy, onPress: () => onEditDestination(ticket)});
  }
  return (
    <Overlay
      visible
      variant="sheet"
      title={ticketTypeLabel(ticket.ticketType, t)}
      right={
        <View style={{flexDirection: "row", gap: 8, alignItems: "center"}}>
          {etaPill !== null ? (
            <View style={[styles.pill, {backgroundColor: theme.primary}]}>
              <Text style={styles.pillText}>{etaPill}</Text>
            </View>
          ) : null}
          <View style={[styles.pill, {backgroundColor: statusPillColor(ticket.status, theme)}]}>
            <Text style={styles.pillText}>{ticketStatusLabel(ticket.status, t)}</Text>
          </View>
        </View>
      }
      closeLabel={t.common.cancel}
      onClose={onClose}
      actions={actions}
    >
      <View style={styles.body}>
        <View style={styles.hero}>
          <Text style={[styles.direction, {color: theme.primary}]} accessibilityLabel={inbound ? t.assist.incoming : t.assist.outgoing}>{inbound ? t.assist.filterIn : t.assist.filterOut}</Text>
          <Text style={[styles.heroName, {color: theme.text}]}>{displayName}</Text>
          {roleLabel !== null ? (
            <Text style={[styles.coords, {color: theme.muted}]}>{roleLabel}</Text>
          ) : null}
          <Text style={[styles.coords, {color: theme.muted}]}>{ticketTypeLabel(ticket.ticketType, t)}{typeof ticket.createdAt === "string" ? ` · ${agoOf(ticket.createdAt, t)}` : ""}</Text>
          {dropoffIn !== null ? (
            <Text style={[styles.coords, {color: theme.primary}]}>{t.shop.etaDropoff.replace("{n}", String(dropoffIn))}</Text>
          ) : null}
        </View>
        <View style={[styles.destBlock, {borderColor: theme.border}]}>
          {placeHeader !== null ? (
            <Text style={[styles.coords, {color: theme.muted}]}>{placeHeader}</Text>
          ) : null}
          <Section theme={theme} icon="place">
            <PlaceLabel theme={theme} lat={ticket.lat} lng={ticket.lng} lang={lang} />
          </Section>
        </View>
        {showShop ? (
          <ShopCard
            theme={theme}
            t={t}
            shop={{name: party.name, label: party.label, avg: party.ratingAvg, count: party.ratingCount, phone: party.phone, openNow: party.openNow}}
            onPress={() => onOpenShop(ticket)}
          />
        ) : null}
        {destShop !== null ? (
          <View style={[styles.destBlock, {borderColor: theme.border}]}>
            <Text style={[styles.coords, {color: theme.muted}]}>{t.assist.dropOffPoint}</Text>
            <ShopCard
              theme={theme}
              t={t}
              shop={destShop}
              onPress={() => onOpenDestination(ticket)}
            />
          </View>
        ) : !destShop && destLat !== null && destLng !== null ? (
          <View style={[styles.destBlock, {borderColor: theme.border}]}>
            <Text style={[styles.coords, {color: theme.muted}]}>{t.assist.dropOffPoint}</Text>
            <Section theme={theme} icon={destName !== null ? "storefront" : "flag"}>
              <Text style={[styles.coords, {color: theme.text}]}>{destName ?? destLabel ?? t.assist.dropOffPoint}</Text>
              <Text style={[styles.coords, {color: theme.muted}]}>{formatPoint(destLat, destLng)}</Text>
            </Section>
          </View>
        ) : ticket.ticketType === "TOW" ? (
          <View style={[styles.destBlock, {borderColor: theme.border}]}>
            <Text style={[styles.coords, {color: theme.muted}]}>{t.assist.dropOffPoint}</Text>
            <Section theme={theme} icon="flag">
              <Text style={[styles.coords, {color: theme.muted}]}>{inbound ? t.assist.noDropOffAssigned : t.assist.noDropOff}</Text>
            </Section>
            {onEditDestination && canEditDestination(ticket.direction, ticket.status, ticket.ticketType) ? (
              <Pressable style={[styles.chipBtn, styles.selfStart, {borderColor: theme.primary}]} onPress={() => onEditDestination(ticket)} accessibilityRole="button" accessibilityLabel={t.assist.changeDropOff}>
                <Text style={{color: theme.primary}}>{t.assist.changeDropOff}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {towPreview ? (
          <View style={[styles.destBlock, {borderColor: theme.border}]}>
            <Text style={[styles.coords, {color: theme.muted}]}>{t.assist.towRoutePreview}</Text>
            {towPreview.busy ? (
              <View style={[styles.metaRow, {flexDirection: "row", alignItems: "center", gap: 8}]}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text style={[styles.coords, {color: theme.muted}]}>{t.common.loading}</Text>
              </View>
            ) : towPreview.error ? (
              <Text style={[styles.coords, {color: theme.danger}]}>{towPreview.error}</Text>
            ) : previewFresh && towPreview.summary ? (
              <Text style={[styles.coords, {color: theme.text}]}>{towPreview.summary}</Text>
            ) : null}
            {towPreview.fareEstimate !== null && towPreview.fareEstimate !== undefined ? (
              <Text style={[styles.coords, {color: theme.text}]}>{`${t.assist.fareEstimate}: ${towPreview.fareEstimate.toLocaleString()} VND`}</Text>
            ) : null}
          </View>
        ) : null}
        {acceptHidden ? (
          <Text style={[styles.coords, {color: theme.muted}]}>{acceptOffDuty ? t.assist.towNotAccepting : t.assist.towAcceptHint}</Text>
        ) : null}
        {inbound ? (
          <View style={[styles.shopBlock, {borderColor: theme.border}]}>
            <Section theme={theme} icon="person-pin-circle">
              <Text style={{color: theme.text}}>{displayName}</Text>
              <Text style={[styles.coords, {color: theme.muted}]}>
                {formatPoint(ticket.lat, ticket.lng)}{riderDistance ? ` · ${riderDistance}` : ""}
              </Text>
            </Section>
            <Stars theme={theme} avg={party.ratingAvg} count={party.ratingCount} />
            {party.phone !== null ? <CallRow theme={theme} phone={party.phone} /> : null}
          </View>
        ) : null}
        {!inbound && roleLabel !== null ? (
          <View style={[styles.shopBlock, {borderColor: theme.border}]}>
            <Section theme={theme} icon="person-pin-circle">
              <Text style={{color: theme.text}}>{displayName}</Text>
              <Text style={[styles.coords, {color: theme.muted}]}>{roleLabel}</Text>
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
        {typeof ticket.description === "string" && ticket.description ? (
          <Section theme={theme} icon="description">
            <Text style={{color: theme.text}}>{ticket.description}</Text>
          </Section>
        ) : null}
        {showRequestPhotos && ticketPhotoPaths.length > 0 ? (
          <View style={[styles.destBlock, {borderColor: theme.border}]}>
            <Text style={[styles.coords, {color: theme.muted}]}>{t.assist.photos}</Text>
            <View style={styles.photoRow}>
              {ticketPhotos.length > 0 ? (
                ticketPhotos.map((uri, i) => (
                  <Pressable key={`${i}-${uri}`} onPress={() => photoViewer.open(uri)} accessibilityRole="button" accessibilityLabel={`${t.assist.photos} ${i + 1}`}>
                    <Image source={{uri}} style={styles.thumb} />
                  </Pressable>
                ))
              ) : (
                ticketPhotoPaths.map((path, i) => (
                  <View key={`pending-${i}-${path}`} style={[styles.thumb, {backgroundColor: theme.border}]} />
                ))
              )}
            </View>
          </View>
        ) : null}
        {typeof ticket.declineReason === "string" && ticket.declineReason ? (
          <Section theme={theme} icon="error-outline">
            <Text style={[styles.coords, {color: theme.danger}]}>
              {declineReasonLabel(ticket.declineReason, t)}{typeof ticket.declineNote === "string" && ticket.declineNote ? ` · ${ticket.declineNote}` : ""}
            </Text>
          </Section>
        ) : null}
        {showUnfixable ? (
          <View style={[styles.banner, {borderColor: theme.danger, backgroundColor: theme.danger}]}>
            <MaterialIcons name="error-outline" size={16} color="#fff" />
            <View style={styles.bannerBody}>
              <Text style={styles.bannerTitle}>{t.assist.unfixableTitle}</Text>
              <Text style={styles.bannerText}>{t.assist.unfixableRefund}</Text>
            </View>
          </View>
        ) : null}
        {towerCancelled ? (
          <View style={[styles.banner, {borderColor: theme.danger, backgroundColor: theme.danger}]}>
            <MaterialIcons name="warning" size={16} color="#fff" />
            <View style={styles.bannerBody}>
              <Text style={styles.bannerText}>{t.assist.towerCancelMid}</Text>
              <View style={styles.bannerRow}>
                {onRequeue ? (
                  <Pressable style={[styles.bannerBtn, {borderColor: "#fff"}]} onPress={() => onRequeue(ticket)} accessibilityRole="button" accessibilityLabel={t.assist.requeue}>
                    <Text style={styles.bannerBtnText}>{t.assist.requeue}</Text>
                  </Pressable>
                ) : null}
                {onOpenDispute ? (
                  <Pressable style={[styles.bannerBtn, {borderColor: "#fff"}]} onPress={() => onOpenDispute(ticket)} accessibilityRole="button" accessibilityLabel={t.assist.disputeTicket}>
                    <Text style={styles.bannerBtnText}>{t.assist.disputeTicket}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}
        {shopDeclinedMid ? (
          <View style={[styles.banner, {borderColor: theme.danger, backgroundColor: theme.danger}]}>
            <MaterialIcons name="warning" size={16} color="#fff" />
            <View style={styles.bannerBody}>
              <Text style={styles.bannerText}>{t.assist.shopDeclineMid}</Text>
              <View style={styles.bannerRow}>
                {onOpenDispute ? (
                  <Pressable style={[styles.bannerBtn, {borderColor: "#fff"}]} onPress={() => onOpenDispute(ticket)} accessibilityRole="button" accessibilityLabel={t.assist.disputeTicket}>
                    <Text style={styles.bannerBtnText}>{t.assist.disputeTicket}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
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
        {showEstimateCard && estimateAmount !== null ? (
          <View style={[styles.destBlock, {borderColor: theme.border}]}>
            <Text style={[styles.label, {color: theme.text}]}>{t.assist.estimateTitle}</Text>
            <Text style={[styles.amount, {color: theme.text}]}>{estimateAmount.toLocaleString()} VND</Text>
            {estimateNote !== null ? <Text style={[styles.coords, {color: theme.muted}]}>{estimateNote}</Text> : null}
            {typeof ticket.estimateAmount === "number" ? (
              <Text style={[styles.coords, {color: estimateState === "expired" ? theme.danger : theme.muted}]}>{estimateState === "approved" ? t.assist.estimateStateApproved : estimateState === "expired" ? t.assist.estimateStateExpired : t.assist.estimateStateAwaiting}</Text>
            ) : null}
            {ticket.direction === "out" && estimateState === "pending" && (onApproveEstimate || onDeclineEstimate) ? (
              <View style={styles.metaRow}>
                {onDeclineEstimate ? (
                  <Pressable style={[styles.chipBtn, {borderColor: theme.danger}]} disabled={busy} onPress={() => onDeclineEstimate(ticket)} accessibilityRole="button" accessibilityLabel={t.assist.declineEstimate}>
                    <Text style={{color: theme.danger}}>{t.assist.decline}</Text>
                  </Pressable>
                ) : null}
                {onApproveEstimate ? (
                  <Pressable style={[styles.actionBtn, styles.inlineAction, {backgroundColor: theme.primary}, busy && styles.disabled]} disabled={busy} onPress={() => onApproveEstimate(ticket)} accessibilityRole="button" accessibilityLabel={t.assist.approve}>
                    <Text style={styles.actionText}>{t.assist.approve}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}
        {showFinalCard && typeof ticket.finalAmount === "number" ? (
          <View style={[styles.destBlock, {borderColor: theme.border}]}>
            <Text style={[styles.label, {color: theme.text}]}>{t.assist.finalTitle}</Text>
            <Text style={[styles.amount, {color: theme.text}]}>{(ticket.finalAmount as number).toLocaleString()} VND</Text>
            {typeof ticket.workType === "string" && ticket.workType !== "" ? <Text style={[styles.coords, {color: theme.muted}]}>{ticket.workType}</Text> : null}
            {faultPhotos.length > 0 ? (
              <View style={styles.photoRow}>
                {faultPhotos.map((uri, i) => (
                  <Pressable key={`${i}-${uri}`} onPress={() => photoViewer.open(uri)} accessibilityRole="button" accessibilityLabel={`${t.assist.finalTitle} ${i + 1}`}>
                    <Image source={{uri}} style={styles.thumb} />
                  </Pressable>
                ))}
              </View>
            ) : null}
            {ticket.direction === "out" ? (
              <View style={styles.metaRow}>
                {onApproveFinal ? (
                  <Pressable style={[styles.actionBtn, styles.inlineAction, {backgroundColor: theme.primary}, busy && styles.disabled]} disabled={busy} onPress={() => onApproveFinal(ticket)} accessibilityRole="button" accessibilityLabel={t.assist.approve}>
                    <Text style={styles.actionText}>{t.assist.approve}</Text>
                  </Pressable>
                ) : null}
                {onPayNow ? (
                  <Pressable style={[styles.actionBtn, styles.inlineAction, {backgroundColor: theme.primary}, busy && styles.disabled]} disabled={busy} onPress={() => onPayNow(ticket)} accessibilityRole="button" accessibilityLabel={t.assist.payNow}>
                    <Text style={styles.actionText}>{t.assist.payNow}</Text>
                  </Pressable>
                ) : null}
                {onOpenDispute ? (
                  <Pressable style={[styles.chipBtn, {borderColor: theme.danger}]} disabled={busy} onPress={() => onOpenDispute(ticket)} accessibilityRole="button" accessibilityLabel={t.assist.disputeTicket}>
                    <Text style={{color: theme.danger}}>{t.assist.disputeTicket}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}
        {showWaiting ? (
          <View style={[styles.waitRow, {borderColor: "#f59e0b"}]}>
            <MaterialIcons name="schedule" size={16} color="#f59e0b" />
            <Text style={[styles.coords, {color: "#f59e0b"}]}>
              {t.assist.waitingTitle}{waitingMinutes !== null && waitingMinutes > 0 ? ` · ${waitingMinutes} ${t.route.min}` : ""}{waitingFee !== null && waitingFee > 0 ? ` · ${waitingFee.toLocaleString()} VND` : ""}
            </Text>
          </View>
        ) : null}
        {payMethod !== null ? (
          <View style={[styles.destBlock, {borderColor: theme.border}]}>
            <Text style={[styles.coords, {color: theme.muted}]}>{paymentMethodLabel(payMethod)}{payStatus !== null ? ` · ${payStatus === "HELD" && payMethod === "SEPAY" ? t.assist.sepayHeld : paymentStatusLabel(payStatus)}` : ""}</Text>
            {payMethod === "SEPAY" && qrUri !== null ? (
              <Pressable style={[styles.actionBtn, styles.inlineAction, {backgroundColor: theme.primary}, busy && styles.disabled]} disabled={busy} onPress={() => void Linking.openURL(qrUri)} accessibilityRole="button" accessibilityLabel={t.assist.payNow}>
                <Text style={styles.actionText}>{t.assist.payNow}</Text>
              </Pressable>
            ) : null}
            {payMethod === "CASH" && payStatus !== "CONFIRMED" && ticket.direction === "in" && onConfirmCash ? (
              <Pressable style={[styles.actionBtn, {backgroundColor: theme.primary}, busy && styles.disabled]} disabled={busy} onPress={() => onConfirmCash(ticket)} accessibilityRole="button" accessibilityLabel={t.assist.cashConfirmReceipt}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>{t.assist.cashConfirmReceipt}</Text>}
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {ticket.ticketType === "TOW" && ticket.towFare !== null && typeof ticket.towFare === "object" && typeof ticket.towFare.estimate === "number" ? (
          <Section theme={theme} icon="payments">
            <Text style={[styles.coords, {color: theme.text}]}>
              {typeof ticket.towFare.final === "number" ?
                `${ticket.towFare.partial === true ? t.assist.farePartial : t.assist.fareFinal}: ${ticket.towFare.final.toLocaleString()} VND` :
                `${t.assist.fareUpTo}: ${ticket.towFare.ceiling.toLocaleString()} VND`}
            </Text>
          </Section>
        ) : null}
        <Timeline t={t} theme={theme} ticket={ticket} />
        {linked ? (
          <Pressable style={[styles.linkRow, {borderColor: theme.border}]} onPress={() => onOpenLinked(linked)} accessibilityRole="button" accessibilityLabel={ticketTitle(linked, t)}>
            <MaterialIcons name="link" size={16} color={theme.primary} />
            <Text style={[styles.coords, {color: theme.primary}]}>{ticketTitle(linked, t)}</Text>
          </Pressable>
        ) : null}
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
        {showCancel && confirmCancel ? (
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
              <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={quoted} onChangeText={(value) => setQuoted(formatAmountInput(value))} placeholder={t.provider.quotedAmount} placeholderTextColor={theme.muted} keyboardType="number-pad" />
            )}
            <Text style={[styles.label, {color: theme.text}]}>{t.provider.finalAmount}</Text>
            {typeof ticket.finalAmount === "number" ? (
              <TextInput style={[styles.input, styles.locked, {borderColor: theme.border, color: theme.muted}]} value={ticket.finalAmount.toLocaleString()} editable={false} accessibilityLabel={t.provider.finalAmount} />
            ) : (
              <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={final} onChangeText={(value) => setFinal(formatAmountInput(value))} placeholder={t.provider.finalAmount} placeholderTextColor={theme.muted} keyboardType="number-pad" />
            )}
          </View>
        ) : null}
        {showDisputeFoot && onOpenDispute ? (
          <Pressable style={[styles.chipBtn, styles.selfStart, {borderColor: theme.danger}]} onPress={() => onOpenDispute(ticket)} accessibilityRole="button" accessibilityLabel={t.assist.disputeTicket}>
            <Text style={{color: theme.danger}}>{t.assist.disputeTicket}</Text>
          </Pressable>
        ) : null}
        {photoViewer.node}
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
  shopName: {fontSize: 15, fontWeight: "700"},
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
  linkRow: {flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, padding: 10},
  destBlock: {borderWidth: 1, borderRadius: 12, padding: 10, gap: 6},
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
  amount: {fontSize: 16, fontWeight: "700"},
  photoRow: {flexDirection: "row", gap: 8, flexWrap: "wrap"},
  thumb: {width: 64, height: 64, borderRadius: 8},
  waitRow: {flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, padding: 10},
  banner: {flexDirection: "row", gap: 8, borderWidth: 1, borderRadius: 12, padding: 10, alignItems: "flex-start"},
  bannerBody: {flex: 1, gap: 6},
  bannerTitle: {color: "#fff", fontSize: 13, fontWeight: "700"},
  bannerText: {color: "#fff", fontSize: 12},
  bannerRow: {flexDirection: "row", gap: 8, flexWrap: "wrap"},
  bannerBtn: {borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12},
  bannerBtnText: {color: "#fff", fontWeight: "700"},
  inlineAction: {flex: 1},
});
