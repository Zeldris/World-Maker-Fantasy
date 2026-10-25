/// Enciclopedia § "Combate" (petición explícita, 2026-08-15: "expliquemos con claridad... las
/// mecánicas de las tiradas y cómo funcionan los combates... explicada para el jugador que juega,
/// no para alguien que ya conoce el juego") — mismo patrón que berigLore.ts (Razas/Personajes):
/// contenido estático, sin fila de BD, sin gateo de descubrimiento (es documentación de reglas,
/// no un secreto narrativo — el jugador debería poder consultarlo desde el primer turno).
///
/// Escrito en prosa de mentor de juego, nunca en términos de implementación (nada de "gradoExito"/
/// "OUTCOME_TABLE"/nombres de función) — cada sección explica UN concepto, corto, sin acumular
/// varios a la vez, pensado para leerse de un tirón desde la ventana de la Enciclopedia.
export interface CombatLoreSection {
  slug: string;
  icon: string;
  title: string;
  /// Párrafos separados por '\n\n' — mismo formato de texto plano que el resto de la Enciclopedia
  /// (DetailModal.tsx los pinta con `whitespace-pre-line`, sin parser Markdown).
  text: string;
}

export const COMBAT_LORE_SECTIONS: CombatLoreSection[] = [
  {
    slug: 'las-tiradas',
    icon: '🎲',
    title: 'Las tiradas: cómo se decide todo',
    text: `Casi cualquier cosa arriesgada que intentes — golpear, esquivar, convencer, colarte, aguantar un golpe — se resuelve con una tirada: un dado de 20 caras más un bono fijo, comparado contra una dificultad (o, en un cara a cara de combate, contra la tirada de tu rival).

Ese bono es la mitad de tu atributo relevante (Fuerza, Destreza, Voluntad...), redondeada hacia abajo — no el atributo entero. Es así a propósito: si el bono fuera el atributo completo, el dado dejaría de importar casi nada y un atributo alto convertiría cualquier tirada en un trámite garantizado. Con la mitad, el dado sigue pesando de verdad — un atributo alto te da una ventaja real, pero la suerte del momento sigue pudiendo decidir.

Hay dos resultados posibles: si igualas o superas la dificultad, lo consigues; si te quedas por debajo, fallas. No hay término medio — la narración puede contar lo justo que fue, pero no cambia lo que ya decidió el dado. En combate, cuando alguien ataca y alguien se defiende, cuenta además por cuánto gana uno al otro (ver «El intercambio»).

Nunca eliges el número que sacas ni decides el resultado — el dado y tu personaje deciden, y la narración solo describe lo que ya se decidió.`,
  },
  {
    slug: 'la-dificultad',
    icon: '📏',
    title: 'La dificultad: contra qué te mides',
    text: `La dificultad no es un número fijo — cuando el reto es alguien, depende de cómo de fuerte es comparado contigo. Un rival muy por debajo de ti te pone una dificultad fácil; uno muy por encima, una muy difícil.

Esa dificultad cuenta cuando intentas algo sin que el otro te responda en el mismo instante — una habilidad de apoyo, escapar de una pelea — y para la experiencia que ganas. En un intercambio de ataque y defensa, en cambio, no decide el resultado: ahí manda tu tirada contra la de tu rival (ver «El intercambio»).`,
  },
  {
    slug: 'iniciativa',
    icon: '⚡',
    title: 'Quién golpea primero: la iniciativa',
    text: `Al empezar cada intercambio de combate, tú y tu rival os jugáis la iniciativa con una tirada de Destreza. Quien la gana decide qué hace ese intercambio — atacar, usar una habilidad, lo que sea — sabiendo lo que va a intentar.

Quien la pierde tiene que defenderse a ciegas: eliges tu defensa sin saber todavía qué te va a lanzar el rival. Por eso conviene tener siempre claro qué habilidad defensiva vas a usar antes de que te toque — no hay tiempo de pensarlo con calma en pleno combate.`,
  },
  {
    slug: 'el-intercambio',
    icon: '⚔️',
    title: 'El intercambio: tu tirada contra la suya',
    text: `Cuando alguien ataca y alguien se defiende, los dos tiran a la vez y se comparan los totales: gana el más alto. Si empatan, gana quien defiende — el golpe no llega.

Lo que pasa depende de por cuánto se gana. Si el atacante gana por poco, el golpe conecta con normalidad; si gana por 10 o más, conecta de lleno. Si el defensor gana por poco, para el golpe en seco, sin daño; si gana por 10 o más, aprovecha el hueco y responde con un contragolpe.

Cada intercambio muestra el desglose completo: qué sacó cada lado y por cuánto ganó uno al otro, para que veas por qué salió lo que salió.`,
  },
  {
    slug: 'ventajas-atributos',
    icon: '🔄',
    title: 'Ventajas entre atributos',
    text: `Los atributos no son todos iguales entre sí en combate: cada uno tiene ventaja sobre alguno, como una rueda que se cierra sobre sí misma (la Destreza esquiva a la Fuerza bruta, una mente fría anticipa a la pura velocidad, la magia no sigue una lógica anticipable...).

Si tu habilidad usa un atributo con ventaja sobre el que usa tu rival este intercambio, tu tirada sale reforzada. Si no la tiene, tu tirada sigue siendo la normal — la rueda solo puede ayudarte, nunca te penaliza por el lado que te toque usar. El propio intercambio te enseña el multiplicador exacto cuando aplica, para que veas de un vistazo si la rueda jugó a tu favor.`,
  },
  {
    slug: 'condicion-fisica',
    icon: '❤️',
    title: 'La condición física: de ileso a algo peor',
    text: `Tu estado en combate no es solo un número de vida — pasa por etapas: ileso, herido, grave, convaleciente y, en el peor de los casos, muerto. Cada etapa por debajo de ileso resta directamente al atributo que uses en tu próxima tirada, antes de tirar el dado: herido resta 2, grave resta 5, convaleciente resta 10 — así que un combate largo se pone cuesta arriba de verdad si no consigues resolverlo pronto, no solo narrativamente, también en tus propios números. El resultado de cada intercambio te enseña esa resta exacta cuando te afecta, para que sepas por qué tu tirada salió más floja de lo normal.

Si caes convaleciente (no muerto), tu personaje sobrevive pero queda fuera de la pelea — se repone y la partida sigue. Un enemigo convaleciente, en cambio, se queda tirado en el sitio: si nadie lo remata, con el tiempo se recupera solo hasta quedar herido y puede volver a suponer una amenaza. Un enemigo muerto de verdad, en cambio, desaparece del mundo pasado un tiempo.`,
  },
  {
    slug: 'rematar-y-saquear',
    icon: '💀',
    title: 'Rematar y saquear a un enemigo caído',
    text: `Solo puedes registrar el cuerpo de un enemigo — quedarte con lo que lleva encima — cuando está convaleciente o muerto de verdad, nunca antes. Mientras siga en pie, por muy herido que esté, no hay nada que saquear.

Contra un enemigo ya convaleciente tienes la opción de "Matar": un golpe de gracia. Se tira igual, pero ya no puede defenderse y el golpe entra siempre de lleno — tú decides si acabar con él (o dejarlo con vida, convaleciente, si prefieres no rematarlo).`,
  },
  {
    slug: 'huir',
    icon: '🏃',
    title: 'Huir de un combate',
    text: `Tienes dos formas distintas de huir, según el momento. Si el combate todavía no ha empezado de verdad (acabas de ver al enemigo, pero nadie ha golpeado todavía), puedes intentar escapar antes de que llegue a estallar — una única tirada de Destreza decide si te vas limpio o si el combate se abre de todos modos.

Si ya estás metido en el combate, puedes intentar huir en cualquier turno como una acción más — con su propio riesgo de no conseguirlo y quedarte igual de metido en la pelea. Ninguna huida es gratuita ni está garantizada: cuanto más peligroso sea tu rival, más te cuesta zafarte de verdad.`,
  },
];
