# Difusión: contenido para redes y para el Portal

Material listo para publicar sobre Tarkor (World-Maker-Fantasy): actualizaciones técnicas, lore, imágenes y lo que
se puede ver y jugar en la app. Cada actualización sale en **español e inglés** para Twitter/X, LinkedIn, Reddit y
Discord, y como entrada de «Novedades» del [Portal Galivelop](https://zeldris.github.io/Portal-Galivelop/).

## Estructura

```text
docs/difusion/
  README.md                  este archivo: qué hay, de dónde sale y cómo se prepara
  guia-canales.md            tono, longitud y formato de cada red, y del Portal
  _plantilla/                se copia entera para cada actualización nueva
    ficha.md                 los hechos comprobados y las imágenes: la fuente de todo lo demás
    twitter.md  linkedin.md  reddit.md  discord.md  web.md
    medios/fuente/           plantillas HTML de tarjeta y diagrama (1600x900, paleta del Portal)
  AAAA-MM-DD-<tema>/         una carpeta por actualización, con los mismos archivos que _plantilla/
    medios/                  las imágenes propias en WebP (+ su -mini), renderizadas desde medios/fuente/
```

La skill `gw-media-content` (`.claude/skills/gw-media-content/`) prepara una carpeta entera o completa una que ya
existe con lo que falte por publicar, para los canales que se pidan, imágenes incluidas.

Una actualización es una carpeta: se escribe la `ficha.md` primero y cada canal sale de ella. Así una cifra o un
nombre se corrige en un solo sitio.

## Cómo se prepara una actualización

1. `cp -r docs/difusion/_plantilla docs/difusion/AAAA-MM-DD-<tema>` (fecha de lo que se cuenta).
2. **Ficha:** qué cambió, en lenguaje de jugador y en lenguaje técnico, con la fuente de cada dato.
3. **Medios:** tarjeta y diagrama desde `medios/fuente/` (uno por idioma), capturas del juego en JPG en la misma
   carpeta, y `node .claude/skills/gw-media-content/scripts/render.mjs docs/difusion/<carpeta>`. Cada imagen, en la
   tabla `## Imágenes` de la ficha. Cómo sacar capturas: [`.claude/gw/gw-media-content.md`](../../.claude/gw/gw-media-content.md).
4. **Canales:** cada archivo de canal pedido, en `es` y en `en`, siguiendo [`guia-canales.md`](guia-canales.md); los
   que no se piden se borran.
5. **Repaso:** la lista de comprobación de abajo. Al publicar, se apunta en la ficha dónde y cuándo.

## De dónde sale el material

| Tipo | Fuente | Ojo con |
|---|---|---|
| Lo que cambia en el juego | La entrada de la tarea en su roadmap (`docs/producto/`), las «Novedades» del Portal | Solo lo fusionado en `main` |
| Técnico | Las descripciones de PR (`docs/registros/pr/`), los ADR (`docs/adr/`), `docs/arquitectura/` | Cifras de tests y tiempos tal y como salen ahí |
| Lore | El canon aprobado: `docs/canon-opencode/` (resumen) y `docs/rpgtarkor/` (manda si chocan) | Nunca `docs/borradores-opencode/`: no es canon |
| Imágenes | Las ya publicadas en el Portal (`https://zeldris.github.io/Portal-Galivelop/proyectos/tarkor/…`) | Se enlazan, no se copian aquí |
| Capturas, tarjetas y diagramas nuevos | El juego levantado y las plantillas de `medios/fuente/` | Sin datos de partidas personales ni texto del Ollama simulado |

## Reglas

- **El lore no se inventa.** Se cita o se resume el canon aprobado; una idea nueva va a
  `docs/borradores-opencode/propuestas-lore.md` como propuesta, nunca a una publicación.
- **Nada sin fusionar.** Lo que no está en `main` no se anuncia como hecho; si se adelanta, se dice «en desarrollo».
- **Sin jerga interna.** Ni P-números, ni ids de tareas, ni nombres de ramas en el texto público (sí en la ficha).
- **Honestidad del Portal:** se enseña el proyecto tal y como está, con sus pendientes. Una ronda de pruebas se
  cuenta como ronda de pruebas, no como una función nueva.
- **Idiomas:** `es` y `en` en todos los canales. El Portal exige además `gl` en sus textos (`src/data/tipos.ts`),
  así que `web.md` lleva los tres.
- **Imágenes:** las del Portal se enlazan; las propias van a `medios/` en WebP. Cada una con su texto alternativo
  en los dos idiomas.

## Lista de comprobación antes de publicar

`python3 .claude/skills/gw-media-content/scripts/comprobar.py docs/difusion/<carpeta>` comprueba lo mecánico (huecos
de plantilla, jerga, longitud en X, el JSON de `web.md`, imágenes renderizadas y listadas); el resto, a mano:

- [ ] Cada dato de los canales está en la ficha, con su fuente.
- [ ] El lore citado está en `docs/canon-opencode/` o `docs/rpgtarkor/`.
- [ ] Twitter/X: cada mensaje en 280 caracteres o menos (los enlaces cuentan 23).
- [ ] Las imágenes abren y llevan texto alternativo.
- [ ] El inglés se lee natural, no como traducción literal.
- [ ] `web.md` tiene `es`, `gl` y `en`, y la fecha en `AAAA-MM-DD`.
