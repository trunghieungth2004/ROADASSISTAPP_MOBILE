import {Pressable, StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../components/ui/AppText";
import PhotoThumb from "../../components/ui/PhotoThumb";
import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";
import type {WarrantyClaim} from "../../api/warranty";
import {billDateLabel} from "../bills/billLabels";
import type {
  WarrantyClaimGroup,
  WarrantyCoverageEntry,
  WarrantyCoverageGroup,
  WarrantyCoverageRow,
} from "./warrantyDetail";
import {
  warrantyDeclineReasonLabel,
  warrantyStatusColor,
  warrantyStatusLabel,
} from "./warrantyStatus";

const activeOf = (until: string | null): boolean =>
  typeof until === "string" && Date.parse(until) > Date.now();

export function GroupToggle({t, theme, grouped, onToggle}: {
  t: Strings;
  theme: AppTheme;
  grouped: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.toolRow}>
      <Pressable
        style={[styles.groupToggle, {
          borderColor: grouped ? theme.primary : theme.border,
        }]}
        onPress={onToggle}
        accessibilityRole="switch"
        accessibilityState={{checked: grouped}}
        accessibilityLabel={t.vehicle.warrantyGroupToggle}
      >
        <MaterialIcons
          name={grouped ? "view-agenda" : "view-list"}
          size={16}
          color={grouped ? theme.primary : theme.muted}
        />
        <Text style={[styles.groupToggleText, {
          color: grouped ? theme.primary : theme.text,
        }]}>
          {grouped ? t.vehicle.warrantyGrouped : t.vehicle.warrantyUngrouped}
        </Text>
      </Pressable>
    </View>
  );
}

