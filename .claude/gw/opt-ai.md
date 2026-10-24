<!-- galivelop-workflow v0.2.0 -->
# opt-ai — notas del proyecto

Las lee primero la skill `opt-ai`; aquí vive todo lo propio de los modelos de IA local de Tarkor. El flujo las crea
una vez; desde entonces son del proyecto. La lanza Claude al cerrar cada tanda de pruebas, antes de cambiar un modelo
y cuando la usuaria nota lentitud. **Solo propone** (usuaria, 2026-10-20): lo aprobado entra como tarea con hito
(«Ninguna tarea sin hito», `AGENTS.md`). Diseño y decisiones: `docs/ia/skill-opt-ai.md`.

## Motores y modelos

Fuente de verdad: `backend/src/config/env.ts` (variables `OLLAMA_MODEL_*`, `OLLAMA_KEEP_ALIVE`); léela en cada
pasada, aquí no se copian los nombres de modelo. Motor: Ollama (columna de `references/engines.md` de la skill).

En Ollama, `keep_alive` y `num_ctx` son del modelo cargado (`QA-170`): al proponer o tocar uno, se buscan todas las
llamadas a ese modelo (`grep -rn "ollamaModel<X>" backend/src`) y se alinean con una constante compartida (como
`CTX_CRONISTA` en `narrador.ts`); así se encontró que el respaldo de `narrar` recargaba el cronista de `clasificar`
(`QA-168`).

## Tareas

Los valores de `app.task` que emite el código (los comprueba `tools/qa/tests/test_opt_ai_tareas.py`, `QA-137`):
`narrar` (narrador), `narrar_respaldo` (3.er intento del combate, modelo del Cronista), `clasificar`, `sugerir`
(modelo propio), `dialogo_npc`, `combate`, `modo_dinamico`, `resumen`, `prompts_imagen`, `embedding` y `rag`
(recuperación). Se excluye `calentar`, el calentamiento al arrancar el servidor: no es juego.

## Perfiles de máquina

- El registro se activa con `IA_REGISTRO=<archivo.jsonl>`; sin la variable no se escribe nada. Una tanda, un
  archivo (el anterior se guarda para `--previous`). Formato: `docs/ia/opt-ai-registro.md`.
- `IA_PERFIL` (`app.machine_profile`): `deck` (**mínimo del juego, siempre se mide**), `cpu` (PC sin GPU), `gpu8`,
  `gpu12`. Sin variable, `desconocido`.
- Una tanda que no corrió con la configuración del perfil (sin `IA_PERFIL`, o `arrancar-juego.sh` avisó de CPU o de
  `rag-eval`) se descarta y se pide repetirla (`QA-148`).

## Ajustes

Los lee `scripts/medir.py` de la skill; las rutas relativas se resuelven desde la raíz del repo.

```opt-ai
log: backend/ia/registro.jsonl
exclude_tasks: calentar
cold_ms: 100
```

**Por turno** (`app.turno`, `app.intento`, rechazos `app.evento: rechazo`, `QA-162`): el `medir.py` del flujo no lo
saca; lo da `python3 tools/qa/medir-ia.py <registro> [--anterior <registro>] [--perfil deck]` (la versión de WMF,
con la tabla TURNOS: turno entero, primera palabra, % con intento 2 y con respaldo, rechazos por motivo).

## Banco de pruebas

`bash tools/qa/bench-ia.sh <etiqueta> --anterior <etiqueta>` (`QA-173`): restaura el escenario `ia-gorhorn-dia42`,
reindexa, juega 8 turnos de `npm run benchmark-turno` con `IA_PERFIL=deck`, muestrea RAM y `ollama ps` y pasa
`tools/qa/medir-ia.py`. En segundo plano (~10 min). Al aplicar cada propuesta aprobada, su diff pasa un
`/code-review low` antes del commit y del bench de después (`QA-169`): el bench mide el tiempo, no los fallos.

## Casos de calidad

- Reindexar el lore: `npm run reindex-lore`. Recuperación: `backend/src/services/retrieval.ts`.
- Evaluación del RAG: `npm run rag-eval` sobre el juego fijo `backend/ia/rag-casos.jsonl` (recall@k y MRR).
- Las incoherencias: `docs/registros/pruebas-*-hallazgos.md`; las P de IA son las que inventan, contradicen el lore
  o se equivocan de nombre. Cada una pasa a caso de `rag-casos.jsonl` con `origen` = su P.

## Generador de imágenes

`/opt-ai` mide también `image-generator/` (usuaria, 2026-10-24): `sd-cli` (stable-diffusion.cpp, Vulkan) con FLUX.2
klein 4B en la Deck, no Ollama, así que `medir.py` no lo ve. Fuentes, sin leer los logs enteros:

- `image-generator/generated/*/*/registro.tsv`: una fila por intento con perfil, semilla, pasos, tamaño, `extra`
  (`-r <ruta>` = con referencia), `salida` (0 = bien) y `segundos`.
- La última línea de cada `generated/*/*/logs/*.log` que escribe `generar.sh`: `total`, `min_libre` (RAM libre
  mínima, MB) y los tiempos de `sampling` y `decode_first_stage`.

Se compara por perfil (`thumbnail`, `banner`…), pasos y con o sin referencia; base medida el 2026-10-24 en la Deck:
thumbnail ~104 s y banner ~110 s sin referencia, ~200 s con una. Límites que no se proponen subir: `--max-vram 2`
(la Deck comparte la memoria con el juego) y Ollama liberado antes de generar (`LIBERAR_OLLAMA=1`). Hasta que exista
el script de `IMG-3`, se resume con `awk` sobre los `registro.tsv`. Lo que se propone (pasos, tamaño, cuantización,
`--vae-tiling`, cuántas referencias) se apunta como tarea `IMG` en [`roadmap-imagenes.md`](../../docs/producto/roadmap-imagenes.md).

## Tiempos aceptables

Se fijan con la primera medición en la Deck. Hasta entonces, el paso 4 no marca ninguna tarea como «demasiado
lenta» por su cuenta: informa de las cifras y propone el umbral a la usuaria.

## Ya en marcha

- **Prefijo fijo primero** en los prompts del narrador: Ollama reaprovecha unos 2.600 tokens de caché por turno.
- **`arrancar-juego.sh` con `IA_PERFIL`** (`QA-141`): `IA_REGISTRO` absoluto, GPU en `deck` y `rag-eval` antes de jugar.
- Registro por turno (`QA-162`): `app.turno`, `app.intento`, rechazos de guard y `num_ctx` efectivo de `/api/ps`.
- `keep_alive` 1h en `resumen` y en el calentamiento (`QA-161`); captura remota apagada en las tandas (`QA-160`).
