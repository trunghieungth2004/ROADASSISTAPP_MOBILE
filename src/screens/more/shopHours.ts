export const DOW = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

export type Day = (typeof DOW)[number];

export type DayHours = {enabled: boolean; open: string; close: string};

export type WeekHours = Record<Day, DayHours>;

export function emptyWeek(): WeekHours {
  return {
    MON: {enabled: false, open: "08:00", close: "18:00"},
    TUE: {enabled: false, open: "08:00", close: "18:00"},
    WED: {enabled: false, open: "08:00", close: "18:00"},
    THU: {enabled: false, open: "08:00", close: "18:00"},
    FRI: {enabled: false, open: "08:00", close: "18:00"},
    SAT: {enabled: false, open: "08:00", close: "18:00"},
    SUN: {enabled: false, open: "08:00", close: "18:00"},
  };
}

export function isValidTime(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

export function parseOpenHours(raw: string | null | undefined): WeekHours {
  const week = emptyWeek();
  if (!raw) return week;
  for (const entry of raw.split(",")) {
    const match = /^(MON|TUE|WED|THU|FRI|SAT|SUN) (\d{2}:\d{2})-(\d{2}:\d{2})$/.exec(entry.trim());
    if (!match) continue;
    const day = match[1] as Day;
    const open = match[2];
    const close = match[3];
    if (!isValidTime(open) || !isValidTime(close)) continue;
    week[day] = {enabled: true, open, close};
  }
  return week;
}

export function buildOpenHours(week: WeekHours): string | null {
  const entries: string[] = [];
  for (const day of DOW) {
    const row = week[day];
    if (!row.enabled) continue;
    if (!isValidTime(row.open) || !isValidTime(row.close)) return null;
    entries.push(`${day} ${row.open}-${row.close}`);
  }
  if (entries.length === 0) return null;
  return entries.join(",");
}

export function validateWeek(week: WeekHours): boolean {
  for (const day of DOW) {
    const row = week[day];
    if (!row.enabled) continue;
    if (!isValidTime(row.open) || !isValidTime(row.close)) return false;
  }
  return true;
}
