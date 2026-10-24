# Dungeon frame performance

Level 9 now shares a spatial broad phase for floor, wall, sight, spell and
navigation queries. The authored walls and furniture are indexed in 160-unit
cells. Mutable generic fixtures retain live-bound checks. Map, save restoration
and door changes invalidate the index and pending paths together.

Floor footprints and segments wholly inside one floor rectangle use an exact
fast path. Doorways, unions between rooms and contacts along a floor boundary
retain the original sampling and contact rules. Movement still checks native
collision on every step; a cached straight corridor is reused only while the
actor remains on its previously cleared segment in unchanged static geometry.

Runtime magician A* jobs resume across frames in a FIFO queue. Navigation shares
a 1,500-node expansion budget and at most six new magician searches per frame. One typed
workspace, reused waypoints and reusable crowd buckets reduce garbage
collection. Unfinished searches can retain a previous usable route. Death,
pause and world replacement cannot advance stale jobs.

Zombies now share one player destination and a lazy reverse direction field.
Clear corridors skip the field entirely. Obstructed zombies follow the same
settled cells instead of creating individual A* jobs or polling line of sight
for pursuit. A bounded part of the same node budget advances the shared field
before magician searches. Two reusable field buffers avoid restarting the
whole flood whenever the moving player crosses a cell. Bite collision still
tests range and cover individually.

Spell simulation uses prewarmed banks of 97 projectile records (96 live plus
one fork-transfer slot), 48 ground effects and 96 dispersion records. Stable
in-place retirement retains painting and simulation order. A released record
clears its old state; ground records keep their private reusable hit-ID arrays.
Save snapshots remain detached from pool storage. No spell bank grows during
sustained combat.

Canonical, unstunned dungeon zombies use a conservative 64-unit render margin,
within which their complete model fits. The generic margin is 150 units.
Knockdowns, boxing, custom dimensions and other levels keep that wider margin.
This skips fully offscreen vector painting; simulation, visible art and the
lighting/height passes retain their own rules. Native edge and camera tests
compare every framebuffer channel before and after the cull.

The existing native Canvas character paths now support the pixel-tested p5
1.11.10 renderer as well as 1.11.11. Other versions and accessibility/clipping
modes retain their original paths. RGB paint conversion also reuses a bounded
palette of p5's final rounded color channels and exact alpha. This avoids
temporary Color objects and arrays while preserving custom maxima and mutable
palettes. Other color modes and p5 versions keep native conversion.

The sun shader returns its exact ambient
color when both directional light and specular power are zero, avoiding twenty
unused shadow samples per pixel underground. Torch, flashlight and spell
lights retain the same rendering pipeline, light limits and resolution.

## Measured results

Sequential runs compared `174069e` with optimized source SHA-256
`89e6126acb70c27fa9a7d53d16a194256ae66fe5132b35de2e312cf89154f6eb`.
Each case used 30 warm-up frames and 120 measured frames at 390×844 CSS pixels,
device scale 3 and the game's density cap of 2, with actual p5 1.11.10.
These five captures preceded integration of the concurrent footwork update
`a8f62d6`; the combined version received its own adjacent timing comparison and
the full gameplay, native input and pixel-parity checks.

| Scene / renderer | CPU median before → after | CPU p95 before → after |
| --- | ---: | ---: |
| First-room horde / Canvas | 42.7 → 11.5 ms | 63.2 → 21.2 ms |
| Fully populated dungeon / Canvas | 42.6 → 12.1 ms | 64.4 → 22.5 ms |
| All 288 zombies in first room / Canvas | 107.4 → 32.8 ms | 148.3 → 46.2 ms |
| First-room horde / advanced lighting | 44.3 → 14.3 ms | 70.1 → 28.2 ms |
| All 288 zombies in first room / advanced lighting | 113.5 → 36.3 ms | 148.5 → 51.1 ms |

Median CPU time fell 68–73%. Actor populations stayed intact, and all five
native runs finished without frame faults, browser errors or failed requests.
The dense stress cases and slower frames still exceed the 16.7 ms budget on
this host; these results establish an improvement rather than locked 60 FPS.
On-device sustained performance remains unmeasured.
The [comparison data](dungeon-performance-results.json) includes source hashes,
CPU percentiles and the separate software-rendered frame intervals.

After integrating `a8f62d6`, an adjacent first-room comparison with advanced
lighting measured 45.6 → 14.8 ms median CPU time and 66.6 → 24.3 ms p95. Both
versions retained all 84 actors. The combined source SHA-256 is
`6caf027a558643daefa74a7587223bf0ef9ca5cb75ba0f0d0885f8c16fdb1c13`.

