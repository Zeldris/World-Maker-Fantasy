#!/usr/bin/env python3
"""QA-301 (retro de la puerta 3.4): el inventario de la jugadora no incluye lo de compañeros ni súbditos.

El inventario de la jugadora son los `InventoryItem` con `slot: null` Y SIN dueño (`companionId: null`,
`subjectId: null`): un objeto de un compañero o súbdito sin equipar también tiene `slot: null`. Tres fallos de la
revisión de la puerta 3.4 (p. ej. «Entregar pastos») salieron de una consulta con `slot: null` a secas, que
contaba, entregaba o borraba objetos ajenos (REVIEW.md, QA-78: una regla se arregla en todos sus caminos).

Regla: una consulta Prisma `<cliente>.item.<op>(` o `<cliente>.inventoryItem.<op>(` (el modelo real es
`InventoryItem`; `item` se acepta por si se renombra), o una relación anidada `inventoryItems: { where: ... }`, en
`backend/src/**/*.ts` (sin `.test.ts` ni `.spec.ts`) cuyo `where` contenga `slot: null` debe llevar en ese mismo `where`
`companionId` y `subjectId` (el esquema tiene los dos dueños, así que se exigen los dos), o un comentario
`// inventario: todos` en la línea de la llamada o en la anterior, con el motivo, si de verdad debe incluir
objetos de compañeros. Solo se mira el `where`: un `data: { slot: null }` desequipa, no consulta.

Uso: python3 tools/qa/inventario-suelto.py [raiz]   (raíz del repo; por defecto, la de este archivo)
Salida: `ruta:línea: <op> con slot: null sin companionId|subjectId`, código 1; si no hay infracciones, 0.
"""
import os
import re
import sys

LLAMADA = re.compile(r'\.(?:item|inventoryItem)\.(\w+)\s*\(|\binventoryItems\s*:\s*\{')
EXCUSA = '// inventario: todos'


def cerrar(t: str, ini: int) -> int:
    """Índice del cierre que empareja al paréntesis/llave en t[ini], ignorando strings y comentarios; -1 si no cierra."""
    prof, i, n = 0, ini, len(t)
    while i < n:
        c = t[i]
        if c in '\'"`':
            i += 1
            while i < n and t[i] != c:
                i += 2 if t[i] == '\\' else 1
        elif t.startswith('//', i):
            i = t.find('\n', i)
            if i < 0:
                return -1
        elif t.startswith('/*', i):
            i = t.find('*/', i)
            if i < 0:
                return -1
            i += 1
        elif c in '({[':
            prof += 1
        elif c in ')}]':
            prof -= 1
            if prof == 0:
                return i
        i += 1
    return -1


def sin_cadenas(t: str) -> str:
    """Quita strings y comentarios (conserva longitud) para buscar claves sin falsos positivos."""
    return re.sub(r'(\'(?:\\.|[^\'\\\n])*\'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`|//[^\n]*|/\*.*?\*/)',
                  lambda m: ' ' * len(m.group(0)), t, flags=re.S)


def where_de_primer_nivel(arg: str):
    """El `{...}` del `where:` que cuelga directamente del objeto de argumentos, no uno anidado en include/select;
    None si no hay. `arg` empieza en `(` (llamada; el objeto está a profundidad 2) o en `{` (relación; profundidad 1)."""
    nivel = 2 if arg.startswith('(') else 1
    prof = 0
    for m in re.finditer(r'\bwhere\s*:\s*\{|[({\[]|[)}\]]', arg):
        t = m.group(0)
        if t[0] in ')}]':
            prof -= 1
        elif t[0] in '({[':
            prof += 1
        elif prof == nivel:
            a = m.end() - 1
            b = cerrar(arg, a)
            return arg[a:b + 1] if b >= 0 else arg[a:]
        else:
            prof += 1  # la llave de un where anidado
    return None


def infracciones(texto: str):
    limpio = sin_cadenas(texto)
    lineas = texto.split('\n')
    for m in LLAMADA.finditer(limpio):
        ini = m.end() - 1
        fin = cerrar(limpio, ini)
        if fin < 0:
            continue
        arg = limpio[ini:fin + 1]
        donde = where_de_primer_nivel(arg)
        if donde is None:
            continue
        if not re.search(r'\bslot\s*:\s*null\b', donde):
            continue
        faltan = [k for k in ('companionId', 'subjectId') if not re.search(rf'\b{k}\s*:\s*null\b', donde)]
        if not faltan:
            continue
        linea = limpio.count('\n', 0, m.start()) + 1
        if any(EXCUSA in lineas[i] for i in (linea - 1, linea - 2) if 0 <= i < len(lineas)):
            continue
        yield linea, m.group(1) or 'inventoryItems', faltan


def main() -> int:
    raiz = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    malas = 0
    for dirpath, dirs, archivos in os.walk(os.path.join(raiz, 'backend', 'src')):
        dirs[:] = [d for d in dirs if d not in ('__tests__', 'node_modules')]
        for nombre in sorted(archivos):
            if not nombre.endswith('.ts') or nombre.endswith(('.test.ts', '.spec.ts')):
                continue
            ruta = os.path.join(dirpath, nombre)
            with open(ruta, encoding='utf-8') as f:
                for linea, op, faltan in infracciones(f.read()):
                    print(f'{os.path.relpath(ruta, raiz)}:{linea}: {op} con slot: null sin {"|".join(faltan)}')
                    malas += 1
    return 1 if malas else 0


if __name__ == '__main__':
    sys.exit(main())
