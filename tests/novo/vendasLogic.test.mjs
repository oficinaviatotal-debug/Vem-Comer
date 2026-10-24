/**
 * Vendas (o painel do dono do sistema): o rascunho de cada negócio, a lista de hoje, quem espera resposta, o funil e o
 * formulário de anotar um negócio. Roda no Node, sem navegador.
 *
 * O que este teste guarda é a regra do caderno de vendas: **todo rascunho diz quem fala (Vem Tecnologia), de onde veio o
 * contato e como parar**, e nenhum promete preço, desconto, garantia nem pressa. Nada aqui manda mensagem.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { createPhraser, memoryStore, plainPhraser } from "../../frontend/src/novo/phrasing.ts";
import * as copy from "../../frontend/src/novo/vendasCopy.ts";
import { PHRASES_REVIEWED } from "../../frontend/src/novo/voiceCopy.ts";
import {
  CHANNEL_LABELS,
  KIND_CHOICES,
  REPLY_CHOICES,
  REPLY_IDS,
  SOURCE_CHOICES,
  anotherDraft,
  applyRead,
  canMove,
  cardOf,
  channelOf,
  channelOptions,
  cleanSender,
  contactLine,
  copyTextOf,
  draftKey,
  draftOf,
  emptyForm,
  firstName,
  formProblem,
  formViewOf,
  funnelOf,
  hasDraft,
  openHref,
  originLine,
  salesViewOf,
  savedText,
  sendLabel,
  stageChoices,
  stageSaid,
  subOf,
  toNewProspect,
  whenText,
} from "../../frontend/src/painel/vendasLogic.ts";

function seeded(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const LINK = "https://vem.example/?sistema=1";
/** Terça-feira, 20/10/2026, 14h30 em Brasília (17h30 em UTC). */
const NOW = new Date("2026-10-20T17:30:00Z");

const JARGON = /\b(dashboard|checkout|onboarding|template|upload|click here|app|login|loading|feedback|lead|funil de vendas|crm)\b/i;
/** O que o Vem não promete em mensagem a dono de restaurante. */
const PROMISES =
  /\b(desconto|promo\w*|grátis|gratis|gratuito|garanti\w*|melhor|única|único|última|últimas|urgente|oferta|vagas|corra|aproveite|preço|preco|valor|mensalidade|lucro|dobrar|aumentar|milagre|sem risco|sem compromisso)\b|R\$/i;

const prospect = (over = {}) => ({
  id: "p1",
  business_name: "Pastelaria do Zé",
  kind: "pastelaria",
  kind_label: "Pastelaria",
  city: "Natal",
  neighborhood: null,
  contact_person: null,
  phone: "(84) 99999-8888",
  whatsapp: "5584999998888",
  email: null,
  instagram: null,
  site: null,
  source: "anuncio_publico",
  source_label: "Anúncio público",
  source_note: "Anúncio no Instagram em 20/10",
  note: null,
  stage: "achado",
  stage_label: "Achado",
  days_in_stage: 1,
  touches: 0,
  channels: ["whatsapp", "ligacao"],
  last_channel: null,
  reply_kind: null,
  window: "14h às 17h",
  good_time: true,
  ...over,
  move: { action: "primeiro_contato", reason: "Ainda não foi procurado.", channel: "whatsapp", due: null, tags: [], ...(over.move ?? {}) },
});

const SOURCES = ["anuncio_publico", "site_da_empresa", "indicacao", "parceiro", "pedido_do_contato", "visita", "formulario_do_site"];
const text = (variant, args) => (typeof variant === "function" ? variant(...args) : variant);

// ---------------------------------------------------------------- a escrita de cada forma

test("toda forma de dizer é bem escrita: simples, sem grito, sem promessa, sem palavra difícil", () => {
  assert.ok(copy.SALES_BANKS.length >= 25);
  for (const { bank, samples } of copy.SALES_BANKS) {
    assert.ok(bank.full.length >= 2, `${bank.id}: poucas formas`);
    for (const [index, variant] of bank.full.entries()) {
      for (const args of samples) {
        const line = text(variant, args);
        const where = `${bank.id}[${index}]: ${line}`;
        assert.ok(line.trim().length > 2, `vazia — ${where}`);
        assert.ok(line.length <= 260, `comprida — ${where}`);
        assert.ok(!line.includes("!"), `grito — ${where}`);
        assert.ok(!PROMISES.test(line), `promessa que o Vem não faz — ${where}`);
        assert.ok(!JARGON.test(line), `palavra difícil — ${where}`);
        assert.ok(/[.?]$/.test(line.trim()) || /^(Re|Vem Comer|Cardápio|Sobre|Retomando|Resposta)/.test(line), `sem ponto final — ${where}`);
      }
    }
  }
});

test("as formas de uma mesma situação dizem a mesma coisa: quem fala, e o 'NÃO' para parar", () => {
  for (const variant of copy.SALES_SAY_STOP.full) assert.match(text(variant, []), /\bNÃO\b/);
  for (const variant of copy.SALES_SAY_STOP_EMAIL.full) assert.match(text(variant, []), /\bNÃO\b/);
  for (const variant of copy.SALES_SAY_WHO.full) assert.match(text(variant, ["Carlos"]), /Carlos.*Vem Tecnologia|Vem Tecnologia.*Carlos/);
  for (const variant of copy.SALES_SAY_WHO_NO_NAME.full) assert.match(text(variant, []), /Vem Tecnologia/);
});

