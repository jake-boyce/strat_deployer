import type { BaseTemplate } from "./schema";
import { baseFootprintIn } from "./schema";
import type { Point } from "../maps/schema";

export interface UnitTemplate {
  id: string;
  label: string;
  baseTemplateId: string;
  modelCount: number;
  /** Row layout, front-to-back, e.g. [3, 2] for a 5-model unit in a 3-row
   *  then 2-row tight formation, [5, 5] for a 10-model unit in two ranks
   *  of 5. Must sum to modelCount. */
  rows: number[];
}

export const unitTemplates: UnitTemplate[] = [
  { id: "unit_25mm_5", label: "25mm x5", baseTemplateId: "base_25mm", modelCount: 5, rows: [3, 2] },
  { id: "unit_25mm_10", label: "25mm x10", baseTemplateId: "base_25mm", modelCount: 10, rows: [5, 5] },
  { id: "unit_25mm_20", label: "25mm x20", baseTemplateId: "base_25mm", modelCount: 20, rows: [5, 5, 5, 5] },
  { id: "unit_28.5mm_5", label: "28.5mm x5", baseTemplateId: "base_28.5mm", modelCount: 5, rows: [3, 2] },
  { id: "unit_28.5mm_10", label: "28.5mm x10", baseTemplateId: "base_28.5mm", modelCount: 10, rows: [5, 5] },
  { id: "unit_32mm_1", label: "32mm x1", baseTemplateId: "base_32mm", modelCount: 1, rows: [1] },
  { id: "unit_32mm_5", label: "32mm x5", baseTemplateId: "base_32mm", modelCount: 5, rows: [3, 2] },
  { id: "unit_32mm_10", label: "32mm x10", baseTemplateId: "base_32mm", modelCount: 10, rows: [5, 5] },
  { id: "unit_40mm_3", label: "40mm x3", baseTemplateId: "base_40mm", modelCount: 3, rows: [3] },
  { id: "unit_40mm_5", label: "40mm x5", baseTemplateId: "base_40mm", modelCount: 5, rows: [3, 2] },
  { id: "unit_40mm_6", label: "40mm x6", baseTemplateId: "base_40mm", modelCount: 6, rows: [3, 3] },
  { id: "unit_60mm_1", label: "60mm x1", baseTemplateId: "base_60mm", modelCount: 1, rows: [1] },
  { id: "unit_60mm_3", label: "60mm x3", baseTemplateId: "base_60mm", modelCount: 3, rows: [3] },
  { id: "unit_60mm_6", label: "60mm x6", baseTemplateId: "base_60mm", modelCount: 6, rows: [3, 3] },
  { id: "unit_90mm_1", label: "90mm x1", baseTemplateId: "base_90mm", modelCount: 1, rows: [1] },
  {
    id: "unit_60x35.5mm_3",
    label: "60x35.5mm x3",
    baseTemplateId: "base_60x35.5mm",
    modelCount: 3,
    rows: [3],
  },
  {
    id: "unit_60x35.5mm_6",
    label: "60x35.5mm x6",
    baseTemplateId: "base_60x35.5mm",
    modelCount: 6,
    rows: [3, 3],
  },
];

export const getUnitTemplateById = (id: string): UnitTemplate | undefined =>
  unitTemplates.find((u) => u.id === id);

/** Offsets (in inches, relative to the formation's own center) for each
 *  model in a tight (base-edge-to-base-edge) rectangular formation. Row 0
 *  is placed at the -y side of the formation, later rows increasing +y;
 *  each row is horizontally centered on the formation's x=0, so a shorter
 *  row (e.g. the 2-row in a 3+2 formation) sits centered under the longer
 *  one rather than flush to one side. */
export function formationOffsetsIn(unit: UnitTemplate, base: BaseTemplate): Point[] {
  const [baseWidthIn] = baseFootprintIn(base);
  const rowCount = unit.rows.length;
  const totalHeight = rowCount * baseWidthIn;
  const offsets: Point[] = [];
  unit.rows.forEach((count, rowIndex) => {
    const rowWidth = count * baseWidthIn;
    const y = -totalHeight / 2 + baseWidthIn / 2 + rowIndex * baseWidthIn;
    for (let i = 0; i < count; i++) {
      const x = -rowWidth / 2 + baseWidthIn / 2 + i * baseWidthIn;
      offsets.push([x, y]);
    }
  });
  return offsets;
}
