# Revisar partida — runbook

**Qué es:** los pasos exactos para cuando la usuaria escriba **"revisar partida"** (o pida comprobar
cómo va su sesión en curso). Objetivo: la próxima vez, ejecutar directamente en vez de tener que
volver a decidir qué mirar. Ver también la memoria `feedback_comando_revisar_partida` (Claude Code),
que dispara este mismo proceso automáticamente al ver esa frase.

## 1. Volcar el estado real de la partida

```
cd backend
npx tsx src/scripts/auditSave.ts [saveId opcional, si no se coge la última jugada]
```

Este script (solo lectura) imprime: datos de `Save` (nivel/XP/condición física/ubicación/fecha
ficticia), `WorldState.facts`/`factionsStatus`, `CharacterTransit` activo, `Quest`, `NpcState`
(con su `scope`), inventario, compañeros, capítulos, y el log completo (personaje + mundo) en
orden cronológico.

## 2. Revisar logs/backend.log

Ruta corregida (2026-08-26) — el arranque real (`iniciar-tarkor.sh`) escribe en `logs/backend.log`
en la raíz del proyecto, nunca en `backend/dev-server.log` (nombre antiguo, ya no existe).

```
grep -iE "warn|error|lint|turno" logs/backend.log
```

- Líneas `[lint]` → `lintRegionMismatch` detectó que la narración mencionó una región distinta a
  donde está el personaje.
- Líneas `[turno]` → diagnóstico determinista de cada turno: qué detectó `npcsInScene`, si saltó
  `lootMode`/`harvestSource`/`itemRef`/`npcAttackTarget`/`combateIniciado`. Es la pieza más útil
  para encontrar falsos positivos/negativos de los detectores de texto libre.
- `console.warn` sueltos → reintentos fallidos de `narrateAction`, o avisos de RAM baja al arrancar.

## 3. Revisar en fases separadas, cada una agotada antes de pasar a la siguiente

