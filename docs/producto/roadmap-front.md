# Roadmap de front — Tarkor

**Creado:** 2026-10-01, a partir de un análisis completo de `frontend/src` (páginas, componentes,
`index.css`, hooks) y capturas reales de las pantallas de inicio, mundo y personaje.
**Relación con el roadmap principal:** este documento es complementario a
[21-roadmap.md](21-roadmap.md). No rompe la congelación del hito `0.1`: lo que aquí se marca como
"Fase 1" son arreglos y mejoras de base que no añaden mecánicas de juego; el resto se cuela en los
hitos que digan Álvaro.

**Cómo se usa** (mismo convenio que el roadmap principal):
- Al cerrar un punto se tacha aquí con su commit.
- **🧭 = decide Álvaro antes de empezar.**
- Origen: **[A]** pedido o decidido por Álvaro · **[H]** hallazgo verificado en código ·
  **[P]** propuesta de Claude.
- Esfuerzo orientativo: **S** (horas) · **M** (1-2 días) · **L** (varios días).

---

## Restricciones que manda todo lo de abajo

Estas reglas salen del propio código y de `docs/arquitectura/04-decisiones-tecnicas.md`; toda
propuesta de este roadmap las respeta:

1. **No hay versión móvil.** Objetivo: escritorio (≥1280 px) y **Steam Deck (1280×800)** como
   pantalla mínima de referencia. Nada de este documento persigue layouts de teléfono. **[A]**
2. **GPU modesta.** El historial de bugs ya prohibió `backdrop-blur` (artefactos en la GT 730M,
   ver `PanelDrawer.tsx`), y la iGPU de la Steam Deck va ocupada por el narrador local (Ollama).
   Por tanto: animaciones solo de `transform`/`opacity`, nada de filtros en bucle, nada de WebGL
   permanente, todo efecto ambiental desactivable. **[H]**
3. **Distribución futura con Tauri** (`docs/arquitectura/20-instalador-distribuible.md`): el
   juego acabará en una ventana nativa y **sin conexión garantizada a internet**. Todo recurso
   (fuentes, sonidos, texturas) tiene que ir empaquetado, nunca desde un CDN. **[H]**
4. **Identidad visual ya fijada**: madera (`wood`), hierro (`iron`), cristal del mundo
   (`accent`/`accent2`), estados fijos (`moss`/`danger`/`cost`/`quest`) y color por atributo. Las
   mejoras amplían ese lenguaje, no lo sustituyen.
5. **`prefers-reduced-motion` ya está respetado** en `index.css`; todo lo nuevo debe entrar en esa
   misma lista (y en el ajuste propio de la Fase 1).

---

## Diagnóstico: lo que hay hoy

### Lo que funciona bien (y hay que conservar)
- Un sistema de tokens sólido en `@theme` (`index.css`): escalas de madera/hierro, acentos
  tematizables por mundo (`applyWorldTheme`), paleta por raza (`razaTheme.ts`), color por atributo.
- Texturas 100 % CSS con identidad propia (`.plank-panel`, `.iron-band`, `.dust-road`,
  `.crystal-sky`, remaches, `corner-bracket`) — baratas y coherentes con el lore.
- Un catálogo de microanimaciones con intención (sello, sacudida, pop, campanada del hairline,
  latido de herida grave) y su bloque de `prefers-reduced-motion`.
- Tiradas de dados "en vivo" (`DiceRoll.tsx`) y entrada de combate con golpe seco.
- `SelectionModalShell` ya hace foco, Escape y atrapado de Tab para 11 modales.

### Hallazgos verificados **[H]**

