# The casemate sketch for the design office, drawn straight to a mask (white
# lines, the rest clear) in the style of the Blender part sketches. Faces are
# filled clear and drawn back to front, so nearer ones hide those behind.
# Run: python3 art/sketch-casemate.py public/sketches/turret-casemate.png   (needs Pillow)
import sys

from PIL import Image, ImageDraw

W, H, K = 360, 180, 4          # final size, and drawn K times larger then shrunk
LINE = 6                       # line width at K times
out = sys.argv[1] if len(sys.argv) > 1 else 'turret-casemate.png'


def at(x, y, z):
    # x along the tank, y up, y up, z out towards the viewer; a three-quarter view.
    return ((60 + 0.85 * (x * 0.92 + z * 0.55)) * K, (118 - 0.85 * (y - x * 0.22 + z * 0.42)) * K)


def face(*points):
    # The tank faces the viewer's end: its forward is down x, so the front plate shows.
    return [at(320 - x, y, z) for x, y, z in points]


def slab(x0, x1, y0, y1, z0, z1):
    """The three faces of a slab that face the viewer: the front end (x1), the top and the near side."""
    return [
        face((x1, y0, z0), (x1, y0, z1), (x1, y1, z1), (x1, y1, z0)),
        face((x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)),
        face((x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)),
    ]


img = Image.new('L', (W * K, H * K), 0)
draw = ImageDraw.Draw(img)
faces = []
# A strip of the hull deck it stands on.
faces += slab(-20, 175, -12, 0, -55, 55)
# The casemate: square at the back, its front plate laid well back.
back, top_front, foot, high, side = 0, 92, 150, 55, 45
faces.append(face((back, high, -side), (top_front, high, -side), (top_front, high, side), (back, high, side)))
faces.append(face((top_front, high, -side), (foot, 0, -side), (foot, 0, side), (top_front, high, side)))
faces.append(face((back, 0, side), (foot, 0, side), (top_front, high, side), (back, high, side)))
# A hatch on the roof, and the mantlet round the gun on the front plate.
faces.append(face((22, high, -8), (52, high, -8), (52, high, 22), (22, high, 22)))
faces += slab(118, 136, 18, 40, -12, 12)
# The gun, reaching forward out of the mantlet.
faces += slab(136, 300, 26, 33, -3.5, 3.5)
faces += slab(200, 222, 24, 35, -5.5, 5.5)
for each in faces:
    draw.polygon(each, fill=0)
    draw.line(each + [each[0]], fill=255, width=LINE, joint='curve')

alpha = img.resize((W, H), Image.LANCZOS)
Image.merge('LA', (Image.new('L', (W, H), 255), alpha)).save(out, optimize=True)
print(out)
