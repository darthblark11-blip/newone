# Level 3 architectural overhaul

Based on `codex/directional-falls-and-footwork` at
`5d1583efc9966873b0e66ca8803b8e7aebf3f40e`. The changes are integrated into the
existing global-mode `game.js`; OpenProcessing needs no additional assets,
imports, build step, or runtime library upgrade. The production p5 version
remains 1.9.0.

## Generation blocks

`FRONTIER_ARCHITECTURE` controls the version, maximum two structural wings per
premise, and maximum twelve roof material bands. `frontierCompileArchitecture`
is applied to the authored map, the three settlement plans, and streamed Level 3
content. Independent address hashes select geometry without advancing the
terrain or population random streams.

Every building retains ordinary rectangular ground collision. A recessed
compound consists of separate main and return wings inside its original lot;
the open court has no parent bounding-box collider. Roofs, chimneys, canopies,
and headframes are visual geometry. Their projected polygons also supply the
raised lighting mask. Existing wall blood and attached corpses retain their
ordinary rendering callbacks.

The compiler emits these internal records:

```js
// Attached to each ordinary native building/wing record.
b.frontierPremiseId; // deterministic logical premise identity
b.frontierPartId;    // "main" or "return"
b.frontierLot;       // immutable {id,x,y,w,h,facing,entrance}
b.frontierDesign;    // immutable {id,purpose,roof,material,variant,emblem,primary}
```

`frontierRoofMesh(b)` caches world-space faces and ribs in a WeakMap. The draw
pass projects these vertices from their own heights with the existing camera
model. Projection uses one unit-height lean per building, avoiding allocations
and repeated camera calculations for every vertex.

| Purpose | Roof and identity |
| --- | --- |
| Saloon / hotel | Hip or mansard mass, entrance canopy, upper volumes, spur/hospitality emblem |
| Sheriff / bank | Stepped stone parapets, inset roof volume, star/vault emblem |
| Workshop | Raised sawtooth glazing, chimney, crossed-tools emblem |
| Mission | Adobe or stone body, separate bell tower and pitched crown |
| Mining | Open headframe for hoists; gabled ore sheds and canvas powder stores |
| Barn / home | Gambrel or pitched roof, individual ridge/stack placement |
| Market / merchant | Canvas hall or stepped false front with trade emblem |
| Trailer | Low metal roof and individually projected service fixtures |

All 69 named Dry Gulch premises have distinct structural meshes. Copper Wash,
Sunspur, and Mesa Relay each retain twelve logical premises with different
purpose-sized footprints and staggered frontages. The central streets and both
north/south approaches remain open. Saloon, sheriff, wanted-board, duel, and farm
anchors retain their gameplay contracts.

## Surfaces and crossings

`FRONTIER_SURFACES` defines a 28-unit frontage walk, 14-unit apron, and the shared
authored boardwalk runs. `frontierSurfaceRects` collects lots once per identity;
`frontierUnionSurfaces` produces disjoint material strips. Ground surfaces never
inherit a roof transform. The old live foundation rectangles, separate
boardwalks, and per-frame dust speckles are removed from the hybrid ground pass.

`bakeFrontierRoadNetwork` fills each of five shoulder layers and twelve road
layers once as a compound Canvas path. Consistent polygon winding unions roads
at crossroads, eliminating accumulated translucent paint at intersections.
Wagon-rut paths explicitly end at gaps rather than connecting across faded
terrain. All coordinates and plank joints are anchored in world space.

`bakeFrontierSurfaces` records its clipped material rectangles on the existing
terrain texture. `frontierSurfaceAt` and the native shovel query use those same
records: timber rejects digging, earth remains soil, and real building wings
retain ordinary foundation blocking. Neighbor-lot discovery is deterministic
and uses a bounded 48-entry cache; it does not depend on chunk loading order.

`FRONTIER_CANYON_STYLE` owns the floor/toe/rim palette and the raised bridge rail
dimensions. See [Canyon rendering](frontier-canyon-rendering.md) for the exact
projection and cache rules. Existing canyon profiles, slopes, bridge widths,
ramps, and crossing locations remain the movement authority. Raised rails are
render records outside collision arrays and preserve the clear walking width.
Level 3's signed lighting origin is extended to -192 to cover Redrock's floor.

## Persistence and compatibility

Satellite parent destruction keys suppress all replacement wings. Changed
procedural architecture uses `frontier:v1:` keys; unrelated scenery keeps its
previous keys. Logical names and sign text appear on the primary wing only.
The load path checks old Level 3 exterior positions against current native
collision and can relocate an obstructed player to nearby clear ground on the
same terrain surface, releasing stale cover state.

Terrain remains 1200 units per chunk at 384 pixels. Texture sizes, light target
sizes, particle budgets, population caps, and bake scheduling are unchanged.
Static material detail stays in terrain textures; roof geometry uses weak
ownership, and bridge rail records occupy one replaceable view cache.

## Validation

Focused additions:

```sh
node tools/check-frontier-architecture.js
node tools/check-frontier-surfaces.js
node tools/check-frontier-raised-rails.js
```

Existing frontier town, settlement, route, canyon, material, bridge, occlusion,
lighting, mission, saloon, and save/travel checks cover the shared integration.
Native route tests walk from the sheriff to all three settlements and bounty
sites using the real movement solver.

The baseline already fails one source-pattern assertion in `check-depth.js`
(144/145 pass), a Level 1 courtyard fixture in `check-shovel-foundations.js`, and
the other-biome elevation assertion in `check-civic-terrace.js`. These are
recorded independently of this overhaul. The stale Level 2 lighting expectation
in `check-frontier-lighting.js` is corrected to its existing production range.
The broader `check-generation.js` also reports the same baseline forest
placement issues (230 overlapping pairs and 116 timber reservation violations)
and missing forest-art dispatch assertions. These are outside Level 3; the
baseline and candidate were run separately to confirm the matching failures.

See [Native browser validation](frontier-browser-validation.md) for screenshots,
source hashes, commands, and measured cloud-browser results. Use the generated
standalone S25 benchmark to measure physical-device performance; cloud
SwiftShader timing does not establish Galaxy S25 frame rate.