The subsequent horde/pooling pass compared `bb6a044` with source SHA-256
`d5e7b9cf41f2577285e15f8f5e6556e2e6106febe3bf9eedc450dd6d4acf670c`,
using the same 30/120-frame setup and Canvas renderer:

| Scene | CPU median before → after | CPU p95 before → after |
| --- | ---: | ---: |
| First-room horde | 12.6 → 10.2 ms | 23.1 → 21.5 ms |
| All 288 zombies in first room | 32.0 → 29.3 ms | 44.4 → 43.0 ms |

All 84/342 actors remained alive. Average zombie paints fell from 44.2 to 24.1
and from 213.0 to 170.3 per frame by skipping fully offscreen models. These
captures preceded integration of the concurrent `818afab`/`d6b2969` footwork
updates. The [follow-up data](dungeon-horde-performance-results.json) records
both sources, navigation work and fixed pool capacities. Shared navigation
changes pursuit behavior; it still performs local steering and bite collision
for each zombie. Total AI time was approximately unchanged in these fixtures;
most measured frame savings came from avoiding offscreen painting. The dense
case still exceeds the 16.7 ms CPU budget on this software-rendered host.
The combined source after integrating `d6b2969` is SHA-256
`17907c1ed17c098f81f8dd9bd59d89038a33a33dff6030dc33b4e8e62558f5fa`.
It passes 1,381 headless checks, native dungeon/magician checks, 270 exact spell
simulation/art frames and 2,880 exact native edge-of-screen zombie poses.

## Reproducing the measurements

`tools/profile-dungeon.js` runs real p5 frames with live AI, spells, collision,
particles, lighting and HUD. It keeps enemies alive, seeds randomness and pins
the existing lighting quality so automatic tier changes cannot manufacture a
speedup. The fixtures include the first room with its 72 summoned zombies, the
complete 54-caster/288-zombie dungeon, and a deliberately extreme gathering of
all 288 zombies in the opening room while keeping the 54 authored casters.

Install p5 and Playwright outside the repository, provide Chromium, and run
source snapshots sequentially on an otherwise idle host:

```sh
git show 174069e:game.js > /tmp/dungeon-before.js
GAME_JS=/tmp/dungeon-before.js DUNGEON_P5=/path/to/p5-1.11.10.min.js \
  DUNGEON_CASES=opening_horde:fallback,populated_dungeon:fallback,dense_horde:fallback,opening_horde:advanced,dense_horde:advanced \
  DUNGEON_FRAMES=120 DUNGEON_WARM=30 DUNGEON_OUT=/tmp/dungeon-before.json \
  node tools/profile-dungeon.js
```

Repeat with the optimized `game.js` and a different output file. Optional
`VIS_DEPS` locates external Playwright dependencies; `VIS_CHROME` selects the
browser. The report includes source hashes, actor counts, CPU percentiles,
painted frame intervals, profiler samples and browser errors. Viewport defaults
to 390×844 at device scale 3, subject to the game's native density cap.

These cloud runs use Chromium with SwiftShader. Synchronous CPU time measures
the JavaScript/render-command budget; painted intervals include software GPU
work and are reported separately. Neither is a measurement of a Galaxy S25's
hardware frame rate. A 60 FPS frame has about 16.7 ms for its CPU and GPU work.

## Correctness checks

```sh
node tools/check-dungeon-query-performance.js
node tools/check-dungeon-ai-performance.js
node tools/check-dungeon-horde.js
node tools/check-dungeon-loot.js
SPELL_POOL_BASELINE=/tmp/dungeon-before.js node tools/check-occult-spell-pooling.js
DUNGEON_P5=/path/to/p5.min.js node tools/check-zombie-render-culling.js
CHARACTER_P5=/path/to/p5.min.js node tools/check-character-color-performance.js
DUNGEON_BASELINE=/tmp/dungeon-before.js DUNGEON_P5=/path/to/p5.min.js \
  node tools/check-dungeon-art-performance.js
SUN_BASELINE=/tmp/dungeon-before.js BATTLE_P5=/path/to/p5.min.js \
  node tools/check-dungeon-gpu-performance.js
```

The query test compares 28,000 point/segment/spell queries with the independent
original algorithms, including floor seams, thin cover, door states and live
fixture mutations. AI checks assert expansion limits, full-crowd fairness,
pause/reset behavior, movement distance and cache invalidation. Native Canvas
checks compare exact pixels and painter state across 960 dungeon poses; the
general character suite adds 480 poses. Real WebGL comparisons cover dungeon,
surface, rain, day/night, density, resize and lighting tiers.
The color conversion suite compares 14,633 cases on each of p5 1.11.10,
1.11.11 and 1.9.4, including HSB/HSL fallbacks and color mutations.
