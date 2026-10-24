import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { menuViews } from "../../frontend/src/nav/navLogic.ts";
import { allowedViews, knownViews } from "../../frontend/src/painel/shellLogic.ts";
import {
  captionMs,
  examplesFor,
  interpretVoiceNav,
  normalizeSpeech,
  spokenIn,
  spokenName,
  voicePhrases,
  voiceViews,
} from "../../frontend/src/painel/voiceNavLogic.ts";

const ctx = (extra = {}) => ({ role: "OWNER", planBlocked: false, hasPlanTab: true, platformAdmin: false, ...extra });
const ask = (transcript, extra = {}, current = "inicio") => {
  const context = ctx(extra);
  return interpretVoiceNav({ transcript, role: context.role, allowed: allowedViews(context), current });
};

// ---------------------------------------------------------------- como a fala é lida

test("a fala é lida sem acento, sem maiúscula e sem pontuação, com espaço dos dois lados", () => {
  assert.equal(normalizeSpeech("  Pedidos! "), " pedidos ");
  assert.equal(normalizeSpeech("Abrir a MESA, por favor."), " abrir a mesa por favor ");
  assert.equal(normalizeSpeech("Cardápio"), " cardapio ");
  assert.equal(normalizeSpeech(null), "  ");
  assert.equal(normalizeSpeech(undefined), "  ");
  assert.equal(normalizeSpeech("???"), "  ");
});

test("toda frase que a voz entende já está em minúsculas, sem acento e sem pontuação (senão nunca casaria)", () => {
  for (const phrase of voicePhrases()) {
    assert.equal(normalizeSpeech(phrase), ` ${phrase} `, `a frase "${phrase}" não está normalizada`);
  }
});

test("toda tela do menu tem como ser falada, e a voz não conhece tela que o painel não tem", () => {
  const spoken = new Set(voiceViews());
  for (const view of menuViews()) assert.ok(spoken.has(view), `a tela ${view} do menu não tem frase de voz`);
  for (const view of voiceViews()) assert.ok(knownViews().includes(view), `a voz fala de ${view}, que o painel não tem`);
});

test("nenhuma frase pertence a duas telas (a conta do empate seria sorte)", () => {
  const seen = new Map();
  const phrases = [];
  for (const view of voiceViews()) phrases.push(view);
  for (const name of voicePhrases()) {
    seen.set(name, (seen.get(name) ?? 0) + 1);
  }
  const twice = [...seen].filter(([, n]) => n > 1).map(([name]) => name);
  assert.deepEqual(twice, [], `frases repetidas: ${twice.join(", ")}`);
  assert.ok(phrases.length > 10);
});

// ---------------------------------------------------------------- abrir telas

test("o dono fala a tela e a voz leva até ela, dizendo o que está fazendo", () => {
  const cases = [
    ["pedidos", "pedidos", "Abrindo os pedidos."],
    ["quero ver os pedidos", "pedidos", "Abrindo os pedidos."],
    ["abrir mesa", "mesa", "Abrindo a tela de abrir mesa."],
    ["mesas", "mesas", "Abrindo as mesas."],
    ["entregas", "entregas", "Abrindo as entregas."],
    ["acerto de caixa", "acerto", "Abrindo o acerto de caixa."],
    ["montar o cardápio", "assistente", "Abrindo o assistente do cardápio."],
    ["produtos", "produtos", "Abrindo os produtos."],
    ["categorias", "categorias", "Abrindo as categorias."],
    ["meus números", "dashboard", "Abrindo os números do negócio."],
    ["custos", "custos", "Abrindo os custos."],
    ["pix", "pagamento", "Abrindo o pagamento."],
    ["meu link", "meulink", "Abrindo o seu link."],
    ["horário", "horario", "Abrindo o horário."],
    ["regiões de entrega", "entrega", "Abrindo as regiões de entrega."],
    ["marca", "marca", "Abrindo a marca."],
    ["equipe", "usuarios", "Abrindo a equipe."],
    ["plano", "plano", "Abrindo o plano."],
  ];
  for (const [said, view, say] of cases) {
    assert.deepEqual(ask(said), { kind: "go", view, say }, said);
  }
});

test("maiúscula, acento, pontuação e palavras a mais não atrapalham", () => {
  for (const said of ["PEDIDOS", "Pedidos.", "  pedidos  ", "me mostra os pedidos por favor", "Ôi, abre os pedidos!"]) {
    const answer = ask(said);
    assert.equal(answer.kind, "go", said);
    assert.equal(answer.view, "pedidos", said);
  }
});

