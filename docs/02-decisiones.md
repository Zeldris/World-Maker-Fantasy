# Decisiones de producto — Tarkor

Documento vivo. Aquí se registra cada decisión de producto que tomamos, con su fecha y el razonamiento. Se actualiza a medida que avanzamos — no es un acta de reunión, es la memoria del proyecto.

**Cómo usarlo:** cada vez que cerramos una pregunta de la sección "Pendientes", se mueve a "Decididas" con la fecha y el porqué, y se borra de pendientes.

---

## Decididas

### 1. Naming de los modos — **2026-07-16**

**Decisión:** los dos modos se llaman **"En solitario"** y **"Multijugador"**, no "Offline"/"Online".

**Por qué:** "Offline" sugería erróneamente que el modo funciona sin conexión a internet, cuando en realidad ambos modos requieren red (la IA no funciona sin conexión). "En solitario/Multijugador" describe con precisión la diferencia real entre los modos.

**Impacto:** renombrar en el mapa de pantallas de [01-analisis-producto.md](01-analisis-producto.md) (Home, pantallas 2 y 6) cuando se diseñe la UI. Terminología a usar de aquí en adelante en toda la documentación y el código: "solitario" / "multijugador".

### 2. Alcance del MVP — **2026-07-16**

**Decisión:** el MVP cubre **solo el modo En solitario**. Multijugador queda para una fase posterior.

**Por qué:** el núcleo diferencial del producto (el mundo que vive por su cuenta, doble log personaje/mundo) se valida completamente sin multijugador, y este último depende de 12 preguntas de diseño (P0-P3) aún abiertas que multiplicarían mucho la complejidad si se aborda ahora.

**Impacto:** las preguntas del modo Online (P0-P3, puntos 6-17 de "Pendientes") siguen siendo relevantes para no diseñar el MVP de forma que las bloquee después, pero no son bloqueantes para arrancar la fase técnica del MVP.

### 3. Profundidad mecánica del personaje — **2026-07-16**

**Decisión:** los atributos tienen **efecto mecánico real y las tiradas son visibles** para el jugador (estilo rol de mesa clásico: p. ej. "Sigilo 14 vs dificultad 12 → éxito").

**Por qué:** aporta más profundidad y sensación de juego justo/transparente frente a que la IA decida todo de forma opaca.

**Impacto:** implica diseñar una ficha de personaje con atributos numéricos, un sistema de dificultad/resolución (tipo de dado o fórmula, umbrales de éxito), y que el Narrador muestre la tirada en el log de personaje como parte de la narración. Afecta directamente a la pantalla 4 (creación de personaje) y a la pantalla 10 (ficha en juego) de [01-analisis-producto.md](01-analisis-producto.md). Queda pendiente de definir en fase técnica: el sistema concreto de tiradas (rango de dados, fórmula de dificultad, etc.).

### 4. Modelo de tiempo ficticio — **2026-07-16**, revisada **2026-07-16**

**Decisión (revisada):** el reloj de mundo tiene **su propio calendario y lógica interna** (día/noche, agendas de facciones, rutinas de NPCs) y avanza **mientras el juego está en marcha** (el jugador activo, o el worker de fondo corriendo) — pero se **pausa** cuando se cierra la partida/el backend no está corriendo, como cualquier videojuego. No se sincroniza 1:1 con el reloj real de forma persistente a través de apagados del servidor.

Para las **acciones largas** (viajar, esperar varios días dentro de la ficción), el reloj **no se salta de golpe** mientras el juego está en marcha: el tiempo transcurre de verdad (a la escala que se defina) mientras el personaje queda "en tránsito/ocupado", y pueden ocurrirle cosas de forma automática a un ritmo reducido, dependiente del contexto (p. ej. peligrosidad de la zona). Esto no cambia con la revisión — lo que cambia es solo qué pasa cuando el proceso está apagado (nada — se pausa, no hay hueco que reconciliar al volver).

**Por qué se revisó:** la primera versión (reloj 1:1 sincronizado con el tiempo real incluso con el servidor apagado, con un mecanismo de "recuperación al arrancar" para fingir el tiempo transcurrido) generaba una complejidad de ingeniería innecesaria para lo que realmente se buscaba. Al aclarar con la usuaria, "que sea un mundo real" se refería a que el mundo tenga su propia lógica y calendario internos (sensación de lugar vivo, no que gire alrededor del jugador) — no a que el reloj seguido literalmente el tiempo real durante los apagados del PC. Pausar el mundo cuando el juego no está corriendo es más simple y sigue cumpliendo el objetivo real.

