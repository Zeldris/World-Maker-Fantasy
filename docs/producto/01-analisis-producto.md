# Análisis de producto — RPG narrativo con IA (nombre provisional: "Tarkor")

**Fase:** Análisis de producto (pre-técnica)
**Fecha:** 2026-07-16
**Estado:** análisis fundacional, vigente como visión (comprobado 2026-09-28). El modo Online (§ 5) sigue aparcado; lo que se está haciendo y en qué orden está en el [roadmap](21-roadmap.md).
**Estado:** Borrador para discusión

---

## 1. Concepto y propuesta de valor

**Tarkor es un juego de rol narrativo por texto donde una IA hace de director de juego, pero con una diferencia clave: el mundo vive por su cuenta.** Mientras que en precedentes como AI Dungeon la IA solo reacciona a lo que escribe el jugador (el mundo es un decorado que se genera al mirarlo), aquí el mundo tiene su propio "pulso": clima, facciones, NPCs, economía y sucesos evolucionan en un log paralelo que el jugador ve pero no controla, y que puede alcanzarle en cualquier momento.

La experiencia buscada es la de una **partida de rol de mesa con un buen máster**: el máster no solo responde a tus acciones, sino que tiene un mundo preparado que sigue moviéndose aunque tú no hagas nada. La doble ventana (log de personaje + log de mundo) hace visible esa sensación de "el mundo no gira a mi alrededor", que es precisamente lo que a los juegos narrativos con IA les suele faltar y lo que genera rejugabilidad y sorpresa genuina.

El modo Online extiende esto a mesas compartidas: varios jugadores, cada uno con su personaje, en un mismo mundo dirigido por la IA — el equivalente digital de una campaña de mesa sin necesidad de que nadie haga de máster.

---

## 2. Mapa de pantallas y flujos

### Flujo general

```
Home ──> Offline ──> [Partidas guardadas] ──> Continuar partida ──> Vista de juego
   │                └─> Nueva partida ──> Selección de mundo ──> Personaje ──> Vista de juego
   │
   └──> Online ──> [Mis salas] ──> Entrar en sala ──> Lobby ──> Vista de juego compartida
                  └─> Crear sala / Unirse por código
```

### Pantallas

| # | Pantalla | Descripción |
|---|----------|-------------|
| 1 | **Home** | Dos botones grandes: "Offline" y "Online". Punto de decisión único, sin ruido. Candidata a mostrar también "continuar última partida" como acceso rápido. |
| 2 | **Offline — Lista de partidas** | Partidas guardadas del usuario: nombre, mundo, personaje, fecha de última sesión y un mini-resumen ("Estás en las mazmorras de Khel, herido, buscando la llave"). Acciones: continuar, renombrar, borrar. Botón destacado "Nueva partida". |
| 3 | **Selección de mundo** | Catálogo de mundos ofrecidos por la app (fantasía medieval, ciencia ficción, terror, etc.). Cada mundo es una tarjeta con arte/tono, sinopsis y "reglas de la casa" (tono, letalidad, qué existe y qué no). Posible ficha de detalle antes de confirmar. |
| 4 | **Creación / selección de personaje** | Dos caminos: (a) elegir un personaje pregenerado del mundo (entrada rápida, 1 tap), o (b) crear desde cero: nombre, arquetipo/clase, atributos, trasfondo, motivación. La creación puede ser asistida por la propia IA ("descríbeme a tu personaje y yo relleno la ficha"). |
| 5 | **Vista de juego (Offline)** | La pantalla central del producto. Dos paneles de logs (personaje y mundo, lado a lado en escritorio, apilados o en pestañas en móvil) + textarea inferior estilo Claude.ai. Elementos secundarios necesarios: acceso a la ficha del personaje, resumen de la partida hasta ahora, menú de pausa/guardado/salir. |
| 6 | **Online — Lista de salas** | Salas creadas por el usuario o en las que participa: nombre, mundo, nº de jugadores, estado (esperando / en curso), actividad reciente. Acciones: entrar, crear sala, unirse por código/invitación. |
| 7 | **Crear sala** | Elegir mundo, nombre de sala, nº máximo de jugadores y ajustes de mesa (los que se decidan en la sección 5: modelo de turnos, visibilidad de logs…). Genera código/enlace de invitación. |
| 8 | **Lobby de sala** | Sala de espera pre-partida: lista de jugadores, cada uno crea/elige su personaje, el host lanza la partida cuando todos están listos. También sirve como punto de reentrada entre sesiones. |
| 9 | **Vista de juego compartida (Online)** | Variante de la pantalla 5: log de mundo común a todos + log(s) de personaje según la decisión de visibilidad (sección 5). Añade indicadores de presencia/turno ("esperando a Raquel…"). |
| 10 | **Ficha de personaje (en juego)** | Consulta del estado actual: atributos, inventario, condiciones (herido, envenenado…), relaciones con NPCs. Se actualiza sola a medida que la partida avanza. |
| 11 | **Diario / resumen de partida** | Historia jugada hasta el momento, condensada por la IA en capítulos. Sirve para reengancharse tras días sin jugar y como "memoria" visible de la partida. |

