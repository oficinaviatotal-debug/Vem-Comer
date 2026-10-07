# Logomarca do restaurante

Quem não tem logomarca cria uma em três toques, no celular, sem custo e sem internet. Quem já tem, envia a sua.

## O que o dono vê

Painel → aba **Marca**.

1. **Criar minha logomarca**.
2. **O que você vende?** 13 desenhos: comida caseira, pizza, hambúrguer, cachorro-quente, frango e carnes,
   pastel e salgados, japonesa, açaí, sorvete, bolos e doces, café e padaria, sucos, outro. O sistema já marca o
   que parece ser pelo nome ("Pizzaria do Zé" → pizza). Nada de bebida alcoólica na lista, de propósito.
3. **Qual é a cor da sua fachada?** 9 cores (vermelho, laranja, amarelo, verde, azul, roxo, marrom, rosa, grafite).
   Já vem marcada a que combina com a comida; uma prévia mostra como está ficando.
4. **Escolha o modelo.** 6 modelos com o nome do restaurante: selo redondo, quadrado com faixa, claro, redondo claro,
   só as letras (iniciais) e toldo de loja. O nome pode ser encurtado ali (só muda na logomarca); se ficar comprido
   demais para algum modelo, aparece um aviso.
5. **Usar esta logomarca.** Ela vai para o cardápio do cliente, ao lado do nome do restaurante.

Também na aba: **Já tenho uma logomarca** (PNG, JPG ou WebP; PNG com fundo transparente é o melhor) e
**Remover a logomarca** (dois toques). Dono e gerente podem; garçom não vê a aba.

## O que acontece por baixo

- **No celular** (`frontend/src/logo/`): tudo é desenhado num canvas com traços próprios, sem imagens prontas.
  `logoLogic.ts` tem as regras (cores, medidas, encaixe do nome, contraste); `logoGlyphs.ts` os 13 desenhos;
  `logoDraw.ts` monta a logomarca; `logoFiles.ts` espera as fontes da marca e gera o PNG de 512 x 512 com fundo
  transparente fora da forma; `LogoMaker.tsx` e `LogoPanel.tsx` são as telas.
- **Legibilidade:** o nome e o desenho têm contraste de pelo menos 4,5 (nome) e 3 (detalhes) em todas as combinações
  de cor e modelo; o amarelo usa letra escura. Quem confere isso é `tests/logo/logoLogic.test.mjs`, a cada mudança.
- **Nome:** o sistema tenta uma, duas linhas e fica com a que deixa a letra maior; nunca sai da forma; só em último
  caso corta com "…" e avisa.
- **Logomarca enviada pelo dono:** PNG ou JPG até 3 MB vai como está; maior é reduzido no celular (lado maior 1024),
  PNG continua PNG para não perder a transparência. Outros tipos (SVG, GIF, HEIC) são recusados na tela.
- **No servidor** (`backend/logo_image.py`, rota `POST/DELETE /api/admin/company/logo`): confere os bytes, reduz sem
  esticar (512 e 160 px), grava WebP sem dados escondidos e guarda a chave em `companies.logo_key`. O mesmo volume
  e a mesma entrega `/media/...` das fotos dos pratos. As respostas públicas da empresa trazem `logo_url` e
  `logo_thumb_url`. Segurança: `SECURITY.md`, seção "Restaurant logo".

## Como foi testado

- 36 testes do servidor (`backend/test_logo.py`): imagem, papéis, empresa própria, troca apaga a antiga, 400/413/503,
  banco que falha, resposta pública sem vazar a chave.
- 51 testes do celular (`tests/logo/`): catálogo, contraste de todas as combinações, encaixe do nome para dez nomes
  em seis modelos, cada desenho dentro da caixa e só com as três cores, nome dentro do círculo nos modelos redondos,
  tipo do arquivo enviado. Um canvas de mentira (`tests/logo/fakeCanvas.mjs`) também recusa chamadas que celulares
  antigos não têm (como `roundRect`).
- Navegador (Chromium, 360 px, regra de segurança de produção ligada, API de mentira): painel → Marca → criar nos três
  toques → salvar (PNG 512 x 512 chega ao servidor no campo certo) → enviar a minha (igual ao arquivo) → SVG recusado →
  tipo vazio decidido pelo nome → remover em dois toques → servidor recusando mostra a mensagem → gerente vê e garçom
  não → cardápio do cliente mostra a miniatura e não mostra imagem quebrada quando não há logomarca. 45 de 45.

## O que ainda não foi provado

- Em celular de verdade: o desenho foi visto num Chromium de computador. Falta olhar num Android real, com tela
  pequena e sinal fraco, e conferir se o toque nas opções está confortável.
- No servidor de verdade: o volume de fotos e a rota `/media/...` rodam só lá. A logomarca usa os mesmos.
- A qualidade dos desenhos é de logomarca simples e limpa, feita por código; não substitui um designer. Se o dono
  quiser algo mais caprichado, é por envio da logomarca própria.
- Falta usar a logomarca nos posts da semana e no QR pequeno (próximas etapas) e no cabeçalho do painel.
- Falta a voz: hoje é por toque, que é rápido e funciona sem internet.
