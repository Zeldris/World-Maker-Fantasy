# Roadmap de front — Reino

**Creado:** 2026-10-01. Análisis individual del panel de Reino, complementario a
[roadmap-front.md](roadmap-front.md) (donde Reino solo aparece resumido en `PAN-7`).
**Objetivo (petición de Álvaro):** que desde el front se pueda **ver toda la información posible y
gestionar todo lo posible** del Reino, con una interfaz amable, estilizada y dinámica.

**Fuentes revisadas:**
- Front: `ReinoPanel.tsx` y sus 5 secciones en `panels/reino/` (1.715 líneas en total), `ParcelaDetailModal`,
  `KingdomFoundingModal`, `CompanerosPanel`, `ZonaPanel` (parcelas), tipos en `types.ts` y `lib/api.ts`.
- Backend (solo para saber qué datos existen): `services/kingdomTick.ts`,
  `services/kingdomProduction.ts`, rutas `saves/reino.ts`, `ordenesProduccion.ts`, `parcelas.ts`,
  `almacenLimite.ts`, `companeros.ts`, `descansarCampamento.ts`.
- Diseño: `docs/rpgtarkor/sistemas-reino/` (referencias explícitas de Álvaro a **X4 Foundations**
  para la red de producción y **Bellwright** para el control fino) y
  `docs/mecanicas/17-reglas-construcciones-reino.md`.

**Convenio:** igual que el roadmap de front — identificadores `REI-n`, **🧭** decide Álvaro,
**[H]** hallazgo verificado, **[P]** propuesta, esfuerzo **S/M/L**. Columna **Back** en las tablas:
✅ solo front (los datos ya llegan) · 🔌 necesita exponer un dato que el backend ya calcula ·
🛠️ necesita lógica nueva en backend.

Mismas restricciones que el roadmap general: escritorio y Steam Deck (sin móvil), GPU modesta,
recursos empaquetados.

**Hito de cada fase:** [mapa de roadmaps](21-roadmap.md#qué-entra-en-cada-hito) (R-A en `0.1`,
R-B…R-E en `0.3`, R-F en `0.5`). **Con el Cronista** (`roadmap-cronista.md`): el informe del
amanecer (`REI-100`) se une a la crónica del día en una sola tarjeta (`NAR-11`, `INT-10`); las
facciones nuevas o caídas aparecen en Diplomacia (`INT-11`); la Crónica (`REI-90`) lee del Libro de
Sucesos con filtro "Reino".

---

## 1. Qué hay hoy

| Pestaña | Qué enseña | Qué deja hacer |
|---|---|---|
| **Visión general** | Nombre del reino; 8 números de economía en tarjetas iguales; lista de territorios con su estado y leyenda; avisos de felicidad baja/alta sostenida | Fundar reino si falta el nombre; Descansar en el campamento |
| **Edificios** | Lista de edificios (nombre, tipo, estado, descripción, nivel del Ayuntamiento) con leyenda de estados | Construir solo 3 cosas: Cuartel avanzado, Cuartel de guerra, Puesto comercial |
| **Producción** | Una tarjeta por edificio activo: trabajadores (chips), órdenes activas (receta, modo, prioridad); topes de almacén | Asignar/quitar trabajadores; nueva orden; cambiar prioridad; desactivar orden; fijar topes |
| **Súbditos** | Súbditos (nombre, rol, notas); roles de compañeros; **Almacén**; plantillas de equipo | Asignar rol y plantilla; depositar/retirar del almacén uno a uno; crear/borrar plantillas |
| **Diplomacia** | Facciones descubiertas; resultado de la última acción; mercado si hay tratado | Negociar, Sabotear, Espiar (con el diplomático); comprar; vender del almacén |

Lo que **no está en el panel**: las parcelas (solo se ven desde el mapa de Zona), el registro del
reino (vive en el panel "El mundo" con el botón Reino), la fundación (modal aparte que salta al
terminar el Ayuntamiento).

---

## 2. Hallazgos verificados **[H]**

