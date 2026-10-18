"""Inspect the actual Chromium PDFs produced by tests/print.spec.js.

Run after npm test: python scripts/verify_pdfs.py
Requires pdfplumber (pip install pdfplumber).
"""
import json
import re
from pathlib import Path
import pdfplumber

root = Path(__file__).resolve().parents[1] / 'test-results'
files = sorted(root.rglob('sheet.pdf'))
assert files, 'No PDFs found. Run npm test first.'
for file in files:
    expected = json.loads(file.with_name('expected.json').read_text(encoding='utf-8'))
    with pdfplumber.open(file) as pdf:
        if 'pages' in expected:
            assert len(pdf.pages) == expected['pages'], (file, len(pdf.pages))
        # Content-stream order keeps wrapped cell text together. Geometric text
        # extraction can interleave adjacent cells at each line's y-coordinate.
        text = re.sub(r'\s+', '', ''.join(char['text'] for page in pdf.pages for char in page.chars))
        for marker in expected['markers']:
            assert re.sub(r'\s+', '', marker) in text, (file, 'Missing text', marker)
        if expected.get('forbidden'):
            assert expected['forbidden'] not in text, (file, 'Hidden content printed')
        for page in pdf.pages:
            if expected['orientation'] == 'portrait':
                assert abs(page.width - 595.28) < 1 and abs(page.height - 841.89) < 1
            else:
                assert abs(page.width - 841.89) < 1 and abs(page.height - 595.28) < 1
            assert page.chars, (file, 'Blank page')
            for char in page.chars:
                assert char['x0'] >= 15 and char['x1'] <= page.width - 15, (file, 'Horizontal clipping', char)
                assert char['top'] >= 15 and char['bottom'] <= page.height - 15, (file, 'Vertical clipping', char)
            for edge in page.edges:
                assert edge['x0'] >= 15 and edge['x1'] <= page.width - 15, (file, 'Clipped table border', edge)
                assert edge['top'] >= 15 and edge['bottom'] <= page.height - 15, (file, 'Clipped table border', edge)
        print(f'{file.parent.name}: {len(pdf.pages)} page(s), all markers and margins OK')
print(f'Validated {len(files)} PDFs.')
