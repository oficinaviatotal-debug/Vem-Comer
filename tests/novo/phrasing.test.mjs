import test from "node:test";
import assert from "node:assert/strict";

import { briefOf } from "../../frontend/src/hoje/briefLogic.ts";
import { menuViews } from "../../frontend/src/nav/navLogic.ts";
import {
  DEFAULT_AFTER,
  FORGET_DAYS,
  bank,
  createPhraser,
  memoryStore,
  momentOf,
  plainPhraser,
  webStore,
} from "../../frontend/src/novo/phrasing.ts";
import { ALL_BANKS, PHRASES_REVIEWED, noSalesBankFor, salesBankFor } from "../../frontend/src/novo/voiceCopy.ts";
import { allowedViews } from "../../frontend/src/painel/shellLogic.ts";
import { interpretVoiceNav, spokenIn, spokenName } from "../../frontend/src/painel/voiceNavLogic.ts";

/** Sorteio repetível (para o teste mandar no "acaso"). */
function seeded(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const four = bank("teste.quatro", { full: ["a", "b", "c", "d"] });

// ---------------------------------------------------------------- o motor: não repete

test("nenhuma frase sai duas vezes seguidas, e todas passam antes de qualquer uma voltar", () => {
  for (let seed = 1; seed <= 60; seed += 1) {
    const phrase = createPhraser({ rand: seeded(seed) });
    const said = Array.from({ length: 80 }, () => phrase.say(four));
    for (let i = 1; i < said.length; i += 1) assert.notEqual(said[i], said[i - 1], `seed ${seed}: repetiu na vez ${i}`);
    // A sacola: cada bloco de 4 tem as 4 formas, sem faltar nenhuma.
    for (let start = 0; start < said.length; start += 4) {
      assert.deepEqual([...said.slice(start, start + 4)].sort(), ["a", "b", "c", "d"], `seed ${seed}: bloco ${start / 4}`);
    }
  }
});

test("com duas formas elas se alternam; com uma só, ela é a única", () => {
  const two = bank("teste.duas", { full: ["x", "y"] });
  const phrase = createPhraser({ rand: seeded(7) });
  const said = Array.from({ length: 10 }, () => phrase.say(two));
  for (let i = 1; i < said.length; i += 1) assert.notEqual(said[i], said[i - 1]);
  const one = bank("teste.uma", { full: ["só esta"] });
  assert.deepEqual(Array.from({ length: 5 }, () => phrase.say(one)), Array(5).fill("só esta"));
});

test("a forma pode ser uma conta que recebe os dados da hora", () => {
  const sum = bank("teste.conta", { full: [(a, b) => `${a} e ${b}`] });
  assert.equal(createPhraser().say(sum, "um", "dois"), "um e dois");
});

// ---------------------------------------------------------------- o motor: encurta com o uso

const teaching = bank("teste.aprender", { full: ["A1", "A2", "A3"], short: ["B1", "B2"] });

test("depois de ouvir a explicação completa algumas vezes, vale a forma curta", () => {
  const phrase = createPhraser({ rand: seeded(3) });
  const first = Array.from({ length: DEFAULT_AFTER }, () => phrase.say(teaching));
  assert.ok(first.every((text) => text.startsWith("A")), `as primeiras vezes são completas: ${first}`);
  const later = Array.from({ length: 6 }, () => phrase.say(teaching));
  assert.ok(later.every((text) => text.startsWith("B")), `depois são curtas: ${later}`);
  for (let i = 1; i < later.length; i += 1) assert.notEqual(later[i], later[i - 1]);
});

test("o 'depois de quantas vezes' pode ser ajustado e lista curta vazia cala a frase", () => {
  const quick = bank("teste.rapido", { full: ["longa"], short: ["curta"], after: 1 });
  const phrase = createPhraser();
  assert.deepEqual([phrase.say(quick), phrase.say(quick), phrase.say(quick)], ["longa", "curta", "curta"]);
  const hint = bank("teste.dica", { full: ["Diga pedidos."], short: [] });
  const other = createPhraser();
  assert.deepEqual(
    Array.from({ length: DEFAULT_AFTER + 2 }, () => other.say(hint)),
    ["Diga pedidos.", "Diga pedidos.", "Diga pedidos.", "", ""],
  );
});

test("quem não passa o falador ouve sempre a forma de referência, sem contar nada", () => {
  assert.equal(plainPhraser.say(teaching), "A1");
  assert.equal(plainPhraser.say(teaching), "A1");
  assert.equal(plainPhraser.say(bank("t.f", { full: [(n) => `n=${n}`] }), 4), "n=4");
  assert.deepEqual(plainPhraser.window("x", [1, 2, 3, 4], 3), [1, 2, 3]);
});

test("cada situação conta sozinha (explicar uma não encurta a outra)", () => {
  const phrase = createPhraser({ store: memoryStore() });
  for (let i = 0; i < 5; i += 1) phrase.say(teaching);
  const other = bank("teste.outra", { full: ["O1"], short: ["O2"] });
  assert.equal(phrase.say(other), "O1");
});

// ---------------------------------------------------------------- o contador no celular

function fakeStorage() {
  const data = new Map();
  return { getItem: (key) => (data.has(key) ? data.get(key) : null), setItem: (key, value) => void data.set(key, String(value)), data };
}

test("a contagem fica no celular: ao reabrir o painel a pessoa não ouve a explicação de novo", () => {
  const storage = fakeStorage();
  const day = 20000 * 86400000;
  const one = createPhraser({ rand: seeded(1), store: webStore(storage, () => day) });
  for (let i = 0; i < DEFAULT_AFTER; i += 1) one.say(teaching);
  const reopened = createPhraser({ rand: seeded(2), store: webStore(storage, () => day + 86400000) });
  assert.ok(reopened.say(teaching).startsWith("B"));
  // Só números e um dia: nada do restaurante vai para o celular.
  const saved = JSON.parse(storage.data.get("vem.frases.v1"));
  assert.deepEqual(Object.keys(saved), ["teste.aprender"]);
  assert.ok(saved["teste.aprender"].every((value) => typeof value === "number"));
});

test("depois de semanas sem ouvir, a explicação completa volta", () => {
  const storage = fakeStorage();
  const start = 20000 * 86400000;
  const early = createPhraser({ store: webStore(storage, () => start) });
  for (let i = 0; i < 5; i += 1) early.say(teaching);
  const soon = createPhraser({ store: webStore(storage, () => start + FORGET_DAYS * 86400000) });
  assert.ok(soon.say(teaching).startsWith("B"), "no limite ainda lembra");
  const lateStorage = fakeStorage();
  const before = createPhraser({ store: webStore(lateStorage, () => start) });
  for (let i = 0; i < 5; i += 1) before.say(teaching);
  const after = createPhraser({ store: webStore(lateStorage, () => start + (FORGET_DAYS + 1) * 86400000) });
  assert.ok(after.say(teaching).startsWith("A"), "passou do prazo: explica de novo");
});

test("celular que não deixa guardar, guardado quebrado ou sem armazenamento não derruba a fala", () => {
  const broken = { getItem: () => { throw new Error("bloqueado"); }, setItem: () => { throw new Error("cheio"); } };
  const phrase = createPhraser({ store: webStore(broken) });
  for (let i = 0; i < DEFAULT_AFTER; i += 1) assert.ok(phrase.say(teaching).startsWith("A"));
  assert.ok(phrase.say(teaching).startsWith("B"), "sem onde guardar, conta só na memória");
  for (const junk of ["{não é json", "[1,2]", "null", '{"teste.aprender":"x"}', '{"teste.aprender":[null,1]}', '"texto"']) {
    const storage = { getItem: () => junk, setItem: () => {} };
    assert.ok(createPhraser({ store: webStore(storage) }).say(teaching).startsWith("A"), junk);
  }
  assert.ok(createPhraser({ store: webStore(null) }).say(teaching).startsWith("A"));
});

// ---------------------------------------------------------------- a janela dos exemplos

test("os exemplos andam pela lista a cada vez, sem inventar nenhum", () => {
  const phrase = createPhraser();
  const items = ["a", "b", "c", "d", "e"];
  assert.deepEqual(phrase.window("x", items, 3), ["a", "b", "c"]);
  assert.deepEqual(phrase.window("x", items, 3), ["d", "e", "a"]);
  assert.deepEqual(phrase.window("x", items, 3), ["b", "c", "d"]);
  assert.deepEqual(phrase.window("y", items, 3), ["a", "b", "c"], "cada lista anda sozinha");
  assert.deepEqual(phrase.window("z", ["só"], 3), ["só"]);
  assert.deepEqual(phrase.window("z", [], 3), []);
  assert.deepEqual(phrase.window("z", items, 0), []);
});

// ---------------------------------------------------------------- hora do dia

test("a manhã, a tarde e a noite seguem o mesmo corte do 'Bom dia / Boa tarde / Boa noite'", () => {
  assert.deepEqual([0, 4, 5, 11, 12, 17, 18, 23].map(momentOf), ["noite", "noite", "manha", "manha", "tarde", "tarde", "noite", "noite"]);
});

// ---------------------------------------------------------------- o banco de frases

const JARGON = /\b(dashboard|checkout|onboarding|template|upload|click here|app|login|loading|feedback)\b/i;
const forms = (spec) => [...spec.full, ...(spec.short ?? [])];
const text = (variant, args) => (typeof variant === "function" ? variant(...args) : variant);

test("o banco tem formas de sobra e todas são bem escritas", () => {
  assert.ok(ALL_BANKS.length >= 20);
  const ids = new Set();
  for (const { bank: spec, samples } of ALL_BANKS) {
    assert.ok(!ids.has(spec.id), `id repetido: ${spec.id}`);
    ids.add(spec.id);
    assert.ok(spec.full.length >= 3, `${spec.id}: poucas formas para variar`);
    for (const sample of samples) {
      const rendered = forms(spec).map((variant) => text(variant, sample));
      // Dentro da lista completa e dentro da curta não pode haver forma repetida (a curta pode reaproveitar as da completa).
      for (const list of [spec.full, spec.short ?? []]) {
        const lines = list.map((variant) => text(variant, sample).toLowerCase());
        assert.equal(new Set(lines).size, lines.length, `${spec.id}: formas repetidas ${JSON.stringify(sample)}`);
      }
      for (const line of rendered) {
        const where = `${spec.id} ${JSON.stringify(sample)}: "${line}"`;
        assert.ok(line.length > 0 && line === line.trim(), `vazia ou com espaço nas pontas — ${where}`);
        assert.ok(!/ {2,}/.test(line), `espaço duplo — ${where}`);
        assert.ok(/[.?…]$/.test(line), `não termina em ponto — ${where}`);
        assert.ok(line.length <= 160, `comprida demais para ouvir — ${where}`);
        assert.ok(!/undefined|NaN|null|\[object/.test(line), `dado faltando — ${where}`);
        assert.ok(!JARGON.test(line), `palavra difícil — ${where}`);
        assert.ok(!/!/.test(line), `grito — ${where}`);
        assert.ok(/^[A-ZÁÂÃÀÉÊÍÓÔÕÚÇ0-9]/.test(line), `não começa em maiúscula — ${where}`);
        assert.ok(!/\b(em|de) (o|a|os|as) /.test(line), `contração faltando — ${where}`);
      }
    }
    if (spec.short && spec.short.length > 0) {
      const sample = samples[0];
      const mean = (list) => list.reduce((sum, line) => sum + line.length, 0) / list.length;
      assert.ok(mean(spec.short.map((v) => text(v, sample))) < mean(spec.full.map((v) => text(v, sample))), `${spec.id}: a curta não é mais curta`);
    }
  }
});

test("toda forma diz os mesmos fatos: os números e o tempo aparecem em todas", () => {
  const byId = (id) => ALL_BANKS.find((entry) => entry.bank.id === id).bank;
  for (const [id, args, needles] of [
    ["dia.esperando", [3, "12 minutos"], ["3", "12 minutos"]],
    ["dia.esperando", [1, "1 minuto"], ["1", "1 minuto"]],
    ["dia.atrasado", [4, "1 hora e 5 minutos"], ["4", "1 hora e 5 minutos"]],
    ["dia.atrasado", [1, "25 minutos"], ["25 minutos"]],
    ["dia.cozinha", [5], ["5"]],
    ["dia.cozinha", [1], ["1"]],
    ["dia.a-caminho", [2], ["2"]],
    ["dia.vendas.manha", ["R$ 1.284,50", 38], ["R$ 1.284,50", "38"]],
    ["dia.vendas.tarde", ["R$ 42,50", 1], ["R$ 42,50", "1 pedido"]],
    ["dia.vendas.noite", ["R$ 42,50", 2], ["R$ 42,50", "2 pedidos"]],
    ["voz.abrindo", ["os pedidos"], ["os pedidos"]],
    ["voz.ja-aqui", ["nas mesas"], ["nas mesas"]],
    ["voz.nao-pode", ["os custos"], ["os custos"]],
    ["voz.nao-entendi", ["pedidos, mesas ou abrir mesa"], ["pedidos, mesas ou abrir mesa"]],
    ["voz.ajuda", ["pedidos, mesas ou abrir mesa"], ["pedidos, mesas ou abrir mesa"]],
  ]) {
    for (const variant of forms(byId(id))) {
      const line = text(variant, args);
      for (const needle of needles) assert.ok(line.includes(needle), `${id} ${JSON.stringify(args)}: "${line}" não diz "${needle}"`);
    }
  }
  // Singular e plural certos em todas as formas.
  for (const variant of byId("dia.esperando").full) assert.doesNotMatch(text(variant, [1, "2 minutos"]), /1 pedidos/);
  for (const variant of byId("dia.atrasado").full) assert.doesNotMatch(text(variant, [1, "25 minutos"]), /1 pedidos/);
  for (const variant of byId("dia.vendas.manha").full) assert.doesNotMatch(text(variant, ["R$ 1,00", 1]), /1 pedidos/);
});

test("a hora do dia muda o jeito de dizer as vendas, mas o 'ainda sem vendas' nunca promete nada", () => {
  const morning = salesBankFor("manha").full.map((v) => text(v, ["R$ 10,00", 1]));
  const night = salesBankFor("noite").full.map((v) => text(v, ["R$ 10,00", 1]));
  assert.ok(morning.some((line) => line.startsWith("Até agora,")));
  assert.ok(!night.some((line) => line.startsWith("Até agora,")));
  assert.ok(night.some((line) => line.startsWith("No dia,")));
  for (const moment of ["manha", "tarde", "noite"]) {
    for (const variant of noSalesBankFor(moment).full) assert.match(text(variant, []), /sem vendas|não teve venda|ainda não teve|Nenhuma venda/i);
  }
});

test("as frases têm data de revisão, e não é uma data futura", () => {
  assert.match(PHRASES_REVIEWED, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Date.parse(PHRASES_REVIEWED) <= Date.now() + 86400000);
  assert.ok(Date.parse(PHRASES_REVIEWED) >= Date.parse("2026-10-23"));
});

test("as palavras de tela entram certas em todas as formas (nada de 'em os', 'de o')", () => {
  const spec = (id) => ALL_BANKS.find((entry) => entry.bank.id === id).bank;
  for (const role of ["OWNER", "MANAGER", "CASHIER", "WAITER", "KITCHEN", "COURIER"]) {
    for (const view of menuViews(role)) {
      const name = spokenName(view, role);
      const inside = spokenIn(view, role);
      for (const line of [
        ...forms(spec("voz.abrindo")).map((v) => text(v, [name])),
        ...forms(spec("voz.nao-pode")).map((v) => text(v, [name])),
        ...forms(spec("voz.ja-aqui")).map((v) => text(v, [inside])),
      ]) {
        assert.doesNotMatch(line, /\b(em|de|por) (o|a|os|as) /, `${role}/${view}: ${line}`);
        assert.ok(!/undefined/.test(line));
      }
    }
  }
});

// ---------------------------------------------------------------- a bolinha de voz com o falador de verdade

const owner = { role: "OWNER", planBlocked: false, hasPlanTab: true, platformAdmin: false };
const askWith = (phrase, transcript, current = "inicio") =>
  interpretVoiceNav({ transcript, role: owner.role, allowed: allowedViews(owner), current, phrase });

test("pedir a mesma tela várias vezes não repete a mesma resposta", () => {
  const phrase = createPhraser({ rand: seeded(11) });
  const said = Array.from({ length: 12 }, (_, i) => askWith(phrase, "pedidos", i % 2 === 0 ? "inicio" : "mesas").say);
  for (let i = 1; i < said.length; i += 1) assert.notEqual(said[i], said[i - 1]);
  assert.ok(new Set(said).size >= 4, `pouca variedade: ${[...new Set(said)]}`);
  assert.ok(said.every((line) => /pedidos/.test(line) && !/em os/.test(line)));
});

test("o 'não entendi' varia, dá exemplos diferentes e fica mais curto depois de algumas vezes", () => {
  const phrase = createPhraser({ rand: seeded(5) });
  const answers = Array.from({ length: 8 }, () => askWith(phrase, "bla bla bla"));
  assert.ok(answers.every((answer) => answer.kind === "unknown"));
  const lines = answers.map((answer) => answer.say);
  for (let i = 1; i < lines.length; i += 1) assert.notEqual(lines[i], lines[i - 1]);
  const examples = new Set(lines.map((line) => line.replace(/^[^:]*[:] ?/, "").replace(/[.?]$/, "")));
  assert.ok(examples.size >= 3, `os exemplos tinham de andar: ${[...examples]}`);
  for (const line of lines.slice(0, DEFAULT_AFTER)) assert.ok(line.length > 30);
  for (const line of lines.slice(DEFAULT_AFTER)) assert.match(line, /^Não (entendi|peguei)\. (Tente|Diga|Por exemplo): /);
});

test("pedir ajuda não gasta a lista de exemplos à toa quando a resposta nem usa exemplos", () => {
  const phrase = createPhraser({ rand: seeded(9) });
  const first = askWith(phrase, "pedidos").say;
  assert.match(first, /pedidos/);
  // Abrir uma tela não consumiu a janela: o primeiro "não entendi" ainda começa pelos primeiros exemplos.
  assert.match(askWith(phrase, "bla").say, /pedidos, abrir mesa ou mesas/);
});

// ---------------------------------------------------------------- o resumo do dia com o falador de verdade

const NOW = Date.parse("2026-10-23T12:00:00.000Z"); // sexta, 09h em Brasília
const ago = (minutes) => new Date(NOW - minutes * 60000).toISOString();
const waiting = (minutes) => ({ status: "PENDING_PAYMENT", created_at: ago(minutes), order_type: "mesa", payment_method: "dinheiro", payment_status: "PENDING", total_price: 30 });
const cooking = (minutes) => ({ ...waiting(minutes), status: "em preparo" });
const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, revenue: 0 }));
const sales = (revenue = 1284.5, orders = 38) => ({ summary: { revenue, orders, avg_ticket: 33.8, dishes: 60, delivery_fees: 0 }, hours });
// O dinheiro vem com espaço "sem quebra" (R$ 1.284,50); aqui tudo vira espaço comum para comparar.
const brief = (extra = {}) =>
  briefOf({ name: "João Silva", role: "OWNER", orders: [], calls: [], business: sales(), now: NOW, ...extra }).replace(/\s/g, " ");