### 2.1 Información que existe y no se ve
| # | Hallazgo | Back |
|---|---|---|
| R1 | **No hay previsión.** El balance diario es determinista (`tickKingdomOneDay`: comida `+2 por trabajador −1 por boca`, bebida `−1 por boca`, riqueza `+1 por trabajador −1 por soldado`, felicidad `−5` con déficit / `+2` con superávit), pero el panel solo enseña el número actual. El jugador no puede saber si mañana pasará hambre ni cuántos días le quedan. | ✅ (las constantes se pueden espejar como ya se hace con otras tablas fijas) o 🔌 |
| R2 | **No se ve por qué una orden no produce.** El backend calcula el resultado de cada orden en cada tick (`PRODUCIDA`, `ALMACEN_LLENO`, `SIN_TRABAJADOR_CON_NIVEL`, `SIN_MATERIA_PRIMA`, `NIVEL_EDIFICIO_INSUFICIENTE`, `ORDEN_COMPLETADA`) y el front no lo recibe: una orden parada se ve igual que una que funciona. | 🔌 |
| R3 | **`cantidadProducidaAcumulada`** llega en cada orden y no se pinta; tampoco el `limite` de la orden (solo el modo). No hay progreso visible. | ✅ |
| R4 | **El resultado de diplomacia trae `xpGanada` y `nivelDiplomatico`** (`reino.ts`), pero el tipo del front no los declara y no se muestran: el diplomático sube de nivel sin que el jugador lo sepa. `stage` tampoco se usa. | ✅ |
| R5 | **Las parcelas no están en la pestaña "Edificios"** pese a que la sección se llama `EdificiosParcelasSection`: solo se llega a ellas pinchando en el mapa de Zona. | 🔌 (lista de parcelas del reino) |
| R6 | **Los compañeros trabajadores no enseñan su oficio ni su nivel** al asignarlos (el motor exige nivel: `trabajadorPuedeProducir`), así que se asigna a ciegas. | 🔌 (`xpPorOficio` por compañero) |
| R7 | **La receta de una orden no muestra ingredientes, resultado ni tiempo**: el selector es un `<select>` nativo solo con el nombre. | ✅ (la Enciclopedia ya tiene ingredientes con tienes/necesitas) |
| R8 | **Territorios sin datos de evolución**: población actual, pero no cuánto crece o decrece por día (`+2`/`−3` según felicidad, `territoryPopulationDelta`), ni cuántos días faltan para consolidar o rebelarse (solo un aviso de texto cuando ya hay días acumulados). | ✅ |
| R9 | **El Almacén enseña una fila por unidad**: 30 maderas = 30 filas con su botón "Retirar". No hay agrupación, cantidad, búsqueda ni total. | ✅ |
| R10 | **No hay vista de "quién hace qué"**: los roles se fijan en Súbditos, la asignación a edificio en Producción, la plantilla en Súbditos o en Compañeros, el grupo de combate en otro modal. | ✅ |
| R11 | **Mercado sin contexto**: no hay precio de venta antes de vender, ni comparación entre facciones, ni tendencia, ni cuánto llevas gastado/ganado. Se compra y vende de uno en uno aunque el backend devuelve `cantidad`. | 🔌 (precio de venta previo) |

### 2.2 Gestión que no se puede hacer desde el panel
| # | Hallazgo | Back |
|---|---|---|
| R12 | **Construir solo ofrece 3 recetas** (Cuartel avanzado y sus 2 mejoras). Todo lo demás (Choza, Ayuntamiento y sus niveles, edificios de oficio…) exige escribir texto libre o ir a la Enciclopedia. | ✅ (`recipesStatus` ya trae `met`/`blockedReason` de todas) |
| R13 | **No se puede reactivar ni borrar una orden**: "desactivar" la esconde (el propio tooltip dice "se puede reactivar creando la misma orden de nuevo") y `borrarOrdenProduccion` existe en `api.ts` sin ningún botón. | ✅ |
| R14 | **No se puede editar una orden** (modo, límite) una vez creada; solo la prioridad. | ✅ (la ruta PATCH ya existe) |
| R15 | **Depositar y vender de uno en uno**, sin cantidades ni "todo lo de este tipo". | ✅ / 🔌 |
| R16 | **No se puede gestionar a los súbditos**: solo plantilla. Sin rol editable, sin territorio, sin estado. | 🛠️ |
| R17 | **Las plantillas piden escribir slugs técnicos** (`ej. arma-cuerpo-a-cuerpo`) y un rol en texto libre, y la prioridad es un número sin explicar. | ✅ |

