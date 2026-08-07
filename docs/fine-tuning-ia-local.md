# Fine-tuning de un narrador local propio — guía paso a paso

Esta guía es para la parte que la Steam Deck no puede hacer (entrenar necesita una GPU que la Deck
no tiene) — se hace UNA VEZ, en una web gratuita de Google llamada **Colab**, y al final descargas
un único archivo que traes de vuelta a tu ordenador. No hace falta saber programar en Python ni
entender de IA: son copiar-pegar en el sitio exacto que se indica en cada paso.

**Qué vamos a conseguir**: un modelo de IA propio, entrenado con ejemplos reales de vuestro juego,
que luego correrá en tu Deck exactamente igual que el que ya usáis ahora (mismo Ollama, mismo
Modelfile), pero mejor afinado a Tarkor.

**Vocabulario que vas a ver y qué significa**:
- **Colab**: una web de Google donde se puede ejecutar código con una tarjeta gráfica gratis, sin
  instalar nada. Solo hace falta una cuenta de Google (la misma de Gmail).
- **Notebook**: la "hoja de trabajo" de Colab — una página dividida en cajas ("celdas") de código
  que se ejecutan una a una, de arriba a abajo, con un botón de "play".
- **GPU / T4**: el tipo de tarjeta gráfica gratuita que da Colab. Sin ella, esto no funciona.
- **Unsloth**: la herramienta que hace el entrenamiento en sí — ya viene programada dentro del
  notebook, tú no escribes esa parte.
- **GGUF**: el formato de archivo final que necesita Ollama para poder usar el modelo entrenado.

---

## Paso 0 — Generar los datos de entrenamiento (esto ya está hecho)

Si alguna vez quieres volver a hacerlo con más ejemplos, en una terminal dentro de la carpeta
`backend/` del proyecto:

```
npm run generate-distillation-dataset
npm run split-distillation-dataset
```

Esto ya se ha ejecutado — el resultado son dos archivos que vas a necesitar en el Paso 3:

```
backend/output/distillation-dataset/train.jsonl   (191 ejemplos, para entrenar)
backend/output/distillation-dataset/eval.jsonl    (32 ejemplos, para comparar después — no lo subas a Colab)
```

## Paso 1 — Abrir el notebook en Colab

1. Abre este enlace en tu navegador (te llevará directo a Colab, con el notebook ya cargado):

   **https://colab.research.google.com/github/unslothai/notebooks/blob/main/nb/Mistral_v0.3_(7B)-Conversational.ipynb**

2. Inicia sesión con tu cuenta de Google si te lo pide.

> **¿Por qué pone "Mistral" si queremos Qwen?** Este notebook es la plantilla oficial de Unsloth
> que mejor encaja con el formato de nuestros datos — en el Paso 4 cambiamos una sola línea para
> que entrene el modelo correcto (Qwen2.5, el mismo que ya usa vuestro juego). El nombre del
> archivo no importa, el contenido sí.

## Paso 2 — Activar la GPU gratuita

Arriba del todo, en el menú:

**Entorno de ejecución** (o **Runtime**, si Colab te sale en inglés) → **Cambiar tipo de entorno de
ejecución** (**Change runtime type**) → elige **T4 GPU** → botón **Guardar** (**Save**).

Sin este paso, el entrenamiento no funcionará o irá muchísimo más lento.

## Paso 3 — Subir tu archivo de datos

1. En el borde izquierdo de la pantalla de Colab hay una columna de iconos verticales — haz clic
   en el que parece una **carpeta** 📁 (icono de archivos).
2. Se abre un panel a la izquierda. Haz clic en el icono de **subir archivo** (una hoja con una
   flecha hacia arriba) que hay arriba de ese panel.
3. Selecciona `train.jsonl` desde `backend/output/distillation-dataset/` en tu ordenador.
4. Espera a que aparezca en la lista del panel (tarda unos segundos). Su ruta dentro de Colab será
   `/content/train.jsonl` — la vamos a usar tal cual en el Paso 4.

**Importante**: si cierras la pestaña o Colab se desconecta, este archivo subido se pierde y hay
que volver a subirlo (es rápido, no pasa nada).

## Paso 4 — Ejecutar las celdas, cambiando 3 cosas

Ve ejecutando las celdas del notebook **una por una, de arriba a abajo**, con el botón de play ▶️
que aparece a la izquierda de cada celda al pasar el ratón por encima (o seleccionando la celda y
pulsando `Ctrl+Enter`). Espera a que cada una termine (el circulito de la izquierda deja de girar)
antes de pasar a la siguiente.

La mayoría de celdas no hay que tocarlas — ejecútalas tal cual. Solo hay **3 celdas** donde tienes
que cambiar algo:

### 4.1 — Celda de instalación (primera celda del notebook)

No cambies nada. Solo ejecútala y espera (puede tardar 1-2 minutos).

### 4.2 — Celda donde carga el modelo (busca la palabra `model_name`)

Busca una línea parecida a esta:

