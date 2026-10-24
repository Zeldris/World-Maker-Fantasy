# gw-media-content en World-Maker-Fantasy

Lo propio de WMF que la skill genérica no dice. Las reglas de contenido están en
[`docs/difusion/README.md`](../../docs/difusion/README.md); aquí, cómo se sacan las imágenes.

## Capturas del juego

1. `bash tools/playwright-e2e/arrancar-juego.sh` (Postgres y Ollama simulado los levanta `.claude/hooks/entorno-nube.sh`).
2. `bash tools/qa/escenario.sh cargar <escenario>`; los de `tools/qa/escenarios/` que dan buena imagen:
   - `mv-pozo-guchapo-conv`: El Pozo de Cauce Viejo, mapa de zona con animales y lugares (Mapa → Zona).
   - `reino-fundado`, `reino-sano-defensas`: el reino con sus edificios y súbditos.
   - `reino-combate-ganable`, `reino-combate-capitan`: un combate en curso.
   - `mv-ganado`, `mv-colmillo-ganado`: ganadería.
3. `nohup node tools/playwright-e2e/driver.mjs … &` y las órdenes con `tools/playwright-e2e/orden.sh "<js>"`
   (detalle en [`rondas-de-pruebas.md`](../../docs/runbooks/rondas-de-pruebas.md)); `shot("nombre",{png:true})`
   guarda en `tools/playwright-e2e/shots/`. Al acabar, `kill $(lsof -ti tcp:9333)`.
4. Recorta lo que importa y guárdalo como JPG (calidad ~88) en `medios/fuente/`:
   `convert shots/x.png -crop 852x630+X+Y -quality 88 docs/difusion/<carpeta>/medios/fuente/captura-<tema>.jpg`.

**Ojo:** el Ollama simulado de la nube escribe texto sin sentido. No se captura el diario, el Cronista ni nada que
narre la IA; para eso, una captura hecha con el modelo real en la Deck (la pide la usuaria).

## Tarjetas y diagramas

Las plantillas HTML de `_plantilla/medios/fuente/` usan la paleta oscura del Portal (fondo `#06121c`, superficie
`#0c1d2b`, borde `#1b3447`, texto `#eaf4fa`, celeste `#1aa6df`) y fuentes locales (DejaVu Sans, Liberation Sans):
se renderizan sin red. Una por idioma (`<nombre>.es.html`, `<nombre>.en.html`).