test("a frase mais comprida ganha: 'montar cardápio' é o assistente e 'cardápio' é a lista de produtos", () => {
  assert.equal(ask("montar cardápio").view, "assistente");
  assert.equal(ask("cardápio").view, "produtos");
  assert.equal(ask("tirar foto do cardápio").view, "assistente");
  assert.equal(ask("fotos dos pratos").view, "produtos");
  assert.equal(ask("taxa de entrega").view, "entrega");
  assert.equal(ask("entrega").view, "entregas");
  assert.equal(ask("pagar o plano").view, "plano");
  assert.equal(ask("pix para conferir").view, "pedidos");
  assert.equal(ask("vendas de hoje").view, "dashboard");
  assert.equal(ask("pedidos de ajuda", { platformAdmin: true }).view, "ajuda");
  assert.equal(ask("chamados de ajuda", { platformAdmin: true }).view, "ajuda");
});

test("'mesa' abre a tela de abrir mesa; 'mesas' abre as mesas; a cozinha, que não vai à mesa, ouve 'mesas' em vez de recusa", () => {
  assert.equal(ask("mesa").view, "mesa");
  assert.equal(ask("mesas").view, "mesas");
  assert.equal(ask("mesa chamando").view, "mesa");
  assert.equal(ask("chamados").view, "mesa");
  const kitchen = ask("mesa", { role: "KITCHEN" });
  assert.equal(kitchen.kind, "go");
  assert.equal(kitchen.view, "mesas");
});

test("o dono do sistema que fala 'chamados' ouve a mesa; os pedidos de ajuda pedem 'chamados de ajuda'", () => {
  assert.equal(ask("chamados", { platformAdmin: true }).view, "mesa");
  assert.equal(ask("aprovações", { platformAdmin: true }).view, "aprovacoes");
  assert.equal(ask("assinaturas", { platformAdmin: true }).view, "assinaturas");
});

test("as vendas do Vem abrem só para o dono do sistema; 'vendas' sozinho continua sendo os números do negócio", () => {
  for (const phrase of ["vendas do vem", "máquina de vendas", "quem procurar hoje", "conquistar restaurantes", "prospectar"]) {
    const answer = ask(phrase, { platformAdmin: true });
    assert.equal(answer.kind, "go", phrase);
    assert.equal(answer.view, "vendas", phrase);
    assert.equal(answer.say, "Abrindo as vendas do Vem.", phrase);
  }
  // o dono de um restaurante que fala isso não ganha a tela: ouve que não pode abrir...
  const blocked = ask("prospectar", { platformAdmin: false });
  assert.equal(blocked.kind, "stay");
  assert.match(blocked.say, /vendas do Vem/);
  // ...e "vendas do vem" cai na palavra "vendas", que para ele é a tela dos números do negócio dele
  assert.equal(ask("vendas do vem", { platformAdmin: false }).view, "dashboard");
  assert.equal(ask("vendas", { platformAdmin: true }).view, "dashboard");
  assert.equal(ask("vendas de hoje", { platformAdmin: true }).view, "dashboard");
  assert.equal(spokenIn("vendas", "OWNER"), "nas vendas do Vem");
});

test("os números têm o nome de quem olha: o dono vê 'os números do negócio'; o garçom, 'o resumo'", () => {
  assert.equal(ask("números").say, "Abrindo os números do negócio.");
  assert.equal(ask("números", { role: "WAITER" }).say, "Abrindo o resumo.");
  assert.equal(spokenName("pedidos", "KITCHEN"), "a fila da cozinha");
  assert.equal(spokenName("pedidos", "OWNER"), "os pedidos");
  assert.equal(spokenName("não-existe", "OWNER"), "a tela");
  assert.equal(spokenIn("inicio", "OWNER"), "no Hoje");
  assert.equal(spokenIn("entregas", "OWNER"), "nas entregas");
  assert.equal(spokenIn("pedidos", "OWNER"), "nos pedidos");
  assert.equal(spokenIn("marca", "OWNER"), "na marca");
});

// ---------------------------------------------------------------- o que a pessoa não abre

test("tela que o menu não mostra a esta pessoa não abre, e a frase diz isso (nunca silêncio)", () => {
  const waiter = ask("entregas", { role: "WAITER" });
  assert.equal(waiter.kind, "stay");
  assert.match(waiter.say, /Não posso abrir as entregas para você agora/);
  const kitchen = ask("custos", { role: "KITCHEN" });
  assert.equal(kitchen.kind, "stay");
  assert.match(kitchen.say, /Não posso abrir os custos/);
  const cashier = ask("equipe", { role: "CASHIER" });
  assert.equal(cashier.kind, "stay");
  assert.match(cashier.say, /Não posso abrir a equipe/);
  assert.match(ask("aprovações").say, /Não posso abrir as aprovações/);
});

