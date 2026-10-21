#!/usr/bin/env python3
"""Génère les icônes DevMaster (192, 512, maskable 512, 180 apple-touch)."""
from PIL import Image, ImageDraw
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "icons")
BG = (10, 13, 20)          # #0A0D14
PANEL = (14, 20, 32)       # #0E1420
BORDER = (0, 74, 95)       # cyan sourd
CYAN = (0, 216, 255)       # #00D8FF
CYAN_SOFT = (103, 232, 249)  # #67E8F9
AMBER = (245, 158, 11)     # #F59E0B


def draw_icon(size, maskable=False):
    img = Image.new("RGB", (size, size), BG)
    d = ImageDraw.Draw(img)

    if not maskable:
        pad = int(size * 0.045)
        radius = int(size * 0.22)
        d.rounded_rectangle(
            [pad, pad, size - pad, size - pad],
            radius=radius, fill=PANEL, outline=BORDER,
            width=max(1, size // 72),
        )

    # Zone sûre : le motif reste dans 60 % du cadre pour le maskable
    s = size * (0.30 if not maskable else 0.24)
    cx, cy = size / 2, size / 2
    lw = max(2, int(size * 0.045))

    def chevron(x_center, direction):
        dx = 0.17 * s * direction
        pts = [
            (x_center + dx, cy - 0.30 * s),
            (x_center - dx, cy),
            (x_center + dx, cy + 0.30 * s),
        ]
        d.line(pts, fill=CYAN, width=lw, joint="curve")

    chevron(cx - 0.30 * s, 1)    # « < »
    chevron(cx + 0.30 * s, -1)   # « > »
    # barre oblique centrale (accent ambre)
    d.line([(cx + 0.12 * s, cy - 0.34 * s), (cx - 0.12 * s, cy + 0.34 * s)],
           fill=AMBER, width=max(2, lw - 1))
    # petite virgule / point de données
    r = max(2, int(size * 0.028))
    d.ellipse([cx - 0.30 * s - r, cy + 0.30 * s - r,
               cx - 0.30 * s + r, cy + 0.30 * s + r], fill=CYAN_SOFT)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    targets = [
        ("icon-192.png", 192, False),
        ("icon-512.png", 512, False),
        ("icon-maskable-512.png", 512, True),
        ("icon-180.png", 180, False),
    ]
    for name, size, maskable in targets:
        img = draw_icon(size, maskable)
        path = os.path.join(OUT, name)
        img.save(path, "PNG", optimize=True)
        print(f"{name}: {size}x{size} ({os.path.getsize(path)} octets)")


if __name__ == "__main__":
    main()
