// Physical miniature base templates. This is deliberately scoped small for
// the first iteration: just the base shapes/sizes themselves, not full
// unit/army data (name, faction, model count, etc.) -- that's a later step
// once there's a real unit database to back it. For now, a BaseTemplate is
// just "a shape a model's base can be," which is enough to place accurate,
// correctly-scaled placeholder tokens on a map.

export type BaseShape = "circle" | "oval" | "rectangle";

export interface BaseTemplate {
  id: string; // e.g. "base_32mm"
  shape: BaseShape;
  label: string; // e.g. "32mm Circle", "120x92mm Oval"
  /** Circle bases: diameter in mm. */
  diameter_mm?: number;
  /** Oval bases: long axis (width) and short axis (height) in mm.
   *  Rectangle bases (most vehicles -- tanks, transports, etc. often
   *  don't come on a circular/oval base at all, just their own hull
   *  footprint): full width and height in mm, same fields. */
  width_mm?: number;
  height_mm?: number;
}

export const MM_PER_INCH = 25.4;
export const mmToIn = (mm: number): number => mm / MM_PER_INCH;

/** Footprint size of a base template, in inches, as [width, height]
 *  (width = diameter for circles, so a circle's "width" and "height" are
 *  equal). Useful for anything that needs a bounding box rather than
 *  shape-specific logic. */
export function baseFootprintIn(base: BaseTemplate): [number, number] {
  if (base.shape === "circle") {
    const d = mmToIn(base.diameter_mm!);
    return [d, d];
  }
  return [mmToIn(base.width_mm!), mmToIn(base.height_mm!)];
}
