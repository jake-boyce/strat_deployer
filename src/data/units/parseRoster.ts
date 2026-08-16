import { units } from "./units";

export interface ParsedRosterEntry {
  /** The extracted unit-name text, after cleanup -- kept even when
   *  unmatched so the UI can show the person exactly what wasn't
   *  recognized, rather than a silent gap. */
  raw: string;
  points: number;
  /** Matched Unit id, or null if nothing in the roster matched this
   *  entry's name (could be a typo, an allied/other-faction unit, or one
   *  of the Hull/Unique Space Marines units this app doesn't model yet
   *  -- see the TODO in units.ts). */
  unitId: string | null;
  /** Best-effort model count for this specific entry, summed from its
   *  own top-level "Nx <model type>" bullets (e.g. "1x Eliminator
   *  Sergeant" + "2x Eliminator" -> 3) -- undefined if none were found.
   *  Deliberately NOT validated against the unit's actual valid squad
   *  sizes here (that needs unitTemplates data this file doesn't import,
   *  and belongs with whatever's about to USE the number) -- a consumer
   *  should treat this as a hint to check against real options, not a
   *  guaranteed-correct value. A datasheet that lists the same models
   *  under two aspects (Wolf Guard Headtakers' "3x Wolf Guard
   *  Headtaker" + "3x Hunting Wolves" mounts) is handled correctly as
   *  long as both are modeled as separate Unit entries following the
   *  "<Parent>: <Companion>" naming convention -- see
   *  companionsForUnit -- since the companion's own bullet gets split
   *  into its own entry instead of summed in here. Only genuinely
   *  unmodeled dual-aspect datasheets (none currently in units.ts) would
   *  still over-count. */
  modelCount?: number;
}

export interface ParsedRoster {
  /** Every entry found, matched or not, in the order they appeared. */
  entries: ParsedRosterEntry[];
  /** Unique matched unit ids, in first-seen order -- this is what
   *  actually drives the palette filter. */
  matchedUnitIds: string[];
  /** Raw name text for entries that didn't match anything, for a "these
   *  weren't recognized" hint in the UI. */
  unmatched: string[];
  /** Leader/Support characters paired with the unit they're attached to
   *  (see ATTACHMENT_TAG_PATTERN below for where this comes from in the
   *  export). Only includes pairs where BOTH sides matched a real unit
   *  in this app's roster -- an attachment to/from an unrecognized name
   *  can't be acted on, so it's just dropped rather than carried as a
   *  half-known relationship. */
  attachments: RosterAttachment[];
}

/** A Leader or Support character paired with the unit it's attached to,
 *  straight from what the roster export itself already declares (see
 *  "Attached as: Leader/Support/Bodyguard" in a NewRecruit-style export)
 *  -- deliberately NOT inferred from general 40k attachment-eligibility
 *  rules (which character can lead which unit), since this app doesn't
 *  have that rules data and getting it wrong would be worse than not
 *  having the feature. Reading it straight from the person's own roster
 *  is both simpler and correct FOR THEIR LIST specifically, even without
 *  knowing the general rule. */
export interface RosterAttachment {
  leaderUnitId: string;
  bodyguardUnitId: string;
}

/** A single matched roster line, kept separate from ParsedRosterEntry so
 *  downstream consumers (the deployment checklist) get a type that's
 *  guaranteed to have a real unitId, not string | null. Deliberately NOT
 *  deduplicated the way matchedUnitIds is -- a roster can genuinely list
 *  the same unit twice (two Iron Priests at different point costs is a
 *  completely normal thing to see), and the deployment checklist needs
 *  one row per actual entry to track each instance's placement
 *  separately, not one row per distinct unit. */
export interface MatchedRosterUnit {
  unitId: string;
  points: number;
  /** See ParsedRosterEntry.modelCount -- same caveats apply (best-effort,
   *  unvalidated, wrong for dual-profile datasheets). */
  modelCount?: number;
}

/** Everything DeploymentView needs from a parsed roster, bundled as one
 *  value so it's one thing to thread through DispositionPicker ->
 *  App.tsx -> DeploymentView -> TokenPalette instead of two separately-
 *  shaped props that have to stay in sync. */
export interface ParsedRosterForDeployment {
  units: MatchedRosterUnit[];
  attachments: RosterAttachment[];
}