test("há uma forma de dizer a origem para cada origem do caderno do servidor", () => {
  for (const source of SOURCES) {
    assert.ok(copy.SALES_SAY_ORIGIN[source], source);
    for (const variant of copy.SALES_SAY_ORIGIN[source].full) assert.match(text(variant, ["Pastelaria do Zé"]), /Pastelaria do Zé/);
  }
  // as origens que a pessoa escolhe no formulário são as do servidor, menos o formulário do site (só o próprio formulário cria)
  const choices = SOURCE_CHOICES.map((choice) => choice.id);
  assert.ok(choices.every((id) => SOURCES.includes(id)));
  assert.ok(!choices.includes("formulario_do_site"));
  assert.equal(new Set(choices).size, choices.length);
});

test("os textos da tela são em português simples, sem palavra difícil nem inglês solto", () => {
  const strings = Object.entries(copy)
    .filter(([name, value]) => name.startsWith("SALES_") && !name.startsWith("SALES_SAY_") && name !== "SALES_BANKS")
    .map(([name, value]) => [name, typeof value === "function" ? (value.length === 1 ? value(2) : value.length === 2 ? value("motivo", "amanhã") : value("a", "b", "c")) : value]);
  assert.ok(strings.length > 60);
  for (const [name, value] of strings) {
    if (typeof value !== "string") continue;
    assert.ok(!JARGON.test(value), `${name}: ${value}`);
    assert.ok(!/R\$/.test(value), `${name}: sem preço`);
  }
});

test("a data da última revisão das frases é a mesma que vale para as da voz", () => {
  assert.match(PHRASES_REVIEWED, /^\d{4}-\d{2}-\d{2}$/);
});

// ---------------------------------------------------------------- quem assina

test("o nome de quem assina é o primeiro nome, limpo", () => {
  assert.equal(firstName("Maria, dono"), "Maria");
  assert.equal(firstName("João Silva"), "João");
  assert.equal(firstName("Dona Maria Souza"), "Dona Maria");
  assert.equal(firstName("Seu João da Padaria"), "Seu João");
  assert.equal(firstName("Dr. Paulo Lima"), "Dr. Paulo");
  assert.equal(firstName("Dona"), "Dona");
  assert.equal(firstName(""), "");
  assert.equal(firstName(null), "");
  assert.equal(cleanSender("  Ana   Paula  "), "Ana Paula");
  assert.ok(!/[<>()/]/.test(cleanSender("Carlos <script>alert(1)</script>")), "sem marcas de código");
  assert.ok(!/[0-9:/@]/.test(cleanSender("Zé 99999-8888 http://x.com")), "sem número, endereço nem arroba");
  assert.ok(cleanSender("a".repeat(80)).length <= 30);
  assert.ok(!/[0-9@:/<>]/.test(cleanSender("Zé 99 @x:/<>")));
});

// ---------------------------------------------------------------- as etapas

test("a etapa só anda para a frente; quem disse não, não muda", () => {
  assert.equal(canMove("achado", "chamado"), true);
  assert.equal(canMove("chamado", "respondeu"), true);
  assert.equal(canMove("respondeu", "demonstracao"), true);
  assert.equal(canMove("demonstracao", "respondeu"), false);
  assert.equal(canMove("cadastrou", "demonstracao"), false);
  assert.equal(canMove("nao_quer", "respondeu"), false);
  assert.equal(canMove("nao_quer", "nao_quer"), true);
  assert.equal(canMove("pagando", "nao_quer"), true);
  assert.equal(canMove("sem_resposta", "respondeu"), true);
  assert.equal(canMove("sem_resposta", "chamado"), false);
  assert.equal(canMove("perdido", "pagando"), true);
  assert.equal(canMove("achado", "perdido"), true);
  assert.equal(canMove("xyz", "achado"), false);
});

test("os botões de etapa são os que o servidor aceita", () => {
  assert.deepEqual(stageChoices("respondeu").map((choice) => choice.id), ["demonstracao", "cadastrou", "pagando", "sem_resposta", "perdido"]);
  assert.deepEqual(stageChoices("achado").map((choice) => choice.id), ["demonstracao", "cadastrou", "pagando", "sem_resposta", "perdido"]);
  assert.equal(stageChoices("achado").find((choice) => choice.id === "sem_resposta").label, "Encerrar: sem resposta");
  // quem já viu a demonstração não "ficou sem resposta"
  assert.ok(!stageChoices("demonstracao").some((choice) => choice.id === "sem_resposta"));
  assert.ok(!stageChoices("sem_resposta").some((choice) => choice.id === "sem_resposta"));
  // em voz alta a etapa não repete o "Encerrar:" do botão
  assert.equal(stageSaid("sem_resposta"), "Sem resposta");
  assert.equal(stageSaid("perdido"), "Perdido");
  for (const choice of stageChoices("achado")) assert.notEqual(stageSaid(choice.id), "outra etapa", choice.id);
  assert.deepEqual(stageChoices("demonstracao").map((choice) => choice.id), ["cadastrou", "pagando", "perdido"]);
  assert.deepEqual(stageChoices("pagando").map((choice) => choice.id), ["perdido"]);
  assert.deepEqual(stageChoices("nao_quer"), []);
  assert.deepEqual(stageChoices("perdido").map((choice) => choice.id), ["demonstracao", "cadastrou", "pagando"]);
  for (const choice of stageChoices("achado")) assert.ok(canMove("achado", choice.id));
});

