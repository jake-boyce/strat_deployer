import { baseTemplates } from "../../data/bases/baseTemplates";
import { mmToIn } from "../../data/bases/schema";
import { Token } from "./Token";

// pixels-per-inch for the library preview grid. Deliberately a plain
// constant (not tied to any map's scale) since this view is about
// comparing base sizes to each other, not to a board.
const PX_PER_IN = 36;
const CELL_PADDING = 24;

export function TokenLibrary() {
  return (
    <div style={{ padding: 24 }}>
      <div className="eyebrow" style={{ marginBottom: 4 }}>
        Base library
      </div>
      <h2 style={{ fontSize: 20, marginBottom: 10 }}>Physical base sizes</h2>
      <p style={{ maxWidth: 620, color: "var(--text-dim)", fontSize: 13, marginBottom: 28, lineHeight: 1.5 }}>
        Placeholder tokens by physical base size. These render at true
        relative scale to each other (a 60mm token is genuinely ~2.4x the
        diameter of a 25mm token here) so they're usable for deployment
        planning even before real unit art is wired in.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
        {baseTemplates.map((base) => {
          const widthIn = base.shape === "circle" ? mmToIn(base.diameter_mm!) : mmToIn(base.width_mm!);
          const heightIn = base.shape === "circle" ? mmToIn(base.diameter_mm!) : mmToIn(base.height_mm!);
          const svgW = widthIn * PX_PER_IN + CELL_PADDING * 2;
          const svgH = heightIn * PX_PER_IN + CELL_PADDING * 2;
          const dimLabel =
            base.shape === "circle"
              ? `${widthIn.toFixed(2)}" diameter`
              : `${widthIn.toFixed(2)}" x ${heightIn.toFixed(2)}"`;

          return (
            <div
              key={base.id}
              style={{
                textAlign: "center",
                background: "var(--bg-panel)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "16px 16px 14px",
              }}
            >
              <svg width={svgW} height={svgH}>
                <Token base={base} pxPerIn={PX_PER_IN} x={svgW / 2} y={svgH / 2} />
              </svg>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, marginTop: 6 }}>
                {base.label}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                {dimLabel}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
