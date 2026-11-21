const DAY_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (value: number): string => String(value).padStart(2, "0");

export function formatDateDMY(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string") {
    const day = DAY_ONLY.exec(value);
    if (day) return `${day[3]}/${day[2]}/${day[1]}`;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function formatDateTimeDMY(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${formatDateDMY(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parseDateDMY(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function formatDayMonth(value: string): string {
  const match = DAY_ONLY.exec(value);
  if (match) return `${match[3]}/${match[2]}`;
  const formatted = formatDateDMY(value);
  return formatted === "" ? "" : formatted.slice(0, 5);
}

export function formatTime(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
