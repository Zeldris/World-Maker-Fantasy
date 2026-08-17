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

**Añadido real, no en el diseño original (2026-08-17):** el panel "El mundo" tiene un tercer canal
alternable, "Reino" (`LogChannel.KINGDOM`) — un botón lo cambia entre el log de mundo y el de reino
(fundar/mejorar el Ayuntamiento, levantar un Campamento), nunca los dos a la vez, y solo se ofrece
una vez existe reino o ya hay alguna entrada de ese canal.

## 2. Las pestañas, una por una

**Estado a 2026-07-18: las 9 pestañas están construidas, incluida Misiones.** Tabla original (diseño) conservada por historial; el estado real de cada una está en la última columna.

| Pestaña | Qué muestra | Fuente de datos | Estado |
|---|---|---|---|
| **Mapa** | Regiones de Berig, punto actual, puntos de interés. | `frontend/src/data/map.ts` (SVG de regiones, estático) + `InteractiveMap.tsx` (clicable) + `MapaPanel.tsx`, que ya recibe `currentLocation`/`destinations` reales del backend (`Save.currentLocationId`, `docs/12` § 1) — "aquí ahora" y los destinos con tiempo de viaje ya ajustado a destreza dejaron de estar hardcodeados (corregido 2026-08-02, ver `docs/12` § 7 punto 10). | **Hecho** (posición dinámica real). |
| **Inventario** | Objetos que lleva el personaje, clicables para adjuntar a una acción. | `InventoryItem`, poblado por `newItem` del Narrador (sin catálogo cerrado todavía — ver `docs/12` § 4 para loot determinista). | **Hecho.** |
| **Estadísticas** | 6 atributos + nivel/XP + reparto de puntos ASI. | `Save.attributes`/`level`/`xp`. | **Hecho.** |
| **Diario** | Registro cronológico completo (personaje + mundo mezclados, sin importar el canal). | `LogEntry`. | **Hecho.** |
| **Misiones** | Objetivos activos/completados/fallidos. | `Quest`, poblado por `newQuest`/`questProgress` del Narrador (mismo patrón que Reino). | **Hecho** (2026-07-18). |
| **Compañeros** | Aliados que viajan con el personaje, poblados por `newCompanion` del Narrador. | `Companion`. | **Hecho.** |
| **Reino** | Súbditos, edificios, territorios — estado vacío tratado como narrativo, no bloqueado (la usuaria priorizó construirlo ya, contra la recomendación original de § 5). | `Territory`/`Building`/`Subject`. | **Hecho.** |
| **Habilidades** | Rejilla de iconos con pestañas Combate/Generales; clicar adjunta al chat (no envía directo). | `SavedAction` (+ `icon`/`description`/`isStarting`/`category`) — resuelto el conflicto de § 3 por la vía (B), niveles reabiertos. | **Hecho**, con kit inicial de 8 habilidades para Gorhorn (`backend/src/services/startingAbilities.ts`). |
| **Profesiones** | Ya no es pestaña propia (rediseño 2026-08-07) — vive dentro de Habilidades > Profesiones. Recolectoras (minero/talador/desollador) dan una habilidad base con pop-up de recolección; creadoras (herrero/carpintero/curtidor/constructor) muestran barra + TODAS sus recetas, bloqueadas por nivel si no se alcanzan. | `frontend/src/data/professions.ts` + `ProfessionProgress` (progreso real por oficio, no una única "adoptada" — `Save.profession` se quitó del todo). | **Hecho.** |

## 3. Conflicto resuelto: "nivel del personaje"

**Resuelto (2026-07-18) por la vía (B)** — ver [10-niveles-xp-reino.md](10-niveles-xp-reino.md). La usuaria reabrió la decisión de niveles explícitamente. Los huecos de Habilidades ya tienen fórmula cerrada: `huecosHabilidad(nivel) = 3 + floor(nivel / 2)` (3 a nivel 1, 13 a nivel 20).

## 4. Prerrequisito grande: persistencia real

Casi todas las pestañas (inventario, diario, misiones, compañeros, reino) necesitan que `Save`/`WorldState`/`LogEntry` dejen de ser modelos vacíos y `/turn` deje de ser stateless. Hoy el frontend manda todo el contexto en cada petición y no se guarda nada. Esto no es nuevo — ya estaba anotado como pendiente desde hace meses — pero este panel es la razón concreta para abordarlo ya, porque sin esto la mayoría de pestañas estarían vacías o mostrando datos falsos.