**Pantallas transversales:** ajustes (nombre de usuario, preferencias de contenido/tono), onboarding la primera vez (explicar los dos logs en 3 pasos).

---

## 3. Entidades de dominio (nivel conceptual)

> Plantilla vs instancia: es útil distinguir lo que la app ofrece (catálogo) de lo que el jugador vive (su copia). Un "Mundo" del catálogo genera un "Estado de mundo" propio de cada partida.

- **Usuario** — identidad, preferencias (idioma, tono/contenido), sus partidas y salas.
- **Mundo (plantilla)** — nombre, temática, sinopsis, tono (heroico, sombrío, humorístico…), letalidad, **contrato de mundo** (qué existe: ¿hay magia?, ¿hay armas de fuego?, ¿qué está prohibido narrativamente?), lugares/facciones/NPCs semilla, personajes pregenerados asociados, ganchos de aventura iniciales.
- **Personaje** — nombre, arquetipo, atributos, trasfondo, motivación, inventario, **condiciones actuales** (salud, estados), relaciones con NPCs. Los pregenerados son plantillas de esta misma entidad.
- **Partida / Sesión (offline)** — mundo elegido, personaje, fecha de creación y última jugada, **estado de mundo** propio, historial de logs, resúmenes acumulados.
- **Estado de mundo** — la "fuente de verdad" de una partida: reloj de mundo (fecha/hora ficticias), situación de facciones y NPCs relevantes, hechos establecidos ("el puente está destruido"), agenda de eventos pendientes. No lo ve el jugador directamente; los logs son vistas de él.
- **Entrada de log** — unidad atómica de narración: tipo (personaje | mundo), texto, marca de tiempo real y de tiempo ficticio, causa (acción del jugador / evento programado / consecuencia diferida). En online, además: a qué jugador pertenece y quién puede verla.
- **Turno / Intercambio** — un ciclo completo: acción escrita por el jugador → resolución → entradas de log resultantes. Es la unidad natural de guardado y de "deshacer" si se ofreciera.
- **Resumen / Memoria de partida** — condensaciones periódicas de lo jugado (por capítulos) que permiten mantener coherencia en partidas largas y alimentar el diario (pantalla 11).
- **Sala (online)** — mundo, host, jugadores (cada uno con su personaje), estado (lobby / en curso / pausada), ajustes de mesa, código de invitación.
- **Jugador-en-sala** — vínculo usuario↔sala: su personaje, su estado de conexión/turno, cuándo actuó por última vez.

---

## 4. Mecánica del "director de IA"

### ¿Una IA o dos?

Conceptualmente conviene pensarlo como **un solo director con dos voces**, no dos agentes independientes:

- **El Narrador** (voz del log de personaje): resuelve las acciones del jugador. Responde siempre y solo a lo que el jugador hace, dice o percibe.
- **El Cronista** (voz del log de mundo): narra lo que ocurre en el mundo con independencia de la voluntad del jugador.

La razón para que sea *un* director y no dos agentes separados es la **coherencia**: si dos inteligencias distintas improvisan sobre el mismo mundo sin compartir cabeza, se contradicen. La separación real no debe estar entre "dos IAs" sino entre **el estado canónico del mundo y sus dos vistas**:

