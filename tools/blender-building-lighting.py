#!/usr/bin/env python3
"""Build and validate the actual frontier roof meshes in Blender.

  node tools/extract-building-lighting.cjs
  blender --background --factory-startup --python tools/blender-building-lighting.py
  blender --background --factory-startup --python tools/blender-building-lighting.py -- --validate-only

Runtime data retains native polygon order and local XY/Z coordinates. Blender
supplies polygon normals; the exporter validates each resulting plane against
the original native vertices before writing it. No visible game art is changed.
"""
import argparse
import json
import math
from pathlib import Path
import sys

import bpy

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'buildings'
SOURCE = OUT / 'roof-lighting-source.json'
RUNTIME = OUT / 'roof-lighting.json'
BLEND = OUT / 'roof-lighting.blend'
VERTEX_TOLERANCE = 0.0001  # Blender stores mesh positions as float32.
PLANE_TOLERANCE = 0.0001


def rounded(value, digits=12):
    value = round(float(value), digits)
    return 0 if value == 0 else value


def bounds(points):
    return [[min(p[i] for p in points) for i in range(3)],
            [max(p[i] for p in points) for i in range(3)]]


def load_source():
    if not SOURCE.exists():
        raise RuntimeError('Run node tools/extract-building-lighting.cjs first')
    source = json.loads(SOURCE.read_text())
    if source.get('schema') != 1 or source.get('quantization') != 10000:
        raise RuntimeError('Unsupported native building source schema')
    models = source.get('models', {})
    if not models or len(models) != source.get('modelCount'):
        raise RuntimeError('Native roof model count is invalid')
    if sum(len(m['faces']) for m in models.values()) != source.get('faceCount'):
        raise RuntimeError('Native roof face count is invalid')
    return source


def make_material(rgb, materials):
    # Native face colors are retained for inspecting the source geometry.
    key = tuple(rounded(c, 7) for c in rgb)
    if key in materials:
        return materials[key]
    material = bpy.data.materials.new('Native roof ' + '-'.join(str(v) for v in key))
    material.diffuse_color = tuple(max(0, min(1, c / 255)) for c in rgb) + (1,)
    material.use_nodes = True
    node = material.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = material.diffuse_color
    node.inputs['Roughness'].default_value = 0.85
    materials[key] = material
    return material


def build(source):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    collection = bpy.data.collections.new('Native frontier roofs - ordered lighting source')
    bpy.context.scene.collection.children.link(collection)
    materials = {}
    for key, model in source['models'].items():
        vertices, polygons = [], []
        for face in model['faces']:
            start = len(vertices)
            vertices.extend(face['points'])
            polygons.append(tuple(range(start, len(vertices))))
        mesh = bpy.data.meshes.new(key + ' ordered faces')
        mesh.from_pydata(vertices, [], polygons)
        mesh.update()
        # A dedicated face attribute catches accidental topology reordering.
        order = mesh.attributes.new(name='native_face_index', type='INT', domain='FACE')
        for index, item in enumerate(order.data):
            item.value = index
        native = model['native']
        name = native['role'] + ' | ' + native['part'] + ' | ' + key
        obj = bpy.data.objects.new(name, mesh)
        collection.objects.link(obj)
        obj.location = model['origin']
        obj['roof_key'] = key
        obj['native_premise_id'] = native['id']
        obj['native_part'] = native['part']
        obj['native_roof'] = native['roof']
        obj['native_geometry_digest'] = source['geometryDigest']
        obj['coordinates'] = 'Local native XY; Z is height above authored ground.'
        slots = {}
        for polygon, face in zip(mesh.polygons, model['faces']):
            material = make_material(face['color'], materials)
            if material.name not in slots:
                slots[material.name] = len(mesh.materials)
                mesh.materials.append(material)
            polygon.material_index = slots[material.name]
            polygon.use_smooth = False
    scene = bpy.context.scene
    scene['roof_geometry_digest'] = source['geometryDigest']
    scene['roof_source'] = 'assets/buildings/roof-lighting-source.json'
    scene['roof_export'] = 'assets/buildings/roof-lighting.json'
    scene['roof_editing'] = ('Native art remains authoritative. Preserve polygon and vertex order. '
                             'Refresh extraction and regenerate after changing native geometry.')
    scene.unit_settings.system = 'NONE'
    # Opening the file starts with all actual town meshes selected and framed.
    for obj in collection.objects:
        obj.select_set(True)
    if collection.objects:
        bpy.context.view_layer.objects.active = next(iter(collection.objects))
    world_points = [[p[0]+model['origin'][0],p[1]+model['origin'][1],p[2]]
                    for model in source['models'].values() for face in model['faces'] for p in face['points']]
    world_bounds = bounds(world_points)
    view_center = tuple((world_bounds[0][i]+world_bounds[1][i])*.5 for i in range(3))
    view_distance = max(world_bounds[1][i]-world_bounds[0][i] for i in range(3))*.8
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                area.spaces.active.shading.type = 'MATERIAL'
                area.spaces.active.clip_end = 100000
                area.spaces.active.region_3d.view_location = view_center
                area.spaces.active.region_3d.view_distance = view_distance
    bpy.context.view_layer.update()


