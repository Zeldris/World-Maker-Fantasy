**Título:** Generador local de voces y fauna en `voice-generator/` (VOZ-1 a VOZ-5, en pausa hasta VOZ-6) y retro de las voces (QA-240 a QA-242)

## Summary

Herramientas de desarrollo para voces y sonidos en local con qwentts.cpp, Qwen3-TTS y SoX, siguiendo el mismo
camino que `image-generator/`. El juego no las usa todavía, y en la máquina del jugador no corre nada.

```diff
+voice-generator/
+├── scripts/
+│   ├── instalar.sh               # motor y modelos en un distrobox (VOZ-1)
+│   ├── banco.sh                  # velocidad y español en la Deck (VOZ-2)
+│   ├── disenar.sh, fijar.sh, producir.sh, escuchar.sh   # una voz: diseñar, fijar, producir (VOZ-3)
+│   ├── fauna.sh                  # cadena de SoX sobre sonidos base CC0 (VOZ-5)
+│   ├── comun.sh                  # lanzar, memoria_inicial, una_a_la_vez
+│   └── voces.py                  # fichas: comprobar, instruct, texto, semilla, sox
+├── voces/<raza>/efectos.json     # efectos por raza como datos (VOZ-4)
+├── voces/<raza>/<voz>/diseno.json
+└── fauna/_plantilla/
 docs/producto/
+└── roadmap-voces.md              # VOZ-1…VOZ-9
```

**Sin probar con el motor:** los scripts se escribieron en la nube, sin los modelos y sin la Deck. La usuaria dejó
el generador en pausa: está preparando a fondo un proyecto genérico de voces en otro repositorio y, cuando esté
listo, se traerá su versión adaptada a este código y se usará donde la calidad lo justifique (`VOZ-6`, que acaba con
el control desde el panel de administración). Al traerla toca hacer el simulacro con binarios falsos (`QA-240`) y
poner al día la sección «Voces y sonidos» del mapa.

Retro aplicada (`docs/registros/retro-2026-10-25-voces.md`):

```diff
 tools/qa/mapa-agente.py
+  mira también image-generator/ y voice-generator/ (def, constantes de .py, funciones de bash)
+  ruta con <…>: comprueba su carpeta fija (salvo si git la ignora); un #nombre en un patrón cuenta como roto
 docs/mapa-agente.md
+  ## Voces y sonidos (QA-241)
 tools/roadmap/cobertura.py
+  --fila <ID>: definición, hito con su fila y menciones recortadas en 21-roadmap.md (QA-242)
```

## Evidence

- **Antes:** `mapa-agente.py` no miraba las rutas de `voice-generator/` ni de `image-generator/`.
  **Después:** «0 referencias rotas en 200 del mapa del agente». Los tests `test_mapa_agente.py` ›
  `test_generadores_con_funciones_de_python_y_bash`, `test_ruta_con_patron_mira_su_carpeta_fija` y
  `test_patron_corta_los_nombres_sueltos` fallan sin el arreglo y pasan con él (`rojo-sin-arreglo.sh` OK).
- **Antes:** para saber el hito de una tarea había que leer `21-roadmap.md` entero.
  **Después:** `cobertura.py --fila QA-241` da `hito: 0.3 (21-roadmap.md:122)`. Lo cubre `test_cobertura.py`, con 5
  tests: rango, dos hitos con recorte y bordes de palabra, tarea sin hito (sale con 1), tarea que no existe y sin id.
  También fallan sin el arreglo.
- Las fichas de voces: `test_voces.py` (23 tests) cubre `errores_ficha`, `errores_cadena` y las órdenes de `voces.py`.
- `tools/qa/tests`: 269/269. Backend y frontend sin cambios: `tsc` y `oxlint` en verde en el pre-push. `cobertura.py`
  da «SIN HITO: 0» y `matriz-pruebas.py --comprobar` da OK.
- `/code-review --max-findings all` contra `origin/main`: 19 arreglos (`a0a241c`). En la fase 3 hubo dos pasadas
  sobre los commits de la retro, con 14 arreglos (`3fb5ca5`, `a59ae5f`). Lo leve queda en la bitácora.

## Merge Danger

**Door:** two-way

Sin migraciones y sin cambios en partidas guardadas. Lo nuevo es una carpeta de herramientas aparte, documentación y
dos scripts de QA.

**Blast Radius:** herramientas

`mapa-agente.py` y `cobertura.py` corren en el check y en el CI. Si un `<…>` del mapa apunta a una carpeta que no
existe, ahora el check sale en rojo; en el mapa actual no pasa en ninguno.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01NNE9yTLbic6MgMHz8sm7iA
