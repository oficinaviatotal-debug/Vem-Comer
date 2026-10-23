import test from "node:test";
import assert from "node:assert/strict";

import {
  foodFromWords,
  localFailText,
  logoViewOf,
  makerSpec,
  markCut,
  modelSpecs,
  nameFromWords,
  nameProblem,
  nextStep,
  pickFood,
  pickModel,
  pickPalette,
  prevStep,
  saidFoodText,
  saidNameText,
  startMaker,
  typeName,
  uploadNameOf,
  workingText,
} from "../../frontend/src/painel/logoViewLogic.ts";
import { FOODS, NAME_MAX_CHARS, DEFAULT_PALETTE } from "../../frontend/src/logo/logoLogic.ts";
import {
  LOGO_FRAME_NONE,
  LOGO_HEARD_FOOD_NONE,
  LOGO_HEARD_NONE,
  LOGO_LEAD_HAS,
  LOGO_LEAD_NONE,
  LOGO_LOAD_ERROR,
  LOGO_MAKE,
  LOGO_MAKE_ANOTHER,
  LOGO_NAME_CUT,
  LOGO_NAME_EMPTY,
  LOGO_NEXT_HINT,
  LOGO_OPENING,
  LOGO_OPEN_FAIL,
  LOGO_REMOVING,
  LOGO_SAVING,
  LOGO_SAVED,
  LOGO_SMALL,
  LOGO_TOO_LIGHT,
} from "../../frontend/src/novo/copy.ts";

// ------------------------------------------------------------------------------------------------ criar em três toques

test("o criar começa com o nome do restaurante e já marca o tipo quando o nome diz o que ele vende", () => {
  const withGuess = startMaker("Pizzaria do Zé");
  assert.equal(withGuess.step, 1);
  assert.equal(withGuess.food, "pizza");
  assert.equal(withGuess.guess, "pizza");
  assert.equal(withGuess.palette, DEFAULT_PALETTE.pizza);
  assert.equal(withGuess.name, "Pizzaria do Zé");
  assert.equal(withGuess.template, "quadrado");

  const without = startMaker("Cantinho do Zé");
  assert.equal(without.food, null);
  assert.equal(without.guess, null);
  assert.equal(without.palette, "verde");
});

test("trocar o tipo troca a cor que combina, até a pessoa escolher a cor", () => {
  let state = startMaker("Cantinho do Zé");
  state = pickFood(state, "acai");
  assert.equal(state.palette, DEFAULT_PALETTE.acai);
  state = pickPalette(state, "azul");
  assert.equal(state.paletteTouched, true);
  state = pickFood(state, "pizza");
  assert.equal(state.palette, "azul", "a cor escolhida pela pessoa não muda sozinha");
  assert.equal(state.food, "pizza");
});

test("tocar no que já está marcado não muda nada (mesmo objeto, sem desenhar de novo)", () => {
  const state = pickPalette(pickFood(startMaker("Cantinho do Zé"), "pizza"), "rosa");
  assert.equal(pickFood(state, "pizza"), state);
  assert.equal(pickPalette(state, "rosa"), state);
  assert.equal(pickModel(state, state.template), state);
});

test("só passa do primeiro passo com o tipo escolhido; os outros passos não pedem nada; dá para voltar", () => {
  const empty = startMaker("Cantinho do Zé");
  assert.equal(nextStep(empty), empty, "sem tipo, fica no passo 1");
  let state = pickFood(empty, "sushi");
  state = nextStep(state);
  assert.equal(state.step, 2);
  state = nextStep(state);
  assert.equal(state.step, 3);
  assert.equal(nextStep(state), state, "não há passo 4");
  state = prevStep(prevStep(state));
  assert.equal(state.step, 1);
  assert.equal(prevStep(state), state);
});

test("o nome da logomarca tem o limite de sempre e sem nome não dá para salvar", () => {
  let state = startMaker("Cantinho do Zé");
  state = typeName(state, "x".repeat(NAME_MAX_CHARS + 20));
  assert.equal(state.name.length, NAME_MAX_CHARS);
  assert.equal(nameProblem(state), "");
  assert.equal(nameProblem(typeName(state, "   ")), LOGO_NAME_EMPTY);
  assert.equal(nameProblem(typeName(state, "")), LOGO_NAME_EMPTY);
});