**Orden lógico sugerido**: (1) Estadísticas ya se puede construir con lo que hay. (2) Mapa puede empezar estático. (3) Todo lo demás espera a que se resuelva la persistencia real de `Save`.

## 5. La pestaña más grande: "Reino" — construida (2026-07-18)

La usuaria priorizó construirla ya en vez de esperar (contradice la recomendación original de este documento). Modelo de datos y diseño completo en [10-niveles-xp-reino.md](10-niveles-xp-reino.md) § 5: tres modelos (`Territory`, `Building`, `Subject`), estado vacío tratado como punto de partida narrativo válido (no un bug ni un bloqueo) — para Gorhorn hoy, la pestaña cuenta la historia de lo que todavía falta por restaurar.

## 6. Cosas que añado yo, con valor pero no pedidas explícitamente

- **Reputación/relaciones** (construido) — no quedó como pestaña propia de la barra inferior: vive como sub-pestaña dentro de "Personaje" (`ReputacionPanel.tsx`, junto a Equipo/Estadísticas/Profesiones, panel `9234c0e`), sincronizada en vivo tras cada turno.
- **Indicador de notificación** (punto/badge) en pestañas con novedades — p. ej. "Misiones" con un punto si acaba de aparecer un gancho de aventura nuevo, "Diario" si hay entradas sin leer. Sigue sin construirse: mejora de UX barata pendiente, no requiere datos nuevos, solo comparar contra la última vez que se abrió cada panel.
- **Reutilizar "Habilidades" como acceso rápido al `ChatComposer`** (construido) — clicar una habilidad guardada la adjunta al composer en vez de enviarla directa (§ 2, fila Habilidades); no es una mecánica nueva desconectada, es el atajo sobre el flujo de acción libre que ya existía.

## 7. Qué se puede construir YA (sin esperar a persistencia)

1. **Estadísticas**: ampliar el `AttributeBars` existente (o un panel nuevo) para mostrar también las 9 columnas ampliadas de `docs/rpgtarkor/personajes.md`, aunque sean solo informativas por ahora.
2. **Mapa**: vista estática de las regiones de Berig/Vaelira ya documentadas, sin posición dinámica todavía.
3. **La barra inferior en sí** y el patrón de drawer/panel — se puede montar con datos vacíos/placeholder en el resto de pestañas, listo para conectar cuando cada una tenga datos reales.

## 8. Pendientes de implementación (actualizado 2026-08-02)

1. ~~Resolver el conflicto de niveles (§ 3)~~ — hecho.
2. ~~Diseñar y migrar los modelos nuevos: `Quest`, `SavedAction`~~ — hecho. Los de "Reino" (`Territory`/`Building`/`Subject`) también existen en el schema — la pausa de Reino como línea de juego activa que citaba `docs/archivo/11-roadmap-historico.md` (2026-07-19) quedó superada: reino fundado y jugado en vivo (2026-08-07), reglas de construcción cerradas (`docs/17-reglas-construcciones-reino.md`, 2026-08-04) y economía de reino (`KingdomStats`) con habilidades/recetas de construcción en tiempo real (2026-08-13) — ver `docs/10-niveles-xp-reino.md` § 9 para el detalle y una nota pendiente de reconciliar allí.
3. ~~Abordar la persistencia real de `Save`/`WorldState`/`LogEntry`~~ — hecho.
4. ~~Construir el componente de barra inferior + drawer~~ — hecho.
5. ~~Diseñar el catálogo inicial de Profesiones~~ — hecho (2026-08-07): recolectoras vs creadoras,
   recetas de `crafting.ts` expuestas como habilidades de oficio desbloqueables por nivel, pop-up
   de recolección determinista respaldado por `WorldPopulation` (ver `docs/16-poblacion-dinamica.md`
   § 3.5). El sub-tab propio de "Personaje > Profesiones" se quitó, redundante con Habilidades.
   Pendiente real: quién ENSEÑA un oficio nuevo (NPCs) — aplazado a propósito hasta que haya un
   caso concreto, mismo criterio que las facciones dinámicas por NPC.
