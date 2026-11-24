// O que o Visatto sabe sobre pratos: nomes, apelidos, como costumam ser servidos e do que são feitos.
//
// Usado de três jeitos:
// - reconhecer pela imagem: cada prato tem descrições em inglês, que o modelo de visão (CLIP) compara com as fotos;
// - entender o nome que o dono digitou (apelidos e erros de digitação comuns);
// - montar a "ficha" do produto, que ajusta a reconstrução 3D (formato, topo, partes que pedem tratamento próprio).
//
// As descrições viram vetores uma vez só, fora do site (tools/clip/rotulos.py) e ficam em modelos/clip/rotulos.json.
// Mudou a lista? Rode aquele script de novo para a IA passar a conhecer os pratos novos.
import type { Kind } from "./profile";

export type Dish = {
  id: string;
  nome: string;
  /** descrições em inglês para o modelo de visão */
  en: string[];
  kind: Kind;
  formato?: "redondo" | "retangular" | "irregular";
  topo?: "reto" | "arredondado" | "irregular";
  /** partes típicas (ids de PARTS) */
  partes?: string[];
  /** apelidos, sem acento e em minúsculas */
  alias: string[];
  recipiente?: string;
  transparente?: boolean;
};

export type Part = {
  id: string;
  nome: string;
  en: string[];
  /** tratamento especial na hora de montar o 3D */
  trat?: "feijao" | "morango";
  /** acabamento do material: 0 = espelhado (molhado, calda), 1 = fosco (pão, arroz) */
  rough: number;
  alias: string[];
  /** true = só em doces, false = só em salgados, ausente = nos dois */
  doce?: boolean;
};

const D = (id: string, nome: string, kind: Kind, en: string[], alias: string[], extra: Partial<Dish> = {}): Dish => ({ id, nome, kind, en, alias, ...extra });

