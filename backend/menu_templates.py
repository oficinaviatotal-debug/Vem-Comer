"""Ready-made menus by type of business.

A new owner picks a type, taps the dishes he really sells and says the price of
each one. The lists carry NO prices on purpose: a price is the owner's decision.
Names are plain Portuguese, no brand names beyond generic drink names.
"""

_DRINKS_COMMON = [
    "Refrigerante lata",
    "Refrigerante 600 ml",
    "Refrigerante 2 litros",
    "Suco de laranja",
    "Suco de maracujá",
    "Suco de acerola",
    "Água mineral",
    "Água com gás",
]

_TEMPLATES = {
    "lanchonete": {
        "name": "Lanchonete",
        "icon": "🥪",
        "categories": [
            ("Lanches", [
                "X-Burguer", "X-Salada", "X-Bacon", "X-Egg", "X-Tudo", "X-Frango",
                "X-Calabresa", "Hambúrguer simples", "Cheeseburguer", "Misto quente",
                "Bauru", "Sanduíche natural", "Cachorro-quente", "Cachorro-quente duplo",
                "Pão com ovo", "Pão na chapa", "Beirute de carne", "Beirute de frango",
            ]),
            ("Salgados", [
                "Pastel de carne", "Pastel de queijo", "Pastel de frango", "Pastel de pizza",
                "Coxinha", "Empada", "Esfiha de carne", "Enroladinho de salsicha",
                "Pão de queijo", "Tapioca de queijo", "Tapioca de frango",
            ]),
            ("Porções", [
                "Batata frita", "Batata frita com cheddar e bacon", "Mandioca frita",
                "Anéis de cebola", "Calabresa acebolada", "Frango a passarinho",
                "Isca de peixe", "Polenta frita", "Bolinho de queijo",
            ]),
            ("Bebidas", _DRINKS_COMMON + [
                "Suco de abacaxi", "Vitamina de banana", "Café", "Chá gelado",
            ]),
            ("Sobremesas", [
                "Pudim", "Mousse de maracujá", "Brigadeiro", "Bola de sorvete", "Milkshake",
            ]),
        ],
    },
    "pizzaria": {
        "name": "Pizzaria",
        "icon": "🍕",
        "categories": [
            ("Pizzas salgadas", [
                "Mussarela", "Calabresa", "Portuguesa", "Margherita", "Frango com catupiry",
                "Quatro queijos", "Napolitana", "Toscana", "Bacon", "Atum",
                "Lombo canadense", "Presunto", "Vegetariana", "Alho e óleo",
                "Strogonoff de carne", "Costela com cheddar", "Moda da casa",
            ]),
            ("Pizzas doces", [
                "Chocolate", "Chocolate com morango", "Banana com canela",
                "Romeu e Julieta", "Prestígio", "Brigadeiro", "Doce de leite",
            ]),
            ("Calzones e esfihas", [
                "Calzone de frango", "Calzone de calabresa", "Esfiha de carne",
                "Esfiha de queijo", "Esfiha de frango com catupiry",
            ]),
            ("Bebidas", _DRINKS_COMMON + [
                "Cerveja long neck", "Cerveja 600 ml", "Vinho (taça)",
            ]),
        ],
    },
    "restaurante": {
        "name": "Restaurante e marmitaria",
        "icon": "🍛",
        "categories": [
            ("Marmitas e pratos feitos", [
                "Marmita pequena", "Marmita média", "Marmita grande", "Marmita fit",
                "Prato feito (PF)", "Prato executivo",
            ]),
            ("Pratos do dia", [
                "Feijoada", "Bife acebolado", "Frango grelhado", "Frango assado",
                "Strogonoff de frango", "Strogonoff de carne", "Carne de panela",
                "Costela assada", "Filé de peixe", "Moqueca de peixe",
                "Parmegiana de frango", "Parmegiana de carne", "Lasanha",
                "Macarrão à bolonhesa", "Virado à paulista", "Baião de dois",
                "Carne de sol", "Galinhada", "Escondidinho de carne seca", "Omelete",
            ]),
            ("Acompanhamentos", [
                "Arroz", "Feijão", "Farofa", "Macarrão", "Purê de batata",
                "Batata frita", "Salada", "Vinagrete", "Legumes cozidos", "Ovo frito",
            ]),
            ("Bebidas", _DRINKS_COMMON),
            ("Sobremesas", ["Pudim", "Mousse", "Pavê", "Gelatina", "Fruta da estação"]),
        ],
    },
    "bar": {
        "name": "Bar e boteco",
        "icon": "🍺",
        "categories": [
            ("Cervejas", [
                "Cerveja long neck", "Cerveja 600 ml", "Cerveja lata", "Cerveja artesanal",
                "Chopp 300 ml", "Chopp 500 ml",
            ]),
            ("Drinks e doses", [
                "Caipirinha de limão", "Caipirinha de morango", "Caipiroska",
                "Batida de coco", "Batida de maracujá", "Gin tônica", "Dose de cachaça",
                "Dose de whisky", "Dose de vodka", "Dose de gin",
            ]),
            ("Petiscos", [
                "Porção de batata frita", "Calabresa acebolada", "Torresmo",
                "Frango a passarinho", "Mandioca frita", "Bolinho de bacalhau",
                "Isca de peixe", "Camarão empanado", "Carne de sol com mandioca",
                "Queijo coalho", "Tábua de frios", "Caldinho de feijão",
            ]),
            ("Refeições", ["Feijoada", "Prato do dia", "Sanduíche de carne"]),
            ("Sem álcool", [
                "Refrigerante lata", "Água mineral", "Suco de laranja", "Energético",
            ]),
        ],
    },
    "acai": {
        "name": "Açaí e sorveteria",
        "icon": "🍧",
        "categories": [
            ("Açaí", [
                "Açaí 300 ml", "Açaí 500 ml", "Açaí 700 ml", "Açaí 1 litro",
                "Açaí na tigela com granola", "Açaí com leite em pó", "Açaí fit",
            ]),
            ("Sorvetes", [
                "Bola de sorvete", "Casquinha", "Casquinha dupla", "Picolé", "Sundae",
                "Milkshake 300 ml", "Milkshake 500 ml", "Taça de sorvete", "Cupuaçu",
            ]),
            ("Adicionais", [
                "Granola", "Leite em pó", "Leite condensado", "Banana", "Morango",
                "Paçoca", "Amendoim", "Chocolate granulado", "Calda de chocolate",
                "Mel", "Confete",
            ]),
            ("Bebidas", [
                "Água de coco", "Suco de laranja", "Vitamina", "Refrigerante lata",
                "Água mineral",
            ]),
        ],
    },
    "padaria": {
        "name": "Padaria e cafeteria",
        "icon": "🥐",
        "categories": [
            ("Pães", [
                "Pão francês (unidade)", "Pão francês (quilo)", "Pão de forma",
                "Pão integral", "Pão de queijo", "Pão doce", "Pão de leite", "Baguete",
                "Croissant", "Sonho", "Rosca",
            ]),
            ("Salgados", [
                "Coxinha", "Pastel assado", "Empada", "Enroladinho", "Esfiha",
                "Folhado de queijo", "Pão de batata", "Quiche", "Torta salgada (fatia)",
                "Misto quente", "Pão na chapa",
            ]),
            ("Doces e bolos", [
                "Bolo de cenoura (fatia)", "Bolo de chocolate (fatia)", "Bolo de milho (fatia)",
                "Torta de limão (fatia)", "Brigadeiro", "Beijinho", "Pudim",
            ]),
            ("Cafés e bebidas", [
                "Café coado", "Café com leite", "Cappuccino", "Café expresso",
                "Chocolate quente", "Suco de laranja", "Vitamina", "Chá",
                "Refrigerante lata", "Água mineral",
            ]),
            ("Café da manhã", [
                "Café da manhã completo", "Tapioca", "Cuscuz com ovo",
                "Pão com manteiga", "Ovos mexidos",
            ]),
        ],
    },
    "churrasco": {
        "name": "Churrasco e espetinho",
        "icon": "🍖",
        "categories": [
            ("Espetinhos", [
                "Espetinho de carne", "Espetinho de frango", "Espetinho de coração",
                "Espetinho de linguiça", "Espetinho de queijo coalho",
                "Espetinho de medalhão", "Espetinho de pernil", "Espetinho de bacon",
                "Espetinho de camarão", "Espetinho de kafta",
            ]),
            ("Carnes", [
                "Picanha", "Fraldinha", "Maminha", "Costela", "Contra-filé",
                "Linguiça toscana", "Coração de galinha", "Asinha de frango", "Cupim",
                "Filé de frango",
            ]),
            ("Acompanhamentos", [
                "Arroz", "Feijão tropeiro", "Farofa", "Mandioca cozida", "Vinagrete",
                "Pão de alho", "Salada", "Batata frita", "Queijo coalho",
            ]),
            ("Bebidas", _DRINKS_COMMON + [
                "Cerveja long neck", "Cerveja 600 ml", "Caipirinha de limão",
            ]),
        ],
    },
    "japones": {
        "name": "Comida japonesa",
        "icon": "🍣",
        "categories": [
            ("Sushis e sashimis", [
                "Sushi de salmão (2 unidades)", "Sushi de atum (2 unidades)",
                "Sushi de camarão (2 unidades)", "Niguiri de salmão (2 unidades)",
                "Niguiri de kani (2 unidades)", "Sashimi de salmão (5 fatias)",
                "Sashimi de atum (5 fatias)",
            ]),
            ("Rolls e temakis", [
                "Uramaki de salmão", "Uramaki Philadelphia", "Uramaki skin",
                "Hossomaki de pepino", "Hossomaki de salmão", "Califórnia", "Hot roll",
                "Temaki de salmão", "Temaki skin", "Temaki de kani", "Temaki de camarão",
            ]),
            ("Combinados", [
                "Combinado 10 peças", "Combinado 20 peças", "Combinado 30 peças",
                "Combinado 40 peças", "Barca para 2 pessoas", "Barca para 4 pessoas",
            ]),
            ("Pratos quentes", [
                "Yakisoba de frango", "Yakisoba de carne", "Yakisoba misto", "Guioza",
                "Tempurá de camarão", "Sunomono", "Missoshiru", "Teppanyaki",
            ]),
            ("Bebidas", [
                "Refrigerante lata", "Chá gelado", "Chá verde", "Suco de laranja",
                "Água mineral", "Cerveja long neck", "Sakê",
            ]),
            ("Sobremesas", ["Harumaki doce", "Banana tempurá", "Sorvete de matcha"]),
        ],
    },
    "tapiocaria": {
        "name": "Tapiocaria",
        "icon": "🥙",
        "categories": [
            ("Tapiocas salgadas", [
                "Tapioca de queijo coalho", "Tapioca de queijo e presunto",
                "Tapioca de frango com catupiry", "Tapioca de carne de sol",
                "Tapioca de carne seca", "Tapioca de calabresa", "Tapioca de ovo",
                "Tapioca de atum", "Tapioca de camarão", "Tapioca de pizza",
                "Tapioca de queijo com tomate seco", "Tapioca de queijo com banana",
            ]),
            ("Tapiocas doces", [
                "Tapioca de coco", "Tapioca de banana com canela", "Tapioca de doce de leite",
                "Tapioca de chocolate", "Tapioca de morango com leite condensado",
                "Tapioca de goiabada com queijo", "Tapioca de brigadeiro",
                "Tapioca de leite ninho",
            ]),
            ("Crepioca", [
                "Crepioca de queijo", "Crepioca de frango", "Crepioca de carne",
                "Crepioca de ovo com tomate",
            ]),
            ("Cuscuz", [
                "Cuscuz simples", "Cuscuz com ovo", "Cuscuz com queijo",
                "Cuscuz com carne de sol", "Cuscuz com frango", "Cuscuz com linguiça",
            ]),
            ("Bebidas", _DRINKS_COMMON + ["Café", "Café com leite", "Suco de cajá", "Água de coco"]),
        ],
    },
    "salgados": {
        "name": "Salgados e coxinhas",
        "icon": "🧆",
        "categories": [
            ("Salgados fritos", [
                "Coxinha de frango", "Coxinha com catupiry", "Risole de carne",
                "Risole de queijo e presunto", "Risole de frango", "Bolinha de queijo",
                "Bolinho de carne", "Kibe", "Croquete", "Travesseiro de presunto e queijo",
                "Enroladinho de salsicha", "Pastel de festa",
            ]),
            ("Assados e esfihas", [
                "Esfiha de carne", "Esfiha de queijo", "Esfiha de frango com catupiry",
                "Empada de frango", "Empada de palmito", "Enroladinho assado",
                "Folhado de queijo", "Pão de queijo", "Pão de batata",
            ]),
            ("Salgados de festa", [
                "Salgado de festa misto 50 unidades", "Salgado de festa misto 100 unidades",
                "Salgado de festa de um sabor 50 unidades", "Salgado de festa de um sabor 100 unidades",
                "Mini coxinha 100 unidades", "Mini pastel 100 unidades",
                "Assado de festa 100 unidades",
            ]),
            ("Bebidas", _DRINKS_COMMON),
        ],
    },
    "pastelaria": {
        "name": "Pastelaria",
        "icon": "🥟",
        "categories": [
            ("Pastéis salgados", [
                "Pastel de carne", "Pastel de queijo", "Pastel de frango",
                "Pastel de frango com catupiry", "Pastel de pizza", "Pastel de calabresa",
                "Pastel de carne com queijo", "Pastel de queijo e presunto",
                "Pastel de palmito", "Pastel de bacalhau", "Pastel de camarão",
                "Pastel de carne seca com queijo", "Pastel de vento",
            ]),
            ("Pastéis doces", [
                "Pastel de banana com chocolate", "Pastel de queijo com goiabada",
                "Pastel de doce de leite", "Pastel de chocolate", "Pastel de morango com chocolate",
            ]),
            ("Mini pastéis", [
                "Mini pastel de carne 10 unidades", "Mini pastel de queijo 10 unidades",
                "Mini pastel misto 50 unidades", "Mini pastel misto 100 unidades",
            ]),
            ("Porções", [
                "Batata frita", "Mandioca frita", "Bolinho de bacalhau", "Calabresa acebolada",
            ]),
            ("Bebidas", [
                "Caldo de cana 300 ml", "Caldo de cana 500 ml", "Caldo de cana 700 ml",
                "Caldo de cana com limão", "Caldo de cana com abacaxi",
                "Refrigerante lata", "Refrigerante 600 ml", "Refrigerante 2 litros",
                "Suco de laranja", "Água mineral",
            ]),
        ],
    },
    "hamburgueria": {
        "name": "Hamburgueria",
        "icon": "🍔",
        "categories": [
            ("Hambúrgueres", [
                "Hambúrguer clássico", "Cheeseburguer", "Cheddar e bacon", "Hambúrguer duplo",
                "Hambúrguer triplo", "Smash simples", "Smash duplo", "Burger de frango crocante",
                "Burger de costela", "Burger de picanha", "Burger vegetariano",
                "Burger com ovo", "Burger com cebola caramelizada", "Burger barbecue",
            ]),
            ("Combos", [
                "Combo clássico (burger, batata e refrigerante)",
                "Combo duplo (burger, batata e refrigerante)",
                "Combo smash (burger, batata e refrigerante)",
                "Combo infantil",
            ]),
            ("Acompanhamentos", [
                "Batata frita pequena", "Batata frita média", "Batata frita grande",
                "Batata com cheddar e bacon", "Anéis de cebola", "Nuggets de frango 6 unidades",
                "Nuggets de frango 10 unidades", "Mandioca frita",
            ]),
            ("Adicionais", [
                "Bacon extra", "Queijo extra", "Ovo extra", "Hambúrguer extra",
                "Cebola caramelizada", "Molho da casa",
            ]),
            ("Bebidas", _DRINKS_COMMON + [
                "Milkshake 300 ml", "Milkshake 500 ml", "Cerveja long neck",
            ]),
            ("Sobremesas", ["Brownie", "Sundae", "Torta de limão (fatia)"]),
        ],
    },
    "cafeteria": {
        "name": "Café da manhã e cafeteria",
        "icon": "☕",
        "categories": [
            ("Cafés", [
                "Café expresso", "Expresso duplo", "Café coado", "Café com leite", "Cappuccino",
                "Mocaccino", "Macchiato", "Latte", "Café gelado", "Affogato",
                "Chocolate quente", "Chocolate quente cremoso",
            ]),
            ("Café da manhã", [
                "Café da manhã completo", "Café da manhã simples", "Pão na chapa",
                "Pão com manteiga", "Pão com queijo", "Misto quente", "Tapioca",
                "Cuscuz com ovo", "Ovos mexidos", "Omelete", "Iogurte com granola",
                "Panqueca americana", "Torrada com requeijão", "Fruta fatiada",
            ]),
            ("Salgados e tostas", [
                "Croissant de queijo e presunto", "Tosta de queijo", "Tosta de ovo e tomate",
                "Sanduíche natural", "Quiche (fatia)", "Pão de queijo", "Empada",
            ]),
            ("Doces", [
                "Bolo de cenoura (fatia)", "Bolo de chocolate (fatia)", "Brownie", "Cookie",
                "Torta de limão (fatia)", "Cheesecake (fatia)", "Pão de mel", "Brigadeiro",
            ]),
            ("Bebidas frias", [
                "Suco de laranja", "Suco verde", "Vitamina de banana", "Chá gelado",
                "Limonada suíça", "Água mineral", "Água com gás", "Refrigerante lata",
            ]),
        ],
    },
    "bolos": {
        "name": "Bolos e tortas",
        "icon": "🎂",
        "categories": [
            ("Bolos (fatia)", [
                "Bolo de cenoura com chocolate (fatia)", "Bolo de chocolate (fatia)",
                "Bolo de milho (fatia)", "Bolo de fubá (fatia)", "Bolo de laranja (fatia)",
                "Bolo de coco (fatia)", "Bolo de aipim (fatia)", "Bolo de ninho com morango (fatia)",
            ]),
            ("Bolos inteiros", [
                "Bolo de cenoura com chocolate (inteiro)", "Bolo de chocolate (inteiro)",
                "Bolo de milho (inteiro)", "Bolo de fubá (inteiro)", "Bolo de laranja (inteiro)",
            ]),
            ("Tortas", [
                "Torta de limão (fatia)", "Torta de morango (fatia)", "Torta holandesa (fatia)",
                "Torta de maracujá (fatia)", "Torta salgada (fatia)", "Torta de limão (inteira)",
            ]),
            ("Bolos no pote", [
                "Bolo no pote de chocolate", "Bolo no pote de ninho com morango",
                "Bolo no pote de brigadeiro", "Bolo no pote de cenoura",
                "Bolo no pote de maracujá",
            ]),
            ("Bolos de festa (encomenda)", [
                "Bolo de aniversário 1 kg", "Bolo de aniversário 1,5 kg",
                "Bolo de aniversário 2 kg", "Bolo de aniversário 3 kg",
                "Bolo decorado de 2 andares",
            ]),
            ("Bebidas", ["Café", "Café com leite", "Suco de laranja", "Refrigerante lata", "Água mineral"]),
        ],
    },
    "doces": {
        "name": "Doces e sobremesas",
        "icon": "🍮",
        "categories": [
            ("Brigadeiros e docinhos", [
                "Brigadeiro tradicional", "Brigadeiro gourmet", "Beijinho", "Cajuzinho",
                "Bicho de pé", "Olho de sogra", "Brigadeiro 50 unidades", "Brigadeiro 100 unidades",
                "Docinhos sortidos 100 unidades",
            ]),
            ("Sobremesas", [
                "Pudim de leite (fatia)", "Pudim de leite (inteiro)", "Mousse de maracujá",
                "Mousse de chocolate", "Pavê", "Cheesecake (fatia)", "Petit gâteau",
                "Tiramisù", "Panna cotta", "Torta holandesa (fatia)",
            ]),
            ("Doces no pote", [
                "Brigadeiro de colher no pote", "Bolo no pote", "Mousse no pote",
                "Pudim no pote", "Cheesecake no pote", "Pote da felicidade",
            ]),
            ("Chocolates", [
                "Trufa", "Brownie", "Cookie", "Palha italiana", "Pão de mel", "Casadinho",
                "Ovo de colher", "Barra de chocolate recheada",
            ]),
            ("Churros e fritos", [
                "Churros de doce de leite", "Churros de chocolate", "Churros de goiabada",
                "Sonho", "Rosquinha",
            ]),
            ("Bebidas", ["Café", "Refrigerante lata", "Suco de laranja", "Água mineral"]),
        ],
    },
    "sorveteria": {
        "name": "Sorveteria",
        "icon": "🍦",
        "categories": [
            ("Casquinhas e cascões", [
                "Casquinha 1 bola", "Casquinha 2 bolas", "Casquinha 3 bolas",
                "Cascão 1 bola", "Cascão 2 bolas", "Cascão 3 bolas",
            ]),
            ("Potes e taças", [
                "Pote 200 ml", "Pote 300 ml", "Pote 500 ml", "Pote 1 litro", "Pote 2 litros",
                "Taça de sorvete", "Sundae", "Banana split", "Petit gâteau com sorvete",
                "Affogato",
            ]),
            ("Milkshakes", ["Milkshake 300 ml", "Milkshake 500 ml", "Milkshake 700 ml"]),
            ("Picolés", [
                "Picolé de fruta", "Picolé cremoso", "Picolé de leite condensado",
                "Picolé de chocolate", "Picolé de açaí", "Paleta mexicana",
            ]),
            ("Coberturas e adicionais", [
                "Calda de chocolate", "Calda de morango", "Calda de caramelo", "Granulado",
                "Paçoca", "Confete", "Leite em pó", "Chantilly",
            ]),
            ("Bebidas", ["Água de coco", "Refrigerante lata", "Suco de laranja", "Água mineral"]),
        ],
    },
    "crepe": {
        "name": "Crepe e waffle",
        "icon": "🥞",
        "categories": [
            ("Crepes salgados", [
                "Crepe de queijo e presunto", "Crepe de frango com catupiry", "Crepe de carne",
                "Crepe de calabresa", "Crepe de queijo", "Crepe de atum",
                "Crepe de queijo com tomate seco", "Crepe quatro queijos", "Crepe de palmito",
            ]),
            ("Crepes doces", [
                "Crepe de chocolate", "Crepe de chocolate com morango",
                "Crepe de banana com canela", "Crepe de doce de leite",
                "Crepe de goiabada com queijo", "Crepe de brigadeiro", "Crepe de leite ninho",
                "Crepe de maçã com canela",
            ]),
            ("Waffles", [
                "Waffle simples", "Waffle com sorvete", "Waffle com frutas",
                "Waffle com chocolate", "Waffle de doce de leite", "Waffle salgado",
            ]),
            ("Panquecas", [
                "Panqueca americana com mel", "Panqueca de carne", "Panqueca de frango",
                "Panqueca de chocolate",
            ]),
            ("Bebidas", _DRINKS_COMMON + ["Café", "Chocolate quente", "Milkshake 300 ml"]),
        ],
    },
    "regional": {
        "name": "Comida regional",
        "icon": "🍲",
        "categories": [
            ("Nordeste e Bahia", [
                "Baião de dois", "Carne de sol com macaxeira", "Escondidinho de carne seca",
                "Arrumadinho", "Feijão de corda", "Cuscuz nordestino", "Paçoca de carne de sol",
                "Galinha caipira", "Moqueca baiana", "Acarajé", "Abará", "Vatapá", "Caruru",
            ]),
            ("Minas e Centro-Oeste", [
                "Feijão tropeiro", "Frango com quiabo", "Tutu de feijão", "Costelinha de porco",
                "Torresmo", "Couve refogada", "Arroz com pequi", "Empadão goiano", "Pamonha",
            ]),
            ("Norte", [
                "Tacacá", "Maniçoba", "Pirarucu frito", "Tucunaré frito", "Pato no tucupi",
            ]),
            ("Sul", [
                "Arroz carreteiro", "Galeto", "Polenta frita", "Cuca", "Churrasco gaúcho",
            ]),
            ("Bebidas", [
                "Suco de cajá", "Suco de graviola", "Suco de cupuaçu", "Água de coco",
                "Caldo de cana", "Refrigerante lata", "Água mineral", "Cerveja long neck",
            ]),
            ("Sobremesas", [
                "Cocada", "Bolo de rolo", "Doce de leite", "Doce de banana",
                "Queijo com goiabada", "Rapadura",
            ]),
        ],
    },
}


def list_templates():
    """Summary of every template: id, name, icon and its categories with counts."""
    return [
        {
            "id": template_id,
            "name": data["name"],
            "icon": data["icon"],
            "categories": [
                {"name": name, "count": len(items)} for name, items in data["categories"]
            ],
        }
        for template_id, data in _TEMPLATES.items()
    ]


def get_template(template_id):
    """One template with every item (no prices), or None when the id is unknown."""
    data = _TEMPLATES.get(template_id)
    if data is None:
        return None
    return {
        "id": template_id,
        "name": data["name"],
        "icon": data["icon"],
        "categories": [
            {"name": name, "items": [{"name": item} for item in items]}
            for name, items in data["categories"]
        ],
    }
