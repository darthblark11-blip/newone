# Personal kill combo

The kill combo appears near the top center beside health on wide screens.
On narrow screens the centered combo sits just below the main health/population
readouts, alongside a compact weapon icon and 11-pixel ammo count in the left
column. Extra outpost/ambush status rows follow underneath, so they do not
overlap the ammo. Desktop ammo is 12 pixels. The fading story objective wraps
below the top readouts. Objective triggers, duration and pause behavior are
unchanged.

The combo uses Lilita One, a rounded display font bundled in the single-file
sketch as an unmodified Latin WOFF2 from `@fontsource/lilita-one` 5.3.0. Its
copyright and SIL Open Font License 1.1 accompany the embedded data in
`game.js`. FontFace loads it once without a network request; a rounded system
font stack remains available while loading or if a host cannot use FontFace.

The combo has no shake. Label and timer colors interpolate between these
kill counts: orange at 2, yellow at 10, gold at 20, purple at 30, violet at 40.
The color stays violet above 40. The countdown uses the existing 100-tick
combo window and fills completely when a player kill refreshes it.

The label and timer ease in over 90 ms and out over 120 ms. An expired combo
retains its last displayed count, color and timer width during that brief exit;
the gameplay count and countdown still expire normally. Pause freezes the
transition, and replacing a run or traveling clears its transient display.

Only player kills advance or refresh the personal combo. Ally kills retain
their base score reward and still count for sector, ambush, population and
fortress bookkeeping; they do not earn the player's multiplier. Killer
ownership is separate from projectile team allegiance and follows rockets,
barrels, cars and delayed robot blasts. Barrel ownership is fixed by its
lethal hit. Legacy player/scripted kill callers retain their existing credit.

Checks:

```sh
node tools/check-player-kill-combo.js
node tools/check-combo-hud.js
VIS_DEPS=/workspace/newone-dev node tools/check-combo-hud-scene.js
```

The Canvas scene checks desktop and 320-pixel phone layouts. Set `VIS_DEPS`
to a directory with p5 and Playwright installed and `VIS_CHROME` to the
Chromium executable when the environment uses different paths.
