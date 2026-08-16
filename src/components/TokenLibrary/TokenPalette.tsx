import type { CSSProperties, ReactNode } from "react";
import { baseTemplates, getBaseTemplateById } from "../../data/bases/baseTemplates";
import { baseFootprintIn } from "../../data/bases/schema";
import { unitTemplates, formationOffsetsIn, type UnitTemplate } from "../../data/bases/unitTemplates";
import { getUnitById, unitsForArmy } from "../../data/units/units";
import type { Unit } from "../../data/units/schema";
import type { MatchedRosterUnit, RosterAttachment } from "../../data/units/parseRoster";
import { Token } from "./Token";

const CELL = 56;
const ICON_AREA = CELL - 16;

/** Every unit-template formation actually available for a given unit --
 *  shared between the palette's own render (visibleUnitTemplates below)
 *  and the "Unit" dropdown's onChange handler, which needs to know this
 *  for whatever unit is being switched TO, before that unit is even the
 *  current selectedUnit yet. Same filtering rule either place: shares
 *  the unit's base size, and (when the unit restricts squad sizes)
 *  matches one of them. */
function templatesForUnit(unit: Unit): UnitTemplate[] {
  return unitTemplates.filter(
    (u) =>
      u.baseTemplateId === unit.baseTemplateId &&
      (unit.validSquadSizes === undefined || unit.validSquadSizes.includes(u.modelCount))
  );
}

export type Armed =
  | { type: "base"; id: string; fromRoster?: boolean }
  | { type: "unit"; id: string; fromRoster?: boolean }
  | null;

export interface TokenPaletteProps {
  mode: "deploy" | "move";
  onStartTurn1: () => void;
  onBackToDeployment: () => void;
  armed: Armed;
  onArm: (armed: Armed) => void;
  owner: "red" | "blue";
  onOwnerChange: (owner: "red" | "blue") => void;
  infiltrator: boolean;
  onInfiltratorChange: (value: boolean) => void;
  /** id into src/data/units/units.ts, or null for "generic base" mode. */
  selectedUnitId: string | null;
  onSelectedUnitChange: (id: string | null) => void;
  /** Faction name to restrict the "Unit" dropdown to (set by the army
   *  selector on the disposition-picker page for whichever side is
   *  currently "Placing for"), or null/undefined for no filtering --
   *  every unit in the roster stays offered. */
  armyFilter?: string | null;
  /** The currently-armed side's parsed roster, if one was pasted on the
   *  disposition-picker page -- both narrows the "Unit" dropdown (a
   *  subset of whatever armyFilter already allows) AND renders as its
   *  own checklist Section below, so the person can see who's left to
   *  deploy. Order/duplicates preserved deliberately (see
   *  MatchedRosterUnit) so two roster lines for the same unit (e.g. two
   *  Iron Priests at different point costs) render -- and check off --
   *  as two separate rows, not one. null/undefined or an empty array
   *  means no roster was given: no narrowing, no checklist shown. */
  roster?: MatchedRosterUnit[] | null;
  /** How many separate placement instances of each unit id the current
   *  owner has actually placed on the board (see DeploymentView's
   *  placedGroupCountByUnitId) -- paired against `roster` in order to
   *  decide which specific roster rows get a checkmark. */
  placedCountByUnitId?: Record<string, number>;
  /** Leader/Support <-> Bodyguard pairings from the roster (see
   *  parseRoster.ts's RosterAttachment) -- used to annotate each
   *  checklist row with which unit it's attached to/leads, and to note
   *  that placing the Bodyguard places its Leader/Support automatically
   *  (see DeploymentView's attachedLeaderToken). Purely a display hint
   *  here; the actual auto-placement happens in DeploymentView. */
  attachments?: RosterAttachment[];
  selectedCount: number;
  onDeleteSelected: () => void;
  onRotateSelected: (deltaDeg: number) => void;
  /** True if at least one selected token has a leg it could undo (more
   *  than just its turn-start point on its movement path). Only
   *  meaningful during Turn 1. */
  canUndoLastLeg: boolean;
  onUndoLastLeg: () => void;
}

