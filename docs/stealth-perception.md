# Shared stealth and compact mission HUD

The perception system first tested at Red Mesa now governs regular hostile human enemies in Levels 1–8. Ordinary patrols keep their existing building circuits, road routes and sentry posts. Beyond 20 m, recognition introduces curiosity and investigation before the existing chase, cover and combat code takes over.

Walking, jogging, crouching and prone movement remain silent. Running produces material-dependent footsteps from actual displacement; rolls, gunfire and player-fired surface impacts also create discrete sound events. A listener first rejects sounds outside their peak radius, then applies distance falloff and wall attenuation. Each audible event adds to the existing suspicion meter, displayed from 0 to 100%. A single sound starts curiosity and investigation; repeated strong sounds can fill the meter and trigger an alert. Events are consumed once and carry their original position, time and vertical layer.

Guards face an accepted sound's historical position, then run to investigate. Investigation moves at 3.6 world units per nominal 60 Hz frame and search travel at 3.2, scaled by the actor's normal speed and elapsed time. Urgent turns use an 18 rad/s limit and 35 ms response without applying the shared shoulder filter twice; stationary searches sweep broadly.

Vision rejects candidates by squared distance, then a facing-vector dot product, before testing tunnel or cover geometry. Inside the forward vision cone, an exposed player within 20 m (400 world units) is spotted on the current update, including immediately after a sound reaction. Native head/body cover rays, underground separation and leaning/pop-up offsets still apply. Beyond 20 m, distance, stance, lighting and shadows retain gradual recognition. Low stances behind waist-high cover remain completely concealed across the obstacle.

Confirmed detection puts every eligible hostile guard on the same vertical layer into native combat, regardless of distance. Searching/investigating guards and guards with delayed or stunned AI receive that alert too. Combat turning uses a 24 rad/s cap, 20 ms response and gain 36 to follow a running player in tight circles; firing and rendering consume the same intermediate shoulder heading once per frame. The acquisition cone still controls initial spotting. During combat, native range/cover/layer visibility keeps the identified threat under observation while the body turns.

Each guard retains its own visibility. A shared confirmed position sustains the group alert while someone still sees the player. Losing sight behind cover keeps pursuit/combat active for 15 seconds after the last actual sight or accepted audible clue. Running and gunfire during an established fight update the historical pursuit position and renew contact; hearing before visual detection builds suspicion and can escalate at a full meter. After a quiet escape with no sight or audible contact for 15 seconds, guards search the reported position for 6.5 seconds and eventually resume patrol. Reports never track a hidden player's live position or grant permission to shoot through cover. Ready guns revalidate an otherwise cached sight ray before firing.

When cover blocks a recorded contact, guards sample nearby cover edges and approach a reachable flank rather than charging straight at the wall. Probe routes use the last seen or heard location, bounded spatial queries and a short cache. A guard follows the existing collision and turning code and tries a limited number of route nodes. Guards already taking cover retain their normal peek cycle while their 1.8-second sight memory remains valid, then can flank if contact stays lost. Fresh sight restores direct combat; an unavailable or expired route falls back to the existing pursuit of the recorded contact. Hidden players cannot update the route by moving silently behind cover, and probing never authorizes blind fire.

Explicit ambushes and mandatory combat retain their existing engagement rules. Allies, neutral/unarmed civilians, dedicated creature/machine AI and live combat against non-player targets keep their original logic. Live exploration with the wider overworld camera supports stealth. Red Mesa retains its custom routes, five wanted targets, six support guards and compatible saved survivor state.

## Engine integration

`STEALTH_PERCEPTION` contains shared tuning. `stealthPerceptionContext()` gates active gameplay; `stealthPerceptionActor(actor)` selects eligible enemies. `stealthUpdateEnemy()` handles perception and returns control to native patrol or combat where appropriate. The per-actor state is `stealthPerception`, with a `redMesaStealth` compatibility alias for existing bounty saves.

