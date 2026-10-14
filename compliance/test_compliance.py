"""Testes do conferidor (check.py) e do vigia da lei (legal_watch.py). Só biblioteca padrão.

    python3 -B -m unittest discover -s compliance -p 'test_*.py'
"""

import datetime as dt
import json
import os
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import check  # noqa: E402
import legal_watch as watch  # noqa: E402

HOJE = dt.date(2026, 10, 14)


def ob(**extra):
    base = {
        "id": "X-1",
        "area": "dados-pessoais",
        "norma": "Lei X",
        "exige": "Fazer X",
        "aplica_a": ["vem_comer"],
        "controle": "Faz X",
        "status": "planejado",
        "proximo_passo": "Fazer",
        "verificado_em": "2026-10-01",
    }
    base.update(extra)
    return base


def fonte(**extra):
    base = {"id": "f1", "nome": "Fonte", "url": "https://exemplo.gov.br", "modo": "manual", "resumo_verificado": "ok"}
    base.update(extra)
    return base


def erros_de(obrigacoes, fontes=None, raiz=None):
    erros, _ = check.conferir(obrigacoes, fontes if fontes is not None else [fonte()], HOJE, raiz or check.ROOT)
    return erros


class RegistroRealTests(unittest.TestCase):
    def test_o_registro_do_repositorio_esta_em_ordem(self):
        erros, _ = check.conferir(check.carregar("obligations.json"), check.carregar("sources.json"))
        self.assertEqual(erros, [])

    def test_toda_fonte_automatica_tem_ancoras_e_endereco_oficial(self):
        for f in check.carregar("sources.json"):
            if f["modo"] == "auto":
                self.assertTrue(f["ancoras"], f["id"])
                self.assertTrue(f["url"].startswith("https://www.planalto.gov.br/"), f["id"])

    def test_nada_implementado_sem_prova_que_exista(self):
        for o in check.carregar("obligations.json"):
            if o["status"] == "implementado":
                self.assertTrue(o["evidencias"], o["id"])
                for prova in o["evidencias"]:
                    self.assertIsNone(check.prova_existe(prova), f"{o['id']}: {prova}")

    def test_cada_obrigacao_de_e_mail_passa_pelo_agente_da_lei(self):
        ids = {o["id"] for o in check.carregar("obligations.json")}
        for esperado in ("EMAIL-PROSPECCAO-EMPRESA", "EMAIL-CANDIDATO-CONFIRMACAO", "EMAIL-CAIXA-DE-ESPERA",
                         "EMAIL-LISTA-BLOQUEIO", "EMAIL-REMETENTE"):
            self.assertIn(esperado, ids)


