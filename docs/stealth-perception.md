# Shared stealth and compact mission HUD

The perception system first tested at Red Mesa now governs regular hostile human enemies in Levels 1–8. Ordinary patrols keep their existing building circuits, road routes and sentry posts. Recognition introduces curiosity and investigation before the existing chase, cover and combat code takes over.

Walking, jogging, crouching and prone movement remain silent. Running produces material-dependent sound events from actual displacement. Guards investigate the historical sound position. Cone vision uses native head/body cover rays and actual leaning/pop-up offsets. Distance, stance, lighting and shadows affect suspicion; low stances behind waist-high cover are completely concealed across the obstacle. Losing sight starts a last-known-position search and eventually resumes patrol.

Explicit ambushes and mandatory combat retain their existing engagement rules. Allies, neutral/unarmed civilians, dedicated creature/machine AI and live combat against non-player targets keep their original logic. Live exploration with the wider overworld camera supports stealth. Red Mesa retains its custom routes, five wanted targets, six support guards and compatible saved survivor state.

## Engine integration

`STEALTH_PERCEPTION` contains shared tuning. `stealthPerceptionContext()` gates active gameplay; `stealthPerceptionActor(actor)` selects eligible enemies. `stealthUpdateEnemy()` handles perception and returns control to native patrol or combat where appropriate. The per-actor state is `stealthPerception`, with a `redMesaStealth` compatibility alias for existing bounty saves.

Perception samples are staggered, sound events are capped at twelve with a 900 ms lifetime, and footsteps require 46 units of actual running travel. Cover queries reuse the native spatial index. The shared player lighting estimate uses CPU sun/shadow geometry and existing emitters, cached for six frames; it does not read GPU pixels. Level/player replacement clears stale sound events.

## HUD behavior

Bounty progress uses one compact charcoal rail with a count and progress pips. Each fugitive updates that rail in place instead of reopening the former header and large brown toast. Completing a bounty replaces the same rail with the return-to-sheriff instruction and reward. Acceptance/payment notices are brief; detailed instructions belong at the sheriff board.

The stealth strip shares the same responsive lane, showing suspicion, investigation, searching or a confirmed spotted state. It works outside Red Mesa, appears only when relevant, and leaves the middle of the view clear. Navigation and board controls remain available. `activityHudLayout()` defines the shared bounds used by drawing and validation.

## Checks

```sh
node --check game.js
node tools/check-stealth-perception.js
node tools/check-red-mesa-scope.js
node tools/check-bounty-hud.js
node tools/check-red-mesa-encounter.js
node tools/check-frontier-bounties.js
node tools/check-frontier-integration.js
RED_MESA_P5=/path/to/p5-1.9.0.min.js node tools/check-stealth-ui-browser.cjs
```

Browser validation requires `playwright-core` and Chromium; see [the original native browser setup](red-mesa-stealth.md#validation). The scope check now compares protected actors with commit `5ec3bc1`, since regular hostile-human behavior is intentionally changing.
