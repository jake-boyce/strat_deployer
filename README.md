# Strat Deployer

A library of Warhammer 40k 11th Edition mission maps, plus a deployment
practice tool: place army tokens on any map and save/reload the layout.

## Status

**v0.62 — imported every remaining army from the Base Size Guide: 748
units across 23 new factions (plus 49 more added to the existing
Tyranids faction), taking the roster from 172 units / 5 factions to 920
units / 28 factions.**

Verified the actual PDF page-by-page before parsing anything, rather
than trust the document's own table of contents -- its printed page
numbers turned out to be offset from (and occasionally slightly
inconsistent with) the PDF's real page indices, which cost real time
tracking down when a "page 78" reference didn't land where expected.
Settled it by extracting the first few lines of all 40 actual PDF pages
in one pass and matching each faction to its real page range directly
off the rendered heading text, which is exactly the same lesson the
Imperial Agents/Leagues of Votann import already learned about the
document dump vs. the live PDF -- applied here from the start instead of
re-discovering it.

Wrote a general two-column table parser (`pdftotext -layout` preserves
column alignment, so unit name vs. base size splits cleanly on runs of
2+ spaces) rather than transcribing ~900 lines by hand. The one real
wrinkle: a handful of entries wrap their name onto a second line with no
base-size column at all (e.g. "Masters of the Maelstrom: Garlon
Souleater, Garreon the Corpsemaster," continuing onto "Katar Garrix,
Captain Sargotta" on the next line) -- handled by treating any line with
no recognizable size pattern as a continuation of the previous entry's
name. Caught and fixed a real bug in that same pass before it shipped:
the first version doubled up the comma when the wrapped line's join
point already ended in one ("Corpsemaster,, Katar Garrix" instead of
"Corpsemaster, Katar Garrix") -- fixed by checking whether the
in-progress name already ends with a comma before deciding whether to
add another separator.

Same skip policy as every prior import, applied at real scale this time:
142 units skipped as "Hull" (no given hull dimensions) or "Unique" (the
guide's own designer's note says these don't fit a standard base at
all), plus -- new this round -- "Large Flying Base"/"Small Flying Base"
entries (a flying stand is a specific, differently-shaped mount, not a
circle/oval at some mm size; no dimension is given for these any more
than for Hull, so the same no-fabrication policy applies). Adeptus
Titanicus is skipped as a WHOLE FACTION, not added at all: all 4 of its
units (Reaver/Warbringer Nemesis/Warhound/Warlord Titans) are "Hull",
meaning the faction would have zero placeable units -- there's no value
in an empty entry sitting in the army selector. The full skip list, by
faction, is recorded directly in `units.ts` next to the import.

Added 6 new base templates the expanded roster needed: `base_120mm`,
`base_130mm`, `base_160mm` circles; `base_75x42mm`, `base_150x95mm`,
`base_170x109mm` ovals -- every other size across all 23 factions was
already covered by prior imports. A lightweight keyword-based heuristic
(same spirit as the Dreadnought-pattern judgment calls in the SM/SW
import) flagged 127 obvious vehicles (`isVehicle: true`) across the new
units by name pattern (Dreadnought/Tank/Walker/Rhino/Land Raider/
Gladiator/etc.) -- a best-effort pass, not a verified one, worth
double-checking against real datasheets if `isVehicle` accuracy matters
for a specific unit.

Verified directly, not just typechecked: `unitsForArmy()` correctly
resolves per-faction counts for all 28 factions with zero code changes
needed (it derives from `units.ts`, same as the last two imports);
`companionsForUnit()`'s "\<Parent\>: \<Companion\>" splitting works
immediately on a brand-new faction's units with zero code changes (spot
-checked with Adepta Sororitas's Aestred Thurga/Agathae Dolan pairing);
every one of the 920 total units resolves to a real base template; and
the full prior regression suite (attachments, quantity-prefix expansion,
Dreadnought/Fenrisian-Wolves squad sizes, the Wolf Guard Headtakers
companion split) still passes unchanged.

**v0.61 — fixed the owner-tinted Unit dropdown from v0.60 washing out
its own text: switched from a semi-transparent color overlay to a solid
dark fill.**

The v0.60 tint used `rgba(158,7,14,0.16)`/`rgba(41,90,123,0.2)`,
expecting it to composite against the dark panel behind the `<select>`
the same way it would on a plain `<div>`. A `<select>` element's own
background doesn't reliably composite against its DOM parent the same
way across browsers -- it's a form control with its own rendering quirks
-- and the result in practice landed lighter than intended, washing out
the light `--text` color on top of it. Switched to solid hex fills
(`#3a1a18` Attacker, `#152530` Defender) that don't depend on
compositing behavior at all -- verified directly with a computed-style
WCAG contrast check: both sides now measure ~12.6:1 (AA only requires
4.5:1 for normal text), and confirmed visually with a rendered
screenshot of the select box in both states.

**v0.60 — the "Unit" dropdown is now tinted red/blue to match whichever
side ("Placing for") is currently active, the same colors as that
toggle itself.**

Grew out of a real support case, not a bug: a person selected Leagues of
Votann as their army, placed a unit, then saw the Unit dropdown suddenly
showing every faction's roster and reasonably assumed something had
broken. It hadn't — Defender defaults to "Any army" unless explicitly
set, and they'd switched "Placing for" to Defender without realizing it.
Confirmed by directly tracing `armyFilter` through every render
(logged on each TokenPalette render across the whole interaction) and
finding it stayed exactly `"Leagues of Votann"` throughout — the app was
behaving correctly the whole time; there was just no visual signal for
which side's (possibly unrestricted) list you were looking at.

Fix: the dropdown's background/border now use the exact same
`rgba(158,7,14,...)`/`#c96a5f` (Attacker) and `rgba(41,90,123,...)`/
`#4f83a8` (Defender) colors as the "Placing for" toggle buttons, so a
glance at the dropdown's own color confirms which side it belongs to --
catching exactly this "wait, why is my whole roster showing" moment
before it needs a support conversation. Purely visual; `armyFilter`/
`visibleUnits` computation is completely untouched.

**v0.59 — imported Imperial Agents (Base Size Guide page 24) and
Leagues of Votann (page 26): 32 + 25 units, verified directly against
the actual PDF pages rather than working from memory of the earlier
document dump.**

Both factions turned out to need zero new base templates -- every mm
size on both pages (25/28.5/32/40/50/60/80mm circles, 90x52.5mm/105x70mm/
120x92mm ovals) was already added for Space Marines/Space Wolves/earlier
work. Same standing conventions as the SM/SW import: no art, no
`move_in` (falls back to `DEFAULT_MOVE_IN`), no `validSquadSizes` (this
guide is base-size data only). Skipped as "Hull" with no given
dimensions, per the project's standing no-fabricated-dimensions policy:
Imperial Rhino, Inquisitorial Chimera, Sisters of Battle Immolator
(Imperial Agents); Hekaton Land Fortress (Leagues of Votann).

Sagitaur -- added back before the app had a faction concept at all, with
a genuinely sourced 105x68mm hull measurement -- is also on the Leagues
of Votann page (also listed there as "Hull," same as every other vehicle
on it) and is now tagged `faction: "Leagues of Votann"` accordingly,
rather than staying unfactioned. It's the one Hull-listed unit on either
page that ISN'T skipped, since its dimensions were never guessed.

Both factions' many "\<Parent\>: \<Companion\>" pairs (Exaction Squad /
Exaction Squad: Cyber-mastiff, Brôkhyr Iron-master / Brôkhyr Iron-master:
E-COG / Brôkhyr Iron-master: Ironkin Assistant, Subductor Squad /
Subductor Squad: Cyber-mastiff, Vigilant Squad / Vigilant Squad:
Cyber-mastiff, Cthonian Beserks / Cthonian Beserks: Mole grenade
launcher, Grimnyr / Grimnyr: CORV, and more) needed zero roster-parser
changes -- `companionsForUnit()` (added back in v0.57 for Wolf Guard
Headtakers' Hunting Wolves) already generalizes to any unit following
that naming convention. Verified directly: a synthetic roster listing
"Exaction Squad" with a "Cyber-mastiff" sub-bullet, and "Brôkhyr
Iron-master" with an "E-COG" sub-bullet, both correctly split into two
separate matched entries with no code changes.

Also verified: `unitsForArmy()` picks up both new factions automatically
(32 / 25 units respectively) with no changes needed there either, since
it derives from whatever factions actually exist in `units.ts` rather
than a hardcoded list.

**v0.58 — once a unit's finished moving and gets deselected, its
movement arrow collapses to exactly one arrow with no distance label
(down from one full arrow-plus-label per model), and comes right back
in full detail the moment any part of that unit is reselected.**

Restructured `MapView`'s movement-arrow rendering to group by unit
(`groupId` -- every model from the same placement already shares one;
falls back to the token's own id on the rare chance it isn't set) rather
than drawing independently per model. A group with at least one selected
member renders exactly as before -- one arrow and one distance label per
model, since that's the detailed view someone re-selecting a unit
actually wants for fine adjustment. A group with nothing selected
collapses to ONE arrow (one representative member's path stands in for
the whole unit -- valid because every member moves by the identical
delta during a drag, guaranteed by the v0.56 atomic group-drag fix) with
no label at all, since a bare arrow is enough to show "this unit moved,
and roughly where" without the clutter of a repeated, now-unnecessary
number.

Verified directly with Playwright, not just typechecked: placed a
3-model squad, entered Turn 1 movement, marquee-selected and dragged the
whole group -- 3 arrows + 3 labels while selected, exactly 1 arrow + 0
labels immediately after deselecting, back to 3 + 3 on reselecting.

While chasing this down, hit and resolved several test-methodology dead
ends worth recording since they looked like real bugs at first glance
and weren't: a raw "any `<g>` containing a `<polyline>`" query was also
matching deployment-zone and terrain-outline polylines elsewhere in the
SVG, inflating the apparent arrow count -- fixed by querying
specifically for polylines with a `marker-end` attribute (unique to
movement arrows). And a drag that appeared to only move 1 of 3 selected
tokens turned out to be completely correct, intentional behavior, not a
bug: `handleDragEnd`'s post-drag terrain check (`cannotEndOnTerrain`,
checking the actual FINAL resting spot) is deliberately stricter than
the live per-frame check during the drag itself (`isPathBlockedForMovement`,
which only prevents tunneling THROUGH terrain, not stopping short of
crossing it) -- so two of the three models legitimately ended up on
terrain they aren't allowed to end their move on and correctly reverted,
while the third didn't. Confirmed by directly instrumenting both the
per-frame validation and the final committed state and finding they
agreed exactly. Retracts a claim from earlier note-taking mid-session
that this looked like a separate movement-phase group-desync bug -- it
wasn't; a cleaner drag direction avoiding that terrain produced a full,
correct 3-of-3 group move, which is the scenario actually verified above.

**v0.57 — corrected several units' actual squad sizes (all Dreadnoughts
are solo models, Fenrisian Wolves come in 5), and fixed the roster
parser to split Wolf Guard Headtakers' "3x Hunting Wolves" mounts into
their own separate placeable unit instead of folding them into the
Headtakers' own model count.**

Data corrections (`units.ts`): every Dreadnought-type unit in both
factions -- Space Marines' generic Dreadnought, Ballistus, Brutalis,
Redemptor, and Space Wolves' Bjorn the Fell-handed, Murderfang,
Venerable Dreadnought, Wulfen Dreadnought -- now has `validSquadSizes:
[1]` (previously unset, meaning the "Unit templates" section wrongly
offered 3- or 6-model formations for what's always a single named
character or vehicle). Fenrisian Wolves now has `validSquadSizes: [5]`
(previously unset). Added the matching formation templates these needed
that didn't exist yet: `unit_60mm_1`, `unit_90mm_1`, `unit_40mm_5`. All
now auto-arm correctly on selection (0 real choice = arm immediately),
verified directly against every affected unit.

Wolf Guard Headtakers fix (`parseRoster.ts`): this datasheet's 3
Headtaker models each ride a Hunting Wolf mount, which the roster export
lists as a second top-level bullet under the SAME "Wolf Guard Headtakers"
line ("3x Wolf Guard Headtaker" + "3x Hunting Wolves") -- previously
summed together into one wrong doubled model count (6) for the parent
unit, flagged as a known limitation back in v0.54. `units.ts` already
modeled "Wolf Guard Headtakers: Hunting Wolves" as its own separate Unit
(a genuinely different, oval 60x35.5mm base), so the fix teaches the
parser to recognize that naming convention (`companionsForUnit`: any
unit named `${parent.name}: <something>`) and split a matching bullet
into its own separate roster entry instead of summing it into the
parent. Deliberately generic rather than hardcoded to Wolf Guard
Headtakers specifically -- it also picks up Wolf Scouts/Wolf Scouts:
Hunting Wolves for free, and any future unit added with the same naming
pattern, with zero parser changes needed. The companion entry carries no
points of its own (never separately priced in the export -- bundled into
the parent's cost) and the roster checklist just omits the points figure
for a 0-point line rather than showing a confusing "0pts". Added
`unit_60x35.5mm_3`/`unit_60x35.5mm_6` formation templates and set
`validSquadSizes: [3, 6]` on the companion unit so it behaves like a
real placeable formation, not just single-base placement.

Verified directly against the full 18-unit test roster: Wolf Guard
Headtakers now reports `modelCount: 3` (not 6) with a separate
`Wolf Guard Headtakers: Hunting Wolves` entry at `modelCount: 3`
alongside it; every other unit's counts, matches, and attachments are
unaffected (19 unique units now matched, up from 18, purely from Hunting
Wolves becoming its own trackable line).

**v0.56 — fixed a real bug: group-dragging a unit with an attached
character (a squad plus its auto-placed Leader/Support) could let the
two end up slightly overlapping, and once that happened, neither token
could be moved again in any direction.**

Two compounding issues, both in `handleTokensMove`/`isPathOverlappingOtherBases`,
neither new to this feature but both far more likely to bite now that
v0.53 places a Leader/Support only 0.25in from its Bodyguard's edge (a
razor-thin tolerance compared to how much slack most placements have):

1. **Per-token independent accept/reject during a group drag.** A
   multi-select drag applies the exact same delta to every dragged
   token, so a rigid group's relative alignment should never change --
   but each token's move was being validated and committed
   independently, frame by frame. One member's path getting rejected for
   a single transient frame (grazing terrain, anything) while the rest
   of the group kept moving with the mouse could desync the group's
   alignment. And since dragged tokens are deliberately excluded from
   checking overlap against EACH OTHER (a correct rigid translation
   can't introduce new overlap within the group, so this was never
   checked) -- once desynced, nothing caught two group members actually
   overlapping.
2. **The overlap-along-path check samples the starting point too.** Once
   two bases ARE overlapping, every possible destination's path starts
   from that same already-overlapping point, so literally no move in any
   direction could ever pass the check -- permanently freezing both
   tokens, exactly matching the reported "preventing movement of either
   of them."

Fixed both. `handleTokensMove`'s deploy-mode branch now validates the
WHOLE dragged batch atomically: every token's move this frame is legal,
or none of them move, closing the gap that let per-token independent
accept/reject desync a rigid group. `isPathOverlappingOtherBases` now
exempts any base the token is ALREADY overlapping at the start of its
path from blocking that move -- an already-overlapping pair can be
freely separated, but a clean base still can't be dragged into a brand
new overlap with anything. Together: the primary fix prevents the
overlap from forming in the first place; the second is a defensive
recovery path in case it (or anything else) ever produces one anyway.

Verified directly with Playwright, not just typechecked: placed a
3-model squad with an auto-attached Leader (4 tokens total), marquee-
selected all 4, and dragged the whole group across the board through a
real multi-frame gesture (the exact scenario that used to be able to
desync). All 4 tokens moved by the identical delta -- 0.00px spread
across every member -- confirming the group stayed perfectly rigid with
zero risk of the overlap ever forming.

**v0.55 — fixed a real bug behind "models placed in units can't be
dragged independently anymore": placing a unit from the roster
checklist left it armed afterward, so a click that narrowly missed an
already-placed model's hit-target attempted to place ANOTHER copy right
there instead of starting a drag.**

This took real diagnosis, not a guess — spun up the dev server and
tested interactively with Playwright rather than trying to reason it out
from source alone, since several early hypotheses (group-drag via
`groupId`, a `selectedTokenIds` mixup, a rules-of-hooks violation, stale
counter collisions) all checked out fine on inspection and needed to be
ruled out empirically. First actual test run showed 6 tokens rendered
for a 3-model placement — which turned out to be a TEST artifact, not an
app bug: the still-armed ghost preview (rendered in the "would overlap"
warning color) was sitting on the same spot as the real tokens and got
miscounted as duplicates. Filtering down to just the real, non-ghost
circles showed independent dragging actually working correctly in
isolation — which meant the reported symptom had to be coming from
somewhere else.

The actual mechanism: `armed` staying set after a successful placement
is intentional, existing behavior (lets you place several copies of the
same generic unit without re-arming each time) — but it long predates
the v0.48/v0.53/v0.54 auto-arm features, which made it far more likely
to actually be true in practice. Previously, arming a multi-size unit
needed a second, deliberate click on a specific formation-size button;
now, tapping one roster line arms a formation immediately. Reproduced
directly: with a unit still armed after roster placement, a mousedown
that lands just off a token's hit-target doesn't start a drag at all
(`handleSvgMouseDown` intentionally skips marquee-select while armed) --
it falls through to a fresh placement attempt on mouseup, which either
fails with a visible "Can't end on top of terrain" error or, worse,
silently succeeds and drops an extra token no one asked for. Either way
reads as "dragging stopped working."

Fixed with a new `fromRoster` flag on `Armed` (`TokenPalette.tsx`),
set only when `selectAndArmUnit` is called from a roster row click (not
the plain dropdown or a manual template/base button). `DeploymentView.
handleBoardClick` now automatically un-arms after ONE successful
placement made this way — a roster line means "place this listed unit,"
not "keep placing copies of it." The manual dropdown/button path is
untouched: still stays armed for rapid repeat placement of a generic
unit, exactly as before. Verified directly with Playwright: placing via
a roster row now correctly shows no formation still armed afterward
(and "Deployed 1/1" with a checkmark); placing via the plain dropdown +
template button still shows the formation staying armed; and — combined
with the attached-Leader feature — dragging one model out of a
4-token placement (3-model squad + auto-placed Leader) still moves
exactly that one token, confirming the underlying drag mechanism itself
was never broken.

**v0.54 — tapping a roster line now arms the unit at the actual squad
size that's on the roster, not just whatever unit it is -- "Eliminator
Squad" arms the 3-model formation directly when the roster says 3,
without a second click to pick between 3 and 6.**

`parseRoster.ts` now sums each entry's own top-level "Nx <model type>"
bullets (e.g. "1x Eliminator Sergeant" + "2x Eliminator" -> 3) into a new
`modelCount` field on `ParsedRosterEntry`/`MatchedRosterUnit`. Getting
"top-level" right required distinguishing a model-type bullet ("•") from
that model's own nested wargear-option bullets ("◦") through the same
preprocessing pass that already turns both into control characters for
boundary-detection -- previously they were both folded into one BREAK
marker; split into `BREAK_TOP`/`BREAK_SUB` so summing can correctly
count "1x Eliminator Sergeant" and "2x Eliminator" as 3 total models
while ignoring "2x Bolt sniper rifle" underneath the second one as a
weapon choice, not another model.

Known, accepted limitation: a datasheet that lists the same models under
two different aspects -- Wolf Guard Headtakers' "3x Wolf Guard Headtaker"
+ "3x Hunting Wolves" describes 3 mounted models, not 6 -- sums to 6
anyway, since there's no generic way to tell "these are more troopers"
apart from "this is the same troopers' mounts" from export text alone.
Documented directly on the `modelCount` field rather than silently
shipped; it's an over-count specifically for units built this way, not a
general reliability problem.

