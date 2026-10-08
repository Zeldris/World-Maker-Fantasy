# Cifras provisionales

Cifras que puso Claude sin que la usuaria las decidiera, para revisarlas jugando en la fase de pruebas
del `0.8` (tarea `QA-26`). Cada fila dice dónde vive la constante: cambiarla es tocar solo esa línea.
Las cifras que decidió la usuaria en una ronda (escalones de defensa, tope de 12 bandidos, Fácil = la
mitad…) no están aquí; están en las decisiones de su plan.

Al añadir una cifra provisional nueva, se apunta aquí en el mismo commit (QA-25).

## Asaltos (`CR-65`, `CR-50`, `CR-37`, `CR-67`)

| Qué | Valor | Dónde |
|---|---|---|
| Botín por asaltante en pie (comida, Goirnos, objetos) | 10 · 5 · 2 | `BOTIN_POR_ASALTANTE`, `backend/src/services/asaltos.ts` |
| Parte máxima de lo que hay que se llevan | 25 % | `BOTIN_TOPE`, `asaltos.ts` |
| Módulos de defensa en un Cuartel Avanzado sin mejorar | 2 | `CUPO_DEFENSA_CUARTEL_BASE`, `cronista/defensa.ts` |
| Margen base del atacante (contenida, normal, dura) | 1,9 · 1,5 · 1,2 | `MARGEN_BASE`, `cronista/decisionAsalto.ts` |
| Rebaja del margen con todo el motivo | 0,6 | `REBAJA_POR_MOTIVO`, `decisionAsalto.ts` |
| Margen mínimo | 0,8 | `MARGEN_MINIMO`, `decisionAsalto.ts` |
| Colchón sobre lo que cree necesitar | ×1,2 | `COLCHON`, `decisionAsalto.ts` |
| Motivo mínimo para moverse | 0,1 | `MOTIVO_MINIMO`, `decisionAsalto.ts` |
| Peso en la defensa estimada (miliciano, cobertura, moral) | 0,6 · +10 %/punto · +5 %/punto | `defensaEstimada`, `decisionAsalto.ts` |
| Motivo de los bandidos (riqueza que satura, necesidad) | 1000 Goirnos · +0,2 sin botín · +0,2 lleno | `motivoBandidos`, `decisionAsalto.ts` |
| Motivo de una facción en guerra | 0,2 al entrar, 1 a presión 100 | `motivoGuerra`, `decisionAsalto.ts` |
| Días por refuerzo de un campamento (contenida, normal, dura) | 4 · 3 · 2 | `DIAS_POR_REFUERZO_INTENSIDAD`, `decisionAsalto.ts` |
| Soldados que una facción deja en casa | un tercio | `soldadosEnCasa`, `guerraReino.ts` |

## Campamentos de bandidos (`CR-50`)

| Qué | Valor | Dónde |
|---|---|---|
| Día del primer campamento | 10 | `DIA_PRIMER_CAMPAMENTO`, `cronista/campamentosBandidos.ts` |
| Días para rehacerse tras caer | 20 | `DIAS_PARA_REHACERSE`, `campamentosBandidos.ts` |
| Gente inicial | 6-9 | `GENTE_INICIAL_MIN` / `MAX`, `campamentosBandidos.ts` |
| Nivel de los bandidos (cabecilla +2) | 3 | `nivel` de cada semilla, `OCUPANTES_CAMPAMENTO` |
| Radio de acción contra viajeros | 2 tramos | `RADIO_CAMPAMENTO`, `campamentos.ts` |
| Probabilidad de ver pasar a un viajero | 30 % | `PROB_ASALTO_BANDIDOS`, `campamentos.ts` |
| Comida por pieza robada | 10 | `COMIDA_POR_PIEZA_ROBADA`, `campamentos.ts` |
| Bandidos que nunca dejan el campamento | 2 | `BANDIDOS_EN_CASA`, `campamentos.ts` |
| Cofre de un campamento | 50 Goirnos | `COFRE_CAMPAMENTO`, `ataquesCampamento.ts` |
| Reputación por acabar con uno | +60 | `REP_POR_CAMPAMENTO`, `ataquesCampamento.ts` |
| Patrulla de facción contra un campamento | 8 soldados | `PATRULLA_CONTRA_CAMPAMENTO`, `ataquesCampamento.ts` |

## Defensa de las facciones y guerra (`CR-65` 65e, `CR-37`)

| Qué | Valor | Dónde |
|---|---|---|
| Gente para arrancar con Muro / Muralla | 60 / 200 | `GENTE_PARA_ESCALON`, `defensaFacciones.ts` |
| Goirnos para subir a Muro / Muralla | 120 / 300 | `COSTE_REFUERZO_FACCION`, `defensaFacciones.ts` |
| Tributo: Goirnos por vez y presión que baja | 100 · −10 | `GOIRNOS_POR_TRIBUTO`, `guerraReino.ts`; `TRIBUTO`, `factionRelations.ts` |
| Tributos de golpe | 5 | `MAX_TRIBUTOS`, `guerraReino.ts` |
