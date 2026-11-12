# Packs the Blender renders from art/part-sketches.py into public/sketches/:
# each one made 360 x 180 and kept as a mask (white lines, the rest clear). The
# renders are already framed (and parts in a group share a scale), so nothing is
# cropped. The game paints the mask in the page's ink.
# Run: python3 art/part-sketches-pack.py <render folder> public/sketches   (needs Pillow)
import os
import sys

from PIL import Image

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
W, H = 360, 180
for name in sorted(os.listdir(src)):
    if not name.endswith('.png'):
        continue
    alpha = Image.open(os.path.join(src, name)).convert('RGBA').getchannel('A').resize((W, H), Image.LANCZOS)
    if not alpha.getbbox():
        continue
    sheet = Image.merge('LA', (Image.new('L', (W, H), 255), alpha))
    sheet.save(os.path.join(out, name), optimize=True)
    print(name, os.path.getsize(os.path.join(out, name)))
