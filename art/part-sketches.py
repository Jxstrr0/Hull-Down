# Part sketches for the design office: simple models of each part, drawn by
# Blender's Freestyle as ink lines only (every surface is a holdout, so the
# picture is transparent but for the lines). The game recolours the lines to
# the page's ink, so one picture serves the paper and the blueprint looks.
#
# Run (Blender 4.2 LTS, no window needed):
#   blender --background --factory-startup --python art/part-sketches.py -- <out folder>
# Then art/part-sketches-pack.py turns the renders into the files in public/sketches/.
# Game-level shapes, not engineering drawings.

import math
import os
import sys

import bpy
from mathutils import Vector

OUT = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '/tmp/sketches'
WIDTH, HEIGHT = 720, 360


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 1
    scene.cycles.device = 'CPU'
    scene.render.film_transparent = True
    scene.render.resolution_x = WIDTH
    scene.render.resolution_y = HEIGHT
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.use_freestyle = True
    scene.render.line_thickness_mode = 'ABSOLUTE'
    scene.render.line_thickness = 2.2
    layer = scene.view_layers[0]
    layer.use_freestyle = True
    fs = layer.freestyle_settings
    fs.crease_angle = math.radians(128)
    lineset = fs.linesets[0] if fs.linesets else fs.linesets.new('ink')
    lineset.select_silhouette = True
    lineset.select_border = True
    lineset.select_crease = True
    if lineset.linestyle is None:
        lineset.linestyle = bpy.data.linestyles.new('ink')
    lineset.linestyle.color = (0, 0, 0)
    lineset.linestyle.thickness = 2.2
    return scene


def holdout():
    mat = bpy.data.materials.new('holdout')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    out = nodes.new('ShaderNodeOutputMaterial')
    hold = nodes.new('ShaderNodeHoldout')
    mat.node_tree.links.new(hold.outputs[0], out.inputs['Surface'])
    return mat


HOLD = None


def finish(obj):
    obj.data.materials.append(HOLD)
    return obj


def box(size, at, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at, rotation=rot)
    obj = bpy.context.object
    obj.scale = size
    return finish(obj)


def cyl(radius, depth, at, rot=(0, 0, 0), verts=32):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, location=at, rotation=rot, vertices=verts)
    return finish(bpy.context.object)


def cone(r1, r2, depth, at, rot=(0, 0, 0), verts=32):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=depth, location=at, rotation=rot, vertices=verts)
    return finish(bpy.context.object)


def torus(major, minor, at, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, location=at, rotation=rot,
                                     major_segments=40, minor_segments=12)
    return finish(bpy.context.object)


ALONG_X = (0, math.pi / 2, 0)


def camera_on(scene):
    """An orthographic three-quarter view, fitted round everything in the scene."""
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for obj in scene.objects:
        for corner in obj.bound_box:
            p = obj.matrix_world @ Vector(corner)
            lo = Vector(map(min, lo, p))
            hi = Vector(map(max, hi, p))
    centre = (lo + hi) / 2
    bpy.ops.object.camera_add()
    cam = bpy.context.object
    cam.data.type = 'ORTHO'
    direction = Vector((1.0, -1.35, 0.85)).normalized()
    cam.location = centre + direction * 30
    cam.rotation_euler = (-direction).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = cam
    # Fit: project the box corners onto the camera's axes.
    bpy.context.view_layer.update()
    inv = cam.matrix_world.inverted()
    xs, ys = [], []
    for x in (lo.x, hi.x):
        for y in (lo.y, hi.y):
            for z in (lo.z, hi.z):
                q = inv @ Vector((x, y, z))
                xs.append(q.x)
                ys.append(q.y)
    w = max(xs) - min(xs)
    h = max(ys) - min(ys)
    cam.data.ortho_scale = max(w, h * WIDTH / HEIGHT) * 1.08


def render(name):
    scene = bpy.context.scene
    camera_on(scene)
    scene.render.filepath = os.path.join(OUT, name + '.png')
    bpy.ops.render.render(write_still=True)


# --- Guns: the breech end, cradle and recoil gear, with the barrel running out.
GUNS = {
    'rifled100': (100, 'rifled'),
    'smooth115': (115, 'smoothbore'),
    'smooth125': (125, 'smoothbore'),
    'rifled120': (120, 'rifled'),
}


