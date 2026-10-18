export function formatAmountInput(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function parseAmountInput(display: string): number | null {
  const digits = display.replace(/[^0-9]/g, "");
  if (digits === "") return null;
  const value = Number(digits);
  return Number.isSafeInteger(value) ? value : null;
}
