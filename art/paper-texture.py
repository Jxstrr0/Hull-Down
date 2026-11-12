# Makes the paper grain tiles in src/assets/ from the ambientCG originals in
# art/third-party/textures/ (CC0). Run: python3 art/paper-texture.py <Paper001 colour> <Paper003 colour> <grain out> <mottle out>
import sys
from PIL import Image, ImageFilter, ImageChops, ImageOps
import numpy as np

def tileable(a):
    # Blend the image with itself shifted by half, under a feathered mask, so its edges meet.
    h, w = a.shape
    shifted = np.roll(np.roll(a, h // 2, 0), w // 2, 1)
    y = np.abs(np.linspace(-1, 1, h))[:, None]
    x = np.abs(np.linspace(-1, 1, w))[None, :]
    mask = np.clip(np.maximum(x, y) * 1.6 - 0.6, 0, 1)
    return a * (1 - mask) + shifted * mask

def grain(src, out, size, blur, mean, spread):
    im = ImageOps.grayscale(Image.open(src))
    s = min(im.size)
    im = im.crop((0, 0, s, s)).resize((size, size), Image.LANCZOS)
    a = np.asarray(im, dtype=np.float32)
    low = np.asarray(im.filter(ImageFilter.GaussianBlur(blur)), dtype=np.float32)
    hp = a - low if blur > 0 else a - a.mean()
    hp = tileable(hp)
    hp = (hp - hp.mean()) / (hp.std() + 1e-6)
    v = np.clip(mean + hp * spread, 0, 255).astype(np.uint8)
    Image.fromarray(v, 'L').save(out, 'JPEG', quality=82, optimize=True)

grain(sys.argv[1], sys.argv[3], 512, 12, 236, 9)     # fine tooth, light, for multiply on paper
grain(sys.argv[2], sys.argv[4], 512, 40, 128, 22)    # creases and mottle, mid grey, for soft-light on blueprint
