// Quayside paving is baked into the existing chunk texture. The channel and
// coping paint afterwards, from the same meander/taper, and the bridge streets
// stay outside this strip. No world RNG, collision or per-frame work is added.
function bakeCityQuayDetails(g, ox, oy, cx, cy, palette) {
  if (!g || !cityHasCanal(1, cy) || chunkInAuthoredCore(cx, cy)) return;
  const walk = palette && palette.walk || [162, 166, 172];
  const x0 = ox + 165, x1 = ox + CHUNK_W - 165;
  const y0 = oy + 165, y1 = oy + CHUNK_W - 165;
  const stone = [walk[0] * .65 + 171 * .35, walk[1] * .65 + 160 * .35,
    walk[2] * .65 + 139 * .35];
  const hash = (x, salt) => {
    let h = Math.imul((x | 0) ^ Math.imul(cy, 31337) ^ salt, 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const edge = x => {
    const taper = coreTaperX(cx, cy, x);
    return { y: cityCanalY(1, cy, x),
      d: (cityCanalHalf(1, cy, x) + CITY_QUAY) * taper, taper };
  };
  let stones = 0, drains = 0;
  // Three staggered courses occupy the existing 36-unit pedestrian gap
  // between the coping and the terrace fronts, rather than tiling the yard.
  g.noStroke();
  for (const side of [-1, 1]) {
    for (let row = 0; row < 3; row++) {
      const step = 46, offset = row % 2 ? step * .5 : 0;
      const first = Math.floor((x0 - offset) / step) * step + offset;
      for (let x = first; x < x1; x += step) {
        const a = Math.max(x0, x + 1), b = Math.min(x1, x + step - 1);
        if (b - a < 4) continue;
        const left = edge(a), right = edge(b);
        if (left.taper < .4 || right.taper < .4) continue;
        const inner = 3 + row * 10.3, outer = inner + 9.1;
        const ay = left.y + side * (left.d + inner), by = right.y + side * (right.d + inner);
        const cy1 = right.y + side * (right.d + outer), dy = left.y + side * (left.d + outer);
        if (Math.min(ay, by, cy1, dy) < y0 || Math.max(ay, by, cy1, dy) > y1) continue;
        const tone = (hash(Math.floor(x / step), row * 97 + side * 463) - .5) * 13;
        g.fill(stone[0] + tone, stone[1] + tone, stone[2] + tone, row === 0 ? 222 : 187);
        g.quad(a, ay, b, by, b, cy1, a, dy);
        // Small lit arrises separate the worn stone from the older grey yard.
        g.stroke(stone[0] + 23, stone[1] + 23, stone[2] + 20, 75);
        g.strokeWeight(.9);
        g.line(a + 1, ay, b - 1, by);
        g.noStroke();
        stones++;
      }
    }
    // Cast-iron drains cross the stone courses at a quiet, fixed cadence.
    // They stay entirely within the existing walk and create no new obstacles.
    for (let k = 0; k < 3; k++) {
      const x = ox + 265 + k * 300 + (hash(k, 991 + side) - .5) * 28;
      const left = edge(x - 9), right = edge(x + 9);
      if (left.taper < .4 || right.taper < .4) continue;
      const q = (inner, outer) => {
        const a = left.y + side * (left.d + inner), b = right.y + side * (right.d + inner);
        const c = right.y + side * (right.d + outer), d = left.y + side * (left.d + outer);
        if (Math.min(a, b, c, d) < y0 || Math.max(a, b, c, d) > y1) return false;
        g.quad(x - 9, a, x + 9, b, x + 9, c, x - 9, d); return true;
      };
      g.fill(72, 79, 77); if (!q(6, 28)) continue;
      g.fill(35, 43, 43); q(8, 26);
      g.fill(118, 124, 112);
      for (const offset of [10, 15, 20, 25]) q(offset, offset + 1.1);
      drains++;
    }
  }
  g.noStroke();
  return { stones, drains };
}