export function CoverageCard({t, theme, row, claim, onOpen, onClaim}: {
  t: Strings;
  theme: AppTheme;
  row: WarrantyCoverageRow;
  claim: WarrantyClaim | null;
  onOpen: () => void;
  onClaim: () => void;
}) {
  const active = activeOf(row.line.warrantyUntil);
  const provider = row.item.provider ?? null;
  const color = claim !== null ?
    warrantyStatusColor(claim.status, theme) :
    active ? theme.primary : theme.muted;
  return (
    <Pressable
      style={[styles.card, {
        borderColor: theme.border,
        backgroundColor: theme.paper,
      }]}
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={row.line.name}
    >
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={[styles.title, {color: theme.text}]} numberOfLines={1}>
            {row.line.name}
          </Text>
          <View style={styles.providerRow}>
            <MaterialIcons name="storefront" size={12} color={theme.primary} />
            <Text style={[styles.providerName, {color: theme.primary}]} numberOfLines={1}>
              {provider?.name ?? row.item.providerName ?? row.item.ticketType}
            </Text>
          </View>
        </View>
        <View style={[styles.pill, {backgroundColor: color}]}>
          <Text style={styles.pillText}>
            {claim !== null ?
              warrantyStatusLabel(claim.status, t) :
              active ? t.vehicle.warrantyActive : t.flag.expired}
          </Text>
        </View>
      </View>
      <Text style={[styles.meta, {color: theme.muted}]}>
        {[row.profile.label, row.profile.plate]
          .filter((value) => typeof value === "string" && value !== "")
          .join(" · ")}
      </Text>
      <Text style={[styles.meta, {color: theme.muted}]}>
        {`${t.bills.warranty}: ${billDateLabel(row.line.warrantyUntil)}`}
      </Text>
      <View style={styles.rowBetween}>
        <Text style={[styles.amount, {color: theme.text}]}>
          {`${row.line.amount.toLocaleString()} VND`}
        </Text>
        {active && claim === null ? (
          <Pressable
            style={[styles.secondary, {borderColor: theme.primary}]}
            onPress={onClaim}
          >
            <Text style={[styles.primaryText, {color: theme.primary}]}>
              {t.bills.claimWarranty}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

export function CoverageGroupCard({t, theme, group, onOpen}: {
  t: Strings;
  theme: AppTheme;
  group: WarrantyCoverageGroup;
  onOpen: (entry: WarrantyCoverageEntry) => void;
}) {
  const provider = group.item.provider ?? null;
  const activeClaim = group.entries.find((entry) =>
    entry.claim !== null &&
    ["OPEN", "REBOOKED", "ACCEPTED", "DISPUTED"].includes(entry.claim.status)
  )?.claim ?? null;
  const firstClaim = activeClaim ??
    group.entries.find((entry) => entry.claim !== null)?.claim ?? null;
  const anyActive = group.entries.some((entry) =>
    activeOf(entry.coverage.line.warrantyUntil));
  const color = firstClaim !== null ?
    warrantyStatusColor(firstClaim.status, theme) :
    anyActive ? theme.primary : theme.muted;
  const label = firstClaim !== null ?
    warrantyStatusLabel(firstClaim.status, t) :
    anyActive ? t.vehicle.warrantyActive : t.flag.expired;
  return (
    <View style={[styles.card, {
      borderColor: theme.border,
      backgroundColor: theme.paper,
    }]}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={[styles.title, {color: theme.text}]} numberOfLines={1}>
            {provider?.name ?? group.item.providerName ?? group.item.ticketType}
          </Text>
          <Text style={[styles.meta, {color: theme.muted}]}>
            {[group.profile.label, group.profile.plate]
              .filter((value) => typeof value === "string" && value !== "")
              .join(" · ")}
          </Text>
        </View>
        <View style={[styles.pill, {backgroundColor: color}]}>
          <Text style={styles.pillText}>{label}</Text>
        </View>
      </View>
      <Text style={[styles.meta, {color: theme.muted}]}>
        {[
          `#${group.ticketId.slice(-6)}`,
          group.item.ticketType,
          group.item.serviceDate ? billDateLabel(group.item.serviceDate) : null,
        ].filter((value) => typeof value === "string" && value !== "").join(" · ")}
      </Text>
      <View style={styles.entries}>
        {group.entries.map((entry) => {
          const active = activeOf(entry.coverage.line.warrantyUntil);
          const entryColor = entry.claim !== null ?
            warrantyStatusColor(entry.claim.status, theme) :
            active ? theme.primary : theme.muted;
          return (
            <Pressable
              key={entry.coverage.line.lineId}
              style={[styles.entry, {borderColor: theme.divider}]}
              onPress={() => onOpen(entry)}
              accessibilityRole="button"
              accessibilityLabel={entry.coverage.line.name}
            >
              <View style={styles.entryMain}>
                <View style={styles.entryText}>
                  <Text style={[styles.entryName, {color: theme.text}]} numberOfLines={1}>
                    {entry.coverage.line.name}
                  </Text>
                  <Text style={[styles.meta, {color: theme.muted}]}>
                    {`${t.bills.warranty}: ${billDateLabel(entry.coverage.line.warrantyUntil)}`}
                  </Text>
                  <Text style={[styles.meta, {color: theme.muted}]}>
                    {`${entry.coverage.line.amount.toLocaleString()} VND`}
                  </Text>
                </View>
                <View style={[styles.pill, {backgroundColor: entryColor}]}>
                  <Text style={styles.pillText}>
                    {entry.claim !== null ?
                      warrantyStatusLabel(entry.claim.status, t) :
                      active ? t.vehicle.warrantyActive : t.flag.expired}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ClaimCard({t, theme, claim, providerView, busy, onOpen, onRespond, onDispute, onPhoto}: {
  t: Strings;
  theme: AppTheme;
  claim: WarrantyClaim;
  providerView: boolean;
  busy: boolean;
  onOpen: () => void;
  onRespond: (accept: boolean) => void;
  onDispute: () => void;
  onPhoto: (path: string) => void;
}) {
  const color = warrantyStatusColor(claim.status, theme);
  return (
    <Pressable
      style={[styles.card, {
        borderColor: theme.border,
        backgroundColor: theme.paper,
      }]}
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={claim.serviceName}
    >
      <View style={styles.head}>
        <Text style={[styles.title, {color: theme.text}]} numberOfLines={1}>
          {claim.serviceName}
        </Text>
        <View style={[styles.pill, {backgroundColor: color}]}>
          <Text style={styles.pillText}>
            {warrantyStatusLabel(claim.status, t)}
          </Text>
        </View>
      </View>
      <Text style={[styles.meta, {color: theme.muted}]}>
        {[claim.vehicleLabel, claim.vehiclePlate]
          .filter((value) => typeof value === "string" && value !== "")
          .join(" · ") || `#${claim.ticketId.slice(-6)}`}
      </Text>
      <Text style={[styles.meta, {color: theme.muted}]}>
        {`${t.bills.warranty}: ${billDateLabel(claim.warrantyUntil)}`}
      </Text>
      {warrantyDeclineReasonLabel(claim.declineReasonCode, t) !== null ? (
        <Text style={[styles.meta, {color: theme.muted}]}>
          {`${t.provider.warrantyDeclineReason}: ${warrantyDeclineReasonLabel(claim.declineReasonCode, t)}`}
        </Text>
      ) : null}
      <Text style={[styles.body, {color: theme.text}]}>{claim.reason}</Text>
      {claim.shopResponse ? (
        <Text style={[styles.meta, {color: theme.muted}]}>
          {claim.shopResponse}
        </Text>
      ) : null}
      {claim.photoUrls.length > 0 ? (
        <View style={styles.photoRow}>
          {claim.photoUrls.map((path, index) => (
            <PhotoThumb
              key={`${path}-${index}`}
              path={path}
              theme={theme}
              style={styles.photo}
              onPress={onPhoto}
              accessibilityLabel={`${t.assist.photos} ${index + 1}`}
            />
          ))}
        </View>
      ) : null}
      {providerView && claim.status === "OPEN" ? (
        <View style={styles.actions}>
          <Pressable
            style={[styles.primary, styles.actionHalf, {backgroundColor: theme.primary}, busy && styles.disabled]}
            disabled={busy}
            onPress={() => onRespond(true)}
            accessibilityRole="button"
            accessibilityLabel={t.assist.accept}
          >
            <Text style={styles.primaryText}>{t.assist.accept}</Text>
          </Pressable>
          <Pressable
            style={[styles.secondary, styles.actionHalf, {borderColor: theme.danger}, busy && styles.disabled]}
            disabled={busy}
            onPress={() => onRespond(false)}
            accessibilityRole="button"
            accessibilityLabel={t.provider.decline}
          >
            <Text style={[styles.primaryText, {color: theme.danger}]}>
              {t.provider.decline}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {!providerView && claim.status === "DECLINED" ? (
        <Pressable
          style={[styles.secondary, {borderColor: theme.primary}]}
          onPress={onDispute}
        >
          <Text style={[styles.primaryText, {color: theme.primary}]}>
            {t.provider.dispute}
          </Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

export function ClaimGroupCard({t, theme, group, providerView, busy, onOpen, onRespond, onDispute}: {
  t: Strings;
  theme: AppTheme;
  group: WarrantyClaimGroup;
  providerView: boolean;
  busy: boolean;
  onOpen: (claim: WarrantyClaim) => void;
  onRespond: (claim: WarrantyClaim, accept: boolean) => void;
  onDispute: (claim: WarrantyClaim) => void;
}) {
  return (
    <View style={[styles.card, {
      borderColor: theme.border,
      backgroundColor: theme.paper,
    }]}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={[styles.title, {color: theme.text}]} numberOfLines={1}>
            {group.providerName ?? `#${group.ticketId.slice(-6)}`}
          </Text>
          <Text style={[styles.meta, {color: theme.muted}]}>
            {[group.vehicleLabel, group.vehiclePlate, group.ticketType]
              .filter((value) => typeof value === "string" && value !== "")
              .join(" · ")}
          </Text>
        </View>
        <Text style={[styles.meta, {color: theme.muted}]}>
          {`${group.claims.length} ${group.claims.length === 1 ? t.bills.item : t.bills.items}`}
        </Text>
      </View>
      <Text style={[styles.meta, {color: theme.muted}]}>
        {`#${group.ticketId.slice(-6)}${group.serviceDate ? ` · ${billDateLabel(group.serviceDate)}` : ""}`}
      </Text>
      <View style={styles.entries}>
        {group.claims.map((claim) => (
          <Pressable
            key={claim.id}
            style={[styles.entry, {borderColor: theme.divider}]}
            onPress={() => onOpen(claim)}
            accessibilityRole="button"
            accessibilityLabel={claim.serviceName}
          >
            <View style={styles.entryMain}>
              <View style={styles.entryText}>
                <Text style={[styles.entryName, {color: theme.text}]} numberOfLines={1}>
                  {claim.serviceName}
                </Text>
                <Text style={[styles.meta, {color: theme.muted}]}>
                  {`${t.bills.warranty}: ${billDateLabel(claim.warrantyUntil)}`}
                </Text>
                {warrantyDeclineReasonLabel(claim.declineReasonCode, t) !== null ? (
                  <Text style={[styles.meta, {color: theme.muted}]}>
                    {`${t.provider.warrantyDeclineReason}: ${warrantyDeclineReasonLabel(claim.declineReasonCode, t)}`}
                  </Text>
                ) : null}
                <Text style={[styles.meta, {color: theme.muted}]} numberOfLines={2}>
                  {claim.reason}
                </Text>
              </View>
              <View style={[styles.pill, {
                backgroundColor: warrantyStatusColor(claim.status, theme),
              }]}>
                <Text style={styles.pillText}>
                  {warrantyStatusLabel(claim.status, t)}
                </Text>
              </View>
            </View>
            {providerView && claim.status === "OPEN" ? (
              <View style={styles.actions}>
                <Pressable
                  style={[styles.primary, styles.actionHalf, {backgroundColor: theme.primary}, busy && styles.disabled]}
                  disabled={busy}
                  onPress={() => onRespond(claim, true)}
                  accessibilityRole="button"
                  accessibilityLabel={t.assist.accept}
                >
                  <Text style={styles.primaryText}>{t.assist.accept}</Text>
                </Pressable>
                <Pressable
                  style={[styles.secondary, styles.actionHalf, {borderColor: theme.danger}, busy && styles.disabled]}
                  disabled={busy}
                  onPress={() => onRespond(claim, false)}
                  accessibilityRole="button"
                  accessibilityLabel={t.provider.decline}
                >
                  <Text style={[styles.primaryText, {color: theme.danger}]}>
                    {t.provider.decline}
                  </Text>
                </Pressable>
              </View>
            ) : null}
            {!providerView && claim.status === "DECLINED" ? (
              <Pressable
                style={[styles.secondary, {borderColor: theme.primary}]}
                onPress={() => onDispute(claim)}
              >
                <Text style={[styles.primaryText, {color: theme.primary}]}>
                  {t.provider.dispute}
                </Text>
              </Pressable>
            ) : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  actionHalf: {flex: 1},
  primary: {flex: 1, borderRadius: 9, paddingVertical: 8, alignItems: "center"},
  secondary: {borderWidth: 1, borderRadius: 9, paddingVertical: 8, paddingHorizontal: 10, alignItems: "center"},
  primaryText: {fontSize: 12, fontWeight: "700"},
  rowBetween: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8},
  amount: {fontSize: 13, fontWeight: "700"},
  disabled: {opacity: 0.6},
  toolRow: {flexDirection: "row", justifyContent: "flex-end"},
  groupToggle: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  groupToggleText: {fontSize: 11, fontWeight: "700"},
  entries: {gap: 0},
  entry: {borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 8, gap: 6},
  entryMain: {flexDirection: "row", alignItems: "center", gap: 8},
  entryText: {flex: 1, gap: 1},
  entryName: {fontSize: 13, fontWeight: "700"},
});
