# Corpse contact with walls

Exploded debris, detached arms, shotgun torsos, finisher halves, sword pieces and
flying explosive bodies use swept collision against nearby solids. Small pieces
bounce and lose motion; a fast torso impact holds the body upright briefly,
then slides and rolls it onto the floor. Walkable decks and breached doorways
remain open. Surface walls do not catch bodies below ground.

A humanoid dying with a wall directly behind them slumps into a seated pose.
Its bent legs remain outside the solid, while the upper body uses the wall's
existing height projection. Clothing, head injuries and wounds stay attached.
A body moving away from the wall continues its ordinary directional fall.

Blood spatters are stored in the current sector's blood bank, attached to wall
geometry rather than floor textures. Each wall paints its own visible face,
with clipping at corners and open gateways. Camera motion uses the same wall
projection as the masonry. Decals survive streamed wall regeneration and sector
travel; restart clears them. Wall marks and seated bodies have bounded storage.
Settled seated bodies use a wall layer because floor stamping would hide them
under the supporting wall again. If the support is removed, the body falls flat.

Verification:

- `node tools/check-corpse-walls.js`
- `node tools/check-wall-blood.js`
- `node tools/check-corpse.js`
- `node tools/check-fatal-wounds.js`
- `node tools/check-sword-deaths.js`
- `node tools/check-depth.js`
- `node tools/check-render.js`

For an offline p5/Chromium contact sheet, run
`VIS_DEPS=/path/to/deps VIS_CHROME=/path/to/chromium node tools/visual-corpse-walls.js work`.
`VIS_P5` can point to a local p5.min.js. The preview checks four seated directions
and the native overkill, dash-explosion and melee torso timelines through flight,
contact, hold, slide and flat rest.