// ---------------------------------------------------------------- os canais e os botões que abrem o aplicativo

test("o canal da vez: o que a pessoa escolheu, senão o que o Vem sugere, senão o primeiro", () => {
  const p = prospect({ channels: ["whatsapp", "email", "ligacao"], email: "ze@pastel.com", move: { channel: "email" } });
  assert.deepEqual(channelOptions(p), ["whatsapp", "email", "ligacao", "presencial"]);
  assert.equal(channelOf(p), "email");
  assert.equal(channelOf(p, "ligacao"), "ligacao");
  assert.equal(channelOf(p, "instagram"), "email", "canal que a ficha não tem não vale");
  assert.equal(channelOf(prospect({ channels: ["ligacao"], move: { channel: null } })), "ligacao");
  assert.equal(channelOf(prospect({ channels: [], move: { channel: null } })), "presencial");
  assert.equal(sendLabel("whatsapp"), "Já mandei no WhatsApp");
  assert.equal(sendLabel("ligacao"), "Já liguei");
  assert.equal(sendLabel("presencial"), "Já falei pessoalmente");
  for (const id of Object.keys(CHANNEL_LABELS)) assert.ok(sendLabel(id));
});

test("o WhatsApp abre com o texto pronto e o número do negócio; quem envia é a pessoa", () => {
  const href = openHref(prospect(), "whatsapp", "Olá.\nLinha dois & mais?", null);
  assert.ok(href.startsWith("https://wa.me/5584999998888?text="));
  const sent = new URL(href).searchParams.get("text");
  assert.equal(sent, "Olá.\nLinha dois & mais?");
  assert.ok(!href.includes("\n") && !href.includes(" "));
  assert.equal(openHref(prospect({ whatsapp: null }), "whatsapp", "x", null), null, "fixo não tem WhatsApp");
  assert.equal(openHref(prospect({ whatsapp: "84999998888 ; rm" }), "whatsapp", "x", null), null);
});

test("o e-mail abre com assunto e texto, e só com endereço que parece e-mail de verdade", () => {
  const href = openHref(prospect({ email: "ze@pastel.com" }), "email", "Corpo\n\nAtenciosamente", "Assunto do Zé");
  assert.ok(href.startsWith("mailto:ze@pastel.com?subject="));
  const url = new URL(href);
  assert.equal(url.searchParams.get("subject"), "Assunto do Zé");
  assert.equal(url.searchParams.get("body"), "Corpo\n\nAtenciosamente");
  for (const bad of ["ze@pastel.com?cc=x@y.com", "ze@pastel.com&bcc=a@b.co", "ze pastel@x.com", "ze@x", "", null, "a@b.com<script>"]) {
    assert.equal(openHref(prospect({ email: bad }), "email", "x", "y"), null, String(bad));
  }
});

test("ligar e abrir o Instagram também só com dado que parece certo", () => {
  assert.equal(openHref(prospect(), "ligacao", "", null), "tel:+5584999998888");
  assert.equal(openHref(prospect({ phone: "(84) 3222-1111" }), "ligacao", "", null), "tel:+558432221111");
  assert.equal(openHref(prospect({ phone: "" }), "ligacao", "", null), null);
  assert.equal(openHref(prospect({ instagram: "pastelariadoze" }), "instagram", "", null), "https://www.instagram.com/pastelariadoze/");
  assert.equal(openHref(prospect({ instagram: "x/../evil" }), "instagram", "", null), null);
  assert.equal(openHref(prospect(), "presencial", "", null), null, "visita não abre aplicativo");
});

// ---------------------------------------------------------------- os rascunhos

const draft = (over = {}, input = {}) => draftOf({ prospect: prospect(over), sender: "Carlos", salesLink: LINK, channel: "whatsapp", ...input });

test("o primeiro contato diz quem fala, de onde veio o contato e como parar; o link vem sozinho na linha", () => {
  const result = draft();
  assert.match(result.text, /Vem Tecnologia/);
  assert.match(result.text, /Carlos/);
  assert.match(result.text, /Pastelaria do Zé/);
  assert.match(result.text, /anúncio/);
  assert.match(result.text, /\bNÃO\b/);
  assert.match(result.text, /Vem Comer/);
  const lines = result.text.split("\n");
  assert.equal(lines[lines.indexOf("Veja como funciona:") + 1], LINK);
  assert.ok(!PROMISES.test(result.text));
  assert.ok(!result.text.includes("!"));
  assert.equal(result.subject, null);
  assert.deepEqual(result.script, []);
});

