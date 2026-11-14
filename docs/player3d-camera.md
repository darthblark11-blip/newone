# Screen-position-aware character views

Living player and human enemy meshes use one finite pinhole-camera rule.
The renderer reads the actual main Canvas transform, inverts it at the viewport
center, and resolves the camera-to-character ray. A character can keep the same
world facing and pose while revealing different surfaces as it crosses the
screen. There are no angle buckets or artificial facing rotations.

The focal distance follows the viewport and zoom. Pixel density cancels between
the backing canvas and its transform; terrain/shaft display scale is accounted
for once. Camera motion and shake update the ray at draw time. A near guard
keeps the camera beyond elevated mesh geometry instead of clamping individual
vertices.

For local model coordinates, camera offset `o`, focal height `H`, and reference
plane `z=0`, the projected point is:

```
w = 1 - z / H
screenLocalXY = (modelXY + o * z / H) / w
```

`tools/player3d/view.js` supplies the CPU projection. The mesh shader uses the
same homogeneous `w`, with projectively consistent depth and conservative
projected bounds. Base geometry, outline ink and wound caps share that path.
`snapshot.sockets` stays canonical XYZ; after a successful draw,
`snapshot.renderView` records the camera and `snapshot.projectedSockets` records
presentation positions.

Canvas muzzle flashes, lasers, cannon feedback, shields, hair, Molotov wicks
and boxing feedback use the same camera. Projectile launch height is frozen
at initialization, including the weapon presentation phase and offhand muzzle.
Only visual heads, trails, beam endpoints and tethers are projected. Physics
coordinates, travel, history, aiming, hit checks, ammunition and RNG remain
unchanged. Leg shots visually descend to their existing floor range. A small
launch offset reconciles terrain/shaft display scaling and settles out over
the first 120 world units.

The common living draw helper opts the existing 3D actor paths into perspective.
Direct `Player3D.draw` defaults to orthographic; `{view:true}` requests the main
camera. Offscreen Graphics require an explicit camera descriptor, so corpse
stamps do not bake a changing viewport into the floor. Quickdraw keeps its
separate staged projection. Existing native enemy injury/prone and specialist
painters retain their previous scope. `Player3D.enabled=false` also restores
native projectile presentation for rounds already in flight.

See the [fixed-pose edge/corner gallery](previews/player3d-camera-poses.png),
[straight-walk and camera-pan clip](previews/player3d-camera-motion.mp4), and
[live world scene](previews/player3d-camera-world.png).

Validation:

- 890 pure camera checks: viewport, zoom, DPR, inverse transforms, corners,
  continuity, near safety, offscreen isolation, and state purity.
- 23 living dispatch/attachment checks and 463 projectile presentation checks
  across 99 launch poses. Native leg-shot checks and current-baseline
  projectile physics/RNG parity also pass.
- 72 real GPU fixed-pose placements and 12 GPU/CPU marker comparisons across
  DPR 1/2, rotated transforms and zoom extremes. Maximum marker error: 0.505
  logical pixels.
- Actual Canvas hair/flash origins and native projectile launches agree with
  projected mesh sockets. The 60-frame clip retains fixed facing through
  movement and panning. The world test renders 27 perspective actor draws with
  no WebGL, browser or frame faults.
- Animation reuses 35 uploaded meshes and one shader program. Existing player
  animation fidelity, enemy dispatch, helmet, and corpse-head checks pass.

Results are stored in `player3d-camera-validation.json`. Chromium/SwiftShader
testing does not establish physical-phone performance. The existing historical
particle-beam zero-angle test still fails on the unchanged prior commit; it is
separate from the current-baseline projectile parity check.