test("restaurante bloqueado por falta de pagamento: só abre o que o menu deixa; o resto é recusa", () => {
  const blocked = { planBlocked: true };
  assert.equal(ask("plano", blocked).kind, "go");
  assert.equal(ask("pedidos", blocked).kind, "go");
  const stay = ask("produtos", blocked);
  assert.equal(stay.kind, "stay");
  assert.match(stay.say, /Não posso abrir os produtos/);
});

test("nunca leva a uma tela fora da lista de telas permitidas", () => {
  const roles = ["OWNER", "MANAGER", "CASHIER", "WAITER", "KITCHEN"];
  for (const role of roles) {
    for (const platformAdmin of [false, true]) {
      for (const planBlocked of [false, true]) {
        const context = ctx({ role, platformAdmin, planBlocked });
        const allowed = allowedViews(context);
        for (const phrase of voicePhrases()) {
          const answer = interpretVoiceNav({ transcript: phrase, role, allowed, current: "inicio" });
          if (answer.kind === "go") {
            assert.ok(allowed.includes(answer.view), `${role} ${phrase} levou a ${answer.view}, que o menu não mostra`);
          }
        }
      }
    }
  }
});

// ---------------------------------------------------------------- já está aqui, ajuda e não entendi

test("quem pede a tela em que já está ouve isso, sem navegar", () => {
  assert.deepEqual(ask("pedidos", {}, "pedidos"), { kind: "stay", say: "Você já está nos pedidos." });
  assert.deepEqual(ask("hoje", {}, "inicio"), { kind: "stay", say: "Você já está no Hoje." });
  assert.deepEqual(ask("mesas", {}, "mesas"), { kind: "stay", say: "Você já está nas mesas." });
  assert.deepEqual(ask("marca", {}, "marca"), { kind: "stay", say: "Você já está na marca." });
  assert.deepEqual(ask("pedidos", { role: "KITCHEN" }, "pedidos"), { kind: "stay", say: "Você já está na fila da cozinha." });
});

test("pedir ajuda diz o que se pode falar, com as telas desta pessoa", () => {
  const owner = ask("ajuda");
  assert.equal(owner.kind, "stay");
  assert.match(owner.say, /^Você pode dizer: pedidos, abrir mesa ou mesas\./);
  assert.match(owner.say, /toque no menu/);
  const kitchen = ask("o que posso falar", { role: "KITCHEN" });
  assert.equal(kitchen.kind, "stay");
  assert.doesNotMatch(kitchen.say, /entregas|acerto/);
  // Ajuda que aparece junto de uma tela vale a tela.
  assert.equal(ask("me ajuda com os pedidos").kind, "go");
});

test("o que não foi entendido vira uma frase com exemplos reais, nunca um palpite", () => {
  for (const said of ["blá blá", "", "   ", "uma banana", "sair"]) {
    const answer = ask(said);
    assert.equal(answer.kind, "unknown", said);
    assert.match(answer.say, /^Não entendi\. Diga, por exemplo: /, said);
  }
  assert.equal(ask("pedidos").kind, "go");
});

test("os exemplos são só de telas que a pessoa abre, nunca a tela em que já está, no máximo três", () => {
  assert.equal(examplesFor(["inicio", "pedidos", "mesa", "mesas", "entregas"], "inicio"), "pedidos, abrir mesa ou mesas");
  assert.equal(examplesFor(["inicio", "pedidos", "mesa", "mesas", "entregas"], "pedidos"), "abrir mesa, mesas ou entregas");
  assert.equal(examplesFor(["inicio", "pedidos"], "inicio"), "pedidos");
  assert.equal(examplesFor(["inicio"], "inicio"), "");
  assert.equal(examplesFor([], "inicio"), "");
  // Sem exemplo nenhum, a frase manda ao menu em vez de terminar em "por exemplo: .".
  const none = interpretVoiceNav({ transcript: "blá", role: "OWNER", allowed: ["inicio"], current: "inicio" });
  assert.equal(none.kind, "unknown");
  assert.doesNotMatch(none.say, /por exemplo/);
  assert.match(none.say, /menu/);
});

test("a voz só abre telas e lê o dia: nenhuma resposta cria, muda ou apaga alguma coisa", () => {
  const shapes = { go: ["kind", "say", "view"], stay: ["kind", "say"], unknown: ["kind", "say"], brief: ["kind"] };
  for (const phrase of voicePhrases()) {
    const answer = ask(phrase, { platformAdmin: true });
    assert.ok(Object.keys(shapes).includes(answer.kind), phrase);
    assert.deepEqual(Object.keys(answer).sort(), shapes[answer.kind], phrase);
  }
});

