"""Custo do prato pela ficha tecnica, CMV e preco sugerido.

So contas: sem banco e sem Flask, para testar sozinho. Dinheiro e quantidade sempre em Decimal.

Palavras usadas aqui:
- insumo: o que o restaurante compra (frango, arroz, embalagem). Tem o tamanho da embalagem e o preco pago.
- ficha tecnica: quanto de cada insumo vai em UMA porcao do prato.
- CMV do prato: custo da porcao dividido pelo preco de venda, em %. Ex.: custo R$ 8, preco R$ 25 = 32%.
- meta de CMV: o maximo que o dono aceita. Comeca em 35% (o Sebrae cita 25% a 35% para restaurante).
"""
from decimal import ROUND_CEILING, ROUND_HALF_UP, Decimal, InvalidOperation

# Unidade que o dono fala -> (unidade guardada no banco, quantas unidades guardadas cabem em 1).
UNITS = {
    'kg': ('g', Decimal('1000')),
    'g': ('g', Decimal('1')),
    'l': ('ml', Decimal('1000')),
    'ml': ('ml', Decimal('1')),
    'un': ('un', Decimal('1')),
    'dz': ('un', Decimal('12')),
}
BASE_UNITS = ('g', 'ml', 'un')

DEFAULT_TARGET = 35
MIN_TARGET = 5
MAX_TARGET = 90
# Ate 10 pontos acima da meta e "atencao"; mais que isso e "alto".
WARN_BAND = Decimal('10')

MAX_NAME = 80
MAX_PORTION = 60
MAX_PACKAGE_QTY = Decimal('1000000')    # 1.000 kg ou 1.000 L, na unidade guardada
MAX_PACKAGE_PRICE = Decimal('100000')
MAX_LINE_QTY = Decimal('100000')        # 100 kg numa porcao ja e erro de digitacao
MAX_EXTRA_COST = Decimal('10000')
MAX_RECIPE_LINES = 40

CENT = Decimal('0.01')


class CostError(ValueError):
    """Dado que o dono mandou e nao da para usar. A mensagem vai direto para a tela."""


def parse_number(value, label, allow_zero=True, maximum=None):
    """Aceita 18.9, "18,90", "R$ 18,90", "1.234,56" e "0,250". Recusa negativo, texto e infinito."""
    if isinstance(value, bool) or value is None:
        raise CostError(f"{label}: escreva um numero.")
    if isinstance(value, (int, float, Decimal)):
        text = str(value)
    elif isinstance(value, str):
        text = value.strip().replace('R$', '').replace(' ', '')
        if ',' in text:
            # formato brasileiro: ponto separa milhar, virgula separa centavos
            text = text.replace('.', '').replace(',', '.')
    else:
        raise CostError(f"{label}: escreva um numero.")
    try:
        number = Decimal(text)
    except (InvalidOperation, ValueError):
        raise CostError(f"{label}: escreva um numero.") from None
    if not number.is_finite():
        raise CostError(f"{label}: escreva um numero.")
    if number < 0 or (number == 0 and not allow_zero):
        raise CostError(f"{label}: precisa ser maior que zero.")
    if maximum is not None and number > maximum:
        raise CostError(f"{label}: numero grande demais. Confira se digitou certo.")
    return number


def normalize_unit(unit):
    text = (unit or '').strip().lower()
    aliases = {
        'quilo': 'kg', 'quilos': 'kg', 'kilo': 'kg', 'kilos': 'kg',
        'grama': 'g', 'gramas': 'g',
        'litro': 'l', 'litros': 'l',
        'mililitro': 'ml', 'mililitros': 'ml',
        'unidade': 'un', 'unidades': 'un', 'und': 'un', 'u': 'un',
        'duzia': 'dz', 'duzias': 'dz', 'dúzia': 'dz', 'dúzias': 'dz',
    }
    text = aliases.get(text, text)
    if text not in UNITS:
        raise CostError("Unidade: escolha kg, g, L, ml, unidade ou duzia.")
    return text


def to_base(quantity, unit, label='Quantidade', maximum=MAX_PACKAGE_QTY):
    """(quantidade, unidade do dono) -> (quantidade na unidade guardada, unidade guardada)."""
    code = normalize_unit(unit)
    base_unit, factor = UNITS[code]
    amount = parse_number(quantity, label, allow_zero=False) * factor
    if amount > maximum:
        raise CostError(f"{label}: numero grande demais. Confira se digitou certo.")
    # o banco guarda 3 casas; menos que isso some
    amount = amount.quantize(Decimal('0.001'), rounding=ROUND_HALF_UP)
    if amount <= 0:
        raise CostError(f"{label}: precisa ser maior que zero.")
    return amount, base_unit


def clean_name(name, label='Nome', maximum=MAX_NAME):
    text = ' '.join(str(name or '').split())
    if not text:
        raise CostError(f"{label}: escreva o nome.")
    if len(text) > maximum:
        raise CostError(f"{label}: use no maximo {maximum} letras.")
    return text


def clean_portion(text):
    value = ' '.join(str(text or '').split())
    if len(value) > MAX_PORTION:
        raise CostError(f"Porcao: use no maximo {MAX_PORTION} letras.")
    return value or None