class ConferidorTests(unittest.TestCase):
    def test_obrigacao_correta_passa(self):
        self.assertEqual(erros_de([ob()]), [])

    def test_campo_obrigatorio_faltando(self):
        item = ob()
        del item["controle"]
        self.assertTrue(any("controle" in e for e in erros_de([item])))

    def test_id_repetido(self):
        self.assertTrue(any("repetido" in e for e in erros_de([ob(), ob()])))

    def test_area_status_e_produto_desconhecidos(self):
        self.assertTrue(any("área" in e for e in erros_de([ob(area="culinaria")])))
        self.assertTrue(any("status" in e for e in erros_de([ob(status="quase")])))
        self.assertTrue(any("produto" in e for e in erros_de([ob(aplica_a=["vem_voar"])])))

    def test_implementado_exige_prova_que_existe(self):
        self.assertTrue(any("sem evidências" in e for e in erros_de([ob(status="implementado")])))
        self.assertTrue(any("não existe" in e for e in erros_de([ob(status="implementado", evidencias=["nao/existe.py"])])))

    def test_implementado_nao_pode_ter_falta(self):
        item = ob(status="implementado", evidencias=["compliance/check.py"], falta="algo")
        self.assertTrue(any("falta" in e for e in erros_de([item])))

    def test_prova_com_simbolo_falha_se_o_teste_foi_renomeado(self):
        self.assertIsNone(check.prova_existe("compliance/check.py::def prova_existe"))
        self.assertIn("não contém", check.prova_existe("compliance/check.py::NomeQueNaoExiste12345"))

    def test_parcial_precisa_de_prova_e_do_que_falta(self):
        erros = erros_de([ob(status="parcial")])
        self.assertTrue(any("sem evidências" in e for e in erros))
        self.assertTrue(any("o que falta" in e for e in erros))

    def test_cada_status_pede_o_seu_campo(self):
        self.assertTrue(any("proximo_passo" in e for e in erros_de([ob(proximo_passo="")])))
        self.assertTrue(any("pergunta" in e for e in erros_de([ob(status="depende_de_advogado")])))
        self.assertTrue(any("pergunta" in e for e in erros_de([ob(status="depende_de_contador")])))
        self.assertTrue(any("acao" in e for e in erros_de([ob(status="depende_do_dono")])))
        self.assertTrue(any("motivo" in e for e in erros_de([ob(status="nao_se_aplica")])))

    def test_fonte_citada_precisa_existir(self):
        self.assertTrue(any("sources.json" in e for e in erros_de([ob(fontes=["fantasma"])])))

    def test_data_de_verificacao(self):
        self.assertTrue(any("futuro" in e for e in erros_de([ob(verificado_em="2027-01-01")])))
        self.assertTrue(any("inválido" in e for e in erros_de([ob(verificado_em="ontem")])))
        item = ob()
        del item["verificado_em"]
        self.assertTrue(any("verificado_em" in e for e in erros_de([item])))
        item["a_verificar"] = True
        self.assertEqual(erros_de([item]), [])

    def test_obrigacao_velha_vira_aviso_nao_erro(self):
        erros, avisos = check.conferir([ob(verificado_em="2026-01-01")], [fonte()], HOJE)
        self.assertEqual(erros, [])
        self.assertTrue(any("reverificada" in a for a in avisos))

    def test_fonte_auto_precisa_de_ancoras_e_manual_de_resumo(self):
        erros = erros_de([ob()], [fonte(modo="auto")])
        self.assertTrue(any("âncoras" in e for e in erros))
        erros = erros_de([ob()], [fonte(resumo_verificado="")])
        self.assertTrue(any("resumo_verificado" in e for e in erros))
        self.assertTrue(any("modo" in e for e in erros_de([ob()], [fonte(modo="talvez")])))

    def test_fonte_aponta_para_obrigacao_que_nao_existe(self):
        self.assertTrue(any("não existe" in e for e in erros_de([ob()], [fonte(obrigacoes=["Z-9"])])))

    def test_painel_conta_por_produto_e_status(self):
        texto = check.painel([ob(), ob(id="X-2", aplica_a=["vem_trabalhar"], status="depende_do_dono", acao="a")])
        self.assertIn("vem_comer: 1 obrigações", texto)
        self.assertIn("vem_trabalhar: 1 obrigações", texto)
        self.assertIn("depende_do_dono: 1", texto)

    def test_prova_com_raiz_temporaria(self):
        with tempfile.TemporaryDirectory() as raiz:
            with open(os.path.join(raiz, "prova.py"), "w", encoding="utf-8") as arquivo:
                arquivo.write("class MeuTeste: pass\n")
            item = ob(status="implementado", evidencias=["prova.py::MeuTeste"])
            self.assertEqual(erros_de([item], raiz=raiz), [])


PAGINA = (
    "<html><head><meta charset='iso-8859-1'><title>Lei</title><style>.x{}</style></head><body>"
    "<script>var a=1;</script><p>Art. 8 Cabe ao controlador o ônus da prova de que o consentimento foi obtido.</p>"
    "<p>Art. 41 O controlador deverá indicar encarregado pelo tratamento de dados pessoais.</p>"
    + "<p>Texto de enchimento para passar do mínimo de caracteres da página. </p>" * 20
    + "</body></html>"
)
FONTE_AUTO = {
    "id": "lgpd",
    "nome": "LGPD",
    "url": "https://www.planalto.gov.br/x",
    "modo": "auto",
    "ancoras": ["Cabe ao controlador o ônus da prova", "indicar encarregado pelo tratamento"],
    "obrigacoes": ["X-1"],
}


def corpo(texto=PAGINA, charset="cp1252"):
    return texto.encode(charset), f"text/html; charset={charset}"