def model_objects(source):
    objects = {}
    for obj in bpy.data.objects:
        key = obj.get('roof_key')
        if key is None:
            continue
        if key in objects:
            raise RuntimeError('Duplicate roof geometry key in Blender: ' + key)
        if obj.type != 'MESH' or obj.modifiers:
            raise RuntimeError('Roof export requires the original unmodified polygon topology: ' + key)
        objects[key] = obj
    if set(objects) != set(source['models']):
        raise RuntimeError('Blender roof keys differ from the extracted native source; regenerate the Blender file')
    return objects


def plane_from_polygon(polygon, points, native_points):
    normal = [float(v) for v in polygon.normal]
    length = math.sqrt(sum(v*v for v in normal))
    if not math.isfinite(length) or length < 0.999:
        raise RuntimeError('Degenerate Blender roof polygon')
    normal = [v / length for v in normal]
    # Blender float32 coordinates can give an exactly vertical native beam a
    # tiny spurious Z normal. Preserve exact zero axes established by the
    # original polygon, after confirming Blender agrees within float tolerance.
    native_normal = None
    origin = native_points[0]
    for index in range(1, len(native_points)-1):
        u = [native_points[index][i]-origin[i] for i in range(3)]
        v = [native_points[index+1][i]-origin[i] for i in range(3)]
        cross = [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
        magnitude = math.sqrt(sum(value*value for value in cross))
        if magnitude > 1e-12:
            native_normal = [value/magnitude for value in cross]
            break
    if native_normal is None:
        raise RuntimeError('Degenerate native roof polygon')
    for axis in range(3):
        if abs(native_normal[axis]) < 1e-10:
            if abs(normal[axis]) > 1e-5:
                raise RuntimeError('Blender polygon normal disagrees with a native plane axis')
            normal[axis] = 0.0
    length = math.sqrt(sum(v*v for v in normal))
    normal = [v / length for v in normal]
    blender_center = [sum(p[i] for p in points) / len(points) for i in range(3)]
    blender_d = -sum(normal[i] * blender_center[i] for i in range(3))
    blender_error = max(abs(sum(normal[i] * p[i] for i in range(3)) + blender_d) for p in points)
    # Center D on the original double-precision source. This avoids magnifying
    # Blender's float32 translation error while retaining its actual normal.
    native_center = [sum(p[i] for p in native_points) / len(native_points) for i in range(3)]
    d = -sum(normal[i] * native_center[i] for i in range(3))
    plane = [rounded(v) for v in normal] + [rounded(d)]
    source_error = max(abs(sum(plane[i] * p[i] for i in range(3)) + plane[3]) for p in native_points)
    if max(blender_error, source_error) > PLANE_TOLERANCE:
        raise RuntimeError('Nonplanar roof polygon exceeds tolerance: ' + str(max(blender_error, source_error)))
    return plane, blender_error, source_error


def export_data(source):
    objects = model_objects(source)
    models, vertical, flat, sloped = {}, 0, 0, 0
    max_blender_error, max_source_error, max_vertex_error = 0, 0, 0
    world_points = []
    for key, model in source['models'].items():
        obj, faces = objects[key], []
        if obj.get('native_geometry_digest') != source['geometryDigest']:
            raise RuntimeError('Blender roof geometry is stale: ' + key)
        mesh = obj.data
        if len(mesh.polygons) != len(model['faces']):
            raise RuntimeError('Blender face count changed: ' + key)
        order = mesh.attributes.get('native_face_index')
        if order is None or any(item.value != index for index, item in enumerate(order.data)):
            raise RuntimeError('Native face order was changed: ' + key)
        origin_error = max(abs(float(obj.location[i]) - model['origin'][i]) for i in range(3))
        if origin_error > 0.001 or any(abs(float(v)) > 1e-8 for v in obj.rotation_euler) or any(abs(float(v)-1) > 1e-8 for v in obj.scale):
            raise RuntimeError('Authored object placement/transform changed: ' + key)
        for polygon, native_face in zip(mesh.polygons, model['faces']):
            points = [list(mesh.vertices[index].co) for index in polygon.vertices]
            native_points = native_face['points']
            if len(points) != len(native_points):
                raise RuntimeError('Native polygon topology changed: ' + key)
            error = max(abs(a[i]-b[i]) for a,b in zip(points,native_points) for i in range(3))
            max_vertex_error = max(max_vertex_error, error)
            if error > VERTEX_TOLERANCE:
                raise RuntimeError('Blender vertices differ from native art: ' + key + '; refresh native geometry and extraction before exporting')
            plane, blender_error, source_error = plane_from_polygon(polygon, points, native_points)
            max_blender_error = max(max_blender_error, blender_error)
            max_source_error = max(max_source_error, source_error)
            if plane[2] == 0:
                vertical += 1
            elif plane[0] == 0 and plane[1] == 0:
                flat += 1
            else:
                sloped += 1
            faces.append({'points':[[rounded(v,9) for v in p] for p in native_points],
                          'plane':plane, 'minZ':rounded(min(p[2] for p in native_points),9),
                          'maxZ':rounded(max(p[2] for p in native_points),9)})
            world_points.extend([[p[0]+model['origin'][0],p[1]+model['origin'][1],p[2]] for p in native_points])
        models[key] = {'faces':faces,'bounds':[[rounded(v,9) for v in row] for row in model['bounds']]}
    stats = {'modelCount':len(models),'faceCount':sum(len(m['faces']) for m in models.values()),
             'verticalFaces':vertical,'flatFaces':flat,'slopedFaces':sloped,
             'maxBlenderPlanarityError':rounded(max_blender_error),
             'maxNativePlaneResidual':rounded(max_source_error),
             'maxImportedVertexError':rounded(max_vertex_error),
             'worldBounds':[[rounded(v,9) for v in row] for row in bounds(world_points)]}
    return {'schema':1,'quantization':10000,'sourceDigest':source['geometryDigest'],
            'models':models,'validation':stats}


def validate_data(data, source):
    if data.get('schema') != 1 or data.get('quantization') != 10000 or data.get('sourceDigest') != source['geometryDigest']:
        raise RuntimeError('Roof lighting export is stale or has an unsupported schema')
    if set(data['models']) != set(source['models']):
        raise RuntimeError('Exported roof geometry keys differ from native source')
    for key, model in source['models'].items():
        exported = data['models'][key]['faces']
        if len(exported) != len(model['faces']):
            raise RuntimeError('Exported polygon order/count changed: ' + key)
        for face, native_face in zip(exported, model['faces']):
            points, expected = face['points'], native_face['points']
            if len(points) != len(expected) or max(abs(a[i]-b[i]) for a,b in zip(points,expected) for i in range(3)) > 1e-8:
                raise RuntimeError('Exported polygon vertices changed: ' + key)
            a,b,c,d = face['plane']
            if abs(math.sqrt(a*a+b*b+c*c)-1) > 1e-9:
                raise RuntimeError('Exported plane is not normalized: ' + key)
            if max(abs(a*p[0]+b*p[1]+c*p[2]+d) for p in expected) > PLANE_TOLERANCE:
                raise RuntimeError('Exported plane does not contain native polygon: ' + key)
            if abs(face['minZ']-min(p[2] for p in expected)) > 1e-8 or abs(face['maxZ']-max(p[2] for p in expected)) > 1e-8:
                raise RuntimeError('Exported polygon height bounds changed: ' + key)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--validate-only', action='store_true')
    parser.add_argument('--export-existing', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    source = load_source()
    if args.validate_only:
        if not BLEND.exists() or not RUNTIME.exists():
            raise RuntimeError('Generate the Blender roof source and runtime export first')
        bpy.ops.wm.open_mainfile(filepath=str(BLEND))
    elif not args.export_existing:
        build(source)
    data = export_data(source)
    validate_data(data,source)
    text = json.dumps(data, separators=(',', ':'), ensure_ascii=False) + '\n'
    if args.validate_only:
        stored = json.loads(RUNTIME.read_text())
        validate_data(stored,source)
        if stored != data:
            raise RuntimeError('Blender roof planes differ from the runtime export; regenerate it')
    else:
        OUT.mkdir(parents=True,exist_ok=True)
        RUNTIME.write_text(text)
        if not args.export_existing:
            bpy.context.preferences.filepaths.save_version = 0
            bpy.ops.wm.save_as_mainfile(filepath=str(BLEND),check_existing=False,compress=True)
    print(json.dumps({'action':'validated' if args.validate_only else 'exported',
                      'runtime':str(RUNTIME.relative_to(ROOT)), **data['validation']}))


if __name__ == '__main__':
    main()
