export const SNACK_GAP = 12;

export const TAB_BAR_HEIGHT = 64;

export function snackAboveTabs(insetsBottom: number): number {
  return insetsBottom + TAB_BAR_HEIGHT + SNACK_GAP;
}
