# Level 1 city districts

Stick City's streamed neighbourhoods have fourteen deterministic block plans.
The four newest identities appear exclusively outside the whole starting-gate
enclosure and curtain walls: only addresses beyond the protected -4..4 chunk
range can select them. The opening area's existing ten identities and all 235
ordinary building footprints/architectures remain unchanged.

| Plan | Buildings and open space |
| --- | --- |
| Brownstone mews | Copper/terracotta roofs, dormers and a central carriage lane. |
| Office campus | Offset glass atria, service cores and broad cross routes. |
| Courtyard housing | Four separated residential wings around lawn and stone paths. |
| Market streets | Small pitched shops, striped produce stalls and pedestrian lanes. |
| Workshop yards | Sawtooth roofs, north-light glazing and loading lanes. |
| Garden apartments | Staggered planted terraces, pergolas and asymmetric passages. |
| Transit exchange | Ribbed station halls, amber fascia, bus shelter and paved public court. |
| Civic library | Stepped limestone roofs, bronze-framed skylights, reading wings and benches. |
| Conservatory | Planted glasshouses with visible beds, glazing ribs and garden walks. |
| Municipal depot | Solar-panel roofs, vents, loading shutters and marked service bays. |
| Exterior medical campus | White/teal clinic wings, raised equipment podiums and glazed lightwells. |
| Exterior Art Deco hotel | Stepped stone/copper roof crowns and a public arrival court. |
| Exterior freight terminal | Pitched corrugated sheds, ventilators and solid shipping containers. |
| Exterior recreation club | Timber/glass pavilions, an open sports court and upright basketball hoops. |

Industrial blocks select workshop, garden-apartment, depot or freight plans alongside
existing parking lots. A shared address selector keeps industrial parking and
depot ground treatments aligned with their buildings. Parks, canal quays,
construction sites and civic terraces retain their specialized layouts.
The protagonist's house block, five original
entertainment landmarks, Great Gates, curtain walls and two story transmission
towers retain their original positions and footprints.

District-specific street furniture includes produce stalls, wayfinding plaques,
planters, postboxes and benches. The exterior freight containers have projected
walls, door hardware, roof ribs and corner castings. Recreation hoops project
their post, thick backboard, rim and hanging net at individual heights; their
18-by-18 collision footprint matches the visible ground footplate. The painted
playing field is reserved from all later obstacle scatter. New exterior plans
also omit the older generic wreck prop.

Bicycle racks have grounded tyre contacts and independent-height wheels,
frames, saddles, handlebars and upright supports, all using the shared camera
projection. Their 74-by-28 base stays fixed as the camera moves; their lean is
bounded for a small object. Racks are placed only in recessed exterior court
space, inside the usable block and clear of both central pedestrian strips.
They are omitted where no such space exists, including recreation courts and
the starting enclosure. Bikes no longer occupy pavements or carriageways.

Mirrored addresses and material tones vary deterministically. Facade windows
follow the actual ground-to-roof quadrilateral. Rooftop equipment, stepped hotel
crowns, freight gables and pavilion ridges have their own projected height and
connected faces. Rooftop additions remain visual masses.

Court paths, service bays, paving joints, storm drains, utility covers, asphalt
repairs and kerb litter are baked once into chunk terrain. The paths use the
same district selection and mirroring as the buildings, including inside the
authored opening area. Paved rectangles also register their shovel surface
metadata. Selected windows warm after dusk; existing lamps continue to provide
night illumination. The new streets do not add a per-frame ground-detail pass.

## Persistence and scope

Changed streamed districts use the `district:v3:` destruction-key namespace for
an entire block, including furniture and industrial parking replacements. Old
numeric-grid, `district:` and `district:v2:` indexes cannot erase unrelated
replacement structures. Destruction from those previous
layouts does not map onto replacement buildings. Current destruction still
removes only its intended solid and survives revisiting. Civic and untouched
block keys retain their previous behavior.

Collision and depth sorting continue to use ground footprints. Courtyards and
lanes remain navigable, rooftop details add no accessible interiors, and the
existing civic terrace elevation is preserved. No combat values or objectives
change.

## Validation

`node tools/check-city-districts.js` checks 1,000 deterministic chunks, fourteen
streamed plan/roof families, ten unchanged authored identities and a frozen
signature of all 235 starting buildings. It also checks exclusion of the new
plans from the protected enclosure, clear 24-unit pedestrian crossings,
recessed bicycle placement, empty playing fields with two footplate-sized hoop
bases, old/current destruction-key isolation, 56 mirrored ground bakes with
paint/metadata parity, and 168 time/weather/view renders with finite drawing
coordinates.

Render individual streamed plans with real p5/Chromium:

```sh
VIS_DEPS=/path/to/deps VIS_CHROME=/path/to/chrome VW_W=1100 VW_H=1000 node tools/visual-world.js 1 0 0 0.85 district=10
VIS_DEPS=/path/to/deps VIS_CHROME=/path/to/chrome VW_W=1100 VW_H=1000 node tools/visual-world.js 1 0 0 0.85 district=12 night rain
```

Generation, city placement, shovel terrain, projection/depth, rendering and
real-browser frame/control checks pass. Exterior day/night/rain and phone
captures were inspected with native terrain, shadows and depth sorting.
The civic-terrace check currently fails its other-biome elevation assertion on
both this version and the preceding commit; its Level 1 assertions pass before
that failure. No manual combat playthrough or physical-phone performance
measurement was performed. The software-browser frame check exercised the
existing light-rig frame-budget fallback while keeping controls responsive.
