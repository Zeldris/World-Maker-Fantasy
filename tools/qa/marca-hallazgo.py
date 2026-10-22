#!/usr/bin/env python3
"""QA-42 (retro de QA-27, 2026-10-12): cambia el estado de un hallazgo en el registro de una ronda.

Uso: python3 tools/qa/marca-hallazgo.py P<n> "<texto viejo>" "<texto nuevo>" [--registro <ruta>]
     python3 tools/qa/marca-hallazgo.py --nuevo "<hallazgo>" "<estado>" [--registro <ruta>]
     python3 tools/qa/marca-hallazgo.py --resumen [--comprobar] [--registro <ruta>]

La primera forma busca la fila `| P<n> | ...` cuyo estado (la última columna) contenga el texto viejo y
lo sustituye solo ahí; falla si no hay exactamente una, para no tocar otra fila por error. La segunda (`QA-47`) añade una fila nueva
detrás de la última, con el siguiente número; `QA-55`: el número sale por encima del más alto de la copia
local, de `origin/main` y de todas las ramas `origin/claude/*` (hace `git fetch` antes), para que dos
cuentas que anotan a la vez no repitan número. Registro por defecto: el del hito más alto
(`docs/registros/pruebas-<hito>-hallazgos.md`, p. ej. `pruebas-0.3-hallazgos.md`).

QA-84 (retro del 2026-10-14): el resumen de la cabecera (qué hallazgos siguen pendientes, cuáles están
arreglados y cuáles comprobados jugando) sale de la tabla, entre `INICIO_RESUMEN` y `FIN_RESUMEN`: las
dos primeras formas lo rehacen al escribir, `--resumen` lo rehace solo y `--resumen --comprobar` (CI)
falla si no coincide con la tabla o faltan las marcas. Sin marcas, escribir no genera resumen.
"""
import glob
import os
import re
import subprocess
import sys
import textwrap



def registro_por_defecto() -> str:
    por_hito = {}
    for ruta in glob.glob('docs/registros/pruebas-*-hallazgos.md'):
        m = re.search(r'pruebas-(\d+)\.(\d+)-hallazgos\.md$', ruta)
        if m:
            por_hito[(int(m.group(1)), int(m.group(2)))] = ruta
    if not por_hito:
        sys.exit('No hay ningún docs/registros/pruebas-<hito>-hallazgos.md (¿estás en la raíz del repo?)')
    return por_hito[max(por_hito)]


def numeros_en_ramas(ruta: str) -> list[int]:
    """QA-55: los P<n> del registro en `origin/main` y en cada rama `origin/claude/*`, tras un `git fetch`.

    Sin red, se queda con lo que ya hubiera traído el último fetch (y lo avisa)."""
    if subprocess.run(['git', 'fetch', '--quiet', 'origin'], capture_output=True).returncode != 0:
        print('marca-hallazgo: sin git fetch (¿sin red?); numero con las ramas que ya había', file=sys.stderr)
    raiz = subprocess.run(['git', 'rev-parse', '--show-toplevel'], capture_output=True, text=True).stdout.strip()
    rel = os.path.relpath(os.path.abspath(ruta), raiz) if raiz else ruta
    ramas = subprocess.run(['git', 'for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin/claude/'],
                           capture_output=True, text=True).stdout.split()
    numeros = []
    for rama in ['origin/main', *ramas]:
        r = subprocess.run(['git', 'show', f'{rama}:{rel}'], capture_output=True, text=True)
        if r.returncode == 0:
            numeros += [int(n) for n in re.findall(r'^\| P(\d+) \|', r.stdout, re.M)]
    return numeros


INICIO_RESUMEN = '<!-- resumen: lo genera tools/qa/marca-hallazgo.py desde la tabla; no se edita a mano -->'
FIN_RESUMEN = '<!-- fin del resumen -->'
GRUPOS = [
    ('pendiente', 'Pendientes'),
    ('decision', 'Pendientes de una decisión de la usuaria'),
    ('parte', 'Arreglados en parte'),
    ('arreglado', 'Arreglados, sin comprobar jugando'),
    ('comprobado', 'Comprobados jugando'),
    ('nojugable', 'Arreglados, no jugables (los cubre un test o la base)'),
    ('cerrado', 'Cerrados sin arreglo (no aplica, dato o roadmap)'),
]


def sin_citas(estado: str) -> str:
    return re.sub(r'«[^»]*»', '', estado).strip()


REABIERTO = re.compile(r'\breabiert[oa]\b', re.I)
FECHA = r'(\d{4}-\d{2}-\d{2})'


def reabierto_vigente(t: str) -> bool:
    """Hay un «reabierto» (el último) sin ✅ detrás: manda el último estado (QA-92)."""
    ms = list(REABIERTO.finditer(t))
    return bool(ms) and '✅' not in t[ms[-1].start():]


