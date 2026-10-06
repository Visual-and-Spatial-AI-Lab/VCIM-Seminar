#!/usr/bin/env python3
"""Regenerate the optional static geometric fallback. Python standard library only."""
from pathlib import Path
import math

ROOT = Path(__file__).resolve().parents[1]
W, H, NU, NV = 560, 530, 72, 28
TAU = math.tau

def surface(u, v):
    major = 1.62 + 0.14 * math.cos(3 * u)
    minor = 0.61 + 0.12 * math.sin(3 * u + 0.4)
    twist = v + 0.24 * math.sin(2 * u)
    return ((major + minor * math.cos(twist)) * math.cos(u),
            (major + minor * math.cos(twist)) * math.sin(u),
            minor * math.sin(twist) + 0.27 * math.sin(3 * u))

def project(point):
    x, y, z = point
    rx, ry, rz = 0.86, 0.43, -0.43
    x1, y1, z1 = x, y * math.cos(rx) - z * math.sin(rx), y * math.sin(rx) + z * math.cos(rx)
    x2, y2, z2 = x1 * math.cos(ry) + z1 * math.sin(ry), y1, -x1 * math.sin(ry) + z1 * math.cos(ry)
    x3, y3 = x2 * math.cos(rz) - y2 * math.sin(rz), x2 * math.sin(rz) + y2 * math.cos(rz)
    scale = min(W * 0.19, H * 0.235) * 7.5 / (7.5 - z2)
    return W * 0.52 + x3 * scale, H * 0.49 + y3 * scale, z2

vertices = [[project(surface(i / NU * TAU, j / NV * TAU)) for j in range(NV)] for i in range(NU)]
faces = []
for i in range(NU):
    for j in range(NV):
        pts = [vertices[i][j], vertices[(i + 1) % NU][j], vertices[(i + 1) % NU][(j + 1) % NV], vertices[i][(j + 1) % NV]]
        faces.append((sum(p[2] for p in pts) / 4, pts))
svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" fill="none">', '<title>Original VCIM computational form</title>']
for depth, points in sorted(faces, key=lambda item: item[0]):
    light = max(0, min(1, (depth + 2.3) / 4.6)) ** 1.5
    rgb = (round(48 + light * 38), round(14 + light * 17), round(24 + light * 20))
    p = ' '.join(f'{x:.2f},{y:.2f}' for x, y, _ in points)
    svg.append(f'<polygon points="{p}" fill="rgb{rgb}" stroke="#ebc6a5" stroke-opacity="{0.14 + light * 0.58:.3f}" stroke-width=".55"/>')
svg.append('</svg>')
path = ROOT / 'assets/visuals/field-fallback.svg'
path.write_text('\n'.join(svg), encoding='utf-8')
print(path)
