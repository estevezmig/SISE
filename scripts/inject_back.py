#!/usr/bin/env python3
"""Add navigation before compilation so the PWA cache tracks the change."""
from pathlib import Path
import sys
app = Path(sys.argv[1]) / 'src/app/App.tsx'
s = app.read_text(encoding='utf-8')
anchor = r"""      <a href={window.location.pathname.replace(/\/(?:editor|grafcet-ladder)(?:\/.*)?$/, '/')} style={{position:'fixed',top:64,left:12,zIndex:1000,background:'#142a28',color:'#adf6d1',padding:'8px 12px',borderRadius:8,textDecoration:'none'}}>← Volver a SISE</a>
"""
needle = '      <CommandPalette />'
if s.count(needle) != 1:
    raise SystemExit('Cannot locate GrafcetMaker navigation insertion point')
app.write_text(s.replace(needle, anchor + needle), encoding='utf-8')