def gun(calibre_mm, bore):
    k = calibre_mm / 125
    length = 4.2 * k
    r = 0.11 * k
    box((0.75 * k, 0.55 * k, 0.5 * k), (0, 0, 0))                       # breech ring
    box((0.12 * k, 0.6 * k, 0.32 * k), (-0.42 * k, 0, -0.02 * k))        # breech block face
    box((1.3 * k, 0.42 * k, 0.16 * k), (0.95 * k, 0, -0.3 * k))          # cradle
    for side in (-1, 1):
        cyl(0.07 * k, 1.1 * k, (0.85 * k, side * 0.16 * k, 0.28 * k), ALONG_X, 20)   # recoil cylinders
    cyl(r, length, (0.38 * k + length / 2, 0, 0), ALONG_X)                # barrel
    cyl(r * 1.35, 0.3 * k, (0.38 * k + 0.08, 0, 0), ALONG_X)              # barrel collar
    ext_at = 0.38 * k + length * 0.62
    cyl(r * 1.9, 0.55 * k, (ext_at, 0, 0), ALONG_X)                       # fume extractor
    if bore == 'smoothbore':
        # A thermal sleeve: bands along the barrel.
        for i in range(1, 6):
            x = 0.38 * k + length * i / 7
            if abs(x - ext_at) > 0.4 * k:
                cyl(r * 1.12, 0.05, (x, 0, 0), ALONG_X)
    else:
        # A rifled gun keeps a plain tube with a muzzle collar.
        cyl(r * 1.2, 0.18 * k, (0.38 * k + length - 0.09 * k, 0, 0), ALONG_X)
    if calibre_mm == 100:
        box((0.22 * k, 0.08 * k, 0.5 * k), (-0.2 * k, 0.3 * k, 0.05 * k))  # hand-worked breech lever


# --- Engines.
def diesel(turbo):
    box((2.0, 0.7, 0.55), (0, 0, 0))                                      # crankcase
    for side in (-1, 1):
        bank = box((1.9, 0.42, 0.5), (0, side * 0.33, 0.48), (side * math.radians(30), 0, 0))
        for i in range(6):
            box((0.24, 0.3, 0.12), (-0.78 + i * 0.31, side * 0.5, 0.78), (side * math.radians(30), 0, 0))
        cyl(0.06, 1.8, (0, side * 0.68, 0.5), ALONG_X, 16)                # exhaust manifold
    cyl(0.42, 0.22, (-1.12, 0, 0.1), ALONG_X)                             # flywheel housing
    box((0.4, 0.5, 0.35), (1.15, 0, 0.0))                                 # front cover, pumps
    if turbo:
        for side in (-1, 1):
            cyl(0.17, 0.26, (0.8, side * 0.25, 1.05), (math.pi / 2, 0, 0))  # turbochargers
            torus(0.15, 0.04, (0.8, side * 0.25, 1.05), (math.pi / 2, 0, 0))
    return


def multi_fuel():
    box((2.2, 0.5, 0.5), (0, 0, 0))                                       # opposed-piston block
    for side in (-1, 1):
        for i in range(5):
            cyl(0.13, 0.42, (-0.8 + i * 0.4, side * 0.45, 0.02), (math.pi / 2, 0, 0), 20)
    cyl(0.25, 0.7, (0.2, 0, 0.45), ALONG_X)                               # blower
    cone(0.2, 0.12, 0.3, (0.7, 0, 0.45), ALONG_X)
    cyl(0.4, 0.2, (-1.2, 0, 0), ALONG_X)                                  # gear housing


def turbine():
    cyl(0.38, 1.4, (0, 0, 0), ALONG_X)                                    # gas generator
    cone(0.6, 0.36, 0.45, (0.92, 0, 0), ALONG_X)                          # intake bell
    torus(0.52, 0.13, (-0.45, 0, 0), ALONG_X)                             # recuperator
    box((0.8, 0.9, 0.7), (-1.15, 0, -0.05))                               # reduction gearbox
    cyl(0.22, 0.9, (-0.5, 0, 0.7), (0, 0, 0))                             # exhaust stack
    box((0.5, 0.35, 0.3), (0.2, 0.45, -0.25))                             # fuel control


ENGINES = {
    'diesel580': lambda: diesel(False),
    'diesel780': lambda: diesel(True),
    'multiFuel700': multi_fuel,
    'turbine1000': turbine,
}

os.makedirs(OUT, exist_ok=True)
for name, (calibre, bore) in GUNS.items():
    reset()
    HOLD = holdout()
    gun(calibre, bore)
    render('gun-' + name)
for name, build in ENGINES.items():
    reset()
    HOLD = holdout()
    build()
    render('engine-' + name)
