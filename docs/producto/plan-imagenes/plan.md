# Plan: datos visuales, panel de propuestas y generador de imágenes (Tarkor)

Preparado el 2026-10-25 desde la sesión de Galivelop-workflow, **solo leyendo** World-Maker-Fantasy (no se ha
tocado nada en ese repo). Todo lo de esta carpeta es material de trabajo para la sesión de Tarkor:

| Archivo | Qué es |
|---|---|
| `auditoria-datos.md` | Qué datos hay de cada elemento, dónde, cobertura y huecos; campos propuestos de ficha visual |
| `auditoria-lore-admin.md` | Flujo actual de propuestas (OpenCode), almacén del lore, admin existente, backend |
| `auditoria-generador.md` | Arquitectura del generador, roadmap IMG-*, puntos débiles, qué cambiar |
| `investigacion-interfaces.md` | Leonardo, Midjourney, InvokeAI, ComfyUI, Fooocus: qué copiar y por qué; FLUX.2 Klein y referencias |
| `borradores/` | Guía visual del mundo, 4 fichas piloto, plantilla de prompt y prompts piloto (**borradores sin aprobar**) |
| `spike/` | Pruebas reales con `sd-cli`: prompt nuevo, `-r`, toque fantástico y zona como fondo (`spike/informe.md`) |
| `prototipo/index.html` | Prototipo clicable del panel (Propuestas, Fichas, Generador), datos ficticios |

**Copiado al repo el 2026-10-25** (rama `claude/plan-imagenes`) desde `Desarrollos/plan-imagenes-tarkor/`. Las PNG
de `spike/intentos/` (`A`, `B`, `C`, `D`, `F`, `G`, `H.png`) no se suben: están en la Deck, en la ruta ignorada
`image-generator/pruebas/plan-imagenes-spike/`. Las rutas absolutas de `spike/run*.sh` son las de la carpeta original.

## 1. Lo que hemos visto

1. **El «sabor» de Tarkor no está en ningún dato.** Sale de las imágenes de referencia hechas fuera y de 5 párrafos
   de escena por región metidos en código (`REGION_ESCENA`). No hay guía visual del mundo.
2. **Un solo texto libre por elemento** (`bio`/`description` en `backend/src/scripts/worldCatalog.ts`) mezcla aspecto,
   conducta y lore. Sin campos de silueta, paleta, tamaño ni rasgo distintivo.
3. **La forma del animal la inventa un LLM**: el sistema que reescribe el prompt tiene la orden de «inventar símiles
   de la naturaleza». Por eso cada prompt sale distinto y a veces contra el canon.
4. **El prompt del aullador contradecía el canon**: pedía patas cortas y cuerpo de comadreja; el canon dice
   *flaco, patas desproporcionadamente largas*. Parte del fallo de la imagen era del prompt, no del modelo.
5. **La fuente de verdad real es `worldCatalog.ts`** (12.500 líneas a mano, sembrado con `seed-catalog`); los `.md` de
   `docs/rpgtarkor/` se copian a mano y ya derivan. `seed-catalog` y `reindex-lore` borran y reinsertan.
6. **Propuestas de lore: ~159 en 3 Markdown** (9 pendientes, 77 aprobadas, 73 en `revision-lore.md` que son
   rechazadas aunque digan «SIN REVISAR»). Se pueden importar con heurística.
7. **El admin ya existe** (React 19 + Vite + Tailwind 4, `/admin/enciclopedia`, `/admin/partida/:id/libro`,
   `/admin/ui`), solo lectura y **sin autenticación**; el backend (Fastify 5 + Prisma 6 + Postgres) tampoco tiene.
8. **El generador** es Python stdlib + una página vanilla; un solo estado por intento («elegida»), sin cola, sin
   papelera, sin comparar; «Elegir esta» sobrescribe. El roadmap solo tiene IMG-1..3 (escena que nombra elementos);
   **no hay ítems** de favoritos, candidatos, papelera ni rediseño: hay que crearlos.
9. **La relación fauna → zona sí existe** en datos, repartida en 5 diccionarios de `worldCatalog.ts` (hogar, región,
   terreno, `zonePoint`): 30 de 53 especies con región. Hay que unificarla en la ficha.
10. **FLUX.2 Klein** admite hasta 4 referencias según BFL, pero `stable-diffusion.cpp` solo documenta una `-r`; no lleva
    prompt upsampling (pide prompts largos y descriptivos) y con cfg 1.0 el prompt negativo no actúa.

### Pruebas con el generador (`spike/`, semilla 3, 6 pasos, banner)