### 2.3 Usabilidad y robustez
| # | Hallazgo |
|---|---|
| R18 | **La prioridad de una orden manda una petición por cada tecla** (`onChange` del `<input type=number>` llama a la API). |
| R19 | **Errores tragados**: depositar, retirar, asignar rol, plantillas, prioridad y topes usan `try/finally` sin `catch` — si falla, no se ve nada. |
| R20 | **Los topes se guardan al perder el foco** (`onBlur`) sin confirmación visual; `Enter` no hace nada. |
| R21 | **Los 8 números de economía son iguales**: misma tarjeta para Población que para Felicidad (que es 0-100) o Soldados; solo comida/bebida en 0 se pintan en rojo. |
| R22 | **El Almacén vive dentro de Súbditos**, y los topes del Almacén dentro de Producción: la misma cosa partida en dos pestañas que no son la suya. |
| R23 | **Selectores `<select>` nativos** (rol, plantilla, receta, modo) con el estilo del sistema operativo, fuera de la estética del juego. |
| R24 | **Sin estados de carga reales**: "Cargando…", "Consultando…" en texto. |
| R25 | **Muchos datos sin tooltips de explicación**: qué hace un Guardia frente a un Productor, qué aporta un Visitante, qué es Riqueza. |

---

## 3. Principios de diseño para el nuevo Reino **[P]**

1. **Saber, prever, actuar — en ese orden.** Cada número enseña su valor, su tendencia y la acción
   que lo arregla, en el mismo sitio.
2. **El "por qué" siempre visible.** Nada parado sin motivo: ni una orden, ni un edificio, ni un
   territorio en riesgo.
3. **Todo gestionable desde el panel**, sin escribir texto libre para tareas de gestión. El texto
   libre sigue disponible para el rol, no es obligatorio para administrar.
4. **Red de producción visible (X4)**: de dónde sale y a dónde va cada recurso.
5. **Control fino estilo Bellwright**: prioridades, topes y modos con controles directos y
   arrastrables.
6. **El reino vive**: el paso de los días se nota (informe diario, animaciones de cambio,
   notificaciones), no solo cambia un número.
7. **Lo mismo para jugador y facciones**: el motor es el mismo (`edificios-de-oficio.md` § 4), así
   que los componentes deben poder reutilizarse para ver otras facciones a través de Espiar.

---

## 4. Nueva organización del panel **[P]** **M**

Pasar de 5 a 9 pestañas, con un **índice lateral** dentro del cajón (como el propuesto para la
Enciclopedia) y un **contador de avisos** en cada pestaña (⚠️ 2):

| Pestaña nueva | Sustituye / reúne | Pregunta que responde |
|---|---|---|
| **Resumen** | Visión general | ¿Cómo va mi reino y qué tengo que atender? |
| **Asentamiento** | Edificios + parcelas (hoy en Zona) | ¿Qué tengo construido y qué puedo construir? |
| **Producción** | Producción (sin topes) | ¿Qué se fabrica, quién y por qué se para? |
| **Almacén** | Almacén (Súbditos) + topes (Producción) | ¿Qué tengo guardado y cuánto quiero guardar? |
| **Gente** | Súbditos + roles + plantillas | ¿Quién vive aquí y qué hace cada uno? |
| **Territorios** | Territorios (Visión general) | ¿Qué controlo y qué está en riesgo? |
| **Diplomacia** | Diplomacia | ¿Cómo estoy con cada facción? |
| **Mercado** | Mercado (Diplomacia) | ¿Qué compro y vendo, y dónde sale mejor? |
| **Crónica** | Registro de reino (hoy en el panel "El mundo") | ¿Qué ha pasado en mi reino? |

Y a futuro (documentado en `construcciones-reino.md`, sistema aparte): **Defensa / Escuadrones**.

**REI-1 · Cascarón** — índice lateral con iconos SVG, contador de avisos, recordar la última
pestaña (`CFG-17`), atajo `K` para abrir Reino y `1-9` para saltar de pestaña. **M**
**REI-2 · Modo de pantalla completa del Reino** — el cajón actual (`max-w-4xl`, 85 vh) se queda
pequeño para un panel de gestión: opción de abrir Reino a pantalla casi completa, con la partida
pausada visualmente detrás. 🧭 **M**

---

## 5. Pestaña por pestaña

