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

After sitting, the head bows forward, the arms drop loose, and the knees bend
as the heels draw inward. Bodies either stay in that relaxed seated pose or
lose balance and tip onto a hip. The side fall rotates articulated joints along
the wall, keeping the back supported; the far limbs, torso, near limbs and
profile of the head retain the actor's clothing and injuries throughout.
The seated end folds farther forward: the chest settles over the lap and the
head hangs below the shoulders, rather than retaining an upright sitting pose.
The outcome and hip are chosen once without consuming the combat random stream.
Corners and open doorways select the supported side or retain the seated pose.
Both outcomes stop animating completely before entering the wall bank.

Wall-supported bodies are clipped against their own building before drawing.
On a visible face, its roof occludes the body; on a hidden face, the whole
extruded silhouette does. Visible feet outside that silhouette remain visible,
and open gateways retain their gaps. The masks share the wall's current camera
projection and are cached per occupied support. Later buildings retain the
ordinary depth order. Seated torso proportions stay fixed as the camera pans;
bounded joint projection keeps the head and sleeves attached at distant angles.

Blood spatters are stored in the current sector's blood bank, attached to wall
geometry rather than floor textures. Each wall paints its own visible face,
with clipping at corners and open gateways. Camera motion uses the same wall
projection as the masonry. Decals survive streamed wall regeneration and sector
travel; restart clears them. Wall marks and seated bodies have bounded storage.
Settled seated bodies use a wall layer because floor stamping would hide them
under the supporting wall again. If the support is removed, the body falls flat.

Verification:

- `node tools/check-corpse-walls.js`
- `node tools/check-corpse-wall-slump.js`
- `node tools/check-wall-blood.js`
- `node tools/check-corpse.js`
- `node tools/check-fatal-wounds.js`
- `node tools/check-sword-deaths.js`
- `node tools/check-depth.js`
- `node tools/check-render.js`
- `VIS_P5=/path/to/p5.min.js node tools/check-corpse-wall-occlusion.js`

For an offline p5/Chromium contact sheet, run
`VIS_DEPS=/path/to/deps VIS_CHROME=/path/to/chromium node tools/visual-corpse-walls.js work`.
`VIS_P5` can point to a local p5.min.js. The preview checks four seated directions
and the native overkill, dash-explosion and melee torso timelines through flight,
contact, hold, slide and flat rest.
