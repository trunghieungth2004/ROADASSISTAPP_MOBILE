import {useCallback, useState} from "react";
import {Linking, Pressable, ScrollView, StyleSheet, Switch, View} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "../components/ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {useFocusEffect, useNavigation} from "@react-navigation/native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {missingKinds} from "./more/providerUi";
import {useAuth} from "../context/AuthContext";
import {useProfile} from "../context/ProfileContext";
import {useStrings} from "../context/LanguageContext";
import {darkTheme, lightTheme} from "../theme";
import ScreenContainer from "../components/ui/ScreenContainer";
import Snack from "../components/ui/Snack";
import {snackBottom} from "../components/ui/snackOffset";
import {createProvider, myProviders, type Provider} from "../api/providers";
import {disputeWarrantyClaim, myWarrantyClaims, respondWarrantyClaim, shopWarrantyClaims, type WarrantyClaim, type WarrantyDeclineReason} from "../api/warranty";
import {getNotificationPrefs, updateNotificationPrefs, type NotificationPrefs} from "../api/notifications";
import {normalizeTowPlate, parseTowWidth, validateTowDraft} from "../services/towPlates";
import type {MobileShopDraft, ShopDraft, TowDraft} from "./OnboardingScreen";
import OnboardingScreen from "./OnboardingScreen";
import WarrantyDeclineDialog from "./warranty/WarrantyDeclineDialog";
import Overlay from "../components/overlay/Overlay";
import {useThemeMode} from "../context/ThemeContext";
import {toMessage} from "../api/client";