| # | Hallazgo | Dónde |
|---|---|---|
| H1 | **No existe ningún menú de configuración ni preferencias guardadas** (cero usos de `localStorage`). El jugador no puede cambiar nada: ni tamaño de texto, ni velocidad de dados, ni animaciones. | toda la app |
| H2 | **Las fuentes no son fiables.** Cinzel se pide a Google Fonts por `@import` (falla sin red → en la captura sale una serif genérica) e **Inter nunca se carga** (no hay `@font-face` ni import): el texto base es la fuente del sistema. Con Tauri y sin red, el juego perdería su tipografía. | `index.css:3-7` |
| H3 | **Las tiradas duran ~10 s** en un "vs" (`ROLL_DURATION_MS = 5000`, secuencial) sin opción de acelerar ni saltar. Bonito la primera vez, pesado a la décima. | `DiceRoll.tsx` |
| H4 | **Cero estilos `focus-visible`** en toda la app: con teclado o mando (Steam Deck) no se ve qué está seleccionado. | 0 resultados de `focus-visible` |
| H5 | **Los modales se cierran de golpe**: todas las animaciones son de entrada; no hay ninguna de salida (cajón, modales, tooltips, combate). | `PanelDrawer`, `SelectionModalShell`, `DetailModal`… |
| H6 | **Solo 3 componentes declaran `role="dialog"`**; los otros ~7 modales con `fixed inset-0` (Detalle, Zona, Clase, Especialización, Fundar reino, Modo dinámico, Zoom de mapa) no tienen Escape/foco unificados. | `grep "fixed inset-0"` |
| H7 | **91 colores de Tailwind sueltos** (`red-700`, `amber-…`) y **81 valores arbitrarios** (`shadow-[…]`, `text-[…]`) conviven con los tokens. Los mismos botones se reescriben a mano en GameView (Combatir, Huir, Cancelar acción…) en vez de usar `Button`. | `grep` en `*.tsx` |
| H8 | **Clases CSS muertas**: `animate-edge-flash-amber` y `animate-stamp-in-equip` no las usa nadie. | `index.css` |
| H9 | **Iconografía 100 % emoji** (⚔️ 🛡️ 🧭 🎲 💀 🔪…). Depende de la fuente de emoji del sistema: en SteamOS/Linux cambia de aspecto o desaparece (ya hubo un caso real: el ❌ en vez de ⚔️, comentado en `GameView.tsx`). | `NavTabs.ts`, GameView, paneles |
| H10 | **Imágenes sin carga perezosa ni placeholder**: 13 `<img>` sin `loading="lazy"`, sin `decoding="async"`, sin fundido al cargar; aparecen "a saltos". | LogPanel, CombatPanel, Enciclopedia… |
| H11 | **Pantallas previas a la partida planas**: Mundo y Personaje son tarjetas sobre madera sin imagen, sin retrato del personaje (una "G" en un círculo) y con un botón "Continuar" deshabilitado casi invisible. | `CharacterSelect`, `WorldSelect`, `CharacterCard` |
| H12 | **Textos de bajo contraste**: el enlace de admin (`wood-700`) y la versión casi no se leen sobre el fondo. | `Home.tsx`, `VersionTag` |
| H13 | **`GameView.tsx` tiene 2.129 líneas** con el layout, el HUD de cabecera y todos los modales; cualquier mejora visual del HUD obliga a tocar ese archivo gigante. | `pages/GameView.tsx` |
| H14 | **Sin sonido de ningún tipo.** Para un juego de rol con tiradas, combate y un narrador, es la mayor ausencia "de juego" que tiene el front. | toda la app |
| H15 | **Sin división de código**: todo se carga de golpe (Enciclopedia de 1.574 líneas, mapa, admin) aunque el jugador no los abra. | `App.tsx` |

---

## Fase 1 — Menú de Configuración (prioridad máxima) **[A]**

> Petición de Álvaro (2026-10-01): "un botón de configuración como en todos los juegos, desde el
> cual el jugador podrá ajustar resolución y otro tipo de cosas".

### 1.1 Acceso
- **Botón ⚙️ fijo** en la esquina de la cabecera de hierro de la partida (`GameView`, junto a la
  fecha) y en la pantalla de inicio (`Home`, esquina superior derecha). **S**
- **Atajo de teclado `Esc`** (cuando no haya ningún modal abierto) y botón *Start/Menú* del mando:
  abre el menú, igual que en cualquier juego. **S**
- Dentro de partida el menú hace de **menú de pausa**: *Reanudar · Configuración · Guardar y salir
  a tus partidas · Salir al inicio* (sustituye/absorbe el actual "← Salir a tus partidas"). **M**

