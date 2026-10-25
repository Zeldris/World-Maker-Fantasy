#!/usr/bin/env python3
"""IMG-5: monta el prompt de imagen desde una ficha (docs/producto/plan-imagenes/plantilla-prompt.md).

Sin LLM, sin prompt negativo y sin dependencias: misma ficha, perfil y variante dan siempre el mismo texto.
Uso:
  prompt_ficha.py <ficha.json> <perfil> [--variante macho] [--momento dia|atardecer|noche]
                  [--estacion primavera|verano|otono|invierno (o el enum del motor: PRIMAVERA…)] [--fondo <ficha-zona.json>] [--json]
Sale con 2 y el motivo (palabra, regla, alternativa) si el prompt rompe una regla.
"""
import argparse
import copy
import json
import os
import re
import sys

MUNDO = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'estilo', 'mundo.json')
RECORTABLES = ('B6', 'B5', 'B4')  # orden en que se quitan si el prompt se pasa de largo
ESTACIONES = ('primavera', 'verano', 'otono', 'invierno')  # claves internas, en minúsculas y sin eñe (otoño = otono)
# El enum del motor (`Estacion`, backend/src/services/worldClock.ts) va en mayúsculas; se acepta y se normaliza.
ESTACIONES_MOTOR = {'PRIMAVERA': 'primavera', 'VERANO': 'verano', 'OTONO': 'otono', 'INVIERNO': 'invierno'}
CAMPOS = ('sujeto', 'ancla', 'cuerpo', 'rasgos', 'pose', 'entorno', 'luz', 'lugar')  # claves válidas de `prompt`


class ReglaRota(Exception):
    """El prompt rompe una regla de la plantilla; el mensaje dice la palabra, la regla y la alternativa."""


def _frases(valor):
    if valor is None:
        return ''
    if isinstance(valor, list):
        return ' '.join(str(v).strip() for v in valor if str(v).strip())
    return str(valor).strip()


def _aplicar(p: dict, cambios: dict):
    """Sustituye claves de `p`; una clave terminada en `+` se añade al final de la lista."""
    for clave, valor in cambios.items():
        if clave.endswith('+'):
            base = clave[:-1]
            previo = p.get(base) or []
            if not isinstance(previo, list):
                previo = [previo]
            p[base] = previo + (valor if isinstance(valor, list) else [valor])
        else:
            p[clave] = valor


def _validar_campos(ficha: dict):
    """Las claves de `variantes` y de `condiciones` (con o sin `+` final) tienen que ser campos de `prompt`."""
    for seccion in ('variantes', 'condiciones'):
        for nombre, cambios in (ficha.get(seccion) or {}).items():
            for clave in cambios or {}:
                if clave.removesuffix('+') not in CAMPOS:
                    raise ReglaRota(f'regla 8 ({seccion}): la clave «{clave}» de «{nombre}» en la ficha '
                                    f'«{ficha.get("slug", "?")}» no es un campo de prompt; los que hay son: '
                                    f'{", ".join(CAMPOS)} (con «+» al final para añadir a la lista)')


def _aplicar_variante(ficha: dict, variante):
    p = copy.deepcopy(ficha.get('prompt') or {})
    if variante is None:
        return p
    variantes = ficha.get('variantes') or {}
    if variante not in variantes:
        raise ReglaRota(f'regla 8 (variantes): la variante «{variante}» no existe en la ficha '
                        f'«{ficha.get("slug", "?")}»; las que hay son: {", ".join(sorted(variantes)) or "ninguna"}')
    _aplicar(p, variantes[variante])
    return p


def _validar_condiciones(ficha: dict, mundo: dict):
    momentos, estaciones = sorted(mundo['preambulo']), list(mundo.get('estaciones') or ESTACIONES)
    validos = {'estacion': estaciones, 'momento': momentos}
    for clave in ficha.get('condiciones') or {}:
        partes = [parte.partition(':') for parte in clave.split('+')]
        tipos = tuple(t for t, _, _ in partes)
        # solo las formas que busca _aplicar_condiciones: una sola parte, o la combinada estación + momento en ese orden
        if tipos in (('estacion',), ('momento',), ('estacion', 'momento')) and all(v in validos[t] for t, _, v in partes):
            continue
        raise ReglaRota(f'regla 9 (condiciones): la clave «{clave}» de la ficha «{ficha.get("slug", "?")}» no es '
                        f'válida; usa «estacion:<{"|".join(estaciones)}>», «momento:<{"|".join(momentos)}>» '
                        'o «estacion:<e>+momento:<m>» (en ese orden, sin repetir)')


