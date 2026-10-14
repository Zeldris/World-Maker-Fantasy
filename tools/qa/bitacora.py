#!/usr/bin/env python3
"""QA-69 (retro del 2026-10-13): la bitácora tiene una fila «Tarea en curso» por rama y cada una es corta.

Las dos cuentas escribían en la misma celda: acabó con dos tareas y dos «Siguiente» que se
contradecían. Cada fila se llama «Tarea en curso · `<rama>`» y su texto no pasa de TOPE caracteres
(unas 5 líneas, `CLAUDE.md`), y no hay dos filas de la misma rama. Lo corre `.githooks/pre-push` sobre
la bitácora de cada commit que se sube (con la ruta como argumento).

QA-85 (retro del 2026-10-14): `bitacora.py --cerradas <base> <sha>` (también desde el pre-push) comprueba
que cada tarea que pasa a tachada (`~~…~~`) en un roadmap entre esos dos commits sale también tachada en
«Hecho recientemente» de la bitácora del último. Se cerró `QA-63` en los roadmaps y la bitácora seguía en
«diagnosticado».
"""
import re
import subprocess
import sys
from pathlib import Path

TOPE = 600
ROADMAPS = "docs/producto/"
RUTA_BITACORA = "docs/registros/traspaso.md"


def ids_tachados(texto: str) -> set[str]:
    """Identificadores (`QA-63`) dentro de un tachado, con los rangos `QA-77`…`QA-80` desplegados."""
    ids: set[str] = set()
    for tramo in re.findall(r"~~(.*?)~~", texto):
        for a, b in re.findall(r"([A-Z]+-\d+)`?\s*…\s*`?([A-Z]+-\d+)", tramo):
            pa, na = a.rsplit("-", 1)
            pb, nb = b.rsplit("-", 1)
            if pa == pb and int(na) < int(nb):
                ids |= {f"{pa}-{n}" for n in range(int(na), int(nb) + 1)}
        ids |= set(re.findall(r"\b([A-Z]+-\d+)\b", tramo))
    return ids


def cerradas_sin_bitacora(base: str, sha: str) -> list[str]:
    """Tareas tachadas en los roadmaps entre `base` y `sha` que no salen tachadas en «Hecho recientemente»."""
    diff = subprocess.run(["git", "diff", "-U0", base, sha, "--", ROADMAPS], capture_output=True, text=True).stdout
    quitadas = "\n".join(l[1:] for l in diff.splitlines() if l.startswith("-") and not l.startswith("---"))
    puestas = "\n".join(l[1:] for l in diff.splitlines() if l.startswith("+") and not l.startswith("+++"))
    nuevas = ids_tachados(puestas) - ids_tachados(quitadas)
    if not nuevas:
        return []
    r = subprocess.run(["git", "show", f"{sha}:{RUTA_BITACORA}"], capture_output=True, text=True)
    bitacora = r.stdout if r.returncode == 0 else ""
    hecho = bitacora.split("## Hecho recientemente", 1)[1].split("\n## ", 1)[0] if "## Hecho recientemente" in bitacora else ""
    return sorted(nuevas - ids_tachados(hecho))


if sys.argv[1:2] == ["--cerradas"]:
    faltan = cerradas_sin_bitacora(sys.argv[2], sys.argv[3])
    for t in faltan:
        print(f"bitácora: {t} se tacha en el roadmap; apúntala tachada en «Hecho recientemente» de la bitácora")
    sys.exit(1 if faltan else 0)

BITACORA = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[2] / RUTA_BITACORA

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
ramas = [m.group(1) for f in filas if (m := re.match(r"\| \*\*Tarea en curso · `([^`]+)`\*\*", f))]
for rama in sorted({r for r in ramas if ramas.count(r) > 1}):
    fallos.append(f"dos filas «Tarea en curso» para {rama}: cada rama tiene una sola")
for f in fallos:
    print(f"bitácora: {f}")
sys.exit(1 if fallos else 0)
