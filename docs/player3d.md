# Blender player models

The player is an articulated 3D mesh rendered through WebGL2 at the game's
existing Canvas actor and corpse slots. The overhead camera, world ordering,
controls, simulation, saves, and OpenProcessing entry point remain in place.
`Player3D.enabled = false` selects the complete native player painter for
comparison. Unsupported or lost WebGL contexts use that same fallback.

## Source and export

`assets/player/player.blend` is the editable Blender source;
`assets/player/player.glb` is the portable model. The Blender exporter emits
`assets/player/player-mesh.json`, with shared normalized mesh parts, materials,
and cel-shading parameters. Regenerate the self-contained runtime after changes:

```sh
python3 tools/build-player3d.py
python3 tools/build-player3d.py --check
```

See [the model editing instructions](../assets/player/README.md) for generating
the source and exporting manual edits without rebuilding the character.

The marked generated block at the end of `game.js` contains that data plus the
source modules in `tools/player3d/`. Edit those modules and rebuild rather than
editing the generated block. No runtime mesh downloads or third-party engine
imports are required.

## Geometry and rendering

`player3DPose(actor, options)` resolves actual XYZ joint transforms, mesh parts,
and attachment sockets without advancing animation time or requiring a GPU.
XY uses the existing actor-local world axes; Z is height. Native gameplay
queries remain the reference for weapon origins and contact positions. A
renderer call never updates the simulation.

The head mesh is spherical with no ears or projecting nose. It keeps the small
surface facial marks, uses uniform XYZ scale in living and corpse poses, and is
calibrated to the standard pistol player's original 11-unit projected diameter.
Head centers and the native gameplay hit geometry remain unchanged.

Standing, crouched, and prone mesh landmarks and projected proportions follow
the original painter. Chest and pelvis retain independent native headings;
authored elbows are preserved. Prone legs come from the stance joints, and
stopping retains the native easing clock. Copy `gaitPose()` scalar values before
calling other pose helpers: it returns shared scratch data.

The rifle, shotgun, and particle accelerator use the original game's authored
solids and grip/muzzle coordinates. `node tools/extract-player3d-weapons.cjs`
updates their Blender input when the native weapon art changes.
The support palm sits below the posed long-gun mesh wherever their projections
overlap. The palm and adjacent arm joints change depth while retaining their
native XY positions, so aiming and muzzle placement stay consistent.

The jetpack uses a rigid, uniformly scaled transform attached to the chest's
posterior surface. It follows the anatomical back through turns, moving dives,
and prone spine rolls, including the signed-angle wrap, without stretching its
tanks or disappearing inside the torso.

`Player3D.draw(snapshot, context, options)` immediately copies a transparent,
depth-tested mesh render into the supplied 2D context. Its current transform,
alpha, and clip apply, including rebased `p5.Graphics` corpse caches and pinned
body-part passes. GPU meshes and programs persist between draws. The renderer
owns its WebGL context independently from the world lighting watchdog.

Living wounds attach to the head, clothing, or leg meshes. Surface intersections,
depth testing, and per-part stencil masks keep stains inside the affected body
part and beneath crossing hands. Hit flashes and charred skin use transient
material colors; they do not modify the saved model.

The mesh shader supplies three relative material bands and silhouette ink.
Its shading direction blends the live sun with the strongest nearby native
scene emitters, using their distance falloff, cones, and world heights. Directional
contrast fades in ambient-only darkness. Snapshots carry `worldOrigin`, including
the real position while a corpse is rebased into a chunk's Graphics target.
The existing lighting pass supplies absolute daylight, local lights, atmosphere,
and shadows. The player retains the existing approximate world-shadow stamp;
the model does not add a second floor shadow. Blender material node graphs are
represented by matching runtime parameters rather than exported as GLSL.

The newest eight settled player bodies remain static geometry in the live
corpse list so their lighting can change without advancing death physics.
Older bodies, distant bodies, and bodies retired on map exit use the normal
floor stamp. Enemy bodies retain their existing retirement behavior.

`Player3D.getDiagnostics()` reports context readiness, failure details, successful
draws, mesh uploads, GPU resource creation, and context restoration counts.

## Verification

```sh
node tools/check-player3d.js
node tools/check-player3d-dispatch.js
node tools/check-player3d-corpses.js
node tools/check-player3d-head.js
node tools/check-player3d-head-corpses.js
node tools/check-player3d-lighting.cjs
node tools/check-player3d-fidelity.js
node tools/check-player3d-support-hand.js
node tools/check-player3d-jetpack.js
node tools/check-player3d-equipment-browser.cjs
node tools/check-player3d-browser.cjs
node tools/visual-player3d-fidelity.cjs
```

The fidelity suite traces the original painter's real transforms and anatomy,
then compares mesh joints, visible widths, head/body/hand/boot proportions,
independent headings, prone orientation, and stop easing. The visual tool writes
matched original-2D / first-3D / revised-3D images and an original-versus-revised
motion clip with turning and stance transitions. Set `PLAYER3D_FIDELITY_OUT` to
select its output directory or `PLAYER3D_FIDELITY_VIDEO=0` to skip video.

The equipment checks verify support-hand mesh depth and unchanged native grips,
jetpack rigidity and attachment, and real controller-driven dive transitions.
The equipment browser check also compares actual GPU occlusion and visible pack
pixels, and writes [a pose sheet](previews/player3d-equipment.png) and
[a motion preview](previews/player3d-equipment-motion.mp4). Set
`PLAYER3D_EQUIPMENT_OUT` to change its default `/tmp/player3d-equipment-qa` output
directory. The stored results are in `player3d-equipment-validation.json`.

The browser check uses locally installed p5, Chromium, and Playwright. Set
`PLAYER3D_P5` or `VIS_CHROME` for other installations, and `PLAYER3D_OUT` to change
the default `/tmp/player3d-qa` output directory. It checks actual GPU output,
native player dispatch, clipped draws, corpse render targets, fallback,
context restoration, and persistent mesh buffers. It also produces a contact
sheet, motion frames, and a timing report. Software-rendered browser timings
describe this host; performance on a physical phone requires device measurement.

Two pre-existing checks also fail on the unchanged baseline: `check-depth.js`
(the run-dispatch source-pattern assertion) and `check-standing-fluidity.js`
(the shallow backward-stop assertion). Their failures are independent of this
renderer change.
