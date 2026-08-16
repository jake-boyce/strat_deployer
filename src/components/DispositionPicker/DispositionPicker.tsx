import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { dispositions, getMapPackPrefix } from "../../data/dispositions";
import { factions } from "../../data/units/units";
import { parseRosterText, rosterForDeployment, type ParsedRosterForDeployment } from "../../data/units/parseRoster";

export interface DispositionPickerProps {
  onPackSelected: (
    prefix: string,
    yourDisp: string,
    oppDisp: string,
    yourArmy: string | null,
    oppArmy: string | null,
    yourRoster: ParsedRosterForDeployment | null,
    oppRoster: ParsedRosterForDeployment | null
  ) => void;
}

/** null means "Any army" -- no filtering, every unit in the roster stays
 *  available in the palette. This is the default so the army selector is
 *  purely additive: skipping it entirely reproduces the old behavior. */
const ANY_ARMY = null;

function DispositionColumn({
  eyebrow,
  value,
  onChange,
  otherSideValue,
  accentColor,
}: {
  eyebrow: string;
  value: string | null;
  onChange: (id: string) => void;
  otherSideValue: string | null;
  accentColor: string;
}) {
  return (
    <div style={{ flex: 1, minWidth: 260 }}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>
        {eyebrow}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {dispositions.map((d) => {
          // Take and Hold has no self-mirror pack -- don't let both sides
          // pick it, rather than silently failing after the fact
          const disabled = d.id === "tah" && otherSideValue === "tah";
          const selected = value === d.id;
          return (
            <button
              key={d.id}
              disabled={disabled}
              onClick={() => onChange(d.id)}
              className={selected ? "bracket" : undefined}
              style={{
                textAlign: "left",
                padding: "12px 14px",
                borderRadius: "var(--radius)",
                border: selected ? `1px solid ${accentColor}` : "1px solid var(--border)",
                background: selected ? "var(--bg-hover)" : disabled ? "var(--bg-panel)" : "var(--bg-panel-alt)",
                fontFamily: "var(--font-display)",
                fontSize: 14,
                fontWeight: selected ? 600 : 400,
                cursor: disabled ? "not-allowed" : "pointer",
                color: disabled ? "var(--text-faint)" : "var(--text)",
                transition: "background 100ms ease, border-color 100ms ease",
              }}
            >
              {d.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ArmyColumn({
  eyebrow,
  value,
  onChange,
  accentColor,
}: {
  eyebrow: string;
  value: string | null;
  onChange: (id: string | null) => void;
  accentColor: string;
}) {
  const options: (string | null)[] = [ANY_ARMY, ...factions];
  return (
    <div style={{ flex: 1, minWidth: 260 }}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>
        {eyebrow}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {options.map((army) => {
          const selected = value === army;
          return (
            <button
              key={army ?? "any"}
              onClick={() => onChange(army)}
              className={selected ? "bracket" : undefined}
              style={{
                textAlign: "left",
                padding: "12px 14px",
                borderRadius: "var(--radius)",
                border: selected ? `1px solid ${accentColor}` : "1px solid var(--border)",
                background: selected ? "var(--bg-hover)" : "var(--bg-panel-alt)",
                fontFamily: "var(--font-display)",
                fontSize: 14,
                fontWeight: selected ? 600 : 400,
                cursor: "pointer",
                color: "var(--text)",
                transition: "background 100ms ease, border-color 100ms ease",
              }}
            >
              {army ?? "Any army"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const textareaStyle: CSSProperties = {
  width: "100%",
  minHeight: 110,
  padding: "10px 12px",
  background: "var(--bg-panel-alt)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  lineHeight: 1.5,
  resize: "vertical",
};

function RosterColumn({
  eyebrow,
  text,
  onTextChange,
  accentColor,
}: {
  eyebrow: string;
  text: string;
  onTextChange: (text: string) => void;
  accentColor: string;
}) {
  // Parsed live as the person types/pastes -- cheap enough at this scale
  // (a roster is at most a couple hundred lines) that there's no reason
  // to debounce it.
  const parsed = useMemo(() => parseRosterText(text), [text]);
  const hasText = text.trim().length > 0;
  return (
    <div style={{ flex: 1, minWidth: 260 }}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>
        {eyebrow}
      </div>
      <textarea
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Paste an exported roster (NewRecruit, the GW app, etc.) here, or leave blank to use the full army."
        style={{ ...textareaStyle, borderColor: hasText ? accentColor : "var(--border)" }}
      />
      {hasText && (
        <div style={{ marginTop: 6, fontSize: 11.5, lineHeight: 1.4 }}>
          {parsed.matchedUnitIds.length > 0 ? (
            <span style={{ color: "var(--text-dim)" }}>
              {parsed.matchedUnitIds.length} unit{parsed.matchedUnitIds.length === 1 ? "" : "s"} recognized
            </span>
          ) : (
            <span style={{ color: "var(--danger-strong)" }}>
              Nothing recognized -- check the paste, or clear it to use the full army instead.
            </span>
          )}
          {parsed.unmatched.length > 0 && (
            <div style={{ color: "var(--text-faint)", marginTop: 2 }}>
              Not recognized: {parsed.unmatched.join(", ")}
            </div>
          )}
          <button
            onClick={() => onTextChange("")}
            style={{
              marginTop: 6,
              padding: "3px 9px",
              background: "transparent",
              color: "var(--text-dim)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

export function DispositionPicker({ onPackSelected }: DispositionPickerProps) {
  const [yourDisp, setYourDisp] = useState<string | null>(null);
  const [oppDisp, setOppDisp] = useState<string | null>(null);
  const [yourArmy, setYourArmy] = useState<string | null>(ANY_ARMY);
  const [oppArmy, setOppArmy] = useState<string | null>(ANY_ARMY);
  const [yourRosterText, setYourRosterText] = useState("");
  const [oppRosterText, setOppRosterText] = useState("");

  const prefix = yourDisp && oppDisp ? getMapPackPrefix(yourDisp, oppDisp) : null;
  const bothTah = yourDisp === "tah" && oppDisp === "tah";

  return (
    <div style={{ padding: "36px 24px", maxWidth: 760, margin: "0 auto" }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>
        Mission setup
      </div>
      <h2 style={{ fontSize: 22, marginBottom: 28 }}>Select each side's disposition</h2>

      <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
        <DispositionColumn
          eyebrow="Attacker — you"
          value={yourDisp}
          onChange={setYourDisp}
          otherSideValue={oppDisp}
          accentColor="#c96a5f"
        />
        <DispositionColumn
          eyebrow="Defender — opponent"
          value={oppDisp}
          onChange={setOppDisp}
          otherSideValue={yourDisp}
          accentColor="#4f83a8"
        />
      </div>

      <div className="eyebrow" style={{ marginTop: 32, marginBottom: 6 }}>
        Army selection
      </div>
      <p style={{ fontSize: 11.5, color: "var(--text-faint)", margin: "0 0 12px", lineHeight: 1.4, maxWidth: 560 }}>
        Filters which units show up in each side's palette on the board. Doesn't affect which maps are
        available — leave on "Any army" to keep the full roster.
      </p>
      <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
        <ArmyColumn eyebrow="Attacker's army" value={yourArmy} onChange={setYourArmy} accentColor="#c96a5f" />
        <ArmyColumn eyebrow="Defender's army" value={oppArmy} onChange={setOppArmy} accentColor="#4f83a8" />
      </div>

      <div className="eyebrow" style={{ marginTop: 32, marginBottom: 6 }}>
        Roster (optional)
      </div>
      <p style={{ fontSize: 11.5, color: "var(--text-faint)", margin: "0 0 12px", lineHeight: 1.4, maxWidth: 560 }}>
        Paste a specific list to narrow the palette down further, to just what's actually in it — a
        subset of whatever the army selector above already allows. Leave blank to keep the full army.
      </p>
      <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
        <RosterColumn
          eyebrow="Attacker's roster"
          text={yourRosterText}
          onTextChange={setYourRosterText}
          accentColor="#c96a5f"
        />
        <RosterColumn
          eyebrow="Defender's roster"
          text={oppRosterText}
          onTextChange={setOppRosterText}
          accentColor="#4f83a8"
        />
      </div>

      <div style={{ marginTop: 32, minHeight: 44 }}>
        {yourDisp && oppDisp && (
          prefix ? (
            <button
              onClick={() => {
                const yourRoster = rosterForDeployment(parseRosterText(yourRosterText));
                const oppRoster = rosterForDeployment(parseRosterText(oppRosterText));
                onPackSelected(prefix, yourDisp, oppDisp, yourArmy, oppArmy, yourRoster, oppRoster);
              }}
              style={{
                padding: "12px 28px",
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "var(--font-display)",
                letterSpacing: "0.02em",
                background: "var(--accent)",
                color: "#1a1305",
                border: "none",
                borderRadius: "var(--radius)",
                cursor: "pointer",
              }}
            >
              Find maps &rarr;
            </button>
          ) : (
            <p style={{ color: "var(--danger-strong)", fontSize: 13, maxWidth: 480 }}>
              {bothTah
                ? "Take and Hold has no mirror match against itself — pick a different disposition for one side."
                : "No mission pack found for that combination."}
            </p>
          )
        )}
      </div>
    </div>
  );
}
