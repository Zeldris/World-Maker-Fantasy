# Dos formas de combate: en vivo con la jugadora, de fondo sin ella

Todo combate se resuelve con las mismas reglas de combate por turnos, con cada combatiente y sus
atributos. Si la jugadora está presente con su grupo, ese combate (múltiple) es **en vivo**: por
turnos, con narración. Cualquier otro combate, incluidos los demás que ocurran a la vez, se resuelve
**de fondo**: el mismo motor, determinista y sin narración (como ya hace la intercepción de
expediciones, `simularCombateInterceptacion`). Sin la jugadora, todo es de fondo.

Decisión (usuaria, 2026-10-06, ronda de `CR-56`). Se descarta resolver peleas con cifras en agregado
(«N guerreros, 1d6 bajas») o con equivalencias («esta bestia vale 2 soldados»): un guardia, un soldado
o un renegado pelean igual estés o no. Quedan dos combates que aún van en agregado y deben pasar al
motor de fondo: la escaramuza del narrador de fondo (`narradorFondo.ts`) y la patrulla de vasallaje
(`vasallaje.ts`).