test("o desenho que vai para o servidor usa o que está marcado; sem tipo vale Outro; são seis modelos com o nome limpo", () => {
  let state = typeName(startMaker("Cantinho do Zé"), "  Zé   Lanches ");
  assert.deepEqual(makerSpec(state), { template: "quadrado", food: "geral", palette: "verde", name: "  Zé   Lanches " });
  assert.equal(makerSpec(state, "toldo").template, "toldo");
  const specs = modelSpecs(state);
  assert.equal(specs.length, 6);
  assert.deepEqual(
    specs.map((spec) => spec.template),
    ["selo", "quadrado", "claro", "redondo", "letras", "toldo"],
  );
  assert.ok(specs.every((spec) => spec.name === "Zé Lanches"));
  state = pickFood(state, "cafe");
  assert.ok(modelSpecs(state).every((spec) => spec.food === "cafe" && spec.palette === DEFAULT_PALETTE.cafe));
});

test("o aviso de nome cortado só muda o estado quando muda de verdade", () => {
  const state = startMaker("Cantinho do Zé");
  assert.equal(markCut(state, "selo", false), state);
  const cut = markCut(state, "selo", true);
  assert.notEqual(cut, state);
  assert.equal(cut.cutIn.selo, true);
  assert.equal(markCut(cut, "selo", true), cut);
  assert.equal(markCut(cut, "selo", false).cutIn.selo, false);
});

// ------------------------------------------------------------------------------------------------ o que foi dito

test("falar o que vende: cada nome da lista volta ao próprio tipo, e 'outro' vale Outro", () => {
  for (const food of FOODS) {
    const expected = food.id;
    assert.equal(foodFromWords(food.label), expected, `"${food.label}" deveria virar ${expected}`);
  }
  assert.equal(foodFromWords("outra coisa"), "geral");
  assert.equal(foodFromWords("Outros"), "geral");
});

test("falar o que vende: palavras do dia a dia entendem, e o que não entendo fica sem tipo", () => {
  assert.equal(foodFromWords("pizzaria"), "pizza");
  assert.equal(foodFromWords("eu vendo lanche"), "hamburguer");
  assert.equal(foodFromWords("açaí"), "acai");
  assert.equal(foodFromWords("hot dog"), "cachorro-quente");
  assert.equal(foodFromWords("blá blá"), null);
  assert.equal(foodFromWords(""), null);
});

test("falar o nome: primeira letra de cada palavra grande em maiúscula, sem ponto no fim, e o resto como veio", () => {
  assert.equal(nameFromWords("pizzaria do zé"), "Pizzaria do Zé");
  assert.equal(nameFromWords("bar da maria."), "Bar da Maria");
  assert.equal(nameFromWords("  espetinho   do  JC  "), "Espetinho do JC");
  assert.equal(nameFromWords("BBQ do Tio"), "BBQ do Tio");
  assert.equal(nameFromWords("e o sabor"), "E o Sabor", "a primeira palavra sempre começa com maiúscula");
  assert.equal(nameFromWords(""), "");
  assert.equal(nameFromWords("..."), "");
  assert.ok(nameFromWords("a".repeat(100)).length <= NAME_MAX_CHARS);
});

test("o que a bolinha responde: entendi, não entendi ou não ouvi", () => {
  assert.equal(saidFoodText("", null), LOGO_HEARD_NONE);
  assert.equal(saidFoodText("blá", null), LOGO_HEARD_FOOD_NONE);
  assert.match(saidFoodText("pizzaria", "pizza"), /^Entendi: Pizza\./);
  assert.match(saidFoodText("pizzaria", "pizza"), /Continuar/);
  assert.equal(saidNameText("", ""), LOGO_HEARD_NONE);
  assert.match(saidNameText("bar da maria", "Bar da Maria"), /Escrevi: Bar da Maria\./);
});

// ------------------------------------------------------------------------------------------------ erros e arquivo

