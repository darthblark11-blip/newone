# Backbone One controls

The gameplay handler uses the browser's standard gamepad button layout.

| Control | Action |
| --- | --- |
| Left stick | Move |
| Right stick with guns/taser | Aim/fire using the existing stick behavior |
| Right stick with bow | Pull opposite the arrow direction; travel controls string tension |
| L3 — left stick click | Dash |
| R3 — right stick click | Release a drawn bow; otherwise toggle headshot aim |
| D-pad up | Cycle owned melee tools: sword → pickaxe → unarmed |
| D-pad down | Unmapped |
| D-pad left / right | Previous / next available firearm, taser or unlocked bow |
| L2 | Hold/cook grenade; release to throw |
| L2 with chemist suit | Hold/cook flask; release to throw. No grenades. |
| L1 with chemist suit | Hold to charge the cannon; release to fire |
| L1 with other suits | Reserved suit ability slot; ninja parry is not implemented yet |
| A in the forest | Talk or collect at the visible hunting prompt |
| X | Reload; cannot manufacture arrows |
| Y or R1, without chemist suit | Existing melee attack/finisher input |

The selected shoulder layout is **L2 flask / L1 cannon** for the chemist suit.
The chemist's former Y/R1 flask aliases are removed. A/B no longer cycle guns
or toggle headshot aim. L1/L2 no longer trigger dash.

Melee cycling uses the existing owned-tool list. Firearm cycling wraps in both
directions through pistol, story-mode taser, unlocked bow, SMG or dual SMG, assault rifle,
shotgun and rocket launcher as available; dual SMG replaces single SMG in the
list. Simultaneous new left/right presses cancel. Existing 300 ms firearm
and headshot debounce and dash unlock/cooldown restrictions remain.

Button history is captured after the frame's actions, so a new press can be
detected before history changes. Holding an edge-triggered button does not
repeat its action. Grenade/flask/cannon holds merge with touchscreen input
and feed the existing cooking/charging and release mechanics. A missing
controller clears button history so reconnection can detect a new press.

A connected controller hides the touch action buttons (reload, melee, dash,
headshot aim, grenade or chemist abilities) and both joystick circles, even
when the controller is idle. Touching the screen cannot reveal them while
the controller remains connected. The health, ammo, score and objective HUD
stay visible. Disconnecting restores the touch controls when using touch
input; keyboard/mouse use keeps its existing joystick visibility behavior.

With the bow, pull the right stick **back**, opposite the intended arrow line.
For example, pull left to shoot right. Draw smoothly toward full travel: the
stick distance moves the string, while the speed and steadiness of the pull
determine arrow power. A sudden full-stick jab fires a short, weak dud; holding
that jab cannot build power afterward. The small quiver readout shows tension,
DUD/SMOOTH/READY and release feedback.

Release by letting the stick return to its deadzone, reaching its full end stop,
or clicking R3 while drawing. Each draw fires once. Recenter after an end-stop
or R3 release before drawing again. R3 keeps its existing headshot-toggle action
with other weapons. Wildlife headshots always depend on which body/head surface
the projectile reaches first, regardless of that toggle. Weak/dud arrows cannot
claim an instant PERFECT hunting headshot.

Touch aiming uses the same reversed pull and release gesture. On desktop, aim
toward the target with the mouse, hold the primary button to draw, then release
to fire. Pause, menus, cutscenes, travel, weapon changes and input-device changes
cancel an unfinished draw without firing. Draw state is transient and never
saved.

Verification uses a simulated standard-layout pad through the real touch,
gamepad, desktop and player update paths:

```sh
node tools/check-gamepad.js
node tools/check-bow-draw.js
node tools/check-hunting-ballistics.js
```

It checks actual dash, grenade/flask creation, cannon discharge, melee and
reload; first/held/released buttons, cooldown and unlock gates, bidirectional
gun/taser cycling, owned melee tools, unmapped down, reserved L1, simultaneous
shoulders, touchscreen coexistence, axes/deadzone and disconnection/reconnect.
It also captures the actual HUD labels and circles to verify hiding on idle
detection, during pauses and after touch events, then restoration on disconnect.

`check-bow-draw.js` follows actual gamepad/touch/desktop and Character update
paths through smooth draws, jab duds, neutral/end-stop/R3 releases, recentering,
finite ammunition and interruption. `check-hunting-ballistics.js` verifies
first anatomical contact, cover ordering, weak-arrow quality and pooled reuse.
