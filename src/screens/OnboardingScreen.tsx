import {useEffect, useState} from "react";
import {KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {useAppMode} from "../context/ThemeContext";
import {AppText as Text, AppTextInput as TextInput} from "../components/ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {formatPoint} from "../api/places";
import type {Place} from "../components/place-search/PlaceSearch.types";
import type {Strings} from "../i18n/en";
import {themeForMode, darkTheme, lightTheme} from "../theme";
import {TOW_TYPES, isValidTowPlate, normalizeTowPlate, parseTowWidth, parseVehicleHeight, validateTowDraft} from "../services/towPlates";
import {DOW, buildOpenHours, emptyWeek, summarizeWeek, type Day, type WeekHours} from "./more/shopHours";
import PlaceSearchScreen from "./PlaceSearchScreen";
import MapPickOverlay from "../components/map/MapPickOverlay";
import ShopHoursEditor from "../components/providers/ShopHoursEditor";
import Overlay from "../components/overlay/Overlay";
import ServiceEditSheet from "../components/providers/ServiceEditSheet";
import {buildServiceCatalog, emptyServiceDraft, type ServiceDraft} from "../components/providers/useProviderDraft";
import {myProviders, type Provider, type ProviderService} from "../api/providers";
import {fetchMeBundle, type MeVehicle} from "../api/users";
import {VEHICLE_DEFAULT_WIDTH} from "../api/vehicles";
import {VehicleGlyph, VehicleClassGlyph} from "../components/vehicles/VehicleIcons";
import ProviderServiceList from "../components/providers/ProviderServiceList";
import ExistingVehicleChoices from "../components/providers/ExistingVehicleChoices";
import {existingVehicleChoices, type ExistingVehicleChoice} from "../components/providers/existingVehicles";

export type ShopDraft = {name: string; lat: number; lng: number; label?: string; openHours?: string; vehicleClasses?: string[]; services?: ProviderService[]};

export type TowDraft = {name: string; plate: string; vehicleType: string; vehicleLabel?: string; width: string; height: string; lat: number; lng: number};

export type MobileShopDraft = {name: string; plate: string; vehicleType: "BIKE" | "CAR"; vehicleLabel?: string; vehicleWidth: string; vehicleHeight: string; licenseNumber: string; lat: number; lng: number; label?: string; services?: ProviderService[]};

export type OnboardingProps = {t: Strings; lang: string; token: string | null; busy?: boolean; error?: string | null; selectedServices?: string[]; registered?: {shop: boolean; tow: boolean; mobileShop?: boolean}; setupOnly?: "SHOP" | "TOW" | "MOBILE_SHOP" | null; onClose?: () => void; onFinish: (services: string[], shop: ShopDraft | null, tow: TowDraft | null, mobileShop: MobileShopDraft | null) => void; onSkip: () => void};

type Step = "roles" | "mobileShop" | "shop" | "tow";

const ROLE_ICONS = {
  rider: "two-wheeler",
  mobileShop: "build",
  shop: "storefront",
  tow: "local-shipping",
} as const;

function RoleIcon({name, active, theme}: {name: (typeof ROLE_ICONS)[keyof typeof ROLE_ICONS]; active: boolean; theme: {primary: string; text: string}}) {
  return (
    <View style={styles.iconSlot}>
      <MaterialIcons name={name} size={20} color={active ? "#fff" : theme.primary} />
    </View>
  );
}

export default function OnboardingScreen({t, lang, token, busy, error, selectedServices, registered, setupOnly, onClose, onFinish, onSkip}: OnboardingProps) {
  const scheme = useAppMode();
  const theme = themeForMode(scheme);
  const insets = useSafeAreaInsets();
  const initialStep: Step = setupOnly === "MOBILE_SHOP" ? "mobileShop" : setupOnly === "SHOP" ? "shop" : setupOnly === "TOW" ? "tow" : "roles";
  const shopChosen = (selectedServices ?? []).includes("SHOP");
  const towChosen = (selectedServices ?? []).includes("TOW");
  const mobileShopChosen = (selectedServices ?? []).includes("MOBILE_SHOP");
  const shopRegistered = registered?.shop === true;
  const towRegistered = registered?.tow === true;
  const mobileShopRegistered = registered?.mobileShop === true;
  const hasShop = shopChosen || shopRegistered;
  const hasTow = towChosen || towRegistered;
  const [step, setStep] = useState<Step>(initialStep);
  const [mobileShopOpen, setMobileShopOpen] = useState(mobileShopChosen || setupOnly === "MOBILE_SHOP");
  const hasMobileShop = mobileShopOpen || mobileShopRegistered;
  const [shopOpen, setShopOpen] = useState(setupOnly === "SHOP");
  const [shopName, setShopName] = useState("");
  const [shopPoint, setShopPoint] = useState<{lat: number; lng: number; label?: string} | null>(null);
  const [shopSearch, setShopSearch] = useState(false);
  const [shopMap, setShopMap] = useState(false);
  const [week, setWeek] = useState<WeekHours>(() => emptyWeek());
  const [hoursOpen, setHoursOpen] = useState(false);
  const [shopClasses, setShopClasses] = useState<string[]>(["SOLO_BIKE", "CAR"]);
  const [shopServices, setShopServices] = useState<ServiceDraft[]>([]);
  const [mobileShopServices, setMobileShopServices] = useState<ServiceDraft[]>([]);
  const [serviceEdit, setServiceEdit] = useState<{scope: "shop" | "mobileShop"; index: number | null; service: ServiceDraft} | null>(null);
  function toggleShopClass(cls: string): void {
    setShopClasses((prev) => {
      if (prev.includes(cls)) {
        const next = prev.filter((c) => c !== cls);
        return next.length > 0 ? next : prev;
      }
      return [...prev, cls];
    });
  }
  function chooseMobileShopType(next: "BIKE" | "CAR"): void {
    setMobileShopType(next);
    setMobileShopWidth(String(VEHICLE_DEFAULT_WIDTH[next] ?? 1.9));
    setMobileShopHeight(next === "CAR" ? "1.6" : "1.1");
  }
  function applyMobileShopVehicle(choice: ExistingVehicleChoice): void {
    setMobileShopPlate(choice.plate);
    chooseMobileShopType(choice.vehicleType);
    if (choice.vehicleWidth !== null) setMobileShopWidth(String(choice.vehicleWidth));
    if (choice.vehicleHeight !== null) setMobileShopHeight(String(choice.vehicleHeight));
    if (choice.label !== null) setMobileShopLabel(choice.label);
  }
  function applyTowVehicle(choice: ExistingVehicleChoice): void {
    setPlate(choice.plate);
    setTowType(choice.vehicleType);
    if (choice.vehicleWidth !== null) setWidth(String(choice.vehicleWidth));
    if (choice.vehicleHeight !== null) setTowHeight(String(choice.vehicleHeight));
    if (choice.label !== null) setTowLabel(choice.label);
  }
  function setDay(day: Day, patch: {enabled?: boolean; open?: string; close?: string}): void {
    setWeek((prev) => ({...prev, [day]: {...prev[day], ...patch}}));
  }
  const hoursSummary = summarizeWeek(week, t.provider.days, t.provider.hoursMixed);
  const [towOpen, setTowOpen] = useState(setupOnly === "TOW");
  const [towName, setTowName] = useState("");
  const [plate, setPlate] = useState("");
  const [towType, setTowType] = useState<string>("CAR");
  const [width, setWidth] = useState(String(VEHICLE_DEFAULT_WIDTH.CAR ?? 1.9));
  const [towPoint, setTowPoint] = useState<{lat: number; lng: number} | null>(null);
  const [towSearch, setTowSearch] = useState(false);
  const [towMap, setTowMap] = useState(false);
  const [shopDraft, setShopDraft] = useState<ShopDraft | null>(null);
  const [mobileShopName, setMobileShopName] = useState("");
  const [mobileShopPoint, setMobileShopPoint] = useState<{lat: number; lng: number; label?: string} | null>(null);
  const [mobileShopSearch, setMobileShopSearch] = useState(false);
  const [mobileShopMap, setMobileShopMap] = useState(false);
  const [mobileShopPlate, setMobileShopPlate] = useState("");
  const [mobileShopType, setMobileShopType] = useState<"BIKE" | "CAR">("BIKE");
  const [mobileShopLabel, setMobileShopLabel] = useState("");
  const [mobileShopWidth, setMobileShopWidth] = useState(String(VEHICLE_DEFAULT_WIDTH.BIKE ?? 0.7));
  const [mobileShopHeight, setMobileShopHeight] = useState("1.1");
  const [mobileShopLicense, setMobileShopLicense] = useState("");
  const [mobileShopDraft, setMobileShopDraft] = useState<MobileShopDraft | null>(null);
  const [towLabel, setTowLabel] = useState("");
  const [towHeight, setTowHeight] = useState("1.6");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [vehicles, setVehicles] = useState<MeVehicle[]>([]);
  const [fieldError, setFieldError] = useState<string | null>(null);
  useEffect(() => {
    if (!token) return;
    let active = true;
    void fetchMeBundle(token)
      .then((bundle) => {
        if (active) setVehicles(bundle.vehicles);
      })
      .catch(() => undefined);
    void myProviders(token)
      .then((rows) => {
        if (active) setProviders(rows);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [token]);
  const mobileShopVehicles = existingVehicleChoices("MOBILE_SHOP", null, providers, vehicles);
  const towVehicles = existingVehicleChoices("TOW", null, providers, vehicles);
  const showMobileShopStep = mobileShopOpen && !mobileShopRegistered;
  const showShopStep = (shopOpen || shopChosen) && !shopRegistered;
  const showTowStep = (towOpen || towChosen) && !towRegistered;
  const setupSteps: Step[] = setupOnly ? [initialStep] : ["roles"];
  if (!setupOnly && showMobileShopStep) setupSteps.push("mobileShop");
  if (!setupOnly && showShopStep) setupSteps.push("shop");
  if (!setupOnly && showTowStep) setupSteps.push("tow");
  function nextStep(from: "roles" | "mobileShop" | "shop"): Step | null {
    if (from === "roles") {
      if (showMobileShopStep) return "mobileShop";
      if (showShopStep) return "shop";
      if (showTowStep) return "tow";
      return null;
    }
    if (from === "mobileShop") {
      if (showShopStep) return "shop";
      if (showTowStep) return "tow";
      return null;
    }
    if (showTowStep) return "tow";
    return null;
  }
  function onPickShopPlace(place: Place): void {
    setShopPoint({lat: place.lat, lng: place.lng, label: place.label});
    setShopSearch(false);
  }
  function onConfirmShopMap(lat: number, lng: number, label: string): void {
    setShopPoint({lat, lng, label});
    setShopMap(false);
  }
  function onPickTowPlace(place: Place): void {
    setTowPoint({lat: place.lat, lng: place.lng});
    setTowSearch(false);
  }
  function onConfirmTowMap(lat: number, lng: number): void {
    setTowPoint({lat, lng});
    setTowMap(false);
  }
  function onPickMobileShopPlace(place: Place): void {
    setMobileShopPoint({lat: place.lat, lng: place.lng, label: place.label});
    setMobileShopSearch(false);
  }
  function onConfirmMobileShopMap(lat: number, lng: number, label: string): void {
    setMobileShopPoint({lat, lng, label});
    setMobileShopMap(false);
  }
  function finish(shop: ShopDraft | null, tow: TowDraft | null, mobileShop: MobileShopDraft | null = mobileShopDraft): void {
    onFinish(["RIDER"], shop, tow, mobileShop);
  }
  function onContinueRoles(): void {
    if (busy) return;
    setFieldError(null);
    const next = nextStep("roles");
    if (next) {
      setStep(next);
      return;
    }
    finish(null, null);
  }
  function onContinueShop(): void {
    if (busy) return;
    setFieldError(null);
    if (shopName.trim() === "") {
      setFieldError(t.provider.invalidName);
      return;
    }
    if (!shopPoint) {
      setFieldError(t.provider.invalidLocation);
      return;
    }
    const hours = buildOpenHours(week);
    if (DOW.some((day) => week[day].enabled) && !hours) {
      setFieldError(t.provider.invalidHours);
      return;
    }
    const services = buildServiceCatalog(shopServices);
    if (services === null) {
      setFieldError(t.provider.serviceInvalid);
      return;
    }
    const draft: ShopDraft = {name: shopName.trim(), lat: shopPoint.lat, lng: shopPoint.lng, ...(shopPoint.label ? {label: shopPoint.label} : {}), ...(hours ? {openHours: hours} : {}), vehicleClasses: shopClasses, ...(services.length > 0 ? {services} : {})};
    const next = nextStep("shop");
    if (next) {
      setShopDraft(draft);
      setStep(next);
      return;
    }
    finish(draft, null, mobileShopDraft);
  }
  function onContinueMobileShop(): void {
    if (busy) return;
    setFieldError(null);
    if (mobileShopName.trim() === "") {
      setFieldError(t.provider.invalidName);
      return;
    }
    if (!isValidTowPlate(mobileShopPlate)) {
      setFieldError(t.provider.invalidPlate);
      return;
    }
    if (mobileShopLicense.trim() === "") {
      setFieldError(t.provider.invalidLicense);
      return;
    }
    if (parseTowWidth(mobileShopWidth) === null || parseVehicleHeight(mobileShopHeight) === null) {
      setFieldError(t.vehicle.invalidDims);
      return;
    }
    if (!mobileShopPoint) {
      setFieldError(t.provider.invalidLocation);
      return;
    }
    const services = buildServiceCatalog(mobileShopServices);
    if (services === null) {
      setFieldError(t.provider.serviceInvalid);
      return;
    }
    const draft: MobileShopDraft = {
      name: mobileShopName.trim(),
      plate: normalizeTowPlate(mobileShopPlate),
      vehicleType: mobileShopType,
      vehicleLabel: mobileShopLabel.trim() || undefined,
      vehicleWidth: mobileShopWidth,
      vehicleHeight: mobileShopHeight,
      licenseNumber: mobileShopLicense.trim(),
      lat: mobileShopPoint.lat,
      lng: mobileShopPoint.lng,
      ...(mobileShopPoint.label ? {label: mobileShopPoint.label} : {}),
      ...(services.length > 0 ? {services} : {}),
    };
    const next = nextStep("mobileShop");
    if (next) {
      setMobileShopDraft(draft);
      setStep(next);
      return;
    }
    finish(null, null, draft);
  }
  function onContinueTow(): void {
    if (busy) return;
    setFieldError(null);
    if (towName.trim() === "") {
      setFieldError(t.provider.invalidName);
      return;
    }
    const bad = validateTowDraft({plate, vehicleType: towType, width});
    if (bad === "plate") {
      setFieldError(t.provider.invalidPlate);
      return;
    }
    if (bad === "type") {
      setFieldError(t.provider.invalidType);
      return;
    }
    if (bad === "width") {
      setFieldError(t.provider.invalidWidth);
      return;
    }
    if (parseVehicleHeight(towHeight) === null) {
      setFieldError(t.vehicle.invalidDims);
      return;
    }
    if (!towPoint) {
      setFieldError(t.provider.invalidLocation);
      return;
    }
    finish(shopDraft, {
      name: towName.trim(),
      plate,
      vehicleType: towType,
      vehicleLabel: towLabel.trim() || undefined,
      width,
      height: towHeight,
      lat: towPoint.lat,
      lng: towPoint.lng,
    }, mobileShopDraft);
  }
  function onBack(): void {
    if (busy) return;
    setFieldError(null);
    if (setupOnly) {
      onClose?.();
      return;
    }
    if (step === "tow") {
      setStep(showShopStep ? "shop" : showMobileShopStep ? "mobileShop" : "roles");
      return;
    }
    if (step === "shop") {
      setStep(showMobileShopStep ? "mobileShop" : "roles");
      return;
    }
    setStep("roles");
  }
  function renderServices(scope: "shop" | "mobileShop", rows: ServiceDraft[]) {
    const kind = scope === "shop" ? "SHOP" as const : "MOBILE_SHOP" as const;
    return (
      <ProviderServiceList
        t={t}
        theme={theme}
        rows={rows}
        onEdit={(index, service) => setServiceEdit({scope, index, service: {...service}})}
        onAdd={() => setServiceEdit({
          scope,
          index: null,
          service: emptyServiceDraft(kind, false, shopClasses, mobileShopType),
        })}
      />
    );
  }

  const errorLines = (
    <>
      {error ? <Text style={[styles.error, {color: theme.danger}]}>{error}</Text> : null}
      {fieldError ? <Text style={[styles.error, {color: theme.danger}]}>{fieldError}</Text> : null}
    </>
  );
  const stepHeader = (
    <View style={styles.header}>
      <Pressable disabled={busy} onPress={onBack} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.common.back}>
        <MaterialIcons name="arrow-back" size={22} color={theme.text} />
      </Pressable>
      <View style={styles.dots}>
        {setupSteps.map((item) => (
          <View key={item} style={[styles.dot, {backgroundColor: item === step ? theme.primary : theme.divider}, item === step && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.root, {backgroundColor: theme.background}]}>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.container, {paddingTop: insets.top + (step === "roles" ? 32 : 16), paddingBottom: insets.bottom + 24}]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {step === "roles" ? (
          <>
            <Text style={[styles.title, {color: theme.text}]}>{t.roles.title}</Text>
            <Text style={[styles.subtitle, {color: theme.muted}]}>{t.roles.subtitle}</Text>
            {errorLines}
            <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
              <View style={[styles.option, {borderColor: theme.primary, backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{checked: true}}>
                <RoleIcon name={ROLE_ICONS.rider} active theme={theme} />
                <Text style={{color: "#fff"}}>{t.roles.rider} — {t.roles.riderHint}</Text>
              </View>
              <Pressable disabled={busy || mobileShopRegistered} onPress={() => setMobileShopOpen((v) => { if (v) setMobileShopDraft(null); return !v; })} style={[styles.option, {borderColor: theme.primary}, (mobileShopOpen || hasMobileShop) && {backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{checked: mobileShopOpen || hasMobileShop}}>
                <RoleIcon name={ROLE_ICONS.mobileShop} active={mobileShopOpen || hasMobileShop} theme={theme} />
                <Text style={{color: mobileShopOpen || hasMobileShop ? "#fff" : theme.text}}>{t.roles.mobileShop} — {mobileShopRegistered ? t.provider.registered : t.roles.mobileShopHint}</Text>
              </Pressable>
              {hasShop ? (
                <View style={[styles.option, {borderColor: theme.primary, backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{checked: true, disabled: true}}>
                  <RoleIcon name={ROLE_ICONS.shop} active theme={theme} />
                  <Text style={{color: "#fff"}}>{t.roles.shop} — {shopRegistered ? t.provider.registered : t.provider.chosenNeedsDetails}</Text>
                </View>
              ) : (
                <Pressable disabled={busy} onPress={() => setShopOpen((v) => !v)} style={[styles.option, {borderColor: theme.primary}, shopOpen && {backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{checked: shopOpen}}>
                  <RoleIcon name={ROLE_ICONS.shop} active={shopOpen} theme={theme} />
                  <Text style={{color: shopOpen ? "#fff" : theme.text}}>{t.roles.shop} — {t.roles.shopHint}</Text>
                </Pressable>
              )}
              {hasTow ? (
                <View style={[styles.option, {borderColor: theme.primary, backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{checked: true, disabled: true}}>
                  <RoleIcon name={ROLE_ICONS.tow} active theme={theme} />
                  <Text style={{color: "#fff"}}>{t.roles.tow} — {towRegistered ? t.provider.registered : t.provider.chosenNeedsDetails}</Text>
                </View>
              ) : (
                <Pressable disabled={busy} onPress={() => setTowOpen((v) => !v)} style={[styles.option, {borderColor: theme.primary}, towOpen && {backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{checked: towOpen}}>
                  <RoleIcon name={ROLE_ICONS.tow} active={towOpen} theme={theme} />
                  <Text style={{color: towOpen ? "#fff" : theme.text}}>{t.roles.tow} — {t.roles.towHint}</Text>
                </Pressable>
              )}
            </View>
            <Pressable disabled={busy} onPress={onContinueRoles} style={[styles.primary, {backgroundColor: theme.primary}, busy && styles.disabled]}>
              <Text style={styles.primaryText}>{t.roles.done}</Text>
            </Pressable>
            <Pressable disabled={busy} onPress={onSkip}><Text style={[styles.skip, {color: theme.primary}]}>{t.roles.skip}</Text></Pressable>
          </>
        ) : null}
        {step === "mobileShop" ? (
          <>
            {stepHeader}
            <Text style={[styles.title, {color: theme.text}]}>{t.provider.addMobileShop}</Text>
            {errorLines}
            <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
              <View style={styles.subForm}>
                <Text style={[styles.label, {color: theme.text}]}>{t.provider.name}</Text>
                <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={mobileShopName} onChangeText={setMobileShopName} placeholder={t.provider.name} placeholderTextColor={theme.muted} />
                <Text style={[styles.hint, {color: theme.muted}]}>{t.provider.nameHint}</Text>
                <Text style={[styles.label, {color: theme.text}]}>{t.provider.mobileVehicle}</Text>
                <Text style={[styles.hint, {color: theme.muted}]}>{t.provider.mobileVehicleHint}</Text>
                <View style={styles.row}>
                  {(["BIKE", "CAR"] as const).map((kind) => (
                    <Pressable key={kind} disabled={busy} onPress={() => chooseMobileShopType(kind)} style={[styles.iconChip, {borderColor: theme.primary}, mobileShopType === kind && {backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{checked: mobileShopType === kind}} accessibilityLabel={t.vehicle.types[kind]}>
                      <VehicleGlyph type={kind} color={mobileShopType === kind ? "#fff" : theme.primary} />
                    </Pressable>
                  ))}
                </View>
                <ExistingVehicleChoices t={t} theme={theme} choices={mobileShopVehicles} currentPlate={mobileShopPlate} onPick={applyMobileShopVehicle} />
                <Text style={[styles.label, {color: theme.text}]}>{t.vehicle.label}</Text>
                <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={mobileShopLabel} onChangeText={setMobileShopLabel} placeholder={t.vehicle.labelPlaceholder} placeholderTextColor={theme.muted} />
                <Text style={[styles.label, {color: theme.text}]}>{t.tow.plate}</Text>
                <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={mobileShopPlate} onChangeText={setMobileShopPlate} placeholder={t.tow.platePlaceholder} placeholderTextColor={theme.muted} autoCapitalize="characters" />
                <Text style={[styles.hint, {color: theme.muted}]}>{t.provider.mobilePlateHint}</Text>
                <View style={styles.fieldRow}>
                  <View style={styles.halfCol}>
                    <Text style={[styles.label, {color: theme.text}]}>{t.vehicle.widthMeters}</Text>
                    <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={mobileShopWidth} onChangeText={setMobileShopWidth} keyboardType="decimal-pad" />
                  </View>
                  <View style={styles.halfCol}>
                    <Text style={[styles.label, {color: theme.text}]}>{t.vehicle.height}</Text>
                    <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={mobileShopHeight} onChangeText={setMobileShopHeight} keyboardType="decimal-pad" />
                  </View>
                </View>
                <Text style={[styles.label, {color: theme.text}]}>{t.provider.licenseNumber}</Text>
                <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={mobileShopLicense} onChangeText={setMobileShopLicense} placeholder={t.provider.licenseNumber} placeholderTextColor={theme.muted} />
                <Text style={[styles.hint, {color: theme.muted}]}>{t.provider.licenseHint}</Text>
                <Text style={[styles.label, {color: theme.text}]}>{t.provider.shopAddress}</Text>
                <Pressable disabled={busy} onPress={() => setMobileShopSearch(true)} style={[styles.input, {borderColor: theme.border}]} accessibilityRole="button" accessibilityLabel={t.provider.shopAddress}>
                  <Text style={{color: mobileShopPoint ? theme.text : theme.muted}} numberOfLines={1}>{mobileShopPoint ? (mobileShopPoint.label ?? formatPoint(mobileShopPoint.lat, mobileShopPoint.lng)) : t.provider.addressUnset}</Text>
                </Pressable>
                {renderServices("mobileShop", mobileShopServices)}
              </View>
            </View>
            <Pressable disabled={busy} onPress={onContinueMobileShop} style={[styles.primary, {backgroundColor: theme.primary}, busy && styles.disabled]}>
              <Text style={styles.primaryText}>{nextStep("mobileShop") ? t.roles.done : t.roles.finish}</Text>
            </Pressable>
          </>
        ) : null}
        {step === "shop" ? (
          <>
            {stepHeader}
            <Text style={[styles.title, {color: theme.text}]}>{t.provider.addShop}</Text>
            {errorLines}
            <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
              <View style={styles.subForm}>
                <Text style={[styles.label, {color: theme.text}]}>{t.provider.name}</Text>
                <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={shopName} onChangeText={setShopName} placeholder={t.provider.name} placeholderTextColor={theme.muted} />
                <Text style={[styles.hint, {color: theme.muted}]}>{t.provider.nameHint}</Text>
                <Text style={[styles.label, {color: theme.text}]}>{t.provider.shopAddress}</Text>
                <Pressable disabled={busy} onPress={() => setShopSearch(true)} style={[styles.input, {borderColor: theme.border}]} accessibilityRole="button" accessibilityLabel={t.provider.shopAddress}>
                  <Text style={{color: shopPoint ? theme.text : theme.muted}} numberOfLines={1}>{shopPoint ? (shopPoint.label ?? formatPoint(shopPoint.lat, shopPoint.lng)) : t.provider.addressUnset}</Text>
                </Pressable>
                <Text style={[styles.label, {color: theme.text}]}>{t.provider.customerVehicles}</Text>
                <Text style={[styles.hint, {color: theme.muted}]}>{t.provider.customerVehiclesHint}</Text>
                <View style={styles.row}>
                  {[{id: "SOLO_BIKE", label: t.shop.vehicleBike}, {id: "CAR", label: t.shop.vehicleCar}].map((c) => {
                    const selected = shopClasses.includes(c.id);
                    return (
                      <Pressable key={c.id} disabled={busy} onPress={() => toggleShopClass(c.id)} style={[styles.iconChip, {borderColor: theme.primary}, selected && {backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{checked: selected}} accessibilityLabel={c.label}>
                        <VehicleClassGlyph vehicleClass={c.id} color={selected ? "#fff" : theme.primary} />
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable disabled={busy} onPress={() => setHoursOpen(true)} style={[styles.input, {borderColor: theme.border}]} accessibilityRole="button" accessibilityLabel={t.provider.hours}>
                  <Text style={{color: hoursSummary ? theme.text : theme.muted}} numberOfLines={1}>{hoursSummary ? `${t.provider.hours} — ${hoursSummary}` : `${t.provider.hours} — ${t.provider.hoursNotSet}`}</Text>
                </Pressable>
                {renderServices("shop", shopServices)}
              </View>
            </View>
            <Pressable disabled={busy} onPress={onContinueShop} style={[styles.primary, {backgroundColor: theme.primary}, busy && styles.disabled]}>
              <Text style={styles.primaryText}>{t.roles.done}</Text>
            </Pressable>
          </>
        ) : null}
        {step === "tow" ? (
          <>
            {stepHeader}
            <Text style={[styles.title, {color: theme.text}]}>{t.tow.register}</Text>
            <Text style={[styles.hint, {color: theme.muted}]}>{t.provider.towTruckHint}</Text>
            {errorLines}
            <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
              <View style={styles.subForm}>
                <Text style={[styles.label, {color: theme.text}]}>{t.provider.name}</Text>
                <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={towName} onChangeText={setTowName} placeholder={t.provider.name} placeholderTextColor={theme.muted} />
                <Text style={[styles.hint, {color: theme.muted}]}>{t.provider.nameHint}</Text>
                <Text style={[styles.label, {color: theme.text}]}>{t.provider.towTruck}</Text>
                <ExistingVehicleChoices t={t} theme={theme} choices={towVehicles} currentPlate={plate} onPick={applyTowVehicle} />
                <Text style={[styles.label, {color: theme.text}]}>{t.vehicle.label}</Text>
                <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={towLabel} onChangeText={setTowLabel} placeholder={t.vehicle.labelPlaceholder} placeholderTextColor={theme.muted} />
                <Text style={[styles.label, {color: theme.text}]}>{t.tow.plate}</Text>
                <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={plate} onChangeText={setPlate} placeholder={t.tow.platePlaceholder} placeholderTextColor={theme.muted} autoCapitalize="characters" />
                <Text style={[styles.hint, {color: theme.muted}]}>{t.provider.towPlateHint}</Text>
                <View style={styles.row}>
                  {TOW_TYPES.map((id) => (
                    <Pressable key={id} disabled={busy} onPress={() => setTowType(id)} style={[styles.iconChip, {borderColor: theme.primary}, towType === id && {backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{checked: towType === id}} accessibilityLabel={t.vehicle.types[id]}>
                      <VehicleGlyph type={id} color={towType === id ? "#fff" : theme.primary} />
                    </Pressable>
                  ))}
                </View>
                <View style={styles.fieldRow}>
                  <View style={styles.halfCol}>
                    <Text style={[styles.label, {color: theme.text}]}>{t.vehicle.widthMeters}</Text>
                    <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={width} onChangeText={setWidth} placeholder={t.vehicle.widthMeters} placeholderTextColor={theme.muted} keyboardType="decimal-pad" />
                  </View>
                  <View style={styles.halfCol}>
                    <Text style={[styles.label, {color: theme.text}]}>{t.vehicle.height}</Text>
                    <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={towHeight} onChangeText={setTowHeight} placeholder={t.vehicle.height} placeholderTextColor={theme.muted} keyboardType="decimal-pad" />
                  </View>
                </View>
                <Text style={[styles.hint, {color: theme.muted}]}>{t.provider.towWidthHint}</Text>
                <Pressable disabled={busy} onPress={() => setTowSearch(true)} style={[styles.input, {borderColor: theme.border}]} accessibilityRole="button" accessibilityLabel={t.provider.towAddress}>
                  <Text style={{color: towPoint ? theme.text : theme.muted}} numberOfLines={1}>{towPoint ? formatPoint(towPoint.lat, towPoint.lng) : t.provider.towAddressUnset}</Text>
                </Pressable>
                {towPoint ? <Text style={[styles.coords, {color: theme.muted}]}>{t.provider.towPositionSet}</Text> : <Text style={[styles.coords, {color: theme.muted}]}>{t.provider.towPositionUnset}</Text>}
              </View>
            </View>
            <Pressable disabled={busy} onPress={onContinueTow} style={[styles.primary, {backgroundColor: theme.primary}, busy && styles.disabled]}>
              <Text style={styles.primaryText}>{t.roles.finish}</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
      <Overlay visible={mobileShopSearch} variant="fullScreen" closeLabel={t.common.cancel} onClose={() => setMobileShopSearch(false)}>
        <PlaceSearchScreen
          t={t}
          token={token ?? undefined}
          lang={lang}
          title={t.provider.shopAddress}
          placeholder={t.provider.shopAddress}
          onPick={onPickMobileShopPlace}
          onPickOnMap={() => {
            setMobileShopSearch(false);
            setMobileShopMap(true);
          }}
          onClose={() => setMobileShopSearch(false)}
        />
      </Overlay>
      <Overlay visible={mobileShopMap} variant="fullScreen" closeLabel={t.common.cancel} onClose={() => setMobileShopMap(false)}>
        <MapPickOverlay
          t={t}
          lang={lang}
          title={t.provider.shopAddress}
          initial={mobileShopPoint}
          onPick={onConfirmMobileShopMap}
          onClose={() => setMobileShopMap(false)}
        />
      </Overlay>
      <Overlay visible={shopSearch} variant="fullScreen" closeLabel={t.common.cancel} onClose={() => setShopSearch(false)}>
        <PlaceSearchScreen
          t={t}
          token={token ?? undefined}
          lang={lang}
          title={t.provider.shopAddress}
          placeholder={t.provider.shopAddress}
          onPick={onPickShopPlace}
          onPickOnMap={() => {
            setShopSearch(false);
            setShopMap(true);
          }}
          onClose={() => setShopSearch(false)}
        />
      </Overlay>
      <Overlay visible={shopMap} variant="fullScreen" closeLabel={t.common.cancel} onClose={() => setShopMap(false)}>
        <MapPickOverlay
          t={t}
          lang={lang}
          title={t.provider.shopAddress}
          initial={shopPoint}
          onPick={onConfirmShopMap}
          onClose={() => setShopMap(false)}
        />
      </Overlay>
      <Overlay visible={towSearch} variant="fullScreen" closeLabel={t.common.cancel} onClose={() => setTowSearch(false)}>
        <PlaceSearchScreen
          t={t}
          token={token ?? undefined}
          lang={lang}
          title={t.provider.towAddress}
          placeholder={t.provider.towAddress}
          onPick={onPickTowPlace}
          onPickOnMap={() => {
            setTowSearch(false);
            setTowMap(true);
          }}
          onClose={() => setTowSearch(false)}
        />
      </Overlay>
      <Overlay visible={towMap} variant="fullScreen" closeLabel={t.common.cancel} onClose={() => setTowMap(false)}>
        <MapPickOverlay
          t={t}
          lang={lang}
          title={t.provider.towAddress}
          initial={towPoint}
          onPick={onConfirmTowMap}
          onClose={() => setTowMap(false)}
        />
      </Overlay>
      <Overlay visible={hoursOpen} variant="sheet" title={t.provider.hours} closeLabel={t.common.cancel} onClose={() => setHoursOpen(false)}>
        <ShopHoursEditor t={t} week={week} setDay={setDay} />
      </Overlay>
      {serviceEdit ? (
        <ServiceEditSheet
          t={t}
          kind={serviceEdit.scope === "shop" ? "SHOP" : "MOBILE_SHOP"}
          service={serviceEdit.service}
          vehicleClasses={shopClasses}
          towType={mobileShopType}
          bookingEnabled={false}
          existing={serviceEdit.index !== null}
          onSave={(next) => {
            const update = (rows: ServiceDraft[]) => serviceEdit.index === null ?
              [...rows, next] :
              rows.map((row, index) => index === serviceEdit.index ? next : row);
            if (serviceEdit.scope === "shop") setShopServices(update);
            else setMobileShopServices(update);
            setServiceEdit(null);
          }}
          onRemove={serviceEdit.index === null ? undefined : () => {
            const remove = (rows: ServiceDraft[]) => rows.filter((_, index) => index !== serviceEdit.index);
            if (serviceEdit.scope === "shop") setShopServices(remove);
            else setMobileShopServices(remove);
            setServiceEdit(null);
          }}
          onClose={() => setServiceEdit(null)}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  root: {flex: 1},
  scroll: {flex: 1},
  container: {padding: 20, gap: 12},
  title: {fontSize: 22, fontWeight: "700"},
  subtitle: {fontSize: 13, marginTop: 4, marginBottom: 8},
  hint: {fontSize: 12, lineHeight: 17},
  label: {fontSize: 13, fontWeight: "700"},
  header: {flexDirection: "row", alignItems: "center", minHeight: 32},
  dots: {flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingRight: 22},
  dot: {width: 8, height: 8, borderRadius: 4},
  dotActive: {width: 20},
  error: {fontSize: 13, marginBottom: 4},
  card: {borderWidth: 1, borderRadius: 16, padding: 12, gap: 8},
  option: {borderWidth: 1, borderRadius: 8, padding: 10, flexDirection: "row", alignItems: "center", gap: 8},
  iconSlot: {width: 24, alignItems: "center"},
  subForm: {gap: 8, paddingTop: 4},
  input: {borderWidth: 1, borderRadius: 8, padding: 10},
  row: {flexDirection: "row", gap: 8, flexWrap: "wrap"},
  fieldRow: {flexDirection: "row", gap: 8},
  halfCol: {flex: 1, minWidth: 0, gap: 8},
  iconChip: {width: 44, height: 44, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center"},
  coords: {fontSize: 12},
  primary: {borderRadius: 8, padding: 12, alignItems: "center"},
  disabled: {opacity: 0.6},
  primaryText: {color: "#fff", fontWeight: "700"},
  skip: {textAlign: "center", marginTop: 8},
});
