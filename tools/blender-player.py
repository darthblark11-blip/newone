#!/usr/bin/env python3
"""Deterministically build the game's editable cel-shaded 3D player.

Run: blender --background --factory-startup --python tools/blender-player.py
Options after --: --skip-renders, --validate-only, --export-existing
Export manual edits without rebuilding:
  blender --background assets/player/player.blend --python tools/blender-player.py -- --export-existing
Refresh just the portable soldier variants and their previews:
  blender --background assets/player/player.blend --python tools/blender-player.py -- --export-existing --soldier-variants-only
Runtime meshes are articulated parts; the source and GLB also contain a real
armature, deformation weights, named sockets, equipment, and a sample idle clip.
"""
import argparse
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'player'
PALETTE = {
    'shirt': [200/255, 30/255, 30/255], 'pants': [30/255, 80/255, 180/255],
    'skin': [235/255, 180/255, 140/255], 'boots': [.065, .12, .23],
    'ink': [.025, .032, .045], 'metal': [.19, .22, .27],
    'steel': [.56, .62, .67], 'wood': [.40, .21, .085],
    'armor': [.24, .39, .16], 'khaki': [.55, .45, .33],
    'white': [.88, .91, .92], 'ninja': [.055, .065, .085],
    'cowboy': [.86, .77, .57], 'hat': [.31, .20, .12],
    'glass': [.12, .57, .63], 'gold': [.79, .55, .15],
    'energy': [.22, .80, .90], 'blood': [.43, .035, .045],
    'nm0_cloth': [170/255,175/255,180/255], 'nm0_trousers': [100/255,105/255,110/255],
    'nm0_webbing': [68/255,77/255,83/255], 'nm0_trim': [43/255,50/255,55/255],
    'nm0_helmet': [112/255,124/255,118/255], 'nm0_helmet_trim': [47/255,57/255,52/255],
    'nm0_plate': [100/255,104/255,112/255], 'nm0_plate_trim': [43/255,49/255,58/255],
    'nm0_heavy_helmet': [64/255,77/255,73/255], 'nm0_heavy_helmet_trim': [31/255,39/255,35/255],
    'nm0_heavy_cloth': [40/255,80/255,200/255], 'nm0_heavy_trousers': [30/255,30/255,30/255],
    'nm0_boots': [31/255,36/255,42/255], 'nm0_heavy_boots': [24/255,29/255,36/255],
}
MATERIALS = {}
LIBRARY = {}
SOURCE = []
SOCKETS = {}
NATIVE_WEAPONS = {}


def load_native_weapons():
    """The game's own authored solids are the long-gun model source."""
    path=ROOT/'assets/player/native-weapons.json'
    if not path.exists():
        raise RuntimeError('Run node tools/extract-player3d-weapons.cjs before building the Blender player')
    data=json.loads(path.read_text())
    if data.get('schemaVersion')!=1:
        raise RuntimeError('Unsupported native weapon source schema')
    NATIVE_WEAPONS.update(data['models'])
    for model in NATIVE_WEAPONS.values():
        for item in model['boxes']+model['details']:
            rgb=item['color']
            PALETTE['native_rgb_'+''.join(f'{int(c):02x}' for c in rgb)]=[c/255 for c in rgb]


class Geometry:
    def __init__(self):
        self.vertices, self.faces, self.materials, self.smooth = [], [], [], []

    def add(self, vertices, faces, material='metal', smooth=False, matrix=None):
        base = len(self.vertices)
        matrix = matrix or Matrix.Identity(4)
        self.vertices.extend(tuple(matrix @ Vector(v)) for v in vertices)
        reverse = matrix.to_3x3().determinant() < 0
        for face in faces:
            self.faces.append(tuple(base+i for i in (reversed(face) if reverse else face)))
            self.materials.append(material)
            self.smooth.append(smooth)
        return self

    def box(self, center, size, material='metal', bevel=.12):
        # Octagonal cross sections give a real bevel silhouette without a
        # modifier, so Blender and the compact runtime use identical geometry.
        x, y, z = center
        lx, ly, lz = (n*.5 for n in size)
        by, bz = min(ly*.45, min(size)*bevel), min(lz*.45, min(size)*bevel)
        ring = [(ly-by,lz),(-ly+by,lz),(-ly,lz-bz),(-ly,-lz+bz),
                (-ly+by,-lz),(ly-by,-lz),(ly,-lz+bz),(ly,lz-bz)]
        vertices = [(x+xx,y+yy,z+zz) for xx in [-lx,lx] for yy,zz in ring]
        # The ring above runs counterclockwise as seen from +X.
        faces = [tuple(reversed(range(8))), tuple(range(8,16))]
        faces.extend((j,(j+1)%8,(j+1)%8+8,j+8) for j in range(8))
        return self.add(vertices, faces, material)

    def loft(self, rings, material='metal', axis='X', sides=12, smooth=True):
        # rings: (longitudinal coordinate, first radius, second radius).
        vertices = []
        for coordinate,a,b in rings:
            for j in range(sides):
                t=j*math.tau/sides
                p=(coordinate,a*math.cos(t),b*math.sin(t))
                vertices.append(p if axis=='X' else (p[1],p[2],p[0]))
        faces = [tuple(reversed(range(sides))),
                 tuple((len(rings)-1)*sides+j for j in range(sides))]
        for i in range(len(rings)-1):
            faces.extend((i*sides+j,i*sides+(j+1)%sides,
                          (i+1)*sides+(j+1)%sides,(i+1)*sides+j) for j in range(sides))
        return self.add(vertices,faces,material,smooth)

    def sphere(self, center=(0,0,0), scale=(1,1,1), material='skin', sides=16, rings=10):
        vertices=[(0,0,-1)]
        for i in range(1,rings):
            t=-math.pi*.5+i*math.pi/rings
            for j in range(sides):
                a=j*math.tau/sides
                vertices.append((math.cos(t)*math.cos(a),math.cos(t)*math.sin(a),math.sin(t)))
        vertices.append((0,0,1))
        top=len(vertices)-1
        faces=[(0,1+(j+1)%sides,1+j) for j in range(sides)]
        for i in range(rings-2):
            a=1+i*sides;b=a+sides
            faces.extend((a+j,a+(j+1)%sides,b+(j+1)%sides,b+j) for j in range(sides))
        a=1+(rings-2)*sides
        faces.extend((top,a+j,a+(j+1)%sides) for j in range(sides))
        matrix=Matrix.Translation(center) @ Matrix.Diagonal((*scale,1))
        return self.add(vertices,faces,material,True,matrix)

    def rod(self, a, b, radius, material='metal', sides=10):
        a,b=Vector(a),Vector(b);direction=b-a
        q=Vector((1,0,0)).rotation_difference(direction.normalized())
        temporary=Geometry().loft([(-.5,radius,radius),(.5,radius,radius)],material,sides=sides)
        matrix=Matrix.Translation((a+b)*.5) @ q.to_matrix().to_4x4() @ Matrix.Diagonal((direction.length,1,1,1))
        return self.add(temporary.vertices,temporary.faces,material,True,matrix)