```
                 ┌─────────────────────────┐
                 │   ESTADO DE MUNDO        │  ← única fuente de verdad
                 │ (reloj, hechos, agenda,  │
                 │  facciones, NPCs)        │
                 └───────┬─────────┬───────┘
                    lee/escribe   lee/escribe
                 ┌───────┴──┐   ┌──┴────────┐
                 │ Narrador  │   │ Cronista  │
                 └───────┬──┘   └──┬────────┘
                         ▼         ▼
                 Log de personaje  Log de mundo
```

Ambas voces **leen y escriben el mismo estado**. El log de personaje y el log de mundo no son dos historias: son dos cámaras sobre la misma historia.

### El ciclo de un turno

1. El jugador escribe una acción ("Registro el escritorio del alcalde").
2. El Narrador la resuelve contra el estado de mundo: ¿es posible?, ¿qué encuentra?, ¿qué consecuencias inmediatas tiene? → **entrada en el log de personaje**.
3. La resolución **actualiza el estado de mundo** (hechos nuevos: "el jugador tiene la carta comprometedora"; consecuencias diferidas: "el alcalde notará el registro en ~2 horas de juego").
4. El reloj de mundo avanza lo que la acción haya costado (registrar un escritorio: minutos; viajar a otra ciudad: días).
5. El Cronista revisa si el avance del reloj ha "vencido" algo de la agenda o si toca un evento → **0, 1 o varias entradas en el log de mundo**.

### Qué dispara cada log

| Log de personaje | Log de mundo |
|---|---|
| **Siempre y solo** en respuesta a una acción del jugador (incluida la acción de "esperar" u "observar"). | **(a) Tiempo:** el reloj de mundo avanza y vence eventos de la agenda ("cae la noche", "llega la caravana"). |
| | **(b) Consecuencias diferidas** de acciones pasadas del jugador ("la guardia ha encontrado el cuerpo que escondiste"). Esta es la categoría más valiosa: el mundo *recuerda*. |
| | **(c) Agenda propia del mundo:** tramas de facciones y NPCs que avanzan solas ("el precio del grano sube; hay rumores de guerra en el norte"). |
| | **(d) Azar controlado:** eventos aleatorios *pertinentes* — con presupuesto (p. ej. máx. 1 por turno) para que sea sabor, no ruido. |

**Regla de oro de sincronización:** ninguna voz inventa hechos que contradigan el estado; si el Cronista dice que llueve, el Narrador describe al personaje mojándose. Y los eventos de mundo **no interrumpen** la escritura del jugador: se encolan y se pintan en su panel, y solo cruzan al log de personaje cuando afectan directamente a lo que el personaje percibe ("oyes campanas de alarma a lo lejos").