Long-range perception samples remain staggered at 100 ms. Close detection first rejects targets outside 400 units or the cone; accepted sound events are consumed immediately. Sound events are capped at twelve with a 900 ms lifetime, and footsteps require 46 units of actual running travel. Cover queries reuse the native spatial index. Team dispatch scans the roster at most once per 100 ms, with an immediate first escalation, and recipients consume the shared report without rebroadcasting. Contact expires against active world time even when an individual AI is culled or stunned. Sight wins a same-timestamp clue tie; newer sound IDs beat older sounds. The shared player lighting estimate uses CPU sun/shadow geometry and existing emitters, cached for six frames; it does not read GPU pixels. Level/player replacement clears both sounds and group reports; neither is serialized.

For a sound with peak radius `R`, perceived loudness is `volume * (1 - distance / R)^attenuation` inside that radius. A blocked sound retains 35% of that loudness. The minimum audible loudness is 0.04; an unattenuated event adds up to 18 suspicion points for a running step, 28 for a roll, 26 for an impact or 68 for a shot. Existing quiet-time suspicion decay still applies. Internally, suspicion remains normalized to 0–1 for saved-game and HUD compatibility. Hearing an unseen sound does not grant visibility: only a fresh sight test or the full suspicion meter can escalate the guard.

## HUD behavior

Bounty progress uses one compact charcoal rail with a count and progress pips. Each fugitive updates that rail in place instead of reopening the former header and large brown toast. Completing a bounty replaces the same rail with the return-to-sheriff instruction and reward. Acceptance/payment notices are brief; detailed instructions belong at the sheriff board.

The stealth strip shares the same responsive lane, showing suspicion, investigation, searching or a confirmed spotted state. It works outside Red Mesa, appears only when relevant, and leaves the middle of the view clear. Navigation and board controls remain available. `activityHudLayout()` defines the shared bounds used by drawing and validation.

## Checks

```sh
node --check game.js
node tools/check-vision-pipeline.js
node tools/check-stealth-acoustics.js
node tools/check-stealth-cover-probes.js
node tools/check-stealth-tactical-integration.js
node tools/check-stealth-perception.js
node tools/check-stealth-balance.js
node tools/check-stealth-combat-tracking.js
node tools/check-red-mesa-scope.js
node tools/check-bounty-hud.js
node tools/check-red-mesa-encounter.js
node tools/check-frontier-bounties.js
node tools/check-frontier-integration.js
STEALTH_P5=/path/to/p5-1.9.0.min.js node tools/check-stealth-ui-browser.cjs
```

Browser validation requires `playwright-core` and Chromium; see [the original native browser setup](red-mesa-stealth.md#validation). The scope check now compares protected actors with commit `5ec3bc1`, since regular hostile-human behavior is intentionally changing.

The balance suite exercises 71 real Character integration cases: the inclusive 20 m boundary before a sight sample is due, cone/cover/night/layer rules, delayed cohort alerts, prolonged cover fights and escape, fresh combat sound clues, stale-clue ordering, urgent travel/turns/stride, collision, pause and same-frame player/level replacement. A 40-guard case counts roster reads to prevent quadratic alert broadcasts. The separate tracking suite exercises 183 cases, including dynamic close orbits at 15/30/60/120 Hz and actual joystick-driven running from both PATROL and INVESTIGATE. Native browser checks cover these behaviors alongside live city combat, responsive HUD scenes and day/night lighting. See [the original balance validation record](stealth-balance-qa.json).

The vision suite counts production geometry calls: 240 unaware guards across ten real updates make no sight-geometry calls for rejected targets, while a close ready-shot reuses one layer check and one ray. Acoustic checks exercise continuous falloff, cumulative suspicion, single event consumption, expired clues, player/level replacement, source layers, full dash/dive lifecycles and actual projectile impacts. Cover and combined integration checks cover bounded probes, route expiry, pause/resume, collision-safe reacquisition and identical routes for different silently hidden player positions. Browser checks also exercise cumulative real gunshots and collision-safe flanking toward a frozen clue.