def toon_material(name, rgb):
    material=bpy.data.materials.new(name)
    # Portable soldier variants swap these palette materials temporarily.
    # Keep them editable after reopening the .blend, even when hidden gear
    # is currently using the player's default outfit instead.
    material.use_fake_user=True
    material.diffuse_color=(*rgb,1)
    material.use_nodes=True
    nodes=material.node_tree.nodes;nodes.clear()
    output=nodes.new('ShaderNodeOutputMaterial')
    diffuse=nodes.new('ShaderNodeBsdfDiffuse');diffuse.inputs['Color'].default_value=(1,1,1,1)
    diffuse.inputs['Roughness'].default_value=0
    conversion=nodes.new('ShaderNodeShaderToRGB')
    ramp=nodes.new('ShaderNodeValToRGB');ramp.color_ramp.interpolation='CONSTANT'
    stops=[(.0,.44),(.38,.76),(.70,1.0)]
    for element in list(ramp.color_ramp.elements)[1:]:ramp.color_ramp.elements.remove(element)
    for i,(position,gain) in enumerate(stops):
        element=ramp.color_ramp.elements[0] if i==0 else ramp.color_ramp.elements.new(position)
        element.position=position;element.color=(*(c*gain for c in rgb),1)
    emission=nodes.new('ShaderNodeEmission');emission.inputs['Strength'].default_value=1
    links=material.node_tree.links
    links.new(diffuse.outputs[0],conversion.inputs[0]);links.new(conversion.outputs[0],ramp.inputs[0])
    links.new(ramp.outputs[0],emission.inputs[0]);links.new(emission.outputs[0],output.inputs[0])
    material['toonBands']=[.44,.76,1.0];material['toonThresholds']=[.38,.70]
    material['baseColor']=rgb
    return material


def mesh_object(name, geometry, collection):
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(geometry.vertices,[],geometry.faces);mesh.update()
    names=list(dict.fromkeys(geometry.materials))
    for material in names:mesh.materials.append(MATERIALS[material])
    for polygon,material,smooth in zip(mesh.polygons,geometry.materials,geometry.smooth):
        polygon.material_index=names.index(material);polygon.use_smooth=smooth
    obj=bpy.data.objects.new(name,mesh);collection.objects.link(obj)
    return obj


def rigid_helmet_geometry():
    """Compact Army helmet with a high-cut brow and exposed human face.

    +X is the face. The old low, projecting peak blanketed the face from the
    game's elevated camera even though its eye-level opening was technically
    clear. A short brow, raised temples and flatter crown keep skin visible
    from both camera heights, while the rolled edge reads as a rigid shell.
    """
    geometry=Geometry();sides=20;cx=-.075;rx=1.055;ry=1.075;top=1.12

    def edge(angle):
        facing=math.cos(angle)
        # Army side/back protection stays behind the face, with a visibly
        # raised forehead and temple opening rather than a circular low skirt.
        return .29+.34*max(0,facing)**2-.30*max(0,-facing)**2

    profile=[(1.0,0),(.96,.26),(.80,.65),(.54,.93),(.22,.997)]
    vertices=[]
    for inner in [False,True]:
        for radius,height in profile:
            for j in range(sides):
                angle=j*math.tau/sides
                xradius=radius*rx-(.065 if inner else 0)
                yradius=radius*ry-(.065 if inner else 0)
                z=edge(angle)+(top-edge(angle))*height-(.045 if inner else 0)
                front_cut=.18*radius*max(0,math.cos(angle))**2
                vertices.append((cx+xradius*math.cos(angle)-front_cut,yradius*math.sin(angle),z))
    count=len(profile)*sides;faces=[]
    for inner in [False,True]:
        offset=count if inner else 0
        for i in range(len(profile)-1):
            for j in range(sides):
                face=(offset+i*sides+j,offset+i*sides+(j+1)%sides,
                      offset+(i+1)*sides+(j+1)%sides,offset+(i+1)*sides+j)
                faces.append(tuple(reversed(face)) if inner else face)
        crown=len(vertices);vertices.append((cx,0,top-(.045 if inner else 0)))
        last=offset+(len(profile)-1)*sides
        for j in range(sides):
            face=(crown,last+j,last+(j+1)%sides)
            faces.append(tuple(reversed(face)) if inner else face)
    # Connect the open head aperture through a real, thin shell edge. There
    # is deliberately no face spanning the opening and no lower neck wrap.
    for j in range(sides):
        faces.append((j,count+j,count+(j+1)%sides,(j+1)%sides))
    geometry.add(vertices,faces,'armor',True)

    # Angular rolled edge: four surface strips around the open aperture.
    band=[(1.045,-.055),(1.045,.020),(.995,.045),(.995,-.070)]
    vertices=[]
    for radius,lift in band:
        for j in range(sides):
            angle=j*math.tau/sides
            front_cut=.18*radius*max(0,math.cos(angle))**2
            vertices.append((cx+rx*radius*math.cos(angle)-front_cut,ry*radius*math.sin(angle),edge(angle)+lift))
    for i in range(4):
        faces=[(i*sides+j,i*sides+(j+1)%sides,((i+1)%4)*sides+(j+1)%sides,((i+1)%4)*sides+j) for j in range(sides)]
        geometry.add(vertices,faces,'armor' if i==1 else 'metal',False)

    # ACH/MICH-style shallow brow: a stiff lip, never a baseball-cap visor.
    # Its front stays inside the high-angle line of sight to the eye surface.
    lip=[(.54,-.70,.61),(.82,-.48,.58),(.88,-.22,.57),
         (.88,.22,.57),(.82,.48,.58),(.54,.70,.61)]
    vertices=lip+[(x,y,z+.070) for x,y,z in lip]
    geometry.add(vertices,[tuple(reversed(range(6))),tuple(range(6,12))],'armor')
    geometry.add(vertices,[(j,(j+1)%6,(j+1)%6+6,j+6) for j in range(6)],'metal')
    # Small temple fasteners reinforce the helmet outline without covering
    # cheeks, eyes or chin. They share the rim batch rather than adding draws.
    for sign in [-1,1]:
        geometry.box((.14,sign*1.065,.40),(.22,.065,.12),'metal',.10)
    return geometry


def army_webbing_geometry():
    """One economical infantry kit: exposed shirt between straps and pouches."""
    geometry=Geometry()
    for sign in [-1,1]:
        geometry.box((.76,sign*.49,.12),(.19,.18,1.42),'metal',.08)
        geometry.box((-.74,sign*.49,.12),(.19,.18,1.42),'metal',.08)
        geometry.box((0,sign*.49,.80),(1.43,.18,.16),'metal',.08)
    geometry.loft([(-.73,.90,.91),(-.57,.90,.91)],'metal','Z',12,False)
    for lateral in [-.49,0,.49]:
        geometry.box((.91,lateral,-.30),(.30,.34,.55),'armor',.13)
        geometry.box((1.065,lateral,-.13),(.035,.36,.13),'metal',.10)
    geometry.box((.94,0,-.65),(.12,.25,.19),'armor',.10)
    return geometry


