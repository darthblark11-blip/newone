# Crowded battle performance

The optimization pass is separate from the later armored-impact art changes.
It retains actor counts, AI timing, projectile damage, draw order, lighting
quality and shadows. It does not establish constant 60 FPS on every device.

The sustained battle profiler runs the real p5 `draw()` in Chromium with live
enemy AI, projectiles, particles, terrain, lighting and HUD. Unlike the frame
regression test, it keeps the crowd alive and firing throughout the sample.
It reports both synchronous frame CPU time and painted frame intervals.

Initial adjacent runs using the documented p5 1.9.4, a 540×1170 viewport,
60 warm-up frames and 120 measured frames gave:

| Live enemies | Prior frame CPU median | Optimized median | Reduction |
| --- | ---: | ---: | ---: |
| 80 | 21.0 ms | 17.3 ms | 18% |
| 150 | 30.6 ms | 27.1 ms | 11% |

An adjacent repeat measured 18.8→16.4 ms with 80 enemies and 32.0→27.0 ms
with 150 enemies. Across both pairs the CPU reduction was 11–18%; the
150-enemy scene still exceeded the 16.7 ms budget on this host.

Both runs retained identical gameplay state, random draws and rendered pixel
hashes. The cloud host uses software rendering and can suffer scheduling
stalls; its timings cannot predict a phone GPU's frame rate. The profiler
executes sound cues with the audio context uninitialized, so it excludes the
cost of synthesized audio. On-device performance remains to be measured.

The pre-civilian comparison uses `2ea03e7`. With the same p5 1.9.4 fixture and
150 enemies, its median frame CPU time was 27.5 ms, compared with 30.6–32.0 ms
before this pass and 27.0–27.1 ms after. This largely restores earlier battle
performance while retaining civilians. Character drawing remains the largest
cost; ambient civilian AI alone did not explain the regression.

Changes include reused crowd/projectile buckets, exact sight and collision
broad phases, ordered free projectile slots, reused trail points, bounded
particle/character paints, faster equivalent character primitives, reused
WebGL texture storage, and fewer repeated texture bindings and uniforms.
The existing lighting tiers and downgrade/recovery watchdog are retained.

To compare a version with the optimized game, install p5 and Playwright outside
the repository, provide Chromium, and run each source sequentially:

```sh
git show 3787c16:game.js > /tmp/battle-before.js
VIS_DEPS=/path/to/dependencies VIS_CHROME=/usr/bin/chromium \
  BATTLE_P5=/path/to/p5-1.9.4.min.js BATTLE_LIGHTING=fallback \
  BATTLE_COUNTS=80,150 BATTLE_WARM=60 BATTLE_FRAMES=120 \
  GAME_JS=/tmp/battle-before.js BATTLE_OUT=/tmp/battle-before.json \
  node tools/profile-battle.js
git show 6aaa2e9:game.js > /tmp/battle-optimized.js
VIS_DEPS=/path/to/dependencies VIS_CHROME=/usr/bin/chromium \
  BATTLE_P5=/path/to/p5-1.9.4.min.js BATTLE_LIGHTING=fallback \
  BATTLE_COUNTS=80,150 BATTLE_WARM=60 BATTLE_FRAMES=120 \
  GAME_JS=/tmp/battle-optimized.js BATTLE_OUT=/tmp/battle-optimized.json \
  node tools/profile-battle.js
```

Avoid running other checks while collecting timings. Use
`BATTLE_LIGHTING=advanced` for the advanced rig; the software WebGL result
primarily reflects this host's GPU substitute. Source snapshots before the
particle rework allow exact picture comparisons.

Correctness checks are in `check-battle-crowd.js`,
`check-projectile-performance.js`, `check-character-render-parity.js`,
`check-particle-performance.js` and `check-lighting-upload.js` under `tools`.
They compare original trajectories/RNG, real Canvas pixels and actual WebGL
framebuffers, including resize and density changes.

The later effects change replaces ten orange body-hit ovals on armored NM0
humans with ten compact red smoke puffs from the existing particle pool.
Each puff uses one cached gradient and the old spark's short lifetime/fade;
existing debris and unrelated smoke stay intact. Helmet hits use the robot's
nine directional metal streaks. The robot's charge-only sparks are removed;
the growing orb, full charge, sight cancellation and two-beam burst remain.
`tools/check-armored-impact-effects.js` covers actual impacts on both sides
of each armor threshold, pooling, charge/fire timing and real Canvas falloff.
