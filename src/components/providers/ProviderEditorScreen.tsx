import {useEffect, useState} from "react";
import {Keyboard, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import ProviderFormSheet from "./ProviderFormSheet";
import {useProviderDraft} from "./useProviderDraft";
import Overlay, {ActionFooter} from "../overlay/Overlay";
import MapPickOverlay from "../map/MapPickOverlay";
import PlaceSearchScreen from "../../screens/PlaceSearchScreen";
import {useAuth} from "../../context/AuthContext";
import {useStrings} from "../../context/LanguageContext";
import {fetchMeBundle, type MeVehicle} from "../../api/users";
import {useAppMode} from "../../context/ThemeContext";
import {myProviders, providerPricingLimits, type Provider, type ProviderPricingLimits} from "../../api/providers";
import {themeForMode} from "../../theme";
import {AppText as Text} from "../ui/AppText";
import type {Strings} from "../../i18n/en";

type Props = {
  t: Strings;
  token: string | null;
  kind: "SHOP" | "TOW" | "MOBILE_SHOP";
  provider: Provider;
  onClose: () => void;
  onSaved: () => void;
};

function titleFor(kind: Props["kind"], t: Strings): string {
  if (kind === "TOW") return t.provider.editTow;
  if (kind === "MOBILE_SHOP") return t.provider.editMobileShop;
  return t.provider.editShop;
}

export default function ProviderEditorScreen({t, token, kind, provider, onClose, onSaved}: Props) {
  const {lang} = useStrings();
  const {token: authToken} = useAuth();
  const insets = useSafeAreaInsets();
  const scheme = useAppMode();
  const theme = themeForMode(scheme);
  const [vehicles, setVehicles] = useState<MeVehicle[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [pricingLimits, setPricingLimits] = useState<ProviderPricingLimits | null>(null);
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
    void providerPricingLimits(token)
      .then((limits) => {
        if (active) setPricingLimits(limits);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [token]);
  const draft = useProviderDraft(kind, provider, t, {providers, vehicles});
  function close(): void {
    Keyboard.dismiss();
    onClose();
  }
  async function save(): Promise<void> {
    if (!token) return;
    if (await draft.submit(token)) onSaved();
  }
  return (
    <Overlay visible variant="fullScreen" closeLabel={t.common.cancel} onClose={close}>
      <KeyboardAvoidingView behavior="padding" style={styles.root}>
        <View style={[styles.header, {borderBottomColor: theme.divider, paddingTop: insets.top + 8}]}>
          <Pressable style={[styles.back, {borderColor: theme.border, backgroundColor: theme.paper}]} onPress={close} accessibilityRole="button" accessibilityLabel={t.common.back}>
            <MaterialIcons name="arrow-back" size={22} color={theme.text} />
          </Pressable>
          <View style={styles.headText}>
            <Text style={[styles.title, {color: theme.text}]}>{titleFor(kind, t)}</Text>
            <Text style={[styles.hint, {color: theme.muted}]} numberOfLines={1}>{provider.name}</Text>
          </View>
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <ProviderFormSheet t={t} draft={draft} pricingLimits={pricingLimits} />
        </ScrollView>
        <View style={[styles.footer, {borderTopColor: theme.divider, backgroundColor: theme.paper, paddingBottom: insets.bottom + 12}]}>
          <ActionFooter
            actions={[
              {label: t.common.cancel, tone: "neutral", outline: true, group: "secondary", onPress: close},
              {label: t.common.save, tone: "primary", busy: draft.busy, onPress: () => void save()},
            ]}
            layout="primary"
          />
        </View>
      </KeyboardAvoidingView>
      <Overlay visible={draft.shopSearch} variant="fullScreen" closeLabel={t.common.cancel} onClose={() => draft.setShopSearch(false)}>
        <PlaceSearchScreen
          t={t}
          token={authToken ?? token ?? undefined}
          lang={lang}
          title={t.provider.shopAddress}
          placeholder={t.provider.shopAddress}
          onPick={(place) => {
            draft.onPickPlace(place);
            void draft.refreshNearbyExisting(token);
          }}
          onPickOnMap={() => {
            draft.setShopSearch(false);
            draft.openMapPick("shop");
          }}
          onClose={() => draft.setShopSearch(false)}
        />
      </Overlay>
      <Overlay visible={draft.towSearch} variant="fullScreen" closeLabel={t.common.cancel} onClose={() => draft.setTowSearch(false)}>
        <PlaceSearchScreen
          t={t}
          token={authToken ?? token ?? undefined}
          lang={lang}
          title={t.provider.towAddress}
          placeholder={t.provider.towAddress}
          onPick={draft.onPickTowPlace}
          onPickOnMap={() => {
            draft.setTowSearch(false);
            draft.openMapPick("tow");
          }}
          onClose={() => draft.setTowSearch(false)}
        />
      </Overlay>
      <Overlay visible={draft.mapPick} variant="fullScreen" closeLabel={t.common.cancel} onClose={() => draft.setMapPick(false)}>
        <MapPickOverlay
          t={t}
          lang={lang}
          title={kind === "TOW" ? t.provider.towAddress : t.provider.shopAddress}
          initial={kind === "TOW" ? draft.towPoint : draft.point}
          onPick={(lat, lng, label) => {
            draft.onConfirmMapPoint(lat, lng, label);
            void draft.refreshNearbyExisting(token);
          }}
          onClose={() => draft.setMapPick(false)}
        />
      </Overlay>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  header: {flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1},
  back: {width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center"},
  headText: {flex: 1, minWidth: 0, gap: 2},
  title: {fontSize: 19, fontWeight: "800"},
  hint: {fontSize: 12},
  scroll: {flex: 1},
  content: {padding: 16, paddingBottom: 28},
  footer: {borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 12},
});