def army_platecarrier_geometry():
    """One heavy kit with chamfered plates, broad straps and magazine pouches."""
    geometry=Geometry().loft([(-.80,.72,.76),(-.59,.91,.94),(.42,.96,.98),(.83,.65,.72)],
                             'armor','Z',8,False)
    geometry.box((.94,0,.24),(.23,1.20,.68),'armor',.13)
    geometry.box((-.92,0,.15),(.23,1.31,1.03),'armor',.13)
    for sign in [-1,1]:
        geometry.box((0,sign*.53,.79),(1.36,.24,.19),'metal',.09)
        geometry.box((.77,sign*.53,.54),(.18,.24,.55),'metal',.09)
    geometry.loft([(-.77,.91,.93),(-.60,.91,.93)],'metal','Z',12,False)
    for lateral in [-.48,0,.48]:
        geometry.box((1.01,lateral,-.32),(.31,.36,.52),'armor',.13)
        geometry.box((1.17,lateral,-.15),(.035,.38,.13),'metal',.10)
    return geometry


def make_library(collection):
    geometries={}
    # A round, featureless silhouette in every view, including fallen bodies.
    # Facial marks stay on the surface; ears and the projecting nose formerly
    # extended the head bounds and made rotated/corpse heads read as an egg.
    g=Geometry().sphere(sides=24,rings=16)
    for sign in [-1,1]:
        g.sphere((.91,sign*.34,.10),(.075,.10,.075),'ink',10,6)
        g.box((.89,sign*.34,.28),(.09,.22,.045),'wood')
    g.box((.88,0,-.43),(.08,.30,.025),'wood')
    # Tiny surface marks must never alter the spherical outline. Their inner
    # geometry can remain under the skin, while their exposed faces sit on it.
    g.vertices=[tuple(Vector(v)/max(1,Vector(v).length)) for v in g.vertices]
    geometries['head']=g
    geometries['torso']=Geometry().loft([(-1,.60,.60),(-.65,.85,.76),(.25,1,.90),(.72,.91,.76),(1,.60,.50)],'shirt','Z',16)
    geometries['pelvis']=Geometry().sphere(scale=(.84,1,.67),material='pants')
    geometries['hand']=Geometry().sphere(scale=(1,.78,.61))
    # Plain seam-fill mass. It has the same unit-radius convention as head
    # and hand, but no facial geometry or baked taper. The runtime sizes it
    # to each native joint's actual diameter instead of inventing a new build.
    geometries['joint']=Geometry().sphere(material='shirt')
    for name,material,radii in [
        # Native sleeves are a continuous shoulder/elbow/wrist ribbon. With
        # upperW:foreW=1:.8, both meshes meet at elbowW=.9*upperW=1.125*foreW.
        # Old capped bicep profiles narrowed to .34/.36 here and visibly lost
        # the broad, continuous native elbow even when their maxima matched.
        ('upper_arm','shirt',[(-.5,.50,.50),(-.25,.4875,.4875),(.25,.4625,.4625),(.5,.45,.45)]),
        ('forearm','shirt',[(-.5,.5625,.5625),(-.25,.546875,.546875),(.25,.515625,.515625),(.5,.50,.50)]),
        ('thigh','pants',[(-.5,.40,.40),(-.28,.52,.52),(.20,.46,.44),(.5,.34,.34)]),
        ('shin','pants',[(-.5,.34,.34),(-.27,.43,.43),(.26,.32,.31),(.5,.27,.27)])]:
        geometries[name]=Geometry().loft(radii,material,sides=12)
    geometries['foot']=Geometry().box((0,0,-.06),(1,.55,.19),'boots').box((-.04,0,.085),(.88,.47,.27),'boots').box((-.27,0,.22),(.32,.39,.39),'boots')
    geometries['helmet']=rigid_helmet_geometry()
    geometries['visor']=Geometry().box((.95,0,.03),(.22,1.80,.65),'glass').box((.95,0,.40),(.25,1.98,.15),'metal')
    hood=Geometry().sphere((-.10,0,.11),(1.13,1.10,1.10),'ninja')
    # Cowl is open at the face, retaining a visible inset skin surface.
    keep=[i for i,f in enumerate(hood.faces) if not all(hood.vertices[j][0]>.43 and -.70<hood.vertices[j][2]<.72 for j in f)]
    hood.faces=[hood.faces[i] for i in keep];hood.materials=[hood.materials[i] for i in keep];hood.smooth=[hood.smooth[i] for i in keep]
    geometries['hood']=hood
    geometries['cowboy_hat']=Geometry().loft([(-.05,1.62,1.75),(.035,1.67,1.78),(.12,1.26,1.30)],'hat','Z',24).loft([(.10,.86,.96),(.86,.79,.82),(.98,.58,.73)],'hat','Z',16).loft([(.17,.88,.98),(.30,.87,.96)],'wood','Z',16)
    geometries['vest']=Geometry().loft([(-.80,.71,.77),(-.55,.91,.88),(.65,1.03,.94),(.85,.73,.63)],'armor','Z',16)
    geometries['army_webbing']=army_webbing_geometry()
    geometries['army_platecarrier']=army_platecarrier_geometry()
    geometries['coat']=Geometry().loft([(-1.55,.89,1.0),(-.5,.78,.83),(.65,1,.89),(1,.60,.51)],'white','Z',16)
    g=Geometry().box((0,0,0),(.55,1,.80),'metal')
    for side in [-1,1]:
        g.rod((0,side*.45,-.55),(0,side*.45,.45),.23,'steel',12)
        g.rod((0,side*.45,-.57),(0,side*.45,-.38),.18,'ink',12)
    g.box((-.31,0,.10),(.10,.33,.32),'energy');geometries['jetpack']=g
    # Weapons all point along +X. Their center is independent of the socket;
    # runtime weapon-mount metadata positions the actual hand and muzzle.
    def gun(name,kind):
        g=Geometry();long=kind in ['rifle','shotgun','coach_gun','particle_beam','rocket']
        if kind=='rocket':
            g.rod((-.5,0,.02),(.5,0,.02),.115,'armor',16)
            g.rod((.43,0,.02),(.50,0,.02),.14,'metal',16)
            g.box((-.04,0,-.14),(.12,.08,.22),'metal').box((0,0,.18),(.15,.08,.08),'glass')
        elif kind=='revolver':
            g.box((-.17,0,0),(.30,.12,.13),'steel').rod((-.12,0,.015),(.10,0,.015),.10,'steel',12)
            g.rod((.08,0,.035),(.50,0,.035),.042,'steel').box((-.29,0,-.16),(.18,.12,.29),'wood')
        elif kind=='bow':
            for side in [-1,1]:
                points=[(0,0,0),(-.10,side*.30,0),(-.30,side*.65,0),(-.42,side*1.0,0),(-.31,side*1.25,0)]
                for a,b in zip(points,points[1:]):g.rod(a,b,.045,'wood',8)
            g.rod((-.31,-1.25,0),(-.31,1.25,0),.011,'white',6)
            g.box((.01,0,0),(.14,.24,.12),'wood')
            # Real nocked arrow gives the runtime an honest grip-to-muzzle
            # scale. Normalizing the curved bow alone made its width enormous.
            g.rod((-.50,0,0),(2.64,0,0),.014,'wood',8)
            g.loft([(2.60,.065,.018),(2.80,.001,.001)],'steel',sides=4,smooth=False)
            g.add([(-.47,0,0),(-.30,.11,0),(-.18,0,0),(-.30,-.11,0)],[(0,1,2),(0,2,3)],'white')
        elif long:
            g.box((-.36,0,-.015),(.28,.12,.18),'wood' if kind!='particle_beam' else 'metal')
            g.box((-.02,0,.02),(.43,.13,.15),'metal').rod((.16,0,.035),(.5,0,.035),.035,'metal')
            g.box((.19,0,-.025),(.24,.15,.11),'wood' if kind!='particle_beam' else 'energy')
            g.box((-.10,0,-.13),(.09,.09,.19),'wood' if kind!='particle_beam' else 'metal')
            if kind=='rifle':g.box((.015,0,-.15),(.095,.085,.24),'metal')
            if kind=='coach_gun':g.rod((.05,.045,.035),(.5,.045,.035),.038,'steel').rod((.05,-.045,.035),(.5,-.045,.035),.038,'steel')
            g.box((-.05,0,.12),(.10,.035,.04),'ink').box((.43,0,.10),(.025,.025,.06),'ink')
        else:
            g.box((.08,0,.035),(.72 if kind=='smg' else .64,.14,.14),'metal' if kind!='taser' else 'gold')
            g.rod((.25,0,.035),(.50,0,.035),.038,'steel')
            g.box((-.17,0,-.15),(.15,.11,.31),'metal').box((-.17,0,-.29),(.17,.13,.04),'ink')
            if kind=='smg':g.box((.10,0,-.16),(.10,.085,.24),'metal')
            g.box((.35,0,.135),(.035,.035,.05),'ink')
        return g
    for name in ['pistol','revolver','smg','rifle','shotgun','coach_gun','rocket','bow','taser','particle_beam']:
        if name in NATIVE_WEAPONS:
            model=NATIVE_WEAPONS[name];geometry=Geometry()
            for box in model['boxes']:
                x0,x1,y0,y1,z0,z1=box['bounds']
                material='native_rgb_'+''.join(f'{int(c):02x}' for c in box['color'])
                geometry.box(((x0+x1)*.5,(y0+y1)*.5,(z0+z1)*.5),
                             (x1-x0,y1-y0,z1-z0),material,bevel=.025)
            for line in model['details']:
                if (Vector(line['b'])-Vector(line['a'])).length<1e-8:continue
                material='native_rgb_'+''.join(f'{int(c):02x}' for c in line['color'])
                geometry.rod(line['a'],line['b'],line['width']*.5,material,8)
            geometries[name]=geometry
        else:geometries[name]=gun(name,name)
    geometries['sword']=Geometry().box((-.33,0,0),(.30,.065,.07),'wood').box((-.16,0,0),(.06,.34,.07),'gold').loft([(-.13,.045,.025),(.38,.040,.025),(.5,.001,.001)],'steel',sides=4,smooth=False)
    geometries['pickaxe']=Geometry().rod((-.5,0,0),(.42,0,0),.035,'wood').rod((.36,-.30,0),(.46,0,.04),.045,'steel').rod((.46,0,.04),(.34,.36,0),.045,'steel')
    geometries['shovel']=Geometry().rod((-.5,0,0),(.27,0,0),.028,'wood').box((.36,0,0),(.28,.25,.045),'steel').box((-.46,0,0),(.05,.20,.05),'metal')
    geometries['cannon']=Geometry().loft([(-.5,.24,.24),(-.32,.29,.29),(.40,.25,.25),(.5,.32,.32)],'steel',sides=16).loft([(.47,.20,.20),(.51,.20,.20)],'ink',sides=16)
    geometries['grenade']=Geometry().sphere(scale=(.72,.72,1),material='armor').box((0,0,1),(.50,.34,.22),'metal')
    geometries['flask']=Geometry().sphere(scale=(.55,.55,.8),material='glass').box((0,0,.93),(.32,.32,.35),'white')
    geometries['cap']=Geometry().loft([(-.015,.5,.5),(.015,.5,.5)],'blood',sides=16,smooth=False)
    geometries['torso_cap']=Geometry().loft([(-.015,.85,.52),(.015,.85,.52)],'blood',sides=16,smooth=False)
    for name,geometry in geometries.items():
        weapons={'pistol','revolver','smg','rifle','shotgun','coach_gun','rocket','bow','taser','particle_beam','sword','pickaxe','shovel','cannon'}
        if name in weapons:
            lo=min(v[0] for v in geometry.vertices);hi=max(v[0] for v in geometry.vertices)
            span=hi-lo;center=(hi+lo)*.5
            if name in NATIVE_WEAPONS:
                spec=NATIVE_WEAPONS[name]
                normalized=lambda p:[round((p[0]-center)/span,6),round(p[1]/span,6),round(p[2]/span,6)]
                SOCKETS[name]={'grip':normalized(spec['grip']),'muzzle':normalized(spec['muzzle'])}
            else:
                grip_x={'bow':0,'sword':-.33,'pickaxe':-.25,'shovel':-.25,'cannon':-.35,'rocket':-.04,'revolver':-.29}.get(name,-.17 if name in ['pistol','smg','taser'] else -.10)
                SOCKETS[name]={'grip':[round((grip_x-center)/span,6),0,0],'muzzle':[.5,0,0]}
            geometry.vertices=[((x-center)/span,y/span,z/span) for x,y,z in geometry.vertices]
        obj=mesh_object(name,geometry,collection);obj.hide_render=True;obj.hide_viewport=True
        obj['runtimeSockets']=json.dumps(SOCKETS.get(name,{}))
        LIBRARY[name]=obj