test("a regra vale para toda origem, todo canal de texto e toda forma de dizer (sorteio repetido)", () => {
  for (const source of SOURCES) {
    for (const channel of ["whatsapp", "email", "instagram"]) {
      for (let seed = 1; seed <= 40; seed += 1) {
        const phraser = createPhraser({ rand: seeded(seed), store: memoryStore() });
        const name = seed % 2 ? "Casa da Maria" : "Sorveteria Gelo Bom";
        const person = seed % 3 === 0 ? "Dona Maria Souza" : null;
        const sender = seed % 5 === 0 ? "" : "Ana Paula";
        const result = draftOf({
          prospect: prospect({ source, business_name: name, contact_person: person, email: "dono@casa.com", instagram: "casadamaria", channels: ["whatsapp", "email", "ligacao", "instagram"] }),
          sender,
          salesLink: LINK,
          channel,
          phraser,
        });
        const where = `${source}/${channel}/${seed}: ${result.text}`;
        assert.match(result.text, /Vem Tecnologia/, where);
        assert.ok(result.text.includes(name), where);
        assert.match(result.text, /\bNÃO\b/, where);
        assert.ok(result.text.includes(LINK), where);
        assert.ok(!PROMISES.test(result.text), where);
        assert.ok(!JARGON.test(result.text), where);
        assert.ok(!result.text.includes("!"), where);
        if (sender) assert.ok(result.text.includes(sender), where);
        if (person) assert.ok(result.text.includes("Dona Maria"), where);
        if (channel === "email") {
          assert.ok(result.subject && result.subject.includes(name), where);
          assert.match(result.text, /Atenciosamente,/, where);
          assert.match(result.text, /Vem Tecnologia\s*$/, where);
        }
      }
    }
  }
});

test("quem veio do formulário do site ouve que a pessoa deixou o contato lá e pode dizer que não foi ela", () => {
  const result = draft({ source: "formulario_do_site" });
  assert.match(result.text, /nosso site/);
  assert.match(result.text, /Se não foi você/);
  assert.match(result.text, /\bNÃO\b/);
});

test("sem o nome de quem manda, o rascunho não inventa nome", () => {
  const result = draft({}, { sender: "" });
  assert.match(result.text, /Vem Tecnologia/);
  assert.ok(!/undefined|null|\bAqui é ,/.test(result.text));
});

test("o lembrete se apresenta de novo e diz como parar; só repete a origem se mudou de canal", () => {
  const same = draft({ stage: "chamado", last_channel: "whatsapp", move: { action: "lembrete", channel: "whatsapp" } });
  assert.match(same.text, /Vem Tecnologia/);
  assert.match(same.text, /\bNÃO\b/);
  assert.ok(!same.text.includes("Pastelaria do Zé"), "mesmo canal: a origem já foi dita");
  const other = draft({ stage: "chamado", last_channel: "whatsapp", email: "ze@x.com", channels: ["whatsapp", "email"], move: { action: "lembrete", channel: "email" } }, { channel: "email" });
  assert.ok(other.text.includes("Pastelaria do Zé"), "outro canal: a origem volta");
  assert.match(other.text, /\bNÃO\b/);
  assert.match(other.subject, /Pastelaria do Zé/);
});

test("responder a quem respondeu: cada tipo de resposta tem o seu texto, sem insistir", () => {
  const interested = draft({ stage: "respondeu", reply_kind: "interessado", move: { action: "responder" } });
  assert.match(interested.text, /horário/);
  assert.ok(interested.text.includes(LINK));
  const doubt = draft({ stage: "respondeu", reply_kind: "duvida", move: { action: "responder" } });
  assert.match(doubt.text, /dúvida/);
  const other = draft({ stage: "respondeu", reply_kind: null, move: { action: "responder" } });
  assert.match(other.text, /ajudar/);
  for (const reply of [interested, doubt, other]) assert.ok(!/\bNÃO\b/.test(reply.text), "numa conversa em andamento não se repete o aviso de parar");
});

test("quem perguntou de onde veio o contato ouve a verdade e a oferta de parar e apagar", () => {
  const result = draft({ source: "indicacao", source_note: "indicação do Sr. João, da padaria", stage: "respondeu", reply_kind: "quer_saber_origem", move: { action: "responder_origem" } });
  assert.match(result.text, /uma indicação/);
  assert.match(result.text, /indicação do Sr\. João, da padaria/);
  assert.match(result.text, /apague|apago/);
  assert.match(result.text, /paro|não escreva|não quiser/);
});

test("convidar, perguntar se travou e ajudar a começar têm texto; esperar, encerrar e achar contato não têm", () => {
  assert.match(draft({ stage: "respondeu", move: { action: "convidar_para_demonstracao" } }).text, /Vem Comer funcionando/);
  assert.match(draft({ stage: "demonstracao", move: { action: "perguntar_se_travou" } }).text, /dúvida|difícil/);
  assert.match(draft({ stage: "cadastrou", move: { action: "ajudar_a_comecar" } }).text, /cardápio/);
  for (const action of ["esperar", "encerrar", "achar_contato", "parar"]) {
    assert.equal(hasDraft(prospect({ move: { action } })), false, action);
    assert.equal(draft({ move: { action } }).text, "");
  }
});

