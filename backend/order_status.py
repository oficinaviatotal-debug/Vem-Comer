"""Andamento do pedido: as palavras que o servidor aceita e o que cada tipo de pedido pode ter.

Mesa, balcão e retirada seguem como sempre: aguardando -> em preparo -> concluído.
Entrega ganha dois passos no meio: em preparo -> PRONTO (esperando o entregador) -> SAIU PARA ENTREGA -> concluído.

Tudo que o servidor soma depois (estoque, custo, relatórios) usa SOLD_STATUSES: um pedido que já foi aceito conta
como vendido em qualquer um destes estados. Se um estado novo nascer e não entrar aqui, a venda some do custo e do
estoque sem aviso; por isso há um teste que confere que app.py usa esta lista.
"""

from __future__ import annotations

PENDING = "PENDING_PAYMENT"
PREPARING = "em preparo"
READY = "pronto"
OUT_FOR_DELIVERY = "saiu para entrega"
DONE = "concluido"

ALLOWED = (PENDING, PREPARING, READY, OUT_FOR_DELIVERY, DONE)

# Estados que só existem para pedido de entrega.
DELIVERY_ONLY = (READY, OUT_FOR_DELIVERY)

# Pedido aceito pela cozinha em diante: conta como vendido (estoque, custo, relatórios).
SOLD_STATUSES = (PREPARING, READY, OUT_FOR_DELIVERY, DONE)
SOLD_STATUSES_SQL = ", ".join(f"'{status}'" for status in SOLD_STATUSES)

NOT_A_DELIVERY = "Esse andamento só existe para pedidos de entrega."


def problem_for(order_type: str | None, status: str) -> str | None:
    """A frase em português se o estado não serve para este tipo de pedido; None se está tudo certo."""
    if status in DELIVERY_ONLY and order_type != "entrega":
        return NOT_A_DELIVERY
    return None


def event_type(status: str) -> str:
    """O nome do registro em order_events (coluna de até 50 letras): 'saiu para entrega' -> STATUS_SAIU_PARA_ENTREGA."""
    return ("STATUS_" + status.upper().replace(" ", "_"))[:50]


# A hora em que a entrega saiu e a hora em que chegou ficam gravadas mesmo quando o restaurante muda o andamento pelo
# botao do painel (o motoqueiro ja grava as dele pela tela de entregas). So o primeiro carimbo vale: tocar de novo nao o muda.
# Texto fixo, escolhido pelo andamento (que ja foi conferido contra ALLOWED): nada vem do cliente.
STAMP_PICKED_UP = ", picked_up_at = COALESCE(picked_up_at, now())"
STAMP_DELIVERED = ", delivered_at = CASE WHEN order_type = 'entrega' THEN COALESCE(delivered_at, now()) ELSE delivered_at END"


def stamp_sql(status: str) -> str:
    """O pedaco extra do UPDATE que carimba a hora, ou "" quando o andamento nao carimba nada."""
    if status == OUT_FOR_DELIVERY:
        return STAMP_PICKED_UP
    if status == DONE:
        return STAMP_DELIVERED
    return ""
