"""Append the seven Dry Gulch / Frontier Townsfolk 3D models to assets/player/player.blend.

Run from the repository root:
    blender --background assets/player/player.blend --python tools/blender-frontier-townsfolk.py
    python3 tools/build-player3d.py

Proportions are calibrated directly against PlayerRig's base torso/head and cowboy_hat:
  - Torso garments use vest/coat shoulder scale (0.205, 0.285, 0.30) so shoulders
    visually support the headwear from the overhead camera.
  - Headwear sits on the upper crown (not bisecting the face), uses oval (rx < ry)
    brims balanced to shoulder width, and includes a recessed front-to-back crown
    crease so the three-band world-lit shader reads cleanly in motion.
"""

import json
import math
import pathlib
import runpy
import tempfile

import bpy
from mathutils.bvhtree import BVHTree


ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSET_DIR = ROOT / 'assets' / 'player'
BLEND_PATH = ASSET_DIR / 'player.blend'
RUNTIME_PATH = ASSET_DIR / 'player-mesh.json'
MANIFEST_PATH = ASSET_DIR / 'manifest.json'

base = runpy.run_path(str(ROOT / 'tools' / 'blender-player.py'))
Geometry = base['Geometry']

rig = bpy.data.objects['PlayerRig']
library = bpy.data.collections['Runtime mesh library']
base['load_native_weapons']()

for mat in bpy.data.materials:
    base['MATERIALS'][mat.name] = mat
for obj in library.objects:
    base['LIBRARY'][obj.name] = obj
for obj in bpy.data.objects:
    if obj.type == 'MESH' and obj.parent == rig:
        base['SOURCE'][obj.name] = obj

runtime = json.loads(RUNTIME_PATH.read_text(encoding='utf-8'))
manifest = json.loads(MANIFEST_PATH.read_text(encoding='utf-8'))

body = base['LIBRARY']['torso'].data
stations = [tuple(v.co) for v in body.vertices]
heights = [stations[i][2] for i in range(0, len(stations), 16)]
roof = BVHTree.FromPolygons(stations, [list(p.vertices) for p in body.polygons])

TORSO_GARMENT_SCALE = (0.205, 0.285, 0.30)
COAT_GARMENT_SCALE = (0.210, 0.292, 0.305)
HEAD_SCALE = (0.15, 0.15, 0.15)


def _ring_point(ring_idx, station):
    s = station % 16.0
    i0 = int(math.floor(s)) % 16
    i1 = (i0 + 1) % 16
    t = s - math.floor(s)
    p0 = stations[ring_idx * 16 + i0]
    p1 = stations[ring_idx * 16 + i1]
    return (
        p0[0] + (p1[0] - p0[0]) * t,
        p0[1] + (p1[1] - p0[1]) * t,
        p0[2] + (p1[2] - p0[2]) * t,
    )


def surface(station, height, lift=0.03):
    h = max(heights[0], min(heights[-1], height))
    r0 = 0
    for idx in range(len(heights) - 1):
        if heights[idx] <= h <= heights[idx + 1]:
            r0 = idx
            break
        if h > heights[idx + 1]:
            r0 = idx + 1
    r1 = min(r0 + 1, len(heights) - 1)
    span = heights[r1] - heights[r0]
    tz = 0.0 if abs(span) < 1e-6 else (h - heights[r0]) / span
    a = _ring_point(r0, station)
    b = _ring_point(r1, station)
    x = a[0] + (b[0] - a[0]) * tz
    y = a[1] + (b[1] - a[1]) * tz
    z = a[2] + (b[2] - a[2]) * tz
    rad = math.hypot(x, y)
    scale = (rad + lift) / rad if rad > 1e-5 else 1.0
    return (x * scale, y * scale, z + lift * 0.6)


def cuts(lo, hi, breaks):
    return [lo, *(v for v in breaks if lo < v < hi), hi]


def grid(g, rows, material):
    n_rows = len(rows)
    n_cols = len(rows[0])
    verts = [v for row in rows for v in row]
    faces = []
    for r in range(n_rows - 1):
        for c in range(n_cols - 1):
            a = r * n_cols + c
            b = a + 1
            d = (r + 1) * n_cols + c
            e = d + 1
            faces.append((a, b, e, d))
    g.add(verts, faces, material)


def patch(g, left, right, bottom, top, material, lift=0.03):
    xs = cuts(left, right, range(1, 16))
    zs = cuts(bottom, top, heights)
    rows = [[surface(x, z, lift) for x in xs] for z in zs]
    grid(g, rows, material)


