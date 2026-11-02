# Ficha: todo lo que se mueve viaja de verdad (2026-11-02)

La fuente de todo lo que se publica de esta pieza. Lo que no esté aquí, con su fuente, no sale en los canales.
Carpeta de la pieza: `docs/difusion/2026-11-02/05-todo-viaja/` (NN = número de la pieza del día).

Idiomas: es, en

## Canales

- reddit
- linkedin
- discord

## Qué se cuenta

- **En una frase (quien lo usa):** caravanas, patrullas, mensajeros y refugiados dejarán de ser una banderita entre dos
  nodos: seguirán una ruta real, te los podrás cruzar en el mapa y preguntarles, comerciar, escoltarlos, asaltarlos o
  dejarlos pasar.
- **En una frase (técnico):** una decisión de diseño: nada que se desplace se resuelve «por detrás» con días y una
  tirada; todo es un viajero con ruta, posición y avance diario, y las facciones usan el mismo motor que la jugadora.
- **Estado:** en desarrollo (plan: la infraestructura en el hito 0.3 y el paso a viajeros, `CR-64`, en el 0.4). Es un plan y una decisión de diseño, no algo hecho: en los canales
  se dice «en el plan» y «lo que viene».

## Hechos comprobados

| Dato | Fuente |
|---|---|
| Decisión de diseño: nada que se desplace en el mundo se resuelve «por detrás» con días y una tirada («como en X4: Foundations») | `docs/adr/0003-todo-viaja-de-verdad.md:1-4` |
| Expediciones, caravanas, partidas de caza o captura, patrullas, refugiados, mensajeros y visitantes serán **viajeros**: siguen una ruta real de zona en zona (los enlaces entre lugares y, dentro de cada zona, sus celdas) y avanzan cada día | Ídem, líneas 4-6 |
| La jugadora puede cruzarse con ellos en el mapa: preguntarles por las regiones que han atravesado, comerciar, escoltarlos, asaltarlos o dejarlos pasar | Ídem, líneas 6-8 |
| Lo que les ocurra por el camino (un asalto, una pelea con fauna) pasa en el sitio donde estén, en vivo si ella está y de fondo si no | Ídem, líneas 8-9 |
| Se descarta lo que existía: viajes abstractos con día de salida y de vuelta y un riesgo tirado al llegar, visibles solo como una banderita entre dos nodos del mapa | Ídem, líneas 11-13 |
| Las facciones usan los mismos sistemas que la jugadora: con el mismo motor y las mismas reglas, como las IA de X4 usan las mismas naves y órdenes que el jugador; cada mecánica se prueba también para ellas | Ídem, líneas 15-19 |
| La auditoría de lo que hoy es invisible y su paso a viajeros es trabajo pendiente (tarea de roadmap) | `docs/adr/0003-todo-viaja-de-verdad.md:13`; `docs/producto/plan-roadmap-0.3.md:279-282` |
| El plan fija cómo se interactúa al cruzarte: preguntar qué han visto en cada lugar, comerciar y, con los tuyos, darles órdenes; atacar y escoltar, más adelante | `docs/producto/plan-roadmap-0.3.md:283-284` |
| Tarkor: un juego de rol por texto con IA local como directora de juego; el motor decide con tiradas y el narrador solo cuenta lo que ya pasó | `docs/producto/tarkor-contenido-web.md:41-44` y `:66-68` |
| El mundo tiene 9 facciones con población, economía, expediciones, caravanas y ejércitos | `docs/producto/tarkor-contenido-web.md:56` |

## Reddit

- **Perfil:** u/Alvaro-Garcia-Grana

## Imágenes

| Imagen | Texto alternativo | Canales |
|---|---|---|
| `medios/viajeros.webp` | es: Diagrama «En el plan»: de «sale y vuelve con una tirada» a «viaja de zona en zona por una ruta real»; sale, sigue una ruta real, te lo cruzas y pasa donde está / en: Diagram marked “In the plan”: from “leaves and returns after a dice roll” to “travels zone by zone along a real route”; it sets out, follows a real route, you cross paths and it happens where it is | discord, reddit |
| `medios/viajeros.en.webp` | en: Diagram marked “In the plan”: from “leaves and returns after a dice roll” to “travels zone by zone along a real route”; it sets out, follows a real route, you cross paths and it happens where it is | discord, reddit |
| `medios/viajeros.png` | es: Diagrama «En el plan»: de «sale y vuelve con una tirada» a «viaja de zona en zona por una ruta real»; sale, sigue una ruta real, te lo cruzas y pasa donde está / en: Diagram marked “In the plan”: from “leaves and returns after a dice roll” to “travels zone by zone along a real route”; it sets out, follows a real route, you cross paths and it happens where it is | linkedin |
| `medios/viajeros.en.png` | en: Diagram marked “In the plan”: from “leaves and returns after a dice roll” to “travels zone by zone along a real route”; it sets out, follows a real route, you cross paths and it happens where it is | linkedin |

Fuentes en `medios/fuente/` (`viajeros.html`, `viajeros.en.html`, 1600x900); se renderizan con
`node .claude/skills/gw-media-content/scripts/render.mjs docs/difusion/2026-11-02/05-todo-viaja`.

## Uso interno

Propuesta P5 de `docs/difusion/propuestas/2026-11-02.md`. Tarea de roadmap: `CR-64` (`docs/producto/roadmap-cronista.md`,
línea 1849; hito `0.4` salvo la infraestructura). Decisión de la usuaria del 2026-10-07 (ronda de `CR-61`/`CR-63`).

**Ojo al publicar:** `CR-63` (partidas de caza y captura como viajeros, la infraestructura de `CR-64`) ya está
fusionada en `main` (`docs/producto/roadmap-cronista.md:1796`, ✅ 2026-10-07). Por eso la pieza no dice que «nada»
viaje hoy: dice que la decisión es de diseño y que lo que falta pasar es el resto (expediciones, caravanas,
patrullas, refugiados, mensajeros…). Esta pieza no publica el hito de cada tarea: la propuesta habla del `0.3` y el
roadmap pone `CR-64` en el `0.4`; la ficha sigue el roadmap.

## Publicado

| Canal | Idioma | Fecha | Enlace |
|---|---|---|---|
