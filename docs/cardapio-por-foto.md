# Cardápio por foto

O dono que já tem cardápio (papel, banner, PDF no celular) tira uma foto e o sistema cadastra categorias, pratos
e preços. Ele só confere. Quem não tem cardápio continua pelo caminho de sempre (tipo de negócio → marcar pratos).

## O que o dono vê

1. No Assistente, a primeira pergunta passa a ser **"Você já tem um cardápio pronto? Então tire uma foto dele."**,
   com o cartão **Já tenho um cardápio pronto** acima dos tipos de negócio. Também dá para falar ("já tenho cardápio
   pronto", "quero mandar uma foto").
2. Tela **Foto do cardápio**: **Tirar foto do cardápio** (câmera de trás), **Escolher da galeria** (várias de uma vez)
   ou **Tirar outra página**. Até 4 páginas. Cada página aparece em miniatura, com **×** para tirar.
3. **Ler o cardápio** → "Lendo o cardápio… pode levar até 1 minuto" (há **Cancelar**).
4. O assistente diz o que leu ("Li o seu cardápio: 32 pratos em 4 categorias. 3 pratos estão sem preço.") e
   **pergunta só os preços que faltam**, um por vez, por voz ou digitando.
5. **Conferir o cardápio**: cada prato lido tem o nome editável (para consertar erro de leitura), o preço editável
   e **Tirar**. **Voltar** abre a lista de pratos para tirar ou acrescentar. **Cadastrar tudo** usa a mesma rota de
   importação de sempre (pratos que já existem são pulados).
6. Se a foto não for um cardápio ou estiver ilegível: mensagem em palavras simples e **Tirar outra foto**.
   Se o serviço estiver ocupado: **Tentar de novo** sem tirar a foto outra vez.

Se o servidor não tiver a chave da IA, nada disso aparece: o Assistente é o de antes.

## O que acontece por baixo

- Celular: cada página vira JPEG com o lado maior até 2400 px (qualidade 0,85), com a rotação do celular aplicada.
  O conjunto não passa de 9 MiB.
- Servidor (`POST /api/admin/menu/parse-photo`, só OWNER/MANAGER, campo `photos`): `image_enhance.prepare_for_reading`
  confere que é imagem de verdade, endireita, limita a 2576 px e tira o EXIF; `menu_photo.read_menu` chama a API de
  mensagens da Anthropic com a ferramenta única `register_menu` (`tool_choice` = `any`) e **limpa e limita** a
  resposta antes de devolver (nomes curtos, preços `"18.50"` ou vazio, sem repetição, no máximo 30 categorias e
  300 pratos). Nada é gravado nessa rota; o cadastro é feito depois, pela rota de importação.
- `GET /api/admin/menu/capabilities` diz à tela se a leitura está ligada (`{"photo_menu": true|false}`).
- Modelo padrão: `claude-sonnet-5-5` (troca por `MENU_PHOTO_MODEL` no `.env`, sem mexer no código).
- Limites contra abuso e custo: 6 leituras por restaurante por hora (`MENU_PHOTO_PER_HOUR`) e 300 por dia no servidor
  todo (`MENU_PHOTO_PER_DAY`), contados em memória (zeram ao reiniciar). Falha do serviço não gasta a cota do dono.
  No máximo 2 leituras ao mesmo tempo; o servidor aceita até 120 s por requisição (`--timeout 120`).

## Como ligar e desligar (administrador)

Precisa de uma chave de API da Anthropic (conta paga, com crédito): https://console.anthropic.com/settings/keys

```
bash /opt/vem-comer/app/deploy/vps/configurar-ia.sh
```

O script pede a chave com a digitação escondida, confere o formato, testa a chave com uma pergunta de 1 token,
grava em `/opt/vem-comer/.env` (permissão 600, só root) e reinicia só o servidor do Vem Comer. A chave não passa por
argumento de programa (nem aparece em `ps`), não vai para log e não é gravada se o teste falhar. Para desligar:

```
bash /opt/vem-comer/app/deploy/vps/configurar-ia.sh --remover
```

## Privacidade (LGPD) — precisa entrar na política de privacidade e nos termos

- A foto do cardápio vai para a Anthropic (operador de IA) **só para ser lida**. O Vem Comer não guarda a foto: ela
  fica na memória do servidor durante a leitura e é descartada. Cardápio de restaurante não costuma ter dado pessoal,
  mas o dono pode fotografar algo com telefone ou nome de pessoa; o texto avisa na tela que a foto é usada só para
  ler. Conferir a política de retenção da Anthropic antes de publicar os termos.
- O texto que aparece na foto é tratado como dado, nunca como ordem: a IA só pode devolver a ferramenta
  `register_menu` e a resposta é revalidada no servidor e de novo na tela.

## Custo (estimativa, ainda não medida)

Uma página de cardápio com ~2400 px custa na ordem de poucos centavos de dólar por leitura (a conta é por tokens de
imagem e de saída). **Este número é uma estimativa**: o custo real só será conhecido depois da primeira leitura de
verdade; a Anthropic mostra o gasto no console. Os limites acima existem para o gasto nunca surpreender.

## O que foi provado e o que não foi

Provado aqui: 50 testes do servidor com respostas simuladas e um servidor local imitando a API (cabeçalhos, erros
401/402/403/429/5xx, timeout, conexão recusada, JSON inválido, resposta sem a ferramenta, texto da foto mandando
"ordens", chave nunca devolvida); 10 testes do script da chave com `docker` e Anthropic de mentira; 55 verificações
no navegador (Chromium, regra de segurança de produção ligada) do caminho completo; testes de lógica da tela.

**Não provado:** nenhuma leitura com a IA de verdade (falta a chave e fotos reais de cardápio: letra de mão, foto
torta, reflexo, cardápio em 3 colunas); a câmera e a galeria do celular; a voz ("já tenho cardápio") no microfone do
aparelho; o custo real; o limite em memória com mais de um processo (hoje há um só).
