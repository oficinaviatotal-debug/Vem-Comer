import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { fitDictation, joinDictation } from "../../frontend/src/novo/dictation.ts";

const read = (path) => readFileSync(new URL(`../../frontend/src/${path}`, import.meta.url), "utf8");

// ---------------------------------------------------------------- o texto que vai para o campo

test("o que a pessoa fala vira texto de campo: letra maiúscula no começo, sem ponto no fim, sem espaço sobrando", () => {
  assert.equal(fitDictation("pastel de carne"), "Pastel de carne");
  assert.equal(fitDictation("pastel de carne."), "Pastel de carne");
  assert.equal(fitDictation("  coca   cola , "), "Coca cola");
  assert.equal(fitDictation("sem cebola, sem tomate."), "Sem cebola, sem tomate");
  assert.equal(fitDictation("2 pastéis de queijo"), "2 pastéis de queijo");
  assert.equal(fitDictation("água de coco"), "Água de coco");
  assert.equal(fitDictation("ágape?"), "Ágape");
  assert.equal(fitDictation("açaí 300 ml…"), "Açaí 300 ml");
});

test("nada ouvido não escreve nada, e o limite do campo é respeitado sem deixar espaço na ponta", () => {
  for (const nothing of ["", "   ", "...", " . , ", null, undefined]) assert.equal(fitDictation(nothing), "", String(nothing));
  assert.equal(fitDictation("x".repeat(100), 80).length, 80);
  assert.equal(fitDictation("ab cd ef", 3), "Ab");
  assert.equal(fitDictation("ab cd ef", 5), "Ab cd");
  assert.equal(fitDictation("pastel", 0), "Pastel", "limite que não vale é ignorado");
  assert.equal(fitDictation("pastel", Number.NaN), "Pastel");
});

test("não inventa: as palavras são as que o celular ouviu (nada é trocado nem corrigido)", () => {
  assert.equal(fitDictation("xis tudo"), "Xis tudo");
  assert.equal(fitDictation("PASTEL DE CARNE"), "PASTEL DE CARNE", "só a primeira letra é mexida");
});

test("em campo de várias linhas a fala vai depois do que já estava escrito", () => {
  assert.equal(joinDictation("", "sem cebola"), "Sem cebola");
  assert.equal(joinDictation(null, "sem cebola"), "Sem cebola");
  assert.equal(joinDictation("Tamanho pequeno", "e grande."), "Tamanho pequeno e grande");
  assert.equal(joinDictation("Tamanho pequeno,", "grande"), "Tamanho pequeno, grande");
  assert.equal(joinDictation("Tamanho pequeno  ", "Grande"), "Tamanho pequeno grande", "no meio do texto não começa em maiúscula");
  assert.equal(joinDictation("abc", "", 10), "abc", "sem fala o texto fica como estava");
  assert.equal(joinDictation("abc", "def", 5), "abc d");
  assert.equal(joinDictation("abc", "def"), "abc def");
});

// ---------------------------------------------------------------- o botão e onde ele entra

test("o botão do microfone é só visual, não aparece onde o painel não escuta e tem 44 px", () => {
  const button = read("novo/DictateButton.tsx");
  assert.doesNotMatch(button, /from "\.\.\//, "peça de tela não importa do resto do app");
  assert.match(button, /const dictate = useVoice\(\)\?\.dictate;\n  if \(!dictate \|\| disabled\) return null;/);
  assert.match(button, /type="button"/);
  assert.match(button, /aria-pressed=\{hearing\}/);
  assert.match(button, /aria-label=\{label\}/);
  const css = read("novo/novo.css");
  const rule = css.match(/\.nv-root \.nv-dictate \{[^}]*\}/)[0];
  assert.match(rule, /width: 44px/);
  assert.match(rule, /height: 44px/);
  assert.match(css, /\.nv-root \.nv-dictate\.is-listening svg \{\s*animation: nv-beat/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{\s*\.nv-root \.nv-dictate\.is-listening svg \{\s*animation: none/);
  assert.doesNotMatch(read("novo/voice.ts"), /from "\.\.\//);
});

test("o microfone entra nos campos de texto livre das telas de trabalho, e em nenhum campo de senha, e-mail, preço, código ou número", () => {
  const wired = [
    ["Dishes.tsx", ["nv-dish-name", "nv-dish-text", "nv-dish-search"]],
    ["Categories.tsx", ["nv-cat-name"]],
    ["DishOptions.tsx", ["`nv-opt-name-${group.uid}`", "`nv-opt-iname-${group.uid}-${item.uid}`", "nv-opt-type"]],
    ["MenuModel.tsx", ["nv-model-search", "nv-model-add"]],
  ];
  for (const [name, ids] of wired) {
    const source = read(`novo/${name}`);
    assert.match(source, /import DictateButton from "\.\/DictateButton"/, name);
    for (const id of ids) {
      const quoted = id.startsWith("`") ? `id={${id}}` : `id="${id}"`;
      assert.ok(source.includes(quoted) && new RegExp(`<DictateButton[^>]*${quoted.replace(/[$.{}`]/g, "\\$&")}`, "s").test(source), `${name}: falta o microfone em ${id}`);
    }
  }
  // Nunca em senha, e-mail, preço, código de entrega, número da mesa, nem em envio de arquivo.
  const never = /<DictateButton[^>]*id=\{?[`"][^`"]*(price|preco|code|codigo|number|numero|pass|senha|email|file)/i;
  for (const file of readdirSync(new URL("../../frontend/src/novo/", import.meta.url)).filter((name) => name.endsWith(".tsx"))) {
    assert.doesNotMatch(read(`novo/${file}`), never, `${file}: microfone em campo que não é texto livre`);
  }
  for (const file of ["Login.tsx", "Deliveries.tsx", "Desk.tsx", "Logo.tsx", "Bag.tsx", "Tracking.tsx"]) {
    assert.doesNotMatch(read(`novo/${file}`), /DictateButton/, `${file} não leva microfone de campo (por ora)`);
  }
});

test("só o painel escuta: um microfone por vez, só depois do toque, e o campo só recebe o que foi ouvido", () => {
  const hook = read("painel/useVoiceNav.ts");
  assert.match(hook, /const pressField = useCallback\(/);
  assert.match(hook, /stopSpeaking\(\);\n      const phrase = phraser\(\);\n      if \(!canListen\(\)\) \{\n        show\(\{ tone: "warn", heard: "", text: phrase\.say\(SAY_DICTATE_OFF\) \}\);/);
  assert.match(hook, /const written = heard \? apply\(heard\) : "";\n        if \(!written\) \{/, "sem fala, nada é escrito");
  assert.match(hook, /if \(mine !== turn\.current\) return;\n        hearing\.current = null;/, "resposta velha é descartada");
  assert.match(hook, /if \(hearing\.current\) \{\n        cancelHearing\(\);\n        close\(\);\n        return;\n      \}/, "tocar de novo cancela");
  assert.match(hook, /\[input\.current, cancelHearing, close\]/, "trocar de tela cancela o ditado");
  assert.match(hook, /canListen\(\) \? \{ active: field, press: pressField \} : undefined/, "celular que não escuta não ganha o botão");
  assert.doesNotMatch(hook, /service\/api|fetch\(/);
  assert.match(read("painel/PanelShell.tsx"), /dictate: voice\.dictate/);
});
