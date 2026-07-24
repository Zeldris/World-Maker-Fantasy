/// Hechos protegidos por personaje (roadmap 2026-07-20, mitigación de calidad narrativa, hallazgo
/// real jugando: el modelo le atribuyó "superviviente del Clan Maktor" a un NPC plantilla sin
/// ninguna historia propia — un hecho de mucho peso narrativo que pertenece en EXCLUSIVA a
/// Gorhorn). Mismo patrón que startingInventoryFor/startingAbilitiesFor: solo los 2-3 hechos
/// realmente sagrados del personaje (propuesta de Fable: una prohibición explícita se respeta
/// mucho mejor en un 7B que una implícita en el lore), nunca una lista larga.
export function protectedFactsFor(characterName: string): string[] {
  if (characterName === 'Gorhorn') {
    return [
      'El Clan Maktor fue aniquilado por completo — Gorhorn es el ÚNICO superviviente conocido. Ningún otro personaje (NPC, plantilla o principal) puede ser superviviente del Clan Maktor bajo ningún concepto, salvo que sea un hito narrativo real decidido explícitamente por el backend, nunca improvisado.',
    ];
  }
  return [];
}