Formato añadido 2026-08-27 (petición explícita: "divide en fases... vas haciendo cada fase
individualmente y así creo que detectaremos más cosas"). Reemplaza el paso 3 monolítico anterior —
mezclar criterios distintos en una sola pasada hacía más fácil pasar cosas por alto. 5 fases, en
este orden, cada una investigada y agotada (con sus propias consultas/lecturas si hace falta) antes
de anotar y pasar a la siguiente. Al terminar TODAS, un único informe con los hallazgos de las 5.

### FASE 1 — Funcionalidad / integridad técnica

¿Hay algo colgado o roto a nivel de estado, más allá de lo narrativo? Revisar directamente contra
la BD (Prisma), no solo el JSON público de `/saves/:id`:
- `pendingDynamicMode`, `characterTransit`, `pausedAt` deberían estar `null` salvo que de verdad
  haya algo en curso — si hay uno viejo, sospechar de un flujo que no limpia bien al cerrarse.
- `deathCount`/`condicionFisica`/nivel/XP consistentes entre sí y con lo que cuenta el log.
- `NpcState` del combate en curso (si lo hay): `energia`/`condicionFisica` coherentes con los
  intercambios ya narrados — no dar por bug algo que resulte ser fatiga normal simétrica NPC/jugador.
- Inventario/misiones/habilidades: nada huérfano, duplicado, o con `catalogSlug` que no case con
  ningún objeto real (usar el propio `auditSave.ts` para esto, ya lo vuelca todo).

### FASE 2 — Coherencia narrativa

¿La historia se contradice a sí misma? Releer el log completo (personaje + `SessionFact`, en
orden cronológico) buscando:
- **Hechos protegidos contradichos** — un `SessionFact` que dice "X ya no está en escena, no
  volverá a aparecer" y un turno posterior donde X reaparece (con o sin nombre) — ver el caso real
  del 2026-08-27 (Gistera Koh reintroducida vía `sessionFacts` contaminando `detectNpcsInScene`,
  hueco DISTINTO de los guards `hasFalseGisteraNamedReturn`/`hasGisteraReencuentroSinNombrar` ya
  FIJADOS el 2026-08-13, que solo comprueban la narración libre, no el camino determinista).
- **NPCs que resucitan o repiten loot** — un `NpcState` `INCAPACITADO`/`MUERTO` no debería
  narrarse vivo otra vez; `saqueado: true` no debería poder saquearse de nuevo.
- **Continuidad rota tras un evento fuerte** (muerte/respawn, viaje largo, salto de capítulo) —
  comparar el turno inmediatamente ANTERIOR y el inmediatamente POSTERIOR al evento: ¿el mundo
  "recuerda" lo que pasó, o el LLM narra como si reiniciara la escena desde cero?
- **Objetos/eventos de color repetidos sin memoria** — el mismo detalle decorativo (un objeto que
  "cae al suelo" varias veces, un gesto repetido) en turnos distintos del mismo combate/escena.
- **Anacronismos** (pólvora, tecnología moderna) y **atribución de arma/objeto incorrecta** (un
  arma de un NPC en manos de Gorhorn) — clases de fallo ya vistas, comprobar que no se colaron.
- **Progresión rara** (XP/nivel/fecha ficticia saltando de forma incoherente) y **misiones
  atascadas o duplicadas**.

### FASE 3 — Vocabulario y prosa

¿La redacción en sí es de calidad, más allá de si los hechos que cuenta son correctos?
- **Repeticiones/fórmulas recicladas** — la misma frase o estructura casi calcada usada varias
  veces en el mismo tramo de partida (ej. "mancha roja en tu pecho" ×3 en un combate).
- **Contradicción interna en la misma frase** — una oración que se desmiente a sí misma (ej.
  "bloquea sin daño... dejando una mancha roja") — clase de fallo NUEVA (2026-08-27), ningún guard
  `hasFalse*` existente la cubre porque todos comparan narración-vs-mecánica, nunca narración
  contra sí misma.
- **Mezcla de punto de vista** — saltos de tercera a segunda persona (o viceversa) sin transición
  dentro del mismo párrafo.
- **Errores gramaticales sueltos / vocabulario impreciso** — familia ya documentada desde
  2026-08-08, verbos que no encajan ("lame la maza" en vez de "alza"), género inconsistente.
- **Coherencia de hora del día** — la ambientación debería casar con `fictionalDateLabel`/
  `timeLabel` (mañana/tarde/noche) — recordar que `timeLabel` no se inyecta como contexto real al
  Narrador (`turnResolution.ts`), causa raíz conocida de por qué puede fallar esto.

### FASE 4 — Lore

¿Lo narrado encaja con el mundo real ya establecido en el catálogo (facciones, geografía, historia,
personajes)? Cruzar cualquier nombre propio mencionado en la narración/`SessionFact` contra
`Npc`/`Location`/`Faction` reales (Prisma) antes de dar algo por bien o mal:
- **Topónimos/geografía inventada** — un lugar mencionado que no existe, o un lugar real descrito
  con una naturaleza que no tiene (ej. 2026-08-27: "el río Karot Veku" — Karot Veku es un
  campamento amurallado real, nunca un río).
- **Facción/rol/relación incorrectos** — un NPC actuando o descrito de forma que contradice su
  ficha de catálogo (`role`, `faction`, `personality`, `bio`).
- **Hechos protegidos de trasfondo** — igual que en FASE 2 pero a nivel de lore de fondo, no de
  la escena inmediata (ej. Gorhorn como único superviviente conocido del Clan Maktor).
- Si el catálogo en sí es rico y coherente pero el LLM inventa fuera de él, la causa suele estar
  en falta de contexto real pasado al prompt (ver detectores de texto libre / `hasFalseNpcAppearance`
  en `npcScene.ts`), no en el catálogo — señalarlo así en el hallazgo.

### FASE 5 — UX de lo que se ve en pantalla en ESTA partida

No es una auditoría general de UI (eso ya tiene su propio checklist aparte, `docs/frontend-*`) —
solo si lo que ve la jugadora en ESTA partida concreta es claro y correcto:
- Cifras visibles (nivel, XP, puntos de atributo pendientes, contador de muertes/vidas) correctas
  y bien expuestas — comprobar la regla real antes de reportarlo como bug (ej. los puntos de
  atributo (ASI) solo se ganan en ciertos niveles, `progression.ts` — nivel 2 sin puntos es
  correcto, no un bug).
- Estado de combate/misión/inventario que se muestra en pantalla coincide con el estado real (ver
  FASE 1) — si hay desajuste, es un bug de UI, no solo de datos.

### Detectores de texto libre con falsos positivos/negativos (aplica a FASE 2/4)

Usar el campo `npcsInScene` de la línea `[turno]` como pista: si aparece un NPC que no tiene
sentido para la acción del jugador, sospechar de `matchNpcAliases` (`npcScene.ts`). Fallos
concretos ya confirmados por este runbook (2026-07-20):
1. Los alias de 1-4 letras (p. ej. `"res"` de múrgol) se comprueban con `normalized.includes(alias)`
   **sin ningún filtro de longitud** — a diferencia de la rama de tolerancia a erratas (que sí exige
   5+ letras), así que `"res"` matchea dentro de cualquier palabra que lo contenga como substring
   ("p**res**as", "inte**res**ante", "**res**ponder"...).
2. La tolerancia a erratas (distancia Levenshtein ≤2) puede producir coincidencias de significado
   nada que ver por pura casualidad ortográfica — `"presas"` está a distancia 2 de `"brasas"`
   (alias del Rondador de Brasas), así que cualquier acción que mencione "presas" lo detecta en
   escena sin que el jugador lo haya mencionado ni esté cerca.
3. `sessionFacts` concatenado sin filtrar en el `haystack` de `detectNpcsInScene` (2026-08-27) —
   un fact que MENCIONA a un NPC para decir que se fue para siempre igual lo reintroduce, porque el
   matcher solo busca el nombre, no si el fact es de presencia o de despedida.

Para reproducir/verificar cualquier sospecha nueva de este tipo: importar `matchNpcAliases`/
`levenshtein`/`normalizeText` de `services/npcScene.js`/`services/travel.js` en un script suelto
bajo `src/scripts/`, probar la acción exacta contra los alias del NPC sospechoso, y borrar el
script al terminar (no dejar debug suelto en el repo).

## 4. Reportar

Conciso: qué está bien, qué anomalías concretas (citando la línea de log exacta), y si algo es un
bug de código de verdad (no solo una rareza puntual del modelo) proponer el fix — pero no aplicarlo
sin decirlo primero y esperar luz verde, salvo que la usuaria ya haya pedido explícitamente que se
arregle en el mismo mensaje.

## 5. Registrar el hallazgo

Antes de dar por nuevo cualquier fallo, mirar `docs/registros/revisar-partida-hallazgos.md` — puede que ya se
haya visto y se sepa si tiene fix determinista, está pendiente, o se decidió que no era bug. Al
terminar la auditoría, añadir SIEMPRE una entrada nueva al final de ese archivo (fecha, síntoma
citado, causa raíz si se conoce, y estado: FIJADO/PENDIENTE/NO ES BUG), haya o no fix ya aplicado.
Ese archivo tiene un índice al principio (por fecha, 2026-08-13) — añadir también ahí la entrada
nueva, bajo la fecha correspondiente (nueva fecha = nuevo grupo).
