# Pix do restaurante (código Copia e Cola)

O restaurante coloca a **própria chave Pix** no painel. O cliente, depois de enviar o
pedido, vê na comanda um código **Pix Copia e Cola** e um **QR code** com o valor exato.
O dinheiro vai **direto do banco do cliente para a conta do restaurante**: sem
intermediário e sem taxa do Vem Comer.

## Como funciona, em uma frase

O sistema só escreve o código (chave, nome, cidade, valor e referência do pedido); quem
confirma que o dinheiro chegou é uma pessoa do restaurante, olhando o app do banco, e
toca em **Pagamento recebido**. Um código Pix estático não avisa o sistema quando é pago,
por isso a confirmação é manual. Quando houver um provedor de pagamento (PSP), essa
confirmação passa a ser automática, sem mudar as telas.

## O que cada pessoa vê

**Dono** (aba **Pagamento** do painel)

1. Escolhe o tipo da chave (CPF, CNPJ, celular, e-mail ou chave aleatória), escreve a
   chave, o nome do recebedor (como aparece no banco), a cidade e **a própria senha**.
2. O painel mostra só uma versão escondida da chave (`529••••••25`).
3. **Ver código de teste** gera um Pix de **R$ 1,00**: pague com o seu celular e confira
   se o dinheiro cai na conta e se o nome do recebedor está certo. Faça isso antes de abrir
   o restaurante para os clientes.
4. **Desligar o Pix** (também pede a senha). Sem chave, o cliente só vê Cartão e Dinheiro.

O gerente vê o estado e o teste, mas não muda a chave.

**Cliente** (comanda depois de enviar o pedido)

- Se o restaurante ligou o Pix, aparece a opção **Pix** no carrinho (já marcada).
- Depois de enviar: valor, nome do recebedor, botão **Copiar código Pix**, o código e o QR.
  Se o celular não deixar copiar, a tela diz para tocar e segurar no código.
- Quando o restaurante confirma, a comanda mostra **Pagamento recebido** e o código some.
- Um guia curto (voz + botão piscando) ensina a copiar, pagar no app do banco e esperar.
  Abre sozinho na primeira vez neste aparelho e pode ser reaberto em **Como pagar? Me ajude**.
- Se o Pix for desligado depois do pedido, a comanda diz que o pagamento é com o atendente.

**Caixa, gerente e dono** (aba **Pedidos**)

- Cada pedido mostra uma etiqueta: `Pix: aguardando`, `Pix pago`, `Dinheiro: receber`…
- O botão **Pagamento recebido** aparece nos pedidos ainda não pagos (também serve para
  cartão e dinheiro). Garçom, cozinha e entregador não veem o botão.

## Segurança

- A **chave só muda** pelo dono, **com a senha de novo** e com limite de tentativas
  (as mesmas regras do login). Uma sessão roubada não consegue desviar o dinheiro sem a senha.
- O **valor do código vem do pedido salvo no servidor**, nunca do navegador: o cliente não
  consegue pedir um código de outro valor.
- O código só é entregue com o **token de acompanhamento** do próprio pedido
  (o mesmo que protege a comanda) e só se o pedido é Pix.
- Confirmar pagamento exige perfil dono, gerente ou caixa **do mesmo restaurante**; de
  outro restaurante dá "não encontrado". Confirmar duas vezes não duplica nada e gera um
  único registro `PAYMENT_CONFIRMED` no histórico do pedido.
- O endereço público `GET /api/companies/<id>/payment-options` só diz se há Pix
  (`{"pix": true|false}`); nunca devolve chave, nome ou cidade.

## Rotas

| Rota | Quem | O que faz |
|---|---|---|
| `GET /api/companies/<id>/payment-options` | público | `{pix: true/false}` |
| `GET /api/orders/<id>/pix?tracking_token=` | cliente do pedido | código, QR (data URL), recebedor, valor |
| `GET /api/companies/<id>/admin/pix` | dono, gerente | estado com a chave escondida |
| `PUT /api/companies/<id>/admin/pix` | **só dono** | salva (`key_type`, `key`, `receiver_name`, `city`, `password`) ou desliga (`remove: true`, `password`) |
| `GET /api/companies/<id>/admin/pix/preview` | dono, gerente | código de teste de R$ 1,00 |
| `POST /api/orders/<id>/payment/confirm` | dono, gerente, caixa | marca como pago (`payments.status = PAID`) |

Os pedidos ganharam `payment_status` (`PENDING` ou `PAID`) em `GET /api/orders/<id>` e na
lista do painel.

## Banco de dados

A migração `database/migrations/003_company_pix.sql` acrescenta quatro colunas à tabela
`companies`: `pix_key_type`, `pix_key`, `pix_receiver_name`, `pix_city`. Ela pode rodar mais
de uma vez sem estragar nada (`ADD COLUMN IF NOT EXISTS`).

**Aplique a migração no banco de produção antes de publicar o servidor novo.** Sem as
colunas, as rotas de Pix respondem erro. O restante do sistema continua funcionando e o
cliente simplesmente não vê a opção Pix.

## O código (BR Code)

Montado em `backend/pix.py`, sem dependências: campos EMV (`00`, `26` com `br.gov.bcb.pix`
e a chave, `52`, `53 = 986`, `54` valor, `58 = BR`, `59` nome até 25, `60` cidade até 15,
`62` referência `VC` + 8 caracteres do pedido, `63` CRC16-CCITT). Nome e cidade saem em
maiúsculas, sem acento, como o padrão exige. Chave CPF/CNPJ conferida pelos dígitos
verificadores (inclui o CNPJ alfanumérico); celular vira `+55DDDNÚMERO`.

## Limites conhecidos

- **A confirmação é manual.** O sistema não enxerga o banco. Se ninguém tocar em
  Pagamento recebido, o pedido continua "Pix: aguardando" (a cozinha não depende disso).
- O código estático **não expira** e pode ser pago mais de uma vez; o valor é fixo, mas
  não há controle de duplicidade nem de estorno. Isso só se resolve com Pix dinâmico via PSP.
- QR e código foram conferidos por leitura automática e pelo teste de R$ 1,00 do dono;
  **teste com um pagamento real no seu banco antes de usar**, porque cada banco valida o
  código por conta própria.
- Falta o PSP (Pix dinâmico com aviso automático): depende de escolher o provedor.

## Como testar

```bash
# lógica e telas (Node 22)
node --experimental-strip-types --no-warnings --test tests/onboarding/*.test.mjs tests/customer/*.test.mjs tests/ui/*.test.mjs

# servidor (na pasta backend)
python -m unittest discover -s . -p 'test_*.py'
```

Os testes do servidor usam um banco simulado. Além deles, as rotas foram exercitadas
contra um PostgreSQL de verdade com o esquema de produção: salvar a chave, criar pedido
Pix, gerar o código com o valor do pedido, confirmar pagamento (e confirmar de novo),
bloqueio de garçom e de outro restaurante, desligar o Pix (22 conferências).