export default function SettingsScreen() {
  const {t, lang, toggle} = useStrings();
  const {token} = useAuth();
  const {user, refresh, markOnboarded} = useProfile();
  const {mode, toggle: toggleTheme} = useThemeMode();
  const scheme = mode;
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [notice, setNotice] = useState<string | null>(null);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [servicesBusy, setServicesBusy] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [prefsBusy, setPrefsBusy] = useState(false);
  const [prefsError, setPrefsError] = useState<string | null>(null);
  const [warrantyOpen, setWarrantyOpen] = useState(false);
  const [warrantyClaims, setWarrantyClaims] = useState<WarrantyClaim[]>([]);
  const [warrantyBusy, setWarrantyBusy] = useState(false);
  const [warrantyError, setWarrantyError] = useState<string | null>(null);
  const [declineFor, setDeclineFor] = useState<WarrantyClaim | null>(null);
  const [declineError, setDeclineError] = useState<string | null>(null);
  const [myWarrantyOpen, setMyWarrantyOpen] = useState(false);
  const [myClaims, setMyClaims] = useState<WarrantyClaim[]>([]);
  const [myWarrantyError, setMyWarrantyError] = useState<string | null>(null);
  const [disputeFor, setDisputeFor] = useState<WarrantyClaim | null>(null);
  const [disputeNote, setDisputeNote] = useState("");
  const [disputeBusy, setDisputeBusy] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);
  const loadWarranty = useCallback(async (): Promise<void> => {
    if (!token) return;
    try {
      setWarrantyClaims(await shopWarrantyClaims(token));
      setWarrantyError(null);
    } catch (err) {
      setWarrantyError(toMessage(err));
    }
  }, [token]);

  const loadMyWarranty = useCallback(async (): Promise<void> => {
    if (!token) return;
    try {
      setMyClaims(await myWarrantyClaims(token));
      setMyWarrantyError(null);
    } catch (err) {
      setMyWarrantyError(toMessage(err));
    }
  }, [token]);

  const openDispute = (claim: WarrantyClaim): void => {
    setDisputeFor(claim);
    setDisputeNote("");
    setDisputeError(null);
  };

  const submitDispute = async (): Promise<void> => {
    if (!token || !disputeFor || disputeBusy) return;
    setDisputeBusy(true);
    setDisputeError(null);
    try {
      await disputeWarrantyClaim(token, disputeFor.id, disputeNote.trim() || undefined);
      setDisputeFor(null);
      setNotice(t.provider.disputeDone);
      await loadMyWarranty();
    } catch (err) {
      setDisputeError(toMessage(err));
    } finally {
      setDisputeBusy(false);
    }
  };

  const respondClaim = async (claim: WarrantyClaim): Promise<void> => {
    if (!token || warrantyBusy) return;
    setWarrantyBusy(true);
    try {
      await respondWarrantyClaim(token, claim.id, true);
      setNotice(t.provider.warrantyAccepted);
      await loadWarranty();
    } catch (err) {
      setWarrantyError(toMessage(err));
    } finally {
      setWarrantyBusy(false);
    }
  };

  const submitDecline = async (
    reasonCode: WarrantyDeclineReason,
    note: string,
  ): Promise<void> => {
    if (!token || !declineFor || warrantyBusy) return;
    setWarrantyBusy(true);
    setDeclineError(null);
    try {
      await respondWarrantyClaim(token, declineFor.id, false, {
        reasonCode,
        note,
      });
      setDeclineFor(null);
      setNotice(t.provider.warrantyDeclined);
      await loadWarranty();
    } catch (err) {
      setDeclineError(toMessage(err));
    } finally {
      setWarrantyBusy(false);
    }
  };

  const loadProviders = useCallback(async (): Promise<void> => {
    if (!token) {
      setProviders([]);
      return;
    }
    try {
      setProviders(await myProviders(token));
    } catch (err) {
      setProviderError(toMessage(err));
    }
  }, [token]);
  const loadPrefs = useCallback(async (): Promise<void> => {
    if (!token) {
      setPrefs(null);
      return;
    }
    try {
      setPrefs(await getNotificationPrefs(token));
      setPrefsError(null);
    } catch (err) {
      setPrefsError(toMessage(err));
    }
  }, [token]);
  useFocusEffect(useCallback(() => {
    void loadProviders();
    void loadPrefs();
  }, [loadProviders, loadPrefs]));
  async function onPref(key: keyof NotificationPrefs, value: boolean): Promise<void> {
    if (!token || prefsBusy) return;
    const previous = prefs;
    setPrefs((current) => (current === null ? current : {...current, [key]: value}));
    setPrefsBusy(true);
    setPrefsError(null);
    try {
      setPrefs(await updateNotificationPrefs(token, {[key]: value}));
    } catch (err) {
      setPrefs(previous);
      setPrefsError(toMessage(err));
    } finally {
      setPrefsBusy(false);
    }
  }
  const services = user?.services ?? [];
  async function onServicesFinish(selected: string[], shop: ShopDraft | null, tow: TowDraft | null, mobileShop: MobileShopDraft | null) {
    setServicesBusy(true); setServicesError(null);
    try {
      if (shop && shop.name.trim() === "") throw new Error(t.provider.invalidName);
      if (tow) {
        if (tow.name.trim() === "") throw new Error(t.provider.invalidName);
        if (validateTowDraft({plate: tow.plate, vehicleType: tow.vehicleType, width: tow.width})) throw new Error(t.tow.invalid);
      }
      if (mobileShop) {
        if (mobileShop.name.trim() === "") throw new Error(t.provider.invalidName);
        if (mobileShop.licenseNumber.trim() === "") throw new Error(t.provider.invalidLicense);
      }
      const held = user?.services ?? [];
      for (const service of selected) {
        if (!held.includes(service)) await markOnboarded(service);
      }
      if (token) {
        if (mobileShop) {
          try {
            await createProvider({kind: "MOBILE_SHOP", name: mobileShop.name.trim(), lat: mobileShop.lat, lng: mobileShop.lng, ...(mobileShop.label ? {label: mobileShop.label} : {}), plate: normalizeTowPlate(mobileShop.plate), vehicleType: mobileShop.vehicleType, licenseNumber: mobileShop.licenseNumber.trim()}, token);
          } catch (err) {
            throw new Error(`${t.provider.createMobileShopFailed} ${toMessage(err)}`);
          }
        }
        if (shop) {
          try {
            await createProvider({kind: "SHOP", name: shop.name.trim(), lat: shop.lat, lng: shop.lng, ...(shop.label ? {label: shop.label} : {}), ...(shop.openHours ? {openHours: shop.openHours} : {}), ...(shop.vehicleClasses ? {vehicleClasses: shop.vehicleClasses} : {})}, token);
          } catch (err) {
            throw new Error(`${t.provider.createShopFailed} ${toMessage(err)}`);
          }
        }
        if (tow) {
          try {
            await createProvider({kind: "TOW", name: tow.name.trim(), lat: tow.lat, lng: tow.lng, plate: normalizeTowPlate(tow.plate), vehicleType: tow.vehicleType, vehicleWidth: parseTowWidth(tow.width) ?? undefined}, token);
          } catch (err) {
            throw new Error(`${t.provider.createTowFailed} ${toMessage(err)}`);
          }
        }
      }
      await refresh(); await loadProviders(); setServicesOpen(false); setNotice(t.provider.saved);
    } catch (err) { setServicesError(toMessage(err)); } finally { setServicesBusy(false); }
  }
  async function onServicesSkip() {
    setServicesBusy(true); setServicesError(null);
    try { await markOnboarded("RIDER"); await refresh(); setServicesOpen(false); } catch (err) { setServicesError(toMessage(err)); } finally { setServicesBusy(false); }
  }
  const missing = missingKinds(providers);
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={[styles.scroll, {backgroundColor: theme.background}]}>
        <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <Pressable style={styles.listRow} onPress={() => { setServicesError(null); setServicesOpen(true); }}><MaterialIcons name="bookmark" size={20} color={theme.primary} /><Text style={[styles.listText, {color: theme.text}]}>{t.more.services}</Text></Pressable>
          <View style={[styles.divider, {backgroundColor: theme.divider}]} />
          <Pressable style={styles.listRow} onPress={() => void Linking.openURL("tel:112")} accessibilityRole="button" accessibilityLabel={t.more.emergency}>
            <MaterialIcons name="emergency" size={20} color={theme.danger} />
            <Text style={[styles.listText, {color: theme.danger}]}>{t.more.emergency}</Text>
            
          </Pressable>
          <Pressable style={styles.listRow} onPress={() => navigation.navigate("Permissions" as never)} accessibilityRole="button" accessibilityLabel={t.more.permissions}>
            <MaterialIcons name="lock" size={20} color={theme.primary} />
            <Text style={[styles.listText, {color: theme.text}]}>{t.more.permissions}</Text>
            
          </Pressable>
          <View style={[styles.divider, {backgroundColor: theme.divider}]} />
          <Pressable style={styles.listRow} onPress={() => navigation.navigate("Warranty" as never)} accessibilityRole="button" accessibilityLabel={t.provider.myWarrantyClaims}>
            <MaterialIcons name="verified" size={20} color={theme.primary} />
            <Text style={[styles.listText, {color: theme.text}]}>{t.provider.myWarrantyClaims}</Text>
            
          </Pressable>
          {providers.length > 0 ? (
            <>
              <View style={[styles.divider, {backgroundColor: theme.divider}]} />
              <Pressable style={styles.listRow} onPress={() => navigation.navigate("Warranty" as never)} accessibilityRole="button" accessibilityLabel={t.provider.warrantyClaims}>
                <MaterialIcons name="storefront" size={20} color={theme.primary} />
                <Text style={[styles.listText, {color: theme.text}]}>{t.provider.warrantyClaims}</Text>
                
              </Pressable>
            </>
          ) : null}
          <Pressable style={styles.listRow} onPress={() => navigation.navigate("Providers" as never)} accessibilityRole="button" accessibilityLabel={t.provider.title}>
            <MaterialIcons name="store" size={20} color={theme.primary} />
            <Text style={[styles.listText, {color: theme.text}]}>{t.provider.title}</Text>
            
          </Pressable>
        </View>
        {token ? (
          <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
            <View style={styles.listRow}>
              <MaterialIcons name="notifications" size={20} color={theme.primary} />
              <Text style={[styles.listText, {color: theme.text}]}>{t.more.notifications}</Text>
            </View>
            <View style={[styles.divider, {backgroundColor: theme.divider}]} />
            <View style={styles.settingRow}>
              <View style={styles.settingText}>
                <Text style={[styles.settingTitle, {color: theme.text}]}>{t.more.paymentUpdates}</Text>
                <Text style={[styles.settingHint, {color: theme.muted}]}>{t.more.paymentUpdatesHint}</Text>
              </View>
              <Switch
                value={prefs?.paymentUpdates ?? true}
                onValueChange={(value) => void onPref("paymentUpdates", value)}
                disabled={prefsBusy || prefs === null}
                trackColor={{false: theme.divider, true: theme.primary}}
                thumbColor="#ffffff"
                accessibilityLabel={t.more.paymentUpdates}
              />
            </View>
            <View style={[styles.divider, {backgroundColor: theme.divider}]} />
            <View style={styles.settingRow}>
              <View style={styles.settingText}>
                <Text style={[styles.settingTitle, {color: theme.text}]}>{t.more.payoutUpdates}</Text>
                <Text style={[styles.settingHint, {color: theme.muted}]}>{t.more.payoutUpdatesHint}</Text>
              </View>
              <Switch
                value={prefs?.payoutUpdates ?? true}
                onValueChange={(value) => void onPref("payoutUpdates", value)}
                disabled={prefsBusy || prefs === null}
                trackColor={{false: theme.divider, true: theme.primary}}
                thumbColor="#ffffff"
                accessibilityLabel={t.more.payoutUpdates}
              />
            </View>
          </View>
        ) : null}
        <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <Pressable style={styles.listRow} onPress={toggleTheme} accessibilityRole="switch" accessibilityState={{checked: scheme === "dark"}}><MaterialIcons name={scheme === "dark" ? "light-mode" : "dark-mode"} size={20} color={theme.primary} /><Text style={[styles.listText, {color: theme.text}]}>{t.more.appearance}</Text><View pointerEvents="none"><Switch value={scheme === "dark"} onValueChange={() => toggleTheme()} trackColor={{false: theme.divider, true: theme.primary}} thumbColor="#ffffff" /></View></Pressable>
          <View style={[styles.divider, {backgroundColor: theme.divider}]} />
          <Pressable style={styles.listRow} onPress={toggle}><MaterialIcons name="translate" size={20} color={theme.primary} /><Text style={[styles.listText, {color: theme.text}]}>{t.more.language}</Text><Text style={[styles.listSecondary, {color: theme.muted}]}>{lang === "en" ? "EN" : "VI"}</Text></Pressable>
        </View>
        <Overlay visible={servicesOpen} variant="fullScreen" closeLabel={t.common.cancel} onClose={() => setServicesOpen(false)}>
          {servicesOpen ? (
            <OnboardingScreen t={t} lang={lang} token={token} busy={servicesBusy} error={servicesError} selectedServices={services} registered={{shop: !missing.shop, tow: !missing.tow, mobileShop: !missing.mobileShop}} onFinish={(selected, shop, tow, mobileShop) => void onServicesFinish(selected, shop, tow, mobileShop)} onSkip={() => void onServicesSkip()} />
          ) : null}
        </Overlay>
      </ScrollView>
      {providerError ? (
        <Snack message={providerError} severity="error" bottom={snackBottom(insets.bottom)} dangerColor={theme.danger} onHide={() => setProviderError(null)} />
      ) : prefsError ? (
        <Snack message={prefsError} severity="error" bottom={snackBottom(insets.bottom)} dangerColor={theme.danger} onHide={() => setPrefsError(null)} />
      ) : (
        <Snack message={notice} severity="confirm" bottom={snackBottom(insets.bottom)} accentColor={theme.primary} onHide={() => setNotice(null)} />
      )}
      <WarrantyDeclineDialog
        visible={declineFor !== null}
        serviceName={declineFor?.serviceName ?? ""}
        t={t}
        theme={theme}
        busy={warrantyBusy}
        error={declineError}
        onSubmit={(reasonCode, note) => void submitDecline(reasonCode, note)}
        onClose={() => {
          setDeclineFor(null);
          setDeclineError(null);
        }}
      />
      <Overlay
        visible={warrantyOpen}
        variant="sheet"
        title={t.provider.warrantyClaims}
        closeLabel={t.common.close}
        onClose={() => setWarrantyOpen(false)}
      >
        {warrantyError ? <Text style={[styles.listSecondary, {color: theme.danger}]}>{warrantyError}</Text> : null}
        {warrantyClaims.length === 0 ? (
          <Text style={[styles.listSecondary, {color: theme.muted}]}>{t.provider.warrantyNone}</Text>
        ) : warrantyClaims.map((claim) => (
          <View key={claim.id} style={{gap: 6, paddingVertical: 8}}>
            <Text style={[styles.listText, {color: theme.text}]}>{claim.serviceName}</Text>
            <Text style={[styles.listSecondary, {color: theme.muted}]}>{`${claim.status} · ${claim.reason}`}</Text>
            {claim.status === "OPEN" ? (
              <View style={{flexDirection: "row", gap: 8}}>
                <Pressable style={[styles.primary, {backgroundColor: theme.primary}]} disabled={warrantyBusy} onPress={() => void respondClaim(claim)}>
                  <Text style={styles.primaryText}>{t.assist.accept}</Text>
                </Pressable>
                <Pressable style={[styles.primary, {borderWidth: 1, borderColor: theme.danger}]} disabled={warrantyBusy} onPress={() => setDeclineFor(claim)}>
                  <Text style={[styles.primaryText, {color: theme.danger}]}>{t.provider.decline}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ))}
      </Overlay>
      <Overlay
        visible={myWarrantyOpen}
        variant="sheet"
        title={t.provider.myWarrantyClaims}
        closeLabel={t.common.close}
        onClose={() => setMyWarrantyOpen(false)}
      >
        {myWarrantyError ? <Text style={[styles.listSecondary, {color: theme.danger}]}>{myWarrantyError}</Text> : null}
        {myClaims.length === 0 ? (
          <Text style={[styles.listSecondary, {color: theme.muted}]}>{t.provider.myWarrantyNone}</Text>
        ) : myClaims.map((claim) => (
          <View key={claim.id} style={{gap: 6, paddingVertical: 8}}>
            <Text style={[styles.listText, {color: theme.text}]}>{claim.serviceName}</Text>
            <Text style={[styles.listSecondary, {color: theme.muted}]}>{`${claim.status} · ${claim.reason}`}</Text>
            <Text style={[styles.listSecondary, {color: theme.muted}]}>{`${t.bills.warranty}: ${new Date(claim.warrantyUntil).toLocaleDateString()}`}</Text>
            {claim.status === "DECLINED" ? (
              <Pressable style={[styles.primary, {backgroundColor: theme.primary}]} onPress={() => openDispute(claim)}>
                <Text style={styles.primaryText}>{t.provider.dispute}</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </Overlay>
      <Overlay
        visible={disputeFor !== null}
        variant="dialog"
        title={t.provider.dispute}
        closeLabel={t.common.cancel}
        onClose={() => setDisputeFor(null)}
        scrollable={false}
        actions={[{
          label: t.provider.disputeSubmit,
          tone: "primary",
          busy: disputeBusy,
          disabled: disputeNote.trim().length < 5,
          onPress: () => void submitDispute(),
        }]}
      >
        <Text style={[styles.listSecondary, {color: theme.muted}]}>{t.provider.disputeHint}</Text>
        {disputeError ? <Text style={[styles.listSecondary, {color: theme.danger}]}>{disputeError}</Text> : null}
        <TextInput
          style={[styles.input, {borderColor: theme.border, color: theme.text}]}
          value={disputeNote}
          onChangeText={setDisputeNote}
          placeholder={t.provider.disputeHint}
          placeholderTextColor={theme.muted}
          multiline
        />
      </Overlay>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  primary: {borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12},
  primaryText: {fontWeight: "700", color: "#fff", textAlign: "center"},
  scroll: {padding: 16, gap: 12},
  card: {borderWidth: 1, borderRadius: 16, overflow: "hidden"},
  listRow: {flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16},
  listText: {flex: 1, fontSize: 15, fontWeight: "500"},
  listSecondary: {fontSize: 13},
  divider: {height: 1, marginHorizontal: 16},
  settingRow: {flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16},
  settingText: {flex: 1, gap: 2},
  settingTitle: {fontSize: 14, fontWeight: "600"},
  settingHint: {fontSize: 12},
  optionBlock: {gap: 8, paddingVertical: 14, paddingHorizontal: 16},
  optionLabel: {fontSize: 13, fontWeight: "700"},
  optionRow: {flexDirection: "row", flexWrap: "wrap", gap: 8},
  optChip: {borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16},
  optText: {fontSize: 13, fontWeight: "600"},
  input: {borderWidth: 1, borderRadius: 8, padding: 10, minHeight: 72, textAlignVertical: "top"},
});