### 1.2 Estructura del panel
Modal grande a pantalla casi completa, con pestañas laterales (mismo lenguaje que `SideNav`),
`plank-panel` + `iron-band` en la barra de pestañas. Botones al pie: **Restablecer valores por
defecto · Cancelar · Aplicar**. Los cambios se previsualizan en vivo y se guardan en
`localStorage` (clave `tarkor.settings.v1`, con versión para migraciones). **M**

Implementación propuesta: `SettingsContext` (como `SessionContext`) que expone los ajustes y los
aplica como variables CSS y atributos en `<html>` (`data-motion`, `data-contrast`,
`--ui-scale`…), de forma que el resto de componentes no tenga que leerlos uno a uno.

### 1.3 Pestaña **Pantalla**
| Ajuste | Opciones | Notas |
|---|---|---|
| **Resolución** | Lista de resoluciones (1280×720, 1280×800, 1366×768, 1600×900, 1920×1080, 2560×1440, nativa) | Real con Tauri (`appWindow.setSize`). En navegador se muestra deshabilitado con aviso "disponible en la versión instalada". 🧭 confirmar que se espera a Tauri. |
| **Modo de ventana** | Ventana · Ventana sin bordes · Pantalla completa | Navegador: `requestFullscreen()`; Tauri: `setFullscreen`/`setDecorations`. Atajo `F11`. |
| **Escala de la interfaz** | 80 % – 150 % (pasos de 10) | `font-size` raíz + `--ui-scale`; clave para leer en la Steam Deck o en un 4K. |
| **Ancho máximo del juego** | 1600 px (actual) · 1920 px · Sin límite | Hoy `max-w-[1600px]` fijo en `App.tsx`: en monitores anchos deja bandas vacías. |
| **Límite de FPS de animaciones / Calidad visual** | Alta · Media · Baja | Ver 1.5; "Baja" pensada para Steam Deck en batería. |

### 1.4 Pestaña **Interfaz y texto**
- **Tamaño del texto de narración** (independiente de la escala general): pequeño · normal ·
  grande · muy grande. Los logs son lo que más se lee. **S**
- **Tipografía de narración**: Serif (Cinzel/serif de lectura) · Sans · Dislexia-friendly
  (p. ej. Atkinson Hyperlegible, empaquetada). **S**
- **Interlineado** normal / amplio. **S**
- **Revelado del texto del narrador**: tal como llega del streaming (actual) o suavizado con
  efecto máquina de escribir (rápido · normal). **S**
- **Mostrar tooltips**: siempre · con retardo · nunca. **S**
- **Disposición de los registros**: Personaje a la izquierda / a la derecha; recordar qué lado
  estaba colapsado entre sesiones (hoy `collapsedSide` se pierde al recargar). **S**
- **Hora y fecha ficticia en cabecera**: formato corto / largo. **S**

### 1.5 Pestaña **Gráficos y animaciones**
- **Animaciones**: Completas · Reducidas · Ninguna (por defecto sigue a `prefers-reduced-motion`
  del sistema, pero el jugador puede forzarlo). Se implementa con `[data-motion="reduced"]`
  reutilizando la lista de clases que ya existe en `index.css`. **S**
- **Velocidad de las tiradas de dados**: Dramática (actual, ~5 s por dado) · Normal (~2 s) ·
  Rápida (~0,8 s) · Instantánea. Además, **clic o `Espacio` para saltar** la tirada en curso. **S**
  (resuelve H3)
- **Efectos ambientales** (los de la Fase 4: partículas, clima, cielo animado): Sí / No. **S**
- **Sacudida de pantalla y destellos** en golpes: Sí / No (también accesibilidad). **S**
- **Texturas de madera/hierro**: Detalladas · Lisas (versión plana de `.plank-panel` y
  `.iron-band` para quien quiera menos ruido visual o más legibilidad). **S**
- **Mostrar imágenes de la enciclopedia en la narración** (banners): Sí / No. **S**

