export const FAB_SIZE = 48;
export const FAB_GAP = 8;
const BOTTOM_MARGIN = 12;

export function rightColumnBottom(cardH: number): number {
  return cardH + BOTTOM_MARGIN + FAB_GAP + FAB_SIZE + FAB_GAP;
}
