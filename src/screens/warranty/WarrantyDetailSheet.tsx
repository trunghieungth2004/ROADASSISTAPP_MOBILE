import {useState} from "react";
import {Pressable, StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../components/ui/AppText";
import Overlay, {type OverlayAction} from "../../components/overlay/Overlay";
import PhotoThumb from "../../components/ui/PhotoThumb";
import {usePhotoViewer} from "../../components/ui/PhotoViewer";
import type {Provider} from "../../api/providers";
import type {WarrantyClaim} from "../../api/warranty";
import {billDateLabel} from "../bills/billLabels";
import PaymentDetailSheet from "../bills/PaymentDetailSheet";
import {CardHead, DetailCard, FeeRow} from "../assist/detail/parts";
import {resolvePhotoUrl} from "../../services/photos";
import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";
import type {WarrantyDetailInput} from "./warrantyDetail";
import {warrantyDeclineReasonLabel, warrantyStatusColor, warrantyStatusLabel} from "./warrantyStatus";

type Props = {
  t: Strings;
  theme: AppTheme;
  detail: WarrantyDetailInput;
  providerView: boolean;
  busy?: boolean;
  onClose: () => void;
  onOpenShop?: (provider: Provider) => void;
  onClaim?: (detail: WarrantyDetailInput) => void;
  onDispute?: (claim: WarrantyClaim) => void;
  onRespond?: (claim: WarrantyClaim, accept: boolean) => void;
  onOpenLinked?: (ticketId: string) => void;
  onOpenTicket?: (ticketId: string) => void;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const money = (value: number): string => `${value.toLocaleString()} VND`;

const coverageLabel = (
  parts: string | null | undefined,
  t: Strings,
): string | null => {
  if (parts === "LABOR_ONLY") return t.provider.warrantyLabor;
  if (parts === "PARTS_AND_LABOR") return t.provider.warrantyPartsCovered;
  return null;
};

const daysLeft = (until: string): number | null => {
  const at = Date.parse(until);
  if (!Number.isFinite(at)) return null;
  return Math.ceil((at - Date.now()) / DAY_MS);
};

function WarrantyHero({detail, t, theme, status}: {
  detail: WarrantyDetailInput;
  t: Strings;
  theme: AppTheme;
  status: {label: string; color: string};
}) {
  const category = detail.category !== null &&
    detail.category !== undefined &&
    detail.category in t.services.categories ?
    t.services.categories[
      detail.category as keyof Strings["services"]["categories"]
    ] :
    detail.category;
  return (
    <View style={[styles.hero, {
      borderColor: theme.border,
      backgroundColor: theme.paper,
    }]}>
      <View style={styles.heroHead}>
        <View style={[styles.heroIcon, {
          backgroundColor: `${theme.primary}1f`,
        }]}>
          <MaterialIcons
            name="verified-user"
            size={22}
            color={theme.primary}
          />
        </View>
        <View style={styles.heroText}>
          <Text style={[styles.title, {color: theme.text}]}>
            {detail.serviceName}
          </Text>
          <Text style={[styles.meta, {color: theme.muted}]}>
            {[category, detail.serviceCode, `#${detail.ticketId.slice(-6)}`]
              .filter((value) => typeof value === "string" && value !== "")
              .join(" · ")}
          </Text>
        </View>
        <View style={[styles.pill, {backgroundColor: status.color}]}>
          <Text style={styles.pillText}>{status.label}</Text>
        </View>
      </View>
    </View>
  );
}

function ProviderSummary({detail, t, theme, onOpenShop}: {
  detail: WarrantyDetailInput;
  t: Strings;
  theme: AppTheme;
  onOpenShop?: (provider: Provider) => void;
}) {
  const provider = detail.provider ?? null;
  return (
    <DetailCard theme={theme}>
      <CardHead
        theme={theme}
        icon="storefront"
        title={t.vehicle.warrantyProvider}
      />
      <Pressable
        style={styles.providerBlock}
        disabled={provider === null || onOpenShop === undefined}
        onPress={() => {
          if (provider !== null) onOpenShop?.(provider);
        }}
        accessibilityRole={provider !== null ? "button" : undefined}
        accessibilityLabel={provider?.name ?? detail.providerName ?? undefined}
      >
        <Text style={[styles.providerName, {color: theme.text}]}>
          {detail.providerName ?? provider?.name ?? t.assist.unassigned}
        </Text>
        {provider?.label ? (
          <Text style={[styles.meta, {color: theme.muted}]}>
            {provider.label}
          </Text>
        ) : null}
        {typeof provider?.ratingAvg === "number" && provider.ratingAvg > 0 ? (
          <Text style={[styles.meta, {color: theme.muted}]}>
            {`★ ${provider.ratingAvg.toFixed(1)} (${provider.ratingCount ?? 0})`}
          </Text>
        ) : null}
      </Pressable>
      <FeeRow
        theme={theme}
        label={t.provider.qty}
        value={String(detail.qty ?? 1)}
      />
      {detail.unitPrice !== null && detail.unitPrice !== undefined ? (
        <FeeRow
          theme={theme}
          label={t.provider.unitPrice}
          value={money(detail.unitPrice)}
        />
      ) : null}
      <FeeRow
        theme={theme}
        label={t.bills.total}
        value={money(detail.amount)}
        strong
      />
    </DetailCard>
  );
}

function CoverageSummary({detail, t, theme, remaining}: {
  detail: WarrantyDetailInput;
  t: Strings;
  theme: AppTheme;
  remaining: number | null;
}) {
  const coverage = coverageLabel(detail.warrantyParts, t);
  return (
    <DetailCard theme={theme}>
      <CardHead
        theme={theme}
        icon="event-available"
        title={t.vehicle.warrantyCoverage}
      />
      {detail.vehicleLabel || detail.vehiclePlate ? (
        <FeeRow
          theme={theme}
          label={t.vehicle.warrantyVehicle}
          value={[detail.vehicleLabel, detail.vehiclePlate]
            .filter((value) => typeof value === "string" && value !== "")
            .join(" · ")}
        />
      ) : null}
      {detail.serviceDate ? (
        <FeeRow
          theme={theme}
          label={t.vehicle.serviceDate}
          value={billDateLabel(detail.serviceDate)}
        />
      ) : null}
      {detail.purchaseDate && detail.purchaseDate !== detail.serviceDate ? (
        <FeeRow
          theme={theme}
          label={t.vehicle.warrantyPurchased}
          value={billDateLabel(detail.purchaseDate)}
        />
      ) : null}
      <FeeRow
        theme={theme}
        label={t.bills.warranty}
        value={billDateLabel(detail.warrantyUntil)}
      />
      {detail.warrantyDays !== null && detail.warrantyDays !== undefined ? (
        <FeeRow
          theme={theme}
          label={t.provider.warrantyDays}
          value={String(detail.warrantyDays)}
        />
      ) : null}
      {coverage !== null ? (
        <FeeRow
          theme={theme}
          label={t.vehicle.warrantyCoverage}
          value={coverage}
        />
      ) : null}
      {remaining !== null ? (
        <FeeRow
          theme={theme}
          label={t.vehicle.warrantyActive}
          value={remaining > 0 ?
            t.vehicle.warrantyDaysLeft.replace("{n}", String(remaining)) :
            t.flag.expired}
          valueColor={remaining > 0 ? theme.success : theme.danger}
        />
      ) : null}
    </DetailCard>
  );
}

function ClaimSummary({claim, t, theme, onOpenLinked, openPhoto}: {
  claim: WarrantyClaim;
  t: Strings;
  theme: AppTheme;
  onOpenLinked?: (ticketId: string) => void;
  openPhoto: (path: string) => void;
}) {
  return (
    <DetailCard theme={theme}>
      <CardHead
        theme={theme}
        icon="support-agent"
        title={t.vehicle.warrantyClaimsTab}
        right={(
          <View style={[styles.pill, {
            backgroundColor: warrantyStatusColor(claim.status, theme),
          }]}>
            <Text style={styles.pillText}>
              {warrantyStatusLabel(claim.status, t)}
            </Text>
          </View>
        )}
      />
      <FeeRow
        theme={theme}
        label={t.vehicle.claimFiled}
        value={billDateLabel(claim.createdAt)}
      />
      {warrantyDeclineReasonLabel(claim.declineReasonCode, t) !== null ? (
        <FeeRow
          theme={theme}
          label={t.provider.warrantyDeclineReason}
          value={warrantyDeclineReasonLabel(claim.declineReasonCode, t) ?? ""}
        />
      ) : null}
      <View style={styles.textBlock}>
        <Text style={[styles.label, {color: theme.muted}]}>
          {t.vehicle.claimReason}
        </Text>
        <Text style={[styles.bodyText, {color: theme.text}]}>
          {claim.reason}
        </Text>
      </View>
      {claim.photoUrls.length > 0 ? (
        <View style={styles.photoRow}>
          {claim.photoUrls.map((path, index) => (
            <PhotoThumb
              key={`${path}-${index}`}
              path={path}
              theme={theme}
              style={styles.photo}
              onPress={openPhoto}
              accessibilityLabel={`${t.assist.photos} ${index + 1}`}
            />
          ))}
        </View>
      ) : null}
      {claim.shopResponse ? (
        <View style={styles.textBlock}>
          <Text style={[styles.label, {color: theme.muted}]}>
            {t.vehicle.claimResponse}
          </Text>
          <Text style={[styles.bodyText, {color: theme.text}]}>
            {claim.shopResponse}
          </Text>
        </View>
      ) : null}
      {claim.respondedAt ? (
        <FeeRow
          theme={theme}
          label={t.vehicle.claimResponded}
          value={billDateLabel(claim.respondedAt)}
        />
      ) : null}
      {claim.disputeNote ? (
        <View style={styles.textBlock}>
          <Text style={[styles.label, {color: theme.muted}]}>
            {t.vehicle.claimDisputeNote}
          </Text>
          <Text style={[styles.bodyText, {color: theme.text}]}>
            {claim.disputeNote}
          </Text>
        </View>
      ) : null}
      {claim.resolutionNote ? (
        <View style={styles.textBlock}>
          <Text style={[styles.label, {color: theme.muted}]}>
            {t.vehicle.claimResolutionNote}
          </Text>
          <Text style={[styles.bodyText, {color: theme.text}]}>
            {claim.resolutionNote}
          </Text>
        </View>
      ) : null}
      {claim.linkedTicketId ? (
        <Pressable
          style={[styles.linkRow, {borderColor: theme.border}]}
          onPress={() => onOpenLinked?.(claim.linkedTicketId ?? "")}
          accessibilityRole="button"
          accessibilityLabel={t.vehicle.claimLinkedRework}
        >
          <Text style={[styles.linkText, {color: theme.primary}]}>
            {`${t.vehicle.claimLinkedRework} · #${claim.linkedTicketId.slice(-6)}`}
          </Text>
          
        </Pressable>
      ) : null}
      {claim.refundAmount !== null ? (
        <FeeRow
          theme={theme}
          label={t.bills.refund}
          value={money(claim.refundAmount)}
        />
      ) : null}
      {claim.outcome ? (
        <FeeRow
          theme={theme}
          label={t.vehicle.claimOutcome}
          value={claim.outcome}
        />
      ) : null}
      {claim.resolvedAt ? (
        <FeeRow
          theme={theme}
          label={t.vehicle.claimResolvedAt}
          value={billDateLabel(claim.resolvedAt)}
        />
      ) : null}
    </DetailCard>
  );
}

function actionsFor({claim, providerView, active, busy, detail, t, onClaim, onDispute, onRespond}: {
  claim: WarrantyClaim | null;
  providerView: boolean;
  active: boolean;
  busy: boolean;
  detail: WarrantyDetailInput;
  t: Strings;
  onClaim?: (detail: WarrantyDetailInput) => void;
  onDispute?: (claim: WarrantyClaim) => void;
  onRespond?: (claim: WarrantyClaim, accept: boolean) => void;
}): OverlayAction[] {
  const actions: OverlayAction[] = [];
  if (!providerView && claim === null && active && onClaim !== undefined) {
    actions.push({
      label: t.bills.claimWarranty,
      tone: "primary",
      onPress: () => onClaim(detail),
    });
  }
  if (!providerView && claim?.status === "DECLINED" &&
    onDispute !== undefined) {
    actions.push({
      label: t.provider.dispute,
      tone: "primary",
      onPress: () => onDispute(claim),
    });
  }
  if (providerView && claim?.status === "OPEN" && onRespond !== undefined) {
    actions.push({
      label: t.assist.accept,
      tone: "primary",
      busy,
      onPress: () => onRespond(claim, true),
    });
    actions.push({
      label: t.provider.decline,
      tone: "danger",
      outline: true,
      busy,
      onPress: () => onRespond(claim, false),
    });
  }
  return actions;
}

export default function WarrantyDetailSheet({
  t,
  theme,
  detail,
  providerView,
  busy = false,
  onClose,
  onOpenShop,
  onClaim,
  onDispute,
  onRespond,
  onOpenLinked,
  onOpenTicket,
}: Props) {
  const photoViewer = usePhotoViewer(t.common.cancel);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const openPhoto = (path: string): void => {
    void resolvePhotoUrl(path).then((uri) => {
      if (uri !== "") photoViewer.open(uri);
    });
  };

  const claim = detail.claim;
  const remaining = daysLeft(detail.warrantyUntil);
  const active = remaining !== null && remaining > 0;
  const status = claim !== null ? {
    label: warrantyStatusLabel(claim.status, t),
    color: warrantyStatusColor(claim.status, theme),
  } : {
    label: active ? t.vehicle.warrantyActive : t.flag.expired,
    color: active ? theme.primary : theme.muted,
  };
  const actions = actionsFor({
    claim,
    providerView,
    active,
    busy,
    detail,
    t,
    onClaim,
    onDispute,
    onRespond,
  });
  if (onOpenTicket !== undefined) {
    actions.push({
      label: t.assist.viewTicket,
      icon: <MaterialIcons name="receipt-long" size={20} color={theme.primary} />,
      iconOnly: true,
      outline: true,
      group: "secondary",
      onPress: () => onOpenTicket(detail.ticketId),
    });
  }
  actions.push({
    label: t.payments.detailTitle,
    icon: <MaterialIcons name="payments" size={20} color={theme.primary} />,
    iconOnly: true,
    outline: true,
    group: "secondary",
    onPress: () => setPaymentOpen(true),
  });

  return (
    <>
      <Overlay
        visible
        variant="sheet"
        title={t.vehicle.warrantyDetail}
        closeLabel={t.common.close}
        onClose={onClose}
        actions={actions}
        actionLayout="ticket"
        scrollable
      >
        <View style={styles.body}>
          <WarrantyHero detail={detail} t={t} theme={theme} status={status} />
          <ProviderSummary
            detail={detail}
            t={t}
            theme={theme}
            onOpenShop={onOpenShop}
          />
          <CoverageSummary
            detail={detail}
            t={t}
            theme={theme}
            remaining={remaining}
          />
          {claim !== null ? (
            <ClaimSummary
              claim={claim}
              t={t}
              theme={theme}
              onOpenLinked={onOpenLinked}
              openPhoto={openPhoto}
            />
          ) : null}
        </View>
      </Overlay>
      {photoViewer.node}
      {paymentOpen ? (
        <PaymentDetailSheet
          ticketId={detail.ticketId}
          {...(providerView ? {scope: "payee" as const} : {})}
          onClose={() => setPaymentOpen(false)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  body: {gap: 12},
  hero: {borderWidth: 1, borderRadius: 16, padding: 12},
  heroHead: {flexDirection: "row", alignItems: "center", gap: 10},
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  heroText: {flex: 1, gap: 2},
  title: {fontSize: 16, fontWeight: "800"},
  meta: {fontSize: 11, lineHeight: 16},
  pill: {borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8},
  pillText: {color: "#fff", fontSize: 10, fontWeight: "700"},
  providerBlock: {gap: 3},
  providerName: {fontSize: 14, fontWeight: "700"},
  textBlock: {gap: 2},
  label: {fontSize: 11, fontWeight: "700"},
  bodyText: {fontSize: 13, lineHeight: 18},
  photoRow: {flexDirection: "row", gap: 6, flexWrap: "wrap"},
  photo: {width: 56, height: 56, borderRadius: 8},
  linkRow: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  linkText: {fontSize: 12, fontWeight: "700"},
  sectionTitle: {fontSize: 15, fontWeight: "800"},
});