Consuming side (`TokenPalette.selectAndArmUnit`) is deliberately
conservative about trusting this number: it only arms the matching
formation when the unit's own `validSquadSizes` list actually includes
that count. This isn't just a nicety -- without it, single-model
characters (Captain in Phobos Armour, say) would get a spurious count
from summing their own plain wargear bullets ("1x Bolt Pistol" + "1x
Combat knife" + ...) and could get wrongly armed as a multi-model
formation instead of one character. Verified directly: Eliminator Squad
(roster count 3, valid sizes [3,6]) auto-arms at 3; Captain in Phobos
Armour (roster count 3 from wargear-bullet spillover, no declared valid
sizes at all) correctly falls through to the existing manual-choice
behavior instead of acting on it; Wolf Guard Headtakers hits the known
dual-profile case and arms at 6, matching the documented limitation
rather than silently landing somewhere unexpected.

**v0.53 — attached Leader/Support characters (Ragnar Blackmane leading
Wolf Guard Headtakers, a Lieutenant in Phobos Armour supporting an
Incursor Squad, etc.) now place automatically alongside their Bodyguard
unit, read straight from the pasted roster rather than from any general
rules knowledge about who's allowed to join what.**

The key decision: don't try to encode which characters CAN attach to
which units in general (real 40k attachment-eligibility rules this app
has no data source for, and getting wrong would be worse than not having
the feature at all) — instead read the specific pairing straight out of
what the person's own roster export already declares. NewRecruit-style
exports tag each half right after its own cost line, as the first
bullet: "Attached as: Leader (Character)" / "Attached as: Support
(Character)" for the character, "Attached as: Bodyguard ()" for the unit
it joins. `parseRoster.ts` now detects that tag (peeking from right
after each entry's `(N Points)` match to its first following bullet) and
pairs the most recent unpaired Leader/Support with the next Bodyguard it
sees — new `RosterAttachment` type, collected into `ParsedRoster.
attachments`. Only pairs where BOTH sides matched a real unit in this
app's database get kept; an attachment to/from an unrecognized name is
just dropped, not carried as a half-known relationship.

Two real bugs surfaced and got fixed while building this, both caught by
testing against the actual sample roster before considering it done, not
after: a real line break AND its bullet marker both become the parser's
internal BREAK marker, landing two in a row with nothing between them,
which broke a naive "content between BREAK N and BREAK N+1" read of the
tag text; and the same issue with plain leading whitespace before the
first BREAK in the fully-flattened (PDF-copy, zero real line breaks)
case. Both fixed by scanning for the first non-whitespace, non-BREAK
content island instead of assuming a fixed BREAK-count offset. Re-verified
the full 18-unit test roster afterward — still 18/18 matched, and now
correctly finds all 3 real attachment pairs in both the normally-pasted
and fully-flattened versions.

New `ParsedRosterForDeployment` (`{ units, attachments }`) bundles what
`DeploymentView` needs into one value threaded through `DispositionPicker`
→ `App.tsx` → `DeploymentView` → `TokenPalette`, replacing the narrower
roster-units-only type from v0.51/v0.52.

Placement itself: `DeploymentView.handleBoardClick` already computes
every model's position before committing a Bodyguard unit (single base
or a full formation) — `attachedLeaderToken` runs right after, checking
whether that unit has an attached Leader/Support with an unplaced
instance still owed (compared against the roster's own count for that
unit, so a second copy of the same squad doesn't try to reuse an
already-placed leader), and if so, computes a spot just past the
formation's right edge (using the same base-footprint math as everything
else here, not a guess), validates it against terrain/zone/overlap
exactly like a normal placement, and — only if that's genuinely legal —
adds it as a second, separate token in the *same click*. An illegal spot
is never forced through just to keep the two together; the Leader/Support
just stays available to place manually from the roster checklist
instead, same as before this feature existed. `TokenPalette`'s roster
checklist also gained a small "⤷ deploys with X" / "⤷ attached to X"
hint under each attached row.

**v0.52 — the roster parser now handles a unit appearing more than once
on a roster, including the abbreviated "2x Incursor Squad (170 Points)"
format some exports use instead of writing out two full blocks.**

Previously that line parsed as ONE unmatched entry ("2x Incursor Squad"
doesn't equal any unit's actual name) — silently losing a whole unit
from both the palette filter and the v0.51 deployment checklist. Added
`splitQuantityPrefix()`: detects a leading "Nx " / "N x " before the
name, strips it, and expands into N separate entries, dividing the
line's total point cost back out per instance (40k costs are round
numbers by design, so this divides evenly in every real case checked).
Verified directly: "2x Incursor Squad (170 Points)" now produces two
`{ unitId: "sm_incursor_squad", points: 85 }` entries, matching what two
separately-written "Incursor Squad (85 Points)" lines already produced.

While re-verifying against the full test roster, found and fixed a
related gap in the existing glue-boundary heuristic (the one that
recovers a unit's name when a PDF copy drops line breaks entirely --
see v0.47): it only fired when the glued-together character was a
lowercase letter, so a join landing right after closing punctuation
instead (`"...Support (Character)Incursor Squad"`, glued right after the
`)`) went undetected, and the whole "Attached as: Support (Character)"
prefix leaked into the extracted name, breaking the match. Broadened the
trigger to lowercase letters, digits, and closing brackets — but
deliberately NOT hyphens or apostrophes, which legitimately appear
inside real names ("Fell-Handed"); the first broadening attempt did
include those and immediately mis-sliced "Bjorn the Fell-Handed" down to
just "Handed," which is exactly the kind of regression this project's
existing verify-before-trusting habit exists to catch, so it was caught
and fixed in the same pass rather than shipped. Re-ran the full 18-unit
test roster (both realistic and fully-flattened) after the fix — still
18/18, zero unmatched, including a "Fell-Handed" spot-check specifically
for the hyphen case.

**v0.51 — TokenPalette now shows a "Roster" checklist (only when a
roster was actually pasted) tracking which units have been placed, with
a checkmark per line and a "Deployed N / M" count.**

The tricky part wasn't the checkmark itself, it was getting it right
when a roster lists the same unit more than once (two Iron Priests at
different point costs is a completely normal thing to see) — the old
`matchedUnitIds` (deduplicated, used only for narrowing the "Unit"
dropdown) can't tell those apart. Added `MatchedRosterUnit` +
`matchedRosterUnits()` (`parseRoster.ts`) to carry the full matched list
through with duplicates intact, one entry per actual roster line, and
changed the whole `DispositionPicker` → `App.tsx` → `DeploymentView` →
`TokenPalette` chain to carry that instead of a bare id array (the old
`rosterFilter: string[]` prop is gone; `TokenPalette` now derives its own
id set from `roster: MatchedRosterUnit[]` for dropdown-narrowing, same
behavior as before, just recomputed from the richer data instead of
threading two separate props).

Matching a specific roster LINE to "has this been placed" needed its own
concept of "placed instance," not just "any token with this unitId
exists" — otherwise placing one of the two Iron Priests would check off
both. `DeploymentView` computes `placedGroupCountByUnitId`: for the
current owner, count of *distinct groupIds* per unitId among placed
tokens (a group = one placement action — a 5-model Scout Squad placed in
one go is 1 instance, matching 1 roster line, not 5; every placed token
already carries a groupId, even a lone single-base placement gets its
own unique one). `TokenPalette` then pairs that count against the
roster's entries for each unit id *in order* — the Nth roster line for a
unit checks off once at least N+1 separate instances of it are on the
board. Verified directly against a small roster with a duplicate entry:
placing exactly one Iron Priest checks the first Iron Priest line and
leaves the second unchecked, not both.

Each roster row is also clickable — arms that unit immediately (reusing
the exact same auto-arm logic the "Unit" dropdown uses, factored out into
a shared `selectAndArmUnit` so the two stay in sync), so working down a
roster is tap-the-next-line, click-to-place, repeat, rather than
re-opening the dropdown each time.

**v0.50 — the main board view now crops out the source art's "LAYOUT N"
title strip and inch-ruler margins, so the actual playing surface fills
more of the available screen space instead of competing with dead margin
for room.**

The source images were never just the board -- `cal.pxOrigin` +
`board.width_in`/`height_in` already describe exactly where the real
board sits inside the larger image (that's what every position
calculation in this file has always used), but the `<svg>` itself
rendered the FULL image, so the container's fit-to-size scaling
(`fitScale`) was always sized against the whole image including margin,
not just the board. Verified against all 42 maps' actual calibration
data: the real board only occupies 75-84% of the source image's area, so
that's meaningfully wasted screen space this recovers.

Implementation is a pure viewBox change, nothing else: the `<image>`
element and every position calculation (`toDisplayPx`, `toBoardIn`,
`eventToLocalXY`, drag/marquee/ghost handling) are completely untouched
-- they still operate in the same full-image coordinate space they
always have. Only the outer `<svg>`'s `viewBox` moved from always
starting at `0 0` to a `cropX cropY cropW cropH` window onto just the
board rectangle, which — since SVG viewBox is purely "what window into
this coordinate space is visible," not a transform on the content
itself — needed no changes anywhere else that already uses
`getScreenCTM()`-based coordinate conversion. The one piece of real math
was working out where that crop window lands after the existing
`translate(H,0) rotate(90)` rotation transform (derived by hand, then
verified with a direct point-transform simulation against real
calibration data — see the code comment above `viewBoxMinX`).

Thumbnails (map library grid, mission-map picker) are deliberately left
uncropped: both already show `map.name` as real text next to the
thumbnail, so nothing is lost by not cropping there, and un-cropped
thumbnails keep a consistent width across the grid rather than each
varying by its own map's margin proportions.

**v0.49 — shrunk the Turn 1 movement arrows (line, arrowhead, bend dots,
distance label) so they don't obscure the tokens themselves once a
5–10-model squad has all moved.** Every moved token draws its own arrow,
so a full squad move used to mean 5–10 overlapping full-size arrows and
labels stacked right on top of the tokens they belong to. Reduced:
polyline `strokeWidth` 2→1, arrowhead marker size 7→4.5, start-point dot
r 3→1.8, bend dots r 2.5→1.4, label `fontSize` 11→9 with its outline
stroke 3→2 to match. Purely visual — none of the underlying path/distance
data or clamping logic changed.

**v0.48 — corrected Scout Squad's size to 5 (was wrongly set to 10), and
units with only one real placement option now auto-arm on selection
instead of requiring an extra click.**

Scout Squad: `validSquadSizes` was `[10]`, should be `[5]` (a Scout Squad
is a Sergeant + 4 Scouts, not 10 models) — fixed, plus added the missing
`unit_28.5mm_5` formation template it needs (only `unit_28.5mm_10`
existed before).

Auto-arm: selecting a unit in the "Unit" dropdown used to always clear
whatever was armed, even when that unit only has one thing it could
possibly be armed as — a Dreadnought (or any other unit with no matching
formation templates at all, so its only real placement is the single
base itself) or a unit whose `validSquadSizes` narrows down to exactly
one formation (Iron Priest: `[1]`, now also Scout Squad: `[5]`). New
shared helper `templatesForUnit` (in `TokenPalette.tsx`) computes the
applicable formation list for a given unit; the dropdown's `onChange`
now arms the single base when that list is empty, arms the lone
formation when it has exactly one entry, and only falls back to clearing
armed state (leaving a real choice for the person to make) when there
are two or more, e.g. Hormagaunts (`[10, 20]`) or Eliminator Squad/
Thunderwolf Cavalry/Wolf Guard Headtakers (`[3, 6]`). Verified directly
against the roster: Ballistus Dreadnought → 0 templates → auto-arms its
base; Iron Priest and Scout Squad → 1 template each → auto-arm that
formation; Eliminator Squad, Thunderwolf Cavalry, and Hormagaunt → 2
templates each → still require a manual pick.

**v0.47 — added a roster-paste importer: pasting an exported army list
(NewRecruit, the GW app, etc.) on the disposition-picker page narrows a
side's unit palette down to just what's actually in that list, as a
subset of whatever the army selector already allows.**

New `src/data/units/parseRoster.ts` does the actual parsing. The core
trick: every unit line in these exports carries its point cost as
`(N Points)` right after the name, and nothing else in a normal export
has that exact shape (wargear lines don't cost points on their own,
detachment/roster totals like "3 Detachment Points" always have extra
words between the number and "Points" that the pattern doesn't allow) —
so scanning for that pattern gives a reliable anchor for where every real
unit line is, regardless of how the surrounding text is formatted.

The harder problem: extracting the actual name text preceding each
anchor, given that the text between two anchors is really the PREVIOUS
unit's trailing wargear bullets with the NEXT unit's name glued onto the
end. Handled in two layers — explicit breaks (bullet markers, real line
breaks, and known section headers like "CHARACTERS"/"ATTACHED UNITS"/
"Attached unit N") get marked with a control character during
preprocessing, and the name is whatever comes after the LAST one before
each anchor. But copying a roster out of a rendered PDF is a common way
to lose line breaks entirely with no replacement whitespace at all (confirmed
directly: a real user-provided example had "...bolt carbineEliminator
Squad (75 Points)" — the previous unit's last wargear word directly fused
to the next unit's name) — for that case there's a second fallback: real
multi-word unit names are always space-separated, so a lowercase letter
immediately followed by an uppercase letter never happens *within* a
genuine name, only at exactly this kind of glued join. Cutting at the
last such transition recovers the name even with zero surviving
whitespace between the two units.

Verified against a real 23-entry Space Wolves/Space Marines mixed roster,
both as normally pasted (line breaks intact) and with every line break
artificially stripped to simulate the PDF-copy worst case: 18/18 distinct
units matched correctly in both versions (an Iron Priest appearing twice
at different point costs correctly deduplicates to one matched id), zero
false positives from the roster title, faction lines, detachment/mission
lines, or the "Exported with App Version..." footer.

UI: `DispositionPicker` gained a "Roster (optional)" section below the
existing army selector, one paste box per side, with live match/no-match
feedback and a Clear button. `unmatched` names (couldn't be matched —
maybe a typo, an allied unit, or one of the still-unimplemented Hull/
Unique units) are surfaced directly rather than silently dropped. The
parsed id list flows through `App.tsx`'s `DeployStage` and into
`DeploymentView` as `rosterByOwner`, which resolves to a `rosterFilter`
prop on `TokenPalette` — applied strictly as a narrowing of whatever
`armyFilter`/`unitsForArmy` already allows, never as an independent or
wider filter. An empty or absent roster list means "no narrowing," not
"show nothing." Switching "Placing for" into a side whose roster would
orphan the currently-selected unit clears that selection, same pattern
as the existing army-filter case.

**v0.46 — Space Wolves army selection now also surfaces the generic
Space Marines roster (they share a codex in-lore), minus 27
chapter-specific exceptions.** Previously the army selector filtered
strictly on `Unit.faction`, so picking "Space Wolves" only ever showed
the 23 units explicitly tagged that way — every Space Marines unit was
invisible even though Space Wolves are a Space Marines successor
chapter and can field most of that same roster.

Fixed with two additions rather than restructuring the faction field
itself: `armyFactionAccess` (`units.ts`) maps an army selection to which
other factions' units it also gets access to — currently just
`"Space Wolves": ["Space Marines"]` — and a new per-unit
`excludedFromArmies?: string[]` field marks the individual exceptions a
shared-codex army doesn't actually get: chapter-specific named
characters from other chapters (Roboute Guilliman, Cato Sicarius, Kayvaan
Shrike, Chief Librarian Tigurius, ...) and the generic Chaplain (Space
Wolves field a Wolf Priest instead, already in their own list). 27 units
tagged in total. `unitsForArmy(army)` in `units.ts` combines both and is
what `TokenPalette` now calls instead of a plain `u.faction === armyFilter`
check. Selecting "Space Marines" itself, or "Any army", is unaffected —
verified directly: Space Wolves now resolves to 87 units (23 own + 91 − 27
= 64 shared Space Marines), Space Marines still resolves to exactly its
own 91 with no Space Wolves leaking in either direction.

**v0.45 — imported the full Space Marines and Space Wolves rosters from
the official Base Size Guide (pages 31–34), and added an army selector
to the disposition-picker page that filters each side's unit palette.**

Roster: 91 Space Marines units + 23 Space Wolves units added to
`src/data/units/units.ts` (id-prefixed `sm_`/`sw_`), sourced directly
from the guide's per-unit base-size tables. Six new base templates
(`base_28.5mm`, `base_80mm`, `base_90mm`, `base_100mm`, `base_60x35.5mm`,
`base_90x52.5mm`, `base_105x70mm`) were added to
`src/data/bases/baseTemplates.ts` to cover sizes the roster needed that
weren't already in the library.

Deliberately incomplete, on purpose: 12 units the guide lists as "Hull"
or "Unique" (Land Raider + Crusader/Redeemer, Predator Annihilator/
Destructor, Razorback, Rhino, Vindicator, Whirlwind, Drop Pod, Hammerfall
Bunker, Astraeus, Thunderhawk Gunship) were left out rather than given
invented hull dimensions. The guide gives no mm figures for these —
they sit on their own vehicle hull, not a Citadel base — and this project
has already put real effort into footprint *accuracy* (see the terrain
contour-tracing work below); fabricating a plausible-looking rectangle
for a hull nobody measured would work against that. Add these once real
width x height hull dimensions are on hand, the same way Sagitaur's
105x68mm came from an actual sourced measurement rather than a guess.

Army selector: `DispositionPicker` gained a second pair of columns
("Attacker's army" / "Defender's army", defaulting to "Any army") below
the existing disposition columns, listing factions derived from
`units.ts` (`export const factions`) rather than hand-maintained, so it
can't drift out of sync as more rosters are added. The selection flows
through `App.tsx`'s `DeployStage` state and into `DeploymentView` as an
`armyByOwner: { red, blue }` prop, which resolves to a single
`armyFilter` string passed to `TokenPalette` based on whichever side is
currently "Placing for". `TokenPalette` filters its "Unit" dropdown to
that faction when set; "Generic base (no unit)" always stays available
regardless, since it isn't tied to any faction. Switching "Placing for"
into a side whose filter would orphan the currently-selected unit clears
that selection (and whatever's armed) rather than leaving a stale choice
the palette no longer visibly offers. The map-library "Browse" tab
doesn't go through the disposition picker, so it passes no army filter
and shows the full roster, matching pre-v0.45 behavior.

**v0.44 — a placed token could be dragged clean out of its deployment
zone during deploy-mode repositioning, with nothing stopping it,
regardless of the infiltrators toggle.** Reported directly with a
screenshot: a Sagitaur sitting visibly outside the red zone despite
infiltrators being off for it.

Traced directly rather than assumed: `isInDeploymentZone` was only ever
called in `handleBoardClick` (initial placement), never in
`handleDragEnd` (repositioning an already-placed token via drag). So the
zone boundary was enforced exactly once, at the moment of the original
click — after that, a token could be freely dragged anywhere on the
board. Confirmed directly before fixing: placed a Sagitaur validly inside
the zone with infiltrators off, dragged it a short, precise distance
across the zone boundary, and it went through with nothing stopping it.

Fixed by adding the same check to `handleDragEnd`, scoped specifically to
`mode !== "move"` — deploy-mode repositioning needs it, but Turn 1
movement deliberately doesn't (units are supposed to leave their
deployment zone once the game has started; this is correct, existing
behavior, not something to restrict). Respects the current infiltrators
toggle the same way initial placement already does.

Verification took real back-and-forth, worth recording honestly: UI-level
drag testing on this specific map turned out to be genuinely
tricky — ghost-preview stroke color and palette "armed" CSS state both
gave false signals under tight timing (checking immediately after a
click, before React/CSS had settled), leading to a few contradictory
results before switching to a more reliable rect-count-based check and a
zone polygon's own rendered bounding box (rather than guessed screen
coordinates) as a calibration reference. Once that was sorted, a
temporary debug log (added, used, then fully removed again — confirmed
zero `console.log` calls remain) made the actual decision visible
directly: confirmed the fix reverts a real out-of-zone drag
(`outsideZone: true`), confirmed a same-test failure on a different drag
was genuinely `onTerrain: true` (the existing, correct terrain check, not
a false positive from this fix), and confirmed infiltrators-on correctly
lets a token leave the zone as before. Re-verified Turn 1 movement mode
is unaffected (a token dragged during Turn 1 moved substantially, capped
by its own move-range budget rather than snapped back to origin,
confirming the `mode !== "move"` scoping holds) and full regression
(placement, formation placement, all 42 maps) passed clean.

A second issue reported alongside this one — a ghost preview not showing
the in-terrain ring indicator (v0.42) despite appearing to sit over a
terrain card — could not be reproduced: tested the ring at all 14 terrain
card centers on the map in question and it appeared correctly at every
one. Not fixed because no failure was found to fix; flagged here in case
it recurs with more specific coordinates to reproduce against.

**v0.43 — Sagitaur art re-cropped to match its base's actual aspect
ratio, so it no longer misrepresents the hull's true footprint.**
Reported directly, with a real placement consequence: a player judging
"is my base within the zone" by eye, based on where the visible vehicle
art appeared to sit, was getting a different answer than the actual
rectangular footprint check — because the two didn't actually agree.

Checked the numbers rather than assuming: the source art is 722×644px
(aspect ratio 1.12, close to square), but the Sagitaur's real base is
105×68mm (aspect ratio 1.54, notably wider than tall). `Token.tsx`'s
existing "cover" scaling (`preserveAspectRatio="xMidYMid slice"`) fills
the shape without gaps regardless of source aspect ratio, but the more
mismatched the source is, the more it has to crop to do that — here, the
image had to be scaled up until its width matched, which overflowed the
target height by ~38%, discarding roughly 14% off both the top and
bottom of the source photo. The rendered art was accurate to the base's
*outline* (correctly clipped, correct size) but not to its *content* —
what was visible inside that rectangle came from a substantially
different-shaped slice of the original photo than "the whole vehicle,
scaled proportionally" would produce.

Fixed at the source instead of the render step: computed where the
vehicle's actual substantial content sits vertically (weighted by
per-row opacity, so the thin whip antenna barely pulls the center
compared to the solid hull body) and cropped the already
background-removed `sagitaur.png` to 105:68's exact ratio around that
center — 722×468px, landing at aspect ratio 1.543 against a target of
1.544. Checked before finalizing, not just assumed a centered crop would
land well: verified the new crop still captures 93.8% of the vehicle's
substantial-content rows, and that neither the new top nor bottom edge
lands mid-body (both show a gradual falloff in opacity near the crop
edges, not an abrupt wall of solid vehicle color suggesting a
mid-silhouette cut).

Since the source image's own aspect ratio now closely matches the base's,
`Token.tsx`'s cover-scaling has almost nothing left to crop — the
rendered art should now closely track the true footprint boundary, so
"where the vehicle looks like it is" and "where the rectangle actually
is" should agree far more closely than before. Re-verified placement,
Hormagaunt formations, and generic base placement all still work
correctly; no code changes were needed since this was purely an asset
fix, not a rendering logic change.

