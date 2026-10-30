import {useCallback, useEffect, useRef, useState} from "react";
import {AppState, BackHandler, Keyboard} from "react-native";
import {useAppMode} from "../../context/ThemeContext";


import * as Location from "expo-location";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {useFocusEffect, useIsFocused, useNavigation} from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type {CameraRef} from "@maplibre/maplibre-react-native";
import {safeCameraCall, safeCameraReady} from "../../components/map/safeCamera";
import {acceptTicket, approveFinalQuote, approveEstimate, approveQuote, bustTicketCaches, cancelTicket, confirmCashReceipt, createTicket, declineDestination, declineEstimate, declineTicket, estimateTowFare, feedTickets, fileDispute, getTicket, isTerminal, nearTickets, offerMobileShopTow, continueSos, refreshTowEta, refreshWaiting, reportUnfixable, respondMobileShopTow, respondReturnTow, sendEstimate, sendQuote, setMobileShopFix, updateTicketDestination, updateTicketStatus, updateWorkOrder, DISPATCH_STATUS, type DeclineReason, type DispatchTicket, type FeedTicket, type TicketPayment, type TicketType} from "../../api/dispatch";
import {payeeBills} from "../../api/bills";
import {normalizeVehicleType} from "../../api/vehicles";
import {myProviders, pingProviderLocation, providerRatings, reportProvider, searchProviders, type Provider, type ProviderRating, type ReportReason} from "../../api/providers";
import {ratingsByTicket, replyRating, submitRating, type UserRating} from "../../api/ratings";
import {findRoute, type RouteOption} from "../../api/routes";
import {toMessage, ApiError} from "../../api/client";
import type {Place} from "../../components/place-search";
import {useAuth} from "../../context/AuthContext";
import {useProfile} from "../../context/ProfileContext";
import {useNavSession} from "../../context/NavSessionContext";
import {useStrings} from "../../context/LanguageContext";
import {useBills} from "../../context/BillsContext";
import type {Bill} from "../../api/bills";
import {darkTheme, lightTheme} from "../../theme";






import {ensurePushConfigured, drainDispatchLaunch, subscribeDispatchPush} from "../../services/push";
import {capturePosition, markBeat, useLocationBeat} from "../../services/locationBeats";
import {getFix} from "../../services/geo";
import {ticketStatusLabel} from "./ticketLabels";
import {announcesShopPush, canSeeRequestPhotos} from "./recordActions";
import {vehicleClassOf} from "./vehicleClass";
import {type AssistSection} from "./AssistSectionTabs";





import {fetchShopPlaces} from "../../components/place-search/shopMerge";




import RecordDetailSheet from "./RecordDetailSheet";
import CancelReasonSheet from "./CancelReasonSheet";
import {SHOP_DECLINE_REASONS, TOWER_CANCEL_REASONS, shopDeclineReasonLabel, towerCancelReasonLabel} from "./cancelReasons";




import {type WorkFormMode, type WorkFormValue} from "./WorkSheet";


import {isPhotoPermissionError, takePhoto, uploadPhotoPaths} from "../../services/photos";

import {boundsOf} from "../route/routeGeo";
import {HCMC_CENTER} from "../route/types";
import {shouldRetryCenter} from "../route/cameraIntent";
import {distBetween} from "../navigation/navUtils";




import {hasDropOff, towDestOf, type TowRouteTicket} from "./towDest";
import {isLiveJob, jobRouteKeyFor} from "./jobRoute";

import {checkInAtShop} from "./checkIn";

import {walkMinutes} from "./walkShop";

const ACTIVE_KEY = "roadassist.activeTicket";
const WORKSPACE_KEY = "roadassist.assist.workspace";
const TAB_KEY = "roadassist.assist.tab";

