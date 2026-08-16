import type { MissionMap } from "./schema";

import { tahPaA } from "./tah_pa_a";
import { tahPaB } from "./tah_pa_b";
import { tahPaC } from "./tah_pa_c";
import { tahPurgeA } from "./tah_purge_a";
import { tahPurgeB } from "./tah_purge_b";
import { tahPurgeC } from "./tah_purge_c";
import { tahReconA } from "./tah_recon_a";
import { tahReconB } from "./tah_recon_b";
import { tahReconC } from "./tah_recon_c";
import { tahDisA } from "./tah_dis_a";
import { tahDisB } from "./tah_dis_b";
import { tahDisC } from "./tah_dis_c";
import { purgeMirrorA } from "./purge_mirror_a";
import { purgeMirrorB } from "./purge_mirror_b";
import { purgeMirrorC } from "./purge_mirror_c";
import { disMirrorA } from "./dis_mirror_a";
import { disMirrorB } from "./dis_mirror_b";
import { disMirrorC } from "./dis_mirror_c";
import { disPaA } from "./dis_pa_a";
import { disPaB } from "./dis_pa_b";
import { disPaC } from "./dis_pa_c";
import { disReconA } from "./dis_recon_a";
import { disReconB } from "./dis_recon_b";
import { disReconC } from "./dis_recon_c";
import { paMirrorA } from "./pa_mirror_a";
import { paMirrorB } from "./pa_mirror_b";
import { paMirrorC } from "./pa_mirror_c";
import { purgeDisA } from "./purge_dis_a";
import { purgeDisB } from "./purge_dis_b";
import { purgeDisC } from "./purge_dis_c";
import { purgePaA } from "./purge_pa_a";
import { purgePaB } from "./purge_pa_b";
import { purgePaC } from "./purge_pa_c";
import { purgeReconA } from "./purge_recon_a";
import { purgeReconB } from "./purge_recon_b";
import { purgeReconC } from "./purge_recon_c";
import { reconMirrorA } from "./recon_mirror_a";
import { reconMirrorB } from "./recon_mirror_b";
import { reconMirrorC } from "./recon_mirror_c";
import { reconPaA } from "./recon_pa_a";
import { reconPaB } from "./recon_pa_b";
import { reconPaC } from "./recon_pa_c";

export * from "./schema";

export const allMaps: MissionMap[] = [
  tahPaA,
  tahPaB,
  tahPaC,
  tahPurgeA,
  tahPurgeB,
  tahPurgeC,
  tahReconA,
  tahReconB,
  tahReconC,
  tahDisA,
  tahDisB,
  tahDisC,
  purgeMirrorA,
  purgeMirrorB,
  purgeMirrorC,
  disMirrorA,
  disMirrorB,
  disMirrorC,
  disPaA,
  disPaB,
  disPaC,
  disReconA,
  disReconB,
  disReconC,
  paMirrorA,
  paMirrorB,
  paMirrorC,
  purgeDisA,
  purgeDisB,
  purgeDisC,
  purgePaA,
  purgePaB,
  purgePaC,
  purgeReconA,
  purgeReconB,
  purgeReconC,
  reconMirrorA,
  reconMirrorB,
  reconMirrorC,
  reconPaA,
  reconPaB,
  reconPaC,
];

export const getMapById = (id: string): MissionMap | undefined =>
  allMaps.find((m) => m.id === id);

// Every map belonging to a given mission pack (see src/data/dispositions.ts
// for how a pair of player-chosen dispositions resolves to a prefix),
// sorted by layout letter (A/B/C) since insertion order in allMaps isn't guaranteed.
export const getMapsForPackPrefix = (prefix: string): MissionMap[] =>
  allMaps
    .filter((m) => m.id.startsWith(`${prefix}_`))
    .sort((a, b) => a.id.localeCompare(b.id));
