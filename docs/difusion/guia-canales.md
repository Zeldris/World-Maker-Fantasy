# Guía de canales

Una misma actualización se cuenta distinto en cada sitio. La voz común es la del Portal: **cercana, concreta y
honesta**, sin vender. Se enseña lo que hay, con sus pendientes, y se invita a mirar o a sumarse.

## Twitter/X

- **Para qué:** que alguien vea una imagen o una frase y entre al Portal.
- **Formato:** hilo de 2 a 4 mensajes de **280 caracteres como mucho** (un enlace cuenta 23). El primero se sostiene
  solo y lleva la imagen.
- **Tono:** directo, una idea por mensaje; un emoji como mucho por mensaje.
- **Etiquetas:** 1-2 al final del primero: `#gamedev`, `#indiedev`, `#RPG`, `#LocalAI`, `#IA` (en `es`).
- **Enlace:** en el último mensaje, al Portal o a la ficha de Tarkor.

## LinkedIn

- **Para qué:** lo que estamos aprendiendo; es el canal del taller, no del juego.
- **Formato:** 800-1.300 caracteres. Las dos primeras líneas tienen que enganchar (es lo que se ve antes de «ver más»).
  Párrafos cortos y una lista breve si ayuda. Una imagen o un carrusel.
- **Tono:** profesional pero en primera persona del plural; un reto, cómo lo resolvimos y qué aprendimos.
- **Etiquetas:** 3-5 al final: `#DesarrolloDeSoftware`, `#IA`, `#GameDev`, `#TypeScript`, `#Testing`.
- **Enlace:** al final del texto (LinkedIn penaliza menos que en la primera línea).

## Reddit

- **Para qué:** conversación con comunidades que valoran el detalle.
- **Dónde:** según el tema. Técnico: `r/gamedev`, `r/IndieDev`, `r/LocalLLaMA` (si va de IA local). Juego y lore:
  `r/rpg_gamers`, `r/worldbuilding` (solo lore, sin vender). En español: `r/programacion`, `r/videojuegos`.
- **Antes de publicar:** leer las normas del subreddit; muchos limitan la autopromoción (regla del 10 %) o piden un
  día concreto (p. ej. «Screenshot Saturday» en `r/gamedev`).
- **Formato:** título descriptivo, sin clickbait. Cuerpo en Markdown: contexto, lo que hicimos, lo que salió mal y
  una pregunta abierta al final. El enlace, al final o en un comentario.
- **Tono:** de igual a igual; se reconoce lo que falta.

## Discord

- **Para qué:** el aviso a la comunidad propia (servidor de Galivelop), con más detalle y cercanía.
- **Formato:** Markdown de Discord: `##` para el título, listas con `-`, `**negrita**`, `||spoiler||` para lore que
  destripa algo. Hasta 2.000 caracteres por mensaje. Imágenes adjuntas o enlazadas.
- **Tono:** cercano, con algo de humor; se invita a probar y a comentar en el canal.
- **Estructura:** título con emoji → qué hay de nuevo → detalle técnico breve → curiosidad de lore → qué viene.

## Portal (web)

- **Dónde:** `src/data/proyectos/tarkor.json` del repo
  [Portal-Galivelop](https://github.com/Zeldris/portal-galivelop), lista `novedades`.
- **Formato:** `{ "fecha": "AAAA-MM-DD", "texto": { "es": "…", "gl": "…", "en": "…" } }`. Una o dos frases, unos
  150-250 caracteres por idioma, como las que ya hay. La más nueva va primero.
- **Además, si toca:** `actualizado` (fecha), `fase`, `hitos`, `cifras` e imágenes nuevas (WebP de unos 1.600 px más
  su `-mini` de unos 720 px en `public/proyectos/tarkor/`). Ver `docs/desarrollo.md` del Portal.
- **Tono:** el de las novedades que ya hay: qué puede hacer ahora quien juega, sin tecnicismos.
