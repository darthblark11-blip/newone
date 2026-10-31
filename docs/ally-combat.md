# Allied combat coordination

Baseline: `f92e3d1` on `codex/directional-falls-and-footwork`.

Following armies independently scanned the entire actor roster on each
acquisition slice. Idle followers also performed wall-sight queries toward
the player even though formation movement only needs vertical visibility.
During combat every eligible ally could generate its own stream of bullets,
impacts and sound.

The allied coordinator addresses those costs:

- Allies share a hostile candidate pool, rebuilt once per frame as needed.
  Readers retain the existing nearest-target ranking, roster-order ties,
  liveness/faction tests and native underground visibility. Acquisition keeps
  its existing ten-frame schedule; current targets remain revalidated each frame.
- Idle allies skip the unused wall-sight query toward the player. A real foe
  still gets its own sight query before cover or firing.
- More than 24 engaged FOLLOW gunners share 16 firing places. Different threats
  receive representatives before nearest supporting gunners fill the remaining
  places. Owners retain their normal cooldowns; rear troops continue moving,
  targeting and updating cover instead of creating suppressed shots.

Hold and Search orders retain unrestricted firing. Small engaged squads,
player fire, enemy fire, mounted/injured actors and special weapons retain
their permissions. Weapon damage, per-weapon cadence, collision, movement
rules, controls, rendering resolution and effect quality are unchanged.
The previous hostile coordinator remains enabled and unchanged.

This intentionally reduces a large following army's simultaneous firepower;
it can change casualties and campaign progression. No damage compensation or
enemy-spawn adjustment was added. All actors remain simulated and drawn.
Faction membership in the shared pool is a frame snapshot: a new hostile
conversion after pooling appears on the next frame. Existing candidates
always revalidate current faction and liveness. Roster replacement/growth and
level changes invalidate the pool immediately. Front-rank ownership is
position-driven, without guaranteed timed rotation.

`ALLY_COMBAT` contains `enabled`, `crowdThreshold` and `shooters`. Setting
`enabled:false` restores the baseline allied targeting/sight/fire path; the
hostile coordinator stays active. Revert this commit for a complete rollback.

## Validation

- 310 focused native-harness checks, including 254 exact nearest-target
  comparisons against the published baseline, depth visibility, ties,
  idle Follow/Hold/Search movement and fresh-foe acquisition.
- Actual 80-ally firing fixture: 80 shots/projectiles with the coordinator
  disabled versus 16 enabled. This is an 80% reduction in that fixture,
  not a device FPS measurement.
- Thresholds, distinct threats, cooldown ownership, replacement, commands,
  exclusions, shot side effects, rear movement/cover and reset/level transitions
  pass. Standby cover troops skip expensive firing-ray work while updating pose.
- All 63 hostile-frontline checks still pass. The mechanics source guard locks
  218 functions, 33 methods/accessors, six constructors and 50 tuning tables,
  allowing only the exact authorized hostile/allied coordination edits.
- With allied coordination disabled, a browser replay matches the baseline
  across 100 full-state frames and 80 pixel frames with no errors or frame faults.
- Syntax and whitespace checks pass. Dependencies and rendering code are unchanged.

## Cloud measurement

Sequential baseline/candidate runs used the native Level 2 tower ambush with
80 recruits, 100 initial ambushers, normal NPC health, native wounds/deaths
and kill-driven reinforcements. The existing benchmark refreshes player
health/ammunition for observation. Both used fixed 60 Hz simulation, the same
initial conditions/input driver, p5 1.11.11, 540 × 1170 pixels, density one,
lighting disabled, audio disabled, 40 warm-up frames and 120 measured frames.
This is one pair on Chromium's Vulkan SwiftShader software renderer.

| Measurement | Baseline | Allied coordinator |
| --- | ---: | ---: |
| Mean draw CPU | 64.05 ms | 56.32 ms |
| Median draw CPU | 63.10 ms | 55.90 ms |
| 95th percentile draw CPU | 77.80 ms | 69.90 ms |
| Mean frame interval | 114.00 ms | 104.07 ms |
| Mean entity-update CPU | 8.69 ms | 7.82 ms |
| Mean active projectiles | 17.93 | 5.26 |
| Profiler total shots counter | 331 | 163 |

The pair measured 12.1% less mean draw CPU, 8.7% shorter mean frame intervals
and 70.7% fewer average active projectiles. Combat outcomes intentionally
diverge: 56 versus 40 kills, 14 versus one reinforcement callback, and 38
versus 43 surviving allies. These are not identical-state rendering timings
or an isolated measurement of each optimization. Cloud variability and the
software renderer limit generalization. Galaxy S25 FPS remains unverified.

Raw timing samples, source hashes, hardware identity and checks are recorded
in `ally-combat-results.json`. Reuse p5 and Playwright outside the repository:

```sh
node tools/check-ally-combat.js
node tools/check-hostile-frontline.js
node tools/check-nm0-mechanics-parity.js
VIS_DEPS=/path/to/dependencies \
  BATTLE_DRIVER=replay BATTLE_AUDIO=off BATTLE_LIGHTING=fallback \
  BATTLE_WARM=40 BATTLE_FRAMES=120 BATTLE_OUT=work/allies.json \
  node tools/profile-nm0-combat.js
```

For a timing pair, run each source sequentially using `GAME_JS` and distinct
output paths. Keep pixel/state instrumentation off during clean timings.