def crown(g, left, right, inner_radius, material, lift=0.03):
    xs = cuts(left, right, range(1, 16))
    outer = [surface(x, heights[-1], lift) for x in xs]
    inner = [(p[0] * inner_radius, p[1] * inner_radius, p[2] + 0.015) for p in outer]
    grid(g, [outer, inner], material)


def shoulder_strap(g, y_center, half_w, material, lift=0.055):
    xs = [-0.55, -0.35, -0.15, 0.05, 0.25, 0.45, 0.62]
    ys = [y_center - half_w, y_center + half_w]
    rows = []
    for x in xs:
        row = []
        for y in ys:
            hit, _, _, _ = roof.ray_cast((x, y, 2.0), (0.0, 0.0, -1.0))
            if hit is not None:
                row.append((hit.x, hit.y, hit.z + lift))
            else:
                row.append((x, y, heights[-1] + lift))
        rows.append(row)
    grid(g, rows, material)


def add_box(g, cx, cy, cz, sx, sy, sz, material):
    hx, hy, hz = sx * 0.5, sy * 0.5, sz * 0.5
    verts = [
        (cx - hx, cy - hy, cz - hz),
        (cx + hx, cy - hy, cz - hz),
        (cx + hx, cy + hy, cz - hz),
        (cx - hx, cy + hy, cz - hz),
        (cx - hx, cy - hy, cz + hz),
        (cx + hx, cy - hy, cz + hz),
        (cx + hx, cy + hy, cz + hz),
        (cx - hx, cy + hy, cz + hz),
    ]
    faces = [
        (0, 3, 2, 1),
        (4, 5, 6, 7),
        (0, 1, 5, 4),
        (2, 3, 7, 6),
        (1, 2, 6, 5),
        (3, 0, 4, 7),
    ]
    g.add(verts, faces, material)


def add_creased_crown(g, z_base, z_top, rx_base, ry_base, rx_top, ry_top, crease_depth, sides, material, x_off=0.0):
    rings = [
        (z_base, rx_base, ry_base, 0.0),
        (z_base + (z_top - z_base) * 0.55, rx_base * 0.94, ry_base * 0.92, crease_depth * 0.15),
        (z_top, rx_top, ry_top, crease_depth),
    ]
    verts = []
    for z, rx, ry, dip in rings:
        for i in range(sides):
            ang = (2.0 * math.pi * i) / sides
            ca, sa = math.cos(ang), math.sin(ang)
            ridge_dip = dip * (1.0 - abs(sa)) ** 1.6
            verts.append((x_off + ca * rx, sa * ry, z - ridge_dip))
    faces = []
    for r in range(len(rings) - 1):
        b0, b1 = r * sides, (r + 1) * sides
        for i in range(sides):
            ni = (i + 1) % sides
            faces.append((b0 + i, b0 + ni, b1 + ni, b1 + i))
    top_base = (len(rings) - 1) * sides
    center_idx = len(verts)
    verts.append((x_off, 0.0, z_top - crease_depth * 1.45))
    for i in range(sides):
        ni = (i + 1) % sides
        faces.append((top_base + i, top_base + ni, center_idx))
    g.add(verts, faces, material)


def add_lathe(g, rings, sides, material, cap_top=True, cap_bottom=False, x_scale=1.0, y_scale=1.0, x_off=0.0):
    verts = []
    for radius, z in rings:
        for i in range(sides):
            ang = (2.0 * math.pi * i) / sides
            verts.append((
                x_off + math.cos(ang) * radius * x_scale,
                math.sin(ang) * radius * y_scale,
                z,
            ))
    faces = []
    for r in range(len(rings) - 1):
        base0 = r * sides
        base1 = (r + 1) * sides
        for i in range(sides):
            ni = (i + 1) % sides
            faces.append((base0 + i, base0 + ni, base1 + ni, base1 + i))
    if cap_top and rings[-1][0] > 1e-4:
        top_center = len(verts)
        verts.append((x_off, 0.0, rings[-1][1]))
        base_top = (len(rings) - 1) * sides
        for i in range(sides):
            ni = (i + 1) % sides
            faces.append((base_top + i, base_top + ni, top_center))
    if cap_bottom and rings[0][0] > 1e-4:
        bot_center = len(verts)
        verts.append((x_off, 0.0, rings[0][1]))
        for i in range(sides):
            ni = (i + 1) % sides
            faces.append((ni, i, bot_center))
    g.add(verts, faces, material)


