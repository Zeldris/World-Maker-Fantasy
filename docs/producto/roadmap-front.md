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
13. [Sonido](#13-sonido-son-p-) — `SON`
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
- ~~**CFG-38 · Prompt de imagen editable**~~ ✅ 2026-10-24 (`promptUsado`/`promptUsadoAt` en `ImagePrompt`, rutas
  `GET /world/:slug/image-prompt` y `PUT …/usado`, caja «prompt usado» con Editar / Volver al base; probado en la
  enciclopedia real: editar, guardar, recargar y quitar) (usuaria, 2026-10-24; excepción a la puerta de pruebas aprobada por
  ella): en la caja de `ImagePromptSlot`, además del prompt base que genera la IA, un **prompt usado** editable
  —el exacto con el que se generó la imagen—. «Regenerar» solo cambia el base; el usado no se pierde nunca y es el
  que copia «Copiar». Campo nuevo en `ImagePrompt` (migración). Contexto:
  [reutilizable de imágenes](../arquitectura/reutilizables/01-generacion-imagenes-local.md). **S**
- ~~**CFG-39 · Generador de prompts de imagen con las reglas de FLUX**~~ ✅ 2026-10-24 (borrador estilo → sujeto →
  encuadre → luz → acabado → cierre; `finalizePrompt` quita medidas y deja el cierre una vez; fuera la lista negativa
  y `buildNegativePrompt`, que no usaba nadie; 11 tests. Probado con el LLM real y FLUX en la Deck: «like a worn wool
  sweater» le puso un jersey y «not like a goat's» lo hizo cabra, así que símiles solo de naturaleza, nada en
  negativo y tamaño sin cifras; `v8-cfg39-s7` ya da un múrgol masivo al ocaso. **Queda** el pelaje largo de `v5`:
  lo traen los prompts usados en `CFG-40`) (usuaria, 2026-10-24, tras el
  [banco del múrgol](../arquitectura/reutilizables/01-generacion-imagenes-local.md#banco-del-múrgol-2026-10-24-medido-en-la-deck)):
  `imagePromptGenerator.ts` escribe en lenguaje natural y en orden estilo → sujeto → pose → entorno → luz → acabado;
  sin px ni proporción en el texto, sin listas negativas ni comparaciones con el otro sexo; escena, hora y luz
  explícitas; cierre «No text, no signature, no watermark.». Tests que hacen cumplir cada regla. **S**
- ~~**CFG-40 · RAG del generador de prompts de imagen**~~ ✅ 2026-10-24 (`REGION_ESCENA` en
  `imagePromptGenerator.ts`: paisaje y luz en inglés de las 5 regiones núcleo, sacados de `docs/canon-opencode/regiones/`;
  el Margen, sin niebla, como dice el canon. La región sale como en la Enciclopedia: `harvestSourceRegion`, hogar del
  Npc y `lugarOrigen` del objeto, lo que arregla que toda la fauna dijera «de las Llanuras del Viento Rojo». Si el lore
  fija la hora, la luz sale de ahí. Hasta 2 prompts usados del mismo tipo (`ejemplosDePromptsUsados`) van como
  ejemplos, sin la instrucción de la imagen de referencia; regla nueva de traducir todo al inglés porque se colaban
  «cuernos» y «felino». Probado con el LLM real y en la Deck: `cfg40/cuernahoja-s7` en estepa roja con volcanes y
  ocaso. **Queda** ver cuánto aportan los ejemplos cuando haya más prompts usados; ahora solo está el del múrgol.
  **Leves de la revisión** (fase 1, 2026-10-24), para `CFG-42`: `finalizePrompt` no detecta una salida cortada de
  Ollama; el cierre solo se deduplica en su forma exacta; la regex de proporciones borra también horas (`6:00`); se
  quitó el bloque de seguridad (gore, desnudos) con CFG-39 por la regla de no nombrar lo que no se quiere, falta
  decidir si hace falta otro freno; la región toma el `lugarOrigen` solo del primer objeto, no del primero que lo
  tenga, como `regionFor`; el `PUT` del prompt usado (CFG-38) da 500 sin cuerpo o si la fila desaparece entre la
  lectura y la escritura, y no pide admin en el backend; `ImagePromptDisplay` no limpia el usado al cambiar de
  entidad sin `key`, no lo pide si llega por «Generar» sin `existingPrompt` y hace un `GET` por caja que la
  Enciclopedia podría traer ya)
  (usuaria, 2026-10-24): el contexto del canon (región, paisaje, luz) y los prompts usados (`CFG-38`) de la misma
  categoría como ejemplos para el LLM. **M**
- **CFG-41 · LoRA de estilo para las imágenes**: conjunto de imágenes ya generadas con sus prompts usados y prueba de
  entrenamiento en Colab, para no depender de la imagen de referencia. Antes, comprobar si una LoRA de klein base
  sirve en klein destilado y las condiciones de uso de las imágenes de origen. Tras `CFG-42`, que dirá qué estilo
  fijar. **M**
- **CFG-42 · Análisis de las pruebas de prompts de la usuaria** (usuaria, 2026-10-24): ella genera imágenes con sus
  prompts usados ([`probar.sh`](../../image-generator/scripts/probar.sh): `registro.tsv` y `notas.md` por elemento, en `generated/<tipo>/<slug>/`) y,
  cuando avisa, Claude en la Deck analiza los intentos (imágenes, prompts, notas) y propone mejoras al generador
  (`imagePromptGenerator.ts`, `REGION_ESCENA`) y a los parámetros. Pasos en el
  [README de image-generator](../../image-generator/README.md#probar-prompts-la-usuaria). **M**
  **Cómo se analiza** (`QA-223`): un subagente con el modelo grande lee `registro.tsv`, `notas.md`, los prompts y
  las imágenes, y devuelve por imagen qué funcionó y qué no, con su nombre; la principal mira solo las 2-3 imágenes
  que decidan cada propuesta (cada imagen pesa ~1.600 tokens y se arrastra el resto de la sesión).
- ~~**CFG-43 · Interfaz local del generador de imágenes**~~ ✅ 2026-10-24 (usuaria, 2026-10-24): `image-generator/abrir.sh`
  abre una página (`interfaz/servidor.py`, Python sin dependencias, solo en 127.0.0.1) donde se pega un prompt o se
  trae el usado o el base de una entidad, se genera con `probar.sh` (`PROMPT_ARCHIVO` para el pegado;
  `LIBERAR_OLLAMA=1` en `generar.sh` descarga los modelos de Ollama antes), se ve el paso del muestreo, se apunta la
  nota de cada imagen en `notas.md` y «Elegir esta» la copia con el nombre que busca el juego (a mano a
  `backend/uploads/images/`; dónde queda ahora, en «Por elemento»). Tests: `tools/qa/tests/test_interfaz_imagenes.py`.
  Pasos en el [README](../../image-generator/README.md#probar-prompts-la-usuaria). **S**
  Referencia (usuaria, 2026-10-24): `abrir.sh` copia las imágenes del juego a `referencias/images/` y, si la entidad
  tiene una, una casilla la usa (`-r`) y enseña la original. `sd-cli` corre con sus librerías (`LD_LIBRARY_PATH`).
  Tests: `test_interfaz_imagenes` (15).
  Por elemento (usuaria, 2026-10-24): todo va a `generated/<tipo>/<slug>/` (`intentos/`, `prompts/`, `logs/`,
  `registro.tsv`, `notas.md`, `elegidas.tsv`) y «Elegir esta» deja `<slug>-<perfil>.png` ahí mismo; sin tandas ni
  `salida/`. La página: lista de elementos por categoría con miniatura del juego, barra de progreso con tiempo
  estimado (mediana de los intentos anteriores) y galería con la imagen actual del juego y la elegida marcada.
  La lista trae toda la enciclopedia del backend del juego (`/world/<mundo>/enciclopedia`), con lo anidado
  (variantes por sexo, de raza y de día/estación, el mapa de `zona` de cada lugar y las habilidades de los `unlocks`)
  y las clases y especializaciones de `schema.prisma` (2.550 elementos el 2026-10-25), más los prompts de la BD, lo
  generado y las imágenes del juego. Tests: `test_interfaz_imagenes` (35). Lo siguiente del generador, en [roadmap-imagenes.md](roadmap-imagenes.md).

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
- **HUD-14 · Aviso al desbloquear algo en la Enciclopedia** (usuaria, 2026-10-13, P146 de `QA-27`):
  como el aviso de un objeto nuevo en el inventario, uno cuando se desbloquea una ficha nueva de la
  Enciclopedia, que lleve a ella. **S**

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
- **NAR-12 · El texto libre, para lo que tiene sentido** (usuaria, 2026-10-12, sale de P71 de `QA-27`): 🧭
  ronda de diseño pendiente. Equipar, curarse, comer y beber, viajar, recolectar o construir ya tienen
  su camino determinista, pero el cuadro de acción acepta cualquier cosa: «Me equipo la Maza orca» se
  narra y no cambia nada, y la jugadora cree que la lleva. El texto libre se centra en lo que solo él
  puede hacer, y lo que tiene botón o panel se lleva allí. Para la ronda de diseño:
  - **Para qué sí** (D&D 5e y Baldur's Gate 3: el máster interpreta lo que no cabe en un menú): hablar
    con quien está en escena, investigar o mirar, acciones creativas o de rol sin mecánica propia, y
    las intenciones que el motor ya traduce sin dudas (atacar en combate).
  - **Para qué no** (X4: todo lo que tiene sistema va por su menú; igual en Medieval Dynasty, Bellwright
    y Manor Lords): si el texto pide algo que tiene camino propio, no se narra como hecho; se responde
    con un aviso determinista y un botón que abre ese camino («Para equipar la Maza orca: Personaje →
    Equipo», con el botón).
  - Falta decidir: qué acciones se desvían, cómo se detectan (las reglas de intención que ya existen,
    sin modelo) y si el cuadro sugiere qué escribir. **M**

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
- **CMB-10 · Castigo por estado en porcentaje** (usuaria, 2026-10-11, sale de P10 de `QA-27`): hoy el
  estado resta una cantidad fija al atributo de la tirada (−2 herido, −5 grave, −10 convaleciente,
  `CONDICION_MALUS`, death.ts), que pesa mucho más a un personaje débil que a uno fuerte. Pasa a un
  porcentaje del atributo; propuesta: −20 % herido, −40 % grave, −60 % convaleciente (como X4, donde el
  daño del casco baja la velocidad en proporción, y Bellwright, donde las heridas recortan aguante y vida
  en proporción). Un rival convaleciente sigue pudiendo actuar y defenderse al rematarlo (decisión de la
  usuaria). Incluye el desglose de la tirada en pantalla («−2 heridas»), los tests de combate y las
  cifras en `cifras-provisionales.md`.

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

Del `/retro` de la Fase D del `0.3` (2026-10-07, PR #28 y #29; aceptadas todas por la usuaria; van al
`0.3`):

- ~~**QA-13 · Comprobación antes de subir**~~ ✅ 2026-10-07 (`.githooks/pre-push`, ~45 s; también corre la cobertura del roadmap): hook `pre-push` en `.githooks/` con `tsc` de backend y
  frontend y `oxlint`; el hook de inicio de sesión lo activa (`git config core.hooksPath .githooks`).
  Motivo: el paso 61a de `CR-61` se subió con un error de `tsc` y la CI solo corre en el PR.
- ~~**QA-14 · Cobertura del roadmap en la CI**~~ ✅ 2026-10-07 (job `roadmap` en `ci.yml`; `FANTASMAS_CONOCIDOS` en `cobertura.py`): un paso de la CI ejecuta `tools/roadmap/cobertura.py` y
  falla con «SIN HITO» distinto de 0 o con un identificador sin definir que no esté en la lista de los
  que ya había (hoy unos 20 `ZON-*`). Motivo: `CR-62` llegó tachada al mapa sin entrada en su roadmap.
- ~~**QA-15 · Variables de entorno en toda la sesión**~~ ✅ 2026-10-07 (se nota desde la próxima sesión): el hook de inicio escribe `DATABASE_URL`,
  `DIRECT_URL` y `OLLAMA_BASE_URL` en `$CLAUDE_ENV_FILE`. Motivo: cada `vitest` necesitaba un `export`
  a mano; sin él fallan 29 archivos.
- ~~**QA-16 · Guía de revisión**~~ ✅ 2026-10-07 (`REVIEW.md` con los puntos de las dos retros; test general en `crafting.test.ts`: frase de ejemplo por receta, y destapó que «Ahumo carne de jusha» también hacía `smokeMeat`, arreglado): `REVIEW.md` con lo que se repitió en las dos revisiones (10 hallazgos
  cada una): procesos de fondo que pueden quedarse a medias, decimales de recursos que se pierden al
  redondear y ticks de varios días con los datos del primero, entidades muertas o en combate que se
  pueden mover, reglas del roadmap, y la regla del ADR 0003 (cada mecánica de viajeros dice cómo la
  usan las facciones). Además, un test general de recetas: cada una con frases de ejemplo y cada frase
  dispara solo la suya (hoy solo las de cocina).
- ~~**QA-17 · Bitácora corta y avisos que faltan**~~ ✅ 2026-10-07 (bitácora de 37 000 a 16 000 caracteres; los avisos de Prisma, en sus comandos): la celda «Tarea en curso» de `traspaso.md` solo con
  la tarea actual y el siguiente paso (hoy ~5 500 caracteres con restos del `0.2`) y una línea en
  `CLAUDE.md` que la limite a 5 líneas; corregir el comentario de `Building.tier` en `schema.prisma`
  (también es el escalón de los edificios de oficio); en la receta de migraciones del runbook, que
  `prisma format` reformatea todo el esquema.

Del `/retro` de las fases pendientes (2026-10-07: `0.2` Fases E y G, `0.3` Fases A, B y C; aceptadas
todas por la usuaria; van al `0.3`). `QA-16` suma tres puntos: una escritura que puede ocurrir a la vez
va bajo el candado del avance o con un update condicionado; quien come o cobra se cuenta una sola vez;
lo que es por persona (recuerdos, aprobación, rencor) solo vale para NPC con nombre, nunca fauna ni
genéricos. Y además:

- ~~**QA-18 · Revisión sin tope de hallazgos**~~ ✅ 2026-10-07: en `docs/runbooks/skills-y-modelos.md`, el
  `/code-review` de cada PR a `main` va con `--max-findings all`. Motivo: cinco revisiones seguidas
  dieron justo 10 arreglos (la de la Fase E, 9); probablemente el tope por defecto.
- ~~**QA-19 · N días de golpe = N veces un día**~~ ✅ 2026-10-07 (`saltoDeDias.integration.test.ts`: `tickKingdom` y el tick del Reino en la base cruzando un cambio de estación; las medias de comida se reparten con `porcionDelDia`, sin restos, y el Reino calcula la comida de cada día con su estación y su reserva. Queda: el mismo test para `producirFacciones` cuando su azar se pueda fijar —hoy usa `Math.random` en el rebaño—): un test por cada proceso del avance diario que compare
  avanzar N días de una vez con avanzar N veces 1 día (misma semilla). Motivo: el salto de varios días
  falló en la Fase E (difundir tras el resumen), en la A del `0.3` (informantes), en la D (bajas) y en
  el PR #29 (estación y reserva del primer día).
- ~~**QA-20 · Retros que no se quedan atrás**~~ ✅ 2026-10-07 (las fases ya cerradas, marcadas «retro ✅» o «sin retro»): `cobertura.py` avisa de una fase ✅ de un
  `plan-roadmap-*.md` sin «retro ✅» en su celda, y la bitácora lleva una línea fija «Retros
  pendientes». Motivo: se acumularon cinco fases sin retro.

Retro del 2026-10-08 (`CR-63`, `CR-65`, `CR-50`, `CR-37`, `CR-67`; propuestas aprobadas por la usuaria):

- ~~**QA-21 · Los principios, donde se diseña**~~ ✅ 2026-10-08: en el paso 2 del runbook de skills,
  cada pregunta de una ronda pasa tres comprobaciones (de qué juego sale, ¿estado o temporizador?,
  ¿apaga o regula?) con el enlace a los principios 9 y 10 del Cronista. Motivo: tres correcciones de
  rumbo de la usuaria en una tanda (ronda sin juegos, «sin asaltos», «cada 7 días»).
- ~~**QA-22 · Reglas de revisión de lo que se escapó**~~ ✅ 2026-10-08: `REVIEW.md` con «Del Reino es
  `esDelReino`», «El tope cuenta al decidir», «Un GET solo lee» y «Listas del cuerpo»; helper
  `idsDelCuerpo` (`routes/saves/cuerpo.ts`) en lugar de las dos copias de `ids()`. Motivo: las tres
  revisiones (18, 13 y 11 hallazgos) repitieron esos cuatro tipos de error.
- ~~**QA-23 · Tiempo de Berig y regiones jugables**~~ ✅ 2026-10-08: entradas en `GLOSSARY.md` (año de
  120 días, unidad de cada fecha; solo Las Llanuras tiene caminos hasta el `0.4`) y línea fija en la
  bitácora. Motivo: un test falló por años de 365 días y otro esperaba campamentos fuera de Las Llanuras.
- ~~**QA-24 · Suite completa en segundo plano**~~ ✅ 2026-10-08: en el paso 3 del runbook, los tests de
  lo tocado en cada paso y la suite del backend (5-6 min) en segundo plano y aparte del push.
  Motivo: una suite encadenada al push pasó del límite de 10 minutos.
- ~~**QA-25 · Cifras provisionales en un sitio**~~ ✅ 2026-10-08:
  [`cifras-provisionales.md`](cifras-provisionales.md) con cada cifra, su valor y su constante; se
  apunta en el mismo commit que la cifra. Motivo: decenas de cifras provisionales repartidas.
- **QA-26 · Revisar las cifras provisionales jugando** (fase de pruebas del `0.8`): pasar por cada
  fila de [`cifras-provisionales.md`](cifras-provisionales.md), ajustar la cifra y borrar la fila.
- **QA-27 · Ronda de pruebas jugando** (`0.3`, pedida por la usuaria el 2026-10-09; pausa el roadmap):
  🚧 en curso. Jugar una partida como una jugadora normal en el navegador (Chromium con Playwright,
  Ollama simulado, viajes acortados), apuntar cada bug o incoherencia en
  [`pruebas-0.3-hallazgos.md`](../registros/pruebas-0.3-hallazgos.md) y arreglarlo con su test.
  Hecho (2026-10-09): P1 (zonas saturadas: 2-3 sueltos y grupos de hasta 6), P2 (fauna ambiental
  fuera del mapa, con Colmena de Lebude, Pared de arcilla y Fango de los Quios como recursos), P3
  (la tirada del encuentro cuenta el equipo), P4 (cancelar un viaje), P6 (salir por la salida en la
  que estás), P7 (entrar y salir de las zonas interiores) y P8 (avisos del mapa visibles); P5 no
  aplica (era el Ollama simulado).
  P43 y P44 (interiores de otras partidas: `Location.saveId`) arreglados; el resto de P9-P51,
  apuntados en el registro sin arreglar (la usuaria: solo lo que bloquee). 2026-10-10, los 11 más
  rápidos que eligió la usuaria: P13, P15, P21, P25, P28, P29, P31, P32 (el mapa no entraba en el
  inventario hasta recargar), P35 (y 41 notas internas más en el catálogo), P38 y P42. 2026-10-11
  (la otra cuenta, rama `claude/wonderful-volta-662qt8`, reparto de la usuaria): P9, P11, P12, P14,
  P17, P18, P19, P20, P24, P26, P33 y P51, y los nuevos que salieron jugando: P53 (intro con las
  Llanuras al este), P54 («Chaman»), P55 (en combate de grupo los demás ataques y los golpes gratis
  no salían en el diario) y P56 (dos tiradas para la misma acción). 2026-10-12: P36, P37, P39
  (beber de una fuente sin odre), P41, P45 y P46 (sin comprobar en vivo); P10 pasa a `CMB-10`, P30
  y P40 no aplican; P27 (aviso de riesgo también cuando te cortan el paso), la huida real de P12 (1v1), P47 (el aviso
  de interrupción nombra a quien sale al paso) y P50 (grupos de fauna repartidos); P23 y P48 no
  aplican (por diseño). 2026-10-12, segunda tanda jugando con Gorhorn, sin código salvo bloqueantes:
  P57-P82 apuntados. Comprobados en vivo P12, P17, P27, P33, P39, P50, P53 y P55. P71 pasa a `NAR-12`.
  Arreglado el único bloqueante, P82 (al reaparecer se podía morir en bucle hasta la muerte
  permanente). 🧭 P80 (Carisma 10 para fundar el Reino) espera a la usuaria. **Pausada por la
  usuaria el 2026-10-12.** Falta: P16 (sin reproducir), P49 (ilustración), los pendientes de
  P57-P81 y probar lo propio del `0.3` que no se llegó a jugar (Reino fundado, ganadería, defensa,
  compañeros, «Charlar con NPC», comercio).
  2026-10-12, tercera tanda (P83-P122, de las dos cuentas): P88 arreglado con la opción 2 de la
  usuaria en la zona de inicio; P32 arreglado otra vez (la recompensa de una misión cerrada en
  combate no llegaba a la pantalla). Partida nueva con Gorhorn Cazador: Gistera, el Orco Enfurecido
  y el viaje al Paso de los Pilares Rotos, donde Gorhorn muere atrapado por los Cruzavientos (🧭 P116,
  va con P88 y P89: decide la usuaria; también P109 y P121). Falta: los pendientes de P83-P121 y lo
  propio del `0.3` sin jugar.


Retro del 2026-10-09 (ronda de pruebas `QA-27`; propuestas aprobadas por la usuaria):

- ~~**QA-28 · CI sin Docker Hub**~~ ✅ 2026-10-10 (`ci.yml`: Postgres 16 del runner `ubuntu-24.04` con
  pgvector por apt): la imagen `pgvector/pgvector:pg16` de Docker Hub, sin cuenta, topaba con el límite
  de descargas y dejó el job en rojo sin ejecutar un test (PR #36). Comprobado: CI del PR #37 en verde.
- ~~**QA-29 · Base aparte para jugar**~~ ✅ 2026-10-10 (`tools/playwright-e2e/arrancar-juego.sh`, base
  `tarkor_juego`): los tests dejan partidas, Capitales y lugares en la base `tarkor`, y jugando se
  colaban (P43). Comprobado el 2026-10-10: arranca desde cero y reinicia (dos veces seguidas, un solo backend).
- ~~**QA-30 · Herramientas de pruebas compartidas**~~ ✅ 2026-10-10: los scripts de Playwright de la
  usuaria versionados (`tools/playwright-e2e/`, los de sesiones pasadas en `historico/`), `lib.mjs`
  común (`SAVE_ID` por entorno, Chromium de `/opt/pw-browsers` en la nube; `smoke.mjs` comprobado en
  la nube), `.mcp.json` con `playwright-mcp.sh` y el runbook
  [`rondas-de-pruebas.md`](../runbooks/rondas-de-pruebas.md) (jugar como una jugadora, apuntar todo,
  arreglar solo lo que bloquee). Queda: comprobar el MCP de Playwright en la próxima sesión.
- ~~**QA-31 · Lo de una partida lleva su `saveId`**~~ ✅ 2026-10-10: regla en `REVIEW.md` y test
  `locationConDuena.test.ts` (cada `location.create` del juego pasa `saveId`).
- ~~**QA-32 · Imágenes de zona con el slug de su lugar**~~ ✅ 2026-10-10 (`imagenesZona.test.ts`: falla
  con el archivo que no corresponde a ningún lugar y sugiere el parecido). Motivo: 11 de 21 imágenes
  subidas con otro nombre.
- ~~**QA-33 · Regiones sin artículo en la población**~~ ✅ 2026-10-10 (`repartoFacciones.ts` y
  `regionesSinArticulo.test.ts`). Motivo: P52. Las filas ya copiadas a partidas siguen con artículo;
  `moverPoblacion` las lee igual.

Retro del 2026-10-10 (aplicación de la anterior; propuestas aprobadas por la usuaria):

- ~~**QA-34 · Parar el backend por su PID**~~ ✅ 2026-10-10 (`arrancar-juego.sh`: `logs/backend.pid` y el
  puerto 3001, sin `pkill -f`, que casaba con la orden de quien lo lanzaba y la mataba).
- ~~**QA-35 · Nombres de imágenes en el push**~~ ✅ 2026-10-10 (`.githooks/pre-push`: si el push trae
  `backend/uploads/images/`, pasa `imagenesZona.test.ts`). Motivo: el test de `QA-32` solo corría en la CI.
- ~~**QA-36 · Decir adónde se ha subido**~~ ✅ 2026-10-10 (paso 5 de
  [`skills-y-modelos.md`](../runbooks/skills-y-modelos.md)): «en la rama de trabajo, no en `main`» o
  «en `main` (PR #N)».
- ~~**QA-37 · Reiniciar borra todo lo de la partida**~~ ✅ 2026-10-10 (bug real: Gistera cortaba el
  paso como hostil en una partida recién reiniciada, por el rencor de la anterior). El reinicio ya
  borra recuerdos, consecuencias, etiquetas, hilos, linajes, vasallajes, viajeros, caravanas,
  órdenes de comercio, expediciones, campamentos, grupos de combate, misiones ofrecidas, objetos
  tirados, capturas de maestro y límites de almacén. Test `reinicioCompleto.test.ts`: toda tabla con
  `saveId` se borra o tiene su motivo para quedarse. Pendiente: los `Npc` y `Location` propios de la
  partida (siguen tras reiniciar; hay que borrarlos sin romper referencias).

Retro del 2026-10-12 (hallazgos de `QA-27` en la rama `claude/wonderful-volta-662qt8`; las 6 aprobadas
por la usuaria):

- ~~**QA-38 · La base de los tests, al día sola**~~ ✅ 2026-10-12 (`backend/vitest.bdReal.globalSetup.ts`):
  antes de los tests con Postgres aplica las migraciones pendientes y, si cambiaron las fuentes del
  catálogo (`src/scripts/`, huella en `node_modules/.cache/`), vuelve a sembrarlo. En la CI no (ya lo
  hace el workflow). Motivo: al traer `main`, la base `tarkor` se quedaba sin una columna nueva y con
  el catálogo viejo, y los tests fallaban sin decir por qué.
- ~~**QA-39 · Todos los tests del frontend se ejecutan**~~ ✅ 2026-10-12 (`frontend/vitest.config.ts`:
  `src/**/*.test.{ts,tsx}`). Motivo: un test en `src/data/` no se ejecutaba y pasaba «en verde».
- ~~**QA-40 · Un dato, un sitio**~~ ✅ 2026-10-12: regla en `REVIEW.md` (mismo filtro en los dos
  caminos, sin copias entre backend y frontend, el filtro mira la consulta y no la página) y
  `/code-review` cada 5-6 hallazgos en el runbook de rondas. Motivo: 3 de los 10 fallos de la revisión.
- ~~**QA-41 · Jugar sin el MCP de Playwright**~~ ✅ 2026-10-12 (`tools/playwright-e2e/driver.mjs` y
  `orden.sh`, en su README): navegador abierto que recibe órdenes de JS, solo en `127.0.0.1`, y se para
  por su PID.
- ~~**QA-42 · Marcar hallazgos**~~ ✅ 2026-10-12 (`tools/qa/marca-hallazgo.py`, citado en el runbook):
  cambia el estado de una fila del registro y falla si no hay exactamente una.
- ~~**QA-43 · Índice de `turnResolution.ts`**~~ ✅ 2026-10-12: al principio del archivo, cada bloque de
  `narrateAndPersistTurn` con la clave para buscarlo.

Retro del 2026-10-12, segunda tanda de `QA-27` (jugando con Gorhorn; las 6 aprobadas por la usuaria):

- ~~**QA-44 · Qué se prueba, en qué orden**~~ ✅ 2026-10-12 ([runbook de rondas](../runbooks/rondas-de-pruebas.md)):
  primero lo arreglado que solo tiene tests, luego lo del hito en curso; lo que el roadmap no tiene, no.
  Motivo: la tanda empezó por «Crear desde cero» y por cazar escribiendo, y la usuaria tuvo que reconducirla.
- ~~**QA-45 · La ronda no escribe código**~~ ✅ 2026-10-12 (mismo runbook, paso 4): solo un fallo
  bloqueante; lo demás al registro, las mejoras al roadmap con hito, las retros fuera de la ronda.
- ~~**QA-46 · Ayudas para el MCP de Playwright**~~ ✅ 2026-10-12 (`tools/playwright-e2e/mcp/`: `estado.js`,
  `turno.js`, `mover.js`, `captura.js`): caben en los 60 s del MCP y devuelven el estado en texto; los
  parámetros van en `window.tk` (el MCP no guarda nada entre órdenes).
- ~~**QA-47 · Añadir hallazgos**~~ ✅ 2026-10-12 (`marca-hallazgo.py --nuevo "<hallazgo>" "<estado>"`):
  añade la fila con el siguiente número.
- ~~**QA-48 · Revisar tras una llamada interrumpida**~~ ✅ 2026-10-12 (`CLAUDE.md`): `git status` y
  `git diff` antes de repetirla. Motivo: `NAR-12` entró dos veces.
- ~~**QA-49 · Avisar si el juego no está levantado**~~ ✅ 2026-10-12 (`.claude/hooks/session-start.sh`):
  si existe `tarkor_juego` y el frontend no responde, el inicio de sesión lo dice y da la orden.

Retro del 2026-10-12, último tramo (P82, PR #44; las 4 aprobadas por la usuaria):

- ~~**QA-50 · Sin revisión no hay PR a `main`**~~ ✅ 2026-10-12: gancho de Claude Code
  (`.claude/hooks/revision-antes-de-main.sh`, en `.claude/settings.json`) que bloquea crear o fusionar
  un PR a `main` si la marca de `tools/qa/revisado.sh` no es del mismo commit, y la regla en `CLAUDE.md`.
  Motivo: el PR #43 entró sin `/code-review` y el #44 casi.
  Corregido 2026-10-12 tras el `/code-review` (con permiso de la usuaria): el gancho no estaba versionado
  (`.claude/` va en `.gitignore`; ahora con `git add -f`) y, al fusionar, mira la base y la cabeza del propio
  PR (`gh api`), no el HEAD local; si no puede consultarlo, bloquea.
- ~~**QA-51 · Lo hostil y la jugadora**~~ ✅ 2026-10-12 (`REVIEW.md`): colocar o mover algo hostil dice
  qué pasa junto a la jugadora y donde reaparece, con su test. Motivo: P50 causó P82.
- **QA-52 · Diagnosticar el intermitente de `avanceDiario`** (pendiente): «la economía avanza las copias
  de la partida con su reloj y deja quietas las del catálogo» falló una vez en la suite completa del
  backend (2026-10-12) y pasa suelto. Con `diagnosing-bugs`, como `QA-8` y `QA-12`. Mismo tipo, visto
  el 2026-10-12 (también sobre `main`): en `turn.integration.test.ts`, un hook de «OrdenProduccion» o de
  «Territory.control» supera a veces sus 10 s; cambia de test en cada pasada y pasan sueltos.
- ~~**QA-53 · El juego listo de verdad**~~ ✅ 2026-10-12 (`arrancar-juego.sh`): espera a que `/health` dé la
  base conectada y el frontend sirva, y si no, falla con dónde mirar. Motivo: tras reiniciar el
  contenedor, la partida salió «No se encuentra».

Retro del 2026-10-12, tercera tanda (P100-P122, rama `claude/frontend-improvements-roadmap-0mpckt`;
las 8 aprobadas por la usuaria):

- ~~**QA-54 · La recompensa de misión, por un solo camino**~~ ✅ 2026-10-12: `recompensasComoObjetosNuevos`
  (`questResolution.ts`); el turno y `aceptarQuest` (aceptar la misión y el guion de Gistera) mandan la
  recompensa en `newInventoryItems`, y el frontend la aplica sin recargar. Tests en
  `turn.integration.test.ts` (combate y misión que nace completada). Motivo: P32 volvió.
- ~~**QA-55 · Números de hallazgo sin choques**~~ ✅ 2026-10-12: `marca-hallazgo.py --nuevo` numera por
  encima de la copia local, `origin/main` y las ramas de las dos cuentas (`RAMAS`; `git fetch` antes).
- ~~**QA-56 · Con qué se juega**~~ ✅ 2026-10-12: «Con qué se juega» en `rondas-de-pruebas.md` (Gorhorn,
  Cazador, sin crear desde cero) y «Al jugar» en `CLAUDE.md`, que manda releer el runbook.
- ~~**QA-57 · El driver, con las ayudas del MCP**~~ ✅ 2026-10-12: `orden.sh --ayuda <archivo> '<tk>'`,
  navegador a 1280×720 (`lib.mjs`) y `mcp/interactuar.js`, `opcion.js` y `combate.js`, probadas en vivo.
  `mover.js` corregido: con el mapa ya abierto pulsaba la brújula tapada, y tomaba avisos viejos del diario.
- ~~**QA-58 · El test nuevo, en rojo sin el arreglo**~~ ✅ 2026-10-12: `tools/qa/rojo-sin-arreglo.sh`
  (aparta el arreglo, corre el test por su nombre exacto, exige rojo y luego verde).
- ~~**QA-59 · Textos que vuelven**~~ ✅ 2026-10-12: `comillasEnPantalla.test.tsx` (componentes y páginas)
  y «Textos que se leen» en `REVIEW.md`. De paso, P111 (etiquetas del combate con « ») y P102/P103 (el
  aviso del mapa enseña la frase del backend).
- ~~**QA-60 · Lo que escribe el Ollama simulado**~~ ✅ 2026-10-12: `estado.js` lo marca «[simulado]».
- ~~**QA-61 · «Actualiza con main»**~~ ✅ 2026-10-12: paso 5 de `skills-y-modelos.md`.

Retro del 2026-10-12, último tramo (implementación de `QA-54`…`QA-61` y PR #47; aprobadas por la
usuaria `QA-62`…`QA-65`; la quinta propuesta, regresiones en la ronda, no entra):

- ~~**QA-62 · Sin CI en verde no se fusiona**~~ ✅ 2026-10-12: el gancho de `QA-50` lee las comprobaciones
  del commit de cabeza del PR (`gh api …/check-runs`) y bloquea si alguna no ha terminado en verde;
  paso 6 de `skills-y-modelos.md` (suscribirse y fusionar con el verde) y regla en `CLAUDE.md`. Probado
  sobre el #47 con el backend aún corriendo. Motivo: el #47 se fusionó con el CI corriendo.
- ~~**QA-63 · Los tiempos límite de `turn.integration`**~~ ✅ 2026-10-14: los `afterEach` de los dos bloques llevan su propio límite de 60 s con el motivo (el salto de 7 días es lo que se prueba; acortarlo dejaría el test sin sentido). Comprobado con el bloque entero 3 veces seguidas: 13/13 cada vez. Diagnóstico de entonces: los hooks
  de «OrdenProduccion» y «Territory.control» pasan de 10 s (también en `main`). Diagnóstico del
  2026-10-12 con `diagnosing-bugs`: el `afterEach` hace `prisma.save.delete`, que
  `vitest.bdReal.setup.ts` envuelve para esperar a `esperarTodoElFondo()`; esos tests saltan 7 días,
  así que el borrado espera al avance diario en segundo plano (`avanzarSiCruzaDia`, lanzado tras
  responder el turno), que tarda 6-21 s. Medido: `prisma.save.delete` 6-21 s; el mismo borrado en SQL,
  10-30 ms (sin esperar al fondo, y con interbloqueo 40P01 si se borra mientras avanza). Borrar una
  partida vacía tarda 15 ms: no hay problema de índices. Falta decidir el arreglo: subir el tiempo
  límite de esos hooks (o de `bd-real`) con el motivo, o acortar el avance de 7 días en esos tests;
  luego, comprobar con el bloque entero en bucle (`-t "OrdenProduccion|Territory.control"`, 3 pasadas).
- ~~**QA-64 · Un fallo que vuelve: todos los caminos**~~ ✅ 2026-10-12: «Un fallo que vuelve» en
  `REVIEW.md`. Motivo: P32 volvió dos veces y la revisión del arreglo encontró cuatro caminos más.
- ~~**QA-65 · Parar el juego antes de la suite**~~ ✅ 2026-10-12: `arrancar-juego.sh --parar` (backend,
  frontend y driver) y paso 5 de `rondas-de-pruebas.md`.

Retro de la tercera tanda de `QA-27` (2026-10-12, PR #49;
[propuestas](../registros/retro-2026-10-12-qa27-tercera.md), aprobadas todas por la usuaria el 2026-10-13):

- ~~**QA-66 · El push dice qué sube**~~ ✅ 2026-10-13: `.githooks/pre-push` lista los commits que sube y
  que no están en ninguna rama remota conocida, y avisa si no sube ninguno. Motivo: una cadena `&&` cortada por `grep -c` (sale con 1 al contar
  0) dejó P115 sin commit, y el push vacío dijo «todo en verde».
- ~~**QA-67 · Sin `@default` en un campo obligatorio**~~ ✅ 2026-10-13: regla en «Un fallo que vuelve» de
  `REVIEW.md`; fuera `logEntryConHora.test.ts`, que ya cubre el compilador, y
  `esquemaCamposObligatorios.test.ts` falla si `LogEntry.fictionalMinutes` vuelve a tener `@default`. Motivo: P87, el test que leía
  el código no vio 7 creaciones que `tsc` sacó al quitar el `@default(0)`.
- ~~**QA-68 · Renombres en todos los campos**~~ ✅ 2026-10-13: `renombrarHabilidadesDePartida`
  (`habilidadesRenombradas.ts`, la llama `detail.ts`), con una función por campo de
  `CAMPOS_CON_NOMBRE_DE_HABILIDAD`: acciones guardadas, cinturón de combate, barras y usos por combate
  de `NpcState`. Los campos llevan en el esquema «Guarda nombres de habilidad (QA-68)» y el test exige
  que marcas y lista coincidan. Regla en «Cada partida, lo suyo» de `REVIEW.md`. Motivo: P100 no
  renombraba las barras de habilidades.
- ~~**QA-69 · Una fila «Tarea en curso» por rama**~~ ✅ 2026-10-13: la bitácora tiene una fila «Tarea en
  curso · `<rama>`» por cuenta; `tools/qa/bitacora.py` (en `pre-push`, sobre la bitácora del commit que
  se sube) exige la rama en el nombre, una sola fila por rama y 600 caracteres como mucho; `CLAUDE.md` lo dice. Motivo: las dos cuentas escribían en la misma celda y se
  contradecían.
- ~~**QA-70 · Test del orden del diario en un turno**~~ ✅ 2026-10-13: el orden de las líneas tras la
  narración del turno lo decide `lineasTrasElGolpe` (`intercambiosContraJugadora.ts`) y lo prueba su test:
  brújula, subida de nivel, desbloqueos de clase y de oficio, ataques recibidos con tirada y golpes gratis.
  `turnResolution` crea primero las habilidades nuevas y luego escribe las líneas en ese orden. Los
  ataques con tirada también pasan tras la subida de nivel y la brújula va al final. El frontend las
  pinta al momento en ese orden (`intercambiosExtra` de la respuesta, también la subida de nivel), así
  que se ve igual que tras recargar. Motivo: P117 se arregló dos veces y no tenía test.

Retro del PR #51 (documentos reutilizables, 2026-10-13), aprobada por la usuaria:

- ~~**QA-71 · Documentos con comandos comprobados**~~ ✅ 2026-10-13: criterios en el `README.md` de
  `docs/arquitectura/reutilizables/`: cada comando, comprobado o marcado «(sin verificar)»; cada
  afirmación sobre el proyecto, con su archivo y comprobada con `grep`; cómo comprobar archivos de
  modelos y etiquetas de Ollama. Motivo: 10 de los 15 hallazgos del `/code-review` del PR #51 eran
  comandos sin probar o datos de Tarkor sin mirar.
- ~~**QA-72 · Traer `main` al empezar y al fusionar**~~ ✅ 2026-10-13: paso 5 de «Al empezar cualquier
  sesión» en `CLAUDE.md` y nota en el paso 5 del runbook. Al empezar cada tarea y al fusionar cada PR, `git fetch` y
  `git merge origin/main` (merge, no rebase: las ramas están subidas). Si el conflicto toca la misma lógica
  por los dos lados o dos migraciones, se consulta a la usuaria. Motivo: el PR #50 de la otra cuenta
  no se vio hasta preparar el PR #51. Sustituye a las propuestas de avisar en el pre-push y en el
  inicio de sesión.
---

Retro del PR #50 (2026-10-13; [propuestas](../registros/retro-2026-10-13-pr50.md), aprobadas todas por la
usuaria el 2026-10-13):

- **QA-73 · Diario que el frontend escribe por su cuenta** (🚧 2026-10-13: hecho y con tests; jugado en
  una acción bloqueada, huir antes del combate (P131), Explorar fallido (P138) y, el 2026-10-14, huir
  durante un combate (contra Cruzavientos: tirada de Destreza con su dado y la entrada guardada). Falta
  la caza sigilosa fallida, que solo sale contra una presa 2 niveles por debajo: con Gorhorn a nivel 2 y
  la fauna más floja a nivel 1, no se puede provocar hasta nivel 3):
  - huir antes y durante el combate y la respuesta a una acción bloqueada devuelven la entrada guardada
    (`logEntry`) y el frontend la pinta tal cual; la huida de durante el combate se guarda ya como combate;
  - Explorar: la línea del dado lleva el id de la entrada guardada y, al caer el dado, se sustituye por
    ella con su tirada completa (igual que tras recargar);
  - fuera los respaldos muertos de Explorar fallido y caza sigilosa, porque el backend ya devuelve
    siempre su entrada (los tipos lo exigen);
  - `lineasLocalesDelDiario.test.ts` lista los prefijos de `id` que puede inventar el frontend
    (`<prefijo>-${Date.now()}` y `nextId(...)`: errores y la acción de la jugadora) y falla con uno nuevo;
  - regla en «Sin copias entre backend y frontend» de `REVIEW.md`.
  Motivo: P117 se veía mal en vivo por la línea «sube a nivel» del frontend.
- ~~**QA-74 · Tests de las herramientas de `tools/qa/` y del gancho**~~ ✅ 2026-10-13: `tools/qa/tests/`
  (`unittest`, 13 tests, sin dependencias) para `bitacora.py`, `marca-hallazgo.py` y
  `prepush-ramas.sh`, la parte del gancho que mira cada rama (sacada de `.githooks/pre-push` para poder
  probarla con repos de git de prueba; comprueba la bitácora de cada commit nuevo, no solo del último).
  Los corre el job `roadmap` de la CI. Motivo: 4 de los 11
  hallazgos del `/code-review` del #50 eran de esas herramientas.
- ~~**QA-75 · `/code-review` al cerrar cada tanda de 3 o más tareas**~~ ✅ 2026-10-13: paso 5 de
  `skills-y-modelos.md`. Motivo: las dos últimas tandas salieron con 11 y 12 fallos que solo vio la
  revisión final.
- ~~**QA-76 · `estado.js` con el nombre en los avisos**~~ ✅ 2026-10-13: los avisos se buscan elemento a
  elemento (párrafos, encabezados, listas) uniendo sus trozos con un espacio, así los chips de nombre
  quedan en su frase y «¡Victoria!» (en un `h3`) también sale. Motivo: «  te golpea…» sin quién,
  parecía un fallo del juego.

Retro del PR #53 y de los 12 arreglos de su `/code-review` (2026-10-13), aprobada por la usuaria (1-4 de 5):

- ~~**QA-77 · `/code-review` antes de crear el PR**~~ ✅ 2026-10-13: `CLAUDE.md` y los dos runbooks dicen
  «`/code-review` antes de crear el PR a `main`; `/retro` después de fusionarlo». Motivo: «al final, con
  el PR» se leyó como después de fusionar y los 12 fallos del #53 llegaron a `main`.
- ~~**QA-78 · Una regla nueva, en todos sus caminos**~~ ✅ 2026-10-13: regla en «Un dato, un sitio» de
  `REVIEW.md`. Motivo: 7 de los 12 fallos del #53 eran una regla aplicada solo en el camino que se jugó.
- ~~**QA-79 · Comprobaciones en las rutas de partida**~~ ✅ 2026-10-13: `comprobacionesDeRutas.test.ts`
  recorre las rutas `POST /saves/:id/...` y falla si alguna no rechaza la partida terminada y la muerte
  pendiente, salvo 8 excepciones con motivo. Arregla las 12 que no lo hacían (misiones, bandos,
  propuestas, grupos de combate, comercio, dejar a un compañero, menú del NPC, viajeros, huir) con
  `rechazarSiNoAdmiteAcciones` (`shared.ts`) o la comprobación que faltaba. Motivo: `/npc-interaction/abrir`.
- ~~**QA-80 · El test de `factionRelations` con la base local**~~ ✅ 2026-10-13: buscaba Serhu y Helsig
  con `findFirst` sin `saveId: null` y, con partidas en la base, cogía la copia de una partida: fijaba 65
  en esa copia y la ruta leía la del catálogo (70). Ahora pide las del catálogo. El código de
  producción ya busca por `id` o por `saveId`.

Retro del PR #54 (2026-10-13), aprobada por la usuaria (1 de 2):

- ~~**QA-81 · «Un dato, un sitio» antes del commit**~~ ✅ 2026-10-13: el paso 3 del runbook
  (`skills-y-modelos.md`) pide repasarla antes del commit de un arreglo. Motivo: 4 de los 12 hallazgos
  del `/code-review` del #54 eran reglas de `REVIEW.md` que solo se leen al revisar (una regla aplicada a
  medias en P137, P90 y P132, y una copia en el frontend de lo que decide el backend).

Retro del PR de la ronda `QA-27` del 2026-10-14 (P147-P187) y de los 8 arreglos de su `/code-review`,
aprobada por la usuaria (las 6):

- ~~**QA-82 · El catálogo de la base de juego, al día**~~ ✅ 2026-10-14: `arrancar-juego.sh` guarda una
  huella de `seed-catalog.ts` y todo lo que importa (`huella-catalogo.py`, en `logs/`) y vuelve a sembrar
  el catálogo cuando cambia (unos 7 s). Motivo: P174, la ronda probó P136 con el catálogo de antes del arreglo.
- ~~**QA-83 · El efecto secundario de un arreglo de la rama se arregla antes del PR**~~ ✅ 2026-10-14:
  paso 4 de `rondas-de-pruebas.md`. Motivo: P151 (de P123) se vio jugando y quedó «pendiente» hasta que
  lo cogió el `/code-review`.
- ~~**QA-84 · El resumen del registro de hallazgos sale de la tabla**~~ ✅ 2026-10-14:
  `marca-hallazgo.py` rehace el resumen de la cabecera al escribir; `--resumen` lo rehace y
  `--resumen --comprobar` lo mira en la CI. Motivo: las listas a mano se quedaron desfasadas (`/code-review`).
- ~~**QA-85 · Tarea tachada, tarea en la bitácora**~~ ✅ 2026-10-14: `bitacora.py --cerradas` (desde el
  pre-push, desde lo que ya tiene la rama remota) falla si una tarea pasa a tachada en un roadmap y no
  sale tachada en «Hecho recientemente»; no cuentan las movidas de hito («→»), lo nombrado dentro de un
  título ni lo ya cerrado en `main`.
  Motivo: `QA-63` cerrada en los roadmaps y «diagnosticado» en la bitácora.
- ~~**QA-86 · Capturas y datos de la partida en el runbook**~~ ✅ 2026-10-14: `shot('nombre')` y `psql`
  contra `tarkor_juego` en «Con qué se juega». Motivo: un envoltorio propio de capturas, una carpeta
  `shots/` suelta y seis scripts temporales de Prisma para consultar la partida.
- ~~**QA-87 · Moverse por el mapa de zona**~~ ✅ 2026-10-14: línea en el runbook; el viaje directo es de
  las monturas. Motivo: P164.

Retro antes del PR de los hallazgos de `QA-27` (tandas 1 y 2, 2026-10-15,
[registro](../registros/retro-2026-10-15-hallazgos-qa27.md)), aprobada por la usuaria (las 2):

- ~~**QA-88 · Los tests de lo que cambia, en el push**~~ ✅ 2026-10-15: `tools/qa/tests-relacionados.sh`
  desde `.githooks/pre-push` pasa `vitest related` sobre los archivos cambiados (backend, solo el proyecto
  `unit`; frontend, todo). Para la rama entera, cerca de un minuto. Motivo: P160 rompió 13 tests de
  `recolectar.test.ts` y se vio al pasar la suite completa; con el arreglo quitado, el script sale en rojo
  con esos 13.
- ~~**QA-89 · Lo que sale de una columna JSON se comprueba**~~ ✅ 2026-10-15: regla en `REVIEW.md` («Un
  dato, un sitio»). Motivo: `motivoNoEntregable` tumbaba `GET /saves` con `h.objeto!` (lo cogió el
  `/code-review`).
- ~~**QA-90 · Las plantillas que copian las partidas no se mueven sin pensarlo**~~ ✅ 2026-10-17 (retro del PR #60):
  `posicionesPlantillas.test.ts` (instantánea de la posición de cada RECURSO y EDIFICIO del catálogo) y regla en
  `REVIEW.md` («Un fallo que vuelve»). Motivo: mover el recinto de múrgoles lo duplicaba en las partidas viejas.
- ~~**QA-91 · Sin retro no hay marca de revisión**~~ ✅ 2026-10-17: `tools/qa/revisado.sh` exige una
  `docs/registros/retro-*.md` añadida en la rama con su `**Estado` decidido por la usuaria. Motivo: el PR #60 se
  creó con una retro corta y sin presentar.
- ~~**QA-92 · El resumen del registro de hallazgos lee el último estado**~~ ✅ 2026-10-17: en
  `marca-hallazgo.py`, «reabierto» solo cuenta sin un ✅ detrás, «en parte» vale con o sin paréntesis y
  `--comprobar` avisa de un estado contradictorio (tests en `tools/qa/tests/`). Motivo: P141, P164, P186 y P187
  salían en el grupo equivocado.
- ~~**QA-93 · Cómo sacar los muros de una zona**~~ ✅ 2026-10-17: `tools/zona/rejilla.sh` (cuadrícula con las
  etiquetas de casilla y los muros en rojo) y el apartado «Muros de una zona» de
  `docs/runbooks/nuevo-elemento-catalogo.md`, con puntero desde `murosZona.ts`.
- ~~**QA-94 · Un aviso de React hace fallar el test**~~ ✅ 2026-10-17 (retro de la ronda tras el PR #60):
  `frontend/src/test/avisosDeReact.ts` (`setupFiles`) falla el test con claves repetidas, props desconocidas o
  `act`; la suite no tenía ninguno. Con el arreglo de P197 y su test (opciones del menú sin repetir). Motivo: P197
  llegó a `main` con cinco avisos de React por render y la suite en verde.
- ~~**QA-95 · «Directamente a main» no quita la retro**~~ ✅ 2026-10-17: línea en `CLAUDE.md` («Ramas y `main`»).
  Motivo: el PR #61 se creó con una retro escrita para pasar la marca, sin presentarla.
- ~~**QA-96 · Ayudas de Playwright para cruzar zonas**~~ ✅ 2026-10-17: `mcp/viajar.js` (anda a una salida, pasa
  los encuentros tranquilos, confirma Viajar/Entrar/Salir y espera a llegar), `mcp/puntos.js` (puntos del mapa con
  sus coordenadas de pantalla) y `mover.js` con `textContent`. Comprobadas jugando (Pozo → Hondonada).
- ~~**QA-97 · Las consultas SQL de una ronda**~~ ✅ 2026-10-17: en `rondas-de-pruebas.md` («Capturas y datos de
  la partida»), comprobadas contra `tarkor_juego`.
- ~~**QA-98 · Tests de integración de lo que cambia, en el pre-push**~~ ✅ 2026-10-19 (retro de P189-P205):
  `tests-relacionados.sh` corre también, del proyecto `bd-real`, el `foo.integration.test.ts` de cada `foo.ts`
  cambiado y los tests de integración cambiados. Motivo: P196 rompió `ofertaNombre.integration.test.ts` y subió.
- ~~**QA-99 · La oferta del encuentro, en sus dos sitios**~~ ✅ 2026-10-19: comentario junto a cada construcción
  (`zona.ts` y `turnResolution.ts`) y regla en `REVIEW.md` («Un dato, un sitio»). Motivo: P190 y P193 quedaron
  en uno solo hasta el `/code-review`.
- ~~**QA-100 · El catálogo siembra el origen de los puntos de zona**~~ ✅ 2026-10-19: `datosDePlantillaZonePoint`
  (`scripts/plantillaZonePoint.ts`) con su test, y el test de partida comprueba que el clon copia los campos.
  Motivo: P189 (sin origen, ningún animal tenía territorio).

Proceso de pruebas (usuaria, 2026-10-19: menos tokens y cobertura de todo lo implementado):

- ~~**QA-101 · Matriz de cobertura de las pruebas**~~ ✅ 2026-10-19: `tools/qa/matriz-pruebas.py` y
  `docs/registros/matriz-pruebas.md`, una fila por tarea cerrada del `0.0` al `0.3` con bloque y estado (jugado,
  solo tests, sin jugar, no se juega); da «SIN JUGAR: N de M» por bloque y el pre-push exige la fila de cada tarea
  cerrada. Estado inicial clasificado a mano: 123 de 169 sin jugar (el núcleo del `0.1` no tiene ID y no cuenta).
- ~~**QA-102 · Escenarios preparados y avanzar días**~~ ✅ 2026-10-19: `tools/qa/escenario.sh` guarda la base de
  juego entera como instantánea (`tools/qa/escenarios/<nombre>.dump`, menos de 1 MB, con su línea en el README),
  la carga con las migraciones y el catálogo de ahora y avanza N días (`scripts/avanzarDias.ts`, el avance diario
  de siempre: 3 días en 3 s). Se llega jugando una vez y se guarda; las instantáneas las añade cada ronda.
- ~~**QA-103 · Recorridos que pasan o fallan**~~ ✅ 2026-10-19: `tools/playwright-e2e/recorrer.mjs` y
  `tools/qa/recorrer.sh` pasan los recorridos de `recorridos/` (cada uno con sus hallazgos y su escenario, que se
  carga una vez por grupo) y dan una línea por recorrido. El primero, P194 (en verde). Los demás los deja cada ronda.
- ~~**QA-104 · Estado en texto**~~ ✅ 2026-10-19: `mcp/estado.js` da en unas 10 líneas HUD, modales, la tarjeta
  del encuentro con sus botones, avisos, final del diario y combate; captura solo si algo no cuadra.
- ~~**QA-105 · Rondas por bloques**~~ ✅ 2026-10-19: «Una ronda, un bloque» en `rondas-de-pruebas.md`: qué falta
  (matriz), escenario, jugar en texto con recorridos, apuntar en el registro y en la matriz, y cerrar el bloque.
- ~~**QA-106 · Skill `opt-tokens`**~~ ✅ 2026-10-19 (usuaria): retro de gasto basada en `/retro` y en la guía oficial
  de costes de Claude Code. `.claude/skills/opt-tokens/medir.py` mide el uso real de la API de la sesión, el contexto
  medio por llamada y lo que cada herramienta y resultado arrastra; `SKILL.md` lista las palancas y el proceso
  (medir, buscar, proponer, aplicar lo aprobado); `proyecto.md` es lo propio de Tarkor (en otro proyecto se reescribe).
- ~~**QA-107 · Más comprobaciones en la CI**~~ ✅ 2026-10-19 (usuaria): esquema sin migración pendiente (`prisma migrate
  diff`), build del frontend (Vite), escenarios de pruebas que se restauran y aceptan las migraciones
  (`tools/qa/comprobar-escenarios.sh`), matriz de cobertura, bitácora (y tareas tachadas en un PR), enlaces de los
  `.md` (`tools/qa/enlaces-md.py`, 3 arreglados) y sintaxis de las herramientas. El nombrado de las imágenes ya estaba
  (`imagenesZona.test.ts`, en los tests del backend).
- ~~**QA-108 · Mapa del agente**~~ ✅ 2026-10-19 (usuaria): [`docs/mapa-agente.md`](../mapa-agente.md), por sistema
  (turno, zona y encuentros, combate, reino, súbditos, Cronista, caza, catálogo) las funciones de entrada como
  `` `ruta#función` ``, sus tests, tablas, cómo llegar en la interfaz y trampas conocidas, más «qué no leer» y los
  comandos. `tools/qa/mapa-agente.py` comprueba en la CI y el pre-push que cada referencia existe. Puntero en
  `CLAUDE.md` y en `docs/README.md`. Se mantiene al día en el mismo commit que cambia lo que nombra.
- ~~**QA-109 · Compactar antes**~~ ✅ 2026-10-19 (usuaria, `/opt-tokens` previo al PR): `CLAUDE_CODE_AUTO_COMPACT_WINDOW=300000`
  en el `env` de `.claude/settings.json`. La sesión crecía de ~76k a ~742k tokens entre compactaciones (media 428k por
  llamada); con el tope en 300k la media baja a ~190k, ~55 % menos de entrada por llamada.
- ~~**QA-110 · Sesión nueva tras cada PR fusionado**~~ ✅ 2026-10-19 (usuaria): al fusionar, Claude le recuerda a la
  usuaria `/clear` u otra sesión (runbook `skills-y-modelos.md`, paso 6); Claude no puede compactar por su cuenta.
- ~~**QA-111 · Curva de contexto en `medir.py`**~~ ✅ 2026-10-19 (usuaria): suelo y techo medios entre compactaciones y
  llamadas por tramo, para ver sin cálculos aparte si compensa compactar antes.

**Retro del PR del proceso de pruebas** (2026-10-19, [retro](../registros/retro-2026-10-19-proceso-pruebas.md);
aprobadas las cuatro por la usuaria):

- ~~**QA-112 · `.claude/` versionado sin `-f`**~~ ✅ 2026-10-19: `.gitignore` con `.claude/*` y excepciones para
  `settings.json`, `hooks/` y `skills/`; fuera el `.pyc` que subió el `-f`.
- ~~**QA-113 · Cada herramienta con su test**~~ ✅ 2026-10-19: tests de `mapa-agente.py`, `enlaces-md.py`,
  `matriz-pruebas.py` y `medir.py`, y `test_herramientas_con_test.py`, que falla si una herramienta nueva de
  `tools/qa` o de una skill llega sin el suyo (las que piden el juego o Postgres, en una lista con el porqué).
- ~~**QA-114 · `opt-tokens` mira primero la curva**~~ ✅ 2026-10-19: el paso 1 lee contexto medio y tramos antes de
  proponer y arregla `medir.py` si las cifras no cuadran; `proyecto.md` con las cifras buenas.
- ~~**QA-115 · Fecha de la bitácora al día**~~ ✅ 2026-10-19: `bitacora.py --fecha`; el pre-push falla si un commit
  que cambia la bitácora deja «Actualizado» con un día anterior.
- ~~**QA-116 · Compactar sin perder contexto**~~ ✅ 2026-10-19 (usuaria): `tools/qa/recuperar.py "<regex>"` busca en el
  registro de la sesión lo de antes de compactar (fragmentos recortados, sin resúmenes, subagentes ni búsquedas
  previas); `recuperar.py --estado` lo pone el gancho de `SessionStart` tras cada compactación (fila de la
  bitácora, `git status`, commits, compactaciones llevadas); presupuesto de 1 a 5 compactaciones por tarea en el
  `selector`, con los cortes al acabar cada sub-bloque.
- ~~**QA-117 · Planificar con el grande, escribir con el medio**~~ ✅ 2026-10-19 (usuaria): `medir.py` reparte la
  entrada por modelo (sesión principal y subagentes de `<sesión>/subagents/`); `opt-tokens` lo mira; el runbook
  `skills-y-modelos.md` manda la implementación con plan cerrado a un subagente `sonnet` y la revisión a la sesión
  principal. La sesión del 2026-10-19 llevó el 92 % de la entrada en Opus.
- ~~**QA-118 · Escalera de modelos y topes para subagentes**~~ ✅ 2026-10-19 (usuaria; ideas del workflow
  `implement-afk`): se empieza en el peldaño más barato y se sube uno por fallo, tope de dos fallos, un fallo al
  arrancar no cuenta, una tanda sin supervisión que no cierra nada para, y cada tarea nueva lleva su `modelo:` en
  el roadmap (`selector` y runbook `skills-y-modelos.md`).
- ~~**QA-119 · Registros de sesión de prueba con la forma real**~~ ✅ 2026-10-19 (retro, segunda vuelta, 5): un
  único constructor de líneas en `tools/qa/tests/comun.py` (`respuesta`, `orden`, `resultado`, `aviso`,
  `compactacion`, `ruido`, `registro`), copiado del formato real, para `test_medir.py`, `test_recuperar.py` y
  cualquier herramienta nueva que lea registros.
- ~~**QA-120 · Test de los ganchos de `.claude/settings.json`**~~ ✅ 2026-10-19 (retro, segunda vuelta, 6):
  `test_settings.py` exige `matcher` en cada `SessionStart`, solo `recuperar.py --estado` al compactar y que cada
  orden apunte a un archivo que existe.
- ~~**QA-121 · Sesión directora: skill `orchestrate-dealer`**~~ ✅ 2026-10-19 (usuaria: no depender de `/clear`):
  la principal parte la tarea y reparte cada trozo a un subagente de contexto limpio que devuelve 15 líneas; tope de
  compactación a 200k; el `selector` y el runbook (pasos 1 y 6) la piden en toda tarea de más de un paso. Sustituye
  la sesión nueva tras cada PR de `QA-110`. De `implement-spec` (Matt Pocock): encargos con punteros y
  frontera de arreglos en paralelo, cada uno en su worktree. Pendiente: medirla en el piloto (ronda del Reino) con `/opt-tokens`.
- ~~**QA-122 · Puntos de `/clear`**~~ ✅ 2026-10-19 (usuaria, tras la ronda del Reino con 30 compactaciones): Claude
  recomienda `/clear` en puntos estables (tarea o tanda cerrada, ronda o bloque de pruebas cerrado, PR fusionado,
  contexto por encima de ~200k o presupuesto de compactaciones gastado), con la sesión lista antes (commit, push y
  bitácora con el siguiente paso); nunca entre el `/code-review` y la `/retro`. Tope de compactación de vuelta a 300k
  y gancho de `SessionStart` para `clear` con `recuperar.py --estado`. Runbook `skills-y-modelos.md`, paso 1.

Del `/opt-tokens` y la `/retro` previos al PR de la ronda `QA-105` (usuaria, 2026-10-19: todo aprobado):

- ~~**QA-123 · Tope de compactación de vuelta a 200k**~~ ✅ 2026-10-19: con 300k el techo pasó de ~145k a ~220k y el
  medio por llamada, de ~115k a ~150k. `.claude/settings.json`, runbook `skills-y-modelos.md` paso 1,
  `orchestrate-dealer` y `selector`.
- ~~**QA-124 · Rondas en un subagente `sonnet`**~~ ✅ 2026-10-19: la ronda `QA-105` la jugó la principal con Opus
  (1.150 órdenes de Bash). `rondas-de-pruebas.md` («Quién juega») y la regla de rondas de `orchestrate-dealer`.
- ~~**QA-125 · Ayudas del driver que fallaban**~~ ✅ 2026-10-19: `interactuar` también pulsa el `menuitem` del menú
  del NPC del mapa; `opcion` elige por número la n-ésima `[data-opcion]` (el número va en un `span aria-hidden`
  y no entraba en el nombre del botón); `pelear` nuevo (acercarse, interactuar, «Combatir» y rondas). README de
  `mcp/`. Pendiente: estrenarlas en la próxima ronda.
- ~~**QA-126 · `/code-review` de cada arreglo de subagente antes de fusionarlo**~~ ✅ 2026-10-19: los arreglos de
  P215-P220a llegaron con 9 fallos que solo cazó la revisión del PR. `orchestrate-dealer` (Reglas) y, en el
  encargo, buscar a todos los que usan lo que se cambia.
- ~~**QA-127 · `medir.py` por tramo**~~ ✅ 2026-10-19: medio y techo de los últimos 8 tramos y medio sin el primer
  tramo a medias; el medio de 24 h mezclaba topes distintos. Test en `test_medir.py`.
- ~~**QA-128 · `orden.sh` guarda la respuesta**~~ ✅ 2026-10-19: entera en `tools/playwright-e2e/shots/ultima-respuesta.txt`
  (ignorado por git), 40 líneas en pantalla (`ORDEN_LINEAS`).
- ~~**QA-129 · Calidad primero en `opt-tokens`**~~ ✅ 2026-10-19 (usuaria): cada propuesta dice su riesgo para la
  calidad y su contrapeso; al medir un cambio aplicado se mira también lo que costó en calidad. `proyecto.md` al día.
- ~~**QA-130 · La `/retro` revisa las skills propias y el `/code-review`**~~ ✅ 2026-10-19 (usuaria): dónde fallaron
  o se quedaron cortas en lo revisado, y la mejora.
- ~~**QA-131 · Revisión de cada rama de subagente en el paso 3 de `orchestrate-dealer`**~~ ✅ 2026-10-20 (usuaria): en la
  tanda P223-P237 se fusionaron 8 ramas sin la revisión de `QA-126` (estaba solo en «Reglas») y el `/code-review` final
  encontró 17 hallazgos. La hace un subagente revisor antes de fusionar.
- ~~**QA-132 · Los subagentes en paralelo no tocan los registros compartidos**~~ ✅ 2026-10-20 (usuaria): los hallazgos
  vuelven en `HALLADO` y los apunta la principal, como la bitácora; `pruebas-0.3-hallazgos.md` chocaba al fusionar.
- ~~**QA-133 · Campo `HERRAMIENTAS:` en la vuelta del subagente**~~ ✅ 2026-10-20 (usuaria): los fallos del driver van a
  `rondas-de-pruebas.md`; apuntados ya `turno.js` con cajón abierto y el driver que muere al reiniciar `escenario.sh`.
- ~~**QA-134 · `medir.py --desde <fecha|commit>`**~~ ✅ 2026-10-20 (usuaria): medir una tarea y no la ventana de 24 h, que
  mezclaba la ronda anterior.
- ~~**QA-135 · `tools/qa/fusionar.sh`**~~ ✅ 2026-10-20 (usuaria): fusiona la rama del subagente, resuelve el registro de
  hallazgos, pasa los tests del paquete tocado y avisa si falta la revisión; la principal hacía 44 órdenes de git.
- ~~**QA-136 · Cada sesión, su propia rama**~~ ✅ 2026-10-20 (usuaria): regla en `CLAUDE.md` («Ramas y `main`»). La
  sesión local y la de la nube subían a la misma rama y se reescribían la fila de la bitácora.
- ~~**QA-137 · La revisión corta mira el contrato**~~ ✅ 2026-10-20 (usuaria, retro del PR de `opt-ai`): el revisor de
  cada rama compara con el doc del contrato y los llamadores reales (`orchestrate-dealer`, paso 3); test
  `tools/qa/tests/test_opt_ai_tareas.py` (tareas de `opt-ai/proyecto.md` frente al backend) y los tests de `opt-ai` en la CI.
- ~~**QA-138 · El mapa, tras fusionar la rama**~~ ✅ 2026-10-20 (usuaria): lo que nombra archivos de un worktree se escribe
  después de fusionarlo (`orchestrate-dealer`, «Reglas»); antes, el pre-push rechazaba las rutas.
- ~~**QA-139 · Commit WIP del subagente en worktree**~~ ✅ 2026-10-20 (usuaria): commit en cada punto estable; un reinicio
  perdió dos subagentes sin commit.
- **QA-140 · Lanzar Claude desde el repo** 🚧 en curso (lote 1, retro de pruebas-local §1 y `/opt-tokens`):
  `Desarrollos/CLAUDE.md` de una línea («lanza `claude` desde `World-Maker-Fantasy/`») y la misma nota en el runbook de
  rondas. Hecho 2026-10-20: la nota (paso 0 de «Cómo se juega»). **Falta** `Desarrollos/CLAUDE.md`, fuera del repo: lo
  crea la sesión local en la Deck.
- ~~**QA-141 · `arrancar-juego.sh` comprueba el entorno de la IA**~~ ✅ 2026-10-20 (§2 y `/opt-tokens`, GPU): con
  `IA_PERFIL`, `IA_REGISTRO` a ruta absoluta; en `deck`, error si el registro de Ollama (solo lo escrito tras arrancar)
  o `/api/ps` dicen CPU; `rag-eval` para el arranque (rc 1 → `reindex-lore`). Funciones en
  `tools/playwright-e2e/ia-comprobaciones.sh`, test `test_ia_comprobaciones.py`; paso 1 del runbook con la ruta absoluta.
- ~~**QA-142 · `/opt-ai` en el flujo del PR**~~ ✅ 2026-10-20 (§3): `skills-y-modelos.md` paso 6 (fuente única), `CLAUDE.md` y el punto 7
  del runbook apuntan ahí; fila en la tabla de reparto de `orchestrate-dealer`.
- ~~**QA-143 · Permiso de `escenario.sh` y escenario del Reino con recursos**~~ ✅ 2026-10-20 (§4): regla `allow` en
  `.claude/settings.json` (también por `host.sh`, confirmada por la usuaria); el runbook ya no pide permiso; escenario
  `reino-dia39-recursos` (Granero, comida 180, bolsa 300 y tesoro 251 Goirnos, materiales en inventario y Almacén) y
  `escenario.sh dar-reino` (`darReino.ts`: comida, bebida, Goirnos, tesoro, Almacén y `edificio:<receta>`). El Pozo
  sigue DANADO y soldados y trabajadores en 0: se asignan jugando.
- ~~**QA-144 · Gancho contra los borradores en commits**~~ ✅ 2026-10-20 (§5): `.githooks/pre-commit` con `CLAUDECODE=1`
  rechaza altas, cambios, borrados y renombrados de `docs/borradores-opencode/`; no actúa al cerrar merge, cherry-pick
  o rebase. Test `test_pre_commit.py`.
- ~~**QA-145 · `bitacora.py` contra filas ajenas**~~ ✅ 2026-10-20 (§6): `bitacora.py --ajenas <commit> <rama>`; el
  pre-push lo pasa a cada commit (no merge) que toca la bitácora. Libres: «Actualizado» y «Tests»; el resto de filas
  compartidas, con `BITACORA_COMPARTIDA=1 git push` (p. ej. añadir una rama a «Ramas de trabajo»).
- ~~**QA-146 · `medir.py` por subagente**~~ ✅ 2026-10-20 (§7 y `/opt-tokens`): sección «POR SUBAGENTE» (llamadas,
  contexto medio, entrada y salida) y totales con subagentes; la salida se contaba de menos por tomar el valor provisional
  del streaming (ahora el máximo por respuesta). Casos en `tools/qa/tests/test_medir.py`.
- ~~**QA-147 · Tandas de juego en llamadas**~~ ✅ 2026-10-20 (§7 y `/opt-tokens`): `orchestrate-dealer` paso 1, tanda de ~60 llamadas con
  traspaso por escenario guardado.
- ~~**QA-148 · `opt-ai`: lo que ya hay y tanda válida**~~ ✅ 2026-10-20 (§7): `proyecto.md` apunta «prefijo fijo primero» y el paso 0
  descarta la tanda que no corrió con la configuración del perfil.
- ~~**QA-149 · Capturas más pequeñas**~~ ✅ 2026-10-20 (`/opt-tokens`): `shot()` del driver y `mcp/captura.js` salen en
  JPEG calidad 50 (4,4 veces menos bytes), con `selector`, `clip`, `calidad` y `completo:true` (PNG de página entera).
- ~~**QA-150 · `tools/qa/host.sh` y `sql.sh`**~~ ✅ 2026-10-20 (`/opt-tokens`, tests `test_host.py` y `test_sql.py`): envoltorios para el sandbox Flatpak de la Deck
- ~~**QA-151 · Reglas del juego en los scripts que escriben la partida**~~ ✅ 2026-10-20 (retro del lote 1): `orchestrate-dealer` pide en el encargo y en la revisión de cada rama que lo que escribe estado de la partida pase por las funciones del juego que aplican esas reglas (`darReino.ts` las rehacía a mano).
- ~~**QA-152 · `fusionar.sh` borra la rama y el worktree del subagente**~~ ✅ 2026-10-20 (retro del lote 1, `test_fusionar.py`): tras fusionar y con los tests en verde, `git worktree remove` sin forzar y `git branch -d`; nunca la rama actual, `main` ni `claude/*`.
- ~~**QA-153 · `escenario.sh probar <nombre> <orden…>`**~~ ✅ 2026-10-20 (retro del lote 1, `test_escenario.py`): restaura la instantánea en una base temporal, corre la orden contra ella y la borra al salir; probado con `dar-reino` sobre `reino-dia39-recursos`.
- ~~**QA-154 · `medir.py` da el arranque de cada subagente**~~ ✅ 2026-10-20 (retro del lote 1, `test_medir.py`): columna «arranque» (contexto de la primera llamada) y «Arranque medio»; el paso 1 de `opt-tokens` lo usa para ver qué encargos no compensan un subagente.
  (`flatpak-spawn --host --directory=<repo>`, SQL por stdin) que fuera de la Deck corren la orden tal cual.

Propuestas de `/opt-ai` (primera medida en la Deck, 2026-10-20, aprobadas por la usuaria; [informe](../ia/opt-ai-registro.md)).
Cada una se mide con `benchmark-turno` antes y después (perfil `deck`, `IA_REGISTRO` en las dos) y la medida va al
informe; si empeora la calidad o no mejora, se revierte y se apunta. Objetivo por turno: primera palabra p50 ≤ 30 s,
turno p50 ≤ 45 s y p95 ≤ 75 s. Rama `claude/opt-ai-mejoras`.
- ~~**QA-160 · Captura remota apagada en las tandas** (propuesta 9): `arrancar-juego.sh` la apaga y el servidor avisa al
  arrancar si está encendida.~~ ✅ 2026-10-20: hecho; sin A/B (mandaría turnos fuera), comprobado en `backend.log`.
- ~~**QA-161 · `keep_alive` 1h en `resumen`** (propuesta 3): el resumen usa el narrador y le bajaba la residencia a 5 min.~~
  ✅ 2026-10-20: `resumen` y el calentamiento con 1h; medido en `02`, sin recarga tras el `resumen`.
- ~~**QA-162 · Registro y `medir.py` por turno** (propuesta 6): `app.intento`, `app.rechazo`, id de turno y `num_ctx`
  efectivo; p50/p95 por turno, sin fallidos en p50 y tok/s; los casos de la ronda (P251, P263, P272) en `rag-casos.jsonl`.~~
  ✅ 2026-10-20: hecho (`app.turno`, `app.intento`, `app.evento`/`app.rechazo`, `num_ctx` de `/api/ps`, tabla TURNOS);
  `rag-eval` con los casos nuevos: recall@4 0,750.
- ~~**QA-163 · Menos intentos 2 de `narrar`** (propuesta 1): `num_predict` del intento 1 y los rechazos más frecuentes.~~
  ✅ 2026-10-20: `combateIniciado` solo con agresores en el `format` y `num_predict` 300 en el intento 1; respaldo 14 % → 0 %,
  intento 2 sigue en 29 % (2.ª persona, equipo) y la latencia no cambia.
- ~~**QA-164 · Recortar la parte variable del prompt** (propuesta 2), empezando por los repetidos de la memoria (P247).~~
  ✅ 2026-10-20: estado de la partida y narración anterior tras los hechos estables; turno p50 61 → 38 s, primera palabra
  45 → 23 s. Fuera: los repetidos de la memoria (P247), poco coste al ir al final del prefijo.
- ~~**QA-165 · `lengthGuidance` tras el bloque fijo** (propuesta 7): no perder la caché al entrar en combate.~~
  ✅ 2026-10-20: va junto a la acción; entrar en combate pasa de 50,4 s a 1,4 s de prefill (reproducción), turno p50 33 s.
- ~~**QA-166 · Contexto del respaldo** (propuesta 4): los respaldos se recortaban a 4096.~~
  ✅ 2026-10-20: prompt recortado del intento 2 y `num_ctx` 8192; ya narra la acción (15,5 s en la reproducción).
- ~~**QA-167 · Escalera del RAG** (propuesta 5) con los casos de la ronda.~~
  ✅ 2026-10-20: peldaño 1, trozos de ~400 caracteres por título; recall@4 0,750 → 0,875. Queda fuera la pregunta doble
  de P272 (peldaño 2, híbrida).
- ~~**QA-168 · `keep_alive` de `clasificar`, experimento** (propuesta 8).~~
  ✅ 2026-10-20: `'5m'`; caben los tres modelos (≥1,8 GB libres), `clasificar` p50 6,9 → 2,8 s, turno p50 28,7 s.

Retro del PR de `claude/opt-ai-mejoras` ([retro](../registros/retro-2026-10-20-opt-ai-mejoras.md), aprobadas por la
usuaria el 2026-10-20), con las tres de `/opt-tokens`.
- ~~**QA-169 · `/code-review low` de cada propuesta de `opt-ai` antes de su commit**: el bench mide tiempo, no fallos.~~ ✅ 2026-10-20: (`opt-ai` paso 4): al aplicar cada tarea, `/code-review low` de su diff antes del commit y del bench de después. La usuaria propuso mover el `/code-review` del PR tras `/opt-tokens` y `/opt-ai`; se quedó esta, porque los cuatro fallos venían de las propias tareas de `opt-ai`, que ya iban antes de esa revisión.
- ~~**QA-170 · `keep_alive` y `num_ctx` alineados en todas las llamadas a un modelo** (`opt-ai`, `motores.md`).~~ ✅ 2026-10-20: nota en `motores.md` (Ollama) y en el paso 3: buscar todas las llamadas al modelo y alinearlas con una constante como `CTX_CRONISTA`.
- ~~**QA-171 · `tools/roadmap/cerrar.py`**: cerrar una tarea en su roadmap, en el mapa y en la bitácora en una orden.~~ ✅ 2026-10-20: `cerrar.py QA-n "nota" … --bitacora` (`test_cerrar.py`): tacha en el roadmap (también en varias líneas) y en el mapa (los rangos, cuando quedan cerrados enteros) y abre «Hecho recientemente» con las 10 últimas; con él se cerraron estas.
- ~~**QA-172 · «Prompt del narrador» en `mapa-agente.md`**: bloques, intentos y modelo/`num_ctx`/`keep_alive` por tarea.~~ ✅ 2026-10-20: sección en `docs/mapa-agente.md` con el orden de bloques de `buildNarrationPrompt`, los intentos 1/2/3 y la tabla de modelo, `num_ctx` y `keep_alive` por tarea; `mapa-agente.py` en verde.
- ~~**QA-173 · `tools/qa/bench-ia.sh` versionado**: restaurar, reindexar, jugar, muestrear RAM y `medir.py` en una orden.~~ ✅ 2026-10-20: `bench-ia.sh <etiqueta> [--anterior <etiqueta>] [--turnos N]` y el escenario `ia-gorhorn-dia42` (la partida de las pasadas `01`…`10`); probado con la pasada `10-bench-ia` (turno p50 34,9 s, en objetivo). Se lanza solo por `host.sh` en la Deck.
- ~~**QA-174 · `.prettierrc.json` del backend con comillas simples**: que un archivo reescrito no cambie de estilo.~~ ✅ 2026-10-20: `singleQuote`, `trailingComma: all`, `printWidth` 120; sin reformatear lo que ya hay.
- ~~**QA-175 · `POR ARCHIVO` en `medir.py` de `opt-tokens`**: lecturas y arrastre por archivo.~~ ✅ 2026-10-20: sección `POR ARCHIVO` (Read y Bash con orden de lectura; rutas relativas a otra carpeta, resueltas por `git ls-files`), con su test en `test_medir.py`. En esta sesión, `narrador.ts`: 61 lecturas, 1,6M arrastrados.

Skill `scout-updates` (usuaria, 2026-10-20: el narrador sale lento y malo en la ronda local; [diseño](../ia/skill-scout-updates.md)).
- **QA-176 · Skill `scout-updates`**: inventario del proyecto en `arquitectura.md`, propuestas acumuladas en `propuestas.md`, búsqueda citada y banco de calidad por pares; genérica, bajo demanda. Pedida por la usuaria durante la congelación del roadmap: cuenta como mejora del entorno, como las de las retros (confirmado el 2026-10-20).
  🚧 2026-10-20: retro aplicada (manifiestos difíciles con salida esperada, `contrastar.py --seccion`, búsqueda en `sonnet`, salida de subagentes en `medir.py`); diseño, evaluaciones (`evals/`, con un proyecto de ejemplo no Tarkor), `inventario.py`, `contrastar.py` y `banco.py`, `SKILL.md`, referencias y captura de prompts (`IA_CASOS`) hechos; `docs/scout/` escrito (arquitectura con las restricciones confirmadas: memoria no mayor que el narrador actual, solo local, español, licencias, gratuito primero; propuestas sembradas con las comparativas de la decisión 14; rúbrica del narrador). Primera pasada completa hecha ([informe](../scout/informes/2026-10-20.md), propuestas P-005 a P-021). Validada el mismo día: tabla de cobertura (`contrastar.py --informe`), correcciones a P-014, P-015, P-017, P-018 y P-019, y sección `Planificados` (imágenes, voces, agente local, instalador) en la arquitectura; sin buscar aún Supabase, pgvector, SteamOS ni los planificados. Después: el generador de lore de OpenCode (`opencode.json`, `modelfiles/`) entra en la arquitectura e `inventario.py` lee `*.Modelfile` y `opencode.json`; borrados los Modelfiles descartados (`Modelfile`, `.fast`, `.nemo`, `.celeste`, `.qwen3cronista` y los `modelfiles/` sin uso; la captura DPO lee `Modelfile.llama31`, mismo SYSTEM). Decisiones de la usuaria (2026-10-20): la Deck es el mínimo (versión «plus» con modelos grandes, más adelante); planificados, en la Deck sin swap con Tarkor parado; P-005 a P-021 aceptadas (sus tareas, al volver al roadmap); el banco del narrador con P-005, P-006 y P-007 se hace en una sesión local en la Deck; fine-tune descartado (`Modelfile.finetuned` borrado). Banco del narrador hecho en la Deck el 2026-10-21 ([informe](../scout/informes/2026-10-21.md)): gana el actual llama31 (0,727) a gemma4:e2b, qwen3.5:4b y gemma3:4b; la usuaria rechaza P-005 a P-007, y P-007 se reabre si gemma4 queda dentro del ruido tras arreglar el prompt. Falta: búsqueda de los planificados, si la usuaria da el coste.

Retro del PR de `claude/banco-narrador` ([retro](../registros/retro-2026-10-21-banco-narrador.md), aprobadas todas por la usuaria el 2026-10-21):
- ~~**QA-177 · `banco.py resumen --detalle`**: cara a cara, puntos por caso y motivos de las derrotas con el conteo de la tasa.~~ ✅ 2026-10-21: `--detalle` en `banco.py` (las claves `cara_a_cara`, `por_caso` y `derrotas` van siempre en `--json`), con su test en `test_banco.py`; `banco-calidad.md` dice que todas las cifras del informe salen de ahí.
- ~~**QA-178 · Regla de decisión del banco**: adoptar, dentro del ruido o rechazar, y cuándo se reabre.~~ ✅ 2026-10-21: sección «Decisión» en `banco-calidad.md`: gana por más de ~0,15, adoptar; dentro del ruido, deciden memoria y latencia; pierde por más, rechazar, y se reabre si queda dentro del ruido tras el cambio que lo motive.
- ~~**QA-179 · `medir.py` de `opt-tokens` sin contar ejecuciones como lecturas**: `bash tools/qa/host.sh …` contaba como leer `host.sh` (23 veces en la sesión del banco).~~ ✅ 2026-10-21: ✅ 2026-10-21: `medir.py` no cuenta como lectura una ruta que va justo detrás de `bash`, `sh`, `python3`, `node` o con `./` (en esta sesión, `host.sh` baja de 23 a 5 lecturas, las de verdad); su caso en `test_medir.py`.
- ~~**QA-180 · Pre-push y `host.sh` en el sandbox**: el pre-push se relanza por `host.sh` en el sandbox (el `git push` fallaba sin avisar) y `host.sh` filtra los avisos de `bash -i` en español y el ruido de `nvm`/`npmrc`.~~ ✅ 2026-10-21: ✅ 2026-10-21: el pre-push se relanza entero por `host.sh` en el sandbox Flatpak (con la entrada de git y `BITACORA_COMPARTIDA`/`BITACORA_PY`); `host.sh` filtra los avisos de `bash -i` en español y las tres líneas de `nvm`/`npmrc`, línea exacta (un error de npm parecido pasa), con su test en `test_host.py`. Dos tests de `test_host.py` (fuera del sandbox) fallan si se corren dentro del sandbox; en el host, todos en verde.
- **QA-181 · Herramientas del driver que obligan a rodeos**: `estado.js` (panel «Tu personaje» del combate y narración entera), `viajar.js` (esperar la llegada), `turno.js` en combate y aviso cuando la caja de texto está desactivada (mapa de zona, escena). La usuaria aprueba dejarla para la próxima sesión de arreglos.
- ~~**QA-182 · Aviso de tarea 🚧 sin tocar en el roadmap**: `bitacora.py` (pre-push) avisa, sin bloquear, si los commits de la rama nombran una tarea en curso y su línea del roadmap no cambia contra `main`.~~ ✅ 2026-10-21: ✅ 2026-10-21: `bitacora.py --en-curso <base> <sha>` avisa, sin fallar, de cada tarea 🚧 que nombran los commits (sin merges) y cuya entrada del roadmap (con sus líneas de continuación) no cambia; lo corre `prepush-ramas.sh` en cada push. Tests en `test_bitacora.py`.
- ~~**QA-183 · El PR a `main` en tres fases**: código (`/code-review` y arreglos), entorno (`/opt-ai`, `/opt-tokens`, `/retro` y lo aprobado) y cierre (`/code-review` solo de lo que añadió la retro, `revisado.sh`, `pr`).~~ ✅ 2026-10-21 (usuaria): en `CLAUDE.md` y en el paso 6 de `skills-y-modelos.md`, fuente única del orden.
- ~~**QA-184 · El PR de una sesión local lo crea Claude en la nube**: en la Deck no hay `gh` ni herramienta de GitHub y el modo auto no deja usar la credencial de git.~~ ✅ 2026-10-21 (usuaria): la local sube la descripción a `docs/registros/pr/<rama>.md` y deja «PR listo» en su fila de la bitácora; la nube comprueba el último commit, pasa `revisado.sh` y crea el PR (`CLAUDE.md`, paso 6 de `skills-y-modelos.md`).
- ~~**QA-185 · Aviso de un hallazgo contado como pendiente sin decirlo**: `marca-hallazgo.py --resumen --comprobar` (CI) falla si una fila cae en «Pendientes» y su estado no empieza (tras negritas o emoji) por «pendiente(s)» o «abierto», ni la reabrió un «reabierto».~~ ✅ 2026-10-21 (retro del PR de la línea): `raro()` y tests en `test_marca_hallazgo.py`; el mismo PR ya cuenta «arreglado» sin ✅ y «Jugado ✓» (P215 y P218 salían como decisiones).
- ~~**QA-186 · La fila de la rama al fusionar su PR**: las filas de los PR #68, #69 y #70 seguían diciendo «fusionar».~~ ✅ 2026-10-21 (retro del PR de la línea): el último commit antes del PR deja la fila como «al fusionarse, rama terminada» (paso 6 de `skills-y-modelos.md`).
- ~~**QA-187 · `/clear` tras fusionar sin `orchestrate-dealer`**: una sesión en la nube encadenó 3 PR con 25 compactaciones.~~ ✅ 2026-10-21 (retro del PR de la línea): si la sesión ya compactó, se propone `/clear` al fusionar; paso 6 de `skills-y-modelos.md` y `opt-tokens/proyecto.md`.

Retro previa al PR de `claude/puerta-pruebas` (aprobadas por la usuaria el 2026-10-21; 188-190, 192 y 194 se aplican ya; 191 y 193 son arreglos de la puerta de pruebas, paso 3.4 de la línea):
- ~~**QA-188 · Herramientas de la Deck a git**: los atajos de `logs/shim/` (ignorado) no los tenía la otra cuenta.~~ ✅ 2026-10-21: `tools/qa/deck/` (envoltorios `psql`/`pg_dump`/`pg_restore`, `esc.sh`, `j.sh`, `o.sh`, `lanza.sh`, `relanza.sh`, `ronda.sh`, `r.sh`, `panel.sh`, `txt.sh`, `est.sh` con la partida como argumento, README); `escenario.sh` los antepone al PATH si no hay `psql`; `rondas-de-pruebas.md` apunta a las rutas nuevas. No se suben `lanza.out`, `sub.sh`, `sub2.sh` ni `t.sh` (un solo uso).
- ~~**QA-189 · Tandas de juego más cortas y sin capturas de más**: las tandas 6 y 7 hicieron 87 y 99 llamadas (tope 60) y 15-19 capturas jpg, ~95 % de su contexto.~~ ✅ 2026-10-21: `orchestrate-dealer` pide 6-8 hallazgos por tanda y «captura solo si el hallazgo es visual» en la plantilla; apuntado en `opt-tokens/proyecto.md`.
- ~~**QA-190 · Revisión corta también sin worktree**: el `/code-review` previo al PR halló 11 fallos, casi todos del subagente de escenarios, que trabajó sin worktree.~~ ✅ 2026-10-21: paso 3 de `orchestrate-dealer`.
- **QA-191 · Rehacer `reino-combate-capitan` con un solo capitán** (hoy salen 3 rivales «Muy difícil» y Gorhorn muere en 3 rondas) y la regla, en `tools/qa/escenarios/README.md` y `construir.sh`, de que un escenario nuevo se cierra solo tras jugar una vez lo que promete.
- ~~**QA-192 · El lanzador de la Deck pone `IA_PERFIL` e `IA_REGISTRO`**: `/opt-ai` no tuvo registro de las tandas con Ollama real.~~ ✅ 2026-10-21: `tools/qa/deck/juego.sh` arranca `arrancar-juego.sh` con `IA_PERFIL=deck` e `IA_REGISTRO=<raíz>/logs/ia/<fecha>.jsonl` absoluto salvo que ya vengan puestas.
- **QA-193 · Vía de QA para forzar el azar en `prepararReino`**: activa solo con una variable de entorno de QA; fuerza el próximo suceso (ganar o empatar la iniciativa, emboscada de fauna, interrupción de viaje) para comprobar P29, P69, P90, P46 y P47.
- ~~**QA-194 · La bitácora por su fila en la principal**: 12 lecturas de `traspaso.md`, ~419k tokens arrastrados.~~ ✅ 2026-10-21: `opt-tokens/proyecto.md` manda `python3 tools/qa/recuperar.py --estado` (da la fila, commits y compactaciones) y apunta lo de las capturas.

Retro previa al PR de `claude/pruebas-3.3` (aprobadas por la usuaria el 2026-10-22, [retro](../registros/retro-2026-10-22-pruebas-3-3.md); 195, 197, 198 y 200 se aplican ya; 196 y 199 son del paso 3.4 de la línea):
- ~~**QA-195 · Aviso de «reabierto» o «falta ver» que cuenta como hecho**: los subagentes escriben lo nuevo delante del estado viejo (P116 y P189 del 3.3).~~ ✅ 2026-10-22: `marca-hallazgo.py --resumen --comprobar` (CI) falla si un estado con «reabierto», o con «falta ver/comprobar» y contado como comprobado, cae en arreglado o comprobado; test en `test_marca_hallazgo.py`.
- **QA-196 · Chuleta del driver en lugar de notas por tanda**: «Fallos de las herramientas» del runbook crece ~12 líneas por PR y cada tanda la lee entera (35k); rehacerla como chuleta por herramienta y borrar lo resuelto. Paso 3.4, junto a `QA-193`. 🚧 en parte 2026-10-22 (`QA-208`): el historial pasó a `docs/registros/fallos-herramientas.md` y el runbook tiene «Trucos de las herramientas» con los vigentes; falta ordenarlos por herramienta y depurar duplicados del registro.
- ~~**QA-197 · `escenario.sh` en una orden sola**: el modo auto denegó `dar` en la tanda 13b-1 por ir encadenado con `o.sh pulsar`.~~ ✅ 2026-10-22: regla en `rondas-de-pruebas.md` (en una orden Bash sola; la usuaria lo autoriza para preparar la partida) y nota de la 13b-1 corregida. La regla `allow` ya existía.
- ~~**QA-198 · Test de los atajos de la Deck**: `juego.sh` llegó sin `_path.sh` al PR.~~ ✅ 2026-10-22: `tools/qa/tests/test_atajos_deck.py` exige que todo `tools/qa/deck/*.sh` que lleve a `psql`, `pg_dump`, `pg_restore` o `arrancar-juego.sh` (directo o por otro atajo) cargue `_path.sh`; en rojo sin esa línea en `juego.sh`.
- **QA-199 · Partidas intermedias de una tanda fuera de git**: el PR subió 5 `.dump` de ~900 KB; que `escenario.sh guardar` deje las intermedias en `logs/` (ignorado) y solo suba a `tools/qa/escenarios/` lo guardado con `--subir`. Paso 3.4.
- ~~**QA-200 · Una tanda con Ollama real juega al menos 8 turnos**: con 3 turnos `/opt-ai` no tiene medida comparable.~~ ✅ 2026-10-22: regla 8 de `rondas-de-pruebas.md`; si no llega, `bash tools/qa/bench-ia.sh` al cerrar.

`/opt-tokens` y retro previos al PR de `claude/frontend-improvements-roadmap-0mpckt` (aprobadas por la usuaria el 2026-10-22; 201-204 se aplican ya; 205-207 son del paso 3.4 de la línea):
- ~~**QA-201 · Arreglos de una revisión con `sonnet`**: los tres agentes de arreglos del code-review fueron con `opus`, 7,4 M de entrada cada uno.~~ ✅ 2026-10-22: paso 2 de `orchestrate-dealer`; el revisor sigue en `opus`.
- ~~**QA-202 · La principal hace el arreglo de un archivo**: un subagente arranca con ~52k y hace 70-80 llamadas; la principal cerró dos arreglos en ~10.~~ ✅ 2026-10-22: paso 1 de `orchestrate-dealer`.
- ~~**QA-203 · Antes del PR, solo lo grave**: cada arreglo del code-review previo al PR traía más hallazgos y se acumularon los cambios.~~ ✅ 2026-10-22: regla de `orchestrate-dealer`; lo leve, a la fila compartida de la bitácora.
- ~~**QA-204 · El encargo comprueba la rama de partida**: varios worktrees de agentes salieron de `main`.~~ ✅ 2026-10-22: primera línea del encargo de `orchestrate-dealer`.
- **QA-205 · Aislar el test intermitente de cronista** (`decisionesFaccion`/`deudaDeVida`): pasa solo y falla a veces en la suite completa, seguramente por la base compartida; puede poner el CI en rojo sin motivo. Paso 3.4.
- **QA-206 · `fusionar.sh` desde la raíz**: si se lanza dentro del worktree que borra acaba con error de `getcwd` (aunque fusiona), y con el agente vivo no borra el worktree sin decir por qué; que trabaje desde la raíz y avise del bloqueo. Paso 3.4.
- **QA-207 · `medir.py`, contexto de toda la sesión**: con `--horas 0` da 382k de contexto medio frente a ~110k de los 8 tramos que enseña; que lo cuadre o diga «últimos 8». Paso 3.4.

`/opt-tokens` y retro previos al PR de `claude/pruebas-reino` (aprobadas por la usuaria el 2026-10-22 y aplicadas en la rama):
- ~~**QA-208 · Fallos de las herramientas fuera del runbook**: la sección ocupaba 22,8 KB de 34 KB y la leía entera cada subagente de tanda (~330k tokens por tanda).~~ ✅ 2026-10-22: historial en `docs/registros/fallos-herramientas.md`; en el runbook, «Trucos de las herramientas» con los 17 vigentes (34 → 14 KB).
- ~~**QA-209 · El runbook de rondas lo lee quien juega**: la principal lo leyó entero sin jugar (~520k arrastrados).~~ ✅ 2026-10-22: `CLAUDE.md`, «Al jugar».
- ~~**QA-210 · Gancho `commit-msg` con `Siguiente:`**: dos commits de subagentes salieron sin él.~~ ✅ 2026-10-22: `.githooks/commit-msg` (solo con `CLAUDECODE=1`; merges y revert pasan), con test.
- ~~**QA-211 · `escenario.sh guardar` valida la descripción**: `t16-reino` y `t20-mundo` llevaban el id de la partida en el índice.~~ ✅ 2026-10-22: rechaza una palabra sola o un id, con test.
- ~~**QA-212 · Reabrir solo si el arreglo no funciona**: P293 se reabrió con otro fallo y la revisión lo partió en P319.~~ ✅ 2026-10-22: línea en «Cómo se juega» del runbook de rondas.
- ~~**QA-213 · La matriz no cuenta como jugada una prueba «parcial»**: CR-9 y otras seis pasaron a «jugado» con el texto «parcial … falta».~~ ✅ 2026-10-22: `matriz-pruebas.py --comprobar` las señala (pre-push), con test; las 7 filas reescritas.
- ~~**QA-214 · `*.kate-swp` en `.gitignore`**: el temporal de Kate se coló en un `git add docs/`.~~ ✅ 2026-10-22.

Cuota de GitHub Actions agotada (usuaria, 2026-10-22):
- ~~**QA-215 · A `main` sin PR con el CI en local**: sin minutos de Actions no hay CI de PR y no se podía fusionar.~~ ✅ 2026-10-22: `tools/qa/ci-local.sh` repite los tres jobs de `ci.yml` (base `tarkor_ci` nueva); con él en verde, merge a `main` y `git push origin HEAD:main` sin PR (`CLAUDE.md`, «Ramas y main»). Estrenado con `claude/pruebas-reino`; encontró un enlace roto en su descripción.

`/opt-tokens` y retro previos al PR de `claude/pruebas-mundo-vivo` ([retro](../registros/retro-2026-10-23-pruebas-mundo-vivo.md); aprobadas por la usuaria el 2026-10-23 y aplicadas en la rama):
- ~~**QA-216 · Preparar antes de jugar**~~ ✅ 2026-10-23 (regla en `AGENTS.md`, línea de `orchestrate-dealer`, y en «Qué se prueba» de `rondas-de-pruebas.md`): cuatro pasadas de juego cerraron casi nada porque el escenario no daba el estado que pedía cada hallazgo (~15 M de subagentes). Antes de repartir una tanda, la principal comprueba la precondición de cada id; si falta, primero se prepara.
- ~~**QA-217 · El plan de comprobación nombra escenarios que existen**~~ ✅ 2026-10-23: `matriz-pruebas.py --comprobar` (ya en el check) falla con «ESCENARIO SIN .dump» si la columna «Escenario» de un `plan-comprobacion-*.md` nombra entre comillas invertidas un escenario sin `.dump` en `tools/qa/escenarios/` (ignora órdenes, «—», texto suelto y las demás columnas; vale con o sin `.dump`, con ruta o enlace); 10 tests en `test_matriz_pruebas.py`. Halló `t13a2-ketg` (plan 3.3, tanda 13a-3), un dump borrado a propósito en `367caf18`: el plan lo dice ahora sin comillas y apunta a `t13a3-ketg`.
- ~~**QA-218 · `o.sh` sin lo que cada tanda redescubría**~~ ✅ 2026-10-23: `o.sh combate leer` (o `rondas:0`) solo mira; `o.sh viajar-a <lugar>` (`viajar-a.js`: abre Mapa › Viajar, elige por texto y si no está lista los que hay); `puntos.js` e `interactuar.js` dan `ERROR:` con el motivo (escena, combate, encuentro, modal encima) en vez de esperar 15 s; `captura.js` con `o.sh` guarda en `tools/playwright-e2e/shots/`. Tests de texto en `test_ayudas_mcp.py`. Probado en vivo: leer sin combate, `viajar-a` (lista vacía y «no está»), `puntos` abriendo el mapa, `interactuar` tapado, `captura`. **Pendiente:** la rama «con combate» de `leer` y el viaje real de `viajar-a` (la partida no tiene lugares visitados) sin probar en vivo; los tests de comportamiento son `QA-219`.
- ~~**QA-219 · Tests de comportamiento de `pulsar.js` y `mover.js`**~~ ✅ 2026-10-23: `tools/qa/tests/ayudas_mcp_navegador.mjs` (11 tests) lanza Chromium de Playwright sobre `tools/qa/tests/fixtures/ayudas-mcp.html` (modal con «1 Comer», leyenda pequeña, mapa svg grande en página y modal) y comprueba el orden de pasadas de `pulsar` (capa exacta, capa sin dígito, documento exacto, documento sin dígito) y que `mover` elige el svg grande del modal, descarta los de <100×100 y cae al de la página; lo lanza `test_comportamiento_en_navegador` (host.sh; se salta sin Playwright/Chromium). Comprobado rojo con 5 mutaciones. Quitados los tests de texto cubiertos. Pendiente: el job de `tools/qa` del CI no instala Playwright, allí se salta (ver FOUND).
- ~~**QA-220 · `preparar convaleciente:<npc>`**~~: `mv-pozo-guchapo-conv` lleva un `NpcState` insertado a mano (contra `QA-151`); rehacerlo con las funciones del juego. ✅ 2026-10-23: paso `convaleciente:<npc>` en `prepararReino.ts` (parser y test en `prepararReinoLib`); no hay función del juego exportada que deje a un NPC convaleciente (la escritura vive dentro de `turnLootKill.ts`), así que el paso repetía esa escritura (`scopeFor`, condición y reloj). Arreglado después (fase 3): `datosNpcStateDeIntercambio` y `dejarNpcConvaleciente` salen de `turnLootKill.ts`, el combate y el paso las usan (ausencia de zona de 6 h y grupo incluidos; test `turnLootKill.datos.test.ts`), y `mv-pozo-guchapo-conv` se rehízo con la escritura real (ausente 360 min, comprobado por SQL). Uso del script con `ganado:` y `convaleciente:`. Escenario rehecho desde `mv-pozo-sed50` con `preparar convaleciente:guchapo` y comprobado por SQL; el encuentro sigue sin jugarse.
- **QA-221 · Leves del `/code-review` del PR de `claude/pruebas-mundo-vivo`**: `mover.js` conserva una rama del menú viejo y detecta posición y hora por texto; la montura de pruebas solo la guarda `NODE_ENV=production`; `ganado:` depende del orden de las llamadas a `random()`; `mover.js` y `pulsar.js` repiten la descripción del elemento; `escenario.sh probar` con un `escenario.sh preparar` dentro escribe en la base viva (avisar o redirigir). Del `/code-review` de la fase 3: `viajar-a` da el viaje por hecho a los 9 s sin «Ocupado» y achaca a un panel la falta de «Viajar» sin destinos adyacentes; `interactuar` llama «tapado» a cualquier fallo de clic en 5 s; `puntos` adivina «escena abierta» por un «Vuelta N» del diario; `captura.js` no mira `SHOTS`; `matriz-pruebas.py` parte celdas por `|` sin respetar comillas invertidas; `ayudas_mcp_navegador.mjs` no cierra la página si la ayuda lanza.
- ~~**QA-222 · Imágenes en el mapa del agente**~~ ✅ 2026-10-24 (retro de `claude/imagenes-local`): la sesión releyó el documento de imágenes 21 veces y el generador 28; `docs/mapa-agente.md` tiene ahora la sección «Imágenes» (código, tests, tabla, interfaz, scripts y qué apartado del documento leer).
- ~~**QA-223 · El análisis de `CFG-42` en un subagente**~~ ✅ 2026-10-24: apuntado en la entrada de `CFG-42`; la principal mira solo las imágenes que deciden.
- ~~**QA-224 · `tools/qa/backend-dev.sh`**~~ ✅ 2026-10-24: `tsx watch` no ve los cambios del sandbox y se reinició a mano cuatro veces; el script para el de :3001, arranca `npm run dev` (base `tarkor`) y espera a `/health` (`--parar` solo lo para). Probado en la Deck: listo en 4 s.
- ~~**QA-225 · `sql.sh` contra la base de desarrollo**~~ ✅ 2026-10-24: la orden con `TARKOR_DB_URL` de la base `tarkor` está en la sección «Imágenes» del mapa (la sesión escribió `psql` con comillas a mano).
- ~~**QA-226 · `generar.sh` dice que el tercer argumento es una ruta**~~ ✅ 2026-10-24: con el texto del prompt abortaba repitiéndolo entero.
- ~~**QA-227 · `host.sh` rehace el worktree del pre-push en `logs/`, no en `.git/`**~~ ✅ 2026-10-24: Vite 8 niega `**/.git/**` y los tests de frontend del pre-push fallaban todos («Cannot find module '/src/test/avisosDeReact.ts'»). Test: `test_host`.

`/opt-tokens` y retro previos al PR de `claude/interfaz-imagenes` ([retro](../registros/retro-2026-10-25-interfaz-imagenes.md); aprobadas por la usuaria el 2026-10-25 y aplicadas en la rama):
- ~~**QA-228 · La lista de imágenes cubre todos los tipos que ilustra el juego**~~ ✅ 2026-10-25: la lista de `CFG-43` se dio por completa tres veces sin serlo. `test_la_lista_cubre_todos_los_tipos_que_ilustra_el_juego` lee la unión `ImagePromptEntityType` de `imagePromptGenerator.ts` y falla si `catalogo()` no da alguno (rojo sin los mapas de `zona`).
- ~~**QA-229 · La interfaz del generador en el mapa del agente**~~ ✅ 2026-10-25: `servidor.py` se leyó 43 veces. La sección «Imágenes» de `docs/mapa-agente.md` dice `generated/<tipo>/<slug>/` y da las entradas de `servidor.py`, `index.html`, `abrir.sh`, `resumen.py` y el test.
- ~~**QA-230 · `image-generator/interfaz/resumen.py`**~~ ✅ 2026-10-25: elementos por tipo, aviso y estado del trabajo en unas líneas (`--tipo` lista uno), en vez de capturas de la página (29 imágenes en la sesión). Test: `Resumen` en `test_interfaz_imagenes.py`.
- ~~**QA-231 · La fila de la bitácora dice la fase antes de `main`**~~ ✅ 2026-10-25: hecho en la fila de `claude/interfaz-imagenes`; propuesto a Galivelop-workflow en la retro.
- ~~**QA-232 · `bitacora.py check` en `commit-msg`**~~ ✅ 2026-10-25: un push rechazado por la fecha de «Actualizado» obligó a rehacer dos commits. `.githooks/commit-msg` comprueba la bitácora preparada cuando el commit la cambia. Test: `test_una_bitacora_con_actualizado_viejo_falla_al_hacer_el_commit`. Propuesto también a Galivelop-workflow.
- ~~**QA-233 · `selector` al lanzar cada subagente**~~ ✅ 2026-10-25: tres de cuatro subagentes fueron con Opus para trabajo mecánico; apuntado en `.claude/gw/opt-tokens.md` (costes conocidos).
- **QA-234 · Leves del `/code-review` del PR de `claude/interfaz-imagenes`**: `commit-msg` compara «Actualizado» con la fecha de hoy y el pre-push con la del autor (difieren con `--amend` o `--date`); con `--amend` sin tocar la bitácora no la mira; el test corre también el `pre-commit` real, que mira el índice del proyecto; `resumen.py` repite los nombres de campo de `/api/estado` y `/api/elementos` sin un contrato común con `servidor.py`.

Difusión (usuaria, 2026-10-24):
- ~~**QA-235 · Carpeta de difusión y skill `gw-media-content`**~~ ✅ 2026-10-25: `docs/difusion/` (guía de canales, plantilla por actualización y el ejemplo `2026-10-23-mundo-vivo`, con tarjeta, diagrama y captura en `medios/`) y la skill `gw-media-content`, que crea o completa una carpeta solo con lo no publicado, para los canales pedidos. `render.mjs` pasa las fuentes de `medios/fuente/` a WebP; `comprobar.py` (en el check y en el CI) da por buena la carpeta. Test: `test_comprobar.py`. Queda: la usuaria valida el estilo del ejemplo.

Retro de la difusión (usuaria, 2026-10-25; [`retro-2026-10-25-difusion.md`](../registros/retro-2026-10-25-difusion.md)):
- ~~**QA-236 · Los tests de las skills, en el check**~~ ✅ 2026-10-25: `test_herramientas_con_test` (que ya pedía el test de cada script de skill) entra en el check, y `tools/qa/skills-con-tests.py` (check, CI y `ci-local.sh`) falla si el CI no corre los tests de una skill. Test: `test_skills_con_tests.py`. Queda (leve, del code-review): busca el texto, así que un paso comentado cuenta, y solo ve `test_*.py` directos en `scripts/`.
- ~~**QA-237 · La bitácora, en el check**~~ ✅ 2026-10-25: `tools/qa/bitacora-check.sh` en el check: `bitacora.py check`, `own-row` (ninguna fila ajena tocada desde el último commit) y, frente a la rama remota como el pre-push, `closed`, sobre una foto de la copia de trabajo que incluye lo no añadido. Test: `test_bitacora_check.py`. Queda (leve): la base es `origin/<rama actual>`, no el ref al que se sube.
- ~~**QA-238 · «Lleva a `main`» con la usuaria fuera**~~ ✅ 2026-10-25: regla en `AGENTS.md` («Ramas y `main`»): todo a un paso y su decisión sobre la retro lo lleva a `main`.
- ~~**QA-239 · `ci-local.sh` en un worktree, sin rojos falsos**~~ ✅ 2026-10-25: `test_commit_msg` usa un `hooksPath` solo con `commit-msg` (el pre-commit miraba el índice del repo real), `test_host` acepta el worktree de `logs/` y `ci-local.sh` quita los enlaces de `node_modules` y `.env` antes de `npm ci` (vaciaba el `node_modules` de la copia principal y metía su `.env`). Queda (leve): `test_host` en un worktree de subagente con cambios sin commit sigue dando rojo (host.sh se niega, a propósito).

Retro de las voces (usuaria, 2026-10-25; [`retro-2026-10-25-voces.md`](../registros/retro-2026-10-25-voces.md)):
- **QA-240 · Simulacro de `voice-generator/` con binarios falsos**: la revisión previa a `main` encontró en scripts nunca ejecutados que `lanzar` dejaba a `qwen-tts` sin el texto, que `fijar.sh` cambiaba la voz aunque fallara el codec y que `banco.sh` copiaba una toma a medias. Un test en `tools/qa/tests/` con `qwen-tts`, `qwen-codec` y `sox` falsos en el `PATH` que corra `fijar.sh`, `producir.sh` y `banco.sh` de punta a punta. Se escribe dentro de `VOZ-6`, sobre los scripts que lleguen del repo aparte. **S**
- ~~**QA-241 · Las voces en el mapa del agente**~~ ✅ 2026-10-25: el doc 02 se leyó 8 veces y el `README.md` de imágenes 4 (~176k arrastrados). Sección «Voces y sonidos» en `docs/mapa-agente.md` (scripts, fichas, `voces.py`, apartados del doc 02), y `tools/qa/mapa-agente.py` mira también `image-generator/` y `voice-generator/` (con `def` de Python y funciones de bash; una ruta con `<…>` no se mira).
- ~~**QA-242 · `cobertura.py --fila <ID>`**~~ ✅ 2026-10-25: `21-roadmap.md` se leyó 12 veces (74k arrastrados). La orden da la línea donde se define la tarea, su hito con la fila de «Qué entra en cada hito» y cada mención en `21-roadmap.md`, recortada; test en `tools/qa/tests/test_cobertura.py`.

Lore de la enciclopedia (usuaria, 2026-10-25, rama `claude/lore-enciclopedia`):
- ~~**QA-243 · Asentar el lore de la enciclopedia**~~ ✅ 2026-10-26 (en los primeros commits de la rama, `QA-240`): auditar cada sección (fauna y flora, NPC, razas y personajes, lugares, facciones e historia, objetos y recetas, clases, combate y reputación) contra el canon de `docs/rpgtarkor/`; cada arreglo, propuesto y aplicado solo con el sí de la usuaria, y apuntado en [`lore-hallazgos.md`](../registros/lore-hallazgos.md). Hecho (2026-10-25): NPC, fichas y clases, objetos y recetas, lugares, facciones, fauna y flora (con región y población de 18 animales), y cuatro traducciones en `lenguas-helek.md`. Leves: despiece del Ferike, hecho; edificios Goshg al `0.5` y tablones de Keseg Sael y Goirntes al `0.6`. Fases 1 y 2 antes de `main` hechas (retro → `QA-245`…`QA-248`). 2026-10-26: `./actualizar-mundo.sh` en la BD local de la Deck, en verde (92 bloques reindexados). Las imágenes de las ocho habilidades renombradas no quedan a medias: ninguna habilidad tiene imagen todavía (`backend/uploads/images/ability/` vacía); van con las demás en `IMG-9` ([roadmap de imágenes](roadmap-imagenes.md)). **M**
- ~~**QA-244 · La historia de la enciclopedia, completa**~~ ✅ 2026-10-26: decidido con la usuaria que una entrada sin documento se descubre por **saber común** (abierta desde el principio) o **por lugar** (al visitarlo, como las bóvedas de datos de X4). Código: `HistoriaEntry.documentoItemSlug` opcional y `lugarSlug` (migración `20261026120000_historia_sin_documento`), `buildHistoriaSection` y tests en `world.test.ts`. Diez entradas nuevas en `worldCatalog.ts`, con el sí de la usuaria a los diez textos: siete de saber común (el Estallido, el nacimiento de los orcos, el Golpe de Ketg, la Mesa del Lazo, la Purga Silenciosa, la Guerra de la Isla Cambiante y El Detonante) y tres por lugar (El Borde en El Cruce de las Ausencias, la Senda del Sílice en el Desfiladero Esmeralda y el Pacto del Umbral en El Refugio sin Nombre). Probado con una partida en la base local: 17 entradas, las de lugar se abren al visitarlo. Sale del bloque 4 de `QA-243` (en los primeros commits, `QA-241`). **M**
- ~~**QA-274 · Segunda pasada por la enciclopedia**~~ ✅ 2026-10-26 (usuaria, 2026-10-26: «vamos luego con la segunda pasada»): contrastar cada sección de la enciclopedia ya asentada con el canon, en tandas pequeñas (`QA-247`), y traer los hallazgos a la usuaria; cada arreglo, con su sí, y apuntado en [`lore-hallazgos.md`](../registros/lore-hallazgos.md). **Hecho:** los tres choques del canon de `QA-244` (origen de los orcos, carga de la Senda, marcas «no implementado»); diez tandas de auditoría (sin graves; unos 80 medios y 70 leves), con cuatro bloques aprobados por la usuaria; en el canon, oficios y edificios al día con el juego (ganadero y minero de las Llanuras, lo construible), los 7 documentos y lo reservado de Tarkor (el porqué, no el hecho del regreso). Bloque 2: el seed retira los lugares, facciones y NPC que salen del catálogo si ninguna partida los referencia (`retirarHuerfanos.ts`); fuera los 11 viejos, entre ellos `kegi` (en el Margen), `hashma` y `ulkha`, con lo que Kegi queda solo en las Llanuras (Yegr Kegi) y no hacen falta las fusiones. Bloque 1: unos 160 textos sin notas de diseño, jerga, inglés ni erratas («tier» → «nivel» también en tres mensajes de obras); «Madera/Resina de Junba» también en el canon (era errata). Bloque 3: orcos hasta 50-54 años (hembras 62-64), piel de los Nabieus que «atrapa la luz», Kael Dorn Arquero, cuerda de tendón de Múrgol, caña de Junba Verde, múrgoles tras la empalizada de Karot Veku, el Canizor en pasado, la Sombra de Kroj «devuelve» sonidos, Fin Susurrado «tomado del nombre de su clan» (también en el canon) y el Vientre del Engaño solo como rumor. Mundo resembrado y todo apuntado en `lore-hallazgos.md`. Pendiente (leve, sin aprobar): comparaciones con animales reales, atributos de 22-24 en NPC de nivel menor de 20, Gogorath de nivel 18, descripciones cortas, nombres de receta con artículo y `lugarOrigen` vacías.

Retro del lore de la enciclopedia (usuaria, 2026-10-25; [`retro-2026-10-25-lore-enciclopedia.md`](../registros/retro-2026-10-25-lore-enciclopedia.md)):
- ~~**QA-245 · `tools/qa/ficha.sh <slug>`**~~ ✅ 2026-10-25: `worldCatalog.ts` se leyó 140 veces (1,5M arrastrados) para reunir lo de un slug. Una orden que dé, en una salida, la ficha del catálogo y sus alias, el despiece, la región, el nombre y la descripción de la enciclopedia, la población, las recetas que lo usan o lo fabrican, los chunks de lore y dónde lo nombra el canon. **Hecho:** `tools/qa/ficha.sh <slug> [--canon]` sobre `backend/src/scripts/ficha.ts` (barre además toda exportación de `worldCatalog.ts`; con un slug que no existe, cinco parecidos); tests en `ficha.test.ts` y `test_ficha.py`.
- ~~**QA-246 · Aviso de identificador que ya usa `main`**~~ ✅ 2026-10-25: `QA-240` y `QA-241` chocaron con los de las voces y hubo que renumerar. `cobertura.py --libre <PREFIJO>` da el siguiente libre mirando también `origin/main`, y `cobertura.py` (en el check) avisa de una tarea definida en la rama y en `origin/main` con otro texto. **Hecho:** `--libre` (solo cuenta menciones con su prefijo) y dos líneas que fallan el check: «ABIERTAS TAMBIÉN EN MAIN» (definida en la rama y en `main` desde la base común, con otro título; sin `origin/main`, no falla) y «DEFINIDAS DOS VECES» (en el árbol, también tras traer `main`). Tests en `test_cobertura.py` (`MainRemoto`).
- ~~**QA-247 · Auditorías de lore en tandas pequeñas**~~ ✅ 2026-10-25: las tandas de auditoría fueron el 40 % de la entrada, con 110k de contexto medio. Una tanda, una región o un catálogo, con el resumen de `docs/canon-opencode/` y `ficha.sh`, unas 30 llamadas como tope, y devuelve una tabla de hallazgos. **Hecho:** § 0.5 de [`ampliar-lore.md`](../runbooks/ampliar-lore.md) y línea en `.claude/gw/opt-tokens.md`.
- ~~**QA-248 · La enciclopedia en el mapa del agente**~~ ✅ 2026-10-25: `routes/world.ts` se leyó 13 veces. Sección «Enciclopedia y lore» en `docs/mapa-agente.md` (de dónde saca cada pestaña sus datos, diccionarios, población, chunks, tests de integridad y canon). **Hecho:** sección «Enciclopedia y lore» en `docs/mapa-agente.md` (la comprueba `mapa-agente.py`).

Retro de la segunda pasada por la enciclopedia (usuaria, 2026-10-26; [`retro-2026-10-26-lore-enciclopedia.md`](../registros/retro-2026-10-26-lore-enciclopedia.md)):
- ~~**QA-275 · Copias de partida en el mapa del agente**~~ ✅ 2026-10-26: al retiro de huérfanos de `QA-274` se le escaparon los edificios de las facciones copia (sin `saveId`) y las referencias por slug sin FK; las cazó la revisión. Entrada «Copias de partida» en «Datos que se confunden» de `docs/mapa-agente.md`.
- ~~**QA-276 · Regla de revisión para `where` anidados de Prisma**~~ ✅ 2026-10-26: tsc aceptó `almacen` por `almacenItems` en un `deleteMany`; solo lo vio el test contra Postgres. Regla en `REVIEW.md` («Cada partida, lo suyo»): test de integración, y si borra catálogo, con referencia sin FK y copia de partida.
- ~~**QA-277 · Tope de llamadas en las tandas de edición**~~ ✅ 2026-10-26: el bloque 1 de `QA-274` fue una tanda de 66 llamadas con 103k de contexto medio (6,8M, el 13 % de la sesión). Tope de 30-40 en `ampliar-lore.md` § 0.5 y en `.claude/gw/opt-tokens.md`.
- ~~**QA-272 · Leer por partes: registros por secciones y `ficha.sh` con `archivo:línea`**~~ ✅ 2026-10-26: `worldCatalog.ts` se leyó 44 veces (542k arrastrados) y `lore-hallazgos.md` 17 (300k). `ficha.sh` acaba con la sección «Fuente (archivo:línea)» (`ficha.ts`, con test); la lectura por secciones, en `.claude/gw/opt-tokens.md`.
- ~~**QA-273 · Guardia de nombres de habilidad renombrados**~~ ✅ 2026-10-26 (usuaria, 2026-10-26, tras el CI local): los textos de `QA-274` renombraron cinco habilidades de fauna sin pasarlas por `HABILIDADES_RENOMBRADAS` (`QA-68`); la revisión no lo vio y lo cazó un test de fauna de forma casual. `backend/src/services/habilidadesConocidas.json` guarda todos los nombres que una partida puede guardar, y `habilidadesRenombradas.test.ts` falla si uno desaparece del catálogo sin renombre o si falta uno nuevo en la lista.
  **Leves de la revisión** (pendientes):
  - los nombres viejos de los renombres por clase («Golpe Certero»…) siguen vivos en otra clase, y la guardia no los vigila;
  - `Save.pendingNpcAttack.abilityName` no lleva la marca `QA-68`: una partida guardada con un ataque pendiente conserva el nombre viejo;
  - el mundo sin resembrar conserva los nombres viejos en `Npc.habilidadesRaciales`;
  - «Fuga en Bandada» promete una huida que el motor no hace (no está en `HABILIDADES_DE_HUIDA`; ya pasaba con «Vuelo en Bandada»);
  - las 13 categorías de fauna, repetidas a mano en el test.

Opt-tokens de `claude/plan-imagenes` (usuaria, 2026-10-25; 296 llamadas con 116k de contexto medio):
- ~~**QA-249 · Hoja de contactos del banco de imágenes**~~ ✅ 2026-10-25: se leyeron 66 imágenes del banco una a una (3,99M arrastrados). `bash docs/producto/plan-imagenes/hoja.sh <prefijo> [columnas]` junta una ronda en hojas de 6 casillas (ffmpeg; la leyenda, en texto); la hoja sirve para descartar y la finalista se abre entera. Test: `tools/qa/tests/test_hoja_banco.py`.
- ~~**QA-250 · `recuperar.py --estado` con los worktrees**~~ ✅ 2026-10-25: el gancho corre donde se abrió la sesión y daba la fila de otra rama; la sesión del worktree releyó `traspaso.md` 22 veces (376k). Ahora da también cada worktree con la fila de su rama. Test en `tools/qa/tests/test_recuperar.py`.
- ~~**QA-251 · Modelo explícito en cada subagente y salidas de fondo con `tail`**~~ ✅ 2026-10-25: un subagente mecánico fue con Opus (2,9M de entrada; la segunda vez, tras `QA-233`) y una salida de fondo se leyó entera (11,7k, 363k arrastrados). Regla en `docs/runbooks/skills-y-modelos.md` y en `.claude/gw/opt-tokens.md`.

Retro de `claude/plan-imagenes` (usuaria, 2026-10-25; [`retro-2026-10-25-plan-imagenes.md`](../registros/retro-2026-10-25-plan-imagenes.md)):
- ~~**QA-252 · Los ganchos de `.githooks/` en un worktree**~~ ✅ 2026-10-25: en un worktree git exporta `GIT_DIR` y `pre-commit`/`pre-push` tomaban `.githooks` por raíz; la sesión subió con envoltorios hechos a mano. La raíz sale con `env -u GIT_DIR -u GIT_WORK_TREE`. Test en `tools/qa/tests/test_pre_commit.py`; el push de este arreglo ya fue sin envoltorios. Pendiente (leve, revisión de la fase 3): el de `pre-push` no tiene test, y `config.py` (`git_toplevel`, que usa `commit-msg`) y los `.sh` de `.claude/gw/scripts/` tienen la misma causa (en un worktree leen el `gw.json` de la copia principal); va a Galivelop-workflow.
- ~~**QA-253 · `host.sh` con cambios sin commit**~~ ✅ 2026-10-25: rechazaba un worktree con cambios y no se pudo pasar `node` antes del commit. La copia visible sale de `git stash create` (lo seguido, tal como está; lo sin seguimiento, con `git add` antes). Tests en `tools/qa/tests/test_host.py`. 3 tests de `test_host.py` fallan solo en el sandbox de la Deck (PATH reducido), también sin el cambio; en el host (`ci-local.sh`, 2026-10-25) pasan. Avisa por stderr cuando corre sobre la instantánea (un verde así no prueba ningún commit). Pendiente (leve): un proceso que se queda en segundo plano (`backend-dev.sh`) desde un worktree invisible sigue en la copia ya borrada; pasaba ya sin cambios.
- ~~**QA-254 · `set -euo pipefail` en los scripts de imágenes**~~ ✅ 2026-10-25: `banco.sh` sin `pipefail` nunca decía FALLO. `tools/qa/tests/test_pipefail.py` lo exige en todo `.sh` de `image-generator/` y `docs/producto/plan-imagenes/`, o una línea `# sin pipefail: <motivo>`; `abrir.sh`, `calidad.sh`, `pilotos.sh` y `banco/recorte.sh` lo llevan; `generar.sh`, `probar.sh`, los de `spike/` y `obsoleto/`, con su motivo.
- ~~**QA-255 · `banco.sh` avisa mientras espera memoria**~~ ✅ 2026-10-25: la ronda 7 se quedó parada sin decir nada. Cada 5 min, una línea con los MB libres y los que pide.

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
