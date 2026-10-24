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

Leg aim currently uses body-shot damage and armor rules. On humanoids it
places bullet marks on the struck leg, following that limb through movement
and supported fallen poses. It adds no slowdown, critical damage or new
dismemberment behavior. Existing headshot effects stay on the head. Actors
without humanoid legs retain their existing body-hit behavior.

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
node tools/check-bow-controls.js
node tools/check-bow-draw.js
node tools/check-gamepad-trigger-shooting.js
VIS_DEPS=/workspace/newone-dev node tools/check-touch-aim-scene.js
VIS_DEPS=/workspace/newone-dev node tools/check-leg-aim-scene.js
```

The scene checks use p5, Playwright and Chromium for native touch events and
rendered limb placement. Set `VIS_DEPS` to the directory containing those Node
dependencies and `VIS_CHROME` to the Chromium executable when needed.
