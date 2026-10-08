# Airborne combat and armor impacts

Jetpack bombers, jetpack pistol enemies, and both saucer variants draw above
roofs and vehicles. Their drawing pass runs before projectiles and impact
effects, so those effects remain visible during an aerial fight.

Flying enemies can cross buildings, but their combat positions must sit clear
of bullet-blocking structures. A flyer above a roof keeps moving until it
reaches a usable firing lane. It checks the player's or targeted ally's actual
gun muzzle positions, including both guns when using dual SMGs, before settling
into an engagement. Moving targets and obstructed destinations trigger a new
position search. Flyers also avoid ground elevation and wading slowdowns.

Buildings still stop bullets during roof crossings. Moving the flyer into an
open lane makes it reachable without changing the ground collision rules.

Flight probes use a spatial index of every loaded building and parked car,
including objects beyond the camera's active ring. Exact collision and gate
predicates remain unchanged. Geometry is checked once per frame, and world
publication invalidates the index immediately. Station searches reuse buffers
and muzzle calculations; attack cooldowns skip checks that cannot affect firing.
These optimizations preserve flight paths, firing decisions and rendering.

Armor impact sparks use the same radial gradient falloff as smoke, with a
compact bright center. Existing spark colors, trajectories and lifetimes are
preserved.

Focused checks:

```sh
node tools/check-airborne-flight.js
node tools/check-airborne-render.js
node tools/check-airborne-spatial.js
node tools/check-impact-particles.js
```

The particle check includes Chromium pixel checks and uses the Playwright,
p5 and browser dependencies described in the repository's visual tools.

Compare flight CPU cost with a saved version of `game.js`:

```sh
GAME_JS=/tmp/game-before.js node tools/profile-airborne.js --browser
node tools/profile-airborne.js --browser
```

The benchmark measures flight combat in three loaded-city scenes, separately
from rendering and other AI. Matching state hashes check movement, stations,
shots, timers and random calls. Timing results describe flight CPU, not total FPS.

Compared with `17a31c2`, a headless Chromium run with 16 flyers, about 630
buildings and 300 cars measured 11.69 → 0.23 ms in open streets, 14.58 → 0.31 ms
across roofs, and 11.20 → 0.37 ms in narrow lanes. These are medians of three
240-frame runs after 60 warm-up frames; all three state hashes matched exactly.
Timings vary with the machine and scene.

For exact visual comparisons in the same browser, capture the saved source,
then compare the current source:

```sh
AIRBORNE_BASELINE_JS=/tmp/game-before.js node tools/check-airborne-visual-parity.js --capture
node tools/check-airborne-visual-parity.js
```

This compares each frame's aircraft/effect state and raw screenshot pixels on
phone and desktop in daylight and at night. Captures stay outside the repository.
