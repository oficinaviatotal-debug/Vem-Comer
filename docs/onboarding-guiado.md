# Guia de primeiros passos (assistente que fala e pisca)

O cliente final não deve precisar adivinhar nada. O guia conversa com ele, lê cada
passo em voz alta, **pisca no ponto exato da tela** onde ele deve tocar e entende
comandos de voz. É a base de onboarding de todos os produtos Vem (Vem Comer,
Vem Trabalhar e os próximos).

## O que o dono vê

1. Na primeira vez que o **dono** entra no painel, o guia abre sozinho.
2. Cada passo mostra título, texto curto e uma dica do que dizer. A voz lê o texto.
3. O botão, campo ou aba certa fica com um contorno laranja piscando; o resto da
   tela escurece. O guia **não bloqueia toques**: ele toca no botão de verdade.
4. Ele avança de três jeitos: tocando no botão piscando (nos passos de clique),
   tocando em **Próximo**, ou falando.
5. Para rever, toca em **Guia** no topo do painel (dono e gerente).

Comandos de voz (com ou sem acento): **próximo**, **voltar**, **repetir**,
**pular**. Também entende "pronto", "entendi", "certo", "não entendi" (repete) e
"fechar" (pula). O microfone só liga quando a pessoa toca em **Falar**; nunca
escuta sozinho.

Sem voz ou sem microfone (alguns navegadores não têm), o guia continua
funcionando só com texto e botões.

### Falar o que vai no campo

