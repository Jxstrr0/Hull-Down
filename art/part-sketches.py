# Part sketches for the design office: simple models of each part, drawn by
# Blender's Freestyle as ink lines only (every surface is a holdout, so the
# picture is transparent but for the lines). The game recolours the lines to
# the page's ink, so one picture serves the paper and the blueprint looks.
#
# Run (Blender 4.2 LTS, no window needed):
#   blender --background --factory-startup --python art/part-sketches.py -- <out folder> [name ...]
# Then art/part-sketches-pack.py turns the renders into the files in public/sketches/.
# Sketches in the same group share one scale, so a bigger part looks bigger.
# Game-level shapes, not engineering drawings.

import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = ARGS[0] if ARGS else '/tmp/sketches'
ONLY = set(ARGS[1:])
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
    global HOLD
    HOLD = holdout()
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
ALONG_X = (0, math.pi / 2, 0)
ALONG_Y = (math.pi / 2, 0, 0)


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


def sphere(radius, at, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=at, segments=32, ring_count=16)
    obj = bpy.context.object
    obj.scale = scale
    return finish(obj)


def dome(radius, at, scale=(1, 1, 1)):
    """The top half of a sphere, flat side down."""
    obj = sphere(radius, at, scale)
    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, 0),
                           plane_no=(0, 0, -1), clear_outer=True)
    bmesh.ops.contextual_create(bm, geom=[e for e in bm.edges if e.is_boundary])
    bm.to_mesh(mesh)
    bm.free()
    return obj