### 1.6 Pestaña **Sonido** (se activa cuando exista la Fase 5)
- Volumen general · Música · Efectos · Ambiente · Interfaz (5 deslizadores) y **Silenciar al
  perder el foco de la ventana**. **S** (una vez exista el gestor de audio)

### 1.7 Pestaña **Controles**
- Lista de **atajos de teclado** con posibilidad de reasignarlos: abrir cada panel (I =
  Inventario, M = Mapa, P = Personaje, H = Habilidades, J = Diario, K = Reino…), 1-9 para la barra
  de habilidades, `Enter` para enviar, `Esc` para el menú. Hoy no existe ningún atajo global. **M**
- **Navegación con mando** (Steam Deck): activar/desactivar foco visible grande, esquema de
  botones. Depende de 2.3. **M**

### 1.8 Pestaña **Accesibilidad**
- **Alto contraste** (sube un paso los textos `wood-400/500` y engrosa bordes). **S**
- **Modo daltónico**: alternativa a rojo/verde de éxito/fallo y a los 7 colores de atributo
  (añadir forma/icono además de color, y paletas Deuteranopía/Protanopía/Tritanopía). **M**
- **Subrayar los enlaces a la enciclopedia** dentro del texto (hoy solo color). **S**

### 1.9 Pestaña **Partida**
- **Confirmar acciones irreversibles** (matar convaleciente, cancelar acción, salir): Sí / No. **S**
- **Autopausa** al abrir el menú (si en el futuro hay tiempo real). 🧭 **S**
- Mostrar **información de depuración** (versión completa, id de partida, tiempos del narrador)
  para reportar fallos; hoy la versión vive escondida abajo en Home. **S**

---

## Fase 2 — Base técnica del diseño (sin cambios visibles grandes)

### 2.1 Fuentes empaquetadas **[H]** **S**
Descargar Cinzel (y la fuente de cuerpo elegida) como `woff2` en `frontend/src/assets/fonts`,
declararlas con `@font-face` + `font-display: swap`, y quitar el `@import` de Google Fonts.
Resuelve H2 y es requisito para Tauri sin red. 🧭 Decidir la fuente de cuerpo: **Inter** (la ya
declarada) o una serif de lectura con más carácter para la narración (p. ej. *EB Garamond*,
*Crimson Pro*, *Spectral*) manteniendo Inter para la UI.

### 2.2 Sistema de iconos propio **[H]** **M**
Sustituir los emoji de navegación, HUD y combate por **iconos SVG en línea** (un `Icon.tsx` con
un sprite propio; el `public/icons.svg` actual es el sobrante de la plantilla de Vite —iconos de redes sociales— y se puede sustituir), con trazo y relleno tomados de
los tokens. Los emoji se pueden quedar en la narración. Resuelve H9 (aspecto distinto según SO) y
permite animar los iconos (rellenado de la gema, giro de la brújula…). 🧭 Dibujarlos a mano o
partir de un set libre (Game-icons.net, CC BY 3.0).

### 2.3 Foco visible y navegación por teclado/mando **[H]** **M**
- Estilo global `:focus-visible` (anillo de cristal `accent-400` + glow suave) en botones,
  pestañas, slots y filas. Resuelve H4.
- Hook `useModal()` común (Escape, foco inicial, atrapado de Tab, devolver el foco al cerrar) y
  migrar los ~7 modales que no usan `SelectionModalShell`. Resuelve H6.
- Navegación espacial con flechas/cruceta en la rejilla de inventario, barra de habilidades y
  mapa.

### 2.4 Limpieza de tokens **[H]** **M**
- Pasar los `red-*`/`amber-*` sueltos a `danger-*`/`cost-*` (o crear `danger-700..950` como
  tokens estructurales y documentarlos).
- Convertir los `shadow-[…]` repetidos en utilidades con nombre (`shadow-plank`, `glow-accent`,
  `inset-well`) dentro de `@theme`/`@utility`.
- Reutilizar `Button` (añadiendo variantes `alert` y `compact`) en los botones reescritos a mano
  de `GameView` y modales.
- Borrar las clases muertas (H8) o darles uso.

