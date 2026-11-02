# Ficha: la enciclopedia contradecía al canon (2026-11-02)

La fuente de todo lo que se publica de esta pieza. Lo que no esté aquí, con su fuente, no sale en los canales.
Carpeta de la pieza: `docs/difusion/2026-11-02/08-enciclopedia-canon/` (propuesta P8).

Idiomas: es, en

## Canales

- x
- reddit
- linkedin

## Qué se cuenta

- **En una frase (quien lo usa):** auditamos la enciclopedia del juego contra el lore escrito y encontramos notas de
  diseño a la vista y fichas que decían otra cosa; ya está corregido.
- **En una frase (técnico):** una auditoría por bloques contra el canon, correcciones aplicadas con aprobación, ocho
  habilidades renombradas por clase (las partidas guardadas se ponen al día al cargarlas) y un test que impide que
  vuelvan notas internas o secretos de trama a lo visible.
- **Estado:** fusionado en `main` (2026-10-25). Es un fallo propio y su arreglo, no una función nueva. Queda pendiente
  la historia que falta en el canon y las imágenes de las ocho habilidades renombradas.

## Hechos comprobados

| Dato | Fuente |
|---|---|
| La enciclopedia decía cosas que el canon o el motor no dicen; se auditó por bloques contra el canon y cada arreglo se aplicó con el sí de la usuaria | `docs/registros/pr/claude/lore-enciclopedia.md:5-6` |
| Notas de diseño fuera de 26 lugares | Ídem, líneas 14 y 60 |
| Región y población corregidas en 18 animales | Ídem, línea 14 |
| Región corregida en 11 plantas; antes, once plantas de fuera de las Llanuras no tenían región y el test solo miraba la fauna | Ídem, líneas 14-15 y 59 |
| Ocho habilidades se llamaban igual en clases distintas (el Asesino Selecto tenía dos «Golpe Certero»); renombradas según la clase | Ídem, líneas 12 y 58 |
| Las partidas guardadas se ponen al día al cargarlas | Ídem, líneas 19-20 |
| Un test impide notas de diseño y secretos de trama en lo visible | Ídem, línea 70 |
| Los tests nuevos fallan sin su arreglo | Ídem, líneas 83-84 |
| Se dejó escrito auditar el lore en tandas pequeñas | Ídem, líneas 49-50 |
| Fusionado en `main` el 2026-10-25 | `docs/registros/traspaso.md`, fila `claude/lore-enciclopedia` |

## Reddit

- **Perfil:** u/Alvaro-Garcia-Grana

## Imágenes

| Imagen | Texto alternativo | Canales |
|---|---|---|
| `medios/tarjeta.webp` | es: Tarjeta: «Nuestra enciclopedia contradecía a nuestro propio canon», con tres cifras: 26 lugares con notas de diseño a la vista, 18 animales con región y población corregidas y 11 plantas con la región corregida / en: Card: "Our encyclopedia contradicted our own canon", with three figures: 26 places with design notes in plain sight, 18 animals with region and population corrected and 11 plants with the region corrected | x, reddit |
| `medios/tarjeta.en.webp` | en: Card: "Our encyclopedia contradicted our own canon", with three figures: 26 places with design notes in plain sight, 18 animals with region and population corrected and 11 plants with the region corrected | x, reddit |
| `medios/tarjeta.png` | es: Tarjeta: «Nuestra enciclopedia contradecía a nuestro propio canon», con tres cifras: 26 lugares con notas de diseño a la vista, 18 animales con región y población corregidas y 11 plantas con la región corregida / en: Card: "Our encyclopedia contradicted our own canon", with three figures: 26 places with design notes in plain sight, 18 animals with region and population corrected and 11 plants with the region corrected | linkedin |
| `medios/tarjeta.en.png` | en: Card: "Our encyclopedia contradicted our own canon", with three figures: 26 places with design notes in plain sight, 18 animals with region and population corrected and 11 plants with the region corrected | linkedin |

## Uso interno

Propuesta P8. Tareas `QA-243` y `QA-245`…`QA-248`; rama `claude/lore-enciclopedia` (fusionada sin PR, CI local,
`QA-215`). El test es `catalogoSinNotasInternas.test.ts`; el de regiones, `floraConFicha.test.ts`. El post de Reddit
no cita los archivos. La propuesta decía «r/gamedev»: el encargo lo cambia al perfil propio.

## Publicado

| Canal | Idioma | Fecha | Enlace |
|---|---|---|---|
