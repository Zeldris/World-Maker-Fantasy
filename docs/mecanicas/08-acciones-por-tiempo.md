# Sistema de acciones por tiempo (diseño, 2026-07-17)

**Estado:** implementado (2026-07-18) — `banda`/`duracionEstimadaMinutos` en `classifyAction`, `POST /turn` dividido en `POST /turn/classify` (rápido) + `POST /turn/narrate` (lento, solo instantánea/corta), fórmulas deterministas en `backend/src/services/timedActions.ts`, `CharacterTransit` real para extendida/larga con resolución en `worldTick`, contador visual en el frontend (`GameView.tsx`).
**Origen:** idea de la usuaria (contador visual de tiempo mientras la IA resuelve una acción larga como "cortar leña 5 min"), ampliada con patrones de D&D (bandas de tiempo, downtime activities, grados de éxito) y calibrada con los tiempos reales medidos hoy en este hardware.

---

## 1. El problema que resuelve

Hoy toda acción del jugador —instantánea o no— pasa por el mismo camino: clasificar → tirar → narrar, y el jugador espera el turno completo en silencio (con texto ambiental, pero sin relación real con lo que está pasando). Para acciones que en la ficción llevan tiempo (cortar leña, viajar, construir), eso es una oportunidad perdida: el tiempo de espera real (30s-4min en este hardware) puede mapearse al tiempo que la acción tarda *dentro del juego*, en vez de ser un vacío.

## 2. Bandas de tiempo

| Banda | Duración en ficción | Ejemplos | Resolución |
|---|---|---|---|
| **Instantánea** | segundos | examinar, hablar, atacar, esquivar | Igual que hoy: clasificar → tirar → narrar, sin cambios. |
| **Corta** | minutos | cortar leña un rato, buscar en una zona, primeros auxilios | Clasificar → fórmula determinista de duración/producción → contador visual en vivo mientras narrar corre de fondo → resultado. |
| **Extendida** | horas | descanso corto, tramo de viaje, vigilar un campamento | Igual que "corta" pero con `CharacterTransit`: el personaje queda "ocupado hasta X" en tiempo de ficción; si la sesión sigue abierta, se puede seguir mostrando progreso. |
| **Larga** | días+ | construir un campamento, viaje regional, curarse de una herida grave | `CharacterTransit` puro: la petición responde casi al instante ("Gorhorn se pone a ello, estará ocupado unos días"), y el resultado se narra en diferido — al volver a la partida o cuando el worker de reloj de mundo resuelva el tránsito. El jugador nunca espera el coste de narrar en el momento. |

## 3. Clasificación — sin coste nuevo

La llamada de clasificar que ya existe (`classifyAction`, modelo pequeño, ~25s) se amplía para devolver, en el mismo JSON, dos campos nuevos:

```
{
  "requiereTirada": bool,
  "atributo": "...",
  "dificultad": 8|12|15|18|22,
  "razon": "...",
  "banda": "instantanea" | "corta" | "extendida" | "larga",
  "duracionEstimadaMinutos": number   // 0 si banda = instantanea
}
```

No hace falta una segunda IA para esto — es la misma llamada, con un poco más de JSON de salida. Coste real: el mismo ~25s que ya pagamos hoy por clasificar.

## 4. Duración y producción — fórmulas deterministas, no IA

Igual que la tirada de dados (decisión técnica ya cerrada: el motor de dados es determinista, no lo decide la IA), la duración exacta y la producción de una acción por tiempo las calcula el backend con una fórmula sobre los atributos, **no una llamada a IA**. Ejemplos:

- **Cortar leña**: `madera_por_minuto = base + floor(fuerza / 4)`. Gorhorn (fuerza 18) → ritmo alto.
- **Viajar**: `minutos_por_tramo = distancia_base / (1 + destreza / 20)`. Ithren (destreza 15) viaja más rápido que Amonir (destreza 8).
- **Construir un campamento**: duración fija por tipo de estructura, reducida por fuerza/voluntad según el caso.

Coste real: ~0s — es una operación en memoria, no una llamada a Ollama.

## 5. Grados de éxito (inspirado en D&D, reusando el roll ya existente)