/** Every matched entry from a parsed roster, in original order, with
 *  duplicates intact -- see MatchedRosterUnit for why this differs from
 *  matchedUnitIds. */
export function matchedRosterUnits(parsed: ParsedRoster): MatchedRosterUnit[] {
  return parsed.entries
    .filter((e): e is ParsedRosterEntry & { unitId: string } => e.unitId !== null)
    .map((e) => ({ unitId: e.unitId, points: e.points, modelCount: e.modelCount }));
}

/** Bundles matchedRosterUnits + attachments for handing to DeploymentView
 *  in one piece. Returns null when there's nothing matched at all --
 *  callers use that (rather than an object with an empty units array) as
 *  "no roster was effectively given," this project's standing convention
 *  (see DispositionPicker). */
export function rosterForDeployment(parsed: ParsedRoster): ParsedRosterForDeployment | null {
  const rosterUnits = matchedRosterUnits(parsed);
  if (rosterUnits.length === 0) return null;
  return { units: rosterUnits, attachments: parsed.attachments };
}

// Roster-list exports (NewRecruit, the GW app, BattleScribe, etc.) print
// a unit's cost as "(N Points)" right after its name, and nothing else in
// the export uses that exact "digit(s) + Points" shape -- wargear lines
// don't carry a point cost, enhancement lines don't, and detachment-level
// text ("3 Detachment Points") always has extra words between the number
// and "Points" that this pattern doesn't allow. That makes it a reliable
// anchor: every real match is a genuine per-unit cost, and nothing else
// in a normal export accidentally matches it.
const UNIT_COST_PATTERN = /\(\s*([\d,]+)\s*points?\s*\)/gi;

// A roster header/total is also written as "(N Points)" (e.g. "Strike
// Force (2,000 Points)", "2K - Dreadshroff (2,000 Points)") and would
// otherwise be picked up by the same pattern above. Real single-unit
// costs in current-edition 40k top out well under this in practice (the
// priciest superheavies are a few hundred), while roster/detachment
// totals are conventionally round numbers at or above it -- so treat
// anything this large as list-level noise, not a unit, rather than
// trying to name-match whatever text happens to precede it.
const LIKELY_TOTAL_POINTS_THRESHOLD = 1000;

// Section headers and connective phrases these exports use that carry no
// unit-name information themselves, but that can end up glued directly
// onto the next real unit's name with zero separating whitespace if the
// person copied the roster out of a rendered PDF (a common way line
// breaks get silently dropped on copy). Replaced with a control character
// (never legitimately present in roster text) rather than a space, so
// later parsing can tell "a real explicit break was here" apart from "two
// words that happen to be adjacent" -- see extractUnitName below.
const NOISE_PATTERNS: RegExp[] = [
  /ATTACHED UNITS/g,
  /OTHER DATASHEETS/g,
  /ALLIED UNITS/g,
  /UNASSIGNED UNITS/g,
  /CONFIGURATION/g,
  /CHARACTERS/g,
  /Attached unit \d+/gi,
  /Exported with App Version:.*$/is,
];

// Two distinct control characters rather than one: exports nest content
// two levels deep under a unit ("•" for a model-type line like "1x
// Eliminator Sergeant", "◦" for that model's own wargear options like
// "1x Bolt pistol" underneath it) and telling those apart matters for
// model-count extraction below -- summing every "Nx ..." bullet
// regardless of nesting would double-count a squad's weapon options
// as if they were more models. Neither character is ever legitimately
// present in roster text otherwise.
const BREAK_TOP = "\u0001";
const BREAK_SUB = "\u0002";
const ANY_BREAK = /[\u0001\u0002]/;

// NewRecruit-style exports tag each half of an attached pairing right
// after its own cost parenthetical, as the first bullet: "Attached as:
// Leader (Character)" / "Attached as: Support (Character)" for the
// character, "Attached as: Bodyguard ()" for the unit it joins. Always
// the FIRST thing after an entry's own "(N Points)", before any of that
// entry's own wargear -- which is exactly what makes it findable: peek
// from right after a match to the next BREAK (the next bullet or line
// break) and test against this.
const ATTACHMENT_TAG_PATTERN = /^Attached as:\s*(Leader|Support|Bodyguard)\b/i;