class TextoTests(unittest.TestCase):
    def test_le_pagina_em_cp1252_e_tira_script_e_estilo(self):
        texto = watch.texto_da_pagina(*corpo())
        self.assertIn("ônus", texto)
        self.assertNotIn("var a=1", texto)
        self.assertNotIn(".x{}", texto)

    def test_pagina_em_utf8_tambem(self):
        texto = watch.texto_da_pagina(*corpo(charset="utf-8"))
        self.assertIn("deverá indicar", texto)

    def test_normaliza_sem_acento_e_minusculo(self):
        self.assertEqual(watch.normalizar("  Ônus  da   PROVA  cinqüenta "), "onus da prova cinquenta")

    def test_ancora_e_pagina_sao_comparadas_do_mesmo_jeito(self):
        pagina = watch.normalizar(watch.texto_da_pagina(*corpo()))
        self.assertIsNotNone(watch.trecho_em_volta(pagina, watch.normalizar("Cabe ao controlador o ônus da prova")))
        self.assertIsNone(watch.trecho_em_volta(pagina, watch.normalizar("frase que não existe")))


class VigiaTests(unittest.TestCase):
    def rodar(self, estado, texto=PAGINA):
        return watch.vigiar([FONTE_AUTO, fonte()], estado, buscar=lambda url: corpo(texto), hoje=HOJE)

    def test_primeira_leitura_e_nova_e_grava_o_estado(self):
        resultados, novo = self.rodar({})
        self.assertEqual([r["situacao"] for r in resultados], ["novo"])
        self.assertIn("lgpd", novo)
        self.assertEqual(novo["lgpd"]["visto_em"], "2026-10-14")
        self.assertFalse(watch.precisa_de_atencao(resultados))

    def test_pagina_igual(self):
        _, estado = self.rodar({})
        resultados, _ = self.rodar(estado)
        self.assertEqual(resultados[0]["situacao"], "igual")

    def test_mudou_perto_da_ancora(self):
        _, estado = self.rodar({})
        texto = PAGINA.replace("foi obtido.", "foi obtido, e o prazo agora é de 30 dias.")
        resultados, _ = self.rodar(estado, texto)
        self.assertEqual(resultados[0]["situacao"], "mudou")
        self.assertTrue(watch.precisa_de_atencao(resultados))
        self.assertEqual(resultados[0]["trechos_mudados"][0]["ancora"], "Cabe ao controlador o ônus da prova")

    def test_mudou_longe_das_ancoras(self):
        _, estado = self.rodar({})
        texto = PAGINA.replace("</body>", "<p>Rodapé novo sem relação com as regras.</p></body>")
        resultados, _ = self.rodar(estado, texto)
        self.assertEqual(resultados[0]["situacao"], "mudou_fora_das_ancoras")

    def test_ancora_sumiu(self):
        _, estado = self.rodar({})
        texto = PAGINA.replace("indicar encarregado pelo tratamento", "designar responsável")
        resultados, novo = self.rodar(estado, texto)
        self.assertEqual(resultados[0]["situacao"], "ancora_perdida")
        self.assertEqual(resultados[0]["ancoras_faltando"], ["indicar encarregado pelo tratamento"])
        # o estado antigo é mantido, assim o aviso continua até alguém corrigir o registro
        self.assertEqual(novo["lgpd"]["sha256"], estado["lgpd"]["sha256"])

    def test_erro_de_rede_nao_derruba(self):
        def falha(url):
            raise OSError("sem rede")

        resultados, novo = watch.vigiar([FONTE_AUTO], {}, buscar=falha, hoje=HOJE)
        self.assertEqual(resultados[0]["situacao"], "erro")
        self.assertTrue(watch.so_erros(resultados))
        self.assertEqual(novo, {})

    def test_pagina_curta_demais_e_erro(self):
        resultados, _ = watch.vigiar([FONTE_AUTO], {}, buscar=lambda u: corpo("<p>Acesso negado</p>"), hoje=HOJE)
        self.assertEqual(resultados[0]["situacao"], "erro")

    def test_fonte_manual_nao_e_lida(self):
        resultados, _ = watch.vigiar([fonte()], {}, buscar=lambda u: self.fail("não deveria baixar"), hoje=HOJE)
        self.assertEqual(resultados, [])