### 2.5 Partir `GameView.tsx` **[H]** **L**
Extraer `GameHeader` (HUD), `GameFooter` (composer/combate/muerte/ocupado), `GameModals` (todos los
modales condicionados) y `GameLayout`. Sin cambio visual; prepara el terreno para el HUD nuevo de
la Fase 3 y la Configuración. Resuelve H13.

### 2.6 Rendimiento de carga **[H]** **S**
- `React.lazy` + `Suspense` para `EnciclopediaPanel`, `MapZoomModal`, `InteractiveMap`, `AdminEnciclopedia` y
  los paneles de Reino. Resuelve H15.
- `loading="lazy"`, `decoding="async"` y fundido de entrada al cargar en todas las `<img>`;
  placeholder con el degradado de madera y la gema mientras llega. Resuelve H10.

### 2.7 Librería de transiciones **[P]** **M** 🧭
Para animaciones de **salida** y de **cambio de layout** (H5) hay dos caminos:
- **A (recomendada):** un hook propio `usePresence(open, ms)` que mantiene el componente montado
  durante la animación de salida, más la *View Transitions API* (`document.startViewTransition`)
  para cambios de panel. Cero dependencias, el webview de Tauri en Linux (WebKitGTK) la soporta
  parcialmente: degradar a corte seco si no existe.
- **B:** añadir `motion` (Framer Motion, ~30 KB gz) con `AnimatePresence` y `layout`. Más
  potente y rápido de escribir, pero es la primera dependencia de animación del proyecto.

---

## Fase 3 — Dinamismo e interfaz de partida

### 3.1 Animaciones de salida en todo **[P]** **S** (tras 2.7)
Cajón que baja con el mismo freno con el que sube; modales que se encogen y funden; tooltips que se
desvanecen; combate que se "envaina" al terminar (inverso de `combat-enter`).

### 3.2 Barras de estado vivas en la cabecera **[P]** **M**
- **Barra "fantasma"** en salud/energía/hambre/sed: al perder, el tramo perdido queda en blanco/rojo
  medio segundo y luego se vacía (como en los juegos de lucha) — solo `transform: scaleX`.
- **Números que cuentan** (contador animado) al cambiar energía, XP, oro, reputación.
- **Iconos de umbral**: hambre y sed laten suavemente al entrar en zona crítica (reutiliza
  `pulse-slow`).
- **Texto flotante** "+15 XP", "−1 energía", "+3 Hierro" que sube y se desvanece desde el
  elemento que cambia. Componente `FloatingText` genérico. **M**

### 3.3 Subida de nivel con ceremonia **[P]** **M**
Hoy solo hay un `pop` en el botón de nivel. Propuesta: viñeta de cristal que recorre la pantalla
(una sola vez), insignia grande "Nivel 7" con `stamp-in`, gemas que se encienden una a una con los
puntos a repartir y CTA directo a Estadísticas.