test("na ligação e na visita o rascunho é um roteiro: quem é, de onde veio, o que é e como parar", () => {
  const call = draft({}, { channel: "ligacao" });
  assert.equal(call.text, "");
  assert.ok(call.script.length >= 4);
  const all = call.script.join("\n");
  assert.match(all, /Vem Tecnologia/);
  assert.match(all, /Pastelaria do Zé/);
  assert.match(all, /Vem Comer/);
  assert.match(all, /Não quer/);
  assert.match(all, /falar um minuto/);
  assert.ok(!PROMISES.test(all));
  const visit = draft({}, { channel: "presencial" });
  assert.deepEqual(visit.script.length >= 4, true);
  const reply = draft({ stage: "respondeu", reply_kind: "duvida", move: { action: "responder" } }, { channel: "ligacao" });
  assert.match(reply.script.join("\n"), /dúvida/);
  assert.match(reply.script.join("\n"), /Não quer/);
});

test("o e-mail tem assunto e assinatura; copiar leva assunto e texto, ou o roteiro inteiro", () => {
  const mail = draft({ email: "ze@x.com", channels: ["email"], move: { channel: "email" } }, { channel: "email" });
  assert.ok(mail.subject.length > 10);
  assert.match(mail.text, /Atenciosamente,\nCarlos\nVem Tecnologia$/);
  assert.equal(copyTextOf(mail), `${mail.subject}\n\n${mail.text}`);
  const whats = draft();
  assert.equal(copyTextOf(whats), whats.text);
  const call = draft({}, { channel: "ligacao" });
  assert.equal(copyTextOf(call), call.script.join("\n"));
  const semNome = draft({ email: "ze@x.com" }, { channel: "email", sender: "" });
  assert.match(semNome.text, /Atenciosamente,\nVem Tecnologia$/);
});

test("'Outra mensagem' nunca devolve a mesma que está na tela", () => {
  const phraser = createPhraser({ rand: seeded(7), store: memoryStore() });
  const input = { prospect: prospect(), sender: "Carlos", salesLink: LINK, channel: "whatsapp", phraser };
  let current = draftOf(input);
  const seen = new Set([current.text]);
  for (let i = 0; i < 12; i += 1) {
    const next = anotherDraft(input, current);
    assert.notEqual(next.text, current.text);
    seen.add(next.text);
    current = next;
  }
  assert.ok(seen.size >= 6, "as formas variam de verdade");
});

test("a primeira mensagem sem sorteio é sempre a de referência", () => {
  assert.equal(draft().text, draftOf({ prospect: prospect(), sender: "Carlos", salesLink: LINK, channel: "whatsapp", phraser: plainPhraser }).text);
  assert.match(draft().text, /^Olá\. Aqui é Carlos, da Vem Tecnologia\./);
});

test("o rascunho guardado só é refeito quando algo que o muda muda", () => {
  const p = prospect();
  const base = draftKey(p, "whatsapp", "Carlos", LINK);
  assert.equal(draftKey(prospect(), "whatsapp", "Carlos", LINK), base);
  assert.notEqual(draftKey(p, "email", "Carlos", LINK), base);
  assert.notEqual(draftKey(p, "whatsapp", "Ana", LINK), base);
  assert.notEqual(draftKey(prospect({ move: { action: "lembrete" } }), "whatsapp", "Carlos", LINK), base);
  assert.notEqual(draftKey(prospect({ reply_kind: "duvida" }), "whatsapp", "Carlos", LINK), base);
});

// ---------------------------------------------------------------- a espera

test("quando volta a ser a vez: hoje, amanhã ou o dia da semana, no horário de Brasília", () => {
  assert.equal(whenText("2026-10-20T22:00:00Z", NOW), "hoje");
  assert.equal(whenText("2026-10-21T12:00:00Z", NOW), "amanhã");
  assert.equal(whenText("2026-10-22T12:00:00Z", NOW), "na quinta-feira, 22/10");
  assert.equal(whenText("2026-10-25T12:00:00Z", NOW), "no domingo, 25/10");
  assert.equal(whenText("2026-10-24T12:00:00Z", NOW), "no sábado, 24/10");
  assert.equal(whenText("2026-10-26T12:00:00Z", NOW), "na segunda-feira, 26/10");
  assert.equal(whenText(null, NOW), "em breve");
  assert.equal(whenText("lixo", NOW), "em breve");
  // 01h de UTC ainda é o dia anterior em Brasília
  assert.equal(whenText("2026-10-21T01:00:00Z", NOW), "hoje");
  assert.equal(whenText("2026-10-19T12:00:00Z", NOW), "hoje", "data que já passou: é a vez de hoje");
});

// ---------------------------------------------------------------- o cartão de um negócio

