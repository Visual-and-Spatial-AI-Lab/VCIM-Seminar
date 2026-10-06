#!/usr/bin/env python3
"""Make a self-contained read-only preview from the editable website sources."""
from pathlib import Path
import base64
import re

ROOT = Path(__file__).resolve().parents[1]

def build() -> str:
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    for style in ['tokens.css', 'main.css']:
        content = (ROOT / 'styles' / style).read_text(encoding='utf-8')
        html = html.replace(f'<link rel="stylesheet" href="styles/{style}">', '<style>\n' + content + '\n</style>')
    for path in ['assets/icons/favicon.svg', 'assets/visuals/field-fallback.svg']:
        encoded = base64.b64encode((ROOT / path).read_bytes()).decode('ascii')
        html = html.replace(path, 'data:image/svg+xml;base64,' + encoded)
    scripts = ['data/seminars.js', 'scripts/core.js', 'scripts/app.js', 'scripts/visual.js']
    for path in scripts:
        html = html.replace(f'<script defer src="{path}"></script>', '')
    inline = '\n'.join('<script>\n' + (ROOT / path).read_text(encoding='utf-8').replace('</script', '<\\/script') + '\n</script>' for path in scripts)
    return html.replace('</body>', inline + '\n</body>')

if __name__ == '__main__':
    path = ROOT.parent / 'VCIM-Seminar-Preview.html'
    path.write_text(build(), encoding='utf-8')
    print(path)