// ---------------------------------------------------------------- "como está o dia?"

test("perguntar como está o dia pede a leitura dos números, sem abrir tela", () => {
  for (const said of [
    "como está o dia",
    "Como está o dia?",
    "como estamos hoje",
    "me dá um resumo",
    "resumo do dia",
    "me atualiza",
    "novidades",
    "quantos pedidos tem",
    "tem pedido?",
    "quanto vendi hoje",
    "quanto eu já vendi",
    "como estão as vendas",
  ]) {
    assert.deepEqual(ask(said), { kind: "brief" }, said);
  }
});

test("ler o dia vale para toda função do painel, mesmo para quem não abre os números", () => {
  for (const role of ["OWNER", "MANAGER", "CASHIER", "WAITER", "KITCHEN"]) {
    assert.deepEqual(ask("como está o dia", { role }), { kind: "brief" }, role);
  }
});

test("a frase mais comprida decide entre ler e abrir: 'resumo do dia' lê; 'resumo' e 'vendas de hoje' abrem os números; 'pedidos' abre os pedidos", () => {
  assert.equal(ask("resumo do dia").kind, "brief");
  assert.equal(ask("resumo").view, "dashboard");
  assert.equal(ask("vendas de hoje").view, "dashboard");
  assert.equal(ask("pedidos").view, "pedidos");
  assert.equal(ask("quantos pedidos").kind, "brief");
  assert.equal(ask("o que falta", {}, "pedidos").view, "inicio");
  // Ajuda junto da pergunta: vale a pergunta, que é a frase mais comprida.
  assert.equal(ask("me ajuda, como está o dia").kind, "brief");
  assert.equal(ask("ajuda").kind, "stay");
});

test("a resposta fica na tela o tempo de ler: no mínimo 8 s e no máximo 20 s", () => {
  assert.equal(captionMs(""), 8000);
  assert.equal(captionMs("Abrindo os pedidos."), 8000);
  assert.equal(captionMs("x".repeat(150)), 10500);
  assert.equal(captionMs("x".repeat(1000)), 20000);
});

// ---------------------------------------------------------------- a ligação (o que o microfone de teste da conferência de imagem também prova)

const read = (path) => readFileSync(new URL(`../../frontend/src/${path}`, import.meta.url), "utf8");

test("a casca liga a voz uma vez para todas as telas, e a moldura das telas antigas também tem a bolinha", () => {
  const shell = read("painel/PanelShell.tsx");
  assert.match(shell, /useVoiceNav\(\{\n\s+role,\n\s+allowed: allowedViews\(context\),\n\s+current: shown,\n\s+onGo: go,/);
  assert.match(shell, /<VoiceContext\.Provider value=\{voiceControl\}>/);
  // Com o menu aberto a faixa não fica por cima dele.
  assert.match(shell, /voice\.caption && !menuOpen/);
  assert.match(read("novo/LegacyFrame.tsx"), /<VoiceOrb label="Falar com o Vem" \/>/);
});

test("o microfone só abre depois do toque, e sair do painel o corta", () => {
  const hook = read("painel/useVoiceNav.ts");
  assert.match(hook, /stopSpeaking\(\);\n    const phrase = phraser\(\);\n    if \(!canListen\(\)\)/, "o painel não fala por cima da pessoa");
  assert.match(hook, /hearing\.current\?\.cancel\(\);\n      hearing\.current = null;\n      stopSpeaking\(\);/, "sair do painel corta o microfone e a fala");
  assert.doesNotMatch(hook, /useEffect\([^)]*\bhear\(/, "nada escuta por conta própria");
  // A resposta é só frase e navegação: o hook não chama o servidor.
  assert.doesNotMatch(hook, /service\/api|fetch\(/);
});

test("a peça visual da resposta é só props, avisa o leitor de tela e tem botão de fechar de 44 px", () => {
  const bubble = read("novo/VoiceBubble.tsx");
  assert.match(bubble, /role="status" aria-live="polite"/);
  assert.doesNotMatch(bubble, /from "\.\.\//);
  assert.doesNotMatch(read("novo/voice.ts"), /from "\.\.\//);
  const css = read("novo/novo.css");
  assert.match(css.match(/\.nv-voice-close \{[^}]*\}/)[0], /min-height: 44px/);
  assert.match(css.match(/\.nv-root\.nv-voice \{[^}]*\}/)[0], /position: fixed/);
});
