# Collision-based cover

Walk into a solid wall or waist-high object to take cover. Releasing movement
keeps the character against that face. Moving away releases cover immediately;
movement and collision remain in charge of the root throughout. Movement along
the face remains free. No button, rail, snap, or camera change is involved.

High walls use a back-to-wall posture. Aiming past a nearby open end moves the
upper torso, head, arms and weapon around that end while the hips and legs stay
planted. The shirt keeps its original proportions: the torso hinges at the waist,
with a short, bounded head-and-shoulder lean instead of a stretched connection.
The head, shoulders and weapon turn together with the aim. Approaching an open
end uses a comfortable activation region, including a short preparatory lean
before the entire weapon has cleared. The head and weapon paths determine the
available lean, including both dual SMGs. A sealed corner or an opening beyond the actor's reach
produces no peek. Feet remain inside the wall's end while taking cover; walking
farther around it naturally ends cover. Aiming into open space away from the
wall can fire without an edge lean.

Crates, low barriers, benches, parked cars and other waist-high solids use low
cover. Contact crouches automatically. Raw aiming raises the character to fire;
releasing aim starts ducking immediately, independently of the normal brief
weapon aim hold. The chosen manual stance is remembered and restored on exit.
An explicit stance action takes priority over automatic cover. Saves record the
selected stance rather than a temporary low-cover crouch.

Enemies and allies detect the head or torso that is actually exposed by a wall
peek or a low-cover pop-up; ducking or retracting conceals it again.

Cover protection uses actual intervening solid geometry. Head and upper-body
shot contacts follow their posed positions during a standing peek; leg contacts
stay at the planted root. High walls block every shot height. Low objects block
leg-height rounds and protect lowered bodies, including manually crouched actors
that did not acquire automatic cover. Standing upper-body shots can pass above
low objects. Player fire input always produces the normal shot, recoil, sound and cooldown.
An obstructing wall absorbs the round through the normal impact path instead of
cancelling the weapon. The initial body-to-muzzle segment is also checked, so
placing a barrel beyond a thin wall cannot bypass it. Projectiles keep
their launch height after a shooter ducks back down. Cover grants no invulnerability;
shots from an unprotected side, explosions and melee retain their normal rules.

Armed humanoid enemies and allies share the same contact, pose, exposure and
projectile rules. Their combat AI considers nearby real cover on a staggered
schedule, moves to an available face or open end, and alternates exposure with
protected pauses. Dedicated creature and occult navigation remains separate.
World collision rectangles are reused by movement and cover, including opened
gate wings. Destroyed or removed objects cease to provide cover. Menus pause
cover interpolation and drawing does not advance it.

Focused checks:

- `tools/check-cover-controls.js`: contact, free movement, release, manual
  priority, raw aim, pause and save behavior.
- `tools/check-cover-geometry.js`: material classification, exact faces, valid
  ends, blocked corners, gates and cached geometry.
- `tools/check-cover-projectiles.js`: actual pooled bullets, height, launch
  clearance, exposed anatomy and physical occlusion.
- `tools/check-cover-render.js`: planted legs, upper-body projection, gun and
  support mounts, and painter balance.
- `tools/check-cover-ai.js`: shared enemy behavior and bounded cover decisions.
- `tools/check-cover-player-fire.js`: uninterrupted player firing, native wall
  impacts and pooled launch-state reset.
- `tools/check-cover-fire-arc.js`: full outward aim arc, both tangent shots,
  bounded peeks and unchanged wall occlusion.
- `tools/check-cover-sight.js`: visible upper-body detection and retraction.
- `tools/visual-collision-cover.js`: native cover gallery and rendered barrel
  alignment with actual pooled shots.
