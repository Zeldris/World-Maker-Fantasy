#!/usr/bin/env python3
"""Prototipo desechable: compara el combate de hoy (escalones) con el de vida y tiradas (PV).

No toca el juego. Lee las fichas reales de fauna, armas y orcos de
backend/src/scripts/worldCatalog.ts y simula N combates de cada escenario con los dos sistemas.
Diseño: docs/mecanicas/21-vida-y-tiradas.md.

    python3 tools/prototipos/vida-y-tiradas/simular.py            # 1.000 combates por escenario
    python3 tools/prototipos/vida-y-tiradas/simular.py -n 5000 --semilla 7

Simplificaciones (las dos versiones las comparten): sin rueda de tipos (multiplicador 1), sin
habilidades de clase ni efectos (todo es Ataque básico), sin moral ni huida, y quien defiende
puede contragolpear (lleva ATAQUE). Un combatiente queda fuera al llegar a CONVALECIENTE, como hoy.
"""
from __future__ import annotations

import argparse
import os
import random
import re
from dataclasses import dataclass, field

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
CATALOGO = os.path.join(RAIZ, 'backend', 'src', 'scripts', 'worldCatalog.ts')

ORDEN = ['ILESO', 'HERIDO', 'GRAVE', 'CONVALECIENTE', 'MUERTO']
MALUS = {'ILESO': 0, 'HERIDO': 2, 'GRAVE': 5, 'CONVALECIENTE': 10, 'MUERTO': 0}  # death.ts
MARGEN_DECISIVO = 10  # combatExchange.ts

# ---------------------------------------------------------------- cifras del sistema nuevo (§ 3 del doc)
DADO_ARMA = {'DAGA': (1, 4), 'CUCHILLO': (1, 4), 'ESPADA_1_MANO': (1, 8), 'HACHA_1_MANO': (1, 12),
             'LANZA': (1, 8), 'NATURAL': None,
             # Pendientes de confirmar (propuesta de 5e, doc § 2.4): no salen en los escenarios.
             'MAZA_1_MANO': (1, 6), 'GARROTE_1_MANO': (1, 4), 'PICA': (1, 10), 'ESCUDO': (1, 4)}
# Arma natural de la fauna por tamaño (bloques de monstruo de 5e) y dado de golpe para sus PV.
DADO_TAMANO = {'diminuta': (1, 2), 'pequena': (1, 4), 'mediana': (1, 6), 'grande': (2, 6), 'enorme': (2, 10)}
DG_TAMANO = {'diminuta': 2, 'pequena': 3, 'mediana': 5, 'grande': 7, 'enorme': 10}
# Tamaño sacado a mano de la bio de cada ficha (el catálogo no tiene campo de tamaño; § 4 del doc).
TAMANO = {'zense-ceniza': 'pequena', 'aullador-rojo': 'mediana', 'guchapo': 'grande',
          'escorante': 'pequena', 'rondador-de-brasas': 'mediana', 'cornante': 'grande',
          'canizor': 'mediana', 'gargantua-de-ceniza': 'enorme'}
DEFENDERSE = 5          # «defenderse» suma a la Defensa hasta su siguiente turno (no se usa en la tabla)
PROB_LESION_CRITICO = 0.5
PROB_LESION_TRAMO = {'GRAVE': 0.15, 'CONVALECIENTE': 0.35}
LESIONES = ['brazo', 'corte', 'pierna', 'costillas']
SANGRADO_POR_RONDA = 1
PROB_MUERTE_FONDO = 0.03  # combateDeFondo.ts


# Cifras que se ajustan con --cifra clave=valor (p. ej. --cifra aguante_div=4).
CIFRAS = {
    'dano_div': 3,        # bono de daño = atributo // dano_div
    'pv_base': 10,        # PV humanoide = pv_base + Con + (nivel-1) * (pv_nivel + Con // 4)
    'pv_nivel': 4,
    'aguante_div': 4,     # aguante = Con // aguante_div (0 = sin aguante)
    'muerte_exceso': 50,  # a 0 PV solo muere si el daño sobrante >= este % de PV máx (5e, daño masivo);
                          # si no, cae a 1 PV (CONVALECIENTE). 0 = muere siempre al llegar a 0.
}


