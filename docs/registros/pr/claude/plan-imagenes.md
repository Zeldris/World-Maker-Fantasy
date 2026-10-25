**Título:** Plan de imágenes: fichas como datos, prompt desde la ficha y banco de calidad del generador local (IMG-4…IMG-6, IMG-14, IMG-15, QA-249…QA-255)

## Summary

El plan de imágenes entra en el repo (`docs/producto/plan-imagenes/`, tareas `IMG-4`…`IMG-15` del hito 0.4, decisiones
D1-D10). El generador local monta el prompt desde la ficha del elemento en vez de escribirlo a mano. El banco de
calidad busca la configuración de la Deck que más se acerca a los banners de ChatGPT del juego.

```text
image-generator/
├── estilo/mundo.json          # IMG-4: guía visual del mundo (paleta, luz, materiales por región)
├── fichas/<tipo>/<slug>.json  # IMG-4/6: fichas piloto (aullador rojo, cardo brújula, pastos de la deriva, Hulki)
└── scripts/prompt_ficha.py    # IMG-5/14: ficha + estilo + --momento/--estacion → prompt; error si la ficha rompe una regla
docs/producto/plan-imagenes/
├── banco.sh, banco/           # IMG-15: rondas de pruebas (modelo, VAE, sampler, pasos, estilo), resultados.md
├── hoja.sh                    # QA-249: una ronda en hojas de contactos de 6 (una lectura por hoja)
└── pilotos.sh, calidad.sh     # IMG-6: pilotos con semilla fija; primer banco
```

Resultado del banco (rondas 1-7, `banco/resultados.md`): **klein Q8 + estilo `cine2` con polvo mate, euler, 6 pasos,
VAE pequeño, ~2,5 min por banner**; aguanta con otras semillas. Lo que más acerca a ChatGPT es el texto de estilo, no el
modelo: el VAE completo, el codificador Q8, otros samplers, 9 pasos y Q6 no mejoran; Z-Image-Turbo es más pictórico y
más fiel en fauna, pero tarda ~6-7 min.

Cambios en el generador y sus herramientas:

```diff
 generar.sh
+  VAE= y MIN_INICIO_MB= por variable (banco)
-  cuenta como cargado todo lo que lista /api/ps
+  solo lo que ocupa memoria (size > 0)
 tools/ci/mock-ollama.mjs
-  /api/ps lista tarkor-narrador
+  /api/ps vacío, como un Ollama real sin nada en memoria (generar.sh intentaba descargarlo)
 interfaz/servidor.py
+  generated/banco/ no son elementos ni cuentan para el tiempo estimado
```

Opt-tokens y retro de la sesión (aprobadas enteras por la usuaria):

```diff
 .githooks/pre-commit, pre-push
-  root=$(git -C "$hookdir" rev-parse --show-toplevel)        # en un worktree, GIT_DIR exportado → .githooks
+  root=$(env -u GIT_DIR -u GIT_WORK_TREE git -C "$hookdir" …) # QA-252
 tools/qa/host.sh
-  worktree con cambios sin commit → rechazo
+  copia visible desde `git stash create`, con aviso de instantánea        # QA-253
 .claude/gw/scripts/recuperar.py --estado
+  la fila de la rama de cada worktree con fila propia                     # QA-250
 tools/qa/tests/test_pipefail.py
+  todo .sh versionado de imágenes: set -euo pipefail o «# sin pipefail: <motivo>»   # QA-254
 docs/producto/plan-imagenes/banco.sh
+  cada 5 min de espera de memoria, una línea con los MB libres            # QA-255
```

## Evidence

Sin cambios en `backend/` ni `frontend/`: `tsc` y `oxlint` de los dos, en verde en el pre-push de `ad08aec4` (check de
`.claude/gw.json`). Tests de `tools/qa/tests` tocados: 147 en verde (`test_prompt_ficha` 739 líneas, `test_interfaz_imagenes`,
`test_hoja_banco`, `test_pipefail`, `test_recuperar`, `test_pre_commit`). Los tests nuevos fallan sin su arreglo
(`rojo-sin-arreglo.sh`):

- **Before:** commit desde un worktree con un borrador de `docs/borradores-opencode/` preparado → el pre-commit no
  encuentra la raíz y deja pasar el borrador.
  **After:** `test_en_un_worktree_saca_la_raiz_del_worktree`: sale con 1 y pide `git restore --staged`.
- **Before:** `host.sh` en el sandbox, desde un worktree con cambios → `tiene cambios sin commit`, sale con 1.
  **After:** `test_en_el_sandbox_un_worktree_invisible_con_cambios_los_lleva_a_la_copia_visible`: la orden ve los
  cambios, avisa de la instantánea y el árbol, el índice y `git stash list` quedan como estaban.
- **Before:** una ficha que rompe una regla (noche con sol, día con estrellas, el nombre de la zona en el fondo, una
  variante o un perfil que no existen) → un prompt roto sin aviso.
  **After:** `test_prompt_ficha` (`test_noche_con_sol_es_error_con_motivo`, `test_fondo_rechaza_el_nombre_de_la_zona`…):
  `prompt_ficha.py` sale con error y dice el motivo.
- **Before:** `hoja.sh r1` cogía también `r10-*`. **After:** `test_hojas_de_seis_en_orden_con_leyenda` (`r9` no coge
  `r90`; las hojas de una pasada anterior se borran).

`test_host.py` tiene 3 fallos en el sandbox de la Deck que salen igual sin estos cambios (PATH reducido); el CI local en
el host o el CI de GitHub lo dirá.

## Merge Danger

**Door:** two-way

Ni migraciones ni partidas guardadas. Las fichas y la guía de estilo son datos nuevos que el juego todavía no lee.

**Blast Radius:** herramientas

`pre-commit` y `pre-push` corren en cada commit y push: un fallo en la raíz bloquearía o dejaría pasar todo. Están
probados en la copia principal (los tests) y en un worktree (los pushes de esta rama ya fueron sin envoltorios).
`host.sh` ahora corre sobre cambios sin commit: un verde así no prueba ningún commit, y por eso lo avisa.

Pendiente tras la fusión: leer pastos con Z-Image Q6, fijar el perfil ganador en `generar.sh` y las decisiones de la
usuaria (D8, pilotos de `IMG-6`, textos «[propuesta]» de `IMG-4` e `IMG-14`).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
