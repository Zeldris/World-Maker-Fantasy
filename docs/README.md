# Documentación de Tarkor

Mapa de toda la documentación del proyecto. Cada carpeta tiene un propósito y un tipo de lector;
si no sabes dónde buscar, empieza por la tabla de "Qué quiero hacer".

## Qué quiero hacer

| Quiero… | Empieza por |
|---|---|
| Saber qué se va a hacer y en qué orden | [producto/21-roadmap.md](producto/21-roadmap.md) |
| Mejoras de diseño, animación y configuración del front | [producto/roadmap-front.md](producto/roadmap-front.md) |
| Mejoras del panel de Reino (información y gestión) | [producto/roadmap-front-reino.md](producto/roadmap-front-reino.md) |
| Entender la arquitectura técnica | [arquitectura/03-arquitectura.md](arquitectura/03-arquitectura.md) y [04-decisiones-tecnicas.md](arquitectura/04-decisiones-tecnicas.md) |
| Saber cómo funciona el mundo vivo (Reino, facciones, mercado, producción) | [arquitectura/22-mundo-vivo-x4-tecnico.md](arquitectura/22-mundo-vivo-x4-tecnico.md) |
| Instalar el proyecto | [arquitectura/15-instalacion.md](arquitectura/15-instalacion.md) |
| Consultar una regla de juego (tiradas, combate, XP, construcción) | [mecanicas/](#mecanicas--reglas-del-juego) |
| Consultar el lore (regiones, razas, historia, fauna) | [rpgtarkor/lore-mundo/07-mundo-helek-sirik.md](rpgtarkor/lore-mundo/07-mundo-helek-sirik.md) |
| Añadir un elemento al catálogo (NPC, objeto, fauna…) | [runbooks/nuevo-elemento-catalogo.md](runbooks/nuevo-elemento-catalogo.md) y [puntos-de-codigo-nuevo-contenido.md](runbooks/puntos-de-codigo-nuevo-contenido.md) |
| Ampliar lore con OpenCode | [runbooks/ampliar-lore.md](runbooks/ampliar-lore.md) y [borradores-opencode/prompts/00-como-usar.md](borradores-opencode/prompts/00-como-usar.md) |
| Revisar una partida real buscando fallos | [runbooks/revisar-partida.md](runbooks/revisar-partida.md) |
| Ver hallazgos abiertos | [registros/](#registros--hallazgos-y-checklists-vivos) |

## Carpetas

### `producto/` — qué es Tarkor y hacia dónde va
- [01-analisis-producto.md](producto/01-analisis-producto.md): análisis de partida del producto.
- [02-decisiones.md](producto/02-decisiones.md): decisiones de producto razonadas.
- [21-roadmap.md](producto/21-roadmap.md): **roadmap activo** a un año.
- [roadmap-front.md](producto/roadmap-front.md): roadmap de front (menú de configuración, animaciones, atmósfera, sonido).
- [roadmap-front-reino.md](producto/roadmap-front-reino.md): roadmap de front del panel de Reino.

### `arquitectura/` — cómo está construido
- [03-arquitectura.md](arquitectura/03-arquitectura.md): piezas, flujo de un turno, reloj de mundo.
- [04-decisiones-tecnicas.md](arquitectura/04-decisiones-tecnicas.md): modelos locales, benchmarks, ritmo.
- [15-instalacion.md](arquitectura/15-instalacion.md): instalación local (Postgres en podman, Ollama).
- [20-instalador-distribuible.md](arquitectura/20-instalador-distribuible.md): investigación del instalador.
- [22-mundo-vivo-x4-tecnico.md](arquitectura/22-mundo-vivo-x4-tecnico.md): **referencia técnica del
  mundo vivo**, verificada contra el código, con huecos y preguntas abiertas.

### `mecanicas/` — reglas del juego
Diseño de cada sistema. Cuando un documento dice "diseño", el estado actual puede haber cambiado:
el código manda.

| Doc | Sistema |
|---|---|
| [05](mecanicas/05-mecanicas-juego.md) / [06](mecanicas/06-decisiones-mecanicas.md) | Tiradas, clasificación de acciones, flujo del turno |
| [08](mecanicas/08-acciones-por-tiempo.md) | Acciones por tiempo (instantáneas, largas, tránsitos) |
| [09](mecanicas/09-panel-personaje.md) | Panel de personaje |
| [10](mecanicas/10-niveles-xp-reino.md) | Niveles, XP y Reino |
| [12](mecanicas/12-mundo-estructurado.md) | Posición, NPC, recursos y armería |
| [13](mecanicas/13-escala-del-mundo.md) | Escala real del mundo |
| [14](mecanicas/14-combate-y-muerte.md) | Combate, muerte y descanso |
| [16](mecanicas/16-poblacion-dinamica.md) | Población dinámica y encuentros |
| [17](mecanicas/17-reglas-construcciones-reino.md) | Construcciones y fundación de reino |
| [18](mecanicas/18-validacion-accion-jugador.md) | Validación de la acción del jugador |
| [19](mecanicas/19-post-combate-y-recompensas-mision.md) | Post-combate y recompensas de misión |
| [20](mecanicas/20-zona-cuadricula-interactuar.md) | **Zona: cuadrícula, colisión, Interactuar, caza y saqueo desde el mapa** |

### `rpgtarkor/` — el mundo de Helek Sirik (fuente de verdad del lore)
- [lore-mundo/](rpgtarkor/lore-mundo/07-mundo-helek-sirik.md): índice del mundo, génesis, historia,
  cronologías, razas, lenguas, clanes orcos, clima, estaciones y
  [regiones/](rpgtarkor/lore-mundo/regiones/llanuras-del-viento-rojo.md) (una ficha por región con
  su geografía, fauna, flora y asentamientos).
- [personajes/](rpgtarkor/personajes/personajes.md): personajes jugables y NPC del presente.
- [items-y-catalogo/](rpgtarkor/items-y-catalogo/items.md): objetos y prompts de imagen.
- [sistemas-combate/](rpgtarkor/sistemas-combate/clases.md): clases, combate múltiple, IA de combate.
- [sistemas-reino/](rpgtarkor/sistemas-reino/mundo-vivo-x4.md): diseño del mundo vivo (Reino,
  facciones, edificios de oficio, expediciones, compañeros).

### `canon-opencode/` — resumen del canon para el agente de lore
Versión compacta de `rpgtarkor/`, pensada para el contexto de 32k de OpenCode. Se sincroniza al
aprobar propuestas. Si choca con `rpgtarkor/`, manda `rpgtarkor/`. Ver su
[README](canon-opencode/README.md).

### `borradores-opencode/` — propuestas de lore
- [propuestas-lore.md](borradores-opencode/propuestas-lore.md): bandeja de entrada de OpenCode.
- [propuestas-aprobadas.md](borradores-opencode/propuestas-aprobadas.md): fichas aprobadas con su
  seguimiento de docs y código.
- [revision-lore.md](borradores-opencode/revision-lore.md): propuestas no aprobadas, para consulta.
- [prompts/](borradores-opencode/prompts/00-como-usar.md): chuletas de petición por tipo.

### `runbooks/` — procedimientos repetibles
[ampliar-lore](runbooks/ampliar-lore.md) · [nuevo-elemento-catalogo](runbooks/nuevo-elemento-catalogo.md) ·
[puntos-de-codigo-nuevo-contenido](runbooks/puntos-de-codigo-nuevo-contenido.md) ·
[revisar-partida](runbooks/revisar-partida.md)

### `registros/` — hallazgos y checklists vivos
Se escriben durante las sesiones y se van cerrando. No son documentación de referencia.
- [checklist-pruebas-juego.md](registros/checklist-pruebas-juego.md): pruebas de juego pendientes.
- [pruebas-nube-2026-09-28-hallazgos.md](registros/pruebas-nube-2026-09-28-hallazgos.md) y
  [plan-cierre-hallazgos-2026-09-28.md](registros/plan-cierre-hallazgos-2026-09-28.md): última
  tanda de pruebas (B1-B32) y su plan de cierre.
- [plan-mecanicas-por-zona-2026-09-28.md](registros/plan-mecanicas-por-zona-2026-09-28.md): paso de
  habilidades a mecánicas de zona.
- [revisar-partida-hallazgos.md](registros/revisar-partida-hallazgos.md),
  [sesion-jugadora-hallazgos.md](registros/sesion-jugadora-hallazgos.md),
  [deuda-tecnica-hallazgos.md](registros/deuda-tecnica-hallazgos.md),
  [lore-hallazgos.md](registros/lore-hallazgos.md),
  [ampliar-lore-checklist.md](registros/ampliar-lore-checklist.md).

### `archivo/` — historia
Roadmaps y registros antiguos, cerrados. Solo para arqueología. Incluye
`deuda-tecnica-hallazgos-historico.md` y `checklist-pruebas-juego-historico-2026-09-04.md` (entradas
cerradas movidas de `registros/` el 2026-09-29, sin editar).

### `ia/`
- [fine-tuning-ia-local.md](ia/fine-tuning-ia-local.md): guía para entrenar un narrador local propio.

## Convenciones

- **Idioma:** castellano de España.
- **El código manda.** Si un documento contradice el código, el documento está desactualizado.
- **Estado arriba.** Cada documento de diseño abre con una línea de estado (implementado, diseñado
  sin código, sin diseñar) y la fecha en que se comprobó.
- **Historial abajo.** Las notas "corregido el día X" van a una sección final de historial, no
  intercaladas en el texto.
- **Enlaces:** `node tools/lore-links/check.mjs docs` comprueba ficheros y anclas.
- **Secciones citadas por el código** (`mundo-vivo-x4.md § 7.4`, `areas.md § …`): no se renumeran.
