# Retro antes de fusionar el PR #60: hallazgos de QA-27, tandas 2 y 3 (2026-10-17)

Lo revisado: lo que entra con el PR #60 (rama `claude/frontend-improvements-roadmap-0mpckt`, 20 commits desde el
PR #59, 62 archivos): P154, P141, P165, P150, P177, P186, P166, P172, P184, P187, P178, P185, P147, P164 y P83,
las decisiones de diseño de la usuaria del 2026-10-17 y los 19 hallazgos de su `/code-review`.

**Estado (2026-10-17): aprobadas las cuatro por la usuaria y aplicadas en la rama antes de fusionar** como
~~`QA-90`~~ (1), ~~`QA-91`~~ (2), ~~`QA-92`~~ (3) y ~~`QA-93`~~ (4). De más a menos grave.

## 1. Mover un punto del catálogo duplica el punto en las partidas ya empezadas

**Qué pasó.** Para sacar el recinto de múrgoles de la casilla de la empalizada (P185) se cambió su `y` de 460 a 425
en `worldCatalog.ts`. Las partidas copian sus recursos y edificios por (tipo, slug, x, y) (`plantillasQueFaltan`).
Una partida vieja habría tenido dos recintos, uno sin dueño sobre las estacas. Ningún test lo vio; lo cogió el
`/code-review` y se deshizo el cambio.

**Propuesta (comprobación automática).** Un test con una instantánea de la posición de cada plantilla RECURSO y
EDIFICIO del catálogo (`locationSlug|tipo|targetSlug|x|y`). Mover una plantilla obliga a actualizar la instantánea
(`vitest -u`), y el test explica en su mensaje que hace falta pensar en las partidas ya empezadas. Más una línea
en `REVIEW.md` («Un fallo que vuelve»): una plantilla que las partidas ya copiaron no se mueve ni se renombra sin
decir qué pasa con sus copias.

## 2. La retro llegó después de crear el PR, y corta

**Qué pasó.** Con prisa por los tokens, se creó el PR #60 con una retro corta escrita sin presentarla. CLAUDE.md
pide la `/retro` antes de crear el PR, con sus propuestas presentadas a la usuaria y lo aprobado aplicado en la
rama antes de crearlo. El gancho de `QA-50` solo exige la marca de `revisado.sh`, no la retro.

**Propuesta (comprobación automática).** `revisado.sh` exige un `docs/registros/retro-*.md` añadido en la rama
(desde que se separó de `main`) con una línea `**Estado` que diga lo que decidió la usuaria. Sin ella no pone la
marca, y sin la marca el gancho no deja crear el PR.

## 3. El resumen del registro de hallazgos entendía mal algunos estados

**Qué pasó.** `marca-hallazgo.py --resumen` cuenta como pendiente todo estado que contenga «reabierto», aunque
luego diga ✅. Y solo reconoce «(en parte)» con paréntesis, así que «✅ … en parte:» salía como arreglo completo.
P141, P164, P186 y P187 salieron en el grupo equivocado, y hubo que verlo a ojo y reescribir sus estados.

**Propuesta (herramienta).** El clasificador mira el último ✅ o estado del texto, no cualquier aparición de
«reabierto». Además, acepta «en parte» con o sin paréntesis. Y `--comprobar` avisa de un estado con dos
marcas contradictorias.

## 4. Sacar los muros de una ilustración no está escrito en ningún sitio

**Qué pasó.** Para P185 hubo que improvisar cómo ver la cuadrícula del juego sobre `zona/<slug>-mapa.png`
(`convert` con la rejilla de 16×12 y las etiquetas de casilla) y cómo pintar en rojo las casillas de muro para
comprobarlas. `murosZona.ts` dice que las demás zonas con muros se añadirán según se vean jugando, y la siguiente
sesión tendrá que reinventarlo.

**Propuesta (navegación).** Un apartado en `docs/runbooks/nuevo-elemento-catalogo.md` («Muros de una zona»),
con los dos comandos (cuadrícula y comprobación en rojo) y la regla de la puerta, y un puntero a él desde la
cabecera de `murosZona.ts`.

## Sin propuesta

- **Una llamada «rechazada» que sí se aplicó** (el aviso de combate de `edificios.ts`). Ya lo cubre `QA-48`
  (`git status` y `git diff` tras una llamada rechazada); faltó aplicarlo, no una regla.
- **El rebaño del clan como ancla de fauna salvaje**, la lista de campamentos sin `viajeElegido` y la noticia de
  «El mundo» con autor. Son casos de «Una regla nueva, en todos sus caminos» (`REVIEW.md`). El `/code-review` los
  cogió todos, así que la revisión funcionó.
- **El pre-push con los tests de lo que cambia** (`QA-88`) paró varias veces lo que antes llegaba al CI. Funciona.
- **La copia del cálculo de ruta en el frontend** (vista previa al pasar el ratón) se queda: ya existía, los muros
  le llegan del backend y tiene los mismos casos de test en los dos lados.
