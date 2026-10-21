# Personal kill combo

The kill combo appears near the top center beside health on wide screens.
On narrow screens it takes its own centered row below the status and ammo
readouts. The fading story objective occupies the next top row and wraps
without covering those readouts. Objective triggers, duration and pause
behavior are unchanged.

The combo has no shake. Label and timer colors interpolate between these
kill counts: orange at 2, yellow at 10, gold at 20, purple at 30, violet at 40.
The color stays violet above 40. The countdown uses the existing 100-tick
combo window and fills completely when a player kill refreshes it.

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
