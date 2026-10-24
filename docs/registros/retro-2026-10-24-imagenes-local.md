# Retro y opt-tokens · `claude/imagenes-local` (2026-10-24)

**Estado:** aprobadas las cinco por la usuaria (2026-10-24) y aplicadas: `QA-222`…`QA-226`.

Sesión de CFG-38…CFG-40 y `probar.sh`: 343 llamadas, 4 compactaciones, contexto medio 114k (techo ~162k por tramo,
dentro de lo previsto con la ventana de 200k). Un subagente (Opus, 11 llamadas). 26 imágenes leídas, casi todas para
juzgar la imagen generada, que es el trabajo en sí.

## Propuestas, de más a menos peso

1. **Mapa del agente: sección «Imágenes»** (navegación, del proyecto). `docs/mapa-agente.md` no tiene el sistema de
   prompts de imagen; la sesión lo buscó con `find`/`grep` y releyó `01-generacion-imagenes-local.md` 21 veces
   (876k tokens arrastrados, la lectura más cara) e `imagePromptGenerator.ts` 28 veces (470k). La sección daría:
   `imagePromptGenerator.ts` (`buildPrompt`, `generateImagePrompt`, `REGION_ESCENA`), `imagePromptContext.ts`
   (`loreContextFor`, `ejemplosDePromptsUsados`), rutas `image-prompt` de `world.ts`, `ImagePromptDisplay.tsx`, sus
   tests, la tabla `ImagePrompt`, `image-generator/scripts/` y qué apartado del documento leer para cada cosa.
   Coste: bajo. Riesgo: ninguno (`mapa-agente.py` comprueba que las rutas existen).
2. **Análisis de `CFG-42` en un subagente** (opt-tokens, del proyecto). Analizar las tandas de la usuaria es leer
   muchas imágenes (~1.600 tokens cada una, arrastradas el resto de la sesión). Un subagente lee `registro.tsv`,
   `notas.md`, los prompts y las imágenes, y devuelve por imagen qué funcionó y qué no; la principal mira solo las
   2-3 que decidan cada propuesta. Ahorro estimado: ~1-2M tokens arrastrados por tanda de 20 imágenes. Riesgo: juicio
   visual más pobre si el subagente es barato; contrapeso, el subagente con el modelo grande y la principal mirando
   las imágenes clave. Se apunta en la entrada de `CFG-42`.
3. **Reiniciar el backend de desarrollo** (acceso a la información, del proyecto). `tsx watch` no ve los cambios
   hechos desde el sandbox de VS Code: hubo que reiniciar a mano cuatro veces, una petición dio con el código viejo
   (tras un `git stash`) y otra se adelantó al arranque. Un `tools/qa/backend-dev.sh` que pare, arranque y espere a
   que responda el puerto 3001, o una línea en `rondas-de-pruebas.md` con la orden. Coste: bajo. Riesgo: ninguno.
4. **SQL de la base de desarrollo con `sql.sh`** (economía, del proyecto). Se escribió `flatpak-spawn … podman exec
   … psql` con comillas triplemente escapadas varias veces; `tools/qa/sql.sh` ya lo resuelve, pero apunta a
   `tarkor_juego` y la enciclopedia usa `tarkor`. Se dice en la sección del punto 1:
   `TARKOR_DB_URL=postgresql://tarkor:tarkor@localhost:5432/tarkor tools/qa/sql.sh`. Coste: una línea.
5. **`generar.sh` con el texto en vez de la ruta** (comprobación, del proyecto). Se le pasó el prompt como texto y
   abortó con «prompt vacío o inexistente: <texto entero>». Mensaje que diga «el tercer argumento es la ruta del
   archivo de prompt». Coste: una línea.

## Lo que salió bien

- La revisión de la fase 1 encontró el vigilante de `generar.sh` que dejaba `sd-cli` vivo: justo lo que protege la
  Deck de congelarse. Arreglado y comprobado con un `timeout` + `sleep`.
- Probar con el LLM real y en la Deck antes de cerrar sacó el español colado y el nievón sin región, que los tests
  con mocks no veían.

## For Galivelop-workflow

- Nada general esta vez: todo lo de arriba es del proyecto.
