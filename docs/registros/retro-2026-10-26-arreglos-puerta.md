# Retro y opt-tokens · `claude/wonderful-volta-662qt8` (2026-10-26)

**Estado:** decidida por la usuaria (2026-10-26): aplicadas las tres (1 → `QA-256`, 2 → `QA-257`, 3 → `QA-258`); las de Galivelop-workflow se quedan aquí para `gw-harvest`.

Sesión de los arreglos de la puerta de pruebas: las tandas por sistema (Reino, Mundo, Zona, NPC, Combate/caza,
Supervivencia), las decisiones de la usuaria del 2026-10-26 (P241, P243-P245, P27, P327, P306, P307, P211, P313, P208)
y la fase 1 hacia `main` (22 hallazgos; P255 y P327 con lo decidido después).

Cifras de `medir.py --since 948ea73` (desde la última fusión a `main`):
- principal: 102 llamadas, 112k de contexto medio, techo de 121-144k por tramo, 3 compactaciones. Va bien.
- subagentes: 14, con 1.290 llamadas y 133M de entrada, el **92 %** del periodo. La mitad con Sonnet, la mitad con Opus.
- las tandas de arreglos con Sonnet: 165-183 llamadas cada una, 103k de contexto medio sobre 53k de arranque.
- las revisiones con Opus: 75-146 llamadas.

## Lo que salió mal

- **Fugas del nombre oculto (P327) que pasaron la revisión de cada tanda.** El nombre real del PRINCIPAL sin descubrir
  salía en cuatro sitios: `npcAbilityUsed`, la línea del diario de grupo, la réplica del NPC (`generateNpcReply`) y el
  diario de la emboscada. Las dos primeras las cazó la revisión de la tanda; las otras dos, la fase 1. Tampoco se vio
  que la jugadora no podía nombrarlo («al orco desconocido»). La regla ya está en `REVIEW.md` («Una regla nueva, en
  todos sus caminos»); lo que faltó es una comprobación que no dependa de que el revisor haga el `grep`.
- **`marca-hallazgo.py` falló con «0 filas»** por un espacio al principio del texto viejo; hubo que releer la fila
  para ver por qué.
- **Una tanda dijo que su commit «ya estaba en origin»** sin haber visto su pre-push. Hubo que pasar a mano las 9 órdenes
  del check sobre ese commit.

## Propuestas, de más a menos ahorro o riesgo

1. **Test centinela del nombre oculto** (comprobación automática; del proyecto). Un test de integración con un PRINCIPAL
   sin descubrir que pase por los caminos que lo nombran, con el clasificador y el narrador simulados, y exija que su
   nombre real no salga en ninguna respuesta ni en lo que se manda al narrador. Los caminos: saludo, réplica, regalo,
   combate de grupo, emboscada, diario y `GET /saves/:id`. Coste: un subagente Sonnet, ~1 h. Riesgo: ninguno; puede
   salir alguna fuga más.
2. **Tandas de arreglos más cortas** (ahorro; `AGENTS.md`, apartado `orchestrate-dealer`, junto a la línea de las tandas
   de juego). Como mucho 5 hallazgos y ~90 llamadas, en vez de 8-11 hallazgos y 165-183 llamadas. El contexto de un
   subagente crece de ~53k a ~150k: partir una tanda en dos baja el medio de ~103k a ~78k. Son unos 17M de los ~70M
   de las tandas de este periodo, un 25 %. Riesgo: más arranques (53k cada uno, ~2 % del total) y más fusiones. Para
   no duplicar la revisión con Opus, se revisan dos tandas juntas.
3. **`marca-hallazgo.py` más claro al fallar** (herramienta; del proyecto). Quitar los espacios de los bordes del texto
   viejo y, con 0 filas, mostrar los primeros 200 caracteres del estado actual de la fila. Coste: 15 min con su test en
   `tools/qa/tests`. Riesgo: ninguno.

## For Galivelop-workflow

- **Pasar el check en una orden:** `config.py run check`, con una línea OK/FALLA por orden y la salida del fallo
  recortada. Hoy, comprobar un commit sin su pre-push son 9 órdenes a mano.
- **Tamaño de las tandas de arreglos en `orchestrate-dealer`:** el tope de llamadas por subagente (propuesta 2), en
  general para cualquier proyecto.

## Fuera de la retro

- La sesión lleva 59 compactaciones en varios días. Tras fusionar en `main`, `/clear` (`QA-187`).
- El gancho global de parada pide hacer commit mientras un subagente escribe en el árbol. Es del entorno de la nube,
  no del repo, y se contesta sin hacer commit.
