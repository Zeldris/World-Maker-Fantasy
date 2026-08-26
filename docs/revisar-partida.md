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

## 3. Leer el log turno a turno, buscando estas clases de fallo ya vistas en este proyecto

- **Anacronismos** (pólvora, tecnología moderna) — el prompt ya lo prohíbe, comprobar que no se coló ninguno.
- **Contaminación de región** — la narración menciona un sitio de otra región.
- **Atribución de arma/objeto incorrecta** — un arma de un NPC en manos de Gorhorn.
- **NPCs que resucitan o repiten loot** — un `NpcState` `INCAPACITADO`/`MUERTO` no debería narrarse vivo otra vez; `saqueado: true` no debería poder saquearse de nuevo.
- **Hechos protegidos contradichos** — Gorhorn como único superviviente conocido del Clan Maktor no se le atribuye a otro personaje.
- **Coherencia de hora del día** — la narración de ambientación (`/entorno`, `narrateAction`) debería ser coherente con `fictionalDateLabel`/`timeLabel` (mañana/tarde/noche). **Ojo:** hoy `timeLabel` NO se inyecta como contexto al Narrador (`turnResolution.ts` lo destructura pero solo lo usa para persistir el `LogEntry`, nunca en `contextBlocks`) — es una causa raíz real de por qué puede narrar cielo estrellado a las 08:00, no solo mala suerte del modelo.
- **Detectores de texto libre con falsos positivos/negativos** — usar el campo `npcsInScene` de la línea `[turno]` como pista: si aparece un NPC que no tiene sentido para la acción del jugador, sospechar de `matchNpcAliases` (`npcScene.ts`). Dos fallos concretos ya confirmados por este propio runbook (2026-07-20):
  1. Los alias de 1-4 letras (p. ej. `"res"` de múrgol) se comprueban con `normalized.includes(alias)` **sin ningún filtro de longitud** — a diferencia de la rama de tolerancia a erratas (que sí exige 5+ letras), así que `"res"` matchea dentro de cualquier palabra que lo contenga como substring ("p**res**as", "inte**res**ante", "**res**ponder"...).
  2. La tolerancia a erratas (distancia Levenshtein ≤2) puede producir coincidencias de significado nada que ver por pura casualidad ortográfica — `"presas"` (lo que busca cualquier exploración/caza) está a distancia 2 de `"brasas"` (parte del alias `"rondador de brasas"`), así que **cualquier acción que mencione "presas" detecta al Rondador de Brasas en escena**, sin que el jugador lo haya mencionado ni esté cerca.
  Para reproducir/verificar cualquier sospecha nueva de este tipo: importar `matchNpcAliases`/`levenshtein`/`normalizeText` de `services/npcScene.js`/`services/travel.js` en un script suelto bajo `src/scripts/`, probar la acción exacta contra los alias del NPC sospechoso, y borrar el script al terminar (no dejar debug suelto en el repo).
- **Misiones atascadas o duplicadas.**
- **Progresión rara** (XP/nivel/fecha ficticia saltando de forma incoherente).

## 4. Reportar

Conciso: qué está bien, qué anomalías concretas (citando la línea de log exacta), y si algo es un
bug de código de verdad (no solo una rareza puntual del modelo) proponer el fix — pero no aplicarlo
sin decirlo primero y esperar luz verde, salvo que la usuaria ya haya pedido explícitamente que se
arregle en el mismo mensaje.

## 5. Registrar el hallazgo

Antes de dar por nuevo cualquier fallo, mirar `docs/revisar-partida-hallazgos.md` — puede que ya se
haya visto y se sepa si tiene fix determinista, está pendiente, o se decidió que no era bug. Al
terminar la auditoría, añadir SIEMPRE una entrada nueva al final de ese archivo (fecha, síntoma
citado, causa raíz si se conoce, y estado: FIJADO/PENDIENTE/NO ES BUG), haya o no fix ya aplicado.
Ese archivo tiene un índice al principio (por fecha, 2026-08-13) — añadir también ahí la entrada
nueva, bajo la fecha correspondiente (nueva fecha = nuevo grupo).
