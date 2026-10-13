# Cardápio por arquivo (planilha ou PDF)

O dono que já tem o cardápio numa planilha (Excel, Google Planilhas baixada como Excel ou CSV) ou num PDF manda o
arquivo e o sistema cadastra categorias, pratos e preços. Ele só confere, igual à foto. Quem não tem arquivo continua
pela foto, pela voz ou pelos tipos de negócio.

## O que o dono vê

1. No Assistente, o cartão **Já tenho um cardápio pronto** passa a dizer "Tire uma foto ou mande a planilha". Também
   dá para falar ("tenho uma planilha", "está no Excel", "vou mandar o arquivo").
2. Na tela do cardápio pronto aparece o botão **📄 Planilha ou PDF** (sem a chave da IA no servidor: **Escolher a
   planilha**, só Excel/CSV, e a tela fica só com o arquivo).
3. Escolhido o arquivo, a leitura começa sozinha ("Lendo o cardápio…", com **Cancelar**). Planilha lê em um instante;
   PDF pode levar até 1 minuto.
4. Daí em diante é igual à foto: "Li o seu cardápio: 32 pratos em 4 categorias…", pergunta só os preços que faltam,
   conferir (nome e preço editáveis, **Tirar**) e **Cadastrar tudo** pela rota de importação de sempre.
5. Arquivo vazio, pesado demais, formato antigo (.xls), Word ou imagem: mensagem em palavras simples dizendo o que
   fazer ("Abra a planilha e use Salvar como, escolhendo .xlsx ou CSV"). Arquivo sem pratos com preço: "Não achei
   pratos com preço nesse arquivo" e os botões voltam, sem perder o lugar.

## O que a planilha precisa ter

Não precisa seguir um modelo. O sistema procura sozinho:

- **Linha de títulos** (Nome/Prato/Produto/Item/Sabor, Categoria, Preço/Valor/R$). Sem títulos, adivinha pelo
  conteúdo: a coluna cheia de números é o preço, o texto ao lado é o nome.
- **Mais de uma coluna de preço** (P, M, G ou Pequena/Grande): vira um prato por tamanho, "Calabresa (G)".
- **Uma coluna só** com "X-Burguer ..... R$ 18,50": separa o preço do fim da linha (só com R$ ou centavos, para não
  confundir "Coca 2L" com preço).
- **Linhas de título de categoria** ("Lanches", "Bebidas") sem preço, seguidas de pratos com preço.
- Sem categoria nenhuma, tudo entra em **Cardápio** e o dono reorganiza na conferência.

Vírgula e ponto-e-vírgula, UTF-8 ou Excel em português (cp1252), tudo é aceito. Só a **primeira aba** do Excel é lida.

## O que acontece por baixo

- `POST /api/admin/menu/parse-file` (só OWNER/MANAGER, campo `file`, até 10 MiB na requisição). O servidor olha
  **dentro** do arquivo (`menu_file.detect_kind`), não confia na extensão.
- **Planilha**: sem IA e sem custo. `.xlsx` é lido com `zipfile` + `ElementTree` da biblioteca padrão (nenhuma
  dependência nova). **Fórmulas nunca são calculadas.** XML com `<!DOCTYPE`/`<!ENTITY` é recusado (bomba de
  expansão), no máximo 300 partes no zip, 2 MiB de arquivo, 3000 linhas e 30 colunas.
- **PDF**: vai para a IA como documento (`menu_photo.read_menu_pdf`), mesma ferramenta `register_menu` e mesma
  limpeza da foto, até 10 MiB (`MENU_PDF_MAX_BYTES`). Gasta a mesma cota da foto (6 por restaurante por hora, 300 por
  dia no servidor, 2 ao mesmo tempo). Sem a chave da IA, responde 501 com uma mensagem que sugere planilha ou fotos.
- A resposta tem o mesmo formato da foto (`readable`, `categories`, `notes`) e a tela a confere de novo antes de usar
  (`normalizeReading`). Nada é gravado nessa rota.
- `GET /api/admin/menu/capabilities` agora devolve também `file_menu` (sempre `true` em servidor com a rota) e
  `pdf_menu` (igual a `photo_menu`). A tela só mostra o que o servidor sabe fazer; servidor antigo sem a rota
  continua só com foto.

## Testes

`backend/test_menu_file.py` (30 casos: CSV, Excel montado em memória, cabeçalhos, tamanhos, vírgula decimal,
formatos recusados, XML malicioso), `backend/test_menu_file_endpoint.py` (rota, papéis, limites, PDF com IA falsa) e
`tests/assistant/menuPhotoLogic.test.mjs` / `assistantFlow.test.mjs` (frases faladas, limites no celular, textos
de cada modo).

## O que ainda não faz

- Excel antigo (.xls), Word (.docx) e LibreOffice (.ods) pedem "Salvar como .xlsx ou CSV" (mensagem pronta).
- Só a primeira aba da planilha. Fotos dentro do Excel/PDF não são cadastradas como foto do prato.
- Ainda não testado com planilhas reais de donos. Mande uma e eu a incluo nos testes.
