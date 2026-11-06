import {useEffect, useState} from "react";
import {ActivityIndicator, Pressable, StyleSheet, View} from "react-native";
import {useAppMode} from "../../context/ThemeContext";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text, AppTextInput as TextInput} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import {darkTheme, lightTheme, onColor, type AppTheme} from "../../theme";
import {DECLINE_REASONS, isTerminal, isUnfixableStatus, type DeclineReason, type FeedTicket} from "../../api/dispatch";
import type {Bill} from "../../api/bills";
import type {UserRating} from "../../api/ratings";
import Overlay, {type OverlayAction, type OverlayActionTone} from "../../components/overlay/Overlay";
import {distBetween} from "../navigation/navUtils";
import {timeAgoLabel} from "../hazards/hazardFilter";
import {canAccept, canApproveQuote, canCancel, canCancelSosShop, canConfirmTowReceived, canDeclineDestination, canDispute, canDisputeResolved, canEditDestination, canEditWork, canMarkReady, canMarkUnfixable, canRate, canRateRider, canReportDelay, canResolve, canSendEstimate, canSendQuote, canTowArrive, canTowDeliver, estimateStateOf, returnTowPending, viewerRoleOf, type ViewerRole, type ViewerRoleContext} from "./recordActions";
import {delayReasonLabel} from "./delayReasons";
import {declineReasonLabel, statusPillColor, ticketStatusLabel, ticketTitle, ticketTypeLabel, unfixableReasonLabel} from "./ticketLabels";
import {quoteDeclineReasonLabel, shopDeclineReasonLabel, towerCancelReasonLabel} from "./cancelReasons";
import {directionOf} from "./recordFilter";
import RatingRow from "./RatingRow";
import {resolvePhotoUrl} from "../../services/photos";
import {usePhotoViewer} from "../../components/ui/PhotoViewer";
import {CardHead, DetailCard, partyOf, riderPartyOf} from "./detail/parts";
import JourneyCard, {type DestinationShop} from "./detail/JourneyCard";
import VehicleCard from "./detail/VehicleCard";
import StatusCard from "./detail/StatusCard";
import NotesPhotosCard from "./detail/NotesPhotosCard";
import ServiceWorkCard from "./detail/ServiceWorkCard";
import FeesCard from "./detail/FeesCard";
import PhotoThumb from "../../components/ui/PhotoThumb";
export type TicketPaymentView = {
  method?: string | null;
  status?: string | null;
  checkoutUrl?: string | null;
  id?: string | null;
};

const DELAY_BANNER_COLOR = "#facc15";
const DELAY_BANNER_TEXT = "#111111";

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
  onOpenMobileFix?: ((ticket: FeedTicket) => void) | null;
  onOpenChat?: ((ticket: FeedTicket) => void) | null;
  onDelay?: ((ticket: FeedTicket) => void) | null;
  onClearDelay?: ((ticket: FeedTicket) => void) | null;
  delayBusy?: boolean;
  isAdmin?: boolean;
  onShare?: ((ticket: FeedTicket) => void) | null;
  onQuickFix?: ((ticket: FeedTicket) => void) | null;
  onRelease?: ((ticket: FeedTicket) => void) | null;
  onOfferMobileTow?: ((ticket: FeedTicket) => void) | null;
  canOfferMobileTow?: boolean;
  mobileTowShopOff?: boolean;
  onContinueSos?: ((ticket: FeedTicket) => void) | null;
  onReleaseSos?: ((ticket: FeedTicket) => void) | null;
  onRespondMobileTow?: ((ticket: FeedTicket, accept: boolean) => void) | null;
  onRespondReturnTow?: ((ticket: FeedTicket, accept: boolean) => void) | null;
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
  ownMobileShopId?: string | null;
  roleContext?: ViewerRoleContext;
  showRequestPhotos: boolean;
  onDeclineDestination: (ticket: FeedTicket) => void;
  onEditDestination: ((ticket: FeedTicket) => void) | null;
  allowTowerCancel: boolean;
  onApproveEstimate?: ((ticket: FeedTicket) => void) | null;
  onDeclineEstimate?: ((ticket: FeedTicket) => void) | null;
  onApproveFinal?: ((ticket: FeedTicket) => void) | null;
  onApproveInvoice?: ((ticket: FeedTicket) => void) | null;
  onApproveMobileFix?: ((ticket: FeedTicket) => void) | null;
  onDeclineMobileFix?: ((ticket: FeedTicket) => void) | null;
  onDeclineQuote?: ((ticket: FeedTicket) => void) | null;
  onMarkTowLoaded?: ((ticket: FeedTicket) => void) | null;
  onConfirmTowReceived?: ((ticket: FeedTicket) => void) | null;
  onConfirmCash?: ((ticket: FeedTicket) => void) | null;
  onOpenBill?: ((ticket: FeedTicket) => void) | null;
  onOpenDispute?: ((ticket: FeedTicket) => void) | null;
  onTowerCancel?: ((ticket: FeedTicket) => void) | null;
  onOpenArchivedChat?: ((ticket: FeedTicket, version: number) => void) | null;
  payment?: TicketPaymentView | null;
  waiting?: {waitingMinutes: number; waitingFee: number} | null;
  onMarkUnfixable?: ((ticket: FeedTicket) => void) | null;
  bill?: Bill | null;
  quoteFunded?: boolean;
  quotePayMethod?: string | null;
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