```python
model_name = "unsloth/mistral-7b-instruct-v0.3-bnb-4bit",
```

**Cámbiala por**:

```python
model_name = "unsloth/Qwen2.5-7B-Instruct-bnb-4bit",
```

Deja el resto de la celda igual (`max_seq_length`, `load_in_4bit = True`, etc. — no los toques).
Ejecuta la celda.

### 4.3 — Celda donde carga el dataset (busca `load_dataset`)

Esta celda tiene código para cargar un dataset de ejemplo con un formato distinto al nuestro —
**borra todo el contenido de esa celda** y pega esto en su lugar:

```python
from datasets import load_dataset

dataset = load_dataset("json", data_files="/content/train.jsonl", split="train")

def formatting_prompts_func(examples):
    convos = examples["messages"]
    texts = [tokenizer.apply_chat_template(convo, tokenize=False, add_generation_prompt=False) for convo in convos]
    return {"text": texts}

dataset = dataset.map(formatting_prompts_func, batched=True)
```

Ejecuta la celda. Si sale un error mencionando `tokenizer`, asegúrate de haber ejecutado antes la
celda del Paso 4.2 (el `tokenizer` se crea ahí).

### 4.4 — Celda de configuración del entrenamiento (busca `max_steps`)

Busca esta línea:

```python
max_steps = 60,
```

**Cámbiala por**:

```python
num_train_epochs = 3,
```

(Bórrala y escribe la nueva en su lugar, en el mismo sitio.) El resto de esa celda
(`per_device_train_batch_size`, `learning_rate`, etc.) déjalo igual. Ejecuta la celda.

### 4.5 — Celda de entrenamiento (`trainer.train()`)

No cambies nada. Ejecútala y **espera** — con 191 ejemplos, debería tardar entre **20 y 40
minutos** en la GPU gratuita. Verás una barra de progreso y números bajando poco a poco (la
"pérdida"/`loss` — cuanto más baja, mejor está aprendiendo). Puedes dejar la pestaña abierta y
hacer otra cosa mientras tanto; si Colab te desconecta por inactividad, vuelve a esta página,
reconéctate y sigue ejecutando desde donde se quedó.

## Paso 5 — Exportar el resultado

Busca la celda que contiene esto (suele estar cerca del final, con varias opciones parecidas, cada
una empezando por `if False:`):

```python
if False: model.save_pretrained_gguf("model", tokenizer, quantization_method = "q4_k_m")
```

Cambia **solo esa línea** de `if False:` a `if True:`:

```python
if True: model.save_pretrained_gguf("tarkor-narrador-finetuned", tokenizer, quantization_method = "q4_k_m")
```

(Deja las demás líneas con otros métodos de cuantización tal como están, en `if False:` — no las
necesitamos.) Ejecuta la celda — tarda varios minutos, está convirtiendo y comprimiendo el modelo.

Al terminar, vuelve al panel de archivos (icono de carpeta 📁 de la izquierda). Debería aparecer un
archivo `.gguf` (varios GB). Haz clic derecho sobre él → **Descargar** (**Download**). Tardará un
rato en descargarse por su tamaño.

## Paso 6 — Traerlo de vuelta a la Steam Deck

1. Mueve el archivo `.gguf` descargado a esta ruta exacta del proyecto (crea la carpeta `models`
   si no existe):

   ```
   backend/models/tarkor-narrador-finetuned.gguf
   ```

2. `backend/Modelfile.finetuned` ya está preparado (con el mismo bloque `SYSTEM` que usa el juego
   ahora mismo) — no hace falta crearlo a mano, ya existe en el repo.

3. En una terminal, dentro de `backend/`:

   ```
   ollama create tarkor-narrador-v2 -f Modelfile.finetuned
   ```

   Esto registra el modelo nuevo en Ollama con el nombre `tarkor-narrador-v2` — **no toca ni
   sobrescribe** el modelo actual (`tarkor-narrador`), así que el juego sigue funcionando igual
   que siempre hasta que decidáis cambiar a este.

## Paso 7 — Compararlo contra el modelo actual (Fase 3, ya lista)

El script de comparación ya está construido: `backend/src/scripts/compare-narrador-models.ts`.
En cuanto `tarkor-narrador-v2` exista en Ollama (paso anterior), dentro de `backend/`:

```
npm run compare-narrador-models
```

Esto re-narra los 32 escenarios de `eval.jsonl` (nunca vistos en el entrenamiento) con los dos
modelos, mide latencia, y puntúa con los mismos detectores automáticos que protegen el juego real
(anacronismo, fuga de inglés, golpes/objetos/viajes narrados sin respaldo mecánico, NPCs muertos
"resucitados", slugs de combate inventados). Al final imprime un veredicto: si el candidato
introduce una sola regresión nueva respecto al actual, queda **bloqueado** aunque mejore de media —
solo si no hay regresiones y mejora, indica el cambio a hacer en `backend/.env`
(`OLLAMA_MODEL_NARRADOR="tarkor-narrador-v2"`) y reiniciar el backend.
