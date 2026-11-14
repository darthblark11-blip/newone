# Gate ambush isolation

A fortress gate breach now suspends ambient activity for that sector until
its merged NM-0 encounter is completely defeated. This applies to the main
fortress gates and every relay fort, including Level 1's southwest relay.
Standalone tower/Grey Fatigue encounters retain their existing rules; merging
one into an active gate fight retains isolation until the whole fight clears.

At the breach, ambient enemies, city NPCs, checkpoint residents, frontier
workers/bounties, wildlife and department resident actors leave the world.
Their normal population creators remain blocked throughout the fight, even
inside captured territory and after reload. Living residents and contract
survivors are banked, not killed: despawning grants no score, casualties or
recruitment. Construction and optional hunting/interior activities wait too.
Static terrain, buildings and visual settings remain unchanged.

The objective's finite garrison and liberation cohort, freed recruits and
active combat allies remain in battle. The previous survivor rule still holds:
only this fort's surviving freed guards join the Directive, after its complete
ambush clears. Unrelated forts do not spawn their own garrisons during the fight.

Ambushers bypass the old 6,000-world-unit AI update cutoff and distant actor
cleanup. They retain normal movement, collision, attacks, weapon timing and
line-of-sight checks while pursuing. Existing soldiers never teleport. When a
new reserve would otherwise arrive more than 4,800 world units from the
player, it instead searches for an offscreen arrival around the player. This
allows pursuit into owned territory without relocating arrivals 1,500 metres
away. Sector travel and optional interiors wait until the encounter clears.

The main gate still opens with three groups of 15. All 45 now count toward
its 150-person total, leaving 105 reserves. Previously only the last 30 were
tagged, leaving an uncounted group of 15 alongside 120 reserves. Relay fights
retain their 30-person opening (blocked stations become reserves) and 150
required enemies; ambient wanderers no longer enlarge that quota.

Save/load restores the gate lock and every outstanding quota, including main
gate saves made before the towers fall. Reload seeds six soldiers per fight
and retains the remainder in reserve. Missing bodies return to their own
reserve instead of triggering an early victory. Ambient spawning resumes only
after the native clear handoff.

## Validation

- `node tools/check-gate-ambush-isolation.js`: 179 checks cover immediate
  despawn, population/casualty preservation, blocked spawn paths, actual native
  infantry/heavy/aerial pursuit beyond 6,000 units, distant reserve arrivals,
  no teleporting, reload, missing-body recovery, all 150 kills and resumption.
- Existing fortress, ownership, relay territory, survivor, save/load, travel,
  boxing, batch sizing and cross-sector policy checks were run.
- `node tools/check-fort-capture-browser.js` exercises native p5 1.9.0 in
  Chromium: 150 kills, 43 surviving guards, one Directive award and reload,
  with no browser errors or frame faults.
- The mechanics source guard still checks 218 functions, 33 methods/accessors,
  six constructors and 50 tuning tables/constants. Authorized isolation and
  pursuit changes have explicit reviewed source hashes; damage, weapons,
  collision and movement implementations remain guarded.

This verifies the activity limit and encounter lifecycle. It is not a measured
FPS improvement on a Galaxy S25. The phone/GPU is unavailable here; desktop
functional checks do not establish the phone's frame rate or frame consistency.
