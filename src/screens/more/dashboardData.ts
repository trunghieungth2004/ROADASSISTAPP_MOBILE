import type {Bill} from "../../api/bills";
import type {Booking} from "../../api/bookings";
import type {DispatchTicket} from "../../api/dispatch";
import type {ProviderStats} from "../../api/providers";
import type {EligibleAppeals} from "../../api/appeals";
import type {ReceivedRatings} from "../../api/ratings";
import type {Strings} from "../../i18n/en";
import {DISPATCH_STATUS} from "../../api/dispatch";
import type {DashboardBar, DashboardData} from "./DashboardView";

const TERMINAL = new Set<string>([
  DISPATCH_STATUS.RESOLVED,
  DISPATCH_STATUS.CANCELLED,
  DISPATCH_STATUS.DECLINED,
  DISPATCH_STATUS.RESOLVED_UNFIXABLE,
  DISPATCH_STATUS.UNFIXABLE,
]);

export function money(value: number): string {
  return `${Math.round(value).toLocaleString()} VND`;
}

function monthKey(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function lastMonths(count: number, locale: string): Array<{key: string; label: string}> {
  const now = new Date();
  return Array.from({length: count}, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    return {
      key: monthKey(date),
      label: date.toLocaleDateString(locale, {month: "short"}),
    };
  });
}

export function buildRiderDashboard({
  bills,
  received,
  t,
  lang,
}: {
  bills: Bill[];
  received: ReceivedRatings | null;
  t: Strings;
  lang: string;
}): {data: DashboardData; summary: string} {
  const locale = lang === "vi" ? "vi-VN" : "en-US";
  const months = lastMonths(6, locale);
  const completed = bills.filter((bill) =>
    bill.ticketStatus === DISPATCH_STATUS.RESOLVED).length;
  const active = bills.filter((bill) => !TERMINAL.has(bill.ticketStatus)).length;
  const spend = bills.reduce((sum, bill) => sum + bill.paid, 0);
  const monthly: DashboardBar[] = months.map((month) => {
    const rows = bills.filter((bill) =>
      bill.createdAt !== null && monthKey(bill.createdAt) === month.key);
    const value = rows.reduce((sum, bill) => sum + bill.paid, 0);
    return {label: month.label, value, display: money(value)};
  });
  const types = new Map<string, number>();
  for (const bill of bills) {
    types.set(bill.ticketType, (types.get(bill.ticketType) ?? 0) + 1);
  }
  const rating = received?.rider.count ?
    `${received.rider.avg.toFixed(1)} (${received.rider.count})` :
    "-";
  return {
    data: {
      mode: "RIDER",
      stats: [
        {label: t.more.dashboardTrips, value: String(bills.length)},
        {label: t.more.dashboardCompleted, value: String(completed)},
        {label: t.more.dashboardActive, value: String(active)},
        {label: t.more.dashboardSpend, value: money(spend)},
        {label: t.more.dashboardRating, value: rating},
      ],
      monthly,
      breakdown: [...types.entries()].map(([label, value]) => ({
        label,
        value,
        display: String(value),
      })),
    },
    summary: `${bills.length} ${t.more.dashboardTrips.toLowerCase()} · ${money(spend)} · ${received?.rider.count ? `★ ${received.rider.avg.toFixed(1)}` : "-"}`,
  };
}

export function buildProviderDashboard({
  stats,
  bookings,
  requests,
  records,
  t,
  lang,
}: {
  stats: ProviderStats | null;
  bookings: Booking[];
  requests: number;
  records: DispatchTicket[];
  t: Strings;
  lang: string;
}): {data: DashboardData; summary: string} {
  const locale = lang === "vi" ? "vi-VN" : "en-US";
  const months = lastMonths(6, locale);
  const providers = stats?.providers ?? [];
  const completed = providers.reduce((sum, row) => sum + row.completedJobs, 0);
  const ratingCount = providers.reduce((sum, row) => sum + row.ratingCount, 0);
  const rating = ratingCount > 0 ?
    providers.reduce((sum, row) => sum + row.ratingAvg * row.ratingCount, 0) / ratingCount :
    0;
  const bookingCount = bookings.filter((booking) =>
    booking.status === "REQUESTED" ||
    booking.status === "CONFIRMED" ||
    booking.status === "ARRIVED").length;
  const monthly: DashboardBar[] = months.map((month) => {
    const jobs = records.filter((row) =>
      monthKey(row.createdAt ?? "") === month.key).length;
    const booked = bookings.filter((row) =>
      monthKey(row.scheduledAt) === month.key).length;
    return {
      label: month.label,
      value: jobs + booked,
      display: `${jobs} / ${booked}`,
    };
  });
  const types = new Map<string, number>();
  for (const row of records) {
    types.set(row.ticketType, (types.get(row.ticketType) ?? 0) + 1);
  }
  return {
    data: {
      mode: "PROVIDER",
      stats: [
        {label: t.more.dashboardCompleted, value: String(completed)},
        {label: t.more.dashboardPending, value: String(requests)},
        {label: t.more.dashboardBookings, value: String(bookingCount)},
        {label: t.more.dashboardEarned, value: money(stats?.payouts.gross ?? 0)},
        {label: t.more.dashboardNet, value: money(stats?.payouts.net ?? 0)},
        {label: t.more.dashboardCommission, value: money(stats?.payouts.commissionOwed ?? 0)},
        {
          label: t.more.dashboardRating,
          value: ratingCount > 0 ? `${rating.toFixed(1)} (${ratingCount})` : "-",
        },
      ],
      monthly,
      breakdown: [...types.entries()].map(([label, value]) => ({
        label,
        value,
        display: String(value),
      })),
    },
    summary: `${completed} ${t.more.dashboardCompleted.toLowerCase()} · ${requests} ${t.more.dashboardPending.toLowerCase()} · ${bookingCount} ${t.more.dashboardBookings.toLowerCase()}`,
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