def frontier_overalls():
    g = Geometry()
    patch(g, 0.0, 16.0, 0.35, 1.0, 'shirt', lift=0.024)
    crown(g, 0.0, 16.0, 0.52, 'shirt', lift=0.028)
    patch(g, 0.0, 16.0, -0.92, -0.15, 'pants', lift=0.036)
    patch(g, 0.0, 2.4, -0.15, 0.58, 'pants', lift=0.044)
    patch(g, 13.6, 16.0, -0.15, 0.58, 'pants', lift=0.044)
    patch(g, 6.0, 10.0, -0.15, 0.54, 'pants', lift=0.040)
    shoulder_strap(g, -0.45, 0.15, 'pants', lift=0.058)
    shoulder_strap(g, 0.45, 0.15, 'pants', lift=0.058)
    for s in (1.35, 14.65):
        px, py, pz = surface(s, 0.50, lift=0.062)
        add_box(g, px, py, pz, 0.075, 0.075, 0.075, 'gold')
    return g


def frontier_farmer_dress():
    g = Geometry()
    patch(g, 0.0, 16.0, -1.0, 0.98, 'shirt', lift=0.030)
    crown(g, 0.0, 16.0, 0.54, 'shirt', lift=0.036)
    patch(g, 0.0, 16.0, -0.46, -0.30, 'white', lift=0.048)
    crown(g, 0.0, 16.0, 0.44, 'white', lift=0.044)
    return g


def frontier_cowboy_vest():
    g = Geometry()
    patch(g, 1.30, 14.70, -0.72, 0.98, 'armor', lift=0.040)
    crown(g, 1.30, 14.70, 0.54, 'armor', lift=0.044)
    patch(g, 0.0, 1.9, 0.46, 0.92, 'khaki', lift=0.066)
    patch(g, 14.1, 16.0, 0.46, 0.92, 'khaki', lift=0.066)
    crown(g, 0.0, 2.3, 0.46, 'khaki', lift=0.068)
    crown(g, 13.7, 16.0, 0.46, 'khaki', lift=0.068)
    patch(g, 0.0, 16.0, -0.80, -0.58, 'wood', lift=0.060)
    patch(g, 0.0, 0.90, -0.81, -0.57, 'gold', lift=0.076)
    patch(g, 15.10, 16.0, -0.81, -0.57, 'gold', lift=0.076)
    hx, hy, hz = surface(12.2, -0.74, lift=0.10)
    add_box(g, hx, hy, hz, 0.24, 0.17, 0.36, 'wood')
    return g


def frontier_cop_coat():
    g = Geometry()
    patch(g, 0.0, 16.0, -1.0, 1.0, 'shirt', lift=0.036)
    crown(g, 0.0, 16.0, 0.50, 'shirt', lift=0.042)
    patch(g, 0.0, 0.42, -0.86, 0.84, 'ink', lift=0.048)
    patch(g, 15.58, 16.0, -0.86, 0.84, 'ink', lift=0.048)
    for z_btn in (-0.30, 0.08, 0.44):
        bx, by, bz = surface(0.0, z_btn, lift=0.062)
        add_box(g, bx, by, bz, 0.065, 0.065, 0.065, 'steel')
    sx, sy, sz = surface(1.9, 0.46, lift=0.074)
    add_box(g, sx, sy, sz, 0.13, 0.17, 0.17, 'gold')
    shoulder_strap(g, -0.44, 0.12, 'shirt', lift=0.054)
    shoulder_strap(g, 0.44, 0.12, 'shirt', lift=0.054)
    patch(g, 0.0, 16.0, -0.78, -0.56, 'wood', lift=0.060)
    for st in (1.2, 2.6, 13.4, 14.8):
        lx, ly, lz = surface(st, -0.67, lift=0.076)
        add_box(g, lx, ly, lz, 0.065, 0.065, 0.17, 'gold')
    return g


def frontier_villager_apron():
    g = Geometry()
    patch(g, 0.0, 16.0, 0.30, 1.0, 'shirt', lift=0.024)
    crown(g, 0.0, 16.0, 0.52, 'shirt', lift=0.028)
    patch(g, 0.0, 3.6, -0.92, 0.20, 'khaki', lift=0.042)
    patch(g, 12.4, 16.0, -0.92, 0.20, 'khaki', lift=0.042)
    patch(g, 0.0, 16.0, -0.34, -0.22, 'khaki', lift=0.048)
    shoulder_strap(g, -0.42, 0.12, 'wood', lift=0.054)
    shoulder_strap(g, 0.42, 0.12, 'wood', lift=0.054)
    return g


