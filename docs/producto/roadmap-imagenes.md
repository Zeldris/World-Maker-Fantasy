# Roadmap del generador de imágenes — Tarkor

**Creado:** 2026-10-24 (usuaria). **Qué cubre:** el generador local de imágenes (`image-generator/`: `sd-cli` con
FLUX.2 klein en la Deck, su interfaz `abrir.sh` y los prompts que le llegan del juego). Lo ya hecho del generador
vive en `roadmap-front.md` (`CFG-38`…`CFG-43`); lo nuevo, aquí.
**Orden y hito:** los fija el [mapa de roadmaps](21-roadmap.md#mapa-de-roadmaps).

**Cómo se usa** (mismo convenio que [roadmap-front.md](roadmap-front.md)): al cerrar un punto se tacha con su
commit; **[A]** pedido por Álvaro, **[P]** propuesta de Claude; esfuerzo **S** (horas) · **M** (1-2 días) ·
**L** (varios días).

## Fase I-A · Escenas compuestas con elementos ya generados

Una imagen compuesta (un mapa, una llanura, una escena) nombra otros elementos del catálogo: «una llanura donde se
ven múrgoles y cuernahojas». Hoy el prompt los describe con palabras y el modelo los inventa de nuevo, distintos de
sus propias imágenes. Las imágenes por elemento ya viven en `image-generator/generated/<categoria>/<slug>/` y la
elegida en `generated/<categoria>/<slug>/<slug>-<perfil>.png` (`CFG-43`).

- **IMG-1 · El prompt de una escena enlaza las imágenes de sus elementos** [A] (usuaria, 2026-10-24): al preparar
  el prompt de una imagen compuesta, se detectan los elementos del catálogo que nombra (por slug o nombre de la
  enciclopedia) y se pasan sus imágenes elegidas como referencias (`-r` de `sd-cli`, varias a la vez), con el texto
  que dice qué es cada una. Antes, medir en la Deck cuántas referencias aguanta klein 4B con `--max-vram 2` y cuánto
  sube el tiempo (con una, ~200 s frente a ~105 s sin ella; ver `.claude/gw/opt-ai.md`). **M**
- **IMG-2 · Sin las imágenes de sus elementos, no se genera la escena** [A] (usuaria, 2026-10-24): si falta la
  imagen elegida de algún elemento que nombra la escena, la interfaz no deja generarla y lista los que faltan, con
  un enlace para generar cada uno primero. Depende de `IMG-1`. **S**
- **IMG-3 · Medir el generador con `/opt-ai`** [P] (usuaria, 2026-10-24): un script que resume
  `generated/*/*/registro.tsv` y los logs (segundos, perfil, pasos, con o sin referencia, memoria libre mínima) para
  que `/opt-ai` compare y proponga ajustes con números, sin leer los logs enteros. **S**

## Fase I-B · Datos visuales, panel de lore y generador moderno

Pedido por la usuaria el 2026-10-25, con su [plan](plan-imagenes/plan.md) (decisiones D1-D10 tomadas ese día). Las
imágenes tienen que salir con el toque del mundo **sin imagen de referencia**: lo dan los datos visuales de cada
elemento y un prompt montado desde ellos. `seed-catalog` y `reindex-lore` borran y reinsertan: nada que se edite
desde el panel vive en tablas que siembran.

- **IMG-4 · Guía visual del mundo y plantilla de prompt** [A] (usuaria, 2026-10-25): desde
  `plan-imagenes/borradores/`, con lo marcado «[propuesta]» pendiente de la usuaria. Fase 1 del plan. **S**
- **IMG-5 · Script que monta el prompt desde la ficha** [A] (usuaria, 2026-10-25): determinista, sin LLM, con tests;
  rechaza las palabras que el modelo malinterpreta («moon», «crystal dust across the heavens», «scars»…). Depende de
  `IMG-4`. **M**
- **IMG-6 · Las 5 fichas piloto con semilla fija** [A] (usuaria, 2026-10-25): aullador macho y hembra, Cardo Brújula,
  Pastos de la Deriva y Hulki, sin `-r`; el aullador además en segunda pasada sobre su zona (`-r` de la zona). Las
  aprueba la usuaria. Depende de `IMG-5`. **S**
- **IMG-7 · Modelo de datos: `Propuesta` y `FichaVisual`** [A] (usuaria, 2026-10-25): migración Prisma (puerta de un
  solo sentido), importador de los 3 `.md` de propuestas (~159), exportación de lo aprobado al formato de
  `propuestas-aprobadas.md`, fichas exportadas a JSON versionado, API Fastify con escritura solo desde `127.0.0.1` y
  token en `.env` (D1, D3, D4). Fase 2. **L**
- **IMG-8 · Panel admin de lore tipo CRM** [A] (usuaria, 2026-10-25): pestañas Propuestas y Fichas del
  [prototipo](plan-imagenes/prototipo/index.html) en el admin React: ver, filtrar, diff, editar y aprobar o rechazar
  en bloque las propuestas (de Claude y de OpenCode) y ver el lore ya volcado en la BD; un cambio a lore sembrado
  entra como propuesta, no se escribe en su tabla. Atajos de teclado. Depende de `IMG-7`. Fase 3. **L**
- **IMG-9 · Fichas visuales en bloque** [A] (usuaria, 2026-10-25): un LLM rellena borradores de ficha desde el canon
  (53 de fauna primero) como propuestas en la bandeja; el script de `IMG-5` lee `FichaVisual` en vez de `bio`.
  Depende de `IMG-8`. Fase 4. **L**
- **IMG-10 · Estados por intento y papelera** [A] (usuaria, 2026-10-25): favorita, candidata, descartada (y
  aprobada, que hereda de `elegidas.tsv`) en `estados.json` por elemento; las descartadas se pueden borrar
  (papelera como carpeta). D7. Fase 5. **M**
- **IMG-11 · Cola con tiempo estimado, lotes y ajustes reutilizables** [A] (usuaria, 2026-10-25): cola con ETA,
  lotes de semillas, reutilizar los ajustes de una imagen, plantillas de ajustes y comparar imágenes. Fase 5. **M**
- **IMG-12 · Zona aprobada como fondo de lo nativo** [A] (usuaria, 2026-10-25): primero se generan las zonas; la
  fauna, flora y demás elementos nativos de una zona sin imagen aprobada quedan bloqueados, y con zona aprobada se
  genera en segunda pasada con la zona como `-r` (una por pasada en la Deck, D10). Generaliza `IMG-1` e `IMG-2`.
  Fase 5. **M**
- **IMG-13 · Interfaz del generador en el admin** [A] (usuaria, 2026-10-25): pestaña Generador del prototipo en el
  admin React (`servidor.py` pasa a API, D6), con ideas de Leonardo y similares: galería, vista ampliada, revisión
  rápida con teclado y filtros. Hecho cuando se revisan 20 intentos solo con teclado. Fase 6. **L**