test("falha ao abrir a imagem: a frase nossa passa; erro do navegador (inglês) vira a frase de sempre", () => {
  assert.equal(localFailText(new Error("Esse arquivo não é uma imagem PNG ou JPG. Escolha outra.")), "Esse arquivo não é uma imagem PNG ou JPG. Escolha outra.");
  assert.equal(localFailText(new Error("Não consegui abrir essa imagem. Escolha outra, em PNG ou JPG.")), "Não consegui abrir essa imagem. Escolha outra, em PNG ou JPG.");
  assert.equal(localFailText(new Error("The source image could not be decoded.")), LOGO_OPEN_FAIL);
  assert.equal(localFailText(new Error("")), LOGO_OPEN_FAIL);
  assert.equal(localFailText("falhou"), LOGO_OPEN_FAIL);
  assert.equal(localFailText(undefined), LOGO_OPEN_FAIL);
  assert.equal(localFailText(new Error("out of memory"), "Outra frase."), "Outra frase.");
});

test("o nome do arquivo enviado não leva o nome que o celular deu à foto", () => {
  assert.equal(uploadNameOf("image/png"), "logomarca.png");
  assert.equal(uploadNameOf("image/jpeg"), "logomarca.jpg");
  assert.equal(uploadNameOf("IMAGE/WEBP"), "logomarca.webp");
  assert.equal(uploadNameOf(""), "logomarca.png");
});

// ------------------------------------------------------------------------------------------------ a tela

const input = (extra = {}) => ({
  load: "ready",
  loadError: "",
  name: "Pizzaria do Zé",
  logoSrc: "",
  mode: "home",
  working: "",
  notice: null,
  removeArmed: false,
  review: null,
  maker: null,
  canListen: true,
  listening: "",
  heard: "",
  said: "",
  ...extra,
});

test("abrindo: só diz que está abrindo; falha ao abrir nunca vira 'sem logomarca'", () => {
  const loading = logoViewOf(input({ load: "loading" }));
  assert.equal(loading.stage, "loading");
  assert.equal(loading.home, null);
  const failed = logoViewOf(input({ load: "error", loadError: "Sem internet. Tente de novo.", logoSrc: "" }));
  assert.equal(failed.stage, "error");
  assert.equal(failed.error, "Sem internet. Tente de novo.");
  assert.equal(failed.home, null, "sem as cartas do início: não diz que não tem logomarca");
  assert.equal(failed.live, "Sem internet. Tente de novo.");
  assert.notEqual(LOGO_LOAD_ERROR, "");
});

test("o início sem logomarca diz o que falta e o que fazer; com logomarca diz o que o cliente vê e que dá para trocar", () => {
  const none = logoViewOf(input()).home;
  assert.equal(none.hasLogo, false);
  assert.equal(none.lead, LOGO_LEAD_NONE);
  assert.match(none.next, /foto/);
  assert.match(none.next, /de graça/);
  assert.equal(none.makeLabel, LOGO_MAKE);
  assert.notEqual(LOGO_FRAME_NONE, "");

  const has = logoViewOf(input({ logoSrc: "https://x/media/a.webp" })).home;
  assert.equal(has.hasLogo, true);
  assert.equal(has.logoSrc, "https://x/media/a.webp");
  assert.equal(has.lead, LOGO_LEAD_HAS);
  assert.match(has.next, /trocar/);
  assert.equal(has.makeLabel, LOGO_MAKE_ANOTHER);
});

test("o início: o nome do restaurante vai no topo; sem nome, a frase de apoio; a frase viva traz o aviso, senão o que fazer", () => {
  assert.equal(logoViewOf(input()).sub, "Pizzaria do Zé");
  assert.equal(logoViewOf(input({ name: "   " })).sub, "O que o cliente vê no alto do cardápio");
  const noticed = logoViewOf(input({ notice: { ok: true, text: LOGO_SAVED } }));
  assert.equal(noticed.live, LOGO_SAVED);
  assert.deepEqual(noticed.home.notice, { ok: true, text: LOGO_SAVED });
  const quiet = logoViewOf(input());
  assert.ok(quiet.live.includes(quiet.home.lead) && quiet.live.includes(quiet.home.next));
});

test("enquanto abre, salva ou remove a tela diz o que está fazendo", () => {
  assert.equal(workingText(""), "");
  assert.equal(workingText("opening"), LOGO_OPENING);
  assert.equal(workingText("saving"), LOGO_SAVING);
  assert.equal(workingText("removing"), LOGO_REMOVING);
  const view = logoViewOf(input({ logoSrc: "https://x/media/a.webp", working: "removing", removeArmed: true }));
  assert.equal(view.home.working, LOGO_REMOVING);
  assert.equal(view.home.removeArmed, true);
  assert.equal(view.live, LOGO_REMOVING);
});

