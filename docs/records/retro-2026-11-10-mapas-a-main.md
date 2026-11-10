# Retro 2026-11-10 · `claude/generador-mapas` a `main`

Sesión: traer `main`, la decisión del agente local (`MAP-17` → `MAP-18`), la fase 1 de la revisión (15 hallazgos, 7
arreglados en `0d7e8608` por un subagente con Sonnet) y la medida de `/gw-opt-tokens` (32 llamadas, 73k de contexto
medio, sin compactar; los subagentes, 3,8 M de entrada: la revisión con Opus, 2,4 M).

**Estado:** aprobada por la usuaria (2026-11-10): P1 aplicada en `tools/qa/tests-vitest.sh`; P2 al workflow (abajo); P3 es una nota, sin cambio.

## Propuestas

1. **El pre-push en la Deck levanta el Ollama simulado** (proyecto). El pre-push corrió los tests de integración
   unos 10 minutos y falló con 20 rojos `ECONNREFUSED 127.0.0.1:11434`; hubo que buscar en `ci-local.sh` cómo se
   levanta el simulado y repetir el push. Cambio: `tools/qa/tests-vitest.sh integracion` hace lo que ya hace
   `ci-local.sh` (l. 60): si el 11434 no contesta, arranca `tools/ci/mock-ollama.mjs` (vía `host.sh` en la Deck).
   Ahorro: un push fallido y unos 3 pasos para diagnosticarlo (~100k tokens arrastrados en esta sesión).
   Riesgo: ninguno nuevo; con el Ollama real en marcha contesta él, como hoy.
2. **`related-tests.sh` no repite la lista de archivos** (Galivelop-workflow). Al fallar imprime la orden completa
   dos veces, con ~150 rutas (4k tokens, 83k arrastrados: el resultado más caro de la sesión); al pasar, una vez.
   Cambio: imprimir «N archivos» y escribir la orden completa en un archivo temporal que se nombra. Riesgo: ninguno.
3. **La revisión de la fase 1 sin verificar** (proyecto, nota). `/code-review` con `--max-findings all` dio 15
   hallazgos sin pasada de verificación; el subagente de los arreglos hizo de verificador (cada uno, con un test rojo
   sin el arreglo). Basta con decirlo en el encargo del subagente que arregla (ya pasa); sin cambio.

## For Galivelop-workflow

- `related-tests.sh`: en el mensaje de rojo y en el de inicio, el número de archivos en vez de la lista; la orden
  completa a un archivo temporal (propuesta 2).