**Importante — la versión original (interpretación A: reloj 1:1 sincronizado con el tiempo real, persistente incluso sin proceso corriendo) queda reservada como posible requisito específico del modo Multijugador** (ver pregunta 6 de "Pendientes" más abajo): en una sala compartida por varios jugadores, el servidor sí tendría que correr de forma continua (hosted, no en el PC de una sola persona) mientras haya sesión activa, y ahí sí sería razonable que el mundo compartido avanzara en tiempo real de verdad para todos los participantes por igual, sin depender de que un jugador concreto esté conectado.

**Impacto:**
- Arquitectura (revisado): ya no hace falta un mecanismo de "recuperación al arrancar" ni reconciliar huecos de tiempo real — ver [03-arquitectura.md](03-arquitectura.md#6-el-reloj-de-mundo-en-tiempo-real-la-pieza-más-singular-de-este-proyecto), sección simplificada en consecuencia.
- El MVP en solitario sigue incluyendo la mecánica de "personaje ocupado + resolución automática a ritmo reducido" durante acciones largas — solo cambia qué pasa cuando el proceso está apagado (nada, se pausa).
- **Pendiente de afinar en detalle más adelante** (no bloqueante ahora): el ritmo exacto de resolución automática según zona/contexto, si hay un tope máximo de duración para una acción larga, y cómo se notifica al jugador cuando algo relevante le ocurre mientras la acción se resuelve.

### 5. Mundos semilla iniciales — **2026-07-16**

**Decisión:** para el lanzamiento del MVP se desarrolla **un único mundo semilla** (no 2-3 como sugería el análisis original), de **alta fantasía épica inspirada en WoW / El Señor de los Anillos**: razas, reinos, magia, facciones en conflicto, el tipo de ambientación reconocible del género.

**Por qué:** reduce aún más el alcance del MVP (coherente con la decisión 2 de validar primero el modo en solitario) concentrando el esfuerzo de worldbuilding en un solo mundo bien desarrollado en vez de repartirlo entre varios mundos superficiales.

**Impacto:** sustituye el punto "definir 2-3 mundos semilla" de los siguientes pasos del análisis por "definir 1 mundo semilla en profundidad". Queda pendiente concretar el contrato de este mundo (tono, letalidad, qué existe y qué no, facciones/NPCs semilla, personajes pregenerados) — se abordará como tarea de worldbuilding, no como pregunta de esta lista.

### 6. Identidad visual base y tematización por mundo — **2026-07-16**

**Decisión:** la paleta base de toda la app es "madera + hierro": tonos marrones claros y oscuros (superficie tipo tablón de madera con veta) combinados con negros tipo hierro forjado (bordes, remaches/"clavos" decorativos en las esquinas de paneles y tarjetas). Sobre esa base neutra, cada **mundo** del catálogo lleva su propio tema de dos acentos de color (uno primario y uno secundario) que se aplica dinámicamente a toda la pantalla en cuanto el jugador lo selecciona — hoy solo existe el tema de Valdreth (latón + musgo), pero la arquitectura ya soporta que futuros mundos definan su propio tema sin tocar componentes.

**Corrección (2026-08-13):** "Valdreth" era el mundo placeholder de la demo de frontend y se retiró por completo al día siguiente de esta decisión, sustituido por el mundo semilla real **Helek Sirik** (decisión 5 de este mismo documento, [07-mundo-helek-sirik.md](07-mundo-helek-sirik.md)) — no queda ninguna referencia a "Valdreth" en el código. El único tema hoy activo es el de Helek Sirik (`frontend/src/data/mock.ts`), en azules/grises, no latón+musgo. El mecanismo descrito (tematización dinámica por mundo vía `theme: WorldTheme`) sigue siendo correcto y vigente, solo cambió qué mundo/colores concretos lo usan.

**Por qué:** primera iteración de diseño de la demo de frontend usaba un violeta/dorado genérico; la usuaria pidió una base más "de madera con clavos negros", coherente con la ambientación de fantasía. Además, cada mundo del catálogo debería sentirse visualmente distinto cuando el jugador entra en él.

**Impacto (implementación en `frontend/`):**
- `src/index.css`: tokens de Tailwind v4 — escala neutra `wood-*` (reemplaza a la antigua `ink-*`), `iron-*` para remaches/bordes profundos, y dos escalas semánticas *tematizables* `accent-*`/`accent2-*` (por defecto = tema de Valdreth) más `moss-*` fijo (no tematizable, usado en Multijugador y en el estado de éxito de tiradas, que son contextos fuera de cualquier mundo). Utilidades `.wood-grain`, `.plank-panel` y `.rivet` para el efecto de tablón con clavos.
- `src/types.ts`: `World` ahora incluye `theme: WorldTheme` (8 valores hex: accent 300-600, accent2 300-600).
- `src/lib/worldTheme.ts` + `SessionContext`: al seleccionar un mundo, se sobrescriben en tiempo real las variables CSS `--color-accent-*`/`--color-accent2-*` en `document.documentElement`, así que todos los componentes que usan esas clases (`bg-accent-500`, `text-accent2-400`, etc.) cambian de color automáticamente sin lógica adicional por componente.
- Al añadir un mundo nuevo al catálogo (`src/data/mock.ts`), basta con darle su propio `theme` — no hace falta tocar componentes ni páginas.

---

## Pendientes

Preguntas abiertas identificadas en [01-analisis-producto.md](01-analisis-producto.md), en el orden en que las iremos respondiendo.

### Fundacionales (afectan a todo el producto)

### Modo Online — P0 (bloquean el diseño del modo)

6. **Modelo de tiempo online** — ¿por turnos, tiempo real, o asíncrono estilo "rol por foro"? **Pista de la revisión de la decisión 4:** el modo Multijugador es el candidato natural para la interpretación "reloj 1:1 sincronizado con el tiempo real de forma persistente" que se descartó para el modo en solitario — ahí sí habría un servidor corriendo de forma continua (hosted, no en un PC personal) mientras haya sesión activa, lo que hace viable (y probablemente deseable) que el mundo compartido avance en tiempo real de verdad para todos los jugadores por igual.
7. **Resolución de acciones conflictivas** — cuando dos jugadores actúan sobre lo mismo, ¿orden de llegada, ronda conjunta, o mecánica de iniciativa/atributos?
8. **¿Se permite PvP narrativo?** — ¿los personajes pueden enfrentarse/engañarse entre sí, o el diseño asume cooperación?

### Modo Online — P1 (experiencia de mesa)

9. **Visibilidad de logs entre jugadores** — ¿cada jugador ve solo su log de personaje (permite secretos) o todos ven todo? ¿El log de mundo es igual para todos o filtrado por lo que cada personaje sabe?
10. **Rol del host** — ¿solo administrativo (invitar/expulsar/pausar) o también "co-máster" (vetar acciones, orientar a la IA)?
11. **Jugadores ausentes** — ¿la partida espera, el personaje queda "en pausa narrativa", o la IA lo controla temporalmente?
12. **¿Puede el grupo separarse?** — ¿la IA lleva escenas paralelas si los jugadores van a sitios distintos, o el diseño fuerza a mantener el grupo junto?

### Modo Online — P2 (límites y ciclo de vida)

13. **Límite de jugadores por sala**
14. **Ciclo de vida de la sala** — ¿campañas persistentes, one-shots, o ambos? ¿Se puede entrar a mitad de campaña? ¿Qué pasa si el host abandona?
15. **Descubrimiento** — ¿solo salas privadas por invitación/código, o también salas públicas listadas (implica moderación)?

### Modo Online — P3 (pueden esperar)

16. **Espectadores** — ¿se puede ver una partida sin jugar / compartir partidas como lectura?
17. **Identidad social** — perfiles, historial de personajes, "trofeos" de campañas.

---

## Notas de seguimiento

- Referencia completa del análisis original: [01-analisis-producto.md](01-analisis-producto.md).
- Este archivo es la fuente de verdad de decisiones de producto. Las decisiones técnicas (stack, arquitectura) se documentarán aparte una vez cerrado este bloque.
- **Estado a 2026-07-16:** cerradas las 5 decisiones fundacionales (1-5). Las 12 preguntas del modo Multijugador (P0-P3) quedan **pausadas deliberadamente** — no bloquean el MVP en solitario (decisión 2) — y se retomarán cuando se aborde esa fase. El proyecto pasa ahora a la fase de decisiones técnicas para el MVP en solitario.