const review = (extra = {}) => ({ originalSrc: "blob:o", refinedSrc: "blob:r", useRefined: true, tooLight: false, small: false, ...extra });

test("'Ficou bom?': com a versão ajustada ela vem escolhida e a original continua à mão; mostra como o cliente vê", () => {
  const view = logoViewOf(input({ mode: "review", review: review() })).review;
  assert.equal(view.useRefined, true);
  assert.equal(view.shownSrc, "blob:r");
  assert.match(view.lead, /margem vazia/);
  assert.equal(view.restaurant, "Pizzaria do Zé");
  const original = logoViewOf(input({ mode: "review", review: review({ useRefined: false }) })).review;
  assert.equal(original.useRefined, false);
  assert.equal(original.shownSrc, "blob:o");
});

test("'Ficou bom?': sem versão ajustada não há o que escolher, mesmo que o estado diga que sim", () => {
  const view = logoViewOf(input({ mode: "review", review: review({ refinedSrc: "", useRefined: true }) })).review;
  assert.equal(view.useRefined, false);
  assert.equal(view.shownSrc, "blob:o");
  assert.ok(!/margem/.test(view.lead));
});

test("'Ficou bom?': avisa quando a imagem é clara demais ou pequena, e o erro de salvar fica na tela", () => {
  const warned = logoViewOf(input({ mode: "review", review: review({ tooLight: true, small: true }) })).review;
  assert.deepEqual(warned.warnings, [LOGO_TOO_LIGHT, LOGO_SMALL]);
  const clean = logoViewOf(input({ mode: "review", review: review() })).review;
  assert.deepEqual(clean.warnings, []);
  assert.equal(clean.error, "");
  const failed = logoViewOf(input({ mode: "review", review: review(), notice: { ok: false, text: "Imagem grande demais." } }));
  assert.equal(failed.review.error, "Imagem grande demais.");
  assert.equal(failed.live, "Imagem grande demais.");
  const nameless = logoViewOf(input({ mode: "review", review: review(), name: "" })).review;
  assert.equal(nameless.restaurant, "Seu restaurante");
});

test("'Ficou bom?': enquanto abre outra imagem ou salva, os botões esperam", () => {
  const opening = logoViewOf(input({ mode: "review", review: review(), working: "opening" })).review;
  assert.equal(opening.busy, true);
  assert.equal(opening.saving, false);
  const saving = logoViewOf(input({ mode: "review", review: review(), working: "saving" })).review;
  assert.equal(saving.busy, true);
  assert.equal(saving.saving, true);
  assert.equal(logoViewOf(input({ mode: "review", review: review() })).review.busy, false);
});

test("sem imagem escolhida não existe a tela de conferir; sem o criar não existe a tela de criar", () => {
  assert.equal(logoViewOf(input({ mode: "review", review: null })).stage, "home");
  assert.equal(logoViewOf(input({ mode: "maker", maker: null })).stage, "home");
});

test("criar, passo 1: o tipo adivinhado fica marcado; trocar mostra 'parece ser este'; sem tipo, o continuar espera e a frase diz por quê", () => {
  let state = startMaker("Pizzaria do Zé");
  let maker = logoViewOf(input({ mode: "maker", maker: state })).maker;
  assert.equal(maker.step, 1);
  assert.equal(maker.stepText, "Passo 1 de 3");
  assert.equal(maker.question, "O que você vende?");
  assert.equal(maker.foods.length, FOODS.length);
  assert.equal(maker.foods.find((food) => food.id === "pizza").picked, true);
  assert.equal(maker.foods.find((food) => food.id === "pizza").hint, undefined);
  assert.equal(maker.canNext, true);
  assert.equal(maker.nextHint, "");

  state = pickFood(state, "sushi");
  maker = logoViewOf(input({ mode: "maker", maker: state })).maker;
  assert.equal(maker.foods.find((food) => food.id === "pizza").hint, "parece ser este");
  assert.equal(maker.foods.find((food) => food.id === "sushi").picked, true);
  assert.equal(maker.foods.filter((food) => food.picked).length, 1);

  const empty = logoViewOf(input({ mode: "maker", maker: startMaker("Cantinho do Zé") })).maker;
  assert.equal(empty.canNext, false);
  assert.equal(empty.nextHint, LOGO_NEXT_HINT);
  assert.equal(empty.foods.filter((food) => food.picked).length, 0);
});

