#!/usr/bin/env python3
"""
Vem Comer API smoke test.
Dependency: requests only.

Usage:
    python smoke_test.py https://SEU-BACKEND.example.com
"""
import sys
import time

import requests


TIMEOUT = 15


def fail(message):
    raise AssertionError(message)


def request_json(method, url, **kwargs):
    response = requests.request(method, url, timeout=TIMEOUT, **kwargs)
    try:
        body = response.json()
    except ValueError:
        body = None
    return response, body


def expect(response, expected, label):
    if response.status_code != expected:
        fail(
            f"{label}: HTTP {response.status_code}; "
            f"esperado {expected}; resposta={response.text[:500]}"
        )


def main():
    if len(sys.argv) != 2:
        print("Uso: python smoke_test.py https://SEU-BACKEND.example.com")
        return 2

    base = sys.argv[1].rstrip("/")
    stamp = str(int(time.time() * 1000))
    suffix = stamp[-10:]

    companies = [
        {
            "company_name": f"Smoke A {suffix}",
            "slug": f"smoke-a-{suffix}",
            "name": "Smoke Owner A",
            "email": f"smoke-a-{suffix}@example.invalid",
            "password": f"SmokeA-{suffix}-Test!",
        },
        {
            "company_name": f"Smoke B {suffix}",
            "slug": f"smoke-b-{suffix}",
            "name": "Smoke Owner B",
            "email": f"smoke-b-{suffix}@example.invalid",
            "password": f"SmokeB-{suffix}-Test!",
        },
    ]

    created_company_ids = []
    tokens = {}
    product_ids = {}

    try:
        # 1) Health
        response, body = request_json("GET", f"{base}/api/health")
        expect(response, 200, "health")
        if body != {"ok": True}:
            fail(f"health: resposta inesperada: {body}")

        # 2) Criar empresas A e B
        for key, company in zip(("A", "B"), companies):
            response, body = request_json(
                "POST",
                f"{base}/api/auth/register-company",
                json=company,
            )
            expect(response, 201, f"criar empresa {key}")
            company_id = body["company"]["id"]
            created_company_ids.append(company_id)

        # 3) Login A e B
        for key, company in zip(("A", "B"), companies):
            response, body = request_json(
                "POST",
                f"{base}/api/auth/login",
                json={
                    "email": company["email"],
                    "password": company["password"],
                },
            )
            expect(response, 200, f"login {key}")
            tokens[key] = body["token"]

        headers_a = {"Authorization": f"Bearer {tokens['A']}"}
        headers_b = {"Authorization": f"Bearer {tokens['B']}"}

        # 4) Criar produto A e B
        for key, company_id in zip(("A", "B"), created_company_ids):
            headers = headers_a if key == "A" else headers_b
            response, body = request_json(
                "POST",
                f"{base}/api/companies/{company_id}/admin/products",
                headers=headers,
                json={
                    "name": f"Smoke Product {key} {suffix}",
                    "description": "produto criado pelo smoke test",
                    "price": 9.90,
                },
            )
            expect(response, 201, f"criar produto {key}")
            product_ids[key] = body["product_id"]

        # 5) Criar pedido A e B
        for key, company_id in zip(("A", "B"), created_company_ids):
            response, body = request_json(
                "POST",
                f"{base}/api/companies/{company_id}/orders",
                json={
                    "customer_name": f"Smoke Customer {key}",
                    "items": [{"id": product_ids[key], "quantity": 1}],
                    "payment_method": "pix",
                },
            )
            expect(response, 201, f"criar pedido {key}")

        # 6) Provar isolamento: A não acessa usuários de B
        company_b_id = created_company_ids[1]
        response, _ = request_json(
            "GET",
            f"{base}/api/companies/{company_b_id}/users",
            headers=headers_a,
        )
        expect(response, 403, "A acessar usuários de B")

        # 7) Provar isolamento: A não pode apagar produto de B
        response, _ = request_json(
            "DELETE",
            f"{base}/api/admin/products/{product_ids['B']}",
            headers=headers_a,
        )
        expect(response, 404, "A apagar produto de B")

        print("SMOKE TEST PASSOU: health, empresas, login, produtos, pedidos e isolamento A/B.")

    finally:
        # Cleanup somente pela API. Cada empresa é removida pelo próprio OWNER.
        for key, company_id in reversed(list(zip(("A", "B"), created_company_ids))):
            token = tokens.get(key)
            if not token:
                continue
            response, _ = request_json(
                "DELETE",
                f"{base}/api/companies/{company_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
            if response.status_code not in (200, 404):
                print(
                    f"AVISO: cleanup da empresa {key} retornou "
                    f"HTTP {response.status_code}."
                )

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (AssertionError, requests.RequestException) as exc:
        print(f"SMOKE TEST FALHOU: {exc}")
        raise SystemExit(1)