def _aplicar_condiciones(p: dict, ficha: dict, estacion, momento):
    """Orden, tras prompt y variante: estación, momento, combinada."""
    conds = ficha.get('condiciones') or {}
    claves = ([f'estacion:{estacion}'] if estacion else []) + [f'momento:{momento}']
    if estacion:
        claves.append(f'estacion:{estacion}+momento:{momento}')
    for clave in claves:
        if clave in conds:
            _aplicar(p, conds[clave])


def _b1(p: dict) -> str:
    sujeto = _frases(p.get('sujeto'))
    if not sujeto:
        raise ReglaRota('regla 8: B1 (prompt.sujeto) es obligatorio')
    if p.get('ancla'):
        sujeto += f' Its silhouette recalls {str(p["ancla"]).strip()}.'
    return sujeto


def _estilo_perfil(mundo: dict, perfil: str) -> dict:
    estilos = mundo['estilos']
    e = estilos.get(perfil)
    if isinstance(e, str):  # alias (thumbnail -> icono)
        e = estilos.get(e)
    if not isinstance(e, dict):
        raise ReglaRota(f'regla 2: el perfil «{perfil}» no tiene estilo en mundo.json')
    return e


def _estilo(mundo: dict, perfil: str, tipo: str) -> str:
    e = _estilo_perfil(mundo, perfil)
    por_tipo = (e.get('porTipo') or {}).get(tipo) or {}
    base = e['base'].replace('{clase}', por_tipo.get('clase', ''))
    base = re.sub(r'\s+', ' ', base).replace(' ,', ',').strip()
    return ' '.join(x for x in (base, por_tipo.get('acabado', '')) if x)


def _comprobar(prompt: str, mundo: dict, nombres: list, momento=None):
    fallos = []
    c = (mundo.get('coherencia') or {}).get(momento)
    if c:
        for m in re.finditer(c['patron'], prompt, re.I):
            fallos.append(f'regla 9 (coherencia con el momento): «{m.group(0)}» en un prompt de {momento}; '
                          f'{c["motivo"]}. En su lugar: {c["alternativa"]}')
    for v in mundo.get('vetadas', []):
        for m in re.finditer(v['patron'], prompt, re.I):
            fallos.append(f'regla 4 (palabra vetada): «{m.group(0)}» en el prompt; {v["motivo"]}. '
                          f'En su lugar: {v["alternativa"]}')
    neg = mundo.get('negaciones')
    if neg:
        for m in re.finditer(neg, prompt, re.I):
            fallos.append(f'regla 3 (frases en positivo): negación «{m.group(0)}» en el prompt; '
                          'reescribir en positivo, sin nombrar lo que no se quiere')
    for n in nombres:
        if n and re.search(rf'(?<!\w){re.escape(n)}(?!\w)', prompt, re.I):  # palabra entera: «Ash» no salta con «ashes»
            fallos.append(f'regla 5 (sin nombres propios): el prompt contiene el nombre «{n}»; '
                          'describir la cosa en vez de nombrarla')
    if fallos:
        raise ReglaRota('; '.join(fallos))


