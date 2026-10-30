# Level 2 NM-0 crowd performance

This pass starts at `37dfd722d2524a1810851ffc62905b3aa1d655a4`, the remote head of
`codex/directional-falls-and-footwork` when work began. It preserves character
art, effects, lighting, actor counts, AI scheduling, reaction delays, damage and
movement. The requested exception is ambient encounter scheduling: new forest
animals wait during NM-0 ambushes and until the player is outside Level 2's
starting compound. Existing animals, wounds and corpses continue to update.

## Changes

- Cover sight, muzzle and projectile queries reject coarse spatial-cell misses
  using conservative bounds before classifying cover or resolving its geometry.
  Exact swept intersections, gate wings and first-hit order are retained.
- Standing collision probes skip stance eligibility work when the effective
  pose is already standing. Low cover still resolves before this shortcut;
  suppression and transitions remain live between probes within a frame.
- Excavation synchronization reuses its existing key/cell. Actors already at
  their target depth skip a zero-delta exponential without skipping timers.
- The existing exact RGB palette cache also handles p5 1.9.4. Native cel paths
  use its verified closing sequence, avoiding temporary p5 vertex arrays. Its
  different rectangle and ellipse implementations retain their original paths.
  Alternate color modes, clipping, accessibility and unknown versions retain
  their fallbacks. Limb normalization reuses lengths already calculated.
- Empty wildlife updates skip grid work; suppressed encounters consume no
  ecology random numbers or placement attempts.

## Reproduction

`tools/profile-nm0-battle.js` starts the native Level 2 tower victory ambush with
80 recruited allies and 100 initial NM-0 ambushers. Ten ambient patrol actors
also remain in the native world. Actor health is raised to sustain fire for
the whole sample. The native replacement spawner is retained, but its 200
reserves are unused because the high-health actors do not die. This measures
sustained crowd/combat work rather than a complete ambush victory.

The profiler runs real p5 `draw()` in Chromium at 540 × 1170, including native
movement, cover, incoming-shot reactions, projectiles, particles, streaming,
terrain, shadows, lighting and HUD. Lighting quality is pinned for comparisons.
The default quiet wildlife timer isolates equivalent work from the separately
requested spawn suppression; `BATTLE_WILDLIFE=native` includes that change.

Install Playwright and p5 outside the repository, provide Chromium, then run
sources sequentially with the same dependency versions:

```sh
mkdir -p work
git show 37dfd72:game.js > work/nm0-before.js
VIS_DEPS=/path/to/dependencies VIS_CHROME=/usr/bin/chromium \
  BATTLE_WARM=60 BATTLE_FRAMES=120 BATTLE_LIGHTING=fallback \
  GAME_JS=work/nm0-before.js BATTLE_OUT=work/nm0-before.json \
  node tools/profile-nm0-battle.js
VIS_DEPS=/path/to/dependencies VIS_CHROME=/usr/bin/chromium \
  BATTLE_WARM=60 BATTLE_FRAMES=120 BATTLE_LIGHTING=fallback \
  BATTLE_OUT=work/nm0-after.json node tools/profile-nm0-battle.js
```

`BATTLE_P5=/path/to/p5.min.js` selects a specific p5 version.
`BATTLE_LIGHTING=advanced` exercises the advanced light rig.
`BATTLE_PROFILE=1 BATTLE_FINE=1` adds diagnostic instrumentation; leave those off
when comparing timings. `BATTLE_PIXELS=1` fingerprints every measured Canvas
frame after the CPU timer, so use that mode for parity rather than painted
interval timings. Reports include raw frame samples, gameplay/RNG fingerprints,
actual crowd/projectile/effect load, browser errors and caught frame faults.

## Verification

Adjacent runs used 60 warm-up frames and 120 measured frames, with diagnostic
instrumentation disabled. Median synchronous `draw()` CPU time:

| p5 / lighting | Original | Optimized | Change |
| --- | ---: | ---: | ---: |
| 1.9.4 / fallback, pair 1 | 70.1 ms | 61.5 ms | 12.3% lower |
| 1.9.4 / fallback, repeat | 70.0 ms | 60.7 ms | 13.3% lower |
| 1.11.11 / fallback | 61.6 ms | 59.9 ms | 2.8% lower |
| 1.11.11 / advanced | 170.6 ms | 172.0 ms | Effectively unchanged |

The 1.9.4 fallback p95 improved from 84.3–87.4 ms to 77.4–77.6 ms.
Its entity update stage fell from 7.1–7.3 ms to 6.4–6.5 ms, while the depth-sorted
scene pass fell from 51.7–52.4 ms to 43.7 ms. Particle work remained unchanged.
The modern fallback p95 improved from 77.7 ms to 73.8 ms. Advanced lighting's
software WebGL cost dominates this host; its p95 was 205.2 ms before and
204.3 ms after, so these measurements establish no advanced-lighting speedup.
These figures remain above the 16.7 ms frame budget on this software-rendered
host. They establish less work in the fallback path, not universal 60 FPS.

All timed pairs retained 80 allies, 100 ambushers and the 10 native patrol
actors. Full gameplay fingerprints, both random states and final Canvas pixels
matched within each p5/lighting mode, with no browser errors or frame faults.
Separate p5 1.9.4 fallback and 1.11.11 advanced replays also matched every one
of their 120 measured Canvas frame fingerprints, plus gameplay, RNG, events
and loads. All 12 final timing/parity runs completed without frame faults.
Raw timing and replay data are in `nm0-battle-performance-results.json`.

Focused checks compare the changed functions with the original branch:
`check-cover-query-performance.js`, `check-stance-performance.js` and
`check-shovel-crowd-performance.js`. `check-wildlife-battle-budget.js` checks
suppression, no placement/RNG work, recovery and existing animal/corpse timing.

`check-character-color-performance.js`, `check-character-render-parity.js` and
`check-figure-path-performance.js` verify native color and exact Canvas pixels
on p5 1.9.4 and 1.11.11, including lowered/cover figures and Graphics buffers.
The cover, stance, incoming-shot, dive, leg injury, projectile leg-contact,
shovel, population, fortress, save/load and reset regression checks also pass.

The older `check-falls-and-footwork.js` fails its boxing foot-width assertion
at line 117 on both the untouched source and the optimized source. The current
directional and crouch footwork checks pass; this pass does not alter boxing.

Cloud Chromium uses software rendering. CPU time and painted intervals describe
this host rather than device FPS. Audio cues execute without an initialized Web
Audio context, so synthesized voice cost is excluded.
