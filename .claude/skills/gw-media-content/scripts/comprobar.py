#!/usr/bin/env python3
"""gw-media-content: checks the update folders of docs/difusion/ before anything is published.

    python3 comprobar.py [update-folder...]     (default: every AAAA-MM-DD-<tema> folder in docs/difusion/)

Per folder: the six text files are there; every X post fits in 280 characters (a link counts 23); web.md carries
a JSON block with a valid date and es, gl and en; every channel has es and en; the public channels carry no
internal jargon (finding numbers, task ids, branch names); every image in the ficha's table has alt text in both
languages and, when local (medios/...), exists with its -mini; every medios/*.webp is listed in the ficha.
Exit 1 with one line per problem; exit 0 and «OK» per folder when clean.
"""
import json
import re
import sys
from datetime import date
from pathlib import Path

RAIZ = Path("docs/difusion")
TEXTOS = ["ficha.md", "twitter.md", "linkedin.md", "reddit.md", "discord.md", "web.md"]
CANALES = ["twitter.md", "linkedin.md", "reddit.md", "discord.md"]
URL = re.compile(r"https?://\S+")
# P-numbers of findings (P320), roadmap ids (QA-215, CR-12, ZON-10) and branch names (claude/...).
JERGA = re.compile(r"\bP\d{2,4}\b|\b[A-Z]{2,4}-\d+\b|\bclaude/[\w.-]+")
# A template gap is a lone «…» (between spaces or at a line end); «combate… atacaba» is prose.
HUECO = re.compile(r"(?m)(^|\s)…(\s|$)")
FECHA_CARPETA = re.compile(r"^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$")


def longitud_x(texto: str) -> int:
    return len(URL.sub("x" * 23, texto))


def secciones(texto: str) -> dict:
    """Splits a channel file by its `## es` / `## en` headings."""
    partes, actual = {}, None
    for linea in texto.splitlines():
        m = re.match(r"^##\s+(es|en|gl)\s*$", linea.strip())
        if m:
            actual = m.group(1)
            partes[actual] = []
        elif actual:
            partes[actual].append(linea)
    return {k: "\n".join(v) for k, v in partes.items()}


def mensajes_x(seccion: str) -> list:
    """Each post starts with **n/**; it runs until the next one."""
    trozos = re.split(r"(?m)^\*\*\d+/\*\*\s*", seccion)
    return [t.strip() for t in trozos[1:] if t.strip()]


