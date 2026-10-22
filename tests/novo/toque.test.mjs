import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * A regra do desenho (pedido do GD em 22/10/2026: "impressão de 3D" e "tudo clicável"):
 * o que tem borda grossa embaixo e afunda no toque, TOCA; o que só informa fica liso. Estes testes leem o CSS e as
 * telas como texto (não há navegador aqui); a conferência com imagens em 320 a 480 px confere o resto.
 */
const DIR = new URL("../../frontend/src/novo/", import.meta.url);
const read = (name) => readFileSync(new URL(name, DIR), "utf8");
const css = read("novo.css");
const block = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const found = css.match(new RegExp(`(?:^|\\n)${escaped} \\{[^}]*\\}`));
  assert.ok(found, `não achei o bloco ${selector}`);
  return found[0];
};

test("o cartão do prato inteiro é o botão de pedir; o + da foto é só desenho", () => {
  const shop = read("ShopMenu.tsx");
  assert.match(shop, /className="nv-dish-hit nv-hit"/);
  assert.ok(!/<button[^>]*className="nv-add"/.test(shop), "o + não pode ser um segundo botão dentro do cartão");
  assert.match(shop, /<span className="nv-add" aria-hidden="true">/);
  assert.match(block(".nv-add"), /pointer-events: none/);
  assert.match(block(".nv-hit::after"), /position: absolute/);
  assert.match(block(".nv-hit::after"), /inset: 0/);
});

