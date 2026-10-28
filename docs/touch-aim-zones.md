# Touch targeting

The right aiming control rests as a body silhouette with three touch sections:
HEAD, BODY and LEGS. Press a section to select the target. The familiar aiming
joystick then appears centered at that exact press, and dragging uses its
existing direction, travel, firing threshold and bow draw behavior. Release
returns to the silhouette; the next press can choose a different section.

The first aiming finger owns the gesture until release. Crossing another
section while dragging does not change the target, and another finger can
still move or use reload, dash and the other action buttons. Those buttons
stay in their fixed screen positions when the aiming origin moves.

Combat buttons form one column along the right edge: GRENADE, RELOAD, DASH,
then MELEE. The chemist uses FLASK in the top slot and CANNON in the bottom
slot. Their cooking, charging, ammunition and cooldown behavior is unchanged.
Painting and hit detection share `touchCombatLayout()`, with separate hit
areas for adjacent rows.

The aiming silhouette sits about 68 CSS pixels (approximately 1.8 cm) higher
than its initial position. Its larger sections are 184 pixels tall overall,
with a wider silhouette shifted slightly left. Short screens fit it between
movement and the action column and keep buttons below the top status HUD.

Touch buttons and joystick outlines fade out over 160 ms while aiming,
firing, drawing the bow or charging the cannon, then return over 200 ms when
idle. Their hit regions stay active at every opacity; health, ammo and other
status readouts keep their normal visibility. The combo uses its own quicker
entry and exit fade.

The normal and saloon HUDs omit score and the permanent pause icon. Score
remains in the shop and results. Tap the top-right corner to open pause,
including a quick tap that ends between input frames.

Standing humanoid leg aim uses two thin swept leg shapes, so the gap between
the legs and the space outside them are misses. Low firearm rounds meet the
floor after 15 m standing, 20 m crouched or 26 m prone, using the shooter's
effective stance at launch. Conventional firearm hits resolved to LEGS deal
50% body damage, with existing armor rules and a 25% chance to collapse a
surviving hostile humanoid onto the struck side. Low shots converted to BODY
or HEAD keep normal damage, including during falls and seated/prone transitions.
Arrows, energy weapons, explosions and tasers retain their existing damage. Wounded
enemies can fire prone, sit and fire, or get back up. See
[Leg injuries](leg-injuries.md) for timing and lowered hit profiles.
Bullet marks follow the selected leg through movement, injury and supported
fallen poses. Existing headshot effects stay on the head. Actors without
humanoid legs retain their existing hit shapes and decal placement.

The aiming laser now stops at the first valid contact for the selected HEAD,
BODY or LEGS elevation. It shares projectile anatomy and cover checks: raised
shots pass over lowered actors, while low shots can pass between standing legs.
Low firearm guides use the same 15/20/26 m stance limits as their bullets. Each dual
SMG barrel has its own guide, and crouch, prone and cover use the actual posed
muzzle. The guide follows the weapon's central aiming direction; weapon spread
still applies to fired rounds and shotgun pellets.

Bullet decal placement separates the projectile's lateral contact from the
mark's anatomical height. The actual bullet path still determines the
left-to-right position; height varies within the resolved head, torso or leg
section instead of repeatedly marking one row. Stance remapping chooses that
section before placing the mark. The sampled position is stored at impact,
so walking, turning, crouching and falling carry the same wound rather than
choosing another height while drawing it. This changes decal placement only,
not projectile flight, hit detection or damage. Leg hits can land on the thigh
or shin of the leg selected by the actual shot, rather than only the bottom
shin. Pellets sharing one shot ID still receive separate heights. Placement
uses a private cosmetic hash and consumes no combat randomness.

Pause, travel, death, reset, resize and input handoffs cancel the held gesture.
Menu touches remain consumed until release. New games and loaded games start
with BODY aim; the selected zone and joystick gesture are not saved. Desktop
right-click and controller R3 retain their head/body toggle, and R3 still
releases a drawn bow.

Checks:

```sh
node tools/check-aim-zones.js
node tools/check-touch-aim-zones.js
node tools/check-leg-aim.js
node tools/check-leg-shot-collision.js
node tools/check-leg-injury-integration.js
node tools/check-aim-laser.js
node tools/check-vertical-hit-decals.js
node tools/check-bow-controls.js
node tools/check-bow-draw.js
node tools/check-gamepad-trigger-shooting.js
VIS_DEPS=/workspace/newone-dev node tools/check-touch-aim-scene.js
VIS_DEPS=/workspace/newone-dev node tools/check-leg-aim-scene.js
VIS_DEPS=/workspace/newone-dev node tools/visual-vertical-hit-decals.js
VIS_DEPS=/workspace/newone-dev node tools/visual-aim-laser.js
```

The scene checks use p5, Playwright and Chromium for native touch events and
rendered limb placement. Set `VIS_DEPS` to the directory containing those Node
dependencies and `VIS_CHROME` to the Chromium executable when needed.
