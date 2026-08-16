import { useState, useEffect } from "react";
import { MapLibrary } from "./components/MapLibrary/MapLibrary";
import { TokenLibrary } from "./components/TokenLibrary/TokenLibrary";
import { DispositionPicker } from "./components/DispositionPicker/DispositionPicker";
import { MissionMapPicker } from "./components/DispositionPicker/MissionMapPicker";
import { DeploymentView } from "./components/DeploymentView/DeploymentView";
import { getMapById } from "./data/maps";
import type { ParsedRosterForDeployment } from "./data/units/parseRoster";

type Tab = "deploy" | "browse" | "tokens";
type DeployStage =
  | { stage: "dispositions" }
  | {
      stage: "pickMap";
      prefix: string;
      yourDisp: string;
      oppDisp: string;
      yourArmy: string | null;
      oppArmy: string | null;
      yourRoster: ParsedRosterForDeployment | null;
      oppRoster: ParsedRosterForDeployment | null;
    }
  | {
      stage: "board";
      mapId: string;
      prefix: string;
      yourDisp: string;
      oppDisp: string;
      yourArmy: string | null;
      oppArmy: string | null;
      yourRoster: ParsedRosterForDeployment | null;
      oppRoster: ParsedRosterForDeployment | null;
    };

const TABS: [Tab, string][] = [
  ["deploy", "Deploy"],
  ["browse", "Browse Maps"],
  ["tokens", "Tokens"],
];

export default function App() {
  const [tab, setTab] = useState<Tab>("deploy");
  const [deployStage, setDeployStage] = useState<DeployStage>({ stage: "dispositions" });
  const [browseSelectedId, setBrowseSelectedId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // synced with the browser's own fullscreen state, not just our own click
  // handler -- the user can also exit via Esc or the browser's native UI,
  // and the button needs to reflect that rather than getting stuck showing
  // "exit fullscreen" after the browser already left it
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen().catch(() => {
        // some browsers/contexts (e.g. an embedded iframe without the
        // allowfullscreen attribute) reject this -- nothing more to do
        // than leave the button in its current (not-fullscreen) state
      });
    }
  };

  const header = (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 28,
        padding: "0 20px",
        height: 52,
        flexShrink: 0,
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-panel)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span
          style={{
            width: 9,
            height: 9,
            border: "2px solid var(--accent)",
            transform: "rotate(45deg)",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          Strat Deployer
        </span>
      </div>
      <nav style={{ display: "flex", gap: 2, height: "100%" }}>
        {TABS.map(([t, label]) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              if (t === "deploy") setDeployStage({ stage: "dispositions" });
              if (t === "browse") setBrowseSelectedId(null);
            }}
            style={{
              padding: "0 14px",
              height: "100%",
              border: "none",
              borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
              background: "transparent",
              color: tab === t ? "var(--text)" : "var(--text-dim)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: "pointer",
              transition: "color 120ms ease",
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <button
        onClick={toggleFullscreen}
        title={isFullscreen ? "Exit full screen" : "Enter full screen — more room for the board"}
        style={{
          marginLeft: "auto",
          width: 30,
          height: 30,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-panel-alt)",
          color: "var(--text-dim)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          cursor: "pointer",
          fontSize: 15,
          lineHeight: 1,
        }}
      >
        {isFullscreen ? (
          // exit fullscreen: arrows pointing inward toward center
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 3v4a2 2 0 0 1-2 2H3M15 3v4a2 2 0 0 0 2 2h4M9 21v-4a2 2 0 0 0-2-2H3M15 21v-4a2 2 0 0 1 2-2h4" />
          </svg>
        ) : (
          // enter fullscreen: arrows pointing outward toward corners
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9V5a2 2 0 0 1 2-2h4M15 3h4a2 2 0 0 1 2 2v4M21 15v4a2 2 0 0 1-2 2h-4M9 21H5a2 2 0 0 1-2-2v-4" />
          </svg>
        )}
      </button>
    </header>
  );

  const renderDeploy = () => {
    if (deployStage.stage === "dispositions") {
      return (
        <DispositionPicker
          onPackSelected={(prefix, yourDisp, oppDisp, yourArmy, oppArmy, yourRoster, oppRoster) =>
            setDeployStage({ stage: "pickMap", prefix, yourDisp, oppDisp, yourArmy, oppArmy, yourRoster, oppRoster })
          }
        />
      );
    }
    if (deployStage.stage === "pickMap") {
      const { prefix, yourDisp, oppDisp, yourArmy, oppArmy, yourRoster, oppRoster } = deployStage;
      return (
        <MissionMapPicker
          prefix={prefix}
          yourDisp={yourDisp}
          oppDisp={oppDisp}
          onSelect={(mapId) =>
            setDeployStage({ stage: "board", mapId, prefix, yourDisp, oppDisp, yourArmy, oppArmy, yourRoster, oppRoster })
          }
          onBack={() => setDeployStage({ stage: "dispositions" })}
        />
      );
    }
    const map = getMapById(deployStage.mapId);
    if (!map) return <p style={{ padding: 24 }}>Map not found.</p>;
    const { prefix, yourDisp, oppDisp, yourArmy, oppArmy, yourRoster, oppRoster } = deployStage;
    return (
      <DeploymentView
        map={map}
        onBack={() => setDeployStage({ stage: "pickMap", prefix, yourDisp, oppDisp, yourArmy, oppArmy, yourRoster, oppRoster })}
        armyByOwner={{ red: yourArmy, blue: oppArmy }}
        rosterByOwner={{ red: yourRoster, blue: oppRoster }}
      />
    );
  };

  const browseSelected = browseSelectedId ? getMapById(browseSelectedId) : undefined;
  // the interactive board manages its own internal space exactly (no
  // scrolling needed if sized right); other tabs may have more content
  // than fits and should scroll normally
  const isBoardView = (tab === "deploy" && deployStage.stage === "board") || (tab === "browse" && !!browseSelected);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {header}
      <div style={{ flex: "1 1 0%", minHeight: 0, overflow: isBoardView ? "hidden" : "auto" }}>
        {tab === "deploy" && renderDeploy()}
        {tab === "browse" &&
          (browseSelected ? (
            <DeploymentView map={browseSelected} onBack={() => setBrowseSelectedId(null)} backLabel="Back to library" />
          ) : (
            <MapLibrary onSelect={setBrowseSelectedId} />
          ))}
        {tab === "tokens" && <TokenLibrary />}
      </div>
    </div>
  );
}
