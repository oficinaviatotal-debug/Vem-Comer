# Fotos dos pratos

O dono tira a foto (ou escolhe da galeria, ou grava um vídeo curto) e o sistema melhora e publica no cardápio.
Ninguém precisa escrever nada.

## O que o dono vê

1. Ao terminar de cadastrar o cardápio no Assistente, aparece **Colocar fotos nos pratos**.
2. Um prato por vez: **Tirar foto**, **Escolher da galeria** ou **Gravar vídeo do prato**. Se for vídeo, o celular
   olha 8 momentos e fica com o mais nítido e bem iluminado.
3. Aparece **Sua foto** ao lado da **Melhorada**, com o que mudou (mais luz, mais contraste, cores mais vivas, mais nitidez)
   e, quando for o caso, uma dica em palavras simples (ex.: "A foto ficou escura. Perto de uma janela fica bem mais bonito").
4. Também dá para colocar, trocar ou remover a foto na aba **Produtos** do painel.
5. O cliente vê a miniatura (4:3) ao lado de cada prato no cardápio.

## O que acontece por baixo

- No celular: a foto é reduzida (lado maior 1600 px) e vira JPEG antes de subir, para funcionar com sinal fraco.
  A rotação do celular é aplicada aqui.
- No servidor (`backend/image_enhance.py`): confere se é mesmo uma imagem, corta no centro em 4:3,
  ajusta contraste (60% do efeito automático), clareia foto escura (nunca escurece), +12% de cor, nitidez leve,
  tira os dados escondidos (EXIF) e grava duas versões WebP: 1080x810 e 480x360.
- Os arquivos ficam no volume `vemcomer_uploads` (`/data/uploads/<empresa>/<chave>.webp` e `-thumb.webp`);
  o banco guarda só a chave (`products.image_key`). O Caddy entrega em `/media/...`, com cache longo
  (cada foto nova tem nome novo).
- Apagar o prato ou remover a foto apaga os dois arquivos.
- O backup diário (`deploy/vps/backup.sh`) agora também copia as fotos (`vemcomer-fotos-*.tar.gz`).

## O que ainda não foi provado

- A calibração (quanto clarear, quanta cor) foi feita com imagens de teste, não com fotos reais de pratos.
  Quando houver fotos reais do dono, ajustar os números em `image_enhance.py`.
- Não há aviso de "foto tremida" de propósito: sem fotos reais para calibrar, um aviso errado incomoda mais do que ajuda.
- Volume do Docker, Caddy `/media/*` e o backup das fotos só rodam de verdade no servidor; aqui foram testados
  a lógica, o servidor Flask completo com banco simulado e o navegador (Chromium, regra de segurança de produção ligada).
- A câmera do celular (`capture`) e a gravação de vídeo só foram testadas com arquivos; falta testar no aparelho.
- Vídeos H.264 de celular dependem do navegador do aparelho conseguir tocá-los (Chrome no Android toca).
