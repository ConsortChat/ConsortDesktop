#!/usr/bin/env python3
"""Regenerate every Consort icon in this repository from one definition.

The mark is a chord: four voices of different range sounding together. Its
geometry is mirrored from `brand/generate.py` in the Consort server repository,
which is the source of truth -- change it there first, then copy the constants
below. They are duplicated rather than imported because the two repositories are
checked out independently and a cross-repo import would break for anyone who has
only this one.

Filenames are deliberately left as they are: `package.json` (electron-builder),
`app/renderer/about.html` and `app/renderer/network.html` refer to them by name.

    pip install pillow
    python tools/brand-assets.py

PNG rasterising goes through headless Chromium, found automatically or via
BRAND_BROWSER.
"""

import os
import pathlib
import shutil
import subprocess
import sys
import time

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
TMP = ROOT / "tools" / "_brand-tmp"

# ---------------------------------------------------------------- the mark

BARS_X = [205, 415, 625, 835]
BARS_H = [510, 830, 630, 370]
BAR_W = 165

MARK_FROM, MARK_TO = "#2DD4BF", "#0E7490"
BADGE_RED = "#F04A3F"


def stadium(x, h, w, cy):
    r = w / 2
    y0, y1 = cy - h / 2, cy + h / 2
    return (
        f"M{x - r:g} {y0 + r:g}A{r:g} {r:g} 0 0 1 {x + r:g} {y0 + r:g}"
        f"L{x + r:g} {y1 - r:g}A{r:g} {r:g} 0 0 1 {x - r:g} {y1 - r:g}Z"
    )


def chord_d(scale=1.0, dx=0.0, dy=0.0):
    return "".join(
        stadium(x * scale + dx, h * scale, BAR_W * scale, 500 * scale + dy)
        for x, h in zip(BARS_X, BARS_H)
    )


GRAD = (
    f'<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
    f'<stop offset="0" stop-color="{MARK_FROM}"/>'
    f'<stop offset="1" stop-color="{MARK_TO}"/></linearGradient>'
)


def svg_circle(badge=False):
    """Gradient disc with a white mark -- the shape every desktop icon uses."""
    s = 0.58
    off = 500 * (1 - s)
    dot = ""
    if badge:
        # Matches the placement of the badge this replaces: a 39px dot on a
        # 150px canvas, tight into the top-right corner.
        dot = f'<circle cx="830" cy="140" r="133" fill="{BADGE_RED}"/>'
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">{GRAD}'
        f'<circle cx="500" cy="500" r="500" fill="url(#g)"/>'
        f'<path d="{chord_d(s, off, off)}" fill="#fff"/>{dot}</svg>'
    )


def svg_mono(colour="#000"):
    """Flat single-colour mark on transparency -- macOS tray templates."""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">'
        f'<path d="{chord_d(0.96, 20, 20)}" fill="{colour}"/></svg>'
    )


