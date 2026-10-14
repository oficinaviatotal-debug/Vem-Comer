# Pedidos sobre dados pessoais e denúncias de conteúdo

Guia de operação do canal que a LGPD (arts. 18 e 19) e o Marco Civil (arts. 19 e 21) pedem. Quem opera é o
administrador da plataforma. Este texto é a leitura da engenharia; o advogado confirma prazos e respostas
(`compliance/obligations.json`: LGPD-DIREITOS-TITULAR, LGPD-ELIMINACAO-RETENCAO, MCI-DENUNCIA-CONTEUDO).

## Papéis (quem decide o quê)

- **Dados do restaurante e do dono** (cadastro, assinatura, aceites): a Vem Tecnologia decide e responde.
- **Dados dos clientes do restaurante** (nome, telefone, endereço, pedidos): o restaurante decide e responde; a
  plataforma só guarda e processa para ele (operador). Se um cliente pedir esses dados, o pedido chega aqui,
  mas a resposta depende do restaurante; o administrador encaminha e registra.
- **Conteúdo do restaurante** (cardápio, fotos, descrições): é responsabilidade de quem publicou. A plataforma
  retira quando a lei manda (ordem judicial ou aviso de conteúdo íntimo) ou quando a denúncia mostra ilegalidade clara.

## Onde os pedidos chegam

| Canal | Quem usa | O que acontece |
| --- | --- | --- |
| `/api/privacidade` | Qualquer pessoa | Página com o inventário de dados, os direitos e o formulário. Devolve **protocolo** (`VC-2026-XXXXXXXX`) e um **código** de acompanhamento |
| `/api/denuncia` | Qualquer pessoa, sem identificação | Formulário de denúncia de conteúdo (endereço do conteúdo e motivo) |
| Plano → "Seus dados" no painel | Dono logado | Baixa a cópia dos dados da conta (JSON) e abre pedido já com identidade conferida |
| E-mail ou presencial | Qualquer pessoa | O administrador registra pelo painel com o canal certo |

Cada pedido ganha **prazo**: 15 dias para os pedidos da LGPD e meta interna de 2 dias para denúncia. A pessoa
acompanha em `/api/privacidade/acompanhar?p=<protocolo>&t=<código>`; no banco fica só a impressão digital do código.

## Onde o administrador responde

Painel → **Chamados** → bloco **Pedidos sobre dados pessoais** (abaixo dos pedidos de ajuda).

1. A fila mostra os pedidos abertos, os atrasados primeiro. O aviso no celular diz só o tipo e o prazo (nunca o conteúdo).
2. Abra o pedido, **confira a identidade** (só marque "identidade conferida" quando a pessoa provou ser a dona do
   e-mail: pedido feito logado no painel já vem conferido; pedido do formulário público, não).
3. Escolha a resposta: respondida, negada (diga o motivo) ou encerrada. O histórico do pedido só recebe linhas
   novas; o banco recusa alterar ou apagar.
4. **Apagar os dados de uma pessoa**: o painel simula antes (conta o que mudaria e desfaz) e só executa depois que
   você digita `ANONIMIZAR`.

## O que a eliminação apaga e o que guarda

- Pessoa: nome vira "Pessoa removida", o e-mail vira um endereço inválido, a senha deixa de funcionar e a conta
  fica inativa; as chaves de aviso no celular são apagadas; o telefone e o texto dos pedidos de ajuda e o
  comentário das opiniões são limpos.
- Restaurante inteiro: tudo isso para todas as pessoas, mais o nome (vira "Restaurante encerrado"), o endereço
  público, a chave Pix, o telefone do dono e a logomarca (referência); nos pedidos, nome, telefone, endereço de
  entrega e observações dos itens; os comentários dos clientes. O cardápio fecha para pedidos.
- Guarda, porque a lei manda guardar ou para defesa: valores e datas dos pedidos e dos pagamentos da assinatura, a prova
  dos aceites (e-mail só como código calculado a partir dele) e o histórico do pedido do titular.
- O e-mail da pessoa entra na lista de bloqueio (motivo `titular`) para ninguém mandar mensagem por engano depois.
- Outros restaurantes não são tocados. Há teste no banco de verdade para isso.
- **Limite conhecido**: esta rotina limpa o banco de dados, mas **não apaga os arquivos de foto** (logomarca e pratos)
  que ficam no disco do servidor, nem os nomes e descrições dos pratos do cardápio. Isso ainda precisa de uma rotina própria.
- Os prazos de guarda (5 anos para prova de aceite e pagamentos) são proposta da engenharia; o contador e o advogado confirmam.

## O que precisa estar no `.env` do servidor

Sem isso a página funciona, mas **sem CNPJ, endereço e canal**, e mostra o aviso de texto preliminar.

```
CONTROLLER_NAME=Vem Tecnologia
CONTROLLER_CNPJ=...            # quando a empresa tiver CNPJ
CONTROLLER_ADDRESS=...         # endereço da empresa
PRIVACY_CONTACT=...            # e-mail ou WhatsApp do encarregado (canal de privacidade)
PRIVACY_REVIEWED=1             # SÓ depois que um advogado revisou os textos
```

Depois de editar o `.env`, reiniciar só o servidor do Vem Comer:
`cd /opt/vem-comer/app/deploy/vps && docker compose up -d api`.

## O que ainda depende de gente

- **Encarregado (DPO)**: nomear uma pessoa e publicar o contato (`PRIVACY_CONTACT`).
- **Advogado**: revisar `/api/privacidade`, os termos e as respostas-padrão; confirmar prazos e bases legais.
- **Contador**: confirmar os prazos de guarda fiscal.
- **Incidente de segurança**: plano e registro de 5 anos ainda por fazer (LGPD art. 48; ANPD Res. 15/2024).
- **Cliente final do restaurante**: ainda não existe tela própria para ele abrir pedido de dados; hoje ele usa `/api/privacidade`.

## Como se prova que funciona

- `backend/test_titular.py`, `test_titular_api.py`: regras, prazos, páginas e rotas.
- `backend/test_titular_db.py` (roda no PostgreSQL de verdade, CI `banco-de-verdade`): histórico que não se altera;
  a eliminação mantém o dinheiro e apaga o dado pessoal; outro restaurante fica intacto.
- `backend/test_inventario_dados.py`: toda coluna que parece dado pessoal precisa estar no inventário
  (`backend/inventario_dados.json`), senão a conferência quebra. Coluna nova com dado pessoal exige atualizar o inventário.
