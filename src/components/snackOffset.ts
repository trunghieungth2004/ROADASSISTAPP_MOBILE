export const SNACK_GAP = 12;

export function snackAbove(base: number, anchorHeight: number, gap: number = SNACK_GAP): number {
  return base + anchorHeight + gap;
}
