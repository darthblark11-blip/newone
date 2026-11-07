# Firearm body overkill

Close shotgun body kills retain the three-outcome rotation (IDs 2, 7 and 10).
Close dual-SMG body kills share outcome 10. Damage, ranges, kill credit and
headshot selection are unchanged. Ordinary SMG body kills remain ordinary falls.

- **Waist slice (2):** a randomized oblique cut divides the clothed torso from
  the lower body. The upper body keeps its head and arms, lifts briefly along
  the shot direction, lands and slides to a stop. Small cloth, bone and flesh
  fragments share the explosion piece solver. Both sides retain their cut faces.
- **Whole-body fall (7):** the current projected humanoid rig supplies the torso,
  head and jointed limbs, including an already injured actor's pose. It follows
  the normal movement/impact direction rule and retains its gradual floor pool.
- **Torso/arm breakup (10):** shotgun and dual SMGs share a proportionate torso,
  head, separately jointed arms and a lower body with both legs. Detached pieces
  travel with the impact instead of using the old reversed oval/rectangle art.

The two dismemberment modes use `projectFallRig` at the normal corpse scale.
Wounds, clothing and the head remain attached to their actual moving pieces.
Cut jets run for **180 active simulation ticks (three seconds at 60 Hz)**,
including after the pieces land. The old 210-tick wound emitter is replaced for
these modes so it cannot prolong or duplicate their spray. Part motion freezes
after the bounded ballistic/slide interval; drawing never advances physics.

The existing blast lifecycle supplies floor shadows, airborne height, bounded
gibs, particle limits, dynamic visibility bounds and corpse-bank stamping.
Offscreen simulation advances the same motion without emitting particles;
travel finishes and stamps the final pose. Pausing freezes the simulation.
An active whole-body fall or bleed cannot be discarded by corpse-stack culling.

These modes apply to humanoid shotgun/dual-SMG body deaths. Explosion deaths,
firearm headshot variants, the red-orb hybrid, gator and other nonhumans retain
their own selection and anatomy.

Focused verification:

```sh
node tools/check-gun-overkill.js
node tools/check-shotgun-face-down.js
node tools/check-nm0-corpse-direction.js
node tools/check-fatal-wounds.js
node tools/check-explosion-deaths.js
node tools/visual-gun-overkill.js
```
