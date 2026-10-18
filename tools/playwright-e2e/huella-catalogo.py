#!/usr/bin/env python3
"""QA-82 (retro del 2026-10-14): huella de lo que siembra `seed-catalog`: el propio script y todo lo que
importa del repo (importaciones relativas, siguiéndolas), p. ej. `worldCatalog.ts` y `worldPopulation.ts`.
`arrancar-juego.sh` vuelve a sembrar el catálogo cuando cambia."""
import hashlib
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
pendientes = [RAIZ / 'backend/src/scripts/seed-catalog.ts']
vistos: set[Path] = set()
while pendientes:
    ruta = pendientes.pop()
    if ruta in vistos or not ruta.is_file():
        continue
    vistos.add(ruta)
    for imp in re.findall(r"""from\s+['"](\.{1,2}/[^'"]+)['"]""", ruta.read_text(encoding='utf-8')):
        base = (ruta.parent / imp).resolve()
        pendientes += [base.with_suffix('.ts'), base / 'index.ts', base]
h = hashlib.sha256()
for ruta in sorted(vistos):
    h.update(str(ruta.relative_to(RAIZ)).encode() + b'\0' + ruta.read_bytes())
print(h.hexdigest())
