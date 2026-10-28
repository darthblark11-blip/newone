# Leg shots and temporary injuries

Standing humanoids now test low shots against the two actual jointed leg shapes,
using the same thigh, knee and shin geometry as their wound decals. Air between
the legs and outside the pants is a miss. Projectile sweeps retain fast-shot
contact and record which leg was struck before damage or knockback moves the
target. Existing vertical wound variation is preserved on that leg.

LEGS firearm rounds meet the floor at **13 m (260 world units)**. Collision is
checked through the final partial step before the round retires. Other aim
elevations retain their normal range; arrows, energy weapons, rockets and tasers
retain their own flight behavior.

A surviving leg hit has a **25% immobilization chance** on hostile, on-foot
humanoid enemies, including standard NM0 armored guards. Player, friendly and
neutral actors, animals, robots, armored orbs, airborne actors, scientists,
mounted riders and scripted/boxing actors are excluded. Existing stun and
knockout states retain ownership.

The struck side is captured at impact. Moving actors kick that leg back and
fall along their incoming motion; stationary actors reach for the injured leg
as they fall. Three authored fall variants rotate independently through three
outcomes:

- **Prone fire:** remains down and uses native directional aiming and firearm
  emission for 4.8 seconds. Incoming HEAD/BODY shots pass overhead; LEGS shots
  receive head/critical damage.
- **Seated fire:** first drops onto the back with the legs extending forward.
  After a 0.28 second floor pause, the actor lifts the chest over 0.52 seconds
  while the feet stay planted. The firearm eases into its ready pose near the
  end of the rise; firing starts after the sit-up, for 5.4 seconds. While flat,
  HEAD/BODY pass overhead and LEGS is critical. During the rise, collision
  follows the actual interpolated stance height. Once seated, HEAD passes
  overhead, BODY resolves head/critical damage and LEGS resolves body damage.
- **Quick recovery:** remains down for 0.65 seconds without firing before rising.

Every outcome has a 0.95 second recovery and returns the survivor to normal combat
AI. A 3 second cooldown prevents immediate repeated immobilization. Movement is
disabled while injured after the collision-checked fall slide; aiming, native
ammo/reloads, muzzle flashes and damage feedback continue during downed fire.
Pause, travel/build menus and other noncombat overlays freeze the whole state.
Fatal hits still use native death, wound attachment and kill credit.
The actual wounded pose hands its joints to the native corpse settle, so a
prone or seated fighter does not briefly stand up when killed. Wounds and
fatal spray follow the same limbs during that handoff. Cover releases on injury
and cannot take control again until the fighter recovers.

`LEG_INJURY_CHANCE`, `LEG_INJURY_RECOVER_MS`, `LEG_INJURY_COOLDOWN_MS` and
`LEG_SHOT_RANGE` in `game.js` are the principal balance controls. The injury state
is transient and is rebuilt with the hostile roster on travel/load/reset.
Outcome choices and proc rolls consume no shared gameplay RNG; rendering does
not advance the state or choose a new pose.

Focused checks:

```sh
node tools/check-leg-shot-collision.js
node tools/check-leg-injury-ai.js
node tools/check-leg-injury-integration.js
node tools/check-leg-injury-corpse.js
node tools/check-leg-injury-render.js
node tools/check-leg-injury-cover.js
node tools/check-seated-injury.js
```

`tools/visual-leg-injuries.js` renders the native p5 fall/outcome/directional
fixtures and a motion recording for visual review.
`tools/visual-seated-injury.js` focuses on the backward drop, floor pause,
planted sit-up and firearm presentation for both hurt sides and weapon grips.
