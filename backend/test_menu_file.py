import io
import os
import unittest
import zipfile
from xml.sax.saxutils import escape

os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")

import menu_file  # noqa: E402


def csv_bytes(text, encoding="utf-8"):
    return text.encode(encoding)


def make_xlsx(rows, shared=True, sheet_names=("Cardapio",), extra_files=None, first_sheet_file="sheet1.xml"):
    """Planilha .xlsx mínima, montada à mão (sem biblioteca), como o Excel a guarda."""
    strings = []

    def column_letter(index):
        letters = ""
        index += 1
        while index:
            index, rest = divmod(index - 1, 26)
            letters = chr(65 + rest) + letters
        return letters

    sheet_rows = []
    for row_number, row in enumerate(rows, start=1):
        cells = []
        for column, value in enumerate(row):
            if value is None or value == "":
                continue
            reference = f"{column_letter(column)}{row_number}"
            if isinstance(value, (int, float)):
                cells.append(f'<c r="{reference}"><v>{value}</v></c>')
            elif shared:
                strings.append(value)
                cells.append(f'<c r="{reference}" t="s"><v>{len(strings) - 1}</v></c>')
            else:
                cells.append(f'<c r="{reference}" t="inlineStr"><is><t>{escape(value)}</t></is></c>')
        sheet_rows.append(f'<row r="{row_number}">{"".join(cells)}</row>')

    sheet_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f'<sheetData>{"".join(sheet_rows)}</sheetData></worksheet>'
    )
    sheets = "".join(
        f'<sheet name="{name}" sheetId="{i}" r:id="rId{i}"/>' for i, name in enumerate(sheet_names, start=1)
    )
    workbook = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f"<sheets>{sheets}</sheets></workbook>"
    )
    rels = "".join(
        f'<Relationship Id="rId{i}" Type="x" Target="worksheets/{first_sheet_file if i == 1 else f"sheet{i}.xml"}"/>'
        for i, _ in enumerate(sheet_names, start=1)
    )
    relationships = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        f'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">{rels}</Relationships>'
    )
    shared_xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        + "".join(f"<si><t>{escape(text)}</t></si>" for text in strings)
        + "</sst>"
    )
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", "<Types/>")
        archive.writestr("xl/workbook.xml", workbook)
        archive.writestr("xl/_rels/workbook.xml.rels", relationships)
        if shared:
            archive.writestr("xl/sharedStrings.xml", shared_xml)
        archive.writestr(f"xl/worksheets/{first_sheet_file}", sheet_xml)
        for name, content in (extra_files or {}).items():
            archive.writestr(name, content)
    return buffer.getvalue()


def flat(result):
    """{"Lanches": [("X-Burguer", "18.50")]}, para comparar sem barulho."""
    return {category["name"]: [(item["name"], item["price"]) for item in category["items"]] for category in result["categories"]}


