import {ActivityIndicator, Keyboard, StyleSheet, View} from "react-native";

import {AppText as Text} from "../components/ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";

import {fetchShopPlaces} from "../components/place-search/shopMerge";

import PlaceSearchScreen from "./PlaceSearchScreen";
import Overlay from "../components/overlay/Overlay";
import FlagReportDialog from "../components/flags/FlagReportDialog";
import SaveRouteDialog from "../components/routes/SaveRouteDialog";

import SavedRoutesSheet from "../components/routes/SavedRoutesSheet";
import Snack from "../components/ui/Snack";
import {flagOverlayActions} from "./hazards/flagActions";

import FlagDetailSheet from "../components/flags/FlagDetailSheet";
import ChatSheet from "./assist/ChatSheet";

import {flagTypeLabel} from "../i18n/labels";
import {hazardKind} from "../components/flags/hazardStyle";
import {flagStatusColor, flagStatusLabel} from "../components/flags/flagStatus";

import {HCMC_CENTER} from "./route/types";

import MapPickOverlay from "../components/map/MapPickOverlay";

import RouteMapView from "./route/RouteMapView";
import RouteCard from "./route/RouteCard";
import VehiclePickerSheet from "../components/vehicles/VehiclePickerSheet";
import {Fab, FabColumn} from "../components/ui/Fab";
import {FAB_SIZE, rightColumnBottom} from "./route/fabLayout";
import {snackBottom} from "../components/ui/snackOffset";

import useRouteController from "./route/useRouteController";

