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
        "icon": "🍔",
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
