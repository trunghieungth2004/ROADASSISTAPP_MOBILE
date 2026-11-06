import {useCallback, useState} from "react";
import {Pressable, ScrollView, StyleSheet, View} from "react-native";
import {useFocusEffect, useNavigation} from "@react-navigation/native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../components/ui/AppText";
import ScreenContainer from "../components/ui/ScreenContainer";
import Snack from "../components/ui/Snack";
import PhotoThumb from "../components/ui/PhotoThumb";
import {usePhotoViewer} from "../components/ui/PhotoViewer";
import {useAuth} from "../context/AuthContext";
import {useProfile} from "../context/ProfileContext";
import {useStrings} from "../context/LanguageContext";
import {useThemeMode} from "../context/ThemeContext";
import {darkTheme, lightTheme, type AppTheme} from "../theme";
import {toMessage} from "../api/client";
import {listProfiles, vehicleHistory, type VehicleHistoryItem, type VehicleHistoryLine, type VehicleProfile} from "../api/vehicles";
import {myProviders, type Provider} from "../api/providers";
import {disputeWarrantyClaim, myWarrantyClaims, respondWarrantyClaim, shopWarrantyClaims, type WarrantyClaim} from "../api/warranty";
import {resolvePhotoUrl} from "../services/photos";
import ShopDetailSheet from "./assist/ShopDetailSheet";
import WarrantyClaimDialog from "./bills/WarrantyClaimDialog";
import {billDateLabel} from "./bills/billLabels";

type CoverageRow = {
  profile: VehicleProfile;
  item: VehicleHistoryItem;
  line: VehicleHistoryLine;
};

function statusColor(status: string, theme: AppTheme): string {
  if (status === "OPEN") return "#d97706";
  if (status === "REBOOKED" || status === "ACCEPTED") return theme.primary;
  if (status === "COMPLETED" || status === "RESOLVED") return theme.success;
  if (status === "DECLINED" || status === "REJECTED") return theme.danger;
  if (status === "DISPUTED") return "#8b5cf6";
  return theme.muted;
}

function statusLabel(status: string, t: ReturnType<typeof useStrings>["t"]): string {
  if (status === "OPEN") return t.vehicle.claimOpen;
  if (status === "REBOOKED" || status === "ACCEPTED") return t.vehicle.claimRebooked;
  if (status === "COMPLETED") return t.vehicle.claimCompleted;
  if (status === "DECLINED" || status === "REJECTED") return t.vehicle.claimDeclined;
  if (status === "DISPUTED") return t.provider.dispute;
  if (status === "RESOLVED") return t.vehicle.claimResolved;
  return status;
}

