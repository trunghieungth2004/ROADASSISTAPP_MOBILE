
import {ActivityIndicator, Keyboard, Pressable, StyleSheet, View} from "react-native";

import {AppText as Text, AppTextInput as TextInput} from "../components/ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";






import {isTerminal} from "../api/dispatch";


import {REPORT_REASONS} from "../api/providers";











import Snack from "../components/ui/Snack";
import Overlay from "../components/overlay/Overlay";

import {snackBottom} from "../components/ui/snackOffset";
import {Fab, FabColumn} from "../components/ui/Fab";
import VehiclePickerSheet from "../components/vehicles/VehiclePickerSheet";



import {ticketTitle, ticketTypeLabel} from "./assist/ticketLabels";
import {retargetableLiveTicket} from "./assist/recordActions";

import AssistSectionTabs, {type AssistSection} from "./assist/AssistSectionTabs";
import RequestSection from "./assist/RequestSection";
import TowSection from "./assist/TowSection";
import MobileShopSection from "./assist/MobileShopSection";
import MobileFixSheet from "./assist/MobileFixSheet";
import ChatSheet from "./assist/ChatSheet";
import {isRepairPlace} from "../components/place-search/shopMerge";
import MapPickOverlay from "../components/map/MapPickOverlay";
import PlaceSearchScreen from "./PlaceSearchScreen";
import ShopsSection from "./assist/ShopsSection";
import RecordsSection from "./assist/RecordsSection";

import BillStrip from "./assist/BillStrip";
import TicketSheet from "./assist/TicketSheet";
import DisputeSheet from "./assist/DisputeSheet";
import EstimateSheet from "./assist/EstimateSheet";
import WorkSheet from "./assist/WorkSheet";
import UnfixableSheet from "./assist/UnfixableSheet";
import CancelReasonSheet from "./assist/CancelReasonSheet";
import {SHOP_DECLINE_REASONS, TOWER_CANCEL_REASONS, shopDeclineReasonLabel, towerCancelReasonLabel} from "./assist/cancelReasons";
import SosContinuationSheet from "./assist/SosContinuationSheet";

import RatingSheet from "./assist/RatingSheet";



import {distBetween} from "./navigation/navUtils";
import AssistMapView from "./assist/AssistMapView";
import AssistTopPanel from "./assist/AssistTopPanel";
import ActiveJobCard from "./assist/ActiveJobCard";
import ShopRadiusOverlay from "./assist/ShopRadiusOverlay";
import {declinedShopIds} from "./assist/towDest";

import TowRoutePreview from "./assist/TowRoutePreview";

import ShopDetailSheet from "./assist/ShopDetailSheet";
import {IM_HERE_RADIUS_M, TOW_RADII, WALK_RADII} from "./assist/walkShop";

const ACTIVE_KEY = "roadassist.activeTicket";
import useAssistController from "./assist/useAssistController";

