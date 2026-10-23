import {useState} from "react";
import {ActivityIndicator, Pressable, StyleSheet, View} from "react-native";
import {useAppMode} from "../../context/ThemeContext";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text, AppTextInput as TextInput} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import {darkTheme, lightTheme, onColor, type AppTheme} from "../../theme";
import {DECLINE_REASONS, isTerminal, type DeclineReason, type FeedTicket} from "../../api/dispatch";
import type {Bill} from "../../api/bills";
import type {UserRating} from "../../api/ratings";
import Overlay, {type OverlayAction} from "../../components/overlay/Overlay";
import {distBetween} from "../navigation/navUtils";
import {timeAgoLabel} from "../hazards/hazardFilter";
import {canAccept, canApproveQuote, canCancel, canDeclineDestination, canDispute, canDisputeResolved, canEditDestination, canEditWork, canMarkReady, canMarkUnfixable, canRate, canRateRider, canResolve, canSendEstimate, canSendQuote, canStartWork, estimateStateOf, viewerRoleOf, type ViewerRole, type ViewerRoleContext} from "./recordActions";
import {declineReasonLabel, stageLabel, statusPillColor, statusStages, ticketStatusLabel, ticketTitle, ticketTypeLabel} from "./ticketLabels";
import {directionOf} from "./recordFilter";
import RatingRow from "./RatingRow";
import {usePhotoUrls} from "../../services/photos";
import {usePhotoViewer} from "../../components/ui/PhotoViewer";
import {partyOf} from "./detail/parts";
import JourneyCard, {type DestinationShop, type JourneyPreview} from "./detail/JourneyCard";
import NotesPhotosCard from "./detail/NotesPhotosCard";
import FeesCard from "./detail/FeesCard";
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
  uid: string | null;
  hasRated: boolean;
  onClose: () => void;
  onConfirmCancel: (id: string) => void;
  onRate: (ticket: FeedTicket) => void;
  onAccept: (ticket: FeedTicket) => void;
  onDecline: ((ticket: FeedTicket, reason: DeclineReason, note: string | undefined) => void) | null;
  onOpenWork: (ticket: FeedTicket) => void;
  onOpenQuote: (ticket: FeedTicket) => void;
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
  ownTowId: string | null;
  hasVolunteer: boolean;
  roleContext?: ViewerRoleContext;
  showRequestPhotos: boolean;
  onDeclineDestination: (ticket: FeedTicket) => void;
  onEditDestination: ((ticket: FeedTicket) => void) | null;
  allowTowerCancel: boolean;
  onApproveEstimate?: ((ticket: FeedTicket) => void) | null;
  onDeclineEstimate?: ((ticket: FeedTicket) => void) | null;
  onApproveFinal?: ((ticket: FeedTicket) => void) | null;
  onConfirmCash?: ((ticket: FeedTicket) => void) | null;
  onOpenBill?: ((ticket: FeedTicket) => void) | null;
  onOpenDispute?: ((ticket: FeedTicket) => void) | null;
  onRequeue?: ((ticket: FeedTicket) => void) | null;
  payment?: TicketPaymentView | null;
  waiting?: {waitingMinutes: number; waitingFee: number} | null;
  onMarkUnfixable?: ((ticket: FeedTicket) => void) | null;
  bill?: Bill | null;
  quoteFunded?: boolean;
};

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

function StatusHistory({t, theme, ticket}: {t: Strings; theme: AppTheme; ticket: FeedTicket}) {
  const history = Array.isArray(ticket.statusHistory) ? ticket.statusHistory : [];
  const stages = statusStages(ticket.ticketType);
  const seen = new Set(history.map((h) => h.status));
  const atOf = new Map(history.map((h) => [h.status, h.at] as [string, string]));
  const current = ticket.status;
  const trailing = !stages.includes(current) ? [current] : [];
  const rows = [...stages.filter((s) => seen.has(s) || s === current), ...trailing];
  const currentAt = atOf.get(current) ?? history[history.length - 1]?.at ?? null;
  const tint = statusPillColor(current, theme);
  const summary = rows.map((status) => {
    const at = atOf.get(status);
    const label = stageLabel(ticket.ticketType, status, t);
    return at !== undefined && at !== "" ? `${label} ${agoOf(at, t)}` : label;
  }).join(", ");
  return (
    <View style={styles.history} accessible accessibilityLabel={summary}>
      {rows.map((status, i) => {
        const failed = !stages.includes(status);
        const filled = seen.has(status) || status === current;
        const dotColor = failed ? theme.danger : filled ? statusPillColor(status, theme) : theme.border;
        return (
          <View key={`${status}-${i}`} style={styles.historyStep}>
            {i > 0 ? <View style={[styles.historyLine, {backgroundColor: theme.border}]} /> : null}
            <View style={[styles.historyDot, {borderColor: dotColor, backgroundColor: filled || failed ? dotColor : "transparent"}]} />
          </View>
        );
      })}
      <Text numberOfLines={1} style={[styles.historyLabel, {color: tint}]}>{stageLabel(ticket.ticketType, current, t)}</Text>
      {currentAt !== null ? <Text numberOfLines={1} style={[styles.historyTime, {color: theme.muted}]}>{` · ${agoOf(currentAt, t)}`}</Text> : null}
    </View>
  );
}

