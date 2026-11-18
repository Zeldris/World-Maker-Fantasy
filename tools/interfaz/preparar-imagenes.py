#!/usr/bin/env python3
"""Prepara las imágenes de la marca de Tarkor para la interfaz (UX-41).

Lee las piezas aprobadas de `frontend/src/assets/tarkor-final/` (PNG RGB con fondo de croma verde, fuera de git),
recorta el croma con `gimg brand matte` (repo galivelop-image-generator), encuadra al contenido, escala y escribe
WebP con transparencia en `frontend/src/assets/interfaz/`, que es lo que importa el frontend y lo que se sube.

    python3 tools/interfaz/preparar-imagenes.py [--gimg RUTA] [--solo PREFIJO]

`--gimg` (o la variable GIMG_REPO) apunta al repo del generador; por defecto, `../galivelop-image-generator`.
Necesita `ffmpeg` con libwebp. Cada pieza se busca por su prefijo (sin el `-qNNNN` del intento), así que al
aprobar otro intento basta con dejarlo en la raíz de `tarkor-final/` y volver a correr el script.
"""
from __future__ import annotations

import argparse
import glob
import os
import subprocess
import sys
import tempfile

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FUENTE = os.path.join(RAIZ, 'frontend', 'src', 'assets', 'tarkor-final')
DESTINO = os.path.join(RAIZ, 'frontend', 'src', 'assets', 'interfaz')

ICONO = 96      # pictogramas: se ven a 20-40 px, 96 da para pantallas 2x
MARCO = 192     # marcos y ranura (border-image / superposición)

# (prefijo de la fuente, nombre de salida, tamaño, recortar croma, huecos, encuadrar)
# recortar croma: True = gimg (fondo tomado del borde); 'llave' = llave de color de ffmpeg sobre el verde, para una
# pieza cuyo borde no es croma (la plantilla de captura: marco de madera con el hueco verde dentro)
# tamaño: entero = cuadrado de ese lado; (ancho, None) = ancho fijo y alto proporcional
PIEZAS = []
for p in ('companeros', 'diario', 'enciclopedia', 'equipo', 'habilidades', 'inventario', 'leyendas', 'mapa',
          'misiones', 'personaje', 'reino'):
    PIEZAS.append((f'11-pestana-{p}', f'pestana-{p}', ICONO, True, False, True))
for p in ('energia', 'sed'):
    PIEZAS.append((f'12-barra-{p}', f'hud-{p}', ICONO, True, False, True))
for p in ('combate', 'dinamico', 'eleccion', 'encuentro', 'muerte', 'ocupado', 'pensando'):
    PIEZAS.append((f'13-fase-{p}', f'fase-{p}', ICONO, True, False, True))
PIEZAS.append(('14-dado', 'dado', ICONO, True, False, True))
for p in ('accesorio', 'arma', 'armadura', 'consumible', 'cosmetico', 'documento', 'especial', 'herramienta', 'hueso',
          'madera', 'medicinal', 'ropa', 'valor'):
    PIEZAS.append((f'15-categoria-{p}', f'categoria-{p}', ICONO, True, False, True))
for p in ('aviso', 'en-curso', 'error', 'hecho'):
    PIEZAS.append((f'17-estado-{p}', f'estado-{p}', ICONO, True, False, True))
PIEZAS += [
    ('08-esquina-oro', 'esquina-oro', 64, True, False, True),
    ('10-marco-ranura', 'ranura', MARCO, True, True, True),
    ('e11-marco-retrato-q', 'marco-retrato', MARCO, True, True, True),
    ('e11-marco-retrato-redondo', 'marco-redondo', MARCO, True, True, True),
    ('e09-sello', 'sello', 128, True, False, True),
    ('e10-insignia', 'insignia', (256, None), True, True, True),
    ('e12-plantilla-captura', 'plantilla-captura', (1280, None), 'llave', False, False),
    ('06-cielo', 'cielo', (1536, None), False, False, False),
    ('e06-carga', 'carga', (1280, None), False, False, False),
    ('e07-barra-pista', 'barra-pista', (904, None), False, False, False),
    ('e07-barra-relleno', 'barra-relleno', (864, None), False, False, False),
]


