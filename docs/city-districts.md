# Level 1 city districts

Stick City's ordinary opening blocks and its streamed residential/commercial
neighbourhoods share ten deterministic plans. The opening enclosure now includes
all ten identities, and the same plans continue beyond the story walls.

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

Industrial blocks select workshop, garden-apartment or depot plans alongside
existing parking lots. A shared address selector keeps industrial parking and
depot ground treatments aligned with their buildings. Parks, canal quays,
construction sites and civic terraces retain their specialized layouts. The protagonist's house block, five original
entertainment landmarks, Great Gates, curtain walls and two story transmission
towers retain their original positions and footprints.

District-specific street furniture includes bicycle racks with parked bikes,
produce stalls, wayfinding plaques, planters, postboxes and benches. Furniture
uses checked ground footprints and leaves pedestrian crossings clear. Mirrored
addresses and material tones vary deterministically. Facade windows follow the
actual ground-to-roof quadrilateral; depot shutters, library pilasters and transit
fascia follow the same projection. Rooftop additions remain visual masses.

Court paths, service bays, paving joints, storm drains, utility covers, asphalt
repairs and kerb litter are baked once into chunk terrain. The paths use the
same district selection and mirroring as the buildings, including inside the
authored opening area. Paved rectangles also register their shovel surface
metadata. Selected windows warm after dusk; existing lamps continue to provide
night illumination. The new streets do not add a per-frame ground-detail pass.

## Persistence and scope

Changed streamed districts use the `district:v2:` destruction-key namespace for
an entire block, including furniture and industrial parking replacements. Old
numeric-grid and `district:` indexes cannot erase unrelated replacement structures. Destruction from those previous
layouts does not map onto replacement buildings. Current destruction still
removes only its intended solid and survives revisiting. Civic and untouched
block keys retain their previous behavior.

Collision and depth sorting continue to use ground footprints. Courtyards and
lanes remain navigable, rooftop details add no accessible interiors, and the
existing civic terrace elevation is preserved. No combat values or objectives
change.

## Validation

`node tools/check-city-districts.js` checks 1,000 deterministic chunks, ten
plan/roof families, authored home/landmark/gate/tower preservation, clear
24-unit pedestrian crossings, furniture bounds and overlaps, old/current
destruction-key isolation, 40 mirrored ground bakes with paint/metadata parity,
and 120 time/weather/view renders with finite drawing coordinates.

Render individual streamed plans with real p5/Chromium:

```sh
VIS_DEPS=/path/to/deps VIS_CHROME=/path/to/chrome VW_W=1100 VW_H=1000 node tools/visual-world.js 1 0 0 0.85 district=6
VIS_DEPS=/path/to/deps VIS_CHROME=/path/to/chrome VW_W=1100 VW_H=1000 node tools/visual-world.js 1 0 0 0.85 district=8 night rain
```

Population, fortress, save/load and the real-browser frame/control checks pass.
The civic-terrace check currently fails its other-biome elevation assertion on
both this version and the preceding commit; its Level 1 assertions pass before
that failure. No manual combat playthrough or physical-phone performance
measurement was performed. The software-browser frame check exercised the
existing light-rig frame-budget fallback while keeping controls responsive.
