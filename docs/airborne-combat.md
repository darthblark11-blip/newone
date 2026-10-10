# Airborne combat and armor impacts

Jetpack bombers, jetpack pistol enemies, and both saucer variants draw above
roofs and vehicles. Their drawing pass runs before projectiles and impact
effects, so those effects remain visible during an aerial fight.

Flying enemies use their original movement, targeting, firing and collision
behavior. The aircraft change only affects their drawing order. Fallen aircraft
retain the ground actor order.

Armor impact sparks use the same radial gradient falloff as smoke, with a
compact bright center. Existing spark colors, trajectories and lifetimes are
preserved.

Focused checks:

```sh
node tools/check-airborne-render.js
node tools/check-impact-particles.js
```

The particle check includes Chromium pixel checks and uses the Playwright,
p5 and browser dependencies described in the repository's visual tools.
