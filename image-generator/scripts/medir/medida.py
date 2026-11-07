"""IMG-25: la medida de un intento de fase, para enseñarla a su lado. Solo biblioteca estándar y ffmpeg, en segundos.
Forma: SSIM en gris con la imagen de la que parte (pautas.md §5, ≳ 0,7). Color: EMD Cb y Cr con la imagen del juego del
elemento, sin mediana ni momento (a diferencia de medir.sh, los elementos no llevan momento). Los umbrales y el estado
(ok, aviso, falla) se deciden aquí; la interfaz solo los enseña. Medir nunca hace fallar un intento: lo que no se pueda
medir queda en `error`. Uso: python3 medida.py <imagen> [<anterior|-> [<juego>]]   ->   JSON"""
import json
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import emd as E  # noqa: E402

SSIM_MIN = 0.7
EMD_LIMITES = {'cb': (6, 11.4), 'cr': (7.5, 13.5)}  # (se da por bueno hasta, falla por encima de), estilo/gradacion.json
FALLOS = (OSError, ValueError, subprocess.SubprocessError, SystemExit)  # emd.py sale con sys.exit si no puede leerla


def ssim(a, b):
    """SSIM en gris de dos imágenes, a 640x256 las dos: compara la forma, no el detalle que añade la fase."""
    escala = 'scale=640:256:flags=lanczos,format=gray'
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', a, '-i', b, '-lavfi',
                        f'[0:v]{escala}[a];[1:v]{escala}[b];[a][b]ssim', '-frames:v', '1', '-f', 'null', '-'],
                       capture_output=True, text=True, timeout=60, check=True)
    m = re.search(r'All:([0-9.]+)', r.stderr)
    if not m:
        raise ValueError('ffmpeg no dio el SSIM')
    return float(m.group(1))


def estado_emd(canal, valor):
    bueno, falla = EMD_LIMITES[canal]
    return 'ok' if valor <= bueno else 'aviso' if valor <= falla else 'falla'


def medir(imagen, anterior=None, juego=None):
    """{ssim?: {valor, estado}, emd?: {cb, cr}, error?}. Sin `emd` ni `error`, el elemento no tiene imagen del juego."""
    medida, errores = {}, []
    if anterior:
        try:
            v = ssim(imagen, anterior)
            medida['ssim'] = {'valor': round(v, 3), 'estado': 'ok' if v >= SSIM_MIN else 'aviso'}
        except FALLOS as e:
            errores.append(f'SSIM: {e}')
    if juego:
        try:
            _, cb, cr = [E.emd(x, y) for x, y in zip(E.planos(imagen), E.planos(juego))]
            medida['emd'] = {c: {'valor': round(v, 1), 'estado': estado_emd(c, v)} for c, v in (('cb', cb), ('cr', cr))}
        except FALLOS as e:
            errores.append(f'EMD: {e}')
    if errores:
        medida['error'] = ' · '.join(errores)
    return medida


if __name__ == '__main__':
    if not 2 <= len(sys.argv) <= 4:
        sys.exit(__doc__)
    args = sys.argv[1:] + [None, None]
    print(json.dumps(medir(args[0], None if args[1] == '-' else args[1], args[2]), ensure_ascii=False))