**Matiz importante de ritmo — [DECIDIDO, luego REVISADO el mismo día, ver [02-decisiones.md](02-decisiones.md#4-modelo-de-tiempo-ficticio--2026-07-16-revisada-2026-07-16)]:** al contrario de lo que se planteaba aquí, el mundo tiene su propio calendario y avanza **mientras el juego está en marcha** — las acciones largas (viajar, esperar) no saltan el reloj: transcurre tiempo real de verdad mientras el personaje está "en tránsito/ocupado", con resolución automática de sucesos a ritmo reducido según contexto. **Corrección (2026-08-11): la primera versión de este párrafo decía que el reloj era 1:1 persistente incluso con el backend apagado — esa versión se revisó el mismo día en que se decidió (ver el detalle completo en 02-decisiones.md § decisión 4): el mundo se PAUSA cuando el backend no está corriendo, como cualquier videojuego, y no hace falta ningún mecanismo de recuperación al volver a encenderlo.** La versión 1:1 persistente queda reservada como posible requisito específico de un futuro modo Multijugador con servidor dedicado, no como comportamiento del modo en solitario.

---

## 5. Modo Online — preguntas abiertas

Decisiones pendientes, **priorizadas** (P0 = bloquea el diseño del modo; P3 = puede decidirse tras el MVP):

### P0 — Definen qué juego es
1. **Modelo de tiempo:** ¿por turnos (cada jugador declara y la IA resuelve la ronda), tiempo real (cada acción se resuelve al llegar), o asíncrono estilo "rol por foro" (juegas cuando puedes, el mundo espera)? Esta decisión condiciona todo lo demás, incluida la experiencia en móvil.
2. **Resolución de acciones conflictivas:** si dos jugadores actúan sobre lo mismo a la vez ("cojo la gema" / "yo también"), ¿resuelve la IA por orden de llegada, por ronda conjunta (lee todas las declaraciones y narra una única resolución), o con alguna mecánica (iniciativa, atributos)?
3. **¿Se permite jugar entre jugadores?** ¿Los personajes pueden enfrentarse, robarse, engañarse (PvP narrativo), o el diseño asume cooperación? Afecta a conflictos, visibilidad y moderación.

### P1 — Definen la experiencia de mesa
4. **Visibilidad de los logs de personaje:** ¿cada jugador ve solo el suyo (permite secretos, susurros al máster, escenas privadas) o todos ven todo (más simple, más "mesa de amigos")? ¿Y el log de mundo — es idéntico para todos o filtrado por lo que cada personaje puede saber?
5. **Rol del host:** ¿es solo administrativo (invitar, expulsar, pausar) o tiene poderes de "co-máster" (vetar acciones, orientar a la IA, saltar escenas)?
6. **Jugadores ausentes:** si alguien no responde, ¿la partida espera, su personaje queda "en pausa narrativa", o la IA lo controla temporalmente? Crítico en asíncrono.
7. **¿Puede el grupo separarse?** Si dos jugadores van a sitios distintos, ¿la IA lleva escenas paralelas o el diseño fuerza a mantener el grupo junto? (Las escenas paralelas son muy potentes y muy costosas de diseñar bien.)

### P2 — Definen límites y ciclo de vida
8. **Límite de jugadores por sala** (la intuición de rol de mesa dice 3–5; más jugadores degradan el ritmo y el protagonismo de cada uno).
9. **Ciclo de vida de la sala:** ¿campañas persistentes que duran meses, one-shots de una sesión, o ambos? ¿Puede entrar un jugador nuevo a mitad de campaña? ¿Qué pasa si el host abandona?
10. **Descubrimiento:** ¿solo salas privadas por invitación/código, o también salas públicas listadas? (Público implica moderación y política de contenido entre desconocidos.)

### P3 — Pueden esperar
11. **Espectadores** (ver una partida sin jugar) y compartir partidas como lectura.
12. **Identidad social:** perfiles, historial de personajes, "trofeos" de campañas.

---

## 6. Riesgos y retos de diseño

1. **Coherencia narrativa a largo plazo.** El riesgo nº 1 del género: a las 40 sesiones la IA olvida que el herrero murió en la sesión 3. Mitigación de producto: el **estado de mundo como fuente de verdad** (hechos establecidos explícitos, no solo prosa) + **resúmenes por capítulos** (entidad "Memoria de partida") + la ficha de personaje siempre actualizada. La prosa se puede olvidar; los hechos, no.

2. **Latencia percibida.** Cada turno implica generación de IA, y aquí puede haber *dos* generaciones (Narrador + Cronista). Mitigaciones de experiencia: respuesta en streaming (el texto va apareciendo, como en Claude.ai), resolver primero el log de personaje (lo que el jugador espera) y dejar que el log de mundo "llegue" un instante después — que de hecho refuerza la ficción de que el mundo va por su cuenta —, y microtextos de espera con sabor ("el destino baraja sus cartas…").

3. **El jugador que rompe el mundo.** "Saco mi bazuca" en fantasía medieval, "convenzo al rey de que me dé el trono". Mitigaciones: el **contrato de mundo** (sección 3) da a la IA una base explícita para decir que no *dentro de la ficción* ("buscas en tu zurrón, pero eso no existe en este mundo"); las acciones desproporcionadas se resuelven con **consecuencias, no con vetos** ("puedes intentar insultar al rey; los calabozos son fríos"); y los atributos del personaje deberían pesar en qué es plausible (un pícaro carismático puede lo que un bárbaro no). Decidir si hay azar mecánico visible (tiradas) es una decisión de producto pendiente.

4. **El mundo como ruido.** Riesgo inverso al anterior: si el log de mundo escupe eventos constantes e irrelevantes, el jugador dejará de leerlo y la feature diferencial muere. El Cronista necesita **presupuesto y criterio de pertinencia**: pocos eventos, con intención, y que de vez en cuando *converjan* con la historia del jugador (el rumor de la sesión 2 se vuelve la amenaza de la sesión 8). Métrica de diseño: el jugador debería *querer* mirar el panel de mundo.

5. **Guardado y reenganche.** Partidas de semanas: el jugador vuelve y no recuerda nada. El **diario por capítulos** (pantalla 11) y el mini-resumen en la lista de partidas ("Estás en…, buscando…") son parte del producto, no un extra. El guardado debe ser automático por turno — nunca un botón que se puede olvidar.

6. **Página en blanco.** Un textarea vacío intimida: muchos jugadores no sabrán qué escribir. Mitigación: 2–3 **sugerencias de acción** contextuales bajo el input (tocables, editables), sobre todo en los primeros turnos y tras eventos de mundo. Es probablemente la decisión de UX con más impacto en retención temprana.

7. **Contenido sensible.** Terror, violencia, temas adultos: cada mundo debería declarar su clasificación y el usuario sus límites (preferencias de contenido). En online el riesgo se multiplica: texto libre entre desconocidos exige política de contenido y herramientas de mesa (expulsar, reportar) desde el primer día del modo público, si lo hay.

8. **Coste por sesión.** Sin entrar en tecnología: cada turno consume generación de IA, y las partidas largas con doble log consumen mucho. Es un dato de producto porque condiciona el modelo de negocio (¿gratis limitado?, ¿suscripción?, ¿energía/turnos?) y conviene tenerlo en la cabeza al decidir, p. ej., cuánto genera el Cronista por turno.

9. **Expectativas offline.** "Offline" en la descripción significa "partida individual", pero el nombre sugiere "sin conexión", y un juego con IA difícilmente funciona sin red. Riesgo de confusión de naming: considerar "En solitario / Multijugador" en lugar de "Offline / Online".

---

## 7. Siguientes pasos sugeridos

Decisiones de producto a cerrar **antes** de hablar de tecnología, en orden:

1. **Alcance del MVP.** Recomendación: el MVP es **solo el modo en solitario** (Home → mundos → personaje → vista de juego con doble log). El modo online depende de decisiones P0 aún abiertas y multiplica la complejidad; el corazón diferencial (el mundo que vive) se valida perfectamente en solitario.
2. **Definir 2–3 mundos semilla completos** (p. ej. fantasía medieval + uno más contrastado como terror o ciencia ficción), cada uno con su contrato de mundo, tono, letalidad, NPCs/facciones semilla y 3–4 personajes pregenerados. Esto obliga a concretar qué es exactamente un "mundo" como producto.
3. **Decidir la profundidad mecánica del personaje:** ¿los atributos son solo color narrativo, o tienen efecto real en la resolución (con o sin tiradas/azar visible)? Define la ficha, la creación de personaje y el comportamiento del Narrador.
4. **Decidir el modelo de tiempo ficticio:** cuánto avanza el mundo por turno, y qué pasa (nada, por defecto) cuando el jugador no juega. Define al Cronista.
5. **Escribir el "guion de una sesión tipo":** una partida de 15–20 turnos redactada a mano (jugador ficticio + ambas voces + evolución de los dos paneles). Es el prototipo más barato posible: valida el ritmo, el reparto entre logs y el tono antes de construir nada, y luego sirve de especificación de comportamiento para la IA.
6. **Boceto de la vista de juego** (wireframe): resolver ya la duda "paneles lado a lado vs apilados", qué pasa en móvil (¿pestañas?), y dónde viven ficha, diario y sugerencias de acción.
7. **Cerrar naming y tono de la app** (incluida la duda Offline/Online vs En solitario/Multijugador) y la política de contenido por mundo.
8. **Responder las preguntas P0 del modo online** (sección 5) — no para construirlo ya, sino para que ninguna decisión del MVP en solitario lo haga inviable después (p. ej. el modelo de turno y la entidad Sala ya están contemplados en el dominio).

Con los puntos 1–5 cerrados, el proyecto está listo para la fase de decisiones técnicas.