def frontier_pinafore():
    g = Geometry()
    patch(g, 0.0, 16.0, -0.96, 0.96, 'shirt', lift=0.030)
    crown(g, 0.0, 16.0, 0.54, 'shirt', lift=0.036)
    patch(g, 0.0, 3.3, -0.90, 0.38, 'white', lift=0.046)
    patch(g, 12.7, 16.0, -0.90, 0.38, 'white', lift=0.046)
    patch(g, 0.0, 16.0, -0.44, -0.30, 'white', lift=0.048)
    crown(g, 0.0, 16.0, 0.44, 'white', lift=0.052)
    return g


def frontier_straw_hat():
    g = Geometry()
    add_lathe(
        g,
        [(0.84, 0.68), (1.42, 0.66), (1.46, 0.74), (1.14, 0.80), (0.86, 0.80)],
        sides=20, material='gold', cap_top=False, x_scale=0.95, y_scale=1.04,
    )
    add_lathe(
        g,
        [(0.88, 0.78), (0.87, 0.92)],
        sides=16, material='wood', cap_top=False, x_scale=0.94, y_scale=1.03,
    )
    add_creased_crown(
        g, z_base=0.80, z_top=1.44,
        rx_base=0.84, ry_base=0.92,
        rx_top=0.60, ry_top=0.72,
        crease_depth=0.14, sides=16, material='khaki',
    )
    return g


def frontier_cop_hat():
    g = Geometry()
    add_lathe(
        g,
        [(0.84, 0.70), (1.40, 0.69), (1.42, 0.77), (1.12, 0.82), (0.86, 0.82)],
        sides=20, material='ink', cap_top=False, x_scale=0.96, y_scale=1.04,
    )
    add_lathe(
        g,
        [(0.88, 0.80), (0.87, 0.94)],
        sides=16, material='gold', cap_top=False, x_scale=0.95, y_scale=1.03,
    )
    add_creased_crown(
        g, z_base=0.82, z_top=1.48,
        rx_base=0.84, ry_base=0.92,
        rx_top=0.56, ry_top=0.68,
        crease_depth=0.15, sides=16, material='armor',
    )
    return g


def frontier_flat_cap():
    g = Geometry()
    add_lathe(
        g,
        [(0.92, 0.56), (1.04, 0.74), (0.96, 0.98), (0.62, 1.12)],
        sides=16, material='armor', cap_top=True, x_scale=1.06, y_scale=1.00,
    )
    bill_verts = [
        (0.56, -0.62, 0.54), (1.24, -0.38, 0.48), (1.32, 0.00, 0.46), (1.24, 0.38, 0.48), (0.56, 0.62, 0.54),
        (0.56, -0.62, 0.62), (1.24, -0.38, 0.55), (1.32, 0.00, 0.53), (1.24, 0.38, 0.55), (0.56, 0.62, 0.62),
    ]
    bill_faces = [(0, 1, 6, 5), (1, 2, 7, 6), (2, 3, 8, 7), (3, 4, 9, 8), (5, 6, 7, 8, 9), (4, 3, 2, 1, 0)]
    g.add(bill_verts, bill_faces, 'wood')
    return g


def frontier_bonnet():
    g = Geometry()
    add_lathe(
        g,
        [(0.96, 0.30), (1.08, 0.62), (0.98, 0.96), (0.58, 1.14)],
        sides=16, material='white', cap_top=True, x_scale=1.00, y_scale=1.02, x_off=-0.14,
    )
    add_lathe(
        g,
        [(0.96, 0.46), (1.16, 0.58), (1.10, 0.90), (0.78, 1.10)],
        sides=16, material='khaki', cap_top=True, x_scale=0.84, y_scale=1.06, x_off=0.18,
    )
    add_box(g, 0.02, 0.94, 0.34, 0.42, 0.12, 0.14, 'shirt')
    return g


