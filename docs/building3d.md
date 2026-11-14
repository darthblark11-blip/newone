# Blender building-lighting optimization

The existing frontier roof solids are extracted into Blender, validated and
exported as 96 ordered lighting plans containing 3,180 polygons. The standalone
game embeds the export and caches direct Canvas paths and material styles.
It samples ground elevation once per building rather than once per face.
An unchanged camera reuses projected paths; moving the camera refreshes their
edges through the existing parallax projection.

This pass covers authored frontier buildings. Generated roofs compile a
validated fallback once per mesh. Visible artwork, collisions, sun direction,
local lamps and the established per-face shadow heights remain in place.
An experimental continuous-height version accentuated the existing sparse
sun marcher's banding, so production retains native mean-height proxies.
The three tested world height buffers match the previous painter byte for byte.

Measured on this host with Chromium/SwiftShader, a 23-building,
755-face roof-lighting pass took 3.50 ms median before and
2.00 ms after. This measures that stage, not whole-game FPS;
physical-phone performance remains unmeasured. Camera movement creates no
gradients, and idle views reuse paths and styles.

See [the world comparison](previews/building3d-lighting.jpg),
[validation data](building3d-validation.json), and
[the Blender asset workflow](../assets/buildings/README.md).

```sh
node tools/extract-building-lighting.cjs --check
python3 tools/build-building3d.py --check
node tools/check-building3d-roof-lighting.js
node tools/check-building3d-roof-browser.cjs
```

Validation includes 9,728 asset/geometry/cache checks, 132 actual Canvas pixel
samples, camera movement, signed terrain heights, wet materials, and live
sun/night-lamp world rendering. Frontier lighting, building identity and
occlusion suites also pass.