test("criar, passo 2: cores com amostra, uma marcada, e a frase de apoio da fachada", () => {
  const state = nextStep(pickFood(startMaker("Cantinho do Zé"), "pizza"));
  const maker = logoViewOf(input({ mode: "maker", maker: state })).maker;
  assert.equal(maker.step, 2);
  assert.match(maker.question, /cor da sua fachada/);
  assert.match(maker.help, /Sem fachada/);
  assert.equal(maker.palettes.length, 9);
  assert.ok(maker.palettes.every((palette) => /^#[0-9A-Fa-f]{6}$/.test(palette.color)));
  assert.equal(maker.palettes.filter((palette) => palette.picked).length, 1);
  assert.equal(maker.palettes.find((palette) => palette.picked).id, DEFAULT_PALETTE.pizza);
});

test("criar, passo 3: seis modelos com nome para o leitor de tela, um marcado, e o aviso de nome cortado", () => {
  let state = nextStep(nextStep(pickFood(startMaker("Cantinho do Zé"), "pizza")));
  let maker = logoViewOf(input({ mode: "maker", maker: state })).maker;
  assert.equal(maker.step, 3);
  assert.equal(maker.models.length, 6);
  assert.ok(maker.models.every((model) => model.label !== ""));
  assert.equal(maker.models.find((model) => model.picked).id, "quadrado");
  assert.equal(maker.cutNote, "");
  assert.equal(maker.name, "Cantinho do Zé");
  state = markCut(state, "selo", true);
  maker = logoViewOf(input({ mode: "maker", maker: state })).maker;
  assert.equal(maker.cutNote, LOGO_NAME_CUT);
  state = markCut(state, "selo", false);
  assert.equal(logoViewOf(input({ mode: "maker", maker: state })).maker.cutNote, "");
});

test("criar: a voz mostra o que ouviu e o que entendeu; sem microfone a frase manda tocar ou escrever", () => {
  const state = pickFood(startMaker("Cantinho do Zé"), "pizza");
  const listening = logoViewOf(input({ mode: "maker", maker: state, listening: "food", heard: "pizza" })).maker;
  assert.equal(listening.listening, "food");
  assert.equal(listening.heard, "pizza");
  const understood = logoViewOf(input({ mode: "maker", maker: state, said: "Entendi: Pizza." })).maker;
  assert.equal(understood.said, "Entendi: Pizza.");
  const noMic = logoViewOf(input({ mode: "maker", maker: state, canListen: false })).maker;
  assert.equal(noMic.canListen, false);
  assert.match(noMic.said, /não escuta/);
  assert.match(noMic.said, /figuras/);
  const noMicName = logoViewOf(input({ mode: "maker", maker: nextStep(nextStep(state)), canListen: false })).maker;
  assert.match(noMicName.said, /Escreva o nome/);
});

test("criar: o erro de salvar e a espera aparecem; a frase viva traz o erro, senão a pergunta", () => {
  const state = nextStep(nextStep(pickFood(startMaker("Cantinho do Zé"), "pizza")));
  const failed = logoViewOf(input({ mode: "maker", maker: state, notice: { ok: false, text: "Não consegui enviar a logomarca. Tente de novo." } }));
  assert.equal(failed.maker.error, "Não consegui enviar a logomarca. Tente de novo.");
  assert.equal(failed.live, "Não consegui enviar a logomarca. Tente de novo.");
  const saving = logoViewOf(input({ mode: "maker", maker: state, working: "saving" }));
  assert.equal(saving.maker.saving, true);
  assert.equal(saving.live, LOGO_SAVING);
  const calm = logoViewOf(input({ mode: "maker", maker: state }));
  assert.equal(calm.maker.error, "");
  assert.equal(calm.live, "Passo 3 de 3. Escolha o modelo");
});