| Prueba | Resultado |
|---|---|
| A. Prompt reescrito, sin `-r` (151 s) | Mucho mejor que el original: cresta de púas con punta encendida, colmillos de sable, cola negra. Cuerpo de cánido largo, no de hurón |
| B. A + `-r` con la imagen del juego (272 s) | Clava la silueta del juego: cuerpo muy largo y bajo, cresta hasta la cola, manada igual de alargada |
| C. A + frase de «mundo fantástico» genérica (152 s) | Añade motas y flora rara, pero **pinta una luna**, y el canon no tiene luna: el toque fantástico tiene que salir de la guía del mundo, no de una frase genérica |
| D. Zona (laberinto de cañones) como `-r` + criatura descrita (270 s) | La zona se respeta y la criatura se integra, pero la zona impone su cielo azul y su luz, y la anatomía vuelve a la de A |
| E. Zona + criatura a la vez (dos `-r`) | No cabe en `--max-vram vulkan0=2` (pide 2.202 MB de 1.786); `sd-cli` sí admite varias `-r` |

Segunda tanda, con prompts sacados de las fichas piloto (canon) y un preámbulo de mundo sin la palabra «luna»:

| Prueba | Resultado |
|---|---|
| F. Aullador macho desde la ficha, sin `-r` (151 s) | El más fiel al **texto** del canon: flaco, patas largas con mechones negros, colmillos amarillos curvos, gola, cola negra, manada detrás. Pero parece un lobo de crin sarnoso: las «vetas de arena fosilizada» salen como heridas rosadas |
| G. Los Pastos de la Deriva desde la ficha (150 s) | Óleo, ocaso, picos volcánicos, arcilla roja: se lee como mundo propio. Fallos: estrellas de día (el «polvo de cristal» del preámbulo), cuernahojas como vacas pintas, una figura que parece un jinete |
| H. Segunda pasada: F colocado en G con `-r G` (270 s) | La zona se respeta casi entera y la criatura se integra en estilo y luz. Fallos: las «cicatrices» salen como heridas abiertas, falta la manada |

Conclusiones:
1. **Los datos sí mandan**: con la ficha, el animal sale como dice el canon, sin referencia.
2. **El toque fantástico depende de los rasgos únicos del elemento**, y hoy están escritos de forma que el modelo no
   sabe pintar («vetas de arena fosilizada»). La ficha tiene que describirlos con forma, color y sitio («thin glinting
   streaks of red mineral embedded in the coat along the flanks»). Esta es la tarea central de la fase 4.
3. **Palabras que el modelo malinterpreta**: «moon» (aunque sea para negarla), «crystal dust across the heavens» (pone
   estrellas), «scars» (pone heridas). La plantilla necesita una lista de palabras vetadas con su alternativa, y el
   script la comprueba.
4. **Zona como fondo en dos pasadas: viable** (H mejor que D).

Detalle en `spike/informe.md`; imágenes en `spike/intentos/` (A-D primera tanda, F-H segunda).

**Ojo: el canon y la imagen del juego no dicen lo mismo del aullador.** El texto (`worldCatalog.ts:1479`) lo
describe flaco y con patas desproporcionadamente largas; la imagen actual del juego tiene el cuerpo alargado y bajo.
Hay que decidir cuál manda (D9).

## 2. Decisiones que te tocan (con mi recomendación)

| # | Decisión | Recomiendo | Por qué |
|---|---|---|---|
| D1 | Dónde viven las **fichas visuales** | Tabla nueva `FichaVisual` en BD, que `seed-catalog` no toca, con exportación a JSON versionado en el repo | El panel necesita escribir; si van en `worldCatalog.ts` el panel no puede editarlas, y si van en tablas que el seed borra se pierden |
| D2 | **Fuente de verdad del lore** en prosa | De momento no se cambia (Markdown + `worldCatalog.ts`); se decide en una fase posterior | Es el cambio más caro (tests, RAG, partidas guardadas, enlaces); las propuestas y fichas no lo necesitan |
| D3 | **Propuestas** | Modelo `Propuesta` en BD + importador único de los 3 `.md`; aprobar en el panel exporta al formato actual de `propuestas-aprobadas.md` | Bandeja con filtros y aprobación masiva sin romper el runbook `ampliar-lore.md` |
| D4 | **Autenticación** del panel | Escritura solo desde `127.0.0.1` + token en `.env` | Hoy el backend no tiene auth y el panel va a escribir |
| D5 | **Nombres de animales reales** en el prompt | Sí en el prompt (es interno), nunca en el texto publicado | El modelo necesita la silueta («galgo», «chacal»); el canon solo prohíbe nombrarlos en el juego |
| D6 | **Dónde va la UI del generador** | Panel único en el admin React; `servidor.py` pasa a ser API (sigue lanzando `sd-cli`) | Fichas, aprobaciones y generación en un sitio; la Deck sigue generando de una en una |
| D7 | **Estados de los intentos** | `estados.json` por elemento en `generated/` (migra `elegidas.tsv` a «aprobada»); papelera como carpeta | El generador no depende de Postgres para funcionar |
| D9 | **Aullador: canon o imagen del juego** | Que mande el texto del canon y se regenere la imagen (o, si te gusta más la del juego, se cambia el canon). Regla general: cuando choquen, manda la ficha y la imagen se rehace | Si la imagen manda sobre el texto, la ficha deja de servir para generar sin referencia |
| D10 | **Zona como fondo** | Dos pasadas: criatura aprobada primero; luego la zona aprobada como `-r` con la criatura descrita. Probar dos `-r` subiendo la VRAM solo con supervisión | Una sola `-r` cabe en la Deck; dos no con el límite actual |
| D8 | **Estilo por tipo** | Fauna y NPC: fotografía cinematográfica; zonas: óleo; luz de la ficha, no ocaso forzado para toda la fauna | Hoy toda la fauna sale al atardecer por una prueba con el múrgol |

