# Retro del PR de las tandas 8-14 del 3.3 (2026-10-22)

Lo revisado: lo que entra con el PR a `main` desde `claude/pruebas-3.3` (`git log origin/main..HEAD`):

- las tandas 8-14 del paso 3.3 (`plan-comprobacion-3.3.md`), con la 13a y la 13b partidas en cinco;
- el cierre del reparto (no jugables, lista de los sin ver) y los nuevos P303-P311;
- el `/code-review --max-findings all` previo: 11 hallazgos, todos arreglados en `367caf18` (grupo «no jugables» en
  `marca-hallazgo.py`, `juego.sh` sin `_path.sh`, notas del runbook contradictorias, dos `.dump` de más).

También se revisan `opt-tokens`, `opt-ai`, `orchestrate-dealer` y `/code-review`.

**Estado (2026-10-22): la usuaria aprobó las seis propuestas.** Aplicadas en la rama: 1 → `QA-195`, 3 → `QA-197`,
4 → `QA-198`, 6 → `QA-200`. Al paso 3.4, sin implementar: 2 → `QA-196` (chuleta del driver) y 5 → `QA-199`
(partidas intermedias fuera de git).

## Medida

`/opt-tokens` desde `879de97c`: la principal hizo 73 llamadas con un contexto medio de 121k. Los 11 subagentes de las
tandas hicieron 500 llamadas (el 80 % de la entrada). Cada uno arrancó con 35k y llegó a un contexto medio de 56-84k.
El tope de 60 llamadas (`QA-189`) se cumplió en todas las tandas; en el PR anterior, las tandas 6 y 7 hicieron 87 y 99.
Cuatro tandas llegaron al tope sin terminar: 13a-1, 13a-2, 13a-3 y 13b-1.

`/opt-ai` sobre `logs/ia/2026-10-22.jsonl` (perfil `deck`, la tanda 14) solo tiene 3 turnos: p50 35 s, p95 63 s,
narrador a 10,8 tok/s, sin intento 2 ni respaldo. Tres turnos no bastan para comparar con el bench 10 (16 turnos).
Las dos incoherencias de la tanda no son de RAG, así que ninguna se puede fijar como caso de `rag-eval`:

- **P310 es código.** El texto fijo sale de `playerActionValidation.ts:201`, que no distingue a una NPC conocida que
  no está presente de una desconocida.
- **P311 es del modelo (`ignorado`).** El narrador mezcla dos voces en un mismo párrafo, sin que le falte nada del
  índice.

## Lo que funcionó

- **Tandas de 6-8 hallazgos y partirlas al vuelo.** Ninguna pasó de 60 llamadas. Al partirse, cada mitad guardó la
  partida y la siguiente siguió desde ahí.
- **Retomar con `SendMessage`.** Cuando el límite de la API cortó una tanda, se retomó el mismo subagente y no se
  perdió nada.

## Propuestas

1. **Que `marca-hallazgo.py --comprobar` avise de un «reabierto» que no cuenta como pendiente.** Los subagentes
   escriben lo nuevo delante del estado viejo. Por eso P116 («Reabierto… arreglo ✅») contaba como arreglado y
   P189 («comprobado jugando…; falta ver una hora entera») contaba como comprobado. Los dos salieron en el
   `/code-review`, no al marcar. El aviso saldría en CI, y la fila se arregla al momento.
2. **Una chuleta del driver en lugar de notas por tanda.** «Fallos de las herramientas» crece unas 12 líneas por
   PR, y cada tanda la lee entera al arrancar (35k). Ya ha tenido notas que se contradicen y otras repetidas. La
   propuesta: rehacerla como chuleta por herramienta (`mover.js` pide `{x,y}`, cómo abrir una ficha, cómo cerrar un
   modal) y borrar las notas ya resueltas. Es tarea del 3.4, junto a `QA-193`.
3. **`escenario.sh dar` permitido en las tandas.** El modo auto lo denegó en la 13b-1. Sin agua ni comida, Gorhorn
   llegó convaleciente y la tanda gastó llamadas en buscar agua. La propuesta: una regla de permiso en
   `.claude/settings.json` solo para `bash tools/qa/escenario.sh dar …`. Pide tu decisión.
4. **Un test mínimo para los atajos de la Deck.** `juego.sh` (`QA-192`) llegó roto al PR anterior y no se vio hasta la
   tanda 14, porque `tools/qa/deck/` está exento de tests. La propuesta: un test que exija que todo atajo que lleve a
   `psql`, `pg_dump` o `arrancar-juego.sh` cargue `_path.sh`.
5. **Las partidas intermedias de una tanda, fuera de git.** Este PR subió 5 `.dump` de unos 900 KB cada uno; dos se
   quitaron, pero ya están en el historial. La propuesta: que `escenario.sh guardar` deje las intermedias en `logs/`
   (ignorado) y solo suba a `tools/qa/escenarios/` lo que se guarde con `--subir`.
6. **Una tanda con Ollama real juega al menos 8 turnos** (`opt-ai`). Con 3 no hay medida comparable. La alternativa
   es pasar `bash tools/qa/bench-ia.sh` al cerrar la tanda.
