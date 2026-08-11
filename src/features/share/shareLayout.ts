/** Preview and exported PNG use this same visual scale. */
export const SHARE_CARD_PREVIEW_SCALE = 0.58;

export function scaleShareCardDimension(dimension: number): number {
  return Math.round(dimension * SHARE_CARD_PREVIEW_SCALE);
}
