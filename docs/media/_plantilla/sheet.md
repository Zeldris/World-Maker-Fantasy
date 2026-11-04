# Sheet: <tema> (AAAA-MM-DD)

La fuente de todo lo que se publica de esta pieza. Lo que no esté aquí, con su fuente, no sale en los canales.
Carpeta de la pieza: `<dir>/AAAA-MM-DD/NN-<tema>/` (NN = número de la pieza del día).

Languages: es, en

## Channels

- x
- reddit
- linkedin
- discord
- web

## What is told

- **In one sentence (for who uses it):** {{…}}
- **In one sentence (technical):** {{…}}
- **Status:** {{publicado en la versión X / fusionado el AAAA-MM-DD / en desarrollo}}

## Verified facts

| Fact | Source |
|---|---|
| {{dato}} | {{archivo, PR, CHANGELOG o enlace donde se comprueba}} |

## Reddit

Solo si `reddit` está en `## Canales`. Por cada subreddit, una línea `Subreddit:` y, debajo, un apartado
`### Normas de r/<nombre>` con las normas pegadas tal cual (200 caracteres como mínimo). Lee las normas y apunta el día:
`Normas leídas:` no puede estar en el futuro ni tener más de 90 días (contados desde la carpeta de fecha de la pieza).
Las tres líneas de campos van antes del primer `###`, y el texto pegado no puede llevar títulos con `#` (pégalos como
líneas normales): un título corta el bloque.

- **Subreddit:** r/{{subreddit}}
- **Rules read:** AAAA-MM-DD
- **Self-promotion:** {{lo que dicen las normas sobre promocionar lo propio, y cómo lo cumple esta pieza}}

### Rules of r/{{subreddit}}

{{pega aquí las normas del subreddit, tal cual}}

## Images

Una fila por cada archivo de `media/` que se usa (`.webp` para X y Discord, `.png` para LinkedIn, `.pdf` para un
carrusel de LinkedIn). El texto alternativo describe lo que se ve de la pieza, con el formato `es: texto / en: text`.
El primer idioma de `Idiomas:` usa `media/<n>.webp`; otro idioma puede tener su propia imagen
`media/<n>.<idioma>.webp` (fuente `<n>.<idioma>.html`), con su fila y el texto alternativo en ese idioma.

| Image | Alt text | Channels |
|---|---|---|
| `media/tarjeta.webp` | es: {{qué se ve}} / en: {{what is shown}} | x, discord |
| `media/tarjeta.png` | es: {{qué se ve}} / en: {{what is shown}} | linkedin |

## Internal use

Lo que sirve al equipo y no se publica: ids de tareas, ramas, PRs y notas. Nada de esto va en los canales.

- {{…}}

## Published

| Channel | Language | Date | Link |
|---|---|---|---|
