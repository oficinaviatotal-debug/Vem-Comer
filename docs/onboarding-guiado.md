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

## Peças (em `frontend/src/onboarding/`)

| Arquivo | Função |
| --- | --- |
| `tourEngine.ts` | Lógica pura: passos, progresso, interpretação do que foi falado. Sem navegador, testável no Node. |
| `OnboardingGuide.tsx` | Tela do guia: balão, contorno piscando, voz, microfone. Recebe só a lista de passos. |
| `speech.ts` | Voz (síntese) e microfone (reconhecimento) em pt-BR, com proteção quando o navegador não oferece. |
| `guideStorage.ts` | Lembra, só neste navegador, se o guia já foi mostrado e se a voz está ligada. |
| `adminTour.ts` | O roteiro do painel do restaurante (categorias, pratos, mesas, QR, pedidos). |

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
- Os testes automáticos cobrem a lógica e o roteiro. O piscar e o posicionamento
  foram conferidos em um navegador Chromium simulando celular (390 x 844) com o
  servidor simulado; voz e microfone reais, e o toque em aparelhos de verdade,
  ainda precisam ser vistos em um celular.
