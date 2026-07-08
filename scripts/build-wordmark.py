#!/usr/bin/env python3
"""Convert the hero wordmark + tagline to Inter vector paths.

GitHub renders the profile SVG as an <img>, where @font-face web fonts often do
not apply, so the wordmark is baked to outlines from the real Inter font (the
same family the website uses) at the matching weight. Writes scripts/wordmark.json
for generate-hero.mjs to embed. Committed output means the node generator needs
no Python at build time.

Requires: fonttools, brotli.  Run: python scripts/build-wordmark.py
"""

import json
import os

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(
    HERE,
    "..", "..", "voidprojects-site", "node_modules",
    "@fontsource-variable", "inter", "files", "inter-latin-wght-normal.woff2",
)

# (text, font-size px, weight, letter-spacing px) — weight/size mirror the site:
# the hero title is Inter bold, the tagline a lighter medium.
LINES = {
    "wordmark": ("VOID PROJECTS", 76.0, 700, 7.0),
    "tagline": ("AI-CENTRIC PROJECTS FROM A DEVELOPER COLLECTIVE", 19.0, 500, 6.0),
}


def build_line(text, size, weight, tracking):
    font = TTFont(FONT)
    instantiateVariableFont(font, {"wght": weight}, inplace=True)
    upm = font["head"].unitsPerEm
    cmap = font.getBestCmap()
    glyphset = font.getGlyphSet()
    hmtx = font["hmtx"]
    scale = size / upm

    svgpen = SVGPathPen(glyphset, ntos=lambda v: f"{v:.2f}")
    x = 0.0
    for ch in text:
        gname = cmap.get(ord(ch))
        if gname is None:
            gname = cmap.get(ord(" "))
        # y flipped (font y-up -> svg y-down), baseline at y=0, shifted to x cursor
        tpen = TransformPen(svgpen, (scale, 0, 0, -scale, x, 0))
        glyphset[gname].draw(tpen)
        x += hmtx[gname][0] * scale + tracking
    width = x - tracking  # drop the trailing track
    return {"d": svgpen.getCommands(), "width": round(width, 2)}


def main():
    out = {name: build_line(*args) for name, args in LINES.items()}
    dest = os.path.join(HERE, "wordmark.json")
    with open(dest, "w") as fh:
        json.dump(out, fh, indent="\t")
    for name, v in out.items():
        print(f"{name}: width {v['width']}px, {len(v['d'])} path chars")
    print(f"wrote {dest}")


if __name__ == "__main__":
    main()
