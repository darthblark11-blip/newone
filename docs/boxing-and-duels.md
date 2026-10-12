# Boxing and quick draw

The player now uses a shared southpaw boxing stance in the world and the Copper
Spur. The right foot leads; the left straight is the rear power punch and the
right jab is the lead punch. Entering the stance locks onto the nearest eligible
target. A punch commits its facing through contact, so a moving opponent cannot
drag an extended fist onto somebody behind the player.

## Punches, defense and footwork

| Action | Touch | Keyboard | Standard gamepad |
| --- | --- | --- | --- |
| Left straight | L STRAIGHT | E | RT |
| Right jab | R JAB | R | LT |
| Left hook | L HOOK | Q | RB |
| Right hook | R HOOK | T | LB |
| Left upper-body sway | SWAY L | Space | X |
| Right upper-body sway | SWAY R | H | Y |
| Footwork | Left stick | WASD | Left stick |
| Directional guard | Right stick | Arrow keys or IJKL | Right stick |
| Return to equipped weapon outdoors | WEAPON icon | Tab | B |

Tap an attack for the head, or hold it for 180 ms for the body. A held attack
fires once; release before the next punch. Both sways leave the feet planted
unless a movement direction is held, which adds a collision-checked sidestep.
Slipping the head leaves the body vulnerable, and the wrong sway can be caught
by the opposite hook.

Guard directions are relative to the boxer, independent of their facing:

| Stick direction | Protected area |
| --- | --- |
| Up | Face against straight punches |
| Down | Body center against straight punches |
| Up-left / up-right | Left / right head side against hooks |
| Down-left / down-right | Left / right body side against hooks |
| Left / right | Left / right outer ribs |

Changing into the correct guard within 140 ms of contact parries the punch,
flashes at the guard and knocks the attacker back into a **600 ms standing
stun**. Holding the same direction keeps a block but does not refresh the parry
window. An attacking arm opens its own guard; the other arm can still protect
its selected area. Punches use the actual animated fist, forearm and head/body
geometry, including terrain scale, rather than a broad damage radius.

Boxers have body collision and take staggered attack turns. Three opponents
allow one attack at a time; a larger outdoor group can spend two separated
attack turns. Windups, recovery, guard gaps and counterattacks remain active.
Ordinary armed enemies retain their firearm behavior. World fists preserve
harmless civilian knockdowns and the existing four-hit hostile stun.

## Copper Spur

The room is now 1400 × 980 world units, about 2.7 times its previous area, with
a longer bar, six tables, gallery, piano, stairs and a clear fighting floor.
The close camera keeps the player and locked opponent readable. The bar fight
uses separate GRIT and nonlethal directional knockouts; its first win still
awards 75 score. Pause, save and leave-to-shop retain the outside equipment.

## Quick draw

The right stick aims below roughly **70%** travel and fires when pushed farther.
The visible gun and projectile follow that direction. Aiming while WAIT is
safe; firing before DRAW loses. Desktop mouse aiming, Space/RT and the FIRE
button remain available. The target must actually be hit: a badly aimed round
can miss, and victory waits for finite projectile contact.

Each victory advances the saved challenge. The first duel starts at 380 world
units with a 700 ms normal draw deadline; subsequent opponents stand 55 units
farther away and draw progressively faster. Hard mode starts with 520 ms.
The first win awards 120 score and immediate cowboy costume ownership; later
wins advance the challenge without duplicating that reward.

Hits use the game's native corpse, wound, fall and death effects inside the
duel scene. A player defeat shows the same death animation through a local
body, costs 12 outside health and keeps the minigame's rematch flow. Local
actors, bullets and effects do not alter campaign kills or outside combat.
Saving resumes outside with the challenge tier and exact weapon reserves.

## Verification

```sh
node tools/check-boxing-combat.js
node tools/check-boxing-render.js
node tools/check-boxing-world.js
node tools/check-frontier-saloon.js
node tools/check-frontier-integration.js
```

Actual Chromium checks cover portrait and landscape touch layouts, simultaneous
move/guard/punch fingers, complete mobile bar fights, timed parries, world
stance entry/exit, aimed duel hits and misses, native death visuals and saved
challenge progression.
