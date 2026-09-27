═══════════════════════════════════════════════════════════════
CHULETA DEL AGENTE DE LORE — COMANDOS PARA COPIAR/PEGAR
═══════════════════════════════════════════════════════════════

Regla de oro: UN COMANDO POR MENSAJE. Copia solo el bloque que toca,
no todos juntos. El prompt del sistema ya tiene las reglas internas.


───────────────────────────────────────────────────────────────
PASO 1 — LEE
───────────────────────────────────────────────────────────────

LEE: EVENTOS


───────────────────────────────────────────────────────────────
PASO 2 — ESCRIBE (tras "LECTURA COMPLETA")
───────────────────────────────────────────────────────────────

ESCRIBE

Necesito 1 evento histórico para las semillas y Madre, especialmente Tarkor
Elige tú el hueco más importante que falte en la cronología que ya has leído.

CONTEXTO:
- Trabaja solo con lo que ya has leído antes. NO leas nada nuevo.
- Quiero un evento que rellene un hueco real, no que contradiga nada.
- Centrado en las semillas y Madre. Especialmente Tarkor
- Mundo de fantasía con base científica: todo explicable con causas naturales, no quiero magia sin fundamento.

EL EVENTO debe incluir:
- Título del evento (nombre propio en la lengua de la raza)
- Era: comun (después del año 0) o semillas (mítico, anterior al año 0)
- Año aproximado (solo si es era comun)
- Tipo (batalla / tratado / catástrofe / fundación / descubrimiento / represión)
- Participantes (razas y facciones concretas)
- Causas: qué lo provocó
- Desarrollo: qué pasó
- Consecuencias: cómo afecta al presente del mundo
- Descripción detallada: de hasta 500 palabras
- Si hay un objeto físico que documente el evento (una tablilla, un mapa, una carta, un diario): descríbelo. Si no, indica "sin documento asociado".

NO QUIERO:
- Eventos mágicos sin fundamento
- Nombres que no sigan las lenguas del lore
- Contradicciones con lo ya escrito
- Campos que no haya pedido (referencias a código, mecánicas, stats)
- Palabras en inglés
- Más de 1 evento. Solo 1 bien detallado.


───────────────────────────────────────────────────────────────
PASO 3 — AJUSTA (si el evento no te vale, ya existe, o quieres otro)
───────────────────────────────────────────────────────────────

AJUSTA: ese evento ya existe. Elige otro hueco TOTALMENTE DISTINTO: otro siglo, otra facción, otro tipo de evento.


───────────────────────────────────────────────────────────────
PASO 3b — AJUSTA (para corregir un detalle concreto del evento)
───────────────────────────────────────────────────────────────

AJUSTA: [instrucción concreta sobre qué cambiar]


───────────────────────────────────────────────────────────────
PASO 4 — CONTINÚA (si el evento se cortó a mitad)
───────────────────────────────────────────────────────────────

CONTINÚA


───────────────────────────────────────────────────────────────
CAMBIO DE TIPO — Repetir desde PASO 1 con otro tipo
───────────────────────────────────────────────────────────────

LEE: NPCs
LEE: FAUNA
LEE: FLORA
LEE: CONSTRUCCIONES
LEE: ITEMS
LEE: CLASES
LEE: FACCIONES
LEE: EVENTOS
LEE: LUGARES
LEE: RELACIONES


───────────────────────────────────────────────────────────────
REGLAS DE USO
───────────────────────────────────────────────────────────────

1. UN COMANDO POR MENSAJE. No pegues varios juntos.

2. El LEE solo lleva el comando. Nada más. Ni reglas ni contexto — ya
   están dentro del prompt del sistema.

3. El ESCRIBE solo lleva "ESCRIBE" + la petición completa.

4. El AJUSTA solo lleva "AJUSTA" + la instrucción.

5. En cada ESCRIBE, ACOTA a UNA ubicación (o UNA facción, o UN tipo
   concreto). Dos ubicaciones dispersan al modelo.

6. Cierra OpenCode cada 5-6 turnos. El contexto se satura a 32k y el
   modelo empieza a fallar. Sesión nueva = contexto limpio.

7. Al empezar una sesión nueva con el mismo tipo, NO hace falta repetir
   el LEE si los archivos no han cambiado. Puedes ir directo al ESCRIBE.
   Solo repite el LEE si:
   - Cambiaste los .md de la tabla.
   - El modelo dice que le falta contexto.
   - Llevas mucho tiempo sin usarlo.

8. Si el modelo, al hacer LEE, empieza a escribir una propuesta en vez
   de decir "LECTURA COMPLETA", PARA (Esc en OpenCode) y repite el LEE.
   El prompt debería evitarlo, pero Qwen 9B a veces se desvía.


───────────────────────────────────────────────────────────────
PASO EXTRA — GUARDAR LA PROPUESTA
───────────────────────────────────────────────────────────────

Cuando una propuesta te valga:
1. Cópiala del chat.
2. Pégala en `docs/borradores-opencode/propuestas-lore.md`, en la
   categoría correcta (Facciones, Construcciones, Historia, etc.).
3. Marca `**Estado: SIN REVISAR**` (ya viene así).
4. Más tarde, cuando la apruebes, muévela a `propuestas-aprobadas.md`
   con los campos extra (Acción, Prioridad, Dependencias, etc.).


───────────────────────────────────────────────────────────────
TIPOS DISPONIBLES
───────────────────────────────────────────────────────────────

FAUNA          — criaturas, bestias, depredadores
FLORA          — plantas, árboles, hierbas, recursos
CONSTRUCCIONES — edificios, fortalezas, sedes
ITEMS          — armas, armaduras, herramientas, consumibles
NPCs           — personajes, líderes, artesanos, guerreros
CLASES         — clases y especializaciones
FACCIONES      — clanes, órdenes, imperios
EVENTOS        — eventos históricos, batallas, tratados
LUGARES        — zonas, regiones, asentamientos
RELACIONES     — diplomacia entre facciones


═══════════════════════════════════════════════════════════════
FIN DE LA CHULETA
═══════════════════════════════════════════════════════════════
