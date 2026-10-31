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

The surrounding HUD uses Rajdhani SemiBold for ammo, objectives, the clock,
activity readouts and navigation, with real Bold for upright population/status
labels and touch actions. Status labels and climate text are 12 pixels; ammo
retains its compact 11/12-pixel size and width fitting. Both Latin WOFF2 faces
are bundled unmodified from `@fontsource/rajdhani` 5.3.0 with their copyright
and OFL 1.1 in `game.js`. `setup()` starts `initHudFont()` once; the HUD uses a
system sans-serif fallback until both faces load or if loading fails. Debug
telemetry retains monospace. The combo keeps its separate Lilita One lettering.

The combo has no shake. Its first colors remain orange at 2 kills, yellow at
10, gold at 20, purple at 30 and violet at 40. Higher streaks continue through
these visual stages:

| Kills | Label and countdown treatment |
| --- | --- |
| 40–50 | Blood red creeps inward from the purple letter edges; short, subtle drips develop as the letters become red. |
| 50–55 | Black enters at the edges while white radiates from the middle. |
| 55–60 | The white settles on the left and black on the right. |
| 60–70 | The split gradually hardens into grey stone with grain and cracks. |
| 70–80 | A soul-fire burst breaks the stone; yellow-green flames grow into neon green. |
| 80–90 | A second burst leads into indigo flames. |
| 90–100 | A shifting pearlescent sheen replaces the indigo. |
| Above 100 | Rainbow colors pulse in a repeating star cadence. |

The full kill count remains readable above 99. These changes are cosmetic: the
score multiplier retains its existing cap, and the countdown uses the existing
100-tick combo window. A player kill still refreshes the timer completely.

The label and timer ease in over 90 ms and out over 120 ms. An expired combo
retains its last displayed count, color and timer width during that brief exit;
the gameplay count and countdown still expire normally. Pause freezes the
transition, and replacing a run or traveling clears its transient display.
The same clock drives drips, flames, sheen and rainbow cadence, so pause also
freezes those effects. The bursts fire once when a streak crosses 70 and 80;
painting the HUD repeatedly cannot retrigger them. New streaks clear old bursts.
The effect stays inside the compact HUD area and does not create combat particles.

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
VIS_DEPS=/workspace/newone-dev node tools/visual-combo-progression.js
```

The Canvas scene checks desktop and 320-pixel phone layouts. Set `VIS_DEPS`
to a directory with p5 and Playwright installed and `VIS_CHROME` to the
Chromium executable when the environment uses different paths.
The progression review renders twenty material stages, three narrow HUD layouts
and a motion clip in `/tmp/newone-combo-progression`. It also samples actual glyph
pixels to check that the pearl and rainbow gradients span the lettering.
