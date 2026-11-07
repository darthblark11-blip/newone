# Level 3 native browser validation

`tools/frontier-browser-qa.cjs` runs the production `setup`, `startAtLevel(3)`,
streamer, AI and complete `draw` loop in real p5.js 1.9.0 and Chromium.
It freezes the source bytes at launch and records their SHA-256. Optional
dialogue images and absent music receive local placeholders; game rendering
and simulation functions remain production code. Existing arrival/objective
banner timers start in their expired state so terrain and architecture remain
visible in captures.

The production p5 library is identified by SHA-256
`726ac96626b93f5bcaff83a910b6c60d3a9728f063e0eb73b5d0819ffc356915`.
Set `FRONTIER_P5` to a local copy of `p5@1.9.0/lib/p5.min.js`.

```sh
FRONTIER_P5=/path/to/p5-1.9.0.min.js \
FRONTIER_OUT=/tmp/frontier-candidate \
node tools/frontier-browser-qa.cjs
```

The default matrix covers Dry Gulch, all three satellite towns, a canyon
bridge and the canyon floor, in portrait 360×780 and landscape 940×390,
DPR 3, production density cap 2. Advanced and fallback lighting run separately;
the lighting watchdog is held fixed during measurement so a quality change
cannot appear as a rendering improvement. Reports include draw CPU samples,
canvas/chunk counts, actor and solid counts, drawing-stack balance, page
errors, frame faults and WebGL error status. `FRONTIER_RAF=1` also measures
requestAnimationFrame intervals. Pixel captures happen outside the CPU timer.

Use an immutable baseline file for a comparison:

```sh
git show 5d1583efc9966873b0e66ca8803b8e7aebf3f40e:game.js > /tmp/frontier-before.js
GAME_JS=/tmp/frontier-before.js FRONTIER_P5=/path/to/p5-1.9.0.min.js \
FRONTIER_OUT=/tmp/frontier-before node tools/frontier-browser-qa.cjs
```

`docs/frontier-browser-validation-results.json` records the baseline and
overhaul snapshot results. Both completed all 24 cases with zero page errors,
zero WebGL errors, no frame faults, and balanced drawing stacks. The overhaul
matrix uses source `b742c88b…`; purpose classification was then verified in the
matched timing fixtures on `d19d7545…`. A final nonvisual build-clearance
compatibility guard was verified in all four towns and three panoramas on
final source
`931f3eb1691e4939561cf1cdacafba540a6118da4a35175b6a43b9fad25f85c8`.
Resident chunk and actor counts matched across corresponding initial fallback
scenes. The candidate uses one additional bounded canvas and a small number of
rail records. Each report retains its exact source hash.
An additional final native Copper Wash inspection confirmed the hoist's
`MINE`/`HEADFRAME` descriptor and an 85-unit maximum roof height.

Matched timing captures ran sequentially, baseline first and final second,
without overlapping browser runs. Each case warmed for six native frames and
measured 24 complete draws at 360×780, DPR 3, density 2. CPU milliseconds below
are **median / p95**, measured on this software-rendered cloud host:

| Scene | Fallback baseline | Fallback final | Advanced baseline | Advanced final |
| --- | --- | --- | --- | --- |
| Dry Gulch | 6.5 / 11.3 | 6.8 / 11.6 | 8.4 / 37.9 | 12.3 / 44.1 |
| Copper Wash | 4.2 / 8.7 | 3.4 / 4.8 | 4.9 / 29.8 | 4.9 / 9.6 |
| Canyon bridge | 2.4 / 2.8 | 3.0 / 4.0 | 4.3 / 9.8 | 7.5 / 21.9 |

These short software-rendered cloud runs establish browser correctness and
provide diagnostic CPU samples. The added advanced-lighting geometry costs
more CPU in the town and bridge fixtures. These results do not establish
physical Galaxy S25 frame rates or 60 FPS acceptance. Hardware measurements
remain necessary before claiming the 13.3 ms p95 headroom target.

For review images with complete building silhouettes:

```sh
FRONTIER_P5=/path/to/p5-1.9.0.min.js FRONTIER_WIDTH=1200 \
FRONTIER_HEIGHT=800 FRONTIER_DPR=1 FRONTIER_FRAMES=2 \
FRONTIER_MODES=fallback FRONTIER_SCENES=dry-gulch,copper-wash,canyon-bridge \
FRONTIER_OUT=/tmp/frontier-panorama node tools/frontier-browser-qa.cjs
```

## Physical Galaxy S25 capture

```sh
node tools/build-frontier-s25-benchmark.cjs \
  --p5 /path/to/p5-1.9.0.min.js --out /tmp/frontier-s25.html
```

The standalone HTML embeds the exact baseline commit, current candidate and
p5 library. Open it in Chrome on the phone, select the scene and lighting mode,
and run baseline and candidate at identical settings. Keep Chrome visible.
Each run warms for three seconds and measures native frames for fifteen seconds.
Portrait and landscape use the actual device viewport and production density cap.

Fixtures cover the four settlements, a bridge, native movement along the open
Main Street through chunk boundaries, and combat with already spawned ambient
bandits. Combat uses native pistol fire, enemy health, AI and projectiles;
only player health/ammunition are refreshed. Reports include actual frame
intervals, draw CPU distributions, initial/final player position, actor/resource
counts, source hashes, lighting state, errors and hidden-page events.
The HTML and JSON reports remain local until shared. The builder and a complete
baseline native-loop capture were smoke-tested in Chromium; physical-phone
measurements remain required for the 60 FPS target.