def source_part(name,semantic,center,scale=(1,1,1),direction=None,bone=None,material_override=None,visible=True,collection=None):
    # Real skinning requires independent deform groups for left/right parts;
    # Blender shares those groups along with linked Mesh data. Export detects
    # edited source geometry and synchronizes each semantic runtime part.
    obj=bpy.data.objects.new(name,LIBRARY[semantic].data.copy());collection.objects.link(obj)
    obj.location=center;obj.scale=scale
    if direction is not None:obj.rotation_mode='QUATERNION';obj.rotation_quaternion=Vector((1,0,0)).rotation_difference(Vector(direction).normalized())
    if material_override:
        for i,mat in enumerate(obj.data.materials):
            if mat.name in ['shirt','pants','boots']:obj.data.materials[i]=MATERIALS[material_override]
    obj['semantic']=semantic;obj['bone']=bone or 'root';obj['variantVisible']=visible
    obj.hide_render=not visible;obj.hide_viewport=not visible
    SOURCE.append(obj)
    return obj


def assemble(body_collection,equipment_collection):
    armature=bpy.data.armatures.new('PlayerSkeleton')
    rig=bpy.data.objects.new('PlayerRig',armature);body_collection.objects.link(rig)
    bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    bone_defs=[('root',(0,0,0),(0,0,.20),None),('pelvis',(0,0,.92),(0,0,1.08),'root'),
               ('spine',(0,0,1.08),(0,0,1.24),'pelvis'),('chest',(0,0,1.24),(0,0,1.45),'spine'),
               ('neck',(0,0,1.45),(0,0,1.54),'chest'),('head',(0,0,1.54),(0,0,1.78),'neck')]
    for side,sign in [('L',1),('R',-1)]:
        bone_defs.extend([(f'upper_arm.{side}',(0,sign*.25,1.43),(.025,sign*.34,1.10),'chest'),
                          (f'forearm.{side}',(.025,sign*.34,1.10),(.06,sign*.39,.82),f'upper_arm.{side}'),
                          (f'hand.{side}',(.06,sign*.39,.82),(.08,sign*.41,.69),f'forearm.{side}'),
                          (f'thigh.{side}',(0,sign*.115,.94),(.015,sign*.12,.53),'pelvis'),
                          (f'shin.{side}',(.015,sign*.12,.53),(0,sign*.12,.12),f'thigh.{side}'),
                          (f'foot.{side}',(0,sign*.12,.12),(.21,sign*.12,.07),f'shin.{side}')])
    for name,head,tail,parent in bone_defs:
        bone=armature.edit_bones.new(name);bone.head=head;bone.tail=tail
        if parent:bone.parent=armature.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT');rig.show_in_front=True
    source_part('Shirt','torso',(0,0,1.20),(.19,.265,.29),bone='chest',collection=body_collection)
    source_part('Trousers pelvis','pelvis',(-.015,0,.93),(.17,.20,.16),bone='pelvis',collection=body_collection)
    source_part('Bald head','head',(.015,0,1.66),(.15,.15,.15),bone='head',collection=body_collection)
    for side,sign in [('L',1),('R',-1)]:
        for semantic,width in [('upper_arm',.23),('forearm',.184),('thigh',.28),('shin',.22)]:
            definition=next(b for b in bone_defs if b[0]==f'{semantic}.{side}')
            a,b=Vector(definition[1]),Vector(definition[2])
            source_part(f'{semantic}.{side}',semantic,(a+b)*.5,((b-a).length,width,width),b-a,f'{semantic}.{side}',collection=body_collection)
        shoulder=next(b for b in bone_defs if b[0]==f'upper_arm.{side}')[1]
        elbow=next(b for b in bone_defs if b[0]==f'forearm.{side}')[1]
        source_part(f'Sleeve shoulder.{side}','joint',shoulder,(.115,.115,.115),
                    bone=f'upper_arm.{side}',collection=body_collection)
        source_part(f'Sleeve elbow.{side}','joint',elbow,(.1035,.1035,.1035),
                    bone=f'forearm.{side}',collection=body_collection)
        source_part(f'hand.{side}','hand',(.075,sign*.40,.765),(.07,.057,.072),bone=f'hand.{side}',collection=body_collection)
        source_part(f'boot.{side}','foot',(.075,sign*.12,.07),(.32,.34,.30),bone=f'foot.{side}',collection=body_collection)
    for name,semantic,center,scale,bone in [
        ('Armor vest','vest',(0,0,1.20),(.20,.27,.30),'chest'),
        ('NM0 infantry webbing','army_webbing',(0,0,1.20),(.20,.27,.30),'chest'),
        ('NM0 armored plate carrier','army_platecarrier',(0,0,1.20),(.20,.27,.30),'chest'),
        ('Chemist coat','coat',(0,0,1.20),(.205,.28,.30),'chest'),
        ('Ninja hood','hood',(.015,0,1.66),(.15,.15,.15),'head'),
        ('Cowboy hat','cowboy_hat',(.015,0,1.78),(.145,.14,.15),'head'),
        ('Armor helmet','helmet',(.015,0,1.66),(.15,.15,.15),'head'),
        ('Armor visor','visor',(.015,0,1.66),(.15,.15,.15),'head'),
        ('Jetpack','jetpack',(-.24,0,1.22),(.25,.30,.32),'chest')]:
        source_part(name,semantic,center,scale,bone=bone,visible=False,collection=equipment_collection)
    for side in ['L','R']:
        definition=next(b for b in bone_defs if b[0]==f'upper_arm.{side}')
        a,elbow=Vector(definition[1]),Vector(definition[2]);b=a+(elbow-a)*.38
        cap=source_part(f'NM0 armored shoulder.{side}','upper_arm',(a+b)*.5,
                        ((b-a).length,.23*1.16,.23*1.08),b-a,f'upper_arm.{side}',
                        'nm0_plate',False,equipment_collection)
        cap['soldierKit']='army_platecarrier'
    for i,name in enumerate(['pistol','revolver','smg','rifle','shotgun','coach_gun','rocket','bow','taser','particle_beam','sword','pickaxe','shovel','cannon','grenade','flask']):
        # Park optional equipment in an organized hidden collection; all are
        # editable and exportable without cluttering the default silhouette.
        source_part('Equipment '+name,name,(.22,-.42,.76),(.40,.40,.40),bone='hand.R',visible=False,collection=equipment_collection)
    for obj in SOURCE:
        group=obj.vertex_groups.new(name=obj['bone']);group.add(list(range(len(obj.data.vertices))),1.0,'REPLACE')
        modifier=obj.modifiers.new('Player skin','ARMATURE');modifier.object=rig
        obj.parent=rig
        # Seam-fill masses are the sleeve interior, not separate cuff rings.
        # Their shell ink would intersect the adjoining sleeve shells in
        # Blender even though all three pieces share one material contour.
        if obj['semantic']=='joint':
            obj['outlineWidth']=0
            continue
        # Outline material uses an inverted hull in EEVEE, not a painted image.
        if not obj.data.materials or obj.data.materials[-1]!=MATERIALS['ink']:
            obj.data.materials.append(MATERIALS['ink'])
        outline=obj.modifiers.new('Cel silhouette','SOLIDIFY');outline.thickness=.018
        outline.offset=1;outline.use_flip_normals=True;outline.material_offset=len(obj.data.materials)-1
        outline.material_offset_rim=len(obj.data.materials)-1
        obj['outlineWidth']=.018
    for name,bone,point in [('grip.R','hand.R',(.08,-.41,.75)),('grip.L','hand.L',(.08,.41,.75)),
                             ('muzzle','hand.R',(.50,-.41,.77)),('headwear','head',(0,0,1.78)),('back','chest',(-.24,0,1.23))]:
        empty=bpy.data.objects.new('socket.'+name,None);equipment_collection.objects.link(empty)
        empty.empty_display_size=.04;empty.empty_display_type='ARROWS';empty.parent=rig
        empty['bone']=bone;empty.parent_type='BONE';empty.parent_bone=bone
        bpy.context.view_layer.update();empty.matrix_world=Matrix.Translation(point)
    # A genuine armature action demonstrates editability. Game animation is
    # driven by native timers, not by this illustrative idle clip.
    rig.animation_data_create()
    for frame,angle in [(1,-.018),(16,.018),(31,-.018)]:
        rig.pose.bones['chest'].rotation_mode='XYZ';rig.pose.bones['chest'].rotation_euler.y=angle
        rig.pose.bones['chest'].keyframe_insert(data_path='rotation_euler',frame=frame,group='Chest breathing')
    if rig.animation_data.action:rig.animation_data.action.name='Player_Idle_Preview'
    bpy.context.scene.frame_set(1)
    return rig


