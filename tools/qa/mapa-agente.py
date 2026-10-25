#!/usr/bin/env python3
"""QA-108 (2026-10-19): que el mapa del agente (docs/mapa-agente.md) no apunte a nada que ya no existe (CI).

Mira cada referencia entre comillas invertidas que empiece por una ruta del repo (`b/` = backend/src/,
`f/` = frontend/src/, `backend/`, `frontend/`, `tools/`, `docs/`, `image-generator/`, `voice-generator/`; una ruta con `<…>` es un patrón y no se mira):
  - `ruta`           el archivo o la carpeta existe (con `*`, que haya al menos uno);
  - `ruta#nombre`    además, el archivo define `nombre` (función, constante, clase, tipo o modelo de Prisma;
                     en Python, `def`; en bash, `nombre()`);
  - `nombre` suelto  (en camelCase, tras una `ruta#…` en la misma viñeta) sale en ese mismo archivo (puede ser
                     una llamada o un campo: el mapa nombra secciones del turno por lo que llaman).
Sale con 1 si alguna está rota.
Uso: python3 tools/qa/mapa-agente.py
"""
import glob, os, re, subprocess, sys

RAIZ = subprocess.run(['git', 'rev-parse', '--show-toplevel'], capture_output=True, text=True).stdout.strip()
MAPA = os.path.join(RAIZ, 'docs', 'mapa-agente.md')
PREFIJOS = {'b/': 'backend/src/', 'f/': 'frontend/src/'}
REF = re.compile(r'`((?:b|f|backend|frontend|tools|docs|image-generator|voice-generator)/[^`\s#<]+)(?:#([A-Za-z_][\w]*))?`')
SUELTO = re.compile(r'`([a-z]+[A-Z]\w*)`')


def texto_de(ruta, cache={}):
    if ruta not in cache:
        cache[ruta] = open(ruta, encoding='utf-8').read()
    return cache[ruta]


def define(texto, nombre):
    n = re.escape(nombre)
    return re.search(
        rf'(?:\b(?:function\*?|const|let|var|class|interface|type|enum|model|def)\s+{n}\b)'  # declaración
        rf'|(?:^\s*{n}\s*\(\)\s*\{{)'  # función de bash
        # método (con o sin modificadores): sus paréntesis van seguidos de `{`, no de `;` como una llamada
        rf'|(?:^\s*(?:(?:public|private|protected|static|async|override|readonly)\s+)*{n}\s*(?:<[^>]*>)?\([^;]*?\)\s*(?::[^;{{=]*)?\{{)',
        texto, re.M) is not None


def vinetas():
    """Cada viñeta (o párrafo) entera, con el número de su primera línea."""
    actual, inicio = [], 0
    for nl, l in enumerate(open(MAPA, encoding='utf-8'), 1):
        if not l.strip() or re.match(r'^(- |#|\|)', l):
            if actual:
                yield inicio, ' '.join(actual)
            actual, inicio = ([l.strip()], nl) if l.strip() else ([], 0)
        else:
            inicio = inicio or nl
            actual.append(l.strip())
    if actual:
        yield inicio, ' '.join(actual)


def main():
    rotas = []
    total = 0
    for nl, texto in vinetas():
        archivos = None
        for m in re.finditer(REF.pattern + '|' + SUELTO.pattern, texto):
            ruta, nombre, suelto = m.group(1), m.group(2), m.group(3)
            if suelto:
                if not archivos:
                    continue
                total += 1
                if not any(re.search(rf'\b{suelto}\b', texto_de(a)) for a in archivos):
                    rotas.append(f'mapa-agente.md:{nl}: {ruta_actual} no define {suelto}')
                continue
            total += 1
            for corto, largo in PREFIJOS.items():
                if ruta.startswith(corto):
                    ruta = largo + ruta[len(corto):]
            ruta_actual = ruta
            todos = glob.glob(os.path.join(RAIZ, ruta))
            archivos = [a for a in todos if os.path.isfile(a)]
            if not todos:
                rotas.append(f'mapa-agente.md:{nl}: no existe {ruta}')
            elif nombre and not any(define(texto_de(a), nombre) for a in archivos):
                rotas.append(f'mapa-agente.md:{nl}: {ruta} no define {nombre}')
            if not nombre or '*' in ruta:
                archivos = None  # los nombres sueltos solo siguen a una referencia `archivo#función`
    for r in rotas:
        print(r)
    print(f'{len(rotas)} referencias rotas en {total} del mapa del agente')
    return 1 if rotas else 0


if __name__ == '__main__':
    sys.exit(main())
