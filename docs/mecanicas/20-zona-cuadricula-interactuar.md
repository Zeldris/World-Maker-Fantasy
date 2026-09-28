# Zona: cuadrícula, colisión e Interactuar

**Estado:** implementado; descripción comprobada contra el código el 2026-09-28.
**Qué cubre:** cómo se mueve el jugador dentro de una `Location`, cómo se mueve el mundo con él,
cuándo hay encuentro y qué pasa después (Interactuar, combate, caza, recolección, saqueo). Es la
forma principal de jugar desde las fases 1-5 del
[plan de mecánicas por zona](../registros/plan-mecanicas-por-zona-2026-09-28.md): lo que ocurre en un
punto del mapa se hace desde el mapa, no con botones sueltos.
**Código:** `backend/src/services/zonaPosicion.ts` (geometría pura), `services/zonePoints.ts`
(puntos del mundo), `services/dynamicMode.ts` (Interactuar), `services/caza.ts` (caza en grupo),
`routes/saves/zona.ts`, `routes/saves/dynamicMode.ts`, `routes/saves/dynamicModeRecurso.ts`;
frontend en `components/panels/ZonaPanel.tsx`.

---

## 1. El lienzo y la cuadrícula

- Cada `Location` tiene un lienzo de **800 × 600 px**, dividido en celdas de **50 px**: 16
  columnas × 12 filas (`CELL_SIZE_PX`, `GRID_COLS`, `GRID_ROWS`). Una celda son unos 50 m.
- La posición del jugador vive en `Save.zonaPosX`/`zonaPosY`. Al entrar en una zona aparece en el
  borde por el que llega (`puntoDeEntradaParaDireccion`); tras una derrota vuelve a la entrada.
- Las **salidas** a zonas vecinas se colocan en el borde según su rumbo real, separadas al menos
  100 px (`posicionesDeSalidas`). Una salida sin visitar se muestra como "Camino hacia el {rumbo}".

## 2. Qué hay en el mapa: `ZonePoint`