export default function RecordDetailSheet({t, lang, ticket, ratings, busy, uid, hasRated, onClose, onConfirmCancel, onRate, onAccept, onDecline, onOpenWork, onOpenQuote, onOpenEstimate, onApproveQuote, onOpenShop, onOpenDestination, onNavigateJob, acceptHidden, acceptOffDuty, towPreview, onPreviewTowRoute, linked, onOpenLinked, onAdvance, onReply, onRateRider, ownShopIds, ownTowId, hasVolunteer, showRequestPhotos, onDeclineDestination, onEditDestination, allowTowerCancel, onApproveEstimate, onDeclineEstimate, onApproveFinal, onConfirmCash, onOpenBill, onOpenDispute, onRequeue, payment, waiting, onMarkUnfixable, bill, quoteFunded, roleContext}: Props) {
  const scheme = useAppMode();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const inbound = directionOf(ticket) === "in";
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState<DeclineReason>("FULL");
  const [declineNote, setDeclineNote] = useState("");
  const [replyRatingId, setReplyRatingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const photoViewer = usePhotoViewer(t.common.cancel);
  const party = partyOf(ticket, t.assist.unassigned);
  const role: ViewerRole = viewerRoleOf(ticket, {ownShopIds, ownTowId, uid, hasVolunteer}, roleContext ?? "auto");
  const hasShop = role.kind === "assigned" && role.assignedKind === "SHOP";
  const showShop = party.kind === "SHOP";
  const etaInMin = (iso: string | null | undefined): number | null => {
    if (typeof iso !== "string" || iso === "") return null;
    const mins = Math.round((Date.parse(iso) - Date.now()) / 60000);
    return mins > 0 ? mins : null;
  };
  const pickupIn = ticket.ticketType === "TOW" ? etaInMin(ticket.etaPickupAt) : null;
  const dropoffIn = ticket.ticketType === "TOW" ? etaInMin(ticket.etaDropoffAt) : null;
  const previewFresh = towPreview !== null && typeof towPreview.summary === "string" && towPreview.summary !== "" && (ticket.status === "1" || ticket.status === "2" || ticket.status === "3");
  const towerFix = ticket.ticketType === "TOW" && ticket.towerFix !== null && typeof ticket.towerFix === "object" &&
    typeof ticket.towerFix.lat === "number" && typeof ticket.towerFix.lng === "number" ?
    {lat: ticket.towerFix.lat, lng: ticket.towerFix.lng} :
    null;
  const towerMeters = towerFix ? Math.round(distBetween(towerFix, {lat: ticket.lat, lng: ticket.lng})) : null;
  const towerDistance = towerMeters === null ? null : towerMeters < 1000 ? t.shop.radiusM.replace("{n}", String(towerMeters)) : t.shop.radiusKm.replace("{n}", (towerMeters / 1000).toFixed(1));
  const etaPickupText = pickupIn !== null ? t.shop.etaPickup.replace("{n}", String(pickupIn)) : null;
  const etaText = !previewFresh && (etaPickupText !== null || towerDistance !== null)
    ? etaPickupText !== null && towerDistance !== null ? `${towerDistance} · ${etaPickupText}` : etaPickupText
    : null;
  const dropoffEtaText = dropoffIn !== null ? t.shop.etaDropoff.replace("{n}", String(dropoffIn)) : null;
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
  } : destSnap !== null && typeof destSnap.name === "string" && destSnap.name !== "" && (destSnap.kind === "SHOP" || (typeof ticket.destinationShopId === "string" && ticket.destinationShopId !== "")) ? {
    id: typeof destSnap.id === "string" ? destSnap.id : (typeof ticket.destinationShopId === "string" ? ticket.destinationShopId : null),
    name: destSnap.name,
    label: typeof destSnap.label === "string" ? destSnap.label : null,
    avg: null,
    count: null,
    phone: null,
    openNow: typeof (destSnap as {openNow?: unknown}).openNow === "boolean" ? ((destSnap as {openNow?: boolean}).openNow ?? null) : null,
  } : null;
  const isWalkIn = ticket.ticketType === "WALK_IN";
  const walkSnap = ticket.providerSnapshot ?? null;
  const walkSnapLat = walkSnap !== null && typeof walkSnap.lat === "number" ? walkSnap.lat : null;
  const walkSnapLng = walkSnap !== null && typeof walkSnap.lng === "number" ? walkSnap.lng : null;
  const walkShop: DestinationShop | null = isWalkIn ? (party.kind === "SHOP" ? {
    id: party.id,
    name: party.name,
    label: party.label,
    avg: party.ratingAvg,
    count: party.ratingCount,
    phone: party.phone,
    openNow: party.openNow,
  } : walkSnap !== null && typeof walkSnap.name === "string" && walkSnap.name !== "" ? {
    id: typeof walkSnap.id === "string" ? walkSnap.id : null,
    name: walkSnap.name,
    label: null,
    avg: null,
    count: null,
    phone: null,
    openNow: walkSnap.closed === true ? false : walkSnap.closed === false ? true : null,
  } : null) : null;
  const walkLat = isWalkIn ? walkSnapLat ?? party.lat : null;
  const walkLng = isWalkIn ? walkSnapLng ?? party.lng : null;
  const placeHeader = t.assist.pickup;
  const canDeclineDest = canDeclineDestination(ticket.status, role.kind === "destination");
  const canEditDest = onEditDestination !== null && canEditDestination(ticket.direction, ticket.status, ticket.ticketType);
  const estimateAmount = typeof ticket.estimateAmount === "number" ? ticket.estimateAmount : null;
  const estimateNote = typeof ticket.estimateNote === "string" && ticket.estimateNote !== "" ? ticket.estimateNote : null;
  const faultPhotos = usePhotoUrls(ticket.faultPhotos);
  const ticketPhotoPaths = showRequestPhotos && Array.isArray(ticket.photoUrls) ? ticket.photoUrls.filter((path): path is string => typeof path === "string" && path !== "") : [];
  const ticketPhotos = usePhotoUrls(showRequestPhotos ? ticket.photoUrls : null);
  const note = typeof ticket.note === "string" && ticket.note !== "" ? ticket.note : null;
  const description = typeof ticket.description === "string" && ticket.description !== "" ? ticket.description : null;
  const workType = typeof ticket.workType === "string" && ticket.workType !== "" ? ticket.workType : null;
  const fareWaitingFee = ticket.towFare !== null && typeof ticket.towFare === "object" && typeof ticket.towFare.waitingFee === "number" ? ticket.towFare.waitingFee : null;
  const waitingFee = typeof waiting?.waitingFee === "number" ? waiting.waitingFee : typeof ticket.waitingFee === "number" ? ticket.waitingFee : fareWaitingFee;
  const fareWaitingMinutes = ticket.towFare !== null && typeof ticket.towFare === "object" && typeof ticket.towFare.waitingMinutes === "number" ? ticket.towFare.waitingMinutes : null;
  const sinceMinutes = typeof ticket.waitingSince === "string" && ticket.waitingSince !== "" ? Math.max(0, Math.round((Date.now() - Date.parse(ticket.waitingSince)) / 60000)) : null;
  const waitingMinutes = typeof waiting?.waitingMinutes === "number" ? waiting.waitingMinutes : typeof ticket.waitingMinutes === "number" ? ticket.waitingMinutes : fareWaitingMinutes ?? sinceMinutes;
  const showWaiting = (waitingMinutes !== null && waitingMinutes > 0) || (waitingFee !== null && waitingFee > 0);
  const billPayment = bill != null ? (bill.items.find((item) => item.ticketId === ticket.id)?.payment ?? bill.items[0]?.payment ?? null) : null;
  const payMethod = (typeof payment?.method === "string" ? payment.method : typeof ticket.paymentMethod === "string" ? ticket.paymentMethod : null) ?? (typeof billPayment?.method === "string" ? billPayment.method : null);
  const payStatus = (typeof payment?.status === "string" ? payment.status : typeof ticket.paymentStatus === "string" ? ticket.paymentStatus : null) ?? (typeof billPayment?.status === "string" ? billPayment.status : null);
  const towerCancelled = ticket.direction === "out" && typeof ticket.cancelledBy === "string" && ticket.cancelledBy !== "" && !isTerminal(ticket.status);
  const declinedLegs = Array.isArray(ticket.towLegs) ? ticket.towLegs.filter((leg) => typeof leg?.toShopId === "string" && (leg as {toShopId: string}).toShopId !== "") : [];
  const shopDeclinedMid = declinedLegs.length > 0 && !isTerminal(ticket.status);
  const showUnfixable = ticket.unfixable === true;
  const payable = !showUnfixable && !isTerminal(ticket.status);
  const estimateState = estimateStateOf(ticket);
  const showEstimate = estimateAmount !== null && (role.kind === "rider" || role.kind === "destination");
  const destinationMine = role.kind === "destination";
  const canEstimate = onOpenEstimate !== undefined && onOpenEstimate !== null && canSendEstimate(ticket.direction, ticket.ticketType, ticket.status, destinationMine, estimateState);
  const showDisputeAction = onOpenDispute !== undefined && onOpenDispute !== null && role.kind === "rider" && !towerCancelled && !shopDeclinedMid && (canDispute(ticket.status) || canDisputeResolved(ticket));
  const canConfirmCash = ticket.canConfirmCash === true || billPayment?.canConfirmCash === true;
  const canViewBill = role.kind === "rider" || role.kind === "assigned" || role.kind === "destination";
  const previewBusy = towPreview !== null && towPreview.busy;
  const previewError = towPreview !== null && typeof towPreview.error === "string" && towPreview.error !== "" ? towPreview.error : null;
  const previewFare = towPreview !== null && typeof towPreview.fareEstimate === "number" ? towPreview.fareEstimate : null;
  const preview: JourneyPreview | null = towPreview !== null && (previewFresh || previewBusy || previewError !== null || previewFare !== null) ? {
    title: t.assist.towRoutePreview,
    loadingLabel: t.common.loading,
    fareLabel: t.assist.fareEstimate,
    busy: previewBusy,
    error: previewError,
    summary: previewFresh ? towPreview.summary as string : null,
    fareEstimate: previewFare,
  } : null;
  const actions: OverlayAction[] = [];
  if (!inbound && canRate(ticket.status)) {
    actions.push({label: hasRated ? t.rating.editRating : t.assist.rate, tone: "primary", busy, onPress: () => onRate(ticket)});
  }
  if (showDisputeAction && onOpenDispute) {
    actions.push({label: t.assist.disputeTicket, tone: "danger", outline: true, onPress: () => onOpenDispute(ticket)});
  }
  const showCancel = (!inbound && canCancel(ticket.status)) || allowTowerCancel;
  if (showCancel && !confirmCancel) {
    actions.push({label: t.assist.cancel, tone: "danger", outline: true, onPress: () => setConfirmCancel(true)});
  }
  if (showCancel && confirmCancel) {
    actions.push({label: t.assist.keepRequest, tone: "neutral", outline: true, onPress: () => setConfirmCancel(false)});
    actions.push({label: t.assist.confirmCancel, tone: "danger", busy, onPress: () => onConfirmCancel(ticket.id)});
  }
  if (canAccept(role) && !declineOpen) {
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
  if (canSendQuote(ticket.direction, ticket.status, ticket.ticketType, hasShop) && typeof ticket.shopQuotedAmount !== "number") {
    actions.push({label: t.assist.sendQuote, tone: "primary", busy, onPress: () => onOpenQuote(ticket)});
  }
  if (canEditWork(ticket.direction, ticket.status, hasShop, ticket.ticketType)) {
    actions.push({label: t.provider.workDone, tone: "neutral", outline: true, busy, onPress: () => onOpenWork(ticket)});
  }
  const unfixableReady = onMarkUnfixable !== undefined && onMarkUnfixable !== null && ticket.direction === "in" && hasShop && !showUnfixable && canMarkUnfixable(ticket.ticketType, ticket.status);
  if (unfixableReady) {
    actions.push({label: t.assist.unfixableAction, tone: "danger", outline: true, busy, onPress: () => onMarkUnfixable(ticket)});
  }
  if (canApproveQuote(ticket.direction, ticket.status) && (ticket.ticketType === "WALK_IN" || ticket.ticketType === "MECHANIC")) {
    actions.push({label: quoteFunded === true ? t.assist.approveQuote : t.assist.payToApprove, tone: "primary", busy, onPress: () => onApproveQuote(ticket)});
  }
  if (canResolve(ticket.direction, ticket.status)) {
    actions.push({label: t.assist.resolved, tone: "primary", busy, onPress: () => onAdvance(ticket, "4")});
  }
  if ((ticket.ticketType === "TOW" || ticket.ticketType === "SOS") && ticket.direction === "out" && ticket.status === "2") {
    actions.push({label: t.assist.arrived, tone: "primary", busy, onPress: () => onAdvance(ticket, "3")});
  }
  if ((ticket.ticketType === "TOW" || ticket.ticketType === "SOS") && ticket.direction === "out" && ticket.status === "3") {
    actions.push({label: t.assist.resolved, tone: "primary", busy, onPress: () => onAdvance(ticket, "4")});
  }
  if (onNavigateJob) {
    actions.push({label: t.common.routeFromHere, tone: "primary", busy, onPress: () => onNavigateJob(ticket)});
  }
  const formOpen = declineOpen || confirmCancel;
  if (!formOpen && canStartWork(ticket.direction, ticket.status, ticket.ticketType, typeof ticket.shopQuotedAmount === "number", hasShop)) {
    actions.push({label: t.assist.startWork, tone: "primary", busy, onPress: () => onAdvance(ticket, "6")});
  }
  if (!formOpen && canMarkReady(ticket.direction, ticket.status, ticket.ticketType, hasShop)) {
    actions.push({label: t.assist.markReady, tone: "primary", busy, onPress: () => onAdvance(ticket, "7")});
  }
  if (canRateRider(role, ticket.status)) {
    actions.push({label: t.assist.rateRider, tone: "primary", onPress: () => onRateRider(ticket)});
  }
  if (canEstimate) {
    actions.push({label: t.assist.sendEstimate, tone: "neutral", outline: true, onPress: () => onOpenEstimate?.(ticket)});
  }
  if (!formOpen && canDeclineDest) {
    actions.push({label: t.assist.declineDestination, tone: "danger", outline: true, busy, onPress: () => onDeclineDestination(ticket)});
  }
  if (!formOpen && canEditDest && onEditDestination !== null) {
    actions.push({label: t.assist.changeDropOff, tone: "primary", outline: true, busy, onPress: () => onEditDestination(ticket)});
  }
  return (
    <Overlay
      visible
      variant="sheet"
      title={ticketTypeLabel(ticket.ticketType, t)}
      closeLabel={t.common.cancel}
      onClose={onClose}
      actions={actions}
      right={
        <View style={[styles.pill, {backgroundColor: statusPillColor(ticket.status, theme)}]}>
          <Text style={[styles.pillText, {color: onColor(statusPillColor(ticket.status, theme))}]}>{ticketStatusLabel(ticket.status, t)}</Text>
        </View>
      }
    >
      <View style={styles.body}>
        <View style={styles.meta}>
          <Text style={[styles.direction, {color: theme.primary}]} accessibilityLabel={inbound ? t.assist.incoming : t.assist.outgoing}>{inbound ? t.assist.filterIn : t.assist.filterOut}</Text>
          <Text style={[styles.coords, {color: theme.muted}]}>{ticketTypeLabel(ticket.ticketType, t)}{typeof ticket.createdAt === "string" ? ` · ${agoOf(ticket.createdAt, t)}` : ""}</Text>
        </View>
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
        {showUnfixable ? (
          <View style={[styles.banner, {borderColor: theme.danger, backgroundColor: theme.danger}]}>
            <MaterialIcons name="error-outline" size={16} color="#fff" />
            <View style={styles.bannerBody}>
              <Text style={styles.bannerTitle}>{t.assist.unfixableTitle}</Text>
              <Text style={styles.bannerText}>{t.assist.unfixableRefund}</Text>
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
        <JourneyCard
          t={t}
          lang={lang}
          theme={theme}
          ticket={ticket}
          inbound={inbound}
          party={party}
          partyOnPress={showShop ? () => onOpenShop(ticket) : null}
          placeHeader={placeHeader}
          destShop={isWalkIn ? walkShop : destShop}
          destLat={isWalkIn ? walkLat : destLat}
          destLng={isWalkIn ? walkLng : destLng}
          destName={destName}
          destLabel={destLabel}
          onOpenDestination={isWalkIn ? (showShop ? () => onOpenShop(ticket) : null) : () => onOpenDestination(ticket)}
          etaText={etaText}
          dropoffEtaText={dropoffEtaText}
          preview={preview}
          busy={busy}
        />
        {acceptHidden ? (
          <Text style={[styles.coords, {color: theme.muted}]}>{acceptOffDuty ? t.assist.towNotAccepting : t.assist.towAcceptHint}</Text>
        ) : null}
        <NotesPhotosCard
          t={t}
          theme={theme}
          note={note}
          description={description}
          workType={workType}
          showRequestPhotos={showRequestPhotos}
          requestPaths={ticketPhotoPaths}
          requestUrls={ticketPhotos}
          evidenceUrls={faultPhotos}
          right={<StatusHistory t={t} theme={theme} ticket={ticket} />}
          onOpenPhoto={photoViewer.open}
        />
        <FeesCard
          t={t}
          theme={theme}
          ticket={ticket}
          bill={bill ?? null}
          busy={busy}
          payable={payable}
          waitingMinutes={waitingMinutes}
          waitingFee={waitingFee}
          showWaiting={showWaiting}
          estimateAmount={showEstimate ? estimateAmount : null}
          estimateNote={showEstimate ? estimateNote : null}
          estimateState={estimateState}
          onApproveEstimate={onApproveEstimate ?? null}
          onDeclineEstimate={onDeclineEstimate ?? null}
          onApproveFinal={onApproveFinal ?? null}
          payMethod={payMethod}
          payStatus={payStatus}
          onConfirmCash={canConfirmCash ? onConfirmCash ?? null : null}
          onOpenBill={canViewBill ? onOpenBill ?? null : null}
        />
        {linked ? (
          <Pressable style={[styles.linkRow, {borderColor: theme.border}]} onPress={() => onOpenLinked(linked)} accessibilityRole="button" accessibilityLabel={ticketTitle(linked, t)}>
            <MaterialIcons name="link" size={16} color={theme.primary} />
            <Text style={[styles.coords, {color: theme.primary, flex: 1}]}>{ticketTitle(linked, t)}</Text>
            <View style={[styles.pill, {backgroundColor: statusPillColor(linked.status, theme)}]}>
              <Text style={styles.pillText}>{ticketStatusLabel(linked.status, t)}</Text>
            </View>
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
        {photoViewer.node}
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  body: {gap: 12, width: "100%"},
  meta: {gap: 2},
  direction: {fontSize: 12, fontWeight: "700"},
  section: {flexDirection: "row", gap: 8, alignItems: "flex-start"},
  sectionBody: {flex: 1, gap: 2},
  coords: {fontSize: 12},
  label: {fontSize: 13, fontWeight: "700"},
  pill: {borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10},
  pillText: {fontSize: 12, fontWeight: "700"},
  history: {flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto", flexShrink: 1, minWidth: 0},
  historyStep: {flexDirection: "row", alignItems: "center", gap: 4},
  historyLine: {width: 8, height: 2, borderRadius: 1},
  historyDot: {width: 9, height: 9, borderRadius: 4.5, borderWidth: 1.5},
  historyLabel: {fontSize: 12, fontWeight: "700", flexShrink: 1},
  historyTime: {fontSize: 11, flexShrink: 0},
  linkRow: {flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, padding: 10},
  replyRow: {gap: 6, borderWidth: 1, borderRadius: 12, padding: 10},
  form: {gap: 8},
  actionBtn: {borderRadius: 8, padding: 10, alignItems: "center"},
  actionText: {color: "#fff", fontWeight: "700"},
  chipBtn: {borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12},
  chipRow: {flexDirection: "row", gap: 8, flexWrap: "wrap"},
  input: {borderWidth: 1, borderRadius: 8, padding: 10},
  disabled: {opacity: 0.6},
  banner: {flexDirection: "row", gap: 8, borderWidth: 1, borderRadius: 12, padding: 10, alignItems: "flex-start"},
  bannerBody: {flex: 1, gap: 6},
  bannerTitle: {color: "#fff", fontSize: 13, fontWeight: "700"},
  bannerText: {color: "#fff", fontSize: 12},
  bannerRow: {flexDirection: "row", gap: 8, flexWrap: "wrap"},
  bannerBtn: {borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12},
  bannerBtnText: {color: "#fff", fontWeight: "700"},
});
