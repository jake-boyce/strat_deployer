import { getMapsForPackPrefix } from "../../data/maps";
import { getDispositionLabel } from "../../data/dispositions";
import { MapView } from "../MapView/MapView";
import { BACK_BTN_STYLE } from "../common";

export interface MissionMapPickerProps {
  prefix: string;
  yourDisp: string;
  oppDisp: string;
  onSelect: (mapId: string) => void;
  onBack: () => void;
}

export function MissionMapPicker({ prefix, yourDisp, oppDisp, onSelect, onBack }: MissionMapPickerProps) {
  const maps = getMapsForPackPrefix(prefix);

  return (
    <div style={{ padding: 24 }}>
      <button onClick={onBack} style={BACK_BTN_STYLE}>&larr; Change dispositions</button>
      <div className="eyebrow" style={{ marginTop: 18, marginBottom: 4 }}>
        Mission pack
      </div>
      <h2 style={{ fontSize: 20, marginBottom: 20 }}>
        {getDispositionLabel(yourDisp)} <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>vs</span>{" "}
        {getDispositionLabel(oppDisp)}
      </h2>
      {maps.length === 0 ? (
        <p style={{ color: "var(--text-dim)" }}>No maps found for this pack yet.</p>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
          {maps.map((map) => (
            <div key={map.id} onClick={() => onSelect(map.id)} className="map-card">
              <div
                className="eyebrow"
                style={{ marginBottom: 8, display: "flex", justifyContent: "space-between" }}
              >
                <span>{map.name}</span>
                {map.deploymentType && <span style={{ color: "var(--text-faint)" }}>{map.deploymentType}</span>}
              </div>
              <MapView map={map} thumbnail />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