**Conflictos de canon a resolver** (los encontró el borrador; los decides tú):
- Cardo Brújula: flor gris metálico (planta) o morado apagado (ítem). Propuesta: gris metálico con matiz violáceo.
- Hierba de las Llanuras: amarilla (Pasto Solar), naranja (`REGION_ESCENA`) o roja (Sabana Alta).
- Telda: árbol de 1-2 m, pero empalizadas de «troncos de Telda de 4-5 m».
- Nabieus: «piel gris apagada» (`rasgoFisico`) o «ninguna tonalidad» (`genesis.md`).

### Decidido (usuaria, 2026-10-25)

- **D1-D7, D9, D10:** como recomienda la tabla.
- **D8, por perfil y no por tipo:** `banner` realista (fotografía cinematográfica, también en zonas); `icono` y
  `thumbnail` (son lo mismo) al óleo; `mapa`, punto medio entre realismo y óleo. La luz sale de la ficha (sin ocaso
  forzado para la fauna).
- **Cardo Brújula:** gris metálico apagado con matiz violáceo.
- **Hierba de las Llanuras:** amarillo pajizo anaranjado; rojo solo en la Sabana Alta.
- **Telda:** crece hasta 4-6 m (lo de 1-2 m son ejemplares jóvenes); de ahí salen los troncos de las empalizadas.
- **Nabieus:** gris casi neutro, sin brillo, que apenas se distingue de la sombra.
- **Aullador:** manda el canon (flaco, patas desproporcionadamente largas); la imagen del juego se rehace.

Las fichas y la guía ya los usan. Pasarlos al canon (`docs/rpgtarkor/`, `worldCatalog.ts`, `berigLore.ts`) va por el
runbook `ampliar-lore.md`, con Álvaro: ningún agente edita el lore.

**Datos que faltan** y el borrador inventó como «[propuesta]»: alturas de las razas, ojos y hocico del aullador,
aspecto del Jakut Tusha de Hulki, altura de la planta entera del Cardo.

## 3. Fases

Cada fase cierra con su criterio comprobable; la 1 va primero porque demuestra que los datos arreglan las imágenes
antes de construir nada alrededor.

| Fase | Qué | Hecho cuando | Depende de ti |
|---|---|---|---|
| 1. Piloto de datos | Guía visual del mundo y plantilla de prompt (desde `borradores/`), script que monta el prompt desde la ficha, 4 pilotos con semilla fija | Los 4 pilotos sin `-r` dan imágenes que apruebas; el script tiene tests | Aprobar la guía, los conflictos y los 4 pilotos |
| 2. Modelo de datos | `Propuesta` y `FichaVisual` en Prisma (migración), importador de los 3 `.md` (~159), API Fastify con tests | Importación con recuentos iguales a los de la auditoría; tests `unit` y `bd-real` en verde | D1, D3, D4 |
| 3. Bandeja en el admin | Pestañas Propuestas y Fichas del prototipo en React: filtros, diff, edición, aprobar/rechazar en bloque, atajos de teclado | Aprobar 10 propuestas de golpe y verlas exportadas; completitud por elemento | Probarla |
| 4. Fichas en bloque | Un LLM rellena borradores de ficha por elemento (53 fauna primero) desde el canon, como propuestas en la bandeja; el script de prompt lee `FichaVisual` en vez de `bio` | Las 53 fichas de fauna aprobadas; el LLM ya no inventa la forma | Aprobar en bloque |
| 5. Generador: estados y dependencias | Estados por intento, papelera, cola con ETA, lotes de semillas, reutilizar ajustes, comparar; zona aprobada como fondo (según `spike/informe.md`) | Fauna con zona sin imagen aprobada queda bloqueada; con zona aprobada se usa de fondo | D6, D7 |
| 6. UI moderna | Pestaña Generador del prototipo en el admin: galería masonry, lightbox con triaje por teclado, filtros | Triaje de 20 intentos solo con teclado | Probarla |

Ítems nuevos para `docs/producto/roadmap-imagenes.md`: fichas visuales y guía del mundo (fase 1 y 4), estados por
intento y papelera, cola y lotes, dependencia zona → fauna (generaliza IMG-1/IMG-2), UI del generador en el admin.

## 4. Riesgos

- `seed-catalog`/`reindex-lore` borran y reinsertan: lo que edite el panel en tablas sembradas se perdería (por eso D1).
- Una migración de Prisma es puerta de un solo sentido: se diseña el modelo antes de crearla.
- La Deck: varias `-r` suben memoria; medir antes de usar zona + criatura juntas (IMG-1 ya lo pide).
- El panel escribe sin auth hasta D4.