### 3.4 Sistema de notificaciones (toasts) **[P]** **M**
Pila en la esquina superior derecha con el lenguaje de `plank-panel` + borde de color por tipo
(`quest` misión, `moss` logro, `danger` peligro, `accent` sistema): misión aceptada/completada,
objeto obtenido, expedición vuelta, cambio de relación entre facciones (enlaza con "El mundo vivo,
visible" del hito 0.1). Agrupa repetidas ("+3 Hierro ×2"). Duración y posición configurables en la
Fase 1.

### 3.5 Narración más viva **[P]** **M**
- **Capitular** (inicial grande decorada en Cinzel) en la primera entrada de cada escena o día.
- **Separadores de escena** con la gema y hairlines al cambiar de zona, de día o de estación.
- Cursor parpadeante tipo pluma mientras el narrador escribe (streaming).
- Diálogo de NPC con **retrato pequeño** a la izquierda si la enciclopedia tiene `thumbnail`.
- Botón "ir al final" flotante cuando el jugador ha hecho scroll hacia arriba y llega texto nuevo.

### 3.6 Combate con más impacto **[P]** **M**
- **Sacudida corta del panel** del rival al recibir un golpe y del propio HUD al recibirlo el
  jugador (desactivable, Fase 1.5).
- **Números de daño/estado flotantes** sobre la tarjeta del rival.
- **Ficha del rival con retrato a sangre** (banner a ancho completo con degradado inferior y
  nombre encima) en lugar de imagen dentro de recuadro.
- **Indicador de turno** claro: franja superior que cambia entre "Tu ataque" (madera cálida) y
  "Tu defensa" (azul, ya existe `plank-panel-defense`) con transición cruzada.
- **Viñeta roja** en los bordes de la pantalla cuando el personaje está GRAVE/CONVALECIENTE.
- Pantalla de **victoria/derrota** con resumen (daño hecho, recibido, botín) antes de volver.

### 3.7 Dados **[P]** **S-M**
- Dado con **cara visible que rueda** (SVG de d20 con rotación) en vez de solo el número cambiando.
- **Crítico/pifia** con efecto propio: destello dorado + partículas para 20 natural, grieta y
  sacudida para 1 natural.
- Velocidad y salto según Fase 1.5.

### 3.8 Cajón y paneles **[P]** **S-M**
- Pestañas internas (Personaje, Reino, Habilidades…) con **indicador deslizante** en vez de saltar
  de una a otra.
- **Recordar la última subpestaña** de cada panel.
- Inventario: **arrastrar y soltar** objetos a las ranuras de equipo y consumibles, con resaltado
  de ranuras compatibles (`isCompatibleWithSlot` ya existe).
- **Comparador de objetos** en el tooltip (equipado vs. el que miras, con flechas ▲▼ coloreadas).
- **Rareza visible** del objeto (borde/brillo según calidad) si el catálogo la tiene. 🧭

### 3.9 Brújula y movimiento **[P]** **S**
La brújula central (🧭) gira lentamente hacia el rumbo de la última salida tomada, y la aguja
tiembla en zonas peligrosas. Requiere 2.2 (icono SVG).

---

## Fase 4 — Atmósfera y opciones gráficas

Todo lo de esta fase va detrás del ajuste "Efectos ambientales" y "Calidad visual" (Fase 1.5).

### 4.1 Ambiente según hora, estación y clima **[P]** **M**
El backend ya envía `entorno` (estación + clima) y la fecha ficticia. Propuesta: una capa fija y
barata detrás de los paneles que cambia el **tinte del fondo** (amanecer cálido, noche azulada
con el `crystal-sky`, invierno desaturado) y añade **partículas CSS** según el clima: lluvia
(líneas diagonales), nieve, polvo rojo en la estepa, niebla en la Ciénaga. Máximo ~30 partículas,
solo `transform`, pausadas cuando la ventana no tiene foco.

### 4.2 Tema visual por región **[P]** **M** 🧭
Igual que hoy cada mundo tiñe `accent`, cada **región** de Berig podría modular la textura base:
Llanuras = `dust-road`, Cristal Helado = madera escarchada y acento más frío, Ciénaga Troncal =
madera húmeda con musgo, Meseta del Orden = `iron-etched` dominante. Encaja con los hitos
`0.4`–`0.6`. Revisar con el canon de `docs/rpgtarkor/` antes de fijar colores.

### 4.3 Cielo de cristal animado en el inicio **[P]** **S**
`crystal-sky` hoy es estático por decisión explícita. Propuesta opcional: un parpadeo muy lento
(10-20 s) de unos pocos cristales y un paralaje leve con el ratón. Desactivado si "Animaciones:
reducidas". 🧭 Respetar o no la decisión original de "nunca animado".

### 4.4 Pantallas previas a la partida **[H]**/**[P]** **M**
- **Inicio:** logotipo/título "Tarkor" como elemento principal (hoy domina la pregunta "¿Cómo
  quieres jugar?"), imagen de fondo de Berig (el mapa `helek-sirik-berig.png` ya existe) con
  oscurecido, botones de menú clásicos: *Continuar · Partidas · Configuración · Salir*.
- **Elegir mundo:** tarjeta con imagen del mundo a sangre y paralaje al pasar el ratón.
- **Elegir personaje:** retrato grande (sustituye la "G"), atributos dibujados como **rueda** en el
  mismo orden del anillo de debilidades (`ATTRIBUTE_RING`, `attributeWheel.ts`) y con los colores por atributo en vez de barras azules iguales, y un
  "Continuar" deshabilitado que se lea como tal (H11).
- **Partidas guardadas:** miniatura de la zona/última escena, fecha ficticia, nivel y tiempo
  jugado; animación de borrado.
- Transiciones entre los 3 pasos con deslizamiento lateral (el `StepDots` ya marca el avance).

### 4.5 Pantalla de carga con lore **[P]** **S**
Sustituir "Cargando partida..." por una tarjeta con ilustración o mapa, un consejo de juego o una
cita del lore (frases de `waitingFlavor.ts` ya existen como base) y una barra de progreso con la
gema.

### 4.6 Cursor temático **[P]** **S** 🧭
Cursor personalizado (guantelete/pluma) en SVG empaquetado, con versión "mano" sobre lo pulsable.
Opción en Configuración para usar el cursor del sistema.

### 4.7 Mapa interactivo **[P]** **M**
- **Niebla de guerra** sobre zonas no visitadas (máscara SVG) que se disipa con una transición al
  descubrirlas.
- Ruta animada (trazo discontinuo que avanza) durante un viaje en curso.
- Zoom y desplazamiento con rueda/arrastre suavizado (hoy el zoom es un modal aparte).
- Leyenda plegable y marcadores con iconos SVG de 2.2.

---

## Fase 5 — Sonido **[P]** 🧭

La mayor ausencia "de videojuego" del front (H14). Todo empaquetado, todo con su volumen en
Configuración (1.6).

- **Gestor de audio** (`AudioContext` propio o `howler.js`, ~10 KB) con canales Música / Efectos /
  Ambiente / Interfaz y precarga perezosa. **M**
- **Interfaz:** clic de madera/hierro, abrir/cerrar cajón, pasar página en el Diario. **S**
- **Dados:** rodar y aterrizar (distinto en crítico/pifia). **S**
- **Combate:** golpe, bloqueo, fallo, muerte; tambor grave al entrar en combate. **S**
- **Ambiente** según región/clima (viento de estepa, lluvia, ciénaga). **M**
- **Música** por estado (exploración, combate, reino, muerte), con fundido cruzado. **L**
- 🧭 Origen de los audios: librería libre (Freesound/OpenGameArt con licencia compatible) o
  generados; y si la música entra en `0.x` o se deja para la Beta.

---

## Orden recomendado

| Orden | Bloque | Motivo |
|---|---|---|
| 1 | **1.1–1.5, 1.8** (Configuración básica) + **2.1** (fuentes) | Lo pedido por Álvaro y lo que más arregla con menos riesgo; las fuentes rotas se notan en cada pantalla. |
| 2 | **2.3, 2.5, 2.7** | Foco/mando para la Steam Deck, `GameView` troceado y animaciones de salida desbloquean casi todo lo demás. |
| 3 | **3.2, 3.4, 3.6, 3.7** | Lo que más "dinamismo" da durante la partida: HUD vivo, toasts, combate y dados. |
| 4 | **2.2, 2.4, 2.6, 4.4, 4.5** | Pulido de identidad (iconos, tokens) y pantallas previas. |
| 5 | **Fase 4** restante y **1.7** | Atmósfera y atajos reasignables. |
| 6 | **Fase 5** y **1.6** | Sonido, cuando se decida su alcance. |
| — | **1.3 Resolución / modo ventana nativos** | Al montar el envoltorio Tauri (paso 5 del plan de `20-instalador-distribuible.md`). |

## Decisiones pendientes 🧭 (resumen)
1. ¿Resolución real solo cuando exista Tauri, o se adelanta el envoltorio? (1.3)
2. Fuente de cuerpo / de narración. (2.1)
3. Iconos propios o set libre. (2.2)
4. Hook propio + View Transitions, o añadir `motion`. (2.7)
5. ¿Se anima el cielo de cristal pese a la decisión original? (4.3)
6. Colores por región: revisión contra canon. (4.2)
7. Rareza de objetos visible. (3.8)
8. Cursor temático sí/no. (4.6)
9. Alcance y origen del sonido. (Fase 5)