// A top-level "Nx <model type>" bullet, e.g. "1x Eliminator Sergeant" or
// "2x Eliminator" -- summed (per entry, top-level bullets only) to guess
// that entry's actual squad size. See ParsedRosterEntry.modelCount for
// the known limitation with dual-profile datasheets.
const MODEL_COUNT_LINE_PATTERN = /^(\d+)\s*[x×]\s+/i;

/** Splits a zone of cleaned roster text into its bullet segments, each
 *  tagged with whether it was a top-level ("•") or nested ("◦") bullet
 *  -- determined by whether a BREAK_SUB appears anywhere in the run of
 *  break characters immediately preceding it, since a real line break
 *  and its own bullet marker often land as two (or more) consecutive
 *  break characters, not one, and a plain "did the LAST break equal
 *  BREAK_SUB" check would miss that. The first segment (before any
 *  break at all -- leftover content from whatever preceded this zone)
 *  is discarded; every zone this is used on is the text strictly AFTER
 *  a unit's own cost match, which always starts with at least one
 *  break of its own. */
function splitBulletSegments(zone: string): { text: string; nested: boolean }[] {
  const parts = zone.split(/([\u0001\u0002]+)/);
  const segments: { text: string; nested: boolean }[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const breakRun = parts[i];
    const text = (parts[i + 1] ?? "").trim();
    if (text) segments.push({ text, nested: breakRun.includes(BREAK_SUB) });
  }
  return segments;
}

/** Pulls the real unit-name text out of everything between the end of
 *  the previous unit's cost parenthetical and the start of this one --
 *  which, for every unit after the first, starts with the PREVIOUS
 *  unit's trailing wargear/enhancement bullets. Two layers of defense
 *  against that:
 *  1. Any explicit break we know about (a real line break, a bullet
 *     marker, or one of the stripped section headers/"Attached unit N"
 *     phrases) got marked with BREAK earlier -- take everything after
 *     the LAST one, since the true name is always the last thing before
 *     the cost parenthetical.
 *  2. If the export's line breaks were dropped entirely on copy (no
 *     BREAK survives at the actual boundary -- confirmed to happen when
 *     copying out of a rendered PDF), the previous unit's last wargear
 *     word ends up glued straight onto this unit's name with no
 *     separator at all, e.g. "carbineEliminator Squad". Real multi-word
 *     unit names are always space-separated, so an uppercase letter
 *     glued flush against a lowercase letter, digit, or closing bracket
 *     (e.g. "...Support (Character)Incursor Squad", right after the
 *     closing paren) never happens *within* a genuine name -- only at a
 *     glued join. Deliberately NOT triggering on a hyphen or apostrophe
 *     immediately before an uppercase letter, though -- those genuinely
 *     occur inside real names ("Fell-Handed"), so treating them as glue
 *     would wrongly slice a real name in half. Cutting at the LAST
 *     genuine-glue transition recovers the name even with zero
 *     surviving whitespace. */
function extractUnitName(zone: string): string {
  let lastBreak = -1;
  for (let i = zone.length - 1; i >= 0; i--) {
    if (ANY_BREAK.test(zone[i])) {
      lastBreak = i;
      break;
    }
  }
  const afterLastBreak = zone.slice(lastBreak + 1);
  let cut = -1;
  for (let i = 0; i < afterLastBreak.length - 1; i++) {
    if (/[a-z0-9)\]}]/.test(afterLastBreak[i]) && /[A-Z]/.test(afterLastBreak[i + 1])) {
      cut = i + 1;
    }
  }
  const candidate = cut >= 0 ? afterLastBreak.slice(cut) : afterLastBreak;
  return candidate.trim();
}

function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function matchUnitName(name: string): string | null {
  const target = normalizeForMatch(name);
  return units.find((u) => normalizeForMatch(u.name) === target)?.id ?? null;
}

/** Some datasheets are modeled in units.ts as TWO separate Unit entries
 *  sharing a naming convention -- "Wolf Guard Headtakers" (the riders,
 *  on their own base) and "Wolf Guard Headtakers: Hunting Wolves" (their
 *  mounts, on a completely different 60x35.5mm oval base) are two real,
 *  independently-placeable things, not one unit counted twice. A roster
 *  export lists them as sub-bullets under the SAME parent line ("3x Wolf
 *  Guard Headtaker" + "3x Hunting Wolves" both under "Wolf Guard
 *  Headtakers (115 Points)"), which is exactly what used to make this
 *  sum into one wrong, doubled model count for the parent (see the
 *  historical note on ParsedRosterEntry.modelCount). Detecting the
 *  companion by name -- anything in the roster whose name is
 *  `${parent.name}: <something>` -- lets the parser split it into its
 *  OWN separate entry instead, matching how the app already models the
 *  two as genuinely different placeable units. Generic on purpose: this
 *  isn't hardcoded to Wolf Guard Headtakers specifically, so it also
 *  covers Wolf Scouts/Wolf Scouts: Hunting Wolves and any future unit
 *  added with the same naming convention, with no parser changes needed. */
