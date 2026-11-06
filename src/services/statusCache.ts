import {api} from "../api/client";

type StatusRow = {
  domain?: string;
  code?: string;
  name?: string;
  nameVi?: string | null;
};

let statusMap: Record<string, StatusRow> = {};
let currentLang: "en" | "vi" = "en";
let loaded = false;
let loading: Promise<void> | null = null;

export function setStatusLang(lang: "en" | "vi"): void {
  currentLang = lang;
}

export async function loadStatuses(token: string | null | undefined): Promise<void> {
  if (!token || loaded || loading) return loading ?? Promise.resolve();
  loading = (async () => {
    try {
      const grouped = await api.post<Record<string, StatusRow[]>>("/statuses", {}, token);
      const next: Record<string, StatusRow> = {};
      for (const rows of Object.values(grouped ?? {})) {
        if (!Array.isArray(rows)) continue;
        for (const row of rows) {
          const domain = String(row.domain ?? "");
          const code = String(row.code ?? "");
          if (domain === "" || code === "") continue;
          next[`${domain}:${code}`] = row;
        }
      }
      statusMap = next;
      loaded = true;
    } catch {
      void 0;
    } finally {
      loading = null;
    }
  })();
  return loading;
}

export function statusName(domain: string, code: string, fallback: string): string {
  const row = statusMap[`${domain}:${code}`];
  if (!row) return fallback;
  if (currentLang === "vi") return row.nameVi || row.name || fallback;
  return row.name || fallback;
}
