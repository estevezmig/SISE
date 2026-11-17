#!/usr/bin/env python3
"""Insertar protección de interfaz en la copia compilada de GrafcetMaker.
No altera fuentes ni los scripts del autor; mantiene atribuciones y licencia.
"""
import pathlib
import os
import sys
root=pathlib.Path(sys.argv[1])
for p in root.rglob('*.html'):
    rel=os.path.relpath(root.parent,p.parent).replace('\\','/')
    injection=(f'<link rel="stylesheet" href="{rel}/auth.css">'
               f'<script src="{rel}/auth.js"></script>')
    raw=p.read_text(encoding='utf-8')
    if '</head>' not in raw:continue
    if 'auth.js' in raw:continue
    p.write_text(raw.replace('<head>','<head>'+injection,1),encoding='utf-8')
    print('Contraseña insertada:',p)