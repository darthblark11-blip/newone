# Red Mesa stealth sandbox

Red Mesa was the original Level 3 test encounter for this system. The accepted implementation has now been promoted to regular hostile humans; see [shared stealth and compact mission HUD](stealth-perception.md) for the current scope and interface. This page retains the encounter layout, tuning and original validation record. Confirmed alerts hand control back to the existing chase and combat code.

## Playing the encounter

Accept **Red Mesa Raiders** from the Level 3 bounty board. The redoubt has four entrances, connected patrol lanes, five low-cover obstacles and separate earth, stone and timber areas. Its original five wanted targets are supported by six henchmen. Only the wanted targets count toward the five-target objective and its reward.

Walk, jog, crouch and prone movement are silent. Running emits footsteps after actual movement; earth carries them the least, then stone, then timber. Guards investigate where a sound occurred. Walls reduce sound propagation. Gunfire is also audible; the bow is silent.

Guards see through a forward cone. An exposed player within 20 m is spotted immediately; beyond that, guards build suspicion before attacking. Distance, stance, running, daylight, ambient light, local lights and building shadows affect long-range recognition. The HUD reports suspicion and the investigation/search phase. Crouching or going prone behind a low obstacle completely blocks visual detection across that obstacle. Standing, popping up to shoot or leaning around a high corner can expose the player.

Confirmed detection alerts all eligible hostile guards on the same vertical layer, including distant, searching and temporarily stunned guards, directly into combat. They share only the last confirmed contact and keep their own line-of-sight checks. Combat turns follow a running player much faster. Cover retains the fight for 15 seconds after the last sight or audible running/gunfire clue; renewed contact extends pursuit. After a quiet escape, guards search that position and eventually return to patrol. Hearing before initial detection causes investigation. Leaving and returning preserves casualties, wounded survivors and investigation state.

## Integration and tuning

All configuration and functions are in `game.js` beside `FRONTIER_BOUNTY_DEFS`:

| Block | Purpose |
| --- | --- |
| `RED_MESA_STEALTH` | Perception, recognition, hearing and search tuning |
| `redMesaStealthContext` / `redMesaStealthActor` | Level, contract and actor scope gates |
| `redMesaUpdateNoise` | One bounded sound-event queue per frame, based on displacement |
| `redMesaStealthVisible` | Cone test and native head/body cover rays, including peek offsets |
| `redMesaIllumination` | CPU lighting estimate using the existing sun, shadows and emitter list |
| `redMesaUpdateEnemy` | Patrol → curious → investigate → alert → search transitions |
| `RED_MESA_LAYOUT` | Local collision footprints, cover types and structure heights |
| `RED_MESA_POSTS` | Eleven spawn positions, facing angles and patrol routes |
| `RED_MESA_SURFACES` | Authored material rectangles shared by rendering and acoustics |
| `serializeRedMesaStealthActor` / `restoreRedMesaStealthActor` | Bounded, validated save state |

Defaults: sight range 680 world units; instant recognition within 400 units (20 m); total acquisition cone angle 104.4°; long-range sight sampling every 100 ms, with immediate close detection and hearing reactions; long-range base recognition grace 450 ms, increased by darkness and distance; curious pause 400 ms; combat contact memory 15,000 ms; search window 6,500 ms. Investigation/search travel is 3.6/3.2 units per nominal 60 Hz frame; urgent turns use an 18 rad/s limit and 35 ms response. Human combat turns use a 24 rad/s limit, 20 ms response and gain 36. Running hearing radii are earth 280, stone 313.6 and timber 378 units. Footsteps require 46 units of running displacement. Sound events expire after 900 ms, with at most 12 retained. The player lighting estimate is shared between guards and cached for six frames. No GPU pixel reads are used.

The locomotion noise gate reads the current movement input, so easing down from a run to a jog is silent immediately. Collision-blocked movement and teleporting do not emit running steps. Guards use the existing collision and avoidance helpers for movement. Supporting casualties are stored independently and do not grant bounty progress or campaign kill score.

## Validation

Run from the repository root:

```sh
node --check game.js
node tools/check-red-mesa-encounter.js
node tools/check-red-mesa-scope.js
node tools/check-frontier-bounties.js
node tools/check-frontier-integration.js
RED_MESA_P5=/path/to/p5-1.9.0.min.js node tools/check-red-mesa-stealth-browser.cjs
```

The browser check requires `playwright-core` and Chromium (`VIS_CHROME` can select its executable). It uses the production p5 1.9.0 library, executes native character/cover logic and complete day/night drawing, and writes its report and captures to `/tmp/red-mesa-stealth-qa` (`RED_MESA_QA_OUT` overrides this).

The original encounter suite passed 14 checks, including native collision routing from every entrance, patrol segments, support casualties and save continuity. Its initial scope suite passed 427 enemy-decision and RNG parity checks against commit `370d076` outside the sandbox. That scope check now protects dedicated AI and scripted combat while allowing the approved regular-enemy rollout. Existing bounty and integration suites passed 37 and 42 checks. Browser assertions passed for silence, material propagation, cone facing, gradual recognition, historical sound locations, low-cover concealment, native pop-up/corner peeking, day/night/shadows and last-known-position searches.

Full native day/night renders completed with no uncaught JavaScript errors, WebGL errors or Canvas2D/WebGL attribute warnings; p5 drawing stacks remained balanced. Software-rendered Chromium CPU samples are recorded for reference and do not establish physical-device frame rates.

- [Day preview](previews/red-mesa-stealth-day.png)
- [Night preview](previews/red-mesa-stealth-night.png)
- [Browser report, including source/library hashes](red-mesa-stealth-qa.json)