export const DISHES: Dish[] = [
  // ---- lanches
  D("hamburguer", "Hambúrguer", "prato_alto", ["a hamburger", "a cheeseburger with lettuce and cheese", "a gourmet burger"], ["hamburguer", "hamburger", "burger", "burguer", "x burguer", "xburguer", "x salada", "x bacon", "x tudo", "x egg", "smash", "cheeseburger", "cheese burger"], { formato: "redondo", topo: "arredondado", partes: ["pao", "carne", "queijo", "salada"] }),
  D("cachorro_quente", "Cachorro-quente", "prato_alto", ["a hot dog", "a hot dog with toppings in a bun"], ["cachorro quente", "hot dog", "hotdog", "dogao", "dog"], { formato: "irregular", topo: "irregular", partes: ["pao", "linguica", "molho"] }),
  D("sanduiche", "Sanduíche", "prato_alto", ["a sandwich", "a toasted sandwich cut in half"], ["sanduiche", "sanduba", "misto quente", "misto", "bauru", "beirute", "club sandwich", "baguete", "ciabatta", "lanche natural", "panini"], { formato: "retangular", topo: "irregular", partes: ["pao", "queijo"] }),
  D("wrap", "Wrap", "prato_alto", ["a wrap", "a burrito cut in half"], ["wrap", "burrito", "tortilha"], { formato: "irregular", topo: "arredondado" }),
  D("pastel", "Pastel", "porcao", ["a Brazilian pastel, a large fried pastry", "fried pastries"], ["pastel", "pasteis", "pastelzinho"], { formato: "retangular", topo: "arredondado" }),
  D("salgados", "Salgados", "porcao", ["coxinha, Brazilian fried chicken croquettes", "a plate of fried snacks"], ["coxinha", "coxinhas", "salgado", "salgados", "salgadinhos", "kibe", "quibe", "bolinha de queijo", "risole", "enroladinho", "croquete", "bolinho de bacalhau", "bolinho de aipim", "bolinho"], { formato: "irregular" }),
  D("pao_de_queijo", "Pão de queijo", "porcao", ["Brazilian cheese bread balls"], ["pao de queijo", "paes de queijo", "chipa"], { formato: "irregular", topo: "arredondado" }),
  D("esfiha", "Esfiha", "porcao", ["esfiha, open-faced meat pies"], ["esfiha", "esfirra", "esfiha aberta", "esfiha fechada"], { formato: "irregular" }),
  D("tapioca", "Tapioca", "prato_raso", ["a Brazilian tapioca crepe folded with filling"], ["tapioca", "beiju"], { formato: "irregular" }),
  D("crepe", "Crepe", "prato_raso", ["a folded crepe", "a crepe with filling"], ["crepe", "crepes"], { formato: "irregular" }),
  D("panqueca", "Panqueca", "prato_raso", ["rolled savory pancakes with tomato sauce and cheese", "pancakes with syrup"], ["panqueca", "panquecas", "pancake", "pancakes"], { formato: "irregular" }),
  D("pizza", "Pizza", "pizza_tabua", ["a whole pizza", "a pepperoni pizza", "a pizza with cheese and toppings"], ["pizza", "pizzas", "calabresa", "mussarela", "mucarela", "margherita", "marguerita", "portuguesa", "quatro queijos", "4 queijos", "frango com catupiry", "pepperoni", "napolitana", "broto"], { formato: "redondo", topo: "reto", partes: ["pizza", "queijo", "molho"] }),
  D("fatia_pizza", "Fatia de pizza", "pizza_tabua", ["a slice of pizza"], ["fatia de pizza", "pedaco de pizza", "pizza fatia"], { formato: "irregular", topo: "reto" }),
  D("calzone", "Calzone", "prato_raso", ["a calzone"], ["calzone"], { formato: "irregular", topo: "arredondado" }),
  // ---- pratos
  D("prato_feito", "Prato feito", "prato_raso", ["a plate of rice and beans with steak and salad", "a Brazilian plate with white rice, beans, meat and salad", "a lunch plate with rice, beans and grilled meat"], ["pf", "prato feito", "prato executivo", "executivo", "marmita", "marmitex", "comercial", "prato do dia", "arroz e feijao", "arroz feijao", "refeicao", "almoco"], { formato: "redondo", topo: "irregular", partes: ["arroz", "feijao", "carne", "salada"] }),
  D("feijoada", "Feijoada", "tigela", ["feijoada, a Brazilian black bean stew with pork", "a bowl of black bean stew"], ["feijoada"], { formato: "redondo", topo: "irregular", partes: ["feijao", "carne"] }),
  D("baiao_de_dois", "Baião de dois", "prato_raso", ["rice and beans cooked together with cheese and dried meat"], ["baiao de dois", "baiao"], { partes: ["arroz", "feijao", "queijo"] }),
  D("tropeiro", "Feijão tropeiro", "prato_raso", ["beans mixed with cassava flour, sausage, bacon and egg"], ["tropeiro", "feijao tropeiro"], { partes: ["feijao", "farofa", "linguica"] }),
  D("strogonoff", "Strogonoff", "prato_raso", ["beef stroganoff with white rice and potato sticks", "chicken stroganoff in creamy sauce with rice"], ["strogonoff", "estrogonofe", "estrogonoff", "stroganoff", "strogonofe"], { partes: ["arroz", "molho", "batata_frita"] }),
  D("parmegiana", "Parmegiana", "prato_raso", ["chicken parmigiana with melted cheese and tomato sauce, rice and fries", "a breaded steak covered with tomato sauce and melted cheese"], ["parmegiana", "parmigiana", "a parmegiana", "parmeggiana"], { partes: ["carne", "queijo", "molho", "arroz", "batata_frita"] }),
  D("frango_grelhado", "Frango grelhado", "prato_raso", ["grilled chicken breast with vegetables", "a grilled chicken fillet with rice and salad"], ["frango grelhado", "file de frango", "peito de frango", "frango", "sobrecoxa"], { partes: ["frango", "arroz", "salada"] }),
  D("bife", "Carne grelhada", "prato_raso", ["a grilled steak", "sliced grilled beef steak on a plate", "steak with fries"], ["bife", "file", "file mignon", "picanha", "contra file", "alcatra", "maminha", "entrecot", "ancho", "chorizo", "carne", "bife a cavalo", "costela", "fraldinha", "cupim"], { partes: ["carne", "batata_frita", "arroz"] }),
  D("churrasco", "Churrasco", "porcao", ["Brazilian barbecue, grilled meats on skewers", "grilled meat skewers"], ["churrasco", "espetinho", "espetinhos", "espeto", "kafta"], { formato: "irregular", partes: ["carne", "linguica"] }),
  D("peixe", "Peixe", "prato_raso", ["a grilled fish fillet with vegetables", "fried fish fillet with lemon"], ["peixe", "tilapia", "salmao", "file de peixe", "pescada", "merluza", "bacalhau", "bacalhoada", "robalo", "tambaqui", "pintado", "bacalhau a portuguesa", "bacalhau a gomes de sa"], { partes: ["peixe", "arroz", "legumes"] }),
  D("moqueca", "Moqueca", "tigela", ["moqueca, a Brazilian fish stew in a clay pot", "a fish and shrimp stew with coconut milk"], ["moqueca", "moqueca de peixe", "moqueca de camarao"], { partes: ["peixe", "molho"] }),
  D("bobo", "Bobó de camarão", "tigela", ["shrimp in a creamy cassava sauce"], ["bobo", "bobo de camarao"], { partes: ["molho"] }),
  D("camarao", "Camarão", "prato_raso", ["a plate of shrimp", "garlic butter shrimp", "breaded fried shrimp"], ["camarao", "camaroes", "camarao empanado", "camarao alho e oleo"]),
  D("lasanha", "Lasanha", "prato_raso", ["a slice of lasagna", "baked lasagna with melted cheese"], ["lasanha", "lasagna", "lazanha"], { formato: "retangular", topo: "reto", partes: ["macarrao", "queijo", "molho"] }),
  D("espaguete", "Espaguete", "prato_raso", ["spaghetti with tomato sauce", "spaghetti bolognese", "a plate of pasta", "spaghetti carbonara with creamy sauce", "spaghetti with shrimp"], ["espaguete", "macarrao", "spaghetti", "talharim", "fettuccine", "fetuccine", "penne", "massa", "bolonhesa", "carbonara", "alho e oleo", "macarronada", "talharini"], { partes: ["macarrao", "molho"] }),
  D("nhoque", "Nhoque", "prato_raso", ["gnocchi with tomato sauce", "potato gnocchi with sauce and cheese"], ["nhoque", "gnocchi", "inhoque"], { partes: ["macarrao", "molho"] }),
  D("risoto", "Risoto", "prato_raso", ["risotto", "a creamy risotto on a plate"], ["risoto", "risotto"], { partes: ["arroz"] }),
  D("yakisoba", "Yakisoba", "tigela", ["yakisoba, stir-fried noodles with vegetables and meat"], ["yakisoba", "yakissoba", "lamen frito"], { partes: ["macarrao", "legumes"] }),
  D("ramen", "Lámen", "tigela", ["a bowl of ramen noodle soup"], ["ramen", "lamen", "lamem"]),
  D("sushi", "Sushi", "porcao", ["sushi rolls on a plate", "a sushi platter", "assorted sushi and sashimi"], ["sushi", "combinado", "uramaki", "hossomaki", "niguiri", "nigiri", "sashimi", "hot roll", "hot holl"], { formato: "retangular", partes: ["sushi"] }),
  D("temaki", "Temaki", "prato_alto", ["temaki, a cone-shaped sushi hand roll"], ["temaki"], { formato: "irregular" }),
  D("poke", "Poke", "tigela", ["a poke bowl with salmon, rice and vegetables"], ["poke", "poke bowl"], { formato: "redondo", partes: ["arroz", "peixe", "legumes"] }),
  D("salada", "Salada", "tigela", ["a fresh green salad", "a bowl of salad with tomatoes"], ["salada", "salada caesar", "mix de folhas", "salada verde", "saladas"], { partes: ["salada", "tomate"] }),
  D("sopa", "Sopa", "tigela", ["a bowl of soup", "a bowl of creamy soup", "a cup of clear broth soup"], ["sopa", "caldo", "canja", "caldo verde", "consome", "sopa de legumes", "creme de abobora", "creme de legumes", "creme de mandioquinha", "sopa creme"], { formato: "redondo", topo: "reto" }),
  D("omelete", "Omelete", "prato_raso", ["an omelette on a plate"], ["omelete", "omelet", "omeleta", "ovos mexidos"], { partes: ["ovo"] }),
  D("escondidinho", "Escondidinho", "prato_raso", ["a baked casserole with mashed cassava and melted cheese on top"], ["escondidinho"], { formato: "retangular", topo: "reto", partes: ["pure", "queijo"] }),
  D("galinhada", "Galinhada", "prato_raso", ["yellow rice with chicken pieces"], ["galinhada", "arroz com frango"], { partes: ["arroz", "frango"] }),
  D("carreteiro", "Arroz carreteiro", "prato_raso", ["rice with shredded dried beef"], ["carreteiro", "arroz carreteiro"], { partes: ["arroz", "carne"] }),
  D("frango_frito", "Frango frito", "porcao", ["fried chicken pieces", "crispy fried chicken wings"], ["frango frito", "frango a passarinho", "passarinho", "asinha", "asa de frango", "drumet", "nuggets", "tulipa"], { formato: "irregular", partes: ["frango"] }),
  D("batata_frita", "Batata frita", "porcao", ["a portion of french fries", "french fries with cheddar and bacon"], ["batata frita", "fritas", "batata rustica", "porcao de batata", "batata cheddar", "batata canoa"], { formato: "irregular", partes: ["batata_frita"] }),
  D("mandioca_frita", "Mandioca frita", "porcao", ["fried cassava sticks"], ["mandioca frita", "aipim frito", "macaxeira frita", "mandioca", "aipim"], { formato: "irregular" }),
  D("isca", "Iscas fritas", "porcao", ["breaded fried fish strips with dipping sauce"], ["isca", "iscas", "isca de peixe", "isca de frango", "tirinhas"], { formato: "irregular" }),
  D("petiscos", "Porção de petiscos", "porcao", ["a platter of mixed bar snacks", "sliced sausage with onions"], ["porcao", "petisco", "petiscos", "calabresa acebolada", "tabua de petiscos", "linguica acebolada", "linguica calabresa", "porcao de calabresa"], { formato: "irregular", partes: ["linguica"] }),
  D("tabua_frios", "Tábua de frios", "pizza_tabua", ["a charcuterie board with cheese and cold cuts"], ["tabua de frios", "frios", "tabua de queijos", "queijos e frios"], { formato: "retangular", topo: "irregular" }),
  D("acai_tigela", "Açaí na tigela", "tigela", ["an acai bowl with banana and granola"], ["acai", "acai na tigela", "acai bowl", "tigela de acai"], { formato: "redondo", partes: ["fruta"] }),
  D("tacos", "Tacos", "porcao", ["tacos with meat and vegetables", "nachos with cheese"], ["taco", "tacos", "nachos", "quesadilla", "mexicano"], { formato: "irregular" }),
  D("ceviche", "Ceviche", "tigela", ["ceviche, raw fish marinated in lime with onion"], ["ceviche"]),
  D("acaraje", "Acarajé", "porcao", ["acaraje, a fried bean fritter stuffed with shrimp"], ["acaraje", "abara"]),
  D("cuscuz", "Cuscuz", "prato_raso", ["Brazilian corn couscous"], ["cuscuz", "cuscuz nordestino", "cuscuz paulista"], { formato: "redondo", topo: "arredondado" }),
  D("quiche", "Quiche", "fatia", ["a quiche", "a slice of quiche"], ["quiche", "torta salgada", "torta de frango", "torta de palmito", "torta de carne", "empadao de frango"], { formato: "redondo", topo: "reto" }),
  D("empada", "Empada", "porcao", ["small savory pies"], ["empada", "empadinha", "empadao"], { formato: "redondo", topo: "reto" }),
  D("bruschetta", "Bruschetta", "porcao", ["bruschetta with tomato and basil"], ["bruschetta", "brusqueta", "crostini"], { formato: "irregular" }),
  D("carpaccio", "Carpaccio", "prato_raso", ["beef carpaccio with arugula and parmesan"], ["carpaccio"], { topo: "reto" }),
  // ---- sobremesas
  D("fatia_bolo", "Fatia de bolo", "fatia", ["a slice of cake", "a slice of layered cake on a plate"], ["fatia de bolo", "pedaco de bolo", "bolo fatia", "bolo de pote"], { formato: "irregular", topo: "reto", partes: ["bolo"] }),
  D("bolo", "Bolo inteiro", "bolo", ["a whole round cake", "a frosted layer cake"], ["bolo", "naked cake", "bolo de aniversario", "bolo inteiro", "bolo de chocolate", "bolo de cenoura"], { formato: "redondo", topo: "reto", partes: ["bolo"] }),
  D("torta_doce", "Torta doce", "fatia", ["a slice of pie", "a lemon meringue tart", "a fruit tart"], ["torta", "torta de limao", "torta holandesa", "tortinha", "banoffee", "torta doce", "torta de morango", "torta alema"], { formato: "irregular", topo: "reto" }),
  D("cheesecake", "Cheesecake", "fatia", ["a slice of cheesecake with berry sauce"], ["cheesecake", "cheese cake"], { formato: "irregular", topo: "reto" }),
  D("pudim", "Pudim", "bolo", ["a Brazilian flan with caramel sauce", "a caramel custard pudding"], ["pudim", "flan", "pudim de leite"], { formato: "redondo", topo: "reto" }),
  D("brigadeiro", "Brigadeiros", "porcao", ["brigadeiros, Brazilian chocolate truffles", "chocolate truffles"], ["brigadeiro", "brigadeiros", "docinhos", "docinho", "beijinho", "trufa", "trufas", "bombom", "bombons"], { formato: "irregular", topo: "arredondado" }),
  D("brownie", "Brownie", "prato_raso", ["a chocolate brownie", "a brownie with a scoop of ice cream"], ["brownie", "brownies"], { formato: "retangular", topo: "reto", partes: ["chocolate", "sorvete", "morango"] }),
  D("petit_gateau", "Petit gâteau", "prato_raso", ["a chocolate lava cake with a scoop of ice cream"], ["petit gateau", "petit gatou", "petit gato", "vulcao de chocolate", "petit"], { formato: "redondo", topo: "arredondado", partes: ["chocolate", "sorvete"] }),
  D("sorvete", "Sorvete", "sorvete", ["scoops of ice cream in a bowl", "a scoop of ice cream"], ["sorvete", "gelato", "bola de sorvete", "sorvetes"], { formato: "redondo", topo: "arredondado", partes: ["sorvete"] }),
  D("sundae", "Sundae", "taca_copo", ["an ice cream sundae in a glass with chocolate sauce", "a banana split"], ["sundae", "banana split", "taca de sorvete", "colegial"], { formato: "redondo", topo: "arredondado", transparente: true, partes: ["sorvete", "chocolate"] }),
  D("casquinha", "Casquinha", "sorvete", ["an ice cream cone"], ["casquinha", "cascao", "cone", "picole"], { formato: "redondo", topo: "arredondado" }),
  D("milkshake", "Milkshake", "taca_copo", ["a milkshake with whipped cream in a tall glass"], ["milkshake", "milk shake", "shake", "frappe", "frapuccino"], { formato: "redondo", topo: "arredondado", transparente: true }),
  D("mousse", "Mousse", "taca_copo", ["chocolate mousse in a glass", "a dessert in a small glass cup"], ["mousse", "musse", "verrine", "sobremesa no pote", "pote", "copo da felicidade"], { formato: "redondo", topo: "reto", transparente: true }),
  D("pave", "Pavê", "taca_copo", ["a layered dessert with cream and cookies", "trifle"], ["pave", "trifle", "banoffee no pote", "pudim no pote"], { formato: "redondo", topo: "reto" }),
  D("tiramisu", "Tiramisù", "fatia", ["tiramisu dusted with cocoa"], ["tiramisu"], { formato: "retangular", topo: "reto" }),
  D("cupcake", "Cupcake", "prato_alto", ["a cupcake with frosting", "a muffin"], ["cupcake", "cupcakes", "muffin", "muffins"], { formato: "redondo", topo: "arredondado" }),
  D("donut", "Donut", "porcao", ["a glazed donut", "doughnuts with icing"], ["donut", "donuts", "rosquinha", "sonho", "sonhos"], { formato: "redondo", topo: "arredondado" }),
  D("churros", "Churros", "porcao", ["churros with dulce de leche"], ["churros", "churro"], { formato: "irregular" }),
  D("waffle", "Waffle", "prato_raso", ["a waffle with fruit and syrup"], ["waffle", "waffles"], { formato: "irregular", topo: "reto" }),
  D("salada_frutas", "Salada de frutas", "tigela", ["a bowl of fruit salad", "a plate of sliced fruit"], ["salada de frutas", "frutas", "fruta", "prato de frutas"], { partes: ["fruta"] }),
  D("morango_chocolate", "Morango com chocolate", "prato_raso", ["strawberries dipped in chocolate", "a bowl of strawberries"], ["morango com chocolate", "morangos", "morango do amor", "morango"], { formato: "irregular", partes: ["morango", "chocolate"] }),
  D("cookie", "Cookie", "porcao", ["chocolate chip cookies"], ["cookie", "cookies", "biscoito"], { formato: "redondo", topo: "reto" }),
  D("quindim", "Quindim", "porcao", ["quindim, a small glossy yellow coconut custard"], ["quindim", "quindins"], { formato: "redondo", topo: "reto" }),
  D("creme_brulee", "Crème brûlée", "tigela", ["creme brulee with a caramelized sugar crust"], ["creme brulee", "creme brule"], { formato: "redondo", topo: "reto" }),
  D("acai_copo", "Açaí no copo", "taca_copo", ["an acai cup with granola, banana and condensed milk"], ["acai no copo", "copo de acai"], { formato: "redondo", transparente: true }),
  // ---- bebidas
  D("suco", "Suco", "bebida", ["a glass of fresh orange juice", "a glass of fruit juice"], ["suco", "suco natural", "laranjada", "limonada", "vitamina", "smoothie", "suco de laranja", "suco verde"], { formato: "redondo", topo: "reto", transparente: true }),
  D("refrigerante", "Refrigerante", "bebida", ["a glass of soda with ice", "a can of soda"], ["refrigerante", "refri", "coca", "coca cola", "guarana", "soda", "fanta", "sprite", "lata de refrigerante"], { formato: "redondo", topo: "reto", transparente: true }),
  D("cerveja", "Cerveja", "bebida", ["a glass of beer", "a bottle of beer"], ["cerveja", "chopp", "chope", "long neck", "pilsen", "ipa"], { formato: "redondo", topo: "reto", transparente: true }),
  D("caipirinha", "Caipirinha", "bebida", ["a caipirinha cocktail with lime and ice"], ["caipirinha", "caipiroska", "caipi", "caipisake"], { formato: "redondo", topo: "reto", transparente: true }),
  D("drink", "Drink", "bebida", ["a cocktail in a glass", "a gin and tonic with fruit"], ["drink", "drinks", "coquetel", "gin", "gin tonica", "aperol", "mojito", "margarita", "negroni", "whisky", "dose", "spritz", "moscow mule"], { formato: "redondo", topo: "reto", transparente: true }),
  D("vinho", "Vinho", "bebida", ["a glass of red wine"], ["vinho", "taca de vinho", "vinho tinto", "vinho branco", "espumante"], { formato: "redondo", topo: "reto", transparente: true }),
  D("cafe", "Café", "bebida", ["a cup of coffee", "a cappuccino with latte art", "an espresso in a small cup"], ["cafe", "cappuccino", "capuccino", "expresso", "espresso", "latte", "mocha", "cha", "cafe com leite", "pingado"], { formato: "redondo", topo: "reto" }),
  D("agua_coco", "Água de coco", "bebida", ["a green coconut with a straw"], ["agua de coco", "coco gelado"], { formato: "redondo", topo: "arredondado" }),
];