test("o resumo do dia muda de jeito a cada vez, mas os fatos são sempre os mesmos", () => {
  const phrase = createPhraser({ rand: seeded(21) });
  const input = { orders: [waiting(5), waiting(9), cooking(12)], phrase };
  const said = Array.from({ length: 40 }, () => brief(input));
  for (let i = 1; i < said.length; i += 1) assert.notEqual(said[i], said[i - 1], `repetiu o resumo inteiro na vez ${i}`);
  assert.ok(new Set(said).size >= 8, `pouca variedade: ${new Set(said).size}`);
  for (const line of said) {
    assert.match(line, /^Bom dia, João\./);
    assert.match(line, /\b2\b.*\b9 minutos\b/s);
    assert.match(line, /R\$ 1\.284,50/);
    assert.match(line, /\b38\b/);
    assert.match(line, /\b1\b.*cozinha|cozinha.*\b1\b/s);
    assert.doesNotMatch(line, /undefined|NaN/);
  }
});

test("sem o falador o resumo é o de sempre, palavra por palavra", () => {
  assert.equal(
    brief({ orders: [waiting(3)], calls: [] }),
    "Bom dia, João. 1 pedido esperando, o mais antigo há 3 minutos. Vendas de hoje: R$ 1.284,50 em 38 pedidos.",
  );
});

