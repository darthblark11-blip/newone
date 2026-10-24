# Government Directive level 2 rewards

Department XP and levels belong to the current campaign save. Loading restores
all four departments before creating the player, equipment and allied actors;
new games start with level 1 departments and no pending barrier reward.

| Department | Level 2 reward |
| --- | --- |
| Farming | Player maximum HP increases from 100 to 125. Health packs can restore the full 125; gaining the level heals the added 25 HP once. |
| Military | Reloadable player weapons keep double magazines through purchases, pickups, reloads, travel and loading. The bow keeps its finite quiver. |
| Architecture | One barrier reward, placed through Pause → Build → Fortifications. Aim the ghost and confirm a clear position to construct it immediately. |
| Science | Lightning cannon reach increases by 15%: initial reach 300 → 345 and chain hops 200 → 230. The existing chemist unlock remains. |

Farming and military derive capacities from saved levels rather than mutating
the shared weapon definitions. Applying or loading a reward does not repeatedly
heal the player. The health bar scales to the current maximum.

The architecture reward stays available after canceling placement or attempting
a blocked location. Only a valid confirmation consumes it. The save records
whether the reward is still available, including after a placed barrier is
destroyed. Placed barriers retain their sector and health through travel,
streaming and loading. Normal blueprints still require architects and build
over time; the reward barrier needs no crew or construction delay.

During placement, touch uses the left movement ring and right aim ring with
separate PLACE/CANCEL buttons. Mouse aiming uses Enter to place and Escape to
cancel; a controller uses the right stick and A/B. Combat input stays inactive
until placement ends, and held confirmation/cancel inputs must be released
before they can fire a weapon. The top-right pause shortcut remains available.

Older saves without the pending-reward flag use their level and placed-barrier
records: architecture level 2 with no recorded barrier gets an available reward;
an existing recorded barrier counts as spent.

Focused checks cover department capacities, file isolation and save migration,
native cannon range boundaries, and fortification placement through the existing
build controls. See the corresponding `tools/check-department-capacities.js`,
`tools/check-department-save.js`, `tools/check-science-cannon.js`,
`tools/check-fortifications.js`, and `tools/check-build.js`.
`tools/check-fortifications-scene.js` verifies native p5 touch placement and
phone/landscape layouts with the existing p5/Playwright setup.
