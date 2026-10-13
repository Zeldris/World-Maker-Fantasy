#!/usr/bin/env python3
"""QA-69 (retro del 2026-10-13): la bitácora tiene una fila «Tarea en curso» por rama y cada una es corta.

Las dos cuentas escribían en la misma celda: acabó con dos tareas y dos «Siguiente» que se
contradecían. Cada fila se llama «Tarea en curso · `<rama>`» y su texto no pasa de TOPE caracteres
(unas 5 líneas, `CLAUDE.md`). Lo corre `.githooks/pre-push`.
"""
import re
import sys
from pathlib import Path

TOPE = 600
BITACORA = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[2] / "docs/registros/traspaso.md"

fallos = []
filas = [l for l in BITACORA.read_text(encoding="utf-8").splitlines() if l.startswith("| **Tarea en curso")]
if not filas:
    fallos.append("no hay ninguna fila «Tarea en curso · `<rama>`»")
for fila in filas:
    m = re.match(r"\| \*\*Tarea en curso · `([^`]+)`\*\* \|(.*)\|\s*$", fila)
    if not m:
        fallos.append(f"fila sin rama, debe ser «| **Tarea en curso · `<rama>`** | … |»: {fila[:80]}…")
        continue
    rama, texto = m.group(1), m.group(2).strip()
    if len(texto) > TOPE:
        fallos.append(f"«Tarea en curso» de {rama}: {len(texto)} caracteres (tope {TOPE}); lo hecho va a «Hecho recientemente»")
for f in fallos:
    print(f"bitácora: {f}")
sys.exit(1 if fallos else 0)
