"""IMG-41 (diseño §3.3): el adaptador de Tarkor del generador, lo único de `interfaz/` que sabe del juego.

Qué elementos hay (la enciclopedia del backend, `GET /world/<mundo>/enciclopedia`, y las clases y especializaciones de
`schema.prisma`), sus prompts (tabla `ImagePrompt`, por psql) y el entorno que pide `probar.sh` del mundo. Se configura
al crearlo (no al importarlo): `servidor.py` lo crea con sus variables de entorno. Otro producto pone otro adaptador
con las mismas funciones: `elementos()`, `prompt(tipo, slug, perfil)`, `entorno()` y `mundo`.
"""
import json, re, subprocess, unicodedata, urllib.request

from nucleo import SLUG, slug

# Sección de /world/<mundo>/enciclopedia → (carpeta de imágenes, campo del slug); fauna y flora según `esFauna`.
SECCIONES = {'npcs': ('npc', 'slug'), 'items': ('item', 'slug'), 'faunaFlora': (None, 'sourceSlug'),
             'locations': ('location', 'slug'), 'razas': ('raza', 'slug'), 'personajes': ('personaje', 'slug'),
             'constructionRecipes': ('construccion', 'key'), 'craftingRecipes': ('crafteo', 'key'),
             'factions': ('faction', 'slug'), 'historia': ('historia', 'slug')}


def slugify(nombre):
    """El `slugify` del backend (backend/src/lib/slugify.ts), que da el slug de cada habilidad."""
    s_ = ''.join(c for c in unicodedata.normalize('NFD', nombre) if not unicodedata.combining(c)).lower()
    return re.sub(r'[^a-z0-9]+', '-', s_).strip('-')