En vez de éxito/fallo binario para acciones por tiempo, se añade una tercera zona derivada del mismo resultado de la tirada que ya se calcula (`d20 + atributo/2` vs dificultad):

- **Éxito claro**: resultado ≥ dificultad + 5.
- **Éxito con coste**: resultado entre dificultad y dificultad + 4 (se completa la acción, pero con un precio narrativo — se tarda más, se gasta un recurso, algo se resiente).
- **Fallo**: resultado < dificultad.

No añade ninguna llamada nueva — es una lectura distinta del mismo número que el sistema de dados ya produce hoy.

## 6. Eventos durante la acción — reutiliza `/entorno`, no una IA nueva

Igual que el generador de alrededores ya decide con su propio dado interno (`Math.random() < 0.25`) si surge un evento, una acción por tiempo puede tirar ese mismo tipo de dado backend antes de narrar: si toca evento, se le indica al **narrar** (la misma llamada que ya se iba a hacer) que incluya una interrupción — usando los ganchos de aventura ya escritos en `docs/rpgtarkor/personajes/personajes.md`. Cero llamadas nuevas a Ollama.

## 7. Piezas existentes que esto conecta

Esta idea no es un sistema nuevo aislado — le da uso real a varias piezas que llevábamos meses diseñando y dejando pendientes:

- **`CharacterTransit`** (en `schema.prisma` desde el diseño original, nunca implementado): el mecanismo de "ocupado hasta X" para las bandas extendida/larga.
- **Condición física** (pendiente desde `06-decisiones-mecanicas.md`): lo que mejora al descansar (banda extendida/larga).
- **`InventoryItem`** (creado hoy, sin uso todavía): el resultado de fabricar/recolectar en una acción corta o extendida.
- **Ganchos de aventura** (`docs/rpgtarkor/personajes/personajes.md`): la fuente de eventos que pueden interrumpir una acción larga.
- **Worker de reloj de mundo** (`worldTick.ts`, hoy solo actualiza `lastTickedAt`): el que resolvería los `CharacterTransit` cuya `busyUntil` ya haya pasado cuando el jugador vuelva.

## 8. Presupuesto de tiempo real (basado en los benchmarks de hoy)

| Paso | Coste medido hoy | ¿Cambia con este sistema? |
|---|---|---|
| Recuperación de lore (RAG) | 1-2s | No cambia. |
| Clasificar (modelo pequeño, sin lore) | ~24-26s | No cambia — solo devuelve más campos en el mismo JSON. |
| Cálculo de duración/producción | — | Nuevo, pero ~0s (fórmula, no IA). |
| Narrar (modelo grande, con lore) | 30-220s, muy variable | No cambia para banda instantánea/corta. |
| **Total banda instantánea/corta** | **~55-250s** | **Igual que hoy** — el contador visual no acelera nada, solo hace la misma espera más legible. |
| **Total banda extendida/larga** | — | **Mejora real**: la petición responde en ~25-28s (solo clasificar + fórmula), sin esperar narrar. La narración del resultado se genera después, en diferido, cuando se resuelve el tránsito — el jugador nunca paga el coste de los 30-220s de narrar en el momento. |

**Conclusión del presupuesto:** cuanto más desgranamos las acciones largas hacia `CharacterTransit`, más barato se vuelve el sistema en tiempo de espera real — no más caro. Las acciones instantáneas/cortas no cambian de coste, solo de percepción (contador visual en vez de espera muda).

## 9. Pendientes de implementación — **todo hecho** (actualizado 2026-08-02)

1. ~~Ampliar el JSON de `classifyAction` con `banda` y `duracionEstimadaMinutos`~~ — hecho.
2. ~~Escribir las fórmulas deterministas de duración/producción~~ — hecho, `backend/src/services/timedActions.ts`.
3. ~~Componente de frontend: contador visual en vivo para banda corta/extendida~~ — hecho.
4. ~~Implementar `CharacterTransit` de verdad~~ — hecho, `backend/src/workers/worldTick.ts` § `resolveDueTransits`.
5. ~~Migración de Prisma para el campo de condición física~~ — hecho.
6. ~~Decidir el catálogo inicial de acciones largas tipo "downtime"~~ — hecho, ver `harvestYields`/producción en `worldCatalog.ts`.