export default function RouteScreen() {
  const {activeVehicle, applyCenter, busy, cameraRef, canClear, cancelFlagReport, cardH, chatFlag, cycleHazard, deniedIds, dest, destText, drag, error, flagBusy, flagMode, flagPoint, flagWarnings, flagsKey, gpsBusy, gpsPos, hasVehicle, hazardFocusIdx, hazardHighlight, hazardZones, insets, lang, mapPickFor, navigation, onClear, onConfirmFlag, onConfirmMapPick, onDeleteStop, onDenyFlag, onLocate, onOpenSaved, onPickPlace, onRefreshAlertsQuiet, onRemoveFlag, onSave, onSaveRoute, onSelectRoute, onStart, onSubmitFlag, onSwap, onVehiclePress, origin, originText, pausedKey, result, routes, saveBusy, saveOpen, savedOpen, searchingFor, selectedFlag, selectedIndex, selectedMid, setCardH, setChatFlag, setDismissedPausedKey, setError, setFlagMode, setMapPickFor, setSaveOpen, setSavedOpen, setSearchingFor, setSelectedFlag, setSnack, setVehicleOpen, snack, starting, stops, t, theme, toggleFlagMode, token, uid, vehicleOpen, votedIds, widthBlocks} = useRouteController();
  return (
    <View style={styles.root} onLayout={(e) => {
      const {width, height} = e.nativeEvent.layout;
      const prev = drag.camRef.current;
      drag.camRef.current = {...(prev ?? {center: HCMC_CENTER, zoom: 13, ne: [0, 0] as [number, number], sw: [0, 0] as [number, number]}), w: width, h: height};
    }}>
      <RouteMapView
        t={t}
        theme={theme}
        cameraRef={cameraRef}
        routes={routes}
        selectedIndex={selectedIndex}
        result={result}
        origin={origin}
        dest={dest}
        stops={stops}
        gps={gpsPos}
        flagPoint={flagPoint}
        dragPos={drag.dragPos}
        selectedMid={selectedMid}
        hazardHighlight={hazardHighlight}
        dragging={drag.dragging}
        dragPan={drag.dragPan}
        onMapPress={drag.onMapPress}
        onRegionChange={drag.onRegionChange}
        onRegionDid={drag.onRegionDid}
        onSelectIndex={onSelectRoute}
        onMapReady={() => applyCenter()}
        flagCamRef={drag.camRef}
        flagsToken={token}
        flagsKey={flagsKey}
        onPickFlag={setSelectedFlag}
        subscribeRegionDid={drag.subscribeRegionDid}
      />
      {!flagPoint && !selectedFlag ? (
        flagMode ? (
          <Fab theme={theme} variant="danger" size={FAB_SIZE} label={t.common.close} onPress={toggleFlagMode} style={{position: "absolute", top: insets.top + 12, left: 12, zIndex: 10, elevation: 4}}>
            <MaterialIcons name="close" size={22} color="#fff" />
          </Fab>
        ) : (
          <Fab theme={theme} label={t.route.flagMode} onPress={toggleFlagMode} style={{position: "absolute", top: insets.top + 12, left: 12, zIndex: 10, elevation: 4}}>
            <MaterialIcons name="add-alert" size={22} color={theme.primary} />
          </Fab>
        )
      ) : null}
      {!flagMode && !selectedFlag ? (
      <>
      <FabColumn bottom={rightColumnBottom(cardH)}>
        {canClear ? (
          <Fab theme={theme} variant="danger" size={FAB_SIZE} label={t.route.clear} onPress={onClear}>
            <MaterialIcons name="close" size={22} color="#fff" />
          </Fab>
        ) : null}
        {result && flagWarnings.length > 0 ? (
          <Fab theme={theme} size={FAB_SIZE} variant={hazardFocusIdx >= 0 ? "primary" : "paper"} label={t.nav.hazardFocus} onPress={cycleHazard}>
            <Text style={[styles.hazardNumber, {color: hazardFocusIdx >= 0 ? "#fff" : theme.primary}]}>{flagWarnings.length}</Text>
          </Fab>
        ) : null}
      </FabColumn>
      <View style={styles.bottomContainer}>
        <View style={styles.fabRow}>
          <Fab theme={theme} label={t.saved.title} disabled={!token || busy} onPress={() => setSavedOpen(true)}>
            <MaterialIcons name="bookmark-border" size={22} color={token ? theme.primary : theme.muted} />
          </Fab>
          <View style={styles.fabSpacer} />
          <Fab theme={theme} size={FAB_SIZE} label={t.common.currentLocation} disabled={gpsBusy} onPress={() => void onLocate()}>
            {gpsBusy ? <ActivityIndicator size="small" color={theme.primary} /> : <MaterialIcons name="my-location" size={22} color={theme.primary} />}
          </Fab>
        </View>
        <View onLayout={(e) => setCardH(e.nativeEvent.layout.height)}>
        <RouteCard
          t={t}
          theme={theme}
          lang={lang}
          originText={originText}
          destText={destText}
          stops={stops}
          result={result}
          origin={origin}
          dest={dest}
          activeVehicle={activeVehicle}
          hasVehicles={hasVehicle}
          busy={busy}
          starting={starting}
          hazardZones={hazardZones}
          widthBlocks={widthBlocks}
          onOpenSearch={(f) => { setMapPickFor(null); setFlagMode(false); setSearchingFor(f); }}
          onSwap={onSwap}
          onDeleteStop={onDeleteStop}
          onOpenVehicle={() => setVehicleOpen(true)}
          onStart={() => void onStart()}
          onSave={() => void onSave()}
        />
        </View>
      </View>
      </>
      ) : null}
      {vehicleOpen ? (
        <Overlay visible variant="sheet" title={t.vehicle.title} closeLabel={t.common.cancel} onClose={() => setVehicleOpen(false)}>
          <VehiclePickerSheet t={t} theme={theme} token={token} activeId={activeVehicle?.id ?? null} onPick={(id) => void onVehiclePress(id)} onAddVehicle={() => { setVehicleOpen(false); navigation.navigate("Vehicle" as never); }} />
        </Overlay>
      ) : null}
      {searchingFor ? (
        <Overlay visible variant="fullScreen" closeLabel={t.common.cancel} onClose={() => { Keyboard.dismiss(); setSearchingFor(null); }}>
          <PlaceSearchScreen
              t={t}
              token={token ?? undefined}
              lang={lang}
              title={searchingFor === "origin" ? t.route.origin : searchingFor === "destination" ? t.route.destination : t.route.stop}
              placeholder={searchingFor === "origin" ? t.route.searchOrigin : searchingFor === "destination" ? t.route.searchDestination : t.route.searchStop}
              shops={searchingFor === "destination" && token && gpsPos ? async (q) => fetchShopPlaces(q, token, gpsPos) : undefined}
              onPick={onPickPlace}
              onPickOnMap={() => {
                const f = searchingFor;
                Keyboard.dismiss();
                setSearchingFor(null);
                setFlagMode(false);
                setMapPickFor(f);
              }}
              onClose={() => { Keyboard.dismiss(); setSearchingFor(null); }}
            />
        </Overlay>
      ) : null}
      {mapPickFor ? (
        <Overlay visible variant="fullScreen" closeLabel={t.common.cancel} onClose={() => setMapPickFor(null)}>
          <MapPickOverlay
            t={t}
            lang={lang}
            title={mapPickFor === "origin" ? t.route.origin : mapPickFor === "destination" ? t.route.destination : t.route.stop}
            initial={mapPickFor === "origin" ? origin : mapPickFor === "destination" ? dest : stops.length > 0 ? stops[stops.length - 1] : null}
            onPick={onConfirmMapPick}
            onClose={() => setMapPickFor(null)}
          />
        </Overlay>
      ) : null}
      {savedOpen ? (
        <Overlay visible variant="sheet" title={t.saved.title} closeLabel={t.common.cancel} onClose={() => { Keyboard.dismiss(); setSavedOpen(false); }}>
          <SavedRoutesSheet t={t} token={token} onOpen={(id) => void onOpenSaved(id)} />
        </Overlay>
      ) : null}
      {saveOpen && result ? (
        <SaveRouteDialog
          t={t}
          theme={theme}
          originText={originText}
          destText={destText}
          distanceM={result.distanceMeters ?? 0}
          durationSec={result.durationSeconds ?? 0}
          busy={saveBusy}
          onClose={() => { Keyboard.dismiss(); setSaveOpen(false); }}
          onSave={(name) => void onSaveRoute(name)}
        />
      ) : null}
      {error ? (
        <Snack message={error} severity="error" bottom={snackBottom(insets.bottom)} dangerColor={theme.danger} onHide={() => setError(null)} />
      ) : snack ? (
        <Snack message={snack} severity="confirm" bottom={snackBottom(insets.bottom)} accentColor={theme.primary} onHide={() => setSnack(null)} />
      ) : (
        <Snack
          message={
            drag.dragging
              ? t.route.dragHint
              : flagMode && !flagPoint
                ? t.route.flagHint
                : pausedKey !== null
                  ? t.route.alertsPaused
                  : null
          }
          sticky
          modal={false}
          bottom={snackBottom(insets.bottom)}
          action={pausedKey !== null && !drag.dragging && !(flagMode && !flagPoint) ? {label: t.assist.refresh, onPress: () => void onRefreshAlertsQuiet()} : undefined}
          onHide={() => {
            if (pausedKey !== null) setDismissedPausedKey(pausedKey);
          }}
        />
      )}
      {flagPoint ? (
        <FlagReportDialog t={t} onClose={cancelFlagReport} onSubmit={onSubmitFlag} />
      ) : null}
      {selectedFlag ? (
        <Overlay
          visible
          variant="dialog"
          scrollable={false}
          title={flagTypeLabel(selectedFlag.type, t)}
          leading={<MaterialIcons name={hazardKind(selectedFlag.type).icon} size={22} color={hazardKind(selectedFlag.type).color} />}
          right={
            <View style={[styles.statusChip, {backgroundColor: flagStatusColor(selectedFlag.status)}]}>
              <Text style={styles.statusText}>{flagStatusLabel(selectedFlag.status, t)}</Text>
            </View>
          }
          closeLabel={t.common.cancel}
          onClose={() => setSelectedFlag(null)}
          actions={flagOverlayActions(
            selectedFlag.id,
            selectedFlag.status,
            uid != null && selectedFlag.reporterId === uid,
            votedIds.has(selectedFlag.id) || selectedFlag.voteDirection === "up",
            deniedIds.has(selectedFlag.id) || selectedFlag.voteDirection === "down",
            flagBusy,
            {confirm: t.flag.confirm, deny: t.flag.deny, remove: t.flag.remove},
            {onConfirm: (id) => void onConfirmFlag(id), onDeny: (id) => void onDenyFlag(id), onRemove: (id) => void onRemoveFlag(id)},
          )}
        >
          <FlagDetailSheet
            t={t}
            flag={selectedFlag}
            isOwn={uid != null && selectedFlag.reporterId === uid}
            onChat={(flag) => setChatFlag(flag)}
          />
        </Overlay>
      ) : null}
      {chatFlag && token ? (
        <ChatSheet
          t={t}
          token={token}
          uid={uid}
          scope="HAZARD"
          refId={chatFlag.id}
          title={flagTypeLabel(chatFlag.type, t)}
          onClose={() => setChatFlag(null)}
        />
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  root: {flex: 1},
  statusChip: {borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10},
  statusText: {color: "#fff", fontSize: 12, fontWeight: "700"},
  bottomContainer: {position: "absolute", left: 16, right: 16, bottom: 16, gap: 10},
  fabRow: {flexDirection: "row", alignItems: "center", gap: 8},
  fabSpacer: {flex: 1},
  hazardNumber: {fontSize: 22, fontWeight: "800", textAlign: "center"},
});
