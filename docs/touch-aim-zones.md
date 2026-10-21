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
