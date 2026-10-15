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


ID = r"[A-Z]+-\d+[a-z]?"
RANGO = r"\s*(?:…|\.\.\.|–|—|\ba\b)\s*"
SEPARADOR = rf"(?:{RANGO}|\s*(?:,|\by\b)\s*)"


def ids_tachados(texto: str) -> set[str]:
    """Tareas cerradas en un texto: los identificadores con los que empieza cada tachado (`~~QA-80 · …~~`,
    `~~`QA-62`, `QA-64`~~`), con los rangos (`QA-77`…`QA-80`) desplegados. Un tachado seguido de «→» es
    una tarea movida a otro hito, no cerrada, y lo que se nombra dentro del título (`(ver QA-5)`) no cuenta."""
    ids: set[str] = set()
    for m in re.finditer(r"~~(.*?)~~(\s*→)?", texto):
        if m.group(2):
            continue
        tramo = re.sub(r"[*`]", "", m.group(1))
        cabeza = re.match(rf"\s*({ID}(?:{SEPARADOR}{ID})*)", tramo)
        if not cabeza:
            continue
        run = cabeza.group(1)
        ids |= set(re.findall(ID, run))
        for a, b in re.findall(rf"({ID}){RANGO}({ID})", run):
            (pa, na), (pb, nb) = a.rsplit("-", 1), b.rsplit("-", 1)
            if pa == pb and na.isdigit() and nb.isdigit() and int(na) < int(nb):
                ids |= {f"{pa}-{n}" for n in range(int(na), int(nb) + 1)}
    return ids


def git(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", *args], capture_output=True, text=True)


def cerradas_sin_bitacora(base: str, sha: str) -> list[str]:
    """Tareas tachadas en los roadmaps entre `base` y `sha` que no salen tachadas en «Hecho recientemente».
    Las que ya están tachadas en `origin/main` (llegan con un merge de main, `QA-72`) son de otra rama."""
    diff = git("diff", "-U0", base, sha, "--", ROADMAPS).stdout
    quitadas = "\n".join(l[1:] for l in diff.splitlines() if l.startswith("-") and not l.startswith("---"))
    puestas = "\n".join(l[1:] for l in diff.splitlines() if l.startswith("+") and not l.startswith("+++"))
    nuevas = ids_tachados(puestas) - ids_tachados(quitadas)
    for ruta in git("diff", "--name-only", base, sha, "--", ROADMAPS).stdout.split():
        en_main = git("show", f"origin/main:{ruta}")
        if en_main.returncode == 0:
            nuevas -= ids_tachados(en_main.stdout)
    if not nuevas:
        return []
    r = git("show", f"{sha}:{RUTA_BITACORA}")
    bitacora = r.stdout if r.returncode == 0 else ""
    hecho = bitacora.split("## Hecho recientemente", 1)[1].split("\n## ", 1)[0] if "## Hecho recientemente" in bitacora else ""
    return sorted(nuevas - ids_tachados(hecho))


if sys.argv[1:2] == ["--cerradas"]:
    if len(sys.argv) != 4:
        sys.exit("Uso: python3 tools/qa/bitacora.py --cerradas <commit base> <commit>")
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
