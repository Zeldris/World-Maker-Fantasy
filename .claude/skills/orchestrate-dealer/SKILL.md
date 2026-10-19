---
name: orchestrate-dealer
description: La sesión principal como orchestrator que reparte el trabajo a subagentes de contexto limpio, para trabajar horas sin `/clear`. Usar en toda tarea de más de un paso (tarea del roadmap, tanda de arreglos, ronda de pruebas) y cuando el contexto de la sesión pase de ~150k.
---

# orchestrate-dealer (`QA-121`)

La sesión principal es el **orchestrator**: guarda el plan, las decisiones y el hilo con la usuaria, y reparte cada
trozo de trabajo a un subagente que empieza con el contexto vacío. Cada reparto es un `/clear` automático: la
principal solo recibe un resumen corto y crece despacio. Si aun así llega al tope, la compactación automática
(`CLAUDE_CODE_AUTO_COMPACT_WINDOW`, 200k) y el gancho de `recuperar.py --estado` son la red.

## Qué se queda en la principal y qué se reparte

| Orchestrator (principal) | Subagente |
|---|---|
| Hablar con la usuaria, preguntar, presentar | Leer código, docs largos, logs, capturas y `snapshot` de Playwright |
| Partir la tarea en trozos y escribir cada encargo | Implementar, depurar, pasar tests |
| Decidir (diseño, qué se arregla, qué se apunta) | Jugar una tanda de la ronda de pruebas |
| Revisar lo que vuelve: `git log`/`git diff --stat`, nunca el diff entero salvo duda | Commit y push de su trabajo, con la bitácora en el mismo commit |
| `/code-review`, `/opt-tokens`, `/retro`, PR y fusión | — |

Una lectura de más de ~200 líneas o una salida larga en la principal es un trozo que no se repartió.

## Pasos

1. **Partir.** Con el `selector` ya aplicado, divide la tarea en trozos que un subagente cierre de una vez: un
   arreglo, un sistema, una tanda de 3-5 comprobaciones de la ronda. Cada trozo, con su criterio de hecho
   comprobable (un test en verde, un P-número comprobado o abierto, un commit subido) y lo que le bloquea. La
   **frontera** son los trozos que nada pendiente bloquea: salen a la vez (ver Reglas).
2. **Repartir.** Un subagente por trozo con `Agent`, en primer plano (`run_in_background: false`) cuando el
   siguiente trozo depende de él. Modelo y esfuerzo por la escalera del `selector` (`QA-118`): `sonnet` para
   implementar y jugar, `opus` para depurar algo no obvio. El encargo lleva **punteros**, no copias: dónde está lo que
   necesita (fila de la bitácora, P-número del registro, fila de la matriz, commit, archivo y función del
   `docs/mapa-agente.md`), nunca el texto pegado. Con esta forma:

   ```text
   Trabajas en Tarkor, rama <rama>. Lee docs/registros/traspaso.md (tu fila) y, si tocas código,
   docs/mapa-agente.md. Sigue CLAUDE.md (commit + push con la bitácora en el mismo commit).
   Encargo: <qué, en una o dos frases>.
   Hecho cuando: <criterio comprobable>.
   No hagas: <lo que es de otro trozo o pide decisión de la usuaria>.
   Si algo pide decidir a la usuaria, para y devuélvelo como pregunta.
   Devuelve como mucho 15 líneas:
   HECHO: … · HALLADO: P-números con una línea cada uno · COMMIT: <sha> · FALTA: … · PREGUNTAS: …
   ```

3. **Revisar lo que vuelve.** Comprueba el commit (`git fetch` + `git log -1 --stat`) y que el criterio de hecho
   se cumple. Si no cierra, el reintento sube un peldaño; dos fallos, se para y se le cuenta a la usuaria.
   Las `PREGUNTAS` van a la usuaria tal cual, con la respuesta que recomiendas.
4. **Seguir.** Siguiente trozo. A la usuaria, una línea por trozo cerrado; el detalle está en la bitácora.

## Reglas

- **Arreglos de código de la frontera, en paralelo** (idea de `implement-spec` de Matt Pocock): cada subagente con
  `isolation: "worktree"`, en `run_in_background`, hace commit en su worktree sin tocar la bitácora ni subir, y
  devuelve su rama. La principal los fusiona uno a uno en la rama de trabajo (`git merge`, tests del paquete
  tocado), escribe la bitácora y sube. Un conflicto entre dos de ellos lo resuelve un subagente de fusión.
- **Sin worktree, uno a la vez en la misma rama**: dos subagentes que hacen commit en la rama de trabajo chocan
  en la bitácora. En paralelo, además, todo lo que no escribe (buscar, leer, medir).
- **Rondas de pruebas, en serie**: comparten el navegador y la base de juego. Cada tanda deja la partida en un
  estado que la siguiente pueda retomar y lo dice en `FALTA` (pantalla, partida, día).
- **El subagente no habla con la usuaria**: lo que necesite de ella vuelve como `PREGUNTAS`.
- **Medir**: `/opt-tokens` antes de cada PR compara el contexto medio por llamada, las compactaciones y el reparto
  `POR MODELO` con la sesión anterior; si no bajan, el reparto se está quedando en la principal.
