"""Background removal: python cutout.py <in image> <out.png>

Writes a PNG with the background made transparent and the empty border cropped away, then prints
{"w", "h"} of the result. Uses rembg (u2net; the model downloads to ~/.u2net on first use).
"""
import json
import sys

from PIL import Image
from rembg import remove


def main() -> None:
    src, out = sys.argv[1], sys.argv[2]
    img = remove(Image.open(src).convert("RGBA"))
    box = img.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    if box is None:
        sys.exit("nothing left after removing the background")
    pad = max(4, round(max(img.size) * 0.01))
    l, t, r, b = box
    img = img.crop((max(0, l - pad), max(0, t - pad), min(img.width, r + pad), min(img.height, b + pad)))
    img.save(out)
    print(json.dumps({"w": img.width, "h": img.height}))


if __name__ == "__main__":
    main()