const P = (id: string, nome: string, rough: number, en: string[], alias: string[], trat?: Part["trat"], doce?: boolean): Part => ({ id, nome, rough, en, alias, trat, doce });

/** Partes que aparecem nos pratos (a IA olha cada pedaço do prato e diz qual é). */
export const PARTS: Part[] = [
  P("arroz", "arroz", 0.8, ["cooked white rice", "a mound of steamed white rice on a plate", "white rice grains"], ["arroz"], undefined, false),
  P("feijao", "feijão", 0.32, ["cooked brown beans", "a portion of pinto beans in sauce", "black beans", "bean stew"], ["feijao", "feijoada", "tropeiro"], "feijao", false),
  P("carne", "carne", 0.55, ["a grilled steak", "a piece of cooked beef", "sliced meat"], ["carne", "bife", "file", "picanha", "alcatra", "costela"], undefined, false),
  P("frango", "frango", 0.55, ["grilled chicken", "fried chicken"], ["frango", "galinha"], undefined, false),
  P("peixe", "peixe", 0.5, ["a cooked fish fillet"], ["peixe", "salmao", "tilapia"], undefined, false),
  P("linguica", "linguiça", 0.45, ["sausage slices", "grilled sausage"], ["linguica", "calabresa", "salsicha"], undefined, false),
  P("salada", "salada", 0.45, ["lettuce and tomato salad", "green salad leaves"], ["salada", "alface", "rucula", "folhas"], undefined, false),
  P("tomate", "tomate", 0.3, ["tomato slices"], ["tomate", "tomates"]),
  P("batata_frita", "batata frita", 0.7, ["french fries", "potato sticks"], ["batata frita", "fritas", "batata palha"], undefined, false),
  P("farofa", "farofa", 0.85, ["toasted cassava flour", "breadcrumbs"], ["farofa"], undefined, false),
  P("ovo", "ovo", 0.4, ["a fried egg"], ["ovo", "ovos"]),
  P("macarrao", "macarrão", 0.5, ["spaghetti noodles", "pasta"], ["macarrao", "massa", "espaguete", "nhoque"], undefined, false),
  P("molho", "molho", 0.3, ["tomato sauce", "a sauce"], ["molho", "caldo"], undefined, false),
  P("pure", "purê", 0.6, ["mashed potatoes"], ["pure", "pure de batata", "mandioca"], undefined, false),
  P("legumes", "legumes", 0.5, ["cooked vegetables, broccoli and carrots"], ["legumes", "brocolis", "cenoura", "vegetais"], undefined, false),
  P("pao", "pão", 0.7, ["a bread bun", "toasted bread"], ["pao", "paes", "torrada"]),
  P("queijo", "queijo", 0.45, ["melted cheese", "a slice of cheese"], ["queijo", "mussarela", "cheddar", "catupiry"]),
  P("pizza", "pizza", 0.55, ["a pizza"], ["pizza"], undefined, false),
  P("hamburguer", "hambúrguer", 0.6, ["a hamburger"], ["hamburguer", "burger"], undefined, false),
  P("morango", "morango", 0.28, ["a fresh red strawberry", "strawberries"], ["morango", "morangos"], "morango", true),
  P("chocolate", "chocolate", 0.4, ["a chocolate brownie", "chocolate sauce", "chocolate cake"], ["chocolate", "brownie", "calda"], undefined, true),
  P("sorvete", "sorvete", 0.5, ["a scoop of vanilla ice cream", "ice cream"], ["sorvete", "gelato"], undefined, true),
  P("chantilly", "chantilly", 0.55, ["whipped cream"], ["chantilly", "creme"], undefined, true),
  P("fruta", "fruta", 0.35, ["sliced fruit", "banana slices", "fresh berries"], ["fruta", "frutas", "banana", "kiwi", "manga", "uva"]),
  P("bolo", "bolo", 0.6, ["a slice of cake", "sponge cake layers"], ["bolo", "torta"], undefined, true),
  P("sushi", "sushi", 0.45, ["sushi rolls"], ["sushi", "sashimi"], undefined, false),
];

