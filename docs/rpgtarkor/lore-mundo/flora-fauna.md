# Helek Sirik — Flora y fauna

[← Volver al índice del mundo](07-mundo-helek-sirik.md)

*Cómo se organiza la vida de Helek Sirik (las 26 familias) y dónde está cada especie. **Las fichas de cada especie viven en el fichero de su región** (ver el índice de abajo), junto a la geografía de la zona donde aparece. El catálogo técnico de recolección y despiece (`HarvestYield`) está en `docs/12-mundo-estructurado.md` § 3.*

---

## Las 26 familias — cómo se reparten fauna y flora entre las Semillas

Todo animal y toda planta de Helek Sirik pertenece a una de 13 familias de fauna o 13 de flora — no
es solo clasificación de biólogo, es linaje real: cada familia desciende de la mano de una Semilla
concreta, y comparte con sus hermanas de familia un mismo "sabor" de instinto o de crecimiento que
delata a su creadora aunque la especie cambie. Un cazador o un herborista con suficiente experiencia
reconoce la familia de una criatura o una planta que no ha visto nunca solo por cómo se mueve o cómo
crece, igual que reconocería el estilo de un artesano sin ver su firma.

**Fauna — de Ferios ("El que Nace", instinto y caza limpia)**: seis familias, la mayoría de la fauna
salvaje de Berig. **Guelises** (depredadores de jauría), **Acechantes** (depredadores solitarios de
emboscada), **Corvenes** (aves de presa o carroñeras), **Zancudos** (aves terrestres o de charca),
**Bestiones** (grandes herbívoros y bestias de manada) y **Rondines** (pequeños mamíferos omnívoros).

