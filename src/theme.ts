export const lightTheme = {
  primary: "#0284c7",
  primaryLight: "#7dd3fc",
  primaryDark: "#0369a1",
  background: "#f5f7f5",
  paper: "#ffffff",
  text: "#111111",
  muted: "#737373",
  border: "#e5e5e5",
  divider: "#e5e5e5",
  tabInactive: "#737373",
  danger: "#b91c1c",
  success: "#15803d",
  radius: 16,
};

export const darkTheme = {
  primary: "#38bdf8",
  primaryLight: "#7dd3fc",
  primaryDark: "#075985",
  background: "#121212",
  paper: "#1e1e22",
  text: "#ffffff",
  muted: "#a3a3a3",
  border: "#404040",
  divider: "#404040",
  tabInactive: "#a3a3a3",
  danger: "#f87171",
  success: "#4ade80",
  radius: 16,
};

export type AppTheme = typeof lightTheme;

export function onColor(color: string): string {
  const hex = color.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.6 ? "#111111" : "#ffffff";
}
