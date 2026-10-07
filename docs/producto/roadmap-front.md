# Roadmap de front — Tarkor

**Creado:** 2026-10-01. **Revisión 2 (mismo día):** pasada completa archivo por archivo de
`frontend/src` — las 7 páginas, los 30 modales, los paneles del cajón y las 5 secciones de Reino, `index.css`, los hooks
de flujo — más capturas reales de inicio, mundo y personaje.
**Relación con el roadmap principal:** complementario a [21-roadmap.md](21-roadmap.md). No rompe la
congelación del hito `0.1`: los bloques marcados **«arreglo»** son correcciones que encajan en
`0.1`; el resto entra en los hitos que decida Álvaro.

**Documentos hermanos:** [Reino](roadmap-front-reino.md) · [Mapa de zona](roadmap-front-zona.md) ·
[Experiencia de usuario: flujos, orden y bloqueos](roadmap-front-ux.md) ·
[Cronista: historia viva de la partida](roadmap-cronista.md).
**Orden y hito de cada fase:** lo fija el [mapa de roadmaps](21-roadmap.md#mapa-de-roadmaps) del
roadmap general; la tabla de § 15 de este documento queda como referencia de prioridades internas.

**Cómo se usa** (mismo convenio que el roadmap principal):
- Al cerrar un punto se tacha aquí con su commit.
- **🧭 = decide Álvaro antes de empezar.**
- Origen: **[A]** pedido o decidido por Álvaro · **[H]** hallazgo verificado en código ·
  **[P]** propuesta de Claude.
- Esfuerzo orientativo: **S** (horas) · **M** (1-2 días) · **L** (varios días).
- Cada punto lleva un identificador (`CFG-3`, `DAD-7`, `MOD-12`…) para poder citarlo en commits y
  en los registros.

## Índice

0. [Restricciones](#0-restricciones-que-manda-todo-lo-de-abajo)
1. [Diagnóstico general](#1-diagnóstico-general)
2. [Menú de Configuración](#2-menú-de-configuración-cfg--prioridad-máxima-a) — `CFG`
3. [Base técnica del diseño](#3-base-técnica-del-diseño-bas) — `BAS`
4. [Sistema de tiradas de dados](#4-sistema-de-tiradas-de-dados-dad) — `DAD`
5. [Sistema de modales](#5-sistema-de-modales-mod) — `MOD`
6. [Revisión modal por modal](#6-revisión-modal-por-modal) — `MOD-xx`
7. [Revisión panel por panel](#7-revisión-panel-por-panel-pan) — `PAN`
8. [HUD y dinamismo de partida](#8-hud-y-dinamismo-de-partida-hud) — `HUD`
9. [Narración y registros](#9-narración-y-registros-nar) — `NAR`
10. [Combate](#10-combate-cmb) — `CMB`
11. [Atmósfera y opciones gráficas](#11-atmósfera-y-opciones-gráficas-atm) — `ATM`
12. [Pantallas fuera de la partida](#12-pantallas-fuera-de-la-partida-pre) — `PRE`
13. [Sonido](#13-sonido-son) — `SON`
14. [Calidad: cómo se verifica todo esto](#14-calidad-cómo-se-verifica-todo-esto-qa) — `QA`
15. [Lo que piden el Cronista, la zona y el Reino](#15-lo-que-piden-el-cronista-la-zona-y-el-reino-int) — `INT`
16. [Orden recomendado](#16-orden-recomendado)
17. [Decisiones pendientes](#17-decisiones-pendientes-)

---

## 0. Restricciones que manda todo lo de abajo

1. **No hay versión móvil.** Objetivo: escritorio (≥1280 px) y **Steam Deck (1280×800)** como
   pantalla mínima de referencia. Nada de este documento persigue layouts de teléfono. **[A]**
2. **GPU modesta.** El historial de bugs ya prohibió `backdrop-blur` (artefactos en la GT 730M, ver
   `PanelDrawer.tsx`), y la iGPU de la Steam Deck va ocupada por el narrador local (Ollama). Por
   tanto: animaciones solo de `transform`/`opacity`, nada de filtros en bucle, nada de WebGL
   permanente, todo efecto ambiental desactivable. **[H]**
3. **Distribución futura con Tauri** (`docs/arquitectura/20-instalador-distribuible.md`): ventana
   nativa y **sin conexión garantizada**. Todo recurso (fuentes, iconos, sonidos, texturas) va
   empaquetado, nunca desde un CDN. **[H]**
4. **Identidad visual ya fijada**: madera (`wood`), hierro (`iron`), cristal del mundo
   (`accent`/`accent2`), estados fijos (`moss`/`danger`/`cost`/`quest`), color por atributo y paleta
   por raza (`razaTheme.ts`). Se amplía ese lenguaje, no se sustituye.
5. **`prefers-reduced-motion` ya se respeta** en `index.css`; todo lo nuevo entra en esa lista y en
   el ajuste propio de animaciones (`CFG-14`).
6. **Las esperas del narrador son largas** (decenas de segundos en local). El front debe convertir
   esa espera en algo que se mira, nunca en un bloqueo silencioso.

---

## 1. Diagnóstico general

### 1.1 Lo que funciona bien (y hay que conservar)
- Sistema de tokens sólido en `@theme`: escalas madera/hierro, acentos tematizables por mundo
  (`applyWorldTheme`), paleta por raza, un color por atributo.
- Texturas 100 % CSS con identidad (`.plank-panel`, `.iron-band`, `.dust-road`, `.crystal-sky`,
  remaches, `corner-bracket`), baratas y coherentes con el lore.
- Catálogo de microanimaciones con intención (sello, sacudida, pop, campanada del hairline, latido
  de herida grave) y su bloque de `prefers-reduced-motion`.
- `SelectionModalShell`: foco, Escape y atrapado de Tab, con tests, ya usado por 22 modales.
- La tirada "en vivo" existe y está centralizada en `DiceRoll.tsx` para combate, iniciativa,
  turno normal, Huir y Tameo.
- El movimiento por la zona ya interpola posiciones (`transition: transform` en `ZonaPanel.tsx`).

### 1.2 Hallazgos verificados **[H]**

| # | Hallazgo | Dónde |
|---|---|---|
| H1 | **No existe menú de configuración ni preferencias guardadas** (cero usos de `localStorage`). | toda la app |
| H2 | **Fuentes no fiables**: Cinzel por `@import` de Google Fonts (sin red cae a una serif genérica, visto en las capturas) e **Inter nunca se carga**. | `index.css:3-7` |
| H3 | **Una tirada "vs" dura ~10 s** (`ROLL_DURATION_MS = 5000`, secuencial), sin acelerar ni saltar. | `DiceRoll.tsx` |
| H4 | **Cero estilos `focus-visible`**: con teclado o mando no se ve qué está seleccionado. | toda la app |
| H5 | **Ninguna animación de salida**: modales, cajón, tooltips y combate desaparecen de golpe. | todos los overlays |
| H6 | **Modales con cascarón propio sin Escape/foco/rol**: `DetailModal`, `DynamicModeModal`, `KingdomFoundingModal`, `ClaseModal`, `EspecializacionModal`, `MapZoomModal`; y **el cajón `PanelDrawer` tampoco cierra con Escape**. | ver lista |
| H7 | **91 colores de Tailwind sueltos** (`red-400`, `emerald-300`, `amber-400`…) y **81 valores arbitrarios** junto a los tokens; los mensajes de éxito usan `emerald-300` en unos modales y `moss` en otros. | `*.tsx` |
| H8 | **Clases CSS muertas**: `animate-edge-flash-amber`, `animate-stamp-in-equip`. | `index.css` |
| H9 | **Iconografía 100 % emoji**, que cambia según el SO (ya hubo un ❌ en lugar de ⚔️, comentado en `GameView.tsx`). El 🎲 (un d6) representa también los d20 y d100. | `NavTabs.ts`, paneles, tiradas |
| H10 | **Imágenes sin `loading="lazy"`, sin `decoding="async"` y sin fundido**: aparecen a saltos. | 13 `<img>` |
| H11 | **Pantallas previas planas**: tarjetas sin imagen, el personaje es una "G" en un círculo, "Continuar" deshabilitado casi invisible. | `CharacterSelect`, `WorldSelect` |
| H12 | **Textos de bajo contraste** (`wood-600/700` sobre madera): enlace de admin, versión, dificultad de las tiradas ("necesitas X" en `wood-600`). | `Home`, `DiceRoll` |
| H13 | **`GameView.tsx` tiene 2.129 líneas** con layout, HUD y todos los modales. | `pages/GameView.tsx` |
| H14 | **Sin sonido** de ningún tipo. | toda la app |
| H15 | **Sin división de código**: Enciclopedia (1.574 líneas), mapa y admin se cargan siempre. | `App.tsx` |
| H16 | **Sin atajos de teclado globales**: la barra de habilidades no responde a 1-9, los paneles no tienen tecla, solo hay un listener de teclado global (el visor de imágenes). | toda la app |
| H17 | **Herramientas de admin visibles al jugador**: `ImagePromptSlot` ("Prompt (inglés)", "Generar") aparece en Clase, Especialización y fichas de la Enciclopedia dentro de la partida. | `ImagePromptDisplay.tsx` + 9 usos |
| H18 | **Tameo: la segunda tirada no se vuelve a animar** — `DiceRollVs` se renderiza sin `key`, así que React reutiliza la instancia y su `useEffect(..., [])` no se repite (mismo patrón que el hallazgo 27 ya corregido en `CombatPanel`). Pendiente de confirmar jugando. **arreglo** | `TameoModal.tsx` |
| H19 | **Tameo: el veredicto llega antes que el dado** — "¡Gana confianza!"/"No cede esta vez" y el fondo verde/rojo se pintan en cuanto llega la respuesta, mientras el dado aún gira (en Recolección y en la iniciativa de combate ya se corrigió esto mismo con `onLanded`/`initiativeRevealed`). **arreglo** | `TameoModal.tsx` |
| H20 | **La tirada en vivo no enseña el total**: muestra dado, `+bono`, el desglose entre paréntesis y "necesitas X", pero nunca "= 19 vs 15 → Éxito" — hay que sumar de cabeza. El estático (`RollBadge`) sí lo enseña. | `DiceFace` en `DiceRoll.tsx` |
| H21 | **Cinco representaciones distintas de una tirada**: `DiceFace` (en vivo), `GatheringDiceReveal` (JSX propio con ventaja), `RollBadge` (estático), `ExtendedRollBadge` (d100 de sigilo, d6 de grupo, iniciativa de grupo en lista) y `CombatExchangeBadge` (combate estático). Cada una con su propio aspecto. | componentes de tiradas |
| H22 | **El fallo no tiene color propio** en las tiradas (`wood-400`, gris), y no existe tratamiento de crítico (20 natural) ni pifia (1 natural). | `DiceRoll.tsx`, `RollBadge.tsx` |
| H23 | **Etiquetas genéricas y truncadas** en los dados: "Tú" / "el enemigo" / "Resistencia", con `max-w-[6rem] truncate`. | `DiceRoll.tsx`, `CombatPanel.tsx`, `TameoModal.tsx` |
| H24 | **Cada tirada hace `scrollIntoView` suave** incondicional: si el jugador está leyendo más arriba, se le arrastra. | `useScrollIntoViewOnMount` |
| H25 | **Ningún resultado se anuncia a lectores de pantalla** (sin `aria-live` en tiradas, toasts ni narración nueva). | `DiceRoll.tsx`, `LogPanel.tsx` |
| H26 | **El selector de cantidad −/+ está copiado 5 veces** (Recolección, Curar, Comer ×2, Producción) sin "máximo", sin mantener pulsado y sin teclear el número. | modales de selección |
| H27 | **Los modales de lista son texto puro**: ningún objeto, NPC o recurso muestra su miniatura aunque la Enciclopedia la tenga. | Entregar, Capturar, Saquear, Viajar… |
| H28 | **Los estados de carga son solo una frase** ("Buscando…", "Cargando…", "Consultando…"), sin esqueletos; el contenido llega de golpe y el modal cambia de altura. | todos los modales asíncronos |
| H29 | **Inventario sin buscar, filtrar ni ordenar**, y los objetos son emoji por categoría. | `InventarioPanel.tsx` |
| H30 | **Momentos grandes tratados como formularios**: fundar reino, elegir clase (irreversible) y especialización usan el mismo modal estrecho `max-w-md` que "Cancelar acción". | `KingdomFoundingModal`, `ClaseModal`, `EspecializacionModal` |
| H31 | **El composer no recuerda acciones anteriores** (no hay ↑ para recuperar la última). | `ChatComposer.tsx` |
| H32 | **La pantalla de error** (`ErrorBoundary`) no ofrece volver al inicio ni copiar el error para reportarlo. | `ErrorBoundary.tsx` |

---

## 2. Menú de Configuración (`CFG`) — prioridad máxima **[A]**

> Petición de Álvaro (2026-10-01): "un botón de configuración como en todos los juegos, desde el
> cual el jugador podrá ajustar resolución y otro tipo de cosas".

### 2.1 Acceso y estructura
- ~~**CFG-1 · Botón ⚙️ fijo** en la cabecera de hierro de la partida (junto a la fecha) y en la esquina
  superior derecha de `Home`. **S**~~ ✅ 2026-10-02: `components/BotonAjustes.tsx` en `GameHeader` y
  `Home`.
- ~~**CFG-2 · `Esc` abre el menú** cuando no hay ningún modal/cajón abierto (si lo hay, `Esc` lo cierra
  primero, como en cualquier juego); botón *Menú/Start* del mando igual. **S**~~ ✅ 2026-10-02:
  escuchador en `GameView` sobre el gestor de capas: sin capa abierta, abre la pausa; con el cajón
  arriba, lo cierra; los modales cierran con su propio Esc (`ModalShell`). **Queda:** el botón
  *Menú/Start* del mando (Gamepad API, con `CFG-27`).
- ~~**CFG-3 · Menú de pausa** dentro de la partida: *Reanudar · Configuración · Guardar y salir a tus
  partidas · Salir al inicio*. Absorbe el actual "← Salir a tus partidas" de la cabecera. **M**~~
  ✅ 2026-10-02: `components/MenuPausa.tsx` (opciones con número, MOD-3), abierto con «☰ Menú» de la
  cabecera o Esc; sustituye a la confirmación de salida (la partida se guarda en cada turno; si hay
  algo en curso, avisa con el motivo de `canDo(fase, 'salir')`).
- ~~**CFG-4 · Panel de configuración** a pantalla casi completa, pestañas laterales (lenguaje de
  `SideNav`), `plank-panel` + `iron-band`. Pie: **Restablecer · Cancelar · Aplicar**, previsualización
  en vivo, aviso si se cierra con cambios sin aplicar. **M**~~ ✅ 2026-10-02:
  `components/PanelAjustes.tsx` sobre `ModalShell` (`lg`), pestañas Pantalla · Interfaz y texto ·
  Animaciones · Accesibilidad; vista previa sin guardar (`setAjustes(…, { vistaPrevia })`), aviso
  «Hay cambios sin aplicar» con Descartar / Aplicar y cerrar. Lo pinta `AjustesProvider`
  (`abrirPanel()`), así se abre desde cualquier pantalla. **Queda:** pestañas Sonido y Controles
  cuando lleguen sus ajustes (`CFG-25`, `CFG-26`).
- ~~**CFG-5 · Persistencia**: `localStorage` con clave versionada (`tarkor.settings.v1`) y migración
  entre versiones; con Tauri, fichero de configuración del sistema. **S**~~ ✅ 2026-10-02:
  `lib/ajustes.ts` (`cargarAjustes`/`guardarAjustes`, `normalizarAjustes` campo a campo, hueco de
  migración `CLAVES_ANTIGUAS`). **Queda:** el fichero de configuración con Tauri.
- ~~**CFG-6 · `SettingsContext`** que aplica los ajustes como variables CSS y atributos en `<html>`
  (`data-motion`, `data-contrast`, `data-texture`, `--ui-scale`, `--narration-size`…), para que los
  componentes no lean ajustes uno a uno. **M**~~ ✅ 2026-10-02: `AjustesProvider` (en `main.tsx`) +
  `useAjustes` y `aplicarAjustes`: `font-size` raíz (escala), `data-motion` («sistema» resuelto con
  `prefers-reduced-motion`), `data-contrast`, `data-narration-font`, `--narration-size`,
  `--narration-leading` y el factor de los dados (`lib/duracionTirada.ts`). Admite vista previa sin
  guardar para el panel (`CFG-4`). **Queda:** `data-texture` con `CFG-23`.
  Ya se aplican (falta su control en el panel `CFG-4`): escala (`CFG-9`), narración (`CFG-13`, clase
  `.texto-narracion`), animaciones (`CFG-14`, reglas `[data-motion]` sobre la lista de
  `prefers-reduced-motion`), velocidad de los dados (`CFG-20`, `duracionTirada()` en todo lo que
  espera a los dados) y alto contraste (`CFG-28`).

### 2.2 Pestaña Pantalla
| Id | Ajuste | Opciones | Notas |
|---|---|---|---|
| CFG-7 | **Resolución** | 1280×720, 1280×800, 1366×768, 1600×900, 1920×1080, 2560×1440, nativa | Real con Tauri (`setSize`). En navegador, deshabilitado con aviso "disponible en la versión instalada". 🧭 |
| CFG-8 | **Modo de ventana** | Ventana · Sin bordes · Pantalla completa | Navegador: `requestFullscreen()`; Tauri: `setFullscreen`/`setDecorations`. Atajo `F11`. |
| ~~CFG-9~~ ✅ 2026-10-02 | **Escala de la interfaz** | 80 %–150 % | `font-size` raíz; clave en Steam Deck y monitores 4K. Deslizador de 5 en 5 en la pestaña Pantalla. |
| CFG-10 | **Ancho máximo del juego** | 1600 px (actual) · 1920 px · sin límite | Hoy `max-w-[1600px]` fijo en `App.tsx`. |
| CFG-11 | **Calidad visual** | Alta · Media · Baja | Agrupa texturas, partículas y sombras; "Baja" pensada para Steam Deck en batería. |
| CFG-12 | **Brillo / gamma de la interfaz** | deslizador | Las texturas de madera son muy oscuras en pantallas con poco brillo. |

### 2.3 Pestaña Interfaz y texto
- ~~**CFG-13 · Tamaño y tipografía de la narración** (independiente de la escala general): tamaño
  pequeño · normal · grande · muy grande; fuente serif de lectura · sans · *Atkinson Hyperlegible*
  (empaquetada); interlineado normal/amplio. **S**~~ ✅ 2026-10-02: tamaño, fuente (Normal = la de
  siempre · Serif de lectura = Georgia · Muy legible) e interlineado amplio, sobre `.texto-narracion`.
  **Queda:** empaquetar Atkinson Hyperlegible (hoy cae en Verdana si no está instalada).
- **CFG-15 · Revelado del texto del narrador**: tal como llega del streaming (actual) o suavizado con
  efecto máquina de escribir (rápido/normal). **S**
- **CFG-16 · Tooltips**: siempre · con retardo · nunca. **S**
- **CFG-17 · Disposición**: registro de personaje a izquierda/derecha; recordar qué lado estaba
  colapsado (hoy `collapsedSide` se pierde al recargar); recordar la última subpestaña de cada panel. **S**
- **CFG-18 · Notificaciones** (ver `HUD-6`): posición, duración y qué tipos mostrar. **S**
- **CFG-19 · Formato de fecha ficticia** en cabecera: corto / largo. **S**

### 2.4 Pestaña Gráficos y animaciones
- ~~**CFG-14 · Animaciones**: Completas · Reducidas · Ninguna. Por defecto sigue a
  `prefers-reduced-motion`, pero se puede forzar. Implementación: `[data-motion]` reutilizando la
  lista de clases que ya existe en `index.css`. **S**~~ ✅ 2026-10-02: Como el sistema · Completas ·
  Reducidas · Ninguna («Ninguna» quita también las transiciones; «Completas» manda sobre el sistema).
- **CFG-20 · Tiradas de dados** (detalle en §4): velocidad *Dramática* (actual) · *Normal* · *Rápida* ·
  *Instantánea*; dónde se muestran (*en el registro* · *en primer plano* · *solo las importantes en
  primer plano*); saltar con clic/`Espacio`. **S** (resuelve H3) 🚧 2026-10-02: hecha la
  **velocidad** (`lib/duracionTirada.ts`: todo lo que espera a los dados usa `duracionTirada()`).
  2026-10-06: hecho **saltar** (clic en los dados o `Espacio` fuera de un campo de texto y de un
  botón con el foco): `temporizadorTirada`/`saltarTiradas` en `lib/duracionTirada.ts` adelantan
  todo lo que espera a los dados (aterrizaje, vida aplicada, iniciativa siguiente, consecuencias
  del registro), en su orden. **Falta:** dónde se muestran (en primer plano), que va con `DAD-7` en
  el `0.3` porque necesita el `DiceTray`.
- **CFG-21 · Efectos ambientales** (§11): sí/no. **S**
- **CFG-22 · Sacudidas de pantalla y destellos**: sí/no (también accesibilidad). **S**
- **CFG-23 · Texturas**: Detalladas · Lisas (versión plana de `.plank-panel`/`.iron-band`). **S**
- **CFG-24 · Imágenes en la narración** (banners de enciclopedia): sí/no. **S**

### 2.5 Pestaña Sonido (cuando exista §13)
- **CFG-25** · Volumen General · Música · Efectos · Ambiente · Interfaz · Voz/narrador (futuro), y
  *silenciar al perder el foco de la ventana*. **S**

### 2.6 Pestaña Controles
- ~~**CFG-26 · Atajos de teclado reasignables**: `I` Inventario, `M` Mapa, `P` Personaje, `H`
  Habilidades, `J` Diario, `K` Reino, `L` Enciclopedia, `1-9` barra de habilidades, `Z` moverse por
  la zona, `Enter` enviar, `↑` recuperar última acción, `Esc` menú. Hoy no hay ninguno (H16). **M**~~
  ✅ 2026-10-02: `lib/atajos.ts` (I, M, P, H, J, K, L, Z; reasignar intercambia si la tecla ya era de
  otra acción; números, Espacio, Enter, Esc y Tab reservados) y pestaña «Controles» del panel. En
  `GameView` abren o cierran su panel con las mismas pestañas bloqueadas que la barra lateral y el
  permiso de la fase; Z solo si se puede mover. **Queda:** `1-9` para la barra de habilidades y `↑`
  para recuperar la última acción.
- **CFG-27 · Mando / Steam Deck**: foco visible grande, esquema de botones, repetición al mantener
  la cruceta. Depende de `BAS-3`. **M**

### 2.7 Pestaña Accesibilidad
- ~~**CFG-28 · Alto contraste**: sube un paso los textos `wood-400/500/600` y engrosa bordes. **S**~~
  ✅ 2026-10-02: `[data-contrast='alto']` aclara `text-wood-400/500/600` un paso y marca los bordes
  `iron-700/800`.
- **CFG-29 · Modo daltónico**: éxito/fallo y los 7 colores de atributo con forma/icono además de
  color; paletas Deuteranopía/Protanopía/Tritanopía. **M**
- **CFG-30 · Subrayar enlaces a la enciclopedia** en el texto (hoy solo color). **S**
- **CFG-31 · Lector de pantalla**: anunciar tiradas, notificaciones y narración nueva (`aria-live`, H25). **S**

### 2.8 Pestaña Partida
- **CFG-32 · Confirmar acciones irreversibles** (matar convaleciente, cancelar acción, soltar
  captura, salir): sí/no. **S**
- **CFG-33 · Modo desarrollador**: muestra versión completa, id de partida, tiempos del narrador y
  las herramientas de prompts de imagen; **apagado por defecto**, de modo que `ImagePromptSlot`
  deja de verse en partida (H17). **S** — ✅ parte del 0.1 (2026-10-01): `lib/modoDesarrollador.ts`
  (`localStorage`, interruptor en la página de admin, que enseña las herramientas siempre);
  `ImagePromptSlot` y el bloque de prompts de `DetailModal` solo con el modo activo. Pendiente para
  el menú de Configuración (CFG-1): el interruptor allí, versión completa, id de partida y tiempos del
  narrador.
- ~~**CFG-34 · Estilo del mundo**~~ ✅ 2026-10-05 (ya lo hizo `CR-12`: «Ritmo del mundo» en Ajustes de la partida; cerrada en la ronda 1 de la Fase E) (Cronista D-7): *Tranquilo · Equilibrado · Caótico* — cuántos sucesos
  genera el narrador de fondo (presupuesto de tensión). Por defecto *Equilibrado*. **S**
- ~~**CFG-35 · Avisos de sucesos**~~ ✅ 2026-10-05 (ajuste `avisosSucesos` en «Interfaz y texto»; `debeAvisar` en `lib/noticias.ts`; cada noticia de un suceso lleva su nivel; una propuesta al Reino avisa siempre salvo con «ninguno»): a partir de qué importancia sale una notificación (`HUD-6`):
  todos · importantes (≥ 5, por defecto) · solo graves (≥ 8) · ninguno. **S** (Por defecto ≥ 5 confirmado
  en `CR-18` Q7, 2026-10-05.)
- **CFG-36 · Crónica**: escribir crónica diaria / semanal / solo al final; mostrar "por qué pasó"
  (causas) en Leyendas. **S**
- **CFG-37 · IA en la nube para el Cronista** (Cronista D-4): solo visible si hay clave configurada;
  apagado por defecto. **S**

---

## 3. Base técnica del diseño (`BAS`)

- ~~**BAS-1 · Fuentes empaquetadas** **[H]** **S** — `woff2` en `frontend/src/assets/fonts`,
  `@font-face` + `font-display: swap`, fuera el `@import` de Google. Requisito para Tauri sin red.~~
  ✅ 2026-10-01: Cinzel e Inter variables (latin + latin-ext, OFL) en `src/assets/fonts/fonts.css`;
  Inter, que antes no se cargaba, ya se ve de verdad. Comprobado sin red en Chromium.
  🧭 Fuente de cuerpo: Inter (ya declarada) o una serif de lectura para la narración (*EB Garamond*,
  *Crimson Pro*, *Spectral*) manteniendo Inter en la interfaz.
- **BAS-2 · Iconos SVG propios** **[H]** **M** — `Icon.tsx` + sprite propio (el `public/icons.svg`
  actual es el sobrante de la plantilla de Vite, iconos de redes sociales). Navegación, HUD, combate,
  dados y estados; los emoji se quedan solo dentro del texto narrado. Permite animar iconos y
  distinguir d20/d6/d100. 🧭 Dibujados a mano o partir de un set libre (Game-icons.net, CC BY 3.0).
- ~~**BAS-3 · Foco visible y navegación** **[H]** **M** — `:focus-visible` global (anillo de cristal
  `accent-400` + glow suave); navegación con flechas/cruceta en rejillas (inventario, equipo, barra de
  habilidades, mapa).~~ ✅ 2026-10-02: anillo global en `index.css` (`:where(…):focus-visible`, sin
  los contenedores `tabindex="-1"`). Navegación **espacial** con flechas, Inicio y Fin
  (`lib/navegacionRejilla.ts`, `useNavegacionRejilla`, celdas marcadas con `data-celda`) en
  inventario, habilidades, equipo (muñeco + consumibles) y barra de habilidades. **Queda:** el mapa
  de zona (SVG con pines) va con el roadmap de zona (Z-B/Z-D).
- **BAS-4 · Limpieza de tokens** **[H]** **M** — colores sueltos a tokens (`danger-700..950` como
  estructurales, `success` = `moss` en vez de `emerald`); sombras repetidas como utilidades con nombre
  (`shadow-plank`, `glow-accent`, `inset-well`); `Button` con variantes `alert`, `compact`, `icon`;
  borrar clases muertas (H8).
- ~~**BAS-5 · Partir `GameView.tsx`**~~ ✅ 2026-10-06 **[H]** **L** — `GameHeader`, `GameFooter`, `GameModals`,
  `GameLayout`. Sin cambio visual; desbloquea HUD y Configuración. 🚧 en curso (2026-10-02): hecho
  `GameHeader` (`components/GameHeader.tsx`, con las animaciones de nivel y muertes) y `GameFooter`
  (`components/GameFooter.tsx`: fin, muerte, composer de combate como hueco, composer normal con
  barra de habilidades; el bloqueo y su motivo se calculan en GameView). **Queda, aplazado al
  final de la Fase B del 0.2:** `GameModals` y `GameLayout`. Medido: las 19 capas usan 135 nombres
  de GameView y solo el cajón de paneles 70; sacarlos a props solo cambiaría de sitio la lista. Se
  hará con un contexto/almacén del estado de la partida que les dé acceso directo.
  🚧 2026-10-06 (usuaria: hacerlo ahora, por pasos): paso 1 ✅ — el estado y los manejadores salen
  a `pages/useGameViewState.tsx` (`GameViewState` = su tipo de retorno); `GameView` solo pinta.
  Paso 2 ✅ — `GameViewContext` (`pages/GameViewContext.ts`, `useGameView()`) y `GameModals` (las 18
  capas modales, `pages/GameModals.tsx`). Paso 3 ✅ — `GameLayout` (raíles y los dos paneles) y
  `GamePanelCajon` (el cajón de paneles). `GameView` pasa de 2422 a 305 líneas: proveedores,
  cabecera, avisos de ocupado/combate, pie y las piezas. **Cerrada.**
- **BAS-6 · Carga** **[H]** **S** — `React.lazy` para Enciclopedia, `MapZoomModal`, `InteractiveMap`,
  admin y secciones de Reino; `loading="lazy"`, `decoding="async"` y fundido en todas las `<img>`.
- ~~**BAS-7 · Animaciones de salida y de cambio de layout**~~ ✅ 2026-10-06 **[P]** **M**
  - **A (recomendada):** hook propio `usePresence(open, ms)` + *View Transitions API* con degradado a
    corte seco donde el webview no la soporte. Cero dependencias.
  - **B:** `motion` (Framer Motion, ~30 KB gz) con `AnimatePresence`/`layout`.

  🚧 2026-10-02 — **se toma la opción A por defecto** (la recomendada; Álvaro puede cambiarla):
  `hooks/usePresence.ts` mantiene montado lo que se cierra durante su salida (cierra en seco con
  «Animaciones: ninguna»). Aplicado al cajón de paneles (`animate-drawer-down` + fondo que se
  aclara, 220 ms; sigue registrado en el gestor de capas mientras sale) y a las notificaciones
  (`saliendo`, 200 ms). **Falta:** salida de `ModalShell` (sus 19 usos se desmontan desde fuera:
  hay que pasar cada apertura por `usePresence`; mejor junto al resto de `BAS-5`) y View
  Transitions para los cambios de disposición (plegar un lado, cambiar de pestaña).
  ✅ 2026-10-06: `components/Presencia.tsx` envuelve cada capa de `GameModals` y la mantiene
  220 ms al cerrarse (`SaliendoContext`): `Capa` la desvanece y `ModalShell` encoge su panel
  (`animate-modal-out`); solo con «Animaciones: completas». `lib/transicionVista.ts`
  (`conTransicion`) usa la View Transitions API al plegar o desplegar un lado y al cambiar de
  pestaña en `Tabs`; sin soporte o sin animaciones completas, cambio en seco.
- ~~**BAS-8 · Librería de componentes base** **[P]** **M** — `QuantityStepper`, `EntityRow` (miniatura
  + nombre + subtítulo + acción), `Skeleton`, `ErrorBanner`, `SuccessState`, `Tabs` con indicador
  deslizante, `ProgressBar` (con barra fantasma), `Chip`. Hoy cada uno vive copiado en varios sitios.~~
  ✅ 2026-10-02: `components/base/` con `Chip`, `ProgressBar` (barra fantasma al bajar), `Tabs`
  (indicador deslizante, flechas/Inicio/Fin) y `EntityRow` (con `Miniatura`); los demás ya salieron
  con `MOD-2`/`MOD-5` (`EstadosModal`, `QuantityStepper`, `ErrorBanner`). `ResourceBar` usa
  `ProgressBar` y los chips de XP del registro usan `Chip`. **Queda:** pasar a ellos el resto de
  copias (barras de vida/energía, pestañas de los paneles, filas de Saquear/Recolectar) según se
  toquen.
- ~~**BAS-9 · Catálogo visual** **[P]** **M** — una ruta `/admin/ui` (como `/admin/enciclopedia`) que
  pinta todos los componentes y estados (vacío, cargando, error, deshabilitado) para revisar el
  diseño sin jugar. Sustituye a Storybook sin añadir dependencias.~~ ✅ 2026-10-02:
  `pages/AdminUI.tsx` en `/admin/ui` (chips, barras, pestañas, filas, cantidades, estados de modal,
  tarjetas de oferta, mantener pulsado, notificaciones y los 5 tamaños de `ModalShell`), con el
  botón ⚙️ para ver cada componente con los ajustes aplicados.

---

## 4. Sistema de tiradas de dados (`DAD`)

La tirada es el momento "de juego de rol" por excelencia y hoy es lo que más se repite en una
partida (cada turno, cada intercambio, cada recolección). Merece un sistema propio.

### 4.1 Problemas actuales (resumen de H3, H18-H25)
1. Cinco aspectos distintos para la misma idea (H21).
2. Dura ~5 s por dado, ~10 s en un "vs", sin saltar (H3).
3. Solo cambia un número; el 🎲 queda quieto y es un d6 aunque se tire un d20 o un d100 (H9).
4. No se ve el total ni la comparación final (H20); la dificultad está en gris casi ilegible (H12).
5. El fallo es gris; no hay críticos ni pifias (H22).
6. Tameo: no reanima la segunda tirada y desvela el veredicto antes de tiempo (H18, H19).
7. Nombres genéricos y cortados (H23); arrastra el scroll (H24); no se anuncia (H25).
8. Técnicamente: ~60 `setTimeout` por dado con `Math.random()` (puede mostrar el número final antes
   de aterrizar) y `GatheringDiceReveal` duplica la lógica en vez de reutilizarla.

### 4.2 Arreglos inmediatos **arreglo**
- ~~**DAD-1** · `key` por tirada en `TameoModal` (H18). **S**~~ ✅
- ~~**DAD-2** · Veredicto de Tameo diferido a `onAllLanded` (H19), como ya hacen Recolección e
  iniciativa. **S**~~ ✅ (también la subida de Felicidad y el color del recuadro)
- ~~**DAD-3** · Mostrar siempre `dado + bono = total vs dificultad → Éxito/Fallo` al aterrizar (H20). **S**~~ ✅
  (lo que el backend suma aparte, como el bono de tirada de una habilidad, sale como término propio;
  en las opuestas, `total vs total → ganador` al caer los dos dados)
- ~~**DAD-4** · Nombres reales en los dos lados (personaje y rival) en vez de "Tú/el enemigo", y
  quitar el truncado a 6rem. **S**~~ ✅ (iniciativa de combate y Tameo; el log ya los pasaba)
- ~~**DAD-5** · `scrollIntoView` solo si la tirada está fuera de la vista y el jugador no ha hecho
  scroll manual en los últimos segundos. **S**~~ ✅ (`lib/scrollTirada.ts`, 4 s)
- ~~**DAD-6** · Color propio de fallo (`danger-400`) y subir el contraste de "necesitas X". **S**~~ ✅
  (todo cerrado el 2026-10-01)

### 4.3 Nuevo componente único: `DiceTray` (bandeja de tiradas) **[P]** **L**
Un solo componente para todas las tiradas, con dos modos (**en vivo** y **histórico compacto**) y
cuatro fases:

1. **Lanzamiento** — dado SVG con su forma real (d20 icosaedro, d6 cubo, d100 = dos d10) que entra
   rodando con rebote y gira con `transform` (sin física ni WebGL). Las caras que se ven al girar
   nunca coinciden con el número final.
2. **Aterrizaje** — el número final con `stamp-in`; crítico y pifia con efecto propio (`DAD-9`).
3. **Modificadores** — chips que entran uno a uno junto al dado, cada uno con el color de su
   atributo: `+5 Fuerza`, `−2 salud`, `+3 habilidad`, `×1,5 ventaja de tipo`. Sustituye al paréntesis
   `(15 −3sal +4hab = 16 ×1.5 ≈24/2)` actual, que es correcto pero difícil de leer.
4. **Veredicto** — el total cuenta hacia arriba y se compara con una **regla horizontal** (1-40) con
   la marca de dificultad y la aguja del resultado; banda final **ÉXITO / FALLO / CRÍTICO / PIFIA**
   con margen ("por 4"). En "vs", las dos agujas en la misma regla, cada una con el retrato o
   iniciales de su lado.

Variantes que cubre (todas las que hoy existen):
| Tirada | Hoy | Con `DiceTray` |
|---|---|---|
| Turno normal / Huir | `DiceRollSingle` + `RollBadge` | modo simple contra dificultad |
| Combate (ataque/defensa) | `DiceRollReveal` + `CombatExchangeBadge` | modo "vs" con multiplicador de tipo |
| Iniciativa (combate y encuentro) | `DiceRollVs` + `IniciativaEncuentroBadge` | modo "vs" sin dificultad, texto "Lo ves primero / Te ve primero" |
| Iniciativa de grupo | lista `CombateGrupoBadge` | **orden de turnos** en fila de retratos con su número |
| Recolección con ventaja | `GatheringDiceReveal` | dos dados, el descartado se apaga y se aparta |
| Segundas tiradas por recurso | `SegundasTiradasBadge` | mini-reglas por recurso, en cascada |
| Sigilo de caza (d100) | badge con `≤ chance%` | dos d10 + **barra de probabilidad** con la zona de éxito marcada |
| Entrada de grupo (d6) | badge "uno más/menos" | d6 con la consecuencia como chip |
| Tameo | `DiceRollVs` + caja verde/roja | modo "vs" con la barra de Felicidad avanzando al final |

### 4.4 Presentación y ritmo
- **DAD-7 · Dónde se ve** (`CFG-20`): *en el registro* (actual), *en primer plano* (un modal ligero,
  centrado, fondo atenuado, que se cierra solo al terminar o con clic) o *solo las importantes en
  primer plano* (iniciativa, combate, Tameo, críticos). **M**
- **DAD-8 · Velocidad**: Dramática ~5 s/dado (actual) · Normal ~1,8 s · Rápida ~0,7 s · Instantánea.
  Los dos dados de un "vs" pueden caer **solapados** (el segundo empieza al 60 % del primero) en vez
  de estrictamente seguidos. **Clic/`Espacio`/`Enter` salta** a la fase final. **S**
- **DAD-9 · Críticos y pifias**: 20 natural → destello dorado, borde de cristal y partículas cortas;
  1 natural → grieta en la cara y sacudida seca. Solo efecto visual, la mecánica no cambia. **S**
- **DAD-10 · Tensión mientras el narrador escribe**: en combate el resultado ya llega antes que la
  narración (`onExchangeResolved`); aprovecharlo para que la bandeja se quede visible con el
  veredicto mientras aparece el texto debajo, en vez de desaparecer. **S**
- **DAD-11 · Accesibilidad**: `aria-live="polite"` con la frase completa ("Tirada de Fuerza: 14 más
  5, 19 contra 15. Éxito."); con animaciones reducidas, aparece directamente la fase final. **S**
- **DAD-12 · Implementación**: una sola animación con `requestAnimationFrame` (o CSS) por dado en
  lugar de decenas de `setTimeout`; secuencia de caras pregenerada sin el número final;
  `GatheringDiceReveal` y `DiceRollVs` pasan a ser configuraciones de `DiceTray`. **M**

### 4.5 Extras **[P]** 🧭
- **DAD-13 · Probabilidad antes de actuar**: "≈65 % de éxito" junto a cada habilidad de combate y a
  cada atributo de Tameo, calculado en cliente (d20 + bono contra la dificultad conocida). 🧭 Decisión
  de diseño de juego: puede quitar tensión; podría ser un ajuste de dificultad *Novato*. **S**
- **DAD-14 · Historial de tiradas**: pestaña en el Diario con las últimas tiradas, filtros por tipo y
  una curiosidad estadística ("tu media de d20: 11,2"). **M**
- **DAD-15 · Dados personalizables**: material del dado (hueso, hierro, cristal azul de Helek Sirik)
  como opción cosmética en Configuración. 🧭 **S**

---

## 5. Sistema de modales (`MOD`)

Hoy hay dos familias: 22 modales sobre `SelectionModalShell` y 8 overlays con cascarón propio (H6).
Todos tienen el mismo ancho (`max-w-md`), la misma entrada (`combat-enter`) y ninguna salida.

- ~~**MOD-1 · `ModalShell` único** **M**~~ — evolución de `SelectionModalShell` que absorbe los 8
  overlays propios:
  - **Tamaños**: `sm` (confirmar), `md` (selección, actual), `lg` (fichas de la enciclopedia,
    Tameo), `xl` (Moverte por la zona, editor de barras), `ceremonia` (pantalla casi completa,
    ver MOD-4).
  - **Cabecera** con icono o retrato opcional, título, subtítulo y botón ✕; **pie fijo** (los
    botones no se van con el scroll del contenido).
  - Escape, foco inicial, atrapado de Tab, **devolver el foco** al elemento que lo abrió, `role`,
    `aria-labelledby`.
  - **Animación de salida** (BAS-7) y **apilado** (z-index gestionado; hoy hay `z-50`, `z-[60]` y
    `z-40` repartidos a mano).

  ✅ 2026-10-02: `components/ModalShell.tsx` con tamaños, cabecera (icono,
  título, subtítulo, ✕ o texto propio), pie fijo, cuerpo con o sin scroll, Escape, Tab atrapado,
  foco devuelto al cerrar y `aria-labelledby`; `SelectionModalShell` es una envoltura suya. Migrados
  Clase, Especialización, Fundar reino, Modo dinámico, Detalle, Moverte por la zona y Mapa
  ampliado. El visor de imagen (`ImagePromptDisplay`) queda fuera a propósito: es un visor a
  pantalla completa sin marco, no un panel (ya cierra con Escape). El apilado lo lleva el gestor de
  capas (`UX-9`). **Queda:** la animación de salida, con `BAS-7` (🧭).
- ~~**MOD-2 · Estados comunes** **S** — `Skeleton` mientras carga (con la altura final aproximada, para
  que el modal no salte, H28), `ErrorBanner` con botón *Reintentar*, `SuccessState` con icono y
  sello animado (hoy cada modal escribe su frase en `emerald-300`).~~ ✅ 2026-10-02:
  `components/EstadosModal.tsx`: `CargandoModal` (filas de esqueleto con la altura final, `aria-busy`),
  `ErrorCarga` (con «Reintentar»; `useAsyncModalData` devuelve `reintentar()`) y `ExitoModal` (sello
  ✓ en tono `moss`). Aplicados en Saquear, Aprender oficio, Campamento, Entregar, Capturar, Viajar,
  Recolectar, Grupos de combate y Parcela. Viajar no ofrece reintentar (carga propia sin el hook).
- ~~**MOD-3 · Teclado en modales** **S** — `Enter` confirma, números `1-9` eligen opción en listas
  cortas (Modo dinámico, Viajar, Clase), flechas recorren la lista.~~ ✅ 2026-10-02: en `ModalShell`
  (`teclaDeModal`): números 1-9 pulsan la opción N marcada con `data-opcion`, flechas arriba/abajo
  las recorren y Enter pulsa la marcada con `data-confirmar` (no si el foco está en un botón o un
  área de texto; al escribir en un campo, números y flechas son del campo). Marcados Modo dinámico
  (con el número delante de cada opción), Viajar, Clase, Especialización y Fundar reino.
- ~~**MOD-4 · Modales de ceremonia** **M** — variante para decisiones grandes o irreversibles (fundar
  reino, clase, especialización, muerte, subida de nivel): ancho grande, ilustración, título en
  Cinzel grande, línea de cristal que se extiende (`line-extend`), botón de confirmar que hay que
  **mantener pulsado** 1 s en lo irreversible en vez del doble clic "Aceptar → Confirmar".~~ ✅ 2026-10-02:
  tamaño `ceremonia` de `ModalShell` (ancho grande, título grande, línea de cristal `line-extend`) y
  `components/BotonMantener.tsx` (mantener 1 s con ratón, toque, Espacio o Enter; soltar antes
  cancela). Aplicado a Clase y Especialización (aviso fijo «No podrás cambiar… más adelante» en vez
  de la pregunta del doble clic) y Fundar reino («Mantén para fundar»). **Queda:** muerte y subida
  de nivel no son modales hoy (la muerte sustituye al composer, la subida es una entrada del
  registro); pasarán a ceremonia si se rediseñan como modales.
- ~~**MOD-5 · `QuantityStepper` compartido** **S** — sustituye las 5 copias (H26): botón *Máx.*,
  mantener pulsado para repetir, rueda del ratón, número editable y vista previa del efecto.~~ ✅ 2026-10-02:
  `components/QuantityStepper.tsx` (−/+ que repiten al mantener, número editable, rueda sobre el
  número enfocado, «Máx.» hasta el `tope` con su motivo) en Curar, Comer, Beber y Recolectar.
  Producción ya usaba `NumeroGuardable`. **Queda:** la vista previa del efecto dentro del propio
  selector (hoy cada modal la enseña en su resumen).
- ~~**MOD-6 · `EntityRow` con miniatura** **S** — cada objeto, NPC, criatura o recurso de un modal
  enseña su miniatura de la enciclopedia o el icono SVG de su categoría (H27).~~ ✅ 2026-10-02:
  `components/Miniatura.tsx` (imagen `thumbnail` de la ficha por `entityType:slug` o por nombre;
  si no hay, el icono de la ficha o uno de reserva) en Curar, Comer, Beber, Entregar (objetos y
  NPC), Capturar y Aprender oficio. **Queda:** Saquear y Recolectar (filas con casillas y grupos,
  más complejas) y los iconos SVG de categoría de `BAS-2` en vez de emojis.

---

## 6. Revisión modal por modal

Todos heredan MOD-1…MOD-6; aquí solo lo específico de cada uno.

### Recursos y supervivencia
- **MOD-10 · Recolectar/Desollar** (`HarvestSelectionModal`) — la tirada pasa a `DiceTray`; los
  recursos encontrados aparecen como **cartas** que se dan la vuelta en cascada (ya hay escalonado de
  150 ms); botón *Coger todo lo que quepa*; barra de capacidad de inventario que se llena en vivo con
  la selección (hoy es una línea de texto); el aviso de "segunda tirada no suficiente" con la tirada
  visible, no solo el texto. **M**
- **MOD-11 · Curar** (`HealSelectionModal`) — la vista previa "Herido → Ileso" pasa a la propia
  barra de salud con el tramo que se recuperaría en verde translúcido; botón *Lo justo para quedar
  ileso* que elige la combinación mínima. **S**
- **MOD-12 · Comer/Beber** (`HungerThirstSelectionModal`) — dos barras de hambre y sed con
  previsualización (hoy porcentajes en texto), las dos columnas Comida/Bebida lado a lado, botón
  *Saciar con lo mínimo*. **S**
- **MOD-13 · Saquear la zona** (`SaquearZonaModal`) — un bloque por cuerpo con retrato, *Marcar
  todo/ninguno* por cuerpo y global, peso/hueco de inventario de lo marcado; los `<input type=checkbox>`
  nativos pasan a casillas con el estilo del juego. **S**
- **MOD-14 · Saquear en combate** (`CombatSelectionModal`) y **Cadáver** (`PostCombatInteractionModal`)
  — mismo tratamiento que MOD-13; el de cadáver enseña la imagen del rival caído en gris. **S**

### Viaje y movimiento
- **MOD-15 · Viajar** (`TravelDestinationModal`) — mini-mapa de la región con el destino resaltado al
  pasar el ratón por cada fila; ordenar por tiempo; icono de peligro/control de facción si se
  conoce; la hora de llegada estimada en fecha ficticia. **M**
- **MOD-16 · Volver al campamento** (`CampSelectionModal`) — se fusiona visualmente con Viajar
  (misma fila, con el tiempo de viaje que hoy no enseña). **S**
- **MOD-17 · Moverte por la zona** (`ZonaMovimientoModal`, 90 vh) — ver
  [roadmap-front-zona.md](roadmap-front-zona.md), que propone sacarlo del modal; resumen: leyenda de formas/colores
  plegable, zoom y desplazamiento con rueda/arrastre, ruta prevista dibujada antes de confirmar,
  atajo `Z`. **M**
- **MOD-18 · Salida de zona** (`ZonaSalidaModal`) — la imagen de la salida a ancho completo con
  degradado y el rumbo como **rosa de los vientos**; si no está visitada, silueta brumosa en vez de
  nada. **S**
- **MOD-19 · Punto de la zona / Grupo** (`ZonePointDetailModal`, `ZoneGroupDetailModal`) — retrato o
  imagen arriba, chips de tipo/color con la misma forma del pin del mapa (círculo, rombo…), acciones
  como botones con icono (Saquear, Desollar, Ir hasta, Ver ficha). **S**

### Personajes, criaturas y compañeros
- **MOD-20 · Tameo** (`TameoModal`) — arreglos DAD-1/DAD-2; retrato grande de la criatura o
  prisionero; los 7 botones de atributo con su color y el valor del personaje (hoy todos iguales y
  sin número); la Felicidad como barra con marcas de umbral y corazones/sellos que se llenan;
  historial de intentos; `bg-emerald-500` a token. **M**
- **MOD-21 · Capturar** (`CapturaModal`) — retrato y estado de salud de cada candidato; cuerdas
  disponibles visibles; animación de cuerda al atar. **S**
- **MOD-22 · Entregar** (`EntregaModal`) — hoy en dos pasos de lista (objeto → persona). Propuesta:
  dos columnas (inventario | personas presentes) y **arrastrar el objeto hasta la persona**, con la
  opción de clic como alternativa; aviso si el objeto es de misión para esa persona. **M**
- **MOD-23 · Equipo de compañero** (`CompanionEquipModal`) — mismo muñeco de ranuras que
  `EquipoPanel` del jugador, en pequeño, con comparador. **M**
- **MOD-24 · Grupos de combate** (`CombatGroupsModal`) — el arrastrar y soltar ya existe: añadir
  resaltado de zona de destino, orden dentro del grupo, retratos, y alternativa por teclado. **S**
- **MOD-25 · Aprender oficio** (`AprenderOficioModal`) — ficha del Maestro (retrato, oficio con su
  icono, qué desbloquea) y coste con el saldo de Goirnos al lado; éxito con sello en vez de texto. **S**

### Progresión y decisiones
- **MOD-26 · Elegir clase / especialización** (`ClaseModal`, `EspecializacionModal`) — variante
  ceremonia (MOD-4): tarjetas lado a lado con ilustración, rol, atributos que favorece (con sus
  colores) y habilidades de ejemplo; comparación directa; confirmación manteniendo pulsado; ocultar
  `ImagePromptSlot` (H17). **M**
- **MOD-27 · Fundar reino** (`KingdomFoundingModal`) — ceremonia: estandarte con el nombre que se
  escribe en vivo, color/emblema del reino (🧭 si se guarda), la región en un mini-mapa y, al
  aceptar, sello y entrada solemne en el registro. Añadir Escape/foco (H6). **M**
- **MOD-28 · Confirmar** (`ConfirmModal`) — tamaño `sm`, icono de advertencia, y en lo irreversible
  mantener pulsado (MOD-4) o al menos foco inicial en *Cancelar*. **S**

### Información
- **MOD-29 · Ficha de detalle** (`DetailModal`, 718 líneas, 4 tipos) — tamaño `lg`; diseño en dos
  columnas (imagen | datos) cuando hay imagen; pestañas para variantes por región/sexo/época (hoy
  apiladas); comparador para objetos equipables (▲▼ por atributo); navegación *anterior/siguiente*
  y "atrás" entre fichas enlazadas; Escape (H6). **M**
- **MOD-30 · Detalle de recurso / parcela** (`RecursoDetalleModal`, `ParcelaDetailModal`) — mismo
  patrón de ficha; la parcela con su producción como barra de progreso hasta la siguiente cosecha. **S**
- **MOD-31 · Relaciones entre facciones** (`RelacionesFaccionesModal`) — hoy lista de pares con
  `presión/100`. Propuesta: **matriz** facción × facción con color por relación y, cuando haya más
  facciones, un grafo; la presión como barra con flecha de tendencia. **M**
- **MOD-32 · Visor de imagen / mapa ampliado** (`ImagePromptDisplay`, `MapZoomModal`) — zoom con
  rueda y arrastre, pantalla completa ya existe; añadir Escape unificado y miniatura de navegación. **S**

### Narrativos
- **MOD-33 · Modo dinámico** (`DynamicModeModal`) — opciones numeradas con teclas `1-3`; la imagen
  con leve paralaje/zoom lento (Ken Burns) mientras se espera; marcador de vueltas (`Vuelta 2 de ~4`
  si se conoce); Escape = *Salir* con confirmación (H6). **S**
- **MOD-34 · Editor de barras de habilidades** (`SkillBarEditor`) — tamaño `xl`, la barra real en
  grande arriba y las habilidades disponibles en rejilla filtrable debajo; asignar también con clic +
  número. **S**

---

## 7. Revisión panel por panel (`PAN`)

Contenedor común: `PanelDrawer` (cajón inferior, `max-w-4xl`, 85 vh).
- **PAN-1 · Cajón** — Escape para cerrar (H6); animación de salida; arrastrar el asa hacia abajo
  para cerrar; recordar la altura; navegar entre paneles con `Tab`/`Shift+Tab` o `Q`/`E` sin
  cerrar; **modo lateral opcional** (cajón desde la derecha que deja ver el registro) para monitores
  anchos. **M**

### Tu personaje
- **PAN-2 · Inventario** — búsqueda, filtros por tipo y orden (nombre, tipo, nivel, recientes) (H29);
  barra de capacidad con colores (hoy texto `text-amber-400`); **rareza/nivel visible** en el borde
  de la carta (`tier` ya existe); menú contextual con clic derecho (Usar, Equipar, Soltar, Ver
  ficha); arrastrar al equipo (`isCompatibleWithSlot` ya existe); vista lista/cuadrícula. **M**
- **PAN-3 · Equipo** — silueta del personaje con las ranuras alrededor (estilo hoja de personaje) en
  vez de rejilla; resaltado de ranuras compatibles al arrastrar; resumen de bonos totales; las 6
  ranuras de consumibles como "cinturón". **M**
- **PAN-4 · Estadísticas** — los 7 atributos como **rueda** (mismo orden que `ATTRIBUTE_RING` de
  `attributeWheel.ts`, con sus colores), para que se vea de un vistazo la rueda de ventajas; reparto
  de puntos con +/− y vista previa antes de confirmar; barra de XP con barra fantasma. **M**
  Nueva subpestaña **Historia** del panel Personaje: **etiquetas ganadas** (Cronista § 8.1) con el
  suceso que las otorgó, y la **biografía viva** del personaje escrita por el Cronista. **M**
- **PAN-5 · Habilidades** (465 líneas) — tarjetas con icono SVG, color del atributo, rol
  (ataque/defensa/utilidad) como forma; filtros por categoría; arrastrar directamente a la barra de
  habilidades y al cinturón de combate. **M**
- **PAN-6 · Compañeros** — tarjetas con retrato, salud, lealtad/felicidad como barra y grupo de
  combate; acceso directo a su equipo (MOD-23). **S**
  Con el Cronista (§ 8.2): **barra de aprobación** con sus **valores** (piedad, honor, codicia…)
  como iconos, las últimas reacciones ("Kaila desaprueba: dejaste morir al prisionero") y aviso
  visible cuando la aprobación cae a zona de abandono. **S**
- **PAN-7 · Reino** (5 secciones) — **análisis completo y propio en
  [roadmap-front-reino.md](roadmap-front-reino.md)**; lo de abajo es solo el resumen:
  - *Visión general*: los indicadores (`KINGDOM_STAT_LABEL`) como medidores con tendencia ▲▼ y
    sparkline de los últimos días, críticos parpadeando una vez. **M**
  - *Edificios y parcelas*: **plano del asentamiento** (cuadrícula de parcelas dibujada) además de la
    lista; construir arrastrando a una parcela. 🧭 **L**
  - *Producción*: cada cadena como fila con barra de progreso hasta el siguiente lote y entradas →
    salidas con iconos; los campos "sin tope"/"∞" con `QuantityStepper`. **M**
  - *Súbditos*: retratos/avatares por raza (`razaTheme`), filtros por rol. **S**
  - *Diplomacia y mercado*: relación con cada facción como barra centrada (de Guerra a Alianza) con
    la paleta por raza; mercado con precios y tendencia. **M**

### El mundo
- **PAN-8 · Mapa** (Zona + Mapa) — **el mapa de zona tiene análisis propio en
  [roadmap-front-zona.md](roadmap-front-zona.md)**; ver ATM-7 (niebla, ruta animada, zoom suave); leyenda unificada
  entre Zona y Berig; botón "centrar en mí". **M**
- **PAN-9 · Diario** — búsqueda en el texto, filtros por canal (personaje/mundo/reino), saltar a
  una fecha ficticia, capítulos por día con separador (NAR-3) y exportar la partida como relato
  (texto/HTML). **M**
- ~~**PAN-9b · Leyendas de tu partida**~~ ✅ 2026-10-05 (`CR-20`: panel «Leyendas» y fichas «En tu partida»; Cronista § 14) — Crónica (por días y semanas), Personajes,
  Facciones, Lugares y Línea temporal, **solo con lo que el personaje sabe**; cada entrada enlaza a
  sus sucesos y a la Enciclopedia; filtros por familia (clima, diplomacia, vida y muerte…). 🧭
  ¿Pestaña del Diario o pestaña propia en el riel "El mundo"? → **panel propio, icono de libro, junto
  al Diario** (`CR-18` Q5, 2026-10-05). **L**
- **PAN-10 · Misiones** — misión seguida fijada en la cabecera (HUD-7); objetivos como lista con
  casillas; recompensa visible con iconos; las cerradas plegadas. **S**
- **PAN-11 · Enciclopedia** (1.574 líneas, 15 pestañas) — las 15 pestañas en un **índice lateral**
  agrupado (Seres · Lugares · Sociedad · Sistemas) en lugar de una fila que no cabe; búsqueda global
  (hoy solo por nombre dentro de la pestaña); marcas de "nuevo" en entradas recién descubiertas;
  **línea temporal** visual para Historia (Era Común / Era de las Semillas); fichas en `DetailModal`
  ampliado (MOD-29). **L**
  Con el Cronista: sección **"En tu partida"** en cada ficha (biografía viva, sucesos conocidos,
  estado actual: muerto, líder, caída); **facciones y NPC nacidos en la partida** aparecen como
  fichas propias marcadas; nada que el personaje no sepa. **M**
- **PAN-12 · Reputación** — bandas como barra segmentada con la posición actual y el umbral
  siguiente; animación al subir/bajar ya existe (`hit-flash`), añadir el número que cambia. **S**
  Con el Cronista: facciones **caídas** atenuadas con su fecha, facciones **nuevas** marcadas, y
  etiquetas `AMIGO_DE`/`ENEMIGO_DE` junto a cada facción. **S**

### Barras y composer
- **PAN-13 · Composer** (`ChatComposer`) — `↑`/`↓` para recuperar acciones anteriores (H31);
  contador suave de longitud; botón de enviar con estado *enviando* animado; los chips de objeto y
  habilidad con su icono SVG. **S**
- **PAN-14 · Barra de habilidades** (`SkillBarHud`/`SkillBarMenu`) — teclas `1-9` con el número
  impreso en cada hueco (H16); hueco no disponible con motivo (energía, montura…) como sombreado y
  tooltip; animación al lanzar. **S**

---

## 8. HUD y dinamismo de partida (`HUD`)

- **HUD-1 · Barras con barra fantasma** — salud, energía, hambre y sed: el tramo perdido se queda
  medio segundo en claro y luego se vacía; solo `transform: scaleX`. **S**
- **HUD-2 · Números que cuentan** al cambiar energía, XP, Goirnos, reputación. **S**
- **HUD-3 · Umbrales críticos**: hambre/sed laten suavemente en zona crítica (reutiliza `pulse-slow`)
  y su icono cambia (plato vacío, gota seca). **S**
- **HUD-4 · Texto flotante** "+15 XP", "−1 energía", "+3 Hierro" que sube desde el elemento que
  cambia; componente `FloatingText` genérico. **M**
- **HUD-5 · Subida de nivel con ceremonia**: viñeta de cristal que recorre la pantalla una vez,
  insignia "Nivel 7" con `stamp-in`, gemas que se encienden con los puntos a repartir y botón directo
  a Estadísticas. **M**
- ~~**HUD-6 · Notificaciones (toasts)**~~ ✅ 2026-10-02 (parte del `0.2`): pila arriba a la derecha con `plank-panel` y borde por tipo
  (`quest` misión, `moss` logro/obtenido, `danger` peligro, `accent` sistema, `accent2` mundo vivo):
  misión aceptada/completada, objeto obtenido, expedición vuelta, cambio de relación entre facciones
  (enlaza con "El mundo vivo, visible" del hito `0.1`). Agrupa repetidas. **M**
  Con el Cronista: es el canal de los **sucesos que el personaje llega a saber** (rumores, caídas,
  guerras, nacimientos notables, consecuencias), filtrados por importancia (`CFG-35`); cada
  notificación abre su entrada en Leyendas. Tras un viaje o descanso de varios días, **una sola**
  notificación resumen ("Mientras viajabas: 3 sucesos") en vez de varias (`UX-31`).
  Hecho en el `0.2`: `lib/notificaciones.ts` (tipos con su borde, agrupar repetidas «×N», tope de
  4), `useNotificaciones` (se van solas a los 7 s) y `components/Notificaciones.tsx`. Avisan:
  misión aceptada/completada, cambio de reputación (verde o rojo), oficio que sube de nivel, objeto
  nuevo en el inventario (solo los que llegan con un turno, no los de la carga) y noticias del
  mundo (`useNoticiasMundo`, `onNuevas`). **Queda:** los sucesos del Cronista filtrados por
  importancia (`CFG-35`) que abren su entrada en Leyendas, y el resumen tras viajes largos
  (`UX-31`); objetos que llegan por `refreshSave` (recolectar, cazar) aún no avisan.
- **HUD-7 · Misión seguida** en la cabecera, con su objetivo actual en una línea. **S**
- **HUD-8 · Barra de "Ocupado"** (`busyUntil`): hoy una línea de texto con cuenta atrás; propuesta:
  barra de progreso real con el icono de la actividad y la hora ficticia de fin. **S**
- **HUD-9 · Reloj del mundo**: la fecha ficticia con un pequeño disco día/noche que gira según la
  hora, y estación/clima con iconos SVG. **S**
- **HUD-10 · Brújula** central que apunta al rumbo de la última salida y tiembla en zonas peligrosas
  (requiere BAS-2). **S**
- **HUD-11 · Cabecera adaptable a 1280 px**: hoy son 6-7 chips en fila que hacen `flex-wrap`; agrupar
  hambre/sed/energía en un bloque compacto con tooltip detallado. **S**
- ~~**HUD-12 · "El mundo avanza"**: indicador discreto (gema que respira junto a la fecha) mientras
  corre el avance diario o el Cronista en segundo plano; **nunca bloquea nada** (`UX-29`). **S**~~
  ✅ 2026-10-02: gema en `GameHeader` (`mundoAvanza`, con `role="status"`). Hoy la señal es la
  ambientación en curso (`worldThinking`); el avance diario corre dentro del turno en el backend.
  **Queda:** engancharla al Cronista en segundo plano cuando exista (`CR-12`).
- **HUD-13 · Etiqueta principal** del personaje bajo su nombre en la cabecera (la de más peso, p. ej.
  "Verdugo de Torgash"), con las demás en el tooltip. **S**

---

## 9. Narración y registros (`NAR`)

- **NAR-1 · Capitular** (inicial grande en Cinzel) en la primera entrada de cada escena o día. **S**
- **NAR-2 · Cursor de pluma** parpadeante mientras el narrador escribe en streaming. **S**
- **NAR-3 · Separadores de escena** con gema y hairlines al cambiar de zona, día o estación. **S**
- **NAR-4 · Retrato pequeño** junto al diálogo de un NPC si la enciclopedia tiene `thumbnail`. **S**
- **NAR-5 · "Ir al final"** flotante cuando el jugador ha subido y llega texto nuevo, con contador de
  entradas nuevas. **S**
- **NAR-6 · Ofertas en el registro** (misión, modo dinámico, recurso, caza): hoy tarjetas con colores
  distintos pero misma forma; darles forma de "carta" con sello del tipo, y que al aceptarlas se
  sellen en vez de desaparecer. **S**
- **NAR-7 · Espera del narrador**: la tarjeta "El Narrador escribe" ya tiene barrido de luz y frases
  rotatorias (`waitingFlavor.ts`); añadir tiempo transcurrido discreto y, pasados ~30 s, una frase
  de tranquilidad ("el narrador local está pensando…"). **S**
- **NAR-8 · Banners de entidad** (`entityBanner`): fundido y leve zoom al cargar, en lugar de aparecer
  de golpe (H10). **S**
- ~~**NAR-9 · Rumores en "El mundo"**~~ ✅ 2026-10-05 (`NoticiaMundo`: un rumor en estilo pergamino con «Desde <región> · pasó el día N» y «Ver en Leyendas»; el texto sigue siendo «Se dice que…», Q8) (Cronista § 9): entradas con estilo propio (pergamino, "Se dice
  en las Llanuras que…"), región y antigüedad del rumor, enlace a Leyendas. **S**
- **NAR-10 · Reacciones de compañeros** en el registro de personaje (Cronista § 8.2): línea breve con
  el retrato y el valor afectado, como el aviso de aprobación de Baldur's Gate 3. **S**
- **NAR-11 · Informe del amanecer**: al cambiar de día, una sola tarjeta plegable que junta la
  crónica del día del Cronista y el informe del Reino (`REI-100`), en vez de dos piezas separadas. **M**

---

## 10. Combate (`CMB`)

- **CMB-1 · Indicador de turno** claro: franja superior "Tu ataque" (madera cálida) / "Tu defensa"
  (azul, `plank-panel-defense` ya existe) con transición cruzada. **S**
- **CMB-2 · Ficha del rival con retrato a sangre** (banner a ancho completo con degradado y nombre
  encima) y su salud como barra grande. **S**
- **CMB-3 · Impacto**: sacudida corta de la tarjeta del rival al recibir un golpe y del HUD propio
  al recibirlo (desactivable, `CFG-22`); números flotantes sobre la tarjeta. **M**
- **CMB-4 · Viñeta roja** en los bordes de la pantalla en GRAVE/CONVALECIENTE. **S**
- **CMB-5 · Orden de turnos** en combate de grupo como fila de retratos (DAD, iniciativa de grupo). **M**
- **CMB-6 · Cinturón de habilidades** con color de atributo, rol por forma y probabilidad (DAD-13 🧭);
  hoy rejilla de 2 columnas de texto. **M**
- **CMB-7 · Pantalla de victoria/derrota** con resumen (daño hecho/recibido, botín, XP) antes de
  volver, y animación de "envainar" al cerrar el panel. **M**
- **CMB-8 · Aviso de combate pendiente** ("⚔️ Combatir / 🏃 Huir"): hoy dos botones en la franja
  inferior; darle presencia de encuentro (retrato del rival, dificultad como calavera 1-5). **S**
- **CMB-9 · Subir el tope de 4 combatientes por grupo** a 6 u 8 (usuaria, 2026-10-07): el límite de 4
  nace de los tiempos de narración; en la fase de pulido, al mejorar esos tiempos, se sube
  (`MAX_COMBATIENTES_POR_BANDO` y el tamaño de los grupos de combate). Hito `0.8`. **M**

---

## 11. Atmósfera y opciones gráficas (`ATM`)

Todo detrás de `CFG-11` y `CFG-21`.
- **ATM-1 · Ambiente por hora, estación y clima** — el backend ya envía `entorno`: capa fija y barata
  detrás de los paneles que cambia el tinte (amanecer cálido, noche azulada con `crystal-sky`,
  invierno desaturado) y partículas CSS según clima (lluvia, nieve, polvo rojo, niebla). Máximo ~30
  partículas, solo `transform`, pausadas sin foco. **M**
- **ATM-2 · Tema por región** 🧭 — Llanuras = `dust-road`, Cristal Helado = madera escarchada y
  acento frío, Ciénaga Troncal = madera húmeda con musgo, Meseta del Orden = `iron-etched`. Encaja
  con los hitos `0.4`–`0.6`; revisar contra `docs/rpgtarkor/`. **M**
- **ATM-3 · Cielo de cristal animado en el inicio** 🧭 — parpadeo muy lento de pocos cristales y
  paralaje leve con el ratón; hoy es estático por decisión explícita. **S**
- **ATM-4 · Pantalla de carga con lore** — ilustración o mapa, consejo o cita (`waitingFlavor.ts`
  como base) y barra con la gema, en lugar de "Cargando partida...". **S**
- **ATM-5 · Cursor temático** 🧭 — guantelete/pluma en SVG, con opción de cursor del sistema. **S**
- **ATM-6 · Transiciones entre pantallas** con *View Transitions* (fundido de madera, deslizamiento
  entre los 3 pasos previos). **S**
- **ATM-7 · Mapa** — niebla de guerra sobre zonas no visitadas que se disipa al descubrirlas; ruta
  animada durante un viaje; zoom y arrastre suavizados; marcadores SVG. **M**
- **ATM-8 · Viñeta y grano** suaves opcionales sobre la vista de partida para dar profundidad
  (imagen estática superpuesta, coste casi nulo). **S**

---

## 12. Pantallas fuera de la partida (`PRE`)

- **PRE-1 · Inicio** — título "Tarkor" como protagonista (hoy domina la pregunta "¿Cómo quieres
  jugar?"), fondo con el mapa de Berig (`helek-sirik-berig.png` ya existe) oscurecido, menú clásico
  *Continuar · Partidas · Configuración · Salir*; el enlace de admin solo en modo desarrollador. **M**
- **PRE-2 · Elegir mundo** — tarjeta con imagen a sangre y paralaje al pasar el ratón. **S**
- **PRE-3 · Elegir personaje** — retrato grande (sustituye la "G"), atributos como rueda en color
  (PAN-4), "Continuar" deshabilitado que se lea como tal. *Crear desde cero* (68 puntos) con
  reparto visual y vista previa de la rueda. **M**
- **PRE-4 · Partidas guardadas** — miniatura de la última zona, fecha ficticia, nivel, tiempo jugado,
  dificultad con icono; renombrar/borrar con animación; confirmación de borrado con el nombre
  escrito en lo irreversible. **M**
- **PRE-5 · Selector de dificultad** — tres tarjetas con calaveras y lo que implica cada una (hoy
  texto). **S**
- **PRE-6 · Pantalla de error** (`ErrorBoundary`) — botones *Volver al inicio* y *Copiar detalles*
  (versión + error) para reportar (H32). **S**
- **PRE-7 · Multijugador "próximamente"** — mantener, con la misma estética de tarjeta que el resto. **S**

---

## 13. Sonido (`SON`) **[P]** 🧭

La mayor ausencia "de videojuego" (H14). Todo empaquetado; volumen en `CFG-25`.
- **SON-1 · Gestor de audio** (`AudioContext` propio o `howler.js`, ~10 KB): canales, precarga
  perezosa, sin solapar el mismo sonido. **M**
- **SON-2 · Interfaz**: clic de madera/hierro, abrir/cerrar cajón, pasar página en el Diario. **S**
- **SON-3 · Dados**: rodar y aterrizar, distinto en crítico/pifia; sincronizado con `DiceTray`. **S**
- **SON-4 · Combate**: golpe, bloqueo, fallo, muerte; tambor grave al entrar. **S**
- **SON-5 · Ambiente** por región/clima/hora. **M**
- **SON-6 · Música** por estado (exploración, combate, reino, muerte) con fundido cruzado. **L**
- 🧭 Origen (librería libre con licencia compatible o generados) y si la música entra en `0.x` o en
  la Beta.

---

## 14. Calidad: cómo se verifica todo esto (`QA`)

- **QA-1 · Resoluciones de referencia**: 1280×800 (Steam Deck), 1366×768, 1920×1080, 2560×1440, y
  escala de interfaz al 80 % y 150 %. Nada se corta ni hace scroll horizontal.
- **QA-2 · Rendimiento**: 60 fps en la Steam Deck con el narrador generando; ninguna animación en
  bucle fuera de la vista; medir con el panel de rendimiento antes y después de ATM-1.
- **QA-3 · Movimiento reducido**: con `CFG-14 = Ninguna` y con `prefers-reduced-motion`, todo el juego
  sigue siendo usable y las tiradas muestran directamente el resultado.
- **QA-4 · Teclado y mando**: una partida completa sin ratón (guion del hito `0.1`).
- **QA-5 · Sin red**: arrancar sin conexión y comprobar fuentes e iconos (BAS-1, BAS-2).
- **QA-6 · Tests**: cada componente base (BAS-8, `ModalShell`, `DiceTray`) con tests de
  `@testing-library/react` como los que ya existen (`SelectionModalShell.test.tsx`,
  `DiceRoll.test.tsx`).
- **QA-7 · Capturas de referencia**: script de Playwright (Chromium ya está instalado en el entorno)
  que fotografía las pantallas principales para comparar antes/después de cada bloque.

Del `/retro` de la Fase D del `0.2` (2026-10-05, aceptadas todas por la usuaria; van al `0.2`):

- ~~**QA-8 · Tests que no ensucian el catálogo**~~ ✅ 2026-10-05 (`backend/vitest.bdReal.globalSetup.ts`; comprobado: progreso de los NPC idéntico antes y después de la suite): `globalSetup` del proyecto `bd-real` que guarda y
  restaura el progreso de oficio de los NPC (`NpcProfessionProgress`, compartido) y borra los
  interiores de prueba que dejan los tests de cuartel avanzado. Causa del «expected 2399 to be
  greater than 2399» que salió dos veces en la Fase D.
- ~~**QA-9 · Verificar al subagente ligero**~~ ✅ 2026-10-05: en `docs/runbooks/skills-y-modelos.md`, lo que reporta un
  Explore ligero se comprueba con un grep antes de llevarlo a una pregunta de diseño; y en
  `roadmap-cronista.md` § 13.1, el puntero a `avanceDiario.ts` como entrada de todo lo diario por partida.
- ~~**QA-10 · Arranque del entorno**~~ ✅ 2026-10-05 (`.claude/hooks/session-start.sh` + `.claude/settings.json`, solo en la nube; ~20 s con todo ya montado): hook de inicio de sesión que levanta Postgres (crea la base si
  falta, migra y siembra) y el Ollama simulado.
- ~~**QA-11 · Tests rápidos**~~ ✅ 2026-10-05 (`vitest run --changed` en backend y frontend: solo los tests que dependen de lo no confirmado; un cambio en `package.json` o en la config de vitest los lanza todos): `npm run test:rapido` (solo lo relacionado con los cambios) para iterar;
  la suite completa, antes de cada push.
- ~~**QA-12 · Intermitente de `ProduccionSection.test.tsx`**~~ ✅ 2026-10-05 (era un fallo real de `NumeroGuardable`: el efecto que copiaba `valor` al borrador corría también al montar y pisaba lo escrito antes de los efectos; ahora se ajusta en el render solo si `valor` cambia. Test de regresión determinista en `NumeroGuardable.test.tsx`; bucle de estrés 0/80 tras el arreglo, ~1/20 antes): diagnosticarlo con `diagnosing-bugs`
  (1 fallo en ~12 pasadas, 2026-10-05).

---

## 15. Lo que piden el Cronista, la zona y el Reino (`INT`)

Revisión cruzada (2026-10-01) con [roadmap-cronista.md](roadmap-cronista.md),
[roadmap-front-zona.md](roadmap-front-zona.md) y [roadmap-front-reino.md](roadmap-front-reino.md):
lo que esos documentos necesitan del diseño general y que este roadmap no tenía. Los cambios ya
están incorporados en sus secciones (`CFG-34`…`37`, `PAN-4`, `PAN-6`, `PAN-9b`, `PAN-11`,
`PAN-12`, `HUD-6`, `HUD-12`, `HUD-13`, `NAR-9`…`NAR-11`); aquí van las piezas transversales.

### 15.1 Lenguaje visual del mundo vivo
- ~~**INT-1 · Familias de sucesos con identidad propia**~~ ✅ 2026-10-05 (`FAMILIA_ESTILO` en `lib/leyendas.ts`; icono emoji como el de las noticias de UX-38 mientras `BAS-2` no tenga los de familia): un icono SVG (`BAS-2`) y un color de token por
  familia del Cronista — clima (`accent2`), natural (`moss`), vida y muerte (`wood-200` / `danger`
  para muertes), diplomacia (`quest`), facción (paleta por raza), economía (`cost`), Reino
  (`accent`), jugador (`accent`), lore (`wood-300`). Se usan igual en notificaciones, Leyendas,
  rumores y fichas. **S**
- ~~**INT-2 · Importancia visible**~~ ✅ 2026-10-05 (nivel NORMAL/DESTACADO/GRAVE desde el backend, borde y sello con `animate-stamp-in` en Leyendas): 1-4 sin marca, 5-7 con borde, 8-10 con sello de lacre y entrada
  con `stamp-in`; la importancia nunca se muestra como número al jugador. **S**
- ~~**INT-3 · Causas enlazadas**~~ ✅ 2026-10-05 (en Leyendas, botones «Por qué pasó» que llevan a la causa; en las fichas, la causa se nombra): en Leyendas y en las fichas, "por qué pasó" como cadena de sucesos
  clicables (Día 14 → Día 15 → …), estilo línea de tiempo; activable con `CFG-36`. **M**
- ~~**INT-4 · Lo desconocido se ve como desconocido**~~ ✅ 2026-10-05 (comprobado: Leyendas, fichas «En tu partida», «El mundo» y avisos solo reciben lo que está en `Conocimiento`; un rumor sale sin detalles; el Libro entero solo en `/admin/partida/:id/libro`, D-5; lo que recibe el narrador como sabido es de la Fase 6 del Cronista): un suceso del que solo se sabe una parte
  aparece como rumor ("se dice…"), y lo que el personaje no sabe **no existe en ninguna pantalla**
  (coherente con `UX-30`). **S**

### 15.2 Personas que recuerdan
- **INT-5 · Etiquetas como insignias**: mismo componente en la cabecera (`HUD-13`), en la ficha del
  personaje (`PAN-4`) y en la tarjeta de un NPC que reacciona a ellas ("Te reconoce: Verdugo de
  Torgash"). **S**
- **INT-6 · Recuerdo de un NPC**: en su ficha y en el modo dinámico, una línea "Recuerda: le
  perdonaste la vida (Día 9)". En el mapa de zona, anillo de *némesis* para un NPC con recuerdo muy
  negativo (ver `ZON-16`). **S**
- **INT-7 · Compañero que se va**: aviso tres días antes en Compañeros y en el registro; el abandono
  es una capa de *Decisión* (`UX-9`) con su despedida, nunca un borrado silencioso. **S**

### 15.3 Consecuencias en el mapa de zona
- **INT-8 · Fichas que vienen de una consecuencia** (Cronista § 7.2: un NPC perdonado que vuelve, un
  vengador): pictograma normal más un pequeño sello "te conoce"; al pasar el ratón, la tarjeta
  flotante (`ZON-40`) dice de qué suceso viene. **S**
- ~~**INT-9 · Rumor con lugar**~~ ✅ 2026-10-05 (`useRumoresDelMapa` y `rumoresConLugar`: pergamino 📜 en la región del mapa de Berig con rumores sin confirmar sin leer; pulsar la región enseña sus rumores en su tarjeta y los da por leídos; lo leído, en `localStorage` por partida): si un rumor menciona una zona conocida, el mapa de Berig marca la
  región con un icono de pergamino hasta que se lee. **S**

### 15.4 Reino y Cronista
- **INT-10 · Un solo informe diario** (`NAR-11`) que junta el informe del Reino (`REI-100`) y la
  crónica del día; los sucesos del Reino viven también en Leyendas, filtro "Reino". **S**
- **INT-11 · Facciones nuevas en Diplomacia** (`REI-70`): una facción escindida o fundada aparece con
  su paleta por raza, la marca "nueva" y el suceso que la creó. **S**

### 15.5 Epílogo
- **INT-12 · Epílogo de la partida** (`UX-18` + Cronista `CR-28`): pantalla de pergamino con el
  texto del Cronista, por secciones (el personaje, sus compañeros, cada facción, cada lugar), con
  la línea de tiempo de los sucesos de importancia ≥ 8 y botón *Exportar como relato*. **M**

---

## 16. Orden recomendado

> El hito en que entra cada bloque lo fija el [mapa de roadmaps](21-roadmap.md#qué-entra-en-cada-hito);
> esta tabla solo ordena prioridades dentro del front. Las piezas `INT` entran con la fase del
> Cronista que las genera (Fases 4-5 en `0.2`/`0.3`, epílogo en `0.4`).

| Orden | Bloque | Motivo |
|---|---|---|
| 1 | **DAD-1…6** (arreglos de tiradas) + **H17/CFG-33** (ocultar herramientas de admin) | Errores visibles hoy; encajan en el hito `0.1`. |
| 2 | **CFG-1…6, 7-9, 13-14, 20, 26, 28** + **BAS-1** | Lo pedido por Álvaro y las fuentes rotas. |
| 3 | **BAS-3, BAS-5, BAS-7, BAS-8, MOD-1…3** | Foco/mando, `GameView` troceado, salidas y componentes base: desbloquean casi todo. |
| 4 | **DAD-7…12** (`DiceTray`) | El momento que más se repite en una partida. |
| 5 | **HUD-1…6, CMB-1…4, NAR-1…5** | El dinamismo que más se nota jugando. |
| 6 | **MOD-10…34** (por grupos) y **PAN-1…14** | Pulido modal a modal y panel a panel. |
| 7 | **BAS-2, BAS-4, BAS-6, PRE-1…6** | Identidad (iconos, tokens) y pantallas previas. |
| 8 | **ATM** y resto de **CFG** | Atmósfera y opciones avanzadas. |
| 9 | **SON** + **CFG-25** | Sonido, cuando se decida su alcance. |
| — | **CFG-7/8 nativos** | Al montar el envoltorio Tauri. |

## 17. Decisiones pendientes 🧭

1. Resolución real solo con Tauri, o adelantar el envoltorio. (CFG-7)
2. Fuente de cuerpo y de narración. (BAS-1)
3. Iconos propios o set libre. (BAS-2)
4. Hook propio + View Transitions, o añadir `motion`. (BAS-7)
5. Mostrar probabilidad de éxito antes de actuar, y en qué dificultades. (DAD-13)
6. Dados cosméticos. (DAD-15)
7. Confirmación "mantener pulsado" para lo irreversible. (MOD-4)
8. Emblema/color del reino guardado al fundarlo. (MOD-27)
9. Plano visual del asentamiento. (PAN-7)
10. Colores por región contra canon. (ATM-2)
11. Animar el cielo de cristal pese a la decisión original. (ATM-3)
12. Cursor temático. (ATM-5)
13. Alcance y origen del sonido. (SON)
14. Dónde viven las Leyendas: pestaña propia del riel "El mundo" o dentro del Diario. (PAN-9b)
