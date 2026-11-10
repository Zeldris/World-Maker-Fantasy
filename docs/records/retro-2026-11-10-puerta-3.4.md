# Retro: paso 3.4 de la puerta de pruebas (tandas 89-106, lotes A-C) antes de `main`

Rama `claude/wonderful-volta-662qt8`, 2026-11-10. Diez y ocho tandas de juego, tres lotes de arreglos (P325-P439),
`QA-298`…`QA-300` en `escenario.sh`, y la fase 1 de la revisión contra `origin/main`: 14 hallazgos, 9 a arreglar,
7 reales (`9f2709a8`), 5 leves a la bitácora.

**Estado:** presentada a la usuaria; su decisión, en el párrafo siguiente.

Decisión de la usuaria: sin decidir todavía.

## Qué fue bien

- Cada lote tuvo su revisión y los arreglos de la revisión, y cada P se comprobó jugando antes de tacharlo.
- Lo que no se podía alcanzar jugando se resolvió con pasos de `escenario.sh` (`QA-298`, `QA-299`, `QA-300`) en vez
  de `UPDATE` a mano.
- La fase 1 por subagente `sonnet` verificó cada hallazgo antes de tocarlo y descartó dos falsos (4 y 7).

## Candidatas a mejora (por gravedad)

1. **Las reglas «en todos sus caminos» ya están en `REVIEW.md` y la revisión por lotes no las cazó** (comprobación,
   proyecto). Tres de los siete reales eran de `QA-78`/`QA-99`: «Entregar pastos» sin `companionId: null`
   (Depositar sí lo filtra), el filtro de P254 fuera de la oferta ambiental, y el Granero compartido sin llegar a
   `dar-reino`. Una regla de criterio que se rompe por tercera vez pide un script. Propuesta:
   - `tools/qa/inventario-suelto.py` (en el check): falla si una consulta `prisma.item.*` / `tx.item.*` con
     `slot: null` no lleva `companionId` en el mismo `where` (o un comentario `// inventario: todos` que lo excuse).
   - Un test que exija que todo `pickAmbientEncounterCandidate` reciba candidatos pasados por `sinPuntoEnOtraZona`,
     o mejor, mover el filtro dentro de una sola función de oferta (tarea `QA-` con hito).
2. **Revisión por bloques (`QA-292`) sin cumplir** (comprobación, flujo): 18 tandas y 48 commits sin revisión del
   diff entero; las revisiones de cada lote solo miraron su diff. Propuesta general: que `recover.py --state` avise
   cuando los commits desde la última revisión (`.claude/revision-main.sha` o la última marca) pasan de un umbral
   configurable. Va a Galivelop-workflow.
3. **El texto de ayuda de `escenario.sh` copió mal el aviso del juego** (hallazgo 14). Leve; sin cambio: la regla de
   copiar el texto real ya está, y fue un despiste puntual.

## gw-opt-tokens

Medido desde la última fusión (`measure.py --since e9649fac`): sesión principal 497 llamadas, contexto medio 114k
(suelo 97k, techo 141k, 9 compactaciones), 56,7M de entrada; 18 subagentes, 74,3M; total 131M.

1. **Plan y registro de hallazgos leídos a trozos una y otra vez**: `plan-comprobacion-puerta.md` 57 lecturas
   (1,14M arrastrados), `pruebas-0.3-hallazgos.md` 49 (0,70M), `traspaso.md` 61 (0,40M). Propuesta:
   - `marca-hallazgo.py --ver P<n>…`: la fila de cada P en el registro y las líneas del plan que lo citan, recortadas.
   - Pasar las secciones cerradas del plan (tandas 28-88, ~60 % de sus 86 kB) a `plan-comprobacion-puerta-archivo.md`.
   Ahorro estimado ~1,2M por sesión de ronda. Riesgo: que falte contexto de la fila; contrapeso, la salida da
   `archivo:línea` para leer la sección si hace falta.
2. **Subagentes por encima de su tope**: «Tanda 90» 87 llamadas y «QA-299» 79 (topes de ~60 para tandas y 30-40
   para edición, `QA-277`), 17,9M entre los dos. Propuesta: el encargo lleva la frase «a las 50 llamadas, para,
   guarda el escenario y devuelve lo hecho y lo que falta» (en la plantilla de tanda de `rondas-de-pruebas.md`).
   Riesgo: más tandas partidas; contrapeso, `escenario.sh guardar` ya lo resuelve.
3. **`/clear` al cerrar cada lote** en una rama larga, no solo al cerrar el PR: la sesión encadenó tres lotes con 9
   compactaciones. El suelo bajaría de ~97k a ~70k (el arranque de un subagente es ~69k, casi todo fijo). Ahorro
   ~25k × ~400 llamadas ≈ 10M a precio de caché (~1M normal). Riesgo: perder una decisión; contrapeso, la bitácora.

## For Galivelop-workflow

- Aviso de revisión atrasada en `recover.py --state` (candidata 2).
