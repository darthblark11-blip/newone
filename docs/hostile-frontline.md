# Crowded hostile firearm front line

Baseline: `b8e1313` on `codex/directional-falls-and-footwork`.

This is an explicitly authorized combat-pressure experiment. It changes how
many ordinary hostile gunners can shoot at the player in a large crowd; it is
not a behavior-identical rendering optimization. Fewer incoming shots can make
these encounters easier.

When more than 32 eligible gunners within 700 units have cached sight of the
player, a shared coordinator selects up to 24 firing owners. It first keeps
the nearest gunner in each occupied direction, then fills the remaining slots
with the nearest rank. A one-sided rush can still use all 24 slots.

Rear ranks continue their normal movement, targeting, stance and cover updates.
They gain places as positions, visibility and the front rank change. Ordinary
weapon cooldowns retain ownership so rear troops cannot defeat the limit by
cycling through every free cooldown. Selection refreshes once per frame when
needed, and resets with the run.

Allies remain unrestricted. Enemies attacking allies, scripted firing, injured
floor combat, special creatures/weapons, and encounters with 32 or fewer
eligible gunners retain their existing firing permissions. Per-shot damage,
weapon cadence, projectile physics, controls, rendering resolution, art and
effect quality are unchanged. Suppressed shots do not create their normal
projectiles, sounds or effects.

`HOSTILE_FRONTLINE` in `game.js` contains the enabled flag, crowd threshold and
owner count. Setting `enabled:false` disables the experiment. Reverting this
commit is the complete rollback.

## Validation

- 63 focused checks exercise the actual coordinator, firing, cover and movement
  functions: threshold boundaries, nearest ranks, eight directions, cooldown
  ownership, replacement, exclusions, reset, RNG and shot side effects.
- A simultaneous 100-gunner fixture emits 24 real shots/projectiles with the
  coordinator enabled versus 100 disabled. This is a 76% shot-count reduction
  in that fixture, not an FPS measurement.
- Denied rear cover troops retain pose/cycle updates without performing firing
  line checks. Denied hard-mode shots do not cancel ongoing strafes.
- The mechanics source guard permits only the precise authorized fire hooks;
  its 218 functions, 33 methods/accessors, six constructors and 50 tuning
  tables/constants retain the established implementation elsewhere.
- With the coordinator disabled, a browser battle replay matches the baseline
  across 100 full-state frames and 80 pixel frames, without browser/frame errors.
- Syntax and whitespace checks pass. No dependencies changed.

## Cloud measurements and limits

A direct-player Level 2 ambush replay used 100 initial native ambushers, no
recruited allies, normal NPC health, native death/reinforcement rules, the
benchmark's observation-only player health/ammo refresh, p5 1.11.11,
540 × 1170 pixels, density one, lighting disabled, audio disabled, 40 warm-up
frames and 120 measured frames. Each source ran sequentially with the same
initial conditions and input driver. Combat states diverge because the new
firing restriction is intentional.

| Measurement | Baseline | Final coordinator |
| --- | ---: | ---: |
| Mean draw CPU | 40.55 ms | 35.39 ms |
| Median draw CPU | 38.00 ms | 34.80 ms |
| 95th percentile draw CPU | 60.80 ms | 47.70 ms |
| Mean frame interval | 72.10 ms | 64.50 ms |
| Total shots during replay | 62 | 60 |

The single cloud pair recorded 12.7% lower mean draw CPU and 10.5% shorter mean
frame intervals. The gate only suppressed two shots in this particular native
scene, so these timings do not establish the isolated speedup caused by the
coordinator. Cloud-host variability and the intentionally different combat
states limit attribution. The browser uses Vulkan SwiftShader, not a physical
GPU. Galaxy S25 FPS improvement remains unverified.

An exploratory mixed battle with 80 recruits emitted the same 331 shots and
matched final state with the initial coordinator revision. Enemies attacking
allies bypass this gate, so it does not solve squad-versus-squad rendering load.
Nearest-rank selection does not guarantee timed rotation: rear troops can stay
behind living front owners, and ducked/blocked cover owners can hold places.

The first attempt, reordering ally acquisition distance/visibility checks, was
discarded. Although focused tests found equivalent targets and fewer sight
queries, both whole-frame comparisons were slower. None of that change remains.
This coordinator is the second and final attempt for this round.

`hostile-frontline-results.json` records hashes, timing samples, shot counts,
hardware identity and validation. Reuse dependencies outside the repository:

```sh
VIS_DEPS=/path/to/dependencies node tools/check-hostile-frontline.js
node tools/check-nm0-mechanics-parity.js
VIS_DEPS=/path/to/dependencies \
  BATTLE_COUNTS=0 BATTLE_DRIVER=replay BATTLE_AUDIO=off BATTLE_LIGHTING=fallback \
  BATTLE_WARM=40 BATTLE_FRAMES=120 BATTLE_OUT=work/frontline.json \
  node tools/profile-nm0-combat.js
```

For before/after measurements, run each source sequentially using `GAME_JS` and
distinct output paths. Keep pixel/state instrumentation off for clean timings.