### 5.1 Resumen (tablero)
| Id | Propuesta | Back | Esf. |
|---|---|---|---|
| REI-10 | **Cabecera del reino**: estandarte con nombre, emblema y color (ver MOD-27), nivel del Ayuntamiento como insignia, día de fundación, número de territorios, población total. | ✅ | S |
| REI-11 | **Medidores con su forma**: Felicidad como dial 0-100 con las marcas de 20 (rebelión) y 70 (consolidación); Comida y Bebida como reservas con "días de reserva" (`stock / bocas`); Riqueza con su balance diario; Población, Soldados, Trabajadores y Visitantes como figuras con iconos. | ✅ | M |
| REI-12 | **Balance de mañana** (R1): por cada recurso, `entra +X · sale −Y = neto` desglosado (trabajadores, bocas, soldados) y la felicidad que resultaría. Tooltip con la fórmula. | ✅/🔌 | M |
| REI-13 | **Tendencia**: flecha ▲▼ y mini-gráfica de los últimos 7-14 días por recurso. | 🛠️ (histórico diario) | M |
| REI-14 | **Panel de avisos priorizado**: "Te quedas sin agua en 2 días", "2 órdenes paradas por falta de materia prima", "Felicidad baja: 4 de 7 días para la rebelión", "Edificio dañado", "Tope de almacén alcanzado". Cada aviso con botón que lleva a la pestaña y al elemento exacto. | ✅/🔌 | M |
| REI-15 | **Consejero del reino** 🧭: tres sugerencias concretas calculadas en cliente ("Asigna 1 trabajador más para cubrir la comida", "Construye un pozo"). Opcional, desactivable. | ✅ | M |
| REI-16 | **Acciones rápidas**: Descansar en el campamento, ir al Ayuntamiento, nueva orden, depositar mochila. | ✅ | S |

### 5.2 Asentamiento (edificios y parcelas)
| Id | Propuesta | Back | Esf. |
|---|---|---|---|
| REI-20 | **Plano del asentamiento**: vista dibujada (SVG) con las parcelas de cada territorio como casillas — ocupadas con el icono del edificio y su estado (color de borde), vacías con "+" — reutilizando los datos de parcelas que ya pinta `ZonaPanel`. Clic en una parcela abre su ficha (`ParcelaDetailModal`). 🧭 | 🔌 (parcelas por territorio) | L |
| REI-21 | **Vista lista** alternativa (la actual mejorada): tarjeta por edificio con imagen o icono, estado, nivel, trabajadores asignados, órdenes activas y botón a Producción. Filtro por estado y tipo. | ✅ | M |
| REI-22 | **Catálogo de construcción completo** (R12): todas las recetas de construcción con coste (materiales tienes/necesitas), requisitos, motivo de bloqueo (`blockedReason`) y efecto; filtros "puedo construir ya / me faltan materiales / bloqueado". El botón sigue mandando el mismo texto por el turno normal (como hoy los 3 del Cuartel), así que no cambia la mecánica. | ✅ | M |
| REI-23 | **Mejoras de edificio** (Ayuntamiento pequeño → mediano → grande, Cuartel → de guerra / comercial) como árbol visual con lo que desbloquea cada nivel. | ✅ | M |
| REI-24 | **Edificio en construcción** con barra de progreso y tiempo ficticio restante, si el backend lo tiene. | 🔌 | S |
| REI-25 | **Edificio dañado/abandonado** con la causa y la acción para arreglarlo (reparar, asignar trabajador). | 🛠️ (reparar) | M |
| REI-26 | **Ficha de parcela mejorada**: hoy una parcela ocupada solo dice "Ya hay una construcción aquí"; enseñar el edificio, su estado y sus órdenes. | ✅ | S |