/** Frases que embrulham cada descrição na hora de gerar os vetores (média das variações = mais estável). */
export const DISH_TEMPLATES = ["a photo of {}.", "a photo of {}, a type of food.", "a close-up photo of {} on a table.", "a restaurant photo of {}."];
export const PART_TEMPLATES = ["a close-up photo of {}.", "a photo of {}, a type of food.", "a top view of {} on a plate."];

/** Doces e sobremesas (o resto é salgado ou bebida): muda que partes a IA espera ver. */
const SWEET_KINDS = new Set(["fatia", "bolo", "taca_copo", "sorvete"]);
const SWEET_IDS = new Set(["brownie", "petit_gateau", "brigadeiro", "donut", "churros", "waffle", "salada_frutas", "morango_chocolate", "cookie", "quindim", "creme_brulee", "acai_tigela", "cupcake", "pudim"]);
export const isSweet = (d: Dish) => SWEET_IDS.has(d.id) || (SWEET_KINDS.has(d.kind) && d.id !== "quiche");

export const dishById = (id: string) => DISHES.find((d) => d.id === id);
export const partById = (id: string) => PARTS.find((p) => p.id === id);

// ---------------------------------------------------------------------------------------------------------------
// Entender um nome digitado

export const normName = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

/** Distância de edição (com troca de letras vizinhas), limitada: devolve > max assim que passar. */
function editDist(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const n = b.length;
  let prev2 = new Array(n + 1).fill(0), prev = Array.from({ length: n + 1 }, (_, j) => j), cur = new Array(n + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    [prev2, prev, cur] = [prev, cur, prev2];
  }
  return prev[n];
}