def frontier_ponytail():
    g = Geometry()
    add_lathe(
        g,
        [(0.98, 0.18), (1.05, 0.54), (0.94, 0.88), (0.52, 1.06)],
        sides=14, material='wood', cap_top=True, x_scale=0.96, y_scale=1.01, x_off=-0.10,
    )
    tail_rings = [
        ((-0.88, 0.0, 0.14), 0.28, 0.25),
        ((-1.20, 0.0, 0.02), 0.30, 0.26),
        ((-1.46, 0.0, -0.14), 0.20, 0.18),
        ((-1.62, 0.0, -0.28), 0.08, 0.07),
    ]
    sides = 8
    verts = [
        (cx, cy + math.cos(2.0 * math.pi * i / sides) * ry, cz + math.sin(2.0 * math.pi * i / sides) * rz)
        for (cx, cy, cz), ry, rz in tail_rings
        for i in range(sides)
    ]
    faces = [
        (r * sides + i, r * sides + (i + 1) % sides, (r + 1) * sides + (i + 1) % sides, (r + 1) * sides + i)
        for r in range(len(tail_rings) - 1)
        for i in range(sides)
    ]
    g.add(verts, faces, 'wood')
    return g


def upgraded_cowboy_hat():
    g = Geometry()
    add_lathe(
        g,
        [(1.24, 0.10), (1.70, 0.03), (1.72, -0.04), (1.58, -0.05), (1.22, 0.05)],
        sides=24, material='hat', cap_top=False, x_scale=0.95, y_scale=1.05,
    )
    add_lathe(
        g,
        [(0.90, 0.14), (0.89, 0.29)],
        sides=16, material='wood', cap_top=False, x_scale=0.95, y_scale=1.04,
    )
    add_creased_crown(
        g, z_base=0.10, z_top=0.98,
        rx_base=0.86, ry_base=0.96,
        rx_top=0.58, ry_top=0.73,
        crease_depth=0.16, sides=16, material='hat',
    )
    return g


torso_part = base['SOURCE']['torso']
head_part = base['SOURCE']['head']

frontier_col = bpy.data.collections.get('Frontier townsfolk variants')
if frontier_col is None:
    frontier_col = bpy.data.collections.new('Frontier townsfolk variants')
    bpy.context.scene.collection.children.link(frontier_col)

attachments = {
    'frontier_overalls': (frontier_overalls, tuple(torso_part.location), TORSO_GARMENT_SCALE, 'chest'),
    'frontier_farmer_dress': (frontier_farmer_dress, tuple(torso_part.location), TORSO_GARMENT_SCALE, 'chest'),
    'frontier_cowboy_vest': (frontier_cowboy_vest, tuple(torso_part.location), TORSO_GARMENT_SCALE, 'chest'),
    'frontier_cop_coat': (frontier_cop_coat, tuple(torso_part.location), COAT_GARMENT_SCALE, 'chest'),
    'frontier_villager_apron': (frontier_villager_apron, tuple(torso_part.location), TORSO_GARMENT_SCALE, 'chest'),
    'frontier_pinafore': (frontier_pinafore, tuple(torso_part.location), TORSO_GARMENT_SCALE, 'chest'),
    'frontier_straw_hat': (frontier_straw_hat, tuple(head_part.location), HEAD_SCALE, 'head'),
    'frontier_cop_hat': (frontier_cop_hat, tuple(head_part.location), HEAD_SCALE, 'head'),
    'frontier_flat_cap': (frontier_flat_cap, tuple(head_part.location), HEAD_SCALE, 'head'),
    'frontier_bonnet': (frontier_bonnet, tuple(head_part.location), HEAD_SCALE, 'head'),
    'frontier_ponytail': (frontier_ponytail, tuple(head_part.location), HEAD_SCALE, 'head'),
}

for name, (builder, loc, scl, bone_name) in attachments.items():
    for existing in (bpy.data.objects.get(name), bpy.data.objects.get(f'{name}_source')):
        if existing is not None:
            bpy.data.objects.remove(existing, do_unlink=True)
    lib_obj = base['mesh_object'](name, builder(), library)
    lib_obj.hide_viewport = True
    lib_obj.hide_render = True
    base['LIBRARY'][name] = lib_obj
    src_obj = base['source_part'](f'{name}_source', name, loc, scl, bone_name, frontier_col, visible=False)
    vg = src_obj.vertex_groups.get(bone_name) or src_obj.vertex_groups.new(name=bone_name)
    vg.add(range(len(src_obj.data.vertices)), 1.0, 'REPLACE')
    mod = src_obj.modifiers.get('Player skin') or src_obj.modifiers.new('Player skin', 'ARMATURE')
    mod.object = rig
    src_obj.parent = rig
    base['SOURCE'][src_obj.name] = src_obj

