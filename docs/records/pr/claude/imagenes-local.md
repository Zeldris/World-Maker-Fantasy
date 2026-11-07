**Título:** Prompts de imagen: prompt usado editable, reglas de FLUX, región y ejemplos; probar.sh (CFG-38…CFG-40, QA-222…QA-226)

## Summary

Deja listo el circuito de pruebas de imágenes de la usuaria en la Deck: genera el prompt en la enciclopedia, lo
retoca y lo guarda como «prompt usado», genera la imagen con `probar.sh` y apunta qué le parece; luego Claude analiza
las tandas (`CFG-42`).

```text
POST /world/:slug/image-prompt          (enciclopedia, modo desarrollador)
  loreContextFor                        lore + región del canon (fauna: hábitat, hogar o lugarOrigen del objeto)
                                        + conMomento si la ubicación tiene hora o estación
  ejemplosDePromptsUsados               hasta 2 prompts usados de otras entidades (no sus variantes de sexo u hora)
  generateImagePrompt                   reglas de FLUX: estilo → sujeto → encuadre → escenario → luz → acabado,
    buildPrompt                         sin medidas ni negativos, símiles de naturaleza, todo en inglés
      REGION_ESCENA                     paisaje y luz de las 5 regiones (iconos y mapas, luz plana)
PUT  /world/:slug/image-prompt/usado    CFG-38: guarda el prompt editado aparte del base
```

```diff
 backend/prisma/schema.prisma
   model ImagePrompt
+    promptUsado    String?             # migración 20261024120000_image_prompt_usado
+    promptUsadoAt  DateTime?
 frontend/src/components/ImagePromptDisplay.tsx
+  caja «Prompt usado» editable, con guardar
 image-generator/scripts/
+  probar.sh <tanda> <tipo> <slug> <perfil> [semilla] [pasos]   # prompt de la base → imagen + registro.tsv + notas.md
   generar.sh                           # vigilante que mata también a sd-cli (no solo a timeout); mensaje de ruta
-  demo.sh                              → obsoleto/
 tools/qa/backend-dev.sh                # QA-224: reinicia el backend de desarrollo y espera a /health
 docs/mapa-agente.md                    # QA-222: sección «Imágenes»
```

## Evidence

- **Antes:**
  - El prompt generado salía con medidas, negativos y palabras en español («cuernos», «felino»).
  - No sabía en qué región vivía cada animal: el nievón salía sin escenario.
  - No había dónde guardar el prompt con el que de verdad se hizo la imagen.
  - Si el vigilante de `generar.sh` cortaba una generación, `sd-cli` seguía vivo, y en la Deck eso la congela.

  **Después:**
  - `imagePromptGenerator.test.ts` y `imagePromptContext.test.ts`: 55/55. Cubren el orden de las reglas, la línea
    `Setting:` por región, la luz plana de zona e icono aunque haya momento, la regla de traducir al español, la región
    del nievón por `lugarOrigen`, `conMomento` con solo estación y los ejemplos sin variantes propias.
  - `world.test.ts`: 29/29, con las rutas GET, POST y PUT de `image-prompt`.
  - `ImagePromptDisplay.test.tsx`: 7/7.
  - Los tests nuevos fallan sin su arreglo (`rojo-sin-arreglo.sh`).
  - Probado en la Deck con Ollama real y FLUX.2 klein:
    - El prompt de cuernahoja y el de nievón salen en inglés, con su región.
    - `probar.sh` hizo el thumbnail del nievón en 103 s.
    - El vigilante probado con `timeout` + `sleep` no deja huérfanos.
    - `backend-dev.sh` deja el backend listo en 4 s.
- **Backend:** `tsc` limpio, `oxlint` 0 errores (15 avisos, 622 archivos).
- **Frontend:** `tsc -b` limpio, `oxlint` 0 errores (29 avisos, 419 archivos).
- Check del proyecto en verde (cobertura «SIN HITO: 0», `mapa-agente.py` 0 rotas, matriz).
- `/code-review` de la fase 1, con los arreglos subidos; lo leve está apuntado en `CFG-40` para `CFG-42`. El de la
  fase 3 no encontró nada.

## Merge Danger

**Door:** one-way. Una migración añade dos columnas que admiten nulo a `ImagePrompt` (`promptUsado`,
`promptUsadoAt`). Las filas que ya existen no cambian y las partidas guardadas no se tocan; deshacerlo pediría otra
migración.

**Blast Radius:** enciclopedia. Solo afecta al modo desarrollador de la enciclopedia y a los scripts de
`image-generator/`, que corren en la Deck. El juego no lee estos prompts.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
