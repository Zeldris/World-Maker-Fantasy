# Ficha: sin funciones nuevas hasta haberlo jugado todo (2026-11-02)

La fuente de todo lo que se publica de esta pieza. Lo que no esté aquí, con su fuente, no sale en los canales.
Carpeta de la pieza: `docs/difusion/2026-11-02/07-jugarlo-todo/`.

Idiomas: es, en

## Canales

- x
- discord

## Qué se cuenta

- **En una frase (quien lo usa):** el roadmap está parado: ninguna función nueva hasta haber jugado todo lo ya implementado; van 135 de 139 tareas jugadas.
- **En una frase (técnico):** regla de la usuaria desde el 2026-10-13: las rondas de pruebas juegan y apuntan, otras sesiones arreglan, y la matriz de pruebas y la lista de hallazgos dicen lo que falta.
- **Estado:** regla vigente a 2026-11-02; cifras recalculadas ese día. Es una ronda de pruebas, no una función nueva.

## Hechos comprobados

| Dato | Fuente |
|---|---|
| Hasta cerrar las pruebas no hay roadmap: ninguna tarea nueva hasta haber probado jugando todo lo implementado, del `0.1` al hito en curso (usuaria, 2026-10-13) | `AGENTS.md:55-57` |
| 4 de 139 tareas sin jugar (2 %), es decir, 135 de 139 jugadas | `python3 tools/qa/matriz-pruebas.py`, 2026-11-02 |
| Las 4 sin jugar son del Mundo vivo: 44 de 48 jugadas; las demás áreas (Configuración, Cronista en la interfaz, Dados y tiradas, Interfaz, Mapa de zona, Narrador, Paneles, Reino) están jugadas al completo | Ídem |
| 185 hallazgos comprobados jugando; 45 arreglados, sin comprobar jugando; 32 arreglados en parte; 40 pendientes | `docs/registros/pruebas-0.3-hallazgos.md`, resumen de cabecera («Estado y roadmap»), 2026-11-02 |
| Las rondas de pruebas solo juegan y apuntan; los arreglos se hacen en sesiones aparte | `AGENTS.md:57-59` |
| Se cuenta como ronda de pruebas, no como función nueva | `docs/difusion/README.md`, «Reglas» (honestidad del Portal) |

## Imágenes

Una fila por cada archivo de `medios/` que se usa (`.webp` para X y Discord, `.png` para LinkedIn, `.pdf` para un
carrusel de LinkedIn). El texto alternativo describe lo que se ve de la pieza, con el formato `es: texto / en: text`.
El primer idioma de `Idiomas:` usa `medios/<n>.webp`; otro idioma puede tener su propia imagen
`medios/<n>.<idioma>.webp` (fuente `<n>.<idioma>.html`), con su fila y el texto alternativo en ese idioma.

| Imagen | Texto alternativo | Canales |
|---|---|---|
| `medios/jugarlo-todo.webp` | es: Tarjeta: sin funciones nuevas hasta haberlo jugado todo; 135 de 139 tareas jugadas, 185 hallazgos comprobados jugando y 40 pendientes / en: Card: no new features until we've played everything; 135 of 139 tasks played, 185 findings confirmed by playing and 40 still open | x, discord |
| `medios/jugarlo-todo.en.webp` | en: Card: no new features until we've played everything; 135 of 139 tasks played, 185 findings confirmed by playing and 40 still open | x, discord |

Fuentes en `medios/fuente/` (HTML a 1600x900); se renderizan con
`node .claude/skills/gw-media-content/scripts/render.mjs docs/difusion/2026-11-02/07-jugarlo-todo`.

## Uso interno

Lo que sirve al equipo y no se publica: ids de tareas, ramas, PRs y notas. Nada de esto va en los canales.

- Propuesta P7 de `docs/difusion/propuestas/2026-11-02.md`. Cifras recalculadas el 2026-11-02: coinciden con las de la
  propuesta (135/139, Mundo vivo 44/48, 185 / 45 / 32 / 40).
- La propuesta hablaba de «302 hallazgos»: es la suma de esas cuatro categorías; el total de la lista es mayor (también
  hay 5 no jugables y 23 cerrados sin arreglo), así que los canales no dan ese total.
- «Pendientes» = hallazgos aún sin arreglar. «Comprobados jugando» = hallazgos ya arreglados y vistos funcionar.
- Sin ids de hallazgos ni de tareas en los canales.

## Publicado

| Canal | Idioma | Fecha | Enlace |
|---|---|---|---|
