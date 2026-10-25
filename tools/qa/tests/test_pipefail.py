"""QA-254: los scripts del generador de imágenes y de su plan llevan `set -euo pipefail` al principio.

`docs/producto/plan-imagenes/banco.sh` no lo tenía y «probar.sh … | tail -2 || echo FALLO» nunca decía FALLO: sin
pipefail, la tubería devuelve el código del último comando (tail), no el del que falló. Todo `.sh` bajo
`image-generator/` y `docs/producto/plan-imagenes/` lo lleva en sus primeras 15 líneas, o dice por qué no con una línea
`# sin pipefail: <motivo>` en esas mismas líneas (p. ej. generar.sh y probar.sh vigilan y matan procesos de sd-cli, y no
se pueden probar sin los modelos de la Deck). Se excluyen los enlaces (`image-generator/modelos`, `bin` y `generated`
apuntan a la copia principal) y cualquier `node_modules`.
"""
import os
import re
import unittest

from comun import RAIZ

CARPETAS = ['image-generator', os.path.join('docs', 'producto', 'plan-imagenes')]
LINEAS = 15
# En la raíz de image-generator/ estas tres son enlaces (o carpetas ignoradas por git) a la copia principal del repo.
EXCLUIDAS_EN_RAIZ = {'modelos', 'bin', 'generated'}
SIN_PIPEFAIL = re.compile(r'^\s*#\s*sin pipefail:\s*\S')


def scripts_sh():
    """Rutas (relativas a la raíz del repo) de todos los .sh de CARPETAS, sin enlaces ni node_modules."""
    encontrados = []
    for carpeta in CARPETAS:
        base = os.path.join(RAIZ, carpeta)
        for dirpath, dirnames, nombres in os.walk(base, followlinks=False):
            dirnames[:] = sorted(d for d in dirnames if d != 'node_modules' and not os.path.islink(os.path.join(dirpath, d))
                                 and not (dirpath == base and carpeta == 'image-generator' and d in EXCLUIDAS_EN_RAIZ))
            for nombre in sorted(nombres):
                ruta = os.path.join(dirpath, nombre)
                if nombre.endswith('.sh') and not os.path.islink(ruta):
                    encontrados.append(os.path.relpath(ruta, RAIZ))
    return encontrados


def tiene_set_estricto(linea: str) -> bool:
    """`set` con -e, -u y -o pipefail (en cualquier orden: `-euo pipefail`, `-eu -o pipefail`, `-e -u -o pipefail`)."""
    orden = linea.split('#', 1)[0].split(';', 1)[0].split()
    if not orden or orden[0] != 'set':
        return False
    letras, pipefail = '', False
    for i, palabra in enumerate(orden[1:], 1):
        if palabra == '-o' and orden[i + 1:i + 2] == ['pipefail']:
            pipefail = True
        elif re.fullmatch(r'-[a-z]+', palabra):
            letras += palabra[1:]
            # `-euo pipefail`: la o del final pide el nombre de la opción en la palabra siguiente.
            if palabra.endswith('o') and orden[i + 1:i + 2] == ['pipefail']:
                pipefail = True
    return pipefail and 'e' in letras and 'u' in letras


def cumple(texto: str) -> bool:
    cabecera = texto.splitlines()[:LINEAS]
    return any(tiene_set_estricto(l) or SIN_PIPEFAIL.match(l) for l in cabecera)


class Pipefail(unittest.TestCase):
    def test_encuentra_los_scripts(self):
        scripts = scripts_sh()
        for esperado in ('image-generator/scripts/generar.sh', 'image-generator/scripts/probar.sh',
                         'docs/producto/plan-imagenes/banco.sh'):
            self.assertIn(esperado, scripts, f'{esperado} no sale en la lista: el recorrido de carpetas está roto')
        self.assertFalse([s for s in scripts if 'node_modules' in s.split(os.sep)], 'entra un node_modules')
        for excluida in EXCLUIDAS_EN_RAIZ:
            self.assertFalse([s for s in scripts if s.startswith(f'image-generator/{excluida}/')],
                             f'entra image-generator/{excluida}/')

    def test_todo_script_tiene_pipefail_o_dice_por_que_no(self):
        malos = []
        for ruta in scripts_sh():
            with open(os.path.join(RAIZ, ruta), encoding='utf-8') as f:
                if not cumple(f.read()):
                    malos.append(ruta)
        self.assertEqual(malos, [], f'script sin `set -euo pipefail` en sus primeras {LINEAS} líneas ni una línea '
                                    '`# sin pipefail: <motivo>` (sin pipefail, «cmd | tail || echo FALLO» nunca dice '
                                    f'FALLO, QA-254): {", ".join(malos)}')

    # El comprobador en sí: un test que no falla sin su arreglo no comprueba nada.
    def test_acepta_las_formas_estrictas(self):
        for linea in ('set -euo pipefail', 'set -euo pipefail  # sin pipefail, «x» nunca diría FALLO',
                      'set -eu -o pipefail', 'set -e -u -o pipefail', 'set -o pipefail -eu'):
            self.assertTrue(cumple(f'#!/bin/bash\n{linea}\n'), linea)

    def test_rechaza_lo_incompleto(self):
        for linea in ('set -u', 'set -eu', 'set -e', 'set -o pipefail', 'set -eo pipefail', '# set -euo pipefail',
                      'echo set -euo pipefail'):
            self.assertFalse(cumple(f'#!/bin/bash\n{linea}\n'), linea)
        self.assertFalse(cumple('#!/bin/bash\n'), 'sin ningún set')

    def test_la_excepcion_pide_motivo(self):
        self.assertTrue(cumple('#!/bin/bash\n# sin pipefail: vigila y mata procesos de sd-cli\nset -u\n'))
        self.assertFalse(cumple('#!/bin/bash\n# sin pipefail:\nset -u\n'), 'excepción sin motivo')
        self.assertFalse(cumple('#!/bin/bash\n# sin pipefail\nset -u\n'), 'excepción sin dos puntos ni motivo')

    def test_solo_cuentan_las_primeras_lineas(self):
        relleno = '# relleno\n' * LINEAS
        self.assertFalse(cumple(f'#!/bin/bash\n{relleno}set -euo pipefail\n'))
        self.assertTrue(cumple('#!/bin/bash\n' + '# relleno\n' * (LINEAS - 2) + 'set -euo pipefail\n'))


if __name__ == '__main__':
    unittest.main()