def svg_macos():
    """macOS app icon: the platform squircle, the mark knocked out of it with an
    inner shadow. Structure kept from the icon this replaces."""
    s = 0.46
    off = 412 - 500 * s
    glyph = chord_d(s, off, off)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -100 1024 1024"><defs>\
<linearGradient id="a" x1="0" y1="0" x2="1" y2="1">\
<stop offset="0" stop-color="{MARK_FROM}"/><stop offset="1" stop-color="{MARK_TO}"/></linearGradient>\
<mask id="b"><rect x="-100" y="-100" width="1024" height="1024" fill="#fff"/>\
<path d="{glyph}" fill="#000"/></mask>\
<path id="c" d="M824 257c0-64 0-104-14-141A173 173 0 00708 14C671 0 631 0 567 0H257C193 0 153 0 116 14A173 173 0 0014 116C0 153 0 193 0 257V567c0 64 0 104 14 141A173 173 0 00116 810c37 14 77 14 141 14H567c64 0 104 0 141-14A173 173 0 00810 708c14-37 14-77 14-141Z"/>\
<filter id="d"><feGaussianBlur in="SourceGraphic" stdDeviation="10"/></filter>\
<filter id="e"><feGaussianBlur in="SourceGraphic" stdDeviation="5"/></filter></defs>\
<use href="#c" transform="translate(0 10)" fill-opacity="0.3" filter="url(#d)"/>\
<rect x="120" y="120" width="584" height="584" fill="#fff"/>\
<g filter="url(#e)"><rect x="120" y="120" width="584" height="584" fill="#0b4b58" mask="url(#b)" transform="translate(0 5)"/></g>\
<use href="#c" mask="url(#b)" fill="url(#a)"/></svg>
"""


# The wordmark, as outlines. Source Sans 3 Semibold, tracking 14/1000em, baseline
# at y=0 -- lifted verbatim from brand/consort-logo.svg so this script needs no
# font and no fonttools. It only changes if the project is renamed.
WORDMARK_D = (
    "M346.0 12.0Q263.0 12.0 195.5 -27.0Q128.0 -66.0 88.5 -141.5Q49.0 -217.0 49.0"
    " -325.0Q49.0 -432.0 89.5 -508.5Q130.0 -585.0 198.0 -625.5Q266.0 -666.0 348.0"
    " -666.0Q410.0 -666.0 458.0 -642.0Q506.0 -618.0 537.0 -583.0L475.0 -513.0Q450.0"
    " -538.0 419.5 -551.5Q389.0 -565.0 351.0 -565.0Q299.0 -565.0 257.5 -536.0Q216.0"
    " -507.0 192.0 -454.0Q168.0 -401.0 168.0 -328.0Q168.0 -216.0 218.5 -152.5Q269.0"
    " -89.0 354.0 -89.0Q396.0 -89.0 429.5 -105.5Q463.0 -122.0 489.0 -150.0L548.0"
    " -82.0Q508.0 -36.0 458.0 -12.0Q408.0 12.0 346.0 12.0ZM864.0 12.0Q803.0 12.0"
    " 750.0 -18.5Q697.0 -49.0 664.0 -106.5Q631.0 -164.0 631.0 -245.0Q631.0 -327.0"
    " 664.0 -384.5Q697.0 -442.0 750.0 -472.5Q803.0 -503.0 864.0 -503.0Q926.0 -503.0"
    " 979.0 -472.5Q1032.0 -442.0 1065.0 -384.5Q1098.0 -327.0 1098.0 -245.0Q1098.0"
    " -164.0 1065.0 -106.5Q1032.0 -49.0 979.0 -18.5Q926.0 12.0 864.0 12.0ZM864.0"
    " -82.0Q918.0 -82.0 949.0 -127.0Q980.0 -172.0 980.0 -245.0Q980.0 -319.0 949.0"
    " -364.0Q918.0 -409.0 864.0 -409.0Q810.0 -409.0 779.5 -364.0Q749.0 -319.0 749.0"
    " -245.0Q749.0 -172.0 779.5 -127.0Q810.0 -82.0 864.0 -82.0ZM1226.0 0.0V-491.0"
    "H1321.0L1329.0 -425.0H1333.0Q1366.0 -457.0 1405.0 -480.0Q1444.0 -503.0 1494.0"
    " -503.0Q1573.0 -503.0 1609.0 -452.0Q1645.0 -401.0 1645.0 -308.0V0.0H1530.0"
    "V-293.0Q1530.0 -354.0 1512.0 -379.0Q1494.0 -404.0 1453.0 -404.0Q1421.0 -404.0"
    " 1396.5 -388.5Q1372.0 -373.0 1341.0 -343.0V0.0ZM1937.0 12.0Q1886.0 12.0 1836.5"
    " -7.0Q1787.0 -26.0 1751.0 -60.0L1802.0 -126.0Q1834.0 -99.0 1868.5 -87.0Q1903.0"
    " -75.0 1941.0 -75.0Q1981.0 -75.0 2000.0 -92.0Q2019.0 -109.0 2019.0 -134.0"
    "Q2019.0 -165.0 1988.0 -181.0Q1957.0 -197.0 1916.0 -212.0Q1881.0 -225.0 1849.5"
    " -243.5Q1818.0 -262.0 1798.5 -289.5Q1779.0 -317.0 1779.0 -356.0Q1779.0 -421.0"
    " 1827.0 -462.0Q1875.0 -503.0 1957.0 -503.0Q2007.0 -503.0 2049.0 -486.5Q2091.0"
    " -470.0 2121.0 -444.0L2070.0 -379.0Q2018.0 -416.0 1960.0 -416.0Q1923.0 -416.0"
    " 1905.0 -400.5Q1887.0 -385.0 1887.0 -362.0Q1887.0 -335.0 1913.0 -320.5Q1939.0"
    " -306.0 1985.0 -290.0Q2023.0 -277.0 2055.5 -258.5Q2088.0 -240.0 2108.0 -211.5"
    "Q2128.0 -183.0 2128.0 -140.0Q2128.0 -77.0 2079.0 -32.5Q2030.0 12.0 1937.0 12.0"
    "ZM2446.0 12.0Q2385.0 12.0 2332.0 -18.5Q2279.0 -49.0 2246.0 -106.5Q2213.0 -164.0"
    " 2213.0 -245.0Q2213.0 -327.0 2246.0 -384.5Q2279.0 -442.0 2332.0 -472.5Q2385.0"
    " -503.0 2446.0 -503.0Q2508.0 -503.0 2561.0 -472.5Q2614.0 -442.0 2647.0 -384.5"
    "Q2680.0 -327.0 2680.0 -245.0Q2680.0 -164.0 2647.0 -106.5Q2614.0 -49.0 2561.0"
    " -18.5Q2508.0 12.0 2446.0 12.0ZM2446.0 -82.0Q2500.0 -82.0 2531.0 -127.0Q2562.0"
    " -172.0 2562.0 -245.0Q2562.0 -319.0 2531.0 -364.0Q2500.0 -409.0 2446.0 -409.0"
    "Q2392.0 -409.0 2361.5 -364.0Q2331.0 -319.0 2331.0 -245.0Q2331.0 -172.0 2361.5"
    " -127.0Q2392.0 -82.0 2446.0 -82.0ZM2808.0 0.0V-491.0H2903.0L2911.0 -404.0"
    "H2915.0Q2941.0 -452.0 2977.5 -477.5Q3014.0 -503.0 3054.0 -503.0Q3089.0 -503.0"
    " 3110.0 -493.0L3087.0 -395.0Q3075.0 -398.0 3065.0 -399.5Q3055.0 -401.0 3039.0"
    " -401.0Q3010.0 -401.0 2978.0 -378.5Q2946.0 -356.0 2923.0 -300.0V0.0ZM3368.0"
    " 10.0Q3283.0 10.0 3247.5 -39.0Q3212.0 -88.0 3212.0 -167.0V-400.0H3142.0V-486.0"
    "L3218.0 -491.0L3232.0 -645.0H3328.0V-491.0H3453.0V-400.0H3328.0V-167.0Q3328.0"
    " -81.0 3397.0 -81.0Q3425.0 -81.0 3448.0 -91.0L3469.0 -10.0Q3450.0 -2.0 3424.0"
    " 4.0Q3398.0 10.0 3368.0 10.0Z"
)

# Lockup geometry, matching brand/consort-logo.svg: mark box 880 tall sitting on
# the cap band, wordmark starting 190 further right. Extent -20,-790 4593x920.
LOCKUP_VB = (-20.0, -790.0, 4593.0, 920.0)


def lockup(fill):
    return (
        f'<g transform="translate(0 -770) scale(0.88)">'
        f'<path d="{chord_d()}" fill="{fill}"/></g>'
        f'<path transform="translate(1070 0)" d="{WORDMARK_D}" fill="{fill}"/>'
    )


def svg_dmg_background():
    """The DMG window backdrop: brand gradient, the lockup, and the two wells.

    Needs an explicit viewBox -- without one, scaling the <svg> element when
    rasterising leaves the contents at their original size in the corner."""
    # Sized and placed like the wordmark this replaces: ~210 wide, centred at
    # (270, 70) in the 540x380 window.
    s = 210.0 / LOCKUP_VB[2]
    cx = LOCKUP_VB[0] + LOCKUP_VB[2] / 2
    cy = LOCKUP_VB[1] + LOCKUP_VB[3] / 2
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="540" height="380" viewBox="0 0 540 380">
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="{MARK_FROM}" />
    <stop offset="1" stop-color="{MARK_TO}" />
  </linearGradient>
  <rect x="0" y="0" width="540" height="380" fill="url(#g)" />
  <g transform="translate(270 70) scale({s:.6f}) translate({-cx:.1f} {-cy:.1f})">{lockup("#fff")}</g>
  <rect x="50" y="140" width="160" height="160" rx="24" fill="#fff" opacity=".5" />
  <text x="270" y="244" font-size="64" font-family="System Font"
  text-anchor="middle" fill="#fff">&#8594;</text>
  <rect x="330" y="140" width="160" height="160" rx="24" fill="#fff" opacity=".5" />
</svg>
"""


