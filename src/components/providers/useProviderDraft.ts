import {useState} from "react";
import {Keyboard} from "react-native";
import {createProvider, nearProviders, updateProvider, type Provider, type ProviderService, type ServiceCategory, type ServiceChannel} from "../../api/providers";
import {toMessage} from "../../api/client";
import type {Place} from "../place-search/PlaceSearch.types";
import type {Strings} from "../../i18n/en";
import type {MeVehicle} from "../../api/users";
import {DOW, buildOpenHours, parseOpenHours, validateWeek, type WeekHours} from "../../screens/more/shopHours";
import {isValidTowPlate, normalizeTowPlate, parseTowWidth} from "../../services/towPlates";
import {normalizeVehicleType} from "../../api/vehicles";

export type ServiceDraft = {
  code: string;
  name: string;
  price: string;
  quoteRequired: boolean;
  category: ServiceCategory;
  warrantyDays: string;
  warrantyParts: "LABOR_ONLY" | "PARTS_AND_LABOR";
  channels: ServiceChannel[];
  vehicleClasses: string[];
};

function bookingPatch(input: {
  enabled: boolean;
  slotMinutes: string;
  capacity: string;
  leadMinutes: string;
  horizonDays: string;
  hours: string;
  alwaysOpen: boolean;
  depositPolicy: "NONE" | "FIXED" | "PERCENT";
  depositAmount: string;
  depositPercent: string;
}): Record<string, unknown> {
  const num = (raw: string): number | undefined => {
    if (raw.trim() === "") return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  };
  const slot = num(input.slotMinutes);
  const capacity = num(input.capacity);
  const lead = num(input.leadMinutes);
  const horizon = num(input.horizonDays);
  const deposit = num(input.depositAmount);
  const depositPercent = num(input.depositPercent);
  return {
    bookingEnabled: input.enabled,
    bookingAlwaysOpen: input.alwaysOpen,
    bookingHours: input.hours.trim() || null,
    ...(slot !== undefined ? {bookingSlotMinutes: slot} : {}),
    ...(capacity !== undefined ? {bookingCapacity: capacity} : {}),
    ...(lead !== undefined ? {bookingLeadMinutes: lead} : {}),
    ...(horizon !== undefined ? {bookingHorizonDays: horizon} : {}),
    depositPolicy: input.depositPolicy,
    ...(deposit !== undefined ? {depositAmount: deposit} : {}),
    ...(depositPercent !== undefined ? {depositPercent} : {}),
  };
}

function contactPatch(tax: string): Record<string, unknown> {
  return {taxCode: tax.trim() || null};
}

function serviceCodeFor(name: string, index: number): string {
  const base = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return base === "" ? `SVC_${index + 1}` : base.slice(0, 64);
}

