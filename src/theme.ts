export const lightTheme = {
  primary: "#0ea5e9",
  primaryLight: "#7dd3fc",
  primaryDark: "#0284c7",
  background: "#f1f5f9",
  paper: "#ffffff",
  surface: "#f8fafc",
  surfaceRaised: "#ffffff",
  text: "#0f172a",
  muted: "#64748b",
  border: "#dbe3ec",
  divider: "#e2e8f0",
  tabInactive: "#64748b",
  danger: "#dc2626",
  success: "#16a34a",
  warning: "#d97706",
  info: "#2563eb",
  onPrimary: "#ffffff",
  overlay: "rgba(15, 23, 42, 0.62)",
  radius: 18,
  radiusSmall: 12,
  radiusPill: 999,
  space: {xs: 4, sm: 8, md: 12, lg: 16, xl: 24},
  font: {caption: 11, body: 14, label: 12, title: 18, display: 28},
  elevation: {card: 2, overlay: 12},
};

export const darkTheme = {
  primary: "#38bdf8",
  primaryLight: "#7dd3fc",
  primaryDark: "#0284c7",
  background: "#0b1017",
  paper: "#121a24",
  surface: "#172230",
  surfaceRaised: "#1d2a3a",
  text: "#f8fafc",
  muted: "#94a3b8",
  border: "#2b3b4f",
  divider: "#223143",
  tabInactive: "#7f91a6",
  danger: "#f87171",
  success: "#4ade80",
  warning: "#f59e0b",
  info: "#60a5fa",
  onPrimary: "#07111d",
  overlay: "rgba(2, 6, 23, 0.78)",
  radius: 18,
  radiusSmall: 12,
  radiusPill: 999,
  space: {xs: 4, sm: 8, md: 12, lg: 16, xl: 24},
  font: {caption: 11, body: 14, label: 12, title: 18, display: 28},
  elevation: {card: 4, overlay: 16},
};

export const amoledTheme = {
  ...darkTheme,
  background: "#000000",
  paper: "#000000",
  surface: "#080808",
  surfaceRaised: "#121212",
  border: "#252525",
  divider: "#1d1d1d",
  overlay: "rgba(0, 0, 0, 0.88)",
};

export type AppTheme = typeof lightTheme;

export function themeForMode(mode: "light" | "dark" | "amoled"): AppTheme {
  if (mode === "amoled") return amoledTheme;
  return mode === "dark" ? darkTheme : lightTheme;
}

export function onColor(color: string): string {
  const hex = color.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.6 ? "#111111" : "#ffffff";
}
