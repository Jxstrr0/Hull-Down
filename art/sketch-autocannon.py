# The 30 mm cannon sketch for the design office, drawn straight to a mask
# (white lines, the rest clear) in the style of the Blender gun sketches: a
# boxy receiver, the belt feed chute, and a thin barrel with a flash eliminator.
# Faces facing the viewer are filled clear and drawn back to front, so nearer
# ones hide those behind.
# Run: python3 art/sketch-autocannon.py public/sketches/gun-autocannon30.png   (needs Pillow)
import math
import sys

from PIL import Image, ImageDraw

W, H, K = 360, 180, 4          # final size, and drawn K times larger then shrunk
LINE = 6                       # line width at K times
out = sys.argv[1] if len(sys.argv) > 1 else 'gun-autocannon30.png'
# Towards the viewer: the projection below flattens along this line.
VIEW = (0.598, 0.552, -1.0)


def at(x, y, z):
    # x along the gun, breech to muzzle; y up; z across. A three-quarter view from above.
    return ((22 + 0.98 * (x * 0.92 + z * 0.55)) * K, (66 - 0.98 * (y - x * 0.22 + z * 0.42)) * K)


def depth(points):
    return sum(sum(p[i] * VIEW[i] for i in range(3)) for p in points) / len(points)


def normal(points):
    a, b, c = points[0], points[1], points[2]
    u = [b[i] - a[i] for i in range(3)]
    v = [c[i] - a[i] for i in range(3)]
    return (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])


faces = []


def facing(points):
    n = normal(points)
    return sum(n[i] * VIEW[i] for i in range(3)) < 0


def add(points, edges=None):
    """One flat face, wound so its normal points out, kept only if it faces the viewer. `edges` picks which sides to ink: all when not given."""
    if facing(points):
        faces.append((points, list(range(len(points))) if edges is None else edges))


def box(x0, x1, y0, y1, z0, z1):
    add([(x0, y0, z0), (x0, y1, z0), (x1, y1, z0), (x1, y0, z0)])
    add([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)])
    add([(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)])
    add([(x0, y1, z0), (x0, y1, z1), (x1, y1, z1), (x1, y1, z0)])
    add([(x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0)])
    add([(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)])


def tube(x0, x1, r, y=0.0, z=0.0, sides=14):
    """A round bar along x, as a prism of many sides."""
    ring = [(y + r * math.cos(2 * math.pi * i / sides), z + r * math.sin(2 * math.pi * i / sides)) for i in range(sides)]
    sidewall = []
    for i in range(sides):
        (ya, za), (yb, zb) = ring[i], ring[(i + 1) % sides]
        sidewall.append([(x0, ya, za), (x0, yb, zb), (x1, yb, zb), (x1, ya, za)])
    shown = [facing(each) for each in sidewall]
    for i, each in enumerate(sidewall):
        # Ink only the round outline: the ends of the bar, and the long sides where it turns away out of sight.
        edges = [0, 2]
        if not shown[(i - 1) % sides]:
            edges.append(3)
        if not shown[(i + 1) % sides]:
            edges.append(1)
        add(each, edges)
    add([(x1, a, b) for a, b in ring])
    add([(x0, a, b) for a, b in reversed(ring)])


# The receiver, its feed chute coming in from the side, and the cradle under it.
box(30, 110, -14, 14, -12, 12)
box(50, 80, 14, 20, -24, 12)
box(40, 100, -20, -14, -8, 8)
# The barrel, the collar where it leaves the receiver, the recoil sleeve, and the flash eliminator.
tube(110, 300, 4.5)
tube(110, 132, 8)
tube(132, 170, 6)
tube(282, 304, 6.5)

img = Image.new('L', (W * K, H * K), 0)
draw = ImageDraw.Draw(img)
for points, edges in sorted(faces, key=lambda face: depth(face[0]), reverse=True):
    flat = [at(*p) for p in points]
    draw.polygon(flat, fill=0)
    for i in edges:
        draw.line([flat[i], flat[(i + 1) % len(flat)]], fill=255, width=LINE)
    for i in edges:
        for end in (flat[i], flat[(i + 1) % len(flat)]):
            draw.ellipse([end[0] - LINE / 2, end[1] - LINE / 2, end[0] + LINE / 2, end[1] + LINE / 2], fill=255)

alpha = img.resize((W, H), Image.LANCZOS)
Image.merge('LA', (Image.new('L', (W, H), 255), alpha)).save(out, optimize=True)
print(out)
