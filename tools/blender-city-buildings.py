#!/usr/bin/env python3
"""Author the visible canal roof kit in Blender and export portable polygons.

blender --background --factory-startup --python tools/blender-city-buildings.py
blender --background --factory-startup --python tools/blender-city-buildings.py -- --validate-only
blender --background --factory-startup --python tools/blender-city-buildings.py -- --export-existing

The game supplies the existing walls and footprint. These roof assemblies start
at its deck (Z=0); XY exports as fractions of the full collision footprint.
Normals remain in the physical 200 x 160 reference frame. Scale their XY by
200/width and 160/depth before normalizing for live shading and visibility.
"""
import argparse
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'buildings'
BLEND = OUT / 'city-buildings.blend'
RUNTIME = OUT / 'city-buildings.json'
REFERENCE = (200, 160)
PALETTE = {
    'roof_tile': [157, 91, 64], 'roof_tile_dark': [111, 66, 49],
    'roof_metal': [94, 123, 126], 'roof_metal_dark': [57, 79, 84],
    'roof_membrane': [91, 98, 97], 'brick': [142, 95, 74],
    'stone': [174, 165, 142], 'trim': [211, 194, 157],
    'glass': [48, 105, 119], 'glass_highlight': [114, 171, 179],
    'metal': [131, 145, 141], 'metal_dark': [56, 67, 70],
    'plant': [71, 104, 66],
}
LABELS = {
    'quay_house': 'Canal merchants house: pitched tile roof, dormers and chimneys',
    'quay_warehouse': 'Wharf workshop: sawtooth north lights and standing seams',
    'quay_office': 'Canal office: stone parapet, rooflight and service plant',
}
MATERIALS = {}


def number(value):
    value = round(float(value), 8)
    return 0 if value == 0 else value


def material(name):
    if name not in MATERIALS:
        m = bpy.data.materials.new(name)
        m.diffuse_color = tuple(v / 255 for v in PALETTE[name]) + (1,)
        m.use_nodes = True
        shader = m.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value = m.diffuse_color
        shader.inputs['Roughness'].default_value = .82 if name != 'glass' else .3
        MATERIALS[name] = m
    return MATERIALS[name]