/** Um apelido aparece no texto? Aceita 1 letra errada em palavras de 5+ letras (2 em 9+). */
function aliasHit(words: string[], alias: string): number {
  const aw = alias.split(" ");
  let best = 0;
  for (let i = 0; i + aw.length <= words.length; i++) {
    let errs = 0, ok = true;
    for (let k = 0; k < aw.length && ok; k++) {
      const a = aw[k], w = words[i + k];
      if (a === w) continue;
      const tol = a.length >= 9 ? 2 : a.length >= 5 ? 1 : 0;
      const d = tol ? editDist(a, w, tol) : 1;
      if (d > tol) ok = false;
      else errs += d;
    }
    if (ok) best = Math.max(best, aw.length * 10 + alias.length - errs * 4);
  }
  return best;
}

export type NameMatch = { dish: Dish | null; score: number; parts: Part[] };

/** O que o texto diz: qual prato (o apelido mais longo que bater vence) e quais partes ele cita. */
export function matchName(text: string): NameMatch {
  const words = normName(text).split(" ").filter(Boolean);
  let dish: Dish | null = null, score = 0;
  for (const d of DISHES)
    for (const a of d.alias) {
      const s = aliasHit(words, a);
      if (s > score) { score = s; dish = d; }
    }
  const parts: Part[] = [];
  for (const p of PARTS) if (p.alias.some((a) => aliasHit(words, a) > 0)) parts.push(p);
  return { dish, score, parts };
}

/** Descrição curta do que a IA entendeu, para mostrar ao dono. */
export function describeParts(ids: string[]) {
  const names = [...new Set(ids)].map((id) => partById(id)?.nome).filter(Boolean) as string[];
  if (!names.length) return "";
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}
