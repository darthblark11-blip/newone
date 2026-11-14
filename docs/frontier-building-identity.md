# Frontier building identity correction

The initial overhaul replaced too many distinct structures with generic roof
forms, repeated windows and circular trade badges. This revision removes that
badge system entirely and restores the original architectural descriptions.

It also fixes a visible rendering error: roof-grain polylines inherited the
previous fill colour. Each open three-point ridge line became a filled triangle,
covering towers and chimneys. Roof meshes now retain ordered face and stroke
commands. Strokes explicitly disable fill and paint beside their owning roof,
before raised details.

Buildings retain separate structural families and semantic roles. A courthouse
stays a courthouse, a warehouse stays a warehouse, and adobe wall material no
longer changes the whole Sunspur mission into a flat-roofed block. The new roles
also distinguish the school, laundry, waterworks, bakery, telegraph, post office,
bookshop, barber, opera house, cattlemen's hall and other businesses.

The church has its teal pitched nave, ivory clapboard, arched windows, double
doors, entrance steps, open belfry, pyramidal steeple and physical raised cross.
The school retains its bell instead of receiving the same church cross. The
saloon has a clerestory, paired chimneys, balcony and spindles. Hotels retain
verandas and dormers; civic buildings have porticoes and cupolas; depots have
platform canopies and clocks; workshops have large working doors and brick
stacks; the mine has an open shaft, braced headframe, sheave and chute. Utility
details belong to the business: a roof tank for the waterworks, twin stacks for
the steam laundry, and a physical barber pole at the barber's entrance.

Names are secondary, mounted on simple rectangular signboards. There are no
universal circular medallions. Facade openings follow the building's function:
barred jail windows, church arches, barn sliding doors, civic pilasters and
larger shopfront glazing. Collision, mission anchors and existing courtyard
footprints are unchanged by this correction.

## Reviewed native captures

These are complete native p5 1.9.0 game frames with advanced lighting:

- [Church and neighboring livery](previews/frontier-church-restored.png)
- [Copper Spur saloon](previews/frontier-saloon-restored.png)
- [Stage depot and church street](previews/frontier-depot-restored.png)

The browser runner now supports fixed-camera views of the church, saloon, bank,
depot, workshop and Sunspur mission. Eight corrected captures across fallback
and advanced lighting report no JavaScript errors, WebGL errors or unbalanced
drawing state. The exact source hashes and scene metadata are recorded in
`frontier-building-identity-results.json`. Short capture timing samples are not
physical-device FPS measurements.

```sh
node tools/check-frontier-building-identity.js
node tools/check-frontier-architecture.js
node tools/check-frontier-town.js
node tools/check-frontier-occlusion.js
node tools/check-frontier-lighting.js
```

All five focused checks pass. The new identity check observes actual drawing
commands to ensure roof grain never fills triangles; it also checks restored
structural families, church colours and cross height, the separate school bell,
mission geometry and removal of the badge renderer.