### 5.3 Producción (red de producción)
| Id | Propuesta | Back | Esf. |
|---|---|---|---|
| REI-30 | **Estado de cada orden** (R2): chip verde "Produciendo", ámbar "Almacén lleno", rojo "Falta materia prima: 3 Hierro", gris "Sin trabajador con nivel", "Edificio de nivel insuficiente", "Completada". Es lo más importante de toda la pestaña. | 🔌 | M |
| REI-31 | **Progreso de la orden** (R3): `producido / límite` como barra; en modo *reponer*, stock actual frente al tope del almacén. | ✅ | S |
| REI-32 | **Nueva orden con ficha de receta** (R7): selector visual con buscador, mostrando ingredientes (con stock en almacén), resultado, oficio y nivel requerido; avisa antes de crear si nadie puede producirla. | ✅ | M |
| REI-33 | **Editar, reactivar y borrar órdenes** (R13, R14): pestaña "Desactivadas" con *Reactivar*; menú ⋯ con *Editar* y *Borrar*. | ✅ | S |
| REI-34 | **Prioridad arrastrable** estilo Bellwright: las órdenes de un edificio en lista ordenable (arrastrar para cambiar prioridad) o un selector 0-9 con botones; una sola petición al soltar (R18). | ✅ | M |
| REI-35 | **Trabajadores con oficio y nivel** (R6): cada chip muestra retrato, oficio principal y nivel; los que no tienen nivel para ninguna receta del edificio aparecen atenuados con el motivo. Arrastrar un compañero de un edificio a otro. | 🔌 | M |
| REI-36 | **Mapa de la red** (X4): diagrama de flujo recurso → edificio → producto (nodos y flechas SVG), resaltando los cuellos de botella en rojo. 🧭 | ✅ | L |
| REI-37 | **Resumen de producción diaria**: "Ayer: +6 Pan, +3 Lingote de hierro, −9 Mineral" con iconos. | 🔌 | M |

### 5.4 Almacén
| Id | Propuesta | Back | Esf. |
|---|---|---|---|
| REI-40 | **Agrupado por recurso** (R9): una fila/carta por tipo con cantidad, icono, categoría (comida, bebida, material, medicina, equipo — clasificación ya hecha en `construcciones-reino.md`), y botón para ver unidades sueltas si hiciera falta. | ✅ | S |
| REI-41 | **Topes junto al stock** (R22): barra `cantidad / tope` por recurso con el tope editable (stepper o deslizador, `Enter` para guardar, confirmación visual) (R20). | ✅ | S |
| REI-42 | **Depositar y retirar en cantidad** (R15): selector de cantidad (`QuantityStepper`, MOD-5), "Depositar todo lo de este tipo", "Depositar todo menos lo equipado". Arrastrar desde la mochila. | ✅ (varias llamadas) / 🔌 (en lote) | M |
| REI-43 | **Buscar, filtrar, ordenar** (por categoría, cantidad, cerca del tope). | ✅ | S |
| REI-44 | **Uso de cada recurso**: en la ficha de un recurso, qué órdenes lo consumen y cuáles lo producen (enlaza con REI-36). | ✅ | M |

### 5.5 Gente (súbditos, compañeros, roles, plantillas)
| Id | Propuesta | Back | Esf. |
|---|---|---|---|
| REI-50 | **Tabla de personal** (R10): una fila por persona (compañero o súbdito) con retrato, raza (`razaTheme`), rol, edificio asignado, plantilla, salud, felicidad, comida/agua (los compañeros ya traen `felicidad`, `comida`, `agua`, `condicionFisica`). Ordenable y filtrable. | ✅ | M |
| REI-51 | **Roles como tarjetas explicadas** (R25): Trabajador, Guardia, Productor, Diplomático, con qué hace cada uno, cuántos hay y arrastrar personas a cada rol. Sustituye al `<select>`. | ✅ | M |
| REI-52 | **Editor de plantillas visual** (R17): el muñeco de ranuras de `EquipoPanel` en pequeño; en cada ranura se elige una **categoría con nombre legible** (no el slug) de una lista; el rol en un selector; la prioridad explicada ("qué plantilla gana si se aplican dos"). Vista previa de qué objetos del almacén se le asignarían hoy. | ✅ | M |
| REI-53 | **Súbditos con más gestión** (R16): rol editable, territorio de residencia, estado. 🧭 Depende de la versión mínima de súbditos del hito `0.1` (F9-7). | 🛠️ | M |
| REI-54 | **Llegadas y salidas**: cuando la versión mínima de súbditos exista, tarjeta "Llegaron 2 pobladores orcos" con su origen y por qué vinieron (vivienda, comida, agua). | 🛠️ | S |

