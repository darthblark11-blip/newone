# Editable 3D player

`player.blend` contains the assembled, skinned player, an 18-bone armature,
bone-attached grip/muzzle/equipment sockets, a breathing preview action, cel
materials and hidden outfit/equipment variants. The default character is bald,
with a red shirt, blue trousers and dark boots.

The head has a spherical silhouette with no ears or projecting nose. Small
eye, eyebrow, and mouth marks stay within the sphere surface. The assembled
source uses a uniform head scale calibrated to the standard pistol player's
11-unit head diameter, matching the round head used on fallen bodies.

`player.glb` contains the visible base character, skeleton, animation and sockets.
Optional equipment remains available in the `.blend` and runtime mesh library;
putting every hidden variant in a standard GLB would make them all appear at once.
GLB materials retain the palette and toon metadata. The browser implements the
actual three-band material; Blender's Shader-to-RGB nodes are not a glTF feature.

## Regenerate

From the repository root:

```sh
node tools/extract-player3d-weapons.cjs
blender --background --factory-startup --python tools/blender-player.py
```

The assault rifle, shotgun and particle beam meshes come directly from the
game's authored `drawLongGunSolid` boxes, detail lines, colors and sockets in
`native-weapons.json`. Refresh that source with the extraction command when
the native weapon art changes. Both the grip and muzzle are transformed into
the exported mesh coordinates, retaining the original buttstock and barrel
dimensions instead of estimating them from a second weapon model.

Add `-- --skip-renders` to rebuild models and data without rendering the previews.
Validation runs during export. To validate an existing runtime asset:

```sh
blender --background --factory-startup --python tools/blender-player.py -- --validate-only
```

## Export manual edits

Open `assets/player/player.blend`, edit the assembled character in Edit Mode and
save it. The exporter detects edits on either limb and updates the same semantic
part used by both runtime limbs. If both sides have conflicting shape edits,
export reports the conflict rather than silently discarding one. Edit the lit stop of a material's
cel Color Ramp to change its exported palette color.

```sh
blender --background assets/player/player.blend --python tools/blender-player.py -- --export-existing --skip-renders
python3 tools/build-player3d.py
```

`--export-existing` exports the file already loaded by Blender; it does not rebuild
or overwrite the editable `.blend`. Omit `--skip-renders` for a new three-quarter
preview. Regeneration without `--export-existing` intentionally rebuilds the source.

## Runtime format

`player-mesh.json` has `schemaVersion: 1`, a normalized sRGB `palette`, shared toon
thresholds/bands and a `meshes` dictionary. Each semantic mesh contains flat XYZ
`positions`, outward `normals`, triangle `indices`, a default `material` and
`materialGroups: [{start, count, material}]`. Group offsets and counts address the
index array. Weapon meshes also contain local `grip` and `muzzle` sockets.

Coordinates are +X forward, +Y lateral and +Z up. Limb meshes span X -0.5 to +0.5.
Sleeve profiles follow the native shoulder/elbow/wrist taper: the upper arm has
radial extent 0.5 at the shoulder and 0.45 at the elbow; the forearm has 0.5625
at the elbow and 0.5 at the wrist. Applying the native upper/forearm widths (1:0.8)
makes both sides of the elbow meet at the same diameter. The plain `joint` sphere
fills shoulder and elbow seams at that same native joint size. Head, torso,
pelvis, hand and joint meshes use unit radius. Weapons span X -0.5 to +0.5. The bow includes its real nocked arrow, so its
muzzle is the arrow tip and its width remains proportional when aligned in game.
Severed parts can use `cap` and `torso_cap` meshes for closed cut surfaces.

The default assembled body is 4,080 triangles before its silhouette outline.
