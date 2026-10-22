**Título:** Arreglos de la puerta de pruebas: reabiertos P27, P99, P158, P169; P275-P303, Casa de obras y retro (QA-201 a QA-207)

## Summary

Arregla lo que encontró la puerta de pruebas del 0.3 ([hallazgos](../../pruebas-0.3-hallazgos.md)): los cuatro reabiertos,
el texto de P70 y los nuevos P275-P303. P278, P279, P288 (falta Ollama real) y P300 quedan en parte.

```text
Reino
  Almacén y depositar        P275 P276          tope y avisos coherentes
  Edificios                  P277 P282 P287 P301 requisitos, Jaula→Corrales, Mercado DAÑADO cuenta
  Casa de obras (nuevo)      P302               cola de obras con constructores (nivel → velocidad,
                                                tier por nivel de la Casa: 1→T1-3, 2→T4-6, 3→T7-9)
  Partidas y súbditos        P280 P281 P283     caza, menores fuera, texto sin nadie libre
  Defensa y milicia          P284 P285 P295 P296 milicia solo de la Capital, reparar, sin trabajadores
  Vasallaje y guerra         P286 P297 P298     deuda visible, cuota 0 sin patrulla, orden estable
  Rebelión                   P299               un Ayuntamiento DAÑADO sigue siendo la Capital
Personajes y combate         P27 P289 P291 P292 P293 P303   avisos, aprobación, títulos, ficha del rival
Interfaz                     P99 P158 P169 P290 P294        oficios, dificultad, mapa, expediciones
```

Decisiones de la usuaria (2026-10-22): tope de tier de la Casa de obras; una Capital sin Torre licencia la milicia
tras el asalto; fracción de la cuota de la semana, la migración no cobra, constructores sin obra recogen comida.

Antes del PR, `/code-review --max-findings all` con arreglos fusionados (vasallaje, Casa de obras, rebelión, milicia);
lo leve, como pendiente en la bitácora. Retro (`retro-2026-10-22-frontend-improvements.md`):

```diff
 .claude/skills/orchestrate-dealer/SKILL.md
+  arreglos de una revisión con sonnet; el revisor, opus           (QA-201)
+  el arreglo de un archivo lo hace la principal                   (QA-202)
+  antes del PR, solo lo grave; lo leve a la bitácora              (QA-203)
+  el encargo comprueba que parte de origin/<rama>                 (QA-204)
 roadmap-front.md: QA-205 test intermitente, QA-206 fusionar.sh, QA-207 medir.py → paso 3.4
```

## Evidence

- **Antes:** P275-P303 abiertos en el registro; P27, P99, P158, P169 reabiertos.
  **Después:** cada uno con su test (p. ej. `turn.integration.test.ts` P299 con `ACTIVO` y `DANADO`,
  `casaDeObras.integration.test.ts`, `vasallaje` con cuota 0).
- backend: `tsc` 0 errores · `oxlint` 0 errores · `vitest` 311 archivos, 3772 tests en verde.
- frontend: `tsc` 0 errores · `oxlint` 0 errores · `vitest` 156 archivos, 721 tests en verde.
- Un test de cronista (`decisionesFaccion`/`deudaDeVida`) falla a veces en la suite completa (`QA-205`).

## Merge Danger

**Door:** de un solo sentido.

Dos migraciones: `20261022120000_casa_de_obras` (columnas `nivelConstructor`, `xpConstructor` en `Subject`, tabla
`ObraCola`) y `20261022130000_obra_avance_por_velocidad` (`diasHechos` pasa a `DOUBLE PRECISION`). Solo añaden, con
valores por defecto: las partidas guardadas cargan igual.

**Blast Radius:** Reino.

Tick diario (vasallaje, rebelión, milicia, obras) y pantallas del Reino. Una partida vieja empieza con la cola vacía y
constructores de nivel 1.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01CprfyerCkZJQW72S2ekkQ8