def fuente(prefijo: str) -> str:
    """El único PNG de la raíz de tarkor-final que empieza por `prefijo` (sin contar descartes)."""
    patron = prefijo if prefijo.endswith('-q') else prefijo + '-q'
    hallados = sorted(glob.glob(os.path.join(FUENTE, patron + '*.png')))
    if len(hallados) != 1:
        raise SystemExit(f'preparar-imagenes: {len(hallados)} fuentes para «{prefijo}» en {FUENTE} (se espera 1)')
    return hallados[0]


def caja_alfa(gimg_png, ruta: str, umbral: int = 16) -> tuple[int, int, int, int]:
    """(x, y, ancho, alto) de los píxeles con alfa > umbral."""
    w, h, rgba = gimg_png.read_rgba(ruta)
    xs, ys = [], []
    for y in range(h):
        fila = rgba[y * w * 4 + 3:(y + 1) * w * 4:4]
        cols = [x for x, a in enumerate(fila) if a > umbral]
        if cols:
            ys.append(y)
            xs.append(cols[0])
            xs.append(cols[-1])
    if not xs:
        raise SystemExit(f'preparar-imagenes: {ruta} quedó vacía tras recortar el croma')
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    return x0, y0, x1 - x0 + 1, y1 - y0 + 1


def ffmpeg(*args: str) -> None:
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', *args], check=True)


def preparar(gimg_repo: str, solo: str | None) -> None:
    sys.path.insert(0, gimg_repo)
    from gimg import brand, png as gimg_png  # noqa: E402 (repo del generador, ruta en tiempo de ejecución)

    os.makedirs(DESTINO, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for prefijo, nombre, tam, croma, huecos, encuadrar in PIEZAS:
            if solo and not nombre.startswith(solo):
                continue
            src = fuente(prefijo)
            entrada = src
            filtros = []
            if croma == 'llave':
                filtros += ['format=rgba', 'colorkey=0x10c414:0.28:0.06']
            elif croma:
                entrada = os.path.join(tmp, nombre + '.png')
                brand.matte(src, entrada, holes=huecos)
                if encuadrar:
                    x, y, w, h = caja_alfa(gimg_png, entrada)
                    filtros.append(f'crop={w}:{h}:{x}:{y}')
            if isinstance(tam, int):
                filtros.append(f'scale={tam}:{tam}:force_original_aspect_ratio=decrease:flags=lanczos')
                filtros.append(f'pad={tam}:{tam}:(ow-iw)/2:(oh-ih)/2:color=black@0')
            else:
                filtros.append(f'scale={tam[0]}:-2:flags=lanczos')
            salida = os.path.join(DESTINO, nombre + '.webp')
            calidad = '88' if croma else '80'
            pix = ['-pix_fmt', 'yuva420p'] if croma else []
            ffmpeg('-i', entrada, '-vf', ','.join(filtros), '-c:v', 'libwebp', '-quality', calidad, *pix, salida)
            print(f'{nombre}.webp  <- {os.path.basename(src)}  ({os.path.getsize(salida) // 1024} KB)')


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('--gimg', default=os.environ.get('GIMG_REPO',
                                                     os.path.join(os.path.dirname(RAIZ), 'galivelop-image-generator')))
    ap.add_argument('--solo', help='solo las salidas que empiecen por este prefijo')
    args = ap.parse_args()
    if not os.path.isdir(os.path.join(args.gimg, 'gimg')):
        raise SystemExit(f'preparar-imagenes: no encuentro el repo de gimg en {args.gimg} (usa --gimg o GIMG_REPO)')
    preparar(args.gimg, args.solo)


if __name__ == '__main__':
    main()
