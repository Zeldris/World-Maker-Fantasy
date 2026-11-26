# 2026-11-26 · gw-worker · pending · QA-531

## Why

El registro solo recibía `intento` de `narrar`; `dialogo_npc` y `narrar_respaldo` no decían por qué se reintentaba. Se añade la opción `rechazoPrevio` a `ollamaGenerate`, que va a `app.rechazo` en la línea de la llamada (mismo campo que ya usa el evento `rechazo`).

## Alternatives

Un campo nuevo `motivo_rechazo`: descartado, el registro ya tiene `app.rechazo`. Un evento extra por reintento: más ruido en el JSONL.

## Changed because

—