def svg_loading(colour="#14A79B"):
    """The renderer's spinner, in brand teal."""
    return """<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="margin: auto; background: rgba(0, 0, 0, 0) none repeat scroll 0%% 0%%; display: block; shape-rendering: auto; animation-play-state: running; animation-delay: 0s;" width="150px" height="150px" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid">
<circle cx="50" cy="50" fill="none" stroke="%s" stroke-width="10" r="42" stroke-dasharray="197.92033717615698 67.97344572538566" style="animation-play-state: running; animation-delay: 0s;">
  <animateTransform attributeName="transform" type="rotate" repeatCount="indefinite" dur="1s" values="0 50 50;360 50 50" keyTimes="0;1" style="animation-play-state: running; animation-delay: 0s;"></animateTransform>
</circle>
<!-- Created with loading.io (https://loading.io/spinner/rolling/-bar-circle-curve-round-rotate) -->
<!-- "The Rolling spinner is released under loading.io free License." (https://loading.io/license/#free-license) -->
</svg>
""" % colour


# ---------------------------------------------------------------- rasterising

BROWSERS = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
]


def find_browser():
    if os.environ.get("BRAND_BROWSER"):
        return os.environ["BRAND_BROWSER"]
    for p in BROWSERS:
        if pathlib.Path(p).exists():
            return p
    found = shutil.which("chromium") or shutil.which("google-chrome")
    if found:
        return found
    raise SystemExit("No Chromium found. Set BRAND_BROWSER to one.")