Cada cosa con la que se puede interactuar tiene un `ZonePoint` ("todo debe tener ZonePoint; si
no, ¿cómo interactúas?").

| Campo | Para qué |
|---|---|
| `tipo` | `FAUNA`, `NPC`, `RECURSO` o `EDIFICIO` |
| `targetSlug` | La especie, el NPC, la fuente de recurso o el edificio |
| `cantidad` | Tamaño del grupo (fauna) o existencias |
| `x`, `y` | Posición actual |
| `origenX`, `origenY` | Centro de su territorio, para el paseo aleatorio |
| `ruta`, `pasoRuta` | Ruta fija que recorre en bucle, si la tiene |
| `activo` | Si está en el mapa ahora mismo |
| `factionSlug` | Color del punto según la reputación del jugador con esa facción |

**Importante:** los `ZonePoint` son **por mundo**, no por partida (decisión B1 pendiente, ver el
[roadmap](../producto/21-roadmap.md)). Nunca se modifican a mano en la base de datos real.

Además de los `ZonePoint`, `GET /zona` añade puntos dinámicos: objetos tirados, cadáveres con
Saquear/Desollar, parcelas de construcción (interiores del Reino) y el propio jugador.

**Grupos de fauna.** `recalcularZonePointsDeLocation` reparte la población regional
(`WorldPopulation`) en grupos con `repartirEnGrupos`: capas descendentes de tamaño 4 → 3 → 2 → 1,
con uno o dos grupos por capa. `reconciliarGrupos` ajusta los grupos existentes cuando la población
cambia (caza, crecimiento). Un `ZonePoint` de fauna o recurso sin `WorldPopulation` detrás se
desactiva.

**Visibilidad.** Un punto puede estar oculto hasta que el jugador acepte una misión
(`zonePointVisiblePara`), no existir de día o de noche (`zonePointActivoAhora`) o haber
desaparecido para siempre (NPC muerto). Lo que el jugador no ha descubierto se muestra como "???";
toparse con ello lo descubre.

## 3. Moverse: `POST /saves/:id/zona/mover`

El jugador hace clic en una celda; nunca teclea coordenadas.

1. **Bloqueos previos.** Si hay un encuentro agresivo sin resolver, no se puede andar: primero hay
   que reaccionar (combatir o huir).
2. **Camino.** `calcularCamino` (Bresenham) desde la celda actual hasta el destino. Se recalcula en
   cada llamada, porque el jugador puede cambiar de destino a mitad.
3. **Un paso por llamada.** El backend avanza **una celda** y devuelve el resultado; el frontend
   anima y vuelve a llamar. Así se puede parar justo donde haya un encuentro.
4. **El mundo da un paso a la vez** (`avanzarZonePointsUnPaso`, "estilo Mount & Blade"): la fauna
   y los NPC con ruta la siguen; los demás pasean dentro de su territorio; un agresivo que ha visto
   al jugador lo persigue. La colisión se evalúa sobre las posiciones ya actualizadas. Si el
   jugador no se mueve (clic en su propia celda), el mundo tampoco.
5. **Reloj.** Cada paso cuesta **1 minuto de ficción** y regenera energía como el descanso pasivo.
6. **Encuentro** (`detectarEncuentroEnCelda`):
   - **Misma celda**: colisión real, inevitable. Con un agresivo o enemigo, combate forzado.
   - **Celda adyacente**: aviso y oferta de Interactuar.
   - **Quién ve a quién primero**: tirada de Destreza del jugador contra la del NPC
     (`quienIniciaEncuentro`). Decide la narración y quién abre.
   - Un encuentro detiene el camino en ese punto; no queda trayecto pendiente.
   - Una oferta pacífica que el jugador deja atrás andando se da por ignorada.
   - Si el recurso requiere más nivel de oficio del que tiene el jugador, se muestra como
     avistamiento con el motivo, sin oferta.

Moverse no se permite durante un combate, un tránsito o con la partida terminada.

## 4. Interactuar (modo dinámico)

Contenedor único de todo lo que interrumpe o se ofrece en una escena. Estado en
`Save.pendingDynamicModeOffer` (la oferta) y `Save.pendingDynamicMode` (la conversación en curso).

| Ruta | Qué hace |
|---|---|
| `POST /saves/:id/modo-dinamico/interactuar` | Acepta la oferta y abre el modo |
| `POST /saves/:id/modo-dinamico/responder` | Una vuelta más de conversación |
| `POST /saves/:id/modo-dinamico/ignorar` | Rechaza la oferta |

Según el `tipo` del candidato:
- **NPC y FAUNA:** conversación de hasta **4 vueltas** (`MAX_VUELTAS_MODO_DINAMICO`), 2 minutos de
  ficción cada una, con opciones que el LLM narra. Al cerrarse (por agotar vueltas, por decisión
  del narrador o por "Salir"), toda la conversación se vuelca a un `LogEntry` y puede dejar una
  oferta de misión o un hecho de sesión.
- **RECURSO:** se resuelve de una vez, sin conversación: tirada de recolección y botín reales
  (`resolverRecoleccion`), mismas reglas que el antiguo botón de recolectar.
- **Combate forzado:** si el candidato es agresivo, la tarjeta ofrece solo **Combatir** o **Huir**.
  Abrir el combate identifica al NPC aunque su nombre estuviera oculto.

Cuando no hay colisión, el turno también puede ofrecer Interactuar por su cuenta
(`decideOfertaModoDinamico`), con un enfriamiento de 45 minutos de ficción
(`COOLDOWN_MODO_DINAMICO_MINUTOS`).

## 5. Cazar, saquear y desollar desde el mapa

- **Cazar** (`POST /saves/:id/zona/cazar`): caza exactamente el grupo con el que se ha
  colisionado (`pendingDynamicModeOffer.zonePointId`), no un sorteo de la población regional.
  `iniciarCaza` (`services/caza.ts`) abre el combate, múltiple si el grupo es de más de uno. Un
  grupo recién dispersado no se puede volver a cazar hasta que pase su enfriamiento.
- **Cadáveres:** tras un combate, el cuerpo queda en el mapa como punto `CADAVER` con **Saquear** y
  **Desollar** si procede. Desaparece a las 48 h de ficción (`worldTick`).
- **Recolección por texto libre:** si el jugador escribe "mino hierro", el log le indica que lo haga
  desde el mapa (icono 🧭), en vez de resolverlo por una vía paralela.

Las habilidades Cazar, Minar, Talar, Recolectar hierbas, Recoger, Pescar y Buscar salieron del kit
inicial en la fase 4. Pescar y Buscar **no tienen todavía puntos en el mapa**, así que hoy no hay
forma de usarlos (ver el roadmap).

## 6. Pruebas

| Área | Tests |
|---|---|
| Geometría, caminos, grupos | `zonaPosicion.test.ts` |
| Puntos, visibilidad, reconciliación | `zonePoints.test.ts` |
| Mover, colisión, aviso, persecución | `zonaMover.integration.test.ts` |
| Grupos de fauna reales | `zonaGrupos.integration.test.ts` |
| Cazar desde la tarjeta | `zonaCazar.integration.test.ts`, `caza.integration.test.ts` |
| Compañeros en la zona | `zonaCompanion.integration.test.ts` |
| Parcelas en interiores del Reino | `zonaParcelas.integration.test.ts` |
| Interactuar | `dynamicMode.integration.test.ts`, `dynamicModeRecurso.integration.test.ts` |

---

## Historial

- **2026-09-02** — Primer `ZonePoint` en Las Llanuras (prototipo, solo marcadores).
- **2026-09-08** — Cuadrícula 16 × 12, movimiento por clic, colisión y aviso, rutas y paseo
  aleatorio; Interactuar como contenedor único (franjas 0-3).
- **2026-09-17** — Fauna diurna y nocturna, persecución, tirada de quién ve primero.
- **2026-09-28** — Fases 1-5 del plan de mecánicas por zona: grupos reales, cazar desde la tarjeta,
  cobertura de Las Llanuras, retirada de habilidades, cadáveres en el mapa. Un paso = 1 minuto.
