# Packs the Blender renders from art/part-sketches.py into public/sketches/:
# each one cropped to its lines, set on a 2:1 sheet, made 360 x 180, and kept as
# a mask (white lines, the rest clear). The game paints the mask in the page's ink.
# Run: python3 art/part-sketches-pack.py <render folder> public/sketches   (needs Pillow)
import os
import sys

from PIL import Image

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
W, H, PAD = 360, 180, 10
for name in sorted(os.listdir(src)):
    if not name.endswith('.png'):
        continue
    alpha = Image.open(os.path.join(src, name)).convert('RGBA').getchannel('A')
    box = alpha.getbbox()
    if not box:
        continue
    alpha = alpha.crop(box)
    scale = min((W - 2 * PAD) / alpha.width, (H - 2 * PAD) / alpha.height)
    alpha = alpha.resize((max(1, round(alpha.width * scale)), max(1, round(alpha.height * scale))), Image.LANCZOS)
    sheet = Image.new('LA', (W, H), (255, 0))
    lines = Image.new('L', alpha.size, 255)
    sheet.paste(Image.merge('LA', (lines, alpha)), ((W - alpha.width) // 2, (H - alpha.height) // 2))
    sheet.save(os.path.join(out, name), optimize=True)
    print(name, os.path.getsize(os.path.join(out, name)))
