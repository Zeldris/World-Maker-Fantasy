# Panel de personaje — diseño de frontend (2026-07-17)

**Estado:** diseño para revisión — nada implementado todavía.
**Origen:** petición de la usuaria: barra inferior de acceso con pestañas (mapa, inventario, estadísticas, diario, misiones, compañeros, reino, habilidades, profesiones) mientras juega una partida.

---

## 1. Patrón de navegación propuesto

En vez de páginas nuevas (que sacarían al jugador de `GameView`, perdiendo el contexto de los dos logs y el chat), propongo una **barra inferior fija con pestañas** que abren un **panel deslizante (drawer) por encima** de la vista de juego — el jugador nunca pierde de vista dónde estaba. Ya existe un patrón parecido en `GameView.tsx` (`showSheet` para la ficha de atributos) — esto es una generalización de esa misma idea a más pestañas.

```
┌─────────────────────────────────────┐
│  Header (personaje · mundo · fecha)  │
├───────────────┬───────────────────────┤
│  Tu personaje │      El mundo         │
│    (log)      │       (log)           │
├───────────────┴───────────────────────┤
│           Chat / composer             │
├─────────────────────────────────────┤
│ 🗺️ 🎒 📊 📖 🎯 👥 🏰 ✨ 🔨          │  ← barra inferior nueva
└─────────────────────────────────────┘
```

Al tocar un icono, un panel sube desde abajo (o se abre en modal en pantallas grandes) mostrando esa sección. Cerrar vuelve exactamente a donde estabas.

## 2. Las pestañas, una por una

| Pestaña | Qué muestra | Fuente de datos | ¿Necesita persistencia real primero? |
|---|---|---|---|
| **Mapa** | Regiones conocidas de Helek Sirik, dónde está el personaje ahora, puntos de interés visitados. | Estático al principio (a partir de `docs/rpgtarkor/areas.md`), luego cruzado con la posición real del personaje. | Parcial — el mapa en sí puede ser estático ya; marcar "dónde estoy" necesita una posición real guardada (ver § 4). |
| **Inventario** | Objetos que lleva el personaje. | `InventoryItem` (ya existe en el schema, sin usar). | Sí — hoy no hay ninguna fila real, todo vive en texto. |
| **Estadísticas** | Los 6 atributos jugables (ya existe `AttributeBars`) + las 9 columnas ampliadas (Inteligencia, Magia, Poder de Semilla, Moral, Resistencias) que documentamos hoy, aunque el motor no las use aún. | `Character.attributes` (frontend) — se puede mostrar ya, hoy mismo, sin persistencia nueva. | No — esta es la más fácil de construir ya. |
| **Diario** | Registro completo y permanente de lo que le ha pasado al personaje (no solo lo que cabe en pantalla). | `LogEntry` (ya existe en el schema, sin usar — `/turn` es stateless hoy). | Sí. |
| **Misiones** | Objetivos activos/completados del personaje. | **Modelo nuevo** — no existe todavía. Propuesta: `Quest` (título, descripción, estado, origen — ligada a un NPC o a un gancho de aventura). | Sí, y además necesita el modelo nuevo. |
| **Compañeros** | Aliados/súbditos que viajan con el personaje. | `Companion` (ya existe en el schema, sin usar). | Sí. |
| **Reino** | Súbditos, edificios, zonas conquistadas. | **Modelo nuevo** — no existe todavía (`Building`, `Territory`...). | Sí, y es la pestaña con más trabajo de diseño pendiente (ver § 5). |
| **Habilidades** | "Prompts" guardados y reutilizables como acciones rápidas, más los que el jugador cree y guarde. | **Modelo nuevo** — propuesta: `SavedAction` (nombre, texto del prompt, personaje). | Sí, y tiene un conflicto de diseño (ver § 3). |
| **Profesiones** | Catálogo cerrado de profesiones predefinidas (herrero, cazador, sanador...) que el personaje puede ejercer. | **Contenido nuevo** — catálogo curado por nosotros (parecido a cómo curamos el lore hoy), más una relación personaje↔profesión. | Sí. |

