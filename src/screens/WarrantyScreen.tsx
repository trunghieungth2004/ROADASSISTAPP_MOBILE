import {useCallback, useState} from "react";
import {Pressable, ScrollView, StyleSheet, View} from "react-native";
import {useFocusEffect, useNavigation} from "@react-navigation/native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../components/ui/AppText";
import ScreenContainer from "../components/ui/ScreenContainer";
import Snack from "../components/ui/Snack";
import {usePhotoViewer} from "../components/ui/PhotoViewer";
import {useAuth} from "../context/AuthContext";
import {useProfile} from "../context/ProfileContext";
import {useStrings} from "../context/LanguageContext";
import {useThemeMode} from "../context/ThemeContext";
import {themeForMode, darkTheme, lightTheme} from "../theme";
import {toMessage} from "../api/client";
import {listProfiles, vehicleHistory} from "../api/vehicles";
import {myProviders, type Provider} from "../api/providers";
import {disputeWarrantyClaim, myWarrantyClaims, respondWarrantyClaim, shopWarrantyClaims, type WarrantyClaim, type WarrantyDeclineReason} from "../api/warranty";
import {resolvePhotoUrl} from "../services/photos";
import ShopDetailSheet from "./assist/ShopDetailSheet";
import WarrantyClaimDialog from "./bills/WarrantyClaimDialog";
import WarrantyDetailSheet from "./warranty/WarrantyDetailSheet";
import WarrantyTicketSheet from "./warranty/WarrantyTicketSheet";
import WarrantyDeclineDialog from "./warranty/WarrantyDeclineDialog";
import WarrantyDisputeDialog from "./warranty/WarrantyDisputeDialog";
import {
  claimDetail,
  coverageDetail,
  coverageForClaim,
  groupClaimsByTicket,
  groupCoverageByTicket,
  type WarrantyCoverageRow,
  type WarrantyDetailInput,
} from "./warranty/warrantyDetail";
import {
  ClaimCard,
  ClaimGroupCard,
  CoverageCard,
  CoverageGroupCard,
  GroupToggle,
} from "./warranty/WarrantyCards";

