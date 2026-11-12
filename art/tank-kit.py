# The trial tank kit: low-poly pieces the 3D range builds every tank from
# (plan sections 13.1 and PR 15). Game-level shapes, no real vehicle.
# Each piece is built here in code, at a reference size the game scales to
# the player's design (the sizes are in src/data/kit.ts). The hull is not a
# piece: the game builds it from the design's own measurements.
#
# Run with Blender 4.2 LTS, no window needed:
#   blender --background --factory-startup --python art/tank-kit.py -- export public/kit/tank-kit.glb
#   blender --background --factory-startup --python art/tank-kit.py -- render <folder> [piece | tank | lineup ...]
# `export` writes the kit the game loads; `render` draws grey pictures to check shapes by eye.
# The bake-kit workflow runs `export` in Actions and fails if the committed file is out of date.
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
MODE = ARGS[0] if ARGS else 'render'
OUT = ARGS[1] if len(ARGS) > 1 else '/tmp/kit'
ONLY = set(ARGS[2:])


# ---------- scene

def reset(w=640, h=480):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = 'CYCLES'
    s.cycles.device = 'CPU'
    s.cycles.samples = 24
    s.cycles.use_denoising = True
    s.render.resolution_x, s.render.resolution_y = w, h
    s.render.film_transparent = False
    s.view_settings.view_transform = 'AgX'
    global GREY, DARK, GROUND
    GREY = mat('body', (0.55, 0.56, 0.55))
    DARK = mat('dark', (0.22, 0.23, 0.23))
    GROUND = mat('ground', (0.7, 0.71, 0.69))
    if MODE == 'export':
        return s
    world = bpy.data.worlds.new('w')
    s.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.78, 0.8, 0.82, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = 0.55
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 2.4
    sun.data.angle = math.radians(8)
    sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(35))
    s.collection.objects.link(sun)
    return s


def mat(name, rgb):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = 0.75
    return m


GREY = DARK = GROUND = None


def link(bm, name, material=None, smooth=False):
    mesh = bpy.data.meshes.new(name)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material or GREY)
    if smooth:
        for p in mesh.polygons:
            p.use_smooth = True
    return obj


def tris(objs):
    n = 0
    for o in objs:
        for p in o.data.polygons:
            n += len(p.vertices) - 2
    return n


# ---------- shape helpers (each returns an object)