def part(parent, name, vertices, faces, colors, order):
    mesh = bpy.data.meshes.new(parent.name + '/' + name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(parent.name + '/' + name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj['city_model'] = parent.name
    obj['part_name'] = name
    obj['part_order'] = order
    names = list(dict.fromkeys(colors))
    for key in names:
        mesh.materials.append(material(key))
    for face, key in zip(mesh.polygons, colors):
        face.material_index = names.index(key)
    return obj


def box(parent, name, x, y, w, h, z, rise, color, order, top=None):
    x0, x1, y0, y1, z1 = x-w/2, x+w/2, y-h/2, y+h/2, z+rise
    return part(parent, name,
                [(x0,y0,z),(x1,y0,z),(x1,y1,z),(x0,y1,z),
                 (x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1)],
                [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],
                [color,top or color,color,color,color,color], order)


def slope_box(parent, name, x, y, w, h, surface, top_z, color, order, top=None):
    # Four lower corners meet the host plane exactly. A flat guessed foot
    # creates a visible gap on the low side of a chimney at oblique angles.
    xy=[(x-w/2,y-h/2),(x+w/2,y-h/2),(x+w/2,y+h/2),(x-w/2,y+h/2)]
    return part(parent,name,[(px,py,surface(px,py)) for px,py in xy]+
                [(px,py,top_z) for px,py in xy],
                [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],
                [color,top or color,color,color,color,color],order)


def plane(parent, name, points, color, order):
    return part(parent, name, points, [tuple(range(len(points)))], [color], order)


def deck(parent, name, x, y, w, h, z, color, order):
    return plane(parent, name, [(x-w/2,y-h/2,z),(x+w/2,y-h/2,z),
                               (x+w/2,y+h/2,z),(x-w/2,y+h/2,z)], color, order)


def gable(parent, name, x, y, w, h, base, peak, roof, side, order):
    # Ridge runs along X; both sloping planes meet the same actual ridge.
    return part(parent, name,
                [(x-w/2,y-h/2,base),(x+w/2,y-h/2,base),
                 (x+w/2,y+h/2,base),(x-w/2,y+h/2,base),
                 (x-w/2,y,peak),(x+w/2,y,peak)],
                [(0,3,2,1),(0,1,5,4),(3,4,5,2),(0,4,3),(1,2,5)],
                [side,roof,roof,side,side], order)


def house(parent):
    deck(parent,'roof-seat',0,0,200,160,0,'stone',-1)
    gable(parent, 'pitched-roof', 0, 0, 196, 156, 1, 15, 'roof_tile', 'brick', 0)
    # The fascia joins the eaves; it never becomes a separate ground block.
    for sign in [-1,1]:
        box(parent, 'eave-'+str(sign), 0, sign*77, 198, 4, 0, 2.1, 'trim', 1)
        for k in range(1,6):
            y = sign * k*12
            z = 15 - abs(y)*14/78 + .10
            # Tile courses are real shallow strips on the roof plane.
            plane(parent, 'tile-course-'+str(sign)+'-'+str(k),
                  [(-97,y-.42,z+sign*.42*14/78),(97,y-.42,z+sign*.42*14/78),
                   (97,y+.42,z-sign*.42*14/78),(-97,y+.42,z-sign*.42*14/78)],
                  'roof_tile_dark', 2)
    box(parent, 'ridge-cap', 0, 0, 198, 3, 14.8, 1.1, 'trim', 3)
    # Two small dormers terminate against the sloped surface, rather than
    # painted squares lying on the roof. Their bases follow the local slope.
    for i, x in enumerate([-49,39]):
        y, w, h = -28, 29, 25
        zfront = 15-abs(y-h/2)*14/78
        zback = 15-abs(y+h/2)*14/78
        low, high = 12.6, 17.2
        vertices=[(x-w/2,y-h/2,zfront),(x+w/2,y-h/2,zfront),
                  (x+w/2,y+h/2,zback),(x-w/2,y+h/2,zback),
                  (x-w/2,y-h/2,low),(x+w/2,y-h/2,low),
                  (x+w/2,y+h/2,low),(x-w/2,y+h/2,low)]
        part(parent,'dormer-cheeks-'+str(i),vertices,
             [(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],['trim']*4,4)
        gable(parent,'dormer-roof-'+str(i),x,y,w+3,h+3,low,high,'roof_metal','trim',5)
        # Front glazing is raised with its dormer, facing the canal frontage.
        plane(parent,'dormer-window-'+str(i),
              [(x-9,y-h/2-.06,zfront+.7),(x+9,y-h/2-.06,zfront+.7),
               (x+9,y-h/2-.06,12),(x-9,y-h/2-.06,12)],'glass',6)
        box(parent,'window-mullion-'+str(i),x,y-h/2-.12,1.4,.35,zfront+.5,12-zfront,'trim',7)
    for i, x in enumerate([-73,68]):
        y=41
        slope_box(parent,'chimney-'+str(i),x,y,12,14,
                  lambda px,py:15-py*14/78,16.8,'brick',8)
        box(parent,'chimney-cap-'+str(i),x,y,16,18,16.8,1.1,'stone',9,top='metal_dark')


def warehouse(parent):
    deck(parent,'under-roof',0,0,200,160,0,'roof_metal_dark',0)
    for i in range(3):
        y0=-75+i*50;y1=y0+50
        # One closed triangular prism per tooth, with a steep north-light face.
        part(parent,'sawtooth-'+str(i),
             [(-96,y0,1.2),(96,y0,1.2),(96,y1,1.2),(-96,y1,1.2),
              (-96,y0,14),(96,y0,14)],
             [(0,3,2,1),(0,1,5,4),(3,4,5,2),(0,4,3),(1,2,5)],
             ['roof_metal_dark','glass','roof_metal','brick','brick'],1)
        # The vertical glass ribbons retain separated steel bays at every view.
        for x in [-64,-32,0,32,64]:
            plane(parent,'north-light-mullion-'+str(i)+'-'+str(x),
                  [(x-1,y0-.08,1.2),(x+1,y0-.08,1.2),
                   (x+1,y0-.08,14),(x-1,y0-.08,14)],'trim',2)
        for x in [-80,-48,-16,16,48,80]:
            # A narrow two-plane standing seam follows the sloping roof.
            z0,z1=14.2,1.4
            part(parent,'standing-seam-'+str(i)+'-'+str(x),
                 [(x-.7,y0,z0),(x,y0,z0+.55),(x+.7,y0,z0),
                  (x-.7,y1,z1),(x,y1,z1+.55),(x+.7,y1,z1)],
                 [(0,1,4,3),(1,2,5,4)],['roof_metal_dark','metal'],3)
    for sign in [-1,1]:
        box(parent,'side-coping-'+str(sign),sign*98,0,4,158,.1,2.1,'stone',4)
    # The shared service plant rests on the last slope at its actual height.
    surface=lambda x,y:14-(y-25)*12.8/50
    top_z=surface(57,39)+4.2
    slope_box(parent,'extractor',57,48,27,18,surface,top_z,'metal',5,top='metal_dark')
    for x in range(48,69,5):
        deck(parent,'extractor-fin-'+str(x),x,48,1.3,14,top_z+.1,'metal',6)
    slope_box(parent,'flue',-66,42,10,11,surface,16.8,'brick',7)
    box(parent,'flue-cap',-66,42,14,15,16.8,1,'stone',8,top='metal_dark')


def office(parent):
    deck(parent,'roof-deck',0,0,200,160,0,'roof_membrane',0)
    for i,(x,y,w,h) in enumerate([(0,-76,198,6),(0,76,198,6),(-96,0,6,146),(96,0,6,146)]):
        box(parent,'parapet-'+str(i),x,y,w,h,0,4.5,'stone',1)
        box(parent,'coping-'+str(i),x,y,w+1,h+1,4.5,1,'trim',2)
    # Low seams and service pavers make the roof read as an occupied deck.
    for i in range(5):
        deck(parent,'membrane-seam-'+str(i),-72+i*36,0,.7,145,.4,'metal_dark',3)
    for i in range(6):
        deck(parent,'service-paver-'+str(i),4,55-i*18,13,14,.55,'stone',4)
    box(parent,'plant-room',-40,-17,58,48,.35,11,'stone',5,top='roof_metal')
    box(parent,'plant-room-coping',-40,-17,62,52,11.35,1.3,'trim',6)
    for i,x in enumerate([-57,-40,-23]):
        plane(parent,'plant-glass-'+str(i),[(x-5,-41.08,4),(x+5,-41.08,4),
                                         (x+5,-41.08,9.3),(x-5,-41.08,9.3)],'glass',7)
    # A raised glass lantern has real sloped sides and an opaque perimeter.
    gable(parent,'roof-lantern',45,-28,50,34,.8,7.2,'glass','metal',8)
    box(parent,'lantern-ridge',45,-28,51,1.8,7,1.1,'trim',9)
    for i,x in enumerate([29,45,61]):
        for sign in [-1,1]:
            plane(parent,'lantern-rib-'+str(i)+'-'+str(sign),
                  [(x-.6,-28,7.35),(x+.6,-28,7.35),
                   (x+.6,-28+sign*16.7,1.05),(x-.6,-28+sign*16.7,1.05)][::1 if sign>0 else -1],
                  'trim',10)
    for i,x in enumerate([33,65]):
        box(parent,'vent-'+str(i),x,34,22,17,.35,5.3,'metal',11,top='metal_dark')
        for k in range(4):
            deck(parent,'vent-fin-'+str(i)+'-'+str(k),x-7+k*4.5,34,1.3,13,5.8,'metal',12)
    box(parent,'roof-planter',-47,47,55,19,.35,4.2,'stone',13,top='plant')
    # A shaded inset makes the planting edge visible without tiny leaf geometry.
    deck(parent,'planter-bed',-47,47,49,13,4.6,'plant',14)


def generate():
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    MATERIALS.clear()
    for i,(key,build) in enumerate([('quay_house',house),('quay_warehouse',warehouse),('quay_office',office)]):
        parent=bpy.data.objects.new(key,None);bpy.context.collection.objects.link(parent)
        parent.location=(i*270,0,0);parent['city_roof_model']=True
        build(parent)
    # Inspection camera/lights remain in Blender only; runtime lighting stays live.
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32
    scene.cycles.use_denoising=False
    scene.world.color=(.65,.65,.65)
    bpy.ops.object.light_add(type='SUN',location=(200,-300,500));bpy.context.object.data.energy=2.1
    bpy.context.object.rotation_euler=(math.radians(25),math.radians(-25),math.radians(-30))
    bpy.ops.object.camera_add(location=(620,-520,600));camera=bpy.context.object
    direction=Vector((270,0,2))-camera.location;camera.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=860;scene.camera=camera
    scene.render.resolution_x=1200;scene.render.resolution_y=650;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='Standard'
    scene.render.image_settings.file_format='PNG'


def export_data():
    models={};face_count=0;part_count=0;max_error=0
    for parent in sorted((o for o in bpy.data.objects if o.get('city_roof_model')),key=lambda o:o.name):
        parts=[];all_points=[]
        inverse=parent.matrix_world.inverted()
        for obj in sorted((o for o in bpy.data.objects if o.parent==parent and o.type=='MESH'),
                          key=lambda o:(o.get('part_order',0),o.name)):
            matrix=inverse@obj.matrix_world;normal_matrix=matrix.to_3x3().inverted().transposed();faces=[]
            for polygon in obj.data.polygons:
                physical=[matrix@obj.data.vertices[index].co for index in polygon.vertices]
                normal=(normal_matrix@polygon.normal).normalized()
                if not all(math.isfinite(v) for p in physical for v in p) or abs(normal.length-1)>1e-5:
                    raise RuntimeError('Non-finite or degenerate city roof face: '+obj.name)
                residual=max(abs(normal.dot(p-physical[0])) for p in physical)
                max_error=max(max_error,residual)
                if residual>.0001:raise RuntimeError('Non-planar city roof face: '+obj.name)
                points=[[number(p.x/REFERENCE[0]),number(p.y/REFERENCE[1]),number(p.z)] for p in physical]
                if any(abs(p[0])>.501 or abs(p[1])>.501 or p[2]<-.001 or p[2]>18.001 for p in points):
                    raise RuntimeError('City roof leaves its bounded footprint/height: '+obj.name)
                key=obj.data.materials[polygon.material_index].name
                if key not in PALETTE:raise RuntimeError('Unknown material '+key)
                faces.append({'points':points,'normal':[number(v) for v in normal],'material':key,
                              'centroid':[number(sum(p[i] for p in points)/len(points)) for i in range(3)]})
                all_points.extend(points)
            parts.append({'name':obj.get('part_name',obj.name),'order':int(obj.get('part_order',0)),
                          'minZ':number(min(p[2] for f in faces for p in f['points'])),
                          'maxZ':number(max(p[2] for f in faces for p in f['points'])),'faces':faces})
        count=sum(len(p['faces']) for p in parts)
        if count>160:raise RuntimeError(parent.name+' exceeds the 160-face budget: '+str(count))
        models[parent.name]={'label':LABELS[parent.name],'parts':parts,'faceCount':count,
                             'bounds':[[number(min(p[i] for p in all_points)) for i in range(3)],
                                       [number(max(p[i] for p in all_points)) for i in range(3)]]}
        face_count+=count;part_count+=len(parts)
    if set(models)!=set(LABELS):raise RuntimeError('Missing roof family')
    return {'schemaVersion':1,'coordinates':'footprint-fraction-xy/world-z',
            'referenceFootprint':list(REFERENCE),'palette':PALETTE,'models':models,
            'validation':{'modelCount':len(models),'partCount':part_count,'faceCount':face_count,
                          'maxPlanarityError':number(max_error),'maxFacesPerModel':160,
                          'xyLimit':.501,'heightLimit':18}}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--validate-only',action='store_true')
    parser.add_argument('--export-existing',action='store_true')
    parser.add_argument('--render-preview',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    OUT.mkdir(parents=True,exist_ok=True)
    if args.validate_only or args.export_existing:
        bpy.ops.wm.open_mainfile(filepath=str(BLEND))
    else:generate()
    bpy.context.view_layer.update();data=export_data()
    if args.validate_only:
        if json.loads(RUNTIME.read_text())!=data:raise RuntimeError('Saved Blender city roof source differs from runtime export')
        print('Validated saved Blender city roofs:',data['validation']);return
    if not args.export_existing:
        bpy.context.preferences.filepaths.save_version=0
        bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    RUNTIME.write_text(json.dumps(data,separators=(',',':'))+'\n')
    if args.render_preview:
        bpy.context.scene.render.filepath=str(OUT/'city-buildings-preview.png');bpy.ops.render.render(write_still=True)
    print('Exported visible Blender city roofs:',data['validation'])


if __name__=='__main__':main()
