# Level 1 Blender building upgrade

The plain blocks between Stick City's canal bridges now use the same visible
Blender roof kit as the older brownstone, office-campus, market and workshop
buildings. The representative waterfront block is centered at world
`(600, 7800)`, between bridge streets at `x=0` and `x=1200`.

The former canal buildings had empty detail lists and no district architecture,
so they fell through to generic flat roof rectangles. Their lighting proxies
also remained on the unprojected ground rectangles while the artwork leaned
with the camera.

## Visible changes

- Pitched tile/copper roofs have connected slopes, dormers, chimneys, ridges
  and eave trim. Long tenements orient their ridge along their long axis.
- Workshop roofs have three sawtooth north lights, standing seams, an extractor
  and flue. Flat-roof offices have parapets, a plant room, glass lantern, vents
  and a planting bed.
- Framed windows, glazing and front doors occupy the actual wall planes;
  warehouse fronts have loading shutters. Canal doors face the water.
- The canal crane has a grounded slew ring, mast, raised cab/counterweight,
  lattice jib and hanging hook. Barges have connected hull sides, gunwales,
  recessed holds and raised wheelhouses.
- Staggered limestone courses and drainage grates follow both quay banks.
  These details are baked into the existing terrain textures.

The roof kit is authored in [Blender](../assets/buildings/city-buildings.blend)
and exports 311 polygons across three families. See its
[source preview](../assets/buildings/city-buildings-preview.png) and
[editing/export workflow](../assets/buildings/city-buildings.md).

In-game previews: [waterfront](previews/city-blender-waterfront.png),
[bridge angle](previews/city-blender-bridge-angle.png), and
[roof/camera comparison](previews/city-blender-roof-angles.png).

## Projection, lighting and performance

Every roof and wall vertex shares the building's footprint-anchored camera
projection. Roof features retain their individual heights above the deck;
the parent walls meet the roof without independently shearing the parts.
The same cached projected polygons feed the advanced lighting height map.
The native shadow fallback uses the new silhouette bounds and roof height.
Depth sorting includes the projected eave so nearby characters stay beneath it.
The crane and barge use the same rule, with their base vertices at height zero.

The game remains self-contained in `game.js`. Exported geometry is embedded;
there are no new model/texture downloads or WebGL contexts. Compiled geometry
and face-local Canvas paths are cached. Camera changes update affine projection
coefficients without allocating new paths; idle views reuse those coefficients
and bounds as well. No GPU readback, live ground-detail pass, additional
collision, or world RNG call is introduced by this environment upgrade.

Building footprints, bridge/deck positions, roads, canal meander, placement
order, destruction keys and traversal remain unchanged. Eight frozen native
chunk signatures cover the canal and neighboring blocks. Existing medical,
hotel, leisure, courtyard/garden, downtown landmark and other specialized
building families retain their dedicated renderers. Other levels retain their
existing building/prop artwork. The working SPCK character renderer is unchanged.

## Regenerate and check

```sh
blender --background --factory-startup --python tools/blender-city-buildings.py
python3 tools/build-city3d.py
blender --background --factory-startup --python tools/blender-city-buildings.py -- --validate-only
python3 tools/build-city3d.py --check
node tools/check-city3d.js
node tools/check-city3d-props.js
node tools/check-city3d-browser.cjs
```

Focused checks validate Blender geometry and saved-export agreement, opposite
camera views, height/material pixels, day/evening/rain/night native scenes,
unchanged placements and idle cache reuse. Browser validation uses Chromium
with SwiftShader; it does not measure physical Android performance.

[Recorded validation](city-blender-validation.json) includes 70,427 building
geometry/projection checks, 1,350 prop checks, 472 height/material pixel samples,
nine transformed/clipped Canvas targets and the native world captures. The
11-building pan-stage roof/height medians are 2.4/1.3 ms on this host. The older
plain artwork/footprint proxies measured 1.5/0.2 ms; the new visible solids and
matching lighting add work. Caching face-local paths reduced the new pan stage
from about 5.0 to 3.7 ms combined and removed all recurring path allocations
across the 25 idle and 25 moving-camera samples. These elapsed Canvas timings
include synchronization and are not whole-game FPS or GPU timestamps.

The existing broad generation/district suites have baseline failures on
`e2fd618`: timber scatter on roads/water, a solid overlap, a clutter-art list
and a recreation court with one hoop instead of two. These were reproduced
before this change; the city upgrade does not alter those generators.