### 5.6 Territorios
| Id | Propuesta | Back | Esf. |
|---|---|---|---|
| REI-60 | **Mapa de territorios**: los territorios del reino sobre el mapa de Berig con su color de control (reutiliza `InteractiveMap`). | ✅ | M |
| REI-61 | **Ficha de territorio** (R8): población y su variación diaria (`+2`/`−3`), barra de días hacia consolidar o hacia rebelión (`x/7`), edificios y parcelas del territorio, región. | ✅ | S |
| REI-62 | **Cronología del control**: Reclamado → Disputado → Consolidado como línea con fechas ficticias. | 🛠️ | M |
| REI-63 | **Presencia de otras facciones** en la región del territorio (control regional que ya pinta `ZonaPanel`). | ✅ | S |

### 5.7 Diplomacia
| Id | Propuesta | Back | Esf. |
|---|---|---|---|
| REI-70 | **Tarjetas de facción** con emblema, líder (retrato), raza (paleta por raza ya existente) y la relación como **barra centrada** de Guerra a Alianza con la presión marcada. | ✅ | M |
| REI-71 | **Diplomático visible** (R4): retrato, nivel de diplomático y XP; al negociar, "+XP" flotante y aviso de subida de nivel. | ✅ | S |
| REI-72 | **Acciones explicadas**: qué hace Negociar, Sabotear y Espiar, qué riesgo tienen y el resultado anterior; Sabotear con confirmación. | ✅ | S |
| REI-73 | **Informe de espionaje** como ficha: lo que se descubre de la facción (presión, relación, hechos del mundo) en formato de pergamino, guardado en un historial por facción. | ✅ | M |
| REI-74 | **Relaciones entre facciones** (hoy en Reputación, `RelacionesFaccionesModal`): enlazarlas también aquí como matriz (`MOD-31`). | ✅ | S |

### 5.8 Mercado
| Id | Propuesta | Back | Esf. |
|---|---|---|---|
| REI-80 | **Pestaña propia** con dos columnas (Comprar | Vender) y la facción elegida arriba; Goirnos siempre visibles con animación al cambiar. | ✅ | M |
| REI-81 | **Precio de venta antes de vender** y **comparar entre facciones con tratado** (dónde se vende mejor cada recurso) (R11). | 🔌 | M |
| REI-82 | **Comprar y vender en cantidad** con `QuantityStepper` y total en vivo. | 🔌 | S |
| REI-83 | **Historial de operaciones** y balance de Goirnos del día. | 🛠️ | S |

### 5.9 Crónica
| Id | Propuesta | Back | Esf. |
|---|---|---|---|
| REI-90 | **Registro de reino dentro del panel** (hoy `kingdomLog` solo en el panel "El mundo" con el botón Reino), con filtros (construcción, producción, población, diplomacia). | ✅ | S |
| REI-91 | **Hitos del reino** como línea de tiempo: fundación, primer territorio consolidado, mejoras del Ayuntamiento, tratados. | ✅/🛠️ | M |

---

## 6. Dinamismo y estilo específicos de Reino **[P]**

- **REI-100 · Informe del amanecer** — al cruzar un día ficticio (`daysCrossed`), tarjeta/modal
  ligero con lo que pasó: producido, consumido, población, felicidad, avisos nuevos. Con un ajuste
  para mostrarlo siempre, solo si hay avisos, o nunca. 🔌 **M**
- **REI-101 · Números vivos** — cada valor que cambia cuenta hacia arriba/abajo y deja un "+6" /
  "−3" flotante (`HUD-2`, `HUD-4`). **S**
- **REI-102 · Barras de reserva que se vacían** con barra fantasma y cambian de color al acercarse a
  cero; la Felicidad en el dial gira hasta su nuevo valor. **S**
- **REI-103 · Edificios que se notan**: al terminar una construcción, sello y brillo en su casilla
  del plano; al producir, un pequeño humo/chispa CSS sobre el edificio (desactivable con
  `CFG-21`). **M**
- **REI-104 · Estética propia de Reino** — el panel de Reino como "mesa del regente": pergamino
  claro para fichas e informes sobre la madera, sellos de lacre para estados (Consolidado, Tratado),
  estandartes con la paleta por raza. Sin hexes nuevos: derivados de `wood`, `quest`, `accent2`. 🧭 **M**
- **REI-105 · Notificaciones de reino** (`HUD-6`, tipo `accent2`) también fuera del panel: "Tu
  Herrería se ha quedado sin hierro", "Felicidad baja: 5 de 7 días". **S**
