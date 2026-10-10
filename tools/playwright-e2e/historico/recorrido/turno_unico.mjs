// Proceso Node AISLADO por turno — bug real confirmado (2026-09-08): el fetch nativo de Node
// (undici) se cuelga en la 2ª+ llamada consecutiva dentro del MISMO proceso contra /turn/narrate
// (streaming NDJSON manual del backend), incluso con Connection:close. Un proceso nuevo por
// llamada (sin reutilizar el runtime/pool de undici) es la única forma fiable encontrada — el
// coste de arrancar Node de nuevo (decenas de ms) es insignificante frente a la narración real.
const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';
const [,, action, enCombateArg, lootItemNamesArg, allowAfterEndedArg] = process.argv;
const enCombate = enCombateArg === 'true';
const lootItemNames = lootItemNamesArg ? JSON.parse(lootItemNamesArg) : null;
const allowAfterEnded = allowAfterEndedArg === 'true';

const classifyRes = await fetch('http://localhost:3001/turn/classify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ saveId: SAVE_ID, action, enCombate }),
});
if (!classifyRes.ok) { console.error('classify falló:', classifyRes.status, await classifyRes.text()); process.exit(1); }
const classifyBody = await classifyRes.json();
// Bug real detectado (2026-09-08): el classify puede responder `{ blocked: {...} }` en vez de
// `{ classification, roll, ... }` (acción rechazada de raíz, p. ej. destino desconocido) — sin
// este chequeo, narrate fallaba con 400 "Faltan campos" de forma confusa, y encima el propio
// combate/estado de un turno ANTERIOR seguía en la BD, dando la falsa impresión de que este turno
// nuevo sí había hecho algo cuando en realidad nunca llegó a enviarse.
if (classifyBody.blocked) {
  console.error('BLOQUEADO por el clasificador:', classifyBody.blocked.narration);
  process.exit(1);
}
// Bug real detectado (2026-09-08): faltaba reenviar `travel` (y `npcsInScene`) del classify al
// narrate — sin `travel`, el backend nunca sabe que la acción es un viaje entre Locations, así
// que el jugador se quedaba narrativamente "moviéndose" sin cambiar nunca de currentLocationId.
const { classification, roll, travel, npcsInScene } = classifyBody;

const narrateRes = await fetch('http://localhost:3001/turn/narrate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ saveId: SAVE_ID, action, classification, roll, travel, npcsInScene, enCombate, lootItemNames, allowAfterEnded }),
});
if (!narrateRes.ok) { console.error('narrate falló:', narrateRes.status, await narrateRes.text()); process.exit(1); }
const text = await narrateRes.text();
console.log(text);
