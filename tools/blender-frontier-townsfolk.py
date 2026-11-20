"""Append the seven Dry Gulch / Frontier Townsfolk 3D models to assets/player/player.blend.

Run from the repository root:
    blender --background assets/player/player.blend --python tools/blender-frontier-townsfolk.py
    python3 tools/build-player3d.py
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


def surface(station, height, lift=0.025):
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


def patch(g, left, right, bottom, top, material, lift=0.025):
    xs = cuts(left, right, range(1, 16))
    zs = cuts(bottom, top, heights)
    rows = [[surface(x, z, lift) for x in xs] for z in zs]
    grid(g, rows, material)


def crown(g, left, right, inner_radius, material, lift=0.025):
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
    patch(g, 0.0, 16.0, -0.86, -0.18, 'pants', lift=0.032)
    patch(g, 0.0, 2.3, -0.18, 0.56, 'pants', lift=0.038)
    patch(g, 13.7, 16.0, -0.18, 0.56, 'pants', lift=0.038)
    patch(g, 6.2, 9.8, -0.18, 0.52, 'pants', lift=0.036)
    shoulder_strap(g, -0.44, 0.14, 'pants', lift=0.052)
    shoulder_strap(g, 0.44, 0.14, 'pants', lift=0.052)
    for s in (1.35, 14.65):
        px, py, pz = surface(s, 0.48, lift=0.055)
        add_box(g, px, py, pz, 0.07, 0.07, 0.07, 'gold')
    return g


def frontier_farmer_dress():
    g = Geometry()
    patch(g, 0.0, 16.0, -0.88, 0.96, 'shirt', lift=0.028)
    crown(g, 0.0, 16.0, 0.56, 'shirt', lift=0.034)
    patch(g, 0.0, 16.0, -0.48, -0.32, 'white', lift=0.045)
    crown(g, 0.0, 16.0, 0.46, 'white', lift=0.042)
    return g


def frontier_cowboy_vest():
    g = Geometry()
    patch(g, 1.35, 14.65, -0.68, 0.96, 'armor', lift=0.034)
    crown(g, 1.35, 14.65, 0.56, 'armor', lift=0.038)
    patch(g, 0.0, 1.8, 0.46, 0.90, 'khaki', lift=0.062)
    patch(g, 14.2, 16.0, 0.46, 0.90, 'khaki', lift=0.062)
    crown(g, 0.0, 2.2, 0.46, 'khaki', lift=0.065)
    crown(g, 13.8, 16.0, 0.46, 'khaki', lift=0.065)
    patch(g, 0.0, 16.0, -0.78, -0.58, 'wood', lift=0.056)
    patch(g, 0.0, 0.85, -0.79, -0.57, 'gold', lift=0.072)
    patch(g, 15.15, 16.0, -0.79, -0.57, 'gold', lift=0.072)
    hx, hy, hz = surface(12.2, -0.72, lift=0.095)
    add_box(g, hx, hy, hz, 0.22, 0.16, 0.34, 'wood')
    return g


def frontier_cop_coat():
    g = Geometry()
    patch(g, 0.0, 16.0, -0.92, 0.98, 'shirt', lift=0.030)
    crown(g, 0.0, 16.0, 0.52, 'shirt', lift=0.036)
    patch(g, 0.0, 0.42, -0.82, 0.82, 'ink', lift=0.042)
    patch(g, 15.58, 16.0, -0.82, 0.82, 'ink', lift=0.042)
    for z_btn in (-0.28, 0.08, 0.42):
        bx, by, bz = surface(0.0, z_btn, lift=0.056)
        add_box(g, bx, by, bz, 0.06, 0.06, 0.06, 'steel')
    sx, sy, sz = surface(1.9, 0.44, lift=0.068)
    add_box(g, sx, sy, sz, 0.12, 0.16, 0.16, 'gold')
    shoulder_strap(g, -0.42, 0.11, 'shirt', lift=0.048)
    shoulder_strap(g, 0.42, 0.11, 'shirt', lift=0.048)
    patch(g, 0.0, 16.0, -0.76, -0.56, 'wood', lift=0.055)
    for st in (1.2, 2.6, 13.4, 14.8):
        lx, ly, lz = surface(st, -0.66, lift=0.072)
        add_box(g, lx, ly, lz, 0.06, 0.06, 0.16, 'gold')
    return g


def frontier_villager_apron():
    g = Geometry()
    patch(g, 0.0, 3.6, -0.88, 0.18, 'khaki', lift=0.038)
    patch(g, 12.4, 16.0, -0.88, 0.18, 'khaki', lift=0.038)
    patch(g, 0.0, 16.0, -0.34, -0.22, 'khaki', lift=0.044)
    shoulder_strap(g, -0.40, 0.11, 'wood', lift=0.050)
    shoulder_strap(g, 0.40, 0.11, 'wood', lift=0.050)
    return g


def frontier_pinafore():
    g = Geometry()
    patch(g, 0.0, 16.0, -0.90, 0.95, 'shirt', lift=0.026)
    crown(g, 0.0, 16.0, 0.56, 'shirt', lift=0.032)
    patch(g, 0.0, 3.2, -0.86, 0.36, 'white', lift=0.042)
    patch(g, 12.8, 16.0, -0.86, 0.36, 'white', lift=0.042)
    patch(g, 0.0, 16.0, -0.44, -0.30, 'white', lift=0.044)
    crown(g, 0.0, 16.0, 0.44, 'white', lift=0.048)
    return g


def frontier_straw_hat():
    g = Geometry()
    add_lathe(g, [(0.86, 0.42), (1.62, 0.36), (1.64, 0.44), (0.92, 0.50)], sides=16, material='gold', cap_top=False)
    add_lathe(g, [(0.92, 0.46), (0.88, 0.78), (0.72, 1.06), (0.38, 1.18)], sides=16, material='khaki', cap_top=True)
    return g


def frontier_cop_hat():
    g = Geometry()
    add_lathe(g, [(0.86, 0.42), (1.56, 0.40), (1.56, 0.48), (0.92, 0.52)], sides=16, material='ink', cap_top=False, x_scale=1.05, y_scale=0.97)
    add_lathe(g, [(0.94, 0.48), (0.94, 0.64)], sides=16, material='gold', cap_top=False, x_scale=1.02, y_scale=0.97)
    add_lathe(g, [(0.90, 0.62), (0.82, 0.96), (0.56, 1.18), (0.24, 1.24)], sides=16, material='armor', cap_top=True, x_scale=1.02, y_scale=0.97)
    return g


def frontier_flat_cap():
    g = Geometry()
    add_lathe(g, [(0.96, 0.36), (1.06, 0.58), (0.96, 0.86), (0.62, 1.04)], sides=14, material='armor', cap_top=True, x_scale=1.08, y_scale=0.98)
    bill_verts = [
        (0.55, -0.68, 0.38), (1.32, -0.44, 0.30), (1.42, 0.00, 0.28), (1.32, 0.44, 0.30), (0.55, 0.68, 0.38),
        (0.55, -0.68, 0.48), (1.32, -0.44, 0.38), (1.42, 0.00, 0.36), (1.32, 0.44, 0.38), (0.55, 0.68, 0.48),
    ]
    bill_faces = [(0, 1, 6, 5), (1, 2, 7, 6), (2, 3, 8, 7), (3, 4, 9, 8), (5, 6, 7, 8, 9), (4, 3, 2, 1, 0)]
    g.add(bill_verts, bill_faces, 'wood')
    return g


def frontier_bonnet():
    g = Geometry()
    add_lathe(g, [(0.98, 0.14), (1.12, 0.50), (1.02, 0.90), (0.62, 1.14)], sides=14, material='white', cap_top=True, x_scale=1.04, y_scale=1.02, x_off=-0.16)
    add_lathe(g, [(1.02, 0.32), (1.26, 0.42), (1.20, 0.80), (0.86, 1.06)], sides=14, material='khaki', cap_top=True, x_scale=0.88, y_scale=1.08, x_off=0.22)
    add_box(g, 0.05, 0.96, 0.18, 0.52, 0.14, 0.18, 'shirt')
    return g


def frontier_ponytail():
    g = Geometry()
    add_lathe(g, [(1.02, 0.10), (1.08, 0.48), (0.96, 0.84), (0.54, 1.05)], sides=12, material='wood', cap_top=True, x_scale=0.98, y_scale=1.02, x_off=-0.12)
    tail_rings = [((-0.92, 0.0, 0.12), 0.34, 0.30), ((-1.42, 0.0, -0.02), 0.40, 0.34), ((-1.95, 0.0, -0.22), 0.28, 0.24), ((-2.34, 0.0, -0.44), 0.10, 0.09)]
    sides = 8
    verts = [(cx, cy + math.cos(2.0 * math.pi * i / sides) * ry, cz + math.sin(2.0 * math.pi * i / sides) * rz) for (cx, cy, cz), ry, rz in tail_rings for i in range(sides)]
    faces = [(r * sides + i, r * sides + (i + 1) % sides, (r + 1) * sides + (i + 1) % sides, (r + 1) * sides + i) for r in range(len(tail_rings) - 1) for i in range(sides)]
    g.add(verts, faces, 'wood')
    return g


torso_part = base['SOURCE']['torso']
head_part = base['SOURCE']['head']

frontier_col = bpy.data.collections.get('Frontier townsfolk variants')
if frontier_col is None:
    frontier_col = bpy.data.collections.new('Frontier townsfolk variants')
    bpy.context.scene.collection.children.link(frontier_col)

attachments = {
    'frontier_overalls': (frontier_overalls, torso_part, 'chest'),
    'frontier_farmer_dress': (frontier_farmer_dress, torso_part, 'chest'),
    'frontier_cowboy_vest': (frontier_cowboy_vest, torso_part, 'chest'),
    'frontier_cop_coat': (frontier_cop_coat, torso_part, 'chest'),
    'frontier_villager_apron': (frontier_villager_apron, torso_part, 'chest'),
    'frontier_pinafore': (frontier_pinafore, torso_part, 'chest'),
    'frontier_straw_hat': (frontier_straw_hat, head_part, 'head'),
    'frontier_cop_hat': (frontier_cop_hat, head_part, 'head'),
    'frontier_flat_cap': (frontier_flat_cap, head_part, 'head'),
    'frontier_bonnet': (frontier_bonnet, head_part, 'head'),
    'frontier_ponytail': (frontier_ponytail, head_part, 'head'),
}

for name, (builder, ref_part, bone_name) in attachments.items():
    for existing in (bpy.data.objects.get(name), bpy.data.objects.get(f'{name}_source')):
        if existing is not None:
            bpy.data.objects.remove(existing, do_unlink=True)
    lib_obj = base['mesh_object'](name, builder(), library)
    lib_obj.hide_viewport = True
    lib_obj.hide_render = True
    base['LIBRARY'][name] = lib_obj
    src_obj = base['source_part'](f'{name}_source', name, tuple(ref_part.location), tuple(ref_part.scale), bone_name, frontier_col, visible=False)
    vg = src_obj.vertex_groups.get(bone_name) or src_obj.vertex_groups.new(name=bone_name)
    vg.add(range(len(src_obj.data.vertices)), 1.0, 'REPLACE')
    mod = src_obj.modifiers.get('Player skin') or src_obj.modifiers.new('Player skin', 'ARMATURE')
    mod.object = rig
    src_obj.parent = rig
    base['SOURCE'][src_obj.name] = src_obj

base['validate_scene'](rig)
with tempfile.TemporaryDirectory() as _tmp:
    compact = base['export_compact']()

for name in attachments:
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
print('FRONTIER_TOWNSFOLK_READY', len(attachments), 'meshes exported')
