# Retro del contenido para la web de Tarkor (2026-10-18)

Lo revisado: lo que entra con el PR a `main` de `docs/producto/tarkor-contenido-web.md` y su `/code-review`,
que encontró 9 cifras erróneas y una nota de P139 que no probaba el arreglo.

**Estado (2026-10-18): ninguna aprobada por la usuaria («de esta retro nada»); no se aplica nada.**

## 1. Las cifras del proyecto, sacadas del código con un script

7 de los 9 fallos eran recuentos tomados de documentos de diseño o mal contados (`ls | wc -l` contaba
`migration_lock.toml`). Propuesta: `tools/qa/cifras.py`, que imprima enums, modelos, migraciones, recuentos del
catálogo y parámetros del narrador desde su fuente.

## 2. `modelfiles/` no tiene el Modelfile del narrador

`modelfiles/llama31-8b-16k.Modelfile` parece el del narrador y es un experimento; el que se usa es
`backend/Modelfile.llama31`. Propuesta: un `modelfiles/README.md` y la indicación en `03-arquitectura.md` §3.3.

## 3. «Comprobado jugando» cita lo que demuestra el arreglo

La nota de P139 citaba «Edificio · Neutro», que no enseña la facción. Propuesta: una línea en el paso 3 de
`docs/runbooks/rondas-de-pruebas.md`.
