**Título:** Cadena fotorreal del generador de imágenes: receta, encuadre, gradación y LoRA de estilo (IMG-15…IMG-33, QA-280…QA-284)

## Summary

El generador local de la Deck tiene una receta **fotorreal** que se acerca a los banners de referencia de GPT. Las
tareas `IMG-20`, `IMG-25` e `IMG-26` siguen abiertas y no entran. Solo cambian `image-generator/`,
`docs/producto/plan-imagenes/`, los documentos del flujo y `tools/qa/tests/`; `backend/` y `frontend/` no se tocan.

**La cadena, con `PERFIL=fotorreal`** (`IMG-16`, `IMG-17`, `IMG-23`, `IMG-27`, `IMG-28`, `IMG-33`):

```text
probar.sh <tipo> <slug> fotorreal [semilla]
  prompt_ficha.py      ficha → prompt: oscuridad al principio, luz del estilo por momento, el sol fuera de cuadro
  planos.sh            fondo, sujeto y manada por separado (armonías sin momento)
    encuadre.py        `encuadre` de la ficha → HERO y MANADA, en fracciones del lienzo, con perspectiva
    montar.sh          compone los planos
  generar.sh           FLUX.3 klein Q8 + Qwen3-VL 4B, bin-nuevo/sd-cli
                       LoRA de estilo `wmf-estilo` a peso 1 (LORA=0 lo quita; sin el archivo, avisa y sigue)
  gradar.sh            gradación por momento (dia, atardecer, noche): LUT .cube con la huella de sus curvas
  medir.sh             métricas contra los banners de GPT
```

Lo demás:

- bocetos paramétricos por plan corporal (`IMG-18`, `IMG-24`);
- pautas de prompt con fauna, flora, lugar, objeto y raza (`IMG-19`, `IMG-21`, `IMG-22`), con su banco de rondas en
  `docs/producto/plan-imagenes/banco/`;
- un banner ajeno como referencia de acabado (`IMG-31`);
- el LoRA entrenado en Kaggle (`IMG-29`, `IMG-30`, `IMG-32`). El `.safetensors` queda fuera del repo
  (`image-generator/.gitignore`); `lora-kaggle.md` dice cómo rehacerlo.

**Retro aplicada** (`docs/records/retro-2026-11-03-plan-imagenes.md`):

```diff
 docs/runbooks/skills-y-modelos.md
+  /code-review del diff de cada tarea IMG-* al cerrarla (QA-280)
 docs/producto/roadmap-imagenes.md
+  a main por bloque, no tras toda la rama (QA-281)
 docs/mapa-agente.md
+  «Cadena fotorreal»: entradas y tests (QA-282)
 docs/producto/plan-imagenes/hoja.sh
+  --archivos <nombre> <png>…: hoja de contactos de banners sueltos, en hojas/sueltas-<nombre>-<n>.png (QA-283)
 .claude/gw/opt-tokens.md
+  /clear antes de preparar main; ir a la línea con grep -n en vez de releer (QA-284)
```

## Evidence

- **`tools/qa/tests`**, los tests de esta rama:

  | Archivo | Tests | Qué cubre |
  |---|---|---|
  | `test_prompt_ficha.py` | 105 | prompt por perfil y momento; la noche veta «golden-hour» |
  | `test_generar_perfil.py` | 40 | receta, LoRA (`0`, `0.0`, `00` lo quitan), gradación, cadena de planos que acaba si `gradar.sh` falla |
  | `test_gradar.py` | 12 | la LUT con otra huella cae a las curvas y avisa |
  | `test_encuadre.py` | 12 | posiciones, escala, perspectiva, rangos |
  | `test_hoja_banco.py` | 6 | `--archivos`: sin pisar hojas ajenas; rutas con `:`, `%` y `-` |
  | `test_montar.py` | 1 | sin caja, ABORTO con motivo |

  Cada arreglo de las revisiones lleva un test que falla sin él (`rojo-sin-arreglo.sh`).
- **Batería entera de `tools/qa`:** 493 tests en la Deck, 2 saltados. Los 5 fallos de `test_host.py` vienen del sandbox Flatpak (también
  fallan en la copia principal, con `host.sh` sin tocar); el CI los corre fuera de él. `test_pipefail.py` cazó dos
  notas «sin pipefail» que habían bajado de la línea 15, y un reenvío sin `set`: arreglado.
- **Prueba real en la Deck** (`probar.sh fauna aullador-rojo fotorreal 42`): carga `bin-nuevo`, aplica el LoRA y
  grada en 563 s. Lo visual (cuánto se acerca a GPT) lo juzga la usuaria con las hojas de contactos, no un test.
- **Revisiones:** fase 1, `/code-review` contra `origin/main`: 15 hallazgos, los 4 medios arreglados. Fase 3,
  `/code-review` de `hoja.sh`: 8 hallazgos, arreglados los que podían borrar o romper.

## Merge Danger

**Door:** two-way. Sin migraciones ni cambios en las partidas guardadas. Revertir solo quita scripts y documentos.

**Blast Radius:** el generador de imágenes de la Deck (`image-generator/`) y las hojas del banco. Sin `PERFIL`,
`generar.sh` se comporta como antes; la interfaz de `CFG-43` no cambia.

Además, `IMG-4` (guía visual y plantilla) queda cerrada con el sí de la usuaria (2026-11-03), y `IMG-6` se rehace con la cadena fotorreal después de esta fusión.

Quedan como leves pendientes:
- `planos.sh` reutiliza armonías viejas tras un montaje nuevo;
- en `probar.sh`, `RES` apunta a la imagen sin gradar; además corre `plantilla` dos veces, y un `FICHAS` relativo lo rompe;
- `plantilla.py` no valida los colores hex;
- `planos.sh` puede abortar en `encuadre.py` aunque se den `HERO` y `MANADA`;
- en `encuadre.py`, `lado: centro` reparte mal las copias;
- `medir/stats.sh` muere sin mensaje cuando no hay métricas;
- el glob de `lora/conjunto.sh` va sin `nullglob`;
- `banco/planos.sh` duplica la receta e ignora el LoRA;
- en `hoja.sh`, el modo por prefijo no valida el nombre (viene del banco, no de fuera).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
