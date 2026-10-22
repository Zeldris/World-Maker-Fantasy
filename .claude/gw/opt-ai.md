<!-- galivelop-workflow v0.2.0 -->
# opt-ai — notas del proyecto

Las lee primero la skill `opt-ai`; aquí vive todo lo propio de los modelos de IA local de este proyecto. El flujo
las crea una vez; desde entonces son del proyecto.

## Motores y modelos

<!-- Qué motor usa cada tarea y dónde viven los nombres de los modelos (un archivo de config; nunca copiarlos aquí). -->

## Tareas

<!-- Los valores de app.task que emite el código, y los que se excluyen (llamadas de calentamiento). -->

## Perfiles de máquina

<!-- Nombres (app.machine_profile), cuál es el mínimo (siempre se mide), cómo se fija el perfil y cómo se activa el
     registro. -->

## Ajustes

Los lee `scripts/medir.py` de la skill; las rutas relativas se resuelven desde la raíz del repo.

```opt-ai
# log: <registro por llamada de esta ronda>
# previous: <el registro de la ronda anterior>
exclude_tasks: warmup
cold_ms: 100
```

## Banco de pruebas

<!-- La orden que repite un escenario fijo con el registro activado, y cuánto tarda. -->

## Casos de calidad

<!-- La orden que evalúa la recuperación con un conjunto fijo de casos, dónde están y dónde se apuntan los hallazgos. -->

## Tiempos aceptables

<!-- Por tarea, una vez medidos. -->

## Ya en marcha

<!-- Cada herramienta o ajuste aprobado antes, una línea cada uno, para no volver a proponerlo. -->