**Fauna — de Florial ("El que Brota", crecimiento lento y paciente)**: tres familias, la fauna que
Florial tejió junto a Ferios pese a no ser su dominio natural (ver [genesis.md § "Florial y Ferios:
la obra compartida"](genesis.md#florial-y-ferios-la-obra-compartida)). **Quitinos** (insectos y
artrópodos acorazados), **Escamados** (reptiles y anfibios) y **Nadantes** (peces y fauna acuática).

**Fauna — de Goirme y de Kroj**: una familia cada una. Los Ordenados tienen la primera, el **Vreskal** de la
Meseta; los Umbrias tienen dos, ambas del Margen Silencioso: la **Leshra** y las **Sombras de Kroj**.
**Ordenados** (tema simetría/orden/geometría — la fauna que llevaría, si existiera, la firma de
Goirme descrita en [genesis.md § "El dominio de Goirme"](genesis.md#el-dominio-de-goirme)) y
**Umbrias** (tema sigilo/noche/silencio — el equivalente de familia a las criaturas ya descritas en
[genesis.md § "El dominio de Kroj"](genesis.md#el-dominio-de-kroj), como Sombras de Kroj, Rondador de
Brasas, Nuente y Miruina, aunque ninguna lleva hoy esta etiqueta técnica).

**Fauna — de Tarkor (magia Salvaje del Estallido)**: dos familias, herederas del mismo Estallido que
dio origen a los orcos. **Mudos Salvaje** (fauna que ya existía, mutada por la magia — un animal real
con algo imposible o mítico en su naturaleza) y **Rokrats Estallido** (seres nacidos directamente de
la magia salvaje, sin animal base real — el mismo tipo de origen que los propios orcos, no una
mutación sobre algo previo; sin especie asignada todavía).

**Flora — de Florial**: once géneros, el grueso absoluto de la flora de Helek Sirik — coherente con
que, tras la caída de Tarkor, Florial se volcara en su obra hasta triplicar en variedad a toda la
fauna del mundo (ver el mismo enlace de arriba). **Veldrias** (árboles con madera y resina
emparejadas), **Zarcos** (arbustos de leña sin resina), **Heldras** (hierbas y pastos base),
**Granoles** (cereales silvestres), **Trenias** (fibra para tejido y cordaje), **Marelas** (algas de
costa o charca), **Bulvias** (raíces y tubérculos de agua), **Muscarias** (líquenes y musgos, cobertura
de superficie sin tallo propio), **Salviras** (flores y plantas de alquimia y curación de campo),
**Fongares** (setas) y **Vetrias** (flora con mineral real incrustado en su propia estructura, como la
Hierba del Hierro o los Árboles de Hebra Dorada — ver [Meseta del Orden](regiones/meseta-del-orden.md#hierba-del-hierro)
y [Vaelira](regiones/vaelira.md#árboles-de-hebra-dorada) para el mecanismo de cada una).

**Flora — de Tarkor**: dos géneros, hermanos de familia de Mudos Salvaje y Rokrats Estallido en
fauna, con el mismo juego de palabras en su nombre técnico ("Roktars" es "Tarkor" al revés).
**Brotes Salvajes** (flora normal mutada por la magia salvaje — como la Raíz de Fuego, que acumula
calor volcánico hasta inflamarse, o el Cardo Brújula, con fibra imantada que señala siempre el mismo
rumbo) y **Roktars Florares** (flora nacida directamente de la magia salvaje, sin especie base real —
sin especie asignada todavía).

*(Nota técnica: estas familias existen en el motor como `Npc.faunaCategoria` y una categoría
equivalente de flora, puro sabor narrativo/organizativo — no cambian ninguna regla de combate ni de
recolección. Se documentan aquí porque el propio reparto por Semilla ya vivía, bien razonado, en
comentarios de código sin haber llegado nunca a un documento de lore legible.)*

## Índice por región

| Región | Fauna | Flora y minerales |
|---|---|---|
| [Cristal Helado](regiones/cristal-helado.md) | Hielaga, Nievón, Escarchín | Liquen Escarcha, Hielo Sílice |
| [Las Llanuras del Viento Rojo](regiones/llanuras-del-viento-rojo.md) | [Toda la región](regiones/llanuras-del-viento-rojo.md#fauna) (Gargantúa, Corredor de Cauce, Espina del Viento, Múrgol, Aullador Rojo, Cruzavientos, Rondador de Brasas, Zense Ceniza, Canizor, Corretolvas) y [zona por zona](regiones/llanuras-del-viento-rojo.md#zonas-del-núcleo) | [Toda la región](regiones/llanuras-del-viento-rojo.md#flora-y-minerales) y zona por zona |
| [Ciénaga Troncal](regiones/cienaga-troncal.md) | Cornantes, Tragalodo, Borbol, Zancapilote | Trepadores Ocaso, Bolco, Bulbo de Turbera, Velo de Charca, Herrumbrera |
| [El Margen Silencioso](regiones/margen-silencioso.md) | Sombras de Kroj, Hetris, Mekiosi, Vistue, Leshra, Morvasa, Brozán, Hoscón, Vaeth (espíritu) | Musgo Callado, Veldria Hueca, Flor de Víspera, Cántaro de Hoja, Carnosa de Tocón |
| [La Meseta del Orden](regiones/meseta-del-orden.md) | Vreskal | Hierba del Hierro |
| [Vaelira](regiones/vaelira.md) | Susurradores de Cristal, Acechadores de la Bruma | Árboles de Hebra Dorada, Flor de Esquirla |

## Vaelira — El continente Kelife

Movido a [regiones/vaelira.md](regiones/vaelira.md#flora).

## Berig — El continente Goirntes

Las fichas de Berig están ahora en el fichero de cada región (tabla de arriba). Las Llanuras del Viento
Rojo, que concentran casi toda la fauna y flora documentada, se organizan zona por zona: La Hondonada
del Eco, Los Pilares Rotos, El Pozo de Cauce Viejo, El Cruce de las Cenizas, El Osario de la Manada,
Las Agujas Imán, Los Manaderos, Los Pastos de la Deriva, El Filo de las Brasas, La Sabana Alta, Playa
de Ceniza Blanca y Los Acantilados Partidos.

---

## Historial de cambios

- 2026-09-06: las 26 familias pasan de comentarios de código a documento de lore.
- 2026-09-27: las fichas de especies se reparten por región en `regiones/*.md`; aquí se quedan las
  familias y el índice. Primera tanda de propuestas aprobadas: 9 especies nuevas en el Margen y la
  Ciénaga, entre ellas la primera de la familia Umbrias.

---

**Ver también:** [Cronología mítica](cronologia-mitica.md) · [Cronología](cronologia.md) · [Génesis y Formación](genesis.md) · [Áreas y geografía](areas.md) · [Historia y presente](historia.md) · [Razas](razas.md) · [Items](../items-y-catalogo/items.md) · [Personajes](../personajes/personajes.md) · [NPCs](../personajes/npcs.md)