export default function RecordDetailSheet({t, lang, ticket, ratings, busy, uid, hasRated, onClose, onConfirmCancel, onRate, onAccept, onDecline, onOpenWork, onOpenMobileFix, onOpenChat, onDelay, onClearDelay, delayBusy = false, isAdmin = false, onShare, onQuickFix, onRelease, onOfferMobileTow, canOfferMobileTow = false, mobileTowShopOff = false, onContinueSos, onReleaseSos, onRespondMobileTow, onRespondReturnTow, onOpenQuote, onOpenEstimate, onApproveQuote, onOpenShop, onOpenDestination, onNavigateJob, acceptHidden, acceptOffDuty, towPreview, onPreviewTowRoute, linked, onOpenLinked, onAdvance, onReply, onRateRider, ownShopIds, ownTowId, ownMobileShopId, showRequestPhotos, onDeclineDestination, onEditDestination, allowTowerCancel, onApproveEstimate, onDeclineEstimate, onApproveFinal, onApproveInvoice, onApproveMobileFix, onDeclineMobileFix, onDeclineQuote, onMarkTowLoaded, onConfirmTowReceived, onConfirmCash, onOpenBill, onOpenDispute, onTowerCancel, onOpenArchivedChat, payment, waiting, onMarkUnfixable, bill, quoteFunded, quotePayMethod, roleContext}: Props) {
  const scheme = useAppMode();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const inbound = directionOf(ticket) === "in";
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState<DeclineReason>("FULL");
  const [declineNote, setDeclineNote] = useState("");
  const [replyRatingId, setReplyRatingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [linkedSummaryOpen, setLinkedSummaryOpen] = useState(false);
  const photoViewer = usePhotoViewer(t.common.cancel);
  useEffect(() => {
    setLinkedSummaryOpen(false);
  }, [ticket.id]);
  const openPhoto = (path: string): void => {
    void resolvePhotoUrl(path).then((uri) => {
      if (uri !== "") photoViewer.open(uri);
    });
  };
  const baseParty = partyOf(ticket, t.assist.unassigned);
  const riderParty = riderPartyOf(ticket);
  const riderPickup = ticket.ticketType === "SOS" ||
    (ticket.ticketType === "TOW" && ticket.towKind === "RETURN");
  const party = riderPickup && baseParty.kind === null &&
    riderParty !== null ? riderParty : baseParty;
  const hold = ticket.hold ?? null;
  const holdEta = hold !== null && typeof hold.etaAt === "string" ?
    new Date(hold.etaAt).toLocaleTimeString(lang, {hour: "2-digit", minute: "2-digit"}) :
    null;
  const role: ViewerRole = viewerRoleOf(ticket, {ownShopIds, ownTowId, ownMobileShopId: ownMobileShopId ?? null}, roleContext ?? "auto");
  const isDelayReporter = hold !== null && hold.by === uid;
  const canEditDelay = hold === null || isDelayReporter || isAdmin;
  const canClearDelay = onClearDelay !== undefined && onClearDelay !== null &&
    (role.kind === "rider" || role.kind === "assigned") &&
    (isDelayReporter || isAdmin);
  const hasShop = role.kind === "assigned" && role.assignedKind === "SHOP";
  const mobileShopAssigned = ticket.ticketType === "SOS" &&
    ownMobileShopId != null &&
    typeof ticket.assignedShopId === "string" &&
    ticket.assignedShopId === ownMobileShopId;
  const showShop = party.kind === "SHOP" || party.kind === "MOBILE_SHOP";
  const etaInMin = (iso: string | null | undefined): number | null => {
    if (typeof iso !== "string" || iso === "") return null;
    const mins = Math.round((Date.parse(iso) - Date.now()) / 60000);
    return mins > 0 ? mins : null;
  };
  const dropoffIn = ticket.ticketType === "TOW" ? etaInMin(ticket.etaDropoffAt) : null;
  const towerFix = ticket.ticketType === "TOW" && ticket.towerFix !== null && typeof ticket.towerFix === "object" &&
    typeof ticket.towerFix.lat === "number" && typeof ticket.towerFix.lng === "number" ?
    {lat: ticket.towerFix.lat, lng: ticket.towerFix.lng} :
    null;
  const towerMeters = towerFix ? Math.round(distBetween(towerFix, {lat: ticket.lat, lng: ticket.lng})) : null;
  const towerDistance = towerMeters === null ? null : towerMeters < 1000 ? t.shop.radiusM.replace("{n}", String(towerMeters)) : t.shop.radiusKm.replace("{n}", (towerMeters / 1000).toFixed(1));
  const etaText = towerDistance;
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
  const disputeHold = ticket.disputeHold === true;
  const disputeOpen = disputeHold || ticket.dispute?.status === "OPEN";
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
  const faultPhotoPaths = Array.isArray(ticket.faultPhotos) ? ticket.faultPhotos.filter((path): path is string => typeof path === "string" && path !== "") : [];
  const unfixablePhotoPaths = ticket.unfixable && typeof ticket.unfixable === "object" && Array.isArray(ticket.unfixable.photoUrls) ?
    ticket.unfixable.photoUrls.filter((path): path is string => typeof path === "string" && path !== "") :
    [];
  const linkedEvidencePaths = Array.isArray(ticket.linkedSummary?.evidencePhotoUrls) ?
    ticket.linkedSummary.evidencePhotoUrls.filter((path): path is string =>
      typeof path === "string" && path !== "") :
    [];
  const ticketPhotoPaths = showRequestPhotos && Array.isArray(ticket.photoUrls) ? ticket.photoUrls.filter((path): path is string => typeof path === "string" && path !== "") : [];
  const note = typeof ticket.note === "string" && ticket.note !== "" ? ticket.note : null;
  const description = typeof ticket.description === "string" && ticket.description !== "" ? ticket.description : null;
  const workType = typeof ticket.workType === "string" && ticket.workType !== "" ? ticket.workType : null;
  const workItems = Array.isArray(ticket.invoiceItems) && ticket.invoiceItems.length > 0 ?
    ticket.invoiceItems :
    Array.isArray(ticket.quoteItems) ? ticket.quoteItems : [];
  const fareWaitingFee = ticket.towFare !== null && typeof ticket.towFare === "object" && typeof ticket.towFare.waitingFee === "number" ? ticket.towFare.waitingFee : null;
  const waitingFee = typeof waiting?.waitingFee === "number" ? waiting.waitingFee : typeof ticket.waitingFee === "number" ? ticket.waitingFee : fareWaitingFee;
  const billPayment = bill != null ? (bill.items.find((item) => item.ticketId === ticket.id)?.payment ?? null) : null;
  const payMethod = (typeof payment?.method === "string" ? payment.method : typeof ticket.paymentMethod === "string" ? ticket.paymentMethod : null) ?? (typeof billPayment?.method === "string" ? billPayment.method : null);
  const payStatus = (typeof payment?.status === "string" ? payment.status : typeof ticket.paymentStatus === "string" ? ticket.paymentStatus : null) ?? (typeof billPayment?.status === "string" ? billPayment.status : null);
  const formerAssignment = ticket.formerAssignment === true;
  const formerMobile = formerAssignment &&
    ticket.formerAssignmentKind === "MOBILE_SHOP";
  const mobileFeeHistory = Array.isArray(ticket.mobileFeeHistory) ?
    [...ticket.mobileFeeHistory].sort((a, b) =>
      String(b.declinedAt).localeCompare(String(a.declinedAt))) :
    [];
  const mobileDeclineReason = formerMobile ?
    (mobileFeeHistory[0]?.reason ?? null) :
    null;
  const mobileDeclineLabel = typeof mobileDeclineReason === "string" &&
    mobileDeclineReason !== "" ?
    (["PRICE_TOO_HIGH", "WORK_NOT_DONE", "ITEMS_WRONG", "OTHER"]
      .includes(mobileDeclineReason) ?
      quoteDeclineReasonLabel(mobileDeclineReason, t) :
      mobileDeclineReason) :
    null;
  const towerCancelled = !formerAssignment && ticket.direction === "out" && typeof ticket.cancelledBy === "string" && ticket.cancelledBy !== "" && !isTerminal(ticket.status);
  const shopDeclinedMid = !formerAssignment && ticket.destinationDecline != null && !isTerminal(ticket.status);
  const towCancelHistory = Array.isArray(ticket.towCancelHistory) ? ticket.towCancelHistory : [];
  const towCancelReason = towCancelHistory.length > 0 ?
    (towCancelHistory[towCancelHistory.length - 1]?.reasonCode ?? null) :
    null;
  const shopDeclineReason = ticket.destinationDecline?.reasonCode ?? null;
  const chatHistory = Array.isArray(ticket.chatHistory) ?
    [...ticket.chatHistory].sort((a, b) =>
      String(b.at).localeCompare(String(a.at))) :
    [];
  const showUnfixable = ticket.unfixable !== null &&
    ticket.unfixable !== undefined &&
    ticket.unfixable !== false;
  const payable = !disputeHold && (!isTerminal(ticket.status) ||
    (ticket.ticketType === "SOS" && isUnfixableStatus(ticket.status)));
  const estimateState = estimateStateOf(ticket);
  const showEstimate = estimateAmount !== null && (role.kind === "rider" || role.kind === "destination");
  const destinationMine = role.kind === "destination";
  const canEstimate = onOpenEstimate !== undefined && onOpenEstimate !== null && canSendEstimate(ticket.direction, ticket.ticketType, ticket.status, destinationMine, estimateState);
  const showDisputeAction = onOpenDispute !== undefined && onOpenDispute !== null && !disputeOpen && !towerCancelled && !shopDeclinedMid && (role.kind === "rider" || role.kind === "assigned") && (canDispute(ticket.status) || canDisputeResolved(ticket));
  const canConfirmCash = ticket.canConfirmCash === true || billPayment?.canConfirmCash === true;
  const canViewBill = role.kind === "rider" || role.kind === "assigned" || role.kind === "destination";
  const actions: OverlayAction[] = [];
  function iconOf(name: string, tone: OverlayActionTone = "neutral", outline = true): React.ReactNode {
    const color = !outline ? "#fff" : tone === "danger" ? theme.danger : tone === "primary" ? theme.primary : theme.text;
    return <MaterialIcons name={name as never} size={20} color={color} />;
  }
  if (!inbound && canRate(ticket.status)) {
    actions.push({label: hasRated ? t.rating.editRating : t.assist.rate, tone: "primary", busy, iconOnly: true, icon: iconOf("star", "primary", false), onPress: () => onRate(ticket)});
  }
  if (showDisputeAction && onOpenDispute) {
    actions.push({label: t.assist.disputeTicket, tone: "danger", outline: true, iconOnly: true, icon: iconOf("flag", "danger"), onPress: () => onOpenDispute(ticket)});
  }
  const showCancel = (!inbound && canCancel(ticket.status)) || allowTowerCancel || canCancelSosShop(ticket.ticketType, ticket.status, mobileShopAssigned);
  const towerCancelAction = allowTowerCancel && onTowerCancel !== undefined && onTowerCancel !== null ? onTowerCancel : null;
  if (showCancel && !confirmCancel) {
    actions.push({label: t.assist.cancel, tone: "danger", outline: true, iconOnly: true, icon: iconOf("close", "danger"), onPress: () => towerCancelAction !== null ? towerCancelAction(ticket) : setConfirmCancel(true)});
  }
  if (showCancel && confirmCancel && towerCancelAction === null) {
    actions.push({label: t.assist.keepRequest, tone: "neutral", outline: true, iconOnly: true, icon: iconOf("undo"), onPress: () => setConfirmCancel(false)});
    actions.push({label: t.assist.confirmCancel, tone: "danger", busy, iconOnly: true, icon: iconOf("delete", "danger", false), onPress: () => onConfirmCancel(ticket.id)});
  }
  if (canAccept(role) && !declineOpen) {
    if (onDecline && ticket.ticketType === "WALK_IN") {
      actions.push({label: t.provider.decline, tone: "danger", outline: true, iconOnly: true, icon: iconOf("close", "danger"), onPress: () => { setDeclineReason("FULL"); setDeclineNote(""); setDeclineOpen(true); }});
    }
    if (!acceptHidden) {
      actions.push({label: t.assist.accept, tone: "primary", busy, onPress: () => onAccept(ticket)});
    }
    if (towPreview && onPreviewTowRoute) {
      actions.push({label: t.assist.towRoutePreview, tone: "neutral", outline: true, iconOnly: true, icon: iconOf("map"), disabled: !towPreview.ready || towPreview.busy, onPress: () => onPreviewTowRoute(ticket)});
    }
  }
  if (declineOpen && onDecline) {
    actions.push({label: t.provider.decline, tone: "danger", busy, onPress: () => { onDecline(ticket, declineReason, declineNote.trim() || undefined); setDeclineOpen(false); }});
  }
  if (canSendQuote(ticket.direction, ticket.status, ticket.ticketType, hasShop)) {
    actions.push({label: typeof ticket.shopQuotedAmount === "number" ? t.assist.amendQuote : t.assist.sendQuote, tone: "primary", busy, onPress: () => onOpenQuote(ticket)});
  }
  const unfixableReady = onMarkUnfixable !== undefined && onMarkUnfixable !== null && !disputeHold && ticket.direction === "in" && hasShop && !showUnfixable && canMarkUnfixable(ticket.ticketType, ticket.status);
  if (mobileShopAssigned && onOpenMobileFix && ticket.status === "3" && !disputeHold) {
    actions.push({label: t.assist.fixComplete, tone: "primary", busy, onPress: () => onOpenMobileFix(ticket)});
  }
  if (mobileShopAssigned && canOfferMobileTow && ticket.status === "15" &&
    !ticket.continuationTicketId &&
    ticket.mobileTowOffer?.status !== "PENDING" &&
    ticket.mobileTowOffer?.status !== "ACCEPTED" && onOfferMobileTow) {
    actions.push({label: ticket.mobileTowMode === "NETWORK" ? t.assist.requestTow : t.assist.offerTow, tone: "primary", onPress: () => onOfferMobileTow(ticket)});
  }
  if (mobileShopAssigned && ticket.ticketType === "SOS" && ticket.status === "15" &&
    !ticket.continuationTicketId &&
    ticket.mobileTowOffer?.status !== "PENDING" &&
    ticket.mobileTowOffer?.status !== "ACCEPTED" && onReleaseSos) {
    actions.push({label: t.assist.releaseSos, tone: "neutral", outline: true, onPress: () => onReleaseSos(ticket)});
  }
  if (role.kind === "rider" && ticket.ticketType === "SOS" && ticket.status === "15" &&
    !ticket.continuationTicketId &&
    (ticket.mobileTowOffer?.status === "EXPIRED" ||
      ticket.mobileTowOffer?.status === "DECLINED" ||
      !ticket.mobileTowOffer) &&
    onContinueSos) {
    actions.push({label: t.assist.continueSosConfirm, tone: "primary", onPress: () => onContinueSos(ticket)});
  }
  if (role.kind === "rider" && ticket.mobileTowOffer?.status === "PENDING" && onRespondMobileTow) {
    actions.push({label: t.assist.acceptTow, tone: "primary", onPress: () => onRespondMobileTow(ticket, true)});
    actions.push({label: t.assist.declineTow, tone: "danger", outline: true, onPress: () => onRespondMobileTow(ticket, false)});
  }
  if (role.kind === "rider" && returnTowPending(ticket) &&
    (ticket.status === "7" || ticket.status === "15") && onRespondReturnTow) {
    actions.push({label: t.assist.returnTow, tone: "primary", onPress: () => onRespondReturnTow(ticket, true)});
    actions.push({label: t.assist.declineReturnTow, tone: "neutral", outline: true, iconOnly: true, icon: iconOf("close"), onPress: () => onRespondReturnTow(ticket, false)});
  }
  if (onQuickFix && hasShop && role.kind === "assigned" &&
    ticket.status === "2" &&
    (ticket.ticketType === "WALK_IN" || ticket.ticketType === "MECHANIC")) {
    actions.push({label: t.provider.quickFix, tone: "primary", outline: true, onPress: () => onQuickFix(ticket)});
  }
  if (onRelease && role.kind === "assigned" &&
    ["1", "2", "3", "9"].includes(ticket.status) &&
    ticket.ticketType !== "TOW") {
    actions.push({label: t.assist.release, tone: "danger", outline: true, iconOnly: true, icon: iconOf("undo", "danger"), onPress: () => onRelease(ticket)});
  }
  if (onShare && role.kind === "rider" &&
    !["4", "5", "8", "12", "15"].includes(ticket.status)) {
    actions.push({label: t.assist.share, tone: "neutral", outline: true, iconOnly: true, icon: iconOf("share"), onPress: () => onShare(ticket)});
  }
  if (onOpenChat && (role.kind === "rider" || role.kind === "assigned")) {
    actions.push({label: t.chat.open, tone: "neutral", outline: true, iconOnly: true, icon: iconOf("chat-bubble-outline"), onPress: () => onOpenChat(ticket)});
  }
  if (onDelay && canEditDelay &&
    (role.kind === "rider" || role.kind === "assigned") &&
    canReportDelay(ticket.status)) {
    actions.push({label: t.assist.reportDelay, tone: "neutral", outline: true, iconOnly: true, icon: iconOf("schedule"), onPress: () => onDelay(ticket)});
  }
  if (unfixableReady) {
    actions.push({label: t.assist.unfixableAction, tone: "danger", group: "primary", busy, onPress: () => onMarkUnfixable(ticket)});
  }

  if (ticket.direction === "in" && ticket.ticketType === "TOW" &&
    ticket.status === "3" && !ticket.loadedAt && onMarkTowLoaded) {
    actions.push({label: t.assist.loaded, tone: "primary", busy, onPress: () => onMarkTowLoaded(ticket)});
  }
  if (ticket.direction === "out" && ticket.invoiceApproval === "PENDING" &&
    onApproveInvoice) {
    actions.push({label: t.assist.approveInvoice, tone: "primary", busy, onPress: () => onApproveInvoice(ticket)});
  }
  if (canResolve(ticket.direction, ticket.status) && !disputeHold) {
    actions.push({label: t.assist.resolved, tone: "primary", busy, onPress: () => onAdvance(ticket, "4")});
  }
  if (ticket.ticketType === "SOS" && ticket.direction === "out" && ticket.status === "2") {
    actions.push({label: t.assist.arrived, tone: "primary", busy, onPress: () => onAdvance(ticket, "3")});
  }
  if (!disputeHold && ticket.direction === "out" &&
    ticket.ticketType === "SOS" && ticket.status === "3" &&
    typeof ticket.finalAmount === "number") {
    actions.push({label: t.assist.resolved, tone: "primary", busy, onPress: () => onAdvance(ticket, "4")});
  }
  if (canTowArrive(role, ticket.ticketType, ticket.status)) {
    actions.push({
      label: ticket.towKind === "RETURN" ? t.assist.arrivedAtHangar : t.assist.arrivedAtPickup,
      tone: "primary",
      busy,
      onPress: () => onAdvance(ticket, "3"),
    });
  }
  if (canTowDeliver(role, ticket.ticketType, ticket.status, ticket.loadedAt)) {
    actions.push({
      label: ticket.towKind === "RETURN" ? t.assist.deliveredToRider : t.assist.delivered,
      tone: "primary",
      busy,
      onPress: () => onAdvance(ticket, "4"),
    });
  }
  if (canConfirmTowReceived(ticket.direction, ticket.ticketType, ticket.status, ticket.receivedAt) &&
    typeof ticket.deliveredAt === "string" && ticket.deliveredAt !== "" &&
    onConfirmTowReceived) {
    actions.push({
      label: t.assist.confirmReceived,
      tone: "primary",
      busy,
      onPress: () => onConfirmTowReceived(ticket),
    });
  }
  if (onNavigateJob) {
    actions.push({label: t.common.routeFromHere, tone: "neutral", outline: true, iconOnly: true, icon: iconOf("navigation"), busy, onPress: () => onNavigateJob(ticket)});
  }
  const formOpen = declineOpen || confirmCancel;
  if (!formOpen && canMarkReady(ticket.direction, ticket.status, ticket.ticketType, hasShop)) {
    actions.push({label: t.assist.markReady, tone: "primary", busy, onPress: () => onAdvance(ticket, "7")});
  }
  if (canRateRider(role, ticket.status)) {
    actions.push({label: t.assist.rateRider, tone: "primary", iconOnly: true, icon: iconOf("star", "primary", false), onPress: () => onRateRider(ticket)});
  }
  if (canEstimate) {
    actions.push({label: t.assist.sendEstimate, tone: "neutral", outline: true, iconOnly: true, icon: iconOf("request-quote"), onPress: () => onOpenEstimate?.(ticket)});
  }
  if (!formOpen && canDeclineDest) {
    actions.push({label: t.assist.declineDestination, tone: "danger", outline: true, busy, onPress: () => onDeclineDestination(ticket)});
  }
  if (!formOpen && canEditDest && onEditDestination !== null) {
    actions.push({label: t.assist.changeDropOff, tone: "primary", outline: true, iconOnly: true, icon: iconOf("edit-location", "primary"), busy, onPress: () => onEditDestination(ticket)});
  }
  const feeDecision = ticket.direction === "out" && ticket.status === "9" &&
    (ticket.ticketType === "WALK_IN" ||
      ticket.ticketType === "MECHANIC" ||
      (ticket.ticketType === "SOS" &&
        typeof ticket.finalAmount === "number"));
  return (
    <Overlay
      visible
      variant="sheet"
      title={ticketTypeLabel(ticket.ticketType, t, ticket.towKind)}
      closeLabel={t.common.cancel}
      onClose={onClose}
      actions={actions}
      actionLayout={feeDecision ? "confirm" : "ticket"}
      right={
        <View style={styles.headerPills}>
          {dropoffIn !== null ? (
            <View style={[styles.etaPill, {borderColor: theme.border, backgroundColor: theme.paper}]}>
              <MaterialIcons name="storefront" size={13} color={theme.primary} />
              <Text style={[styles.etaPillText, {color: theme.text}]}>{t.shop.etaDropoffPill.replace("{n}", String(dropoffIn))}</Text>
            </View>
          ) : null}
          <View style={[styles.pill, {backgroundColor: statusPillColor(ticket.status, theme)}]}>
            <Text style={[styles.pillText, {color: onColor(statusPillColor(ticket.status, theme))}]}>{ticketStatusLabel(ticket.status, t, {direction: ticket.direction, ticketType: ticket.ticketType})}</Text>
          </View>
        </View>
      }
    >
      <View style={styles.body}>
        <View style={styles.meta}>
          <Text style={[styles.direction, {color: theme.primary}]} accessibilityLabel={inbound ? t.assist.incoming : t.assist.outgoing}>{inbound ? t.assist.filterIn : t.assist.filterOut}</Text>
          <Text style={[styles.coords, {color: theme.muted}]}>{ticketTypeLabel(ticket.ticketType, t, ticket.towKind)}{typeof ticket.createdAt === "string" ? ` · ${agoOf(ticket.createdAt, t)}` : ""}</Text>
        </View>
        {disputeOpen ? (
          <View style={[styles.banner, {borderColor: theme.danger, backgroundColor: theme.danger}]}>
            <MaterialIcons name="flag" size={16} color="#fff" />
            <View style={styles.bannerBody}>
              <Text style={styles.bannerTitle}>{t.assist.disputeUnderReview}</Text>
              <Text style={styles.bannerText}>{disputeHold ? t.assist.disputeUnderReviewHint : t.assist.disputeFiledHint}</Text>
            </View>
          </View>
        ) : null}
        {hold !== null ? (
          <View style={[styles.banner, {borderColor: DELAY_BANNER_COLOR, backgroundColor: DELAY_BANNER_COLOR}]}>
            <MaterialIcons name="schedule" size={16} color={DELAY_BANNER_TEXT} />
            <View style={styles.bannerBody}>
              <Text style={[styles.bannerTitle, {color: DELAY_BANNER_TEXT}]}>{t.assist.delayActive}</Text>
              <Text style={[styles.bannerText, {color: DELAY_BANNER_TEXT}]}>
                {[delayReasonLabel(String(hold.reason), t), hold.note ?? null, holdEta === null ? null : `${t.assist.holdUntil} ${holdEta}`].filter((part): part is string => part !== null && part !== "").join(" · ")}
              </Text>
              {canClearDelay ? (
                <Pressable
                  style={[styles.delayBtn, {borderColor: DELAY_BANNER_TEXT}]}
                  disabled={delayBusy}
                  onPress={() => onClearDelay(ticket)}
                  accessibilityRole="button"
                  accessibilityLabel={t.assist.clearDelay}
                >
                  {delayBusy ? (
                    <ActivityIndicator size="small" color={DELAY_BANNER_TEXT} />
                  ) : (
                    <Text style={[styles.delayBtnText, {color: DELAY_BANNER_TEXT}]}>{t.assist.clearDelay}</Text>
                  )}
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}
        {ticket.invoiceApproval === "PENDING" ? (
          <View style={[styles.banner, {borderColor: theme.primary, backgroundColor: theme.primary}]}>
            <MaterialIcons name="receipt-long" size={16} color="#fff" />
            <View style={styles.bannerBody}>
              <Text style={styles.bannerTitle}>{t.assist.invoicePending}</Text>
              <Text style={styles.bannerText}>{t.assist.invoicePendingHint}</Text>
            </View>
          </View>
        ) : null}
        {formerAssignment ? (
          <View style={[styles.banner, {borderColor: theme.muted, backgroundColor: theme.muted}]}>
            <MaterialIcons name="history" size={16} color="#fff" />
            <View style={styles.bannerBody}>
              <Text style={styles.bannerText}>{formerMobile ?
                `${t.assist.formerFixDeclinedBanner}${mobileDeclineLabel !== null ? ` · ${mobileDeclineLabel}` : ""}` :
                `${t.assist.formerAssignmentBanner}${towCancelReason !== null ? ` · ${towerCancelReasonLabel(towCancelReason, t)}` : ""}`}</Text>
            </View>
          </View>
        ) : null}
        {towerCancelled ? (
          <View style={[styles.banner, {borderColor: theme.danger, backgroundColor: theme.danger}]}>
            <MaterialIcons name="warning" size={16} color="#fff" />
            <View style={styles.bannerBody}>
              <Text style={styles.bannerText}>{`${t.assist.towerCancelMid}${towCancelReason !== null ? ` · ${towerCancelReasonLabel(towCancelReason, t)}` : ""}`}</Text>
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
        {shopDeclinedMid ? (
          <View style={[styles.banner, {borderColor: theme.danger, backgroundColor: theme.danger}]}>
            <MaterialIcons name="warning" size={16} color="#fff" />
            <View style={styles.bannerBody}>
              <Text style={styles.bannerText}>{`${t.assist.shopDeclineMid}${shopDeclineReason !== null ? ` · ${shopDeclineReasonLabel(shopDeclineReason, t)}` : ""}`}</Text>
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
        {ticket.ticketType === "TOW" && Array.isArray(ticket.towFeeHistory) &&
          ticket.towFeeHistory.some((entry) => entry.reasonCode === "TOWER_CANCEL_BREAKDOWN") ? (
            <View style={[styles.banner, {borderColor: theme.danger, backgroundColor: theme.danger}]}>
              <MaterialIcons name="build" size={16} color="#fff" />
              <View style={styles.bannerBody}>
                <Text style={styles.bannerTitle}>{t.assist.towerBreakdown}</Text>
                <Text style={styles.bannerText}>{t.assist.towerBreakdownHint}</Text>
              </View>
            </View>
          ) : null}
        {mobileShopAssigned && ticket.ticketType === "SOS" && ticket.status === "15" &&
          !ticket.continuationTicketId && ticket.mobileTowAvailable !== true &&
          ticket.mobileTowState !== "NONE_NEARBY" ? (
            <Section theme={theme} icon="info-outline">
              <Text style={[styles.coords, {color: theme.muted}]}>{t.assist.towVehicleNotLinked}</Text>
            </Section>
          ) : null}
        {mobileShopAssigned && ticket.ticketType === "SOS" && ticket.status === "15" &&
          !ticket.continuationTicketId && ticket.mobileTowAvailable === true &&
          ticket.mobileTowMode === "NETWORK" ? (
            <Section theme={theme} icon="info-outline">
              <Text style={[styles.coords, {color: theme.muted}]}>
                {ticket.mobileTowState === "TOW_OFF_DUTY" ? t.assist.offerTowNetworkOffDuty :
                  ticket.mobileTowState === "TOW_BUSY" ? t.assist.offerTowNetworkBusy :
                    t.assist.offerTowNetworkNoTow}
              </Text>
            </Section>
          ) : null}
        {mobileShopAssigned && ticket.ticketType === "SOS" && ticket.status === "15" &&
          !ticket.continuationTicketId && mobileTowShopOff ? (
            <Section theme={theme} icon="info-outline">
              <Text style={[styles.coords, {color: theme.muted}]}>{t.assist.offerTowShopOff}</Text>
            </Section>
          ) : null}
        {showUnfixable ? (
          <View style={[styles.banner, {borderColor: theme.danger, backgroundColor: theme.danger}]}>
            <MaterialIcons name="error-outline" size={16} color="#fff" />
            <View style={styles.bannerBody}>
              <Text style={styles.bannerTitle}>{t.assist.unfixableTitle}</Text>
              {ticket.unfixable && typeof ticket.unfixable === "object" && ticket.unfixable.reason ? (
                <Text style={styles.bannerText}>{unfixableReasonLabel(ticket.unfixable.reason, t)}</Text>
              ) : null}
              <Text style={styles.bannerText}>
                {ticket.mobileCallOutWaived === true || ticket.mobileCallOutFee === 0 ?
                  t.assist.unfixableWaived :
                  t.assist.unfixableRefund}
              </Text>
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
        />
        <VehicleCard t={t} theme={theme} ticket={ticket} />
        <StatusCard t={t} theme={theme} ticket={ticket} />
        {chatHistory.length > 0 && onOpenArchivedChat ? (
          <DetailCard theme={theme}>
            <CardHead theme={theme} icon="forum" title={t.chat.previousChats} />
            {chatHistory.slice(0, 3).map((entry) => (
              <Pressable
                key={`${entry.version}-${entry.roomId}`}
                style={[styles.chatArchiveRow, {borderColor: theme.border, backgroundColor: theme.paper}]}
                onPress={() => onOpenArchivedChat(ticket, entry.version)}
                accessibilityRole="button"
                accessibilityLabel={t.chat.previousChat}
              >
                <MaterialIcons name="chat-bubble-outline" size={18} color={theme.primary} />
                <View style={styles.chatArchiveBody}>
                  <Text style={[styles.chatArchiveTitle, {color: theme.text}]} numberOfLines={1}>
                    {`${t.chat.previousChat}${entry.shopName ? ` · ${entry.shopName}` : ""}`}
                  </Text>
                  <Text style={[styles.chatArchiveMeta, {color: theme.muted}]}>
                    {new Date(entry.at).toLocaleString()}
                  </Text>
                </View>
                <View style={[styles.chatArchivePill, {backgroundColor: theme.muted}]}>
                  <Text style={styles.chatArchivePillText}>{t.chat.archived}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={18} color={theme.muted} />
              </Pressable>
            ))}
          </DetailCard>
        ) : null}
        {ticket.linkedSummary ? (
          <Pressable
            style={[styles.linkedCard, {borderColor: theme.border, backgroundColor: theme.paper}]}
            onPress={() => setLinkedSummaryOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`${t.assist.previousSos} · ${t.assist.sosAttempt.replace("{n}", String(ticket.linkedSummary.sosAttempt ?? 1))}`}
          >
            <View style={[styles.linkedIcon, {backgroundColor: theme.danger + "18"}]}>
              <MaterialIcons name="report-problem" size={20} color={theme.danger} />
            </View>
            <View style={styles.linkedRowBody}>
              <View style={styles.linkedTitleRow}>
                <Text style={[styles.linkedRowTitle, {color: theme.text}]}>{t.assist.previousSos}</Text>
                <View style={[styles.linkedAttemptPill, {backgroundColor: theme.border}]}>
                  <Text style={[styles.linkedAttemptText, {color: theme.muted}]}>{t.assist.sosAttempt.replace("{n}", String(ticket.linkedSummary.sosAttempt ?? 1))}</Text>
                </View>
              </View>
              <Text style={[styles.linkedRowMeta, {color: theme.muted}]} numberOfLines={1}>
                {ticket.linkedSummary.unfixableReason ?
                  unfixableReasonLabel(ticket.linkedSummary.unfixableReason, t) :
                  t.assist.previousShopEvidence}
              </Text>
              {linkedEvidencePaths.length > 0 ? (
                <View style={styles.linkedThumbStack}>
                  {linkedEvidencePaths.slice(0, 3).map((path, index) => (
                    <PhotoThumb key={`${path}-${index}`} path={path} theme={theme} style={styles.linkedThumbSmall} />
                  ))}
                  {linkedEvidencePaths.length > 3 ? (
                    <Text style={[styles.linkedRowMeta, {color: theme.muted}]}>+{linkedEvidencePaths.length - 3}</Text>
                  ) : null}
                </View>
              ) : null}
            </View>
            <MaterialIcons name="chevron-right" size={18} color={theme.muted} />
          </Pressable>
        ) : null}
        <NotesPhotosCard
          t={t}
          theme={theme}
          note={note}
          description={description}
          showRequestPhotos={showRequestPhotos}
          requestPaths={ticketPhotoPaths}
          evidencePaths={faultPhotoPaths}
          unfixablePaths={unfixablePhotoPaths}
          loadedPaths={Array.isArray(ticket.loadedPhotos) ? ticket.loadedPhotos : []}
          receivedPaths={Array.isArray(ticket.receivedPhotos) ? ticket.receivedPhotos : []}
          onOpenPhoto={openPhoto}
        />
        <ServiceWorkCard t={t} theme={theme} workType={workType} items={workItems} warrantyRework={typeof ticket.warrantyOfTicketId === "string" && ticket.warrantyOfTicketId !== ""} />
        <FeesCard
          t={t}
          theme={theme}
          ticket={ticket}
          bill={bill ?? null}
          busy={busy}
          payable={payable}
          waitingFee={waitingFee}
          estimateAmount={showEstimate ? estimateAmount : null}
          estimateNote={showEstimate ? estimateNote : null}
          estimateState={estimateState}
          onApproveEstimate={onApproveEstimate ?? null}
          onDeclineEstimate={onDeclineEstimate ?? null}
          onApproveFinal={onApproveFinal ?? null}
          onApproveQuote={onApproveQuote}
          onDeclineQuote={onDeclineQuote ?? null}
          onApproveMobileFix={onApproveMobileFix ?? null}
          onDeclineMobileFix={onDeclineMobileFix ?? null}
          quotePayMethod={quotePayMethod ?? null}
          quoteFunded={quoteFunded}
          payMethod={payMethod}
          payStatus={payStatus}
          onConfirmCash={canConfirmCash ? onConfirmCash ?? null : null}
          onOpenBill={canViewBill ? onOpenBill ?? null : null}
        />
        {linked ? (
          <Pressable style={[styles.linkRow, {borderColor: theme.border}]} onPress={() => onOpenLinked(linked)} accessibilityRole="button" accessibilityLabel={ticketTitle(linked, t)}>
            <MaterialIcons name="link" size={16} color={theme.primary} />
            <Text style={[styles.coords, {color: theme.primary, flex: 1}]}>{ticketTypeLabel(linked.ticketType, t)}</Text>
            <View style={[styles.pill, {backgroundColor: statusPillColor(linked.status, theme)}]}>
              <Text style={[styles.pillText, {color: "#fff"}]}>{ticketStatusLabel(linked.status, t)}</Text>
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
        {ticket.linkedSummary ? (
          <Overlay
            visible={linkedSummaryOpen}
            variant="dialog"
            title={t.assist.previousSos}
            closeLabel={t.common.cancel}
            onClose={() => setLinkedSummaryOpen(false)}
            scrollable={false}
          >
            <View style={styles.linkedSheetBody}>
              <View style={styles.linkedDialogHeader}>
                <View style={[styles.linkedDialogIcon, {backgroundColor: theme.danger + "18"}]}>
                  <MaterialIcons name="report-problem" size={24} color={theme.danger} />
                </View>
                <View style={styles.linkedDialogHeaderBody}>
                  <Text style={[styles.linkedRowTitle, {color: theme.text}]}>{t.assist.unfixableTitle}</Text>
                  <Text style={[styles.linkedRowMeta, {color: theme.muted}]}>{t.assist.sosAttempt.replace("{n}", String(ticket.linkedSummary.sosAttempt ?? 1))}</Text>
                </View>
              </View>
              {ticket.linkedSummary.unfixableReason ? (
                <View style={[styles.linkedReasonBox, {borderColor: theme.border, backgroundColor: theme.paper}]}>
                  <Text style={[styles.linkedRowMeta, {color: theme.muted}]}>{t.assist.linkedReason}</Text>
                  <Text style={[styles.linkedReasonText, {color: theme.text}]}>{unfixableReasonLabel(ticket.linkedSummary.unfixableReason, t)}</Text>
                </View>
              ) : null}
              <View style={styles.linkedEvidenceHeader}>
                <Text style={[styles.linkedRowMeta, {color: theme.muted}]}>{t.assist.previousShopEvidence}</Text>
                <Text style={[styles.linkedRowMeta, {color: theme.muted}]}>{linkedEvidencePaths.length}</Text>
              </View>
              {linkedEvidencePaths.length > 0 ? (
                <View style={styles.linkedEvidenceGrid}>
                  {linkedEvidencePaths.map((path, index) => (
                    <PhotoThumb
                      key={`${path}-${index}`}
                      path={path}
                      theme={theme}
                      style={styles.linkedEvidenceThumb}
                      accessibilityLabel={`${t.assist.previousShopEvidence} ${index + 1}`}
                      onPress={openPhoto}
                    />
                  ))}
                </View>
              ) : (
                <Text style={[styles.linkedRowMeta, {color: theme.muted}]}>{t.assist.previousSosNoEvidence}</Text>
              )}
            </View>
          </Overlay>
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
  linkedCard: {flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 14, padding: 12},
  linkedIcon: {width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center"},
  linkedRowBody: {flex: 1, gap: 3},
  linkedRowTitle: {fontSize: 13, fontWeight: "700"},
  linkedRowMeta: {fontSize: 12},
  linkedTitleRow: {flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap"},
  linkedAttemptPill: {borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8},
  linkedAttemptText: {fontSize: 10, fontWeight: "700"},
  linkedThumbStack: {flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2},
  linkedThumbSmall: {width: 28, height: 28, borderRadius: 6},
  linkedSheetBody: {gap: 12, width: "100%"},
  linkedDialogHeader: {flexDirection: "row", alignItems: "center", gap: 12},
  linkedDialogIcon: {width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center"},
  linkedDialogHeaderBody: {flex: 1, gap: 2},
  linkedReasonBox: {borderWidth: 1, borderRadius: 12, padding: 10, gap: 2},
  linkedReasonText: {fontSize: 14, fontWeight: "600"},
  linkedEvidenceHeader: {flexDirection: "row", alignItems: "center", justifyContent: "space-between"},
  linkedEvidenceGrid: {flexDirection: "row", flexWrap: "wrap", gap: 8},
  linkedEvidenceThumb: {width: "31%", aspectRatio: 1, borderRadius: 10},
  label: {fontSize: 13, fontWeight: "700"},
  headerPills: {flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6, flexWrap: "wrap", maxWidth: "62%"},
  etaPill: {flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8},
  etaPillText: {fontSize: 10, fontWeight: "700"},
  chatArchiveRow: {flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 12, padding: 10},
  chatArchiveBody: {flex: 1, gap: 2},
  chatArchiveTitle: {fontSize: 13, fontWeight: "700"},
  chatArchiveMeta: {fontSize: 11},
  chatArchivePill: {borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8},
  chatArchivePillText: {color: "#fff", fontSize: 10, fontWeight: "700"},
  pill: {borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10},
  pillText: {fontSize: 12, fontWeight: "700"},
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
  delayBtn: {alignSelf: "flex-start", borderWidth: 1, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10},
  delayBtnText: {fontSize: 11, fontWeight: "700"},
  bannerBody: {flex: 1, gap: 6},
  bannerTitle: {color: "#fff", fontSize: 13, fontWeight: "700"},
  bannerText: {color: "#fff", fontSize: 12},
  bannerRow: {flexDirection: "row", gap: 8, flexWrap: "wrap"},
  bannerBtn: {borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12},
  bannerBtnText: {color: "#fff", fontWeight: "700"},
});
