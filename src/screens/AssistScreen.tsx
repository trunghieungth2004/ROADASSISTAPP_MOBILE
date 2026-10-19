import {useCallback, useEffect, useRef, useState} from "react";
import {ActivityIndicator, BackHandler, Keyboard, Pressable, ScrollView, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "../components/ui/AppText";
import {MaterialCommunityIcons, MaterialIcons} from "@expo/vector-icons";
import * as Location from "expo-location";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {useFocusEffect, useIsFocused, useNavigation} from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type {CameraRef} from "@maplibre/maplibre-react-native";
import {acceptTicket, approveFinalQuote, approveEstimate, approveQuote, bustTicketCaches, cancelTicket, confirmCashReceipt, createTicket, declineDestination, declineEstimate, declineTicket, estimateTowFare, feedTickets, fileDispute, getTicket, nearTickets, refreshTowEta, refreshWaiting, reportUnfixable, sendEstimate, sendQuote, updateTicketDestination, updateTicketStatus, updateWorkOrder, type DeclineReason, type DispatchTicket, type FeedTicket, type TicketPayment, type TicketType} from "../api/dispatch";
import {myProviders, pingProviderLocation, providerRatings, reportProvider, searchProviders, REPORT_REASONS, type Provider, type ProviderRating, type ReportReason} from "../api/providers";
import {ratingsByTicket, replyRating, submitRating, type UserRating} from "../api/ratings";
import {findRoute, type RouteOption} from "../api/routes";
import {toMessage, ApiError} from "../api/client";
import type {Place} from "../components/place-search";
import {useAuth} from "../context/AuthContext";
import {useProfile} from "../context/ProfileContext";
import {useNavSession} from "../context/NavSessionContext";
import {useStrings} from "../context/LanguageContext";
import {darkTheme, lightTheme} from "../theme";
import Snack from "../components/ui/Snack";
import Overlay from "../components/overlay/Overlay";
import StatusRow from "../components/ui/StatusRow";
import {snackBottom} from "../components/ui/snackOffset";
import {Fab, FabColumn} from "../components/ui/Fab";
import VehiclePickerSheet from "../components/vehicles/VehiclePickerSheet";
import {ensurePushConfigured, drainDispatchLaunch, subscribeDispatchPush} from "../services/push";
import {capturePosition, markBeat, useLocationBeat} from "../services/locationBeats";
import {getFix} from "../services/geo";
import {statusPillColor, ticketStatusLabel, ticketTitle, ticketTypeLabel} from "./assist/ticketLabels";
import {announcesShopPush, canSeeRequestPhotos, retargetableLiveTicket} from "./assist/recordActions";
import {vehicleClassOf} from "./assist/vehicleClass";
import AssistSectionTabs, {type AssistSection} from "./assist/AssistSectionTabs";
import RequestSection from "./assist/RequestSection";
import TowSection from "./assist/TowSection";
import {fetchShopPlaces, isRepairPlace} from "../components/place-search/shopMerge";
import MapPickOverlay from "../components/map/MapPickOverlay";
import PlaceSearchScreen from "./PlaceSearchScreen";
import ShopsSection from "./assist/ShopsSection";
import RecordsSection from "./assist/RecordsSection";
import RecordDetailSheet from "./assist/RecordDetailSheet";
import TicketSheet from "./assist/TicketSheet";
import DisputeSheet from "./assist/DisputeSheet";
import EstimateSheet from "./assist/EstimateSheet";
import WorkSheet, {type WorkFormMode, type WorkFormValue} from "./assist/WorkSheet";
import UnfixableSheet from "./assist/UnfixableSheet";
import {isPhotoPermissionError, takePhoto, uploadPhotoPaths} from "../services/photos";
import RatingSheet from "./assist/RatingSheet";
import {boundsOf} from "./route/routeGeo";
import {HCMC_CENTER} from "./route/types";
import {shouldRetryCenter} from "./route/cameraIntent";
import {distBetween} from "./navigation/navUtils";
import AssistMapView from "./assist/AssistMapView";
import ShopRadiusOverlay from "./assist/ShopRadiusOverlay";
import {declinedShopIds, hasDropOff, towDestOf, type TowRouteTicket} from "./assist/towDest";
import TowRoutePreview from "./assist/TowRoutePreview";
import {checkInAtShop} from "./assist/checkIn";
import ShopDetailSheet from "./assist/ShopDetailSheet";
import {IM_HERE_RADIUS_M, TOW_RADII, WALK_RADII, walkMinutes} from "./assist/walkShop";

const ACTIVE_KEY = "roadassist.activeTicket";

export default function AssistScreen() {
  const {t, lang} = useStrings();
  const {token, uid} = useAuth();
  const {activeVehicle, activateVehicle, bundle, hasVehicle} = useProfile();
  const [ownProviders, setOwnProviders] = useState<Provider[]>([]);
  const provider = (bundle?.user.services ?? []).includes("VOLUNTEER") ||
    ownProviders.some((p) => p.kind === "TOW" && p.status === "ACTIVE");
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation() as unknown as {navigate: (name: string, params?: Record<string, unknown>) => void; setOptions: (options: {title?: string; headerShown?: boolean}) => void};
  const cameraRef = useRef<CameraRef | null>(null);
  const centeredRef = useRef(false);
  const pendingCenterRef = useRef<{lat: number; lng: number} | null>(null);
  const [ticketType, setTicketType] = useState<TicketType | null>(null);
  const [note, setNote] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photosBusy, setPhotosBusy] = useState(false);
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
  const [workFor, setWorkFor] = useState<{ticket: FeedTicket; mode: WorkFormMode} | null>(null);
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
  const [ticketRatings, setTicketRatings] = useState<Record<string, UserRating[]>>({});
  const [recBusy, setRecBusy] = useState(false);
  const [detailFor, setDetailFor] = useState<FeedTicket | null>(null);
  const [boardDetail, setBoardDetail] = useState<FeedTicket | null>(null);
  const [editDestFor, setEditDestFor] = useState<FeedTicket | null>(null);
  const [duplicateFor, setDuplicateFor] = useState<{ticketId: string} | null>(null);
  const [towPreview, setTowPreview] = useState<{ticketId: string; route: RouteOption | null; fareEstimate: number | null; busy: boolean; error: string | null} | null>(null);
  const [towPreviewMap, setTowPreviewMap] = useState(false);
  const [jobRoute, setJobRoute] = useState<{ticketId: string; key: string; route: RouteOption | null} | null>(null);
  useEffect(() => {
    setDetailFor((prev) => {
      if (!prev) return prev;
      return feed.find((t) => t.id === prev.id) ?? prev;
    });
  }, [feed]);
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [nearbyTow, setNearbyTow] = useState<DispatchTicket[]>([]);
  const [gps, setGps] = useState<{lat: number; lng: number} | null>(null);
  const [active, setActive] = useState<DispatchTicket | null>(null);
  const [reportFor, setReportFor] = useState<{id: string; name: string} | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason>("FAKE_BUSINESS");
  const [reportNote, setReportNote] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const towOnDuty = ownProviders.some((item) => item.kind === "TOW" && item.status === "ACTIVE" && item.accepting !== false && item.suspended !== true);
  const ownTowId = ownProviders.find((item) => item.kind === "TOW" && item.status === "ACTIVE")?.id ?? null;
  const storedFeed = active ? feed.find((entry) => entry.id === active.id) ?? null : null;
  const ownLiveTow = storedFeed === null ? feed.find((t) => t.direction === "out" && t.ticketType === "TOW" && (t.status === "2" || t.status === "3")) ?? null : null;
  const activeFeed = storedFeed ?? ownLiveTow;
  const needsDropOff = activeFeed === null ? feed.find((t) => t.direction === "out" && t.ticketType === "TOW" && t.status === "1" && towDestOf(t) === null) ?? null : null;
  const pendingOwnTow = activeFeed === null && needsDropOff === null ? feed.find((t) => t.direction === "out" && t.ticketType === "TOW" && t.status === "1" && towDestOf(t) !== null) ?? null : null;
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
  const liveTow = activeFeed !== null && activeFeed.ticketType === "TOW" && (activeFeed.status === "2" || activeFeed.status === "3");
  const liveTowNoDest = liveTow && activeFeed !== null && !hasDropOff(activeFeed);
  const liveTowNoDestOut = liveTowNoDest && activeFeed !== null && activeFeed.direction === "out";
  const liveTowTone = liveTowNoDest ? "#f59e0b" : theme.primary;
  const activeName = activeFeed !== null && typeof activeFeed.otherParty === "object" && activeFeed.otherParty !== null && typeof activeFeed.otherParty.name === "string" ?
    activeFeed.otherParty.name :
    t.assist.unassigned;
  const activeEta = activeFeed !== null && activeFeed.ticketType === "TOW" && typeof activeFeed.etaPickupAt === "string" ?
    Math.round((Date.parse(activeFeed.etaPickupAt) - Date.now()) / 60000) :
    null;
  function activeJobLine(): string {
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
  const jobLayers = liveTow && activeFeed ? {
    tower: activeFeed.direction === "out" ?
      (activeFeed.towerFix ? {lat: activeFeed.towerFix.lat, lng: activeFeed.towerFix.lng} : null) :
      gps,
    pickup: {lat: activeFeed.lat, lng: activeFeed.lng},
    dest: towDestOf(activeFeed),
    status: activeFeed.status,
    route: jobRoute && jobRoute.ticketId === activeFeed.id ? jobRoute.route : null,
  } : null;
  const jobRouteKey = liveTow && activeFeed ? `${activeFeed.id}:${activeFeed.status}:${JSON.stringify(towDestOf(activeFeed) ?? null)}` : null;
  useEffect(() => {
    if (!jobRouteKey || !liveTow || !activeFeed || !token) {
      if (!jobRouteKey) setJobRoute(null);
      return;
    }
    if (jobRoute && jobRoute.ticketId === activeFeed.id && jobRoute.key === jobRouteKey) return;
    const ticket = activeFeed;
    const key = jobRouteKey;
    let alive = true;
    void fetchTowRoute(ticket, ticket.status === "3").then((route) => {
      if (!alive) return;
      setJobRoute({ticketId: ticket.id, key, route});
      if (route) {
        const b = boundsOf(route.geometry.coordinates);
        if (b) {
          void cameraRef.current?.fitBounds([b.sw[0], b.sw[1], b.ne[0], b.ne[1]], {padding: {top: 80, right: 60, bottom: 340, left: 60}, duration: 800});
        }
      }
    }).catch(() => {
      if (alive) setJobRoute({ticketId: ticket.id, key, route: null});
    });
    return () => {
      alive = false;
    };
  });
  const assistFocused = useIsFocused();
  const hasJobCard = (liveTow && activeFeed !== null) || needsDropOff !== null || pendingOwnTow !== null;
  useEffect(() => {
    setCardCollapsed(hasJobCard);
  }, [hasJobCard]);
  useLocationBeat(!!token && towOnDuty && assistFocused, active ? 60 * 1000 : 5 * 60 * 1000, async () => {
    if (!token) return;
    const pos = await capturePosition();
    if (!pos) return;
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
  const [query, setQuery] = useState("");
  const [imHereBusy, setImHereBusy] = useState(false);
  const [ratingFor, setRatingFor] = useState<DispatchTicket | null>(null);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [ratingRider, setRatingRider] = useState(false);
  const [ratedScores, setRatedScores] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cardH, setCardH] = useState(0);
  const [cardCollapsed, setCardCollapsed] = useState(false);
  const vehicleClass = vehicleClassOf(activeVehicle?.type);
  const showShops = vehicleClass !== "CAR";
  const browsing = section === "request" && ticketType === "MECHANIC" && showShops;

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
    void cam.setStop({center: [pending.lng, pending.lat], zoom: 15, duration: 800});
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
    if (b) void cameraRef.current?.fitBounds([b.sw[0], b.sw[1], b.ne[0], b.ne[1]], {padding: {top: 80, right: 60, bottom: 340, left: 60}, duration: 800});
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
      const [fetched, feedList] = await Promise.all([
        myProviders(token).catch((): Provider[] => []),
        feedTickets(undefined, token).catch((): FeedTicket[] => []),
      ]);
      setFeed(feedList);
      setOwnProviders(fetched);
      const gate = (bundle?.user.services ?? []).includes("VOLUNTEER") ||
        fetched.some((item) => item.kind === "TOW" && item.status === "ACTIVE");
      if (gate) {
        if (!granted) throw new Error(t.nav.locationDenied);
        if (pos) {
          setNearbyTow(await nearTickets(pos.lat, pos.lng, token, undefined, "TOW").catch((): DispatchTicket[] => []));
        } else {
          setNearbyTow([]);
        }
      } else {
        setNearbyTow([]);
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
  }, [reloadAll]));
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
    const pts = [...(jobLayers.tower ? [jobLayers.tower] : gps ? [gps] : []), jobLayers.pickup];
    if (jobLayers.dest) pts.push(jobLayers.dest);
    const b = boundsOf(pts.map((p) => [p.lng, p.lat] as [number, number]));
    if (b) void cameraRef.current?.fitBounds([b.sw[0], b.sw[1], b.ne[0], b.ne[1]], {padding: {top: 80, right: 60, bottom: 340, left: 60}, duration: 800});
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
    ensurePushConfigured();
    const applyLaunch = (data: {ticketId: string; ticketType?: string; status?: string} | null): void => {
      if (!data) return;
      if (token) bustTicketCaches(token);
      void (async () => {
        await reloadAll();
        if (data.status && token) void loadActive(data.ticketId, token);
        if (data.ticketType === "WALK_IN") {
          setSection("records");
          return;
        }
        if (!token) return;
        const rows = await feedTickets(undefined, token).catch((): FeedTicket[] => []);
        const mine = new Set(ownProviders.map((p) => p.id));
        if (announcesShopPush(rows, mine, data.ticketId)) {
          setSection("records");
          setNotice(t.assist.newTowAtShop);
          return;
        }
        if (!data.status && data.ticketType === "TOW" && ownTowId !== null) {
          setSection("tow");
          setNotice(t.assist.newTowNearby);
        }
      })();
    };
    void drainDispatchLaunch().then(applyLaunch);
    return subscribeDispatchPush((data) => {
      applyLaunch(data);
    }, "assist");
  }, [reloadAll, loadActive, token, ownProviders]);
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
    void cameraRef.current?.setStop({center: [shop.lng, shop.lat], zoom: 15, duration: 600});
  }
  function onPickRadiusShop(shop: Provider, mode: "browse" | "tow"): void {
    if (mode === "tow") {
      if (editDestFor) {
        void applyDestinationEdit(editDestFor, {label: shop.name, lat: shop.lat, lng: shop.lng, source: "shop", id: shop.id});
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
      else void cameraRef.current?.setStop({center: [shop.lng, shop.lat], zoom: 15, duration: 600});
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
      startNavSession({route: first, dest, stops: [], seed: live, ...(activeVehicle?.baseWidth !== undefined ? {width: activeVehicle.baseWidth} : {}), ...(activeVehicle?.type ? {vehicleType: activeVehicle.type} : {}), ...(shop ? {checkIn: {providerId: shop.id, name: shop.name}} : {})});
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
      startNavSession({route: warn.route, dest: {lat: warn.shop.lat, lng: warn.shop.lng}, stops: [], seed: warn.seed, ...(activeVehicle?.baseWidth !== undefined ? {width: activeVehicle.baseWidth} : {}), ...(activeVehicle?.type ? {vehicleType: activeVehicle.type} : {}), checkIn: {providerId: warn.shop.id, name: warn.shop.name}});
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
      kind: record.kind === "TOW" ? "TOW" : "SHOP",
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
    const shop = providerOf(ticket.destinationParty, fallback);
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
  function towLegsFor(ticket: TowRouteTicket): {origin: {lat: number; lng: number}; pickup: {lat: number; lng: number}; dest: {lat: number; lng: number} | null} | null {
    if (!gps) return null;
    return {origin: gps, pickup: {lat: ticket.lat, lng: ticket.lng}, dest: towDestOf(ticket)};
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
  ) {
    const hasVolunteer = (bundle?.user.services ?? []).includes("VOLUNTEER");
    const ownShopIds = new Set(ownProviders.filter((item) => item.kind === "SHOP").map((item) => item.id));
    const showRequestPhotos = canSeeRequestPhotos(ticket, ownShopIds, uid, hasVolunteer);
    const ownTowAccepting = ownProviders.some((item) => item.kind === "TOW" && item.status === "ACTIVE" && item.accepting !== false);
    const acceptOffDuty = ticket.ticketType === "TOW" &&
      ticket.status === "1" &&
      ownTowId !== null &&
      !ownTowAccepting &&
      !hasVolunteer;
    const acceptHidden = (ticket.ticketType === "TOW" &&
      ticket.status === "1" &&
      ownTowId === null &&
      !hasVolunteer) || acceptOffDuty;
    return (
      <RecordDetailSheet
        t={t}
        lang={lang}
        ticket={ticket}
        ratings={ticketRatings[ticket.id] ?? []}
        busy={recBusy}
        gps={gps}
        uid={uid}
        hasRated={ratedScores[ticket.id] !== undefined}
        onClose={onCloseSheet}
        onConfirmCancel={(id) => void onCancel(id)}
        onRate={(item) => onRate(item)}
        onAccept={(item) => void onAcceptTicket(item)}
        onDecline={decline === null ? null : (item, reason, note) => void onDeclineTicket(item, reason, note)}
        onOpenWork={(item) => { setWorkFor({ticket: item, mode: "done"}); setWorkError(null); }}
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
          return live.ticketType === "TOW" && (live.status === "2" || live.status === "3") && ownTowId !== null && live.assignedShopId === ownTowId ?
            (item) => void navigateJobFor(item) :
            null;
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
        onRequeue={(item) => void onRequeueTicket(item)}
        payment={payments[ticket.id] ?? null}
        waiting={waiting[ticket.id] ?? null}
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
        void cameraRef.current?.setStop({center: [shop.lng, shop.lat], zoom: 15, duration: 600});
      } catch (err) {
        setError(toMessage(err));
      }
    })();
  }
  function onPickTowShop(place: Place): void {
    if (typeof place.id !== "string") return;
    setDestShopId(place.id);
    setDest({label: place.label, lat: place.lat, lng: place.lng, source: "map"});
    setTowDestError(null);
    setShopSearchMode(null);
  }
  function onPickTowPlace(place: Place): void {
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
    setImHereBusy(true);
    setError(null);
    try {
      await checkInAtShop({
        providerId: shop.id,
        token,
        vehicleType: activeVehicle?.type,
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
  function rateTarget(ticket: DispatchTicket): {targetId: string; targetKind: "VOLUNTEER" | "SHOP"} | null {
    if (typeof ticket.assignedUid === "string" && ticket.assignedUid) return {targetId: ticket.assignedUid, targetKind: "VOLUNTEER"};
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
  async function onRequest(force = false): Promise<void> {
    if (!token || !pendingTicket) return;
    const kind = pendingTicket;
    if (kind === "TOW" && !dest) {
      setTowDestError(t.assist.towNeedsDest);
      setError(t.assist.towNeedsDest);
      return;
    }
    setReqBusy(true);
    setError(null);
    setNotice(null);
    try {
      Keyboard.dismiss();
      const point = await currentPoint();
      let photoUrls: string[] | undefined;
      let photoUploadFailed = false;
      if (photos.length > 0) {
        try {
          photoUrls = await uploadPhotoPaths(`dispatch/pending-${Date.now()}`, photos);
        } catch {
          photoUrls = undefined;
          photoUploadFailed = true;
        }
      }
      await createTicket({ticketType: kind, lat: point.lat, lng: point.lng, note: note.trim() || undefined, ...(description.trim() ? {description: description.trim().slice(0, 1000)} : {}), ...(photoUrls && photoUrls.length > 0 ? {photoUrls} : {}), destinationShopId: kind === "TOW" ? destShopId ?? undefined : undefined, destinationPoint: kind === "TOW" && dest ? {lat: dest.lat, lng: dest.lng, label: dest.label} : undefined, vehicleType: activeVehicle?.type, vehicleWidth: activeVehicle?.baseWidth, ...(force ? {force: true} : {})}, token);
      setPendingTicket(null);
      setDuplicateFor(null);
      setNotice(photoUploadFailed ? t.photos.uploadFailed : t.assist.requested);
      setNote("");
      setDescription("");
      setPhotos([]);
      setTowDestError(null);
      setDest(null);
      setDestShopId(null);
      await reloadAll();
    } catch (err) {
      const conflict = !force ? liveTicketConflict(err) : null;
      if (conflict !== null) {
        setDuplicateFor({ticketId: conflict});
        return;
      }
      setError(toMessage(err));
    } finally {
      setReqBusy(false);
    }
  }
  async function onAddTicketPhotos(): Promise<void> {
    if (photosBusy) return;
    setPhotosBusy(true);
    setError(null);
    try {
      const picked = await takePhoto();
      if (picked.length > 0) setPhotos((prev) => [...prev, ...picked].slice(0, 5));
    } catch (err) {
      setError(isPhotoPermissionError(err) ? t.photos.cameraDenied : toMessage(err));
    } finally {
      setPhotosBusy(false);
    }
  }
  async function onRequeueTicket(ticket: FeedTicket): Promise<void> {
    if (!token || recBusy) return;
    setRecBusy(true);
    setError(null);
    try {
      const point = await getFix();
      await createTicket({ticketType: ticket.ticketType as TicketType, lat: point.lat, lng: point.lng, ...(Array.isArray(ticket.photoUrls) && ticket.photoUrls.length > 0 ? {photoUrls: ticket.photoUrls} : {}), ...(typeof ticket.note === "string" && ticket.note ? {note: ticket.note} : {}), ...(typeof ticket.description === "string" && ticket.description ? {description: ticket.description} : {}), ...(ticket.destinationShopId ? {destinationShopId: ticket.destinationShopId} : {}), ...(ticket.destinationPoint ? {destinationPoint: ticket.destinationPoint} : {}), ...(typeof ticket.vehicleType === "string" ? {vehicleType: ticket.vehicleType} : {}), ...(typeof ticket.vehicleWidth === "number" ? {vehicleWidth: ticket.vehicleWidth} : {})}, token);
      setDetailFor(null);
      setBoardDetail(null);
      setNotice(t.assist.requeued);
      await reloadAll();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setRecBusy(false);
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
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setRecBusy(false);
    }
  }
  function fundedForApproval(ticket: FeedTicket): boolean {
    const live = payments[ticket.id] ?? null;
    const method = typeof live?.method === "string" ? live.method : typeof ticket.paymentMethod === "string" ? ticket.paymentMethod : null;
    const status = typeof live?.status === "string" ? live.status : typeof ticket.paymentStatus === "string" ? ticket.paymentStatus : null;
    return (method === "CASH" && (status === "PENDING" || status === "CONFIRMED")) || (method === "SEPAY" && (status === "HELD" || status === "CONFIRMED"));
  }
  function openBill(ticket: FeedTicket): void {
    setDetailFor(null);
    navigation.navigate("BillDetail", {ticketId: ticket.id});
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
      const uploaded = await uploadPhotoPaths(`dispatch/unfixable-${unfixableFor.id}`, photos);
      if (uploaded.length === 0) {
        setUnfixableError(t.assist.unfixableNeedPhoto);
        return;
      }
      await reportUnfixable(unfixableFor.id, reason, uploaded, token);
      setUnfixableFor(null);
      setNotice(t.assist.unfixableSent);
      await reloadAll();
    } catch (err) {
      setUnfixableError(toMessage(err));
    } finally {
      setUnfixableBusy(false);
    }
  }
  function liveTicketConflict(err: unknown): string | null {
    if (err instanceof ApiError && err.statusCode === 409) {
      const errors = err.errors as {ticketId?: unknown} | null | undefined;
      if (errors && typeof errors.ticketId === "string" && errors.ticketId !== "") return errors.ticketId;
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
    const fromBoard = boardDetail !== null && boardDetail.id === ticket.id;
    const addressed = typeof ticket.providerId === "string" && ticket.providerId ? ticket.providerId : null;
    const isVolunteer = (bundle?.user.services ?? []).includes("VOLUNTEER");
    const shopId = addressed ?? (ticket.ticketType === "TOW" ? ownTowId : null);
    const volunteerPath = shopId === null && ticket.ticketType === "TOW" && (fromBoard || isVolunteer);
    if (shopId === null && !volunteerPath) {
      setError(ticket.ticketType === "TOW" ? t.assist.towOperatorsOnly : t.assist.alreadyGone);
      return;
    }
    setRecBusy(true);
    setError(null);
    try {
      await acceptTicket(ticket.id, token, shopId ?? undefined);
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
  async function onDeclineDestinationTicket(ticket: FeedTicket): Promise<void> {
    if (!token || recBusy) return;
    setRecBusy(true);
    setError(null);
    try {
      await declineDestination(ticket.id, token);
      setNotice(t.provider.declineSent);
      setDetailFor(null);
      closeBoardDetail();
      await reloadAll();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setRecBusy(false);
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
      await startTowNavigation(ticket);
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
      void cameraRef.current?.setStop({center: [p.lng, p.lat], zoom: 15, duration: 600});
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setLocateBusy(false);
    }
  }
  return (
    <View style={styles.root}>
      <AssistMapView
        theme={theme}
        cameraRef={cameraRef}
        gps={gps}
        dest={ticketType === "TOW" && dest ? {lat: dest.lat, lng: dest.lng} : null}
        selectedShop={browsing ? (shopSheet ?? shopSel) : null}
        pillTextForShop={pillForShop}
        walkRoute={browsing ? walkRoute : null}
        jobLayers={jobLayers}
        onMapReady={() => applyCenter()}
      />
      {liveTow && activeFeed ? (
        <View style={[styles.bottomContainer, {bottom: insets.bottom + 12}]}>
          <Pressable style={[styles.innerCard, styles.activeCard, {backgroundColor: theme.paper, borderColor: liveTowTone}]} onPress={() => setDetailFor(activeFeed)} accessibilityRole="button" accessibilityLabel={ticketTitle(activeFeed, t)}>
            <View style={styles.activeHead}>
              <MaterialCommunityIcons name="tow-truck" size={20} color={liveTowTone} />
              <Text style={[styles.cardTitle, styles.activeTitle, {color: theme.text}]}>{t.assist.activeJob}</Text>
              <View style={[styles.pill, {backgroundColor: statusPillColor(activeFeed.status, theme)}]}>
                <Text style={styles.pillText}>{ticketStatusLabel(activeFeed.status, t)}</Text>
              </View>
            </View>
            <Text style={[styles.coords, {color: theme.muted}]}>{activeJobLine()}</Text>
            {liveTowNoDestOut ? <Text style={[styles.coords, {color: "#f59e0b"}]}>{t.assist.noDropOff}</Text> : null}
            {liveTowNoDest && !liveTowNoDestOut ? <Text style={[styles.coords, {color: "#f59e0b"}]}>{t.assist.waitingDropOff}</Text> : null}
          </Pressable>
        </View>
      ) : needsDropOff ? (
        <View style={[styles.bottomContainer, {bottom: insets.bottom + 12}]}>
          <Pressable style={[styles.innerCard, styles.activeCard, {backgroundColor: theme.paper, borderColor: "#f59e0b"}]} onPress={() => setDetailFor(needsDropOff)} accessibilityRole="button" accessibilityLabel={ticketTitle(needsDropOff, t)}>
            <View style={styles.activeHead}>
              <MaterialCommunityIcons name="tow-truck" size={20} color="#f59e0b" />
              <Text style={[styles.cardTitle, styles.activeTitle, {color: theme.text}]}>{t.assist.activeJob} · {ticketTypeLabel(needsDropOff.ticketType, t)}</Text>
              <View style={[styles.pill, {backgroundColor: statusPillColor(needsDropOff.status, theme)}]}>
                <Text style={styles.pillText}>{ticketStatusLabel(needsDropOff.status, t)}</Text>
              </View>
            </View>
            <Text style={[styles.coords, {color: theme.muted}]}>{t.assist.noDropOff}</Text>
          </Pressable>
        </View>
      ) : pendingOwnTow ? (
        <View style={[styles.bottomContainer, {bottom: insets.bottom + 12}]}>
          <Pressable style={[styles.innerCard, styles.activeCard, {backgroundColor: theme.paper, borderColor: theme.border}]} onPress={() => setDetailFor(pendingOwnTow)} accessibilityRole="button" accessibilityLabel={ticketTitle(pendingOwnTow, t)}>
            <View style={styles.activeHead}>
              <MaterialCommunityIcons name="tow-truck" size={20} color={theme.primary} />
              <Text style={[styles.cardTitle, styles.activeTitle, {color: theme.text}]}>{t.assist.activeJob} · {ticketTypeLabel(pendingOwnTow.ticketType, t)}</Text>
              <View style={[styles.pill, {backgroundColor: statusPillColor(pendingOwnTow.status, theme)}]}>
                <Text style={styles.pillText}>{ticketStatusLabel(pendingOwnTow.status, t)}</Text>
              </View>
            </View>
            <Text style={[styles.coords, {color: theme.muted}]}>{t.assist.dropOffPoint} · {pendingDropName(pendingOwnTow)}</Text>
          </Pressable>
        </View>
      ) : null}
      <FabColumn top={insets.top + 24 + cardH}>
        <Fab theme={theme} label={t.common.currentLocation} disabled={locateBusy} onPress={() => void onLocate()}>
          {locateBusy ? <ActivityIndicator size="small" color={theme.primary} /> : <MaterialIcons name="my-location" size={22} color={theme.primary} />}
        </Fab>
        <Fab theme={theme} label={t.assist.refresh} disabled={loading} onPress={() => void reloadAll()}>
          {loading ? <ActivityIndicator size="small" color={theme.primary} /> : <MaterialIcons name="refresh" size={22} color={theme.primary} />}
        </Fab>
      </FabColumn>
      <View style={[styles.topContainer, {top: insets.top + 12}]}>
        <View onLayout={(e) => setCardH(e.nativeEvent.layout.height)} style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <ScrollView contentContainerStyle={styles.cardScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {cardCollapsed && hasJobCard ? null : (
            <>
            <AssistSectionTabs
              theme={theme}
              tabs={[
                {id: "request", label: t.assist.sectionRequest},
                ...(provider ? [{id: "tow", label: t.assist.sectionTow}] : []),
                {id: "records", label: t.assist.sectionRecords},
              ]}
              selected={section}
              onChange={(id) => setSection(id as AssistSection)}
            />
            {section === "request" ? (
              <>
              <RequestSection
                t={t}
                theme={theme}
                ticketType={ticketType}
                onTicketType={setTicketType}
                showMechanic={showShops}
                onOpenTicket={(kind) => { prevTicketType.current = ticketType; setDest(null); setDestShopId(null); setTowDestError(null); setDescription(""); setPhotos([]); setPendingTicket(kind); }}
                vehicleType={activeVehicle?.type ?? null}
                hasVehicles={hasVehicle}
                onOpenVehicle={() => setVehicleOpen(true)}
              />
              </>
            ) : null}
            {browsing ? (
              vehicleClass ? (
                <ShopsSection
                  t={t}
                  theme={theme}
                  query={query}
                  onOpenSearch={() => setShopSearchMode("browse")}
                  mapSel={mapSel}
                  onClearMapSel={() => setMapSel(null)}
                  onNavigateMapSel={() => {
                    if (mapSel) void navigateToPoint(mapSel);
                  }}
                  onRegisterShop={() => onRegisterShop()}
                  shopSel={shopSel}
                  walkRoute={walkRoute}
                  walkBusy={walkBusy}
                  navBusy={navBusy}
                  onClearShop={() => { setShopSel(null); setWalkRoute(null); }}
                  onNavigate={(shop) => void onNavigateToShop(shop)}
                />
              ) : (
                <Text style={[styles.hint, {color: theme.muted}]}>{t.shop.noVehicle}</Text>
              )
            ) : null}
            {section === "tow" && provider ? (
              <TowSection
                t={t}
                theme={theme}
                tickets={nearbyTow}
                loading={loading}
                onOpen={(id) => onOpenBoardTicket(id)}
              />
            ) : null}
            {section === "records" ? (
              <RecordsSection
                t={t}
                theme={theme}
                tickets={feed}
                loading={loading}
                shopKinds={new Map(
                  ownProviders
                    .filter((p) => p.status !== "DENIED" && (p.kind === "SHOP" || p.kind === "TOW"))
                    .map((p) => [p.id, p.kind]),
                )}
                onOpen={(ticket) => {
                  setDetailFor(ticket);
                  if (ticket.status === "4") void onLoadRatings(ticket);
                }}
              />
            ) : null}
            </>
            )}
            {detailFor ? (
              sheetFor(detailFor, () => setDetailFor(null), (ticket, reason, note) => void onDeclineTicket(ticket, reason, note))
            ) : null}
            {boardDetail ? (
              sheetFor(boardDetail, () => setBoardDetail(null), null)
            ) : null}
          </ScrollView>
          {hasJobCard ? (
            <Pressable style={styles.collapseBar} onPress={() => setCardCollapsed((v) => !v)} accessibilityRole="button" accessibilityLabel={cardCollapsed ? t.assist.expandPanel : t.assist.collapsePanel}>
              <MaterialIcons name={cardCollapsed ? "expand-more" : "expand-less"} size={22} color={theme.primary} />
              <Text style={[styles.collapseText, {color: theme.text}]}>{cardCollapsed ? t.assist.expandPanel : t.assist.collapsePanel}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {shopSheet ? (
        <ShopDetailSheet
          t={t}
          shop={shopSheet}
          openLabel={openBadge(shopSheet).label}
          openColor={openBadge(shopSheet).color}
          walkBusy={walkBusy}
          navBusy={navBusy}
          imHereBusy={imHereBusy}
          jobs={shopJobs[shopSheet.id] ?? null}
          reviews={shopReviews[shopSheet.id] ?? null}
          onReport={() => {
            setReportReason("FAKE_BUSINESS");
            setReportNote("");
            setReportError(null);
            setReportFor({id: shopSheet.id, name: shopSheet.name});
            closeShopSheet();
          }}
          onWalkHere={() => void onWalkPreview(shopSheet)}
          onRouteFromHere={() => void onNavigateToShop(shopSheet)}
          onImHere={shopSheet && gps && distBetween(gps, {lat: shopSheet.lat, lng: shopSheet.lng}) <= IM_HERE_RADIUS_M ? () => void onImHere(shopSheet) : null}
          onClose={() => closeShopSheet()}
        />
      ) : null}
      {vehicleOpen ? (
        <Overlay visible variant="sheet" title={t.vehicle.title} closeLabel={t.common.cancel} onClose={() => setVehicleOpen(false)}>
          <VehiclePickerSheet t={t} theme={theme} token={token} activeId={activeVehicle?.id ?? null} onPick={(id) => void onVehiclePress(id)} onAddVehicle={() => { setVehicleOpen(false); navigation.navigate("Vehicle" as never); }} />
        </Overlay>
      ) : null}
      {ratingFor ? (
        <RatingSheet
          t={t}
          ticket={ratingFor}
          initialScore={ratedScores[ratingFor.id] ?? null}
          initialComment={(ticketRatings[ratingFor.id] ?? []).find((r) => r.byUserId === uid)?.text ?? null}
          busy={ratingBusy}
          onSubmit={(score, comment) => void onSubmitRating(score, comment)}
          onClose={() => { setRatingFor(null); setRatingRider(false); }}
        />
      ) : null}
      {pendingTicket ? (
        <TicketSheet
          t={t}
          theme={theme}
          ticketType={pendingTicket}
          note={note}
          onNote={setNote}
          towDest={
            <View style={{gap: 8}}>
              <Pressable
                style={[styles.destField, {borderColor: theme.border}]}
                onPress={() => setShopSearchMode("tow")}
                accessibilityRole="button"
                accessibilityLabel={t.common.searchPlaceholder}
              >
                <Text style={{color: dest ? theme.text : theme.muted}} numberOfLines={1}>
                  {dest ? dest.label : t.common.searchPlaceholder}
                </Text>
              </Pressable>
              {dest ? (
                <Pressable
                  style={[styles.destClear, {borderColor: theme.border}]}
                  onPress={() => {
                    setDest(null);
                    setDestShopId(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t.route.clear}
                >
                  <Text style={{color: theme.muted}}>{t.route.clear}</Text>
                </Pressable>
              ) : null}
            </View>
          }
          busy={reqBusy}
          onSubmit={() => void onRequest()}
          onClose={() => { setPendingTicket(null); setTicketType(prevTicketType.current); }}
          description={description}
          onDescription={setDescription}
          photos={photos}
          photosBusy={photosBusy}
          onAddPhotos={() => void onAddTicketPhotos()}
          onRemovePhoto={(index) => setPhotos((prev) => prev.filter((_, i) => i !== index))}
          destError={towDestError}
        />
      ) : null}
      {duplicateFor ? (
        <Overlay
          visible
          variant="dialog"
          title={t.assist.duplicateTitle}
          closeLabel={t.common.cancel}
          onClose={() => setDuplicateFor(null)}
          actions={(() => {
            const row = retargetableLiveTicket(feed, duplicateFor.ticketId);
            const file = {label: t.assist.fileAnyway, tone: "primary", busy: reqBusy, onPress: () => void onRequest(true)} as const;
            const keep = {label: t.assist.keepRequest, tone: "neutral", outline: true, onPress: () => setDuplicateFor(null)} as const;
            if (row) {
              return [
                {label: t.assist.changeDropOff, tone: "primary", busy: reqBusy, onPress: () => { setDuplicateFor(null); setDetailFor(row); setEditDestFor(row); setShopSearchMode("tow"); }},
                file,
                keep,
              ];
            }
            return [file, keep];
          })()}
        >
          <Text style={{color: theme.text}}>{t.assist.duplicateMessage.replace("{ticket}", (() => {
            const row = feed.find((t) => t.id === duplicateFor.ticketId) ?? null;
            return row ? ticketTitle(row, t) : (pendingTicket ? ticketTypeLabel(pendingTicket, t) : "");
          })())}</Text>
        </Overlay>
      ) : null}
      {shopSearchMode ? (
        <Overlay visible variant="fullScreen" closeLabel={t.common.cancel} onClose={() => { Keyboard.dismiss(); setShopSearchMode(null); setEditDestFor(null); }}>
          <PlaceSearchScreen
            t={t}
            token={token ?? undefined}
            lang={lang}
            title={shopSearchMode === "tow" ? t.assist.dropOffPoint : t.shop.searchPlaceholder}
            placeholder={shopSearchMode === "tow" ? t.route.searchDestination : t.shop.searchPlaceholder}
            shops={fetchAssistShops}
            filters={{sortBy: "distance", ...(editDestFor ? {ticketId: editDestFor.id} : {})}}
            sources={shopSearchMode === "tow" ? ["saved", "shop", "directory", "map"] : ["shop", "map"]}
            mapFilter={isRepairPlace}
            query={query}
            onQuery={setQuery}
            onPick={(place) => onPickSearchPlace(place, shopSearchMode)}
            disabledIds={editDestFor !== null && shopSearchMode === "tow" ? declinedShopIds(editDestFor) : undefined}
            disabledNote={t.assist.shopDeclined}
            onPickOnMap={() => {
              Keyboard.dismiss();
              setMapSearchFrom(shopSearchMode);
              setShopSearchMode(null);
            }}
            onBrowseNearby={() => {
              Keyboard.dismiss();
              setRadiusSearchFrom(shopSearchMode);
              setShopSearchMode(null);
            }}
            onClose={() => { Keyboard.dismiss(); setShopSearchMode(null); setEditDestFor(null); }}
          />
        </Overlay>
      ) : null}
      <Overlay visible={mapSearchFrom !== null} variant="fullScreen" closeLabel={t.common.cancel} onClose={() => setMapSearchFrom(null)}>
        <MapPickOverlay
          t={t}
          lang={lang}
          title={mapSearchFrom === "tow" ? t.assist.dropOffPoint : t.shop.searchPlaceholder}
          initial={mapSel}
          onPick={(lat, lng, label) => {
            const mode = mapSearchFrom;
            setMapSearchFrom(null);
            if (mode) onPickSearchPlace({label, lat, lng, source: "map"}, mode);
          }}
          onClose={() => { setMapSearchFrom(null); setEditDestFor(null); }}
        />
      </Overlay>
      <Overlay visible={radiusSearchFrom !== null} variant="fullScreen" closeLabel={t.common.cancel} onClose={() => { setRadiusSearchFrom(null); setEditDestFor(null); }}>
        <ShopRadiusOverlay
          t={t}
          token={token}
          gps={gps}
          vehicleClass={vehicleClass ?? undefined}
          radii={radiusSearchFrom === "tow" ? TOW_RADII : WALK_RADII}
          radius={radiusSearchFrom === "tow" ? towRadius : radius}
          onRadius={(r) => {
            if (radiusSearchFrom === "tow") setTowRadius(r);
            else setRadius(r);
          }}
          mode={radiusSearchFrom === "tow" ? "tow" : "browse"}
          card={{
            walkBusy,
            navBusy,
            imHereBusy,
            canImHere: (shop) => !!gps && distBetween(gps, {lat: shop.lat, lng: shop.lng}) <= IM_HERE_RADIUS_M,
            onWalkHere: (shop) => {
              setRadiusSearchFrom(null);
              void onWalkPreview(shop);
            },
            onRouteFromHere: (shop) => {
              setRadiusSearchFrom(null);
              void onNavigateToShop(shop);
            },
            onReport: (shop) => {
              setRadiusSearchFrom(null);
              setReportReason("FAKE_BUSINESS");
              setReportNote("");
              setReportError(null);
              setReportFor({id: shop.id, name: shop.name});
            },
            onImHere: (shop) => {
              setRadiusSearchFrom(null);
              void onImHere(shop);
            },
          }}
          onUseShop={(shop) => onPickRadiusShop(shop, "tow")}
          onClose={() => setRadiusSearchFrom(null)}
        />
      </Overlay>
      <Overlay visible={towPreviewMap} variant="fullScreen" closeLabel={t.common.cancel} onClose={() => setTowPreviewMap(false)}>
        {(() => {
          const legs = boardDetail ? towLegsFor(boardDetail) : null;
          const route = towPreview && boardDetail && towPreview.ticketId === boardDetail.id ? towPreview.route : null;
          if (!legs || !route || !boardDetail) return null;
          return (
            <TowRoutePreview
              t={t}
              summary={towSummary(route, legs.dest !== null)}
              route={route}
              origin={legs.origin}
              pickup={legs.pickup}
              dest={legs.dest}
              busy={recBusy}
              onAccept={() => void onAcceptTicket(boardDetail)}
              onClose={() => setTowPreviewMap(false)}
            />
          );
        })()}
      </Overlay>
      <Overlay
        visible={closingWarn !== null}
        variant="dialog"
        title={t.shop.closingSoonTitle}
        closeLabel={t.common.cancel}
        onClose={() => setClosingWarn(null)}
        actions={[
          {label: t.common.cancel, tone: "neutral", outline: true, onPress: () => setClosingWarn(null)},
          {label: t.shop.closingGo, tone: "primary", onPress: () => void onConfirmClosingWarn()},
        ]}
      >
        {closingWarn ? (
          <Text style={[styles.hint, {color: theme.text}]}>
            {t.shop.closingSoonMsg.replace("{shop}", closingWarn.shop.name).replace("{close}", String(closingWarn.closesIn)).replace("{eta}", String(closingWarn.etaMin))}
          </Text>
        ) : null}
      </Overlay>
      <Overlay
        visible={reportFor !== null}
        variant="dialog"
        title={reportFor ? `${t.report.title} · ${reportFor.name}` : t.report.title}
        closeLabel={t.common.cancel}
        onClose={() => setReportFor(null)}
        actions={[{label: t.report.submit, tone: "primary", busy: reportBusy, onPress: () => void onReport()}]}
      >
        {reportError ? <Text style={[styles.hint, {color: theme.danger}]}>{reportError}</Text> : null}
        <View style={styles.row}>
          {REPORT_REASONS.map((reason) => (
            <Pressable key={reason} onPress={() => setReportReason(reason)} style={[styles.chip, {borderColor: theme.primary}, reportReason === reason && {backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{checked: reportReason === reason}}>
              <Text style={{color: reportReason === reason ? "#fff" : theme.text}}>{{FAKE_BUSINESS: t.report.reasonFakeBusiness, WRONG_LOCATION: t.report.reasonWrongLocation, UNSAFE: t.report.reasonUnsafe, HARASSMENT: t.report.reasonHarassment, SPAM: t.report.reasonSpam, INFO_INACCURATE: t.report.reasonInfoInaccurate, OTHER: t.report.reasonOther}[reason]}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} placeholder={t.report.notePlaceholder} placeholderTextColor={theme.muted} value={reportNote} onChangeText={setReportNote} maxLength={280} />
      </Overlay>
      {estimateFor ? (
        <EstimateSheet
          t={t}
          ticketLabel={ticketTypeLabel(estimateFor.ticketType, t)}
          status={estimateFor.status}
          busy={estimateBusy}
          error={estimateError}
          initialAmount={typeof estimateFor.estimateAmount === "number" ? estimateFor.estimateAmount : null}
          initialNote={typeof estimateFor.estimateNote === "string" ? estimateFor.estimateNote : null}
          onSubmit={(amount, note) => void onSendEstimate(amount, note)}
          onClose={() => {
            setEstimateFor(null);
            setEstimateError(null);
          }}
        />
      ) : null}
      {workFor ? (
        <WorkSheet
          t={t}
          ticketLabel={ticketTitle(workFor.ticket, t)}
          mode={workFor.mode}
          status={workFor.ticket.status}
          busy={workBusy}
          error={workError}
          initialWorkType={typeof workFor.ticket.workType === "string" ? workFor.ticket.workType : null}
          initialInvoiceRef={typeof workFor.ticket.invoiceRef === "string" ? workFor.ticket.invoiceRef : null}
          onSubmit={(value) => void onSubmitWork(value)}
          onClose={() => {
            setWorkFor(null);
            setWorkError(null);
          }}
        />
      ) : null}
      {disputeFor ? (
        <DisputeSheet
          t={t}
          ticketLabel={ticketTitle(disputeFor, t)}
          busy={disputeBusy}
          error={disputeError}
          onSubmit={(reason, noteText, photoUri) => void onFileDispute(reason, noteText, photoUri)}
          onClose={() => { setDisputeFor(null); setDisputeError(null); }}
        />
      ) : null}
      {unfixableFor ? (
        <UnfixableSheet
          t={t}
          ticketLabel={ticketTitle(unfixableFor, t)}
          busy={unfixableBusy}
          error={unfixableError}
          onSubmit={(reason, photos) => void onMarkUnfixable(reason, photos)}
          onClose={() => { setUnfixableFor(null); setUnfixableError(null); }}
        />
      ) : null}
      {error ? (
        <Snack message={error} severity="error" sticky bottom={snackBottom(insets.bottom)} dangerColor={theme.danger} onHide={() => setError(null)} />
      ) : (
        <Snack message={notice} severity="confirm" bottom={snackBottom(insets.bottom)} accentColor={theme.primary} onHide={() => setNotice(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  topContainer: {position: "absolute", left: 12, right: 12},
  bottomContainer: {position: "absolute", left: 12, right: 12},
  activeHead: {flexDirection: "row", alignItems: "center", gap: 8},
  pill: {borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10},
  pillText: {color: "#fff", fontSize: 12, fontWeight: "700"},
  card: {width: "100%", borderWidth: 1, borderRadius: 16, padding: 12, maxHeight: 420, overflow: "hidden"},
  cardScroll: {gap: 8, paddingBottom: 4},
  section: {fontSize: 16, fontWeight: "700", marginTop: 8},
  row: {flexDirection: "row", gap: 8, flexWrap: "wrap"},
  chip: {borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12},
  input: {borderWidth: 1, borderRadius: 8, padding: 10},
  disabled: {opacity: 0.6},
  innerCard: {borderWidth: 1, borderRadius: 12, padding: 12, gap: 6},
  activeCard: {borderWidth: 2},
  cardTitle: {fontWeight: "700"},
  activeTitle: {flex: 1},
  coords: {fontSize: 12},
  destField: {borderWidth: 1, borderRadius: 8, padding: 10},
  destClear: {borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, alignSelf: "flex-start"},
  collapseBar: {flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 6},
  collapseText: {fontSize: 12, fontWeight: "700"},
  hint: {fontSize: 12},
});