function armedEquals(a: Armed, type: "base" | "unit", id: string): boolean {
  return a !== null && a.type === type && a.id === id;
}

/** Small preview icon showing a unit template's formation shape (e.g. the
 *  3+2 or 5+5 rank layout) as scaled-down dots, so the palette communicates
 *  the actual arrangement, not just a number. */
function FormationIcon({ unit }: { unit: UnitTemplate }) {
  const base = getBaseTemplateById(unit.baseTemplateId);
  if (!base) return null;
  const [baseWidthIn] = baseFootprintIn(base);
  const offsets = formationOffsetsIn(unit, base);
  const area = ICON_AREA;
  const rowCount = unit.rows.length;
  const maxRowLen = Math.max(...unit.rows);
  const formationWIn = maxRowLen * baseWidthIn;
  const formationHIn = rowCount * baseWidthIn;
  const scale = (area * 0.9) / Math.max(formationWIn, formationHIn);
  const dotR = Math.max(1.5, (baseWidthIn * scale) / 2 - 0.5);
  return (
    <svg width={CELL - 12} height={CELL - 12}>
      {offsets.map(([x, y], i) => (
        <circle
          key={i}
          cx={(CELL - 12) / 2 + x * scale}
          cy={(CELL - 12) / 2 + y * scale}
          r={dotR}
          fill="var(--text-dim)"
          stroke="var(--border-light)"
        />
      ))}
    </svg>
  );
}

function Section({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="eyebrow" style={{ marginBottom: hint ? 4 : 8 }}>
        {label}
      </div>
      {hint && <p style={{ fontSize: 11.5, color: "var(--text-faint)", margin: "0 0 8px", lineHeight: 1.4 }}>{hint}</p>}
      {children}
    </div>
  );
}

const paletteButtonStyle = (armed: boolean): CSSProperties => ({
  border: armed ? "1px solid var(--accent-border)" : "1px solid var(--border)",
  background: armed ? "var(--accent-dim)" : "var(--bg-panel-alt)",
  borderRadius: "var(--radius)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background 100ms ease, border-color 100ms ease",
});

const selectStyle: CSSProperties = {
  width: "100%",
  padding: "9px 10px",
  background: "var(--bg-panel-alt)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  fontFamily: "var(--font-display)",
  fontSize: 13,
  cursor: "pointer",
};

