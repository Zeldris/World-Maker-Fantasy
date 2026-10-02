# Fase G del 0.1 — pasada de juego completa: hallazgos (vivo)

Guion en [`plan-roadmap-0.1.md` § Fase G](../producto/plan-roadmap-0.1.md#fase-g--pasada-de-juego-completa-opus-con-el-navegador).

Entorno: contenedor en la nube con Postgres local, **Ollama simulado** (`tools/ci/mock-ollama.mjs`),
backend (`npx tsx src/server.ts`, viajes acortados con `TRAVEL_SEGUNDOS_*`) y frontend (`vite`),
manejados con Chromium por CDP. Todo lo determinista (interfaz, movimiento, combate, Reino) se prueba
de verdad; **la calidad narrativa no** (las narraciones son del simulador). Esa parte queda para una
pasada con Ollama real en la máquina de Álvaro.

Partida: Gorhorn, **Cazador** (su clase real), dificultad Novato.

## Estado del guion

| Tramo | Estado |
|---|---|
| Crear partida y primer turno | ✅ (G1, G2, G3) |
| Gistera | ✅ «Alguien» en el mapa → Interactuar → escena guionizada de 3 vueltas → acepta → se marcha y crea «Acabar con el Orco Enfurecido» (G9) |
| Zona y movimiento | 🚧 mapa, ficha de punto e «Ir hasta aquí» funcionan; faltan salidas a otra zona |
| Caza en solitario y en grupo (aviso de riesgo) | 🚧 solitario ✅ (G4, G5); en grupo: aviso de riesgo ✅, arranque arreglado (G10), intercambios del jugador en estudio (G11) |
| Cadáveres, saqueo y Goirnos | 🚧 cadáver de fauna y desollar ✅ (G8); falta saqueo de un NPC y Goirnos |
| Recolección con cada método (ficha de flora) | pendiente |
| Combate con muerte y renacer | pendiente |
| Compañeros | pendiente |
| Reino (fundar, construir, taller, diplomacia con XP, mercado) | pendiente |

## Hallazgos

| # | Hallazgo | Estado |
|---|---|---|
| G1 | La narración enlazaba palabras comunes como si fueran entidades: «algo que **tira** de él» salía como el NPC «Tira», y el chip mostraba el nombre canónico en vez de la palabra («las **Roca de Llanura Roja**» por «las rocas»). | ✅ 2026-10-02: los nombres propios (NPC, lugar, personaje) solo se enlazan si en el texto llevan alguna mayúscula, y el chip de la narración muestra la palabra tal cual. Una sola función (`buscarMenciones` en `lib/enciclopediaIndex.ts`) para narración, composer y banner. |
| G2 | Con un único mundo (y con un único personaje preseleccionado) «Continuar» está desactivado hasta pulsar la tarjeta: un clic de más sin elección real. | ✅ 2026-10-02: con un único mundo o un único preseleccionado jugable, sale ya elegido (`WorldSelect.tsx`, `CharacterSelect.tsx`). |
| G3 | Al elegir clase, el diario decía «asume su clase: CAZADOR» (el nombre interno en mayúsculas). | ✅ 2026-10-02: sale «Cazador» (`enumLabel` de `imagePromptContext.ts`, ya existente, ahora exportado); test de `turn.integration` lo comprueba. |
| G4 | En el panel de combate (estrecho), la tirada «Actúas primero» no cabía: la fórmula del rival se cortaba y salía barra horizontal. | ✅ 2026-10-02: los dos lados de `DiceRollVs` se acercan y, si no caben, el rival baja debajo (`DiceRoll.tsx`). |
| G5 | «Capturar» a un rival convaleciente sin cuerdas no hacía nada visible: el backend daba el motivo (400 «Necesitas cuerdas…») y el frontend se lo tragaba. Igual en «Clemente». | ✅ 2026-10-02: el motivo sale en el diario (`useCombatFlow.ts`, `avisarErrorEnLog`), con 2 tests. Mejora posible aparte: avisar antes de pulsar (el backend ya expone `tieneCuerdas` en `GET /capturables`). |
| G6 | La habilidad «Analisis Salvaje» va sin tilde. | pendiente — el nombre hace de identificador de las `SavedAction` ya guardadas (anti-duplicado por nombre en `progression.ts`): cambiarlo necesita migrar las partidas existentes. |
| G7 | Cuando el narrador cae al texto fijo de respaldo (3 intentos fallidos), en combate podía contradecir el intercambio: «La acción no sale como se esperaba» junto a «Gana Gorhorn · el golpe conecta». | ✅ 2026-10-02: en un intercambio, el respaldo dice solo lo seguro («El intercambio se salda con un golpe que conecta» / «Ningún golpe llega a conectar») según `combatRealHitLanded`/`combatBothMissed` (`narrador.ts`); test nuevo. |
| G8 | Tras matar a una presa en combate 1v1, el aviso «Hay presas caídas sin desollar» no salía hasta cambiar de escena o recargar (el cadáver sí estaba en el backend). | ✅ 2026-10-02: `GameView.tsx` recomprueba los cadáveres al pasar de combate a sin combate. Desollar comprobado: 3 trozos de quitina, +25 XP, el aviso desaparece. |
| G9 | Despedida de Gistera: «…si nos volvemos a ver te lo agradeceré como corresponde!» sin «¡». | ✅ 2026-10-02: «Gracias, Gorhorn. No puedo quedarme aquí más tiempo, pero si nos volvemos a ver, ¡te lo agradeceré como corresponde!» (`dynamicMode.ts`). |
| G10 | Tras matar a un Gesgurio, «Cazar» un grupo de Gesgurios en la misma zona abría la ficha del muerto («El cuerpo ya está registrado») en vez del combate: el estado de fauna es por especie y lugar, y el turno interceptaba el texto de la propia caza como «tocar el cadáver». | ✅ 2026-10-02: `/turn/classify` no intercepta el texto de la caza (`esActionTextDeCaza`) ni con un combate de grupo en curso (`turn.ts`); 3 tests en `turn.classify.test.ts` (2 fallan sin el arreglo). |
| G11 | En el combate de grupo de la partida en vivo, las acciones de Gorhorn no quedaron como intercambio (sin tarjeta de dados, el Gesgurio siguió «Ileso» 5 rondas) mientras los ataques del enemigo sí le hirieron hasta morir. Con el mismo flujo por API (`repro-grupo.ts`, local) el intercambio sí se guarda: el fallo depende de algo del frontend o del estado previo (fase de defensa). | 🚧 investigando |