def loft(rings, name='loft', material=None, cap_bottom=True):
    """Rings [(z, [(x, y), ...]), ...] bottom to top, same corner count; skinned and capped."""
    bm = bmesh.new()
    vs = [[bm.verts.new((x, y, z)) for x, y in pts] for z, pts in rings]
    n = len(vs[0])
    for a, b in zip(vs, vs[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new([a[i], a[j], b[j], b[i]])
    bm.faces.new(list(reversed(vs[-1])))
    if cap_bottom:
        bm.faces.new(vs[0])
    return link(bm, name, material)


def prism(profile, width, name='prism', material=None, y=0.0):
    """Side profile [(x, z), ...] given a width across (y)."""
    bm = bmesh.new()
    f = [bm.verts.new((x, y - width / 2, z)) for x, z in profile]
    b = [bm.verts.new((x, y + width / 2, z)) for x, z in profile]
    bm.faces.new(f)
    bm.faces.new(list(reversed(b)))
    for i in range(len(profile)):
        j = (i + 1) % len(profile)
        bm.faces.new([f[i], f[j], b[j], b[i]])
    return link(bm, name, material)


def band(outer, thick, width, name='band', material=None, y=0.0):
    """A closed loop of plate: an outline [(x, z), ...] (convex, anticlockwise) and its inset, given a width across."""
    n = len(outer)
    inner = []
    for i in range(n):
        p0, p1, p2 = Vector(outer[i - 1]), Vector(outer[i]), Vector(outer[(i + 1) % n])
        e0, e1 = (p1 - p0).normalized(), (p2 - p1).normalized()
        n0, n1 = Vector((-e0.y, e0.x)), Vector((-e1.y, e1.x))
        m = (n0 + n1).normalized()
        inner.append(p1 + m * (thick / m.dot(n0)))
    bm = bmesh.new()
    rows = []
    for ring in (outer, inner):
        rows.append(([bm.verts.new((x, y - width / 2, z)) for x, z in ring], [bm.verts.new((x, y + width / 2, z)) for x, z in ring]))
    (of, ob), (inf, inb) = rows
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([of[i], of[j], ob[j], ob[i]])
        bm.faces.new([inf[j], inf[i], inb[i], inb[j]])
        bm.faces.new([of[j], of[i], inf[i], inf[j]])
        bm.faces.new([ob[i], ob[j], inb[j], inb[i]])
    return link(bm, name, material)


def box(size, at, name='box', material=None, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    o = link(bm, name, material)
    o.location, o.rotation_euler = at, rot
    return o


def drum(r, depth, at, axis='y', sides=12, name='drum', material=None, r2=None):
    """A round bar along an axis. r2 tapers the far end."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=sides, radius1=r, radius2=r2 if r2 else r, depth=depth)
    o = link(bm, name, material, smooth=False)
    o.location = at
    o.rotation_euler = {'x': (0, math.pi / 2, 0), 'y': (math.pi / 2, 0, 0), 'z': (0, 0, 0)}[axis]
    return o


def superellipse(ahead, behind, half, p, n=16):
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        c, s = math.cos(t), math.sin(t)
        x = (ahead if c > 0 else behind) * math.copysign(abs(c) ** (2 / p), c)
        y = half * math.copysign(abs(s) ** (2 / p), s)
        pts.append((x, y))
    return pts


def gear(teeth, r_in, r_out, width, at, name='gear', material=None):
    pts = []
    for i in range(teeth * 2):
        r = r_out if i % 2 == 0 else r_in
        t = 2 * math.pi * (i + 0.5) / (teeth * 2)
        pts.append((r * math.cos(t), r * math.sin(t)))
    o = prism(pts, width, name, material)
    o.location = at
    return o


# ---------- the kit. Every piece is built at the origin, x forward, z up
# (three.js: x forward, y up). Two materials, named for the tones the game paints: body and dark.
R = 1.1   # the reference turret radius; the game scales to the design's own


def t_cast_dome():
    # A deep cast dome: a lip at the ring, cheeks bulging forward, a rounded crown.
    h = 0.8
    se = lambda a, b, w, p=2.2: superellipse(a * R, b * R, w * R, p, 18)
    rings = [(0, se(1.0, 1.0, 1.0)), (0.07 * h, se(1.07, 1.03, 1.05)), (0.4 * h, se(1.1, 0.98, 1.02)),
             (0.72 * h, se(0.88, 0.8, 0.84)), (0.92 * h, se(0.58, 0.52, 0.58)), (h, se(0.3, 0.26, 0.32, 2.0))]
    return [loft(rings, 'turret cast dome')]


def t_low_profile():
    # A wide, flat pancake with a steep sloped front.
    h = 0.5
    se = lambda a, b, w: superellipse(a * R, b * R, w * R, 3.2, 18)
    rings = [(0, se(1.08, 1.0, 1.06)), (0.3 * h, se(1.1, 1.02, 1.08)), (0.75 * h, se(0.8, 0.86, 0.95)), (h, se(0.5, 0.62, 0.72))]
    return [loft(rings, 'turret low profile')]


def t_welded_wedge():
    # A flat-topped body with two arrowhead cheeks out front and a slot for the gun between them.
    h = 0.66
    def body_ring(a, b, w, c):
        return [(a, w), (-b + c, w), (-b, w - c), (-b, -(w - c)), (-b + c, -w), (a, -w)]
    body = loft([(0, body_ring(0.5 * R, 1.0 * R, 0.95 * R, 0.3 * R)),
                 (h, body_ring(0.4 * R, 0.85 * R, 0.82 * R, 0.22 * R))], 'turret welded wedge')
    objs = [body]
    for side in (-1, 1):
        lo = [(1.65 * R, 0.24 * R), (0.45 * R, 0.97 * R), (0.45 * R, 0.24 * R)]
        hi = [(1.3 * R, 0.24 * R), (0.4 * R, 0.83 * R), (0.4 * R, 0.24 * R)]
        flip = lambda pts: [(x, side * y) for x, y in pts]
        rings = [(0, flip(lo)), (0.6 * h, flip([(1.62 * R, 0.24 * R), (0.45 * R, 0.95 * R), (0.45 * R, 0.24 * R)])), (h, flip(hi))]
        if side < 0:
            rings = [(z, list(reversed(r))) for z, r in rings]
        objs.append(loft(rings, 'wedge cheek'))
    return objs


def t_bustle():
    # Angled front cheeks, and a long box overhanging the back with a stowage basket on it.
    h = 0.85
    def ring(a, b, w, c):
        return [(a, w - c), (a - c, w), (-b, w), (-b, -w), (a - c, -w), (a, -(w - c))]
    body = loft([(0, ring(1.0 * R, 0.9 * R, 0.92 * R, 0.38 * R)), (0.45 * h, ring(1.02 * R, 0.9 * R, 0.94 * R, 0.38 * R)),
                 (h, ring(0.55 * R, 0.9 * R, 0.86 * R, 0.22 * R))], 'turret bustle')
    rear = prism([(-0.85 * R, 0.25 * h), (-2.0 * R, 0.4 * h), (-2.05 * R, h * 0.98), (-0.85 * R, h)], 1.68 * R, 'bustle box')
    objs = [body, rear]
    # The basket: a rail round the back of the bustle.
    for side in (-1, 1):
        objs.append(box((0.9, 0.04, 0.04), (-1.75 * R, side * 0.95 * R, h + 0.2), 'rail', DARK))
        for x in (-1.35 * R, -2.1 * R):
            objs.append(box((0.04, 0.04, 0.22), (x, side * 0.95 * R, h + 0.1), 'post', DARK))
    objs.append(box((0.04, 1.9 * R, 0.04), (-2.1 * R, 0, h + 0.2), 'rail', DARK))
    return objs


def t_unmanned():
    # A low armoured slab, the gun carried high in a cradle on top, and a sensor mast.
    h = 0.42
    def ring(a, b, w, c):
        return [(a, w - c), (a - c, w), (-b + c, w), (-b, w - c), (-b, -(w - c)), (-b + c, -w), (a - c, -w), (a, -(w - c))]
    body = loft([(0, ring(1.0 * R, 1.0 * R, 0.62 * R, 0.25 * R)), (h, ring(0.6 * R, 0.85 * R, 0.55 * R, 0.18 * R))], 'turret unmanned')
    cradle = prism([(-0.55, 0), (0.45, 0), (0.62, 0.18), (0.55, 0.42), (-0.55, 0.42)], 0.5, 'cradle', DARK)
    cradle.location = (0, 0, h)
    mast = drum(0.05, 0.5, (-0.7 * R, 0.4 * R, h + 0.25), 'z', 6, 'mast', DARK)
    head = box((0.26, 0.2, 0.18), (-0.7 * R, 0.4 * R, h + 0.58), 'sensor head', DARK)
    return [body, cradle, mast, head]


# Where things go on each turret: the front of the gun mount (x), the gun's height, the roof,
# whether a crew rides in it, and how far out the smoke launchers sit.
TURRET_FIT = {
    'cast-dome': dict(build=t_cast_dome, front=1.0 * R, gun=0.4, top=0.8, crewed=True, side=1.0 * R, mantlet='cast'),
    'low-profile': dict(build=t_low_profile, front=1.0 * R, gun=0.26, top=0.5, crewed=True, side=1.05 * R, mantlet='cast'),
    'welded-wedge': dict(build=t_welded_wedge, front=0.45 * R, gun=0.36, top=0.66, crewed=True, side=0.97 * R, mantlet='slot'),
    'bustle': dict(build=t_bustle, front=0.95 * R, gun=0.45, top=0.85, crewed=True, side=0.94 * R, mantlet='block'),
    'unmanned': dict(build=t_unmanned, front=0.55, gun=0.42 + 0.24, top=0.42, crewed=False, side=0.62 * R, mantlet='none'),
}


def mantlet_cast():
    # A rounded block round the gun's root, its front face bulged.
    pts = superellipse(0.32, 0.12, 0.42, 2.4, 12)
    rings = [(-0.25, [(x * 0.92, y * 0.92) for x, y in pts]), (0, pts), (0.25, [(x * 0.92, y * 0.92) for x, y in pts])]
    o = loft(rings, 'mantlet cast', DARK)
    return [o]


def mantlet_block():
    prof = [(-0.1, -0.24), (0.22, -0.24), (0.32, -0.12), (0.32, 0.16), (0.2, 0.24), (-0.1, 0.24)]
    return [prism(prof, 0.9, 'mantlet block', DARK)]


def gun_barrel():
    L = 5.2
    tube = drum(0.075, L, (L / 2, 0, 0), 'x', 10, 'barrel', DARK, r2=0.065)
    root = drum(0.12, 0.9, (0.45, 0, 0), 'x', 10, 'barrel root', DARK)
    fume = drum(0.13, 0.7, (2.2, 0, 0), 'x', 10, 'fume extractor', DARK)
    bands = [drum(0.09, 0.08, (x, 0, 0), 'x', 10, 'band', DARK) for x in (1.2, 3.3, 4.3)]
    muzzle = drum(0.085, 0.18, (L - 0.09, 0, 0), 'x', 10, 'muzzle', DARK)
    return [tube, root, fume, muzzle] + bands


def road_wheel():
    r, w = 0.36, 0.11
    outer = drum(r, w, (0, 0.085, 0), 'y', 16, 'tyre')
    inner = drum(r, w, (0, -0.085, 0), 'y', 16, 'tyre')
    hub = drum(0.12, 0.34, (0, 0, 0), 'y', 8, 'hub', DARK)
    dish = drum(r * 0.72, 0.03, (0, 0.15, 0), 'y', 16, 'dish', DARK)
    return [outer, inner, hub, dish]


def sprocket():
    a = gear(11, 0.29, 0.36, 0.06, (0, 0.07, 0), 'sprocket ring', DARK)
    b = gear(11, 0.29, 0.36, 0.06, (0, -0.07, 0), 'sprocket ring', DARK)
    hub = drum(0.2, 0.3, (0, 0, 0), 'y', 10, 'sprocket hub')
    cap = drum(0.12, 0.08, (0, 0.18, 0), 'y', 8, 'cap', DARK)
    return [a, b, hub, cap]


def idler():
    a = drum(0.3, 0.09, (0, 0.08, 0), 'y', 14, 'idler')
    b = drum(0.3, 0.09, (0, -0.08, 0), 'y', 14, 'idler')
    hub = drum(0.1, 0.32, (0, 0, 0), 'y', 8, 'idler hub', DARK)
    return [a, b, hub]


def return_roller():
    return [drum(0.11, 0.24, (0, 0, 0), 'y', 8, 'return roller'), drum(0.05, 0.3, (0, 0, 0), 'y', 6, 'axle', DARK)]


def track_run():
    # Six links of a straight run: a plate and a grouser bar each. In game the run can be one strip with this as a texture.
    objs = []
    for i in range(6):
        x = i * 0.16
        objs.append(box((0.145, 0.58, 0.04), (x, 0, 0.02), 'link', DARK))
        objs.append(box((0.04, 0.58, 0.03), (x, 0, -0.012), 'grouser', DARK))
        objs.append(box((0.06, 0.04, 0.09), (x, 0, 0.08), 'guide horn', DARK))
    return objs


def skirt_panel():
    prof = [(0, 0), (1.2, 0), (1.2, 0.55), (0, 0.55)]
    plate = prism(prof, 0.04, 'skirt')
    flap = box((1.2, 0.02, 0.12), (0.6, 0, -0.06), 'rubber flap', DARK)
    return [plate, flap]


def era_tiles():
    objs = []
    for i in range(3):
        for j in range(2):
            objs.append(box((0.32, 0.22, 0.07), (i * 0.34, j * 0.24, 0.035), 'era tile'))
    objs.append(box((1.06, 0.5, 0.02), (0.34, 0.12, -0.01), 'era frame', DARK))
    return objs


def smoke_bank():
    base = box((0.34, 0.12, 0.16), (0, 0, 0), 'launcher base', DARK)
    tubes = [drum(0.045, 0.24, (0.1, -0.035 + 0.07 * (k % 2), -0.04 + 0.08 * (k // 2)), 'x', 8, 'tube', DARK) for k in range(4)]
    for t in tubes:
        t.rotation_euler = (0, math.pi / 2 - math.radians(20), math.radians(25))
    return [base] + tubes


def cupola():
    ring = drum(0.36, 0.16, (0, 0, 0.08), 'z', 12, 'cupola ring')
    hatch = drum(0.3, 0.05, (0, 0, 0.185), 'z', 12, 'hatch')
    scopes = [box((0.1, 0.07, 0.07), (0.33 * math.cos(a), 0.33 * math.sin(a), 0.12), 'periscope', DARK)
              for a in [math.radians(d) for d in (-50, -15, 15, 50)]]
    for s, a in zip(scopes, (-50, -15, 15, 50)):
        s.rotation_euler = (0, 0, math.radians(a))
    return [ring, hatch] + scopes


def sight_head():
    body = box((0.34, 0.3, 0.32), (0, 0, 0.16), 'sight head')
    window = box((0.02, 0.22, 0.12), (0.17, 0, 0.2), 'sight window', DARK)
    stem = drum(0.08, 0.1, (0, 0, -0.05), 'z', 8, 'sight stem', DARK)
    return [body, window, stem]


def engine_deck():
    plate = box((1.6, 2.0, 0.03), (0, 0, 0), 'deck')
    slats = [box((0.06, 1.6, 0.03), (-0.65 + i * 0.1, 0, 0.03), 'slat', DARK) for i in range(14)]
    return [plate] + slats


# ---------- one assembled tank, built from its measurements like the game does

def prism_taper(profile, half_at, name='prism', material=None):
    """A side profile [(x, z), ...] whose half width across depends on height: half_at(z)."""
    bm = bmesh.new()
    f = [bm.verts.new((x, -half_at(z), z)) for x, z in profile]
    b = [bm.verts.new((x, half_at(z), z)) for x, z in profile]
    bm.faces.new(f)
    bm.faces.new(list(reversed(b)))
    for i in range(len(profile)):
        j = (i + 1) % len(profile)
        bm.faces.new([f[i], f[j], b[j], b[i]])
    return link(bm, name, material)


def hull_body(L=6.8, roof=1.75, deck=0.92, upper_half=1.68, lower_half=1.08):
    """A lower hull between the tracks, with a lower front plate and a sloped tail,
    and an upper hull whose sponsons reach out over the tracks, its sides leaning in."""
    half = L / 2
    lower = prism([(-half + 0.35, 0.42), (half - 1.15, 0.42), (half - 0.12, deck + 0.04), (-half + 0.05, deck + 0.04),
                   (-half + 0.05, 0.75)], lower_half * 2, 'lower hull')
    side = prism([(-half + 0.05, deck), (half - 0.12, deck), (half - 0.02, deck + 0.12), (half - 1.9, roof),
                  (-half + 0.55, roof), (-half, roof - 0.32)], upper_half * 2 + 0.2, 'upper hull')
    # Seen from the front: a bevel under each sponson, sides leaning in, a chamfer along the roof edge.
    u, r = upper_half, roof
    section = prism([(-u + 0.2, deck), (u - 0.2, deck), (u, deck + 0.16), (u - 0.16, r - 0.14), (u - 0.32, r),
                     (-u + 0.32, r), (-u + 0.16, r - 0.14), (-u, deck + 0.16)], L + 1, 'section')
    section.rotation_euler = (0, 0, math.pi / 2)
    mod = side.modifiers.new('cut', 'BOOLEAN')
    mod.operation, mod.object, mod.solver = 'INTERSECT', section, 'EXACT'
    bpy.context.view_layer.objects.active = side
    bpy.ops.object.modifier_apply(modifier='cut')
    bpy.data.objects.remove(section)
    upper = side
    return [lower, upper]


def assembled(skirts=True, turret='cast-dome'):
    L, track_w = 6.8, 0.58
    half = L / 2
    roof = 1.75
    objs = hull_body(L, roof)
    zc = 1.08 + track_w / 2 + 0.02
    loop = [(-half + 0.55, 0), (half - 0.75, 0), (half - 0.25, 0.42), (half - 0.25, 0.68), (half - 0.55, 0.86),
            (-half + 0.35, 0.86), (-half + 0.05, 0.62), (-half + 0.1, 0.36)]
    xs = [half - 1.3 - i * 0.9 for i in range(6)]
    for side in (-1, 1):
        objs.append(band(loop, 0.09, track_w, 'track', DARK, y=side * zc))
        for x in xs:
            for o in road_wheel():
                o.location += Vector((x, side * zc, 0.38))
                objs.append(o)
        for o in idler():
            o.location += Vector((half - 0.5, side * zc, 0.5))
            objs.append(o)
        for o in sprocket():
            o.location += Vector((-half + 0.38, side * zc, 0.52))
            objs.append(o)
        for x in (1.6, 0.0, -1.6):
            for o in return_roller():
                o.location += Vector((x, side * zc, 0.8))
                objs.append(o)
        for k in range(4 if skirts else 0):
            for o in skirt_panel():
                o.location += Vector((half - 1.45 - k * 1.22, side * 1.71, 0.38))
                objs.append(o)
    for o in engine_deck():
        o.location += Vector((-half + 1.3, 0, roof + 0.015))
        objs.append(o)
    # Reactive tiles on the glacis, two rows laid on the slope.
    gx0, gz0, gx1, gz1 = half - 0.02, 1.04, half - 1.9, roof
    pitch = math.atan2(gz1 - gz0, gx0 - gx1)
    for i in range(2):
        u = 0.3 + i * 0.38
        x, z = gx0 + (gx1 - gx0) * u, gz0 + (gz1 - gz0) * u
        for j in range(7):
            t = box((0.5, 0.36, 0.08), (x + 0.03, -1.17 + j * 0.39, z + 0.06), 'era tile')
            t.rotation_euler = (0, pitch, 0)
            objs.append(t)

    def place(parts, dx, dy, dz):
        for o in parts:
            o.location += Vector((dx, dy, dz))
        return parts

    # Turret over the ring, and what rides on it.
    fit = TURRET_FIT[turret]
    tx, tz = 0.25, roof
    objs += place(fit['build'](), tx, 0, tz)
    gx, gz = tx + fit['front'], tz + fit['gun']
    if fit['mantlet'] == 'cast':
        objs += place(mantlet_cast(), gx - 0.05, 0, gz)
    elif fit['mantlet'] == 'block':
        objs += place(mantlet_block(), gx, 0, gz)
    elif fit['mantlet'] == 'slot':
        m = mantlet_block()
        for o in m:
            o.scale = (1.6, 0.5, 1.0)
        objs += place(m, gx, 0, gz)
    objs += place(gun_barrel(), gx + (0.0 if fit['mantlet'] != 'slot' else 0.3), 0, gz)
    if fit['crewed']:
        objs += place(cupola(), tx - R * 0.3, R * 0.38, tz + fit['top'] * 0.97)
        objs += place(sight_head(), tx - R * 0.02, -R * 0.42, tz + fit['top'] * 0.9)
    for side in (-1, 1):
        objs += place(smoke_bank(), tx - R * 0.35, side * (fit['side'] + 0.02), tz + fit['top'] * 0.5)
    return objs


# ---------- rendering

def frame(objs, name, view=(1.0, -1.3, 0.75), lens=60, ground=True, w=640, h=480, pad=1.18):
    s = bpy.context.scene
    s.render.resolution_x, s.render.resolution_y = w, h
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    centre = (lo + hi) / 2
    size = (hi - lo).length
    if ground:
        g = box((400, 400, 0.01), (centre.x, centre.y, lo.z - 0.006), 'ground', GROUND)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    s.collection.objects.link(cam)
    cam.data.lens = lens
    d = Vector(view).normalized()
    fov = 2 * math.atan(18 / lens) * (1 if w >= h else w / h)
    dist = size * pad / (2 * math.tan(fov / 2)) * (h / w if w >= h else 1) * 1.6
    cam.location = centre + d * dist
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    s.camera = cam
    s.render.filepath = os.path.join(OUT, name + '.png')
    bpy.ops.render.render(write_still=True)


PIECES = {
    'turret-cast-dome': t_cast_dome, 'turret-low-profile': t_low_profile, 'turret-welded-wedge': t_welded_wedge,
    'turret-bustle': t_bustle, 'turret-unmanned': t_unmanned, 'hull': lambda: hull_body(),
    'mantlet-cast': mantlet_cast, 'mantlet-block': mantlet_block, 'gun': gun_barrel,
    'road-wheel': road_wheel, 'sprocket': sprocket, 'idler': idler, 'return-roller': return_roller,
    'track-links': track_run, 'skirt-panel': skirt_panel, 'era-tiles': era_tiles, 'smoke-launchers': smoke_bank,
    'cupola': cupola, 'sight-head': sight_head, 'engine-deck': engine_deck,
}

# What the game loads. The hull and the track links stay out: the game builds
# the hull from the design, and the links are for a texture later.
EXPORT = ['turret-cast-dome', 'turret-low-profile', 'turret-welded-wedge', 'turret-bustle', 'turret-unmanned',
          'mantlet-cast', 'mantlet-block', 'gun', 'road-wheel', 'sprocket', 'idler', 'return-roller',
          'skirt-panel', 'era-tiles', 'smoke-launchers', 'cupola', 'sight-head', 'engine-deck']


def export(path):
    reset()
    for key in EXPORT:
        objs = PIECES[key]()
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.join()
        piece = bpy.context.view_layer.objects.active
        piece.name = piece.data.name = key
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        # One slot per material, so each piece is at most two draw groups.
        bpy.ops.object.material_slot_remove_unused()
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_yup=True, export_apply=True,
                              export_texcoords=False, export_normals=True, export_materials='EXPORT',
                              export_extras=False, export_cameras=False, export_lights=False)
    for key in EXPORT:
        print(f'{key}\t{tris([bpy.data.objects[key]])}')


def render(folder):
    os.makedirs(folder, exist_ok=True)
    for key, build in PIECES.items():
        if ONLY and key not in ONLY:
            continue
        reset()
        objs = build()
        print(f'{key}\t{tris(objs)}')
        frame(objs, key)
    if not ONLY or 'tank' in ONLY:
        views = {'tank-front-quarter': ((1.0, -1.25, 0.6), True), 'tank-rear-quarter': ((-1.0, -1.25, 0.7), True),
                 'tank-side-bare': ((0.0, -1.0, 0.15), False), 'tank-low': ((1.4, -0.55, 0.12), True)}
        for view_name, (view, skirts) in views.items():
            reset(960, 600)
            objs = assembled(skirts)
            print(f'{view_name}\t{tris(objs)}')
            frame(objs, view_name, view, lens=50, w=960, h=600, pad=1.08)
    if not ONLY or 'lineup' in ONLY:
        # The five turrets on the same hull, side by side.
        reset(1600, 700)
        objs = []
        for k, name in enumerate(TURRET_FIT):
            tank = assembled(True, name)
            print(f'tank {name}\t{tris(tank)}')
            for o in tank:
                o.location += Vector((-k * 0.6, k * 4.4, 0))
            objs += tank
        frame(objs, 'lineup', (0.55, -1.0, 0.38), lens=50, w=1600, h=700, pad=1.3)


if MODE == 'export':
    export(OUT)
else:
    render(OUT)
