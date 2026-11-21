import type {MyAnalytics} from "../../api/analytics";
import type {EligibleAppeals} from "../../api/appeals";
import type {ReceivedRatings} from "../../api/ratings";
import type {Strings} from "../../i18n/en";
import type {DashboardBar, DashboardData} from "./DashboardView";
import { formatDayMonth } from "../../utils/date";

export function money(value: number): string {
  return `${Math.round(value).toLocaleString()} VND`;
}

function bucketBars(
  rows: Array<{date: string; value: number}>,
  maxBuckets = 7,
): DashboardBar[] {
  if (rows.length === 0) return [];
  const size = Math.ceil(rows.length / maxBuckets);
  const buckets: DashboardBar[] = [];
  for (let index = 0; index < rows.length; index += size) {
    const chunk = rows.slice(index, index + size);
    const value = chunk.reduce((sum, row) => sum + row.value, 0);
    const first = chunk[0];
    const label = formatDayMonth(first.date);
    buckets.push({label, date: first.date, value, display: money(value)});
  }
  return buckets;
}

function topServiceLabel(
  mix: MyAnalytics["rider"]["services"],
): string {
  return mix.topService ?
    `${mix.topService.name} (${mix.topService.count})` :
    "-";
}

function breakdownOf(
  mix: MyAnalytics["rider"]["services"],
): DashboardBar[] {
  return mix.services.slice(0, 5).map((service) => ({
    label: service.name,
    value: service.count,
    display: String(service.count),
  }));
}

function serviceTypesOf(
  mix: MyAnalytics["rider"]["services"],
): DashboardBar[] {
  return Object.entries(mix.byType)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({
      label,
      value,
      display: String(value),
    }));
}

export function buildRiderDashboard({
  analytics,
  received,
  t,
}: {
  analytics: MyAnalytics;
  received: ReceivedRatings | null;
  t: Strings;
}): DashboardData {
  const rating = received?.rider.count ?
    `${received.rider.avg.toFixed(1)} (${received.rider.count})` :
    "-";
  const spend = analytics.rider.payments.gross;
  const activity = bucketBars(analytics.rider.series.map((row) => ({
    date: row.date,
    value: row.spend,
  })));
  return {
    mode: "RIDER",
    lastUpdated: analytics.generatedAt ?? "",
    hero: {
      label: t.more.dashboardSpend,
      value: money(spend),
      change: analytics.comparison?.change.rider.spend,
      series: analytics.rider.series.map((row) => row.spend),
    },
    stats: [
      {label: t.more.dashboardTrips, value: String(analytics.rider.tickets.total), change: analytics.comparison?.change.rider.tickets, icon: "route"},
      {label: t.more.dashboardCompleted, value: String(analytics.rider.tickets.completed), change: analytics.comparison?.change.rider.completed, icon: "task-alt"},
      {label: t.more.dashboardActive, value: String(analytics.rider.tickets.active), icon: "bolt"},
      {label: t.more.dashboardRating, value: rating, icon: "star"},
    ],
    activity,
    breakdown: breakdownOf(analytics.rider.services),
    serviceTypes: serviceTypesOf(analytics.rider.services),
    topService: topServiceLabel(analytics.rider.services),
    serviceCount: analytics.rider.services.services.length,
  };
}

export function buildProviderDashboard({
  analytics,
  requests,
  t,
}: {
  analytics: MyAnalytics;
  requests: number;
  t: Strings;
}): DashboardData {
  const rating = analytics.provider.rating.count > 0 ?
    `${analytics.provider.rating.avg.toFixed(1)} (${analytics.provider.rating.count})` :
    "-";
  const activity = bucketBars(analytics.provider.series.map((row) => ({
    date: row.date,
    value: row.earnings,
  })));
  return {
    mode: "PROVIDER",
    lastUpdated: analytics.generatedAt ?? "",
    hero: {
      label: t.more.dashboardNet,
      value: money(analytics.provider.earnings.net),
      change: analytics.comparison?.change.provider.net,
      series: analytics.provider.series.map((row) => row.earnings),
    },
    stats: [
      {label: t.more.dashboardTaken, value: String(analytics.provider.tickets.taken ?? analytics.provider.tickets.total), change: analytics.comparison?.change.provider.taken, icon: "assignment-turned-in"},
      {label: t.more.dashboardCompleted, value: String(analytics.provider.tickets.completed), change: analytics.comparison?.change.provider.completed, icon: "task-alt"},
      {label: t.more.dashboardBookings, value: String(analytics.provider.bookings.active), change: analytics.comparison?.change.provider.bookings, icon: "event"},
      {label: t.more.dashboardPending, value: String(requests), icon: "hourglass-empty"},
      {label: t.more.dashboardCommission, value: money(analytics.provider.earnings.commissionOwed), icon: "percent"},
      {label: t.more.dashboardRating, value: rating, icon: "star"},
    ],
    activity,
    breakdown: breakdownOf(analytics.provider.services),
    serviceTypes: serviceTypesOf(analytics.provider.services),
    topService: topServiceLabel(analytics.provider.services),
    serviceCount: analytics.provider.services.services.length,
  };
}

export function buildCasesSummary({
  received,
  eligible,
  t,
}: {
  received: ReceivedRatings | null;
  eligible: EligibleAppeals | null;
  t: Strings;
}): {hasCases: boolean; summary: string} {
  const riderCount = received?.rider.count ?? 0;
  const riderAvg = received?.rider.avg ?? 0;
  const providerRows = received?.providers.filter((provider) =>
    provider.count > 0) ?? [];
  const providerCount = providerRows.reduce(
    (sum, provider) => sum + provider.count,
    0,
  );
  const providerAvg = providerCount > 0 ?
    providerRows.reduce(
      (sum, provider) => sum + provider.avg * provider.count,
      0,
    ) / providerCount :
    0;
  const ratings = eligible?.ratings ?? [];
  const reports = eligible?.reports ?? [];
  const disputes = eligible?.disputes ?? [];
  const hasCases = riderCount > 0 ||
    providerCount > 0 ||
    ratings.length + reports.length + disputes.length > 0;
  const parts = [
    riderCount > 0 ?
      `${t.more.ratingAsRider} ${riderAvg.toFixed(1)} (${riderCount})` :
      null,
    providerCount > 0 ?
      `${t.more.dashboardProvider} ${providerAvg.toFixed(1)} (${providerCount})` :
      null,
    ...(ratings.length > 0 ? [`${t.more.appealSubjectRating} ${ratings.length}`] : []),
    ...(reports.length > 0 ? [`${t.more.appealSubjectReport} ${reports.length}`] : []),
    ...(disputes.length > 0 ? [`${t.more.appealSubjectDispute} ${disputes.length}`] : []),
  ].filter((part): part is string => part !== null);
  return {hasCases, summary: parts.join(" · ")};
}
