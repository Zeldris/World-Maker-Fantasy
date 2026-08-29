# Frontend — checklist de mejoras (2026-08-27, segunda ronda)

Consolidado de 6 auditorías en paralelo sobre TODO el frontend (no solo lo tocado en la sesión de
"Dinamismo del mundo"): 3 pasadas de UI/UX (cada una acabó explorando un área — combate/modales de
acción, personaje/inventario/habilidades/compañeros, mapa/diario/misiones/reputación/enciclopedia —
más una cuarta específica sobre reino/modo dinámico), 1 de integración cruzada, y 1 de calidad de
código. Complementa a `frontend-diseno-ux-hallazgos-2026-08-27.md` (auditoría de diseño de producto,
misma fecha, criterio distinto — aquella es "cómo se debería ver/organizar", esta es "qué está roto,
a medias, o inconsistente hoy").

Ningún hallazgo se ha implementado todavía. Checklist para ir marcando según se cierre cada uno.

---

## A. Alto impacto

- [x] **A.1 — `GameView.tsx` es un god file (1816 líneas)**. **APLICADO 2026-08-27**: `handleSubmit`
  extraído a `hooks/useTurnFlow.ts` (mismo criterio que `useCombatFlow.ts`, setters como parámetros).
  `GameView.tsx` 1867→1649 líneas. Test nuevo `useTurnFlow.test.tsx` (10 tests) cazó un bug real de
  producción de paso: `isBusyError` no distinguía un `TurnLockedError` real de un `BusyError`
  (arreglado en `gameViewHelpers.ts`).
- [x] **A.2 — Sin guard entre modales/combate simultáneos**. **APLICADO 2026-08-27**:
  `anyActionModalOpen` en `useActionModalsState.ts` + `anyModalOpen` combinado en `GameView.tsx`
  (incluye `detailTarget`/`kingdomFoundedInfo`/`combat.combatOpen`), aplicado como guard en
  `handleAttachAbility` y `disabled` en el botón de Desollar pasiva.
- [x] **A.3 — `pendingDynamicMode`/`activeDynamicMode` no sobrevive a un F5**. **APLICADO
  2026-08-27**: `PendingDynamicMode` (backend) amplía con `narration`/`opciones` de la última vuelta;
  `GET /saves/:id` expone `pendingDynamicMode`; `syncFromSave` lo reconstruye igual que
  `combateIniciado`. Tests backend nuevos (`detail.test.ts`, `dynamicMode.integration.test.ts`).
- [x] **A.4 — Composer de texto libre sin bloquear en varios casos reales**. **APLICADO 2026-08-27**:
  `disabled` del `ChatComposer` extendido con `anyModalOpen`.
- [x] **A.5 — `ChatComposer` sin accesibilidad básica**. **APLICADO 2026-08-27**: `role="textbox"`,
  `aria-multiline`, `aria-label`, `aria-disabled` añadidos.
- [x] **A.6 — `HealSelectionModal` sin busy/error en el submit**. **APLICADO 2026-08-27**: flag local
  `confirmado` (síncrono, sin await propio — no hace falta `useSubmitError` completo).
- [x] **A.7 — Fallos silenciosos en los 3 flujos nuevos de modo dinámico**. **APLICADO 2026-08-27**:
  `dynamicModeOffer`/`activeDynamicMode` ganan `error`/`busy` visibles; la tarjeta ya no se limpia
  hasta confirmar éxito.
- [x] **A.8 — Reino sin codificación visual de urgencia**. **APLICADO 2026-08-27**: tonos por estado
  en Territorios/Edificios (`CONTROL_TONE`/`BUILDING_STATUS_TONE`) + alarma roja en comida/bebida
  ≤0 en Economía.
- [x] **A.9 — Círculo vs. rombo apenas distinguibles**. **APLICADO 2026-08-27**: rombo alargado
  verticalmente (7×10 en vez de 9×9).

## B. Medio impacto

### Componentes/patrones duplicados o sin reutilizar
- [x] **B.1 — APLICADO 2026-08-27**: nuevo `OfferCard.tsx` compartido (`tone`/`icon`/`title`/
  `subtitle`/`error`/`actions`/`resolvedText`), las 3 tarjetas de `LogPanel.tsx` migradas.
- [ ] **B.2 — PENDIENTE, alcance mayor de lo previsto**: `Button.tsx` solo tiene 3 variantes
  (`primary`/`secondary`/`ghost`, sin `danger`/`accent2`) y un tamaño (`text-sm`) distinto al patrón
  `text-xs`/`text-2xs` de los botones de acción/modal ya vistos en el resto de este checklist —
  adoptarlo exige ampliarlo primero y luego tocar decenas de archivos. Se deja fuera de esta pasada
  (deuda de mantenimiento documentada, no bug visible).
- [x] **B.3 — APLICADO 2026-08-27**: `PostCombatInteractionModal` migrado a `SelectionModalShell`
  (overlay/panel/título compartidos). Layout de botones se mantuvo en COLUMNA dentro de `children`
  en vez del `footer` en fila del shell — decisión de valor consciente: "Matar" es irreversible y
  necesita quedar separado de "Salir", nunca en la misma fila estrecha donde un roce pulsa la
  contraria por error.

### Modo dinámico (pieza más nueva — la que más se nota "recién llegada")
- [x] **B.4 — APLICADO 2026-08-27**: `error` visible en `DynamicModeModal`/tarjeta de oferta (ver A.7).
- [x] **B.5 — APLICADO 2026-08-27**: botón "Salir" real durante el flujo, endpoint `/ignorar`
  ampliado en backend para limpiar `pendingDynamicMode` también con conversación en curso.
- [x] **B.6 — APLICADO** (misma nota que C.2): `imageUrl` (prop nueva) se pinta como banner al
  abrir el modal, resuelto por `targetSlug` conocido — `DynamicModeModal.tsx`.
- [x] **B.7 — APLICADO 2026-08-27**: `text-accent2-400` (azulado, canal "El mundo") en vez de
  `accent-400` (dorado, "Tu personaje").
- [x] **B.8 — APLICADO 2026-08-27 (segunda mitad hoy)**: la transición ENTRE vueltas ya estaba
  resuelta (`key={turno.vuelta}` + `animate-entry-in`); faltaba el indicador MIENTRAS se espera la
  siguiente vuelta — añadido `{busy && <p className="animate-pulse">Resolviendo...</p>}` en
  `DynamicModeModal.tsx`. `tsc -b` limpio.
- [x] **B.9 — APLICADO 2026-08-27**: tarjeta de oferta usa `accent2` en vez de `quest` (amarillo).
- [x] **B.10 — APLICADO 2026-08-27**: segunda línea de contexto ("Puedes hablar con esta persona" /
  "Hay algo cerca con lo que puedes interactuar") antes de decidir.

### Sistemas de color/reputación inconsistentes
- [x] **B.11 — APLICADO 2026-08-27**: `ZonaPanel` usa ahora los mismos tonos hex (`emerald-500`/
  `red-500`) que `ReputacionPanel` para Amigable/Enemigo — cada sistema conserva su propio número
  de bandas (3+SIN_FACCION por punto de mapa vs. 5 por temperamento de combate, legítimamente
  distintas), solo se alineó el COLOR donde el concepto se solapa.
- [x] **B.12 — APLICADO 2026-08-27**: nuevo `agresorLegible()` en `ZonaPanel.tsx` descompone
  "Clan Serhu-Concordia de Hierro" en "Clan Serhu + Concordia de Hierro" solo para MOSTRAR, sin
  tocar el dato real del backend (que sigue siendo correcto como concepto de alianza).
- [x] **B.13 — APLICADO 2026-08-27**: `ReputacionPanel` es ahora pestaña propia de `worldTabs`
  (canal azulado), no sub-pestaña de "Personaje". Cambio de navegación real: `PanelId` ampliado,
  `PersonajeSubTab` reducido a `'equipo' | 'estadisticas'`, render movido a nivel superior en
  `GameView.tsx`.
- [x] **B.14 — APLICADO 2026-08-27, alcance mayor de lo previsto**: `Companion.condicionFisica` YA
  existía en el schema (participa de verdad en combate múltiple) pero nunca se exponía en
  `GET /saves/:id` — expuesto ahora (`null` para compañeros sin capa mecánica real, mismo criterio
  que `comida`/`agua`), `CompanerosPanel.tsx` muestra `HealthBar` cuando aplica.
- [x] **B.15 — REVISADO 2026-08-27, sin cambio**: el propio comentario de `HuntSelectionModal.tsx`
  (`difficultyRowClasses`) documenta que fue petición EXPLÍCITA de la usuaria (2026-08-14: "verde,
  amarillo o rojo según su dificultad... mismos 3 tokens semánticos que ya usa el resto del juego
  para lo mismo"). No es un descuido, es una decisión de producto ya tomada — se deja tal cual.

### Reino
- [x] **B.16 — REVISADO 2026-08-27, sin cambio**: Depositar/Retirar mueven el objeto entre dos
  listas visibles (desaparece de una, aparece en la otra) y Crear/Borrar cierran el formulario o
  quitan la fila — las 4 acciones YA tienen feedback visual real por el propio cambio de estado. El
  flash de `PlantillaSelect` existe porque ahí el ÚNICO indicio de éxito es que un `<select>` cambie
  su valor (fácil de no notar); no es el caso aquí. Añadir un flash más sería redundante, no un fix.
- [x] **B.17 — APLICADO** (misma nota que C.2): `categoriasConocidas` (`datalist` con las
  categorías reales ya usadas en el inventario) en `ReinoPanel.tsx`.
- [x] **B.18 — APLICADO** (misma nota que C.2): el aviso "Tu Ayuntamiento sigue sin nombre de
  reino" ahora se muestra SIEMPRE con `ayuntamiento` presente — el botón "Fundar reino" solo se
  añade dentro si `onFundarReino` existe, nunca desaparece el bloque entero (`ReinoPanel.tsx`).
- [x] **B.19 — APLICADO 2026-08-27, corrección de rumbo real**: el hallazgo original suponía que
  la causa era el conflicto de facciones del mundo — investigado y descartado: `Territory.control`
  cambia por FELICIDAD sostenida del propio reino (7 días, `DIAS_PARA_REBELION`/`CONSOLIDAR`),
  sistema totalmente independiente de `WorldState.agenda`. Expuesto `diasFelicidadBaja`/
  `diasFelicidadAlta` (backend nuevo en `KingdomStats` → API → tipo), aviso visible en Territorios
  con la causa REAL, no un enlace falso a un sistema no relacionado.

### Otros
- [x] **B.20 — INVESTIGADO 2026-08-27, hallazgo original no aplica**: `esperandoDefensaJugador`
  (`awaitingDefense`) es un concepto EXCLUSIVO del combate 1v1 clásico (`pendingNpcAttack`,
  turnResolution.ts) — ahí siempre hay un único NPC posible por diseño, nunca combatientes
  duplicados. El sistema de combate múltiple (`combateMultipleOrquestacion.ts`) no tiene ningún
  concepto de "defensa a ciegas" — nunca activa `awaitingDefense`. El riesgo que planteaba el
  checklist (atacante distinto al `selectedNpcSlug` con varios combatientes iguales) no puede
  ocurrir con el diseño actual — se deja documentado, sin cambio de código.
- [x] **B.21 — APLICADO 2026-08-27**: `sm:group-focus-within:flex` añadido junto a `group-hover`.
- [x] **B.22 — APLICADO 2026-08-27**: `IconCard` gana prop `passive` con tratamiento visual propio
  (borde punteado, sin opacidad reducida) distinto de `disabled` (bloqueado por requisitos, podría
  desbloquearse) — "esto no se pulsa nunca" ya no se confunde con "esto está bloqueado ahora mismo".
- [x] **B.23 — APLICADO 2026-08-27**: 3er mensaje de aviso (banda ámbar, 25-49%) que faltaba, mismo
  umbral que ya usa `ResourceBar` — antes saltaba de "sin aviso" a "desgaste real" sin escalón.
- [x] **B.24 — APLICADO 2026-08-27**: nueva prop `disabledReason` en `ChatComposer`, calculada en
  `GameView.tsx` con el motivo real (pensando/ocupado/en combate/otro modal abierto) en vez de un
  texto de ayuda siempre idéntico.
- [x] **B.25 — REVISADO 2026-08-27, decisión explícita: sin gate**: confirmado que nunca hubo
  "modo autor" en todo el proyecto — la usuaria es la única jugadora de su propia partida y usa la
  herramienta activamente para generar assets; añadir un gate solo introduciría fricción a su
  propio flujo de trabajo sin beneficio real. Se deja sin cambio, decisión consciente documentada.

## C. Bajo impacto

- [x] **C.1 — APLICADO 2026-08-27**: script de un solo uso (respeta JSX anidado/llaves) añadió
  `type="button"` a los 122 `<button>` que no lo tenían en 43 archivos — verificado con `tsc -b`,
  `oxlint` (sin warnings nuevos) y la suite completa (103/103). Formato mecánico (`type="button"`
  pegado a `<button` en vez de en línea propia) — funcionalmente correcto, sin reformateo cosmético
  posterior por ser deuda de bajo impacto, no justifica el volumen de edición manual.
- [x] **C.2 — APLICADO** (checklist consolidado 2026-08-27, casilla desactualizada — el trabajo
  ya estaba hecho en el código, solo faltaba marcar aquí): `markCarcassPending()`/
  `checkCarcassPending()` en `useActionModalsState.ts`, setter crudo retirado del `return` público.
- [ ] **C.3** — 40+ `useState` sueltos de "estado de personaje" en `GameView.tsx` sin agrupar —
  candidato a `useCharacterState` o reducer único (`syncFromSave` ya actúa como reducer manual de 46
  líneas). Sin tocar a propósito (checklist consolidado 2026-08-27): refactor MEDIA/riesgo de
  regresión silenciosa en el archivo más grande y crítico del proyecto, sin beneficio funcional
  inmediato — se deja para una pasada dedicada, no de paso dentro de un cierre de checklist grande.
- [ ] **C.4** — `EnciclopediaPanel.tsx` (1194 líneas) y `CombatPanel.tsx` (935 líneas) — ya
  subdividido en sub-componentes locales, pero podrían moverse a archivos propios si se retoca algo.
- [x] **C.5 — APLICADO** (misma nota que C.2 — casilla desactualizada): a partir de 10, el
  contador se pinta como badge fuera del icono (círculo aparte arriba a la derecha) en vez de
  centrado dentro, en `ZonaPanel.tsx`.
- [x] **C.6/C.7 — APLICADOS** (misma nota que C.2): `regionControlDisplay` centraliza tono+texto
  de control regional (ya no `text-wood-400` apagado) y el `switch` de `regionControl.estado`/
  `ZonePointShape` ya es exhaustivo, `ZonaPanel.tsx`.
- [x] **C.8 — APLICADO 2026-08-27**: `handleDismissDynamicModeOffer` ya tenía `console.error` (se
  arregló durante A.7 sin marcarlo aquí); `handleSpendAttributePoint` lo gana ahora, mismo criterio.
- [x] **C.9 — REVISADO 2026-08-27, sin cambio real posible**: `MisionesPanel` no hace fetch propio
  (a diferencia de `DiarioPanel`) — recibe `quests` ya cargado por `syncFromSave`. Si esa carga
  falla, falla TODA la partida (ya con su propio manejo de error de nivel superior), no solo
  Misiones — no hay un escenario real de "todo lo demás carga bien pero Misiones falla sola".
- [x] **C.10 — REVISADO 2026-08-27, sin hueco real**: `handleSimpleModalSelect` (GameView.tsx)
  cierra el modal INMEDIATAMENTE (síncrono) y pasa a `handleSubmit`, que ya activa su propio
  indicador de "pensando" en `LogPanel` (`characterThinking`/`timedThinkingText`) — no hay ningún
  hueco de "espera sin feedback" entre el cierre del modal y el indicador normal del turno.
- [x] **C.11 — APLICADO** (misma nota que C.2): header ya usa `rounded-full text-2xs`, igual que
  `MapaPanel`.
- [x] **C.12** — `EnciclopediaLinkedText`: los chips de enlace a la Enciclopedia son visualmente
  indistinguibles de los chips decorativos del composer — solo el cursor `pointer` delata que son
  clicables. **APLICADO 2026-08-27**: subrayado punteado sutil (`underline decoration-accent-500/50
  decoration-dotted`) añadido al chip clicable, mismo lenguaje visual pero ahora distinguible sin
  depender del cursor.
- [x] **C.13** — Prosa larga sin estructurar en la pestaña "Combate" de `HabilidadesPanel` (párrafo
  denso en vez de lista/badges). **APLICADO 2026-08-27**: reestructurado en lista de 4 badges
  (Siempre / 2 raciales / 1-2 de arma / 4 de clase) + nota final, mismo lenguaje visual badge+texto
  que el resto del panel.
- [x] **C.14** — `InventarioPanel`: aviso de capacidad solo cambia de color al límite exacto, sin
  escalón intermedio (mismo patrón que C.23 de arriba, ya señalado en A/B). **APLICADO 2026-08-27**:
  añadido escalón amber al 80% de capacidad, mismo patrón que B.23 (EstadisticasPanel hambre/sed).
- [x] **C.15** — Grupo "Sin categorizar" en `InventarioPanel` soportado como si fuera normal —
  señal de posible catálogo con `tipo` sin asignar en algún objeto. **REVISADO 2026-08-27**: no es
  un bug — `tipo` es opcional por diseño en objetos narrativos sueltos sin `catalogSlug` (la IA los
  inventa sobre la marcha, sin fila de `ItemCatalog` que consultar). Código defensivo correcto,
  esperado; añadido comentario aclaratorio en el código para dejarlo documentado.

---

## Resumen de severidad

| Hallazgo | Impacto | Ref |
|---|---|---|
| `GameView.tsx` god file (1816 líneas), `handleSubmit` sin extraer | Alto | A.1 |
| Sin guard entre modales/combate simultáneos | Alto | A.2 |
| Modo dinámico no sobrevive a F5 | Alto | A.3 |
| Composer no se bloquea en varios casos reales | Alto | A.4 |
| `ChatComposer` sin accesibilidad básica | Alto | A.5 |
| `HealSelectionModal` sin busy/error en submit | Alto | A.6 |
| Fallos silenciosos en los 3 endpoints de modo dinámico | Alto | A.7 |
| Reino sin codificación visual de urgencia | Alto | A.8 |
| Círculo/rombo apenas distinguibles en ZonaPanel | Alto | A.9 |
| 3 tarjetas de oferta duplicadas en LogPanel | Medio | B.1 |
| `Button.tsx` infrautilizado, deriva visual entre botones | Medio | B.2 |
| `PostCombatInteractionModal` no usa `SelectionModalShell` | Medio | B.3 |
| `DynamicModeModal`: sin error, sin salida, sin identidad NPC, canal de color incorrecto | Medio | B.4-B.7 |
| Modo dinámico sin loading/transición entre vueltas | Medio | B.8 |
| Tarjeta de oferta de modo dinámico confunde color/contexto con misión | Medio | B.9-B.10 |
| 3 paletas de reputación/facción sin criterio compartido | Medio | B.11 |
| Nombre de facción compuesto no coincide entre paneles | Medio | B.12 |
| ReputacionPanel mal encajada en "Personaje" | Medio | B.13 |
| Compañeros sin indicador de condición física | Medio | B.14 |
| HuntSelectionModal reutiliza semántica de color de tirada | Medio | B.15 |
| Reino: Almacén/Plantillas sin confirmación visual | Medio | B.16 |
| Plantilla de equipo: categoría sin validación | Medio | B.17 |
| Reino: fallback roto si `onFundarReino` es undefined | Medio | B.18 |
| Reino sin enlace a causa de disputa territorial | Medio | B.19 |
| Ficha de rival puede no actualizarse en defensa (combate múltiple) | Medio | B.20 |
| Resto de medios (accesibilidad IconCard, avisos sin escalón, etc.) | Medio | B.21-B.25 |
| Resto de bajos (type="button", god-files menores, matices de pulido) | Bajo | C.1-C.15 |
