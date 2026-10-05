# Las ofertas pendientes de la partida no se fusionan

La partida guarda tres ofertas que esperan respuesta: el modo dinámico (`pendingDynamicModeOffer`), la
misión (`pendingQuestOfferInfo`) y el menú del NPC (`pendingNpcInteractionOffer`). En septiembre de
2026 se decidió no fusionarlas porque cada una la decide alguien distinto, y se apuntó que, si el motor
llegaba a decidir las misiones, la de misión encajaría con la de modo dinámico. Con `CR-40` el motor ya
decide las misiones secundarias, pero no las guarda como oferta pendiente: viven como avisos propios
(`MisionOfrecida`) en un tablón o en boca de un NPC, sobreviven a cerrar la tarjeta y se cogen desde
su modal. La oferta de misión de la partida solo la usa ya la misión fija de Gistera.

Decisión (usuaria, 2026-10-05, Q21 de `CR-40`, revisando la Q6): **no se fusionan**. Fusionar tocaría unas
50 referencias del modo dinámico, muy probado, sin ningún cambio para quien juega. Si en el futuro
una misión necesita «una oferta a la vez» en la partida, se reabre esta decisión.