def grupo(estado: str) -> str:
    """En qué grupo del resumen cae un hallazgo, por el texto de su estado (lo citado entre «» no cuenta).

    Lo que queda de un arreglo va tras «pendiente:» o «falta:», o lo marca «en parte» (con o sin paréntesis);
    lo jugado, «comprobado jugando», «comprobado en vivo» o «✅ comprobado»; lo que no se puede jugar y se cierra
    con su razón, «no jugable» (cierre del 3.3). «Reabierto» solo cuenta si no le sigue un ✅: manda el último
    estado (QA-92)."""
    t = sin_citas(estado)
    bajo = t.lower()
    if reabierto_vigente(t):
        return 'pendiente'
    if re.match(r'(no aplica|dato\b|→ roadmap|🧭|va al roadmap|pasa al roadmap)', bajo):
        return 'cerrado'
    # Desde la ronda del 2026-10-19 muchas filas abren con «arreglado (…)» sin el ✅: cuentan igual.
    if '✅' in t or re.match(r'arreglad[oa]s?\b', bajo):
        if re.search(r'\bno jugable\b', bajo):
            return 'nojugable'
        if re.search(r'\b(pendiente|falta):|\ben parte\b', bajo):
            return 'parte'
        if re.search(r'comprobad[oa]s? (jugando|en vivo)|✅ comprobado\b|jugado ✓', bajo):
            return 'comprobado'
        return 'arreglado'
    if re.search(r'decisi[oó]n de la usuaria|que la usuaria (confirme|decida)', bajo):
        return 'decision'
    return 'pendiente'


def contradictorio(estado: str) -> bool:
    """Un estado con ✅ que a la vez empieza por cerrado sin arreglo o dice que espera a la usuaria (QA-92).
    «✅ (decisión de la usuaria)» no lo es: es lo que ella decidió."""
    t = sin_citas(estado)
    bajo = t.lower()
    return '✅' in t and bool(re.match(r'(no aplica|→ roadmap|va al roadmap|pasa al roadmap)', bajo)
                             or re.search(r'pendiente de (una |la )?decisi[oó]n|que la usuaria (confirme|decida)', bajo))


def raro(estado: str) -> bool:
    """QA-185: cuenta como pendiente sin decirlo, como las filas «arreglado» sin ✅ que se contaban mal. Lo dice
    si empieza (tras negritas, emoji o rayas) por «pendiente(s)» o «abierto», o si un «reabierto» lo reabrió."""
    t = sin_citas(estado)
    bajo = t.lower()
    if grupo(estado) != 'pendiente' or reabierto_vigente(t):
        return False
    return not re.match(r'[^\w]*(pendientes?|abiert[oa]s?)\b', bajo)


def incoherente(estado: str, g: str | None = None) -> bool:
    """QA-195: el estado cuenta como cerrado (arreglado, comprobado, en parte o no jugable) pero dice lo contrario en el
    orden equivocado: un «reabierto <fecha>» POSTERIOR a la fecha del ✅ que lo sigue (los subagentes escriben lo nuevo
    delante del estado viejo: P116 del 3.3), o, en un comprobado, «falta/queda (por) ver/comprobar». El historial en
    orden («✅ 10-15; reabierto 10-21; ✅ 10-23») y las referencias sin fecha («no se ha reabierto») pasan."""
    t = sin_citas(estado)
    bajo = t.lower()
    g = g or grupo(estado)
    if g not in ('arreglado', 'comprobado', 'parte', 'nojugable'):
        return False
    # «falta verlo/comprobarlo jugando» en un arreglado es lo normal (aún no se ha jugado); «falta ver una hora» tras un
    # «comprobado jugando» es lo que se quedó a medias.
    if g == 'comprobado' and re.search(r'\b(falta|queda)n?( por)? (ver|comprobar)\w*', bajo):
        return True
    for m in REABIERTO.finditer(t):
        resto = t[m.end():]
        cruz = resto.find('✅')
        if cruz < 0:
            continue
        f1 = re.search(FECHA, resto[:cruz])
        f2 = re.match(r'[^\d✅]{0,25}' + FECHA, resto[cruz + 1:])
        if f1 and f2 and f1.group(1) > f2.group(1):
            return True
    return False


def partir(linea: str) -> tuple[str, str]:
    """Una fila en (todo hasta la última columna, su Estado): lo que va detrás del último ` | ` sin escapar."""
    cuerpo = linea.rstrip()[:-1].rstrip()  # sin la `|` final
    corte = max(i for i in range(len(cuerpo) - 2) if cuerpo[i:i + 3] == ' | ' and cuerpo[i - 1] != '\\')
    return cuerpo[:corte + 3], cuerpo[corte + 3:]


