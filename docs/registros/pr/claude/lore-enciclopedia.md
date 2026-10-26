**Título:** La enciclopedia, alineada con el canon y el motor; ficha.sh y aviso de identificador en main (QA-243, QA-245…QA-248)

## Summary

La enciclopedia decía cosas que el canon o el motor no dicen. Se auditó por bloques contra `docs/rpgtarkor/` y cada
arreglo se aplicó con el sí de la usuaria (registro en `docs/registros/lore-hallazgos.md`). La historia que falta va
aparte, en `QA-244`.

```text
bloque 1  NPC y personajes          fichas, razas y facciones como en el canon
bloque 2  fichas de combate         clases, IA de combate y sistemas como en el motor (combatLore, reputationLore)
          y sistemas                ocho habilidades con nombre repetido, renombradas por clase
bloque 3  objetos y recetas         descripciones y bonus como en el catálogo («el catálogo manda»)
bloque 4  lugares, facciones,       notas de diseño fuera de 26 lugares; región y población de 18 animales;
          fauna y flora             región de 11 plantas; Cuerno de Hielaga; despiece del Ferike
canon     lenguas-helek.md          cuatro traducciones de facción (Ilsk'sael, Thak'ashi, Hesh'yegr, Durk'helske)
```

Habilidades renombradas: el nombre depende de la clase y, a veces, de la especialización. Las partidas guardadas se
ponen al día al cargarlas.

```text
GET /saves/:id                          (detail.ts)
  renombrarHabilidadesDePartida         HABILIDADES_RENOMBRADAS_POR_CLASE, según la clase y la especialización:
                                        Golpe Certero → Golpe Oportuno / Golpe a la Marca (Asesino Selecto)
                                        Instinto Asesino → Reflejo Primario (Cazador) / Arrebato Salvaje (Druida)
                                        Golpe Adaptado → Golpe Llano · Tiro Inmovilizador → Tiro a la Pata
                                        Tiro Múltiple → Tiro Pasante · Postura de Tirador → Postura de Ballestero
```

Bonus de lo fabricado: la receta ya no fija bonus propios.

```diff
 sincronizarObjetosDeCatalogo           (itemCatalogSync.ts)
-  si la fila coincide con los bonus de su receta → no se toca
-  si no → bonus del catálogo
+  toda diferencia con el catálogo → bonus del catálogo
```

Retro de la sesión (aprobada entera):

```diff
 tools/qa/
+  ficha.sh <slug> [--canon]            # QA-245: todo lo de un slug en una salida (backend/src/scripts/ficha.ts)
 tools/roadmap/cobertura.py
+  --libre <PREFIJO>                    # QA-246: siguiente número libre, mirando también origin/main
+  ABIERTAS TAMBIÉN EN MAIN             #   mismo id abierto en la rama y en main desde la base común
+  DEFINIDAS DOS VECES                  #   y en el árbol, también después de traer main
 docs/runbooks/ampliar-lore.md
+  § 0.5 auditar en tandas pequeñas     # QA-247
 docs/mapa-agente.md
+  Enciclopedia y lore                  # QA-248
```

## Evidence

- **Antes:**
  - Ocho habilidades se llamaban igual en clases distintas, y el Asesino Selecto tenía dos «Golpe Certero».
  - Once plantas de fuera de las Llanuras no tenían región, y el test solo miraba la fauna.
  - La enciclopedia mostraba notas de diseño en 26 lugares, y fichas y descripciones contradecían al canon o al motor.
  - Para reunir lo de un slug, `worldCatalog.ts` se leyó 140 veces.
  - `QA-240` y `QA-241` chocaron con los de `main` sin que nada avisara.

  **Después:**
  - **`habilidadesRenombradas.test.ts`:** renombra por clase y especialización; con dos filas del mismo nombre viejo,
    distingue por la descripción.
  - **`detail.habilidadesIniciales.integration.test.ts`:** una partida vieja sale renombrada al cargarla.
  - **`itemCatalogSync.test.ts`:** lo fabricado vuelve a los bonus de su ficha.
  - **`floraConFicha.test.ts`:** toda fuente de recolección tiene región.
  - **`catalogoSinNotasInternas.test.ts`:** sin notas de diseño ni secretos de trama en lo visible.
  - **`crafting.test.ts`:** cada ingrediente existe en el catálogo, y cada receta se llama como su ficha y fabrica con
    sus bonus.
  - **`factionRelationsIniciales.test.ts`:** las posturas clave del lore caen en su banda.
  - **`ficha.test.ts` (7):**
    - claves heredadas;
    - chunks por palabra entera;
    - `orMatch` con su cantidad;
    - búsqueda en el canon con tope y recorte por caracteres;
    - el catálogo real con `hielaga`.
  - **`test_ficha.py` (4):** errores de uso con su motivo.
  - **`test_cobertura.py` (14):** choque con `main`, misma tarea de una tercera rama, definida dos veces tras traer
    `main`, y `--libre` con rangos y sin números sueltos.
  - Los tests nuevos fallan sin su arreglo (`rojo-sin-arreglo.sh`, o a mano con la versión anterior de
    `cobertura.py`).
- **Tests de backend que toca la rama:**
  - unidad: 8 archivos, 222/222;
  - integración con Postgres: `turn` y `detail.habilidadesIniciales`, 188/188.
- **Backend:** `tsc` limpio, `oxlint` 0 errores (15 avisos).
- **Frontend:** `tsc -b` limpio, `oxlint` 0 errores (29 avisos).
- **Check del proyecto:** en verde (cobertura «SIN HITO: 0», «ABIERTAS TAMBIÉN EN MAIN: []», «DEFINIDAS DOS
  VECES: {}», `mapa-agente.py`).
- **`tools/qa`:** 283 tests. Los 3 fallos de `test_host` ya estaban antes de esta rama.
- **`/code-review`:**
  - fase 1: 2 arreglados, leves en `lore-hallazgos.md`;
  - fase 3: dos revisiones de la retro y de sus arreglos, con los medios arreglados y los leves en
    `lore-hallazgos.md`.

## Merge Danger

**Door:** one-way, por partidas guardadas. No hay migración de BD.
- **Habilidades:** al cargar una partida, se reescriben con su nombre nuevo las habilidades de la clase, las barras y
  las activas. Volver atrás pediría el renombre inverso.
- **Bonus de lo fabricado:** `sincronizarObjetosDeCatalogo` pone a lo fabricado los bonus de su ficha y deja de
  conservar los de la receta (por ejemplo, el Tocado de plumas). Lo que ya se haya sincronizado no recupera sus bonus
  viejos aunque se revierta.

**Blast Radius:** partidas. Los nombres de habilidades y los bonus de lo fabricado cambian en las partidas
existentes, y los textos de la enciclopedia y del lore que lee el narrador cambian para todos.

Tras fusionar, en la Deck:
- `./actualizar-mundo.sh`, para la BD local;
- las imágenes de las ocho habilidades renombradas (pendiente de `QA-243`).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