def comprobar(carpeta: Path) -> list:
    fallos = []
    if not FECHA_CARPETA.match(carpeta.name):
        fallos.append(f"el nombre no es AAAA-MM-DD-<tema>")
    if not (carpeta / "ficha.md").is_file():
        fallos.append("falta ficha.md")
    if not any((carpeta / n).is_file() for n in TEXTOS[1:]):
        fallos.append("ningún canal: hace falta al menos uno de " + ", ".join(TEXTOS[1:]))
    if fallos:
        return fallos

    for nombre in [n for n in CANALES if (carpeta / n).is_file()]:
        texto = (carpeta / nombre).read_text(encoding="utf-8")
        partes = secciones(texto)
        for idioma in ("es", "en"):
            if not partes.get(idioma, "").strip():
                fallos.append(f"{nombre}: sin sección «## {idioma}»")
        for m in JERGA.finditer(texto):
            fallos.append(f"{nombre}: jerga interna «{m.group(0)}» (va en la ficha, no en el canal)")
        if HUECO.search(texto):
            fallos.append(f"{nombre}: queda un «…» de la plantilla")

    tw = secciones((carpeta / "twitter.md").read_text(encoding="utf-8")) if (carpeta / "twitter.md").is_file() else {}
    for idioma in ("es", "en") if tw else ():
        posts = mensajes_x(tw.get(idioma, ""))
        if not 1 <= len(posts) <= 4:
            fallos.append(f"twitter.md ({idioma}): {len(posts)} mensajes; el hilo es de 1 a 4 (**1/**, **2/**…)")
        for i, post in enumerate(posts, 1):
            n = longitud_x(post)
            if n > 280:
                fallos.append(f"twitter.md ({idioma}) mensaje {i}: {n} caracteres (máximo 280, un enlace cuenta 23)")

    web = (carpeta / "web.md").read_text(encoding="utf-8") if (carpeta / "web.md").is_file() else None
    bloque = web and re.search(r"```json\s*(\{.*?\})\s*```", web, re.S)
    if web is None:
        pass
    elif not bloque:
        fallos.append("web.md: sin bloque ```json con la novedad")
    else:
        try:
            novedad = json.loads(bloque.group(1))
            try:
                date.fromisoformat(novedad.get("fecha", ""))
            except ValueError:
                fallos.append(f"web.md: fecha «{novedad.get('fecha')}» no es AAAA-MM-DD")
            for idioma in ("es", "gl", "en"):
                t = (novedad.get("texto") or {}).get(idioma, "")
                if not t.strip() or t.strip() == "…":
                    fallos.append(f"web.md: texto «{idioma}» vacío")
                for m in JERGA.finditer(t):
                    fallos.append(f"web.md ({idioma}): jerga interna «{m.group(0)}»")
        except json.JSONDecodeError as e:
            fallos.append(f"web.md: el JSON no se lee ({e})")

    ficha = (carpeta / "ficha.md").read_text(encoding="utf-8")
    tabla = re.search(r"(?ms)^## Imágenes\s*$(.*?)(?=^## |\Z)", ficha)
    listadas = set()
    if not tabla:
        fallos.append("ficha.md: sin apartado «## Imágenes»")
    else:
        for fila in tabla.group(1).splitlines():
            celdas = [c.strip() for c in fila.strip().strip("|").split("|")]
            if len(celdas) < 3 or celdas[0] in ("Imagen", "") or set(celdas[0]) <= set("-: "):
                continue
            ruta = celdas[0].strip("`")
            if " / " not in celdas[1] or "…" in celdas[1]:
                fallos.append(f"ficha.md: «{ruta}» sin texto alternativo «es / en»")
            if ruta.startswith("medios/"):
                listadas.add(ruta)
                if not (carpeta / ruta).is_file():
                    fallos.append(f"ficha.md: «{ruta}» no existe (node render.mjs {carpeta})")
                elif ruta.endswith(".webp") and not (carpeta / ruta.replace(".webp", "-mini.webp")).is_file():
                    fallos.append(f"ficha.md: «{ruta}» sin su -mini.webp")
    for img in sorted((carpeta / "medios").glob("*.webp")):
        rel = f"medios/{img.name}"
        if not img.name.endswith("-mini.webp") and rel not in listadas:
            fallos.append(f"{rel}: no está en la tabla de imágenes de la ficha")
    for fuente in sorted((carpeta / "medios" / "fuente").glob("*")):
        if fuente.suffix in (".html", ".svg") and "{{" in fuente.read_text(encoding="utf-8"):
            fallos.append(f"medios/fuente/{fuente.name}: quedan huecos {{{{…}}}} de la plantilla")
        if fuente.suffix in (".html", ".svg", ".png", ".jpg") and not (carpeta / "medios" / f"{fuente.stem}.webp").is_file():
            fallos.append(f"medios/fuente/{fuente.name}: sin renderizar (node render.mjs {carpeta})")
    return fallos


def main(args: list) -> int:
    carpetas = [Path(a) for a in args] or sorted(
        p for p in RAIZ.iterdir() if p.is_dir() and not p.name.startswith("_")
    )
    hay_fallos = False
    for carpeta in carpetas:
        fallos = comprobar(carpeta)
        if fallos:
            hay_fallos = True
            for f in fallos:
                print(f"{carpeta}: {f}")
        else:
            print(f"{carpeta}: OK")
    return 1 if hay_fallos else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
