#!/usr/bin/env python3
"""IMG-39 · PROTOTIPO desechable: rellena los datos de img-39-pantalla-elemento.html.

Sin argumentos, reescribe el bloque DATOS del HTML con rutas relativas a las imágenes de las rondas r25-r31
(`image-generator/generated/banco/`, fuera de git): se abre con doble clic en la Deck.
Con `--incrustar <salida.html>`, escribe una copia autocontenida, con cada imagen en JPEG de 560 px (ffmpeg) dentro
del HTML, para abrirla en el móvil o publicarla.
"""
import base64
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent.parent
HTML = AQUI / "img-39-pantalla-elemento.html"
BANCO = RAIZ / "image-generator/generated/banco"
REFS = RAIZ / "image-generator/referencias/images"
PROMPTS = RAIZ / "docs/producto/plan-imagenes/banco/prompts"

# Por elemento: banner y, por fase, las rondas cuyos intentos hacen de «intentos ya generados», en el orden en que
# salen al regenerar. La primera de cada fase es la de la receta actual (pautas.md §12-§15).
ELEMENTOS = {
    "aullador-rojo": {
        "nombre": "Aullador rojo", "tipo": "fauna", "banner": "fauna/aullador-rojo-macho-banner.png",
        "prompt": "aullador",
        "F0": ["r27-f0-aullador", "r27-f0-aullador-sin-planas", "r25-f0-v1-sin-zorro", "r25-f0-v4-ancla-marco"],
        "F1": ["r27-f1-aullador", "r25-f1-s7-aullador", "r25-f1-forma-f3"],
        "F2": ["r27-f2-aullador", "r26c-f2-h-aullador", "r27-f2-aullador-sin-planas"],
        "FIN": ["r30-a-aullador", "r31-p4-aullador", "r30-b-aullador", "r27-final-aullador"],
    },
    "cardo-brujula": {
        "nombre": "Cardo brújula", "tipo": "flora", "banner": "flora/cardo-brujula-banner.png",
        "prompt": "cardo-brujula",
        "F0": ["r30-f0-cardo-brujula", "r27-f0-cardo-brujula"],
        "F1": ["r27-f1-cardo-brujula", "r25-f1-cardo-brujula"],
        "F2": ["r27-f2-cardo-brujula", "r26c-f2-cardo-brujula"],
        "FIN": ["r30-a-cardo-brujula", "r30-b-cardo-brujula", "r27-final-cardo-brujula", "r27p-final-cardo-brujula"],
    },
    "choza-basica-orco-llanuras": {
        "nombre": "Choza básica orca", "tipo": "construccion",
        "banner": "construccion/choza-basica-orco-llanuras-banner.png", "prompt": "choza-basica-orco-llanuras",
        "F0": ["r30-f0-choza-basica-orco-llanuras", "r27-f0-choza-basica-orco-llanuras"],
        "F1": ["r27-f1-choza-basica-orco-llanuras", "r25-f1-choza-basica-orco-llanuras"],
        "F2": ["r27-f2-choza-basica-orco-llanuras", "r26c-f2-choza-basica-orco-llanuras"],
        "FIN": ["r30-a-choza-basica-orco-llanuras", "r31s-choza-basica-orco-llanuras",
                "r30-b-choza-basica-orco-llanuras", "r27-final-choza-basica-orco-llanuras"],
    },
    "cuchillo-hielo-silice": {
        "nombre": "Cuchillo de hielo-sílice", "tipo": "item", "banner": "item/cuchillo-hielo-silice-banner.png",
        "prompt": "cuchillo-hielo-silice",
        "F0": ["r30-f0-cuchillo-hielo-silice", "r27-f0-cuchillo-hielo-silice"],
        "F1": ["r27-f1-cuchillo-hielo-silice", "r25-f1-cuchillo-hielo-silice"],
        "F2": ["r27-f2-cuchillo-hielo-silice", "r26c-f2-cuchillo-hielo-silice"],
        "FIN": ["r30-a-cuchillo-hielo-silice", "r30-b-cuchillo-hielo-silice", "r27-final-cuchillo-hielo-silice",
                "r27p-final-cuchillo-hielo-silice"],
    },
}
PROMPT_DE_FASE = {"F0": "r27-f0-{p}.txt", "F1": "r26-{p}-detalle.txt", "F2": "r26-{p}-detalle.txt",
                  "FIN": "r30-{p}-auto.txt"}


def ruta(p: Path, incrustar: bool) -> str:
    if not incrustar:
        return str(Path("../..") / p.relative_to(RAIZ))
    with tempfile.NamedTemporaryFile(suffix=".jpg") as t:
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(p), "-vf", "scale=560:-2",
                        "-q:v", "5", t.name], check=True)
        return "data:image/jpeg;base64," + base64.b64encode(Path(t.name).read_bytes()).decode()


def datos(incrustar: bool) -> dict:
    salida = {}
    for slug, e in ELEMENTOS.items():
        d = {"nombre": e["nombre"], "tipo": e["tipo"], "banner": ruta(REFS / e["banner"], incrustar),
             "prompts": {}, "pool": {}}
        for fase in ("F0", "F1", "F2", "FIN"):
            d["prompts"][fase] = (PROMPTS / PROMPT_DE_FASE[fase].format(p=e["prompt"])).read_text().strip()
            pool = []
            for ronda in e[fase]:
                pngs = sorted((BANCO / ronda / "intentos").glob("*.png"))
                if not pngs:
                    sys.exit(f"sin imagen en {ronda}")
                pool.append({"ronda": ronda, "img": ruta(pngs[-1], incrustar)})
            d["pool"][fase] = pool
        salida[slug] = d
    return salida


def main() -> None:
    incrustar = len(sys.argv) == 3 and sys.argv[1] == "--incrustar"
    destino = Path(sys.argv[2]) if incrustar else HTML
    texto = HTML.read_text()
    bloque = json.dumps(datos(incrustar), ensure_ascii=False, indent=None if incrustar else 1)
    nuevo, n = re.subn(r"/\*DATOS\*/.*?/\*FIN\*/", lambda _: f"/*DATOS*/{bloque}/*FIN*/", texto, flags=re.S)
    if n != 1:
        sys.exit("no encuentro el bloque /*DATOS*/…/*FIN*/")
    destino.write_text(nuevo)
    print(f"{destino} ({len(nuevo) // 1024} KB)")


if __name__ == "__main__":
    main()
