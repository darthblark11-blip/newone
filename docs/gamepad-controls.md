# Backbone One controls

The gameplay handler uses the browser's standard gamepad button layout.

| Control | Action |
| --- | --- |
| Left stick | Move |
| Right stick | Aim/fire using the existing stick behavior |
| L3 — left stick click | Dash |
| R3 — right stick click | Toggle headshot aim |
| D-pad up | Cycle owned melee tools: sword → pickaxe → unarmed |
| D-pad down | Unmapped |
| D-pad left / right | Previous / next available firearm or taser |
| L2 | Hold/cook grenade; release to throw |
| L2 with chemist suit | Hold/cook flask; release to throw. No grenades. |
| L1 with chemist suit | Hold to charge the cannon; release to fire |
| L1 with other suits | Reserved suit ability slot; ninja parry is not implemented yet |
| X | Reload |
| Y or R1, without chemist suit | Existing melee attack/finisher input |

The selected shoulder layout is **L2 flask / L1 cannon** for the chemist suit.
The chemist's former Y/R1 flask aliases are removed. A/B no longer cycle guns
or toggle headshot aim. L1/L2 no longer trigger dash.

Melee cycling uses the existing owned-tool list. Firearm cycling wraps in both
directions through pistol, story-mode taser, SMG or dual SMG, assault rifle,
shotgun and rocket launcher as available; dual SMG replaces single SMG in the
list. Simultaneous new left/right presses cancel. Existing 300 ms firearm
and headshot debounce and dash unlock/cooldown restrictions remain.

Button history is captured after the frame's actions, so a new press can be
detected before history changes. Holding an edge-triggered button does not
repeat its action. Grenade/flask/cannon holds merge with touchscreen input
and feed the existing cooking/charging and release mechanics. A missing
controller clears button history so reconnection can detect a new press.

Verification uses a simulated standard-layout pad through the real touch,
gamepad, desktop and player update paths:

```sh
node tools/check-gamepad.js
```

It checks actual dash, grenade/flask creation, cannon discharge, melee and
reload; first/held/released buttons, cooldown and unlock gates, bidirectional
gun/taser cycling, owned melee tools, unmapped down, reserved L1, simultaneous
shoulders, touchscreen coexistence, axes/deadzone and disconnection/reconnect.