class Tarkor:
    def __init__(self, psql, mundo, api, esquema):
        """`psql`: la orden (lista) a la que se añade el SQL; `api`: el backend del juego ('' = sin catálogo);
        `esquema`: la ruta de schema.prisma."""
        self.psql, self.mundo, self.api, self.esquema = psql, mundo, api, esquema

    def entorno(self):
        """Lo que añade al entorno de `probar.sh`: el mundo, y liberar Ollama antes de generar (la Deck)."""
        return {'LIBERAR_OLLAMA': '1', 'MUNDO': self.mundo}

    # --- base de datos (ImagePrompt) ---

    def _consulta(self, sql):
        r = subprocess.run(self.psql + [sql], capture_output=True, text=True, timeout=20)
        if r.returncode != 0:
            raise RuntimeError(f'la base no responde ({r.stderr.strip()[:200]}); ¿está arrancado tarkor-postgres?')
        return json.loads(r.stdout.strip() or 'null')

    def _mundo_sql(self):
        return f"(select id from \"World\" where slug='{slug(self.mundo, 'mundo')}')"

    def entidades(self):
        """[{tipo, slug, perfil, usado}] de ImagePrompt del mundo."""
        sql = ("select coalesce(json_agg(json_build_object('tipo',\"entityType\",'slug',\"entitySlug\",'perfil',\"sizeProfile\","
               "'usado',\"promptUsado\" is not null) order by \"entityType\",\"entitySlug\",\"sizeProfile\"),'[]') "
               f"from \"ImagePrompt\" where \"worldId\"={self._mundo_sql()}")
        # Una fila con un tipo o slug que no son rutas válidas (una tilde, un «:») no tumba la lista: se salta.
        return [e for e in self._consulta(sql) or [] if SLUG.match(str(e.get('tipo'))) and SLUG.match(str(e.get('slug')))]

    def prompt(self, tipo, slug_, perfil):
        """{prompt, fuente: usado|base} de ImagePrompt, o None. El perfil ya viene validado."""
        donde = (f"\"worldId\"={self._mundo_sql()} and \"entityType\"='{slug(tipo, 'tipo')}' and "
                 f"\"entitySlug\"='{slug(slug_, 'slug')}' and \"sizeProfile\"='{perfil}'")
        fila = self._consulta(f"select json_build_object('usado',\"promptUsado\",'base',prompt) from \"ImagePrompt\" "
                              f"where {donde}")
        if not fila:
            return None
        return {'prompt': fila['usado'] or fila['base'], 'fuente': 'usado' if fila['usado'] else 'base'}

    # --- catálogo (backend del juego y schema.prisma) ---

    def enum_prisma(self, nombre):
        """Valores del enum `nombre` de schema.prisma: las clases y especializaciones usan el valor como slug."""
        try:
            with open(self.esquema, encoding='utf-8') as f:
                m = re.search(rf'^enum {nombre} \{{(.*?)^\}}', f.read(), re.S | re.M)
        except OSError:
            return []
        return re.findall(r'^\s*([A-Z][A-Z0-9_]*)\s*$', m.group(1), re.M) if m else []

    def catalogo(self):
        """[(tipo, slug, nombre)] de toda la enciclopedia, del backend del juego (si no corre, error), con lo anidado
        (variantes por sexo, de raza y de tiempo; el mapa de zona de cada lugar; las habilidades) y las clases y
        especializaciones de schema.prisma."""
        with urllib.request.urlopen(f'{self.api}/world/{slug(self.mundo, "mundo")}/enciclopedia', timeout=10) as r:
            datos = json.load(r)
        out = []

        def sumar(tipo, s_, nombre):
            if s_ and SLUG.match(s_):
                out.append((tipo, s_, nombre))

        def con_sexos(tipo, e, s_, nombre):
            if not s_:
                return
            sumar(tipo, s_, nombre)
            for v in e.get('variantesSexo') or []:
                if v.get('sexo'):
                    sumar(tipo, f"{s_}-{v['sexo']}", f"{nombre} ({v['sexo']})")

        for seccion, (tipo, campo) in SECCIONES.items():
            for e in datos.get(seccion) or []:
                t = tipo or ('fauna' if e.get('esFauna') else 'flora')
                s_, nombre = e.get(campo), e.get('name') or e.get('sourceName') or e.get('title') or ''
                con_sexos(t, e, s_, nombre)
                for v in e.get('variantes') or []:  # variantes regionales de raza
                    con_sexos(t, v, v.get('slug'), v.get('name') or '')
                if seccion == 'locations' and s_:
                    sumar('zona', s_, f'{nombre} (mapa)')
                    for v in e.get('variantesTiempo') or []:
                        if not (v.get('momento') and v.get('estacion')):
                            continue
                        momento = f"{v.get('momento')}-{v.get('estacion')}"
                        sumar('location', f'{s_}-{momento}', f'{nombre} ({momento})')
                        sumar('zona', f'{s_}-{momento}', f'{nombre} (mapa, {momento})')

        def habilidades(o):  # unlocks de clases y de fauna, estén donde estén
            if isinstance(o, dict):
                h = o.get('ability')
                if isinstance(h, dict) and h.get('name'):
                    sumar('ability', slugify(h['name']), h['name'])
                for v in o.values():
                    habilidades(v)
            elif isinstance(o, list):
                for v in o:
                    habilidades(v)
        habilidades(datos)
        for tipo, enum in (('clase', 'Clase'), ('especializacion', 'Especializacion')):
            for valor in self.enum_prisma(enum):
                sumar(tipo, valor, valor.replace('_', ' ').capitalize())
        return out

    def elementos(self):
        """({(tipo, slug): {tipo, slug, nombre?, perfiles: [{perfil, usado}]}}, [avisos]): el catálogo y los prompts.
        Lo que no responde (el backend, la base) sale como aviso y no tumba la lista."""
        avisos, claves = [], {}
        if self.api:
            try:
                for t, s_, nombre in self.catalogo():
                    claves.setdefault((t, s_), {'tipo': t, 'slug': s_, 'perfiles': []})['nombre'] = nombre
            except (OSError, ValueError) as err:
                avisos.append(f'Sin el catálogo completo (arranca el juego para verlo entero): {err}')
        try:
            for e in self.entidades() or []:
                el = claves.setdefault((e['tipo'], e['slug']), {'tipo': e['tipo'], 'slug': e['slug'], 'perfiles': []})
                el['perfiles'].append({'perfil': e['perfil'], 'usado': bool(e['usado'])})
        except (RuntimeError, ValueError, subprocess.TimeoutExpired, OSError) as err:
            avisos.append(f'Sin los prompts de la enciclopedia: {err}')
        return claves, avisos