test("prato que não se pede agora (esgotado, fechado) não vira botão", () => {
  const shop = read("ShopMenu.tsx");
  assert.match(shop, /dish\.action === "none" \? \(\s*<span className="nv-dish-name">/);
});

test("o menos e o mais ficam por cima do toque estendido, senão o cartão engole o toque", () => {
  const step = block(".nv-step");
  assert.match(step, /position: relative/);
  assert.match(step, /z-index: 1/);
  assert.match(block(".nv-cross-close"), /z-index: 1/);
  assert.match(block(".nv-cross-close"), /position: relative/);
});

test("quem é o toque estendido não se mexe sozinho, e nenhum botão o prende ao próprio tamanho", () => {
  assert.match(css, /\.nv-btn:active:not\(:disabled\):not\(\.nv-hit\)/);
  assert.ok(!/position:/.test(block(".nv-btn")), ".nv-btn com position prenderia o toque estendido ao botão");
  assert.match(block(".nv-root .nv-hit"), /position: static/);
});

test("toda peça que se toca afunda quando o dedo aperta", () => {
  for (const selector of [
    ".nv-btn:active:not(:disabled):not(.nv-hit)",
    ".nv-bag:active:not(:disabled)",
    ".nv-orb:active",
    ".nv-icon-btn:active",
    ".nv-step button:active",
    ".nv-quick-btn:active",
    ".nv-cat:active .nv-cat-tile",
    ".nv-tab:active",
    "button.nv-now-cell:active",
  ]) {
    assert.match(block(selector), /transform: translateY\(/, selector);
  }
  // Os cartões inteiros afundam por dentro (:has), porque o botão deles é invisível.
  for (const selector of [".nv-dish:has(.nv-dish-hit:active)", ".nv-promo:has(.nv-hit:active)", ".nv-sales:has(.nv-hit:active)", ".nv-job:has(.nv-hit:active)", ".nv-cross-bubble:has(.nv-hit:active)"]) {
    assert.match(block(selector), /transform: translateY\(/, selector);
  }
});

test("quem pediu menos movimento recebe a mudança sem animação", () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.nv-root :where\(button, a\) \{\s*transition: none;/);
});

test("o que só informa fica liso: pílulas, espera, ícone do aviso e etiquetas não têm borda grossa", () => {
  for (const selector of [".nv-fact", ".nv-wait", ".nv-todo-icon", ".nv-ticket-where", ".nv-job-chips span", ".nv-notice", ".nv-empty"]) {
    assert.ok(!/box-shadow/.test(block(selector)), `${selector} parece botão sem ser`);
  }
});

test("a borda grossa é a regra de cada tecla: botão, sacola, bolinha, categoria, atalho, passo", () => {
  for (const selector of [".nv-btn", ".nv-bag", ".nv-orb", ".nv-cat-tile", ".nv-quick-btn", ".nv-dish", ".nv-icon-btn", ".nv-step button", ".nv-sales", ".nv-job"]) {
    assert.match(block(selector), /box-shadow:/, selector);
  }
  assert.match(block(".nv-btn"), /0 var\(--nv-depth\) 0 var\(--nv-edge\)/);
});

test("campo de escrever é afundado: o contrário da tecla", () => {
  for (const selector of [".nv-search", ".nv-field"]) {
    assert.match(block(selector), /box-shadow: inset 0 3px/, selector);
  }
});

test("a lista de pratos é de dois por linha (a foto é o que vende); voltar para três é trocar um número", () => {
  assert.match(block(".nv-grid"), /repeat\(2, minmax\(0, 1fr\)\)/);
});

test("caixas do Hoje só viram tecla quando levam a uma tela", () => {
  const today = read("OwnerToday.tsx");
  assert.match(today, /<button key=\{cell\.text\} type="button" className="nv-now-cell"/);
  assert.match(today, /<div key=\{cell\.text\} className="nv-now-cell">/);
  assert.match(today, /className="nv-link nv-hit"/);
  assert.match(today, /className="nv-todo-icon"/);
});

test("botão de menu que não leva a lugar nenhum não aparece", () => {
  assert.match(read("parts.tsx"), /showMenu = false/);
  for (const name of ["Kitchen.tsx", "OwnerToday.tsx", "JobsHome.tsx"]) {
    assert.match(read(name), /onMenu=\{onMenu\} showMenu=\{showMenu\}/, name);
  }
});

test("Vem Trabalhar: os campos escrevem de verdade, o cartão da vaga e o balão inteiros tocam", () => {
  const jobs = read("JobsHome.tsx");
  assert.match(jobs, /<form\s+className="nv-find"/);
  assert.match(jobs, /<input\s+type="search"/);
  assert.match(jobs, /className="nv-btn is-fire nv-hit"/);
  assert.match(jobs, /className="nv-cross-link nv-hit"/);
  assert.ok(!/<span>Cargo ou palavra-chave<\/span>/.test(jobs), "campo de mentira (texto num label) voltou");
});

test("a cozinha só avança o pedido pelo botão grande: a comanda não é um toque estendido", () => {
  const kitchen = read("Kitchen.tsx");
  assert.ok(!/nv-hit/.test(kitchen));
  assert.match(kitchen, /className="nv-btn is-green is-block"/);
});

test("escolhas e sacola: toda tecla nova tem borda grossa, afunda no toque e tem altura de dedo", () => {
  for (const selector of [".nv-opt", ".nv-pick"]) {
    assert.match(block(selector), /box-shadow: var\(--nv-card-3d\)/, selector);
    assert.match(block(selector), /min-height: [67]\dpx/, selector);
  }
  assert.match(block(".nv-opt:active:not(.is-blocked):not(.is-on)"), /transform: translateY\(/);
  assert.match(block(".nv-pick:active:not(.is-on)"), /transform: translateY\(/);
  assert.match(block(".nv-btn.is-small"), /min-height: 44px/);
  assert.match(block(".nv-sheet-foot .nv-btn"), /min-height: 5\dpx/);
  assert.match(block(".nv-send"), /min-height: 6\dpx/);
  assert.match(block(".nv-step button:disabled"), /opacity: 0\.4/);
});

test("a opção marcada afunda e fica verde; a solta sobe", () => {
  for (const selector of [".nv-opt.is-on", ".nv-pick.is-on"]) {
    assert.match(block(selector), /box-shadow: inset 0 3px/, selector);
    assert.match(block(selector), /background: var\(--nv-green-soft\)/, selector);
  }
});

test("o que só informa na sacola e nas escolhas fica liso; a comanda é painel de sombra macia", () => {
  for (const selector of [".nv-rule", ".nv-quote", ".nv-hint", ".nv-slip-detail", ".nv-slip-note"]) {
    assert.ok(!/box-shadow/.test(block(selector)), `${selector} parece botão sem ser`);
  }
  assert.match(block(".nv-slip"), /box-shadow: var\(--nv-panel-3d\)/);
});

test("campos de escrever da sacola e das escolhas são afundados, com letra de 16 px ou mais (o celular não dá zoom)", () => {
  const input = block(".nv-text input");
  assert.match(input, /box-shadow: inset 0 3px/);
  assert.match(input, /min-height: 5\dpx/);
  assert.match(input, /font: 500 (1[6-9]|2\d)px/);
});

test("a folha das escolhas é um diálogo, fecha pelo fundo escurecido e respeita menos movimento", () => {
  const sheet = read("Choices.tsx");
  assert.match(sheet, /role="dialog" aria-modal="true" aria-labelledby="nv-sheet-title"/);
  assert.match(sheet, /event\.target === event\.currentTarget/);
  assert.match(sheet, /aria-label="Fechar sem adicionar"/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.nv-backdrop,\s*\.nv-sheet \{\s*animation: none;/);
});

test("cada opção é a linha inteira (botão com papel e estado), e a escolha única é redonda, a de várias é quadrada", () => {
  const sheet = read("Choices.tsx");
  assert.match(sheet, /role=\{group\.single \? "radio" : "checkbox"\}/);
  assert.match(sheet, /aria-checked=\{item\.on\}/);
  assert.match(sheet, /role=\{group\.single \? "radiogroup" : "group"\}/);
  assert.match(block(".nv-opt-mark"), /border-radius: 8px/);
  assert.match(css, /\.nv-opts-list\[role="radiogroup"\] \.nv-opt-mark \{\s*border-radius: 50%/);
});

test("sacola: o menos de quem está em 1 vira lixeira, o envio espera enquanto envia e o erro é lido em voz alta", () => {
  const bag = read("Bag.tsx");
  assert.match(bag, /line\.quantity <= 1 \? <NvIcon name="trash" \/> : "−"/);
  assert.match(bag, /disabled=\{sending\}/);
  assert.match(bag, /<p ref=\{errorRef\} className="nv-error" role="alert">/);
  assert.match(bag, /Enviar pedido/);
  // Tirar o último é tirar o prato do pedido: o nome do botão diz isso.
  assert.match(bag, /Tirar \$\{line\.name\} do pedido/);
});