RASTER = 1024


def wait_for_screenshot(png, timeout=60):
    """Wait until the browser has finished writing `png`.

    The browser exiting is not the signal: msedge.exe can return straight away
    and write the screenshot a moment later. So this waits for the file to exist
    and for its size to hold still across two looks."""
    deadline = time.monotonic() + timeout
    last = -1
    while time.monotonic() < deadline:
        size = png.stat().st_size if png.exists() else -1
        if size > 0 and size == last:
            return
        last = size
        time.sleep(0.5)
    raise SystemExit("Chromium produced no screenshot")


def render(svg_text, w=RASTER, h=RASTER):
    """SVG -> a Pillow RGBA image at w x h, transparent background."""
    TMP.mkdir(parents=True, exist_ok=True)
    html = TMP / "r.html"
    png = TMP / "r.png"
    html.write_text(
        f"<style>html,body{{margin:0;padding:0;background:transparent}}"
        f"svg{{display:block;width:{w}px;height:{h}px}}</style>{svg_text}",
        encoding="utf-8", newline="\n",
    )
    png.unlink(missing_ok=True)
    profile = TMP / "profile"
    shutil.rmtree(profile, ignore_errors=True)
    subprocess.run(
        [
            find_browser(), "--headless=new", "--disable-gpu", "--hide-scrollbars",
            "--no-first-run", "--no-default-browser-check",
            f"--user-data-dir={profile}",
            "--default-background-color=00000000",
            f"--window-size={w},{h}", f"--screenshot={png.resolve()}",
            html.resolve().as_uri(),
        ],
        check=True, capture_output=True, timeout=120,
    )
    wait_for_screenshot(png)
    img = Image.open(png).convert("RGBA")
    shutil.rmtree(profile, ignore_errors=True)
    return img