**v0.42 — visual indicator for a unit's base overlapping a terrain
footprint at all, live while moving and at rest.** A new, purely
informational signal, not a legality check — the card itself is
walkable (see the "card is walkable, only the feature isn't" distinction
throughout this pipeline's terrain work), so this doesn't affect whether
a position is allowed. It answers a different, real question: is this
unit currently on a terrain piece's card at all, independent of whether
the specific feature within it happens to be blocking — the thing rules
like cover or "unit is on/near terrain" actually care about.

`overlappingTerrainFootprintId(map, center, base, rotationDeg)` in
`geometry.ts` checks a base against every terrain piece's whole card
footprint (`corners`), not just the blocking `keepOutFootprints` within
it — a small, direct reuse of `isBaseOverlappingPolygon`, no new geometry
needed. `Token.tsx` gained an `inTerrain` prop: when set, draws a second,
larger copy of the base's own shape (not a generic circle) around it in a
dashed amber outline, distinct from both the owner-color ring and the
selected-yellow ring, which already carry different state. Drawing the
same shape type scaled up (not just a fixed-size ring) means it reads
correctly under rotation for oval and rectangular bases too, not just
round ones.

Wired into every place a token's position is currently shown: real
placed tokens (updates live during a drag, since it's computed from the
token's current position on every render, no separate tracking needed),
the single-base ghost preview, and the per-model formation ghost preview
(checked individually per model position, not as one all-or-nothing
group flag, since different models in a formation can land on different
terrain or none).

Verified directly: swept a token across open floor and confirmed the
ring toggles on and off correctly as it crosses terrain boundaries during
a live drag; confirmed it persists correctly after release for a token
at rest on terrain; confirmed the underlying overlap math directly for a
rectangular base (Sagitaur hull) independent of screen-coordinate
targeting, since a UI sweep isn't guaranteed to land on a specific card;
confirmed the ghost preview shows the ring correctly while hovering over
terrain before a placement is even committed. Re-ran the broader
regression suite (single-base placement, formation placement, Turn 1
mode) against the change with no issues.

**v0.41 — v0.40's raw-contour fix corrected zone-tint contamination but
introduced a real regression of its own: real terrain features
disappearing from cards where a colored feature interrupts the grey
color-temperature mask.** Reported directly: `purge_mirror_c`'s
green/yellow terrain was no longer being captured, meaning a token could
end a move on top of it — genuine terrain, not the zone-tint artifact
v0.40 fixed.

Traced the mechanism directly: `terrain_v4.py`'s card mask only matches
grey (neutral-to-cool) pixels, so a colored feature sitting on a card —
the exact thing that makes it a genuine terrain feature — fails the
mask's own test and reads as a gap. Real terrain art has enough of these
that a card's mask regularly fragments into a main body plus several
small disconnected pieces nearby, each too small individually to pass
the piece-size filter. v0.40's raw-contour trace of just the main body
correctly excluded zone floor, but also correctly excluded these
feature-gap fragments — precisely the area `extract_terrain_keepout.py`
needs sampled to find the feature in the first place. Confirmed directly
on `purge_mirror_c`'s `terrain_10`: the true main card component measured
59.8in², well short of what the piece should cover.

Two fixes were tried and rejected before landing on one that didn't trade
one problem for another:

1. **Convex hull instead of raw contour** (fills any concave notch,
   recovering the feature gaps). Worked for that — but a hull fills a
   zone-adjacent card's boundary notch too, since that's also just a
   concave notch to the algorithm. Tested directly: zone-tint
   contamination on the same piece v0.40 fixed came back up to 38.7%, a
   large fraction of the 32.3% problem it was supposed to have solved.
2. **A larger morphological close kernel** (9x9, up from 5x5) to bridge
   the gaps directly in the mask before tracing. Zone-tint contamination
   stayed low (this genuinely doesn't have the hull's problem, since a
   close kernel only bridges gaps up to roughly its own size) — but a
   kernel wide enough to bridge feature gaps reliably is also wide enough
   to occasionally merge two separate, closely-touching cards into one,
   which is a real, previously-documented failure mode (the reason 5x5
   was chosen over 11x11 in earlier work on this same script). Confirmed
   directly: piece counts became unstable across both test maps at this
   kernel size, exactly the symptom that caused 5x5 to be chosen
   originally.

**What actually worked**: kept the 5x5 close kernel (avoiding the
merge-separate-cards risk entirely) and added a surgical, per-piece
fragment-absorption step instead of any single global mask operation.
For each real, size-qualifying piece, its own mask is dilated a modest,
fixed 10px and any *other*, sub-threshold-sized component landing inside
that dilation gets merged into it specifically — recovers a feature's gap
in its own card, but doesn't have the reach to pull in a different,
separate card the way a global kernel or hull would. Verified both
properties hold simultaneously on the same test pieces from both fixes:
`terrain_10` on `purge_mirror_c` recovered from 0 keep-out shapes to 3
(16.0% coverage), while the zone-tint numbers on `purge_mirror_a`'s
previously-flagged pieces matched v0.40's raw-contour results exactly
(0.5-9.7%, not the hull approach's regression).

Re-ran the full pipeline across all 42 maps: piece counts stayed
identical to v0.40's (637 total, 631 kept after the existing
marker-icon-false-positive filter drops 23 — both numbers matching
exactly, confirming the fix doesn't introduce the same instability the
two rejected approaches did anywhere else in the dataset). Re-verified
placement, terrain rejection on both flagged maps, unit templates, and
vehicle placement all still work correctly.

**v0.40 — terrain card footprints were bounding rectangles fitted to an
already-accurate color mask, and the rectangle was the actual bug.**
Traced this down after a specific, well-reasoned prompt: terrain
footprints are a distinct grey, so automated detection should already be
reliable — the question was why it wasn't for pieces near deployment
zones specifically.

Checked `terrain_v4.py`'s existing color-temperature mask directly rather
than assuming it was the problem: it's accurate, correctly separating
grey card from colored floor. The bug was one step later —
`cv2.minAreaRect(cv2.convexHull(...))` fits an oriented *rectangle*
around the mask's true, often-irregular (torn-edge, sometimes concave)
shape. Measured directly on the flagged pieces from `purge_mirror_a`: the
fitted rectangle was 194-290% of the mask's real area, with the excess
extending straight into whatever was physically adjacent — for
zone-adjacent pieces, that's strongly-tinted deployment zone floor. Cards
away from a zone boundary showed a much smaller, structural baseline
excess (124-127%, unavoidable for any non-rectangular shape approximated
by a rectangle) — confirming this wasn't a general accuracy problem, it
was specifically the zone-adjacent cases blowing far past that baseline.

An earlier avenue this session (using grid-line presence/absence,
suggested directly and confirmed as a real, measurable signal — floor
shows consistent ~7.76px periodicity, terrain doesn't) turned out not to
generalize to zone-tinted floor specifically: the zone tint itself
suppresses the grid's visibility enough that tinted floor and genuine
terrain became hard to tell apart by that method alone, right in the
cases that mattered most. Abandoned that path once verified rather than
shipping something inconsistent, and went back to what made the report
possible in the first place — terrain really is visually distinct from
zone color, and the mask already captured that; it was the rectangle
simplification afterward that threw the accuracy away.

Fix: `corners` now traces the mask's real contour
(`cv2.approxPolyDP`, ~1% of perimeter as the simplification epsilon —
checked directly against the mask's own area first: ~99% coverage at
this setting), not a fitted rectangle. `width_in`/`height_in`/`angle_deg`
are kept as approximate metadata (still derived from the same
`minAreaRect`, used for size filtering and rough display) but no longer
describe `corners`'s own bounding box, since `corners` is the traced
shape now. Verified directly before rolling out: the previously-flagged
pieces on `purge_mirror_a` dropped from 10-35% zone-tint-colored area
within their polygon down to 0.5-9.7% — most much closer to the
structural floor for any polygon-simplification approach, not zero, but
a real, large reduction, not a marginal one.

Re-ran the full pipeline across all 42 maps (`tah_pa_a` excluded, same as
always — it's a manually-corrected reference the batch scripts
deliberately don't touch): total card area across every map dropped to
62% of the previous rectangle-based total, consistent with removing
systematic over-sizing rather than an isolated few pieces. Re-ran
`classify_terrain.py` and `extract_terrain_keepout.py` on the new
footprints (both already worked generically on any polygon, needing no
changes themselves) and regenerated all map data. Re-verified placement,
terrain rejection, card outline rendering (now correctly showing traced
irregular shapes instead of rectangles), unit templates, vehicle
placement, and base overlap all still work correctly against the new
data.

**v0.39 — investigated the "markers merged with real terrain" gap
flagged in v0.38, built and then reverted a fix after it created a worse
problem elsewhere.** Reported directly with an annotated screenshot on
`purge_mirror_a`: several objective markers were still being counted as
terrain (several were on cards whose only detected "feature" turned out
to be the marker itself, confirmed by checking whether the marker's own
board position falls inside the currently-extracted shapes).

Tried detecting a marker's distinctive white skull/eye glyph directly
(rather than relying on the whole icon staying one clean, separate
connected component, which breaks once a marker touches real terrain)
and carving out a padded zone around each confirmed one before shapes get
grouped. Iterated through several real problems while building this, not
just shipped the first version:
- The white glyph itself is often fragmented into pieces too small to
  register individually (a skull's own eye-socket detail breaks up its
  white area) — needed real bridging to read as one icon, but a bridging
  kernel large enough for the fragmented cases also merged some markers'
  white area with unrelated nearby white elements (a faction-icon label,
  confirmed directly) into something no longer marker-sized at all.
  Multi-pass, gentlest-kernel-first-with-early-exit handled this.
- The ring-color check's sampling radius was wrong — checked directly and
  found the actual colored ring sits much closer to the icon than
  assumed, not out toward 2x its own radius.

After both fixes, direct verification against a second map
(`purge_mirror_c`) that has known genuine large teal-green pipe terrain
found the real, disqualifying problem: pipe art in this style often has
bright end-cap/fitting highlights that are structurally indistinguishable
from a marker's white-icon-with-colored-ring from a local pixel-pattern
perspective alone — confirmed directly on a specific piece where two
"marker-shaped" candidates sat precisely at the two ends of one long pipe
shape. No combination of size, aspect ratio, or ring-color-fraction
threshold tried (several were) cleanly separated the two without either
missing real markers or carving into genuine terrain — sometimes removing
over 80% of a piece's real feature area in testing.

**Reverted rather than ship a partial fix that trades one problem for a
worse one.** Breaking genuine terrain detection on a map that was already
working correctly is a worse outcome than leaving a smaller number of
markers-merged-with-terrain imperfectly handled — the same call made in
v0.38, just now confirmed with a second, harder attempt at a fix rather
than assumed. The known limitation from v0.38 stands: a marker physically
touching or immediately adjacent to real terrain can still pull a larger
area into that piece's keep-out shape than the terrain alone justifies.
Solving this properly would need something more than pixel-pattern
matching — most likely real objective-marker position data (which this
project doesn't currently extract; `objectives: []` on every map) to
cross-reference against, rather than trying to infer "is this a marker"
purely from local shape and color.

Re-verified after reverting: all 42 maps re-extracted (1132 shapes,
matching v0.38 exactly, confirming a clean revert), `purge_mirror_c`'s
previously-fixed pieces still show their correct elongated real terrain
shapes, and the isolated/clean marker cases from v0.38's original fix
(not touching real terrain) still work correctly.

**v0.38 — v0.37's marker fix was itself wrong, in the opposite
direction, and made terrain detection measurably worse.** Reported
directly with an annotated screenshot: real terrain features (circled
green) had stopped being detected at all, and other pieces (circled pink)
were now showing a huge shape tracing almost their entire card instead of
a tight feature outline.

Both were real, and traced to the same root cause: v0.37's fix excluded a
green/teal hue band to filter out objective-marker icons, based on
sampling only 3-4 maps where genuine terrain features happened to be
yellow/gold-dominant. Checking the specific flagged map
(`purge_mirror_c`) directly showed that assumption was wrong there —
several real terrain pieces have large (up to 10+ inches long) teal-green
pipe-and-strut art using close to the exact same hue as that map's own
objective-marker icons. Excluding by color scooped out genuine terrain
along with the markers on any map where the two happen to share a hue.
The pink "giant shape" symptom was a second-order effect of the same
mistake: two pieces lost their only real feature to the hue exclusion,
dropped to zero detected shapes, and the existing "zero shapes → block
the whole card" conservative fallback kicked in — worse than either
approach alone.

Fixed by dropping color as the discriminator entirely and using shape
instead: objective-marker icons are consistently close to square (a
circle or diamond's bounding box is roughly 1:1) and a consistent size
within a given map (~2.0in on one map, ~3.1-3.4in on another, checked
directly rather than assumed to generalize). Genuine terrain feature
clusters, even teal-green ones, are usually elongated — real aspect
ratios of 1.5-3.9 were measured directly on the flagged map's
now-correctly-restored pieces. The hue range is back to covering both
yellow/gold and green/teal (undoing v0.37's narrowing), and a connected
component is only excluded as a likely marker when it's both near-square
*and* within a plausible marker size range, regardless of its color.

**Caught and fixed a real bug in the fix itself before shipping it**: the
first version of the shape check used the axis-aligned bounding box from
`cv2.connectedComponentsWithStats`, which is misleading for a genuinely
elongated feature drawn on a terrain card that's itself rotated on the
board (confirmed one flagged piece's card is rotated -54.6°) — a long
thin shape at roughly 45° can have an axis-aligned bounding box that
looks close to square even though the shape itself isn't, which would
have wrongly triggered marker exclusion on real terrain again. Caught
this by checking a specific flagged piece's *actual* dimensions before
trusting the fix, not just spot-checking pass/fail — found a 10x2.6 inch
genuinely elongated shape reporting as an 8x7.8 axis-aligned box, clearly
wrong. Switched to `cv2.minAreaRect` (the true oriented bounding box,
correct regardless of the card's own rotation) for the aspect/size check
instead, and reverified the same piece reports its real 10.05x2.59in
dimensions (aspect 3.89) correctly.

Re-ran across all 42 maps: 1132 keep-out shapes (essentially back to
v0.36's original 1162 before any marker-related change, as expected,
since the hue range is restored to the same scope and only a small
number of genuinely marker-shaped clusters get excluded now). Zero-shape
piece rate is back to 9.2%, in line with the original 8.4% baseline
before any of this — not the elevated rate v0.37 introduced. Both
flagged pieces (`terrain_10`, `terrain_5` on `purge_mirror_c`) now
correctly show 2 real feature shapes instead of 0. Re-verified placement,
terrain rejection, unit templates, and vehicle placement all still work
correctly.

**One remaining nuance worth being upfront about, not a full fix**: a
marker icon that's physically touching or immediately adjacent to a
genuine terrain feature can still get merged into the same connected
component (since they're literally touching pixels), which can pull a
somewhat larger area into that piece's keep-out shape than the terrain
alone would justify. This is a real, smaller-scale version of the
original problem, not fully solved — cleanly separating a marker from
directly-adjacent terrain would need per-pixel segmentation within a
merged blob, not just whole-component exclusion. Worth a manual review
pass on pieces where this could matter, same as other draft-quality parts
of this pipeline.

**v0.37 — objective marker icons were contaminating terrain keep-out
extraction.** Reported directly: circular/diamond objective markers
(white skull or eye on a colored background, white ring border) were
getting partly swept into nearby terrain pieces' keep-out shapes, because
they're a similar-looking green to what the extraction was treating as
terrain feature coloring.

Traced this down by sampling actual pixel colors rather than guessing at
a fix. Found the marker icons have a specific, extremely consistent
teal-green — measured at ~(17,103,87) RGB across many separate instances
on multiple maps — and confirmed several marker locations fall directly
within existing terrain cards' footprints (their positions on the board
often put them on or right next to real terrain), which is exactly how
`extract_terrain_keepout.py`'s per-card hue sampling was picking them up
as if they belonged to that card's feature. Checked genuine terrain
feature colors the same way, not assumed: every real feature pixel
sampled across several maps was yellow/gold (~30-50deg hue) — the
script's "yellow/gold and green" description of what real terrain feature
coloring looks like turned out to be wrong on the "and green" part. Ran a
broader check specifically for a genuine "true green" terrain signal
(85-155deg hue, well clear of both the yellow/gold band and the marker's
150-190deg band) across several more maps before trusting this and found
essentially nothing there — order of 10 pixels total, consistent with
antialiasing noise, not a real category.

Fixed with two layers in `extract_terrain_keepout.py`: the feature hue
range now excludes the marker's 150-190deg band entirely, plus an
explicit RGB-distance exclusion against the marker's specific measured
color as a second safeguard for any blended/antialiased edge pixels that
might survive the hue narrowing alone. Re-ran across all 42 maps: total
keep-out shapes dropped from 1162 to 639 (a real, large reduction,
confirming a lot of what was previously detected was marker
contamination) and the production bundle shrank accordingly (708KB →
483KB minified). Re-verified placement, terrain rejection, base overlap,
unit templates, and vehicle placement all still work correctly against
the corrected data.

**A known, honest limitation from this fix, not swept under the rug**: a
handful of pieces that previously appeared to have a detected feature —
because that "feature" was actually just marker contamination — now
correctly show zero real shapes after filtering. Since
`terrainKeepOutShapes()`'s fallback for zero shapes is "block the whole
card" (the existing conservative default for extraction genuinely finding
nothing at all), these specific pieces are, for now, still fully blocked
rather than recognized as genuinely featureless. Distinguishing "found
nothing because there's really nothing there" from "found nothing because
the only thing found was noise/contamination now correctly discarded"
would need the extraction to track that distinction explicitly, which it
doesn't yet — noted as a real gap for the next manual review pass rather
than quietly accepted as fine.

**v0.36 — terrain keep-out shapes now trace the actual yellow/green
coloring, not a bounding rectangle around it.** A real correction from
v0.32's approach, not a refinement of it: that version extracted an
oriented rectangle per feature cluster (`cv2.minAreaRect`), matching how
`terrain_v4.py` already extracts the outer card. Reasonable first guess,
but wrong for this specific case — a terrain feature has no real
footprint or bounding box in the rules, the coloring in the art *is* its
literal physical position, and a rectangle around an irregular pipe run
or an L-shaped strut claims space the feature doesn't actually occupy.

`scripts/extract_terrain_keepout.py` now traces each feature cluster's
real contour (`cv2.findContours` + `cv2.approxPolyDP` to simplify the raw
pixel-level boundary into a reasonable polygon) instead of fitting a
rectangle to it. No schema change needed — `keepOutFootprints: Point[][]`
already supported arbitrary polygons, and `geometry.ts`'s
`isBaseOverlappingPolygon`/`isBaseFullyInPolygon` (ray-casting +
edge-distance) already work on any vertex count, not just 4 — only the
extraction script and re-run data changed.

Checked the actual improvement numerically before calling this done, not
just assumed a "real shape" must be better than a box: total keep-out
area across a sampled map dropped from ~36% of card area (rectangles) to
~16% (traced contours) — a large, real change, and much closer to the
~6% true pixel-level feature fraction measured directly. Also checked
point-level precision specifically (sampled points inside the extracted
polygons, checked how many are genuinely feature-colored in the source
image) and found it caps out around 55-58% regardless of how tight the
simplification tolerance is — tested down to 0.1% of contour perimeter
with no meaningful gain. That's a real geometric limit, not a tuning
miss, worth being upfront about: a single simple polygon tracing the
outer boundary of an irregular, branching shape (a bent pipe run, or
several small elements merged into one connected component) necessarily
fills in the concave notches between branches, since a polygon's
interior is everything its boundary encloses. Exact concave/hole
representation would need multi-ring polygons or a raster mask, not a
plain point list — out of scope here, but documented in the script for
whoever touches this next.

Re-ran across all 42 maps (630 pieces, same 1162 shapes as before — the
clustering/detection logic didn't change, only how each cluster's shape
gets represented). Re-verified placement, terrain rejection, vehicle
blocking, base overlap, unit templates, and Sagitaur's art all still work
correctly against the new geometry — nothing else needed to change since
the containment/overlap math was always polygon-general.

**v0.35 — bases can't overlap, Sagitaur art, Hormagaunt squad size
restriction.**

**Bases can't overlap** (`src/data/geometry.ts`): a genuinely new rule,
not a variant of the terrain/zone checks. Added `doBasesOverlap` (any two
arbitrary base shapes, reusing the existing polygon-overlap math rather
than a new intersection algorithm per shape-pair) and
`isPathOverlappingOtherBases` (the same segment-sampling approach the
vehicle/terrain tunneling fix uses, so a fast drag frame can't jump clean
over another base). Wired into placement (single base and formations,
all-or-nothing across a formation's models), continuous dragging (both
free drag and Turn 1 movement — applies to every unit, not just vehicles,
since two physical models can't occupy the same space regardless of
type), and selection rotation (rejected as a whole if it would swing a
member into another token). The ghost preview shows invalid on overlap
too, via the same check the real placement uses.

Verified the math directly first — circle-circle, circle-oval, rect-rect
all matched hand-computed expected results exactly (a 32mm-circle overlap
boundary lands at precisely 2x its radius) — then through the running
app. Hit two real test-methodology traps along the way, both caught and
fixed before trusting results: clicking within ~10px of an existing
token was landing on its own hit-target (selecting it) rather than
attempting a new overlapping placement; and a "farthest from origin"
heuristic in a test script for identifying "which token moved" during a
drag was picking the wrong (stationary) token entirely, since it happened
to end up farther from the drag's start than the token that had actually
moved and gotten blocked. Once corrected: placement is rejected exactly
within the true overlap boundary and succeeds just outside it; a drag
toward another token stops with the stationary token completely
unchanged (0.0px) and the two final positions 24.7" apart -- outside the
16.66px boundary, confirming it was stopped before actual contact, not
after.

**Sagitaur art**: real art provided and processed through the same
background-removal pipeline (`scripts/remove_bg.py`) used for the
Hormagaunt. Checked the output before trusting it — border alpha is
effectively zero (max value 1/255, negligible feather blur, not a real
leftover-background issue) and there's no fragmentation punched through
the vehicle body. `Unit.imageSrc` now points at
`/unit-art/sagitaur.png`.

**Hormagaunt squad sizes**: added `Unit.validSquadSizes` (`[10, 20]` for
Hormagaunts) to restrict the palette's formation offerings to a unit's
actual composition options, rather than every generic formation that
happens to share its base size — previously any 25mm-based unit saw the
same x5/x10 options `TokenPalette` offered for the base size generically.
Added a new `unit_25mm_20` formation (4 ranks of 5, extending the
existing "N ranks of 5" convention rather than inventing a new layout
shape) since nothing above x10 existed before. Verified: selecting
Hormagaunt now shows only x10 and x20 (x5 correctly gone), a generic
(no-unit) 25mm selection still shows all three sizes unaffected, and an
actual 20-model placement produces exactly 20 tokens under one shared
group label without tripping the new overlap check against its own
members.

**v0.34 — reverted true-incremental movement tracking, added Spacebar
checkpoints for intentional multi-leg moves.**

Real usability feedback on v0.30's "measure actual distance traveled"
fix: it was technically correct (didn't undercount wandering) but made
normal placement unusable — nudging a token back and forth while lining
it up exactly ate into its Move budget the same as a genuine
repositioning would, since every bit of back-and-forth was permanently
counted. Real tabletop measurement doesn't work that way either: what
counts is where the model finally comes to rest, not the wobble of the
hand carrying it there.

Reverted to a simpler model: each leg's distance is the straight line
from the last *committed* waypoint to wherever the token currently is,
recomputed live every frame (not accumulated) — `handleTokensMove` in
`DeploymentView` went back to this, and the `dragTrackedPos`/
`dragUsedThisLeg` refs and `liveLegDistance` state from v0.30/v0.31 are
gone entirely, since there's no incremental tracking left to need them.

Genuine multi-leg movement (routing around an obstacle) is now something
the person does on purpose instead of something the app tries to infer
from mouse wandering: hold **Space** while dragging to drop a checkpoint
without releasing the mouse. `MapView` has a `onCheckpoint` prop, fired
by a `keydown` listener (attached once, reading current props via refs
kept updated every render rather than re-attaching the listener on every
token-position change during a drag) that's active only while a token
drag is genuinely in progress. `DeploymentView`'s `handleCheckpoint`
commits the dragged token(s)' current position as a real new
`MoveWaypoint` — refusing to (with the same "can't end on top of
terrain" rule a real release uses) if the checkpoint spot is illegal —
and on success, `MapView` resets its own drag-start reference to the
checkpoint, so the still-continuing gesture measures as a genuinely fresh
leg from there rather than from the original grab point.

Verified precisely: pressing Space mid-drag correctly committed the
current leg (`2.0"` before and immediately after the checkpoint, same
number, confirming nothing changed at the moment of checkpointing) and
continuing to drag further without releasing the mouse correctly
accumulated as a new leg on top of it (`4.0"` total), with the resulting
polyline showing exactly 3 real waypoints (start, checkpoint, end) — a
genuine bend, not a straight line. Separately confirmed the original
complaint is fixed: two tokens moved to the identical net displacement,
one via a direct drag and one via an out-and-back wander first, now
report identical distance (`0.5"` both), where before they would have
differed.

**A real lesson from testing this, worth being honest about**: chasing
what first looked like a broken drag (a token appearing "frozen," not
responding to any further mouse movement) turned out to be a bug in my
*own test*, not the app — the test measured a token's screen position
*before* clicking "Begin Turn 1," but that transition hides the
placement palette sections and reflows the board, shifting where
everything renders on screen. Comparing a pre-transition position against
post-transition token positions made it look like the drag wasn't
working at all. Traced it down with temporary debug logging (confirmed
`handleTokensMove` wasn't even being called — meaning the click was
landing on empty space, not the token) before accepting it as a real
bug, found the actual cause, fixed the test, and reconfirmed clean.

**v0.33 — full screen toggle, and the overlay checkbox moved to the right
side of the map controls row.**

Fullscreen: a button in the app header (right-aligned, all tabs, not just
the board) using the real browser Fullscreen API
(`document.documentElement.requestFullscreen()` /
`document.exitFullscreen()`), with its icon and title synced to actual
fullscreen state via a `fullscreenchange` listener — not just toggled
optimistically on click, so it stays correct if the person exits via Esc
or the browser's own UI instead of the button. Verified both directions
directly: `document.fullscreenElement` flips correctly on click, and
separately, exiting via `document.exitFullscreen()` (simulating an
external exit) correctly flips the button back to "Enter full screen"
too, confirming the listener actually re-syncs state rather than only
working for the click path.

Overlay checkbox ("Show deployment zones / terrain overlay") moved from
the left side of `MapView`'s control row to the right, now grouped
together with the zoom controls in one right-aligned cluster instead of
being split across both ends of the row.

**A real lesson from testing this, not a bug in the app itself**: adding
the header's fullscreen icon (an inline `<svg>`) shifted which SVG on the
page is "the first one" — irrelevant to the actual application, which
never queries SVGs by DOM order anywhere (checked directly, zero
matches), but it broke my own test scripts, which had been using
`page.locator("svg").nth(0)` as a shortcut for "the map" throughout this
whole project. Caught this immediately rather than shipping on faith: a
regression check showed placement "failing" against a previously-known-
good screen position, investigated before assuming the app broke,
found the real cause (my test locator was now grabbing a 15x15 icon, not
the 993x785 map), fixed the test, and confirmed placement, unit
templates, and Turn 1 mode all still work exactly as before.

**v0.32 — terrain keep-out was blocking the whole walkable card, not
just the actual feature.** Traced to a real design mistake from earlier
in this project, not a shape-specific bug: `terrain_v4.py`'s own comment
explicitly says it targets "the grey footprint card itself... not the
decorative art/features sitting on top of it," on the assumption the
card was what gameplay cared about. That assumption was wrong — the card
is walkable; only the decorative feature actually sitting on it (yellow/
gold and green tones in this art style — support struts, pipework,
wreckage) blocks placement. Oval and rectangle bases surfaced this more
often just because they're bigger and more likely to overlap *something*
within an oversized footprint, but every base shape had the same
underlying problem.

Checked the real pixel data before writing any extraction code: sampled
a terrain footprint's per-pixel color and ran connected-components on a
yellow/green hue mask rather than assuming a threshold — the genuine
feature area turned out to be a small fraction of the card (5.8% in the
piece checked first), split across many separate clusters rather than
one blob. Built `scripts/extract_terrain_keepout.py` on that basis: for
each already-known card, finds yellow/green connected components above a
noise-filtering size threshold and fits an oriented rectangle to each one
(same method `terrain_v4.py` already uses for the outer card, for
consistency) — one card can now have several separate keep-out shapes,
not one shape covering everything between them. Ran across all 42 maps:
630 terrain pieces → 1162 keep-out shapes. The ~8% of pieces where no
feature was detected at all fall back to the whole card as a
conservative default, same behavior as before this fix, rather than
silently having zero enforcement on what might still be genuinely solid
terrain.

Added `TerrainPiece.keepOutFootprints` (one or more oriented rectangles)
alongside the existing `corners` (now correctly understood as just the
walkable card). `isBlockedForMovement` / `cannotEndOnTerrain` in
`geometry.ts` now check the tighter shapes via a shared
`terrainKeepOutShapes()` resolver instead of the whole card.
`MapView` renders the card as a faint dashed reference outline and the
keep-out shapes with the actual blocking visual (the existing heavy/light
styling) so it's visually obvious which part is walkable. Also added a
read-only keep-out overlay to `tools/terrain-editor.html`, so a manual
card-boundary correction can be made with visibility into where the real
blocking geometry sits, even though this tool doesn't edit the keep-out
shapes themselves yet.

Verified directly at the geometry level before trusting it in the app: a
32mm circle, a 120x92mm oval, and a 105x68mm rectangle all correctly walk
on a card when clear of its feature geometry (previously all three were
blocked), and all still correctly get rejected when actually overlapping
a keep-out shape. Confirmed end-to-end through the running app too —
scanned a real board for valid/invalid oval placement spots, placed
successfully on a walkable-card spot, and separately confirmed placement
directly on a keep-out feature is still rejected with the same error
message as before. Re-ran the existing vehicle-tunneling, multi-leg
movement, and undo-last-leg regressions afterward — all still produce
correct results under the corrected terrain data.

**v0.31 — three real bugs in the v0.30 incremental-tracking rewrite,
found by direct feedback and fixed, plus an "Undo last leg" button.**

All three reported issues traced back to the same root cause: mutating a
ref or an outer-scope Map *inside* a `setState` updater callback, then
reading it again immediately afterward, assuming the updater had already
run. React does not guarantee that ordering. A real drag fires many
`mousemove` events, often several within a single render cycle, so this
wasn't a rare edge case — it was happening on essentially every drag.

1. **Arrow not shown during drag** and **2. budget enforced after the
   fact, letting a token move outside its range** — both were the same
   underlying issue: `handleTokensMove`'s move-mode branch mutated
   `dragUsedThisLeg` (the running distance-used tracker) inside
   `setTokens`'s updater, then immediately called `setLiveLegDistance`
   reading that same ref, assuming it was already up to date. Fixed by
   restructuring so ALL clamping math and ref mutations happen in a plain
   loop first, and `setTokens`/`setLiveLegDistance` are only called
   afterward with results that are already known-correct — removing any
   dependency on updater-callback timing. Verified with a wandering-drag
   test (out to +25px, back to +8px, all one gesture): the label now
   reads identically (`2.8" / 10"`) whether checked mid-drag or after
   release, where before the fix these two readings genuinely disagreed
   (`2.6"` vs `2.8"`) even with generous settle time between checks,
   confirming it was a real ordering bug and not test-timing noise.
2. A closely related second instance of the *exact same* anti-pattern
   turned up while implementing the undo feature below (`handleUndoLastLeg`
   mutating a `reverted` Map inside `setMovePaths`'s updater, then reading
   it right after) — caught by testing undo specifically before trusting
   it, not assumed safe by similarity to the already-fixed code. Same fix
   applied: compute first, setState after.
3. **New: "Undo last leg" button**, enabled whenever the current
   selection has a committed leg to undo (more than just its turn-start
   point on its path). Pops the last waypoint and reverts the token's
   position to whatever's now the new last point — the correction
   mechanism for "that leg went around the wrong side of the ruin," retry
   with a fresh drag from the reverted point.

Also fixed a bug in the underlying data model surfaced while chasing all
this down: committing a leg previously stored only its start/end
*positions*, and total distance was recomputed as a straight line between
committed waypoints after the fact -- which silently discards any
wandering distance actually spent within that leg, understating how much
Move a later leg has left. Added `MoveWaypoint` (`{pos, distUsed}` in
`src/data/placement.ts`) to store each leg's real tracked distance
explicitly instead of recomputing it from positions.

Re-verified the v0.29/v0.30 regressions after all of this — multi-leg
cumulative tracking (two separate legs, `5.6" / 10"`) and the v0.27
vehicle-tunneling test — both still produce the exact same correct
results.

**v0.30 — movement now measures actual distance traveled, not net
displacement.** A real gap in the v0.29 multi-leg system, caught before
it shipped further: each *leg* (one continuous drag gesture) was tracked
correctly as its own segment, but *within* a single gesture, the clamp
recomputed "distance from the leg's start to wherever the mouse currently
is" fresh on every frame. Since the token visually follows the mouse in
real time during a drag, that's wrong the moment the mouse doesn't move
in a perfectly straight line — move out and partway back within one
continuous gesture and the old code would only charge the short net
displacement, even though the token visibly slid along the whole longer
path to get there.

Fixed by tracking real incremental distance instead: `DeploymentView` now
keeps a ref (`dragTrackedPos`) of where each dragged token's accounting
actually left it, and on every frame adds the *actual* frame-to-frame
movement to a running total (`liveLegDistance`, real state since the
measuring arrow's label needs to reflect it). Once that running total
hits the remaining budget, further mouse movement in *any* direction
stops moving the token — wandering can't buy back reach, and moving the
mouse back toward the start doesn't refund distance already spent.
`MapView`'s arrow label now prefers this tracked value over recomputing a
straight-line estimate, since the straight-line number would understate
things exactly when it matters most (an in-progress wandering drag).

Verified with precise numeric comparisons, not just visual inspection:
dragged out to a net +25px (read `1.6"`), then *without releasing*,
wandered back to a net +8px from the start — read `2.8"`, more than
double a *fresh* straight +8px drag measured separately for comparison
(`1.3"`), confirming the extra out-and-back distance is genuinely being
counted, not discarded. Separately verified the budget-lock case
specifically: dragged a token 400px out (exhausting its full 10" Move),
then continued the same gesture back to within 5px of the origin — the
token stayed stuck 148px from the origin, exactly where its budget ran
out, rather than snapping back toward the mouse's final position. Re-ran
the v0.29 multi-leg cumulative test (two separate legs, `5.6" / 10"`) and
the v0.27 vehicle-tunneling regression afterward — both still produce
the same correct results under the new accounting.

**v0.29 — multi-leg movement: "left a bit to get around the ruin, then
straight down" now tracks correctly.** Previously, Turn 1 movement
measured straight-line distance from a single fixed origin (wherever the
token started the turn) to wherever it currently is — which understates
real distance traveled the moment a unit takes anything but a single
straight line, and doesn't match how vehicles actually have to route
around obstacles.

Replaced the single `moveOrigins: Map<string, Point>` with
`movePaths: Map<string, Point[]>` — each token's full sequence of
committed waypoints this turn, starting as a single point and gaining a
new one every time a drag gesture ends somewhere legal (`MapView`'s
`onDragEnd` → `DeploymentView`'s `handleDragEnd`, which was already the
right place for this since it's also where the "can't end on terrain"
revert check lives). The clamp during an active drag now measures
distance from the *last committed waypoint*, against *remaining* budget
(Move stat minus every already-committed leg's length), not from the
turn's original start against the full allowance every time. The
measuring arrow draws the whole path as a real multi-point polyline (with
small dots at each bend) rather than a single origin→current line, and
its label shows total cumulative distance across every leg, not just the
current one.

Verified with a three-leg sequence on the Hormagaunt (Move 10"): leg 1
alone read `2.7" / 10"`; leg 2, a completely separate drag gesture in a
different direction, read `5.6" / 10"` — confirming it's tracking
*cumulative* total, not resetting or measuring only the current leg; leg
3 attempted a deliberately huge jump and clamped at exactly `10.0" / 10"`,
confirming the remaining-budget math is exact even after two prior legs.
Also confirmed the arrow polyline itself has exactly the right number of
distinct points for a 2-leg move (found and fixed a minor duplicate-point
rendering artifact along the way — harmless numerically, but worth
cleaning up). Re-ran the vehicle-tunneling regression test from v0.27
against the new path-based system and confirmed it's still fully blocked
by heavy terrain, unaffected by the movement-tracking rework.

**v0.28 — Sagitaur Move stat confirmed: 12".** Updated `move_in` in
`src/data/units/units.ts` from unset (falling back to `DEFAULT_MOVE_IN`,
6") to the real value. Art is still pending. Verified via the actual
Turn 1 movement-phase label, not just by reading the source change back:
dragged a placed Sagitaur far past any reasonable distance and confirmed
the distance readout clamped at exactly `12.0" / 12"`, not 6" or
anything else.

**v0.27 — rectangle bases for vehicles, the Sagitaur, and a real
terrain-tunneling bug caught and fixed along the way.**

Added `"rectangle"` as a third `BaseShape` alongside circle/oval — many
vehicles don't come on a circular/oval base at all, just their own hull
footprint. `Token.tsx` renders it as an actual `<rect>`; `geometry.ts`'s
containment/overlap checks got a shared boundary-sampling helper so oval
and rectangle both work through the same code path (rectangle samples
points along all 4 edges rather than an elliptical curve). Also made
`Unit.imageSrc` and `Unit.move_in` optional — a unit can now be drafted
with its physical footprint and vehicle/infantry classification locked in
before art or a confirmed Move stat exist, falling back to a plain
owner-colored shape and `DEFAULT_MOVE_IN` respectively, same pattern
generic base placements already use.

**The Sagitaur**: a 105mm x 68mm rectangular-hull vehicle (`isVehicle:
true`). No art or Move stat provided yet, so both are left unset
intentionally — replace them in `src/data/units/units.ts` once you have
the real values; everything else (base shape, placement, terrain rules)
works correctly without them.

**Caught and fixed a real bug while testing the vehicle-blocks-on-heavy-
terrain rule specifically** (this is the kind of bug that only a vehicle
base could have exposed — the Hormagaunt, being infantry, never exercises
the blocking path at all): the movement-blocking check only evaluated
each drag frame's *destination* point, computed fresh from the original
drag-start position on every mousemove. A vehicle could "tunnel" straight
through a terrain piece if two consecutive mouse samples happened to land
on either side of it without any single sample landing squarely inside —
verified this concretely with a dense, 100-step drag straight through a
confirmed heavy-terrain piece: the vehicle reached its target essentially
untouched (0.9px short of a 1013px total distance) instead of stopping at
the wall. Fixed with `isPathBlockedForMovement` in `geometry.ts`, which
samples the whole segment from the token's actual current position to the
candidate (spaced every 0.25", not a fixed sample count, so a long jump
in one frame gets proportionally more samples) rather than just the
endpoint. Re-ran the identical test after the fix: the vehicle now stops
about a third of the way in (334px of 1013px) and can't be dragged past
the obstacle. Re-verified infantry still passes through the same terrain
completely freely (0.95px short of target — no change from before),
confirming the fix didn't overcorrect into blocking infantry too.

**v0.26 — terrain identification (light/heavy by color) and a two-rule
keep-out system.**

**Classification** (`scripts/classify_terrain.py`): samples the actual
source-image pixels inside each already-extracted terrain footprint and
classifies by mean color saturation. Checked the real distribution across
all ~630 existing terrain pieces before picking a threshold rather than
guessing one — it isn't cleanly bimodal, but there's a distinct tight
cluster of near-zero saturation (grey/stone, ~26% of pieces) before a
long, gradual tail of more colored pieces; landed on S=0.12 as the split
point. Grey/low-saturation reads as heavy (solid stone/concrete — walls,
ruins); more saturated colors read as light (rubble, pipework, other
terrain). This is a heuristic, not a verified per-piece classification —
same caveat as the rest of the terrain pipeline. Also caught and filtered
a real data-quality issue while building this: 24 of the original 654
terrain pieces turned out to be false positives from the original
extraction — small, highly-saturated red/blue blobs matching the app's
own deployment-zone marker-icon colors (the "X" no-go icons) to within a
few RGB units, not real terrain. Dropped entirely rather than classified.

**Keep-out is two separate rules, not one** — this changed mid-session
after an important correction: heavy terrain blocks *movement* only for
vehicles (infantry can move through it freely), light terrain blocks
movement for nobody, but *no unit of any type can end a move on top of
any terrain*, light or heavy, except future multi-level terrain (not
modeled yet). The first version of this feature only had the second rule
and applied it universally including mid-drag, which was wrong. Fixed by
splitting `geometry.ts` into `isBlockedForMovement` (vehicle+heavy only,
checked continuously during a drag) and `cannotEndOnTerrain` (universal,
checked once at drag-release via a new `MapView` → `DeploymentView`
`onDragEnd` callback, reverting to the pre-drag position if the release
point is illegal) plus at placement time (which is inherently an instant
"end position," so it always uses the universal rule regardless of unit
type). Added `Unit.isVehicle` (defaults false/infantry — the permissive
default, matching generic base placements with no unit data at all).

Verified thoroughly: the 9-way combination (heavy/light/open-ground ×
infantry-movement/vehicle-movement/end-position) checked directly against
real terrain data before trusting it in the app — all 9 came back exactly
right. End-to-end: dragged a generic (infantry-like) token straight
*through* a confirmed terrain-covered point without it getting stuck,
then separately confirmed releasing directly on that same point reverts
the token to its pre-drag position with an error shown. Cross-validated
the ghost preview's color-coding against actual placement outcomes at
specific points rather than trusting them independently. One real test
mistake caught along the way: an early check assumed a terrain piece's
screen position from its board-inch coordinates using a fraction-based
guess that happened to work for one piece (its board position was
coincidentally near the exact center on both axes, which is invariant
under the board's rotation) but didn't generalize — resolved by scanning
the actual ghost-preview validity across the board instead of guessing
coordinates.

**v0.25 — investigated the oval-placement "bug" (it isn't one, with
proof), switched zoom to Alt+scroll.**

**Oval buffer near zone edges — reported as a bug, turned out to be
correct.** Rather than assume the report was right and start changing
geometry code, checked it first: bisected the exact transition point
between "can place" and "can't place" against a synthetic zone using the
real `isBaseFullyInPolygon` function, at both 0° and 90° rotation. Got
**2.3622"** at 0° and **1.8110"** at 90°, matching `120mm ÷ 2 ÷ 25.4` and
`92mm ÷ 2 ÷ 25.4` to four decimal places — exactly the oval's own
half-width and half-height. The "~2 inch buffer" is the base's real
physical footprint, not a miscalculation: a 120mm-wide base genuinely
can't have its center closer than half that width to a zone edge without
part of it sticking outside the zone, and the check correctly gets easier
by ~0.55" when the base is rotated to present its narrower profile.
Nothing was changed here — loosening the check would make it
*geometrically wrong*, letting bases legally overlap a boundary they
shouldn't. If placement flush to an edge is actually wanted regardless of
real footprint, that's what the Infiltrators toggle is for.

**Zoom control: Alt+scroll instead of click buttons.** The +/− buttons
are gone; scrolling with Alt held zooms 100%-400%, plain scroll and
Ctrl/Cmd+scroll no longer do (previously Ctrl/Cmd was the zoom modifier —
now only Alt is). A "Reset" button remains for jumping straight back to
100% (a different, less repetitive action than Alt+scrolling back down
tick by tick), alongside a small `Alt+scroll to zoom` hint replacing the
buttons' visual affordance. Verified directly: plain wheel and Ctrl+wheel
now leave the rendered size unchanged, Alt+wheel changes it and updates
the percentage readout correctly (100% → 125% after one tick), and
existing plain-wheel behaviors (ghost rotation while placing, selection
rotation) still fire normally since they're unaffected by the modifier
-key check ordering.

**v0.24 — zoomable map, 100%-400%, for precise placement.** Zoom
controls (+/−/reset buttons, plus Ctrl/Cmd+scroll — which also covers
trackpad pinch-to-zoom, reported by the browser as a wheel event with
`ctrlKey` set) in the map header. The map's scroll container uses native
`overflow: auto`, so panning around a zoomed-in board is just normal
browser scroll/trackpad behavior — no custom drag-to-pan gesture needed,
which also sidesteps a conflict with the existing marquee-select
click-drag.

This went through two real bugs before landing correctly — worth being
specific about both rather than just claiming it works:

1. **A genuine app bug.** The first implementation mixed CSS `object-fit:
   contain` (for "fit the board to the container" at 100%) with a
   separate CSS `transform: scale(zoom)` (for zooming) on the same `<svg>`
   element. Measured with Playwright, not just eyeballed: placement was
   pixel-perfect at 100%, but developed a growing, axis-specific error at
   higher zoom (dx=0, dy=77.5px at 400%) — the two scaling mechanisms
   don't compose the way it looks like they should. Fixed by computing
   explicit rendered pixel dimensions directly (measuring the container
   via `ResizeObserver`, then `width = boardWidth * fitScale * zoom`) and
   dropping both `object-fit` and the CSS `transform` entirely — plain
   SVG viewBox-to-viewport scaling, which `getScreenCTM()` has handled
   correctly everywhere else in this app.
2. **A test-methodology mistake I caught before believing the bug was
   real.** After the fix, a retest still showed the same growing error at
   high zoom. Chased it all the way down to comparing the browser's own
   `getScreenCTM().inverse()` output against an independently hand-computed
   matrix inverse (they matched exactly, ruling out the CTM math) before
   realizing the actual issue: the test clicked a *fixed small pixel
   offset* from the SVG's corner, which at high zoom still landed in the
   map image's title/margin area outside the actual board polygon —
   correctly triggering the existing boundary-clamping logic
   (`Math.max(0, Math.min(...))` in `toBoardIn`), not a placement bug.
   Confirmed by re-clicking a point guaranteed to be inside the board
   interior at the same zoom level: exact 0.00px error.

Verified the real fix precisely: pixel-perfect placement (0.0px error) at
100%, 200%, and 400% zoom, confirmed with clicks safely inside the board
polygon each time. Full regression pass combining zoom with other
features in one sequence — placing a unit-template formation while
zoomed, then starting Turn 1 and dragging a token while still zoomed
(distance-measurement arrow read a sensible `2.7" / 10"`, confirming
movement math is correctly zoom-agnostic) — all clean.

**v0.23 — Turn 1 movement phase: locked positions, a measuring arrow, and
a real Move stat.** `Unit` gained a `move_in` field (Hormagaunt: 10", per
the actual rule) — the first real stat beyond art, and `DEFAULT_MOVE_IN`
(6") covers generic base placements that have no unit data to draw a real
number from. "Begin Turn 1" in the palette snapshots every token's current
position as its movement origin, switches the palette into a
placement-locked mode (the Unit dropdown, unit templates, and single-base
sections all disappear — no new deployments once movement starts), and
from then on dragging a token is clamped to a circle of radius `move_in`
around *that specific origin*, not wherever the token happened to be a
moment ago (it can be dragged multiple times in one turn; the limit is
always against the turn's start, not the last drag). A measuring arrow
(with an SVG `<marker>` arrowhead) is drawn live from origin to current
position with a `"X.X" / Y"` distance label, turning from the normal
accent color to a warning color once a token hits its cap.

Clamping is a straightforward vector scale — if the requested drag
distance exceeds the allowance, scale the origin→requested vector down to
exactly the allowed length — applied per-token independently even during
a multi-select group-drag, so a mixed selection of units with different
Move stats behaves correctly (each stops at its own limit) rather than
enforcing a single uniform cap. "Back to Deployment" flips the palette
back to normal and clears the movement origins, so placement resumes and
a subsequent "Begin Turn 1" re-snapshots from wherever things ended up.

Verified precisely rather than eyeballing it: dragging the Hormagaunt a
screen distance far larger than any reasonable interpretation of 10"
consistently produced a distance label reading exactly `10.0" / 10"`, not
something larger — confirmed the clamp is a hard ceiling, not just a
visual suggestion. Repeated the same test on a generic (non-unit) base
and got `6.0" / 6"`, confirming the default-allowance fallback works
independently of the Hormagaunt-specific stat. Caught a bug in my own
first version of this test, not the app: dragging twice in a row using a
stale pre-drag screen coordinate for the second attempt landed on empty
space (since the token had already moved) and silently started a
marquee-select instead of grabbing the token — fixed by re-reading the
token's actual current position between drags rather than assuming it
hadn't moved. Confirmed placement UI correctly disappears entering Turn 1
and reappears (and works) after returning to Deployment. Full regression
pass afterward — formation placement with labels, marquee-select,
group-drag, group-rotate — all still clean in deploy mode.

**v0.22 — mouse-wheel rotation for an existing selection, matching
placement rotation.** Scroll the wheel while hovering the board with a
selection active (and nothing armed) and it rotates the whole selection
15° per tick, exactly like scrolling rotates the ghost preview before
placement. It's the *same rotation model*, not a separate one: a
formation's models rotate as a rigid body around the group's own
centroid, repositioning relative to each other, not just spinning each
one in place independently. One function (`handleRotateSelected` in
`DeploymentView`) now handles both the palette's rotate buttons and the
new wheel gesture, and correctly covers single-token selection too
without a special case — the centroid of one point is that point itself,
so its position-offset-from-centroid is `(0,0)`, which rotates to `(0,0)`
regardless of angle. Only its own `rotationDeg` changes, which is exactly
"rotate in place."

Verified geometrically, not just "it looks about right": selected two
tokens spread apart, rotated the group 30° (two wheel ticks), and
confirmed the centroid stayed at the exact same point (279.1, 618.5 both
before and after) and the distance between the two tokens was exactly
preserved (233.6 both before and after) — the two invariants that define
a rigid-body rotation, rather than some other transformation that
happens to look similar. Separately confirmed single-token selection
stays position-locked (identical `cx`/`cy` before and after) while its
own rotation transform shifts by exactly 15° per tick. Full regression
pass afterward — placement-time rotation, formation placement with
labels, marquee-select, group-drag, single-token select/rotate/delete —
all still clean.

**v0.21 — click-drag multi-select and group-drag.** Click-drag over empty
board space now draws a marquee selection box (dashed, accent-colored);
any token whose center falls inside it gets selected. Dragging any member
of that selection then moves the whole group together, maintaining every
token's position relative to the others — implemented as a single batched
update (`MapView`'s `onTokensMove` now takes an array of `{id, position}`
instead of one id/position pair) so a 10-model group-drag is one state
update, not ten sequential ones.

Selection is a plain `Set<string>` now (`selectedTokenIds`), replacing the
single-id `selectedTokenId` from earlier versions. No add-to-selection
modifier yet (shift-click, etc.) — every selection change replaces the
previous one, which covers "select a group, drag it" without the extra
complexity of modifier-key semantics; a natural next step if it's needed.

Getting the click-vs-drag distinction right took a real iteration, not
just a first attempt: the initial version let clicking (not dragging) a
member of an existing multi-selection leave the whole selection
untouched, tested that specifically, and it failed — the standard Finder/
Explorer convention is that a *plain click* (no real movement) on an
already-selected item narrows the selection down to just that one, while
a *drag* moves the whole group; both need to start the same way (since
you don't know which one it'll be at mousedown time) and the decision has
to be deferred to mouseup based on whether the pointer actually moved
past a small threshold. Fixed by tracking that threshold explicitly and
re-tested: marquee-select 3 → plain click one of them → confirms down to
1 selected; marquee-select again → drag → confirms all 3 move together by
the exact same pixel delta; click empty space → confirms selection
clears. Full regression pass afterward (all three tabs, unit-template
placement with letters, single-token select/rotate/delete) still clean.

**v0.20 — one label per group, not per model.** A 10-model Hormagaunt
formation was rendering 10 overlapping copies of the same "Hormagaunt"
text directly on top of each other — reported directly, with two
reasonable fixes suggested (dedupe by proximity, or show on hover).
Went with a third option that's more robust than either: every
`PlacedToken` already carries a `groupId` (unique per single-base
placement too, shared across every model in one formation placement), so
`MapView` now groups tokens by that id and renders exactly one label per
group, positioned at the group's centroid. This is more reliable than a
distance-based "nearby" heuristic — two separate 5-model units placed
close together stay visually and logically distinct (confirmed: placing
a second formation right next to the first produces 2 separate labels,
not 1 merged one), which a pure proximity threshold could get wrong in
either direction depending on how it's tuned.

Positioning the label below the *whole* formation (not just one member,
or the centroid alone) needed to account for every member's extent, which
surfaced a real bug in the first attempt: the offset was computed along
local-Y, but the board's rotation transform (`translate(H,0) rotate(90)`)
maps a local point `(x,y)` to screen `(H-y, x)` — meaning screen-Y equals
local-**X**, not local-Y, whenever the board is in its normal rotated
state. Measuring spread along the wrong axis produced a real number, just
not the one that answers "how far down does this formation extend on
screen," so the label landed mid-formation instead of below it. Fixed by
switching which local axis the spread is measured along based on
`isRotated`. Verified by comparing the label's screen bounding box
against every visible token's screen bounding box directly (not the
larger invisible hit-target circles, which are deliberately oversized for
easier grabbing and would give a misleadingly strict result) — confirmed
the label now sits below all 10 models.

**v0.19 — moved token labeling from a tiny in-token badge to a legible
name label below it.** The letter badge crammed inside each token (added
in v0.15) worked fine at the palette-icon scale it was designed at, but
was illegible at actual 25mm-base map scale — reported directly. Fixed by
removing label rendering from `Token.tsx` entirely (it's back to a pure
shape/image renderer) and rendering labels as a separate layer in
`MapView`, positioned below each token at a fixed, readable size rather
than one scaled down to fit inside a small circle. The label now also
shows the real unit **name** when known ("Hormagaunt") instead of just
the grouping letter, falling back to the letter for generic base
placements with no associated unit.

The label positioning uses the same counter-rotation trick the tokens'
own shapes already use to stay upright despite the board's 90° landscape
rotation: wrapping the label in a `<g transform="rotate(counterRotate,
cx, cy)">`, where `counterRotate` is specifically chosen to cancel the
outer board rotation, means a plain local "+y offset" lands directly
below the token on screen regardless of whether the board itself is
rotated — no separate direction-dependent math needed for the rotated vs.
unrotated cases. Verified this precisely rather than assuming the
derivation was right: placed a token, read the actual on-screen bounding
boxes of both the token and its label, and confirmed the label center
sits 16px directly below the token center (0.3px horizontal drift, purely
rounding noise) on a board that's rendered rotated.

**v0.18 — first real unit: the Hormagaunt, with actual art on the board.**
A new layer above the generic base-size system: `src/data/units/` defines
a `Unit` (name, faction, the one base size it actually comes on, token
art), separate from `BaseTemplate` (a shape) and `UnitTemplate` (a
formation with no identity) — this is a real named model now, not a
placeholder circle.

- **Background removal** (`scripts/remove_bg.py`): the source product
  photo had a white studio background. Flood-fills from the image border
  through "close to white" pixels, so only background actually connected
  to an edge gets removed — a pale part of the miniature itself (there's
  a lot of cream/pink coloring on this model) doesn't get punched into a
  hole just because its color happens to be fairly light, since it isn't
  touching the border. Feathers the cutout edge with a light Gaussian
  blur on the alpha channel afterward rather than leaving a hard-edged
  cutout. Caught a real bug while writing it: squaring color-distance in
  `int16` overflows past ~181 units of distance from white, wrapping to a
  negative value and making `sqrt()` return `NaN` for a chunk of the
  image — fixed by computing in `float32` instead.
- **`Token.tsx`** now accepts an `imageSrc`, clipped to the base's actual
  shape (circle or oval) via an SVG `clipPath`, cropped to cover rather
  than letterboxed (`preserveAspectRatio="xMidYMid slice"`). The
  owner-color tint that plain placeholder tokens get becomes a colored
  ring around the art instead of a flat wash over it, and the unit letter
  becomes a small badge in the corner (instead of dead-centered) so it
  doesn't fight with the art.
- **New "Unit" dropdown in the palette**: picking a unit locks the
  "Single base" and "Unit templates" sections down to just that unit's
  base size — for the Hormagaunt (25mm), that's 3 options instead of the
  full library of 10. Both the placed-token rendering and the ghost
  preview use the real art once a unit is selected, not just placement.

Verified thoroughly, not just "it looks right in one screenshot": alpha
channel checked numerically (background pixels α=0, a known pale patch of
the model α=255 despite being light-colored, ~34k pixels in an
intermediate feathered band confirming the blur worked rather than being
a hard cutout). Palette filtering checked by reading the actual rendered
button `title` attributes before/after selecting the unit and again after
reverting to "Generic base" (10 options → 3 → back to 10). Confirmed the
placed token is real art and not a silent fallback to the flat backdrop
color by cropping a screenshot to just the token and checking the pixel
color variance (a failed/fallback render would be a flat single color,
std≈0; the actual render came back with std≈26-36 per channel). Full
regression pass afterward — generic placement, unit-template formations,
select/rotate/delete — still clean.

**v0.17 — infiltrator zone check now covers the whole base, not just its
center point.** The original enforcement (`isInDeploymentZone`) checked
only whether a token's center point fell inside the zone polygon, which
meant a token could be placed flush against the zone boundary with up to
half its base physically poking outside — clearly wrong; no part of the
base may cross the deployment edge. Fixed in `src/data/geometry.ts`:

- **Circle bases** get an exact test: center inside the polygon AND the
  center is at least one radius away from every edge segment of the
  polygon. Together those two conditions guarantee the whole disk is
  inside, correctly even for the concave zone shapes some patterns
  produce (steps, notches).
- **Oval bases** get a sampled-boundary approximation (24 points around
  the rotated ellipse, all must be inside) — exact ellipse/polygon
  containment is substantially more math for a base shape that's a small
  fraction of placements.

Both the actual placement check (`DeploymentView`) and the ghost preview's
live color feedback (`MapView`) now call the same fixed function with the
real base template and rotation, so what the ghost shows and what
placement enforces can't drift apart.

Verified two ways: a direct numeric test of the geometry function against
a synthetic zone with a token positioned so its center was inside but its
edge crossed the boundary — old logic said valid (wrong), new logic
correctly says invalid, confirmed against the literal case that was
reported broken. Then confirmed in the running app: scanned the ghost's
fill color across a fine range of positions near a real zone boundary and
found a single clean, consistent valid→invalid transition (not erratic —
one flip, not several), with no regressions in the rest of the
placement/labeling/regression suite.

**v0.16 — UI design pass.** The app previously used a generic dark-mode
look (near-black background, blue accent) — functional, but not
distinctive, and close to the exact pattern generic AI-generated dark UIs
default to. Replaced with a design grounded in the actual subject (a
tactical deployment-planning tool, not a generic dashboard):

- **Color**: warm graphite background (`#16181a`, not blue-black) with a
  brass/amber accent (`#c9a227`, not the generic blue/green every dark
  dashboard reaches for) and warm off-white text (`#e9e6df`, not pure
  white) — reads as tactical-console hardware rather than "dark mode
  toggle was flipped." Attacker/Defender red/blue are untouched
  everywhere — those are functional colors tied to the actual
  deployment-zone art on the maps, not part of this decorative palette.
- **Type**: IBM Plex Sans (headings/body) + IBM Plex Mono (data — base
  sizes, coordinates, mission-pack labels) via Google Fonts, loaded in
  `index.html`. Verified the font files actually loaded in a real browser
  (`document.fonts.check()`), not just declared and silently falling back
  to `system-ui`.
- **Signature device**: a corner-bracket accent (`.bracket` in
  `src/index.css`) on selected/active elements — nav tab, selected
  disposition, armed palette item — a viewfinder/targeting reference that
  fits "deployment planning" rather than a decorative flourish with no
  connection to the subject.
- **Structure**: uppercase letter-spaced "eyebrow" labels for section
  headers throughout (the `.eyebrow` class) instead of plain `<h3>`s, a
  consistent card treatment for map thumbnails (`.map-card`, with a real
  hover state) replacing several different ad hoc layouts across
  `MapLibrary`/`MissionMapPicker`, and a subtle fixed grid-line texture on
  the page background (a tactical-map cue, kept faint enough to disappear
  under actual content).

Ran a full functional regression afterward (not just a visual check) to
confirm the redesign didn't break anything — all 42 map cards, the full
disposition→pack→board flow, infiltrator enforcement, unit-template
placement and letter labeling, select/rotate/delete all still pass a
Playwright pass with zero errors. Also verified the signature bracket
accent actually renders (checked its computed `::before` style, not just
that the CSS class exists in the stylesheet).

**v0.15 — unit letter labels, infiltrator zone enforcement.** Two
changes, both in `DeploymentView`:

1. **Every placement (single base or whole unit) now gets the next
   letter** (A, B, C... wrapping to AA, AB... past Z via a spreadsheet-
   style `letterForIndex()`), and every model within one unit-template
   placement shares that same letter — so a 5-model formation reads as
   "A, A, A, A, A" and the next thing you place is "B", making it
   immediately clear on the board which tokens belong together.
2. **Infiltrators toggle in the palette.** Off (default): a unit can only
   be placed if *every model* would land inside that owner's deployment
   zone — checked with a standard ray-casting point-in-polygon test
   (`src/data/geometry.ts`) against the map's actual zone data (the same
   exact-template geometry described below, not an approximation).
   Formation placement is all-or-nothing: if even one model in a 10-man
   unit would fall outside the zone, the *whole* placement is rejected,
   not just the offending model. On: no restriction. The ghost preview
   reflects this live — it turns a red/amber warning color over any
   invalid spot (whole formation at once, same all-or-nothing logic)
   before you've even clicked, and a rejected click leaves a brief error
   message rather than silently doing nothing.

Verified: placed a unit near a zone boundary and reduced it to a simple
question — armed at the same screen position, does the outcome flip when
toggling the checkbox? Confirmed via a token-count check that's immune to
the ghost's own shape count (ghosts don't render hit-target circles, so
counting only r≥10 circles isolates *real* placements) — infiltrator off
correctly rejected (0 tokens placed, error shown), infiltrator on
correctly placed (1 token). Also caught and corrected a mistake in my own
test methodology along the way: an early sampling pass varied the wrong
screen axis and seemed to show broken enforcement, when the real
explanation was that the board renders rotated 90° so the zone-relevant
axis is vertical on screen, not horizontal — re-ran along the correct axis
and got a clean result (valid only within the first ~27% of the axis,
matching that map's actual 12"-of-44" zone depth). Read the label text
directly off the SVG for the letter check: a 5-model formation came back
`['A','A','A','A','A']`, the next single-base placement came back `'B'`.

**v0.14 — 24mm base removed, ghost preview + wheel rotation while
placing.** Two changes:

1. **24mm base removed entirely** (it shouldn't have been added — no such
   base exists). Confirmed with a full grep sweep and a rendered check
   (Tokens tab shape count dropped to exactly the remaining 6 templates).
2. **Ghost preview**: arming a base or unit template now shows a
   semi-transparent preview that follows the mouse over the board — for a
   unit template, the *whole formation*, not just one model, so you can
   see exactly where all 5/10 models will land before committing.
   **Scroll the mouse wheel** while hovering to rotate the ghost in 15°
   steps (unit templates rotate the whole formation layout, not just each
   model's individual facing); the rotation carries through exactly to
   whatever gets placed on click.

   Implementation note: `MapView` tracks the armed rotation as a plain
   number applied identically to the ghost and to real `PlacedToken`s at
   render time (both get the same `rotationDeg + counterRotate` treatment
   the board-rotation code already used for real tokens), so there's no
   separate "ghost rotation" math to keep in sync with "real placement
   rotation" — they're the same code path. Verified precisely: 3 wheel
   ticks moved the ghost by exactly 45° (not roughly — exactly, read
   straight off the SVG transform attribute), and the resulting placed
   token shared the identical rotation value. Also confirmed rotation
   resets to 0 when arming something new, rather than carrying over
   confusingly from the last thing placed.

**v0.13 — unit templates: place a whole 5- or 10-model unit in one click.**
Starting with 25mm and 32mm bases (both circles). `src/data/bases/
unitTemplates.ts` defines a `UnitTemplate` as a base size + a row layout
(`[3, 2]` for a 5-model tight formation, `[5, 5]` for 10) and computes each
model's offset from the formation's center in inches — rows spaced by
exactly one base diameter (front-to-back and side-to-side, so bases sit
edge-to-edge/"tight"), shorter rows centered under longer ones rather than
flush to one side.

Deliberately scoped as "generate N individual tokens at once," not a new
group-object type: placing a unit template just creates N ordinary
`PlacedToken`s (tagged with a shared `groupId` for forward compatibility,
unused for now) via the same state update path as single-base placement.
Every model remains independently draggable/rotatable/deletable afterward
— there's no group-select or group-move yet, which was a deliberate
scope cut, not an oversight.

Verified with exact numeric checks (not just "it renders"): placed a 5-man
25mm unit and read the raw SVG coordinates back out — row spacing and
inter-model spacing both came back at exactly one base diameter, and the
2-model row's center matched the 3-model row's center exactly (properly
centered, not left-aligned). Did the same for a 10-man 32mm unit (two rows
of 5, spacing scaled correctly to the larger base). Then dragged a single
model out of a placed formation and confirmed — by comparing all 5 models'
positions before and after, in DOM order — that exactly one moved and the
other four stayed exactly put, confirming formations aren't accidentally
coupled together.

**v0.12 — dark theme, landscape rotation, full-screen board, oval bug fix.**
Four changes, all on the interactive board:

1. **Dark theme** across the whole app — new `src/index.css` with CSS custom
   properties (`--bg`, `--text`, `--accent`, etc.), every component's
   inline styles updated to reference them.
2. **Board renders rotated 90° (landscape)** to use a wide screen properly.
   Implemented as an SVG-native rotation (`<g transform="rotate(...)">`)
   rather than a CSS transform on the outer element — this matters because
   it means click/drag coordinate math didn't need any manual trigonometry
   to invert: `element.getScreenCTM().inverse()` converts a mouse event
   straight into the *unrotated* local coordinate space that all the
   existing zone/terrain/token math already uses, so `toDisplayPx`/
   `toBoardIn` are completely unchanged by the rotation.
3. **Board now actually fills most of the screen** (verified: 83% of
   viewport width, 81% of height, zero overflow) — this took two follow-up
   fixes after the rotation itself worked, both classic CSS layout traps:
   a percentage-width SVG inside a flex item with no explicit width on its
   own wrapper collapses to shrink-to-fit instead of stretching (fixed by
   giving `MapView`'s wrapper div an explicit width/height); and
   constraining by width alone let the (now landscape, differently-
   proportioned) board overflow vertically, fixed with `object-fit:
   contain` plus a proper flexbox chain (`App.tsx` now uses `height: 100vh`
   + flex column with the content area as `flex: 1 1 0%`, instead of a
   magic-number `calc(100vh - 53px)` in `DeploymentView` that quietly
   assumed a header height that wasn't actually correct).
4. **Oval token in the placement palette rendered as a square.** Root
   cause: the palette used one fixed px-per-inch scale for every base
   size's icon; the oval (120x92mm, much larger than the circles) overflowed
   its fixed-size icon cell and got clipped on both axes, which visually
   reads as "square." Fixed by computing a per-base scale so each icon's
   larger dimension fits the cell, preserving aspect ratio. (The Tokens
   library tab was never affected — it already sized each item's container
   to its own shape rather than using a shared fixed scale.)

All four verified with real browser automation (Playwright), not just
`tsc`/build: exact pixel measurements of the oval's rx/ry ratio (1.304,
matching 120/92 precisely) and clipping bounds, viewBox dimensions
confirming landscape orientation, board bounding-box percentage of
viewport with an explicit overflow check, and — the most direct
confidence check for the rotation math — placing and dragging a token,
then comparing its actual on-screen movement to the mouse's screen-space
movement directly (matched to 0.0001px). Also re-ran the full multi-tab
click-through regression (Tokens, Browse Maps with all 42 thumbnails,
Deploy flow with a different mission pack) to confirm nothing else broke.

**v0.11 — disposition-driven map selection, interactive token placement.**
The app UI changed shape: instead of browsing all 42 maps directly, the
main "Deploy" flow now asks each player to pick a disposition (Purge the
Foe, Take and Hold, Priority Assets, Disruption, Reconnaissance) and
resolves that pair to the matching mission pack (same disposition twice ->
the mirror pack). From there you pick one of the pack's 3 layouts and land
on an interactive board: arm a base size from the token palette, click the
map to place it, drag to reposition, rotate, delete. `MapView` and `Token`
were both built to support this without a rewrite — display scale is
always a prop, never hardcoded, so the same components work in a thumbnail
grid, a palette icon, and full interactive placement.

Direct map browsing is still available (new "Browse Maps" tab) for when
you just want a specific map without going through disposition selection.

This got an actual browser-driven test pass (Playwright), not just a
type-check — full click-through of the disposition flow, placing tokens,
dragging (confirmed position delta matched the mouse movement exactly),
rotating (confirmed the SVG transform), deleting (confirmed shape count),
and a regression check on the other two tabs. Zero console/page errors
across all of it. Two real bugs were caught and fixed *during* that
process rather than after: a stale-closure risk from using a plain object
instead of `useRef` for an SVG ref, and a `stopPropagation`-on-`mousedown`
that didn't also stop the separate `click` event, which would have made
every token click also place a spurious duplicate underneath it.

Placement state is session-only (component state, not persisted) — save/
load is still on the roadmap.

**v0.6 — all 42 maps, deployment zones exact and visually verified.** Two
bugs found during a full human visual pass and fixed:

1. **Crucible of Battle orientation** (`recon_pa_a`): the left/right anchor
   probe sampled too close to the ambiguous diagonal line itself, where a
   few pixels of noise could flip the read. Fixed by probing deep into each
   candidate triangle instead, far from the boundary.
2. **Tipping Point / Sweeping Engagement depths off by ~1"** on several maps
   (e.g. `dis_recon_a`): terrain art sometimes covers a large enough,
   consistent enough span of a sampling window that it actually
   *outnumbers* the true clean reading within that window — a pure
   mode/frequency vote can pick the wrong cluster. Fixed by using cross-map
   consistency as a prior: these mission packs reuse near-identical
   measurements across every map of a given pattern, so ambiguous local
   clusters are now resolved by preferring whichever is closest to the
   dataset-wide reference value, not just whichever has more samples. All
   18 Tipping Point / Sweeping Engagement maps now cluster within 0.2" of
   the reference depths, down from a 5" spread before.

See "How the map data was produced" for the full methodology.

**v0.7 — terrain footprint extraction rebuilt, correction tool added.**
The old terrain extractor was badly broken (producing 40-60" "pieces" on a
44×60" board — clearly merged garbage, not usable even as a rough draft).
Rebuilt from scratch (`terrain_v3.py`) combining local texture variance
with color; now produces plausible piece counts (~13/map, 559 total) with
no gross merges. Per-piece precision is still unverified draft data — see
"Terrain footprints" below for why this doesn't have the same "6 known
patterns" shortcut zones got, and `tools/terrain-editor.html` for the
correction workflow.

No token library or drag-and-drop yet — see Roadmap.

**v0.10 — token library, first iteration.** `src/data/bases/` defines
`BaseTemplate` (shape + real-world mm dimensions) with the 6 initially
requested sizes (24/32/40/50/60mm circles, 120x92mm oval), plus a reusable
`Token` SVG component and a `TokenLibrary` browser view (new "Tokens" tab
in the nav) that renders all of them at true relative scale to each other.
Deliberately scoped small: no unit/army database yet (name, faction, model
count), no drag-and-drop placement onto maps yet — just accurate physical
base shapes, which is the foundation everything else in this area builds
on. See "Token library" below.

**v0.9 — category removed, touching-piece merge bug fixed, editor bug
fixed.** A manual correction pass on `tah_pa_a` surfaced two real issues:

1. **Dense/light category was never reliable** and wasn't earning its
   keep — removed entirely from the schema, extractor, editor tool, and
   renderer. Terrain pieces are now just footprint geometry (corners,
   center, width/height, angle), no classification.
2. **Closely-touching separate pieces were sometimes merged into one**
   during extraction — the closing kernel used to consolidate a single
   piece's internal texture gaps was, on some maps, also bridging the gap
   between two genuinely distinct adjacent pieces. Reduced the kernel from
   11×11 to 5×5, which recovers most of these without meaningfully
   increasing fragmentation elsewhere (checked against several other maps
   before committing to the change).
3. Also fixed a real bug in `terrain-editor.html`: adding a new piece or
   dragging its corners never recalculated `center`/`width_in`/
   `height_in`/`angle_deg` — they stayed at their initial placeholder
   values forever. Manually-added pieces now get correct derived fields.

**v0.8 — terrain extraction retargeted to footprints, not features.** A
human visual check caught that the v3 extractor was segmenting the
decorative art (fences, statues, rubble) rather than the grey footprint
card underneath, which is what actually matters for gameplay. Rebuilt
(`terrain_v4.py`) around a color-temperature signal that targets the card
itself. Geometry is now aimed at the right thing; category classification
(dense/light) is a known remaining weak point — see "Terrain footprints"
below.

## Design system

All tokens live in `src/index.css` as CSS custom properties — reach for
these rather than hardcoding a color/spacing value in a component.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#16181a` | page background |
| `--bg-panel` / `--bg-panel-alt` | `#1d2023` / `#24282c` | card and sidebar surfaces |
| `--bg-hover` | `#2c3136` | hover/selected surface |
| `--border` / `--border-light` | `#35393e` / `#494f56` | hairlines, card borders |
| `--text` / `--text-dim` / `--text-faint` | `#e9e6df` / `#9a9d9f` / `#6b6e70` | primary / secondary / tertiary text |
| `--accent` / `--accent-strong` | `#c9a227` / `#e0b93a` | the one accent color — selection, links, primary actions |
| `--danger` / `--danger-strong` | `#c0392b` / `#e0473a` | delete actions, invalid-placement warnings |

Two font roles, loaded via Google Fonts in `index.html`: `--font-display`/
`--font-body` (IBM Plex Sans) for headings and UI text, `--font-mono` (IBM
Plex Mono) specifically for *data* — base sizes, coordinates, mission-pack
names, anything that reads as a measurement or identifier rather than
prose. This split is deliberate, not just "monospace looks technical" —
use body font for anything a person would read as a sentence, mono for
anything they'd read as a value.

Two reusable classes: `.eyebrow` (uppercase, letter-spaced, mono, dim —
section labels instead of plain `<h3>`s) and `.bracket` (the corner-accent
signature device — apply to whatever's currently selected/active/armed,
don't use it decoratively on things that aren't in a selected state).
`.map-card` is the shared hover-able card treatment for map thumbnails,
used in both `MapLibrary` and `MissionMapPicker`.

Deliberately NOT part of this palette: Attacker/Defender red and blue.
Those come directly from the actual deployment-zone colors on the map art
(`zoneColor()` in `MapView.tsx`) and stay consistent everywhere a
zone/token/owner needs a color, independent of whatever the surrounding
UI's accent color is.

## Getting started

```bash
npm install
npm run dev
```

## Project structure

```
public/
  map-images/           # source map PNGs, served as static assets for MapView
  unit-art/               # unit token art (background-removed), served the same way
src/
  index.css               # global dark theme (CSS custom properties)
  main.tsx                  # entry point, imports index.css
  App.tsx                     # tab nav (Deploy/Browse Maps/Tokens) + top-level layout
  data/
    maps/
      schema.ts          # MissionMap, DeploymentZone, TerrainPiece, etc.
      tah_pa_{a,b,c}.ts, tah_purge_{a,b,c}.ts, tah_recon_{a,b,c}.ts,
      tah_dis_{a,b,c}.ts, purge_mirror_{a,b,c}.ts, dis_mirror_{a,b,c}.ts,
      dis_pa_{a,b,c}.ts, dis_recon_{a,b,c}.ts, pa_mirror_{a,b,c}.ts,
      purge_dis_{a,b,c}.ts, purge_pa_{a,b,c}.ts, purge_recon_{a,b,c}.ts,
      recon_mirror_{a,b,c}.ts, recon_pa_{a,b,c}.ts   # all 42 maps
      index.ts            # allMaps[] / getMapById(), auto-generated
    bases/
      schema.ts            # BaseTemplate, BaseShape, mm<->inch helpers
      baseTemplates.ts       # the 6 base size templates (25/32/40/50/60mm circles, 120x92mm oval)
      unitTemplates.ts        # UnitTemplate (formation of N same-size bases) + offset math
    units/
      schema.ts            # Unit (a real named model: name, faction, base, art)
      units.ts               # the unit roster -- 1 entry so far (Hormagaunt)
    dispositions.ts        # 5 dispositions + pair -> mission-pack-prefix lookup
    placement.ts             # PlacedToken type (a token placed on a specific map)
    geometry.ts               # rotatePoint, pointInPolygon, isBaseFullyInPolygon, isInDeploymentZone
  components/
    common.ts           # shared style constants (e.g. BACK_BTN_STYLE)
    MapView/          # SVG renderer for a single map; also drives interactive
                        #   token placement when passed tokens/onBoardClick/etc.
                        #   Handles the landscape rotation and 100-400% zoom
                        #   (see "Deployment UI").
    MapLibrary/        # browse/select grid (all 42 maps, no disposition filter)
    TokenLibrary/
      Token.tsx           # reusable SVG token/base shape renderer
      TokenLibrary.tsx      # browse view, all base sizes at true relative scale
      TokenPalette.tsx        # arm a base size / pick owner / rotate+delete selected
    DispositionPicker/
      DispositionPicker.tsx  # pick your + opponent's disposition
      MissionMapPicker.tsx     # shows the 3 layouts for the resolved pack
    DeploymentView/
      DeploymentView.tsx      # composes MapView (interactive) + TokenPalette,
                                #   owns the placed-tokens state for one session
scripts/
  manifest.json               # source of truth: every map's id/filename/pack/etc
  template_zones.py            # classifies + generates exact deployment zone geometry
  batch_template.py             # runs template_zones.py across every map in the manifest
  batch_template_qa.py           # renders zone QA overlays + template_contact_sheet.png
  terrain_v4.py                   # color-temperature based terrain footprint extraction
  batch_terrain_v4.py              # runs terrain_v4.py across every map in the manifest
  classify_terrain.py               # light/heavy classification + marker-icon false-positive filter
  extract_terrain_keepout.py        # finds the actual blocking feature geometry within each card
  batch_terrain_qa.py               # renders terrain QA overlays
  batch_trace.py                     # thin alias for batch_terrain_v4.py (legacy name)
  generate_ts.py                      # converts scripts/output/*.json into src/data/maps/*.ts
  check_solidity.py                    # legacy zone-tracing QA metric, no longer meaningful
  remove_bg.py                           # strips a white studio-photo background from unit art
  output/                                # generated JSON + per-map QA overlay PNGs
tools/
  zone-editor.html            # fallback manual zone correction (rarely needed now)
  terrain-editor.html          # manual terrain footprint correction -- see below
  editor_data.json              # zone data embedded for zone-editor.html
  terrain_editor_data.json       # terrain data embedded for terrain-editor.html
```

## Rendering: real map art, not just abstract shapes

`MapView` renders the actual source map image (from `public/map-images/`) as
the background, with an SVG overlay of the traced zones/terrain/objectives
aligned on top via each map's `imageCalibration` data (pixel origin + scale,
captured during tracing). There's a checkbox to toggle the overlay off and
view the raw art. Maps without calibration data fall back to a pure
vector-only rendering (`AbstractMapView`) built straight from the inch
coordinates — shouldn't happen for any current map, but keeps the component
from crashing if one ever lacks image data.

Inches, origin at the **bottom-left** of the playing area, x right, y up.
This matches how players usually call out table positions. Board size for
both current maps is 44" x 60" (standard GT/Pariah Nexus size).

## How the map data was produced

### Deployment zones: exact templates, not tracing

Earlier versions of this pipeline pixel-traced zone boundaries directly from
the source PNGs, fighting an unwinnable battle against terrain art sitting
on or near the boundary (which locally obscures the zone color and makes a
traced contour detour around the terrain's silhouette). Multiple mitigation
strategies were tried — morphological closing, subtractive point-filtering
— and each fixed some maps while introducing new failure modes on others.
Roughly half of all traced zones needed manual correction, with no
improvement as more maps were added.

The breakthrough was recognizing that every map's deployment zones follow
one of exactly **6 known geometric patterns**, each fully described by 0-2
numeric parameters. Once that's true, the right tool isn't a better contour
tracer — it's a **classifier + parametric generator**:

1. `scripts/template_zones.py` classifies which of the 6 patterns a map
   uses from the **raw pixel bounding box** of its red/blue zone color
   (after filtering out small same-colored icon markers near the
   centerline). This is robust to terrain occlusion in a way contour
   tracing never was — terrain can carve holes out of the interior of a
   zone without changing its overall bounding box at all.
2. It then extracts the pattern's free parameters (a band depth, a step
   position, a quadrant orientation) via outlier-robust transect sampling
   — scanning many rows/columns and taking the median, so terrain-
   contaminated samples are outvoted rather than corrupting the result.
3. It generates the **exact polygon** for that pattern from those
   parameters — not an approximation of a traced contour, the literal
   formula.

All 42 maps classified successfully with no failures, and the extracted
parameters cluster tightly around consistent values within each pattern
(e.g. Dawn of War is always ~12" deep, Hammer and Anvil always ~18"),
which is a strong internal-consistency signal that classification is
correct.

### Deployment zone patterns

Board is always 44in (width) × 60in (height). "Long edges" are the left/
right (60in) sides; "short edges" are top/bottom (44in).

| Pattern | Shape | Free parameters |
|---|---|---|
| **Dawn of War** | Straight vertical zones along the long edges | 1 depth per zone |
| **Hammer and Anvil** | Straight horizontal zones along the short edges | 1 depth per zone |
| **Crucible of Battle** | Two diagonal triangles, each from a long-edge midpoint to the far corner on that side | orientation only (which corner) |
| **Sweeping Engagement** | Vertical zone with one step at the long-edge midpoint (y=30) | 2 depths per zone |
| **Tipping Point** | Horizontal zone with one step at the long-edge centerline (x=22) | 2 depths per zone |
| **Search and Destroy** | Two opposing quadrants, each with a 9in-radius arc cut out at the board center | quadrant orientation only |

Each free parameter is extracted by scanning many rows/columns of clean
zone-color pixels and finding the most common reading via `robust_mode()`
in `template_zones.py`. That function accepts an optional `prefer_near`
reference value — since every map of a given pattern in this dataset uses
near-identical measurements (Dawn of War is always ~12" deep, Tipping
Point's two depths are always ~40.2"/48.2", etc.), ambiguous per-map
readings (where terrain happens to cover more of the sampling window than
the true boundary does) are resolved by preferring whichever local cluster
is closest to that cross-map reference, rather than just whichever has the
most samples.

QA: `scripts/output/<map_id>_template_qa.png` (and the combined
`scripts/output/template_contact_sheet.png`) render each generated polygon
back over its source art. The old `scripts/check_solidity.py` convexity
check no longer applies as a correctness signal — several patterns
(Sweeping Engagement, Tipping Point, Search and Destroy) are legitimately
non-convex by design, so a "low" score there is expected, not a bug.

### Terrain footprints

Terrain art is much harder to segment automatically than deployment zones:
pieces can sit at any position and rotation (no small set of fixed
patterns to exploit the way zones had), and the art itself has overlapping
icons, text labels, and inconsistent internal coloring.

**First attempt (v3, texture-based) targeted the wrong thing.** It used
local texture variance (terrain card art has dense fine detail vs the
flat floor) to segment pieces, which turned out to mostly catch the
high-contrast decorative art sitting *on* each footprint (the green/gold
rubble, fences, statues) rather than the full grey footprint card
underneath — which is what the rules actually care about, and what a human
visual check caught. The decorative art has strong local contrast against
the grey card, so it clears a texture-variance threshold easily; the grey
card's own subtle "cityscape" fill texture is much closer in magnitude to
the floor's grid-line texture and doesn't separate as cleanly.

**Current approach (v4, `scripts/terrain_v4.py`) targets the footprint card
color directly.** The floor is consistently warm-toned tan (R channel ~9-10
higher than B, very low variance); the grey card is neutral-to-cool
(R-B near zero). This color-temperature signal cleanly separates card from
floor in a way texture variance couldn't, since it's measuring something
that's actually different between them (hue) rather than something
merely correlated (detail density).

**v5: `corners` traces the mask's real shape, not a bounding rectangle
fitted to it.** This was a real, quantified bug in the step *after* the
color mask, not in the color detection itself — the mask was already
correct. `cv2.minAreaRect(cv2.convexHull(...))` fit an oriented rectangle
around each card's mask, and a card's true shape (torn/ragged edges,
sometimes concave) rarely fills its own bounding rectangle. Checked
directly on pieces near a deployment zone boundary: the fitted rectangle
was regularly 194-290% of the mask's real area, with the excess
extending straight into whatever was physically next to the card — for
zone-adjacent pieces, that's strongly red/blue-tinted deployment zone
floor, silently pulled into the card's footprint. Pieces away from a zone
boundary showed a much smaller excess (124-127%, the unavoidable
baseline for approximating any non-rectangular shape with a rectangle),
confirming this wasn't a general accuracy problem — it was specifically
the zone-adjacent cases blowing far past that structural floor.

Fixed by tracing the mask's actual contour (`cv2.approxPolyDP`, epsilon
~1% of the contour's own perimeter — checked directly against the mask's
true area first, landing around 99% coverage at this setting) instead of
fitting a rectangle to it. `width_in`/`height_in`/`angle_deg` are kept as
before (still derived from the same `cv2.minAreaRect`) as approximate
size/rotation metadata for display and the existing size-sanity filter,
but they no longer describe `corners`'s own bounding box — `corners` is
the traced shape now, with a variable vertex count like the terrain
keep-out shapes already have (see below), not always 4 points. Re-ran
across all 42 maps: total card area dropped to 62% of the previous
rectangle-based total, and the specific flagged pieces dropped from
10-35% zone-tint-colored area within their footprint down to 0.5-9.7%.

An earlier approach this session — using grid-line presence/absence,
since floor has a real, measurable grid periodicity (~7.76px spacing,
confirmed directly) that terrain art lacks — turned out not to survive
contact with zone-tinted floor specifically: the tint suppresses the
grid's own visibility enough that tinted floor and genuine terrain became
hard to tell apart by that signal alone, in exactly the cases that
mattered. Documented as a real, verified dead end rather than silently
dropped, since it's a reasonable technique that could still be useful
elsewhere (see v0.40 in Status for the full account).

**v0.41: the raw-contour fix above had its own real regression — genuine
terrain features disappearing, not just zone-tint floor.** The card mask
only matches grey pixels, so wherever a colored feature (the actual thing
that makes it terrain) sits on a card, it fails the mask's own test and
reads as a gap — often enough to fragment one card's mask into a main
body plus several small disconnected pieces nearby, each too small to
pass the piece-size filter individually. Tracing just the main body's raw
contour correctly excludes zone floor but *also* excludes exactly the
area a real feature occupies. Two fixes were tried and rejected before
finding one that didn't trade this problem for the zone-tint problem
again — a convex hull recovers the feature gaps but also refills the
zone-boundary notch (zone-tint contamination came back up to 38.7% on the
same piece v0.40 fixed); a wider close kernel (9x9) avoids that
specifically but risks merging two separate, closely-touching cards into
one, a real previously-documented failure mode (the reason 5x5 was chosen
over 11x11 originally) — confirmed directly, piece counts became unstable
at that kernel size. What worked: kept the 5x5 kernel, and added a
surgical per-piece step instead — each real piece's own mask is dilated a
fixed, modest 10px, and any other sub-threshold-sized component landing
inside that gets merged into it specifically, recovering a feature's gap
in its own card without the reach to pull in a different card. See v0.41
in Status for the full verification (both properties confirmed
simultaneously: feature recovery on the map that regressed, zone-tint
exclusion still matching v0.40 exactly on the map that motivated it).

Same morphological fight as before — the raw mask needs opening (break thin
bridges from dotted lines/text) before closing (re-consolidate each card's
own texture gaps), still has no "6 known patterns" shortcut to lean on, and
still uses the size-sanity filter (reject anything over 20in on a side as
an implausible merge artifact) rather than report a bogus rectangle.

**The closing kernel was too large.** A manual correction pass on
`tah_pa_a` found several genuinely separate, closely-touching pieces that
had been merged into one — the same kernel needed to consolidate a single
piece's internal gaps was, on some maps, also bridging the real gap between
two distinct adjacent pieces. Reduced from 11×11 to 5×5, which recovers
most of those merges (piece counts rose from ~13/map to ~15.5/map on
average) without a corresponding spike in tiny bogus fragments on other
maps — checked before committing to the change, not just assumed.

**Dense/light category classification has been removed entirely.** It was
never reliable (counting green vs gold pixels near each footprint,
attempting to infer terrain "density" from decorative art color) and
wasn't worth keeping around half-working. `TerrainPiece` is now pure
footprint geometry: `corners`, `center`, `width_in`, `height_in`,
`angle_deg`. No category field anywhere in the schema, extractor, editor
tool, or renderer.

**Current state (~637 pieces across 41 auto-extracted maps + `tah_pa_a`
manually corrected):** footprint geometry targets the right thing and
produces plausible, consistently-sized rectangles, with fewer
touching-piece merges than before. Still draft data overall — not verified
piece-by-piece across the full set, and `tah_pa_a` is the only map with a
human-confirmed correction pass so far.

## Known gaps

- **TODO: mission cards aren't imported.** The board crop in v0.50 opens
  up real blank space next to the map (a portrait board in a wide
  viewport, especially) that a mission-reference panel — primary/
  secondary objectives, deployment special rules, the actual mission-pack
  rules text, not more board art — could fill. Nothing sources this data
  yet (`MissionMap` has no field for it) and nothing renders it. See the
  TODO comment in `DeploymentView.tsx` right above the board's wrapping
  div for the fuller shape of this.
- Objective marker positions are not extracted yet (empty `objectives: []`
  in every map file) — need manual placement.
- Terrain footprints are draft-only and need a correction pass via
  `tools/terrain-editor.html` — see below. This is the single biggest
  accuracy gap in the project right now.
- Deployment zones have had one full human visual pass (all 42 maps) with
  two bugs found and fixed — see Status above. Not impossible something
  subtler is still lurking, but there's no known issue as of this writing.
- One real unit exists (the Hormagaunt) as a proof of concept, but it's a
  single hand-entered record, not a database — see "Units" below and
  Roadmap. Everything else still places as a generic colored base.
- Placement is session-only — no save/load yet.
- Infiltrator zone enforcement only applies at initial placement — dragging
  a token afterward (infiltrator or not), including during the Turn 1
  movement phase, doesn't re-check zone membership. Deliberate scope cut
  for now, not an oversight, but worth fixing before treating this as a
  real legality tool rather than a placement aid.
- Movement clamping (Turn 1) only checks straight-line distance from the
  last committed waypoint, terrain keep-out, and now base overlap (see
  "Base overlap" above) — no "can't end within Xin of an enemy unit"
  type rule yet, and no engagement-range concept at all.
- The Sagitaur (the one vehicle in the roster) now has confirmed art and
  a confirmed Move stat (12"). See "Units" above.
- Terrain classification is a color heuristic (see "Terrain" above), not
  a verified per-piece classification — same caveat as terrain footprint
  extraction generally.
- Multi-select has no add-to-selection modifier (shift-click, etc.) —
  every marquee-drag or click replaces the previous selection rather than
  extending it. Fine for "select a cluster, move it," not yet enough for
  "select these two units on opposite sides of the board at once."
- **TODO: 12 Space Marines units aren't implemented at all** — every unit
  the Base Size Guide lists as "Hull" or "Unique" (Land Raider + Crusader/
  Redeemer, Predator Annihilator/Destructor, Razorback, Rhino, Vindicator,
  Whirlwind, Drop Pod, Hammerfall Bunker, Astraeus, Thunderhawk Gunship)
  was left out of the v0.45 roster import rather than given an invented
  hull footprint. See the TODO comment block in `src/data/units/units.ts`
  for the full list and what's needed to add each one (a real measured
  hull width x height in mm, then a rectangle `baseTemplateId` following
  the `base_105x68mm_rect` pattern).

## Adding a new map

The pipeline is manifest-driven, so adding maps is mostly editing one file:

1. Add the source PNG to `/mnt/user-data/uploads` (or wherever the scripts
   can read it) — and once you have it locally, drop it in
   `public/map-images/` too.
2. Add an entry to `scripts/manifest.json`: `id`, `filename`, `display_name`
   ("Layout A" etc.), `pack`, `var_name` (camelCase, used as the TS export
   name).
3. Run `python3 scripts/batch_template.py` — classifies each map's
   deployment pattern and writes exact zone geometry straight to
   `scripts/output/<id>_zones.json` (see "Deployment zone patterns" above).
   Prints `UNKNOWN` for any map that doesn't match one of the 6 known
   bounding-box signatures — if that happens, compare the printed
   `rw_frac`/`rh_frac` against the table above, or fall back to
   `tools/zone-editor.html` for that one map.
4. Run `python3 scripts/batch_terrain_v4.py` (or the `batch_trace.py` alias)
   — draft terrain-footprint extraction for every map, using the
   color-temperature signal (see "Terrain footprints" above). Safe to
   re-run any time; it doesn't touch zone data. Note it will overwrite any
   manually-corrected map's data too — exclude specific map ids from the
   batch (see the `tah_pa_a` skip in `batch_terrain_v4.py` for the pattern)
   if you've hand-corrected something and don't want it clobbered.
5. Run `python3 scripts/generate_ts.py` — writes `src/data/maps/<id>.ts` for
   every manifest entry, and regenerates `index.ts` from scratch to include
   all of them.
6. Run `python3 scripts/batch_template_qa.py` and
   `python3 scripts/batch_terrain_qa.py` — regenerates the per-map QA
   overlay PNGs and `template_contact_sheet.png`.

## Roadmap

1. **Terrain correction pass** — the tool exists (`tools/terrain-editor.html`);
   `tah_pa_a` has had a full manual pass, the other 41 maps haven't.
   Biggest remaining accuracy gap. Piece counts rose (~13/map → ~15.5/map)
   after the 5x5-kernel fix, so there's a real chunk of review work here.
2. **Objective marker placement** — same idea, simpler (just points, not
   rectangles). Could extend either editor tool to cover this.
3. **Unit/army database** — the first real unit exists now (the
   Hormagaunt — name, faction, base size, actual art, see "Units" above)
   but it's exactly one hand-entered record, not a database. Next step is
   enough entries to be useful (a faction's worth, at least), plus the
   things a real roster needs that this demo doesn't have: points cost,
   model count *options* (a unit that can be 5-20 models, not a fixed
   template), keywords/stats. Placing a whole named *unit* — not just one
   model or one generic formation of a unit's usual size — is also still
   open; right now selecting a unit only narrows which base sizes/
   formations show art, it doesn't know the unit's actual squad size.
4. **Multi-turn movement** — Turn 1 exists (see "Deployment UI"); there's
   no Turn 2+ concept yet. "Back to Deployment" lets you re-run "Begin
   Turn 1" from wherever things ended up, but nothing tracks turn number,
   and each new "Begin Turn 1" just re-snapshots — a real Turn 2 would
   need its own origin snapshot layered on top of Turn 1's, not a reset.
5. **Save/load deployments** — placement is currently session-only
   (component state in `DeploymentView`, lost on navigation/refresh).
   localStorage first, backend sync later.
6. **Legality helpers** — zone-boundary checking exists for initial
   placement, and movement distance is enforced during Turn 1 (see
   "Deployment UI" for both), but neither checks terrain collision, and
   there's no virtual tape measure for arbitrary distance checks yet.

## Token library

Base *shapes* and unit *formations* are done; a real unit/army database is
still just one demo entry (the Hormagaunt) — see "Units" below and
Roadmap.

- `src/data/bases/schema.ts` — `BaseTemplate` (a shape: `"circle"` with a
  `diameter_mm`, `"oval"` with `width_mm`/`height_mm`, or `"rectangle"` --
  same `width_mm`/`height_mm` fields, no rounding -- for vehicles that
  don't come on a circular/oval base at all, just their own hull
  footprint) and `mmToIn()` for the inch conversion everything else in
  this app uses.
- `src/data/bases/baseTemplates.ts` — 25mm, 32mm, 40mm, 50mm, 60mm
  circles, a 120x92mm oval, and a 105x68mm rectangle (the Sagitaur's
  hull). Add more here as needed — this list is the single source of
  truth for base shapes throughout the app.
- `src/data/bases/unitTemplates.ts` — `UnitTemplate` (a base size + a row
  layout like `[3, 2]` or `[5, 5]`) and `formationOffsetsIn()`, which
  computes each model's position offset from the formation's center in
  inches. Currently 4 templates: 25mm and 32mm, each as a 5-model (3+2)
  or 10-model (5+5) tight formation. Add more sizes/counts here the same
  way once needed.
- `src/components/TokenLibrary/Token.tsx` — reusable SVG shape renderer.
  Takes a `BaseTemplate` and a `pxPerIn` scale (never hardcoded), plus
  optional position, rotation, selection state, and `imageSrc` for real
  unit art (see "Units" below). Deliberately has no label/text rendering
  of its own — that turned out to need placement-context-specific
  handling (legible below-token label on the board vs. no label at all in
  a small palette icon), so it lives in `MapView` instead; see v0.19 in
  Status. Used in four places: the library browser, single-base palette
  icons, the formation-preview palette icons, and live on-map placement.
- `src/components/TokenLibrary/TokenLibrary.tsx` — browse view ("Tokens"
  tab) rendering all base templates at true relative scale to each other.
- `src/components/TokenLibrary/TokenPalette.tsx` — the placement sidebar.
  Owns a single `Armed` union (`{type: "base", id} | {type: "unit", id} |
  null`) so exactly one thing can be armed at a time whether it's a single
  base or a whole unit template; pick Attacker/Defender (colors tokens
  red/blue to match the zone convention); rotate/delete the selected
  token. Unit template buttons render a small dot-formation preview (via
  `formationOffsetsIn`) so the palette shows the actual arrangement, not
  just a number.

Real-world base sizes in inches, for reference (`mm / 25.4`): 25mm ≈
0.984", 32mm ≈ 1.260", 40mm ≈ 1.575", 50mm ≈ 1.969", 60mm ≈ 2.362",
120x92mm ≈ 4.724" x 3.622", and the Sagitaur's 105x68mm hull ≈ 4.134" x
2.677".

## Units

A `Unit` (`src/data/units/schema.ts`) is a real named model — as opposed
to a `BaseTemplate` (just a physical shape/size) or a `UnitTemplate` (a
generic formation with no identity). Deliberately minimal: name, faction,
the base it comes on, token art, a `move_in` stat, and an `isVehicle`
flag (see "Terrain" above for what that drives). Still no points cost, no
faction keywords, no other stats (Toughness, Wounds, etc.) — that's the
"real unit/army database" roadmap item; this has just enough to place
recognizable art and enforce real rules, not a full data sheet.

`imageSrc` and `move_in` are both optional on `Unit` — a unit can be
drafted with its physical footprint and vehicle/infantry classification
locked in (which is enough to get placement, rotation, and terrain rules
all working correctly) before real art or a confirmed Move stat exist.
Unset `imageSrc` falls back to `Token`'s normal plain-owner-color
rendering; unset `move_in` falls back to `DEFAULT_MOVE_IN` (6") — the
same fallback generic (non-unit) base placements already use.

`src/data/units/units.ts` is the roster — two entries so far:

- **Hormagaunt** (Tyranids, 25mm circle, Move 10", infantry) — full
  entry, art included. `validSquadSizes: [10, 20]` — see below.
- **Sagitaur** (105x68mm rectangle, `isVehicle: true`, Move 12") — full
  entry, art included. Its rectangular hull (rather than a circular/oval
  base) is why `BaseShape` has a `"rectangle"` option at all — see
  "Token library" above. Art is cropped to the base's exact 105:68
  aspect ratio (not just resized) — see v0.43 in Status for why this
  matters beyond looking nicer: a source image with a substantially
  different aspect ratio than its base gets heavily cropped by
  `Token.tsx`'s cover-scaling to fill the shape, and what's visible
  inside the rendered token can end up representing a meaningfully
  different-shaped slice of the source art than "the whole model,
  proportionally" — which matters for a base this size, since players
  judge where the edge of a large base is partly by where the art looks
  like it ends.

Add more the same way: a `Unit` record plus (optionally, for now) art in
`public/unit-art/`.

**`validSquadSizes`** restricts which unit-template formations a unit's
palette selection offers, e.g. Hormagaunts (`[10, 20]`) only show x10 and
x20 — without this field, selecting a unit shows every generic formation
that happens to share its base size (any 25mm unit would otherwise see
the same x5/x10/x20 options), which doesn't reflect real composition
rules. Doesn't affect single-base placement — a lone model is still
always available regardless (e.g. for casualty tracking or measuring),
only the multi-model formation buttons are filtered. Undefined means no
restriction, the same behavior as before this field existed.

**Producing the art**: `scripts/remove_bg.py` strips a white studio-photo
background, producing a transparent PNG. It flood-fills from the image
border through "close to white" pixels, so only background actually
*connected to an edge* gets removed — a pale part of the model itself
(there's a lot of light coloring on the Hormagaunt) doesn't get punched
into a hole just because its color happens to be close to white, since it
isn't touching the border. The cutout edge gets a light Gaussian blur on
just the alpha channel afterward, so it doesn't read as a hard-edged
sticker. Usage: `python3 scripts/remove_bg.py <in.jpg> <out.png>`, then
crop to the model's bounding box (see the script's `__main__` for the
exact crop-with-margin snippet used for the Hormagaunt) and drop the
result in `public/unit-art/`. Checked the Sagitaur's output numerically
before trusting it, not just visually: border alpha is effectively zero
(max value 1/255 — negligible Gaussian-blur feather, not leftover
background) and a scan across the vehicle's body found no fragmented
holes punched through it.

**How the palette uses it**: selecting a unit from the "Unit" dropdown in
`TokenPalette` locks the "Single base" section down to just that unit's
base size, and the "Unit templates" section down to formations matching
both the base size *and* `validSquadSizes` if set. Placing a token while
a unit is selected tags the resulting `PlacedToken` with `unitId`;
`MapView` looks that up and passes the unit's `imageSrc` into `Token`,
which clips the art to the base's actual shape via an SVG `clipPath` and
crops-to-cover (`preserveAspectRatio="xMidYMid slice"`) rather than
letterboxing. The owner-color tint that plain placeholder tokens get
becomes a colored ring around the art instead of a flat wash over it. The
unit's name is rendered as a legible label below the *group* — one per
placement, not one per model, so a 20-model formation reads as a single
"Hormagaunt" label rather than 20 overlapping copies of it — see
v0.19/v0.20 in Status for how that evolved.

## Terrain

Terrain footprints themselves (the polygon geometry) come from
`scripts/terrain_v4.py` — see "How the map data was produced" below.
This section is about the layer built on top of that geometry: light vs.
heavy classification and the keep-out rules it drives.

**Classification** (`scripts/classify_terrain.py`) samples the source
image's actual pixels inside each footprint and classifies by mean color
saturation (threshold S=0.12 — see v0.26 in Status for how that number
was picked, not just asserted). It also drops a specific class of false
positive: small, highly-saturated blobs that match the app's own
deployment-zone marker-icon colors (the red/blue "X" no-go icons near
zone lines) almost exactly, which the original extraction mistook for
terrain. Re-run it after regenerating terrain data for new maps:

```bash
python3 scripts/classify_terrain.py         # classifies + filters, writes back to scripts/output/*_terrain.json
python3 scripts/generate_ts.py              # picks up terrainType in the regenerated src/data/maps/*.ts
```

`TerrainPiece.terrainType` is `"light" | "heavy" | undefined` (the last
for terrain data generated before this field existed — treated as heavy,
the conservative default). `MapView` renders them differently: heavy is a
solid grey fill with a solid stroke, light is a lighter, dashed-stroke
fill (`TERRAIN_HEAVY_FILL`/`TERRAIN_LIGHT_FILL` etc. in `MapView.tsx`).

**The card is walkable — only the feature on it isn't**
(`scripts/extract_terrain_keepout.py`). This is a real correction, not
just an addition: `TerrainPiece.corners` (the whole footprint from
`terrain_v4.py`) is just the base card a terrain piece sits on, and a
unit can stand on that card freely. What actually blocks placement is
`TerrainPiece.keepOutFootprints` — one or more traced polygons following
the actual shape of the decorative feature elements (yellow/gold *and*
green/teal in this art style: struts, pipework, wreckage — the "and
green" was briefly removed in v0.37 on a mistaken assumption from a small
sample, then restored in v0.38 once a counter-example map showed real
terrain and objective-marker icons sharing the same hue; see both entries
in Status), extracted by sampling per-pixel hue/saturation within each
card, running connected-components on it, and tracing each cluster's real
contour (`cv2.findContours` + `cv2.approxPolyDP` to simplify the raw
pixel boundary into a reasonable polygon). Deliberately **not** a
bounding rectangle per cluster (an earlier version did this, matching how
`terrain_v4.py` extracts the outer card) — a terrain feature has no real
footprint or bounding box in the rules, the coloring in the art *is* its
literal position, and a rectangle around an irregular pipe run claims
space the feature doesn't occupy. See v0.36 in Status for the measured
improvement (and an honest limitation: point-level precision inside any
single traced polygon caps around 55-58% regardless of simplification
tightness, since one simple polygon necessarily fills in the concave
notches of a branching shape — a real geometric limit, not a tuning
problem).

Objective-marker icons (small circular/diamond white-skull-or-eye icons
with a white ring border) get excluded by **shape and size, not color** —
checked directly and confirmed color can't reliably tell them apart from
genuine terrain on every map, since some maps render real pipe/strut
terrain in close to the same hue as that map's own marker icons. A
connected feature-colored cluster is excluded specifically when it's both
close to square (`MARKER_MAX_ASPECT`) and within a plausible marker size
range (`MARKER_SIZE_MIN_IN`-`MARKER_SIZE_MAX_IN` inches), using
`cv2.minAreaRect`'s true oriented bounding box rather than an
axis-aligned one — terrain cards are frequently rotated on the board, and
an axis-aligned box around a genuinely elongated feature drawn at roughly
45° can look misleadingly close to square. A card can have several
separate keep-out shapes (real terrain art usually has multiple
disconnected feature clusters, not one blob covering the gaps between
them). Pieces where no feature was detected at all fall back to the whole
card as a conservative default rather than having no enforcement. Re-run
after regenerating terrain footprints for new maps, and after
`classify_terrain.py`, since this reads the already-classified data:

```bash
python3 scripts/extract_terrain_keepout.py  # finds feature geometry within each card, writes back to scripts/output/*_terrain.json
python3 scripts/generate_ts.py              # picks up keepOutFootprints in the regenerated src/data/maps/*.ts
```

`geometry.ts`'s `terrainKeepOutShapes(piece)` resolves which shapes
actually apply (the extracted keep-out shapes if any exist, else the
whole card) and is the single place this fallback logic lives — both the
blocking functions below and `MapView`'s rendering call it, so there's no
risk of the check and the visual drifting apart. Neither needed any
changes when the extraction switched from rectangles to traced polygons
— `isBaseOverlappingPolygon`/`isBaseFullyInPolygon` (ray-casting +
edge-distance) already worked on any vertex count, not just 4, so this
was purely a data change. `MapView` renders the card itself as a faint
dashed reference outline only (`TERRAIN_CARD_STROKE`, no fill) and the
keep-out shapes with the actual heavy/light blocking styling, so it's
visually obvious which part of a terrain piece is walkable and which
isn't.

**Keep-out is two separate rules** (`src/data/geometry.ts`), not a single
"terrain blocks" flag:

- `isBlockedForMovement(map, center, base, rotationDeg, isVehicle)` —
  can a unit occupy this exact spot while moving? Only heavy terrain
  blocks, and only for vehicles (`Unit.isVehicle`, defaults to `false`/
  infantry for units that don't set it and for generic base placements
  with no `Unit` at all). Infantry can move through any terrain, heavy or
  light.
- `isPathBlockedForMovement(map, from, to, base, rotationDeg, isVehicle)`
  — the version `DeploymentView` actually calls during a drag: samples
  the whole segment from the token's current position to the candidate
  (every 0.25", not a fixed sample count) and blocks if *any* point along
  it is blocked, not just the destination. This isn't a refinement, it
  fixed a real bug: checking only the destination point let a vehicle
  "tunnel" through a terrain piece whenever two consecutive drag-frame
  samples happened to land on either side of it without either one
  landing squarely inside — confirmed concretely with a dense, 100-step
  drag straight through a known heavy-terrain piece before the fix (the
  vehicle arrived at its target within 1px, completely unimpeded) and
  after (stopped about a third of the way in, unable to proceed further).
  A blocked micro-movement is simply not applied, so a vehicle visibly
  "gets stuck" against heavy terrain's edge, while infantry drags
  straight over the same spot without interruption.
- `cannotEndOnTerrain(map, center, base, rotationDeg)` — can a unit
  legally *end* a move (or be placed) here? Universal: any terrain, any
  unit type, no vehicle/infantry distinction. Multi-level terrain, where
  a model really could be based on an upper floor, isn't modeled yet —
  every piece is currently treated as single-level. Enforced in two
  places: at placement (`handleBoardClick`, since placing is an instant
  "end position" with no movement involved) and once at the end of a
  drag rather than on every intermediate step — `MapView` fires a new
  `onDragEnd(startPositions)` callback specifically at mouseup (distinct
  from the continuous `onTokensMove`), and `DeploymentView` checks each
  just-dropped token's final position, reverting to wherever it started
  *this* drag gesture if it landed somewhere illegal.

All three build on `isBaseOverlappingPolygon` — true overlap (any part of
the base touching a keep-out shape), not containment; a token whose edge
only clips a corner still can't be placed there. Circle, oval, and
rectangle bases all go through the same shared boundary-sampling helper
(`shapeBoundarySamplesLocal`) for the non-circle cases, and every check
runs against `terrainKeepOutShapes(piece)` (see above), never against
`corners` directly.

**Separately, a purely informational signal**: `overlappingTerrainFootprintId`
checks a base against a card's whole footprint (`corners`), not just the
blocking feature within it — since the card itself is walkable, this
doesn't affect placement legality at all, it just answers "is this unit
on a terrain piece's card, period," the thing rules like cover actually
care about. Drawn as a live amber ring around a token — see "In-terrain
indicator" under Deployment UI below.

## Base overlap

A separate rule from terrain keep-out, not a variant of it: no two bases
can overlap each other, period — applies to every unit regardless of
type or owner, unlike the vehicle-only/infantry-passable terrain rules
above. `doBasesOverlap(centerA, baseA, rotationA, centerB, baseB,
rotationB)` in `geometry.ts` handles any shape-pair combination (circle,
oval, rectangle) by representing one base as an approximating polygon
(`baseAsPolygon`, a 24-sided approximation for circles, the same
boundary-sampling helper terrain uses for oval/rectangle) and reusing
`isBaseOverlappingPolygon` against it — no separate intersection
algorithm needed per shape pair.

Enforced everywhere a token's position can change:

- **Placement** (`handleBoardClick`) — checked against every currently
  placed token; formation placement is all-or-nothing across every
  model, but a formation's own members aren't checked against each other
  (`formationOffsetsIn` already lays them out without overlapping).
- **Dragging** (`handleTokensMove`, both free drag and Turn 1 movement)
  — `isPathOverlappingOtherBases` samples the whole segment from a
  token's current position to the candidate, not just the destination,
  for the same tunneling reason the vehicle/terrain path check exists: a
  fast drag frame could otherwise jump clean over another base without
  any sampled point landing squarely on it. A group drag excludes its
  own members from the check via `otherBaseTuples(excludeIds)`, so
  translating a whole selection doesn't have it block on itself.
- **Selection rotation** (`handleRotateSelected`) — computed and checked
  before calling `setState`, so a rotation that would swing a member into
  a non-selected token is rejected as a whole rather than partially
  applied.
- **Ghost preview** (`MapView`) — shows invalid on overlap too, via the
  same `doBasesOverlap` check the real placement uses, for both single-
  base and formation ghosts.

Verified the shape-pair math directly before trusting it anywhere in the
app: two 32mm circles' overlap boundary lands at exactly 2x the radius
(1.26in), circle-vs-oval and rect-vs-rect both matched hand-computed
expected results. End-to-end through the app, placement is rejected
exactly within that boundary and succeeds just outside it. The drag case
needed two rounds of debugging a test, not the app, before trusting the
result: an early check found offsets under ~10px were landing on an
existing token's own hit-target (selecting it, not attempting a new
overlapping placement) rather than genuinely testing rejection, and a
"farthest from the drag's original position" heuristic for identifying
which token had moved was picking the *stationary* token by mistake,
since it happened to end up farther from that reference point than the
token that had actually moved and been correctly blocked. With both
fixed: a drag toward another token stops with the stationary token
completely unchanged (0.0px moved) and the final gap between the two
bases at 24.7px — outside the ~16.66px overlap boundary, confirming the
drag was stopped before actual contact, not after.

## Deployment UI

The main "Deploy" tab flow: pick a disposition for each side ->
resolve to a mission pack -> pick a layout -> place tokens.

**Disposition -> mission pack resolution** (`src/data/dispositions.ts`):
the 5 dispositions are Purge the Foe, Take and Hold, Priority Assets,
Disruption, Reconnaissance. A pair of picks resolves to a manifest id
prefix via an explicit lookup table (`PAIR_TO_PREFIX`) — deliberately not
a formula, since the manifest's existing naming isn't alphabetically
consistent about which disposition comes first (`tah_purge`, but
`purge_dis`; `purge_pa`, but `recon_pa`). Same disposition picked for both
sides resolves to that disposition's mirror pack (e.g. Purge + Purge ->
`purge_mirror`). **Take and Hold has no self-mirror pack** in this
dataset — the UI disables picking it for both sides rather than letting
you hit a dead end after the fact.

**`src/components/DispositionPicker/`** — `DispositionPicker.tsx` (the two
button grids) and `MissionMapPicker.tsx` (shows the resolved pack's 3
layouts as clickable thumbnails, reusing `MapView` in thumbnail mode).

**`src/components/DeploymentView/DeploymentView.tsx`** — the interactive
board. Owns the placed-tokens array for the current session and wires
`MapView` (in interactive mode) together with `TokenPalette`:
- Click a palette single base size to "arm" it, click the map to place
  one token of that size/owner there.
- Click a unit template instead to arm a whole formation — one click on
  the map places all 5 or 10 models at once, laid out per
  `formationOffsetsIn()` and centered on the click point.
- Every placement gets the next letter (A, B, C...) and every model in
  one unit-template placement shares that letter, so it's visually clear
  which tokens belong to the same unit.
- **Infiltrators** toggle in the palette: off (default) requires every
  model's *entire base* (not just its center point — see
  `isInDeploymentZone` in `src/data/geometry.ts`) to land fully inside
  that owner's deployment zone (all-or-nothing for formations) or the
  placement is rejected; on lifts the restriction entirely. Enforced both
  at initial placement and when dragging an already-placed token to
  reposition it during deploy mode (not during Turn 1 movement, where
  leaving the zone is expected) — see v0.44 in Status for why the latter
  needed its own fix; it wasn't automatic from the former.
- While something is armed, a semi-transparent **ghost preview** follows
  the mouse over the board (the whole formation for a unit template) —
  **scroll the mouse wheel** to rotate it in 15° steps before committing.
  Re-arming (including re-picking the same thing) resets rotation to 0.
  The ghost also turns a warning color over any spot a non-infiltrator
  placement there would be rejected.
- **In-terrain indicator**: any token whose base overlaps a terrain
  piece's card footprint at all — not just the blocking feature within
  it, since the card is walkable — gets a dashed amber ring drawn around
  it (`Token`'s `inTerrain` prop, computed via
  `overlappingTerrainFootprintId` in `geometry.ts`). Purely informational,
  not a legality signal: it's the same shape as the base itself, scaled
  up, so it reads correctly under rotation for oval/rectangular bases
  too. Live on real tokens while dragging and at rest, and on both the
  single-base and per-model formation ghost previews, so a player can
  tell before committing a placement, not just after.
- Drag an existing token to reposition it individually — placing a
  formation doesn't automatically link its models into a rigid group, so
  by default each one moves independently even though they share a
  `groupId` and a label.
- **Click-drag empty board space to marquee-select multiple tokens**
  (only when nothing's armed — while armed, drag-on-empty-space places
  instead). Then drag any selected token to move the *whole selection*
  together, keeping every token's position relative to the others. A
  plain click (no drag) on a token that's part of the current selection
  narrows it down to just that one, matching the usual file-manager
  convention; a plain click on empty space clears the selection.
- Click a token (or select multiple via marquee) to select it, then
  rotate or delete via the palette sidebar. Rotating a multi-token
  selection turns it as a rigid body around the *group's* centroid
  (repositioning the models relative to each other, the same way a unit
  template's formation rotates before placement) rather than spinning
  each token in place independently — a single-token selection still
  rotates in place, since that's what "rotate around a group of one"
  reduces to.
- **Scroll the wheel over the board with a selection active** (and
  nothing armed) to rotate it the same way, 15° per tick — the exact same
  rotation used during placement, just usable after the fact on tokens
  that are already down.
- **During Turn 1**, an "Undo last leg" button appears alongside
  rotate/delete for the current selection, reverting a token to before
  its most recently completed movement leg — see "Turn 1 movement phase"
  below for the full multi-leg model this undoes a step of.

**How placement works in `MapView`** (`src/components/MapView/MapView.tsx`):
when passed a `tokens` array and `onBoardClick`/`onTokensMove`/
`onSelectionChange` props, it renders an additional SVG layer with two
circles per token — a visible one (the actual `Token` shape) and an
invisible, larger one on top purely as a drag/click hit-target, so small
25mm tokens are still easy to grab precisely. Marquee-select renders a
dashed accent-colored `<rect>` in the same local coordinate space while
dragging (only past a small movement threshold, so a plain click doesn't
flash a zero-size box); mouseup checks each token's `toDisplayPx` center
against the box's bounds to build the new `Set<string>` selection.
Group-drag captures every selected token's starting position in a ref at
mousedown, then on each mousemove computes one delta (from whichever
token the mouse actually grabbed) and applies that same delta to all of
them, batched into a single `onTokensMove` call rather than one call per
token.

**Rotation and screen-to-board coordinates**: the full (non-thumbnail)
board renders rotated 90° into landscape via a single SVG `<g
transform="rotate(...)">` wrapping the map image and every overlay
element — not a CSS transform on the outer DOM node. All the actual
coordinate math (`toDisplayPx` converting board inches to pixels, and its
inverse for clicks) stays in the *unrotated* local space and is completely
unaware rotation is happening. Screen clicks are converted into that local
space via `element.getScreenCTM().inverse()`, which the browser computes
correctly regardless of the rotation (or any future CSS scaling) — no
manual trigonometry needed. This was the actual hard part of the rotation
feature; getting the visual rotation right was comparatively easy.

This flow was verified with an actual browser-driven Playwright test
(build the app, serve it, drive it with real clicks/drags), not just a
type-check — see the Status entry above for what that caught. The most
direct check for the rotation math specifically: drag a token on the
rotated board and compare its actual on-screen movement to the mouse's
screen-space movement (matched to within floating-point noise).

### Zoom

100%-400% via Alt+scroll over the map (a "Reset" button, shown once
zoomed, jumps straight back to 100%). Originally a click +/− button pair
on Ctrl/Cmd+scroll; switched to Alt+scroll-only by request, dropping the
buttons entirely in favor of the scroll gesture. Note this means trackpad
pinch-to-zoom (which browsers report as a wheel event with `ctrlKey` set,
not `altKey`) no longer triggers it — a tradeoff of the Ctrl/Cmd-to-Alt
switch worth knowing about if that's how you'd naturally reach for zoom.
Panning around a zoomed-in board is native browser scroll on the map's
container (`overflow: auto`) rather than a custom drag gesture —
deliberately, so it doesn't conflict with marquee-select's click-drag.

Implementation-wise, the actual rendered pixel size of the `<svg>` is
computed explicitly: measure the container via `ResizeObserver`, compute
`fitScale = min(containerWidth / boardWidth, containerHeight /
boardHeight)` (the "fit the whole board in the container" scale), then
`renderedWidth = boardWidth * fitScale * zoom`. Both the CSS style *and*
the SVG's own `width`/`height` attributes are set to this explicit value
— no `object-fit`, no CSS `transform: scale()`. That's a deliberate
choice, not an arbitrary one: an earlier version combined `object-fit:
contain` (for the 100% case) with a separate `transform: scale()` (for
zoom) on the same element, and it introduced a real, measured placement
error that grew with zoom level. See the v0.24 Status entry for the full
story, including a test-methodology mistake caught along the way — worth
reading if you're touching this code, since the failure mode wasn't
obvious from the symptoms alone.

Because click/drag coordinate conversion throughout this app already
goes through `getScreenCTM()` (see "How placement works in MapView"
above) rather than manual pixel math, zoom needed zero changes to any of
the placement, drag, or movement-measurement logic — the browser's own
CTM correctly accounts for the SVG's current rendered size at any zoom
level automatically.

### Turn 1 movement phase

`DeploymentView` has two modes, `"deploy"` and `"move"`, toggled via the
palette's "Begin Turn 1" / "Back to Deployment" button:

- **Begin Turn 1** snapshots every token's current position as the start
  of its movement path — `Map<string, MoveWaypoint[]>` (`movePaths`
  state, each value starting as `[{pos, distUsed: 0}]`) — and disables
  new placement — the palette's Unit dropdown, unit templates, and
  single-base sections all disappear while `mode === "move"`.
  `MoveWaypoint` (`src/data/placement.ts`) pairs a position with the
  distance spent traveling to reach it.
- Movement doesn't have to be a single straight line — real vehicles
  often need to route around obstacles ("left a bit to get around the
  ruin, then straight down as far as I can"), and what has to stay under
  the Move characteristic is the *total* distance across every leg, not
  the straight-line distance from where a unit started the turn to
  wherever it ended up. Each drag gesture (or each segment between
  checkpoints — see below) is a "leg," clamped against whatever's left of
  the token's Move allowance after every *already-committed* leg
  (`totalDistanceUsed()`, summing each waypoint's recorded `distUsed`).
  Within a single leg, `handleTokensMove` in `DeploymentView` measures
  distance as the straight line from the last *committed* waypoint to
  wherever the token currently is, **recomputed live every frame, not
  accumulated**.
- **That "live, not accumulated" choice is deliberate and was a real
  correction, not the original design** (see v0.34 in Status). An earlier
  version tracked true incremental distance — the actual frame-to-frame
  path length, correctly penalizing any wandering within a drag. That was
  technically accurate but made ordinary placement unusable: nudging a
  token back and forth while lining it up exactly permanently ate into
  its Move budget the same as a genuine repositioning would. Real
  tabletop measurement doesn't work that way either — what counts is
  where the model finally comes to rest, not the wobble of the hand
  carrying it there. Recomputing live means backing up and adjusting
  within a drag costs nothing extra; only the net distance from the leg's
  start to wherever you actually release matters.
- **Spacebar checkpoints, for when a multi-leg route is genuinely
  intentional.** Holding **Space** while actively dragging a token drops
  a checkpoint — commits the current position as a real `MoveWaypoint`
  *without releasing the mouse*, and the still-continuing gesture then
  measures as a fresh leg from that point. This is how the app now
  distinguishes "adjusting my placement" (free, live-recomputed, no
  checkpoint) from "I'm deliberately routing around this ruin" (an
  explicit action, permanently committed). `MapView` exposes
  `onCheckpoint(tokenIds) => boolean`, wired to a `keydown` listener that
  checks `dragAnchorId.current` (attached once on mount, not re-attached
  on every token-position update mid-drag — it reads current props via
  refs kept updated every render instead). `DeploymentView`'s
  `handleCheckpoint` refuses (and returns `false`, showing the same
  error a real release would) if the checkpoint spot is currently illegal
  under the "can't end on top of terrain" rule; only on success does
  `MapView` reset its own drag-start reference to the checkpoint, which
  is what makes the continuing gesture measure as a genuinely fresh leg
  rather than still counting from the original grab point.
- When a drag gesture ends legally (mouse released, not just a
  checkpoint), `MapView` fires `onDragEnd`, and `DeploymentView`'s
  `handleDragEnd` appends the token's final position and the leg's
  straight-line distance as a new `MoveWaypoint`. Applied per-token even
  during a multi-select group-drag, so a mixed-unit selection correctly
  stops each member at its own limit rather than enforcing one shared
  cap.
- **Undo last leg**, a palette button enabled whenever the current
  selection has at least one committed leg beyond its turn-start point
  (this includes legs created via a checkpoint, not just a full
  release-and-redrag). Pops the last `MoveWaypoint` off the path and
  reverts the token's displayed position to whatever's now the new last
  waypoint — the correction mechanism for "that leg went around the
  wrong side of the ruin," retry with a fresh drag from the reverted
  point rather than fighting the existing one.
- `MapView` draws the whole path as a measuring arrow — a real
  multi-segment polyline (small dots at each committed bend, an SVG
  `<marker>` arrowhead at the current end) rather than a single
  origin→current line, labeled with the *total* distance used across
  every leg (`pathLengthIn()`, summing recorded `distUsed`) plus the
  current leg's live straight-line distance, e.g. `"5.6\" / 10\""`,
  switching from the normal accent color to a warning color once a token
  is at its cap. Same local-coordinate-space rendering everything else
  uses, so it's automatically correct under the board's landscape
  rotation without any special-casing.
- **Back to Deployment** clears `movePaths` and flips back to `"deploy"`
  mode, restoring placement. A later "Begin Turn 1" re-snapshots fresh
  single-point paths from wherever things ended up — there's no Turn 2
  concept yet (see Roadmap).

## Zone correction tool

Mostly superseded for zones as of the template rewrite — zone boundaries
are generated from exact geometric formulas rather than traced, so there's
no longer a per-map manual-correction step in the normal workflow. Worth
being precise about what that does and doesn't mean: a full visual pass
across all 42 maps did find 2 real bugs (a Crucible of Battle orientation
flip, and systematic ~1" depth errors on several Tipping Point / Sweeping
Engagement maps) — both were bugs in the *classifier/extractor script*,
fixed once in code and then correct for every map that hit that code path,
which is the whole point of the template approach: errors are shared and
fixable in one place instead of needing a separate manual fix per map.
`tools/zone-editor.html` is kept for two narrower uses:

1. **A fallback** if a future map turns out not to fit any of the 6 known
   patterns cleanly — `template_zones.py` will misclassify or error on
   anything structurally different, at which point hand-correction via
   this tool is the right move.
2. **A pattern for extending to terrain correction** — and indeed, this is
   exactly what `tools/terrain-editor.html` (below) was built from:
   the same drag/delete-vertex interaction, generalized from "one polygon
   per zone" to "N independent rectangles per map."

`tools/zone-editor.html` is a standalone (no build step) tool: it overlays
polygons on the actual source art and lets you drag vertices to fix them,
click an edge to insert a new vertex, or shift-click a vertex to delete it.
Export downloads a corrected `<map_id>_zones.json` — drop it into
`scripts/output/` and re-run `generate_ts.py` to bake the correction into
the map's `.ts` file.

To run it:
```bash
python3 -m http.server 8000   # from the project root
# then open http://localhost:8000/tools/zone-editor.html
```
It won't work opened directly as a `file://` URL — browsers block the
`fetch()` of `editor_data.json` under that protocol, hence the local server.
The embedded data now reflects the template-generated (exact) zones, so the
sidebar's ⚠ vertex-count flags are mostly stale — they were tuned for
detecting traced-contour noise, not evaluating exact templates. Ignore them
for now; they'll be relevant again once/if this tool gets extended to
terrain.

## Terrain correction tool

`tools/terrain-editor.html` — same underlying mechanics as the zone editor
(drag a vertex to move it, shift-click to delete it), generalized to
handle a variable number of independent rectangles per map instead of
exactly one polygon per zone. Additional controls: **click a piece** to
select it and reveal its drag handles; **"+ Add Piece"** drops a new
default rectangle near board center for pieces the extractor missed
entirely; **"Delete"** removes a bogus one (e.g. a merge artifact). Also
renders each piece's `keepOutFootprints` (if present) as a read-only
magenta overlay, so a card-boundary correction can be made with
visibility into where the actual blocking feature sits relative to it —
this tool edits the card only, not the keep-out shapes themselves.

To run it:
```bash
python3 -m http.server 8000   # from the project root
# then open http://localhost:8000/tools/terrain-editor.html
```
Same `file://` caveat as the zone editor — needs the local server for
`fetch()` to work. Export downloads a corrected `<map_id>_terrain.json` —
drop it into `scripts/output/` and re-run `generate_ts.py` to bake the
correction into the map's `.ts` file.

Unlike zones, there's no known shortcut (no small set of reusable patterns)
that would let a script get terrain to 100% the way it did for deployment
zones — pieces are placed at genuinely arbitrary positions and rotations.
This tool is the intended path to full terrain accuracy: a manual pass,
not another round of automated tuning. ~559 pieces across 42 maps is a
real chunk of work; doing it in a few sittings rather than all at once is
reasonable.
