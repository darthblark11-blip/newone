# NM-0 openings: groups of 20

NM-0 ambushes now open with 20 enemies total per encounter, spread across the
existing approaches. This is the combined opening, not 20 per flank. The
mission still accounts for every original defender through its reserve pool.

| Encounter | Previous opening | New opening | New aerial count | Reserve after opening |
| --- | ---: | ---: | ---: | ---: |
| Tower, both flanks combined | 60 | 20 | 2, previously 4 | 280 of the same 300 total |
| Gate, all three approaches combined | 45 | 20 | 1, previously 3 | 130 of the same 150 total |
| Relay fort | 30 | 20 | 1, previously 3 | At least 130 of the same 150 total |
| Grey Fatigue | 30 | 20 | 0 | 130 of the same 150 total |
| Scripted ambush save restoration | Up to 60 | Up to 20 | 4% allocation, previously 8% | Remaining budget minus restored enemies |

Whole-unit aerial quotas round down when halved. Tower composition is 17
standard soldiers, one heavy and two aerial units; gates use 18 standard, one
heavy and one aerial. Forts use 17 standard, two heavy and one aerial. Blocked
fort stations remain in reserve instead of spawning inside collision geometry.

Reinforcement rolls now allocate 5% to aerial units, down from 10%; their
existing variant split remains in place. Heavy reinforcement probability stays
at 10%. Grey Fatigue retains its authored ground-only type.

These settings apply across sectors, including tower and north/south gate
entry points, overworld relay forts, and the Grey Fatigue encounter. Gate
approaches divide the 20 slots as 7/7/6; tower flanks receive ten each. Separate
encounters can merge while retaining their individual budgets and counted
reserves. Allies are never tagged as ambush enemies.

Kill-triggered arrivals still replace one enemy after the existing 200–800 ms
delay. Fort emergency refill checks still run every 24 frames, with the existing
`2, 2, 3, 2, 3` phases stopping at a six-body floor or the remaining reserve.
The 20-body policy describes openings and save restoration, rather than a new
global cap on merged encounters or independently pending refill callbacks.

Validation:

- `check-nm0-batch-sizes.js`: 71 checks covering openings, aerial quotas,
  merges, allies, reserve conservation, full 300/150-enemy drains, replacement
  timers, blocked stations, refill timing, and old/new save restoration.
- `check-nm0-global-policy.js`: 128 cross-sector checks across sectors 1–7,
  including both reinforcement paths and existing hostile firing coordination.
- Gate isolation: 179 checks; fortress: 93 checks; fort survivors: 36 checks.
- `check-nm0-mechanics-parity.js --deployments-only`: exact source guards for
  five deployment functions and eleven policy constants. The full parity
  suite retains an unrelated, pre-existing `enemyCoverDiveGoal`/forest-timber
  mismatch, also reproduced on the unchanged prior commit.

The battle profiler accepts the current 20-body opening and historical 60/100
baselines. These gameplay settings do not establish physical-phone frame rates.
