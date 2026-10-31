# Ally regression rollback and rendering follow-up

The allied coordinator from `e8aa30f` was reported slower on the target phone.
It was reverted and pushed in `665b290`, restoring the game source from
`f92e3d1`. The previously helpful hostile firearm coordinator remains active.
No new ally firing limit or targeting cache remains in production.

The earlier allied benchmark changed casualties and reinforcement timing, so
its faster cloud frames were insufficient evidence of a target-device gain.
This follow-up required identical simulation and pixels before accepting
performance measurements.

## Two rejected rendering attempts

1. Reusing constant native CanvasGradient objects for figure solid paints
   avoided repeatedly parsing CSS colors, but changed rasterization pixels.
   The character fixture changed 240,927 channels. An isolated native Canvas
   ellipse also differed at full opacity (417 channels, maximum delta two),
   proving that restricting the technique to opaque paints was not safe.
   The experiment was removed without changing production appearance.
2. Passing numeric figure colors as scalar arguments retained the existing
   CSS paints and exact color math. All 14,773 color cases and eight character
   pixel/state modes passed. A battle replay matched all 160 full-state frames
   and 120 measured picture frames. Clean sequential timings nevertheless
   showed no useful whole-frame improvement, so this change was also removed.

| Clean fixed-input replay | Baseline | Scalar-color experiment |
| --- | ---: | ---: |
| Mean draw CPU | 61.47 ms | 61.53 ms |
| Median draw CPU | 59.80 ms | 59.00 ms |
| 95th percentile draw CPU | 79.00 ms | 83.10 ms |
| Mean frame interval | 110.30 ms | 112.85 ms |
| Mean depth-sorted rendering CPU | 34.43 ms | 33.53 ms |
| Mean entity-update CPU | 8.67 ms | 8.92 ms |

Both clean runs used 80 recruits, 100 initial native Level 2 ambushers,
normal NPC health and the same fixed input/time driver, with 40 warm-up and
120 measured frames. They ended with identical simulation hash `2102066015`:
331 profiler shots, 293 hits, 56 kills and 14 reinforcement callbacks.
The benchmark retains its existing observation-only player health/ammo
refresh. Lighting and audio were disabled; p5 was 1.11.11 at 540 × 1170 pixels,
density one, using Chromium's Vulkan SwiftShader software renderer.

Depth-sorted rendering consumed about 56% of baseline draw CPU; entity updates
about 14%. This points to rendering workload as a larger opportunity than
additional acquisition/firing coordination. It is not a phone GPU profile.

Runtime compatibility also needs verification: the existing native figure
fast paths recognize p5 1.9.4, 1.11.10 and 1.11.11, while other versions use
fallback paths. The actual Spck p5 script URL/version has been requested to
check whether the phone and cloud are exercising the same renderer.

The final retained state passes syntax checking, all 63 hostile-coordinator
checks and the established mechanics source guard. There is no new FPS gain
to claim from this follow-up. Galaxy S25 performance remains unverified beyond
the user's report that the discarded ally change regressed.