def export_compact():
    meshes={}
    for name,obj in LIBRARY.items():
        mesh=obj.data;mesh.calc_loop_triangles()
        positions=[];normals=[];indices=[];groups=[]
        # Group by material for small, contiguous uniform-color draw batches.
        material_indices=sorted(set(t.material_index for t in mesh.loop_triangles))
        for material_index in material_indices:
            start=len(indices)
            for triangle in mesh.loop_triangles:
                if triangle.material_index!=material_index:continue
                for vi in triangle.vertices:
                    vertex=mesh.vertices[vi];normal=vertex.normal if mesh.polygons[triangle.polygon_index].use_smooth else triangle.normal
                    positions.extend(round(v,6) for v in vertex.co)
                    normals.extend(round(v,6) for v in normal)
                    indices.append(len(indices))
            groups.append({'start':start,'count':len(indices)-start,'material':mesh.materials[material_index].name})
        meshes[name]={'positions':positions,'normals':normals,'indices':indices,'material':groups[0]['material'],'materialGroups':groups}
        meshes[name].update(json.loads(obj.get('runtimeSockets','{}')))
    result={'schemaVersion':1,'axis':'+X forward, +Y lateral, +Z up',
            'normalization':'limbs x=-0.5..0.5; head/torso/pelvis/hand/joint unit radius; weapons authored around their grip',
            'palette':{name:[round(c,6) for c in rgb] for name,rgb in PALETTE.items()},'toon':{'thresholds':[.38,.70],'bands':[.44,.76,1.0]},'meshes':meshes}
    validate(result)
    (OUT/'player-mesh.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
    return result


def validate(data):
    required={'head','torso','pelvis','upper_arm','forearm','hand','joint','thigh','shin','foot','helmet','hood','cowboy_hat','vest','coat','jetpack','pistol','revolver','smg','rifle','shotgun','rocket','bow','sword','pickaxe','shovel','cannon'}
    assert data['schemaVersion']==1 and required<=data['meshes'].keys()
    for name,mesh in data['meshes'].items():
        p,n,ix=mesh['positions'],mesh['normals'],mesh['indices']
        assert len(p)==len(n) and len(p)%3==0 and len(ix)%3==0,name
        assert all(math.isfinite(v) for v in p+n),name
        assert all(0<=i<len(p)//3 for i in ix),name
        assert all(abs(sum(c*c for c in n[i:i+3])-1)<.025 for i in range(0,len(n),3)),name
        assert sum(g['count'] for g in mesh['materialGroups'])==len(ix),name
        assert all(g['material'] in data['palette'] for g in mesh['materialGroups']),name
        for i in range(0,len(ix),3):
            a,b,c=(Vector(p[ix[i+j]*3:ix[i+j]*3+3]) for j in range(3))
            assert (b-a).cross(c-a).length>1e-10,(name,i,'degenerate triangle')
    base=['head','torso','pelvis','upper_arm','forearm','hand','thigh','shin','foot']
    triangles=sum(len(data['meshes'][name]['indices'])//3*(2 if name in ['upper_arm','forearm','hand','thigh','shin','foot'] else 1) for name in base)
    triangles+=4*len(data['meshes']['joint']['indices'])//3
    assert triangles<10000,triangles
    helmet=data['meshes']['helmet'];hood=data['meshes']['hood']
    assert min(helmet['positions'][2::3])>-.20,'Helmet must leave the lower head and neck exposed'
    assert min(helmet['positions'][2::3])-min(hood['positions'][2::3])>.60,'Helmet must have a shallower opening than the cloth hood'
    assert .84<max(helmet['positions'][0::3])<.91,'Army brow must remain behind the face surface even from overhead'
    assert max(helmet['positions'][2::3])<1.18,'Army crown must remain compact rather than egg-shaped'
    assert len(helmet['indices'])//3<=700,'Army helmet must stay cheaper than the previous shell'
    for name in ['army_webbing','army_platecarrier']:
        assert name in data['meshes'] and len(data['meshes'][name]['materialGroups'])<=2,(name,'kit batch budget')
        assert len(data['meshes'][name]['indices'])//3<=500,(name,'kit triangle budget')
    print('PLAYER_MESH_VALID',len(data['meshes']),'semantic meshes,',triangles,'base triangles')


def validate_scene(rig):
    assert rig and rig.type=='ARMATURE' and len(rig.data.bones)==18
    for obj in SOURCE:
        assert obj['bone'] in rig.data.bones,obj.name
        assert any(m.type=='ARMATURE' and m.object==rig for m in obj.modifiers),obj.name
        assert geometry_signature(obj)==geometry_signature(LIBRARY[obj['semantic']]),(obj.name,'runtime geometry mismatch')
        for vertex in obj.data.vertices:
            assert abs(sum(g.weight for g in vertex.groups)-1)<1e-6,(obj.name,vertex.index,'skin weight')
    assert all(bpy.data.objects.get('socket.'+name) for name in ['grip.R','grip.L','muzzle','headwear','back'])
    print('PLAYER_RIG_VALID',len(rig.data.bones),'bones,',len(SOURCE),'weighted objects')


def geometry_signature(obj):
    return (tuple(tuple(round(c,6) for c in vertex.co) for vertex in obj.data.vertices),
            tuple((tuple(p.vertices),p.material_index) for p in obj.data.polygons))


def sync_source_edits():
    for name,library in LIBRARY.items():
        baseline=geometry_signature(library)
        matching=[obj for obj in SOURCE if obj['semantic']==name]
        changed=[obj for obj in matching if geometry_signature(obj)!=baseline]
        signatures={geometry_signature(obj) for obj in changed}
        if len(signatures)>1:
            raise RuntimeError('Conflicting manual edits for shared runtime part '+name+'; make left/right geometry identical before export')
        if not changed:continue
        canonical=changed[0]
        for obj in matching:
            if geometry_signature(obj)==geometry_signature(canonical):continue
            obj.data=canonical.data.copy();obj.vertex_groups.clear()
            group=obj.vertex_groups.new(name=obj['bone'])
            group.add(list(range(len(obj.data.vertices))),1.0,'REPLACE')
        library.data=canonical.data.copy();library.vertex_groups.clear()


def stage_and_render(skip):
    scene=bpy.context.scene;scene.render.engine='CYCLES'
    # EEVEE's Shader-to-RGB nodes are the source's editable toon material.
    # Headless preview uses EEVEE where the Mesa EGL device is available.
    scene.render.engine='BLENDER_EEVEE_NEXT'
    scene.render.resolution_x=640;scene.render.resolution_y=800;scene.render.resolution_percentage=100
    scene.eevee.taa_render_samples=32
    scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
    scene.render.image_settings.color_mode='RGBA'
    scene.world.color=(.12,.12,.12)
    scene.view_settings.view_transform='Standard';scene.view_settings.look='Medium High Contrast'
    stage=bpy.data.collections.new('Presentation');scene.collection.children.link(stage)
    ground_material=bpy.data.materials.new('Backdrop');ground_material.diffuse_color=(.18,.24,.29,1)
    geometry=Geometry().box((0,0,-.045),(200,200,.05),'metal')
    ground=mesh_object('Ground',geometry,stage);ground.data.materials.clear();ground.data.materials.append(ground_material)
    for name,location,power,size in [('Key',(3,-4,6),1250,5),('Fill',(-3,2,4),650,4)]:
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
        obj=bpy.data.objects.new(name,data);stage.objects.link(obj);obj.location=location
        obj.rotation_euler=(Vector((0,0,1))-obj.location).to_track_quat('-Z','Y').to_euler()
    camera_data=bpy.data.cameras.new('PlayerCamera');camera=bpy.data.objects.new('PlayerCamera',camera_data)
    stage.objects.link(camera);scene.camera=camera;camera_data.type='ORTHO';camera_data.ortho_scale=2.25
    views={'three-quarter':(4,-6,3.4),'front':(6,0,2.2),'back':(-6,0,2.2),'overhead':(2,-2,8)}
    for name,location in views.items():
        camera.location=location;camera.rotation_euler=(Vector((0,0,.92))-camera.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(OUT/('player-'+name+'.png'))
        if not skip:bpy.ops.render.render(write_still=True)
    camera.location=views['three-quarter'];camera.rotation_euler=(Vector((0,0,.92))-camera.location).to_track_quat('-Z','Y').to_euler()
    if not skip:render_headwear_previews()


def render_headwear_previews():
    """Render the actual source helmet and unchanged cloth hood for review."""
    scene=bpy.context.scene;camera=scene.camera
    sources=[obj for obj in bpy.data.objects if obj.type=='MESH' and 'semantic' in obj]
    helmet=next(obj for obj in sources if obj['semantic']=='helmet')
    hood=next(obj for obj in sources if obj['semantic']=='hood')
    head=next(obj for obj in sources if obj['semantic']=='head')
    visible={obj.name:obj.hide_render for obj in sources}
    camera_matrix=camera.matrix_world.copy();ortho=camera.data.ortho_scale
    resolution=(scene.render.resolution_x,scene.render.resolution_y)
    render_path=scene.render.filepath
    comparison=bpy.data.collections.new('Temporary headwear comparison');scene.collection.children.link(comparison)
    try:
        # A full-player preview also proves that the opening is above the
        # face, rather than disguising an unchanged full-head cowl by color.
        helmet.hide_render=False
        camera.location=(4,-6,3.4)
        camera.rotation_euler=(Vector((0,0,.92))-camera.location).to_track_quat('-Z','Y').to_euler()
        camera.data.ortho_scale=2.25
        scene.render.resolution_x=640;scene.render.resolution_y=800
        scene.render.filepath=str(OUT/'player-helmet.png');bpy.ops.render.render(write_still=True)
        for obj in sources:obj.hide_render=True
        for offset,wear in [(-.26,helmet),(.26,hood)]:
            for original in [head,wear]:
                obj=original.copy();comparison.objects.link(obj)
                obj.location.y+=offset;obj.hide_render=False;obj.hide_viewport=False;obj.hide_set(False)
        target=Vector((head.location.x,0,head.location.z))
        camera.location=(5,-1,3.5)
        camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
        camera.data.ortho_scale=.95
        scene.render.resolution_x=1120;scene.render.resolution_y=640
        scene.render.filepath=str(OUT/'player-headwear-comparison.png');bpy.ops.render.render(write_still=True)
    finally:
        for obj in list(comparison.objects):bpy.data.objects.remove(obj,do_unlink=True)
        bpy.data.collections.remove(comparison)
        for obj in sources:obj.hide_render=visible[obj.name]
        camera.matrix_world=camera_matrix;camera.data.ortho_scale=ortho
        scene.render.resolution_x,scene.render.resolution_y=resolution
        scene.render.filepath=render_path


def export_glb(rig,filename='player.glb'):
    # glTF uses standard materials. Keep original editable toon node graphs in
    # the .blend and export their palette as portable base colors, not a false
    # promise that Shader-to-RGB is a glTF shader feature.
    replacement={}
    for name,rgb in PALETTE.items():
        mat=bpy.data.materials.new(name+'_gltf');mat.use_nodes=True
        bsdf=mat.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(*rgb,1)
        bsdf.inputs['Roughness'].default_value=.88
        mat['toonBands']=[.44,.76,1.0];replacement[name]=mat
    saved=[];seen_meshes=set()
    visibility={obj.name:(obj.hide_render,obj.hide_viewport,obj.hide_get()) for obj in SOURCE}
    outline_state={(obj.name,m.name):(m.show_viewport,m.show_render) for obj in SOURCE for m in obj.modifiers if m.type=='SOLIDIFY'}
    bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
    for obj in bpy.data.objects:
        if obj.name.startswith('socket.'):obj.select_set(True)
    for obj in SOURCE:
        # glTF has no standard hidden-mesh flag. Export the visible assembled
        # character, rather than stacking every optional outfit and weapon on
        # top of it. All optional meshes remain in .blend and runtime JSON.
        if obj.hide_render or obj.hide_viewport:continue
        obj.hide_set(False);obj.hide_viewport=False;obj.select_set(True)
        for modifier in obj.modifiers:
            if modifier.type=='SOLIDIFY':modifier.show_viewport=False;modifier.show_render=False
        if obj.data.name not in seen_meshes:
            seen_meshes.add(obj.data.name)
            for slot in obj.material_slots:
                saved.append((slot,slot.material));slot.material=replacement.get(slot.material.name,slot.material)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=str(OUT/filename),export_format='GLB',use_selection=True,
                              export_animations=True,export_skins=True,export_extras=True,export_apply=False)
    for slot,material in saved:slot.material=material
    for obj in SOURCE:
        obj.hide_render,obj.hide_viewport,hidden=visibility[obj.name];obj.hide_set(hidden)
        for modifier in obj.modifiers:
            if modifier.type=='SOLIDIFY':modifier.show_viewport,modifier.show_render=outline_state[(obj.name,modifier.name)]


def export_helmet_variant(rig):
    helmet=next(obj for obj in SOURCE if obj['semantic']=='helmet')
    hidden=(helmet.hide_render,helmet.hide_viewport,helmet.hide_get())
    try:
        helmet.hide_render=False;helmet.hide_viewport=False;helmet.hide_set(False)
        export_glb(rig,'player-helmet.glb')
    finally:
        helmet.hide_render,helmet.hide_viewport,hide_set=hidden;helmet.hide_set(hide_set)


def export_soldier_variants(rig,render=False):
    """The same bone-attached kit pieces are portable worn Blender variants."""
    scene=bpy.context.scene
    visibility={obj.name:(obj.hide_render,obj.hide_viewport,obj.hide_get()) for obj in SOURCE}
    materials=[(slot,slot.material) for obj in SOURCE for slot in obj.material_slots]
    render_path=scene.render.filepath
    camera=scene.camera
    camera_matrix=camera.matrix_world.copy() if camera else None
    try:
        for kit,weapon,filename in [('army_webbing','rifle','nm0-grey-soldier'),
                                    ('army_platecarrier','pistol','nm0-armored-soldier')]:
            heavy=kit=='army_platecarrier'
            for obj in SOURCE:
                semantic=obj['semantic']
                visible=bool(obj.get('variantVisible')) or semantic in [kit,'helmet',weapon] or obj.get('soldierKit')==kit
                obj.hide_render=not visible;obj.hide_viewport=not visible;obj.hide_set(not visible)
                for slot in obj.material_slots:
                    original=next(material for saved,material in materials if saved==slot)
                    name=original.name
                    replacement=('nm0_heavy_cloth' if heavy else 'nm0_cloth') if name=='shirt' else ('nm0_heavy_trousers' if heavy else 'nm0_trousers') if name=='pants' else None
                    if name=='boots':replacement='nm0_heavy_boots' if heavy else 'nm0_boots'
                    if semantic in ['army_webbing','army_platecarrier']:
                        replacement=('nm0_plate' if heavy else 'nm0_webbing') if name=='armor' else ('nm0_plate_trim' if heavy else 'nm0_trim') if name=='metal' else replacement
                    if semantic=='helmet':
                        replacement=('nm0_heavy_helmet' if heavy else 'nm0_helmet') if name=='armor' else ('nm0_heavy_helmet_trim' if heavy else 'nm0_helmet_trim') if name=='metal' else replacement
                    slot.material=MATERIALS[replacement] if replacement else original
            export_glb(rig,filename+'.glb')
            if render and camera:
                camera.location=(4,-6,3.4)
                camera.rotation_euler=(Vector((0,0,.92))-camera.location).to_track_quat('-Z','Y').to_euler()
                scene.render.filepath=str(OUT/(filename+'.png'));bpy.ops.render.render(write_still=True)
    finally:
        for slot,material in materials:slot.material=material
        for obj in SOURCE:
            obj.hide_render,obj.hide_viewport,hidden=visibility[obj.name];obj.hide_set(hidden)
        if camera and camera_matrix is not None:camera.matrix_world=camera_matrix
        scene.render.filepath=render_path


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--skip-renders',action='store_true');parser.add_argument('--validate-only',action='store_true');parser.add_argument('--export-existing',action='store_true');parser.add_argument('--soldier-variants-only',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if args.soldier_variants_only and not args.export_existing:
        parser.error('--soldier-variants-only requires --export-existing and the editable player.blend')
    if args.validate_only:
        validate(json.loads((OUT/'player-mesh.json').read_text()));return
    load_native_weapons()
    OUT.mkdir(parents=True,exist_ok=True)
    bpy.context.preferences.filepaths.save_version=0
    if args.export_existing:
        for name in PALETTE:
            material=bpy.data.materials.get(name) or toon_material(name,PALETTE[name]);MATERIALS[name]=material
            if material and material.use_nodes:
                ramp=next((node for node in material.node_tree.nodes if node.bl_idname=='ShaderNodeValToRGB'),None)
                if ramp:PALETTE[name]=list(ramp.color_ramp.elements[-1].color[:3])
        library=bpy.data.collections.get('Runtime mesh library')
        if not library:raise RuntimeError('--export-existing requires the existing assets/player/player.blend to be loaded')
        LIBRARY.update({obj.name:obj for obj in library.objects if obj.type=='MESH'})
        SOURCE.extend(obj for obj in bpy.data.objects if obj.type=='MESH' and 'semantic' in obj)
        rig=bpy.data.objects.get('PlayerRig')
        if not rig:raise RuntimeError('PlayerRig is missing from the editable source')
        if args.soldier_variants_only:
            validate_scene(rig);export_soldier_variants(rig,not args.skip_renders)
            print('SOLDIER_VARIANTS_READY',str(OUT));return
        sync_source_edits();validate_scene(rig);export_compact();export_glb(rig);export_helmet_variant(rig);export_soldier_variants(rig,not args.skip_renders)
        if not args.skip_renders:
            scene=bpy.context.scene;scene.render.filepath=str(OUT/'player-three-quarter.png');bpy.ops.render.render(write_still=True)
            render_headwear_previews()
        print('PLAYER_EDITED_EXPORT_READY',str(OUT));return
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for name,rgb in PALETTE.items():MATERIALS[name]=toon_material(name,rgb)
    MATERIALS['ink'].use_backface_culling=True
    library=bpy.data.collections.new('Runtime mesh library');bpy.context.scene.collection.children.link(library)
    body=bpy.data.collections.new('Rigged player');bpy.context.scene.collection.children.link(body)
    equipment=bpy.data.collections.new('Equipment variants');bpy.context.scene.collection.children.link(equipment)
    make_library(library);rig=assemble(body,equipment);validate_scene(rig);data=export_compact()
    export_glb(rig);export_helmet_variant(rig);stage_and_render(args.skip_renders);export_soldier_variants(rig,not args.skip_renders)
    bpy.ops.object.select_all(action='DESELECT');rig.hide_set(False);rig.select_set(True);bpy.context.view_layer.objects.active=rig
    bpy.context.scene['PlayerAssetSchema']=1
    bpy.context.scene['Regenerate']='blender --background --factory-startup --python tools/blender-player.py'
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'player.blend'))
    manifest={'schemaVersion':1,'source':'player.blend','portable':'player.glb','runtime':'player-mesh.json',
              'previews':['player-'+v+'.png' for v in ['three-quarter','front','back','overhead']],
              'helmetVariant':'player-helmet.glb','helmetPreview':'player-helmet.png',
              'headwearComparison':'player-headwear-comparison.png',
              'soldierVariants':[{'kit':'army_webbing','object':'NM0 infantry webbing','portable':'nm0-grey-soldier.glb','preview':'nm0-grey-soldier.png'},
                                 {'kit':'army_platecarrier','object':'NM0 armored plate carrier','portable':'nm0-armored-soldier.glb','preview':'nm0-armored-soldier.png'}],
              'meshCount':len(data['meshes']),'boneCount':len(rig.data.bones),
              'runtimeMaterial':'Three-band world-lit shader; glTF retains palette and toon metadata, not Blender node execution.'}
    (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print('PLAYER_ASSETS_READY',str(OUT))


if __name__=='__main__':main()
