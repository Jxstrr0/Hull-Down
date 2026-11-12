# The tracks-or-wheels sketches for the design office, drawn straight to a mask
# (white lines, the rest clear) in the style of the Blender part sketches: a
# lower hull side seen three-quarter on, standing on tracks or on 4, 6 or 8
# wheels. Faces are filled clear and drawn back to front, so nearer parts hide
# the ones behind.
# Run: python3 art/sketch-layouts.py public/sketches   (needs Pillow)
import math
import sys

from PIL import Image, ImageDraw

W, H, K = 360, 180, 4          # final size, and drawn K times larger then shrunk
LINE = 6                       # line width at K times
FINE = 4
out = sys.argv[1] if len(sys.argv) > 1 else '.'


def at(x, y, z):
    # x along the hull, y up, z out from the side; a three-quarter view.
    return ((60 + 0.85 * (x * 0.92 + z * 0.55)) * K, (150 - 0.85 * (y - x * 0.12 + z * 0.42)) * K)


def poly(draw, points, width=LINE):
    draw.polygon(points, fill=0)
    draw.line(points + [points[0]], fill=255, width=width, joint='curve')


def hull(draw, y0):
    """The lower hull: a long slab with a sloped nose, behind the running gear."""
    x0, x1, y1, z0, z1 = 0, 260, y0 + 52, -30, 0
    nose = 26
    top = [at(x0, y1, z0), at(x1 - nose, y1, z0), at(x1 - nose, y1, z1), at(x0, y1, z1)]
    side = [at(x0, y0, z1), at(x1 - nose * 1.6, y0, z1), at(x1, y0 + 30, z1), at(x1 - nose, y1, z1), at(x0, y1, z1)]
    poly(draw, top)
    poly(draw, side)


def disc(draw, x, y, z, r, rings=True):
    """A wheel seen three-quarter on: an ellipse, with its hub."""
    cx, cy = at(x, y, z)
    rx, ry = r * 0.85 * 0.8 * K, r * 0.85 * K
    draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=0, outline=255, width=LINE)
    if rings:
        draw.ellipse((cx - rx * 0.55, cy - ry * 0.55, cx + rx * 0.55, cy + ry * 0.55), outline=255, width=FINE)
    h = 0.16
    draw.ellipse((cx - rx * h, cy - ry * h, cx + rx * h, cy + ry * h), outline=255, width=FINE)


def tyre(draw, x, z, r):
    """A tyre: its tread band behind, then the face with rim and hub, and tread lines across the band."""
    back = at(x, r, z - 14)
    front = at(x, r, z)
    rx, ry = r * 0.85 * 0.8 * K, r * 0.85 * K
    draw.ellipse((back[0] - rx, back[1] - ry, back[0] + rx, back[1] + ry), fill=0, outline=255, width=LINE)
    for i in range(10):
        a = math.pi * (0.45 + i * 0.11)
        sx, sy = math.cos(a) * rx, math.sin(a) * ry
        draw.line((back[0] + sx, back[1] + sy, front[0] + sx, front[1] + sy), fill=255, width=FINE)
    disc(draw, x, r, z, r)
    # Wheel nuts round the hub.
    for i in range(6):
        a = i * math.pi / 3
        nx, ny = front[0] + math.cos(a) * rx * 0.36, front[1] + math.sin(a) * ry * 0.36
        draw.ellipse((nx - 1.4 * K, ny - 1.4 * K, nx + 1.4 * K, ny + 1.4 * K), fill=255)


def tracks(draw):
    hull(draw, 26)
    # The track loop, as a band with link lines across its top and bottom runs.
    r = 20
    ends = [(22, 24), (238, 30)]
    loop = []
    for side in range(2):
        cx, cy = ends[1 - side] if side == 0 else ends[0]
        start = -math.pi / 2 if side == 0 else math.pi / 2
        for i in range(13):
            a = start + i * math.pi / 12
            loop.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    # Bottom run flat on the ground between the end wheels.
    outer = [at(x, y, 6) for x, y in loop]
    inner = [at(x, y, -10) for x, y in loop]
    poly(draw, inner)
    poly(draw, outer)
    # Road wheels and the end wheels inside the loop.
    for i in range(6):
        disc(draw, 50 + i * 32, 17, 6, 13)
    disc(draw, ends[0][0], ends[0][1], 6, 14)
    disc(draw, ends[1][0], ends[1][1], 6, 14)
    # Link lines along the top run.
    for i in range(22):
        x = 26 + i * 9.6
        y = 4 + (x - 22) / 216 * 6 + 40
        a, b = at(x, y + 3.5, 6), at(x, y + 3.5, -10)
        draw.line(a + b, fill=255, width=FINE)


def wheels(draw, n):
    hull(draw, 30)
    r = 34 if n == 4 else 30
    xs = {4: [56, 206], 6: [40, 104, 214], 8: [36, 92, 170, 226]}[n]
    for x in xs:
        tyre(draw, x, 8, r)


def save(name, paint):
    img = Image.new('L', (W * K, H * K), 0)
    paint(ImageDraw.Draw(img))
    alpha = img.resize((W, H), Image.LANCZOS)
    path = f'{out}/{name}.png'
    Image.merge('LA', (Image.new('L', (W, H), 255), alpha)).save(path, optimize=True)
    print(path)


save('layout-tracks', tracks)
for count in (4, 6, 8):
    save(f'layout-wheels{count}', lambda d, c=count: wheels(d, c))
