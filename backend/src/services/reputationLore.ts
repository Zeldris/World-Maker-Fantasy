/// Enciclopedia § "Sistemas" (auditoría de contenido de Enciclopedia, 2026-09-15: la Reputación de
/// facción, el Temperamento de NPC/fauna, la captura/domesticación/reclutamiento y el propio
/// sistema de fases de descubrimiento existen y se usan desde hace semanas, pero no había ninguna
/// entrada de Enciclopedia que los explicara — el jugador solo los aprendía arriesgándose a ciegas
/// o adivinando qué significaba un candado en una tarjeta). Mismo patrón exacto que combatLore.ts:
/// contenido estático, sin fila de BD, sin gateo de descubrimiento — es documentación de reglas, no
/// un secreto narrativo, así que debería poder consultarse desde el primer turno. Nombre de archivo
/// (`reputationLore.ts`) e interfaz (`ReputationLoreSection`) se quedan como estaban por no romper
/// el import — el título visible en el front pasó de "Reputación" a "Sistemas" al ampliar el
/// alcance más allá de solo reputación/temperamento.
///
/// Escrito en prosa de mentor de juego, nunca en términos de implementación (nada de
/// "factionsStatus"/"effectiveTemperamento"/nombres de función) — mismo criterio que combatLore.ts.
export interface ReputationLoreSection {
  slug: string;
  icon: string;
  title: string;
  /// Párrafos separados por '\n\n' — mismo formato de texto plano que el resto de la Enciclopedia
  /// (DetailModal.tsx los pinta con `whitespace-pre-line`, sin parser Markdown).
  text: string;
}