test("o cartão de hoje: o que fazer, a hora boa, de onde veio e o rascunho com o botão que abre o WhatsApp", () => {
  const p = prospect({ contact_person: "Zé", neighborhood: "Centro" });
  const card = cardOf({ prospect: p, kind: "today", draft: draftOf({ prospect: p, sender: "Carlos", salesLink: LINK, channel: "whatsapp" }), now: NOW });
  assert.equal(card.name, "Pastelaria do Zé");
  assert.equal(card.meta, "Pastelaria · Natal · Centro");
  assert.equal(card.contact, "(84) 99999-8888");
  assert.equal(card.origin, "Veio de: Anúncio público. Onde vi: Anúncio no Instagram em 20/10.");
  assert.equal(card.line, "Ainda não foi procurado.");
  assert.equal(card.timing, "Boa hora para procurar (14h às 17h)");
  assert.equal(card.goodTime, true);
  assert.equal(card.canMarkSent, true);
  assert.equal(card.sendLabel, "Já mandei no WhatsApp");
  assert.equal(card.canClose, false);
  assert.ok(card.draft.openHref.startsWith("https://wa.me/5584999998888?text="));
  assert.equal(card.draft.openLabel, "Abrir o WhatsApp com a mensagem");
  assert.deepEqual(card.draft.channels.map((c) => [c.id, c.selected]), [["whatsapp", true], ["ligacao", false], ["presencial", false]]);
  assert.equal(card.replyOpen, false);
  assert.deepEqual(card.replies.map((r) => r.id), REPLY_CHOICES.map((r) => r.id));
  assert.ok(card.replies.every((r) => REPLY_IDS.includes(r.id)));
});

test("fora da hora de folga a tela diz qual é a melhor hora", () => {
  const card = cardOf({ prospect: prospect({ good_time: false }), kind: "today", draft: draft(), now: NOW });
  assert.equal(card.timing, "Melhor hora: 14h às 17h");
  assert.equal(card.goodTime, false);
});

test("quem espera resposta não tem rascunho nem 'Já mandei': tem a data e o botão de anotar a resposta", () => {
  const p = prospect({ stage: "chamado", stage_label: "Já chamei", touches: 1, last_channel: "whatsapp", move: { action: "esperar", reason: "Já foi chamado: espere a resposta.", due: "2026-10-22T12:00:00Z" } });
  const card = cardOf({ prospect: p, kind: "waiting", draft: draft(), now: NOW });
  assert.equal(card.draft, null);
  assert.equal(card.canMarkSent, false);
  assert.equal(card.canClose, false);
  assert.equal(card.timing, "");
  assert.equal(card.line, "Já foi chamado: espere a resposta. Volta a ser a vez na quinta-feira, 22/10.");
  assert.equal(card.stage, "Já chamei");
});

test("sem contato anotado: avisa, não tem rascunho e deixa encerrar; 3 contatos sem resposta: deixa encerrar", () => {
  const none = cardOf({ prospect: prospect({ channels: [], phone: "", whatsapp: null, move: { action: "achar_contato", reason: "Falta um jeito de falar.", channel: null } }), kind: "today", now: NOW });
  assert.equal(none.noChannel, true);
  assert.equal(none.draft, null);
  assert.equal(none.canMarkSent, false);
  assert.equal(none.canClose, true);
  assert.equal(none.contact, "Sem contato anotado");
  const done = cardOf({ prospect: prospect({ touches: 3, move: { action: "encerrar", reason: "Sem resposta depois de 3 contatos: encerrar e não procurar de novo.", channel: null } }), kind: "today", now: NOW });
  assert.equal(done.canClose, true);
  assert.equal(done.canMarkSent, false);
});

test("a etapa do cartão e os botões de 'Mais' seguem as regras do servidor", () => {
  const card = cardOf({ prospect: prospect({ stage: "respondeu", stage_label: "Respondeu" }), kind: "waiting", ui: { moreOpen: true, confirm: "nao_quer", busy: true, error: "Deu erro." }, now: NOW });
  assert.deepEqual(card.stages.map((s) => s.id), ["demonstracao", "cadastrou", "pagando", "sem_resposta", "perdido"]);
  assert.equal(card.moreOpen, true);
  assert.equal(card.confirm, "nao_quer");
  assert.equal(card.busy, true);
  assert.equal(card.error, "Deu erro.");
});

test("o canal escolhido troca o botão e o texto do rascunho", () => {
  const p = prospect({ email: "ze@x.com", channels: ["whatsapp", "email", "ligacao"] });
  const mail = draftOf({ prospect: p, sender: "Carlos", salesLink: LINK, channel: "email" });
  const card = cardOf({ prospect: p, kind: "today", ui: { channel: "email" }, draft: mail, now: NOW });
  assert.equal(card.draft.channel, "email");
  assert.equal(card.sendLabel, "Já mandei o e-mail");
  assert.ok(card.draft.openHref.startsWith("mailto:ze@x.com"));
  assert.equal(card.draft.openLabel, "Abrir o e-mail com a mensagem");
  const call = draftOf({ prospect: p, sender: "Carlos", salesLink: LINK, channel: "ligacao" });
  const ring = cardOf({ prospect: p, kind: "today", ui: { channel: "ligacao" }, draft: call, now: NOW });
  assert.equal(ring.draft.openHref, "tel:+5584999998888");
  assert.ok(ring.draft.script.length >= 4);
  assert.equal(ring.sendLabel, "Já liguei");
  const visit = cardOf({ prospect: p, kind: "today", ui: { channel: "presencial" }, draft: draftOf({ prospect: p, sender: "Carlos", salesLink: LINK, channel: "presencial" }), now: NOW });
  assert.equal(visit.draft.openHref, null);
  assert.equal(visit.draft.openLabel, "");
});