def bono_dano(atributo: int) -> int:
    return atributo // CIFRAS['dano_div']


def pv_humanoide(con: int, nivel: int) -> int:
    return CIFRAS['pv_base'] + con + (nivel - 1) * (CIFRAS['pv_nivel'] + con // 4)


def pv_fauna(con: int, nivel: int, tamano: str) -> int:
    return con + nivel * DG_TAMANO[tamano]


def aguante_max(con: int) -> int:
    return con // CIFRAS['aguante_div'] if CIFRAS['aguante_div'] else 0


# ---------------------------------------------------------------- catálogo
def _bloque_atributos(texto: str) -> dict[str, int]:
    return {k: int(v) for k, v in re.findall(r'(\w+): (\d+)', texto)}


def leer_catalogo(ruta: str = CATALOGO) -> dict:
    s = open(ruta, encoding='utf-8').read()
    fauna_txt = s[s.index('export const fauna: NpcInput[]'):s.index('export const npcs: NpcInput[]')]
    npcs_txt = s[s.index('export const npcs: NpcInput[]'):s.index('export interface NpcProfessionPotentialInput')]
    items_txt = s[s.index('export const items: ItemCatalogInput[]'):s.index('export interface FactionInput')]
    fauna = {}
    for m in re.finditer(r"slug: '([^']+)',.*?level: (\d+),.*?attributes: \{([^}]*)\}", fauna_txt, re.S):
        fauna[m.group(1)] = {'nivel': int(m.group(2)), 'attrs': _bloque_atributos(m.group(3))}
    armas = {}
    for blk in re.split(r'\n  \{\n', items_txt):
        slug = re.search(r"slug: '([^']+)'", blk)
        sb = re.search(r'statBonuses: \{([^}]*)\}', blk)
        if slug:
            tipo = re.search(r"tipoArma: '(\w+)'", blk)
            armas[slug.group(1)] = {'tipo': tipo.group(1) if tipo else None, 'bonos': _bloque_atributos(sb.group(1)) if sb else {}}
    orcos = []
    for blk in re.split(r'\n  \{\n', npcs_txt):
        if "raza: 'orcos'" in blk:
            a = re.search(r'attributes: \{([^}]*)\}', blk)
            if a:
                orcos.append(_bloque_atributos(a.group(1)))
    media_orco = {k: round(sum(o.get(k, 0) for o in orcos) / len(orcos)) for k in orcos[0]}
    return {'fauna': fauna, 'armas': armas, 'media_orco': media_orco}


def subir_nivel(attrs: dict[str, int], nivel: int) -> dict[str, int]:
    """Aproxima npcAttributesForLevel: +2 al atributo más alto por cada ASI (4, 8, 12...)."""
    a = dict(attrs)
    for asi in (4, 8, 12, 16, 19):
        if nivel >= asi:
            top = max(('fuerza', 'destreza', 'constitucion'), key=lambda k: a[k])
            a[top] = min(18, a[top] + 2) if a[top] < 18 else a[top]
    return a


# ---------------------------------------------------------------- combatientes
@dataclass
class Luchador:
    nombre: str
    bando: str
    attrs: dict
    atk_attr: str
    def_attr_viejo: str
    dado: tuple
    armadura: int = 0
    jugadora: bool = False
    pv_max: int = 0
    pv: int = 0
    aguante: int = 0
    aguante_max: int = 0
    escalon: str = 'ILESO'
    lesiones: list = field(default_factory=list)
    escalon_inicio_ronda: str = 'ILESO'

    def estado(self, nuevo: bool) -> str:
        if not nuevo:
            return self.escalon
        if self.pv <= 0:
            return 'MUERTO'
        pct = 100 * self.pv / self.pv_max
        if pct > 75:
            return 'ILESO'
        if pct > 50:
            return 'HERIDO'
        if pct > 25:
            return 'GRAVE'
        return 'CONVALECIENTE'

    def en_pie(self, nuevo: bool) -> bool:
        return self.estado(nuevo) not in ('CONVALECIENTE', 'MUERTO')


def humanoide(nombre, bando, attrs, nivel, arma_slug, catalogo, armadura=0, jugadora=False, atk=None):
    arma = catalogo['armas'][arma_slug]
    a = dict(subir_nivel(attrs, nivel))
    for k, v in arma['bonos'].items():  # equipment.ts#effectiveAttributes
        a[k] = a.get(k, 0) + v
    tipo = arma['tipo']
    atk = atk or ('destreza' if tipo in ('DAGA', 'CUCHILLO') else 'fuerza' if tipo == 'HACHA_1_MANO' else max(('fuerza', 'destreza'), key=lambda k: a[k]))
    l = Luchador(nombre, bando, a, atk, max(('destreza', 'constitucion'), key=lambda k: a[k]), DADO_ARMA[tipo], armadura, jugadora)
    l.pv_max = pv_humanoide(a['constitucion'], nivel)
    l.aguante_max = aguante_max(a['constitucion'])
    return l


def bestia(slug, bando, catalogo):
    f = catalogo['fauna'][slug]
    a = subir_nivel(f['attrs'], f['nivel'])
    tam = TAMANO[slug]
    l = Luchador(slug, bando, a, max(('fuerza', 'destreza'), key=lambda k: a[k]),
                 max(('destreza', 'constitucion'), key=lambda k: a[k]), DADO_TAMANO[tam])
    l.pv_max = pv_fauna(a['constitucion'], f['nivel'], tam)
    l.aguante_max = aguante_max(a['constitucion'])
    return l


def reiniciar(l: Luchador):
    l.pv, l.aguante, l.escalon, l.lesiones = l.pv_max, l.aguante_max, 'ILESO', []


# ---------------------------------------------------------------- reglas
def d(rng, n, caras):
    return sum(rng.randint(1, caras) for _ in range(n))


def malus(l, nuevo):
    return MALUS[l.estado(nuevo)]


def iniciativa(l, rng, nuevo):
    return rng.randint(1, 20) + max(1, l.attrs['destreza'] - malus(l, nuevo)) // 2


def golpe_viejo(at: Luchador, de: Luchador, rng):
    """combatExchange.ts#resolveExchange + combateMultiple.ts: un golpe = un escalón."""
    ta = rng.randint(1, 20) + max(1, at.attrs[at.atk_attr] - malus(at, False)) // 2
    td = rng.randint(1, 20) + max(1, de.attrs[de.def_attr_viejo] - malus(de, False)) // 2 + de.armadura
    m = ta - td
    if m > 0:
        de.escalon = ORDEN[min(ORDEN.index(de.escalon) + 1, 4)]
        return 'pleno' if m >= MARGEN_DECISIVO else 'normal'
    if m <= -MARGEN_DECISIVO:
        at.escalon = ORDEN[min(ORDEN.index(at.escalon) + 1, 4)]
        return 'contra'
    return 'parada'


def defensa(l: Luchador) -> int:
    return 10 + max(1, l.attrs['destreza'] - malus(l, True)) // 2 + l.armadura


def danar(l: Luchador, dano: int, critico: bool, rng):
    antes = l.estado(True)
    absorbe = min(l.aguante, dano)
    l.aguante -= absorbe
    resto = l.pv - (dano - absorbe)
    l.pv = max(0, resto)
    if l.pv <= 0 and CIFRAS['muerte_exceso'] and -resto < l.pv_max * CIFRAS['muerte_exceso'] / 100:
        l.pv = 1  # cae, no muere: el golpe de gracia o el 3 % del combate de fondo lo rematan
    if l.jugadora and l.escalon_inicio_ronda == 'ILESO' and l.pv <= 0:
        l.pv = 1  # tope de ronda (combateMultipleOrquestacion.ts#topeDeRondaJugadora)
    despues = l.estado(True)
    prob = PROB_LESION_CRITICO if critico else 0.0
    if despues != antes and despues in PROB_LESION_TRAMO:
        prob = max(prob, PROB_LESION_TRAMO[despues])
    if dano > absorbe and rng.random() < prob:
        l.lesiones.append(rng.choice(LESIONES))


def tirar_dano(at: Luchador, rng, critico: bool) -> int:
    n, caras = at.dado
    fu = at.attrs['fuerza'] - (2 if 'brazo' in at.lesiones else 0)
    base = at.attrs[at.atk_attr] if at.atk_attr == 'destreza' and at.dado[1] <= 4 else fu
    return max(1, d(rng, n * (2 if critico else 1), caras) + bono_dano(base))


def golpe_nuevo(at: Luchador, de: Luchador, rng):
    nat = rng.randint(1, 20)
    total = nat + max(1, at.attrs[at.atk_attr] - malus(at, True)) // 2
    m = total - defensa(de)
    if nat == 20 or m >= MARGEN_DECISIVO:
        danar(de, tirar_dano(at, rng, True), True, rng)
        return 'pleno'
    if nat == 1 or m <= -MARGEN_DECISIVO:  # el 1 natural siempre falla y da contragolpe (5e)
        danar(at, tirar_dano(de, rng, False), False, rng)
        return 'contra'
    if m >= 0:
        danar(de, tirar_dano(at, rng, False), False, rng)
        return 'normal'
    return 'parada'


def combate(a: list, b: list, rng, nuevo: bool, tope=60):
    todos = a + b
    for l in todos:
        reiniciar(l)
    for ronda in range(1, tope + 1):
        for l in todos:
            l.escalon_inicio_ronda = l.estado(nuevo)
        orden = sorted((l for l in todos if l.en_pie(nuevo)), key=lambda l: -iniciativa(l, rng, nuevo))
        for yo in orden:
            if not yo.en_pie(nuevo):
                continue
            rivales = [r for r in (b if yo in a else a) if r.en_pie(nuevo)]
            if not rivales:
                break
            # elegirObjetivo con poca Inteligencia: al azar entre los que siguen en pie.
            obj = rng.choice(rivales)
            (golpe_nuevo if nuevo else golpe_viejo)(yo, obj, rng)
        if nuevo:
            for l in todos:
                if 'corte' in l.lesiones and l.en_pie(True):
                    l.pv = max(1, l.pv - SANGRADO_POR_RONDA)
        if not any(l.en_pie(nuevo) for l in a) or not any(l.en_pie(nuevo) for l in b):
            return ronda, any(l.en_pie(nuevo) for l in a)
    return tope, None


# ---------------------------------------------------------------- escenarios
JUGADORA = {'fuerza': 11, 'destreza': 11, 'constitucion': 10, 'inteligencia': 8, 'voluntad': 8, 'carisma': 8, 'magia': 8}
ARMAS = {'daga': 'daga-aleacion-goirntes', 'espada': 'espada-corta-goirntes', 'hacha': 'hacha-guerra-orca'}
FAUNA_NIVEL = [('débil', 'zense-ceniza'), ('media', 'guchapo'), ('fuerte', 'rondador-de-brasas'), ('muy fuerte', 'gargantua-de-ceniza')]
ARMADURA_COTA = 2  # cota-ligera-goirntes, statBonuses.defensa


def resumen(rondas, gana, n):
    return sum(rondas) / n, 100 * sum(1 for g in gana if g) / n


def escenario_armas(cat, rng, n):
    filas = []
    rival_attrs = {k: 10 for k in JUGADORA}
    for arma, slug in ARMAS.items():
        for arm in (0, ARMADURA_COTA):
            fila = [arma, 'cota' if arm else 'sin']
            for nuevo in (False, True):
                rondas, gana = [], []
                for _ in range(n):
                    j = humanoide('jugadora', 'A', JUGADORA, 1, slug, cat, armadura=arm, jugadora=True)
                    r = humanoide('rival', 'B', rival_attrs, 1, 'espada-corta-goirntes', cat)
                    k, g = combate([j], [r], rng, nuevo)
                    rondas.append(k)
                    gana.append(g)
                fila += list(resumen(rondas, gana, n))
            filas.append(fila)
    return filas


def escenario_fauna(cat, rng, n):
    filas = []
    for etiqueta, slug in FAUNA_NIVEL:
        fila = [etiqueta, slug]
        for nuevo in (False, True):
            rondas, gana, lesion, pv_fin = [], [], 0, []
            for _ in range(n):
                j = humanoide('jugadora', 'A', JUGADORA, 1, ARMAS['espada'], cat, jugadora=True)
                bst = bestia(slug, 'B', cat)
                k, g = combate([j], [bst], rng, nuevo)
                rondas.append(k)
                gana.append(g)
                lesion += 1 if j.lesiones else 0
                pv_fin.append(100 * j.pv / j.pv_max if nuevo else 100 - 25 * ORDEN.index(j.escalon))
            fila += [sum(rondas) / n, 100 * sum(1 for x in gana if x) / n, sum(pv_fin) / n]
            if nuevo:
                fila.append(100 * lesion / n)
        b = bestia(slug, 'B', cat)
        fila.append(f'{b.pv_max}+{b.aguante_max}')
        filas.append(fila)
    return filas


def escenario_caza(cat, rng, n, presa='cornante'):
    filas = []
    for nuevo in (False, True):
        rondas, gana = [], []
        ilesos = heridos = caidos = muertos = lesionados = 0
        for _ in range(n):
            cazadores = [humanoide(f'cazador{i}', 'A', cat['media_orco'], 3, 'lanza-corta-caza', cat) for i in range(3)]
            bst = bestia(presa, 'B', cat)
            k, g = combate(cazadores, [bst], rng, nuevo)
            rondas.append(k)
            gana.append(g)
            for c in cazadores:
                e = c.estado(nuevo)
                if e == 'ILESO':
                    ilesos += 1
                elif e in ('HERIDO', 'GRAVE'):
                    heridos += 1
                else:
                    if rng.random() < PROB_MUERTE_FONDO or e == 'MUERTO':
                        muertos += 1
                    else:
                        caidos += 1
                if c.lesiones:
                    lesionados += 1
        tot = 3 * n
        filas.append(['nuevo' if nuevo else 'hoy', sum(rondas) / n, 100 * sum(1 for g in gana if g) / n,
                      100 * ilesos / tot, 100 * heridos / tot, 100 * caidos / tot, 100 * muertos / tot,
                      100 * lesionados / tot if nuevo else None])
    return filas


def tabla(cabecera, filas):
    def fmt(x):
        if x is None:
            return '—'
        return f'{x:.1f}' if isinstance(x, float) else str(x)
    out = ['| ' + ' | '.join(cabecera) + ' |', '|' + '---|' * len(cabecera)]
    out += ['| ' + ' | '.join(fmt(x) for x in f) + ' |' for f in filas]
    return '\n'.join(out)


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument('-n', type=int, default=1000, help='combates por fila (1.000 por defecto)')
    p.add_argument('--semilla', type=int, default=21)
    p.add_argument('--presa', default='cornante', help='bestia de la partida de caza')
    p.add_argument('--cifra', action='append', default=[], metavar='CLAVE=VALOR', help=f'cambia una cifra: {", ".join(CIFRAS)}')
    args = p.parse_args(argv)
    for c in args.cifra:
        k, v = c.split('=')
        CIFRAS[k] = int(v)
    cat = leer_catalogo()
    rng = random.Random(args.semilla)
    print(f'Semilla {args.semilla}, {args.n} combates por fila, cifras {CIFRAS}. Orco medio del catálogo: {cat["media_orco"]}\n')
    print('### Duelo a nivel 1 contra un rival de 10 en todo con espada corta (victorias de la jugadora)\n')
    print(tabla(['arma', 'armadura', 'rondas hoy', '% gana hoy', 'rondas nuevo', '% gana nuevo'], escenario_armas(cat, rng, args.n)))
    print('\n### Jugadora de nivel 1 (espada corta, sin armadura) contra fauna\n')
    print(tabla(['fauna', 'ficha', 'rondas hoy', '% gana hoy', '% salud final hoy', 'rondas nuevo', '% gana nuevo', '% PV final nuevo', '% con lesión', 'PV+aguante bestia'], escenario_fauna(cat, rng, args.n)))
    print(f'\n### 3 cazadores orcos (nivel 3, lanza corta de caza) contra un {args.presa}, combate de fondo sin moral\n')
    print(tabla(['sistema', 'rondas', '% cazan', '% ilesos', '% heridos/graves', '% caídos (convalecientes)', '% muertos', '% con lesión'], escenario_caza(cat, rng, args.n, args.presa)))


if __name__ == '__main__':
    main()
