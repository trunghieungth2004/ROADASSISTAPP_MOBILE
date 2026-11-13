import {useCallback, useState} from "react";
import {Keyboard, Pressable, ScrollView, StyleSheet, View} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "../components/ui/AppText";
import {MaterialCommunityIcons, MaterialIcons} from "@expo/vector-icons";
import {useFocusEffect, useNavigation} from "@react-navigation/native";
import {updateProfile} from "../api/users";
import {profileServiceKinds, serviceLabel} from "./more/providerUi";
import {toMessage} from "../api/client";
import {useAuth} from "../context/AuthContext";
import {useProfile} from "../context/ProfileContext";
import {useStrings} from "../context/LanguageContext";
import {darkTheme, lightTheme, type AppTheme} from "../theme";
import ScreenContainer from "../components/ui/ScreenContainer";
import Snack from "../components/ui/Snack";
import {snackBottom} from "../components/ui/snackOffset";
import {myProviders, type Provider} from "../api/providers";
import {receivedRatings, type ReceivedRatings} from "../api/ratings";
import {eligibleAppeals, fileAppeal, type AppealItem, type AppealReason, type EligibleAppeals} from "../api/appeals";
import Overlay from "../components/overlay/Overlay";
import DutySection from "./DutySection";
import {useThemeMode} from "../context/ThemeContext";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {uploadPhotoPaths} from "../services/photos";
import AppealsSheet from "./more/AppealsSheet";
import AppealSheet from "./more/AppealSheet";
import CaseDetailSheet from "./more/CaseDetailSheet";
import ScoreBar from "../components/ui/ScoreBar";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function scoreColor(kind: "trust" | "standing", value: number, theme: AppTheme): string {
  if (kind === "trust") {
    return value >= 70 ? theme.success : value >= 40 ? "#b45309" : theme.danger;
  }
  return value >= 60 ? theme.success : value >= 50 ? "#b45309" : theme.danger;
}

function issueFor(input: {
  restricted: boolean;
  openAppeal: boolean;
  reportAction: boolean;
  danger: string;
  reason: string;
  t: ReturnType<typeof useStrings>["t"];
}) {
  if (input.restricted) {
    return {
      color: input.danger,
      title: input.t.more.issueRestricted,
      text: input.reason,
    };
  }
  if (input.openAppeal) {
    return {color: "#b45309", title: input.t.more.issueOpenAppeal, text: ""};
  }
  if (input.reportAction) {
    return {color: "#b45309", title: input.t.more.issueWarning, text: ""};
  }
  return null;
}

