# Shared hostile firing budget

At most eight regular ranged enemies can actively attack the player at once, including in groups smaller than the old 33-enemy threshold. The previous coordinator allowed 24 shooters and ran after much of the shooting work had already happened.

The budget covers human firearms, bows and rockets, mounted and injured shooters, robots, armored orb attacks, aircraft, snails, hybrids, alien gators and Molotov throwers. Allies and enemies fighting non-player targets keep their normal combat. Melee forms, dedicated bosses and the separate occult encounter retain their own attack rules. This intentionally reduces incoming ranged pressure in large encounters; projectile damage and individual weapon cadence are preserved.

## Selection and acquisition

`HOSTILE_FRONTLINE` in `game.js` controls the cap (`shooters:8`), shared selection cadence (`refreshMs:100`), ordinary firing turns (`leaseMs:1800`) and blocked-lane retry delay (`retryMs:300`). Setting `enabled:false` disables admission and restores unrestricted firing.

Selection uses cheap actor, target, layer and squared-distance checks before any firing geometry. It considers actual attack reach, favors visible lanes, covers occupied directions and offers waiting enemies turns. The current eight owners are validated each frame; the full roster is scanned on the shared cadence or after an owner becomes invalid. Cold sight caches cannot produce an uncapped first volley. Death, stun, reload, changed target and lost usable sight free places.

Ordinary cooldowns retain ownership. Started robot/orb charges keep their place while completing within 700 units, including when the player crosses the initial charge range. Special bursts retain ownership while their visible target remains inside burst range; stalled or distant attacks yield places to other enemies. Losing permission cancels deferred special releases safely. A promoted waiting shooter refreshes sight before firing; admission itself never grants visibility.

## Work skipped for waiting attackers

Waiting enemies still navigate, animate, hear sounds, sample ordinary perception and react to incoming shots. They retain the shared stealth and historical-contact cover search introduced previously.

The important change is before the trigger: reserves skip per-frame ready-shot LOS revalidation, sample shooting elevation on the existing ten-frame slice, and do not acquire new firing-cover goals. Existing cover contact and phase clocks continue, with waiting guards sheltered instead of performing firing peeks. `fire()` rejects denied requests before shoulder aiming, muzzle rays, random spread, ammunition, recoil, sound or effects. Native injury timers continue while denied injury firing queries pause.

Admission uses active world time, freezes on pause and resets with the run, level or player identity. Waiting does not consume fake weapon cooldowns. The coordinator does not draw random numbers or serialize owners.

## Validation

```sh
node --check game.js
node tools/check-hostile-frontline.js
node tools/check-hostile-acquisition-budget.js
node tools/check-hostile-special-budget.js
node tools/check-hostile-commitment-lifecycle.js
node tools/check-nm0-global-policy.js
node tools/check-stealth-balance.js
node tools/check-stealth-combat-tracking.js
node tools/check-cover-ai.js
node tools/check-armored-impact-effects.js
node tools/check-leg-injury-cover.js
```

The real 100-gunner simultaneous-fire fixture emits eight shots/projectiles with admission enabled, versus 100 disabled. Across 60 real shared-stealth Character updates of 100 guards, sight calls fall from 4,643 to 1,000, cover rays from 4,716 to 1,016, and aim-elevation calls from 6,000 to 1,032. This is about 78% fewer sight rays and 83% fewer aiming calculations in that fixture. Reserves continue moving and their ordinary perception stays active.

Focused checks also cover cold-cache acquisition, rotation, blocked owners, shared roster bounds, denied-shot side effects, pause, mounted/injured/special scope, telegraph and burst cadence, and unrestricted faction combat. Cross-sector tests exercise the cap in sectors 1–7. Native cover, stealth tracking and protected-AI parity checks remain part of regression validation.

Browser validation uses real p5 and Chromium. CPU/render timings from cloud software rendering vary; the work-count reduction is not a measured physical-phone FPS gain. Sequential timing fixtures did not establish an overall CPU/FPS improvement: the empty-world fixture adds small admission overhead, while the dense-prop scene is approximately unchanged. [Current validation results](hostile-acquisition-budget-results.json) record the source hash and work counts. The older 24-owner experiment and its historical timing record remain in [hostile-frontline-results.json](hostile-frontline-results.json).