def down(img, size):
    return img.resize((size, size), Image.LANCZOS)


ICO_SIZES = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]


def write_png(img, rel, size):
    p = ROOT / rel
    down(img, size).save(p, optimize=True)
    print(f"  {rel}  {size}x{size}")


def write_ico(img, rel, sizes=ICO_SIZES):
    p = ROOT / rel
    biggest = max(s[0] for s in sizes)
    down(img, biggest).save(p, format="ICO", sizes=sizes)
    print(f"  {rel}  {sorted(s[0] for s in sizes)}")


def write_text(text, rel):
    (ROOT / rel).write_text(text, encoding="utf-8", newline="\n")
    print(f"  {rel}")


def main():
    print("rendering masters...")
    circle = render(svg_circle())
    circle_badge = render(svg_circle(badge=True))
    mono = render(svg_mono())
    macos = render(svg_macos())

    print("app icons:")
    write_ico(circle, "build/icon.ico")
    write_ico(circle, "public/resources/Icon.ico")
    write_ico(circle, "public/resources/tray/traywin.ico")
    write_ico(circle_badge, "public/resources/tray/trayunread.ico", [(150, 150)])
    write_png(macos, "build/icon-macos.png", 512)
    write_text(svg_macos(), "build/icon-macos.svg")
    write_png(circle, "build/zulip.png", 512)
    write_png(circle, "app/resources/zulip.png", 512)
    write_png(circle, "app/renderer/img/icon.png", 48)
    write_png(circle, "app/renderer/img/ic_server_tab_default.png", 48)
    write_png(circle, "public/resources/Icon.png", 48)
    write_png(circle, "public/resources/tray/traylinux.png", 48)

    print("macOS tray templates (monochrome, macOS tints them):")
    for size, suffix in [(16, ""), (32, "@2x"), (48, "@3x"), (64, "@4x")]:
        write_png(mono, f"public/resources/tray/traymacOSTemplate{suffix}.png", size)

    print("macOS icns:")
    icns = ROOT / "build/dmg-icon.icns"
    down(macos, 1024).save(icns, format="ICNS")
    print(f"  build/dmg-icon.icns  1024")

    print("dmg background:")
    write_text(svg_dmg_background(), "build/dmg-background.svg")
    bg = render(svg_dmg_background(), 1080, 760).resize((540, 380), Image.LANCZOS)
    bg.convert("RGB").save(ROOT / "build/dmg-background.tiff", format="TIFF")
    print("  build/dmg-background.tiff  540x380")

    print("renderer:")
    write_text(svg_loading(), "app/renderer/img/ic_loading.svg")

    # The offline graphic: keep its globe and ellipsis, swap only the mark, which
    # sits in a 102x102 box at (34, 12).
    net = Image.open(ROOT / "app/renderer/img/zulip_network.png").convert("RGBA")
    box = (34, 12, 136, 114)
    net.paste(Image.new("RGBA", (102, 102), (0, 0, 0, 0)), box)
    net.alpha_composite(down(circle, 102), (34, 12))
    net.save(ROOT / "app/renderer/img/zulip_network.png", optimize=True)
    print("  app/renderer/img/zulip_network.png  415x122 (mark only)")

    shutil.rmtree(TMP, ignore_errors=True)
    print("done")


if __name__ == "__main__":
    sys.exit(main())