def construir(ficha: dict, mundo: dict, perfil: str, variante=None, momento=None, fondo=None, estacion=None) -> dict:
    if perfil not in mundo.get('encuadres', {}):
        raise ReglaRota(f'perfil desconocido «{perfil}»; los que hay son: {", ".join(sorted(mundo.get("encuadres", {})))}')
    mom = momento or ficha.get('momento') or 'dia'
    if mom not in mundo['preambulo']:
        raise ReglaRota(f'regla 9 (condiciones): momento desconocido «{mom}»; los que hay son: '
                        f'{", ".join(sorted(mundo["preambulo"]))}')
    validas = list(mundo.get('estaciones') or ESTACIONES)
    estacion = ESTACIONES_MOTOR.get(estacion, estacion)  # PRIMAVERA… del motor -> primavera…
    if estacion is not None and estacion not in validas:
        raise ReglaRota(f'regla 9 (condiciones): estación desconocida «{estacion}»; las que hay son: {", ".join(validas)}')
    tipo = ficha.get('tipo', '')
    if perfil == 'mapa' and tipo != 'location':
        raise ReglaRota(f'regla 2: el perfil «mapa» solo vale con fichas de tipo location; la ficha '
                        f'«{ficha.get("slug", "?")}» es de tipo «{tipo or "?"}»')
    region_ficha = ficha.get('region')
    regiones = mundo.get('regiones') or {}
    if region_ficha is not None and region_ficha not in regiones:
        raise ReglaRota(f'regla 9 (condiciones): región desconocida «{region_ficha}» en la ficha '
                        f'«{ficha.get("slug", "?")}»; las que hay son: {", ".join(sorted(regiones)) or "ninguna"}')
    _validar_campos(ficha)
    _validar_condiciones(ficha, mundo)
    condicion = f'{estacion or "-"}/{mom}'
    p = _aplicar_variante(ficha, variante)
    _aplicar_condiciones(p, ficha, estacion, mom)
    b1, b2, b3, b4 = _b1(p), _frases(p.get('cuerpo')), _frases(p.get('rasgos')), _frases(p.get('pose'))
    avisos, recortados = [], []
    propuestas = list(ficha.get('propuestas') or [])

    if fondo is not None:
        lugar = _frases((fondo.get('prompt') or {}).get('lugar'))
        if fondo.get('tipo') != 'location' or not lugar:
            raise ReglaRota(f'segunda pasada (D10, --fondo): la ficha de fondo «{fondo.get("slug", "?")}» tiene que ser de tipo '
                            f'location y llevar prompt.lugar no vacío (es de tipo «{fondo.get("tipo") or "?"}»'
                            f'{"" if lugar else ", sin prompt.lugar"})')
        entrada = mundo['fondo']['entrada'].replace('{lugar}', lugar)
        sujeto = ' '.join(x for x in (b1, b2, b3, b4) if x)
        sujeto = sujeto[:1].lower() + sujeto[1:]
        estilo = _estilo_perfil(mundo, perfil).get('palabra')
        if not estilo:
            raise ReglaRota(f'regla 2: el perfil «{perfil}» no tiene `palabra` de estilo en mundo.json (la pide --fondo)')
        cierre = mundo['fondo']['cierre'].replace('{estilo}', estilo)
        prompt = ' '.join((entrada, sujeto, cierre))
        _comprobar(prompt, mundo, [ficha.get('nombre'), fondo.get('nombre')], mom)
        return {'prompt': prompt, 'palabras': len(prompt.split()), 'recortados': [], 'avisos': avisos,
                'propuestas': propuestas, 'momento': mom, 'estacion': estacion, 'condicion': condicion}

    region = regiones.get(region_ficha, {})
    if 'entorno' in p:
        b5 = _frases(p['entorno'])
    else:
        b5 = f'The setting is {region["paisaje"]}.' if region.get('paisaje') else ''
        if b5 and estacion:
            b5 = ' '.join(x for x in (b5, (region.get('estaciones') or {}).get(estacion, '')) if x)
    luz_region = region.get('luz', '')
    if isinstance(luz_region, dict):  # una luz por momento
        luz_region = luz_region.get(mom, '')
    # clave ausente: luz de la región; cadena vacía: sin B6 (igual que `entorno: ""` quita B5, regla 8)
    b6 = _frases(p['luz']) if 'luz' in p else luz_region
    b7 = mundo['encuadres'][perfil]
    b8 = _estilo(mundo, perfil, tipo)
    b9 = mundo['preambulo'][mom]
    bloques = {'B1': b1, 'B2': b2, 'B3': b3, 'B4': b4, 'B5': b5, 'B6': b6, 'B7': b7, 'B8': b8, 'B9': b9}

    def montar():
        return ' '.join(bloques[k] for k in ('B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9') if bloques[k])

    lon = mundo.get('longitud') or {}
    prompt = montar()
    for k in RECORTABLES:
        if len(prompt.split()) <= lon.get('max', 10 ** 9):
            break
        if bloques[k]:
            bloques[k] = ''
            recortados.append(k)
            prompt = montar()
    n = len(prompt.split())
    if n > lon.get('max', 10 ** 9):
        avisos.append(f'regla 7: {n} palabras, más del máximo ({lon["max"]}) aun sin B4-B6')
    if n < lon.get('min', 0):
        avisos.append(f'regla 7: {n} palabras, menos del mínimo ({lon["min"]})')
    _comprobar(prompt, mundo, [ficha.get('nombre')], mom)
    return {'prompt': prompt, 'palabras': n, 'recortados': recortados, 'avisos': avisos, 'propuestas': propuestas,
            'momento': mom, 'estacion': estacion, 'condicion': condicion}


def _cargar(ruta):
    with open(ruta, encoding='utf-8') as f:
        return json.load(f)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description='Monta el prompt de imagen desde una ficha.')
    ap.add_argument('ficha')
    ap.add_argument('perfil')
    ap.add_argument('--variante')
    ap.add_argument('--momento')
    ap.add_argument('--estacion')
    ap.add_argument('--fondo', help='ficha de la zona que va de fondo (segunda pasada)')
    ap.add_argument('--mundo', default=MUNDO)
    ap.add_argument('--json', action='store_true')
    a = ap.parse_args(argv)
    try:
        r = construir(_cargar(a.ficha), _cargar(a.mundo), a.perfil, a.variante, a.momento,
                      _cargar(a.fondo) if a.fondo else None, a.estacion)
    except ReglaRota as e:
        print(f'prompt_ficha: {e}', file=sys.stderr)
        return 2
    if a.json:
        print(json.dumps(r, ensure_ascii=False, indent=2))
    else:
        print(r['prompt'])
        for av in r['avisos']:
            print(f'aviso: {av}', file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main())