export default function WarrantyScreen() {
  const {t} = useStrings();
  const {token} = useAuth();
  const {user} = useProfile();
  const {mode} = useThemeMode();
  const theme = mode === "dark" ? darkTheme : lightTheme;
  const navigation = useNavigation();
  const photoViewer = usePhotoViewer(t.common.cancel);
  const services = user?.services ?? [];
  const riderRole = services.includes("RIDER");
  const [role, setRole] = useState<"rider" | "provider">(riderRole ? "rider" : "provider");
  const [riderTab, setRiderTab] = useState<"coverage" | "claims">("coverage");
  const [providerTab, setProviderTab] = useState<"open" | "rework" | "closed">("open");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [coverage, setCoverage] = useState<CoverageRow[]>([]);
  const [claims, setClaims] = useState<WarrantyClaim[]>([]);
  const [shopClaims, setShopClaims] = useState<WarrantyClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [shopFor, setShopFor] = useState<Provider | null>(null);
  const [claimFor, setClaimFor] = useState<{ticketId: string; lineId: string; name: string} | null>(null);
  const providerRole = providers.length > 0 || services.includes("SHOP") || services.includes("TOW") || services.includes("MOBILE_SHOP");

  const load = useCallback(async (): Promise<void> => {
    if (!token) return;
    setLoading(true);
    try {
      const [providerRows, riderClaims, providerClaims] = await Promise.all([
        myProviders(token).catch(() => []),
        myWarrantyClaims(token).catch(() => []),
        shopWarrantyClaims(token).catch(() => []),
      ]);
      setProviders(providerRows);
      setClaims(riderClaims);
      setShopClaims(providerClaims);
      if (riderRole) {
        const profiles = await listProfiles(token).catch(() => []);
        const histories = await Promise.all(profiles.map((profile) =>
          vehicleHistory(profile.id, token).catch(() => ({profileId: profile.id, items: []}))));
        const rows: CoverageRow[] = [];
        profiles.forEach((profile, index) => {
          for (const item of histories[index]?.items ?? []) {
            for (const line of item.lines) {
              if (typeof line.warrantyUntil === "string" && line.warrantyUntil !== "") {
                rows.push({profile, item, line});
              }
            }
          }
        });
        rows.sort((a, b) => (a.line.warrantyUntil ?? "").localeCompare(b.line.warrantyUntil ?? ""));
        setCoverage(rows);
      } else {
        setCoverage([]);
      }
      setError(null);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setLoading(false);
    }
  }, [token, riderRole]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  async function respond(claim: WarrantyClaim, accept: boolean): Promise<void> {
    if (!token || busy) return;
    setBusy(true);
    try {
      await respondWarrantyClaim(token, claim.id, accept);
      setNotice(accept ? t.provider.warrantyAccepted : t.provider.warrantyDeclined);
      await load();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function dispute(claim: WarrantyClaim): Promise<void> {
    if (!token || busy) return;
    setBusy(true);
    try {
      await disputeWarrantyClaim(token, claim.id);
      setNotice(t.provider.disputeDone);
      await load();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function openPhoto(path: string): void {
    void resolvePhotoUrl(path).then((uri) => {
      if (uri !== "") photoViewer.open(uri);
    });
  }

  const openClaims = shopClaims.filter((claim) => claim.status === "OPEN");
  const reworkClaims = shopClaims.filter((claim) => claim.status === "REBOOKED" || claim.status === "ACCEPTED");
  const closedClaims = shopClaims.filter((claim) => claim.status !== "OPEN" && claim.status !== "REBOOKED" && claim.status !== "ACCEPTED");
  const providerRows = providerTab === "open" ? openClaims : providerTab === "rework" ? reworkClaims : closedClaims;

  function claimCard(claim: WarrantyClaim, providerView: boolean) {
    const color = statusColor(claim.status, theme);
    return (
      <View key={claim.id} style={[styles.card, {borderColor: theme.border, backgroundColor: theme.paper}]}>
        <View style={styles.head}>
          <Text style={[styles.title, {color: theme.text}]} numberOfLines={1}>{claim.serviceName}</Text>
          <View style={[styles.pill, {backgroundColor: color}]}>
            <Text style={styles.pillText}>{statusLabel(claim.status, t)}</Text>
          </View>
        </View>
        <Text style={[styles.meta, {color: theme.muted}]}>
          {[claim.vehicleLabel, claim.vehiclePlate].filter((value) => typeof value === "string" && value !== "").join(" · ") || `#${claim.ticketId.slice(-6)}`}
        </Text>
        <Text style={[styles.meta, {color: theme.muted}]}>{`${t.bills.warranty}: ${billDateLabel(claim.warrantyUntil)}`}</Text>
        <Text style={[styles.body, {color: theme.text}]}>{claim.reason}</Text>
        {claim.shopResponse ? <Text style={[styles.meta, {color: theme.muted}]}>{claim.shopResponse}</Text> : null}
        {claim.photoUrls.length > 0 ? (
          <View style={styles.photoRow}>
            {claim.photoUrls.map((path, index) => (
              <PhotoThumb key={`${path}-${index}`} path={path} theme={theme} style={styles.photo} onPress={openPhoto} accessibilityLabel={`${t.assist.photos} ${index + 1}`} />
            ))}
          </View>
        ) : null}
        {providerView && claim.status === "OPEN" ? (
          <View style={styles.actions}>
            <Pressable style={[styles.primary, {backgroundColor: theme.primary}, busy && styles.disabled]} disabled={busy} onPress={() => void respond(claim, true)}>
              <Text style={styles.primaryText}>{t.assist.accept}</Text>
            </Pressable>
            <Pressable style={[styles.secondary, {borderColor: theme.danger}, busy && styles.disabled]} disabled={busy} onPress={() => void respond(claim, false)}>
              <Text style={[styles.primaryText, {color: theme.danger}]}>{t.provider.decline}</Text>
            </Pressable>
          </View>
        ) : null}
        {!providerView && claim.status === "DECLINED" ? (
          <Pressable style={[styles.secondary, {borderColor: theme.primary}]} onPress={() => void dispute(claim)}>
            <Text style={[styles.primaryText, {color: theme.primary}]}>{t.provider.dispute}</Text>
          </Pressable>
        ) : null}
        {claim.linkedTicketId ? (
          <Pressable style={[styles.secondary, {borderColor: theme.border}]} onPress={() => navigation.navigate("Tabs" as never)}>
            <Text style={[styles.primaryText, {color: theme.text}]}>{t.assist.viewTicket}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={[styles.scroll, {backgroundColor: theme.background}]}>
        <Text style={[styles.pageTitle, {color: theme.text}]}>{t.provider.warrantyTitle}</Text>
        {riderRole && providerRole ? (
          <View style={[styles.segment, {borderColor: theme.border}]}>
            {(["rider", "provider"] as const).map((value) => (
              <Pressable key={value} style={[styles.segmentItem, role === value && {backgroundColor: theme.primary}]} onPress={() => setRole(value)}>
                <Text style={[styles.segmentText, {color: role === value ? "#fff" : theme.text}]}>{value === "rider" ? t.vehicle.warrantyRider : t.vehicle.warrantyProvider}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {loading ? <Text style={[styles.meta, {color: theme.muted}]}>{t.common.loading}</Text> : null}
        {error ? <Text style={[styles.meta, {color: theme.danger}]}>{error}</Text> : null}
        {role === "rider" ? (
          <>
            <View style={styles.tabs}>
              {(["coverage", "claims"] as const).map((value) => (
                <Pressable key={value} style={[styles.tab, {borderColor: riderTab === value ? theme.primary : theme.border}]} onPress={() => setRiderTab(value)}>
                  <Text style={[styles.tabText, {color: riderTab === value ? theme.primary : theme.muted}]}>{value === "coverage" ? t.vehicle.warrantyCoverage : t.vehicle.warrantyClaimsTab}</Text>
                </Pressable>
              ))}
            </View>
            {riderTab === "coverage" ? (
              coverage.length === 0 ? <Text style={[styles.meta, {color: theme.muted}]}>{t.vehicle.warrantyNoCoverage}</Text> :
                coverage.map((row) => {
                  const active = Date.parse(row.line.warrantyUntil ?? "") > Date.now();
                  const claim = claims.find((item) => item.lineId === row.line.lineId) ?? null;
                  const provider = row.item.provider ?? null;
                  return (
                    <View key={`${row.item.ticketId}-${row.line.lineId}`} style={[styles.card, {borderColor: theme.border, backgroundColor: theme.paper}]}>
                      <View style={styles.head}>
                        <Pressable style={styles.headText} onPress={() => provider ? setShopFor(provider) : undefined} disabled={provider === null}>
                          <Text style={[styles.title, {color: theme.text}]} numberOfLines={1}>{row.line.name}</Text>
                          <View style={styles.providerRow}>
                            <MaterialIcons name="storefront" size={12} color={theme.primary} />
                            <Text style={[styles.providerName, {color: theme.primary}]} numberOfLines={1}>{provider?.name ?? row.item.providerName ?? row.item.ticketType}</Text>
                            {provider ? <MaterialIcons name="chevron-right" size={14} color={theme.muted} /> : null}
                          </View>
                        </Pressable>
                        <View style={[styles.pill, {backgroundColor: claim ? statusColor(claim.status, theme) : active ? theme.primary : theme.muted}]}>
                          <Text style={styles.pillText}>{claim ? statusLabel(claim.status, t) : active ? t.vehicle.warrantyActive : t.flag.expired}</Text>
                        </View>
                      </View>
                      <Text style={[styles.meta, {color: theme.muted}]}>{[row.profile.label, row.profile.plate].filter((value) => typeof value === "string" && value !== "").join(" · ")}</Text>
                      <Text style={[styles.meta, {color: theme.muted}]}>{`${t.bills.warranty}: ${billDateLabel(row.line.warrantyUntil)}`}</Text>
                      <View style={styles.rowBetween}>
                        <Text style={[styles.amount, {color: theme.text}]}>{`${row.line.amount.toLocaleString()} VND`}</Text>
                        {active && claim === null ? (
                          <Pressable style={[styles.secondary, {borderColor: theme.primary}]} onPress={() => setClaimFor({ticketId: row.item.ticketId, lineId: row.line.lineId, name: row.line.name})}>
                            <Text style={[styles.primaryText, {color: theme.primary}]}>{t.bills.claimWarranty}</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  );
                })
            ) : (
              claims.length === 0 ? <Text style={[styles.meta, {color: theme.muted}]}>{t.vehicle.warrantyNoClaims}</Text> :
                claims.map((claim) => claimCard(claim, false))
            )}
          </>
        ) : (
          <>
            <View style={styles.tabs}>
              {(["open", "rework", "closed"] as const).map((value) => (
                <Pressable key={value} style={[styles.tab, {borderColor: providerTab === value ? theme.primary : theme.border}]} onPress={() => setProviderTab(value)}>
                  <Text style={[styles.tabText, {color: providerTab === value ? theme.primary : theme.muted}]}>
                    {value === "open" ? t.vehicle.warrantyOpenClaims : value === "rework" ? t.vehicle.warrantyRework : t.vehicle.warrantyClosed}
                  </Text>
                </Pressable>
              ))}
            </View>
            {providerRows.length === 0 ? <Text style={[styles.meta, {color: theme.muted}]}>{t.vehicle.warrantyNoClaims}</Text> : providerRows.map((claim) => claimCard(claim, true))}
          </>
        )}
      </ScrollView>
      {photoViewer.node}
      {shopFor ? (
        <ShopDetailSheet
          t={t}
          shop={shopFor}
          openLabel={shopFor.accepting === false ? t.shop.closed : t.shop.open}
          openColor={shopFor.accepting === false ? theme.danger : theme.primary}
          serviceChannel="ASSIST"
          onClose={() => setShopFor(null)}
        />
      ) : null}
      <WarrantyClaimDialog
        visible={claimFor !== null}
        ticketId={claimFor?.ticketId ?? ""}
        line={claimFor}
        token={token}
        theme={theme}
        t={t}
        onClose={() => setClaimFor(null)}
        onFiled={async () => {
          setClaimFor(null);
          setNotice(t.bills.warrantyClaimed);
          await load();
        }}
      />
      <Snack message={notice} severity="confirm" bottom={16} accentColor={theme.primary} onHide={() => setNotice(null)} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {padding: 16, gap: 10},
  pageTitle: {fontSize: 22, fontWeight: "800"},
  segment: {borderWidth: 1, borderRadius: 12, padding: 3, flexDirection: "row", gap: 3},
  segmentItem: {flex: 1, borderRadius: 9, paddingVertical: 8, alignItems: "center"},
  segmentText: {fontSize: 13, fontWeight: "700"},
  tabs: {flexDirection: "row", gap: 6, flexWrap: "wrap"},
  tab: {borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12},
  tabText: {fontSize: 12, fontWeight: "700"},
  card: {borderWidth: 1, borderRadius: 16, padding: 12, gap: 6},
  head: {flexDirection: "row", alignItems: "center", gap: 8},
  headText: {flex: 1, gap: 2},
  title: {fontSize: 15, fontWeight: "800", flexShrink: 1},
  providerRow: {flexDirection: "row", alignItems: "center", gap: 3},
  providerName: {fontSize: 11, fontWeight: "700", flexShrink: 1},
  meta: {fontSize: 11, lineHeight: 16},
  body: {fontSize: 13, lineHeight: 18},
  pill: {borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8},
  pillText: {color: "#fff", fontSize: 10, fontWeight: "700"},
  photoRow: {flexDirection: "row", gap: 6, flexWrap: "wrap"},
  photo: {width: 56, height: 56, borderRadius: 8},
  actions: {flexDirection: "row", gap: 8},
  primary: {flex: 1, borderRadius: 9, paddingVertical: 8, alignItems: "center"},
  secondary: {borderWidth: 1, borderRadius: 9, paddingVertical: 8, paddingHorizontal: 10, alignItems: "center"},
  primaryText: {fontSize: 12, fontWeight: "700"},
  rowBetween: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8},
  amount: {fontSize: 13, fontWeight: "700"},
  disabled: {opacity: 0.6},
});