function parseFee(raw: string): number | undefined | null {
  const clean = raw.replace(/[^0-9]/g, "");
  if (clean === "") return undefined;
  const value = Number.parseInt(clean, 10);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function feePatch(
  kind: "SHOP" | "TOW" | "MOBILE_SHOP",
  fees: {
    towBase?: number;
    towPerKm?: number;
    waiting?: number;
    callOut?: number;
    travelPerKm?: number;
  },
): Record<string, number> {
  const out: Record<string, number> = {};
  if (kind === "TOW") {
    if (fees.towBase !== undefined) out.towBaseFee = fees.towBase;
    if (fees.towPerKm !== undefined) out.towPerKmFee = fees.towPerKm;
    if (fees.waiting !== undefined) out.waitingRatePer15Min = fees.waiting;
  }
  if (kind === "MOBILE_SHOP") {
    if (fees.callOut !== undefined) out.callOutFee = fees.callOut;
    if (fees.travelPerKm !== undefined) out.travelPerKmFee = fees.travelPerKm;
  }
  return out;
}

export function useProviderDraft(kind: "SHOP" | "TOW" | "MOBILE_SHOP", provider: Provider | null, t: Strings, vehicles: MeVehicle[] = []) {
  const [name, setName] = useState(provider?.name ?? "");
  const [point, setPoint] = useState<{lat: number; lng: number; label?: string} | null>(
    provider ? {lat: provider.lat, lng: provider.lng, label: typeof provider.label === "string" ? provider.label : undefined} : null,
  );
  const [towPoint, setTowPoint] = useState<{lat: number; lng: number} | null>(
    provider && kind === "TOW" ? {lat: provider.lat, lng: provider.lng} : null,
  );
  const [locTouched, setLocTouched] = useState(false);
  const [plate, setPlate] = useState(typeof provider?.plate === "string" ? provider.plate : "");
  const [towType, setTowType] = useState<string>(normalizeVehicleType(provider?.vehicleType) ?? "CAR");
  const [towWidth, setTowWidth] = useState(typeof provider?.vehicleWidth === "number" ? String(provider.vehicleWidth) : "");
  const [week, setWeek] = useState<WeekHours>(() => parseOpenHours(typeof provider?.openHours === "string" ? provider.openHours : null));
  const [vehicleClasses, setVehicleClasses] = useState<string[]>(() =>
    Array.isArray(provider?.vehicleClasses) && provider.vehicleClasses.length > 0 ? [...provider.vehicleClasses] : ["SOLO_BIKE", "CAR"],
  );
  const [licenseNumber, setLicenseNumber] = useState(typeof provider?.licenseNumber === "string" ? provider.licenseNumber : "");
  const [towBaseFee, setTowBaseFee] = useState(typeof provider?.towBaseFee === "number" ? String(provider.towBaseFee) : "");
  const [towPerKmFee, setTowPerKmFee] = useState(typeof provider?.towPerKmFee === "number" ? String(provider.towPerKmFee) : "");
  const [taxCode, setTaxCode] = useState(typeof provider?.taxCode === "string" ? provider.taxCode : "");

  const [waitingRate, setWaitingRate] = useState(typeof provider?.waitingRatePer15Min === "number" ? String(provider.waitingRatePer15Min) : "");
  const [bookingEnabled, setBookingEnabled] = useState(provider?.bookingEnabled === true);
  const [bookingAlwaysOpen, setBookingAlwaysOpen] = useState(provider?.bookingAlwaysOpen === true);
  const [bookingSlotMinutes, setBookingSlotMinutes] = useState(typeof provider?.bookingSlotMinutes === "number" ? String(provider.bookingSlotMinutes) : "");
  const [bookingCapacity, setBookingCapacity] = useState(typeof provider?.bookingCapacity === "number" ? String(provider.bookingCapacity) : "");
  const [bookingLeadMinutes, setBookingLeadMinutes] = useState(typeof provider?.bookingLeadMinutes === "number" ? String(provider.bookingLeadMinutes) : "");
  const [bookingHorizonDays, setBookingHorizonDays] = useState(typeof provider?.bookingHorizonDays === "number" ? String(provider.bookingHorizonDays) : "");
  const [bookingHours, setBookingHours] = useState(typeof provider?.bookingHours === "string" ? provider.bookingHours : "");
  const [depositPolicy, setDepositPolicy] = useState<"NONE" | "FIXED" | "PERCENT">(provider?.depositPolicy === "FIXED" || provider?.depositPolicy === "PERCENT" ? provider.depositPolicy : "NONE");
  const [depositAmount, setDepositAmount] = useState(typeof provider?.depositAmount === "number" ? String(provider.depositAmount) : "");
  const [depositPercent, setDepositPercent] = useState(typeof provider?.depositPercent === "number" ? String(provider.depositPercent) : "");
  const [callOutFee, setCallOutFee] = useState(typeof provider?.callOutFee === "number" ? String(provider.callOutFee) : "");
  const [travelPerKmFee, setTravelPerKmFee] = useState(typeof provider?.travelPerKmFee === "number" ? String(provider.travelPerKmFee) : "");
  const [serviceDrafts, setServiceDrafts] = useState<ServiceDraft[]>(() =>
    (Array.isArray(provider?.services) ? provider.services : []).map((service) => ({
      code: service.code,
      name: service.name,
      price: String(service.displayPrice),
      quoteRequired: service.quoteRequired,
      category: (service.category ?? "OTHER") as ServiceCategory,
      warrantyDays: typeof service.warrantyDays === "number" ?
        String(service.warrantyDays) :
        "",
      warrantyParts: service.warrantyParts ?? "LABOR_ONLY",
      channels: kind === "MOBILE_SHOP" ?
        ["ASSIST"] :
        service.channels ?? ["BOOKING", "ASSIST"],
      vehicleClasses: service.vehicleClasses ?? (
        kind === "MOBILE_SHOP" ?
          [towType === "CAR" ? "CAR" : "SOLO_BIKE"] :
          vehicleClasses
      ),
    })),
  );
  const existingVehicles = vehicles.flatMap((vehicle) =>
    (vehicle.providerLinks ?? [])
      .filter((link) => {
        if (kind === "SHOP" || !link.plate) return false;
        if (link.kind === kind && link.status !== "DENIED") return false;
        if (kind === "TOW") return link.vehicleType === "CAR";
        return link.vehicleType === "BIKE" || link.vehicleType === "CAR";
      })
      .map((link) => ({
        plate: link.plate as string,
        vehicleType: link.vehicleType as string,
        vehicleWidth: link.vehicleWidth,
        label: link.name,
      })),
  );
  function useExistingVehicle(vehicle: {plate: string; vehicleType: string; vehicleWidth: number | null}): void {
    setPlate(vehicle.plate);
    setTowType(vehicle.vehicleType);
    setTowWidth(vehicle.vehicleWidth !== null ? String(vehicle.vehicleWidth) : "");
  }
  const [shopSearch, setShopSearch] = useState(false);
  const [towSearch, setTowSearch] = useState(false);
  const [mapPick, setMapPick] = useState(false);
  const [mapTarget, setMapTarget] = useState<"shop" | "tow" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nearbyExisting, setNearbyExisting] = useState<Provider[]>([]);
  const hoursOk = validateWeek(week);
  const plateOk = plate.trim() === "" || isValidTowPlate(plate);
  function addService(): void {
    setServiceDrafts((prev) => [...prev, {
      code: "",
      name: "",
      price: "",
      quoteRequired: false,
      category: "OTHER",
      warrantyDays: "",
      warrantyParts: "LABOR_ONLY",
      channels: kind === "MOBILE_SHOP" ?
        ["ASSIST"] :
        kind === "SHOP" && !bookingEnabled ?
          ["ASSIST"] :
          ["BOOKING", "ASSIST"],
      vehicleClasses: kind === "MOBILE_SHOP" ?
        [towType === "CAR" ? "CAR" : "SOLO_BIKE"] :
        vehicleClasses,
    }]);
  }
  function updateService(index: number, patch: Partial<ServiceDraft>): void {
    setServiceDrafts((prev) => prev.map((row, i) => i === index ? {...row, ...patch} : row));
  }
  function removeService(index: number): void {
    setServiceDrafts((prev) => prev.filter((_, i) => i !== index));
  }
  function buildServices(): ProviderService[] | null {
    const out: ProviderService[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < serviceDrafts.length; i += 1) {
      const row = serviceDrafts[i];
      const name = row.name.trim();
      const priceText = row.price.replace(/[^0-9]/g, "");
      if (name === "" && priceText === "") continue;
      if (name === "" || priceText === "") return null;
      const price = Number.parseInt(priceText, 10);
      if (!Number.isFinite(price) || price < 0) return null;
      let code = row.code.trim() === "" ? serviceCodeFor(name, i) : row.code.trim().toUpperCase();
      if (seen.has(code)) code = `${code}_${i + 1}`;
      seen.add(code);
      const warranty = row.warrantyDays.replace(/[^0-9]/g, "");
      const warrantyDays = warranty === "" ?
        undefined :
        Number.parseInt(warranty, 10);
      if (warrantyDays !== undefined &&
        (!Number.isInteger(warrantyDays) || warrantyDays < 0 ||
          warrantyDays > 90)) return null;
      out.push({
        code,
        name,
        displayPrice: price,
        quoteRequired: row.quoteRequired,
        category: row.category,
        ...(warrantyDays !== undefined ? {warrantyDays} : {}),
        warrantyParts: row.warrantyParts,
        channels: row.channels,
        vehicleClasses: row.vehicleClasses,
      });
    }
    return out;
  }
  function toggleVehicleClass(cls: string): void {
    setVehicleClasses((prev) => {
      if (prev.includes(cls)) {
        const next = prev.filter((c) => c !== cls);
        return next.length > 0 ? next : prev;
      }
      return [...prev, cls];
    });
  }
  function setDay(day: (typeof DOW)[number], patch: {enabled?: boolean; open?: string; close?: string}): void {
    setWeek((prev) => ({...prev, [day]: {...prev[day], ...patch}}));
  }
  function onPickPlace(place: Place): void {
    setPoint({lat: place.lat, lng: place.lng, label: place.label});
    setLocTouched(true);
    setShopSearch(false);
  }
  function onPickTowPlace(place: Place): void {
    setTowPoint({lat: place.lat, lng: place.lng});
    setLocTouched(true);
    setTowSearch(false);
  }
  function openMapPick(target: "shop" | "tow"): void {
    setMapTarget(target);
    setMapPick(true);
  }
  function onConfirmMapPoint(lat: number, lng: number, label: string): void {
    if (mapTarget === "tow") setTowPoint({lat, lng});
    else setPoint({lat, lng, label});
    setLocTouched(true);
    setMapPick(false);
    setMapTarget(null);
  }
  async function refreshNearbyExisting(authToken: string | null): Promise<void> {
    setNearbyExisting([]);
    if (!authToken || !point) return;
    try {
      const found = await nearProviders(point.lat, point.lng, authToken, {radiusMeters: 300});
      setNearbyExisting(found.filter((s) => s.id !== provider?.id));
    } catch {
      return;
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
    } else if (kind === "MOBILE_SHOP") {
      if (!point) {
        setError(t.provider.invalidLocation);
        return false;
      }
      if (licenseNumber.trim() === "") {
        setError(t.provider.invalidLicense);
        return false;
      }
      if (!isValidTowPlate(plate)) {
        setError(t.provider.invalidPlate);
        return false;
      }
    } else {
      if (!isValidTowPlate(plate)) {
        setError(t.provider.invalidPlate);
        return false;
      }
      if (parseTowWidth(towWidth) === null) {
        setError(t.provider.invalidWidth);
        return false;
      }
      if (!provider && !towPoint) {
        setError(t.provider.invalidLocation);
        return false;
      }
    }
    const services = kind === "SHOP" || kind === "MOBILE_SHOP" ?
      buildServices() :
      undefined;
    if (services === null) {
      setError(t.provider.serviceInvalid);
      return false;
    }
    const towBase = parseFee(towBaseFee);
    const towPerKm = parseFee(towPerKmFee);
    const waiting = parseFee(waitingRate);
    const callOut = parseFee(callOutFee);
    const travelPerKm = parseFee(travelPerKmFee);
    if ([towBase, towPerKm, waiting, callOut, travelPerKm].some((v) => v === null)) {
      setError(t.provider.invalidAmount);
      return false;
    }
    return persist(token, {towBase, towPerKm, waiting, callOut, travelPerKm}, services);
  }

  async function persist(
    token: string,
    fees: {
      towBase: number | null | undefined;
      towPerKm: number | null | undefined;
      waiting: number | null | undefined;
      callOut: number | null | undefined;
      travelPerKm: number | null | undefined;
    },
    services?: ProviderService[],
  ): Promise<boolean> {
    const {towBase, towPerKm, waiting, callOut, travelPerKm} = fees;
    setBusy(true);
    setError(null);
    try {
      Keyboard.dismiss();
      if (provider) {
        await updateProvider({
          providerId: provider.id,
          name: name.trim(),
          ...contactPatch(taxCode),
          ...(locTouched && point && kind !== "TOW" ? {lat: point.lat, lng: point.lng, label: point.label ?? null} : {}),
          ...(locTouched && towPoint && kind === "TOW" ? {lat: towPoint.lat, lng: towPoint.lng} : {}),
          ...(kind === "SHOP" ? {openHours: buildOpenHours(week), vehicleClasses} : {}),
          ...(kind === "SHOP" && provider ? bookingPatch({enabled: bookingEnabled, slotMinutes: bookingSlotMinutes, capacity: bookingCapacity, leadMinutes: bookingLeadMinutes, horizonDays: bookingHorizonDays, hours: bookingHours, alwaysOpen: bookingAlwaysOpen, depositPolicy, depositAmount, depositPercent}) : {}),
          ...(services !== undefined ? {services} : {}),
          ...(kind === "MOBILE_SHOP" ? {plate: normalizeTowPlate(plate), vehicleType: towType, licenseNumber: licenseNumber.trim()} : {}),
          ...(kind === "TOW" ? {plate: normalizeTowPlate(plate), vehicleType: towType, vehicleWidth: parseTowWidth(towWidth) ?? undefined} : {}),
          ...feePatch(kind, {towBase: towBase ?? undefined, towPerKm: towPerKm ?? undefined, waiting: waiting ?? undefined, callOut: callOut ?? undefined, travelPerKm: travelPerKm ?? undefined}),
        }, token);
      } else if (kind === "MOBILE_SHOP" && point) {
        await createProvider({
          kind: "MOBILE_SHOP",
          name: name.trim(),
          lat: point.lat,
          lng: point.lng,
          ...(point.label ? {label: point.label} : {}),
          plate: normalizeTowPlate(plate),
          vehicleType: towType,
          licenseNumber: licenseNumber.trim(),
          ...(services !== undefined ? {services} : {}),
          ...feePatch(kind, {callOut: callOut ?? undefined, travelPerKm: travelPerKm ?? undefined}),
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
          ...feePatch(kind, {towBase: towBase ?? undefined, towPerKm: towPerKm ?? undefined, waiting: waiting ?? undefined}),
        }, token);
      } else if (kind === "SHOP" && point) {
        const hours = buildOpenHours(week);
        await createProvider({
          kind: "SHOP",
          name: name.trim(),
          ...contactPatch(taxCode),
          lat: point.lat,
          lng: point.lng,
          ...(point.label ? {label: point.label} : {}),
          ...(hours ? {openHours: hours} : {}),
          vehicleClasses,
          ...(services !== undefined ? {services} : {}),
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
    vehicleClasses,
    toggleVehicleClass,
    licenseNumber,
    setLicenseNumber,
    towBaseFee,
    setTowBaseFee,
    towPerKmFee,
    setTowPerKmFee,
    waitingRate,
    setWaitingRate,
    bookingEnabled,
    setBookingEnabled,
    bookingAlwaysOpen,
    setBookingAlwaysOpen,
    bookingSlotMinutes,
    setBookingSlotMinutes,
    bookingCapacity,
    setBookingCapacity,
    bookingLeadMinutes,
    setBookingLeadMinutes,
    bookingHorizonDays,
    setBookingHorizonDays,
    bookingHours,
    setBookingHours,
    depositPolicy,
    setDepositPolicy,
    depositAmount,
    setDepositAmount,
    depositPercent,
    setDepositPercent,
    taxCode,
    setTaxCode,
    callOutFee,
    setCallOutFee,
    travelPerKmFee,
    setTravelPerKmFee,
    serviceDrafts,
    addService,
    updateService,
    removeService,
    existingVehicles,
    useExistingVehicle,
    shopSearch,
    setShopSearch,
    towSearch,
    setTowSearch,
    mapPick,
    setMapPick,
    openMapPick,
    onConfirmMapPoint,
    busy,
    error,
    hoursOk,
    plateOk,
    setDay,
    onPickPlace,
    onPickTowPlace,
    nearbyExisting,
    refreshNearbyExisting,
    submit,
  };
}

export type ProviderDraftState = ReturnType<typeof useProviderDraft>;