function companionsForUnit(parentUnitId: string): { suffix: string; unitId: string }[] {
  const parent = units.find((u) => u.id === parentUnitId);
  if (!parent) return [];
  const prefix = `${parent.name}: `;
  return units.filter((u) => u.name.startsWith(prefix)).map((u) => ({ suffix: u.name.slice(prefix.length), unitId: u.id }));
}

// Some exports abbreviate multiple copies of the same unit onto ONE line
// ("2x Incursor Squad (170 Points)") rather than repeating a full block
// per copy -- both are real, seen formats, and treating every roster
// line as exactly one unit (as this parser originally did) turned "2x
// Incursor Squad" into a single unmatched entry instead of two matched
// ones, silently losing a whole unit from the deployment checklist and
// from the palette filter. Capped at a sane maximum so a stray leading
// number that isn't actually a quantity prefix (nothing in this roster
// concept should ever hit this, but better an obviously-wrong short list
// than a UI flooded by a mis-parse) doesn't explode the entry count.
const MAX_QUANTITY_PREFIX = 20;

/** Splits a leading "Nx " / "N x " quantity prefix off a unit name, if
 *  present. The point cost on a line like this is the TOTAL for all N
 *  copies, not one -- divided back out per instance here so each
 *  resulting entry's `points` matches what a single copy would cost on
 *  its own line. 40k costs are round numbers by design, so this divides
 *  evenly in every real case checked; an uneven total would just make
 *  the displayed per-instance cost slightly off, which doesn't affect
 *  matching or placement tracking either way. */
function splitQuantityPrefix(name: string, totalPoints: number): { count: number; name: string; pointsEach: number } {
  const m = /^(\d+)\s*[x×]\s*(.+)$/i.exec(name);
  if (!m) return { count: 1, name, pointsEach: totalPoints };
  const count = Math.min(parseInt(m[1], 10), MAX_QUANTITY_PREFIX);
  if (count < 1) return { count: 1, name, pointsEach: totalPoints };
  return { count, name: m[2].trim(), pointsEach: totalPoints / count };
}

/** Parses a pasted army-list export into unit entries matched against
 *  this app's roster. Tolerant of the export's line breaks having been
 *  fully stripped on copy (see extractUnitName) -- a plain paste with
 *  real newlines intact works too, since a genuine newline gets marked
 *  as a break the same as everything else. */