export default function useAssistController() {
  const {t, lang} = useStrings();
  const {token, uid} = useAuth();
  const {bills, dueCount, dueTotal, refresh: refreshBills} = useBills();
  const {activeVehicle, activateVehicle, bundle, hasVehicle} = useProfile();
  const [ownProviders, setOwnProviders] = useState<Provider[]>([]);
  const provider = ownProviders.some((p) =>
    (p.kind === "TOW" || p.kind === "MOBILE_SHOP") &&
    p.status === "ACTIVE");
  const scheme = useAppMode();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation() as unknown as {navigate: (name: string, params?: Record<string, unknown>) => void; setOptions: (options: {title?: string; headerShown?: boolean}) => void};
  const cameraRef = useRef<CameraRef | null>(null);
  const mapReadyRef = useRef(false);
  const mapFocusedRef = useRef(false);
  useEffect(() => () => {
    mapReadyRef.current = false;
  }, []);
  const centeredRef = useRef(false);
  const pendingCenterRef = useRef<{lat: number; lng: number} | null>(null);
  const [ticketType, setTicketType] = useState<TicketType | null>(null);
  const [note, setNote] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photosBusy, setPhotosBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [towDestError, setTowDestError] = useState<string | null>(null);
  const [disputeFor, setDisputeFor] = useState<FeedTicket | null>(null);
  const [disputeBusy, setDisputeBusy] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);
  const [estimateFor, setEstimateFor] = useState<FeedTicket | null>(null);
  const [estimateBusy, setEstimateBusy] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [unfixableFor, setUnfixableFor] = useState<FeedTicket | null>(null);
  const [unfixableBusy, setUnfixableBusy] = useState(false);
  const [unfixableError, setUnfixableError] = useState<string | null>(null);
  const [cancelReasonFor, setCancelReasonFor] = useState<{ticket: FeedTicket; kind: "TOWER" | "SHOP"} | null>(null);
  const [cancelReasonBusy, setCancelReasonBusy] = useState(false);
  const [cancelReasonError, setCancelReasonError] = useState<string | null>(null);
  const [workFor, setWorkFor] = useState<{ticket: FeedTicket; mode: WorkFormMode} | null>(null);
  const [mobileFixFor, setMobileFixFor] = useState<FeedTicket | null>(null);
  const [mobileFixBusy, setMobileFixBusy] = useState(false);
  const [mobileFixError, setMobileFixError] = useState<string | null>(null);
  const [chatFor, setChatFor] = useState<FeedTicket | null>(null);
  const [chatArchiveFor, setChatArchiveFor] = useState<{ticket: FeedTicket; version: number} | null>(null);
  const arrivedHintRef = useRef<Set<string>>(new Set());
  const [towOfferAcceptFor, setTowOfferAcceptFor] = useState<FeedTicket | null>(null);
  const [continuationFor, setContinuationFor] = useState<{ticket: FeedTicket; nextAttempt: number; callOutTotal: number} | null>(null);
  const [continuationBusy, setContinuationBusy] = useState(false);
  const [continuationError, setContinuationError] = useState<string | null>(null);
  const [workBusy, setWorkBusy] = useState(false);
  const [workError, setWorkError] = useState<string | null>(null);
  const [payments, setPayments] = useState<Record<string, TicketPayment>>({});
  const [waiting, setWaiting] = useState<Record<string, {waitingMinutes: number; waitingFee: number}>>({});
  const [dest, setDest] = useState<Place | null>(null);
  const [destShopId, setDestShopId] = useState<string | null>(null);
  const [mapSel, setMapSel] = useState<{label: string; lat: number; lng: number} | null>(null);
  const [shopSearchMode, setShopSearchMode] = useState<"browse" | "tow" | null>(null);
  const [mapSearchFrom, setMapSearchFrom] = useState<"browse" | "tow" | null>(null);
  const [mine, setMine] = useState<DispatchTicket[]>([]);
  const [feed, setFeed] = useState<FeedTicket[]>([]);
  const [payeeBillList, setPayeeBillList] = useState<Bill[]>([]);
  const [ticketRatings, setTicketRatings] = useState<Record<string, UserRating[]>>({});
  const [recBusy, setRecBusy] = useState(false);
  const [detailFor, setDetailFor] = useState<FeedTicket | null>(null);
  const [detailContext, setDetailContext] = useState<"shop" | "tow">("shop");
  const [boardDetail, setBoardDetail] = useState<FeedTicket | null>(null);
  const [editDestFor, setEditDestFor] = useState<FeedTicket | null>(null);
  const [duplicateFor, setDuplicateFor] = useState<{ticketId: string; reason?: string} | null>(null);
  const [towPreview, setTowPreview] = useState<{ticketId: string; route: RouteOption | null; fareEstimate: number | null; busy: boolean; error: string | null} | null>(null);
  const [towPreviewMap, setTowPreviewMap] = useState(false);
  const [jobRoute, setJobRoute] = useState<{ticketId: string; key: string; route: RouteOption | null} | null>(null);
  const [jobRouteRetry, setJobRouteRetry] = useState(0);
  useEffect(() => {
    setDetailFor((prev) => {
      if (!prev) return prev;
      return feed.find((t) => t.id === prev.id) ?? prev;
    });
    setBoardDetail((prev) => {
      if (!prev) return prev;
      return feed.find((t) => t.id === prev.id) ?? prev;
    });
  }, [feed]);
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [nearbyTow, setNearbyTow] = useState<DispatchTicket[]>([]);
  const [nearbySos, setNearbySos] = useState<DispatchTicket[]>([]);
  const [gps, setGps] = useState<{lat: number; lng: number} | null>(null);
  const [towLocationMissing, setTowLocationMissing] = useState(false);
  const [active, setActive] = useState<DispatchTicket | null>(null);
  const [reportFor, setReportFor] = useState<{id: string; name: string} | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason>("FAKE_BUSINESS");
  const [reportNote, setReportNote] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const towOnDuty = ownProviders.some((item) => item.kind === "TOW" && item.status === "ACTIVE" && item.accepting !== false && item.suspended !== true);
  const ownTowId = ownProviders.find((item) => item.kind === "TOW" && item.status === "ACTIVE")?.id ?? null;
  const ownMobileShopId = ownProviders.find((item) => item.kind === "MOBILE_SHOP" && item.status === "ACTIVE")?.id ?? null;
  const mobileShopOnDuty = ownProviders.some((item) => item.kind === "MOBILE_SHOP" && item.status === "ACTIVE" && item.accepting !== false && item.suspended !== true);
  const ownShopProviderId = ownProviders.find((item) => item.kind === "SHOP" && item.status === "ACTIVE")?.id ?? null;
  const ownShopProvider = ownShopProviderId === null ? null :
    ownProviders.find((item) => item.id === ownShopProviderId) ?? null;
  const ownShopAccepting = ownShopProvider !== null &&
    ownShopProvider.status === "ACTIVE" &&
    ownShopProvider.suspended !== true &&
    ownShopProvider.accepting !== false;
  const storedFeed: FeedTicket | null = active ?
    feed.find((entry) => entry.id === active.id) ??
      ({...active, direction: active.userId === uid ? "out" : "in"} as FeedTicket) :
    null;
  const ownLiveTow = storedFeed === null ? feed.find((t) => t.direction === "out" && t.ticketType === "TOW" && (t.status === "2" || t.status === "3")) ?? null : null;
  const ownLiveSos = storedFeed === null ? feed.find((t) => t.direction === "out" && t.ticketType === "SOS" && (t.status === "2" || t.status === "3" || t.status === "7")) ?? null : null;
  const providerLiveJob = feed.find((t) =>
    t.direction === "in" &&
    ((t.ticketType === "TOW" && ownTowId !== null && t.assignedShopId === ownTowId && (t.status === "2" || t.status === "3")) ||
      (t.ticketType === "SOS" && ownMobileShopId !== null && t.assignedShopId === ownMobileShopId && (t.status === "2" || t.status === "3" || t.status === "7")))) ?? null;
  const activeFeed: FeedTicket | null = storedFeed ?? ownLiveTow ?? ownLiveSos ?? providerLiveJob;
  const needsDropOff = activeFeed === null ? feed.find((t) => t.direction === "out" && t.ticketType === "TOW" && t.status === "1" && towDestOf(t) === null) ?? null : null;
  const pendingOwnTow = activeFeed === null && needsDropOff === null ? feed.find((t) => t.direction === "out" && t.ticketType === "TOW" && t.status === "1" && towDestOf(t) !== null) ?? null : null;
  const pendingOwnSos = activeFeed === null && needsDropOff === null && pendingOwnTow === null ? feed.find((t) => t.direction === "out" && t.ticketType === "SOS" && t.status === "1" && typeof t.sosAttempt === "number" && t.sosAttempt > 1) ?? null : null;
  const ownShopIds = new Set(ownProviders.filter((item) => item.kind === "SHOP" && item.status !== "DENIED").map((item) => item.id));
  const billForTicket = (ticket: FeedTicket): Bill | null => {
    const source = ticket.direction === "out" ? bills : payeeBillList;
    const direct = source.find((row) => row.ticketId === ticket.id);
    if (direct) return direct;
    return source.find((row) => row.items.some((item) => item.ticketId === ticket.id)) ?? null;
  };
  const hasShopRole = (ticket: FeedTicket): boolean =>
    [ticket.assignedShopId, ticket.providerId, ticket.destinationShopId].some((id) => typeof id === "string" && id !== "" && ownShopIds.has(id));
  const isTowRequest = (ticket: FeedTicket): boolean =>
    ticket.ticketType === "TOW" &&
    ticket.status === "1" &&
    ticket.direction === "in" &&
    ownTowId !== null &&
    ticket.providerId === ownTowId;
  const isOwnTowJob = (ticket: FeedTicket): boolean =>
    ticket.ticketType === "TOW" &&
    ownTowId !== null &&
    ticket.assignedShopId === ownTowId;
  const towRequests = feed.filter(isTowRequest);
  const towJobs = feed.filter((ticket) => isOwnTowJob(ticket) && !towRequests.some((request) => request.id === ticket.id));
  const riderRecords = feed.filter((ticket) => ticket.direction === "out");
  const providerRecords = feed.filter((ticket) => ticket.direction === "in");
  const nearbyOnly = nearbyTow.filter((ticket) => !towRequests.some((request) => request.id === ticket.id) && !towJobs.some((job) => job.id === ticket.id));
  function pendingDropName(ticket: FeedTicket): string {
    const party = ticket.destinationParty as {name?: unknown} | null | undefined;
    if (party && typeof party.name === "string" && party.name !== "") return party.name;
    const snap = ticket.destinationSnapshot;
    if (snap && typeof snap.name === "string" && snap.name !== "") return snap.name;
    if (snap && typeof snap.label === "string" && snap.label !== "") return snap.label;
    const point = ticket.destinationPoint;
    if (point && typeof point.label === "string" && point.label !== "") return point.label;
    return t.assist.dropOffPoint;
  }
  const liveTow = isLiveJob(activeFeed);
  const liveTowNoDest = liveTow && activeFeed !== null &&
    activeFeed.ticketType === "TOW" && !hasDropOff(activeFeed);
  const liveTowNoDestOut = liveTowNoDest && activeFeed !== null && activeFeed.direction === "out";
  const liveTowTone = liveTowNoDest ? "#f59e0b" : theme.primary;
  const activeName = activeFeed !== null && typeof activeFeed.otherParty === "object" && activeFeed.otherParty !== null && typeof activeFeed.otherParty.name === "string" ?
    activeFeed.otherParty.name :
    t.assist.unassigned;
  const activeEta = activeFeed !== null && activeFeed.ticketType === "TOW" && typeof activeFeed.etaPickupAt === "string" ?
    Math.round((Date.parse(activeFeed.etaPickupAt) - Date.now()) / 60000) :
    null;
  function activeJobLine(): string {
    if (activeFeed !== null && activeFeed.ticketType === "SOS") {
      const status = ticketStatusLabel(activeFeed.status, t);
      const point = activeFeed.direction === "in" ?
        (gps !== null ? {lat: activeFeed.lat, lng: activeFeed.lng} : null) :
        (activeFeed.mobileShopFix && gps !== null ?
          {lat: activeFeed.mobileShopFix.lat, lng: activeFeed.mobileShopFix.lng} :
          null);
      if (point !== null && gps !== null) {
        const meters = Math.round(distBetween(gps, point));
        const distance = meters < 1000 ?
          t.shop.radiusM.replace("{n}", String(meters)) :
          t.shop.radiusKm.replace("{n}", (meters / 1000).toFixed(1));
        return `${activeName} · ${distance} · ${status}`;
      }
      return `${activeName} · ${status}`;
    }
    const dest = activeFeed !== null && activeFeed.ticketType === "TOW" ? towDestOf(activeFeed) : null;
    if (activeFeed !== null && activeFeed.status === "3" && dest !== null && gps !== null) {
      const meters = Math.round(distBetween(gps, dest));
      const distance = meters < 1000 ? t.shop.radiusM.replace("{n}", String(meters)) : t.shop.radiusKm.replace("{n}", (meters / 1000).toFixed(1));
      const dropEta = typeof activeFeed.etaDropoffAt === "string" ?
        Math.round((Date.parse(activeFeed.etaDropoffAt) - Date.now()) / 60000) :
        null;
      if (dropEta !== null && dropEta > 0) {
        return `${activeName} · ${distance} · ~${t.shop.walkMinutesShort.replace("{n}", String(dropEta))}`;
      }
      return `${activeName} · ${distance}`;
    }
    const towerMeters = activeFeed !== null && activeFeed.ticketType === "TOW" && activeFeed.towerFix !== null && typeof activeFeed.towerFix === "object" &&
      typeof activeFeed.towerFix.lat === "number" && typeof activeFeed.towerFix.lng === "number" ?
      Math.round(distBetween(activeFeed.towerFix, {lat: activeFeed.lat, lng: activeFeed.lng})) :
      null;
    const towerDistance = towerMeters === null ? null : towerMeters < 1000 ? t.shop.radiusM.replace("{n}", String(towerMeters)) : t.shop.radiusKm.replace("{n}", (towerMeters / 1000).toFixed(1));
    if (activeEta !== null && activeEta > 0) {
      const eta = `~${t.shop.walkMinutesShort.replace("{n}", String(activeEta))}`;
      return towerDistance !== null ? `${activeName} · ${towerDistance} · ${eta}` : `${activeName} · ${eta}`;
    }
    return activeName;
  }
  const mobileShopFixPoint = activeFeed?.mobileShopFix &&
    typeof activeFeed.mobileShopFix.lat === "number" &&
    typeof activeFeed.mobileShopFix.lng === "number" ?
    {lat: activeFeed.mobileShopFix.lat, lng: activeFeed.mobileShopFix.lng} :
    null;
  const sosProviderPoint = activeFeed?.ticketType === "SOS" ?
    (activeFeed.direction === "in" ? gps : mobileShopFixPoint) :
    null;
  const jobLayers = liveTow && activeFeed ? {
    provider: activeFeed.ticketType === "SOS" ?
      sosProviderPoint :
      activeFeed.direction === "out" ?
        (activeFeed.towerFix ? {lat: activeFeed.towerFix.lat, lng: activeFeed.towerFix.lng} : null) :
        gps,
    providerKind: activeFeed.ticketType === "SOS" ? "mobileShop" as const : "tow" as const,
    pickup: {lat: activeFeed.lat, lng: activeFeed.lng},
    showPickup: activeFeed.direction === "in" && (gps === null || distBetween(gps, {lat: activeFeed.lat, lng: activeFeed.lng}) > 30),
    dest: activeFeed.ticketType === "TOW" ? towDestOf(activeFeed) : null,
    status: activeFeed.status,
    route: jobRoute && jobRoute.ticketId === activeFeed.id ? jobRoute.route : null,
  } : null;
  const jobRouteKey = jobRouteKeyFor(activeFeed, sosProviderPoint);
  useEffect(() => {
    if (!jobRouteKey || !liveTow || !activeFeed || !token) {
      if (!jobRouteKey) setJobRoute(null);
      return;
    }
    if (jobRoute && jobRoute.ticketId === activeFeed.id &&
      jobRoute.key === jobRouteKey && jobRoute.route !== null) return;
    const ticket = activeFeed;
    const key = jobRouteKey;
    let alive = true;
    if (ticket.ticketType === "SOS" && ticket.status === "7") {
      setJobRoute({ticketId: ticket.id, key, route: null});
      return;
    }
    const routePromise = ticket.ticketType === "SOS" ?
      (sosProviderPoint === null ? Promise.resolve(null) :
        findRoute({
          originLat: sosProviderPoint.lat,
          originLng: sosProviderPoint.lng,
          destLat: ticket.lat,
          destLng: ticket.lng,
          width: activeVehicle?.baseWidth,
          vehicleType: normalizeVehicleType(activeVehicle?.type) ?? undefined,
        }, token).then((res) => res.routes?.[0] ?? null)) :
      fetchTowRoute(ticket, ticket.status === "3");
    const sosFallback = (): RouteOption | null =>
      ticket.ticketType === "SOS" && sosProviderPoint !== null ?
        {
          source: "fallback",
          geometry: {
            type: "LineString",
            coordinates: [
              [sosProviderPoint.lng, sosProviderPoint.lat],
              [ticket.lng, ticket.lat],
            ],
          },
        } :
        null;
    void routePromise.then((route) => {
      if (!alive) return;
      const next = route ?? sosFallback();
      setJobRoute({ticketId: ticket.id, key, route: next});
      if (next) {
        const b = boundsOf(next.geometry.coordinates);
        if (b) {
          safeCameraReady(mapReadyRef.current && mapFocusedRef.current, () => cameraRef.current?.fitBounds([b.sw[0], b.sw[1], b.ne[0], b.ne[1]], {padding: {top: 80, right: 60, bottom: 340, left: 60}, duration: 800}));
        }
      }
    }).catch(() => {
      if (alive) setJobRoute({ticketId: ticket.id, key, route: sosFallback()});
    });
    return () => {
      alive = false;
    };
  }, [jobRouteKey, token, activeFeed?.id, activeVehicle?.baseWidth, activeVehicle?.type, jobRouteRetry]);
  useEffect(() => {
    if (!token || !liveTow || !jobRouteKey || jobRoute?.route || !activeFeed) return;
    if (activeFeed.ticketType === "SOS" && activeFeed.status === "7") return;
    const originReady = activeFeed.ticketType === "SOS" ?
      sosProviderPoint !== null :
      activeFeed.direction === "in" ? gps !== null : activeFeed.towerFix !== null;
    if (!originReady) return;
    const timer = setTimeout(() => setJobRouteRetry((value) => value + 1), 10000);
    return () => clearTimeout(timer);
  }, [token, liveTow, jobRouteKey, jobRoute?.route, activeFeed?.id, activeFeed?.ticketType, activeFeed?.direction, activeFeed?.status, activeFeed?.towerFix?.lat, activeFeed?.towerFix?.lng, sosProviderPoint?.lat, sosProviderPoint?.lng, gps?.lat, gps?.lng]);
  const assistFocused = useIsFocused();
  useEffect(() => {
    mapFocusedRef.current = assistFocused;
  }, [assistFocused]);
  const [cardCollapsed, setCardCollapsed] = useState(false);
  const hasJobCard = (liveTow && activeFeed !== null) || needsDropOff !== null || pendingOwnTow !== null || pendingOwnSos !== null;
  useEffect(() => {
    setCardCollapsed(hasJobCard);
  }, [hasJobCard]);
  useEffect(() => {
    if (hasJobCard && cardCollapsed) setCardH(0);
  }, [hasJobCard, cardCollapsed]);
  useLocationBeat(!!token && (towOnDuty || mobileShopOnDuty) && assistFocused, active ? 60 * 1000 : 5 * 60 * 1000, async () => {
    if (!token) return;
    const pos = await capturePosition();
    if (!pos) return;
    setGps(pos);
    await pingProviderLocation(pos.lat, pos.lng, token);
    markBeat("tower");
  });
  async function onReport(): Promise<void> {
    if (!token || !reportFor || reportBusy) return;
    setReportBusy(true);
    setReportError(null);
    try {
      await reportProvider({providerId: reportFor.id, reason: reportReason, ...(reportNote.trim() ? {note: reportNote.trim()} : {})}, token);
      setReportFor(null);
      setReportNote("");
      setNotice(t.report.filed);
    } catch (err) {
      setReportError(toMessage(err));
    } finally {
      setReportBusy(false);
    }
  }
  const [radius, setRadius] = useState(1000);
  const [towRadius, setTowRadius] = useState(5000);
  const [radiusSearchFrom, setRadiusSearchFrom] = useState<"browse" | "tow" | null>(null);
  const [closingWarn, setClosingWarn] = useState<{
    shop: Provider;
    walk: boolean;
    route: RouteOption;
    seed: {lat: number; lng: number} | null;
    etaMin: number;
    closesIn: number;
  } | null>(null);
  function closeShopSheet(): void {
    setShopSheet(null);
  }
  function closingSoon(shop: Provider, durationSeconds: number | null | undefined): {etaMin: number; closesIn: number} | null {
    if (typeof durationSeconds !== "number" || typeof shop.closesInMinutes !== "number") return null;
    const etaMin = Math.max(1, Math.round(durationSeconds / 60));
    if (etaMin <= shop.closesInMinutes) return null;
    return {etaMin, closesIn: shop.closesInMinutes};
  }
  const [shopSel, setShopSel] = useState<Provider | null>(null);
  const [shopSheet, setShopSheet] = useState<Provider | null>(null);
  const [shopJobs, setShopJobs] = useState<Record<string, number>>({});
  const [shopReviews, setShopReviews] = useState<Record<string, ProviderRating[]>>({});
  const [walkRoute, setWalkRoute] = useState<RouteOption | null>(null);
  const [walkBusy, setWalkBusy] = useState(false);
  const [navBusy, setNavBusy] = useState(false);
  const {start: startNavSession, checkedIn, setCheckedIn, navEnded, setNavEnded} = useNavSession();
  const [reqBusy, setReqBusy] = useState(false);
  const [pendingTicket, setPendingTicket] = useState<TicketType | null>(null);
  const prevTicketType = useRef<TicketType | null>(null);
  const [loading, setLoading] = useState(false);
  const [locateBusy, setLocateBusy] = useState(false);
  const [section, setSection] = useState<AssistSection>("request");
  const [workspace, setWorkspace] = useState<"rider" | "provider">("rider");
  const workspaceTouchedRef = useRef(false);
  const isRider = (bundle?.user.services ?? []).includes("RIDER");
  useEffect(() => {
    if (provider) setWorkspace("provider");
  }, [provider]);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const saved = await AsyncStorage.getItem(WORKSPACE_KEY).catch(() => null);
      const savedTab = await AsyncStorage.getItem(TAB_KEY).catch(() => null);
      if (!alive) return;
      if (savedTab === "request" || savedTab === "records") {
        setSection(savedTab);
      }
      if (!isRider && provider) {
        setWorkspace("provider");
        return;
      }
      if (!provider) {
        setWorkspace("rider");
        return;
      }
      if (saved === "rider") setWorkspace("rider");
      else setWorkspace(provider ? "provider" : "rider");
    })();
    return () => {
      alive = false;
    };
  }, [isRider, provider]);
  useEffect(() => {
    if (!workspaceTouchedRef.current) return;
    void AsyncStorage.setItem(WORKSPACE_KEY, workspace).catch(() => undefined);
  }, [workspace]);
  useEffect(() => {
    void AsyncStorage.setItem(TAB_KEY, section).catch(() => undefined);
  }, [section]);
  const [query, setQuery] = useState("");
  const [imHereBusy, setImHereBusy] = useState(false);
  const [ratingFor, setRatingFor] = useState<DispatchTicket | null>(null);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [ratingRider, setRatingRider] = useState(false);
  const [ratedScores, setRatedScores] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cardH, setCardH] = useState(0);
  useEffect(() => {
    const ticket = activeFeed;
    if (!ticket || ticket.direction !== "out" || ticket.status !== "2") return;
    if (arrivedHintRef.current.has(ticket.id)) return;
    const fix = ticket.ticketType === "SOS" ? ticket.mobileShopFix : ticket.towerFix;
    if (!fix || typeof fix.lat !== "number" || typeof fix.lng !== "number") return;
    const seenAt = typeof fix.at === "string" ? Date.parse(fix.at) : NaN;
    if (Number.isNaN(seenAt) || Date.now() - seenAt > 15 * 60 * 1000) return;
    if (distBetween(fix, {lat: ticket.lat, lng: ticket.lng}) > 200) return;
    arrivedHintRef.current.add(ticket.id);
    setNotice(t.assist.arrivedNearby);
  }, [activeFeed, t.assist.arrivedNearby]);
  const vehicleClass = vehicleClassOf(activeVehicle?.type);
  const showShops = vehicleClass !== "CAR";
  const browsing = workspace === "rider" && section === "request" && ticketType === "MECHANIC" && showShops;

  function openBadge(shop: Provider): {label: string; color: string} {
    if (shop.openNow === true) return {label: t.shop.open, color: theme.primary};
    if (shop.openNow === false) return {label: t.shop.closed, color: theme.danger};
    return {label: t.shop.unknownHours, color: theme.muted};
  }
  function applyCenter(): boolean {
    const pending = pendingCenterRef.current;
    const cam = cameraRef.current;
    if (!pending || !cam) return false;
    pendingCenterRef.current = null;
    centeredRef.current = true;
    safeCameraCall(() => cam.setStop({center: [pending.lng, pending.lat], zoom: 15, duration: 800}));
    return true;
  }
  async function centerOnLocal(): Promise<void> {
    for (let attempt = 0; shouldRetryCenter(centeredRef.current, attempt, 3); attempt++) {
      if (attempt > 0) await new Promise<void>((resolve) => setTimeout(resolve, 4000));
      try {
        const {status} = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") {
          pendingCenterRef.current = {lat: HCMC_CENTER[1] ?? 10.7626, lng: HCMC_CENTER[0] ?? 106.6602};
          applyCenter();
          return;
        }
        if (!pendingCenterRef.current) {
          try {
            pendingCenterRef.current = await getFix();
          } catch {}
        }
        if (applyCenter()) return;
      } catch {}
    }
    if (!centeredRef.current && !pendingCenterRef.current) {
      pendingCenterRef.current = {lat: HCMC_CENTER[1] ?? 10.7626, lng: HCMC_CENTER[0] ?? 106.6602};
      if (!applyCenter()) setError(t.route.locationUnavailable);
    }
  }
  useEffect(() => {
    if (centeredRef.current) return;
    void centerOnLocal();
  }, []);
  function fitWalk(route: RouteOption): void {
    const b = boundsOf(route.geometry.coordinates);
    if (b) safeCameraReady(mapReadyRef.current && mapFocusedRef.current, () => cameraRef.current?.fitBounds([b.sw[0], b.sw[1], b.ne[0], b.ne[1]], {padding: {top: 80, right: 60, bottom: 340, left: 60}, duration: 800}));
  }
  const loadActive = useCallback(async (id: string | null, key: string | null): Promise<void> => {
    if (!key || !id) {
      setActive(null);
      return;
    }
    try {
      const ticket = await getTicket(id, key);
      if (ticket.status === "2" || ticket.status === "3" || ticket.status === "6" || ticket.status === "7") {
        setActive(ticket);
      } else {
        setActive(null);
        await AsyncStorage.removeItem(ACTIVE_KEY).catch(() => undefined);
      }
    } catch {
      setActive(null);
    }
  }, []);
  const reloadAll = useCallback(async (): Promise<void> => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      const granted = perm.status === "granted";
      let pos: {lat: number; lng: number} | null = null;
      if (granted) {
        try {
          pos = await getFix();
          setGps(pos);
          if (!centeredRef.current) {
            pendingCenterRef.current = pos;
            applyCenter();
          }
        } catch {
          pos = null;
        }
      }
      const [fetched, feedList, payeeList] = await Promise.all([
        myProviders(token).catch((): Provider[] => []),
        feedTickets(undefined, token).catch((): FeedTicket[] => []),
        payeeBills(token).catch((): Bill[] => []),
      ]);
      setFeed(feedList);
      setOwnProviders(fetched);
      setPayeeBillList(payeeList);
      const activeTow = fetched.some((item) => item.kind === "TOW" && item.status === "ACTIVE");
      const activeMobileShop = fetched.some((item) => item.kind === "MOBILE_SHOP" && item.status === "ACTIVE" && item.accepting !== false);
      const gate = activeTow || activeMobileShop;
      if (gate) {
        if (!granted) {
          setTowLocationMissing(false);
          throw new Error(t.nav.locationDenied);
        }
        if (pos) {
          const [towRows, sosRows] = await Promise.all([
            activeTow ?
              nearTickets(pos.lat, pos.lng, token, 15000, "TOW").catch((): DispatchTicket[] => []) :
              Promise.resolve([]),
            activeMobileShop ?
              nearTickets(pos.lat, pos.lng, token, 15000, "SOS").catch((): DispatchTicket[] => []) :
              Promise.resolve([]),
          ]);
          setNearbyTow(towRows);
          setNearbySos(sosRows);
          setTowLocationMissing(false);
        } else {
          setNearbyTow([]);
          setNearbySos([]);
          setTowLocationMissing(true);
        }
      } else {
        setNearbyTow([]);
        setNearbySos([]);
        setTowLocationMissing(false);
      }
      const saved = await AsyncStorage.getItem(ACTIVE_KEY).catch(() => null);
      await loadActive(saved, token);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setLoading(false);
    }
  }, [token, bundle?.user.services, loadActive, t]);
  useFocusEffect(useCallback(() => {
    void reloadAll();
    void refreshBills();
  }, [reloadAll, refreshBills]));
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      if (token) bustTicketCaches(token);
      void reloadAll();
      void refreshBills();
    });
    return () => sub.remove();
  }, [token, reloadAll, refreshBills]);
  useEffect(() => {
    if (assistFocused && checkedIn) {
      setCheckedIn(false);
      setSection("records");
      setNotice(t.assist.checkedIn);
    }
  }, [assistFocused, checkedIn, setCheckedIn, t]);
  useEffect(() => {
    if (assistFocused && navEnded) {
      setNavEnded(false);
      setSection("records");
      setNotice(t.nav.requestCancelled);
    }
  }, [assistFocused, navEnded, setNavEnded, t]);
  const fittedJobRef = useRef<string | null>(null);
  useEffect(() => {
    if (!liveTow || !activeFeed || !jobLayers) {
      fittedJobRef.current = null;
      return;
    }
    if (fittedJobRef.current === activeFeed.id) return;
    fittedJobRef.current = activeFeed.id;
    const pts = [...(jobLayers.provider ? [jobLayers.provider] : gps ? [gps] : []), jobLayers.pickup];
    if (jobLayers.dest) pts.push(jobLayers.dest);
    const b = boundsOf(pts.map((p) => [p.lng, p.lat] as [number, number]));
    if (b) safeCameraReady(mapReadyRef.current && mapFocusedRef.current, () => cameraRef.current?.fitBounds([b.sw[0], b.sw[1], b.ne[0], b.ne[1]], {padding: {top: 80, right: 60, bottom: 340, left: 60}, duration: 800}));
  }, [liveTow, activeFeed, jobLayers, gps]);
  const activeId = activeFeed?.id ?? null;
  const activeIsOut = activeFeed?.direction === "out";
  useEffect(() => {
    if (!liveTow || !assistFocused || !token) return;
    const timer = setInterval(() => {
      bustTicketCaches(token);
      if (activeId) {
        void refreshWaiting(activeId, token).then(
          (summary) => setWaiting((prev) => ({...prev, [activeId]: summary})),
          () => undefined,
        );
      }
      void feedTickets(undefined, token).then((rows) => setFeed(rows), () => undefined);
    }, 15000);
    return () => clearInterval(timer);
  }, [liveTow, assistFocused, token, activeId]);
  useEffect(() => {
    if (!liveTow || !activeIsOut || !activeId || !token) return;
    const timer = setInterval(() => {
      void (async () => {
        try {
          await refreshTowEta(activeId, token);
        } catch {
          return;
        }
        void feedTickets(undefined, token).then((rows) => setFeed(rows), () => undefined);
      })();
    }, 180000);
    return () => clearInterval(timer);
  }, [liveTow, activeIsOut, activeId, token]);
  useEffect(() => {
    void ensurePushConfigured();
    const applyLaunch = (data: {ticketId: string; ticketType?: string; status?: string; action?: string} | null): void => {
      if (!data) return;
      if (token) bustTicketCaches(token);
      if (data.status) {
        const status = data.status;
        const patch = <T extends {id: string; status: string}>(row: T | null): T | null =>
          row && row.id === data.ticketId ? {...row, status} : row;
        setFeed((prev) => prev.map((row) => row.id === data.ticketId ? {...row, status} : row));
        setDetailFor(patch);
        setBoardDetail(patch);
        setActive(patch);
      }
      void (async () => {
        await reloadAll();
        void refreshBills();
        if (data.action === "mobile-tow-offer" && token) {
          try {
            const offerTicket = await getTicket(data.ticketId, token);
            setWorkspace("rider");
            setSection("records");
            setDetailFor({...offerTicket, direction: "out"} as FeedTicket);
          } catch {
            void 0;
          }
          return;
        }
        if (data.status && token) void loadActive(data.ticketId, token);
        if (data.ticketType === "WALK_IN") {
          setSection("records");
          return;
        }
        if (!token) return;
        const rows = await feedTickets(undefined, token).catch((): FeedTicket[] => []);
        const mine = new Set(ownProviders.map((p) => p.id));
        if (announcesShopPush(rows, mine, data.ticketId)) {
          setWorkspace("provider");
          setSection("records");
          setNotice(t.assist.newTowAtShop);
          return;
        }
        if (!data.status && data.ticketType === "TOW" && ownTowId !== null) {
          setWorkspace("provider");
          setSection("request");
          setNotice(t.assist.newTowNearby);
        }
      })();
    };
    void drainDispatchLaunch().then(applyLaunch);
    return subscribeDispatchPush((data) => {
      applyLaunch(data);
    }, "assist");
  }, [reloadAll, loadActive, token, ownProviders, refreshBills]);
  useEffect(() => {
    navigation.setOptions({headerShown: false});
    return () => {
      navigation.setOptions({headerShown: true});
    };
  }, [navigation]);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (shopSheet) {
        closeShopSheet();
        return true;
      }
      if (shopSel) {
        setShopSel(null);
        setWalkRoute(null);
        return true;
      }
      if (mapSel) {
        setMapSel(null);
        return true;
      }
      if (section !== "request") {
        setSection("request");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [shopSheet, shopSel, mapSel, section]);
  const fetchAssistShops = useCallback(async (q: string, filters?: {minRating?: number; sortBy?: "distance" | "rating"; ticketId?: string}) => {
    if (!token || !gps) return [];
    const towMode = shopSearchMode === "tow";
    return fetchShopPlaces(q, token, gps, vehicleClass ?? undefined, towMode ? 20000 : undefined, towMode, {
      sortBy: "distance",
      acceptingOnly: true,
      ...(filters?.minRating !== undefined ? {minRating: filters.minRating} : {}),
      ...(filters?.sortBy ? {sortBy: filters.sortBy} : {}),
      ticketId: filters?.ticketId ?? editDestFor?.id ?? detailFor?.id ?? undefined,
    });
  }, [token, gps, vehicleClass, shopSearchMode, editDestFor?.id, detailFor?.id]);
  async function currentPoint(): Promise<{lat: number; lng: number}> {
    const {status} = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") throw new Error(t.nav.locationDenied);
    return getFix({timeoutMs: 5000});
  }
  function openShopSheet(shop: Provider): void {
    setShopSheet(shop);
    if (token && shopJobs[shop.id] === undefined) {
      void providerRatings(shop.id, token).then(
        (res) => {
          setShopJobs((prev) => ({...prev, [shop.id]: res.completedJobs}));
          setShopReviews((prev) => ({...prev, [shop.id]: res.ratings}));
        },
        () => undefined,
      );
    }
    safeCameraReady(mapReadyRef.current && mapFocusedRef.current, () => cameraRef.current?.setStop({center: [shop.lng, shop.lat], zoom: 15, duration: 600}));
  }
  function onPickRadiusShop(shop: Provider, mode: "browse" | "tow"): void {
    if (mode === "tow") {
      if (editDestFor) {
        void applyDestinationEdit(editDestFor, {label: shop.name, lat: shop.lat, lng: shop.lng, source: "shop", id: shop.id});
        return;
      }
      if (towOfferAcceptFor) {
        void completeMobileTowAccept(towOfferAcceptFor, {destinationShopId: shop.id});
        return;
      }
      setDestShopId(shop.id);
      setDest({label: shop.name, lat: shop.lat, lng: shop.lng, source: "map"});
      setTowDestError(null);
      setShopSearchMode(null);
      setRadiusSearchFrom(null);
      closeShopSheet();
      return;
    }
    setShopSearchMode(null);
    openShopSheet(shop);
  }
  function pillForShop(shop: Provider): string | null {
    if (typeof shop.distance !== "number") return null;
    return `~${walkMinutes(shop.distance)} ${t.route.min}`;
  }
  async function onWalkPreview(shop: Provider): Promise<void> {
    if (!token) return;
    closeShopSheet();
    setShopSel(shop);
    setWalkRoute(null);
    let origin = gps;
    if (!origin) {
      try {
        origin = await currentPoint();
        setGps(origin);
      } catch (err) {
        setError(toMessage(err));
        return;
      }
    }
    setWalkBusy(true);
    setError(null);
    try {
      const res = await findRoute({originLat: origin.lat, originLng: origin.lng, destLat: shop.lat, destLng: shop.lng, mode: "foot"}, token);
      const route = res.routes?.[0] ?? null;
      const warn = closingSoon(shop, route?.durationSeconds);
      if (route && warn) {
        setWalkRoute(null);
        setClosingWarn({shop, walk: true, route, seed: null, etaMin: warn.etaMin, closesIn: warn.closesIn});
        return;
      }
      setWalkRoute(route);
      if (route) fitWalk(route);
      else safeCameraReady(mapReadyRef.current && mapFocusedRef.current, () => cameraRef.current?.setStop({center: [shop.lng, shop.lat], zoom: 15, duration: 600}));
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setWalkBusy(false);
    }
  }
  async function onNavigateToShop(shop: Provider): Promise<void> {
    await navigateToPoint({lat: shop.lat, lng: shop.lng}, shop);
  }
  async function navigateToPoint(dest: {lat: number; lng: number}, shop?: Provider): Promise<void> {
    if (!token || navBusy) return;
    setNavBusy(true);
    setError(null);
    try {
      const live = await currentPoint();
      closeShopSheet();
      const res = await findRoute(
        {originLat: live.lat, originLng: live.lng, destLat: dest.lat, destLng: dest.lng, width: activeVehicle?.baseWidth, vehicleType: activeVehicle?.type},
        token,
      );
      const first = res.routes?.[0];
      if (!first) throw new Error(t.route.noResults);
      if (shop) {
        const warn = closingSoon(shop, first.durationSeconds);
        if (warn) {
          setClosingWarn({shop, walk: false, route: first, seed: live, etaMin: warn.etaMin, closesIn: warn.closesIn});
          return;
        }
      }
      startNavSession({route: first, dest, stops: [], seed: live, ...(activeVehicle?.id ? {vehicleId: activeVehicle.id} : {}), ...(activeVehicle?.baseWidth !== undefined ? {width: activeVehicle.baseWidth} : {}), ...(activeVehicle?.type ? {vehicleType: activeVehicle.type} : {}), ...(shop ? {checkIn: {providerId: shop.id, name: shop.name}} : {})});
      navigation.navigate("Navigation" as never);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setNavBusy(false);
    }
  }
  async function onConfirmClosingWarn(): Promise<void> {
    const warn = closingWarn;
    setClosingWarn(null);
    if (!warn || !token) return;
    if (warn.walk) {
      setWalkRoute(warn.route);
      fitWalk(warn.route);
      return;
    }
    if (!warn.seed) return;
    setNavBusy(true);
    try {
      startNavSession({route: warn.route, dest: {lat: warn.shop.lat, lng: warn.shop.lng}, stops: [], seed: warn.seed, ...(activeVehicle?.id ? {vehicleId: activeVehicle.id} : {}), ...(activeVehicle?.baseWidth !== undefined ? {width: activeVehicle.baseWidth} : {}), ...(activeVehicle?.type ? {vehicleType: activeVehicle.type} : {}), checkIn: {providerId: warn.shop.id, name: warn.shop.name}});
      navigation.navigate("Navigation" as never);
    } finally {
      setNavBusy(false);
    }
  }
  function providerOf(party: unknown, fallback: {lat: number; lng: number} | null): Provider | null {
    if (typeof party !== "object" || party === null) return null;
    const record = party as {id?: unknown; name?: unknown; kind?: unknown; lat?: unknown; lng?: unknown; label?: unknown; openNow?: unknown; ratingAvg?: unknown; ratingCount?: unknown; phone?: unknown};
    if (typeof record.id !== "string" || record.id === "" || typeof record.name !== "string") return null;
    const coords = typeof record.lat === "number" && typeof record.lng === "number" ?
      {lat: record.lat, lng: record.lng} :
      fallback;
    if (!coords) return null;
    return {
      id: record.id,
      kind: record.kind === "TOW" ? "TOW" : record.kind === "MOBILE_SHOP" ? "MOBILE_SHOP" : "SHOP",
      name: record.name,
      lat: coords.lat,
      lng: coords.lng,
      status: "ACTIVE",
      accepting: true,
      ...(typeof record.label === "string" ? {label: record.label} : {}),
      ...(typeof record.openNow === "boolean" ? {openNow: record.openNow} : {}),
      ...(typeof record.ratingAvg === "number" ? {ratingAvg: record.ratingAvg} : {}),
      ...(typeof record.ratingCount === "number" ? {ratingCount: record.ratingCount} : {}),
      ...(typeof record.phone === "string" ? {phone: record.phone} : {}),
    } as Provider;
  }
  function onOpenShopCard(ticket: FeedTicket): void {
    const shop = providerOf(ticket.otherParty, null);
    if (!shop) {
      setError(t.assist.alreadyGone);
      return;
    }
    openShopSheet(shop);
  }
  function onOpenDestinationCard(ticket: FeedTicket): void {
    const snap = ticket.destinationSnapshot;
    const fallback = snap && typeof snap.lat === "number" && typeof snap.lng === "number" ? {lat: snap.lat, lng: snap.lng} : null;
    const party = ticket.destinationParty ?? (snap && typeof snap.name === "string" && snap.name !== "" ? {
      id: typeof snap.id === "string" ? snap.id : (typeof ticket.destinationShopId === "string" ? ticket.destinationShopId : ""),
      name: snap.name,
      kind: "SHOP",
      lat: typeof snap.lat === "number" ? snap.lat : null,
      lng: typeof snap.lng === "number" ? snap.lng : null,
    } : null);
    const shop = providerOf(party, fallback);
    if (!shop) {
      setError(t.assist.alreadyGone);
      return;
    }
    openShopSheet(shop);
  }
  function boardToFeed(item: DispatchTicket): FeedTicket {
    const riderName = typeof item.riderName === "string" && item.riderName !== "" ? item.riderName : t.assist.unassigned;
    return {
      ...item,
      direction: "in",
      otherParty: {id: item.userId, name: riderName, kind: "RIDER"},
    };
  }
  function onOpenBoardTicket(id: string): void {
    const item = nearbyTow.find((entry) => entry.id === id) ?? null;
    if (!item) {
      setError(t.assist.alreadyGone);
      return;
    }
    const mapped = boardToFeed(item);
    setBoardDetail(mapped);
    if (mapped.status === "1" && mapped.ticketType === "TOW") void loadTowPreview(mapped);
  }
  function onOpenTowRequest(ticket: FeedTicket): void {
    setBoardDetail(ticket);
    setTowPreview(null);
    if (ticket.status === "1" && ticket.ticketType === "TOW") void loadTowPreview(ticket);
  }
  function towLegsFor(ticket: TowRouteTicket): {origin: {lat: number; lng: number}; pickup: {lat: number; lng: number}; dest: {lat: number; lng: number} | null} | null {
    const pickup = {lat: ticket.lat, lng: ticket.lng};
    const dest = towDestOf(ticket);
    const towerFix = ticket.towerFix && typeof ticket.towerFix === "object" && typeof ticket.towerFix.lat === "number" && typeof ticket.towerFix.lng === "number" ? {lat: ticket.towerFix.lat, lng: ticket.towerFix.lng} : null;
    if (ticket.direction === "out") {
      if (towerFix) return {origin: towerFix, pickup, dest};
      if (ticket.status === "3" && gps) return {origin: gps, pickup, dest};
      return null;
    }
    if (!gps) return null;
    return {origin: gps, pickup, dest};
  }
  function towSummary(route: RouteOption, viaPickup: boolean): string {
    const distance = `${((route.distanceMeters ?? 0) / 1000).toFixed(1)} ${t.route.km}`;
    const minutes = `${Math.max(1, Math.round((route.durationSeconds ?? 0) / 60))} ${t.route.min}`;
    return viaPickup ? `${distance} · ${minutes} ${t.assist.towViaPickup}` : `${distance} · ${minutes}`;
  }
  async function fetchTowRoute(ticket: TowRouteTicket, direct = false): Promise<RouteOption | null> {
    if (!token) return null;
    const legs = towLegsFor(ticket);
    if (!legs) return null;
    const res = await findRoute(
      {
        originLat: legs.origin.lat,
        originLng: legs.origin.lng,
        destLat: (legs.dest ?? legs.pickup).lat,
        destLng: (legs.dest ?? legs.pickup).lng,
        ...(legs.dest && !direct ? {stops: [legs.pickup]} : {}),
        ...(typeof ticket.vehicleType === "string" ? {vehicleType: ticket.vehicleType} : {}),
        ...(typeof ticket.vehicleWidth === "number" ? {width: ticket.vehicleWidth} : {}),
      },
      token,
    );
    return res.routes?.[0] ?? null;
  }
  async function loadTowPreview(ticket: FeedTicket, openMap = false): Promise<void> {
    if (!token || !gps) {
      setTowPreview({ticketId: ticket.id, route: null, fareEstimate: null, busy: false, error: t.route.locationUnavailable});
      return;
    }
    setTowPreview({ticketId: ticket.id, route: null, fareEstimate: null, busy: true, error: null});
    setError(null);
    try {
      const route = await fetchTowRoute(ticket);
      if (!route) throw new Error(t.route.noResults);
      const fare = await estimateTowFare(ticket.id, gps.lat, gps.lng, token).catch(() => null);
      setTowPreview({ticketId: ticket.id, route, fareEstimate: fare?.estimate ?? null, busy: false, error: null});
      if (openMap) setTowPreviewMap(true);
    } catch (err) {
      setTowPreview({ticketId: ticket.id, route: null, fareEstimate: null, busy: false, error: toMessage(err)});
    }
  }
  function onPreviewTowRoute(ticket: FeedTicket): void {
    if (towPreview && towPreview.ticketId === ticket.id && towPreview.route) {
      setTowPreviewMap(true);
      return;
    }
    void loadTowPreview(ticket, true);
  }
  async function startSosNavigation(ticket: FeedTicket): Promise<boolean> {
    if (!token) return false;
    let point = gps;
    try {
      point = await getFix();
    } catch {
      point = gps;
    }
    if (point === null) {
      setError(t.route.locationUnavailable);
      return false;
    }
    setGps(point);
    const res = await findRoute({
      originLat: point.lat,
      originLng: point.lng,
      destLat: ticket.lat,
      destLng: ticket.lng,
      width: activeVehicle?.baseWidth,
      vehicleType: normalizeVehicleType(activeVehicle?.type) ?? undefined,
    }, token);
    const route = res.routes?.[0];
    if (!route) {
      setError(t.route.noResults);
      return false;
    }
    startNavSession({
      route,
      dest: {lat: ticket.lat, lng: ticket.lng},
      stops: [],
      seed: point,
      ticketId: ticket.id,
      ...(activeVehicle?.id ? {vehicleId: activeVehicle.id} : {}),
      ...(activeVehicle?.baseWidth !== undefined ? {width: activeVehicle.baseWidth} : {}),
      ...(activeVehicle?.type ? {vehicleType: normalizeVehicleType(activeVehicle.type) ?? activeVehicle.type} : {}),
    });
    navigation.navigate("Navigation" as never);
    return true;
  }
  async function startTowNavigation(ticket: TowRouteTicket): Promise<boolean> {
    if (!token || !gps) {
      setError(t.route.locationUnavailable);
      return false;
    }
    const cached = towPreview && towPreview.ticketId === ticket.id ? towPreview.route : null;
    const route = cached ?? await fetchTowRoute(ticket).catch(() => null);
    if (!route) {
      setError(t.route.noResults);
      return false;
    }
    const legs = towLegsFor(ticket);
    if (!legs) {
      setError(t.route.locationUnavailable);
      return false;
    }
    startNavSession({
      route,
      dest: legs.dest ?? legs.pickup,
      stops: legs.dest ? [legs.pickup] : [],
      seed: gps,
      ticketId: ticket.id,
      ...(typeof ticket.vehicleId === "string" ? {vehicleId: ticket.vehicleId} : {}),
      ...(typeof ticket.vehicleType === "string" ? {vehicleType: ticket.vehicleType} : {}),
      ...(typeof ticket.vehicleWidth === "number" ? {width: ticket.vehicleWidth} : {}),
    });
    navigation.navigate("Navigation" as never);
    return true;
  }
  function closeBoardDetail(): void {
    setBoardDetail(null);
    setTowPreview(null);
    setTowPreviewMap(false);
  }
  function sheetFor(
    ticket: FeedTicket,
    onCloseSheet: () => void,
    decline: ((ticket: FeedTicket, reason: DeclineReason, note: string | undefined) => void) | null,
    roleContext: "auto" | "shop" | "tow" = "auto",
  ) {
    const ownShopIds = new Set(ownProviders.filter((item) => item.kind === "SHOP").map((item) => item.id));
    const showRequestPhotos = canSeeRequestPhotos(ticket, ownShopIds, ownTowId, roleContext, ownMobileShopId);
    const ownTowAccepting = ownProviders.some((item) => item.kind === "TOW" && item.status === "ACTIVE" && item.accepting !== false);
    const acceptOffDuty = ticket.ticketType === "TOW" &&
      ticket.status === "1" &&
      ownTowId !== null &&
      !ownTowAccepting;
    const acceptHidden = (ticket.ticketType === "TOW" &&
      ticket.status === "1" &&
      ownTowId === null) || acceptOffDuty;
    return (
      <RecordDetailSheet
        t={t}
        lang={lang}
        ticket={ticket}
        ratings={ticketRatings[ticket.id] ?? []}
        busy={recBusy}
        uid={uid}
        hasRated={ratedScores[ticket.id] !== undefined}
        onClose={onCloseSheet}
        onConfirmCancel={(id) => void onCancel(id)}
        onRate={(item) => onRate(item)}
        onAccept={(item) => void onAcceptTicket(item)}
        onDecline={decline === null ? null : (item, reason, note) => void onDeclineTicket(item, reason, note)}
        onOpenWork={(item) => { setWorkFor({ticket: item, mode: "done"}); setWorkError(null); }}
        onOpenMobileFix={(item) => { setMobileFixFor(item); setMobileFixError(null); }}
        onOpenChat={(item) => setChatFor(item)}
        onOfferMobileTow={(item) => void onOfferMobileTow(item)}
        canOfferMobileTow={ticket.mobileTowAvailable === true}
        mobileTowShopOff={ticket.mobileTowAvailable === true && ownShopProviderId !== null && !ownShopAccepting}
        onReleaseSos={(item) => void onReleaseSos(item)}
        onContinueSos={(item) => {
          setContinuationFor({
            ticket: item,
            nextAttempt: (item.sosAttempt ?? 1) + 1,
            callOutTotal: typeof item.sosCallOutTotal === "number" ? item.sosCallOutTotal : (typeof item.mobileCallOutFee === "number" ? item.mobileCallOutFee : 50000),
          });
          setContinuationError(null);
        }}
        onRespondMobileTow={(item, accept) => void onRespondMobileTow(item, accept)}
        onRespondReturnTow={ticket.ticketType === "WALK_IN" && ticket.returnTowOffer?.status === "PENDING" && gps !== null && distBetween(gps, {lat: ticket.lat, lng: ticket.lng}) > 1000 ? (item, accept) => void onRespondReturnTow(item, accept) : null}
        onOpenQuote={(item) => { setWorkFor({ticket: item, mode: "quote"}); setWorkError(null); }}
        onOpenEstimate={(item) => {
          setEstimateFor(item);
          setEstimateError(null);
        }}
        onApproveQuote={(item) => void onApproveQuote(item)}
        onOpenShop={(item) => onOpenShopCard(item)}
        onOpenDestination={(item) => onOpenDestinationCard(item)}
        onNavigateJob={(() => {
          const live = feed.find((entry) => entry.id === ticket.id) ?? ticket;
          const towJob = live.ticketType === "TOW" && (live.status === "2" || live.status === "3") && ownTowId !== null && live.assignedShopId === ownTowId;
          const sosJob = live.ticketType === "SOS" && live.direction === "in" && ownMobileShopId !== null && live.assignedShopId === ownMobileShopId && (live.status === "2" || live.status === "3" || live.status === "7");
          return towJob || sosJob ? (item) => void navigateJobFor(item) : null;
        })()}
        acceptHidden={acceptHidden}
        acceptOffDuty={acceptOffDuty}
        towPreview={boardDetail !== null && ticket.id === boardDetail.id && ticket.ticketType === "TOW" && ticket.status === "1" && towPreview && towPreview.ticketId === ticket.id ?
          {
            ready: towPreview.route !== null,
            summary: towPreview.route ? towSummary(towPreview.route, towLegsFor(ticket)?.dest !== null) : null,
            fareEstimate: towPreview.fareEstimate,
            busy: towPreview.busy,
            error: towPreview.error,
          } :
          ticket.ticketType === "TOW" && (ticket.status === "2" || ticket.status === "3") && jobRoute && jobRoute.ticketId === ticket.id && jobRoute.route ?
            {
              ready: true,
              summary: towSummary(jobRoute.route, towDestOf(ticket) !== null),
              busy: false,
              error: null,
            } :
            null}
        onPreviewTowRoute={(item) => onPreviewTowRoute(item)}
        linked={(() => {
          const ids = ticket.linkedTicketIds;
          if (!Array.isArray(ids) || ids.length === 0) return null;
          return feed.find((entry) => entry.id === ids[0]) ?? null;
        })()}
        onOpenLinked={(item) => {
          setDetailFor(item);
          if (item.status === "4") void onLoadRatings(item);
        }}
        onAdvance={(item, status) => void onAdvanceStatus(item, status)}
        onReply={(ratingId, text) => void onReplyRating(ratingId, text)}
        onRateRider={(item) => onRateRider(item)}
        ownShopIds={ownShopIds}
        ownTowId={ownTowId}
        ownMobileShopId={ownMobileShopId}
        roleContext={roleContext}
        showRequestPhotos={showRequestPhotos}
        onDeclineDestination={(item) => void onDeclineDestinationTicket(item)}
        onEditDestination={(item) => { setEditDestFor(item); setShopSearchMode("tow"); }}
        allowTowerCancel={ticket.direction === "in" && ticket.ticketType === "TOW" && (ticket.status === "2" || ticket.status === "3") && ownTowId !== null && ticket.assignedShopId === ownTowId}
        onApproveEstimate={(item) => void onApproveEstimate(item)}
        onDeclineEstimate={(item) => void onDeclineEstimate(item)}
        onApproveFinal={(item) => void onApproveFinal(item)}
        onConfirmCash={(item) => void onConfirmCash(item)}
        onOpenBill={(item) => openBill(item)}
        onOpenDispute={(item) => { setDisputeFor(item); setDisputeError(null); }}
        onTowerCancel={(item) => onTowerCancel(item)}
        onOpenArchivedChat={(item, version) => setChatArchiveFor({ticket: item, version})}
        payment={payments[ticket.id] ?? null}
        waiting={waiting[ticket.id] ?? null}
        bill={billForTicket(ticket)}
        quoteFunded={fundedForApproval(ticket)}
        onMarkUnfixable={(item) => { setUnfixableFor(item); setUnfixableError(null); }}
      />
    );
  }
  function onPickSearch(id: string): void {
    if (!token || !gps) {
      setError(t.assist.alreadyGone);
      return;
    }
    void (async () => {
      try {
        const shops = await searchProviders(
          gps.lat,
          gps.lng,
          query.trim(),
          token,
          {radiusMeters: 10000, ...(vehicleClass ? {vehicleClass} : {})},
        );
        const shop = shops.find((s) => s.id === id) ?? null;
        if (!shop) {
          setError(t.assist.alreadyGone);
          return;
        }
        setShopSearchMode(null);
        setShopSheet(shop);
        safeCameraReady(mapReadyRef.current && mapFocusedRef.current, () => cameraRef.current?.setStop({center: [shop.lng, shop.lat], zoom: 15, duration: 600}));
      } catch (err) {
        setError(toMessage(err));
      }
    })();
  }
  function onPickTowShop(place: Place): void {
    if (typeof place.id !== "string") return;
    if (towOfferAcceptFor) {
      void completeMobileTowAccept(towOfferAcceptFor, {destinationShopId: place.id});
      return;
    }
    setDestShopId(place.id);
    setDest({label: place.label, lat: place.lat, lng: place.lng, source: "map"});
    setTowDestError(null);
    setShopSearchMode(null);
  }
  function onPickTowPlace(place: Place): void {
    if (towOfferAcceptFor) {
      void completeMobileTowAccept(towOfferAcceptFor, {destinationPoint: {lat: place.lat, lng: place.lng, label: place.label}});
      return;
    }
    setDestShopId(null);
    setDest({label: place.label, lat: place.lat, lng: place.lng, source: "map"});
    setTowDestError(null);
    setShopSearchMode(null);
  }
  function onNavigateMap(place: {lat: number; lng: number}): void {
    void navigateToPoint({lat: place.lat, lng: place.lng});
  }
  function onRegisterShop(): void {
    navigation.navigate("More" as never);
  }
  async function onImHere(shop: Provider): Promise<void> {
    if (!token || imHereBusy) return;
    if (shop.accepting === false || shop.status !== "ACTIVE" ||
      shop.suspended === true) {
      setError(t.assist.shopOffDuty);
      return;
    }
    setImHereBusy(true);
    setError(null);
    try {
      await checkInAtShop({
        providerId: shop.id,
        token,
        vehicleId: activeVehicle?.id,
        vehicleType: normalizeVehicleType(activeVehicle?.type) ?? undefined,
        vehicleWidth: activeVehicle?.baseWidth,
        deniedMessage: t.nav.locationDenied,
      });
      closeShopSheet();
      setNotice(t.assist.checkedIn);
      setSection("records");
      await reloadAll();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setImHereBusy(false);
    }
  }
  function rateTarget(ticket: DispatchTicket): {targetId: string; targetKind: "SHOP"} | null {
    if (typeof ticket.assignedShopId === "string" && ticket.assignedShopId) return {targetId: ticket.assignedShopId, targetKind: "SHOP"};
    if (typeof ticket.destinationShopId === "string" && ticket.destinationShopId) return {targetId: ticket.destinationShopId, targetKind: "SHOP"};
    return null;
  }
  function onRate(ticket: DispatchTicket): void {
    if (!rateTarget(ticket)) {
      setError(t.assist.noOneToRate);
      return;
    }
    setRatingRider(false);
    setRatingFor(ticket);
  }
  async function onSubmitRating(score: number, comment: string): Promise<void> {
    if (!token || !ratingFor || ratingBusy) return;
    const target = ratingRider ? {targetId: ratingFor.userId, targetKind: "RIDER" as const} : rateTarget(ratingFor);
    if (!target) {
      setError(t.assist.noOneToRate);
      return;
    }
    setRatingBusy(true);
    setError(null);
    try {
      await submitRating({targetId: target.targetId, targetKind: target.targetKind, ticketId: ratingFor.id, score, ...(comment ? {text: comment} : {})}, token);
      setRatedScores((prev) => ({...prev, [ratingFor.id]: score}));
      setRatingFor(null);
      setRatingRider(false);
      setNotice(t.rating.sent);
      await reloadAll();
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 404) {
        setRatingFor(null);
        setRatingRider(false);
        setNotice(t.assist.alreadyGone);
        await reloadAll();
      } else {
        setError(toMessage(err));
      }
    } finally {
      setRatingBusy(false);
    }
  }
  async function onRequest(skipPhotos = false): Promise<void> {
    if (!token || !pendingTicket) return;
    const kind = pendingTicket;
    if (!activeVehicle?.id) {
      setError(t.assist.vehicleRequired);
      setVehicleOpen(true);
      return;
    }
    const live = feed.find((ticket) =>
      ticket.vehicleId === activeVehicle.id &&
      !isTerminal(ticket.status));
    if (live) {
      setPendingTicket(null);
      setDuplicateFor({ticketId: live.id, reason: "VEHICLE_BUSY"});
      return;
    }
    if (kind === "TOW" && !dest) {
      setTowDestError(t.assist.towNeedsDest);
      setError(t.assist.towNeedsDest);
      return;
    }
    setReqBusy(true);
    setError(null);
    setNotice(null);
    setPhotoError(null);
    try {
      Keyboard.dismiss();
      const point = await currentPoint();
      let photoUrls: string[] | undefined;
      if (photos.length > 0 && !skipPhotos) {
        try {
          const uploaded = await uploadPhotoPaths(`dispatch/pending-${Date.now()}`, photos);
          if (uploaded.length !== photos.length) {
            throw new Error(`photo-upload-incomplete-${uploaded.length}-of-${photos.length}`);
          }
          photoUrls = uploaded;
        } catch (err) {
          console.warn("[assist] photo upload failed", {count: photos.length, error: err});
          setPhotoError(t.photos.uploadFailed);
          setDuplicateFor(null);
          setError(t.photos.uploadFailed);
          return;
        }
      }
      await createTicket({ticketType: kind, lat: point.lat, lng: point.lng, note: note.trim() || undefined, ...(description.trim() ? {description: description.trim().slice(0, 1000)} : {}), ...(photoUrls && photoUrls.length > 0 ? {photoUrls} : {}), destinationShopId: kind === "TOW" ? destShopId ?? undefined : undefined, destinationPoint: kind === "TOW" && dest ? {lat: dest.lat, lng: dest.lng, label: dest.label} : undefined, vehicleId: activeVehicle.id, vehicleType: normalizeVehicleType(activeVehicle.type) ?? undefined, vehicleWidth: activeVehicle.baseWidth}, token);
      setPendingTicket(null);
      setDuplicateFor(null);
      setNotice(t.assist.requested);
      setNote("");
      setDescription("");
      setPhotos([]);
      setTowDestError(null);
      setDest(null);
      setDestShopId(null);
      await reloadAll();
    } catch (err) {
      const conflict = liveTicketConflict(err);
      if (conflict !== null) {
        setDuplicateFor(conflict);
        return;
      }
      setError(toMessage(err));
    } finally {
      setReqBusy(false);
    }
  }
  function onRetryPhotos(): void {
    void onRequest(false);
  }
  function onSendWithoutPhotos(): void {
    void onRequest(true);
  }
  async function onAddTicketPhotos(): Promise<void> {
    if (photosBusy) return;
    setPhotosBusy(true);
    setError(null);
    setPhotoError(null);
    try {
      const picked = await takePhoto();
      if (picked.length > 0) setPhotos((prev) => [...prev, ...picked].slice(0, 5));
    } catch (err) {
      setError(isPhotoPermissionError(err) ? t.photos.cameraDenied : toMessage(err));
    } finally {
      setPhotosBusy(false);
    }
  }
  async function onApproveEstimate(ticket: FeedTicket): Promise<void> {
    if (!token || recBusy) return;
    setRecBusy(true);
    setError(null);
    try {
      await approveEstimate(ticket.id, token);
      await reloadAll();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setRecBusy(false);
    }
  }
  async function onDeclineEstimate(ticket: FeedTicket): Promise<void> {
    if (!token || recBusy) return;
    setRecBusy(true);
    setError(null);
    try {
      await declineEstimate(ticket.id, token);
      setEditDestFor(ticket);
      setShopSearchMode("tow");
      setNotice(t.assist.declineEstimate);
      await reloadAll();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setRecBusy(false);
    }
  }
  async function onApproveFinal(ticket: FeedTicket): Promise<void> {
    if (!token || recBusy) return;
    if (!fundedForApproval(ticket)) {
      setDetailFor(null);
      navigation.navigate("BillDetail", {ticketId: ticket.id, payFirst: true});
      return;
    }
    setRecBusy(true);
    setError(null);
    try {
      await approveFinalQuote(ticket.id, token);
      await reloadAll();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setRecBusy(false);
    }
  }
  async function onConfirmCash(ticket: FeedTicket): Promise<void> {
    if (!token || recBusy) return;
    setRecBusy(true);
    setError(null);
    try {
      const confirmed = await confirmCashReceipt(ticket.id, token);
      setPayments((prev) => ({...prev, [ticket.id]: confirmed}));
      setNotice(t.assist.cashReceiptDone);
      await reloadAll();
      void refreshBills();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setRecBusy(false);
    }
  }
  function fundedForApproval(ticket: FeedTicket): boolean {
    const live = payments[ticket.id] ?? null;
    const bill = billForTicket(ticket);
    const billPayment = bill !== null ? (bill.items.find((item) => item.ticketId === ticket.id)?.payment ?? bill.items[0]?.payment ?? null) : null;
    const method = typeof live?.method === "string" ? live.method : typeof ticket.paymentMethod === "string" ? ticket.paymentMethod : (typeof billPayment?.method === "string" ? billPayment.method : null);
    const status = typeof live?.status === "string" ? live.status : typeof ticket.paymentStatus === "string" ? ticket.paymentStatus : (typeof billPayment?.status === "string" ? billPayment.status : null);
    return (method === "CASH" && (status === "PENDING" || status === "CONFIRMED")) || (method === "SEPAY" && (status === "HELD" || status === "CONFIRMED"));
  }
  function openBill(ticket: FeedTicket): void {
    const payee = ticket.direction === "in" && billForTicket(ticket) !== null && payeeBillList.some((row) => row.ticketId === ticket.id || row.items.some((item) => item.ticketId === ticket.id));
    setDetailFor(null);
    navigation.navigate("BillDetail", payee ? {ticketId: ticket.id, scope: "payee"} : {ticketId: ticket.id, ...(ticket.direction === "in" ? {readOnly: true} : {})});
  }
  async function onFileDispute(reason: string, noteText: string, photoUri: string | null): Promise<void> {
    if (!token || !disputeFor || disputeBusy) return;
    setDisputeBusy(true);
    setDisputeError(null);
    try {
      let photoUrl: string | undefined;
      if (photoUri) {
        const uploaded = await uploadPhotoPaths(`dispatch/dispute-${disputeFor.id}`, [photoUri]);
        if (uploaded.length > 0 && typeof uploaded[0] === "string") photoUrl = uploaded[0] as string;
      }
      await fileDispute({ticketId: disputeFor.id, reason, ...(noteText ? {note: noteText} : {}), ...(photoUrl ? {photoUrl} : {})}, token);
      setDisputeFor(null);
      setNotice(t.dispute.sent);
      await reloadAll();
    } catch (err) {
      setDisputeError(toMessage(err));
    } finally {
      setDisputeBusy(false);
    }
  }
  async function onMarkUnfixable(reason: string, photos: string[]): Promise<void> {
    if (!token || !unfixableFor || unfixableBusy) return;
    if (photos.length === 0) {
      setUnfixableError(t.assist.unfixableNeedPhoto);
      return;
    }
    setUnfixableBusy(true);
    setUnfixableError(null);
    try {
      const uploaded = await uploadPhotoPaths(`dispatch/${unfixableFor.id}`, photos);
      if (uploaded.length === 0) {
        setUnfixableError(t.assist.unfixableNeedPhoto);
        return;
      }
      const result = await reportUnfixable(unfixableFor.id, reason, uploaded, token);
      const waived = unfixableFor.mobileCallOutWaived === true || unfixableFor.mobileCallOutFee === 0;
      setUnfixableFor(null);
      setNotice(waived ? t.assist.unfixableSentWaived : t.assist.unfixableSent);
      await reloadAll();
      void refreshBills();
      if (result.continuationTicketId) {
        setNotice(t.assist.continueSosSnack);
        await loadActive(result.continuationTicketId, token);
      } else if (result.noCandidates) {
        setNotice(t.assist.continueSosNoCandidates);
      }
    } catch (err) {
      setUnfixableError(toMessage(err));
    } finally {
      setUnfixableBusy(false);
    }
  }
  function liveTicketConflict(err: unknown): {ticketId: string; reason?: string} | null {
    if (err instanceof ApiError && err.statusCode === 409) {
      const errors = err.errors as {ticketId?: unknown; reason?: unknown} | null | undefined;
      if (errors && typeof errors.ticketId === "string" && errors.ticketId !== "") {
        return {
          ticketId: errors.ticketId,
          ...(typeof errors.reason === "string" ? {reason: errors.reason} : {}),
        };
      }
    }
    return null;
  }
  async function onVehiclePress(id: string): Promise<void> {
    if (!token) return;
    setError(null);
    try {
      await activateVehicle(id);
      setVehicleOpen(false);
      setNotice(t.vehicle.activeSaved);
    } catch (err) {
      setError(toMessage(err));
    }
  }
  async function onCancel(id: string): Promise<void> {
    if (!token || recBusy) return;
    setRecBusy(true);
    setError(null);
    try {
      await cancelTicket(id, token);
      setNotice(t.assist.cancelled);
      setDetailFor(null);
      await reloadAll();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setRecBusy(false);
    }
  }
  async function onAcceptTicket(ticket: FeedTicket): Promise<void> {
    if (!token || recBusy) return;
    const addressed = typeof ticket.providerId === "string" && ticket.providerId ? ticket.providerId : null;
    const shopId = addressed ?? (ticket.ticketType === "TOW" ? ownTowId : ticket.ticketType === "SOS" ? ownMobileShopId : null);
    if (shopId === null) {
      setError(ticket.ticketType === "TOW" ? t.assist.towOperatorsOnly : t.assist.alreadyGone);
      return;
    }
    setRecBusy(true);
    setError(null);
    try {
      await acceptTicket(ticket.id, token, shopId ?? undefined);
      setDetailFor(null);
      closeBoardDetail();
      if (ticket.ticketType === "TOW") {
        const navigated = await startTowNavigation(ticket);
        if (!navigated) {
          await reloadAll();
          return;
        }
        closeBoardDetail();
        await AsyncStorage.setItem(ACTIVE_KEY, ticket.id).catch(() => undefined);
        setActive(await getTicket(ticket.id, token));
      }
      if (ticket.ticketType === "SOS") {
        closeBoardDetail();
        const localActive = {
          ...ticket,
          status: "2",
          direction: "in",
          ...(shopId ? {assignedShopId: shopId} : {}),
        } as FeedTicket;
        setActive(localActive);
        await AsyncStorage.setItem(ACTIVE_KEY, ticket.id).catch(() => undefined);
        try {
          setActive(await getTicket(ticket.id, token));
        } catch {
          setActive(localActive);
        }
        try {
          await startSosNavigation(ticket);
        } catch (err) {
          setError(toMessage(err));
        }
      }
      setWorkspace("provider");
      setSection("records");
      setNotice(t.assist.accepted);
      await reloadAll();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setRecBusy(false);
    }
  }
  async function onDeclineTicket(ticket: FeedTicket, reason: DeclineReason, note: string | undefined): Promise<void> {
    if (!token || recBusy) return;
    if (typeof ticket.providerId !== "string" || !ticket.providerId) {
      setError(t.assist.alreadyGone);
      return;
    }
    setRecBusy(true);
    setError(null);
    try {
      await declineTicket(ticket.id, ticket.providerId, reason, note, token);
      setNotice(t.provider.declineSent);
      setDetailFor(null);
      await reloadAll();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setRecBusy(false);
    }
  }
  async function onSubmitWork(value: WorkFormValue): Promise<void> {
    if (!token || !workFor || workBusy) return;
    if (workFor.mode === "quote" && value.amount === null) {
      setWorkError(t.provider.invalidAmount);
      return;
    }
    setWorkBusy(true);
    setWorkError(null);
    try {
      if (workFor.mode === "quote") {
        await sendQuote(workFor.ticket.id, value.amount as number, value.workType || undefined, token);
        setNotice(t.assist.quoteSent);
      } else {
        await updateWorkOrder({
          ticketId: workFor.ticket.id,
          ...(value.workType ? {workType: value.workType} : {}),
          ...(value.invoiceRef ? {invoiceRef: value.invoiceRef} : {}),
        }, token);
        setNotice(t.provider.workSaved);
      }
      setWorkFor(null);
      await reloadAll();
    } catch (err) {
      setWorkError(toMessage(err));
    } finally {
      setWorkBusy(false);
    }
  }
  async function onSaveMobileFix(amount: number): Promise<void> {
    if (!token || !mobileFixFor || mobileFixBusy) return;
    setMobileFixBusy(true);
    setMobileFixError(null);
    try {
      await setMobileShopFix(mobileFixFor.id, amount, token);
      await updateTicketStatus(mobileFixFor.id, "7", token);
      setMobileFixFor(null);
      setNotice(t.provider.workSaved);
      await reloadAll();
    } catch (err) {
      setMobileFixError(toMessage(err));
    } finally {
      setMobileFixBusy(false);
    }
  }
  async function onOfferMobileTow(ticket: FeedTicket): Promise<void> {
    if (!token || recBusy) return;
    setRecBusy(true);
    setError(null);
    try {
      const res = await offerMobileShopTow(ticket.id, ownShopAccepting ? ownShopProviderId ?? undefined : undefined, token);
      setNotice(res.mode === "NETWORK" ? t.assist.towNetworkRequested : t.assist.offerTow);
      await reloadAll();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setRecBusy(false);
    }
  }
  async function completeMobileTowAccept(ticket: FeedTicket, destination?: {destinationShopId?: string; destinationPoint?: {lat: number; lng: number; label?: string}}): Promise<void> {
    if (!token || recBusy) return;
    setRecBusy(true);
    setError(null);
    try {
      const res = await respondMobileShopTow(ticket.id, true, token, destination);
      setTowOfferAcceptFor(null);
      setShopSearchMode(null);
      setDetailFor(null);
      if (res.ticketId) {
        await AsyncStorage.setItem(ACTIVE_KEY, res.ticketId).catch(() => undefined);
      }
      await reloadAll();
      void refreshBills();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setRecBusy(false);
    }
  }
  async function onRespondMobileTow(ticket: FeedTicket, accept: boolean): Promise<void> {
    if (!token || recBusy) return;
    if (accept) {
      if (!ticket.mobileTowOffer?.destinationShopId) {
        setTowOfferAcceptFor(ticket);
        setShopSearchMode("tow");
        return;
      }
      await completeMobileTowAccept(ticket, {
        destinationShopId: ticket.mobileTowOffer.destinationShopId,
      });
      return;
    }
    setRecBusy(true);
    setError(null);
    try {
      const res = await respondMobileShopTow(ticket.id, false, token);
      setDetailFor(null);
      await reloadAll();
      void refreshBills();
      const nextTicketId = res.ticketId ?? res.continuationTicketId;
      if (res.requiresContinuationConfirmation === true) {
        setContinuationFor({ticket, nextAttempt: res.nextAttempt ?? 3, callOutTotal: res.callOutTotal ?? 0});
        setContinuationError(null);
      } else if (nextTicketId) {
        setNotice(t.assist.continueSosSnack);
        await loadActive(nextTicketId, token);
      } else if (res.noCandidates === true) {
        setNotice(t.assist.continueSosNoCandidates);
      }
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setRecBusy(false);
    }
  }
  async function onReleaseSos(ticket: FeedTicket): Promise<void> {
    if (!token || recBusy) return;
    setRecBusy(true);
    setError(null);
    try {
      const res = await continueSos(ticket.id, token);
      setDetailFor(null);
      await reloadAll();
      void refreshBills();
      if (res.ticketId) {
        setNotice(t.assist.continueSosSnack);
        await loadActive(res.ticketId, token);
      } else {
        setNotice(t.assist.continueSosNoCandidates);
      }
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setRecBusy(false);
    }
  }
  async function onConfirmContinuation(): Promise<void> {
    if (!token || !continuationFor || continuationBusy) return;
    setContinuationBusy(true);
    setContinuationError(null);
    try {
      const res = await continueSos(continuationFor.ticket.id, token);
      setContinuationFor(null);
      setDetailFor(null);
      if (!res.ticketId) {
        setNotice(t.assist.continueSosNoCandidates);
        await reloadAll();
        return;
      }
      setNotice(t.assist.continueSosSnack);
      await loadActive(res.ticketId, token);
      await reloadAll();
      void refreshBills();
    } catch (err) {
      setContinuationError(toMessage(err));
    } finally {
      setContinuationBusy(false);
    }
  }
  async function onRespondReturnTow(ticket: FeedTicket, accept: boolean): Promise<void> {
    if (!token || recBusy) return;
    setRecBusy(true);
    setError(null);
    try {
      if (accept) {
        const point = await getFix();
        await respondReturnTow(ticket.id, true, token, point);
      } else {
        await respondReturnTow(ticket.id, false, token);
      }
      setDetailFor(null);
      await reloadAll();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setRecBusy(false);
    }
  }
  async function onSendEstimate(amount: number, note: string): Promise<void> {
    if (!token || !estimateFor || estimateBusy) return;
    setEstimateBusy(true);
    setEstimateError(null);
    try {
      await sendEstimate(estimateFor.id, amount, note.trim() || undefined, token);
      setEstimateFor(null);
      setNotice(t.assist.estimateSent);
      await reloadAll();
    } catch (err) {
      setEstimateError(toMessage(err));
    } finally {
      setEstimateBusy(false);
    }
  }
  async function onApproveQuote(ticket: FeedTicket): Promise<void> {
    if (!token || recBusy) return;
    if (!fundedForApproval(ticket)) {
      setDetailFor(null);
      navigation.navigate("BillDetail", {ticketId: ticket.id, payFirst: true});
      return;
    }
    setRecBusy(true);
    setError(null);
    try {
      await approveQuote(ticket.id, token);
      await reloadAll();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setRecBusy(false);
    }
  }
  async function applyDestinationEdit(ticket: FeedTicket, place: Place): Promise<void> {
    if (!token || recBusy) return;
    setRecBusy(true);
    setError(null);
    try {
      if (place.source === "shop" && typeof place.id === "string") {
        await updateTicketDestination(ticket.id, {destinationShopId: place.id}, token);
      } else {
        await updateTicketDestination(ticket.id, {destinationPoint: {lat: place.lat, lng: place.lng, label: place.label}}, token);
      }
      setEditDestFor(null);
      setShopSearchMode(null);
      setMapSearchFrom(null);
      setRadiusSearchFrom(null);
      await reloadAll();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setRecBusy(false);
    }
  }
  function onDeclineDestinationTicket(ticket: FeedTicket): void {
    setCancelReasonError(null);
    setCancelReasonFor({ticket, kind: "SHOP"});
  }
  function onTowerCancel(ticket: FeedTicket): void {
    setCancelReasonError(null);
    setCancelReasonFor({ticket, kind: "TOWER"});
  }
  async function onSubmitCancelReason(reason: string): Promise<void> {
    if (!token || !cancelReasonFor || cancelReasonBusy) return;
    setCancelReasonBusy(true);
    setCancelReasonError(null);
    try {
      if (cancelReasonFor.kind === "TOWER") {
        await cancelTicket(cancelReasonFor.ticket.id, token, reason);
      } else {
        await declineDestination(cancelReasonFor.ticket.id, reason, token);
      }
      setCancelReasonFor(null);
      setDetailFor(null);
      closeBoardDetail();
      setNotice(cancelReasonFor.kind === "TOWER" ? t.assist.cancelled : t.provider.declineSent);
      await reloadAll();
    } catch (err) {
      setCancelReasonError(toMessage(err));
    } finally {
      setCancelReasonBusy(false);
    }
  }
  function onPickSearchPlace(place: Place, mode: "browse" | "tow"): void {
    if (mode === "tow") {
      if (editDestFor) {
        void applyDestinationEdit(editDestFor, place);
        return;
      }
      if (place.source === "shop" && typeof place.id === "string") {
        onPickTowShop(place);
      } else {
        onPickTowPlace(place);
      }
      return;
    }
    if (place.source === "shop" && typeof place.id === "string") {
      setShopSearchMode(null);
      onPickSearch(place.id);
      return;
    }
    setShopSearchMode(null);
    setMapSel({label: place.label, lat: place.lat, lng: place.lng});
  }
  async function onAdvanceStatus(ticket: FeedTicket, status: string): Promise<void> {
    if (!token || recBusy) return;
    setRecBusy(true);
    setError(null);
    try {
      await updateTicketStatus(ticket.id, status, token);
      await reloadAll();
      if (status === DISPATCH_STATUS.ARRIVED) setNotice(t.assist.arrivedNotice);
      if (status === DISPATCH_STATUS.RESOLVED) await refreshBills();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setRecBusy(false);
    }
  }
  async function onLoadRatings(ticket: FeedTicket): Promise<void> {
    if (!token) return;
    try {
      const list = await ratingsByTicket(ticket.id, token);
      setTicketRatings((prev) => ({...prev, [ticket.id]: list}));
    } catch (err) {
      setError(toMessage(err));
    }
  }
  async function onReplyRating(ratingId: string, text: string): Promise<void> {
    if (!token || recBusy || text === "") return;
    setRecBusy(true);
    setError(null);
    try {
      await replyRating(ratingId, text, token);
      setNotice(t.rating.replied);
      await reloadAll();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setRecBusy(false);
    }
  }
  function onRateRider(ticket: FeedTicket): void {
    setRatingFor(ticket);
    setRatingRider(true);
  }
  async function navigateJobFor(ticket: FeedTicket): Promise<void> {
    if (!token || recBusy) return;
    setRecBusy(true);
    setError(null);
    try {
      setDetailFor(null);
      setBoardDetail(null);
      setTowPreviewMap(false);
      if (ticket.ticketType === "SOS") {
        await startSosNavigation(ticket);
      } else {
        await startTowNavigation(ticket);
      }
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setRecBusy(false);
    }
  }
  async function onLocate(): Promise<void> {
    if (locateBusy) return;
    setLocateBusy(true);
    setError(null);
    try {
      const p = await currentPoint();
      setGps(p);
      safeCameraReady(mapReadyRef.current && mapFocusedRef.current, () => cameraRef.current?.setStop({center: [p.lng, p.lat], zoom: 15, duration: 600}));
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setLocateBusy(false);
    }
  }
  return {activateVehicle, active, activeEta, activeFeed, activeId, activeIsOut, activeJobLine, activeName, activeVehicle, applyCenter, applyDestinationEdit, arrivedHintRef, assistFocused, billForTicket, bills, boardDetail, boardToFeed, browsing, bundle, cameraRef, cardCollapsed, cardH, centerOnLocal, centeredRef, cancelReasonBusy, cancelReasonError, cancelReasonFor, chatArchiveFor, chatFor, checkedIn, closeBoardDetail, closeShopSheet, closingSoon, closingWarn, completeMobileTowAccept, continuationBusy, continuationError, continuationFor, currentPoint, description, dest, destShopId, detailContext, detailFor, disputeBusy, disputeError, disputeFor, dueCount, dueTotal, duplicateFor, editDestFor, error, estimateBusy, estimateError, estimateFor, feed, fetchAssistShops, fetchTowRoute, fitWalk, fittedJobRef, fundedForApproval, gps, hasJobCard, hasShopRole, hasVehicle, imHereBusy, insets, isOwnTowJob, isRider, isTowRequest, jobLayers, jobRoute, jobRouteKey, jobRouteRetry, lang, liveTicketConflict, liveTow, liveTowNoDest, liveTowNoDestOut, liveTowTone, loadActive, loadTowPreview, loading, locateBusy, mapFocusedRef, mapReadyRef, mapSearchFrom, mapSel, mine, mobileFixBusy, mobileFixError, mobileFixFor, mobileShopFixPoint, mobileShopOnDuty, navBusy, navEnded, navigateJobFor, navigateToPoint, navigation, nearbyOnly, nearbySos, nearbyTow, needsDropOff, note, notice, onAcceptTicket, onAddTicketPhotos, onAdvanceStatus, onApproveEstimate, onApproveFinal, onApproveQuote, onCancel, onConfirmCash, onConfirmClosingWarn, onConfirmContinuation, onDeclineDestinationTicket, onDeclineEstimate, onDeclineTicket, onFileDispute, onImHere, onLoadRatings, onLocate, onMarkUnfixable, onNavigateMap, onNavigateToShop, onOfferMobileTow, onOpenBoardTicket, onOpenDestinationCard, onOpenShopCard, onOpenTowRequest, onPickRadiusShop, onPickSearch, onPickSearchPlace, onPickTowPlace, onPickTowShop, onPreviewTowRoute, onRate, onRateRider, onRegisterShop, onReleaseSos, onReplyRating, onReport, onRequest, onRetryPhotos, onRespondMobileTow, onRespondReturnTow, onSaveMobileFix, onSendEstimate, onSendWithoutPhotos, onSubmitCancelReason, onSubmitRating, onSubmitWork, onVehiclePress, onWalkPreview, openBadge, openBill, openShopSheet, ownLiveSos, ownLiveTow, ownMobileShopId, ownProviders, ownShopIds, ownShopProviderId, ownTowId, payeeBillList, payments, pendingCenterRef, pendingDropName, pendingOwnSos, pendingOwnTow, pendingTicket, photoError, photos, photosBusy, pillForShop, prevTicketType, provider, providerLiveJob, providerOf, providerRecords, query, radius, radiusSearchFrom, rateTarget, ratedScores, ratingBusy, ratingFor, ratingRider, recBusy, refreshBills, reloadAll, reportBusy, reportError, reportFor, reportNote, reportReason, reqBusy, riderRecords, scheme, section, setActive, setBoardDetail, setCardCollapsed, setCardH, setCancelReasonFor, setChatArchiveFor, setChatFor, setCheckedIn, setClosingWarn, setContinuationBusy, setContinuationError, setContinuationFor, setDescription, setDest, setDestShopId, setDetailContext, setDetailFor, setDisputeBusy, setDisputeError, setDisputeFor, setDuplicateFor, setEditDestFor, setError, setEstimateBusy, setEstimateError, setEstimateFor, setFeed, setGps, setImHereBusy, setJobRoute, setJobRouteRetry, setLoading, setLocateBusy, setMapSearchFrom, setMapSel, setMine, setMobileFixBusy, setMobileFixError, setMobileFixFor, setNavBusy, setNavEnded, setNearbySos, setNearbyTow, setNote, setNotice, setOwnProviders, setPayeeBillList, setPayments, setPendingTicket, setPhotoError, setPhotos, setPhotosBusy, setQuery, setRadius, setRadiusSearchFrom, setRatedScores, setRatingBusy, setRatingFor, setRatingRider, setRecBusy, setReportBusy, setReportError, setReportFor, setReportNote, setReportReason, setReqBusy, setSection, setShopJobs, setShopReviews, setShopSearchMode, setShopSel, setShopSheet, setTicketRatings, setTicketType, setTowDestError, setTowLocationMissing, setTowOfferAcceptFor, setTowPreview, setTowPreviewMap, setTowRadius, setUnfixableBusy, setUnfixableError, setUnfixableFor, setVehicleOpen, setWaiting, setWalkBusy, setWalkRoute, setWorkBusy, setWorkError, setWorkFor, setWorkspace, sheetFor, shopJobs, shopReviews, shopSearchMode, shopSel, shopSheet, showShops, sosProviderPoint, startNavSession, startSosNavigation, startTowNavigation, storedFeed, t, theme, ticketRatings, ticketType, token, towDestError, towJobs, towLegsFor, towLocationMissing, towOfferAcceptFor, towOnDuty, towPreview, towPreviewMap, towRadius, towRequests, towSummary, uid, unfixableBusy, unfixableError, unfixableFor, vehicleClass, vehicleOpen, waiting, walkBusy, walkRoute, workBusy, workError, workFor, workspace, workspaceTouchedRef};
}
