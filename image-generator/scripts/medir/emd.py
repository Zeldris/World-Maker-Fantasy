"""IMG-17: distancia entre los colores de dos imágenes, solo con la biblioteca estándar y ffmpeg.
Uso (siempre aislado): python3 -I emd.py A.png B.png [C.png ...]
Imprime la EMD de A frente a cada otra imagen (Wasserstein-1 entre los histogramas de Y, Cb y Cr, en niveles de
0-255, sobre un diezmado a 160x64) y, si hay más de una, la mediana por canal en una línea «MEDIANA …»."""
import statistics
import subprocess
import sys

ANCHO, ALTO = 160, 64


def planos(ruta):
    """Los tres planos (Y, Cb, Cr) de la imagen, diezmada, como bytes."""
    crudo = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', ruta, '-vf', f'scale={ANCHO}:{ALTO}:flags=area,format=yuv444p',
         '-frames:v', '1', '-f', 'rawvideo', '-'], capture_output=True, check=True).stdout
    n = ANCHO * ALTO
    if len(crudo) < 3 * n:
        sys.exit(f'ERROR: no se pudo leer {ruta}')
    return [crudo[i * n:(i + 1) * n] for i in range(3)]


def cdf(plano):
    h = [0] * 256
    for v in plano:
        h[v] += 1
    acum, salida = 0, []
    for x in h:
        acum += x
        salida.append(acum / len(plano))
    return salida


def emd(a, b):
    return sum(abs(x - y) for x, y in zip(cdf(a), cdf(b)))


def main(argv):
    if len(argv) < 3:
        sys.exit(__doc__)
    a = planos(argv[1])
    todas = []
    for ruta in argv[2:]:
        d = [emd(x, y) for x, y in zip(a, planos(ruta))]
        todas.append(d)
        print('EMD Y=%.1f Cb=%.1f Cr=%.1f' % tuple(d))
    if len(todas) > 1:
        print('MEDIANA Y=%.1f Cb=%.1f Cr=%.1f' % tuple(statistics.median(c[i] for c in todas) for i in range(3)))


if __name__ == '__main__':
    main(sys.argv)