Nos passos que apontam para um campo (nome da categoria, nome do prato, preço,
categoria do prato, número da mesa) o balão diz "Toque em Falar e diga ...". Quem
fala não precisa digitar: o guia escreve no campo, como se tivesse sido digitado,
e confirma em voz alta e na tela ("Escrevi: Pratos. Se estiver certo, toque em
Próximo.").

| Tipo (`dictate`) | O que entende | Exemplo |
| --- | --- | --- |
| `text` | Qualquer frase; vira "Primeira letra maiúscula", sem ponto final | "combinado de 20 peças" |
| `price` | Dígitos ou palavras; devolve com ponto para o campo numérico | "quarenta e nove e noventa", "49,90", "vinte reais e cinquenta" |
| `integer` | Número inteiro, recusa centavos | "mesa cinco" |
| `choice` | Uma opção da lista, ignorando plural e palavras a mais | "bebida" escolhe "Bebidas" |

Regras que não mudam:

- Nos passos com campo, só uma frase de **uma ou duas palavras** conta como comando
  ("próximo", "pode seguir"). Frases maiores são a resposta do campo, então
  "pronto prato do dia" não avança o guia.
- Preço ou número que não ficou limpo **não é adivinhado**: o campo fica como estava
  e o guia pede de novo com um exemplo.
- Categoria ambígua ("pratos" quando há "Pratos quentes" e "Pratos frios") não é
  escolhida pela pessoa; ela toca na lista.
- **Nunca por voz**: chave Pix e senha. Esses passos não têm `dictate`, e um teste
  automático garante isso.

### Rapidez e voz

- Comandos curtos ("pular", "voltar") agem assim que são ouvidos, sem esperar o
  silêncio que encerra a frase. Em passos com campo o guia espera o fim da frase,
  porque uma palavra solta ("pronto") pode ser o começo do nome do prato.
- A voz é escolhida de propósito: português do Brasil, preferindo vozes "Google",
  "Natural" ou "Neural" às vozes simples do sistema (`voiceScore` em `speech.ts`).
  O Chrome carrega a lista de vozes depois da página; o guia espera por ela em vez
  de usar a voz padrão. O ritmo é 1,05.

## Peças (em `frontend/src/onboarding/`)

| Arquivo | Função |
| --- | --- |
| `tourEngine.ts` | Lógica pura: passos, progresso, interpretação do que foi falado. Sem navegador, testável no Node. |
| `fillField.ts` | Escreve o que foi falado no campo apontado (texto, preço, número, opção de lista). Só DOM, sem React. |
| `OnboardingGuide.tsx` | Tela do guia: balão, contorno piscando, voz, microfone. Recebe só a lista de passos. |
| `speech.ts` | Voz (síntese) e microfone (reconhecimento) em pt-BR, com proteção quando o navegador não oferece. |
| `guideStorage.ts` | Lembra, só neste navegador, se o guia já foi mostrado e se a voz está ligada. |
| `adminTour.ts` | O roteiro do painel do restaurante (mesas, QR, Pix, pedidos). O cardápio fica no Assistente, não no guia. |

Estilos: bloco `Guided onboarding` no fim de `frontend/src/styles.css` (classes `tour-*`).
Respeita `prefers-reduced-motion` (sem piscar, só contorno fixo).

## Como criar um roteiro novo

Um passo é um objeto:

```ts
{
  id: "nome-categoria",
  title: "Dê um nome à categoria",         // lido em voz alta
  text: "Escreva o nome da primeira categoria. Por exemplo: Pratos.",
  target: "#admin-menu-name",                // id do elemento que pisca
  view: "categorias",                        // tela/aba onde o passo acontece
  advanceOnClick: true,                      // avança quando tocar no alvo
  say: "próximo",                            // dica mostrada ao usuário
}
```

Regras de escrita: frases curtas (até ~260 caracteres), uma ação por passo, usar as
mesmas palavras que estão escritas nos botões, dar um exemplo concreto.

Para ligar a um painel novo:

1. Dê `id` único aos elementos que vão piscar (`id="meu-botao"`).
2. Crie `meuTour.ts` com a lista de passos e um `TOUR_ID` (troque o número, ex.
   `v2`, quando o roteiro mudar muito, para o guia reaparecer).
3. No painel, declare o estado **antes de qualquer `return` antecipado** (regra dos
   hooks do React):
   ```tsx
   const [guideOpen, setGuideOpen] = useState(false);
   ```
4. Renderize:
   ```tsx
   {guideOpen && (
     <OnboardingGuide
       steps={MEU_TOUR}
       onNavigate={(view) => /* trocar de aba/tela */}
       onClose={() => { markGuideSeen(TOUR_ID, userId); setGuideOpen(false); }}
     />
   )}
   ```
5. Copie `tests/onboarding/adminTour.test.mjs` e adapte: ele garante que todo alvo
   do roteiro existe no código do painel. Se alguém renomear um botão e esquecer o
   guia, a verificação automática falha.

### O cliente da mesa também tem guia

`frontend/src/customer/customerTour.ts` guia quem escaneou o QR: categorias,
**Adicionar**, **Ver pedido**, nome, forma de pagamento e **Enviar pedido**. Abre
sozinho na primeira visita neste aparelho (a marca "já viu" fica no próprio
celular, porque o cliente não faz login) e pode ser reaberto pelo botão **Ajuda**
no topo. O passo de categorias some se o restaurante não tem categorias.
`tests/customer/customerTour.test.mjs` confere que todo alvo existe nas telas.

Se o cliente ainda não adicionou nada, os passos do carrinho continuam sendo lidos
em voz alta e por texto, mas não há o que piscar (a barra e o carrinho só existem
com itens); ele pode tocar em Próximo ou Pular guia.

### O guia de pagamento do Pix

Depois do primeiro pedido com Pix, `pixTour()` (em `customerTour.ts`) guia o cliente em
três passos: **Copiar código Pix** (o botão pisca), pagar no app do banco e esperar a
confirmação do restaurante. Abre sozinho uma vez por aparelho (marca `cliente-pix-v1`) e
reabre em **Como pagar? Me ajude**. Só a comanda do primeiro Pix pendente leva os `id`
usados pelo guia, para que nenhum `id` se repita quando há dois pedidos.

No painel do dono, o roteiro (`admin-v2`) ganhou três passos: aba **Pagamento**, chave Pix e
**Salvar Pix**. Como a versão mudou, donos que já tinham visto o guia o veem de novo.

### Reuso no Vem Trabalhar

A pasta `onboarding/` não depende do Vem Comer: copie a pasta e o bloco de CSS,
escreva o roteiro (perfil, vaga, candidatos) e siga os passos acima.

## Como testar

```bash
node --experimental-strip-types --no-warnings --test tests/onboarding/*.test.mjs tests/customer/*.test.mjs tests/ui/*.test.mjs
```

Roda também no GitHub (`Vem Comer guided onboarding tests`).

## Limites conhecidos

- Voz e microfone dependem do navegador. Reconhecimento de fala funciona bem no
  Chrome/Edge e no Safari recente; em outros, o guia usa só texto e botões. O
  microfone exige página em HTTPS e a permissão do usuário.
- Alguns navegadores só liberam a voz depois de um toque. Se o guia abrir sozinho
  logo após recarregar a página, ele pode ficar mudo no primeiro passo; por isso
  o balão tem o botão **Ouvir de novo**, que sempre funciona com um toque.
- A qualidade da voz depende das vozes instaladas no celular. O guia escolhe a melhor
  em português, mas se o aparelho só tem a voz simples do sistema ela continua sendo
  robótica. O passo seguinte, se isso incomodar, é tocar áudios gravados com voz
  profissional (sem demora e igual em qualquer celular); isso exige um serviço de voz.
- A demora de um comando falado em celular real ainda não foi medida: o ajuste acima
  tira a espera pelo fim da frase, mas o tempo do reconhecimento do próprio celular
  não está nas nossas mãos.
- Os testes automáticos cobrem a lógica e o roteiro. O piscar e o posicionamento
  foram conferidos em um navegador Chromium simulando celular (390 x 844) com o
  servidor simulado; voz e microfone reais, e o toque em aparelhos de verdade,
  ainda precisam ser vistos em um celular.

## Mudança de rumo (guia `admin-v3`)

O guia de 18 passos pedia para **escrever** o nome da categoria e de cada prato. Isso não
serve para dono de negócio pequeno que escreve pouco ou nada. Agora:

- **Primeiro acesso sem cardápio:** o painel abre direto na aba **Assistente** (voz e
  toque, nenhuma escrita) e o guia não abre na frente. O assistente fica em
  `frontend/src/assistant` (ver `docs/assistente-cardapio-voz.md`).
- **Primeiro acesso com cardápio:** abre o guia, agora com 11 passos: um passo apontando
  para a aba Assistente, e depois mesas, QR, Pix e pedidos. O roteiro não aponta mais para
  os campos de categoria e prato (há um teste que garante isso).
- Ao terminar o cardápio no Assistente, o botão **Continuar: mesas, Pix e pedidos** abre o guia.
- O cartão do guia ficou com **um botão grande** ("Próximo", largura toda) no topo dos
  controles; "Ouvir de novo" e "Falar" ficam logo abaixo, e "Voltar" e "Pular guia" viram
  links discretos.
- A voz fala um pouco mais rápido (1,12) e prefere vozes de rede do celular quando existem;
  no Assistente há o botão **Trocar voz**, que percorre as vozes em português do aparelho e
  lembra a escolhida (neste navegador).

