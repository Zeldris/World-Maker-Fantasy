# Mecánicas de juego — Tarkor

**Fase:** Diseño del sistema de juego interno (post-arquitectura, pre-worldbuilding).
**Fecha:** 2026-07-16
**Punto de partida:** decisión de producto 3 ([02-decisiones.md](02-decisiones.md)) — atributos con efecto real y tiradas visibles — dejó pendiente "el sistema concreto de tiradas". Este documento lo cierra y además cubre cómo funciona el juego por dentro turno a turno.

**Decisiones tomadas a partir de este análisis:** ver [06-decisiones-mecanicas.md](06-decisiones-mecanicas.md).

---

## 0. Alcance — no es un RPG de combate

**Corrección importante hecha durante el diseño:** Tarkor no es un RPG centrado en combate. Es un motor de resolución de acciones **genérico** — observar, recolectar, construir, comerciar, gobernar, dar órdenes, negociar, explorar, luchar... la idea es poder intentar prácticamente cualquier cosa, siempre dentro de las normas del mundo y de lo que la partida ya ha establecido. Todo pasa por el mismo mecanismo (clasificación → tirada → consecuencias), sin un subsistema especial para combate. La salud es solo una faceta más del estado del personaje, no el eje del diseño.

---

## 1. Lo que ya está fijado (no se toca aquí)

- **Atributos** (ya en el frontend demo y en `PregeneratedCharacter.attributes`/`Save.attributes`): `fuerza`, `destreza`, `sigilo`, `voluntad`, `carisma`, `arcano`. Rango típico 4–18, presupuesto de creación ~60 puntos.
- **El backend calcula la tirada, nunca el modelo** (decisión de arquitectura § 5): el LLM narra alrededor de un resultado ya fijado, no decide si algo tiene éxito.
- **Qwen2.5:7b (Narrador) es fiable con salida estructurada** — esto es relevante para el punto 3 de abajo.

---

## 2. Fórmula de resolución de tiradas — DECIDIDO

```
resultado = d20 + floor(atributo / 2)
éxito si resultado >= dificultad
```

Aplicable a **cualquier tipo de acción** — física, social, de construcción, de gobierno, lo que sea. El Narrador decide qué atributo y qué dificultad corresponden según el contexto concreto de la acción, no según una categoría fija de "tipo de acción".

**Umbrales de dificultad (confirmados):**

| Dificultad | Valor | Ejemplo |
|---|---|---|
| Trivial | 8 | Abrir una puerta sin cerrojo |
| Fácil | 12 | Trepar un muro bajo |
| Media | 15 | Convencer a un guardia indeciso |
| Difícil | 18 | Forzar una cerradura compleja bajo presión |
| Muy difícil | 22 | Persuadir a un noble hostil de algo que le perjudica |

**Grados de éxito: binario** (éxito/fallo, sin críticos por ahora — se puede añadir más adelante sin romper nada).

---

## 3. Quién decide qué se tira — el problema central de "acción libre → mecánica"

El jugador no elige de un menú ("Sigilo vs Dificultad 12") — escribe texto libre ("me escondo detrás del barril mientras pasa la guardia"). Alguien tiene que traducir eso a `(atributo, dificultad, ¿hace falta tirar?)` antes de que el backend pueda tirar el dado.

**Se evaluaron tres formas de resolverlo:**

- **A — Heurística por palabras clave** (la que usa hoy la demo del frontend): gratis e instantánea, pero frágil y no se adapta a redacción libre ni a acciones fuera de lo físico/combate.
- **B — Llamada de clasificación separada de la narración**: el modelo devuelve `{ requiereTirada, atributo, dificultad, razon }` antes de narrar; el backend tira el dado con ese resultado, y una segunda llamada narra ya con el resultado fijo. Más preciso y sensible al contexto (funciona igual de bien para "construyo una cerca" que para "ataco al guardia"), a cambio de dos llamadas al modelo por turno.
- **C — Una sola llamada con "plantilla condicionada"** (el modelo escribe de antemano las dos narraciones posibles, éxito y fallo, y el backend elige según la tirada): una sola llamada, pero sin validar si Qwen2.5:7b lo hace bien.

**DECIDIDO: Opción B** (dos llamadas por turno). Ver [06-decisiones-mecanicas.md](06-decisiones-mecanicas.md) para el razonamiento completo.

---

## 4. Estado del personaje (salud y todo lo demás) — DECIDIDO

Dado el alcance genérico (sección 0), el estado del personaje no es solo "salud" — incluye reputación, qué posee, a quién gobierna, qué ha construido, relaciones, etc. Se decidió un modelo híbrido:

- **Un campo estructurado ligero para la condición física** (`ileso` → `herido` → `grave` → `incapacitado` → `muerto`), fácil de mostrar en la ficha de personaje del frontend.
- **Todo lo demás como hechos libres** en `WorldState.facts` — sin campos fijos para reputación, posesiones, gobierno, construcciones, etc. Máxima flexibilidad para un juego de alcance tan abierto.

---

## 5. Progresión del personaje — REVERTIDO, ver docs/10

**Obsoleto (2026-07-18).** Esta sección decía "sin sistema de niveles/XP". La usuaria pidió explícitamente introducir niveles y XP con la armazón de D&D. El diseño resultante (tabla de XP, fuentes de XP genéricas, qué otorga el nivel, y el modelo de Reino que se construyó en el mismo pase) vive en [10-niveles-xp-reino.md](10-niveles-xp-reino.md) — ya implementado.

---

## 6. Inventario y equipo — DECIDIDO

**Contexto narrativo, sin bonificadores fijos tabulados.** Lo que el personaje posee vive como hechos ("tiene 200 monedas", "posee una granja", "lleva una ganzúa fina"), y el Narrador lo tiene en cuenta al narrar y al fijar la dificultad de una tirada (es más fácil forzar una cerradura con ganzúa que sin ella) — pero no hay una tabla fija de "objeto X = +2 a tirada Y". Coherente con no tener números fijos para casi nada salvo los atributos y la tirada misma.

---

## 7. Flujo de un turno, de principio a fin

```
1. Jugador escribe una acción en el chat (de cualquier tipo: física, social, construcción, gobierno...).
2. Backend llama al Narrador (Ollama) — clasificación:
   → { requiereTirada, atributo, dificultad, razon }
3. Si requiereTirada: backend tira el dado (d20 + floor(atributo/2) vs dificultad).
4. Backend llama al Narrador otra vez — narración:
   → { narration, new_facts[], clock_advance_minutes, condicionFisica? }
   (recibe el resultado de la tirada ya fijado, más el estado de mundo actual —
   hechos, posesiones, reputación, lo que el personaje gobierna o ha construido...)
5. Backend guarda LogEntry (channel CHARACTER) + actualiza WorldState.facts (y condiciónFisica si cambió).
6. Con cierta probabilidad/lógica de agenda, se dispara también una llamada al Cronista
   (mismo patrón: estado de mundo → narración + nuevos hechos) → LogEntry (channel WORLD),
   respetando el espaciado de la decisión técnica 5 (3-10s configurable).
7. Frontend muestra ambas entradas según van llegando.
```

**Nota de rendimiento:** el paso 2+4 son dos llamadas al modelo por turno (decisión de la sección 3) — en el hardware de la usuaria (CPU, ver arquitectura § 4) esto puede sumar bastante latencia por turno. Aceptado porque el juego es por turnos, no chat en tiempo real, y ya existe el sistema de ritmo (decisión técnica 5). A vigilar en el benchmark real pendiente.
