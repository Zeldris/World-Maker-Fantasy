**Título:** Tandas 22-27: Mundo vivo y arreglados comprobados jugando; retro aplicada (QA-216 a QA-221)

## Summary

Paso 3 de «La línea» (`21-roadmap.md`) para Mundo vivo, según el [reparto](../../plan-comprobacion-mundo-vivo.md):
las 4 tareas sin jugar de la matriz y 35 arreglados sin comprobar. La ronda se paró tras la tanda 27, a petición de la
usuaria. Del juego solo cambia un refactor de `turnLootKill.ts` que deja el comportamiento igual.

```text
tandas 22-27 (10 pasadas con las repeticiones, subagentes sonnet en serie, Deck)
  comprobados jugando  combate de grupo, corte de paso y viaje interrumpido, beber y comer por energía, P192,
                       maestros de oficio y descripción del Pozo, enfriamiento de asaltos
  en parte             P125, P184, plural de fauna, facción del Orco, Múrgoles, Agujas Imán, corrales, Reparar
  reabierto            P129
  nuevos               P320-P330
  pendientes           P51 P95 P163 P193 P290 P128 CR-43 y la cría de CR-55
  escenarios           mv-hondonada-hostiles · mv-pozo-sed50 · mv-pozo-guchapo-conv · mv-energia-baja
                       mv-colmillo-ganado · mv-ganado
```

Herramientas para poder jugarlas (con permiso de la usuaria) y retro aprobada:

```diff
 backend/src/services/monturas.ts        # montura de pruebas, solo con WMF_MONTURA_PRUEBAS=1
 backend/src/scripts/prepararReino.ts
+  ganado:<animal>                       # corrales con animales
+  convaleciente:<npc>                   # QA-220, con las funciones del juego (QA-151)
 backend/src/services/turnLootKill.ts
+  datosNpcStateDeIntercambio()          # pura: lo que escribe un intercambio de combate en NpcState
+  dejarNpcConvaleciente()               # la usan el combate y preparar convaleciente:
 tools/playwright-e2e/mcp/ + tools/qa/deck/o.sh   # QA-218
   pulsar / mover                        # errores claros, posición y hora
+  viajar-a <lugar>                      # dice qué lugares hay y por qué un destino está deshabilitado
+  combate leer                          # de solo lectura (antes atacaba al leer)
   puntos / interactuar                  # ERROR con el motivo en vez de esperar
   captura                               # a shots/
+tools/qa/tests/ayudas_mcp_navegador.mjs # QA-219: pulsar, mover, viajar-a sobre páginas fijas con Chromium
 tools/qa/matriz-pruebas.py --comprobar  # QA-217: escenario del plan sin .dump → falla
 AGENTS.md + runbook de rondas           # QA-216: preparar el estado de cada id antes de repartir la tanda
 .github/workflows/ci.yml, ci-local.sh   # instalan Chromium de Playwright para el test de navegador
```

## Evidence

- **Antes:** `o.sh combate` atacaba al leer el estado (se perdió una partida). `pulsar` decía «pulsado» sin haber
  accionado nada. `mover` decía «AVISO: (ninguno)». Para «Viajar» no había atajo. `mv-pozo-guchapo-conv` llevaba un
  `NpcState` metido a mano. Cuatro pasadas no cerraron casi nada porque el escenario no tenía el estado que pedía cada
  hallazgo.
  **Después:**
  - `ayudas_mcp_navegador.mjs` tiene 15 casos en Chromium: orden de pasadas de `pulsar`, svg del mapa de `mover` y
    diálogo, carga y destino deshabilitado de `viajar-a`. En el CI falla si falta Chromium, en vez de saltarse.
  - `test_ayudas_mcp.test_combate_leer_no_pulsa_nada` comprueba que no hay `click` antes del bucle de rondas.
  - `test_matriz_pruebas` tiene 10 tests, entre ellos «ESCENARIO SIN .dump».
  - `turnLootKill.datos.test.ts` tiene 4 tests: el grupo continúa, se reinicia a ILESO, golpe de muerte y ausencia de
    6 h.
  - El dump rehecho con `preparar convaleciente:guchapo` está comprobado por SQL: Guchapo está CONVALECIENTE en El
    Pozo y ausente 360 min.
- **Backend:** `tsc` limpio. `oxlint` sin errores (15 avisos, 622 archivos). Vitest de los archivos tocados
  (`prepararReinoLib`, `turnLootKill.datos`, `monturas`): 11/11. Frontend sin cambios.
- **`tools/qa/tests`:** 194 tests. Fallan solo los 3 de `test_host`, que fallan siempre dentro del Flatpak de la Deck.
  `cobertura.py` da SIN HITO: 0. La matriz de Mundo vivo está en 44/48 jugadas.
- **CI de GitHub:** no observado, porque la cuota de Actions está agotada (`QA-215`).
- **Sin probar en vivo:** `combate leer` con un combate abierto, un viaje real con `viajar-a` y el encuentro con
  Guchapo convaleciente.

## Merge Danger

**Door:** two-way

No hay migraciones ni cambios en las partidas guardadas. Hay seis `.dump` nuevos o rehechos, de unos 870 KB cada uno.

**Blast Radius:** combate

`applyCombatExchangeToNpcState` usa ahora `datosNpcStateDeIntercambio`. Escribe lo mismo, pero un error ahí tocaría
el estado de los PNJ tras cada intercambio de combate. La montura de pruebas solo existe con `WMF_MONTURA_PRUEBAS=1`
y fuera de producción. El CI tarda un poco más por instalar Chromium en el job de roadmap. Hallazgos leves pendientes
en `QA-221`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