def prism(profile, width, at=(0, 0, 0)):
    """A solid from a side profile [(x, z), ...] given the width along y."""
    mesh = bpy.data.meshes.new('prism')
    bm = bmesh.new()
    front = [bm.verts.new((x, -width / 2, z)) for x, z in profile]
    back = [bm.verts.new((x, width / 2, z)) for x, z in profile]
    bm.faces.new(front)
    bm.faces.new(list(reversed(back)))
    n = len(profile)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([front[i], front[j], back[j], back[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new('prism', mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = at
    return finish(obj)


def round_(length, radius, at, tip=0.25, rot=ALONG_X):
    """A round of ammunition lying along x: case and a pointed nose."""
    x, y, z = at
    cyl(radius, length * (1 - tip), (x, y, z), rot, 20)
    cone(radius, radius * 0.25, length * tip, (x + length * (1 - tip) / 2 + length * tip / 2, y, z), rot, 20)


# --- Camera and render ------------------------------------------------------
def bounds(scene):
    bpy.context.view_layer.update()  # so every object's size and turn are applied before measuring
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for obj in scene.objects:
        if obj.type != 'MESH':
            continue
        for corner in obj.bound_box:
            p = obj.matrix_world @ Vector(corner)
            lo = Vector(map(min, lo, p))
            hi = Vector(map(max, hi, p))
    return lo, hi


def camera_on(scene, fixed_scale=None):
    """An orthographic three-quarter view round everything. Returns the scale it needs."""
    lo, hi = bounds(scene)
    centre = (lo + hi) / 2
    bpy.ops.object.camera_add()
    cam = bpy.context.object
    cam.data.type = 'ORTHO'
    direction = Vector((1.0, -1.35, 0.85)).normalized()
    cam.location = centre + direction * 40
    cam.rotation_euler = (-direction).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = cam
    bpy.context.view_layer.update()
    inv = cam.matrix_world.inverted()
    xs, ys = [], []
    for x in (lo.x, hi.x):
        for y in (lo.y, hi.y):
            for z in (lo.z, hi.z):
                q = inv @ Vector((x, y, z))
                xs.append(q.x)
                ys.append(q.y)
    need = max(max(xs) - min(xs), (max(ys) - min(ys)) * WIDTH / HEIGHT) * 1.08
    cam.data.ortho_scale = fixed_scale or need
    return need


def render(name, build, scale=None):
    scene = reset()
    build()
    camera_on(scene, scale)
    scene.render.filepath = os.path.join(OUT, name + '.png')
    bpy.ops.render.render(write_still=True)


def measure(build):
    scene = reset()
    build()
    return camera_on(scene)


# --- Guns: the breech end, cradle and recoil gear, with the barrel running out.
def gun(calibre_mm, bore):
    k = calibre_mm / 125
    length = 4.2 * k
    r = 0.11 * k
    box((0.75 * k, 0.55 * k, 0.5 * k), (0, 0, 0))
    box((0.12 * k, 0.6 * k, 0.32 * k), (-0.42 * k, 0, -0.02 * k))
    box((1.3 * k, 0.42 * k, 0.16 * k), (0.95 * k, 0, -0.3 * k))
    for side in (-1, 1):
        cyl(0.07 * k, 1.1 * k, (0.85 * k, side * 0.16 * k, 0.28 * k), ALONG_X, 20)
    cyl(r, length, (0.38 * k + length / 2, 0, 0), ALONG_X)
    cyl(r * 1.35, 0.3 * k, (0.38 * k + 0.08, 0, 0), ALONG_X)
    ext_at = 0.38 * k + length * 0.62
    cyl(r * 1.9, 0.55 * k, (ext_at, 0, 0), ALONG_X)
    if bore == 'smoothbore':
        for i in range(1, 6):
            x = 0.38 * k + length * i / 7
            if abs(x - ext_at) > 0.4 * k:
                cyl(r * 1.12, 0.05, (x, 0, 0), ALONG_X)
    else:
        cyl(r * 1.2, 0.18 * k, (0.38 * k + length - 0.09 * k, 0, 0), ALONG_X)
    if calibre_mm == 100:
        box((0.22 * k, 0.08 * k, 0.5 * k), (-0.2 * k, 0.3 * k, 0.05 * k))


def barrel(calibres):
    r = 0.11
    length = calibres * 0.125
    box((0.7, 0.55, 0.5), (-0.35, 0, 0))
    cyl(r, length, (length / 2, 0, 0), ALONG_X)
    cyl(r * 1.9, 0.5, (length * 0.6, 0, 0), ALONG_X)
    cyl(r * 1.25, 0.2, (length - 0.1, 0, 0), ALONG_X)


def recoil(stroke):
    box((0.7, 0.55, 0.5), (0, 0, 0))
    box((1.6, 0.42, 0.14), (0.9, 0, -0.32))
    for side in (-1, 1):
        cyl(0.075, 0.5 + stroke, (0.45 + (0.5 + stroke) / 2, side * 0.17, 0.3), ALONG_X, 20)
        cyl(0.045, 0.4, (0.45 + 0.5 + stroke + 0.2, side * 0.17, 0.3), ALONG_X, 16)
    cyl(0.11, 2.4, (1.55, 0, 0), ALONG_X)
    # The marks along the slide show how far the gun runs back.
    for i in range(int(stroke * 10) + 2):
        box((0.02, 0.44, 0.03), (0.3 + i * 0.12, 0, -0.24))


# --- Engines.
def diesel(turbo):
    box((2.0, 0.7, 0.55), (0, 0, 0))
    for side in (-1, 1):
        box((1.9, 0.42, 0.5), (0, side * 0.33, 0.48), (side * math.radians(30), 0, 0))
        for i in range(6):
            box((0.24, 0.3, 0.12), (-0.78 + i * 0.31, side * 0.5, 0.78), (side * math.radians(30), 0, 0))
        cyl(0.06, 1.8, (0, side * 0.68, 0.5), ALONG_X, 16)
    cyl(0.42, 0.22, (-1.12, 0, 0.1), ALONG_X)
    box((0.4, 0.5, 0.35), (1.15, 0, 0.0))
    if turbo:
        for side in (-1, 1):
            cyl(0.17, 0.26, (0.8, side * 0.25, 1.05), ALONG_Y)
            torus(0.15, 0.04, (0.8, side * 0.25, 1.05), ALONG_Y)


def multi_fuel():
    box((2.2, 0.5, 0.5), (0, 0, 0))
    for side in (-1, 1):
        for i in range(5):
            cyl(0.13, 0.42, (-0.8 + i * 0.4, side * 0.45, 0.02), ALONG_Y, 20)
    cyl(0.25, 0.7, (0.2, 0, 0.45), ALONG_X)
    cone(0.2, 0.12, 0.3, (0.7, 0, 0.45), ALONG_X)
    cyl(0.4, 0.2, (-1.2, 0, 0), ALONG_X)


def turbine():
    cyl(0.38, 1.4, (0, 0, 0), ALONG_X)
    cone(0.6, 0.36, 0.45, (0.92, 0, 0), ALONG_X)
    torus(0.52, 0.13, (-0.45, 0, 0), ALONG_X)
    box((0.8, 0.9, 0.7), (-1.15, 0, -0.05))
    cyl(0.22, 0.9, (-0.5, 0, 0.7), (0, 0, 0))
    box((0.5, 0.35, 0.3), (0.2, 0.45, -0.25))


# --- Hulls and turrets.
def hull(length, width, height, engine_rear=True):
    g = height * 0.55
    prism([(0, height * 0.45), (g * 1.6, height), (length, height), (length - 0.15, 0), (0.5, 0)], width)
    for side in (-1, 1):
        box((length - 0.3, 0.06, 0.04), (length / 2 + 0.1, side * (width / 2 + 0.03), height * 0.7))
    deck = (length * 0.72, length - 0.1) if engine_rear else (g * 1.6 + 0.1, g * 1.6 + 0.1 + length * 0.28)
    x0, x1 = deck
    box((x1 - x0, width * 0.7, 0.05), ((x0 + x1) / 2, 0, height + 0.025))
    for i in range(7):
        box((0.03, width * 0.66, 0.03), (x0 + 0.1 + i * (x1 - x0 - 0.2) / 6, 0, height + 0.06))
    cyl(0.35, 0.06, (length * (0.45 if engine_rear else 0.6), 0, height + 0.03), (0, 0, 0), 40)


def turret(shape):
    r = 1.05
    stub = lambda h: cyl(0.1, 1.6, (-r - 0.6, 0, h), ALONG_X)  # noqa: E731
    if shape == 'castDome':
        dome(r, (0, 0, 0), (1, 1, 0.55))
        stub(0.3)
        cyl(0.27, 0.18, (0.3, 0.42, 0.62), (0, 0, 0))
    elif shape == 'lowProfile':
        dome(r, (0, 0, 0), (1, 0.9, 0.38))
        stub(0.2)
    elif shape == 'weldedWedge':
        prism([(-r, 0), (-r * 0.8, 0.4), (-r * 0.25, 0.6), (r * 0.7, 0.6), (r, 0.3), (r, 0)], 1.9)
        stub(0.32)
        cyl(0.27, 0.18, (0.3, 0.42, 0.69), (0, 0, 0))
    elif shape == 'bustle':
        prism([(-r, 0), (-r * 0.82, 0.42), (-r * 0.3, 0.62), (r + 0.9, 0.62), (r + 0.9, 0.15), (r * 0.92, 0.15),
               (r * 0.92, 0)], 1.6)
        stub(0.32)
        cyl(0.27, 0.18, (0.3, 0.42, 0.71), (0, 0, 0))
    elif shape == 'unmanned':
        prism([(-r, 0), (-r * 0.85, 0.3), (-r * 0.5, 0.42), (r * 0.8, 0.42), (r, 0.25), (r, 0)], 1.2)
        stub(0.22)
        box((0.25, 0.2, 0.2), (0.2, 0.3, 0.52))
    cyl(r * 0.95, 0.08, (0, 0, -0.04), (0, 0, 0), 48)


# --- Loading.
def loader():
    # A crewman (a simple figure), his seat, and a round on the tray before the breech.
    cyl(0.16, 0.6, (0, 0, 0.9), (0, 0, 0), 20)
    sphere(0.12, (0, 0, 1.33))
    for side in (-1, 1):
        cyl(0.06, 0.5, (0.15, side * 0.1, 0.45), (0, math.radians(20), 0), 12)
        cyl(0.05, 0.45, (0.25, side * 0.22, 0.95), (0, math.radians(70), 0), 12)
    box((0.4, 0.4, 0.08), (-0.05, 0, 0.6))
    box((1.1, 0.2, 0.05), (0.85, 0, 0.92))
    round_(0.9, 0.06, (0.8, 0, 1.0))
    box((0.5, 0.45, 0.45), (1.6, 0, 1.0))


def carousel():
    cyl(1.0, 0.12, (0, 0, 0), (0, 0, 0), 48)
    cyl(0.25, 0.2, (0, 0, 0.12), (0, 0, 0), 24)
    for i in range(14):
        a = i / 14 * math.pi * 2
        x, y = math.cos(a) * 0.6, math.sin(a) * 0.6
        cyl(0.06, 0.7, (x, y, 0.15), (0, math.pi / 2, a), 14)
    box((0.12, 0.12, 0.9), (0.95, 0, 0.5))
    box((0.6, 0.15, 0.1), (0.8, 0, 0.95))


def bustle_loader():
    box((1.4, 1.5, 0.5), (0, 0, 0))
    for i in range(6):
        cyl(0.07, 0.04, (-0.72, -0.6 + i * 0.24, 0.05), ALONG_X, 16)
    box((0.9, 0.18, 0.1), (-1.15, 0, 0.1))
    box((0.1, 0.5, 0.4), (-1.62, 0, 0.1))
    for side in (-1, 1):
        box((1.42, 0.05, 0.05), (0, side * 0.77, 0.27))


# --- Ammunition.
def racks():
    for side in (-1, 1):
        box((0.06, 0.06, 0.9), (0, side * 0.5, 0.45))
        box((0.06, 0.06, 0.9), (1.2, side * 0.5, 0.45))
    for h in (0.2, 0.7):
        box((1.26, 1.06, 0.04), (0.6, 0, h))
    for i in range(4):
        round_(1.0, 0.06, (0.6, -0.36 + i * 0.24, 0.3))


def wet_stowage():
    box((1.2, 0.9, 0.7), (0, 0, 0))
    box((1.24, 0.94, 0.06), (0, 0, 0.38))
    for i in range(3):
        for j in range(4):
            cyl(0.07, 0.04, (-0.38 + i * 0.38, -0.33 + j * 0.22, 0.42), (0, 0, 0), 16)
    cyl(0.05, 0.4, (0.7, 0.3, 0.1), ALONG_X, 12)


def armoured_bins():
    box((1.2, 0.9, 0.7), (0, 0, 0))
    box((1.26, 0.96, 0.12), (0, 0, 0.41))
    for x in (-0.4, 0.4):
        cyl(0.04, 0.12, (x, -0.49, 0.36), ALONG_X, 12)
    box((0.3, 0.05, 0.08), (0, -0.48, 0.2))


def blow_out():
    box((1.4, 1.0, 0.5), (0, 0, 0))
    for i in range(3):
        box((0.44, 0.95, 0.04), (-0.47 + i * 0.47, 0, 0.29 + (0.08 if i == 1 else 0)), (0, math.radians(8) if i == 1 else 0, 0))
    for side in (-1, 1):
        box((1.4, 0.04, 0.12), (0, side * 0.52, 0.2))


def sabot(long_rod):
    cyl(0.07, 0.55, (0, 0, 0), ALONG_X, 24)
    rod = 0.85 if long_rod else 0.6
    rr = 0.016 if long_rod else 0.024
    cyl(rr, rod, (0.27 + rod / 2, 0, 0), ALONG_X, 12)
    cone(rr, 0.002, 0.08, (0.27 + rod + 0.04, 0, 0), ALONG_X, 12)
    cyl(0.06, 0.16, (0.38, 0, 0), ALONG_X, 24)
    for i in range(4):
        a = i * math.pi / 2
        box((0.1, 0.004, 0.05), (0.32, math.cos(a) * 0.04, math.sin(a) * 0.04), (a, 0, 0))
    for i in range(4):
        a = i * math.pi / 2 + math.pi / 4
        box((0.12 if long_rod else 0.08, 0.004, 0.035), (0.29, math.cos(a) * 0.03, math.sin(a) * 0.03), (a, 0, 0))


def heat(kind):
    cyl(0.07, 0.5, (0, 0, 0), ALONG_X, 24)
    if kind == 'missile':
        cyl(0.055, 0.7, (0.6, 0, 0), ALONG_X, 24)
        cone(0.055, 0.01, 0.2, (1.05, 0, 0), ALONG_X, 24)
        for i in range(4):
            a = i * math.pi / 2 + math.pi / 4
            box((0.12, 0.004, 0.08), (0.32, math.cos(a) * 0.09, math.sin(a) * 0.09), (a, 0, 0))
            box((0.06, 0.004, 0.04), (0.85, math.cos(a) * 0.07, math.sin(a) * 0.07), (a, 0, 0))
        return
    cone(0.065, 0.035, 0.3, (0.4, 0, 0), ALONG_X, 24)
    cyl(0.012, 0.25, (0.67, 0, 0), ALONG_X, 12)
    cyl(0.02, 0.03, (0.8, 0, 0), ALONG_X, 12)
    if kind == 'tandem':
        cone(0.03, 0.015, 0.08, (0.62, 0, 0), ALONG_X, 16)


# --- Sights, rangefinders, stabilisers, computers, night sights.
def sight_head(width, windows, doors=False):
    box((0.35, width, 0.4), (0, 0, 0))
    box((0.2, width * 0.8, 0.25), (0, 0, -0.3))
    for i in range(windows):
        y = (i - (windows - 1) / 2) * width / windows
        box((0.03, width / windows * 0.7, 0.16), (-0.18, y, 0.04))
    if doors:
        box((0.04, width * 0.9, 0.2), (-0.25, 0, 0.26), (0, math.radians(-30), 0))


def stadia():
    sight_head(0.4, 1)
    for i in range(5):
        box((0.035, 0.005 + i * 0.002, 0.004), (-0.2, 0, -0.02 + i * 0.03))
    box((0.035, 0.004, 0.13), (-0.2, 0, 0.04))


def coincidence():
    cyl(0.07, 1.8, (0, 0, 0), ALONG_Y, 24)
    for side in (-1, 1):
        box((0.18, 0.16, 0.2), (0, side * 0.92, 0))
        box((0.03, 0.1, 0.12), (-0.1, side * 0.92, 0.02))
    box((0.25, 0.25, 0.3), (0.05, 0, -0.18))


def laser():
    box((0.5, 0.35, 0.3), (0, 0, 0))
    cyl(0.1, 0.12, (-0.3, -0.06, 0.02), ALONG_X, 32)
    cyl(0.05, 0.1, (-0.29, 0.1, 0.05), ALONG_X, 20)
    for i in range(4):
        box((0.3, 0.02, 0.02), (0.05, 0.18, -0.08 + i * 0.05))


def stabiliser(planes):
    box((0.45, 0.35, 0.3), (0, 0, 0))
    cyl(0.12, 0.08, (0, 0, 0.19), (0, 0, 0), 24)
    cyl(0.05, 0.7, (0.55, 0, 0), ALONG_X, 16)
    cyl(0.03, 0.4, (1.05, 0, 0), ALONG_X, 12)
    if planes == 2:
        cyl(0.05, 0.6, (0, 0.55, 0), ALONG_Y, 16)
        cyl(0.03, 0.35, (0, 0.95, 0), ALONG_Y, 12)
        cyl(0.12, 0.08, (0, -0.19, 0), ALONG_Y, 24)


def computer(kind):
    if kind == 'mechanical':
        box((0.6, 0.4, 0.45), (0, 0, 0))
        for i, r in enumerate((0.12, 0.08, 0.1)):
            cyl(r, 0.03, (-0.15 + i * 0.16, -0.22, 0.05 + (i % 2) * 0.08), ALONG_Y, 24)
        cyl(0.02, 0.2, (0.38, 0, 0.1), ALONG_X, 12)
        box((0.04, 0.04, 0.12), (0.48, 0, 0.16))
    elif kind == 'electronic':
        box((0.7, 0.4, 0.4), (0, 0, 0))
        for i in range(3):
            cyl(0.06, 0.03, (-0.2 + i * 0.2, -0.21, 0.08), ALONG_Y, 24)
        for i in range(6):
            box((0.4, 0.01, 0.015), (0, -0.205, -0.12 + i * 0.025))
    else:
        box((0.5, 0.3, 0.12), (0, 0, 0))
        box((0.22, 0.01, 0.07), (-0.1, -0.155, 0.01))
        for i in range(3):
            for j in range(3):
                box((0.03, 0.01, 0.02), (0.1 + i * 0.045, -0.155, -0.03 + j * 0.03))


def night(kind):
    if kind == 'activeInfrared':
        cyl(0.3, 0.35, (0, 0, 0), ALONG_X, 40)
        torus(0.3, 0.025, (-0.18, 0, 0), ALONG_X)
        for i in range(5):
            box((0.004, 0.5, 0.01), (-0.18, 0, -0.2 + i * 0.1))
        box((0.12, 0.1, 0.3), (0.05, 0, -0.32))
    elif kind == 'imageIntensifier':
        sight_head(0.35, 1)
        cyl(0.11, 0.35, (-0.33, 0, 0.04), ALONG_X, 32)
        cyl(0.13, 0.04, (-0.5, 0, 0.04), ALONG_X, 32)
    else:
        box((0.5, 0.45, 0.4), (0, 0, 0))
        box((0.03, 0.3, 0.25), (-0.26, 0, 0.02))
        # Cooling fins down the side, and the cooler's pipe at the back.
        for i in range(5):
            box((0.02, 0.06, 0.36), (-0.15 + i * 0.07, 0.25, 0))
        cyl(0.04, 0.2, (0.3, 0, 0.1), ALONG_X, 12)


def commander_sight():
    cyl(0.12, 0.5, (0, 0, 0), (0, 0, 0), 24)
    box((0.35, 0.3, 0.3), (0, 0, 0.4))
    box((0.03, 0.2, 0.14), (-0.18, 0, 0.42))
    torus(0.3, 0.03, (0, 0, -0.25), (0, 0, 0))


# --- Powerpack, running gear, crew and protection.
def gearbox(size, hydro):
    box((0.9 * size, 0.7 * size, 0.6 * size), (0, 0, 0))
    for side in (-1, 1):
        cyl(0.12 * size, 0.3 * size, (0, side * 0.5 * size, 0), ALONG_Y, 24)
    cyl(0.04, 0.4, (0.2, -0.15, 0.45 * size), (0, math.radians(15), 0), 12)
    sphere(0.06, (0.25, -0.15, 0.65 * size))
    if hydro:
        cone(0.35, 0.3, 0.3, (-0.6, 0, 0), ALONG_X, 40)
        box((0.25, 0.4, 0.3), (0, 0.15, 0.48))


def cooling(heavy):
    w = 1.6 if heavy else 1.0
    box((w, 0.2, 0.7), (0, 0, 0))
    for i in range(10 if heavy else 6):
        box((0.02, 0.21, 0.62), (-w / 2 + 0.1 + i * (w - 0.2) / ((10 if heavy else 6) - 1), 0, 0))
    for f in ([-0.4, 0.4] if heavy else [0]):
        cyl(0.28, 0.08, (f, 0.15, 0), ALONG_Y, 40)
        cyl(0.06, 0.1, (f, 0.2, 0), ALONG_Y, 16)


def apu():
    box((0.6, 0.4, 0.4), (0, 0, 0))
    cyl(0.15, 0.2, (-0.4, 0, 0), ALONG_X, 24)
    cyl(0.04, 0.5, (0.2, 0.1, 0.4), (0, 0, 0), 12)
    box((0.25, 0.3, 0.1), (0.1, -0.05, -0.25))


def suspension(kind):
    cyl(0.35, 0.18, (0, 0, 0), ALONG_Y, 40)
    cyl(0.12, 0.2, (0, 0, 0), ALONG_Y, 24)
    box((0.6, 0.08, 0.1), (0.3, -0.15, 0.15), (0, math.radians(-20), 0))
    if kind == 'torsionBar':
        cyl(0.04, 2.0, (0.6, -1.15, 0.25), ALONG_Y, 16)
        cyl(0.07, 0.12, (0.6, -0.2, 0.25), ALONG_Y, 20)
    else:
        cyl(0.07, 0.6, (0.62, -0.15, 0.55), (0, math.radians(15), 0), 20)
        cyl(0.045, 0.35, (0.55, -0.15, 0.95), (0, math.radians(15), 0), 16)
        sphere(0.13, (0.75, -0.15, 0.95))


def seat(level):
    box((0.45, 0.45, 0.08 + 0.04 * level), (0, 0, 0.45))
    box((0.08, 0.45, 0.55 + 0.05 * level), (0.24, 0, 0.75), (0, math.radians(-8), 0))
    cyl(0.04, 0.45, (0, 0, 0.2), (0, 0, 0), 12)
    box((0.4, 0.4, 0.03), (0, 0, 0.0))
    if level >= 1:
        box((0.3, 0.25, 0.25), (-0.4, 0.35, 0.15))
        for i in range(3):
            box((0.005, 0.2, 0.02), (-0.551, 0.35, 0.08 + i * 0.06))
    if level >= 2:
        for side in (-1, 1):
            box((0.35, 0.06, 0.06), (0.05, side * 0.26, 0.62))
        box((0.35, 0.3, 0.3), (0.45, -0.45, 0.85))
        cyl(0.1, 0.03, (0.27, -0.45, 0.85), ALONG_X, 24)


def smoke():
    box((0.6, 0.5, 0.06), (0, 0, 0))
    for i in range(3):
        for j in range(2):
            cyl(0.06, 0.35, (-0.18 + i * 0.18, -0.1 + j * 0.2, 0.18), (0, math.radians(-35), 0), 20)


def fire_bottles():
    for i in range(2):
        cyl(0.12, 0.6, (i * 0.32, 0, 0), (0, 0, 0), 24)
        dome(0.12, (i * 0.32, 0, 0.3))
        cyl(0.03, 0.08, (i * 0.32, 0, 0.45), (0, 0, 0), 12)
    cyl(0.02, 1.0, (0.16 + 0.5, 0, 0.5), ALONG_X, 12)
    box((0.04, 0.08, 0.08), (1.18, 0, 0.45))


def spall_liner():
    prism([(0, 0), (1.4, 0), (1.4, 0.9), (0, 0.9)], 0.06)
    for i in range(1, 7):
        box((0.01, 0.07, 0.86), (i * 0.2, 0, 0.45))
    for j in range(1, 5):
        box((1.36, 0.07, 0.01), (0.7, 0, j * 0.18))


def active(kind):
    if kind == 'softKill':
        box((0.3, 0.3, 0.2), (0, 0, 0))
        cyl(0.08, 0.06, (-0.16, 0, 0.03), ALONG_X, 24)
        for i in range(4):
            cyl(0.05, 0.25, (0.25 + i * 0.12, 0.25, 0.12), (0, math.radians(-30), 0), 16)
    else:
        box((0.05, 0.5, 0.4), (0, 0, 0.3))
        for i in range(4):
            for j in range(3):
                box((0.01, 0.1, 0.1), (-0.03, -0.18 + i * 0.12, 0.18 + j * 0.12))
        box((0.4, 0.3, 0.2), (0.4, 0, 0.1))
        for i in range(2):
            cyl(0.05, 0.4, (0.35, -0.07 + i * 0.14, 0.28), (0, math.radians(60), 0), 16)


# --- What to draw. Name -> (group, builder). A group shares one scale.
SKETCHES = {
    'gun-rifled100': ('gun', lambda: gun(100, 'rifled')),
    'gun-smooth115': ('gun', lambda: gun(115, 'smoothbore')),
    'gun-smooth125': ('gun', lambda: gun(125, 'smoothbore')),
    'gun-rifled120': ('gun', lambda: gun(120, 'rifled')),
    'engine-diesel580': ('engine-a', lambda: diesel(False)),
    'engine-diesel780': ('engine-a', lambda: diesel(True)),
    'engine-multiFuel700': (None, multi_fuel),
    'engine-turbine1000': (None, turbine),
    'hull-light': ('hull', lambda: hull(5.8, 3.0, 1.0)),
    'hull-medium': ('hull', lambda: hull(6.8, 3.2, 1.1)),
    'hull-heavy': ('hull', lambda: hull(7.6, 3.4, 1.2)),
    'engineAt-rear': ('engineAt', lambda: hull(6.8, 3.2, 1.1, True)),
    'engineAt-front': ('engineAt', lambda: hull(6.8, 3.2, 1.1, False)),
    'turret-castDome': ('turret', lambda: turret('castDome')),
    'turret-weldedWedge': ('turret', lambda: turret('weldedWedge')),
    'turret-lowProfile': ('turret', lambda: turret('lowProfile')),
    'turret-bustle': ('turret', lambda: turret('bustle')),
    'turret-unmanned': ('turret', lambda: turret('unmanned')),
    'barrel-short': ('barrel', lambda: barrel(34)),
    'barrel-standard': ('barrel', lambda: barrel(40)),
    'barrel-long': ('barrel', lambda: barrel(48)),
    'recoil-stiff': ('recoil', lambda: recoil(0.2)),
    'recoil-standard': ('recoil', lambda: recoil(0.45)),
    'recoil-longStroke': ('recoil', lambda: recoil(0.75)),
    'loading-loader': (None, loader),
    'loading-carousel': (None, carousel),
    'loading-bustleLoader': (None, bustle_loader),
    'stowage-plainRacks': (None, racks),
    'stowage-wetStowage': ('bins', wet_stowage),
    'stowage-armouredBins': ('bins', armoured_bins),
    'stowage-blowOutPanels': (None, blow_out),
    'kinetic-supplied': ('kinetic', lambda: sabot(False)),
    'kinetic-longRod': ('kinetic', lambda: sabot(True)),
    'shaped-supplied': ('shaped', lambda: heat('heat')),
    'shaped-tandem': ('shaped', lambda: heat('tandem')),
    'shaped-gunMissile': ('shaped', lambda: heat('missile')),
    'sight-daySight': ('sight', lambda: sight_head(0.4, 1)),
    'sight-improvedDaySight': ('sight', lambda: sight_head(0.55, 2, True)),
    'rangefinder-stadiametric': (None, stadia),
    'rangefinder-coincidence': (None, coincidence),
    'rangefinder-laser': (None, laser),
    'stabiliser-singlePlane': ('stabiliser', lambda: stabiliser(1)),
    'stabiliser-twoPlane': ('stabiliser', lambda: stabiliser(2)),
    'computer-mechanical': ('computer', lambda: computer('mechanical')),
    'computer-electronic': ('computer', lambda: computer('electronic')),
    'computer-digital': ('computer', lambda: computer('digital')),
    'night-activeInfrared': (None, lambda: night('activeInfrared')),
    'night-imageIntensifier': (None, lambda: night('imageIntensifier')),
    'night-thermal': (None, lambda: night('thermal')),
    'commanderSight': (None, commander_sight),
    'transmission-manual38': ('transmission', lambda: gearbox(0.9, False)),
    'transmission-manual44': ('transmission', lambda: gearbox(1.0, False)),
    'transmission-hydro50': ('transmission', lambda: gearbox(1.05, True)),
    'cooling-standard': ('cooling', lambda: cooling(False)),
    'cooling-heavyDuty': ('cooling', lambda: cooling(True)),
    'apu': (None, apu),
    'suspension-torsionBar': (None, lambda: suspension('torsionBar')),
    'suspension-hydropneumatic': (None, lambda: suspension('hydropneumatic')),
    'comfort-basic': ('comfort', lambda: seat(0)),
    'comfort-standard': ('comfort', lambda: seat(1)),
    'comfort-improved': ('comfort', lambda: seat(2)),
    'smoke': (None, smoke),
    'fireSuppression': (None, fire_bottles),
    'spallLiner': (None, spall_liner),
    'active-softKill': (None, lambda: active('softKill')),
    'active-hardKill': (None, lambda: active('hardKill')),
}

os.makedirs(OUT, exist_ok=True)
wanted = {name: entry for name, entry in SKETCHES.items() if not ONLY or name in ONLY}
scales = {}
for name, (group, build) in SKETCHES.items():
    if group and any(g == group for g, _ in wanted.values()):
        scales[group] = max(scales.get(group, 0), measure(build))
for name, (group, build) in wanted.items():
    render(name, build, scales.get(group) if group else None)