- **REI-106 · Iconografía de recursos** — iconos SVG por categoría de recurso y por edificio
  (`BAS-2`), para que los flujos de producción se lean sin texto. **M**

## 7. Usabilidad y robustez (arreglos) **arreglo**

- **REI-110** · Prioridad: guardar con *debounce* o al soltar, no en cada tecla (R18). **S**
- ~~**REI-111** · Todos los `try/finally` de Reino con `catch` y `ErrorBanner` visible (R19). **S**~~ ✅ 2026-10-01 (con `UX-24`)
- **REI-112** · Topes con `Enter` y confirmación visual (R20). **S**
- **REI-113** · Sustituir los `<select>` nativos por los selectores del juego (R23). **S**
- **REI-114** · Esqueletos de carga en lugar de "Cargando…" (R24). **S**
- **REI-115** · Tooltips de explicación en cada indicador, rol y estado (R25). **S**
- **REI-116** · Declarar `xpGanada`, `nivelDiplomatico` y `stage` en `DiplomaciaResultado` (R4). **S**

---

## 8. Qué necesita backend

Para que el front pueda enseñarlo todo, estas piezas tendrían que exponerse (ninguna cambia
mecánicas; casi todas ya se calculan):

| Dato | Para | Estado en backend |
|---|---|---|
| Resultado del último tick por orden (`ResultadoOrden`) | REI-30, REI-37, REI-100 | Se calcula en `tickOrdenesProduccion`, no se devuelve ni guarda |
| Nivel/XP por oficio de cada compañero (`xpPorOficio`) | REI-35 | Existe como `TrabajadorReino`, no está en `CompanionInfo` |
| Parcelas por territorio | REI-20 | Existe por ubicación (`/parcelas/:id`, Zona); falta listado por reino |
| Balance diario previsto | REI-12 | Fórmula pura en `kingdomTick.ts`; el front puede espejarla o pedirla |
| Histórico diario de `KingdomStats` | REI-13 | No existe |
| Precio de venta por recurso y facción | REI-81 | Se calcula al vender; falta consulta previa |
| Operaciones en lote (depositar/comprar/vender N) | REI-42, REI-82 | Rutas de una unidad |
| Progreso de construcción | REI-24 | Por confirmar |

---

## 9. Orden recomendado

| Fase | Contenido | Por qué |
|---|---|---|
| **R-A · Arreglos** | REI-110…116, REI-33 (reactivar/borrar órdenes), REI-40/41 (almacén agrupado con topes) | Errores y fricciones visibles hoy, solo front. |
| **R-B · Saber y prever** | REI-1, REI-10…12, REI-14, REI-31, REI-61, REI-71 | El salto grande de información, casi todo solo front. |
| **R-C · Por qué se para** | Exponer `ResultadoOrden` y `xpPorOficio` → REI-30, REI-35, REI-37 | Lo que más ayuda a gestionar la producción. |
| **R-D · Gestionar todo** | REI-22, REI-23, REI-32, REI-34, REI-42, REI-50…52, REI-70, REI-72, REI-80…82, REI-90 | Que ninguna gestión necesite texto libre. |
| **R-E · Vida y estilo** | REI-100…106, REI-60, REI-73 | Dinamismo y estética propia. |
| **R-F · Grandes vistas** | REI-20 (plano), REI-36 (red), REI-13 (tendencias), REI-2 (pantalla completa) | Las más vistosas y las más caras. |
| **Futuro** | Súbditos completos (REI-53/54), Defensa/Escuadrones | Dependen de diseño y backend aún abiertos. |

## 10. Decisiones pendientes 🧭

1. Abrir Reino a pantalla casi completa en vez del cajón. (REI-2)
2. Plano del asentamiento dibujado, o solo lista mejorada. (REI-20)
3. Mapa de la red de producción. (REI-36)
4. Consejero con sugerencias automáticas. (REI-15)
5. Estética "mesa del regente" (pergamino y lacre). (REI-104)
6. Emblema y color del reino guardados al fundarlo. (REI-10, MOD-27)
7. Alcance de la gestión de súbditos en `0.1`/`0.3`. (REI-53)
8. Espejar en el front las fórmulas del tick o pedir la previsión al backend. (REI-12)