test("a linha de contato junta o que a ficha tem, e o site sem 'https://'", () => {
  assert.equal(contactLine(prospect({ email: "ze@x.com", instagram: "pastelariadoze", site: "https://pastel.com.br/" })), "(84) 99999-8888 · ze@x.com · @pastelariadoze · pastel.com.br");
  assert.equal(originLine(prospect({ source_note: null })), "Veio de: Anúncio público.");
});

// ---------------------------------------------------------------- o funil e a tela

const FUNNEL = {
  total: 12,
  paying: 1,
  by_stage: [
    { stage: "achado", label: "Achado", count: 5 },
    { stage: "chamado", label: "Já chamei", count: 4 },
    { stage: "respondeu", label: "Respondeu", count: 2 },
    { stage: "demonstracao", label: "Viu a demonstração", count: 0 },
    { stage: "cadastrou", label: "Cadastrou", count: 0 },
    { stage: "pagando", label: "Pagando", count: 1 },
    { stage: "nao_quer", label: "Não quer", count: 0 },
    { stage: "sem_resposta", label: "Sem resposta", count: 3 },
    { stage: "perdido", label: "Perdido", count: 0 },
  ],
  by_source: [
    { source: "indicacao", label: "Indicação", total: 4, chamados: 4, responderam: 3, cadastraram: 1, pagando: 1, taxa_resposta: 0.75, taxa_cadastro: 0.333, taxa_pagamento: 1 },
    { source: "anuncio_publico", label: "Anúncio público", total: 8, chamados: 0, responderam: 0, cadastraram: 0, pagando: 0, taxa_resposta: 0, taxa_cadastro: 0, taxa_pagamento: 0 },
  ],
};

test("o funil mostra o caminho inteiro, só mostra as saídas que têm gente e nunca deixa a barra sumir", () => {
  const view = funnelOf(FUNNEL);
  assert.deepEqual(view.stages.map((s) => s.id), ["achado", "chamado", "respondeu", "demonstracao", "cadastrou", "pagando", "sem_resposta"]);
  assert.equal(view.stages[0].share, 100);
  assert.equal(view.stages[3].share, 0, "zero é zero");
  assert.ok(view.stages[5].share >= 4, "um negócio ainda aparece");
  assert.equal(view.total, 12);
  assert.equal(view.paying, 1);
  assert.match(view.sources[0].line, /4 anotados, 4 chamados, 3 responderam \(75%\), 1 cadastraram, 1 pagando/);
  assert.equal(view.sources[1].line, "8 anotados, nenhum chamado ainda.");
});

const OVERVIEW = (over = {}) => ({
  today: { items: [prospect({ id: "a" }), prospect({ id: "b", business_name: "Casa da Maria" })], more: 3, touches_today: 2, notes: ["Hoje é domingo."] },
  waiting: { items: [prospect({ id: "w", stage: "chamado", move: { action: "esperar", reason: "Já foi chamado.", due: "2026-10-22T12:00:00Z" } })], more: 0 },
  funnel: FUNNEL,
  ...over,
});

test("a frase debaixo do título conta quantos para procurar, esperando e pagando", () => {
  assert.equal(subOf(OVERVIEW()), "5 para procurar hoje · 1 esperando resposta · 1 pagando");
  assert.equal(subOf(OVERVIEW({ today: { items: [], more: 0, touches_today: 0, notes: [] }, waiting: { items: [], more: 0 }, funnel: { ...FUNNEL, paying: 0 } })), "Nada para procurar agora");
  assert.equal(subOf(null), "");
});

test("a tela inteira: hoje, esperando, avisos do dia, quanto falta e o funil", () => {
  const drafts = { a: draftOf({ prospect: prospect({ id: "a" }), sender: "Carlos", salesLink: LINK, channel: "whatsapp" }) };
  const view = salesViewOf({ load: "ready", overview: OVERVIEW(), sender: "Carlos", drafts, ui: { a: { busy: true } }, now: NOW });
  assert.equal(view.load, "ready");
  assert.equal(view.sub, "5 para procurar hoje · 1 esperando resposta · 1 pagando");
  assert.deepEqual(view.today.map((c) => c.id), ["a", "b"]);
  assert.equal(view.today[0].busy, true);
  assert.ok(view.today[0].draft);
  assert.equal(view.today[1].draft, null, "sem rascunho feito, o cartão ainda não mostra texto");
  assert.equal(view.todayMore, "Mais 3 negócios esperam a vez deles.");
  assert.deepEqual(view.notes, ["Hoje é domingo."]);
  assert.deepEqual(view.waiting.map((c) => c.id), ["w"]);
  assert.equal(view.waitingMore, "");
  assert.equal(view.funnel.total, 12);
  assert.equal(view.sender, "Carlos");
});

