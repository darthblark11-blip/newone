# Lighting-disabled figure palette optimization

Baseline: `1c2ccac` on `codex/directional-falls-and-footwork`.

The fallback Level 2 battle profile spent 52.43 of 81.11 ms per frame in
`drawDepthSorted`. Sampling identified `rgbPaintString` as a substantial
JavaScript rendering cost. Its translucent cache lookup constructed and hashed
an RGB/alpha string on every call, including cache hits.

The palette now indexes by the packed RGB number and checks the exact alpha
stored with its CSS string. A different alpha replaces that RGB entry. The
1,024-entry limit, color normalization, CSS values and fallback parsing remain
unchanged. No simulation, geometry, drawing order, resolution or quality setting
was modified. Alternating opacity can cause more cache replacements; that tradeoff
is covered by color tests and the whole-frame comparison below.

## Controlled cloud measurement

Sequential baseline/candidate runs used the existing normal-health Level 2
tower ambush: 80 recruited allies, 100 initial ambushers, native wounds/deaths
and kill-driven reserves, fixed 60 Hz simulation, 40 warm-up frames and 120
measured frames. Both used p5 1.11.11, 540 × 1170 CSS/backing pixels, density
one, advanced lighting disabled and audio disabled for deterministic replay.
The final simulation hashes and every measured frame's actor/effect/load counts
matched. The player retains the benchmark's existing observation-only health
and ammunition refresh.

| Measurement | Baseline | Candidate |
| --- | ---: | ---: |
| Mean draw CPU | 64.11 ms | 60.23 ms |
| Median draw CPU | 61.80 ms | 58.50 ms |
| 95th percentile draw CPU | 80.10 ms | 76.70 ms |
| Mean depth-sorted rendering CPU | 36.76 ms | 33.70 ms |
| Mean frame interval | 115.04 ms | 108.89 ms |
| 95th percentile frame interval | 141.90 ms | 135.90 ms |

This single controlled pair measured 6.1% less average draw CPU and 5.3%
shorter average frame intervals. Chromium used Vulkan SwiftShader, a software
renderer, rather than a physical GPU. These numbers do not establish FPS on a
Samsung Galaxy S25. The target-device objective remains unverified.

Initial native-loop/audio runs finished with different battle states and
showed no frame-interval gain; their CPU timings were also highly variable.
They are retained in the results as exploratory observations, not used as an
identical-scene performance comparison. The controlled replay is the evidence
for keeping the change. Hardware/native-loop performance needs device testing.

## Validation and reproduction

- Mechanics source lock: 218 functions, 33 methods/accessors, six constructors
  and 50 tuning tables/constants match the established mechanics baseline.
- Color parsing/state: 14,773 cases, including alternate modes, mutable arrays
  and colors, bounded storage and repeated opaque/translucent paints sharing RGB.
- Exact firearm pixels and painter/gameplay state: all eight ordinary/fallback
  modes pass against `1c2ccac`. The allocation assertion now also accepts a
  baseline that already performs zero native p5.Color allocations.
- Full native-combat replay against `1c2ccac`: both fallback and advanced
  lighting pass 160 frame-by-frame full-state comparisons and 120 measured
  pixel-hash comparisons each, with no browser errors or frame faults.

Install/reuse Playwright and p5 outside the repository. For each source, run
the same command sequentially, changing only `GAME_JS` and `BATTLE_OUT`:

```sh
mkdir -p work
git show 1c2ccac:game.js > work/palette-baseline.js
VIS_DEPS=/path/to/dependencies GAME_JS=work/palette-baseline.js \
  BATTLE_DRIVER=replay BATTLE_AUDIO=off BATTLE_LIGHTING=fallback \
  BATTLE_WARM=40 BATTLE_FRAMES=120 BATTLE_OUT=work/palette-baseline.json \
  node tools/profile-nm0-combat.js
VIS_DEPS=/path/to/dependencies \
  BATTLE_DRIVER=replay BATTLE_AUDIO=off BATTLE_COMPARE=work/palette-baseline.js \
  BATTLE_LIGHTING=fallback,advanced BATTLE_PIXELS=1 \
  BATTLE_WARM=40 BATTLE_FRAMES=120 BATTLE_OUT=work/palette-parity.json \
  node tools/profile-nm0-combat.js
```

Run clean timings without pixel/state instrumentation. The adjacent
`fallback-palette-performance-results.json` records source/p5 hashes, raw timing
samples, hardware identity, exploratory native timings and regression results.
One optimization attempt was retained; no second optimization was attempted.