test("pedido esperando há 20 minutos ou mais puxa a atenção; antes disso só conta", () => {
  assert.match(brief({ orders: [waiting(19)] }), /^Bom dia, João\. 1 pedido esperando, o mais antigo há 19 minutos\./);
  assert.match(brief({ orders: [waiting(20)] }), /^Bom dia, João\. Atenção: 1 pedido esperando, o mais antigo há 20 minutos\./);
  assert.match(brief({ orders: [waiting(25), waiting(3)] }), /Atenção: 2 pedidos esperando, o mais antigo há 25 minutos\./);
  assert.match(brief({ orders: [waiting(65)] }), /o mais antigo há 1 hora e 5 minutos\./);
  const phrase = createPhraser({ rand: seeded(4) });
  for (let i = 0; i < 9; i += 1) {
    const line = brief({ orders: [waiting(30), waiting(2), waiting(2)], phrase });
    assert.match(line, /\b3\b.*\b30 minutos\b/s);
    assert.doesNotMatch(line, /undefined|NaN/);
  }
});

test("a dica 'diga pedidos' só vem quando há pedido esperando, a pessoa abre pedidos e ainda está aprendendo", () => {
  const withHint = brief({ orders: [waiting(3)], canOpenOrders: true });
  assert.match(withHint, /Para abrir, diga pedidos\.$/);
  assert.doesNotMatch(brief({ orders: [waiting(3)] }), /diga pedidos/i, "quem não abre pedidos não ouve a dica");
  assert.doesNotMatch(brief({ orders: [], canOpenOrders: true }), /diga pedidos/i, "sem pedido esperando não há o que abrir");
  assert.doesNotMatch(brief({ orders: null, canOpenOrders: true }), /diga pedidos/i, "pedido que não carregou não vira convite");
  const phrase = createPhraser({ rand: seeded(8) });
  const lines = Array.from({ length: 6 }, () => brief({ orders: [waiting(3)], canOpenOrders: true, phrase }));
  assert.ok(lines.slice(0, DEFAULT_AFTER).every((line) => /(diga pedidos|Diga pedidos)/.test(line)), "nas primeiras vezes sugere");
  assert.ok(lines.slice(DEFAULT_AFTER).every((line) => !/diga pedidos/i.test(line)), "depois de aprender, cala");
});