export default function AssistScreen() {
  const {activateVehicle, active, activeEta, activeFeed, activeId, activeIsOut, activeJobLine, activeName, activeVehicle, applyCenter, applyDestinationEdit, arrivedHintRef, assistFocused, billForTicket, bills, boardDetail, boardToFeed, browsing, bundle, cameraRef, cardCollapsed, cardH, centerOnLocal, centeredRef, cancelReasonBusy, cancelReasonError, cancelReasonFor, chatArchiveFor, chatFor, checkedIn, closeBoardDetail, closeShopSheet, closingSoon, closingWarn, completeMobileTowAccept, continuationBusy, continuationError, continuationFor, currentPoint, description, dest, destShopId, detailContext, detailFor, disputeBusy, disputeError, disputeFor, dueCount, dueTotal, duplicateFor, editDestFor, error, estimateBusy, estimateError, estimateFor, feed, fetchAssistShops, fetchTowRoute, fitWalk, fittedJobRef, fundedForApproval, gps, hasJobCard, hasShopRole, hasVehicle, imHereBusy, insets, isOwnTowJob, isRider, isTowRequest, jobLayers, jobRoute, jobRouteKey, jobRouteRetry, lang, liveTicketConflict, liveTow, liveTowNoDest, liveTowNoDestOut, liveTowTone, loadActive, loadTowPreview, loading, locateBusy, mapFocusedRef, mapReadyRef, mapSearchFrom, mapSel, mine, mobileFixBusy, mobileFixError, mobileFixFor, mobileShopFixPoint, mobileShopOnDuty, navBusy, navEnded, navigateJobFor, navigateToPoint, navigation, nearbyOnly, nearbySos, nearbyTow, needsDropOff, note, notice, onAcceptTicket, onAddTicketPhotos, onAdvanceStatus, onApproveEstimate, onApproveFinal, onApproveQuote, onCancel, onConfirmCash, onConfirmClosingWarn, onConfirmContinuation, onDeclineDestinationTicket, onDeclineEstimate, onDeclineTicket, onFileDispute, onImHere, onLoadRatings, onLocate, onMarkUnfixable, onNavigateMap, onNavigateToShop, onOfferMobileTow, onOpenBoardTicket, onOpenDestinationCard, onOpenShopCard, onOpenTowRequest, onPickRadiusShop, onPickSearch, onPickSearchPlace, onPickTowPlace, onPickTowShop, onPreviewTowRoute, onRate, onRateRider, onRegisterShop, onReleaseSos, onReplyRating, onReport, onRequest, onRetryPhotos, onRespondMobileTow, onRespondReturnTow, onSaveMobileFix, onSendEstimate, onSendWithoutPhotos, onSubmitCancelReason, onSubmitRating, onSubmitWork, onVehiclePress, onWalkPreview, openBadge, openBill, openShopSheet, ownLiveSos, ownLiveTow, ownMobileShopId, ownProviders, ownShopIds, ownShopProviderId, ownTowId, payeeBillList, payments, pendingCenterRef, pendingDropName, pendingOwnSos, pendingOwnTow, pendingTicket, photoError, photos, photosBusy, pillForShop, prevTicketType, provider, providerLiveJob, providerOf, providerRecords, query, radius, radiusSearchFrom, rateTarget, ratedScores, ratingBusy, ratingFor, ratingRider, recBusy, refreshBills, reloadAll, reportBusy, reportError, reportFor, reportNote, reportReason, reqBusy, riderRecords, scheme, section, setActive, setBoardDetail, setCardCollapsed, setCardH, setCancelReasonFor, setChatArchiveFor, setChatFor, setCheckedIn, setClosingWarn, setContinuationBusy, setContinuationError, setContinuationFor, setDescription, setDest, setDestShopId, setDetailContext, setDetailFor, setDisputeBusy, setDisputeError, setDisputeFor, setDuplicateFor, setEditDestFor, setError, setEstimateBusy, setEstimateError, setEstimateFor, setFeed, setGps, setImHereBusy, setJobRoute, setJobRouteRetry, setLoading, setLocateBusy, setMapSearchFrom, setMapSel, setMine, setMobileFixBusy, setMobileFixError, setMobileFixFor, setNavBusy, setNavEnded, setNearbySos, setNearbyTow, setNote, setNotice, setOwnProviders, setPayeeBillList, setPayments, setPendingTicket, setPhotoError, setPhotos, setPhotosBusy, setQuery, setRadius, setRadiusSearchFrom, setRatedScores, setRatingBusy, setRatingFor, setRatingRider, setRecBusy, setReportBusy, setReportError, setReportFor, setReportNote, setReportReason, setReqBusy, setSection, setShopJobs, setShopReviews, setShopSearchMode, setShopSel, setShopSheet, setTicketRatings, setTicketType, setTowDestError, setTowLocationMissing, setTowOfferAcceptFor, setTowPreview, setTowPreviewMap, setTowRadius, setUnfixableBusy, setUnfixableError, setUnfixableFor, setVehicleOpen, setWaiting, setWalkBusy, setWalkRoute, setWorkBusy, setWorkError, setWorkFor, setWorkspace, sheetFor, shopJobs, shopReviews, shopSearchMode, shopSel, shopSheet, showShops, sosProviderPoint, startNavSession, startSosNavigation, startTowNavigation, storedFeed, t, theme, ticketRatings, ticketType, token, towDestError, towJobs, towLegsFor, towLocationMissing, towOfferAcceptFor, towOnDuty, towPreview, towPreviewMap, towRadius, towRequests, towSummary, uid, unfixableBusy, unfixableError, unfixableFor, vehicleClass, vehicleOpen, waiting, walkBusy, walkRoute, workBusy, workError, workFor, workspace, workspaceTouchedRef} = useAssistController();  return (
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
        onMapReady={() => { mapReadyRef.current = true; applyCenter(); }}
      />
      {liveTow && activeFeed ? (
        <View style={[styles.bottomContainer, {bottom: insets.bottom + 12}]}>
          <ActiveJobCard
            t={t}
            theme={theme}
            ticket={activeFeed}
            title={activeFeed.ticketType === "SOS" ? `${t.assist.activeJob} · ${ticketTypeLabel(activeFeed.ticketType, t)}` : t.assist.activeJob}
            line={activeJobLine()}
            icon={activeFeed.ticketType === "SOS" ? "sos" : "tow"}
            tone={liveTowTone}
            warning={liveTowNoDestOut ? t.assist.noDropOff : liveTowNoDest ? t.assist.waitingDropOff : null}
            onPress={() => setDetailFor(activeFeed)}
          />
        </View>
      ) : needsDropOff ? (
        <View style={[styles.bottomContainer, {bottom: insets.bottom + 12}]}>
          <ActiveJobCard
            t={t}
            theme={theme}
            ticket={needsDropOff}
            title={`${t.assist.activeJob} · ${ticketTypeLabel(needsDropOff.ticketType, t)}`}
            line={t.assist.noDropOff}
            icon="pending"
            tone="#f59e0b"
            onPress={() => setDetailFor(needsDropOff)}
          />
        </View>
      ) : pendingOwnTow ? (
        <View style={[styles.bottomContainer, {bottom: insets.bottom + 12}]}>
          <ActiveJobCard
            t={t}
            theme={theme}
            ticket={pendingOwnTow}
            title={`${t.assist.activeJob} · ${ticketTypeLabel(pendingOwnTow.ticketType, t)}`}
            line={`${t.assist.towRequested} · ${t.assist.findingTower} · ${pendingDropName(pendingOwnTow)}`}
            icon="tow"
            tone={theme.border}
            iconTone={theme.primary}
            onPress={() => setDetailFor(pendingOwnTow)}
          />
        </View>
      ) : pendingOwnSos ? (
        <View style={[styles.bottomContainer, {bottom: insets.bottom + 12}]}>
          <ActiveJobCard
            t={t}
            theme={theme}
            ticket={pendingOwnSos}
            title={`${t.assist.activeJob} · ${ticketTypeLabel(pendingOwnSos.ticketType, t)}`}
            line={t.assist.findingShop}
            icon="sos"
            tone={theme.border}
            iconTone={theme.primary}
            onPress={() => setDetailFor(pendingOwnSos)}
          />
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
      <AssistTopPanel
        theme={theme}
        top={insets.top + 12}
        hasJobCard={hasJobCard}
        collapsed={cardCollapsed}
        onToggle={() => setCardCollapsed(true)}
        onShow={() => setCardCollapsed(false)}
        showLabel={t.assist.expandPanel}
        collapseLabel={t.assist.collapsePanel}
        expandLabel={t.assist.expandPanel}
        billStrip={<BillStrip t={t} theme={theme} bills={bills} dueCount={dueCount} dueTotal={dueTotal} onOpen={() => navigation.navigate("Bills" as never)} />}
        onLayoutHeight={setCardH}
      >
            {isRider && provider && detailFor === null && boardDetail === null ? (
              <View style={[styles.workspaceSwitch, {borderColor: theme.border}]}>
                {(["rider", "provider"] as const).map((mode) => {
                  const selected = workspace === mode;
                  return (
                    <Pressable
                      key={mode}
                      style={[styles.workspaceBtn, selected && {backgroundColor: theme.primary}]}
                      onPress={() => {
                        workspaceTouchedRef.current = true;
                        setWorkspace(mode);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{selected}}
                      accessibilityLabel={mode === "rider" ? t.assist.recordRider : t.assist.recordProvider}
                    >
                      <Text style={{color: selected ? "#fff" : theme.text, fontSize: 12, fontWeight: "700"}}>
                        {mode === "rider" ? t.assist.recordRider : t.assist.recordProvider}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            <AssistSectionTabs
              theme={theme}
              tabs={[
                {id: "request", label: t.assist.sectionRequest},
                {id: "records", label: t.assist.sectionRecords},
              ]}
              selected={section}
              onChange={(id) => setSection(id as AssistSection)}
            />
            {section === "request" ? (
              workspace === "provider" ? (
                <View style={styles.stack}>
                  {mobileShopOnDuty ? (
                    <MobileShopSection
                      t={t}
                      theme={theme}
                      tickets={nearbySos}
                      loading={loading}
                      locationMissing={towLocationMissing}
                      onOpen={(ticket) => {
                        setDetailContext("shop");
                        setDetailFor(ticket);
                      }}
                    />
                  ) : null}
                  {ownTowId !== null ? (
                    <TowSection
                      t={t}
                      theme={theme}
                      tickets={nearbyOnly}
                      jobs={[]}
                      requests={towRequests}
                      loading={loading}
                      locationMissing={towLocationMissing}
                      onOpen={(id) => onOpenBoardTicket(id)}
                      onOpenJob={(ticket) => {
                        setDetailContext("tow");
                        setDetailFor(ticket);
                        if (ticket.status === "4") void onLoadRatings(ticket);
                      }}
                      onOpenRequest={(ticket) => void onOpenTowRequest(ticket)}
                    />
                  ) : null}
                </View>
              ) : (
                <RequestSection
                  t={t}
                  theme={theme}
                  ticketType={ticketType}
                  onTicketType={setTicketType}
                  showMechanic={showShops}
                  onOpenTicket={(kind) => { prevTicketType.current = ticketType; setDest(null); setDestShopId(null); setTowDestError(null); setDescription(""); setPhotos([]); setPhotoError(null); setPendingTicket(kind); }}
                  vehicleType={activeVehicle?.type ?? null}
                  hasVehicles={hasVehicle}
                  onOpenVehicle={() => setVehicleOpen(true)}
                />
              )
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
            {section === "records" ? (
              <RecordsSection
                t={t}
                theme={theme}
                tickets={provider ? (workspace === "provider" ? providerRecords : riderRecords) : feed}
                loading={loading}
                shopKinds={new Map(
                  ownProviders
                    .filter((p) => p.status !== "DENIED" && (p.kind === "SHOP" || p.kind === "TOW" || p.kind === "MOBILE_SHOP"))
                    .map((p) => [p.id, p.kind as "SHOP" | "TOW" | "MOBILE_SHOP"]),
                )}
                onOpen={(ticket) => {
                  setDetailContext("shop");
                  setDetailFor(ticket);
                  if (ticket.status === "4") void onLoadRatings(ticket);
                }}
              />
            ) : null}
      </AssistTopPanel>
      {detailFor ? (
        sheetFor(detailFor, () => setDetailFor(null), (ticket, reason, note) => void onDeclineTicket(ticket, reason, note), detailContext)
      ) : null}
      {boardDetail ? (
        sheetFor(boardDetail, () => setBoardDetail(null), null, "tow")
      ) : null}
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
          onClose={() => { setPendingTicket(null); setPhotoError(null); setTicketType(prevTicketType.current); }}
          description={description}
          onDescription={setDescription}
          photos={photos}
          photosBusy={photosBusy}
          onAddPhotos={() => void onAddTicketPhotos()}
          onRemovePhoto={(index) => { setPhotos((prev) => prev.filter((_, i) => i !== index)); setPhotoError(null); }}
          destError={towDestError}
          photoError={photoError}
          onRetryPhotos={onRetryPhotos}
          onSubmitWithoutPhotos={onSendWithoutPhotos}
        />
      ) : null}
      {vehicleOpen ? (
        <Overlay visible variant="sheet" title={t.vehicle.title} closeLabel={t.common.cancel} onClose={() => setVehicleOpen(false)}>
          <VehiclePickerSheet t={t} theme={theme} token={token} activeId={activeVehicle?.id ?? null} onPick={(id) => void onVehiclePress(id)} onAddVehicle={() => { setVehicleOpen(false); navigation.navigate("Vehicle" as never); }} />
        </Overlay>
      ) : null}
      {duplicateFor ? (
        <Overlay
          visible
          variant="dialog"
          title={duplicateFor.reason === "VEHICLE_BUSY" ? t.assist.vehicleBusyTitle : t.assist.duplicateTitle}
          closeLabel={t.common.cancel}
          onClose={() => setDuplicateFor(null)}
          actions={(() => {
            const row = feed.find((t) => t.id === duplicateFor.ticketId) ?? null;
            const keep = {label: t.assist.keepRequest, tone: "neutral", outline: true, onPress: () => setDuplicateFor(null)} as const;
            if (duplicateFor.reason === "VEHICLE_BUSY") {
              return [
                ...(row ? [{label: t.assist.viewTicket, tone: "primary" as const, onPress: () => { setDuplicateFor(null); setDetailFor(row); }}] : []),
                keep,
              ];
            }
            const target = retargetableLiveTicket(feed, duplicateFor.ticketId);
            if (target) {
              return [
                {label: t.assist.changeDropOff, tone: "primary", busy: reqBusy, onPress: () => { setDuplicateFor(null); setDetailFor(target); setEditDestFor(target); setShopSearchMode("tow"); }},
                keep,
              ];
            }
            return [keep];
          })()}
        >
          <Text style={{color: theme.text}}>{duplicateFor.reason === "VEHICLE_BUSY" ? t.assist.vehicleBusyMessage : t.assist.duplicateMessage.replace("{ticket}", (() => {
            const row = feed.find((t) => t.id === duplicateFor.ticketId) ?? null;
            return row ? ticketTitle(row, t) : (pendingTicket ? ticketTypeLabel(pendingTicket, t) : "");
          })())}</Text>
        </Overlay>
      ) : null}
      {shopSearchMode ? (
        <Overlay visible variant="fullScreen" closeLabel={t.common.cancel} onClose={() => { Keyboard.dismiss(); setShopSearchMode(null); setEditDestFor(null); setTowOfferAcceptFor(null); }}>
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
            onClose={() => { Keyboard.dismiss(); setShopSearchMode(null); setEditDestFor(null); setTowOfferAcceptFor(null); }}
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
          onClose={() => { setMapSearchFrom(null); setEditDestFor(null); setTowOfferAcceptFor(null); }}
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
        actionLayout="confirm"
        actions={[
          {label: t.common.cancel, tone: "neutral", outline: true, group: "secondary", onPress: () => setClosingWarn(null)},
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
      {chatFor && token ? (
        <ChatSheet
          t={t}
          token={token}
          uid={uid}
          scope="TICKET"
          refId={chatFor.id}
          title={ticketTitle(chatFor, t)}
          ticketType={chatFor.ticketType}
          status={chatFor.status}
          otherName={chatFor.otherParty?.name ?? null}
          version={chatFor.chatVersion ?? 0}
          readOnly={isTerminal(chatFor.status)}
          onClose={() => setChatFor(null)}
        />
      ) : null}
      {chatArchiveFor && token ? (
        <ChatSheet
          t={t}
          token={token}
          uid={uid}
          scope="TICKET"
          refId={chatArchiveFor.ticket.id}
          title={t.chat.previousChat}
          ticketType={chatArchiveFor.ticket.ticketType}
          version={chatArchiveFor.version}
          archived
          readOnly
          onClose={() => setChatArchiveFor(null)}
        />
      ) : null}
      {mobileFixFor ? (
        <MobileFixSheet
          t={t}
          ticketLabel={ticketTitle(mobileFixFor, t)}
          busy={mobileFixBusy}
          error={mobileFixError}
          initialAmount={typeof mobileFixFor.finalAmount === "number" ? mobileFixFor.finalAmount : null}
          onSubmit={(amount) => void onSaveMobileFix(amount)}
          onClose={() => {
            setMobileFixFor(null);
            setMobileFixError(null);
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
          ticketType={disputeFor.ticketType}
          viewer={disputeFor.direction === "out" ? "RIDER" : "PROVIDER"}
          busy={disputeBusy}
          error={disputeError}
          onSubmit={(reason, noteText, photoUri) => void onFileDispute(reason, noteText, photoUri)}
          onClose={() => { setDisputeFor(null); setDisputeError(null); }}
        />
      ) : null}
      {continuationFor ? (
        <SosContinuationSheet
          t={t}
          ticketLabel={ticketTitle(continuationFor.ticket, t)}
          attempt={continuationFor.nextAttempt}
          callOutTotal={continuationFor.callOutTotal}
          busy={continuationBusy}
          error={continuationError}
          onConfirm={() => void onConfirmContinuation()}
          onCancel={() => { setContinuationFor(null); setContinuationError(null); }}
        />
      ) : null}
      {unfixableFor ? (
        <UnfixableSheet
          t={t}
          ticketLabel={ticketTitle(unfixableFor, t)}
          busy={unfixableBusy}
          error={unfixableError}
          callOutWaived={unfixableFor.mobileCallOutWaived === true || unfixableFor.mobileCallOutFee === 0}
          onSubmit={(reason, photos) => void onMarkUnfixable(reason, photos)}
          onClose={() => { setUnfixableFor(null); setUnfixableError(null); }}
        />
      ) : null}
      {cancelReasonFor ? (
        <CancelReasonSheet
          t={t}
          title={cancelReasonFor.kind === "TOWER" ? t.assist.towerCancelReasonTitle : t.assist.shopDeclineReasonTitle}
          reasons={cancelReasonFor.kind === "TOWER" ? TOWER_CANCEL_REASONS : SHOP_DECLINE_REASONS}
          labelFor={cancelReasonFor.kind === "TOWER" ? towerCancelReasonLabel : shopDeclineReasonLabel}
          busy={cancelReasonBusy}
          error={cancelReasonError}
          onSubmit={(reason) => void onSubmitCancelReason(reason)}
          onClose={() => { setCancelReasonFor(null); }}
        />
      ) : null}
      {error ? (
        <Snack message={error} severity="error" bottom={snackBottom(insets.bottom)} dangerColor={theme.danger} onHide={() => setError(null)} />
      ) : (
        <Snack message={notice} severity="confirm" bottom={snackBottom(insets.bottom)} accentColor={theme.primary} onHide={() => setNotice(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  bottomContainer: {position: "absolute", left: 12, right: 12},
  stack: {gap: 8},
  workspaceSwitch: {flexDirection: "row", alignSelf: "flex-start", borderWidth: 1, borderRadius: 999, padding: 2, gap: 2},
  workspaceBtn: {borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12, alignItems: "center"},
  section: {fontSize: 16, fontWeight: "700", marginTop: 8},
  row: {flexDirection: "row", gap: 8, flexWrap: "wrap"},
  chip: {borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12},
  input: {borderWidth: 1, borderRadius: 8, padding: 10},
  disabled: {opacity: 0.6},
  destField: {borderWidth: 1, borderRadius: 8, padding: 10},
  destClear: {borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, alignSelf: "flex-start"},
  hint: {fontSize: 12},
});
