import { allMaps } from "../../data/maps";
import { MapView } from "../MapView/MapView";

export interface MapLibraryProps {
  onSelect: (mapId: string) => void;
}

export function MapLibrary({ onSelect }: MapLibraryProps) {
  return (
    <div style={{ padding: 24 }}>
      <div className="eyebrow" style={{ marginBottom: 4 }}>
        All maps
      </div>
      <h2 style={{ fontSize: 20, marginBottom: 20 }}>{allMaps.length} layouts</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
        {allMaps.map((map) => (
          <div key={map.id} onClick={() => onSelect(map.id)} className="map-card">
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600 }}>{map.name}</div>
              <div className="eyebrow" style={{ marginTop: 2 }}>
                {map.missionPack}
                {map.deploymentType ? ` · ${map.deploymentType}` : ""}
              </div>
            </div>
            <MapView map={map} thumbnail />
          </div>
        ))}
      </div>
    </div>
  );
}