class RelatorioTests(unittest.TestCase):
    def test_sem_mudanca(self):
        self.assertIn("Nenhuma mudança", watch.relatorio([{"id": "lgpd", "situacao": "igual"}], [FONTE_AUTO], [ob()], HOJE))

    def test_mudanca_lista_a_obrigacao_afetada_e_o_que_fazer(self):
        resultados = [{
            "id": "lgpd", "situacao": "mudou", "ancoras_faltando": [],
            "trechos_mudados": [{"ancora": "A", "antes": "prazo de 15 dias", "depois": "prazo de 10 dias"}],
        }]
        texto = watch.relatorio(resultados, [FONTE_AUTO], [ob()], HOJE)
        self.assertIn("14/10/2026", texto)
        self.assertIn("prazo de 10 dias", texto)
        self.assertIn("X-1 (planejado): Fazer X", texto)
        self.assertIn("O que fazer", texto)

    def test_ancora_perdida_e_erro_aparecem(self):
        texto = watch.relatorio(
            [{"id": "lgpd", "situacao": "ancora_perdida", "ancoras_faltando": ["frase sumida"], "trechos_mudados": []},
             {"id": "lgpd", "situacao": "erro", "erro": "sem rede"}],
            [FONTE_AUTO], [ob()], HOJE,
        )
        self.assertIn("frase sumida", texto)
        self.assertIn("sem rede", texto)


class IaTests(unittest.TestCase):
    def test_devolve_o_texto_da_resposta(self):
        enviados = []

        def enviar(corpo_, chave):
            enviados.append((corpo_, chave))
            return {"content": [{"type": "text", "text": "A obrigação AUMENTOU."}]}

        self.assertEqual(watch.analisar_com_ia("relatório", "chave-falsa", enviar), "A obrigação AUMENTOU.")
        self.assertEqual(enviados[0][1], "chave-falsa")
        self.assertIn("relatório", enviados[0][0]["messages"][0]["content"])

    def test_falha_da_ia_nunca_derruba(self):
        def enviar(corpo_, chave):
            raise RuntimeError("fora do ar")

        self.assertIsNone(watch.analisar_com_ia("relatório", "chave", enviar))
        self.assertIsNone(watch.analisar_com_ia("relatório", "chave", lambda c, k: {"content": []}))


class LinhaDeComandoTests(unittest.TestCase):
    def test_main_grava_relatorio_e_estado_e_devolve_codigo(self):
        with tempfile.TemporaryDirectory() as pasta:
            estado = os.path.join(pasta, "estado.json")
            saida = os.path.join(pasta, "relatorio.md")
            ler_de_verdade = watch._ler

            def ler(caminho, padrao):
                if caminho.endswith("sources.json"):
                    return [FONTE_AUTO]
                if caminho.endswith("obligations.json"):
                    return [ob()]
                return ler_de_verdade(caminho, padrao)

            with mock.patch.object(watch, "_ler", side_effect=ler), \
                    mock.patch.object(watch, "baixar", side_effect=lambda url: corpo()):
                self.assertEqual(watch.main(["--estado", estado, "--saida", saida]), 0)
                with open(estado, encoding="utf-8") as arquivo:
                    self.assertIn("lgpd", json.load(arquivo))
                self.assertTrue(os.path.isfile(saida))
                mudou = PAGINA.replace("foi obtido.", "foi obtido, com novo prazo.")
                with mock.patch.object(watch, "baixar", side_effect=lambda url: corpo(mudou)):
                    self.assertEqual(watch.main(["--estado", estado, "--saida", saida]), 3)

    def test_main_sem_gravar_nao_cria_o_estado(self):
        with tempfile.TemporaryDirectory() as pasta:
            estado = os.path.join(pasta, "estado.json")
            with mock.patch.object(watch, "_ler", side_effect=lambda c, p: [FONTE_AUTO] if c.endswith("sources.json") else p), \
                    mock.patch.object(watch, "baixar", side_effect=lambda url: corpo()):
                watch.main(["--estado", estado, "--sem-gravar", "--saida", os.path.join(pasta, "r.md")])
            self.assertFalse(os.path.exists(estado))

    def test_main_so_com_erros_devolve_2(self):
        with tempfile.TemporaryDirectory() as pasta:
            with mock.patch.object(watch, "_ler", side_effect=lambda c, p: [FONTE_AUTO] if c.endswith("sources.json") else p), \
                    mock.patch.object(watch, "baixar", side_effect=OSError("sem rede")):
                self.assertEqual(watch.main(["--estado", os.path.join(pasta, "e.json"), "--saida", os.path.join(pasta, "r.md")]), 2)


if __name__ == "__main__":
    unittest.main()
