from PIL import Image, ImageDraw

S = 512  # supersample canvas, then downscale


def bez(p0, p1, p2, n=80):
    pts = []
    for i in range(n + 1):
        t = i / n
        mt = 1 - t
        x = mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0]
        y = mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1]
        pts.append((x, y))
    return pts


def sc(v):
    return v * S / 128.0


def draw():
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    bg = (23, 26, 33, 255)      # #171a21
    border = (39, 44, 55, 255)  # #272c37
    white = (230, 233, 239, 255)
    orange = (255, 102, 51, 255)

    d.rounded_rectangle([sc(1), sc(1), sc(127), sc(127)], radius=sc(28), fill=bg)
    d.rounded_rectangle([sc(2), sc(2), sc(126), sc(126)], radius=sc(26),
                        outline=border, width=int(sc(2)))

    w = int(sc(6))
    for p0, p1, p2 in [((30, 64), (46, 34), (64, 34)), ((64, 34), (82, 34), (98, 64))]:
        pts = [(sc(x), sc(y)) for x, y in bez(p0, p1, p2)]
        d.line(pts, fill=orange, width=w, joint="curve")
        r = w / 2
        for ex, ey in (pts[0], pts[-1]):
            d.ellipse([ex - r, ey - r, ex + r, ey + r], fill=orange)

    def circle(cx, cy, r, fill):
        d.ellipse([sc(cx - r), sc(cy - r), sc(cx + r), sc(cy + r)], fill=fill)

    circle(30, 64, 11, white)
    circle(98, 64, 11, white)
    circle(64, 34, 14, orange)

    d.rounded_rectangle([sc(50), sc(86), sc(78), sc(104)], radius=sc(4), fill=orange)
    d.rounded_rectangle([sc(55), sc(92), sc(73), sc(94.5)], radius=sc(1.25), fill=bg)
    d.rounded_rectangle([sc(55), sc(97), sc(67), sc(99.5)], radius=sc(1.25), fill=bg)

    return img


master = draw()
for size in (16, 32, 48, 128):
    master.resize((size, size), Image.LANCZOS).save(f"icon{size}.png")
print("done")
