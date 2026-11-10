# Propuesta al juego: la marca de Tarkor en la interfaz (2026-11-10)

> Copiado de `galivelop-image-generator` (`docs/propuestas/tarkor/diseno-interfaz-2026-11-10.md`, rama `portal-marca`, `144d78b`) el 2026-11-10. Tareas: `UX-40` (lo de la sección 7 «Ahora») y `UX-41` (lo que espera a las imágenes), en [`roadmap-front-ux.md`](roadmap-front-ux.md#48-marca-de-tarkor).

**Para:** una sesión en el repo del juego (World-Maker-Fantasy, `frontend/`), y en lo que se indica, el Instalador
(Instalador-WMF-Tarkor) y el Portal (Portal-Galivelop). **De:** galivelop-image-generator, rama `portal-marca`.
**Estado:** propuesta; la aplica quien trabaje en cada repo, con la confirmación de su persona.

Este documento se basta solo: no hace falta leer nada de galivelop-image-generator para aplicarlo. Las líneas citadas son
las de World-Maker-Fantasy en `e3778e61` (iguales en `e5a41d18`, HEAD al escribir); si el archivo cambió, buscar la clase o el
token por su nombre.

> **Aviso sobre las imágenes.** Las texturas y pictogramas de la tabla de la sección 6 **aún no existen**: los produce
> galivelop-image-generator en local y llegarán a `examples/tarkor/entrega/ui/` (interfaz) y `examples/tarkor/entrega/marca/`
> (fuera del juego) de ese repo, de donde se copian a `frontend/public/` o `frontend/src/assets/`. **Hasta entonces el CSS
> sigue con sus degradados actuales**; lo que sí se aplica ya son los tokens, las clases y la tipografía (sección 7).

## 1. Dirección visual, en diez líneas

1. La marca de Tarkor es **la Semilla rota con la estrella**: un disco de piedra oscura partido en seis gajos, con una
   luz de oro en las juntas y una estrella de cuatro puntas encima, dentro de un aro de oro tallado con cuatro puntos cardinales.
2. **«La madera sostiene, el oro remata».** La interfaz es madera oscura, hierro y piedra; el oro aparece solo en filos,
   juntas, remaches y la estrella: como mucho un 10 % de la superficie, y el brillo (el oro más claro) un 5 %.
3. Una sola luz, **rasante desde arriba a la izquierda**, la misma en los PNG, en los SVG y en el CSS (sombras en los surcos,
   nunca sombras arrojadas, nunca halos).
4. **Dentro del juego el fondo es madera** (`wood-950` `#1b130c`); **fuera del juego** (og, avatar, cabeceras, hero de la
   Home) es **noche índigo** (`night-950` `#0f1428` → `night-900` `#1a2140`), con polvo de estrellas fino y sin luna.
5. El **cristal** (`accent-*`) deja de ser el acento de marca: sigue dentro del juego como **gema** y como **campo** detrás
   del emblema (`crystal-deep` `#1f4a55`), nunca como luz ni como color de titular.
6. La **arcilla** `#E0703A` sale de la marca (era el acento que el Portal le asignó); en el juego nunca entró.
7. Tipografía: **Cinzel** (700 en titulares de interfaz, 900 en el hero con relleno de oro) e **Inter** (400 texto, 500 eyebrow);
   el wordmark «TARKOR» es un SVG a trazos (Cinzel 800 modificada), nunca `<text>` ni una fuente en pantalla.
8. El **favicon** del juego pasa a ser el emblema simplificado en oro sobre madera (hoy es el rayo violeta de Vite).
9. Vetos que vienen del canon: **sin morado ni violeta** (luz reservada), **sin luna**, sin rostros ni humanos, sin pólvora.
   El `#863bff` del favicon actual rompe el primero.
10. Todo lo tematizable por mundo (`accent-*`, `accent2-*`) sigue siéndolo; el oro, la piedra y la noche son **de marca** y no
    cambian con el mundo.

## 2. Tokens nuevos en `frontend/src/index.css`

Van dentro del `@theme` (l.8), después del bloque `--color-accent2-*` (l.45-48) y antes de `--color-moss-*` (l.51). No se
quita ningún token existente; `wood-400` `#a3814f` y `wood-300` `#c9a877` siguen en el juego (texto secundario, bordes) aunque
ya no sean colores de marca.

```css
  /* Oro tallado de la marca (logos 2026-11-10): remata, nunca sostiene */
  --color-gold-100: #ffe9a8;  /* núcleo de luz: estrella, junta */
  --color-gold-300: #f2c45a;  /* bisel con luz */
  --color-gold-500: #b8862b;  /* cuerpo del metal */
  --color-gold-700: #7a5a1e;  /* pátina, cara en sombra */
  --color-gold-900: #5a3a14;  /* filo, contorno, tinta sobre claro */
  /* Piedra de la Semilla */
  --color-stone-500: #6b6257;
  --color-stone-700: #3a342d;
  /* Noche de marca (fuera del juego y en .crystal-sky) */
  --color-night-900: #1a2140;
  --color-night-950: #0f1428;
  --color-crystal-deep: #1f4a55;  /* campo del emblema; fondo de gema */
```

Con Tailwind 4 estos tokens dan las utilidades `text-gold-500`, `border-gold-900`, `bg-night-950`, etc.

**Contrastes (WCAG, calculados):** hueso `wood-100` `#f1e4d0` sobre `night-950` 14,55:1, sobre `night-900` 12,54, sobre
`wood-950` 14,63, sobre `wood-800` 11,93; `gold-300` sobre `night-950` 11,14; `gold-500` sobre `night-950` 5,63 y sobre
`wood-950` 5,66; `gold-900` sobre hueso 8,17; `gold-700` sobre hueso 5,06; **`gold-500` sobre hueso 2,58: no vale como
texto sobre claro** (usar `gold-900`); `accent-300` `#a8d8f0` sobre `crystal-deep` 6,34.

## 3. Cambios clase por clase (`frontend/src/index.css`)

Todos son adiciones o cambios de una propiedad; ninguno depende de las imágenes.

| Clase | Líneas hoy | Cambio |
|---|---|---|
| `.plank-panel` | l.167-184 | el borde (l.180, `border: 1px solid var(--color-iron-700);`) se queda; se añade `.plank-panel[data-active="true"], .plank-panel.is-active { border-color: var(--color-gold-900); }` para el panel activo (mundo elegido, modal en primer plano). Cuando llegue `02-tablon.png`, sustituye el `repeating-linear-gradient` + `linear-gradient(155deg, …)` por `url()` de la textura con `background-size: 512px` |
| `.plank-panel-defense` | l.193 | sin cambio ahora; con `07-defensa.png`, igual que el anterior |
| `.iron-band` | l.216-222 | añadir `box-shadow: inset 0 -1px 0 var(--color-gold-700);` (un filo de pátina abajo: el oro remata la banda). Con `05-banda.png`, la textura sustituye los dos `repeating-linear-gradient` y se mantiene el `linear-gradient(175deg, …)` debajo |
| `.accent-hairline` | l.226-234 | se queda (es la firma del mundo activo). Se añade al lado `.gold-hairline { height: 1px; background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-gold-500) 80%, transparent) 50%, transparent); }` para los separadores de marca (Home, modales de título) |
| `.gem` | l.246-254 | el degradado `accent-300 → accent-600` se queda; el `box-shadow` pasa a `0 0 0 1px var(--color-gold-700), 0 0 8px color-mix(in srgb, var(--color-accent-500) 55%, transparent)`: la gema va engastada en oro |
| `.gem2` | l.255 | igual, con `gold-900` en vez de `gold-700` |
| `.crystal-sky` | l.269-286 | el degradado base (l.284, `linear-gradient(180deg, #0d2230 0%, … accent-600 34% …, iron-900 100%)`) pasa a `linear-gradient(180deg, var(--color-night-950) 0%, var(--color-night-900) 50%, var(--color-iron-900) 100%)`. Las estrellas (`radial-gradient` con `accent-300/400`) se quedan: son el polvo de estrellas del canon. Con `06-cielo.png`, la textura va encima del degradado |
| `.iron-etched` | l.292 | sin cambio |
| `.corner-bracket` | l.300-322 | se añade `.corner-bracket-gold` con el mismo dibujo y `border-color: var(--color-gold-700)`, para los paneles de marca (Home, ficha de mundo). Con `08-esquina-oro.png` / `08-esquina-acero.png`, las esquinas pasan a `background-image` en los cuatro pseudo-elementos |
| `.rivet` | l.324-348 | sin cambio; con `09-estrella.png` (16 px), el remache central de los paneles de marca puede ser la estrella |
| `.skill-slot` | l.369-388 | el borde (l.381, `color-mix(in srgb, var(--color-wood-400) 65%, var(--color-iron-900))`) pasa a `1px solid var(--color-gold-900)`; con `10-ranura.png`, `border-image: url(…) 8 fill / 8px stretch` |
| `.skill-slot:hover:not(:disabled)` | l.393 | el `border-color: var(--color-accent-400)` se queda (el cristal es la respuesta del mundo); se añade `0 0 0 1px var(--color-gold-700)` como primera sombra |
| `.skill-slot:disabled` | l.401 | sin cambio |
| nueva `.title-gold` | — | `font-family: var(--font-serif); font-weight: 900; letter-spacing: 0.08em; background: linear-gradient(180deg, var(--color-gold-300), var(--color-gold-700)); -webkit-background-clip: text; background-clip: text; color: transparent; text-shadow: 0 1px 0 var(--color-gold-900);` Solo para el h1 del hero |

Dónde se usan hoy las clases, para comprobar el resultado: `pages/Home.tsx` l.20 (`crystal-sky`), l.24-27 y l.31-34
(`accent-hairline` + `gem`); `components/WorldCard.tsx` l.24-25 (`plank-panel`, `crystal-sky` en Helek Sirik);
`components/SkillBarHud.tsx` l.43, l.49, l.62, l.72 (`skill-slot`); `components/ModalShell.tsx` l.165 y
`components/DetailModal.tsx` l.151 (`plank-panel`); `components/CombatPanel.tsx` l.758 (miniatura del rival, hoy un emoji de
reserva); `components/IconCard.tsx` l.62 y `components/Miniatura.tsx` l.16 (marcos de pictograma).

## 4. Tipografía

- Las fuentes ya están empaquetadas (`frontend/src/assets/fonts/`: Cinzel e Inter variables, OFL; `--font-serif` y
  `--font-sans` en l.9-14): **no se añade ninguna**.
- **Titulares de interfaz:** `font-serif` con peso **700** (cabeceras de `.plank-panel`, modales, fichas de mundo), color hueso
  `text-wood-100`. Hoy el h1 de la Home (`Home.tsx` l.30, `font-serif text-4xl text-wood-100 sm:text-5xl`) va sin peso
  explícito: pasa a `title-gold text-4xl sm:text-5xl` (el único titular en oro).
- **Eyebrow** «Tarkor» (`Home.tsx` l.29, `text-xs tracking-[0.3em] text-accent-400 uppercase`): pasa a `text-wood-200`
  (hueso) con `font-medium`; el cristal deja de ser color de texto de marca.
- **Cuerpo:** Inter 400 (`font-sans`, ya es el `body`, l.113-117); en descripciones largas, `opacity: 0.82` sobre madera.
- **Cifras y datos:** `font-mono` (Cascadia Code), como hasta ahora.
- **El wordmark «TARKOR» nunca se compone con texto**: llega como `tarkor-wordmark.svg` (trazos) dentro de los lockups; mientras
  no exista, el eyebrow en Inter sigue valiendo.

## 5. Favicon e `index.html`

- `frontend/public/favicon.svg` es hoy el rayo violeta de Vite (`#863bff`, `#7e14ff`, `#47bfff`): rompe el veto del morado.
  Lo sustituye `tarkor-emblema-simple.svg`: aro con cuatro puntos, seis gajos y estrella en `gold-500` `#b8862b` plano sobre
  `wood-950` `#1b130c`, `viewBox` cuadrado, sin `<text>`, legible a 16 px. Llega de galivelop-image-generator con el resto del
  sistema de logo (sección 6, fila «favicon»); mientras tanto, el rayo se puede dejar o quitar.
- `frontend/index.html` (12 líneas) no declara icono ni Open Graph. Añadir en `<head>`, tras `<title>Tarkor</title>` (l.6):

```html
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="theme-color" content="#1b130c" />
    <meta property="og:title" content="Tarkor" />
    <meta property="og:description" content="El mundo sigue aunque tú te detengas." />
    <meta property="og:image" content="/og.png" />
```

  `og.png` (1200×630) es la pieza E3 de la tabla; hasta que exista, la etiqueta `og:image` se omite (una ruta rota es peor
  que ninguna). `theme-color` sí se aplica ya.

## 6. Recursos de imagen previstos

Todos en estado **pendiente de generar en galivelop-image-generator**. Los nombres de archivo son los definitivos (así llegan a
`entrega/`), en PNG; los recortes sobre transparencia llevan sufijo `-alpha.png`. Los SVG del sistema de logo se dibujan a mano
en ese repo a partir del emblema elegido.

| Id | Archivo previsto | Medidas | Dónde se usa (ruta y línea hoy) |
|---|---|---|---|
| #1 | `entrega/ui/01-emblema.png` | 1024×1024 | referencia pintada del emblema; de él nacen los SVG y, por img2img, todo lo demás |
| favicon | `tarkor-emblema-simple.svg` | vectorial, 16-64 px | `frontend/public/favicon.svg` |
| logo | `tarkor-emblema.svg`, `tarkor-glifo.svg`, `tarkor-monograma.svg`, `tarkor-wordmark.svg`, `tarkor-lockup-h.svg`, `tarkor-lockup-v.svg` (+ `-claro`, `-mono`) | vectoriales | `frontend/public/` (hero de la Home, cabeceras de modal; el glifo como marcador de 16 px) |
| #2 | `entrega/ui/02-tablon.png` | 1024×1024, repetible | `.plank-panel` (l.167-184) |
| #3 | `entrega/ui/03-fondo.png` | 1024×1024, repetible | `.wood-grain` (l.129) y fondo del `body` (l.113-117) |
| #4 | `entrega/ui/04-polvo.png` | 1024×1024, repetible | `.dust-road` (l.152) |
| #5 | `entrega/ui/05-banda.png` | 1024×256, repetible en horizontal | `.iron-band` (l.216-222), `.iron-etched` (l.292) |
| #6 | `entrega/ui/06-cielo.png` | 1536×640 | `.crystal-sky` (l.269-286): Home l.20 y `WorldCard.tsx` l.25 |
| #7 | `entrega/ui/07-defensa.png` | 1024×1024, repetible | `.plank-panel-defense` (l.193) |
| #8 | `entrega/ui/08-esquina-oro-alpha.png`, `08-esquina-acero-alpha.png` | 64×64 | `.corner-bracket` / `.corner-bracket-gold` (l.300-322) |
| #9 | `entrega/ui/09-separador-alpha.png`, `09-estrella-alpha.png` | 1024×128 y 16×16 | `.gold-hairline`; remache central (`.rivet`, l.324-348); E8 (separador vertical) es el mismo girado por CSS |
| #10 | `entrega/ui/10-ranura-alpha.png` | 64×64 (`border-image`) | `.skill-slot` (l.369-388), `SkillBarHud.tsx` l.43-72 |
| #11 | `entrega/ui/11-pestana-<nombre>-alpha.png` | 512×512 | pestañas de los modales (`ModalShell.tsx`) |
| #12 | `entrega/ui/12-hud-<nombre>-alpha.png` | 512×512 | pictogramas del HUD (`SkillBarHud.tsx`) |
| #13 | `entrega/ui/13-fase-<nombre>-alpha.png` | 512×512 | fases de combate (`CombatPanel.tsx`) |
| #14 | `entrega/ui/14-dado-alpha.png` | 512×512 | tiradas (`CombatPanel.tsx`) |
| #15 | `entrega/ui/15-categoria-<nombre>-alpha.png` | 512×512 | `IconCard.tsx` l.62 |
| #16 | `entrega/ui/16-medallon-alpha.png` | 512×512 | `Miniatura.tsx` l.16; `CombatPanel.tsx` l.758 (sustituye al emoji de reserva) |
| #17 | `entrega/ui/17-estado-<nombre>-alpha.png` | 512×512 | estados (moss / danger / cost / quest) |
| E3 | `entrega/marca/e03-og.png` | 1200×630 | `og:image` de `index.html` (sección 5) |
| E5 | `entrega/marca/e05-hero.png` | 1280×704 | hero de la Home detrás de `.title-gold` |
| E6 | `entrega/ui/e06-carga.png` | 1280×704 | pantalla de carga |
| E7 | `entrega/ui/e07-barra-pista-alpha.png`, `e07-barra-relleno-alpha.png` | 1024×128 | barras de salud, XP y progreso |
| E9 | `entrega/ui/e09-sello-alpha.png` | 512×512 | sello de misión aceptada (`quest`) |
| E10 | `entrega/ui/e10-insignia-alpha.png` | 512×512 | insignias de logro |
| E11 | `entrega/ui/e11-marco-retrato-alpha.png`, `e11-marco-redondo-alpha.png` | 1280×704 y 512×512 | marcos de retrato y de miniatura |
| E12 | `entrega/ui/e12-plantilla-captura.png` | 1280×704 | marco de las capturas compartidas |
| E13 | `entrega/ui/e13-boton-alpha.png`, `e13-boton-hover-alpha.png`, `e13-boton-pulsado-alpha.png` | 1024×128 (`border-image`) | botones principales |
| E16 | `tarkor-glifo.svg` | vectorial, 16 px | marcador de lista, cursor de texto, puntos de carga |
| E17 | `entrega/ui/e17-tooltip-alpha.png` | 1024×128 (`border-image`) | tooltips |
| E14 | `entrega/marca/e14-icono-app.png` | 512×512 (+ 16/32/128 y `fuente.png` 1024) | **Instalador:** `app/src-tauri/icons/` (`icon.png`, `32x32.png`, `64x64.png`, `128x128.png`, `128x128@2x.png`, `icon.ico`, `fuente.png`), `tauri.conf.json` l.34 <!-- gw-allow-private: nombre de archivo de Tauri, no un e-mail --> |
| E1, E2, E4, E18 | `entrega/marca/e01-avatar.png`, `e02-cabecera.png`, `e04-capsula.png`, `e18-contactos.png` | 400², 1500×500, 1024×576, 1024² | redes, Steam y **Portal** (`public/proyectos/tarkor/portada.webp` la sustituye E2) |

Lo que no está en la tabla no se ha previsto (cursor E15: descartado por ahora).

## 7. Qué se aplica ahora y qué espera

**Ahora, sin esperar imágenes:**

1. Los tokens de la sección 2.
2. Los cambios de clase de la sección 3 que no citan un PNG (bordes de oro, `.gold-hairline`, `.title-gold`, `.crystal-sky`
   a noche, engaste de `.gem`, `.corner-bracket-gold`).
3. La tipografía de la sección 4 (peso 700 en titulares, `title-gold` y eyebrow en hueso en `Home.tsx`).
4. `theme-color`, `og:title` y `og:description` en `index.html`.

**Espera a las imágenes:** texturas (`#2-#7`), esquinas y ranura (`#8-#10`), pictogramas (`#11-#17`, E9-E13, E17), el favicon
y el sistema de logo, `og:image` (E3), hero (E5), carga (E6), barras (E7), y todo lo del Instalador (E14) y el Portal (E1, E2,
E4, E18).

**Al Portal, además** (desde aquí no se toca ese repo): el acento de Tarkor en `src/data/proyectos/tarkor.json` l.7 pasa de
arcilla `#E0703A` a oro `#b8862b`, y `docs/marca.md` l.3-4 deja de decir «pendiente de elegir tipografía»: es Cinzel.

## 8. Orden recomendado

1. Tokens (sección 2) y `theme-color`: un commit, sin cambio visible.
2. `.crystal-sky` a noche y `.gem` engastada: la Home cambia de cielo cristal a noche de marca; comprobar en Helek Sirik
   (`WorldCard.tsx` l.25) que la ficha sigue leyéndose.
3. `.title-gold` + eyebrow en hueso + peso 700 en titulares: el único oro grande de la interfaz.
4. Bordes: `.plank-panel` activo, `.iron-band`, `.skill-slot`, `.corner-bracket-gold`, `.gold-hairline`.
5. Cuando lleguen las imágenes, por bloques y en este orden: favicon y logo; `#2`, `#3`, `#5`, `#6`, `#4`, `#7` (texturas);
   `#16`, `#10`, E6, E7; pictogramas (`#12`, `#13`, `#11`, `#14`, `#15`); `#8`, `#9`, `#17`, E9-E13, E5, E17.
6. En cada paso: que el oro no pase del 10 % de la pantalla ni el brillo del 5 %, que no aparezca nada morado, y que el
   contraste del texto sobre noche y madera se mantenga (los valores de la sección 2).