test("carregando ou com erro a tela não mostra número nenhum", () => {
  const loading = salesViewOf({ load: "loading", overview: null, sender: "", now: NOW });
  assert.equal(loading.sub, "");
  assert.deepEqual(loading.today, []);
  assert.equal(loading.funnel.total, 0);
  const failed = salesViewOf({ load: "error", error: "Não consegui abrir as Vendas.", overview: OVERVIEW(), sender: "", now: NOW });
  assert.equal(failed.error, "Não consegui abrir as Vendas.");
  assert.deepEqual(failed.today, [], "erro depois de dado velho: não mostra o velho como se fosse atual");
});

// ---------------------------------------------------------------- anotar um negócio

const filled = (over = {}) => ({ ...emptyForm(), name: "Pizzaria do Zé", city: "Natal", phone: "(84) 99999-8888", source: "anuncio_publico", seen: "Anúncio no Instagram em 20/10", ...over });

test("o formulário só deixa guardar com origem, onde viu e um jeito de falar com o negócio", () => {
  assert.equal(formProblem(filled()), "");
  assert.match(formProblem(filled({ name: "" })), /nome do negócio/);
  assert.match(formProblem(filled({ city: "" })), /cidade/);
  assert.match(formProblem(filled({ source: "" })), /de onde veio o contato/);
  assert.match(formProblem(filled({ source: "formulario_do_site" })), /de onde veio o contato/, "essa origem só o formulário do site cria");
  assert.match(formProblem(filled({ seen: "ab" })), /onde você viu o contato/i);
  assert.match(formProblem(filled({ seen: "x".repeat(301) })), /300/);
  assert.match(formProblem(filled({ phone: "", email: "", instagram: "", site: "" })), /jeito de falar/);
  assert.equal(formProblem(filled({ phone: "", source: "visita" })), "", "visita pode não ter contato ainda");
  assert.match(formProblem(filled({ name: "a".repeat(81) })), /nome do negócio/);
});

test("só os campos preenchidos viajam, e sem espaço sobrando", () => {
  const sent = toNewProspect(filled({ name: "  Pizzaria   do  Zé ", neighborhood: "", person: "Zé", instagram: "@pizzariadoze" }));
  assert.deepEqual(sent, {
    business_name: "Pizzaria do Zé",
    business_kind: "restaurante",
    city: "Natal",
    source: "anuncio_publico",
    source_note: "Anúncio no Instagram em 20/10",
    contact_person: "Zé",
    phone: "(84) 99999-8888",
    instagram: "@pizzariadoze",
  });
  assert.ok(!("paste" in sent), "o texto colado nunca vai para o servidor");
  assert.ok(!("neighborhood" in sent));
});

test("ler o texto preenche só os campos vazios e conta o que achou", () => {
  const read = { name: "Pizzaria do Zé", phone: "5584999998888", other_phones: ["5584988887777"], email: "pizza@ze.com", instagram: "pizzariadoze", site: null };
  const start = { ...emptyForm(), paste: "texto", city: "Natal", name: "Já escrevi este" };
  const { values, note } = applyRead(start, read);
  assert.equal(values.name, "Já escrevi este", "não apaga o que a pessoa escreveu");
  assert.equal(values.phone, "(84) 99999-8888");
  assert.equal(values.email, "pizza@ze.com");
  assert.equal(values.instagram, "pizzariadoze");
  assert.equal(values.city, "Natal");
  assert.equal(values.paste, "texto");
  assert.match(note, /Confira os campos/);
  assert.match(note, /Achei mais 1 telefone/);
  const none = applyRead(emptyForm(), { name: null, phone: null, other_phones: [], email: null, instagram: null, site: null });
  assert.match(none.note, /Não achei telefone, e-mail nem Instagram/);
  assert.deepEqual(none.values, emptyForm());
  const landline = applyRead(emptyForm(), { name: null, phone: "558432221111", other_phones: [], email: null, instagram: null, site: null });
  assert.equal(landline.values.phone, "(84) 3222-1111");
});

test("os tipos de negócio e as respostas são os do servidor", () => {
  assert.equal(KIND_CHOICES.length, 12);
  assert.ok(KIND_CHOICES.some((k) => k.id === "pastelaria") && KIND_CHOICES.some((k) => k.id === "sorveteria"));
  assert.deepEqual(REPLY_IDS, ["interessado", "duvida", "quer_saber_origem", "adiar", "nao_quer"]);
  assert.ok(!REPLY_CHOICES.some((r) => r.id === "nao_quer"), "'não quer' tem confirmação própria");
});

test("a visão do formulário diz se dá para guardar", () => {
  assert.equal(formViewOf(filled(), {}).canSave, true);
  assert.equal(formViewOf(emptyForm(), { error: "Falta algo." }).canSave, false);
  assert.equal(formViewOf(emptyForm(), { error: "Falta algo." }).error, "Falta algo.");
  assert.equal(formViewOf(emptyForm(), { reading: true }).reading, true);
});

test("depois de guardar a tela diz o que aconteceu, sem inventar", () => {
  assert.equal(savedText({ created: true, reason: null }, "Pizzaria do Zé"), "Pizzaria do Zé foi guardado.");
  assert.equal(savedText({ created: false, reason: "ja_existe" }, "X"), "Esse contato já estava anotado. Não criei outro.");
  assert.equal(savedText({ created: false, reason: "na_lista_de_bloqueio" }, "X"), "Esse contato pediu para não receber mais nada. Não foi guardado.");
});
