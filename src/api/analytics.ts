import {api} from "./client";

export type AnalyticsRangeInput = {
  days?: number;
  startDate?: string;
  endDate?: string;
};

export type AnalyticsServiceUsage = {
  key: string;
  name: string;
  category: string | null;
  count: number;
  revenue: number;
};

export type AnalyticsServiceMix = {
  total: number;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
  services: AnalyticsServiceUsage[];
  topService: {
    key: string;
    name: string;
    count: number;
    kind: "TYPE" | "SERVICE";
  } | null;
};

export type AnalyticsBookingSummary = {
  total: number;
  active: number;
  completed: number;
  cancelled: number;
  declined: number;
  noShow: number;
  byStatus: Record<string, number>;
  byService: Array<{key: string; name: string; count: number}>;
};

export type AnalyticsTicketTotals = {
  total: number;
  active: number;
  completed: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
};

export type AnalyticsPaymentTotals = {
  count: number;
  received: number;
  gross: number;
  commission: number;
  refunded: number;
  net: number;
};

export type RiderActivityPoint = {
  date: string;
  tickets: number;
  completed: number;
  spend: number;
  bookings: number;
};

export type ProviderActivityPoint = {
  date: string;
  jobs: number;
  completed: number;
  earnings: number;
  bookings: number;
};

export type MyDayTicket = {
  id: string;
  ticketType: string;
  status: string;
  createdAt: string | null;
  riderId: string;
  riderName: string | null;
  providerId: string | null;
  providerName: string | null;
  providerKind: string | null;
  paymentStatus: string | null;
  amount: number | null;
  description: string | null;
  symptom: string | null;
};

export type MyDayBooking = {
  id: string;
  status: string;
  scheduledAt: string | null;
  providerId: string;
  providerName: string | null;
  serviceNames: string[];
  depositAmount: number;
  note: string | null;
};

export type MyDayPayment = {
  id: string;
  ticketId: string;
  amount: number;
  commissionAmount: number;
  status: string;
  method: string;
  createdAt: string | null;
  confirmedAt: string | null;
};

export type MyDayDetail = {
  date: string;
  mode: "RIDER" | "PROVIDER";
  totals: {
    tickets: number;
    completed: number;
    bookings: number;
    gross: number;
    commission: number;
  };
  tickets: MyDayTicket[];
  bookings: MyDayBooking[];
  payments: MyDayPayment[];
};

export function myAnalyticsDay(
  token: string,
  date: string,
  mode: "RIDER" | "PROVIDER",
): Promise<MyDayDetail> {
  return api.post<MyDayDetail>("/analytics/me/day", { date, mode }, token);
}

export type MyAnalytics = {
  windowDays: number;
  days: number;
  startDate: string;
  endDate: string;
  generatedAt?: string;
  comparison?: {
    startDate: string;
    endDate: string;
    current: {
      rider: {spend: number; tickets: number; completed: number; bookings: number};
      provider: {gross: number; net: number; taken: number; completed: number; bookings: number};
    };
    previous: {
      rider: {spend: number; tickets: number; completed: number; bookings: number};
      provider: {gross: number; net: number; taken: number; completed: number; bookings: number};
    };
    change: {
      rider: {spend: number; tickets: number; completed: number; bookings: number};
      provider: {gross: number; net: number; taken: number; completed: number; bookings: number};
    };
  };
  rider: {
    tickets: AnalyticsTicketTotals;
    payments: AnalyticsPaymentTotals;
    bookings: AnalyticsBookingSummary;
    services: AnalyticsServiceMix;
    series: RiderActivityPoint[];
  };
  provider: {
    providers: Array<{
      id: string;
      kind: string;
      name: string;
      status: string;
      accepting: boolean;
      suspended: boolean;
      ratingAvg: number;
      ratingCount: number;
      completedJobs: number;
      lifetimeCompletedJobs: number;
      bookings: number;
      services: AnalyticsServiceUsage[];
    }>;
    tickets: AnalyticsTicketTotals & {taken: number};
    earnings: AnalyticsPaymentTotals & {commissionOwed: number};
    payouts: {count: number; net: number};
    bookings: AnalyticsBookingSummary;
    rating: {avg: number; count: number};
    services: AnalyticsServiceMix;
    series: ProviderActivityPoint[];
  };
};

export function myAnalytics(
  token: string,
  range: AnalyticsRangeInput = {},
): Promise<MyAnalytics> {
  return api.post<MyAnalytics>("/analytics/me", range, token);
}
