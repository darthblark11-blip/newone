# Shared stealth and compact mission HUD

The perception system first tested at Red Mesa now governs regular hostile human enemies in Levels 1–8. Ordinary patrols keep their existing building circuits, road routes and sentry posts. Beyond 20 m, recognition introduces curiosity and investigation before the existing chase, cover and combat code takes over.

Walking, jogging, crouching and prone movement remain silent. Running produces material-dependent sound events from actual displacement. On hearing a sound, guards immediately face its historical position, then run to investigate. Investigation moves at 3.6 world units per nominal 60 Hz frame and search travel at 3.2 (formerly 1.25 and 1.05), scaled by the actor's normal speed and elapsed time. Urgent turns use an 18 rad/s limit and 35 ms response without applying the shared shoulder filter twice; stationary searches sweep broadly instead of barely drifting.

Inside the forward vision cone, an exposed player within 20 m (400 world units) is spotted on the current update, including immediately after a sound reaction. Native head/body cover rays, underground separation and leaning/pop-up offsets still apply. Beyond 20 m, distance, stance, lighting and shadows retain gradual recognition. Low stances behind waist-high cover remain completely concealed across the obstacle.

Confirmed detection puts every eligible hostile guard on the same vertical layer into native combat, regardless of distance. Each guard retains its own visibility. A shared last-confirmed position sustains the group alert while someone still sees the player; sound alone does not broadcast combat. When everyone loses sight, guards search the reported position and eventually resume patrol. Reports never track a hidden player's live position.

Explicit ambushes and mandatory combat retain their existing engagement rules. Allies, neutral/unarmed civilians, dedicated creature/machine AI and live combat against non-player targets keep their original logic. Live exploration with the wider overworld camera supports stealth. Red Mesa retains its custom routes, five wanted targets, six support guards and compatible saved survivor state.

## Engine integration

`STEALTH_PERCEPTION` contains shared tuning. `stealthPerceptionContext()` gates active gameplay; `stealthPerceptionActor(actor)` selects eligible enemies. `stealthUpdateEnemy()` handles perception and returns control to native patrol or combat where appropriate. The per-actor state is `stealthPerception`, with a `redMesaStealth` compatibility alias for existing bounty saves.

Long-range perception samples remain staggered at 100 ms. Close detection first rejects targets outside 400 units or the cone; accepted sound events are consumed immediately. Sound events are capped at twelve with a 900 ms lifetime, and footsteps require 46 units of actual running travel. Cover queries reuse the native spatial index. A new group alert walks the enemy list once; ongoing confirmed-position updates use a shared report and constant work per guard. The shared player lighting estimate uses CPU sun/shadow geometry and existing emitters, cached for six frames; it does not read GPU pixels. Level/player replacement clears both sounds and group reports; neither is serialized.

## HUD behavior

Bounty progress uses one compact charcoal rail with a count and progress pips. Each fugitive updates that rail in place instead of reopening the former header and large brown toast. Completing a bounty replaces the same rail with the return-to-sheriff instruction and reward. Acceptance/payment notices are brief; detailed instructions belong at the sheriff board.

The stealth strip shares the same responsive lane, showing suspicion, investigation, searching or a confirmed spotted state. It works outside Red Mesa, appears only when relevant, and leaves the middle of the view clear. Navigation and board controls remain available. `activityHudLayout()` defines the shared bounds used by drawing and validation.

## Checks

```sh
node --check game.js
node tools/check-stealth-perception.js
node tools/check-stealth-balance.js
node tools/check-red-mesa-scope.js
node tools/check-bounty-hud.js
node tools/check-red-mesa-encounter.js
node tools/check-frontier-bounties.js
node tools/check-frontier-integration.js
STEALTH_P5=/path/to/p5-1.9.0.min.js node tools/check-stealth-ui-browser.cjs
```

Browser validation requires `playwright-core` and Chromium; see [the original native browser setup](red-mesa-stealth.md#validation). The scope check now compares protected actors with commit `5ec3bc1`, since regular hostile-human behavior is intentionally changing.

The balance suite exercises 50 real Character integration cases: the inclusive 20 m boundary before a sight sample is due, cone/cover/night/layer rules, global combat and shared contact loss, historical running/gunshot reactions, urgent travel/turns/stride, collision, pause and same-frame player/level replacement. A 40-guard case counts roster reads to prevent repeated quadratic alert broadcasts. Native browser checks also cover these boundary, motion and report behaviors alongside live city combat, responsive HUD scenes and day/night lighting. See [the balance validation record](stealth-balance-qa.json).
