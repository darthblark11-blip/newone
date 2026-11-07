# Rendering compatibility with the phone's p5.js 1.9.0

## Canvas2D smoothing warning fix

p5 1.9.0's `smooth()` unconditionally calls `setAttributes('antialias', true)`,
including on P2D graphics. The existing terrain bake and ground blit used it,
producing the repeated "does not use a WEBGL renderer" console message. These
two Canvas2D passes now set `drawingContext.imageSmoothingEnabled` directly.
This preserves filtering without requesting attributes from the wrong renderer.

`node tools/check-terrain-smoothing-browser.cjs` exercises the real p5 1.9.0
runtime. The baseline emits 28 warnings and the fix emits zero. Terrain texture
and ground-blit pixel hashes match in Levels 1, 2 and 3; a live Level 1 frame
keeps advanced lighting active, with `gl.getError() === 0` and no frame fault.
The existing 111 lighting checks also pass.

The supplied Spck page loads a local `p5.min.js`. That file is p5 1.9.0,
SHA-256 `726ac96626b93f5bcaff83a910b6c60d3a9728f063e0eb73b5d0819ffc356915`.
Previous cloud tests used 1.11.11, so they exercised optimized paths that the
phone's library could not select.

Baseline: `395bfe9` on `codex/directional-falls-and-footwork`. Its game source
matches the uploaded phone game. The optimized RGB palette/firearm paths,
figure cel paths and forest polygon paths excluded 1.9.0 by version guard.

This change enables those existing paths for the exact supplied library after
pixel/state validation. It retains p5 1.9.0's own rectangle/ellipse primitives,
including its different closing/rounded-corner behavior. Unknown versions,
alternate modes, clipping and accessibility retain their fallbacks.

No dependency upgrade is needed: replace/update `game.js` only. The supplied
`index.html` and `p5.min.js` remain unchanged. Ally targeting/firing, movement,
physics, weapon damage, controls, enemy coordination, resolution, animations
and effect quality are unchanged. The reverted allied coordinator stays removed.

## Validation using the supplied library

- 14,773 native color/mode/mutation/cache cases pass. The 1,000-paint numeric
  fixture creates zero temporary native p5.Color objects.
- Eight exact firearm pixel/state modes pass. Ordinary RGB firearm parsing
  falls from 1,476 native Color calls to zero in that fixture.
- Direct figure paths: 96 primitive cells, 96 lowered/cover figures and a
  Graphics target preserve every pixel and final state; 4,674 native path
  calls confirm that the optimization is active.
- Three character pixel/state scenes pass, each with 160 poses, including
  fallback and advanced-lighting ownership states.
- Forest paths: 1,056/1,056 exact pixel comparisons and six fallback checks pass.
- A complete ally-heavy battle matches 160 full-state frames and 120 measured
  picture frames at phone-shaped settings, with no browser/frame errors.
- The 63 hostile-coordinator checks and established mechanics source guard
  still pass. Syntax/whitespace checks pass.

## Controlled cloud measurement

Sequential clean runs used the uploaded p5 1.9.0 bytes, 80 recruited allies,
100 initial native Level 2 ambushers, normal NPC health, native wounds/deaths
and kill-driven reinforcements. The existing profiler refreshes player health
and ammunition for observation. Both runs used fixed 60 Hz simulation and
identical initial conditions/input, 40 warm-up frames and 120 measured frames.

The touch fixture was 360 × 780 CSS pixels, DPR three and production density
two, producing a 720 × 1560 backing canvas. Advanced lighting and audio were
disabled. Chromium used Vulkan SwiftShader, not a physical phone GPU.

| Measurement | Baseline | Compatible fast paths |
| --- | ---: | ---: |
| Mean draw CPU | 66.74 ms | 48.40 ms |
| Median draw CPU | 64.40 ms | 48.00 ms |
| 95th percentile draw CPU | 87.50 ms | 62.00 ms |
| Mean depth-sorted rendering CPU | 40.26 ms | 24.44 ms |
| Mean frame interval | 125.62 ms | 104.61 ms |
| 95th percentile frame interval | 148.20 ms | 123.00 ms |

This pair measured 27.5% less average draw CPU, 39.3% less depth-rendering CPU
and 16.7% shorter average frame intervals. Every measured frame's actor/effect
load and the final simulation hash (`2785808769`) match: 360 profiler shots,
306 hits, 61 kills and 14 reinforcement callbacks. No reduction in combat
activity or visual quality accounts for the result.

These are single-pair cloud measurements using the phone's exact library and
representative phone geometry. They do not establish Galaxy S25 FPS. Target
device improvement remains unverified. The adjacent results JSON records
source/library hashes, raw timing samples, hardware identity and checks.

## Reproduction

Reuse Playwright/p5 outside the repository and supply the original library:

```sh
CHARACTER_P5=/path/to/p5-1.9.0.min.js VIS_DEPS=/path/to/dependencies \
  node tools/check-character-color-performance.js
FIGURE_PATH_P5=/path/to/p5-1.9.0.min.js VIS_DEPS=/path/to/dependencies \
  node tools/check-figure-path-performance.js
VIS_P5_FILES=/path/to/p5-1.9.0.min.js VIS_DEPS=/path/to/dependencies \
  VIS_CHROME=/usr/bin/chromium node tools/check-forest-polygons.js
BATTLE_P5=/path/to/p5-1.9.0.min.js VIS_DEPS=/path/to/dependencies \
  BATTLE_DRIVER=replay BATTLE_AUDIO=off BATTLE_LIGHTING=fallback \
  BATTLE_W=360 BATTLE_H=780 BATTLE_DPR=3 BATTLE_DENSITY=2 BATTLE_TOUCH=1 \
  BATTLE_WARM=40 BATTLE_FRAMES=120 BATTLE_OUT=work/p5-190-timing.json \
  node tools/profile-nm0-combat.js
```

For a clean before/after pair, run each source sequentially using `GAME_JS` and
distinct output paths. For regression comparison, add `BATTLE_COMPARE` pointing
at the baseline and `BATTLE_PIXELS=1`; keep those off for clean timings.
