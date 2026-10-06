# Cardápio assistido (cadastro de vários pratos de uma vez)

Para quem tem pouco estudo e pouca paciência com formulário, cadastrar prato por
prato não funciona. A ideia do assistente é: o dono escolhe o tipo de negócio, a
tela já traz os pratos mais comuns, ele marca os que vende e diz o preço de cada
um (ou fala a lista inteira). O celular monta a estrutura abaixo e manda **tudo de
uma vez**.

Esta página descreve a parte do servidor, que já está pronta. A conversa por voz
na tela, as fotos e a logomarca vêm em etapas seguintes (ver "O que falta").

## Modelos prontos por tipo de negócio

Somente o dono (`OWNER`) e o gerente (`MANAGER`) acessam.

| Rota | O que devolve |
| --- | --- |
| `GET /api/admin/menu/templates` | Lista resumida: `id`, `name`, `icon` e as categorias com a quantidade de pratos |
| `GET /api/admin/menu/templates/<id>` | Um modelo completo: categorias e pratos. `404` se o `id` não existe |

Tipos disponíveis: `lanchonete`, `pizzaria`, `restaurante` (marmitaria), `bar`,
`acai`, `padaria`, `churrasco`, `japones`.

**Os modelos não trazem preço, de propósito.** Preço é decisão do dono; um preço
sugerido errado vira prejuízo ou cliente perdido. O código está em
`backend/menu_templates.py`.

## Cadastro em lote

`POST /api/companies/<company_id>/admin/menu/import` (`OWNER` ou `MANAGER`, só do
próprio estabelecimento).

```json
{
  "categories": [
    {
      "name": "Lanches",
      "items": [
        { "name": "X-Burguer", "price": "18,50", "description": "opcional" },
        { "name": "X-Salada", "price": 20 }
      ]
    },
    { "name": "Bebidas", "items": [{ "name": "Suco de laranja", "price": 8 }] }
  ]
}
```

Resposta (`201` quando criou algo, `200` quando tudo já existia):

```json
{
  "message": "Cardapio cadastrado com sucesso",
  "menus_created": 2,
  "menus_reused": 0,
  "products_created": 3,
  "products_skipped": 0
}
```

### Regras

- **Tudo ou nada.** O pedido inteiro é conferido antes de gravar. Se qualquer
  prato estiver errado, nada é gravado e a resposta é `400` com uma frase em
  português dizendo qual (por exemplo, "Preco invalido ou faltando em 'Suco'").
  Depois de conferido, a gravação é uma única transação.
- **Preço obrigatório e maior que zero.** Aceita `18`, `18.5`, `"18,50"`,
  `"R$ 18,50"` e `"1.234,50"`. Zero, negativo, texto e valores acima de
  R$ 99.999,99 são recusados: preço zero quase sempre quer dizer "o preço nunca
  foi dito".
- **Mandar de novo não duplica.** A categoria que já existe é reaproveitada (não
  importam acento nem maiúscula: `Açaí` = `acai`) e o prato que já existe nela é
  pulado, nunca repetido e nunca sobrescrito. Dois toques no botão, ou dois
  celulares ao mesmo tempo, dão o mesmo resultado: a linha do estabelecimento é
  travada durante a gravação.
- **Pratos repetidos no mesmo pedido** são juntados; vale o primeiro.
- **Limites:** 30 categorias, 300 pratos por pedido, nome de categoria até 100
  caracteres, nome de prato até 150, descrição até 500 (o que passar é cortado).
  Quebras de linha e caracteres de controle viram espaço.
- Erros inesperados do banco voltam como `500` sem detalhes internos, e a
  transação é desfeita.

O código está em `backend/menu_import.py`; os testes, em
`backend/test_menu_import.py` (34 testes: preços, textos, validação, gravação sem
duplicar, permissões, falha do banco e conteúdo dos modelos).

## O que falta (próximas etapas, nesta ordem)

1. **Conversa por voz na tela do dono.** O assistente fala, o celular escuta sozinho
   (sem tocar a cada resposta), o dono escolhe o tipo de negócio, diz "tenho X-Burguer
   e X-Salada" e o preço de cada um; o assistente confere e chama a rota acima.
2. **Fotos.** Tirar foto, escolher da galeria ou mandar vídeo; melhoria automática
   (luz, cor, nitidez, corte quadrado) no servidor.
3. **Logomarca.** Ao cadastrar o nome, perguntar se já tem logo; se não, perguntar as
   cores (ou ler a foto da fachada) e gerar uma.
4. **"Falar tudo de uma vez".** Transformar uma frase longa em lista de pratos e
   categorias exige um modelo de linguagem (serviço pago, com chave própria do
   dono do projeto). Sem ele, o assistente pergunta item a item ou usa os modelos
   prontos; os dois caminhos ficam disponíveis.

## Limites conhecidos

- Os modelos são sugestões genéricas; o dono marca só o que vende.
- O reconhecimento de voz do celular devolve texto sem pontuação e sem separar os
  pratos. Por isso a lista falada de uma vez só fica boa com a etapa 4.
- Os testes automáticos usam um banco simulado; o SQL foi conferido à parte contra
  o esquema real em um PostgreSQL de teste, mas o fluxo completo só será visto
  rodando no servidor depois da atualização.