export function parseRosterText(text: string): ParsedRoster {
  let cleaned = text;
  for (const pattern of NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, BREAK_TOP);
  }
  // "•" (model-type / top-level wargear lines) and "◦" (that model's own
  // wargear options, nested one level deeper) are DELIBERATELY marked
  // differently -- see splitBulletSegments
  cleaned = cleaned.replace(/•/g, BREAK_TOP);
  cleaned = cleaned.replace(/◦/g, BREAK_SUB);
  // any whitespace run that contains a real line break is a genuine,
  // still-intact break in the original export -- mark it explicitly
  // rather than just collapsing it, so extractUnitName/splitBulletSegments
  // can find it. Marked as BREAK_TOP by default: a bare line break with
  // no bullet at all only ever occurs at an unambiguously top-level
  // boundary (a new unit's name, a section header) in every export
  // format seen -- and when a line break precedes an actual "◦", that
  // bullet's own BREAK_SUB immediately follows it, so the run as a whole
  // still correctly reads as "nested" wherever splitBulletSegments checks
  // for BREAK_SUB anywhere in a run rather than only its last character.
  cleaned = cleaned.replace(/[^\S\n]*\n[^\S\n]*/g, BREAK_TOP);
  // whatever whitespace remains is just normal in-line spacing
  cleaned = cleaned.replace(/[^\S\n]+/g, " ");

  const entries: ParsedRosterEntry[] = [];
  const attachments: RosterAttachment[] = [];
  // The most recent Leader/Support character seen that hasn't been paired
  // with a Bodyguard yet -- exports list them as character-then-unit, so
  // pairing "whatever Leader/Support came most recently" with "the next
  // Bodyguard we see" matches the actual format rather than needing to
  // understand the "Attached unit N" grouping explicitly.
  let pendingLeaderUnitId: string | null = null;
  let lastEnd = 0;
  let match: RegExpExecArray | null;
  UNIT_COST_PATTERN.lastIndex = 0;
  while ((match = UNIT_COST_PATTERN.exec(cleaned)) !== null) {
    const points = parseInt(match[1].replace(/,/g, ""), 10);
    const zone = cleaned.slice(lastEnd, match.index);
    const afterMatchEnd = UNIT_COST_PATTERN.lastIndex;
    lastEnd = afterMatchEnd;
    if (points >= LIKELY_TOTAL_POINTS_THRESHOLD) continue; // roster/detachment total, not a unit
    const name = extractUnitName(zone);
    if (!name) continue;
    const { count, name: cleanName, pointsEach } = splitQuantityPrefix(name, points);
    const unitId = matchUnitName(cleanName);

    // this entry's OWN trailing content -- its attachment tag and its
    // model-count bullets both live here, ending wherever the NEXT
    // entry's cost anchor starts (or end of string, for the last entry)
    UNIT_COST_PATTERN.lastIndex = afterMatchEnd;
    const peekNext = UNIT_COST_PATTERN.exec(cleaned);
    UNIT_COST_PATTERN.lastIndex = afterMatchEnd; // restore -- this was just a peek
    const ownZoneEnd = peekNext ? peekNext.index : cleaned.length;
    const ownSegments = splitBulletSegments(cleaned.slice(afterMatchEnd, ownZoneEnd));

    const tagMatch = ownSegments[0] && !ownSegments[0].nested ? ATTACHMENT_TAG_PATTERN.exec(ownSegments[0].text) : null;
    const tag = tagMatch?.[1]?.toLowerCase();
    if ((tag === "leader" || tag === "support") && unitId) {
      pendingLeaderUnitId = unitId;
    } else if (tag === "bodyguard" && unitId) {
      if (pendingLeaderUnitId) {
        attachments.push({ leaderUnitId: pendingLeaderUnitId, bodyguardUnitId: unitId });
      }
      pendingLeaderUnitId = null;
    }

    // sum every top-level "Nx <model type>" bullet -- see
    // ParsedRosterEntry.modelCount for what this does and doesn't get
    // right. A bullet matching a known companion unit's name (e.g.
    // "Hunting Wolves" under "Wolf Guard Headtakers") is split into its
    // OWN separate count instead of being folded into this unit's --
    // see companionsForUnit.
    const companions = unitId ? companionsForUnit(unitId) : [];
    let modelCount: number | undefined;
    const companionCounts = new Map<string, number>();
    for (const seg of ownSegments) {
      if (seg.nested) continue;
      const m = MODEL_COUNT_LINE_PATTERN.exec(seg.text);
      if (!m) continue;
      const num = parseInt(m[1], 10);
      const restOfLine = seg.text.slice(m[0].length).trim();
      const companion = companions.find((c) => normalizeForMatch(c.suffix) === normalizeForMatch(restOfLine));
      if (companion) {
        companionCounts.set(companion.unitId, (companionCounts.get(companion.unitId) ?? 0) + num);
      } else {
        modelCount = (modelCount ?? 0) + num;
      }
    }

    for (let i = 0; i < count; i++) {
      entries.push({ raw: cleanName, points: pointsEach, unitId, modelCount });
      for (const [companionUnitId, companionCount] of companionCounts) {
        const companionUnit = units.find((u) => u.id === companionUnitId);
        // No separate point cost is ever printed for the companion --
        // it's bundled into the parent's own line -- so it's left at 0
        // rather than guessed at; the roster checklist just doesn't show
        // a points figure for a 0-point entry.
        entries.push({
          raw: companionUnit?.name ?? companionUnitId,
          points: 0,
          unitId: companionUnitId,
          modelCount: companionCount,
        });
      }
    }
  }

  const matchedUnitIds = Array.from(new Set(entries.map((e) => e.unitId).filter((id): id is string => !!id)));
  const unmatched = entries.filter((e) => !e.unitId).map((e) => e.raw);
  return { entries, matchedUnitIds, unmatched, attachments };
}
