# Level 2 NM-0 combat rendering

The shared stance, cover-query and excavation shortcuts from `eec8fed` have
been removed. Enemy decisions, targeting, reaction delays, cover goals,
movement, injuries, projectile damage and reinforcement rules match
`37dfd722d2524a1810851ffc62905b3aa1d655a4` again. The separately requested
animal encounter gate remains: new forest animals wait during NM-0 ambushes
and inside Level 2's starting compound. Existing animals retain their original
collision, simulation, wounds and corpse timing.

This follow-up targets rendering:

- Firearm faces/details use the existing exact color palette and native Canvas
  quad/line paths. Geometry, face order, separate strokes and alpha stay intact.
  The ordinary RGB fixture creates 4,723 fewer temporary p5 colors. Unsupported
  versions, clipping, accessibility and alternate modes retain their fallbacks.
- Directional shadows stop sampling when visibility is exactly zero. Polar
  shadows stop when their recorded peak is exactly one. Further samples cannot
  change those saturated answers; partial rays retain every original sample.
  Shadow resolution, light budgets and visual settings are unchanged.

## Verification

`check-nm0-mechanics-parity.js` locks 218 functions, 33 methods/accessors, six
constructors and 50 tuning tables/constants to the original branch. This
includes the state machine, collision, cover, physical weapon/stance geometry,
timers, targeting, damage, injuries and native ambush replacement rules. The
previous optimization commit intentionally fails this guard. Restored cover,
stance and excavation tests compare original behavior; they no longer assert
the discarded shortcut budgets.

Full normal-health replays compare own actor fields/reference graphs,
projectiles/shooter references, wounds/corpses, world/gate/fort/town state,
counters, ecology RNG and delayed callback queues after every frame.
Both lighting modes passed 160 state frames and 120 measured picture frames
against the original source, including 56 kills, ten reserve callbacks,
56 corpses and eight lowered actors. The seeded replay did not trigger a
probabilistic leg injury; focused native injury/recovery tests cover that
branch separately.

`check-firearm-render-parity.js` compares exact Canvas pixels and painter state
on p5 1.9.4 and 1.11.11 across eight ordinary/fallback modes, including recoil,
reload, crouch/prone, high/low cover and injury poses. `check-lighting-shadow-budget.js`
compares every byte in composite, normal, light, polar and occlusion targets
over 21 scenes. Real GLSL counters show saturated sun samples falling from
20 to one and saturated polar samples from seven to one. Partial rays retain
20 and seven samples respectively.

Incoming-shot, dive, cover, stance, leg contact/injury, ally-command, ambush
cleanup, native handgun and shovel perception checks pass. Two older longgun
aim-laser fixture assertions also fail on unchanged `eec8fed`; their gameplay
is untouched.

## Measured scope

Clean, sequential normal-health replay pairs compared `eec8fed` with this
rendering follow-up, using p5 1.11.11, 40 warm-up frames and 120 measured frames
at 540 × 1170 CSS pixels and density one. All per-frame actor/effect/death and
reserve loads, final state, RNG and pixels matched within each pair.

| Lighting | Earlier pass median CPU | Follow-up median CPU |
| --- | ---: | ---: |
| Fallback, pair 1 | 65.8 ms | 62.6 ms |
| Fallback, repeat | 65.8 ms | 63.9 ms |
| Advanced | 176.9 ms | 173.8 ms |

These are modest gains: roughly 3–5% in fallback and 2% in advanced lighting
on the software-rendered host. They do not establish a noticeable FPS gain on
the user's Galaxy S25. A 360 × 780 CSS, DPR-three, density-two touch fixture
also verified the production 720 × 1560 backing dimensions. The actual Adreno
GPU remains unavailable in the cloud.

The close-range leg-aim replay additionally matched 110 state frames and
80 picture frames against the original mechanics, including a naturally
triggered leg injury, 38 deaths and six native reserve callbacks. No injury
proc or combat decision was forced.

Experiments using bitmap transfer, repeated polar-texture lookup caching and
opaque hexadecimal paint assignment were rejected after whole-frame tests
showed no useful gain or a regression. A tighter actor painting margin was
also rejected: although omitted actors painted no visible pixels themselves,
skipping their render calls exposed a shared state dependency and changed
13 interior color channels. The original 150-unit allowance is retained.
The final game includes none of these experiments.

Raw CPU/interval samples and compact verification results are in
`nm0-rendering-followup-results.json`.

## Profiling

`profile-nm0-combat.js` starts the native Level 2 tower-victory ambush with
80 recruited allies and 100 initial NM-0 ambushers. NPCs/barrels retain normal
health, enabling wounds, deaths, corpses and native kill-driven reserves.
Only the player is kept alive to observe the complete sample.

The native driver uses the actual p5 loop, real elapsed time/browser timers,
and initialized Web Audio. The replay driver uses the same native game
functions with a virtual timer queue honoring callback delays. Input cycles
between body, head and leg aim. Optional elapsed-time traces include slow frames.

Install Playwright and p5 outside the repository, then run sources sequentially:

```sh
mkdir -p work
git show eec8fed:game.js > work/nm0-pass1.js
git show 37dfd72:game.js > work/nm0-original.js
VIS_DEPS=/path/to/dependencies BATTLE_P5=/path/to/p5.min.js \
  BATTLE_DRIVER=native BATTLE_AUDIO=native BATTLE_HEALTH=normal \
  BATTLE_LIGHTING=fallback,advanced BATTLE_WARM=40 BATTLE_FRAMES=120 \
  BATTLE_OUT=work/nm0-native.json node tools/profile-nm0-combat.js
VIS_DEPS=/path/to/dependencies BATTLE_P5=/path/to/p5.min.js \
  BATTLE_DRIVER=replay BATTLE_AUDIO=off BATTLE_HEALTH=normal \
  BATTLE_COMPARE=work/nm0-original.js BATTLE_PIXELS=1 \
  BATTLE_WARM=40 BATTLE_FRAMES=120 BATTLE_OUT=work/nm0-parity.json \
  node tools/profile-nm0-combat.js
```

Keep sampling, full-state and per-frame pixel instrumentation off for clean
timing pairs. Native audio acceptance uses wall time and consumes shared
`Math.random` draws, so strict state/pixel comparisons disable audio. Separate
native runs measure sound. Sound graphs, voice limits, scheduling and random
draws are unchanged.

This cloud browser exposes Vulkan SwiftShader rather than a hardware GPU.
Canvas/WebGL transfers and synchronization dominate advanced-lighting frames.
Synchronous audio chain work averaged about 0.42 ms per frame. These results
cannot establish FPS on a phone or desktop GPU.

For the actual Galaxy S25, `tools/build-s25-benchmark.js` builds a standalone
HTML test with both the original and current game, p5, fonts and audio embedded:

```sh
node tools/build-s25-benchmark.js --p5 /path/to/p5.min.js \
  --out work/s25-combat-benchmark.html
```

Copy that file to the phone and open it in Chrome. Each run starts from its own
tap so native audio can resume. It runs one game at a time, hides the benchmark
controls during play, disposes the preceding audio/GPU context, and offers a
local JSON download. No network resources or saved campaign state are needed.
Its measurements describe the phone that actually runs it; the tool is not an
assertion that the S25 FPS problem has been resolved.

The [first-pass data](nm0-battle-performance-results.json) is historical.
It used high-health actors, disabled audio and a quiet wildlife clock, and did
not exercise normal deaths/reinforcement scheduling. It does not describe this
follow-up implementation.