class DetectKindTests(unittest.TestCase):
    def test_reconhece_os_formatos(self):
        self.assertEqual(menu_file.detect_kind(b"%PDF-1.7\n..."), "pdf")
        self.assertEqual(menu_file.detect_kind(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1rest"), "xls")
        self.assertEqual(menu_file.detect_kind(b"\x89PNG\r\n\x1a\nrest"), "image")
        self.assertEqual(menu_file.detect_kind(b"\xff\xd8\xff\xe0rest"), "image")
        self.assertEqual(menu_file.detect_kind(make_xlsx([["a"]])), "xlsx")
        self.assertEqual(menu_file.detect_kind(b"Prato;Preco\nX;1,00\n"), "csv")

    def test_zip_que_nao_e_planilha(self):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("word/document.xml", "<w/>")
        self.assertEqual(menu_file.detect_kind(buffer.getvalue()), "docx")
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("coisa.txt", "x")
        self.assertEqual(menu_file.detect_kind(buffer.getvalue()), "zip")
        self.assertEqual(menu_file.detect_kind(b"PK\x03\x04quebrado"), "zip")


class CsvTests(unittest.TestCase):
    def test_ponto_e_virgula_com_titulos_e_preco_brasileiro(self):
        data = csv_bytes("Categoria;Prato;Preço\nLanches;X-Burguer;18,50\nLanches;X-Salada;20,00\nBebidas;Coca-Cola;6\n")
        result = menu_file.read_menu_sheet(data)
        self.assertTrue(result["readable"])
        self.assertEqual(
            flat(result),
            {"Lanches": [("X-Burguer", "18.50"), ("X-Salada", "20.00")], "Bebidas": [("Coca-Cola", "6.00")]},
        )
        self.assertIn("títulos", result["notes"])

    def test_virgula_com_aspas_e_nome_com_virgula(self):
        data = csv_bytes('Produto,Valor\n"Pizza, calabresa",39.90\n"Suco ""natural""",8.5\n')
        result = menu_file.read_menu_sheet(data)
        self.assertEqual(flat(result), {"Cardápio": [("Pizza, calabresa", "39.90"), ('Suco "natural"', "8.50")]})

    def test_tab_e_bom_e_acentos_do_excel_antigo(self):
        data = "﻿Item\tPreço\nAçaí 500 ml\t18,00\n".encode("utf-8")
        self.assertEqual(flat(menu_file.read_menu_sheet(data)), {"Cardápio": [("Açaí 500 ml", "18.00")]})
        data = "Item;Preço\nAçaí 300 ml;12,00\n".encode("cp1252")
        self.assertEqual(flat(menu_file.read_menu_sheet(data)), {"Cardápio": [("Açaí 300 ml", "12.00")]})

    def test_simbolo_de_real_e_milhar(self):
        data = csv_bytes("Prato;Preço\nPicanha na chapa;R$ 1.234,50\nPorção;R$ 32,00\n")
        self.assertEqual(
            flat(menu_file.read_menu_sheet(data)),
            {"Cardápio": [("Picanha na chapa", "1234.50"), ("Porção", "32.00")]},
        )

    def test_coluna_de_custo_nao_e_confundida_com_preco(self):
        data = csv_bytes("Prato;Custo;Preço de venda;Estoque\nX-Burguer;9,00;18,50;30\nX-Bacon;11,00;22,00;12\n")
        self.assertEqual(flat(menu_file.read_menu_sheet(data)), {"Cardápio": [("X-Burguer", "18.50"), ("X-Bacon", "22.00")]})

    def test_prato_sem_preco_entra_com_preco_vazio(self):
        data = csv_bytes("Prato;Preço\nX-Burguer;18,50\nPrato do dia;\nSob consulta;a combinar\n")
        result = menu_file.read_menu_sheet(data)
        self.assertEqual(
            flat(result), {"Cardápio": [("X-Burguer", "18.50"), ("Prato do dia", ""), ("Sob consulta", "")]}
        )

    def test_titulo_de_grupo_numa_linha_so(self):
        data = csv_bytes("Prato;Preço\nLANCHES;\nX-Burguer;18,50\nX-Salada;20,00\nBEBIDAS;\nCoca-Cola;6,00\n")
        self.assertEqual(
            flat(menu_file.read_menu_sheet(data)),
            {"LANCHES": [("X-Burguer", "18.50"), ("X-Salada", "20.00")], "BEBIDAS": [("Coca-Cola", "6.00")]},
        )

    def test_titulos_depois_de_linhas_de_enfeite(self):
        data = csv_bytes("Restaurante do Zé;;\nCardápio 2026;;\n;;\nCategoria;Produto;Preço\nPastel;Pastel de carne;8,00\n")
        self.assertEqual(flat(menu_file.read_menu_sheet(data)), {"Pastel": [("Pastel de carne", "8.00")]})

    def test_sem_titulos_descobre_as_colunas_pelo_conteudo(self):
        data = csv_bytes(
            "Lanches;X-Burguer;18,50\nLanches;X-Salada;20,00\nLanches;X-Bacon;22,00\nBebidas;Coca-Cola;6,00\nBebidas;Suco;8,00\n"
        )
        result = menu_file.read_menu_sheet(data)
        self.assertEqual(
            flat(result),
            {
                "Lanches": [("X-Burguer", "18.50"), ("X-Salada", "20.00"), ("X-Bacon", "22.00")],
                "Bebidas": [("Coca-Cola", "6.00"), ("Suco", "8.00")],
            },
        )
        self.assertIn("conteúdo", result["notes"])

    def test_sem_titulos_duas_colunas_nome_e_preco(self):
        data = csv_bytes("X-Burguer;18,50\nX-Salada;20,00\nCoca-Cola;6,00\n")
        self.assertEqual(
            flat(menu_file.read_menu_sheet(data)),
            {"Cardápio": [("X-Burguer", "18.50"), ("X-Salada", "20.00"), ("Coca-Cola", "6.00")]},
        )

    def test_uma_coluna_so_com_o_preco_no_fim_do_texto(self):
        data = csv_bytes("LANCHES\nX-Burguer ........ R$ 18,50\nX-Salada - 20,00\nBEBIDAS\nCoca-Cola R$ 6\nCombo 2\n")
        result = menu_file.read_menu_sheet(data)
        # "Combo 2" não tem R$ nem centavos: não é preço, vira categoria (o dono vê e corrige na conferência)
        got = flat(result)
        self.assertEqual(got["LANCHES"], [("X-Burguer", "18.50"), ("X-Salada", "20.00")])
        self.assertEqual(got["BEBIDAS"], [("Coca-Cola", "6.00")])
        self.assertNotIn("Combo", " ".join(name for items in got.values() for name, _ in items))

    def test_repetidos_e_lixo_sao_limpos_como_na_foto(self):
        data = csv_bytes("Prato;Preço\nX-Burguer;18,50\nx-burguer;18,50\n;5,00\n  ;  \nX-Salada;0\n")
        result = menu_file.read_menu_sheet(data)
        self.assertEqual(flat(result), {"Cardápio": [("X-Burguer", "18.50"), ("X-Salada", "")]})

    def test_pizzaria_com_uma_coluna_de_preco_por_tamanho(self):
        data = csv_bytes(
            "Categoria;Sabor;Broto;Grande\n"
            "Pizzas;Calabresa;25,00;45,00\n"
            "Pizzas;Mussarela;22,00;40,00\n"
            "Pizzas;Portuguesa;;48,00\n"
        )
        result = menu_file.read_menu_sheet(data)
        self.assertEqual(
            flat(result),
            {
                "Pizzas": [
                    ("Calabresa (Broto)", "25.00"),
                    ("Calabresa (Grande)", "45.00"),
                    ("Mussarela (Broto)", "22.00"),
                    ("Mussarela (Grande)", "40.00"),
                    ("Portuguesa (Grande)", "48.00"),
                ]
            },
        )
        self.assertIn("tamanho", result["notes"])

    def test_codigo_descricao_preco_do_sistema_de_gestao(self):
        data = csv_bytes("Código;Descrição;Preço Venda;Estoque\n001;Pastel de carne;8,00;50\n002;Caldo de cana;7,50;20\n")
        self.assertEqual(
            flat(menu_file.read_menu_sheet(data)),
            {"Cardápio": [("Pastel de carne", "8.00"), ("Caldo de cana", "7.50")]},
        )

    def test_categoria_com_nome_de_lanche_nao_vira_titulo_de_coluna(self):
        data = csv_bytes("Lanches;X-Burguer;18,50\nLanches;X-Salada;20,00\n")
        self.assertEqual(flat(menu_file.read_menu_sheet(data)), {"Lanches": [("X-Burguer", "18.50"), ("X-Salada", "20.00")]})

    def test_descricao_e_subcategoria_viram_campos_do_produto(self):
        data = csv_bytes(
            "Categoria;Subcategoria;Produto;Descrição;Preço\n"
            "Pizzas;Tradicionais;Calabresa;Molho, calabresa e cebola;42,00\n"
            "Pizzas;Doces;Chocolate;Chocolate ao leite e morango;48,00\n"
            "Bebidas;Refrigerantes;Guaraná 2 L;;12,00\n"
        )
        result = menu_file.read_menu_sheet(data)
        pizzas, bebidas = result["categories"]
        self.assertEqual(
            pizzas["items"][0],
            {"name": "Calabresa", "price": "42.00", "description": "Molho, calabresa e cebola", "subcategory": "Tradicionais"},
        )
        self.assertEqual(pizzas["items"][1]["subcategory"], "Doces")
        self.assertEqual(bebidas["items"][0], {"name": "Guaraná 2 L", "price": "12.00", "description": "", "subcategory": "Refrigerantes"})

    def test_subsecao_igual_a_categoria_e_descartada(self):
        data = csv_bytes("Categoria;Subseção;Prato;Preço\nPizzas;Pizzas;Calabresa;42,00\n")
        item = menu_file.read_menu_sheet(data)["categories"][0]["items"][0]
        self.assertEqual(item["subcategory"], "")

    def test_descricao_repete_em_cada_tamanho(self):
        data = csv_bytes("Sabor;Descrição;Broto;Grande\nCalabresa;Com cebola;25,00;45,00\nMussarela;Com orégano;22,00;40,00\n")
        items = menu_file.read_menu_sheet(data)["categories"][0]["items"]
        self.assertEqual([i["name"] for i in items][:2], ["Calabresa (Broto)", "Calabresa (Grande)"])
        self.assertEqual({i["description"] for i in items[:2]}, {"Com cebola"})

    def test_prato_com_descricao_e_sem_preco_nao_vira_titulo_de_grupo(self):
        data = csv_bytes("Prato;Descrição;Preço\nFeijoada;Aos sábados;\nPastel;;8,00\n")
        items = menu_file.read_menu_sheet(data)["categories"][0]["items"]
        self.assertEqual([i["name"] for i in items], ["Feijoada", "Pastel"])
        self.assertEqual(items[0]["price"], "")
        self.assertEqual(items[0]["description"], "Aos sábados")

    def test_codigo_descricao_preco_nao_duplica_a_descricao(self):
        data = csv_bytes("Código;Descrição;Preço Venda\n001;Pastel de carne;8,00\n")
        item = menu_file.read_menu_sheet(data)["categories"][0]["items"][0]
        self.assertEqual(item["name"], "Pastel de carne")
        self.assertEqual(item["description"], "")

    def test_arquivo_sem_pratos(self):
        result = menu_file.read_menu_sheet(csv_bytes("Prato;Preço\n"))
        self.assertFalse(result["readable"])
        self.assertEqual(result["categories"], [])
        self.assertTrue(result["notes"])
        result = menu_file.read_menu_sheet(csv_bytes("só um texto qualquer\n"))
        self.assertFalse(result["readable"])

    def test_vazio_grande_e_binario(self):
        with self.assertRaises(menu_file.MenuFileError) as vazio:
            menu_file.read_menu_sheet(b"")
        self.assertEqual(vazio.exception.status, 400)
        with self.assertRaises(menu_file.MenuFileError) as grande:
            menu_file.read_menu_sheet(b"a;b\n" * (menu_file.MAX_FILE_BYTES // 3))
        self.assertEqual(grande.exception.status, 413)
        with self.assertRaises(menu_file.MenuFileError):
            menu_file.read_menu_sheet(b"abc\x00\x01\x02def;ghi\n")

    def test_limites_de_linhas_e_colunas(self):
        linhas = "Prato;Preço\n" + "".join(f"Prato {i};{i + 1},00\n" for i in range(5000))
        result = menu_file.read_menu_sheet(csv_bytes(linhas))
        total = sum(len(category["items"]) for category in result["categories"])
        self.assertLessEqual(total, 300)  # o mesmo teto do cadastro
        largas = ";".join(["x"] * 200)
        menu_file.read_menu_sheet(csv_bytes(largas + "\n" + largas + "\n"))  # não pode quebrar


class XlsxTests(unittest.TestCase):
    def test_planilha_com_textos_compartilhados_e_precos_numericos(self):
        data = make_xlsx(
            [
                ["Categoria", "Prato", "Preço"],
                ["Lanches", "X-Burguer", 18.5],
                ["Lanches", "X-Salada", 20],
                ["Bebidas", "Coca-Cola", 6],
            ]
        )
        result = menu_file.read_menu_sheet(data)
        self.assertEqual(
            flat(result),
            {"Lanches": [("X-Burguer", "18.50"), ("X-Salada", "20.00")], "Bebidas": [("Coca-Cola", "6.00")]},
        )

    def test_textos_diretos_na_celula(self):
        data = make_xlsx([["Prato", "Preço"], ["Pastel", 8], ["Caldo de cana", "7,50"]], shared=False)
        self.assertEqual(flat(menu_file.read_menu_sheet(data)), {"Cardápio": [("Pastel", "8.00"), ("Caldo de cana", "7.50")]})

    def test_celulas_vazias_no_meio_mantem_as_colunas(self):
        data = make_xlsx([["Categoria", "Prato", "Preço"], ["", "Pastel", 8], ["Doces", "Brigadeiro", 3.5]])
        got = flat(menu_file.read_menu_sheet(data))
        self.assertEqual(got["Doces"], [("Brigadeiro", "3.50")])
        self.assertEqual(got["Cardápio"], [("Pastel", "8.00")])

    def test_usa_a_primeira_aba_na_ordem_do_arquivo(self):
        data = make_xlsx(
            [["Prato", "Preço"], ["Pastel", 8]],
            sheet_names=("Cardapio", "Rascunho"),
            extra_files={"xl/worksheets/sheet2.xml": "<worksheet xmlns='http://schemas.openxmlformats.org/spreadsheetml/2006/main'><sheetData/></worksheet>"},
        )
        self.assertEqual(flat(menu_file.read_menu_sheet(data)), {"Cardápio": [("Pastel", "8.00")]})

    def test_formula_nao_e_executada_so_o_valor_guardado_e_lido(self):
        sheet = (
            '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
            '<row r="1"><c r="A1" t="inlineStr"><is><t>Prato</t></is></c><c r="B1" t="inlineStr"><is><t>Preço</t></is></c></row>'
            '<row r="2"><c r="A2" t="inlineStr"><is><t>Pastel</t></is></c><c r="B2"><f>HYPERLINK("http://x","y")+1</f><v>9</v></c></row>'
            "</sheetData></worksheet>"
        )
        data = make_xlsx([["x"]], extra_files={})
        buffer = io.BytesIO()
        with zipfile.ZipFile(io.BytesIO(data)) as source, zipfile.ZipFile(buffer, "w") as target:
            for item in source.namelist():
                target.writestr(item, sheet if item == "xl/worksheets/sheet1.xml" else source.read(item))
        self.assertEqual(flat(menu_file.read_menu_sheet(buffer.getvalue())), {"Cardápio": [("Pastel", "9.00")]})

    def test_recusa_declaracao_de_entidade(self):
        evil = (
            '<?xml version="1.0"?><!DOCTYPE lol [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;">]>'
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>&b;</t></is></c></row></sheetData></worksheet>'
        )
        data = make_xlsx([["x"]])
        buffer = io.BytesIO()
        with zipfile.ZipFile(io.BytesIO(data)) as source, zipfile.ZipFile(buffer, "w") as target:
            for item in source.namelist():
                target.writestr(item, evil if item == "xl/worksheets/sheet1.xml" else source.read(item))
        with self.assertRaises(menu_file.MenuFileError) as raised:
            menu_file.read_menu_sheet(buffer.getvalue())
        self.assertIn("segurança", raised.exception.message)

    def test_recusa_parte_descompactada_enorme(self):
        data = make_xlsx([["Prato", "Preço"], ["Pastel", 8]])
        original = menu_file.MAX_XML_BYTES
        menu_file.MAX_XML_BYTES = 200  # simula uma "bomba": a parte descompactada passa do limite
        try:
            with self.assertRaises(menu_file.MenuFileError) as raised:
                menu_file.read_menu_sheet(data)
            self.assertIn("grande demais", raised.exception.message)
        finally:
            menu_file.MAX_XML_BYTES = original

    def test_recusa_arquivos_demais_por_dentro(self):
        data = make_xlsx([["Prato", "Preço"], ["Pastel", 8]], extra_files={f"lixo/{i}.txt": "x" for i in range(400)})
        with self.assertRaises(menu_file.MenuFileError):
            menu_file.read_menu_sheet(data)

    def test_xml_quebrado(self):
        data = make_xlsx([["x"]])
        buffer = io.BytesIO()
        with zipfile.ZipFile(io.BytesIO(data)) as source, zipfile.ZipFile(buffer, "w") as target:
            for item in source.namelist():
                target.writestr(item, "<worksheet><sheetData><row>" if item == "xl/worksheets/sheet1.xml" else source.read(item))
        with self.assertRaises(menu_file.MenuFileError):
            menu_file.read_menu_sheet(buffer.getvalue())


class UnsupportedTests(unittest.TestCase):
    def test_formatos_que_nao_lemos_dizem_o_que_fazer(self):
        for blob, palavra in (
            (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"0" * 50, ".xlsx"),
            (b"\x89PNG\r\n\x1a\n" + b"0" * 50, "foto"),
        ):
            with self.assertRaises(menu_file.MenuFileError) as raised:
                menu_file.read_menu_sheet(blob)
            self.assertIn(palavra, raised.exception.message)


if __name__ == "__main__":
    unittest.main()