test("a saudação não perde o nome nem a hora do dia, mesmo mudando de forma", () => {
  const phrase = createPhraser({ rand: seeded(13) });
  for (let i = 0; i < 12; i += 1) assert.match(brief({ phrase, name: "Ana" }), /^Bom dia, Ana\./);
  const night = Date.parse("2026-10-24T01:30:00.000Z"); // sexta, 22h30 em Brasília
  for (let i = 0; i < 12; i += 1) assert.match(brief({ phrase, name: null, now: night }), /^Boa noite\./);
  const weekdays = Array.from({ length: 24 }, () => brief({ phrase }));
  assert.ok(weekdays.some((line) => line.includes("Hoje é sexta-feira.")), "o dia da semana sai certo (sexta, 23/10/2026)");
});

test("busca que falhou continua dizendo que falhou, em qualquer forma", () => {
  const phrase = createPhraser({ rand: seeded(17) });
  for (let i = 0; i < 12; i += 1) {
    const line = brief({ phrase, orders: null, calls: null, business: null });
    assert.match(line, /pedidos/);
    assert.doesNotMatch(line, /Nenhum pedido|Nada esperando|Fila de pedidos vazia|esperando/);
    assert.match(line, /Não consegui|não carregaram/i);
    assert.doesNotMatch(line, /Ainda sem vendas|Vendas de hoje|Nenhuma venda|não teve venda/);
  }
});