## 3. Conflicto resuelto: "nivel del personaje"

**Resuelto (2026-07-18) por la vía (B)** — ver [10-niveles-xp-reino.md](10-niveles-xp-reino.md). La usuaria reabrió la decisión de niveles explícitamente. Los huecos de Habilidades ya tienen fórmula cerrada: `huecosHabilidad(nivel) = 3 + floor(nivel / 2)` (3 a nivel 1, 13 a nivel 20).

## 4. Prerrequisito grande: persistencia real

Casi todas las pestañas (inventario, diario, misiones, compañeros, reino) necesitan que `Save`/`WorldState`/`LogEntry` dejen de ser modelos vacíos y `/turn` deje de ser stateless. Hoy el frontend manda todo el contexto en cada petición y no se guarda nada. Esto no es nuevo — ya estaba anotado como pendiente desde hace meses — pero este panel es la razón concreta para abordarlo ya, porque sin esto la mayoría de pestañas estarían vacías o mostrando datos falsos.

**Orden lógico sugerido**: (1) Estadísticas ya se puede construir con lo que hay. (2) Mapa puede empezar estático. (3) Todo lo demás espera a que se resuelva la persistencia real de `Save`.

## 5. La pestaña más grande: "Reino" — construida (2026-07-18)

La usuaria priorizó construirla ya en vez de esperar (contradice la recomendación original de este documento). Modelo de datos y diseño completo en [10-niveles-xp-reino.md](10-niveles-xp-reino.md) § 5: tres modelos (`Territory`, `Building`, `Subject`), estado vacío tratado como punto de partida narrativo válido (no un bug ni un bloqueo) — para Gorhorn hoy, la pestaña cuenta la historia de lo que todavía falta por restaurar.

## 6. Cosas que añado yo, con valor pero no pedidas explícitamente

- **Reputación/relaciones**: ya está implícito en el lore (Clan Serhu, Concordia de Hierro, Hagar...) pero no tiene ningún sitio donde vivir en la UI. Candidata a pestaña futura o a vivir dentro de "Diario"/"Misiones" en vez de ser una pestaña propia — no la añado a la barra todavía, pero la señalo para no perderla.
- **Indicador de notificación** (punto/badge) en pestañas con novedades — p. ej. "Misiones" con un punto si acaba de aparecer un gancho de aventura nuevo, "Diario" si hay entradas sin leer. Mejora de UX barata, no requiere datos nuevos, solo comparar contra la última vez que se abrió cada panel.
- **Reutilizar "Habilidades" como acceso rápido al `ChatComposer`**: en vez de una pestaña aislada, que una habilidad guardada rellene el campo de texto del chat (o lo envíe directamente) — así no es una mecánica nueva desconectada, es un atajo sobre el flujo de acción libre que ya existe.

## 7. Qué se puede construir YA (sin esperar a persistencia)

1. **Estadísticas**: ampliar el `AttributeBars` existente (o un panel nuevo) para mostrar también las 9 columnas ampliadas de `docs/rpgtarkor/personajes.md`, aunque sean solo informativas por ahora.
2. **Mapa**: vista estática de las regiones de Berig/Vaelira ya documentadas, sin posición dinámica todavía.
3. **La barra inferior en sí** y el patrón de drawer/panel — se puede montar con datos vacíos/placeholder en el resto de pestañas, listo para conectar cuando cada una tenga datos reales.

## 8. Pendientes de implementación (siguiente paso técnico, no hecho todavía)

1. Resolver el conflicto de niveles (§ 3) — decisión de la usuaria, no técnica.
2. Diseñar y migrar los modelos nuevos: `Quest`, `SavedAction`, y (más adelante) los de "Reino".
3. Abordar la persistencia real de `Save`/`WorldState`/`LogEntry` — prerrequisito de casi todo esto.
4. Construir el componente de barra inferior + drawer, empezando por Estadísticas y Mapa (los dos que no dependen de persistencia).
5. Diseñar el catálogo inicial de Profesiones (contenido curado, como el lore).
