"""Conferência do inventário de dados pessoais (LGPD art. 37) contra o banco de verdade.

A parte do arquivo roda sempre. A parte do banco roda quando VEM_TEST_DATABASE_URL aponta para um PostgreSQL com
o esquema e as migrações aplicados (fluxo .github/workflows/compliance.yml): toda tabela nova precisa ser
classificada, todo campo com cara de dado de pessoa precisa estar no inventário, e o inventário não pode citar
campo que não existe mais.
"""

import os
import unittest

import inventario

URL = os.getenv("VEM_TEST_DATABASE_URL")

try:
    import psycopg2
except ImportError:  # pragma: no cover
    psycopg2 = None


class FormaDoInventarioTests(unittest.TestCase):
    def test_the_file_is_well_formed(self):
        self.assertEqual(inventario.problemas_de_forma(), [])

    def test_every_category_says_why_how_long_and_who_decides(self):
        for categoria in inventario.carregar()["categorias"]:
            for chave in ("finalidade", "guarda", "base_legal", "compartilha_com", "papel_da_plataforma"):
                self.assertTrue(categoria[chave], f"{categoria['id']}: falta {chave}")

    def test_in_the_customer_order_the_restaurant_decides_and_we_only_operate(self):
        pedido = next(c for c in inventario.carregar()["categorias"] if c["id"] == "pedido-do-cliente")
        self.assertEqual(pedido["papel_da_plataforma"], "operador")

    def test_a_bad_file_is_caught(self):
        ruim = {
            "bases_legais": {"contrato": "x"},
            "categorias": [
                {"id": "a", "titular": "t", "papel_da_plataforma": "dono", "dados": "d", "campos": ["x"],
                 "finalidade": "f", "base_legal": "inventada", "compartilha_com": "c", "guarda": "g",
                 "eliminacao": "e", "revisao_juridica": "revisado"},
                {"id": "a", "titular": "t", "papel_da_plataforma": "operador", "dados": "d", "campos": [],
                 "finalidade": "f", "base_legal": "contrato", "compartilha_com": "c", "guarda": "g",
                 "eliminacao": "e", "revisao_juridica": "revisado"},
            ],
        }
        texto = " | ".join(inventario.problemas_de_forma(ruim))
        for pedaco in ("papel_da_plataforma deve ser", "base_legal desconhecida", "fora do formato", "id repetido", "precisa dizer 'onde'"):
            self.assertIn(pedaco, texto)

    def test_which_column_names_look_personal(self):
        for coluna in ("email", "owner_phone", "customer_name", "ip_hash", "contact", "delivery_address", "p256dh"):
            self.assertTrue(inventario.parece_pessoal(coluna), coluna)
        for coluna in ("id", "price", "created_at", "status", "quantity", "company_id"):
            self.assertFalse(inventario.parece_pessoal(coluna), coluna)


@unittest.skipUnless(URL and psycopg2, "defina VEM_TEST_DATABASE_URL para rodar a conferência no banco")
class InventarioContraOBancoTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        conn = psycopg2.connect(URL)
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT table_name, column_name FROM information_schema.columns "
                    "WHERE table_schema = 'public' ORDER BY table_name, ordinal_position"
                )
                cls.colunas = [f"{tabela}.{coluna}" for tabela, coluna in cur.fetchall()]
        finally:
            conn.close()
        cls.tabelas = {c.split(".")[0] for c in cls.colunas}
        cls.inv = inventario.carregar()

    def test_every_table_is_classified(self):
        sem_classe = sorted(self.tabelas - inventario.tabelas_conhecidas(self.inv))
        self.assertEqual(
            sem_classe, [],
            "Tabela nova sem classificar em backend/inventario_dados.json (tem dado de pessoa? "
            "entre em 'categorias'; não tem? entre em 'tabelas_sem_dado_pessoal'): " + ", ".join(sem_classe),
        )

    def test_every_personal_looking_column_is_in_the_inventory(self):
        sem_dado = set(self.inv["tabelas_sem_dado_pessoal"])
        inventariados = inventario.campos_inventariados(self.inv)
        excecoes = set(self.inv["colunas_excecoes"])
        faltando = [
            c for c in self.colunas
            if c.split(".")[0] not in sem_dado
            and inventario.parece_pessoal(c.split(".")[1])
            and c not in inventariados
            and c not in excecoes
        ]
        self.assertEqual(
            faltando, [],
            "Campo com cara de dado de pessoa sem registro em backend/inventario_dados.json "
            "(entre em uma categoria, ou em 'colunas_excecoes' com o motivo): " + ", ".join(faltando),
        )

    def test_the_inventory_does_not_name_columns_that_no_longer_exist(self):
        existentes = set(self.colunas)
        antigos = sorted(inventario.campos_inventariados(self.inv) - existentes)
        self.assertEqual(antigos, [], "Campo no inventário que não existe no banco: " + ", ".join(antigos))

    def test_the_exceptions_exist_and_say_why(self):
        existentes = set(self.colunas)
        for coluna, motivo in self.inv["colunas_excecoes"].items():
            self.assertIn(coluna, existentes, coluna)
            self.assertTrue(motivo.strip(), coluna)


if __name__ == "__main__":
    unittest.main()
