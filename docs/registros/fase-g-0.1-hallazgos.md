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
| Crear partida y primer turno | 🚧 en curso |
| Gistera | pendiente |
| Zona y movimiento | pendiente |
| Caza en solitario y en grupo (aviso de riesgo) | pendiente |
| Cadáveres, saqueo y Goirnos | pendiente |
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
