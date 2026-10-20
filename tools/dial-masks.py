#!/usr/bin/env python3
"""Write the two alpha-only SVG masks of the home hero dial (re-fitted to the home headline of the four-background hero):
assets/bg-dial-a.svg and assets/bg-dial-b.svg.

Stdlib only. Geometry lives here, colour lives in CSS: each file is used as a
CSS mask-image over a role-token background, so one pair of files recolours
itself in all six themes (a mask only needs alpha, and an SVG used as an image
cannot read var() anyway).

The dial is an instrument face seen as one arc of a large circle in the empty
right of the hero. Two files, one box, one circle centre:

  A  (never moves)   the bezel (one continuous arc), the outer scale of radial
                     hairline ticks (a long tick every 4th, the longest every
                     8th), a hairline ring, the inner scale, the index (a long
                     radial line at the middle of the arc and a small caret just
                     outside the bezel).
  B  (the vernier)   the outer scale's shadow and the inner scale's shadow: short
                     ticks only, whose pitch is 2 percent finer than A's. CSS turns
                     B about the circle's centre by a fraction of a degree, which
                     slides the place where the two scales line up along the arc
                     about 51 times as far as the ticks move.

Both scales have a tick at the middle of the arc, so with B at rest the two
coincide there, the index points at the clean zone, and the arc reads as one
graduated scale. The sweep tapers to nothing at both ends, so the dial dissolves
rather than being cut off. Alpha is quantised to a few levels so each file is a
few short <path> elements.

The box is the ink's own bounding box, not the whole circle: the centre is far to
the right of it. This script prints the box, the circle centre in box
coordinates and the numbers that styles.css repeats (width, height, left, top,
transform-origin, GAIN in app.js). Run it again after any change, and rename the
two files, because the pages cache them under a fixed URL.

    python3 tools/dial-masks.py
"""
import argparse, math, os

