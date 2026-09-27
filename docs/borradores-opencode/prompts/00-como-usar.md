═══════════════════════════════════════════════════════════════
CÓMO USAR LAS CHULETAS DEL AGENTE DE LORE (OpenCode)
═══════════════════════════════════════════════════════════════

UN COMANDO POR MENSAJE. Copia solo el bloque que toca.

───────────────────────────────────────────────────────────────
EL CICLO
───────────────────────────────────────────────────────────────

  1. LEE: [TIPO] [región]    → espera "LECTURA COMPLETA"
  2. HUECOS                  → te da 5 huecos; elige uno (opcional)
  3. ESCRIBE (una variante)  → la propuesta
  4. REVISA                  → el modelo se corrige contra el núcleo
  5. AJUSTA: …               → arreglas lo que haya salido en REVISA
  6. Guardar (ver abajo)

Regiones: llanuras · cienaga · margen · meseta · cristal-helado
(Vaelira no se juega.)

───────────────────────────────────────────────────────────────
QUÉ CHULETA USAR
───────────────────────────────────────────────────────────────

  prompt-fauna.md          1 animal                 LEE: FAUNA [región]
  prompt-flora.md          1 planta o mineral       LEE: FLORA [región]
  prompt-items.md          1 objeto                 LEE: ITEMS [región]
  prompt-receta.md         1 receta de crafteo      LEE: RECETA [región]
  prompt-npc.md            1 personaje              LEE: NPC [región]
  prompt-zonas.md          1 lugar                  LEE: LUGARES [región]
  prompt-construcciones.md 1 edificio de facción    LEE: CONSTRUCCIONES [región]
  prompt-gancho.md         1 gancho o misión        LEE: GANCHO [región]
  prompt-faccion.md        1 facción                LEE: FACCIONES
  prompt-historia.md       1 evento histórico       LEE: EVENTOS
  prompt-cultura.md        1 rito o costumbre       LEE: CULTURA
  prompt-diplomacia.md     1 relación entre dos     LEE: RELACIONES
  prompt-documento.md      1 objeto legible         LEE: DOCUMENTO
  prompt-lexico.md         palabras nuevas          LEE: LEXICO
  prompt-clases.md         (ver aviso dentro)       LEE: NPC [región]

───────────────────────────────────────────────────────────────
REGLAS DE USO
───────────────────────────────────────────────────────────────

1. El LEE va solo, sin nada más. Si en vez de "LECTURA COMPLETA"
   empieza a escribir una propuesta, pulsa Esc y repite el LEE.

2. Una región y un elemento por petición. Dos regiones dispersan al
   modelo.

3. Cierra OpenCode cada 5-6 turnos (el contexto se llena a 32k).
   En una sesión nueva con el mismo tipo y la misma región puedes
   saltarte el LEE si no has cambiado nada de docs/canon-opencode/.
   Si cambias de TIPO o de REGIÓN, repite el LEE.

4. Las variantes de ESCRIBE de cada chuleta ya dicen QUÉ campos poner.
   Rellena lo que va entre [corchetes] y borra las variantes que no
   uses.

5. Lo mejor que ha salido hasta ahora nació de:
   - elegir un hueco real con HUECOS, y
   - EXPLICA: el origen de algo que el canon da por hecho.
   Úsalos.

6. REVISA siempre antes de guardar. Es barato y atrapa los fallos de
   siempre: Corredor de Cauce, Vaelira en Berig, geografía al revés,
   precios inflados, enums inventados.

7. No pidas "nombre propio en la lengua de la raza" salvo que de
   verdad lo quieras. Si lo pides, que use 01-lenguas.md (o LEXICO
   aparte). Así se evitan los "Silh-X".

───────────────────────────────────────────────────────────────
GUARDAR LA PROPUESTA
───────────────────────────────────────────────────────────────

1. Copia la propuesta del chat (sin la parte de REVISA).
2. Pégala en docs/borradores-opencode/propuestas-lore.md, en su
   categoría: Facciones y diplomacia · Razas y cultura · Idiomas ·
   Construcciones y reino · Historia y cronología · Lugares y
   geografía · Items · Fauna y flora · Personajes y NPCs · Otros.
3. Deja "Estado: SIN REVISAR". Claude la revisa y, si la apruebas,
   pasa a propuestas-aprobadas.md y luego a docs/rpgtarkor/.
═══════════════════════════════════════════════════════════════
