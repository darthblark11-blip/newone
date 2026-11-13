# Blender city roof assemblies

`city-buildings.blend` is the editable source for three visible roof families:

| Family | Geometry | Faces |
| --- | --- | ---: |
| `quay_house` | Connected tile slopes, raised dormers, ridge/eave trim and two brick chimneys. | 90 |
| `quay_warehouse` | Three sawtooth north lights, standing seams, extractor and flue. | 102 |
| `quay_office` | Stone parapet/coping, plant room, glass lantern, vents and planting bed. | 119 |

The game supplies the existing building walls and collision footprint. These
assemblies start at the parent roof deck (`Z=0`); they introduce no ground
colliders. Chimney and extractor lower corners follow the actual sloping host
roof. North-light glazing faces negative Y. All exported points remain inside
the footprint, and the tallest roof detail is under 18 world units.

## Regenerate and validate

```sh
blender --background --factory-startup --python tools/blender-city-buildings.py
blender --background --factory-startup --python tools/blender-city-buildings.py -- --validate-only
```

To export edits made directly in the saved Blender file:

```sh
blender --background --factory-startup --python tools/blender-city-buildings.py -- --export-existing
```

Add `--render-preview` after `--` to generate `city-buildings-preview.png` with
Blender's inspection camera. Its light and shadows are for source review;
runtime lighting remains dynamic. The script disables unsupported denoising so
the preview also renders in Blender builds without OpenImageDenoise.

The exporter validates finite geometry, unit normals, per-face planarity,
footprint and height bounds, expected model keys, known material names, and a
160-face limit per model. `--validate-only` reopens the saved `.blend`, exports
its actual mesh data and compares it with `city-buildings.json`.

## Runtime coordinates

The physical Blender reference footprint is 200 by 160. Every model is rooted
at its own named Empty; component transforms are resolved relative to that
root during export, so translating or rotating an individual component in
Blender is respected. The three roots are spread out in the source scene only
for inspection.

`city-buildings.json` uses schema version 1 and
`coordinates: "footprint-fraction-xy/world-z"`. A point `[x,y,z]` means:

```text
worldX = building.x + x * building.w
worldY = building.y + y * building.h
height above parent deck = z
```

The exported normal is a unit normal in the physical 200-by-160 Blender frame,
not the normalized XY frame. For a runtime footprint `w` by `h`, normalize:

```text
[normal.x * 200/w, normal.y * 160/h, normal.z]
```

Each model contains semantic `parts`, with deterministic `order`, `minZ`,
`maxZ` and `faces`. Faces preserve Blender winding and contain `points`,
`normal`, `material` and a centroid in the same coordinate frame as the points.
`order` records authoring order; the renderer still resolves visible faces and
depth using its current camera. Palette entries are opaque byte RGB colors.

The source contains 119 parts and 311 polygons. Runtime consumers can project
the exported polygons into the existing Canvas2D building pass, without a new
WebGL context, an external texture fetch, or an additional live renderer.
