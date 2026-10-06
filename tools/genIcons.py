"""Map icon factory. Every raster in assets/map (except photo art, of which
there is none) generates from the manifest below at 3x and downscales with
LANCZOS to 2x/1x. Regenerate with `python3 tools/genIcons.py` from the repo
root; re-runs are no-op diffs unless the manifest changes. Hand edits to the
PNGs will be overwritten — change the painter instead."""

from PIL import Image, ImageDraw, ImageFont

FONT = "/usr/share/fonts/liberation/LiberationSans-Bold.ttf"

ACCIDENT = "#dc2626"
FLOOD = "#0284c7"
OBSTRUCTION = "#d97706"
LOCK_RING = "#7f1d1d"
WHITE = "white"


def canvas(size):
    return Image.new("RGBA", (size, size), (0, 0, 0, 0))


def disc(d, size, fill, ring, ring_width):
    m = size / 2
    r = size / 2 - ring_width / 2
    d.ellipse([m - r, m - r, m + r, m + r], fill=fill, outline=ring, width=ring_width)


def letter(d, size, text, fill=WHITE):
    font = ImageFont.truetype(FONT, int(size * 0.52))
    box = d.textbbox((0, 0), text, font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    d.text(((size - w) / 2 - box[0], (size - h) / 2 - box[1] - size * 0.02), text, font=font, fill=fill)


def drop(d, size, fill=WHITE):
    u = size / 168
    cx = size / 2
    d.ellipse([cx - 30 * u, 62 * u, cx + 30 * u, 122 * u], fill=fill)
    d.polygon([(cx - 24 * u, 74 * u), (cx + 24 * u, 74 * u), (cx, 34 * u)], fill=fill)


def crash(d, size, fill=WHITE):
    u = size / 168
    d.polygon([(36 * u, 108 * u), (36 * u, 88 * u), (58 * u, 88 * u), (70 * u, 70 * u),
               (100 * u, 70 * u), (112 * u, 88 * u), (132 * u, 88 * u), (132 * u, 108 * u)], fill=fill)
    for wx in (58 * u, 110 * u):
        d.ellipse([wx - 11 * u, 100 * u, wx + 11 * u, 122 * u], fill=fill)
        d.ellipse([wx - 4 * u, 107 * u, wx + 4 * u, 115 * u], fill="#dc2626")
    for dx, dy in ((-1, -1), (1, -1), (0, -1), (-1, 1), (1, 1)):
        d.line([(84 * u, 52 * u), (84 * u + dx * 16 * u, 52 * u + dy * 14 * u)], fill=fill, width=max(2, round(6 * u)))


def barrier(d, size, stripe, fill=WHITE):
    u = size / 168
    d.rounded_rectangle([34 * u, 66 * u, 134 * u, 96 * u], radius=round(8 * u), fill=fill)
    for i in range(3):
        x = (52 + i * 26) * u
        d.polygon([(x, 96 * u), (x + 12 * u, 66 * u), (x + 22 * u, 66 * u), (x + 10 * u, 96 * u)], fill=stripe)
    for lx in (52 * u, 116 * u):
        d.rectangle([lx - 4 * u, 96 * u, lx + 4 * u, 128 * u], fill=fill)


def arrow_up(d, size, fill=WHITE):
    u = size / 168
    cx = size / 2
    d.polygon([(cx, 30 * u), (cx + 30 * u, 122 * u), (cx, 104 * u), (cx - 30 * u, 122 * u)], fill=fill)


def storefront(d, size, fill, edge):
    u = size / 168
    box = [round(8 * u), round(8 * u), round(160 * u), round(160 * u)]
    d.rounded_rectangle(box, radius=round(38 * u), fill=fill, outline=edge, width=max(1, round(7 * u)))
    for i in range(5):
        x0 = (34 + i * 20) * u
        x1 = (34 + i * 20 + 20) * u
        if i % 2 == 0:
            d.polygon([(round(x0), round(52 * u)), (round(x1), round(52 * u)),
                       (round(x1 + 5 * u), round(78 * u)), (round(x0 - 5 * u), round(78 * u))], fill="white")
    r = lambda *vs: [round(v) for v in vs]
    d.rectangle(r(50 * u, 78 * u, 118 * u, 128 * u), fill="white")
    d.rectangle(r(75 * u, 96 * u, 93 * u, 128 * u), fill=fill)
    d.rectangle(r(56 * u, 86 * u, 69 * u, 99 * u), fill=fill)
    d.rectangle(r(99 * u, 86 * u, 112 * u, 99 * u), fill=fill)


def map_pin(d, size, fill="#1f2937"):
    u = size / 168
    cx = size / 2
    d.ellipse([cx - 52 * u, 12 * u, cx + 52 * u, 116 * u], fill=fill)
    d.polygon([(cx - 34 * u, 92 * u), (cx + 34 * u, 92 * u), (cx, 152 * u)], fill=fill)
    d.ellipse([cx - 14 * u, 48 * u, cx + 14 * u, 76 * u], fill="white")


TYPE_COLORS = {"accident": ACCIDENT, "flood": FLOOD, "obstruction": OBSTRUCTION}
TYPE_GLYPHS = {"accident": crash, "flood": drop, "obstruction": barrier}
STATUS_RING = {"1": WHITE, "2": WHITE, "3": LOCK_RING}
FLAG_FILL = {"0": "#6b7280", "1": "#f59e0b", "2": "#dc2626", "3": "#7f1d1d"}

MANIFEST = []


def emit(name, base, painter):
    MANIFEST.append((name, base, painter))


for t, color in TYPE_COLORS.items():
    for s in ("1", "2", "3"):
        def pin(d, size, color=color, s=s, glyph=TYPE_GLYPHS[t]):
            u = size / 168
            disc(d, size, color, STATUS_RING[s], round(9 * u))
            if glyph == barrier:
                glyph(d, size, color)
            else:
                glyph(d, size)
        emit("pin-%s-%s" % (t, s), 56, pin)

for n, fill in FLAG_FILL.items():
    def flag(d, size, fill=fill):
        disc(d, size, fill, WHITE, round(9 * size / 168))
    emit("flag-%s" % n, 56, flag)


def adot(d, size):
    u = size / 168
    disc(d, size, FLOOD, WHITE, round(9 * u))
    letter(d, size, "A")


def ticketdot(d, size):
    disc(d, size, FLOOD, WHITE, round(9 * size / 168))


def bdot(d, size):
    u = size / 168
    disc(d, size, "#dd2929", WHITE, round(9 * u))
    letter(d, size, "B")


def stopdot(d, size):
    disc(d, size, "#2563eb", WHITE, round(9 * size / 168))


def handledot(d, size):
    disc(d, size, WHITE, FLOOD, round(12 * size / 168))


def navarrow(d, size):
    u = size / 168
    disc(d, size, FLOOD, WHITE, round(9 * u))
    arrow_up(d, size)


emit("a-dot", 84, adot)
emit("ticket-dot", 84, ticketdot)
emit("b-dot", 84, bdot)
emit("stop-dot", 84, stopdot)
emit("handle2-dot", 84, handledot)
emit("nav-arrow", 84, navarrow)
emit("pin-preview", 56, lambda d, size: map_pin(d, size))

SHOP_STATES = {
    "shop-pin": ("#16a34a", "#14532d"),
    "shop-pin-closed": ("#6b7280", "#374151"),
    "shop-pin-unknown": ("#9ca3af", "#4b5563"),
}
for name, (fill, edge) in SHOP_STATES.items():
    def shop(d, size, fill=fill, edge=edge):
        storefront(d, size, fill, edge)
    emit(name, 56, shop)


def folder_of(name):
    if name.startswith(("pin-", "flag-", "pin-preview")):
        return "hazards"
    if name.startswith("shop-pin"):
        return "shops"
    if name.startswith("nav-arrow"):
        return "navigation"
    return "route"


def main():
    for name, base, painter in MANIFEST:
        folder = folder_of(name)
        big = canvas(base * 3)
        painter(ImageDraw.Draw(big), base * 3)
        big.save("assets/map/%s/%s@3x.png" % (folder, name))
        big.resize((base * 2, base * 2), Image.LANCZOS).save("assets/map/%s/%s@2x.png" % (folder, name))
        out = big.resize((base, base), Image.LANCZOS)
        out.save("assets/map/%s/%s.png" % (folder, name))
        print("wrote", name)


if __name__ == "__main__":
    main()
