# Directional falls and boxing footwork

Ordinary humanoid corpse falls and punch stuns use a projected two-bone rig. Actual locomotion is frozen before bullet knockback: a moving actor falls along that vector, while a planted actor responds to the incoming shot or punch. The bullet's entry position is captured before knockback too, so body-side reactions and wound holding use the decal that actually landed.

Corpse collapse retains the previous 0.15-per-frame speed, reaching the floor on the seventh simulation frame. The previous 34-frame limb settle and spring rates are restored. Weapon force still affects displacement, but does not slow the collapse. Punch stuns retain their 40-frame buckle and 16-frame contact settle. The torso, head, shoulders, hips and limbs change projection together; signed leg foreshortening tucks the knees underneath the pelvis before the heels extend onto the floor. Ordinary directional falls limit additional torso spin to 0.26 radians. Final joints freeze and existing corpse retirement still stamps the body into the blood bank.

Shotgun and dual-SMG overkill use the pre-refinement animation path: their original orientation, limb drawing, head scale, separation, dismembered pieces and timings. The directional controller is excluded from these reactions. Head appearance follows the actor’s facing relative to the frozen fall vector, for both killed and stunned bodies. A forward fall shows the back of the head and hair; a backward fall rolls the head face-up and exposes skin, closed eyes and the nose. The same rule works in every map direction. Head wounds retain their damaged shapes. A killed, already stunned actor keeps its head side on the first rendered frame, and streamed/saved city residents keep their stun facing and fall direction. Detached hats stay in their original body/world frame, and off-screen corpse stamping uses the same corrected head transform.

Ordinary body-shot deaths can randomly fold the nearer hand over the actual wound. Headshots and every existing overkill type are excluded. Off-center body hits bias the corresponding shoulder and elbow, with a small torso roll during the fall. A lethal hit on a stunned actor continues the already fallen pose. Unarmed civilians no longer produce a phantom dropped pistol.

Every biological projectile kill with a fatal-hit decal emits blood from that decal for 210 simulation ticks (3.5 seconds at 60 Hz), including ordinary body shots. The wound is frozen from the lethal hit, and the emitter follows the decal’s body/head transform, head roll, separation and moving torso pieces. Piece renderers that previously omitted bullet decals now keep the fatal spot on the surviving piece. Robots retain their oil/spark effects. Nonfatal or stale wounds do not start a death stream.

The spray uses one pooled droplet every two ticks, a narrow cone and a gradual pressure reduction. Its own deterministic sequence does not consume the game’s random draws, so added spray does not alter the earlier overkill motion or art. The existing special headshot and gore effects remain. Pauses freeze the timer; killcam slows it with the simulation. Off-screen bodies finish the timer without particles. Active sprays are protected from pile culling, then the body stamps normally. Leaving a biome retires the body and stops its transient emitter.

Death selectors, damage thresholds, headshot cycles, close-range overkill cycles, gib pieces, death sound triggers, kill accounting and civilian stun durations are retained. This pass changes animation, impact metadata and wound effects. It does not introduce new death types or a general physics engine.

The orthodox guard uses a compact left lead/right rear stance with less resting hip and torso rotation. Forward, backward and lateral movement alternate planted steps and lifted feet without crossing. The lead steps into a jab; the rear heel lifts and pivots into a cross, with the hips following the shoulders. The existing 180-frame guard hold after the completed punch remains.

## Verification

`node tools/check-falls-and-footwork.js` exercises actual bullet hits as well as the shared rig: opposed movement/force, planted reactions, the original corpse speed, frozen settled state, wall collision, pre-knockback metadata, pistol/rifle/shotgun/dual-SMG headshot cycles, close shotgun and dual-SMG overkill exclusion, distant ordinary heavy-weapon deaths, random wound holding, downed death continuity, player/NPC motion capture, compact guard, uncrossed forward/back/lateral steps, heel pivot and finite balanced drawing.

`tools/check-fall-corrections.js` verifies transformed forward/back head drawing in all four cardinal directions, unchanged body direction, long hair, detached hat position, balanced transforms, and graphics-target drawing. With the pre-refinement game supplied, 84 controlled shotgun/dual-SMG overkill samples match its animation state and transformed vector drawing exactly.

`node tools/check-fatal-wounds.js` exercises actual pistol, SMG, rifle, shotgun and dual-SMG kills; fatal/nonfatal/stale wound metadata; 145 painted-decal origin samples including a rolling head and moving/separating pieces; face-up/face-down heads on deaths and slow punch stuns; death while already down; the exact 210-tick cutoff; pause, off-screen, stack and travel retirement; recycled particles; and unchanged heavy overkill state and global random sequences. The city-people check also verifies backward-stun orientation after serialization and streaming.

The update passes the city people and directional-fall checks, plus character 71/71, corpse 87/87, save/load 33/33, depth 95/95, lighting 112/112, render 179/179, ballistics 17/17, damage feedback 25/25 and robot 38/38 regressions. The original p5/Chromium frame run passed 12/12; it was not repeated for this update because that browser/dependency bundle is unavailable in the resumed workspace. The current preview calls the real `Corpse.show()` and update controllers against a Canvas drawing target; it does not duplicate the game geometry. Mobile hardware performance and a manual full combat playthrough have not been measured.

```
git show a9f6db7e7a4aa4d14e31e0c2e5765edcbdc14dee:game.js > /tmp/pre-directional-game.js
FALL_LEGACY_GAME=/tmp/pre-directional-game.js node tools/check-fall-corrections.js
node tools/check-fatal-wounds.js
node tools/visual-fatal-wounds.js animate
```

The current preview calls actual corpse/stun painters, fall controllers and blood particles for forward/back deaths and stuns, a second map direction, a fatal head wound and the restored heavy overkill cases. It runs 4.5 seconds so the 3.5-second spray cutoff and final pose are visible. The earlier correction preview remains available for the restored overkill timing.

![Forward/back heads and fatal-wound spray](previews/fatal-wounds.gif)

Still preview: [fatal-wounds.png](previews/fatal-wounds.png).