if 'cowboy_hat' in base['LIBRARY']:
    old_hat = base['LIBRARY']['cowboy_hat']
    bpy.data.objects.remove(old_hat, do_unlink=True)
    new_hat = base['mesh_object']('cowboy_hat', upgraded_cowboy_hat(), library)
    new_hat.hide_viewport = True
    new_hat.hide_render = True
    base['LIBRARY']['cowboy_hat'] = new_hat
    hat_src = bpy.data.objects.get('Cowboy hat')
    if hat_src is not None:
        hat_src.data = new_hat.data

base['validate_scene'](rig)
with tempfile.TemporaryDirectory() as _tmp:
    compact = base['export_compact']()

for name in (*attachments.keys(), 'cowboy_hat'):
    if name in compact['meshes']:
        runtime['meshes'][name] = compact['meshes'][name]

base['validate'](runtime)
RUNTIME_PATH.write_text(json.dumps(runtime, separators=(',', ':')), encoding='utf-8')

GLB_EXPORTS = [
    ('FARMER_MALE', 'frontier-farmer-m.glb', ['frontier_overalls_source', 'frontier_straw_hat_source'], {'shirt': [220, 220, 220], 'pants': [40, 100, 200], 'gold': [210, 180, 70], 'khaki': [190, 160, 50]}),
    ('FARMER_FEMALE', 'frontier-farmer-f.glb', ['frontier_farmer_dress_source', 'frontier_ponytail_source'], {'shirt': [245, 245, 245], 'pants': [245, 245, 245], 'white': [232, 228, 220], 'wood': [150, 80, 40]}),
    ('COWBOY', 'frontier-cowboy.glb', ['frontier_cowboy_vest_source'], {'shirt': [158, 122, 84], 'pants': [72, 92, 126], 'armor': [88, 62, 40], 'khaki': [168, 54, 46], 'wood': [64, 44, 28], 'gold': [214, 186, 96]}),
    ('COWGIRL', 'frontier-cowgirl.glb', ['frontier_cowboy_vest_source', 'frontier_ponytail_source'], {'shirt': [196, 156, 118], 'pants': [112, 76, 54], 'armor': [146, 92, 62], 'khaki': [178, 96, 120], 'wood': [122, 74, 38], 'gold': [214, 186, 96]}),
    ('LOCAL_COP', 'frontier-local-cop.glb', ['frontier_cop_coat_source', 'frontier_cop_hat_source'], {'shirt': [74, 78, 92], 'pants': [52, 54, 64], 'armor': [46, 44, 52], 'ink': [34, 32, 40], 'wood': [56, 40, 28], 'gold': [226, 206, 118]}),
    ('VILLAGER_MALE', 'frontier-villager-m.glb', ['frontier_villager_apron_source', 'frontier_flat_cap_source'], {'shirt': [206, 194, 168], 'pants': [96, 84, 66], 'khaki': [160, 148, 126], 'armor': [84, 74, 58], 'wood': [64, 56, 44]}),
    ('VILLAGER_FEMALE', 'frontier-villager-f.glb', ['frontier_pinafore_source', 'frontier_bonnet_source'], {'shirt': [184, 168, 196], 'pants': [184, 168, 196], 'white': [228, 220, 204], 'khaki': [214, 204, 184]}),
]

saved_palette = dict(base['PALETTE'])
for e_type, glb_name, show_parts, pal in GLB_EXPORTS:
    base['PALETTE'].update(pal)
    for pname in show_parts:
        bpy.data.objects[pname].hide_viewport = False
        bpy.data.objects[pname].hide_render = False
    base['export_glb'](rig, glb_name)
    for pname in show_parts:
        bpy.data.objects[pname].hide_viewport = True
        bpy.data.objects[pname].hide_render = True
    base['PALETTE'].clear()
    base['PALETTE'].update(saved_palette)

for mat in list(bpy.data.materials):
    if mat.name.endswith('_gltf') and mat.users == 0:
        bpy.data.materials.remove(mat)

bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

manifest['meshCount'] = len(runtime['meshes'])
manifest['frontierVariants'] = [
    {'type': e_type, 'portable': glb_name, 'parts': [p.replace('_source', '') for p in show_parts], 'builder': 'tools/blender-frontier-townsfolk.py'}
    for e_type, glb_name, show_parts, _ in GLB_EXPORTS
]
MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print('FRONTIER_TOWNSFOLK_READY', len(attachments), 'meshes + creased cowboy_hat exported')
