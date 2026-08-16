// "Disposition" here means a mission category a player brings to the game
// (Purge the Foe, Take and Hold, etc.) -- not to be confused with
// MissionMap.deploymentType (Dawn of War, Hammer and Anvil, etc.), which is
// the *deployment zone shape* a specific layout uses. Two players each pick
// a disposition; the pair determines which mission PACK applies (e.g.
// Purge the Foe + Take and Hold -> "TAH: Purge"), and each pack has 3
// layouts (A/B/C) to choose from.

export interface Disposition {
  id: string;
  label: string;
}

export const dispositions: Disposition[] = [
  { id: "purge", label: "Purge the Foe" },
  { id: "tah", label: "Take and Hold" },
  { id: "pa", label: "Priority Assets" },
  { id: "dis", label: "Disruption" },
  { id: "recon", label: "Reconnaissance" },
];

export const getDispositionLabel = (id: string): string =>
  dispositions.find((d) => d.id === id)?.label ?? id;

// Explicit pair -> manifest id prefix lookup. NOT alphabetically derivable
// from the two codes -- the manifest's existing naming isn't consistent
// about which disposition comes first (tah_purge, but purge_dis; purge_pa,
// but recon_pa) -- so this is a literal table, not a formula.
const PAIR_TO_PREFIX: Record<string, string> = {
  "dis|dis": "dis_mirror",
  "dis|pa": "dis_pa",
  "dis|purge": "purge_dis",
  "dis|recon": "dis_recon",
  "dis|tah": "tah_dis",
  "pa|pa": "pa_mirror",
  "pa|purge": "purge_pa",
  "pa|recon": "recon_pa",
  "pa|tah": "tah_pa",
  "purge|purge": "purge_mirror",
  "purge|recon": "purge_recon",
  "purge|tah": "tah_purge",
  "recon|recon": "recon_mirror",
  "recon|tah": "tah_recon",
  // "tah|tah" intentionally has no entry: no such mission pack exists in
  // this dataset. Take and Hold has no self-mirror.
};

/** Given two disposition ids (order doesn't matter), return the manifest id
 *  prefix for the matching mission pack, or null if no pack exists for
 *  that pairing (currently only Take and Hold vs itself). */
export function getMapPackPrefix(dispA: string, dispB: string): string | null {
  const [a, b] = [dispA, dispB].sort();
  return PAIR_TO_PREFIX[`${a}|${b}`] ?? null;
}