export default function MoreScreen() {
  const {t} = useStrings();
  const {signOut, token} = useAuth();
  const {user, refresh} = useProfile();
  const {mode} = useThemeMode();
  const scheme = mode;
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const [editOpen, setEditOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameBusy, setNameBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dutyError, setDutyError] = useState<string | null>(null);
  const navigation = useNavigation();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [received, setReceived] = useState<ReceivedRatings | null>(null);
  const [eligible, setEligible] = useState<EligibleAppeals | null>(null);
  const [appealsOpen, setAppealsOpen] = useState(false);
  const [appealFor, setAppealFor] = useState<AppealItem | null>(null);
  const [caseFor, setCaseFor] = useState<AppealItem | null>(null);
  const [appealBusy, setAppealBusy] = useState(false);
  const [appealError, setAppealError] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    if (!token) return;
    void refresh();
    void myProviders(token).then(setProviders).catch(() => undefined);
    void receivedRatings(token).then(setReceived).catch(() => undefined);
    void eligibleAppeals(token).then(setEligible).catch(() => undefined);
  }, [token, refresh]));
  const displayName = user?.displayName || user?.email || "—";
  const services = user?.services ?? [];
  const isAdmin = user?.role === "1";
  const profileKinds = profileServiceKinds(services, providers);
  const restricted = user?.bookingBlocked === true ||
    (typeof user?.restrictedUntil === "string" &&
      Date.parse(user.restrictedUntil) > Date.now());
  const openAppeal = eligible !== null &&
    [...eligible.ratings, ...eligible.reports, ...eligible.disputes]
      .some((item) => item.appealStatus === "OPEN");
  const reportAction = eligible !== null &&
    eligible.reports.some((item) =>
      typeof item.snapshot.action === "string" &&
      item.snapshot.action !== "NONE" &&
      item.appealResolution !== "OVERTURN");
  const issue = issueFor({
    restricted,
    openAppeal,
    reportAction,
    danger: theme.danger,
    reason: user?.restrictionReason ?? "",
    t,
  });
  function openEdit() { setNameDraft(user?.displayName ?? ""); setEditError(null); setEditOpen(true); }
  async function onSubmitAppeal(
    reason: AppealReason,
    note: string,
    uris: string[],
  ): Promise<void> {
    if (!token || !appealFor || appealBusy) return;
    setAppealBusy(true);
    setAppealError(null);
    try {
      const photoUrls = uris.length > 0 ?
        (await uploadPhotoPaths(
          `appeals/${appealFor.subjectKind}-${appealFor.subjectId}`,
          uris,
        )).filter((item): item is string => typeof item === "string") :
        [];
      await fileAppeal({
        subjectKind: appealFor.subjectKind,
        subjectId: appealFor.subjectId,
        reason,
        note,
        photoUrls,
      }, token);
      setAppealFor(null);
      setNotice(t.more.appealFiled);
      const [fresh, freshEligible] = await Promise.all([
        receivedRatings(token),
        eligibleAppeals(token),
      ]);
      setReceived(fresh);
      setEligible(freshEligible);
      setAppealsOpen(true);
    } catch (err) {
      setAppealError(toMessage(err));
    } finally {
      setAppealBusy(false);
    }
  }
  async function onSaveName() {
    if (!token || !nameDraft.trim() || nameBusy) return;
    Keyboard.dismiss();
    setNameBusy(true);
    setEditError(null);
    try { await updateProfile({displayName: nameDraft.trim()}, token); await refresh(); setEditOpen(false); setNotice(t.more.saved); } catch (err) { setEditError(toMessage(err)); } finally { setNameBusy(false); }
  }
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={[styles.scroll, {backgroundColor: theme.background}]}>
        <View style={[styles.headerCard, {
          backgroundColor: theme.paper,
          borderColor: issue?.color ?? theme.border,
          borderWidth: issue ? 2 : 1,
        }]}>
          <View style={styles.headerRow}>
            <View>
              <View style={[styles.avatar, {backgroundColor: theme.primary}]}><Text style={styles.avatarText}>{initials(displayName)}</Text></View>
              <Pressable style={[styles.avatarEdit, {backgroundColor: theme.paper, borderColor: theme.border}]} onPress={openEdit} accessibilityRole="button" accessibilityLabel={t.more.editName}>
                <MaterialIcons name="edit" size={16} color={theme.primary} />
              </Pressable>
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.name, {color: theme.text}]}>{displayName}</Text>
              <Text style={[styles.email, {color: theme.muted}]}>{user?.email ?? ""}</Text>
              <View style={styles.badgeRow}>
                <View style={[styles.badge, {backgroundColor: theme.primary}]}><Text style={styles.badgeText}>{isAdmin ? t.more.roleAdmin : t.roles.rider}</Text></View>
                {profileKinds.map((kind) => (<View key={kind} style={[styles.service, {borderColor: theme.border}]}><Text style={[styles.serviceText, {color: theme.text}]}>{serviceLabel(kind, t)}</Text></View>))}
              </View>
            </View>
          </View>
          {issue && !restricted ? (
            <View style={[styles.issueBanner, {borderColor: issue.color}]}>
              <MaterialIcons name="report-problem" size={16} color={issue.color} />
              <View style={styles.issueBody}>
                <Text style={[styles.issueTitle, {color: issue.color}]}>{issue.title}</Text>
                {issue.text ? <Text style={[styles.issueText, {color: theme.muted}]}>{issue.text}</Text> : null}
              </View>
              <Pressable
                onPress={() => setAppealsOpen(true)}
                style={[styles.issueButton, {borderColor: issue.color}]}
                accessibilityRole="button"
                accessibilityLabel={t.more.viewCases}
              >
                <Text style={[styles.issueButtonText, {color: issue.color}]}>{t.more.viewCases}</Text>
              </Pressable>
            </View>
          ) : null}
          {restricted ? (
            <View style={[styles.restriction, {borderColor: theme.danger}]}>
              <MaterialIcons name="lock" size={16} color={theme.danger} />
              <View style={styles.restrictionText}>
                <Text style={[styles.restrictionTitle, {color: theme.danger}]}>
                  {t.more.restricted}
                </Text>
                <Text style={[styles.restrictionHint, {color: theme.muted}]}>
                  {[
                    typeof user?.restrictedUntil === "string" ?
                      `${t.more.restrictedUntil}: ${new Date(user.restrictedUntil).toLocaleDateString()}` :
                      null,
                    user?.restrictionReason ?? null,
                  ].filter((part): part is string => part !== null && part !== "").join(" · ")}
                </Text>
              </View>
            </View>
          ) : null}
          <View style={styles.scoreStack}>
            <ScoreBar
              label={t.more.trust}
              value={user?.trustScore ?? 0}
              color={scoreColor("trust", user?.trustScore ?? 0, theme)}
              theme={theme}
            />
            <ScoreBar
              label={t.more.standing}
              value={user?.standingScore ?? 100}
              color={scoreColor("standing", user?.standingScore ?? 100, theme)}
              theme={theme}
            />
          </View>
        </View>
        {(received !== null &&
          (received.rider.count > 0 ||
            received.providers.some((provider) => provider.count > 0))) ||
        (eligible !== null &&
          eligible.ratings.length + eligible.reports.length +
            eligible.disputes.length > 0) ? (
          <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
            <Pressable
              style={styles.listRow}
              onPress={() => setAppealsOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t.more.cases}
            >
              <MaterialIcons name="gavel" size={20} color={theme.primary} />
              <View style={styles.ratingInfo}>
                <Text style={[styles.listText, {color: theme.text}]}>{t.more.cases}</Text>
                <Text style={[styles.ratingSummary, {color: theme.muted}]}>
                  {[
                    received !== null && received.rider.count > 0 ?
                      `${t.more.ratingAsRider} ${received.rider.avg.toFixed(1)} (${received.rider.count})` :
                      null,
                    ...(eligible === null ? [] : [
                      `${t.more.appealSubjectRating} ${eligible.ratings.length}`,
                      `${t.more.appealSubjectReport} ${eligible.reports.length}`,
                      `${t.more.appealSubjectDispute} ${eligible.disputes.length}`,
                    ]),
                  ].filter((part): part is string => part !== null).join(" · ")}
                </Text>
              </View>
              
            </Pressable>
          </View>
        ) : null}
        <DutySection
          providers={providers}
          onProvidersChanged={() => {
            if (!token) return;
            void myProviders(token).then(setProviders).catch(() => undefined);
          }}
          onNotice={(message) => setNotice(message)}
          onError={(message) => setDutyError(message)}
        />
        <Overlay
          visible={editOpen}
          variant="dialog"
          title={t.more.displayName}
          closeLabel={t.common.cancel}
          onClose={() => { Keyboard.dismiss(); setEditOpen(false); }}
          scrollable={false}
          actions={[{label: t.common.save, tone: "primary", busy: nameBusy, disabled: !nameDraft.trim(), onPress: () => void onSaveName()}]}
        >
          {editError ? <Text style={[styles.error, {color: theme.danger}]}>{editError}</Text> : null}
          <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={nameDraft} onChangeText={setNameDraft} placeholder={t.more.displayName} placeholderTextColor={theme.muted} />
        </Overlay>
        <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <Pressable style={styles.listRow} onPress={() => navigation.navigate("Providers" as never)} accessibilityRole="button" accessibilityLabel={t.more.provider}>
            <MaterialIcons name="storefront" size={20} color={theme.primary} />
            <Text style={[styles.listText, {color: theme.text}]}>{t.more.provider}</Text>
            
          </Pressable>
          <View style={[styles.divider, {backgroundColor: theme.divider}]} />
          <Pressable style={styles.listRow} onPress={() => navigation.navigate("Vehicle" as never)} accessibilityRole="button" accessibilityLabel={t.tabs.vehicle}>
            <MaterialCommunityIcons name="motorbike" size={20} color={theme.primary} />
            <Text style={[styles.listText, {color: theme.text}]}>{t.tabs.vehicle}</Text>
            
          </Pressable>
          <View style={[styles.divider, {backgroundColor: theme.divider}]} />
          <Pressable style={styles.listRow} onPress={() => navigation.navigate("Payments" as never)} accessibilityRole="button" accessibilityLabel={t.payments.title}>
            <MaterialIcons name="payments" size={20} color={theme.primary} />
            <Text style={[styles.listText, {color: theme.text}]}>{t.payments.title}</Text>
            
          </Pressable>
          {services.includes("RIDER") || providers.length > 0 ? (
            <>
              <View style={[styles.divider, {backgroundColor: theme.divider}]} />
              <Pressable style={styles.listRow} onPress={() => navigation.navigate("Warranty" as never)} accessibilityRole="button" accessibilityLabel={t.provider.warrantyClaims}>
                <MaterialIcons name="verified" size={20} color={theme.primary} />
                <Text style={[styles.listText, {color: theme.text}]}>{t.provider.warrantyTitle}</Text>
                
              </Pressable>
            </>
          ) : null}
        </View>
        <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <Pressable style={styles.listRow} onPress={() => navigation.navigate("Support" as never)} accessibilityRole="button" accessibilityLabel={t.support.title}>
            <MaterialIcons name="support-agent" size={20} color={theme.primary} />
            <Text style={[styles.listText, {color: theme.text}]}>{t.support.title}</Text>
            
          </Pressable>
          <View style={[styles.divider, {backgroundColor: theme.divider}]} />
          <Pressable style={styles.listRow} onPress={() => navigation.navigate("Settings" as never)} accessibilityRole="button" accessibilityLabel={t.more.settings}>
            <MaterialIcons name="settings" size={20} color={theme.primary} />
            <Text style={[styles.listText, {color: theme.text}]}>{t.more.settings}</Text>
            
          </Pressable>
          <View style={[styles.divider, {backgroundColor: theme.divider}]} />
          <Pressable style={styles.listRow} onPress={() => navigation.navigate("About" as never)} accessibilityRole="button" accessibilityLabel={t.more.about}>
            <MaterialIcons name="info" size={20} color={theme.primary} />
            <Text style={[styles.listText, {color: theme.text}]}>{t.more.about}</Text>
            
          </Pressable>
        </View>
        <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <Pressable style={styles.listRow} onPress={() => void signOut()}><MaterialIcons name="logout" size={20} color={theme.danger} /><Text style={[styles.listText, {color: theme.danger}]}>{t.more.signOut}</Text></Pressable>
        </View>
      </ScrollView>
      <Snack message={notice} severity="confirm" bottom={snackBottom(insets.bottom)} accentColor={theme.primary} onHide={() => setNotice(null)} />
      {dutyError ? (
        <Snack message={dutyError} severity="error" bottom={snackBottom(insets.bottom)} dangerColor={theme.danger} onHide={() => setDutyError(null)} />
      ) : null}
      {appealsOpen && eligible !== null ? (
        <AppealsSheet
          t={t}
          eligible={eligible}
          received={received}
          onClose={() => setAppealsOpen(false)}
          onOpen={(item) => {
            setAppealsOpen(false);
            setCaseFor(item);
          }}
        />
      ) : null}
      {caseFor !== null ? (
        <CaseDetailSheet
          t={t}
          item={caseFor}
          onClose={() => setCaseFor(null)}
          onAppeal={(item) => {
            setCaseFor(null);
            setAppealError(null);
            setAppealFor(item);
          }}
        />
      ) : null}
      {appealFor !== null ? (
        <AppealSheet
          t={t}
          subjectKind={appealFor.subjectKind}
          busy={appealBusy}
          error={appealError}
          onSubmit={(reason, note, uris) => void onSubmitAppeal(reason, note, uris)}
          onClose={() => {
            setAppealFor(null);
            setAppealError(null);
          }}
        />
      ) : null}
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  scroll: {padding: 16, gap: 12},
  headerCard: {borderWidth: 1, borderRadius: 16, padding: 16, gap: 12, overflow: "hidden"},
  headerRow: {flexDirection: "row", alignItems: "center", gap: 12},
  avatar: {width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center"},
  avatarText: {color: "#fff", fontWeight: "700", fontSize: 18},
  avatarEdit: {position: "absolute", right: -6, bottom: -6, width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center"},
  restriction: {flexDirection: "row", alignItems: "flex-start", gap: 8, borderWidth: 1, borderRadius: 12, padding: 10},
  issueBanner: {flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, padding: 10},
  issueBody: {flex: 1, gap: 2},
  issueTitle: {fontSize: 13, fontWeight: "700"},
  issueText: {fontSize: 11, lineHeight: 15},
  issueButton: {borderWidth: 1, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10, alignSelf: "center"},
  issueButtonText: {fontSize: 11, fontWeight: "700"},
  restrictionText: {flex: 1, gap: 2},
  restrictionTitle: {fontSize: 13, fontWeight: "700"},
  restrictionHint: {fontSize: 11, lineHeight: 15},
  scoreStack: {gap: 10, marginTop: 4},
  headerText: {flex: 1, minWidth: 0, gap: 2},
  name: {fontSize: 18, fontWeight: "700"},
  email: {fontSize: 13},
  badgeRow: {flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 4},
  badge: {borderRadius: 12, paddingVertical: 2, paddingHorizontal: 8},
  badgeText: {color: "#fff", fontSize: 12, fontWeight: "600"},
  service: {borderWidth: 1, borderRadius: 12, paddingVertical: 2, paddingHorizontal: 8},
  serviceText: {fontSize: 12},
  input: {borderWidth: 1, borderRadius: 8, padding: 10},
  error: {fontSize: 12, marginBottom: 6},
  card: {borderWidth: 1, borderRadius: 16, overflow: "hidden"},
  listRow: {flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16},
  listText: {fontSize: 15, fontWeight: "500"},
  ratingInfo: {flex: 1, gap: 2, minWidth: 0},
  ratingSummary: {fontSize: 11, lineHeight: 15},
  divider: {height: 1, marginHorizontal: 16},
});
