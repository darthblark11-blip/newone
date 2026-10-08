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

Armor impact sparks use the same radial gradient falloff as smoke, with a
compact bright center. Existing spark colors, trajectories and lifetimes are
preserved.

Focused checks:

```sh
node tools/check-airborne-flight.js
node tools/check-airborne-render.js
node tools/check-impact-particles.js
```

The particle check includes Chromium pixel checks and uses the Playwright,
p5 and browser dependencies described in the repository's visual tools.