p = argparse.ArgumentParser(description=__doc__.split('\n')[0])
p.add_argument('--out', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets'))
p.add_argument('--name', default='bg-dial')
p.add_argument('--radius', type=float, default=252, help='bezel radius (outer edge of the ticks), px')
p.add_argument('--sweep', type=float, default=130, help='arc length in degrees, centred on the leftmost point of the circle')
p.add_argument('--pitch', type=float, default=1.5, help='outer scale A step in degrees')
p.add_argument('--ratio', type=float, default=1.02, help='A pitch / B pitch')
p.add_argument('--stroke', type=float, default=1.8, help='outer scale tick width, px')
p.add_argument('--short', type=float, default=13, help='minor tick length (A and B), px')
p.add_argument('--mid', type=float, default=22, help='every --mid-every tick, A only, px')
p.add_argument('--major', type=float, default=34, help='every --major-every tick, A only, px')
p.add_argument('--mid-every', type=int, default=4)
p.add_argument('--major-every', type=int, default=8)
p.add_argument('--b-offset', type=float, default=0, help='B hangs this far inside the bezel, px (0: B lies over A)')
p.add_argument('--b-stroke', type=float, default=2.2, help='B tick width, px (0: same as --stroke)')
p.add_argument('--b-short', type=float, default=0, help='B tick length, px (0: same as --short)')
p.add_argument('--bezel', type=float, default=1.8, help='bezel stroke, px (0 for none)')
p.add_argument('--ring-gap', type=float, default=58, help='the hairline ring sits this far inside the bezel, px (0 for no ring or inner scale)')
p.add_argument('--ring', type=float, default=1.2, help='ring stroke, px')
p.add_argument('--ring-alpha', type=float, default=0.85)
p.add_argument('--inner-step', type=int, default=2, help='inner scale pitch, in outer pitches')
p.add_argument('--inner-short', type=float, default=9)
p.add_argument('--inner-long', type=float, default=16)
p.add_argument('--inner-stroke', type=float, default=1.4)
p.add_argument('--inner-alpha', type=float, default=1.0)
p.add_argument('--index-width', type=float, default=2.4)
p.add_argument('--caret', type=float, default=11, help='caret height, px (0 for none)')
p.add_argument('--taper', type=float, default=0.2, help='fraction of the sweep faded at each end')
p.add_argument('--levels', type=int, default=6)
p.add_argument('--pad', type=float, default=3)
a = p.parse_args()


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def level(phi):
    u = (phi + a.sweep / 2.0) / a.sweep
    return int(round(smooth(min(u, 1 - u) / a.taper) * a.levels))


def pt(r, phi):
    """Circle-centred coordinates, x right, y down; phi = 0 is the leftmost point, negative is up."""
    rad = math.radians(180 - phi)
    return (r * math.cos(rad), r * math.sin(rad))


def ticks(pitch_deg, length_of, r_outer, step=1):
    half = int(math.floor(a.sweep / 2.0 / pitch_deg + 1e-9))
    out = []
    for i in range(-half * 1, half + 1):
        if i % step:
            continue
        phi = i * pitch_deg
        lvl = level(phi)
        if lvl <= 0:
            continue
        ln = length_of(i)
        x0, y0 = pt(r_outer, phi)
        x1, y1 = pt(r_outer - ln, phi)
        out.append((lvl, 'M%.1f %.1fL%.1f %.1f', (x0, y0, x1, y1)))
    return out


def arc(r, alpha_mul=1.0, step=1.0):
    """A continuous arc as runs of polyline, one path per alpha level."""
    out = []
    n = int(math.floor(a.sweep / 2.0 / step))
    run, run_lvl = [], 0
    for i in range(-n, n):
        phi0, phi1 = i * step, (i + 1) * step
        lvl = level((phi0 + phi1) / 2.0)
        if lvl != run_lvl and run:
            out.append((run_lvl, run))
            run = []
        run_lvl = lvl
        if lvl <= 0:
            continue
        if not run:
            run = [pt(r, phi0)]
        run.append(pt(r, phi1))
    if run:
        out.append((run_lvl, run))
    return out


R = a.radius
pitch_a = a.pitch
pitch_b = a.pitch / a.ratio
R2 = R - a.ring_gap


def outer_len_a(i):
    k = abs(i)
    if k % a.major_every == 0:
        return a.major
    if k % a.mid_every == 0:
        return a.mid
    return a.short


def outer_len_b(i):
    return a.b_short or a.short


def inner_len_a(i):
    k = abs(i)
    return a.inner_long if (k // a.inner_step) % (a.major_every // a.inner_step) == 0 else a.inner_short


def inner_len_b(i):
    return a.inner_short


# Each file: list of (stroke width, alpha multiplier, [(level, kind, data)]) plus filled shapes.
def build(which):
    groups = []   # (stroke, alpha_mul, [(lvl, d_fragments)])
    fills = []
    if which == 'a':
        if a.bezel > 0:
            runs = arc(R)
            groups.append((a.bezel, 1.0, [(lvl, 'P', pts) for lvl, pts in runs]))
        groups.append((a.stroke, 1.0, [(l, f, d) for l, f, d in ticks(pitch_a, outer_len_a, R)]))
        if a.ring_gap > 0:
            runs = arc(R2)
            groups.append((a.ring, a.ring_alpha, [(lvl, 'P', pts) for lvl, pts in runs]))
            # the inner scale hangs inward from the ring; its step is a few outer pitches
            groups.append((a.inner_stroke, a.inner_alpha, [(l, f, d) for l, f, d in ticks(pitch_a, inner_len_a, R2, step=a.inner_step)]))
        # the index: a long radial line from the bezel to the ring, and a caret outside the bezel
        r_in = R2 if a.ring_gap > 0 else R - a.major
        x0, y0 = pt(R + 1.0, 0)
        x1, y1 = pt(r_in, 0)
        groups.append((a.index_width if hasattr(a, 'index_width') else a.index_width, 1.0, [(a.levels, 'M%.1f %.1fL%.1f %.1f', (x0, y0, x1, y1))]))
        if a.caret > 0:
            apex = pt(R + 3.0, 0)
            bx = pt(R + 3.0 + a.caret, 0)[0]
            half = a.caret * 0.5
            fills.append('M%.2f %.2fL%.2f %.2fL%.2f %.2fZ' % (apex[0], apex[1], bx, -half, bx, half))
    else:
        groups.append((a.b_stroke or a.stroke, 1.0, [(l, f, d) for l, f, d in ticks(pitch_b, outer_len_b, R - a.b_offset)]))
        if a.ring_gap > 0:
            groups.append((a.inner_stroke, a.inner_alpha, [(l, f, d) for l, f, d in ticks(pitch_b, inner_len_b, R2, step=a.inner_step)]))
    return groups, fills


def paths_for(groups, fills, dx, dy):
    parts = []
    for stroke, amul, items in groups:
        buckets = {}
        for lvl, kind, data in items:
            if kind == 'P':
                d = 'M' + 'L'.join('%.1f %.1f' % (x + dx, y + dy) for x, y in data)
            else:
                x0, y0, x1, y1 = data
                d = kind % (x0 + dx, y0 + dy, x1 + dx, y1 + dy)
            buckets.setdefault(lvl, []).append(d)
        for lvl in sorted(buckets):
            parts.append('<path stroke-width="%g" stroke-opacity="%.3f" d="%s"/>' % (stroke, min(1.0, lvl / float(a.levels) * amul), ''.join(buckets[lvl])))
    return ''.join(parts), ''.join('<path d="%s"/>' % shift_fill(f, dx, dy) for f in fills)


def shift_fill(f, dx, dy):
    import re
    toks = re.findall(r'[MLZ]|-?\d+\.?\d*', f)
    out, i, coords = [], 0, []
    while i < len(toks):
        t = toks[i]
        if t in 'MLZ':
            out.append(t)
            i += 1
            if t != 'Z':
                out.append('%.1f %.1f' % (float(toks[i]) + dx, float(toks[i + 1]) + dy))
                i += 2
        else:
            i += 1
    return ''.join(out)


# bounding box of every ink point (both files share it), in circle-centred coordinates
xs, ys = [], []
for which in ('a', 'b'):
    g, f = build(which)
    for stroke, amul, items in g:
        for lvl, kind, data in items:
            pts = data if kind == 'P' else [(data[0], data[1]), (data[2], data[3])]
            for x, y in pts:
                xs.append(x); ys.append(y)
    for fl in f:
        import re
        nums = [float(n) for n in re.findall(r'-?\d+\.?\d*', fl)]
        xs += nums[0::2]; ys += nums[1::2]
pad = a.pad + max(a.stroke, a.bezel, a.index_width) / 2.0
minx, maxx, miny, maxy = min(xs) - pad, max(xs) + pad, min(ys) - pad, max(ys) + pad
W, H = int(math.ceil(maxx - minx)), int(math.ceil(maxy - miny))
dx, dy = -minx, -miny + (H - (maxy - miny)) / 2.0
cxb, cyb = dx, dy       # the circle centre in box coordinates

os.makedirs(a.out, exist_ok=True)
for which in ('a', 'b'):
    g, f = build(which)
    body, fill = paths_for(g, f, dx, dy)
    s = ('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">'
         '<g fill="none" stroke="#000" stroke-linecap="butt" stroke-linejoin="round">%s</g>%s</svg>\n' % (W, H, W, H, body, ('<g fill="#000">%s</g>' % fill) if fill else ''))
    path = os.path.join(a.out, '%s-%s.svg' % (a.name, which))
    with open(path, 'w') as fh:
        fh.write(s)
    print('%s: %d bytes' % (os.path.basename(path), len(s)))

beat = pitch_a / (1 - 1 / a.ratio)
gain_deg = math.degrees(6.0 / R)
print('box %d x %d px; circle centre in the box at (%.1f, %.1f); the leftmost ink is %.1f px left of the bezel' % (W, H, cxb, cyb, cxb - R))
print('pitch A %.4f deg = %.2f px at the bezel, B %.4f deg; beat %.1f deg (%.2f beats across the sweep), fringe gain %.1fx' % (
    pitch_a, math.radians(pitch_a) * R, pitch_b, beat, a.sweep / beat, beat / pitch_a))
print('CSS: width %dpx; height %dpx; transform-origin %.1fpx %.1fpx; left = dial-cx - %.1fpx; top = (hero y of the centre) - %.1fpx' % (W, H, cxb, cyb, cxb, cyb))
print('JS : GAIN = %.3f degrees (6px at the bezel); ticks move at most 6.00px at r = %g' % (gain_deg, R))
print('     the bezel is %.1f px from the leftmost ink; --dial-cx = leftmost bezel x + %g' % (0, R))