export default function WarrantyScreen() {
  const {t} = useStrings();
  const {token} = useAuth();
  const {user} = useProfile();
  const {mode} = useThemeMode();
  const theme = themeForMode(mode);
  const navigation = useNavigation();
  const photoViewer = usePhotoViewer(t.common.cancel);
  const services = user?.services ?? [];
  const riderRole = services.includes("RIDER");
  const [role, setRole] = useState<"rider" | "provider">(riderRole ? "rider" : "provider");
  const [riderTab, setRiderTab] = useState<"coverage" | "claims">("coverage");
  const [providerTab, setProviderTab] = useState<"open" | "rework" | "closed">("open");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [coverage, setCoverage] = useState<WarrantyCoverageRow[]>([]);
  const [claims, setClaims] = useState<WarrantyClaim[]>([]);
  const [shopClaims, setShopClaims] = useState<WarrantyClaim[]>([]);
  const [detailFor, setDetailFor] = useState<WarrantyDetailInput | null>(null);
  const [ticketFor, setTicketFor] = useState<string | null>(null);
  const [grouped, setGrouped] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [shopFor, setShopFor] = useState<Provider | null>(null);
  const [claimFor, setClaimFor] = useState<{ticketId: string; lineId: string; name: string} | null>(null);
  const [declineFor, setDeclineFor] = useState<WarrantyClaim | null>(null);
  const [declineError, setDeclineError] = useState<string | null>(null);
  const [disputeFor, setDisputeFor] = useState<WarrantyClaim | null>(null);
  const [disputeError, setDisputeError] = useState<string | null>(null);
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
        const rows: WarrantyCoverageRow[] = [];
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

  async function acceptClaim(claim: WarrantyClaim): Promise<boolean> {
    if (!token || busy) return false;
    setBusy(true);
    try {
      await respondWarrantyClaim(token, claim.id, true);
      setNotice(t.provider.warrantyAccepted);
      await load();
      return true;
    } catch (err) {
      setError(toMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function acceptFromDetail(claim: WarrantyClaim): Promise<void> {
    if (await acceptClaim(claim)) setDetailFor(null);
  }

  async function submitDecline(
    reasonCode: WarrantyDeclineReason,
    note: string,
  ): Promise<void> {
    if (!token || !declineFor || busy) return;
    setBusy(true);
    setDeclineError(null);
    try {
      await respondWarrantyClaim(token, declineFor.id, false, {
        reasonCode,
        note,
      });
      const claimId = declineFor.id;
      setDeclineFor(null);
      setDetailFor((prev) => prev?.claim?.id === claimId ? null : prev);
      setNotice(t.provider.warrantyDeclined);
      await load();
    } catch (err) {
      setDeclineError(toMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitDispute(note: string): Promise<void> {
    if (!token || !disputeFor || busy) return;
    setBusy(true);
    setDisputeError(null);
    try {
      const claimId = disputeFor.id;
      await disputeWarrantyClaim(token, claimId, note);
      setDisputeFor(null);
      setDetailFor((prev) => prev?.claim?.id === claimId ? null : prev);
      setNotice(t.provider.disputeDone);
      await load();
    } catch (err) {
      setDisputeError(toMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function claimFromDetail(detail: WarrantyDetailInput): void {
    setDetailFor(null);
    setClaimFor({
      ticketId: detail.ticketId,
      lineId: detail.lineId,
      name: detail.serviceName,
    });
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
  const coverageGroups = groupCoverageByTicket(coverage, claims);
  const claimGroups = groupClaimsByTicket(claims);
  const providerGroups = groupClaimsByTicket(providerRows);

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
            <GroupToggle
              t={t}
              theme={theme}
              grouped={grouped}
              onToggle={() => setGrouped((value) => !value)}
            />
            {riderTab === "coverage" ? (
              coverage.length === 0 ? <Text style={[styles.meta, {color: theme.muted}]}>{t.vehicle.warrantyNoCoverage}</Text> :
                grouped ? coverageGroups.map((group) => (
                  <CoverageGroupCard
                    key={group.ticketId}
                    t={t}
                    theme={theme}
                    group={group}
                    onOpen={(entry) => setDetailFor(coverageDetail(entry.coverage, entry.claim))}
                  />
                )) : coverage.map((row) => {
                  const claim = claims.find((item) => item.lineId === row.line.lineId) ?? null;
                  return (
                    <CoverageCard
                      key={`${row.item.ticketId}-${row.line.lineId}`}
                      t={t}
                      theme={theme}
                      row={row}
                      claim={claim}
                      onOpen={() => setDetailFor(coverageDetail(row, claim))}
                      onClaim={() => setClaimFor({ticketId: row.item.ticketId, lineId: row.line.lineId, name: row.line.name})}
                    />
                  );
                })
            ) : (
              claims.length === 0 ? <Text style={[styles.meta, {color: theme.muted}]}>{t.vehicle.warrantyNoClaims}</Text> :
                grouped ? claimGroups.map((group) => (
                  <ClaimGroupCard
                    key={group.ticketId}
                    t={t}
                    theme={theme}
                    group={group}
                    providerView={false}
                    busy={busy}
                    onOpen={(claim) => setDetailFor(claimDetail(claim, coverageForClaim(coverage, claim)))}
                    onRespond={(claim, accept) => accept ? void acceptClaim(claim) : setDeclineFor(claim)}
                    onDispute={(claim) => setDisputeFor(claim)}
                  />
                )) : claims.map((claim) => (
                  <ClaimCard
                    key={claim.id}
                    t={t}
                    theme={theme}
                    claim={claim}
                    providerView={false}
                    busy={busy}
                    onOpen={() => setDetailFor(claimDetail(claim, coverageForClaim(coverage, claim)))}
                    onRespond={(accept) => accept ? void acceptClaim(claim) : setDeclineFor(claim)}
                    onDispute={() => setDisputeFor(claim)}
                    onPhoto={openPhoto}
                  />
                ))
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
            <GroupToggle
              t={t}
              theme={theme}
              grouped={grouped}
              onToggle={() => setGrouped((value) => !value)}
            />
            {providerRows.length === 0 ? <Text style={[styles.meta, {color: theme.muted}]}>{t.vehicle.warrantyNoClaims}</Text> :
              grouped ? providerGroups.map((group) => (
                <ClaimGroupCard
                  key={group.ticketId}
                  t={t}
                  theme={theme}
                  group={group}
                  providerView
                  busy={busy}
                  onOpen={(claim) => setDetailFor(claimDetail(claim, coverageForClaim(coverage, claim)))}
                  onRespond={(claim, accept) => accept ? void acceptClaim(claim) : setDeclineFor(claim)}
                  onDispute={(claim) => setDisputeFor(claim)}
                />
              )) : providerRows.map((claim) => (
                <ClaimCard
                  key={claim.id}
                  t={t}
                  theme={theme}
                  claim={claim}
                  providerView
                  busy={busy}
                  onOpen={() => setDetailFor(claimDetail(claim, coverageForClaim(coverage, claim)))}
                  onRespond={(accept) => accept ? void acceptClaim(claim) : setDeclineFor(claim)}
                  onDispute={() => setDisputeFor(claim)}
                  onPhoto={openPhoto}
                />
              ))}
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
      {detailFor !== null ? (
        <WarrantyDetailSheet
          t={t}
          theme={theme}
          detail={detailFor}
          providerView={role === "provider"}
          busy={busy}
          onClose={() => setDetailFor(null)}
          onOpenShop={(provider) => {
            setDetailFor(null);
            setShopFor(provider);
          }}
          onClaim={claimFromDetail}
          onDispute={(claim) => setDisputeFor(claim)}
          onRespond={(claim, accept) => accept ? void acceptFromDetail(claim) : setDeclineFor(claim)}
          onOpenLinked={(ticketId) => setTicketFor(ticketId)}
          onOpenTicket={(ticketId) => setTicketFor(ticketId)}
        />
      ) : null}
      {ticketFor !== null ? (
        <WarrantyTicketSheet
          ticketId={ticketFor}
          onClose={() => setTicketFor(null)}
        />
      ) : null}
      <WarrantyDeclineDialog
        visible={declineFor !== null}
        serviceName={declineFor?.serviceName ?? ""}
        t={t}
        theme={theme}
        busy={busy}
        error={declineError}
        onSubmit={(reasonCode, note) => void submitDecline(reasonCode, note)}
        onClose={() => {
          setDeclineFor(null);
          setDeclineError(null);
        }}
      />
      <WarrantyDisputeDialog
        visible={disputeFor !== null}
        serviceName={disputeFor?.serviceName ?? ""}
        t={t}
        theme={theme}
        busy={busy}
        error={disputeError}
        onSubmit={(note) => void submitDispute(note)}
        onClose={() => {
          setDisputeFor(null);
          setDisputeError(null);
        }}
      />
      <Snack message={notice} severity="confirm" bottom={16} accentColor={theme.primary} onHide={() => setNotice(null)} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {padding: 16, gap: 14},
  pageTitle: {fontSize: 22, fontWeight: "800"},
  segment: {borderWidth: 1, borderRadius: 16, padding: 4, flexDirection: "row", gap: 4},
  segmentItem: {flex: 1, borderRadius: 9, paddingVertical: 8, alignItems: "center"},
  segmentText: {fontSize: 13, fontWeight: "700"},
  tabs: {flexDirection: "row", gap: 6, flexWrap: "wrap"},
  tab: {borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12},
  tabText: {fontSize: 12, fontWeight: "700"},
  card: {borderWidth: 1, borderRadius: 20, padding: 16, gap: 8},
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
  primary: {flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: "center"},
  secondary: {borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, alignItems: "center"},
  primaryText: {fontSize: 12, fontWeight: "700"},
  rowBetween: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8},
  amount: {fontSize: 13, fontWeight: "700"},
  disabled: {opacity: 0.6},
});
