# The side skirts sketch for the design office, drawn straight to a mask (white
# lines, the rest clear) in the style of the Blender part sketches. Faces are
# filled clear and drawn back to front, so nearer plates hide the ones behind.
# Run: python3 art/sketch-skirts.py public/sketches/skirts.png   (needs Pillow)
import sys

from PIL import Image, ImageDraw

W, H, K = 360, 180, 4          # final size, and drawn K times larger then shrunk
LINE = 6                       # line width at K times
out = sys.argv[1] if len(sys.argv) > 1 else 'skirts.png'


def at(x, y, z):
    # x along the tank, y up, z out from the side; a three-quarter view.
    return ((72 + 0.85 * (x * 0.92 + z * 0.55)) * K, (118 - 0.85 * (y - x * 0.22 + z * 0.42)) * K)


def box(x0, x1, y0, y1, z0, z1):
    """The three faces of a slab that face the viewer: top, front (z1), and the left end."""
    p = lambda x, y, z: at(x, y, z)
    top = [p(x0, y1, z0), p(x1, y1, z0), p(x1, y1, z1), p(x0, y1, z1)]
    front = [p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1)]
    end = [p(x0, y0, z0), p(x0, y0, z1), p(x0, y1, z1), p(x0, y1, z0)]
    return [end, top, front]


img = Image.new('L', (W * K, H * K), 0)
draw = ImageDraw.Draw(img)
faces = []
# Four plates a little apart, then the rail they hang from, in front of their tops.
for i in range(4):
    x0 = 4 + i * 59
    faces += box(x0, x0 + 56, 20, 96, 4, 9)
faces += box(0, 240, 96, 104, 0, 10)
for face in faces:
    draw.polygon(face, fill=0)
    draw.line(face + [face[0]], fill=255, width=LINE, joint='curve')
# Two bolts along the top of each plate.
for i in range(4):
    for bx in (12, 44):
        cx, cy = at(4 + i * 59 + bx, 88, 9)
        r = 2.5 * K
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=255, width=LINE - 2)

alpha = img.resize((W, H), Image.LANCZOS)
Image.merge('LA', (Image.new('L', (W, H), 255), alpha)).save(out, optimize=True)
print(out)