def money(value):
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


def line_cost(quantity, package_qty, package_price):
    """Custo de um insumo dentro da porcao: quantidade usada x preco da embalagem / tamanho da embalagem."""
    package_qty = Decimal(package_qty)
    if package_qty <= 0:
        return Decimal('0')
    return Decimal(quantity) * Decimal(package_price) / package_qty


def product_cost(lines, extra_cost=0):
    """Custo de uma porcao. lines = [(quantidade, tamanho da embalagem, preco da embalagem)].

    None quando o prato ainda nao tem ficha (nem insumo, nem outro custo): custo desconhecido nao e zero.
    """
    lines = list(lines)
    extra = Decimal(extra_cost or 0)
    if not lines and extra == 0:
        return None
    total = sum((line_cost(q, pq, pp) for q, pq, pp in lines), Decimal('0')) + extra
    return money(total)


def cmv_percent(cost, price):
    """Custo / preco, em %, com 1 casa. None se nao ha custo ou o prato nao tem preco."""
    if cost is None:
        return None
    price = Decimal(price or 0)
    if price <= 0:
        return None
    return (Decimal(cost) * 100 / price).quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)


def status(cost, price, target):
    """'sem_custo', 'sem_preco', 'ok' (na meta), 'atencao' (ate 10 pontos acima) ou 'alto'."""
    if cost is None:
        return 'sem_custo'
    if Decimal(price or 0) <= 0:
        return 'sem_preco'
    cmv = cmv_percent(cost, price)
    target = Decimal(target)
    if cmv <= target:
        return 'ok'
    if cmv <= target + WARN_BAND:
        return 'atencao'
    return 'alto'


def suggested_price(cost, target):
    """Menor preco que deixa o prato dentro da meta (custo / meta), arredondado para cima no centavo."""
    if cost is None or Decimal(cost) <= 0:
        return None
    return (Decimal(cost) * 100 / Decimal(target)).quantize(CENT, rounding=ROUND_CEILING)


def margin(cost, price):
    if cost is None:
        return None
    return money(Decimal(price or 0) - Decimal(cost))


def normalize_target(value):
    number = parse_number(value, 'Meta de CMV', allow_zero=False)
    if number != number.to_integral_value():
        raise CostError("Meta de CMV: use um numero inteiro, por exemplo 35.")
    number = int(number)
    if not MIN_TARGET <= number <= MAX_TARGET:
        raise CostError(f"Meta de CMV: escolha entre {MIN_TARGET}% e {MAX_TARGET}%.")
    return number


def period_summary(items):
    """CMV do periodo pelos pedidos. items = [(quantidade, preco unitario, custo unitario ou None)].

    So entra na conta do CMV o que tinha custo no momento do pedido. coverage diz quanto das vendas
    tinha custo: com pouca cobertura o numero ainda nao diz muito.
    """
    revenue = Decimal('0')
    covered_revenue = Decimal('0')
    covered_cost = Decimal('0')
    for quantity, unit_price, unit_cost in items:
        sale = Decimal(unit_price or 0) * int(quantity or 0)
        revenue += sale
        if unit_cost is not None:
            covered_revenue += sale
            covered_cost += Decimal(unit_cost) * int(quantity or 0)
    cmv = None
    if covered_revenue > 0:
        cmv = (covered_cost * 100 / covered_revenue).quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)
    coverage = None
    if revenue > 0:
        coverage = (covered_revenue * 100 / revenue).quantize(Decimal('1'), rounding=ROUND_HALF_UP)
    return {
        'revenue': money(revenue),
        'covered_revenue': money(covered_revenue),
        'cost': money(covered_cost),
        'cmv': cmv,
        'coverage': coverage,
    }


def recipe_lines(items, ingredients):
    """Confere a ficha que veio da tela e devolve [(ingredient_id, quantidade na unidade guardada)].

    items: [{"ingredient_id", "quantity", "unit"}]. ingredients: {id: unidade guardada} do restaurante.
    """
    if not isinstance(items, list):
        raise CostError("Ficha tecnica invalida.")
    if len(items) > MAX_RECIPE_LINES:
        raise CostError(f"Ficha tecnica: no maximo {MAX_RECIPE_LINES} insumos por prato.")
    seen = set()
    lines = []
    for item in items:
        if not isinstance(item, dict):
            raise CostError("Ficha tecnica invalida.")
        ingredient_id = str(item.get('ingredient_id') or '')
        if ingredient_id not in ingredients:
            raise CostError("Um dos insumos nao existe mais. Atualize a tela.")
        if ingredient_id in seen:
            raise CostError("O mesmo insumo aparece duas vezes. Junte numa linha so.")
        seen.add(ingredient_id)
        quantity, base_unit = to_base(item.get('quantity'), item.get('unit'), 'Quantidade', MAX_LINE_QTY)
        if base_unit != ingredients[ingredient_id]:
            raise CostError("Unidade nao combina com o insumo: peso com peso (kg, g), liquido com liquido (L, ml).")
        lines.append((ingredient_id, quantity))
    return lines
