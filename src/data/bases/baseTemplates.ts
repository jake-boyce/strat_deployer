import type { BaseTemplate } from "./schema";

// First iteration: just the base shapes/sizes explicitly requested. Add
// more here as needed (e.g. 25mm/28.5mm circle, other oval sizes, square
// bases for some vehicles) -- this list is the single source of truth for
// both the token library browser and (later) actual unit-to-base mapping.
export const baseTemplates: BaseTemplate[] = [
  { id: "base_25mm", shape: "circle", label: "25mm Circle", diameter_mm: 25 },
  { id: "base_28.5mm", shape: "circle", label: "28.5mm Circle", diameter_mm: 28.5 },
  { id: "base_32mm", shape: "circle", label: "32mm Circle", diameter_mm: 32 },
  { id: "base_40mm", shape: "circle", label: "40mm Circle", diameter_mm: 40 },
  { id: "base_50mm", shape: "circle", label: "50mm Circle", diameter_mm: 50 },
  { id: "base_60mm", shape: "circle", label: "60mm Circle", diameter_mm: 60 },
  { id: "base_80mm", shape: "circle", label: "80mm Circle", diameter_mm: 80 },
  { id: "base_90mm", shape: "circle", label: "90mm Circle", diameter_mm: 90 },
  { id: "base_100mm", shape: "circle", label: "100mm Circle", diameter_mm: 100 },
  { id: "base_120mm", shape: "circle", label: "120mm Circle", diameter_mm: 120 },
  { id: "base_130mm", shape: "circle", label: "130mm Circle", diameter_mm: 130 },
  { id: "base_160mm", shape: "circle", label: "160mm Circle", diameter_mm: 160 },
  { id: "base_60x35.5mm", shape: "oval", label: "60x35.5mm Oval", width_mm: 60, height_mm: 35.5 },
  { id: "base_75x42mm", shape: "oval", label: "75x42mm Oval", width_mm: 75, height_mm: 42 },
  { id: "base_90x52.5mm", shape: "oval", label: "90x52.5mm Oval", width_mm: 90, height_mm: 52.5 },
  { id: "base_105x70mm", shape: "oval", label: "105x70mm Oval", width_mm: 105, height_mm: 70 },
  { id: "base_120x92mm", shape: "oval", label: "120x92mm Oval", width_mm: 120, height_mm: 92 },
  { id: "base_150x95mm", shape: "oval", label: "150x95mm Oval", width_mm: 150, height_mm: 95 },
  { id: "base_170x109mm", shape: "oval", label: "170x109mm Oval", width_mm: 170, height_mm: 109 },
  // vehicle hull footprints -- many vehicles (tanks, transports) don't
  // come on a circular/oval base at all, just their own rectangular hull
  { id: "base_105x68mm_rect", shape: "rectangle", label: "105x68mm Hull", width_mm: 105, height_mm: 68 },
];

export const getBaseTemplateById = (id: string): BaseTemplate | undefined =>
  baseTemplates.find((b) => b.id === id);
