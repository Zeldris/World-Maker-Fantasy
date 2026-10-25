#!/usr/bin/env python3
"""gw-media-content: checks the update folders of docs/difusion/ before anything is published.

    python3 comprobar.py [update-folder...]     (default: every AAAA-MM-DD-<tema> folder in docs/difusion/)

Per folder: ficha.md and at least one channel are there (channels not asked for are deleted); no template
placeholder is left («…», <tema>, AAAA-MM-DD, {{…}}); an X thread has 2 to 4 posts of 280 characters at most (a link counts 23, an emoji
or a wide character 2); web.md carries
a JSON block with a valid date and es, gl and en; every channel has es and en; the public channels carry no
internal jargon (finding numbers, task ids, branch names); every image in the ficha's table has alt text in both
languages and, when local (medios/...), exists with its -mini; every medios/*.webp is listed in the ficha.
Exit 1 with one line per problem; exit 0 and «OK» per folder when clean.
"""
import json
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]
RAIZ = REPO / "docs" / "difusion"
TEXTOS = ["ficha.md", "twitter.md", "linkedin.md", "reddit.md", "discord.md", "web.md"]
CANALES = ["twitter.md", "linkedin.md", "reddit.md", "discord.md"]
URL = re.compile(r"https?://\S+")
FUENTES = (".html", ".svg", ".png", ".jpg", ".jpeg")  # the same list as render.mjs


def prefijos_de_tareas() -> list:
    """Roadmap id prefixes actually in use (QA, CR, ZON…), so GPT-4 or COVID-19 are not taken for task ids."""
    usados = {}
    for md in (REPO / "docs" / "producto").glob("*.md"):
        for m in re.finditer(r"\b([A-Z]{2,4})-\d+\b", md.read_text(encoding="utf-8")):
            usados[m.group(1)] = usados.get(m.group(1), 0) + 1
    return sorted(p for p, n in usados.items() if n >= 3) or ["QA"]


# P-numbers of findings (P320), roadmap ids (QA-215, CR-12, ZON-10) and branch names (claude/...).
JERGA = re.compile(r"\bP\d{2,4}\b|\b(?:" + "|".join(prefijos_de_tareas()) + r")-\d+\b|\bclaude/[\w.-]+")
# A template gap is a lone «…» (between spaces or at a line end); «combate… atacaba» is prose. The template also
# leaves <tema> and AAAA-MM-DD.
HUECO = re.compile(r"(?m)(^|\s)…(\s|$)|<tema>|AAAA-MM-DD")
FECHA_CARPETA = re.compile(r"^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$")
FECHA = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def longitud_x(texto: str) -> int:
    """X's weighted count: a link is 23; emoji and East Asian wide characters weigh 2."""
    texto = URL.sub("x" * 23, texto)
    return sum(2 if ord(c) >= 0x1F000 or unicodedata.east_asian_width(c) in ("W", "F") else 1 for c in texto)


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


def comprobar_web(web: str) -> list:
    """The Portal entry: {"fecha": "AAAA-MM-DD", "texto": {"es", "gl", "en"}}, as src/data/tipos.ts wants it."""
    bloque = re.search(r"```json\s*(\{.*?\})\s*```", web, re.S)
    if not bloque:
        return ["web.md: sin bloque ```json con la novedad"]
    try:
        novedad = json.loads(bloque.group(1))
    except json.JSONDecodeError as e:
        return [f"web.md: el JSON no se lee ({e})"]
    fallos = []
    fecha = novedad.get("fecha")
    try:
        if not (isinstance(fecha, str) and FECHA.match(fecha)):
            raise ValueError
        date.fromisoformat(fecha)
    except ValueError:
        fallos.append(f"web.md: fecha «{fecha}» no es AAAA-MM-DD")
    texto = novedad.get("texto")
    if not isinstance(texto, dict):
        return fallos + ["web.md: «texto» tiene que ser un objeto con es, gl y en"]
    for idioma in ("es", "gl", "en"):
        t = texto.get(idioma)
        if not isinstance(t, str) or not t.strip() or t.strip() == "…":
            fallos.append(f"web.md: texto «{idioma}» vacío")
            continue
        for m in JERGA.finditer(t):
            fallos.append(f"web.md ({idioma}): jerga interna «{m.group(0)}»")
    return fallos


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

    ficha = (carpeta / "ficha.md").read_text(encoding="utf-8")
    for m in HUECO.finditer(ficha):
        fallos.append(f"ficha.md: queda «{m.group(0).strip()}» de la plantilla")

    for nombre in [n for n in CANALES if (carpeta / n).is_file()]:
        texto = (carpeta / nombre).read_text(encoding="utf-8")
        partes = secciones(texto)
        for idioma in ("es", "en"):
            if not partes.get(idioma, "").strip():
                fallos.append(f"{nombre}: sin sección «## {idioma}»")
        for m in JERGA.finditer(texto):
            fallos.append(f"{nombre}: jerga interna «{m.group(0)}» (va en la ficha, no en el canal)")
        for m in HUECO.finditer(texto):
            fallos.append(f"{nombre}: queda «{m.group(0).strip()}» de la plantilla")

    tw = secciones((carpeta / "twitter.md").read_text(encoding="utf-8")) if (carpeta / "twitter.md").is_file() else {}
    for idioma in ("es", "en") if tw else ():
        posts = mensajes_x(tw.get(idioma, ""))
        if not 2 <= len(posts) <= 4:
            fallos.append(f"twitter.md ({idioma}): {len(posts)} mensajes; el hilo es de 2 a 4 (**1/**, **2/**…)")
        for i, post in enumerate(posts, 1):
            n = longitud_x(post)
            if n > 280:
                fallos.append(f"twitter.md ({idioma}) mensaje {i}: {n} caracteres (máximo 280; un enlace cuenta 23, un emoji 2)")

    if (carpeta / "web.md").is_file():
        fallos += comprobar_web((carpeta / "web.md").read_text(encoding="utf-8"))

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
        if fuente.suffix.lower() in (".html", ".svg") and "{{" in fuente.read_text(encoding="utf-8"):
            fallos.append(f"medios/fuente/{fuente.name}: quedan huecos {{{{…}}}} de la plantilla")
        if fuente.suffix.lower() in FUENTES and not (carpeta / "medios" / f"{fuente.stem}.webp").is_file():
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
