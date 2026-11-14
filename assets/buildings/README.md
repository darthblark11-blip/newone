# Blender roof lighting geometry

Level 1's visible city roof assemblies have a separate editable
[`city-buildings.blend`](city-buildings.blend) source and
[export workflow](city-buildings.md). Their embedded artwork and lighting share
the same camera projection; see the [city upgrade](../../docs/city-blender-overhaul.md).

`roof-lighting.blend` contains the 96 actual authored frontier roof assemblies,
positioned at their native map coordinates. Its 3,180 polygons retain the exact
order and winding supplied by `frontierRoofMesh()`, including chimneys, towers,
porches, braces and vertical faces. The source colors help inspect the geometry.

`roof-lighting-source.json` captures native double-precision vertices. Blender
imports them, validates polygon planarity and exports normalized local face
planes to `roof-lighting.json`. The runtime uses the planes to compile cached
projected polygon paths, validate geometry and reject edge-on faces. Visible
building artwork, collision and the moving sun remain controlled by the game.

Production retains each native polygon's existing mean-height shadow proxy.
Continuous surface-height ramps were tested, but accentuated bands from the
existing sparse sun-ray marcher. The cached proxy matches the previous height
buffer while removing repeated p5 vertex/color work and elevation lookups.
Camera movement refreshes projected edges; an unchanged view reuses the paths.

## Regenerate

From the repository root:

```sh
node tools/extract-building-lighting.cjs
blender --background --factory-startup --python tools/blender-building-lighting.py
python3 tools/build-building3d.py
```

The final command embeds the lighting export into the self-contained `game.js`.
The Blender exporter does not write to the game or player assets.

To check both freshness and the saved Blender/export pair:

```sh
node tools/extract-building-lighting.cjs --check
blender --background --factory-startup --python tools/blender-building-lighting.py -- --validate-only
```

Freshness compares the actual extracted roof geometry and authored placement,
so unrelated game changes do not invalidate it. Validation checks saved Blender
face order, vertex topology, object placement, normalized planes, polygon
residuals, height bounds and exact agreement with the runtime export.

## Coordinates and keys

Vertices use native local XY with Z measured above ground. Subtracting the
building's XY origin localizes the mesh; its original Z is retained. Each
Blender object is translated to that authored world XY origin. Runtime ground
elevation and camera projection remain live.

Keys have the form `roof-xxxxxxxx`. The extractor applies FNV-1a 32-bit to each
ordered local vertex quantized with `Math.round(value * 10000)`, encoded as
`qx,qy,qz;`, followed by `|` after each face. Blender preserves this key across
its float32 import. Runtime checks the matching geometry before using a plane.

Each exported face retains `points`, a unit-normal plane `[A,B,C,D]` satisfying
`A*x + B*y + C*z + D = 0`, and `minZ`/`maxZ`. Vertical native planes export `C=0`.
Coefficients retain 12 decimal places; source points retain nine. The exporter
centers each Blender normal's plane on the original native vertices and checks
the resulting residual, avoiding unnecessary float32 translation error.

## Inspecting and editing

The `.blend` is an ordinary editable polygon collection. Objects identify their
native premise, part and geometry key. Every mesh has a `native_face_index`
attribute. Keep face and vertex order intact when inspecting or preparing edits.

Native artwork remains the geometry authority for this lighting fix. Changing
geometry only in Blender would make its height field disagree with the visible
building, so export rejects such a mismatch. Update the native geometry,
refresh extraction and regenerate the Blender source together when changing a
building's shape. An unchanged saved file can be exported without rebuilding:

```sh
blender --background assets/buildings/roof-lighting.blend --python tools/blender-building-lighting.py -- --export-existing
```

The current export has 2,286 vertical, 535 flat and 359 sloped faces. Its maximum
native plane residual is 0.00000801 world units. These counts and measured
errors are recorded in the export's `validation` object.