export const REPUTATION_LORE_SECTIONS: ReputationLoreSection[] = [
  {
    slug: 'el-temperamento',
    icon: '🧭',
    title: 'El temperamento: cómo reacciona alguien al verte',
    text: `Cada persona o criatura del mundo tiene un temperamento propio, de más receptivo a más hostil: amigable, inofensivo, cauteloso, agresivo o enemigo. Es lo primero que decide cómo se comporta al encontrarte — si te ignora, si te habla, si se pone a la defensiva o si va directamente a por ti.

Alguien amigable o inofensivo nunca inicia un combate por su cuenta. Alguien cauteloso reacciona según lo que hagas tú — un gesto agresivo puede bastar para que deje de fiarse. Alguien agresivo o enemigo, en cambio, va a por ti casi sin excepción en cuanto te tiene cerca, sin que necesites provocarlo.

El temperamento no es fijo para siempre: tu reputación con la facción de esa persona puede desplazarlo, para bien o para mal (ver más abajo).`,
  },
  {
    slug: 'la-reputacion',
    icon: '⚖️',
    title: 'La reputación: lo que cada facción piensa de ti',
    text: `Con cada facción del mundo tienes una reputación propia, que empieza en un punto neutro y se mueve según lo que haces con su gente. No es un marcador único para todo el mundo — puedes ser bien visto por un clan y detestado por otro al mismo tiempo, sin relación entre ambos.

Resolver algo en paz con alguien de una facción mejora tu reputación con ella poco a poco. Atacar a alguien de esa facción hasta matarlo la hunde de golpe, mucho más rápido de lo que se recupera actuando en paz — no es simétrico a propósito: caer en su lista negra debe doler de verdad, no ser algo de lo que sales en un par de turnos. Dejar a alguien con vida tras vencerlo también tiene coste, pero mucho menor que matarlo — capturarlo cuesta más que perdonarlo, y ambos cuestan bastante menos que rematarlo.

Tu reputación con cada facción tiene cinco escalones. En los dos más bajos, el temperamento de cualquiera de esa facción se vuelve más hostil de lo que sería por defecto — en el peor, alguien normalmente cauteloso pasa a tratarte como a un enemigo. En los dos más altos ocurre lo contrario: en el mejor, hasta alguien agresivo por naturaleza deja de atacarte por su cuenta. En el escalón del medio, cada cual es como es.`,
  },
  {
    slug: 'reputacion-y-territorio',
    icon: '🏳️',
    title: 'La reputación también decide quién es dueño de la tierra',
    text: `Varias regiones del mundo tienen una o más facciones que las consideran suyas. Si intentas fundar un asentamiento propio en una región así, tu reputación con ellas decide cómo responden: si no estás por debajo del punto neutro con ninguna, el territorio pasa a ser tuyo sin más resistencia; si lo estás con alguna — aunque sea solo una de las dos que se reparten una región —, no lo acepta y el territorio queda en disputa en vez de quedar limpiamente bajo tu control.

Una región sin ninguna facción conocida que la reclame no tiene este problema — puedes fundar ahí sin que nadie te lo dispute por motivos de reputación.`,
  },
  {
    slug: 'atar-y-capturar',
    icon: '🪢',
    title: 'Atar y capturar a alguien caído',
    text: `Cuando dejas a un enemigo grave o convaleciente en vez de rematarlo, tienes la opción de atarlo — necesitas llevar cuerdas encima, y solo puedes tener una captura sin resolver a la vez en toda la partida. Mientras la lleves contigo tienes que depositarla en una jaula antes de poder intentar atar a nadie más.

No todo el mundo puede atarse: solo quienes tienen algún punto débil real por el que ceder responden a este intento, y hace falta hueco libre en el inventario para cargar con la captura — si no lo tienes, el intento falla sin gastar la cuerda y el objetivo sigue ahí para reintentarlo luego.`,
  },
  {
    slug: 'domesticar-reclutar-cortejar',
    icon: '🤝',
    title: 'Domesticar, reclutar y cortejar: ganarse a alguien de verdad',
    text: `Distinto de atar a alguien caído en combate, hay quien puede unirse a ti por voluntad propia — domesticar a una criatura salvaje, reclutar a un NPC como compañero, o cortejarlo si la relación va por ahí. Cada intento es una tirada tuya contra la resistencia de la otra parte, y va sumando a una confianza que tiene que llegar a un umbral antes de dar fruto — no suele bastar con un solo intento.

No toda persona o criatura es igual de receptiva: algunas apenas se lo plantean por mucho que insistas, y otras ceden con facilidad. Cuanto más reacia sea de partida, más te cuesta cada intento — no es que sea imposible, pero puede hacer falta mucha paciencia, o directamente no merecer la pena insistir.`,
  },
  {
    slug: 'fases-de-conocimiento',
    icon: '🔒',
    title: 'Por qué algunas fichas aparecen bloqueadas',
    text: `No conoces todo el mundo desde el principio. Cualquier persona, criatura o lugar pasa por hasta tres fases: si nunca has oído hablar de ello, ni siquiera aparece en la Enciclopedia. Si ya se ha mencionado delante de ti pero todavía no lo has visto con tus propios ojos, aparece con un candado — sabes que existe, pero no su ficha completa. Solo cuando te lo encuentras de verdad en una escena se desbloquea del todo.

No hay ningún atajo para forzar esto desde la propia Enciclopedia — la única forma de desbloquear una ficha es vivirlo en juego: viajar hasta donde está, cruzarte con ello, o que la conversación con alguien lo traiga a la mesa de verdad.`,
  },
  {
    slug: 'lengua-de-los-orcos',
    icon: '🗣️',
    title: 'Kektira: la lengua de los orcos',
    text: `Los orcos de Helek Sirik hablan su propia lengua, el Kektira, y varios nombres de cargo, lugar y persona que oirás una y otra vez vienen directamente de ella, sin traducir.

Los cuatro títulos que vas a encontrarte más: Ikar es "jefe" o "jefa" a secas. Kort'ikar añade el sentido de mando en la guerra — quien lidera en el campo de batalla. Terk'ikar es quien gobierna el clan en su día a día, poblado, caza y reparto. Mesok'ikar es el título del chamán, guía espiritual del clan.

Otras raíces frecuentes en nombres de lugar: Karot (ceniza), Veku (colmillo), Lukar (hogar), Sedsar (salón), Helske (helado), Tugh (honor). Así, "Karot Veku" es literalmente "Colmillo de Ceniza", y "Helske Tugh" es "Honor Helado" — los propios nombres del asentamiento ya cuentan algo de quienes viven ahí.`,
  },
  {
    slug: 'crafteo',
    icon: '🔨',
    title: 'Fabricar tus propios objetos',
    text: `Muchos objetos del mundo no se encuentran, se fabrican — a partir de materiales que ya llevas encima, según una receta concreta. Cada receta pide un conjunto fijo de ingredientes y, a menudo, algo más: estar en el sitio adecuado (un taller, un fuego), tener los atributos mínimos que exige y, en algunos oficios, llevar encima su herramienta.

Si conoces el oficio de la receta, cada nivel que tengas en él rebaja esos mínimos: la práctica suple la fuerza o la maña que te falte. El nivel de una receta marca cuánto tarda: de unos segundos para lo más sencillo a cerca de un minuto para lo más elaborado. Unas pocas recetas, además, hay que descubrirlas antes, al cerrar un encargo. Con todo eso en regla, el objeto sale: no hay tirada ni riesgo de estropearlo.`,
  },
  {
    slug: 'construcciones',
    icon: '🏗️',
    title: 'Construcciones: levantar algo permanente',
    text: `Construir es distinto de fabricar un objeto: en vez de un objeto que te llevas encima, levantas algo fijo en el mundo — un edificio, una mejora de tu territorio — que se queda ahí de forma permanente. Igual que al fabricar objetos, cada construcción pide materiales concretos, pero ninguna exige atributos mínimos. Lo que manda es su nivel de obra (del 1 al 9): hasta el 3 la levantas tú con tus manos; del 4 en adelante hace falta una Casa de obras con súbditos constructores, y un Ayuntamiento mediano (niveles 4 a 6) o grande (7 a 9).

Algunas construcciones además están ligadas a una raza o cultura concreta — reflejan cómo construye ese pueblo, no una plantilla genérica que sirva para cualquiera.`,
  },
];
