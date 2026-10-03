#!/usr/bin/env python3
"""
Smoke test do Vem Comer usando somente requests.

Uso:
    python smoke_test.py https://SEU-BACKEND.up.railway.app

O teste cria duas empresas, faz login, cria produtos/pedido e verifica
isolamento entre A e B.

Limitação conhecida da API:
- não existe endpoint para apagar empresa;
- não existe endpoint para apagar pedido.
Portanto, o script apaga os produtos criados, mas não pode apagar
empresas/pedido sem acesso direto ao banco. Ele informa isso no final.
"""

import sys
import uuid
import requests


TIMEOUT = 20


def fail(message):
    raise RuntimeError(message)


def check(response, expected, label):
    if response.status_code != expected:
        try:
            body = response.json()
        except ValueError:
            body = response.text[:500]
        fail(f"{label}: HTTP {response.status_code}, esperado {expected}: {body}")
    return response


def post_json(session, url, payload, label, expected=201):
    return check(session.post(url, json=payload, timeout=TIMEOUT), expected, label).json()


def main():
    if len(sys.argv) != 2:
        print("Uso: python smoke_test.py https://seu-backend")
        return 2

    base = sys.argv[1].rstrip("/")
    session = requests.Session()
    suffix = uuid.uuid4().hex[:10]

    a = {
        "company_name": f"Smoke A {suffix}",
        "slug": f"smoke-a-{suffix}",
        "name": "Smoke Owner A",
        "email": f"smoke-a-{suffix}@example.invalid",
        "password": "SmokeTest-A-2026!"
    }
    b = {
        "company_name": f"Smoke B {suffix}",
        "slug": f"smoke-b-{suffix}",
        "name": "Smoke Owner B",
        "email": f"smoke-b-{suffix}@example.invalid",
        "password": "SmokeTest-B-2026!"
    }

    created_product_ids = []
    cleanup_notes = []

    try:
        health = check(
            session.get(f"{base}/api/health", timeout=TIMEOUT),
            200,
            "health"
        ).json()
        if health.get("status") != "ok":
            fail(f"health retornou {health}")
        print("PASS health")

        company_a = post_json(
            session, f"{base}/api/auth/register-company", a,
            "criar empresa A"
        )
        company_b = post_json(
            session, f"{base}/api/auth/register-company", b,
            "criar empresa B"
        )

        company_a_id = str(company_a["company"]["id"])
        company_b_id = str(company_b["company"]["id"])
        print("PASS criar empresa A/B")

        login_a = check(
            session.post(
                f"{base}/api/auth/login",
                json={"email": a["email"], "password": a["password"]},
                timeout=TIMEOUT
            ),
            200,
            "login A"
        ).json()

        login_b = check(
            session.post(
                f"{base}/api/auth/login",
                json={"email": b["email"], "password": b["password"]},
                timeout=TIMEOUT
            ),
            200,
            "login B"
        ).json()

        token_a = login_a["token"]
        token_b = login_b["token"]
        print("PASS login A/B")

        product_a = check(
            session.post(
                f"{base}/api/companies/{company_a_id}/admin/products",
                headers={"Authorization": f"Bearer {token_a}"},
                json={
                    "name": f"Smoke Product A {suffix}",
                    "description": "smoke test",
                    "price": 10.00
                },
                timeout=TIMEOUT
            ),
            201,
            "criar produto A"
        ).json()
        product_a_id = str(product_a["product_id"])
        created_product_ids.append((product_a_id, token_a))

        product_b = check(
            session.post(
                f"{base}/api/companies/{company_b_id}/admin/products",
                headers={"Authorization": f"Bearer {token_b}"},
                json={
                    "name": f"Smoke Product B {suffix}",
                    "description": "smoke test",
                    "price": 12.00
                },
                timeout=TIMEOUT
            ),
            201,
            "criar produto B"
        ).json()
        product_b_id = str(product_b["product_id"])
        created_product_ids.append((product_b_id, token_b))
        print("PASS criar produto A/B")

        order = check(
            session.post(
                f"{base}/api/companies/{company_a_id}/orders",
                json={
                    "customer_name": "Smoke Customer",
                    "items": [{"id": product_a_id, "quantity": 1}],
                    "payment_method": "pix",
                    "payment_change": 0
                },
                timeout=TIMEOUT
            ),
            201,
            "criar pedido A"
        ).json()
        print(f"PASS criar pedido A: {order['order_id']}")

        users_a_as_a = check(
            session.get(
                f"{base}/api/companies/{company_a_id}/users",
                headers={"Authorization": f"Bearer {token_a}"},
                timeout=TIMEOUT
            ),
            200,
            "A acessar A"
        ).json()
        if not users_a_as_a:
            fail("A não encontrou o próprio usuário")
        print("PASS A acessa seus próprios dados")

        denied = session.get(
            f"{base}/api/companies/{company_b_id}/users",
            headers={"Authorization": f"Bearer {token_a}"},
            timeout=TIMEOUT
        )
        if denied.status_code != 403:
            fail(
                f"isolamento A->B falhou: HTTP {denied.status_code}; "
                f"esperado 403"
            )
        print("PASS A não acessa dados de B")

        denied_delete = session.delete(
            f"{base}/api/admin/products/{product_b_id}",
            headers={"Authorization": f"Bearer {token_a}"},
            timeout=TIMEOUT
        )
        if denied_delete.status_code != 404:
            fail(
                f"isolamento de produto A->B falhou: "
                f"HTTP {denied_delete.status_code}; esperado 404"
            )
        print("PASS A não pode apagar produto de B")

    finally:
        for product_id, owner_token in created_product_ids:
            try:
                response = session.delete(
                    f"{base}/api/admin/products/{product_id}",
                    headers={"Authorization": f"Bearer {owner_token}"},
                    timeout=TIMEOUT
                )
                if response.status_code == 200:
                    print(f"CLEAN produto {product_id}: apagado")
                else:
                    cleanup_notes.append(
                        f"produto {product_id}: HTTP {response.status_code}"
                    )
            except requests.RequestException as exc:
                cleanup_notes.append(f"produto {product_id}: {exc}")

        cleanup_notes.append(
            "empresas e pedido não foram apagados: a API atual não "
            "possui endpoints de exclusão para esses recursos."
        )

    print("SMOKE TEST: PASS")
    print("LIMPEZA:", " | ".join(cleanup_notes))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (requests.RequestException, RuntimeError) as exc:
        print(f"SMOKE TEST: FAIL - {exc}")
        raise SystemExit(1)
