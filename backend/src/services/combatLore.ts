/// Enciclopedia § "Combate" (petición explícita, 2026-08-15: "expliquemos con claridad... las
/// mecánicas de las tiradas y cómo funcionan los combates... explicada para el jugador que juega,
/// no para alguien que ya conoce el juego") — mismo patrón que berigLore.ts (Razas/Personajes):
/// contenido estático, sin fila de BD, sin gateo de descubrimiento (es documentación de reglas,
/// no un secreto narrativo — el jugador debería poder consultarlo desde el primer turno).
///
/// Escrito en prosa de mentor de juego, nunca en términos de implementación (nada de "gradoExito"/
/// "OUTCOME_TABLE"/nombres de función) — cada sección explica UN concepto, corto, sin acumular
/// varios a la vez, pensado para leerse de un tirón desde el pop-up de Enciclopedia.
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
    text: `Casi cualquier cosa arriesgada que intentes — golpear, esquivar, convencer, colarte, aguantar un golpe — se resuelve con una tirada: un dado de 20 caras más un bono que depende de tu atributo (Fuerza, Destreza, Voluntad...), comparado contra una dificultad.

Hay tres resultados posibles. Si te quedas muy por debajo de la dificultad, es un fallo — no pasa. Si la alcanzas o la superas por poco, es un éxito con coste — lo consigues, pero algo se tuerce o te cuesta más de lo esperado. Si la superas con margen de sobra, es un éxito claro — sale exactamente como querías, sin pegas.

Nunca eliges el número que sacas ni decides el resultado — el dado y tu personaje deciden, y la narración solo describe lo que ya se decidió.`,
  },
  {
    slug: 'la-dificultad',
    icon: '📏',
    title: 'La dificultad: contra qué te mides',
    text: `La dificultad de una tirada de combate no es un número fijo — depende de cómo de fuerte es tu rival comparado contigo. Un enemigo muy por debajo de tu nivel te pone una dificultad fácil; uno muy por encima, una dificultad muy difícil.

Eso significa que la misma acción (un golpe directo, por ejemplo) puede ser sencilla contra un rival débil y arriesgada contra uno peligroso, sin que tú hagas nada distinto — el mundo simplemente responde a quién tienes delante.`,
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
    title: 'El intercambio: dos tiradas, no una',
    text: `Cuando alguien ataca y alguien se defiende, NO es una sola tirada donde gana el número más alto. Son dos tiradas completamente independientes, cada una contra su propia dificultad: la de quien ataca (¿consigue de verdad golpear?) y la de quien defiende (¿consigue de verdad pararlo?).

Por eso a veces sacas un número más alto que tu rival y aun así "pierdes" el intercambio: tu número solo cuenta contra TU dificultad, nunca contra la suya. Puedes sacar 13 necesitando 15 (fallas) mientras tu rival saca 8 necesitando solo 12 (también falla) — y aun así el resultado es que tu ataque no llega, porque lo que importa es si TÚ superaste lo que TÚ necesitabas.

Con las dos tiradas ya resueltas, se cruzan para decidir qué pasa de verdad: un golpe que conecta de lleno, un golpe que conecta con normalidad, un bloqueo limpio sin daño, un choque donde los dos acaban acusando algo, un ataque que simplemente no llega, o — el caso más raro — un ataque que falla del todo justo cuando la defensa rival tiene tanto éxito que responde con un golpe de propina. Cada intercambio muestra el desglose completo: qué sacó cada lado, qué necesitaba y por qué salió lo que salió.`,
  },
  {
    slug: 'ventajas-atributos',
    icon: '🔄',
    title: 'Ventajas entre atributos',
    text: `Los atributos no son todos iguales entre sí en combate: cada uno tiene ventaja sobre alguno y desventaja frente a otro, como una rueda que se cierra sobre sí misma (la Destreza esquiva a la Fuerza bruta, una mente fría anticipa a la pura velocidad, lo arcano no sigue una lógica anticipable...).

Si tu habilidad usa un atributo con ventaja sobre el que usa tu rival este intercambio, tu tirada sale reforzada; si tiene desventaja, sale penalizada. El propio intercambio te enseña el multiplicador exacto cuando aplica, para que veas de un vistazo si la rueda jugó a tu favor o en tu contra.`,
  },
  {
    slug: 'condicion-fisica',
    icon: '❤️',
    title: 'La condición física: de ileso a algo peor',
    text: `Tu estado en combate no es solo un número de vida — pasa por etapas: ileso, herido, grave, incapacitado y, en el peor de los casos, muerto. Cada etapa por debajo de ileso te penaliza un poco más en tus propias tiradas, así que un combate largo se pone cuesta arriba de verdad si no consigues resolverlo pronto.

Si caes incapacitado (no muerto), tu personaje sobrevive pero queda fuera de la pelea — respawnea y sigue la partida. Un enemigo incapacitado, en cambio, se queda tirado en el sitio: si nadie lo remata, con el tiempo se recupera solo hasta quedar herido y puede volver a suponer una amenaza. Un enemigo muerto de verdad, en cambio, desaparece del mundo pasado un tiempo.`,
  },
  {
    slug: 'rematar-y-saquear',
    icon: '💀',
    title: 'Rematar y saquear a un enemigo caído',
    text: `Solo puedes registrar el cuerpo de un enemigo — quedarte con lo que lleva encima — cuando está incapacitado o muerto de verdad, nunca antes. Mientras siga en pie, por muy herido que esté, no hay nada que saquear.

Contra un enemigo ya incapacitado tienes la opción de "Matar": un golpe de gracia que no necesita ninguna tirada, porque ya no puede defenderse — simplemente decides acabar con él (o dejarlo con vida, incapacitado, si prefieres no rematarlo).`,
  },
  {
    slug: 'huir',
    icon: '🏃',
    title: 'Huir de un combate',
    text: `Tienes dos formas distintas de huir, según el momento. Si el combate todavía no ha empezado de verdad (acabas de ver al enemigo, pero nadie ha golpeado todavía), puedes intentar escapar antes de que llegue a estallar — una única tirada de Destreza decide si te vas limpio o si el combate se abre de todos modos.

Si ya estás metido en el combate, puedes intentar huir en cualquier turno como una acción más — con su propio riesgo de no conseguirlo y quedarte igual de metido en la pelea. Ninguna huida es gratuita ni está garantizada: cuanto más peligroso sea tu rival, más te cuesta zafarte de verdad.`,
  },
];
