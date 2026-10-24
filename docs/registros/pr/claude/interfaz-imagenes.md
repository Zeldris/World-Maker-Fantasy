**Título:** Interfaz local del generador de imágenes con toda la enciclopedia; roadmap IMG (CFG-43, QA-228…QA-234)

## Summary

La usuaria prueba prompts de imagen en la Deck desde una página. Elige cualquier elemento de la enciclopedia, genera
con `probar.sh` viendo el progreso y compara cada intento con la imagen actual del juego. Todo lo de un elemento
queda en una sola carpeta.

```text
image-generator/abrir.sh                 arranca tarkor-postgres, copia las imágenes del juego, abre :7861
  interfaz/servidor.py                   sin dependencias; solo POST JSON desde su propia página
    catalogo                             /world/:slug/enciclopedia + lo anidado + enums de schema.prisma
                                         (2.550: variantes por sexo, de raza y de tiempo, mapas de zona,
                                          habilidades, las 9 clases y 31 especializaciones)
    elementos                            catálogo + prompts de la BD + generated/ + imágenes del juego
    Trabajo.lanzar                       una imagen a la vez (tampoco si hay un sd-cli suelto)
      probar.sh <tipo> <slug> <perfil>   PROMPT_ARCHIVO, LIBERAR_OLLAMA=1
    leer_progreso, estimado              paso y tiempo; mediana de intentos del mismo perfil
    elegir                               copia a <slug>-<perfil>.png, el nombre que busca el juego
  interfaz/index.html                    elegirElemento, traerPrompt, pintarGaleria (notas por intento)
  interfaz/resumen.py                    QA-230: lista y trabajo en texto, sin captura
```

```diff
 image-generator/
-  pruebas/<tanda>/ , salida/images/     (se quedan donde estaban, sin migrar; la interfaz ya no los lee)
+  generated/<tipo>/<slug>/              <slug>-<perfil>.png, intentos/, prompts/, logs/, registro.tsv,
+                                        notas.md, elegidas.tsv  (fuera de git)
 .githooks/commit-msg
+  bitacora.py check si el commit cambia la bitácora   # QA-232
 docs/producto/roadmap-imagenes.md       # nuevo: IMG-1…IMG-3 (0.4)
 docs/mapa-agente.md                     # QA-229: la interfaz en «Imágenes»
```

## Evidence

- **Antes:**
  - Probar un prompt pedía terminal: `probar.sh` a mano, sin ver el progreso ni la imagen del juego al lado.
  - Los intentos quedaban repartidos por tandas.
  - La primera lista daba 121 elementos (solo los que tenían prompt); de clases solo salía Cazador.

  **Después:**
  - `test_interfaz_imagenes.py`: 37/37. Cubre:
    - validación de tipo, slug y perfil, y que solo entra un POST JSON de la propia web;
    - la lista con lo anidado y los enums;
    - `test_la_lista_cubre_todos_los_tipos_que_ilustra_el_juego` (QA-228), que lee la unión `ImagePromptEntityType`
      de `imagePromptGenerator.ts`;
    - el estimado, el progreso, una imagen a la vez, elegir, las notas, la referencia y `resumen.py`.
  - `test_commit_msg.py`: 6/6.
  - Los tests nuevos fallan sin su arreglo (`rojo-sin-arreglo.sh`).
  - Probado en la Deck con FLUX.2 klein:
    - La lista da 2.550 elementos (`resumen.py`: clase 9, especializacion 31, ability 310, zona 747…).
    - Un thumbnail generado desde la página, con barra y estimado.
    - La galería con la imagen del juego.
- **Suite de `tools/qa`:** 230/233. Fallan 3 de `test_host`, y también fallan (4) en `origin/main` dentro del
  sandbox Flatpak de la Deck: los da el entorno, no esta rama. En el CI corren fuera del sandbox.
- **Backend y frontend:** sin cambios en esta rama.
- **Check del proyecto:** en verde (cobertura «SIN HITO: 0», `mapa-agente.py` 0 rotas, matriz).
- **Revisión:**
  - `/code-review` de la fase 1: 17 hallazgos, todos arreglados (`385f5ad7`).
  - Retro y opt-tokens aprobadas y aplicadas (`QA-228`…`QA-233`).
  - `/code-review` de la fase 3: arreglos en `382c46ef`; los leves, en `QA-234`.

## Merge Danger

**Door:** two-way

Todo son herramientas locales y documentación: ni el backend, ni el frontend, ni la base de datos, ni las partidas.
`generated/` está fuera de git.

**Blast Radius:** commits

- `.githooks/commit-msg` ahora rechaza, con `CLAUDECODE=1`, un commit que cambia la bitácora con «Actualizado» viejo
  o una fila de más de 600 caracteres; antes eso solo saltaba en el pre-push.
- Fuera de Claude Code no cambia nada.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
