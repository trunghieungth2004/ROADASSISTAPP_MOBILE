import {useState} from "react";
import {Keyboard} from "react-native";
import * as Location from "expo-location";
import {createProvider, updateProvider, type Provider} from "../api/providers";
import {toMessage} from "../api/client";
import type {Place} from "./place-search/PlaceSearch.types";
import type {Strings} from "../i18n/en";
import {DOW, buildOpenHours, parseOpenHours, validateWeek, type WeekHours} from "../screens/more/shopHours";
import {isValidTowPlate, normalizeTowPlate, parseTowWidth} from "../services/towPlates";

export function useProviderDraft(kind: "SHOP" | "TOW", provider: Provider | null, t: Strings) {
  const [name, setName] = useState(provider?.name ?? "");
  const [point, setPoint] = useState<{lat: number; lng: number; label?: string} | null>(
    provider ? {lat: provider.lat, lng: provider.lng, label: typeof provider.label === "string" ? provider.label : undefined} : null,
  );
  const [towPoint, setTowPoint] = useState<{lat: number; lng: number} | null>(
    provider && kind === "TOW" ? {lat: provider.lat, lng: provider.lng} : null,
  );
  const [locTouched, setLocTouched] = useState(false);
  const [plate, setPlate] = useState(typeof provider?.plate === "string" ? provider.plate : "");
  const [towType, setTowType] = useState(typeof provider?.vehicleType === "string" ? provider.vehicleType : "VAN");
  const [towWidth, setTowWidth] = useState(typeof provider?.vehicleWidth === "number" ? String(provider.vehicleWidth) : "");
  const [week, setWeek] = useState<WeekHours>(() => parseOpenHours(typeof provider?.openHours === "string" ? provider.openHours : null));
  const [accepting, setAccepting] = useState(provider?.accepting !== false);
  const [shopSearch, setShopSearch] = useState(false);
  const [locBusy, setLocBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hoursOk = validateWeek(week);
  const plateOk = plate.trim() === "" || isValidTowPlate(plate);
  const editable = !provider || provider.status === "ACTIVE";
  function setDay(day: (typeof DOW)[number], patch: {enabled?: boolean; open?: string; close?: string}): void {
    setWeek((prev) => ({...prev, [day]: {...prev[day], ...patch}}));
  }
  function onPickPlace(place: Place): void {
    setPoint({lat: place.lat, lng: place.lng, label: place.label});
    setLocTouched(true);
    setShopSearch(false);
  }
  async function stampTowPoint(): Promise<void> {
    if (locBusy) return;
    setLocBusy(true);
    setError(null);
    try {
      const {status} = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") throw new Error(t.nav.locationDenied);
      const pos = await Location.getCurrentPositionAsync({});
      setTowPoint({lat: pos.coords.latitude, lng: pos.coords.longitude});
      setLocTouched(true);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setLocBusy(false);
    }
  }
  async function submit(token: string | null): Promise<boolean> {
    if (!token || busy) return false;
    if (name.trim() === "") {
      setError(t.provider.invalidName);
      return false;
    }
    if (kind === "SHOP") {
      if (!point) {
        setError(t.provider.invalidLocation);
        return false;
      }
      if (!hoursOk) {
        setError(t.provider.invalidHours);
        return false;
      }
    } else {
      if (!provider && !isValidTowPlate(plate)) {
        setError(t.provider.invalidPlate);
        return false;
      }
      if (!provider && parseTowWidth(towWidth) === null) {
        setError(t.provider.invalidWidth);
        return false;
      }
      if (!provider && !towPoint) {
        setError(t.provider.invalidLocation);
        return false;
      }
    }
    setBusy(true);
    setError(null);
    try {
      Keyboard.dismiss();
      if (provider) {
        await updateProvider({
          providerId: provider.id,
          name: name.trim(),
          ...(locTouched && point && kind === "SHOP" ? {lat: point.lat, lng: point.lng, label: point.label ?? null} : {}),
          ...(locTouched && towPoint && kind === "TOW" ? {lat: towPoint.lat, lng: towPoint.lng} : {}),
          ...(kind === "SHOP" ? {openHours: buildOpenHours(week)} : {}),
          accepting,
        }, token);
      } else if (kind === "TOW" && towPoint) {
        await createProvider({
          kind: "TOW",
          name: name.trim(),
          lat: towPoint.lat,
          lng: towPoint.lng,
          plate: normalizeTowPlate(plate),
          vehicleType: towType,
          vehicleWidth: parseTowWidth(towWidth) ?? undefined,
        }, token);
      } else if (kind === "SHOP" && point) {
        const hours = buildOpenHours(week);
        await createProvider({
          kind: "SHOP",
          name: name.trim(),
          lat: point.lat,
          lng: point.lng,
          ...(point.label ? {label: point.label} : {}),
          ...(hours ? {openHours: hours} : {}),
        }, token);
      }
      return true;
    } catch (err) {
      setError(toMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return {
    kind,
    provider,
    name,
    setName,
    point,
    towPoint,
    plate,
    setPlate,
    towType,
    setTowType,
    towWidth,
    setTowWidth,
    week,
    accepting,
    setAccepting,
    shopSearch,
    setShopSearch,
    locBusy,
    busy,
    error,
    hoursOk,
    plateOk,
    editable,
    setDay,
    onPickPlace,
    stampTowPoint,
    submit,
  };
}

export type ProviderDraftState = ReturnType<typeof useProviderDraft>;