export function TokenPalette({
  mode,
  onStartTurn1,
  onBackToDeployment,
  armed,
  onArm,
  owner,
  onOwnerChange,
  infiltrator,
  onInfiltratorChange,
  selectedUnitId,
  onSelectedUnitChange,
  armyFilter,
  roster,
  placedCountByUnitId,
  attachments,
  selectedCount,
  onDeleteSelected,
  onRotateSelected,
  canUndoLastLeg,
  onUndoLastLeg,
}: TokenPaletteProps) {
  const selectedUnit = selectedUnitId ? getUnitById(selectedUnitId) : null;
  // restricted to the currently-armed side's army, when the disposition
  // picker's army selector set one -- "Generic base (no unit)" stays
  // available regardless, since it isn't tied to any faction. Uses
  // unitsForArmy rather than a plain faction check: some armies (Space
  // Wolves) share a codex with a parent faction (Space Marines) and get
  // most of its roster too, minus a handful of chapter-specific
  // exclusions -- see armyFactionAccess/excludedFromArmies in units.ts.
  const armyVisibleUnits = unitsForArmy(armyFilter ?? null);
  // further narrowed to a specific pasted roster, when one was given --
  // always a SUBSET of what the army already allows, never an override:
  // a roster entry for a unit the army filter already excludes (e.g. a
  // typo, or a different faction's unit) just won't show up either way.
  // An empty/absent roster list means "no additional narrowing," not
  // "show nothing" -- see DispositionPicker's RosterColumn, which only
  // ever passes a non-empty list up. Deduplicated here (the dropdown only
  // needs which units are allowed, not how many roster lines mention
  // each one -- that duplicate-preserving detail is what the checklist
  // section below uses `roster` directly for, unfiltered).
  const rosterUnitIds = roster && roster.length > 0 ? new Set(roster.map((e) => e.unitId)) : null;
  const visibleUnits = rosterUnitIds ? armyVisibleUnits.filter((u) => rosterUnitIds.has(u.id)) : armyVisibleUnits;
  // selecting a real unit locks the base-size choice to the one base that
  // unit actually comes on, rather than offering the whole base library
  const visibleBaseTemplates = selectedUnit
    ? baseTemplates.filter((b) => b.id === selectedUnit.baseTemplateId)
    : baseTemplates;
  // further restricted to the unit's actual valid squad sizes when set
  // (e.g. Hormagaunts only come in units of 10 or 20) -- undefined means
  // no restriction, every formation sharing the base size is offered,
  // same as before this field existed
  const visibleUnitTemplates = selectedUnit ? templatesForUnit(selectedUnit) : unitTemplates;

  /** `preferredModelCount` comes from a roster row's own parsed squad
   *  size (see MatchedRosterUnit.modelCount) -- when clicking a specific
   *  roster line, e.g. "Eliminator Squad" at a roster-implied 3 models,
   *  this arms the matching formation directly instead of leaving a
   *  choice between 3/6 the person already answered by having a real
   *  list. Deliberately gated on the unit's OWN declared
   *  `validSquadSizes` actually including this number, not just "does
   *  some template happen to have this modelCount" -- the roster
   *  parser's count is a best-effort sum of top-level wargear bullets
   *  (see parseRoster.ts), and for a unit with no declared valid sizes
   *  at all (most single-model characters, e.g. Captain in Phobos
   *  Armour) that sum is frequently just "how many wargear options this
   *  model has," not a model count at all -- trusting it there would
   *  silently arm a whole extra-model formation for what should be one
   *  character. Absent, invalid, or not a real option: falls through to
   *  the same 0/1/many logic as picking from the plain dropdown.
   *
   *  `fromRoster` distinguishes "armed by tapping a roster line" from
   *  "armed by picking from the plain dropdown or a template/base
   *  button" -- carried onto the resulting Armed value so
   *  DeploymentView's placement handler knows to automatically un-arm
   *  after ONE successful placement made this way (see handleBoardClick).
   *  A roster line means "place this one unit," not "keep placing copies
   *  of it" -- staying armed there just makes an imprecise click near an
   *  already-placed model much more likely to be read as "place another
   *  one right here" instead of "drag that model," which reads as
   *  dragging having silently stopped working. The plain dropdown/manual
   *  template-button path is untouched: staying armed there for rapid
   *  repeat placement of the same generic unit remains exactly as
   *  before. */
  const selectAndArmUnit = (nextId: string | null, preferredModelCount?: number, fromRoster?: boolean) => {
    onSelectedUnitChange(nextId);
    const nextUnit = nextId ? getUnitById(nextId) : null;
    if (!nextUnit) {
      onArm(null);
      return;
    }
    const templates = templatesForUnit(nextUnit);
    const preferred =
      preferredModelCount !== undefined && nextUnit.validSquadSizes?.includes(preferredModelCount)
        ? templates.find((t) => t.modelCount === preferredModelCount)
        : undefined;
    // If this unit doesn't actually offer a choice -- no formation
    // templates apply at all (a lone-model unit like a Dreadnought,
    // which only ever places as a single base), or exactly one does
    // (e.g. Iron Priest, which only ever comes as 1 model) -- there's
    // nothing to pick, so arm that one option immediately rather than
    // making the person click it separately right after selecting the
    // unit.
    if (preferred) {
      onArm({ type: "unit", id: preferred.id, fromRoster });
    } else if (templates.length === 0) {
      onArm({ type: "base", id: nextUnit.baseTemplateId, fromRoster });
    } else if (templates.length === 1) {
      onArm({ type: "unit", id: templates[0].id, fromRoster });
    } else {
      // real choice between formations (e.g. Hormagaunts: 10 or 20) --
      // whatever was armed under the old filter may not even be a valid
      // choice anymore, so clear rather than leave a stale/invisible
      // armed state
      onArm(null);
    }
  };

  // One row per roster LINE, not per distinct unit -- a roster can
  // genuinely list the same unit twice (two Iron Priests at different
  // point costs), and each needs its own checkbox. Matched to placement
  // by ordinal position: among the roster's entries for a given unit id,
  // the Nth one (0-indexed) is "deployed" once at least N+1 separate
  // placement instances of that unit exist on the board -- see
  // DeploymentView's placedGroupCountByUnitId for what counts as an
  // "instance" (one groupId, not one model).
  const rosterRows: { entry: MatchedRosterUnit; checked: boolean }[] = [];
  if (roster && roster.length > 0) {
    const seenSoFar = new Map<string, number>();
    for (const entry of roster) {
      const ordinal = seenSoFar.get(entry.unitId) ?? 0;
      seenSoFar.set(entry.unitId, ordinal + 1);
      const placedCount = placedCountByUnitId?.[entry.unitId] ?? 0;
      rosterRows.push({ entry, checked: ordinal < placedCount });
    }
  }
  const rosterCheckedCount = rosterRows.filter((r) => r.checked).length;
  // for the checklist hint text -- which unit id each unit id is
  // attached to/leads, by name lookup, not the raw id
  const bodyguardIdToLeaderId = new Map((attachments ?? []).map((a) => [a.bodyguardUnitId, a.leaderUnitId]));
  const leaderIdToBodyguardId = new Map((attachments ?? []).map((a) => [a.leaderUnitId, a.bodyguardUnitId]));

  return (
    <div
      style={{
        width: 232,
        flexShrink: 0,
        background: "var(--bg-panel)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: 16,
        maxHeight: "100%",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          padding: "10px 11px",
          marginBottom: 20,
          background: mode === "move" ? "var(--accent-dim)" : "var(--bg-panel-alt)",
          border: mode === "move" ? "1px solid var(--accent-border)" : "1px solid var(--border)",
          borderRadius: "var(--radius)",
        }}
      >
        <div className="eyebrow" style={{ marginBottom: 4 }}>
          {mode === "deploy" ? "Deployment phase" : "Turn 1 — movement"}
        </div>
        <p style={{ fontSize: 11.5, color: "var(--text-dim)", margin: "0 0 8px", lineHeight: 1.4 }}>
          {mode === "deploy"
            ? "Starting Turn 1 locks in current positions as everyone's movement origin and turns off new placement."
            : "Drag a token up to its Move distance from where it started this turn — the arrow shows how far."}
        </p>
        <button
          onClick={mode === "deploy" ? onStartTurn1 : onBackToDeployment}
          style={{
            width: "100%",
            padding: "9px 0",
            background: mode === "deploy" ? "var(--accent)" : "var(--bg-panel-alt)",
            color: mode === "deploy" ? "#1a1305" : "var(--text)",
            border: mode === "deploy" ? "none" : "1px solid var(--border-light)",
            borderRadius: "var(--radius)",
            fontFamily: "var(--font-display)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {mode === "deploy" ? "Begin Turn 1 →" : "← Back to Deployment"}
        </button>
      </div>

      {mode === "deploy" && (
        <>
          <Section label="Placing for">
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => onOwnerChange("red")}
                className={owner === "red" ? "bracket" : undefined}
                style={{
              flex: 1,
              padding: "9px 0",
              border: owner === "red" ? "1px solid #c96a5f" : "1px solid var(--border)",
              background: owner === "red" ? "rgba(158,7,14,0.28)" : "var(--bg-panel-alt)",
              color: "var(--text)",
              borderRadius: "var(--radius)",
              fontFamily: "var(--font-display)",
              fontSize: 13,
              fontWeight: owner === "red" ? 600 : 400,
              cursor: "pointer",
            }}
          >
            Attacker
          </button>
          <button
            onClick={() => onOwnerChange("blue")}
            className={owner === "blue" ? "bracket" : undefined}
            style={{
              flex: 1,
              padding: "9px 0",
              border: owner === "blue" ? "1px solid #4f83a8" : "1px solid var(--border)",
              background: owner === "blue" ? "rgba(41,90,123,0.38)" : "var(--bg-panel-alt)",
              color: "var(--text)",
              borderRadius: "var(--radius)",
              fontFamily: "var(--font-display)",
              fontSize: 13,
              fontWeight: owner === "blue" ? 600 : 400,
              cursor: "pointer",
            }}
          >
            Defender
          </button>
        </div>
      </Section>

      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 9,
          padding: "10px 11px",
          marginBottom: 20,
          background: "var(--bg-panel-alt)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={infiltrator}
          onChange={(e) => onInfiltratorChange(e.target.checked)}
          style={{ marginTop: 2 }}
        />
        <span>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600 }}>Infiltrators</div>
          <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 1, lineHeight: 1.4 }}>
            {infiltrator
              ? "Can deploy anywhere on the board."
              : "Must deploy fully inside your deployment zone."}
          </div>
        </span>
      </label>

      <Section label="Unit" hint="Locks base size to whatever that unit actually comes on.">
        <select
          value={selectedUnitId ?? ""}
          onChange={(e) => selectAndArmUnit(e.target.value || null)}
          style={{
            ...selectStyle,
            // tinted to match whichever side is currently "Placing for"
            // (same border colors as that toggle) -- this is what
            // actually would have made the "why is my whole roster
            // showing up" confusion obvious: a side with no army set
            // still shows its full unfiltered list (by design), but a
            // dropdown that suddenly looks like the OTHER side's color
            // is a much faster tell than the list contents alone.
            // Deliberately solid dark hex fills, not a translucent
            // overlay on the panel color -- a <select>'s own background
            // doesn't reliably composite against its DOM parent the same
            // way a plain <div> would across browsers, and a
            // semi-transparent fill risked landing lighter than expected
            // and washing out the light --text color on top of it.
            background: owner === "red" ? "#3a1a18" : "#152530",
            border: owner === "red" ? "1px solid #c96a5f" : "1px solid #4f83a8",
          }}
        >
          <option value="">Generic base (no unit)</option>
          {visibleUnits.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
              {u.faction ? ` — ${u.faction}` : ""}
            </option>
          ))}
        </select>
      </Section>

      {rosterRows.length > 0 && (
        <Section
          label="Roster"
          hint="Tap a line to arm that unit at the size it's actually listed at. Placing a Bodyguard places its attached Leader/Support with it automatically."
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>Deployed</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
              {rosterCheckedCount} / {rosterRows.length}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 260, overflowY: "auto" }}>
            {rosterRows.map(({ entry, checked }, i) => {
              const unit = getUnitById(entry.unitId);
              const isSelected = selectedUnitId === entry.unitId;
              const attachedLeaderId = bodyguardIdToLeaderId.get(entry.unitId);
              const attachedBodyguardId = leaderIdToBodyguardId.get(entry.unitId);
              const attachmentHint = attachedLeaderId
                ? `⤷ deploys with ${getUnitById(attachedLeaderId)?.name ?? attachedLeaderId}`
                : attachedBodyguardId
                  ? `⤷ attached to ${getUnitById(attachedBodyguardId)?.name ?? attachedBodyguardId}`
                  : null;
              return (
                <button
                  key={`${entry.unitId}-${i}`}
                  onClick={() => selectAndArmUnit(entry.unitId, entry.modelCount, true)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    padding: "6px 8px",
                    textAlign: "left",
                    background: isSelected ? "var(--bg-hover)" : "transparent",
                    border: isSelected ? "1px solid var(--accent-border)" : "1px solid transparent",
                    borderRadius: "var(--radius)",
                    cursor: "pointer",
                    color: "var(--text)",
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      marginTop: 1,
                      width: 14,
                      height: 14,
                      borderRadius: 3,
                      border: checked ? "none" : "1px solid var(--border-light)",
                      background: checked ? "var(--accent)" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      lineHeight: 1,
                      color: "#1a1305",
                    }}
                  >
                    {checked ? "✓" : ""}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: 12,
                          color: checked ? "var(--text-faint)" : "var(--text)",
                          textDecoration: checked ? "line-through" : "none",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={unit?.name ?? entry.unitId}
                      >
                        {unit?.name ?? entry.unitId}
                      </span>
                      {entry.points > 0 && (
                        <span style={{ flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-faint)" }}>
                          {entry.points}pts
                        </span>
                      )}
                    </span>
                    {attachmentHint && (
                      <span style={{ display: "block", fontSize: 10, color: "var(--text-faint)", marginTop: 1 }}>
                        {attachmentHint}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {visibleUnitTemplates.length > 0 && (
        <Section
          label="Unit templates"
          hint="One click places the whole unit in formation. Models stay independently draggable/rotatable/deletable."
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {visibleUnitTemplates.map((unit) => {
              const isArmed = armedEquals(armed, "unit", unit.id);
              return (
                <button
                  key={unit.id}
                  onClick={() => onArm(isArmed ? null : { type: "unit", id: unit.id })}
                  title={`${unit.label} (${unit.rows.join("+")})`}
                  className={isArmed ? "bracket" : undefined}
                  style={{ ...paletteButtonStyle(isArmed), width: CELL, height: CELL + 13, flexDirection: "column", padding: 0 }}
                >
                  <FormationIcon unit={unit} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-dim)" }}>
                    {unit.label}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      <Section
        label="Single base"
        hint="Click a size, then click the map. Click the armed one again to cancel."
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {visibleBaseTemplates.map((base) => {
            const isArmed = armedEquals(armed, "base", base.id);
            const [wIn, hIn] = baseFootprintIn(base);
            const iconPxPerIn = ICON_AREA / Math.max(wIn, hIn);
            return (
              <button
                key={base.id}
                onClick={() => onArm(isArmed ? null : { type: "base", id: base.id })}
                title={base.label}
                className={isArmed ? "bracket" : undefined}
                style={{ ...paletteButtonStyle(isArmed), width: CELL, height: CELL }}
              >
                <svg width={CELL - 12} height={CELL - 12}>
                  <Token
                    base={base}
                    pxPerIn={iconPxPerIn}
                    x={(CELL - 12) / 2}
                    y={(CELL - 12) / 2}
                    fill="var(--text-dim)"
                    imageSrc={selectedUnit?.baseTemplateId === base.id ? selectedUnit.imageSrc : undefined}
                  />
                </svg>
              </button>
            );
          })}
        </div>
      </Section>
        </>
      )}

      {selectedCount > 0 && (
        <div style={{ paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            {selectedCount === 1 ? "1 token selected" : `${selectedCount} tokens selected`}
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <button
              onClick={() => onRotateSelected(-15)}
              style={{
                flex: 1,
                padding: "7px 0",
                background: "var(--bg-panel-alt)",
                color: "var(--text)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              &#8634; 15&deg;
            </button>
            <button
              onClick={() => onRotateSelected(15)}
              style={{
                flex: 1,
                padding: "7px 0",
                background: "var(--bg-panel-alt)",
                color: "var(--text)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              &#8635; 15&deg;
            </button>
          </div>
          {mode === "move" && (
            <button
              onClick={onUndoLastLeg}
              disabled={!canUndoLastLeg}
              title={
                canUndoLastLeg
                  ? "Revert the selected token(s) to before their last completed leg"
                  : "Nothing to undo -- drag a selected token first"
              }
              style={{
                width: "100%",
                padding: "9px 0",
                marginBottom: 8,
                background: canUndoLastLeg ? "var(--bg-panel-alt)" : "var(--bg-panel)",
                color: canUndoLastLeg ? "var(--text)" : "var(--text-faint)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                cursor: canUndoLastLeg ? "pointer" : "not-allowed",
                fontFamily: "var(--font-display)",
                fontSize: 13,
              }}
            >
              &#8630; Undo last leg
            </button>
          )}
          <button
            onClick={onDeleteSelected}
            style={{
              width: "100%",
              padding: "9px 0",
              background: "var(--danger)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius)",
              cursor: "pointer",
              fontFamily: "var(--font-display)",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {selectedCount === 1 ? "Delete token" : `Delete ${selectedCount} tokens`}
          </button>
        </div>
      )}
    </div>
  );
}