def con_resumen(lineas: list[str]) -> list[str]:
    """Las líneas con el resumen rehecho desde la tabla (iguales si no hay marcas de resumen)."""
    if INICIO_RESUMEN not in lineas or FIN_RESUMEN not in lineas:
        return lineas
    por_grupo: dict[str, list[str]] = {g: [] for g, _ in GRUPOS}
    for linea in lineas:
        m = re.match(r'^\| (P\d+) \|', linea)
        if m:
            por_grupo[grupo(partir(linea)[1])].append(m.group(1))
    cuerpo = []
    for clave, titulo in GRUPOS:
        ids = por_grupo[clave]
        texto = f'- **{titulo}** ({len(ids)}): ' + (', '.join(ids) if ids else 'ninguno') + '.'
        cuerpo += textwrap.wrap(texto, 100, subsequent_indent='  ', break_on_hyphens=False)
    i, j = lineas.index(INICIO_RESUMEN), lineas.index(FIN_RESUMEN)
    return lineas[:i + 1] + cuerpo + lineas[j:]


def guardar(ruta: str, lineas: list[str]) -> None:
    open(ruta, 'w', encoding='utf-8').write('\n'.join(con_resumen(lineas)))


def main(args: list[str]) -> None:
    registro = None
    if '--registro' in args:
        i = args.index('--registro')
        registro = args[i + 1]
        args = args[:i] + args[i + 2:]
    ruta = registro or registro_por_defecto()
    lineas = open(ruta, encoding='utf-8').read().split('\n')
    if args[:1] == ['--resumen']:
        nuevas = con_resumen(lineas)
        if args[1:] == ['--comprobar']:
            if INICIO_RESUMEN not in lineas or FIN_RESUMEN not in lineas:
                sys.exit(f'{ruta}: faltan las marcas del resumen (`{INICIO_RESUMEN}` y `{FIN_RESUMEN}`, cada una en su línea)')
            raros, incoherentes = [], []
            for linea in lineas:
                m = re.match(r'^\| (P\d+) \|', linea)
                if not m:
                    continue
                estado = partir(linea)[1]
                if contradictorio(estado):
                    print(f'{ruta}: aviso: el estado de {m.group(1)} se contradice (✅ y cerrado o pendiente de la usuaria)',
                          file=sys.stderr)
                if incoherente(estado):
                    print(f'{ruta}: aviso: el estado de {m.group(1)} tiene un «reabierto <fecha>» posterior a su ✅, o un '
                          '«falta ver» en un comprobado (QA-195)', file=sys.stderr)
                    incoherentes.append(m.group(1))
                if raro(estado):
                    raros.append(m.group(1))
            if raros:
                sys.exit(f'{ruta}: cuentan como pendientes y su estado no lo dice (QA-185): {", ".join(raros)}; '
                         'empiézalo por «pendiente», o por «✅»/«arreglado» si ya está arreglado')
            if incoherentes:
                sys.exit(f'{ruta}: cuentan como cerrados y su estado dice lo contrario en orden equivocado (QA-195): '
                         f'{", ".join(incoherentes)}; el estado vigente va AL FINAL (gana el último, QA-92): mueve el '
                         '«Reabierto <fecha>: …» detrás del ✅ viejo, o quita el «falta ver» si ya se vio')
            if nuevas != lineas:
                sys.exit(f'{ruta}: el resumen no coincide con la tabla; rehazlo con `python3 tools/qa/marca-hallazgo.py --resumen`')
            return
        if args[1:]:
            sys.exit(__doc__)
        guardar(ruta, lineas)
        print(f'{ruta}: resumen rehecho')
        return
    if args[:1] == ['--nuevo']:
        if len(args) != 3:
            sys.exit(__doc__)
        filas = [i for i, l in enumerate(lineas) if re.match(r'^\| P\d+ \|', l)]
        if not filas:
            sys.exit(f'{ruta}: no hay ninguna fila `| P<n> |` detrás de la que añadir')
        locales = [int(re.match(r'^\| P(\d+) ', lineas[i]).group(1)) for i in filas]
        numero = max(locales + numeros_en_ramas(ruta)) + 1
        hallazgo, estado = (t.replace('|', '\\|') for t in args[1:])
        lineas.insert(filas[-1] + 1, f'| P{numero} | {hallazgo} | {estado} |')
        guardar(ruta, lineas)
        print(f'{ruta}: P{numero} añadido')
        return
    if len(args) != 3:
        sys.exit(__doc__)
    pid, viejo, nuevo = args
    viejo, nuevo = viejo.replace('|', '\\|'), nuevo.replace('|', '\\|')

    filas = [i for i, l in enumerate(lineas) if l.startswith(f'| {pid} |') and viejo in partir(l)[1]]
    if len(filas) != 1:
        sys.exit(f'{ruta}: {len(filas)} filas de {pid} con ese texto en el estado (hace falta exactamente una)')
    antes, texto = partir(lineas[filas[0]])
    lineas[filas[0]] = f'{antes}{texto.replace(viejo, nuevo, 1)} |'
    guardar(ruta, lineas)
    print(f'{ruta}: {pid} actualizado')


if __name__ == '__main__':
    main(sys.argv[1:])
