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

// Contraste (WCAG): o texto pequeno das peças novas passa de 4,5:1, lido das cores do próprio CSS.
const token = (name) => {
  const found = css.match(new RegExp(`--nv-${name}: (#[0-9a-fA-F]{6})`));
  assert.ok(found, `não achei a cor --nv-${name}`);
  return found[1];
};
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test("o texto pequeno das escolhas e da sacola passa de 4,5:1 de contraste", () => {
  const pairs = [
    ["muted", "peach", "dica e texto de exemplo nos campos"],
    ["fire-deep", "peach", "etiqueta Obrigatório"],
    ["green", "paper", "preço da opção"],
    ["green", "green-soft", "preço da opção marcada"],
    ["ink", "green-soft", "nome da opção marcada"],
    ["alert", "alert-soft", "aviso em vermelho"],
    ["muted", "paper", "rótulo dos campos"],
    ["paper", "green", "texto dos botões verdes"],
    ["ink", "sun", "texto dos botões amarelos"],
  ];
  for (const [front, back, what] of pairs) {
    const ratio = contrast(token(front), token(back));
    assert.ok(ratio >= 4.5, `${what}: ${ratio.toFixed(2)}:1 (${front} sobre ${back})`);
  }
});

test("o texto de exemplo dos campos não é apagado por transparência (ficaria abaixo de 4,5:1)", () => {
  const placeholder = block(".nv-text input::placeholder");
  assert.match(placeholder, /opacity: 1/);
});

test("o contador da observação fica vermelho quando passa do limite", () => {
  assert.match(block(".nv-text small.is-over"), /color: var\(--nv-alert\)/);
  assert.match(read("Choices.tsx"), /choices\.note\.count > choices\.note\.max \? "is-over"/);
});

test("grupos de escolha única respondem às setas e só o marcado recebe o Tab (como grupo de rádio)", async () => {
  const keys = await import(new URL("keys.ts", DIR));
  assert.equal(keys.radioTab(0, false, false), 0, "ninguém marcado: o primeiro recebe o Tab");
  assert.equal(keys.radioTab(1, false, false), -1);
  assert.equal(keys.radioTab(1, true, true), 0, "o marcado recebe o Tab");
  assert.equal(keys.radioTab(0, false, true), -1, "marcado em outro: o primeiro não recebe");
  assert.match(read("keys.ts"), /ArrowDown[\s\S]*ArrowRight[\s\S]*ArrowUp[\s\S]*ArrowLeft/);
  assert.match(read("Choices.tsx"), /onKeyDown=\{group\.single \? onRadioKeys : undefined\}/);
  assert.match(read("Bag.tsx"), /onKeyDown=\{onRadioKeys\}/);
  assert.match(read("Bag.tsx"), /tabIndex=\{radioTab\(index, option\.on, options\.some/);
});

test("acompanhar o pedido: o andamento e a comanda são painéis de sombra macia; o que só informa fica liso", () => {
  assert.match(block(".nv-status"), /box-shadow: var\(--nv-panel-3d\)/);
  assert.match(css.match(/\.nv-pix,\s*\.nv-rate \{[^}]*\}/)[0], /box-shadow: var\(--nv-panel-3d\)/);
  for (const selector of [".nv-handling", ".nv-steps li"]) {
    assert.ok(!/box-shadow/.test(block(selector)), `${selector} parece botão sem ser`);
  }
  assert.ok(!/box-shadow/.test(css.match(/\.nv-paid,\s*\.nv-thanks \{[^}]*\}/)[0]), "o aviso de pagamento recebido parece botão");
});

test("o código de entrega é grande, lido número a número por quem usa leitor de tela, e o desenho dos números é escondido dele", () => {
  const tracking = read("Tracking.tsx");
  assert.match(tracking, /className="nv-dcode-digits" aria-label=\{track\.deliveryCode\.spoken\}/);
  assert.match(tracking, /className="nv-dcode-digit" aria-hidden="true"/);
  assert.match(block(".nv-dcode-digit"), /font: 700 4\dpx/);
});

test("o andamento avisa a mudança em voz alta e marca a etapa de agora", () => {
  const tracking = read("Tracking.tsx");
  assert.match(tracking, /<h2 aria-live="polite">\{status\.headline\}<\/h2>/);
  assert.match(tracking, /aria-current=\{step\.state === "current" \? "step" : undefined\}/);
  assert.match(tracking, /<ol className="nv-steps" aria-label="Andamento do pedido"/);
});

test("Pix: o botão de copiar só vale com o código pronto, o erro é lido em voz alta e o QR tem texto alternativo", () => {
  const tracking = read("Tracking.tsx");
  assert.match(tracking, /disabled=\{!pix\.payload\} onClick=\{onCopy\}/);
  assert.match(tracking, /<p className="nv-error" role="alert">\s*\{PIX_ERROR_TEXT\}/);
  assert.match(tracking, /alt="QR code Pix deste pedido"/);
  assert.match(tracking, /<p className="nv-hint" role="status">\s*\{copiedText\(pix\.copied\)\}/);
});

test("Pix a pagar vem antes da comanda (é a próxima coisa a fazer); pago e 'acerta na hora' vêm depois", () => {
  const tracking = read("Tracking.tsx");
  const slip = tracking.indexOf('<section className="nv-slip"');
  const pixAt = tracking.indexOf('track.payment.kind === "pix" && pix ?');
  const paidAt = tracking.indexOf('track.payment.kind === "paid" ?');
  assert.ok(pixAt > 0 && pixAt < slip, "o Pix deve vir antes da comanda");
  assert.ok(paidAt > slip, "o pagamento recebido vem depois da comanda");
});

test("'Fechar este pedido' só aparece com o pedido pronto, e a avaliação tem teclas, comentário e envio", () => {
  const tracking = read("Tracking.tsx");
  assert.match(tracking, /status\.done && onDismiss \?/);
  assert.match(tracking, /<fieldset className="nv-rate-group">/);
  assert.match(tracking, /disabled=\{!rating\.canSend\}/);
  assert.match(block(".nv-picks.is-4"), /repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 380px\) \{\s*\.nv-picks\.is-4 \{\s*grid-template-columns: repeat\(2/);
});

test("texto das peças de acompanhar passa de 4,5:1 (inclui o texto cinza sobre o painel verde de pedido pronto)", () => {
  for (const [front, back] of [["muted", "green-soft"], ["muted", "paper"], ["ink", "peach"]]) {
    assert.ok(contrast(token(front), token(back)) >= 4.5, `${front} sobre ${back}`);
  }
  assert.ok(contrast(token("ink"), "#fff3cf") >= 4.5, "o código de entrega sobre o painel amarelo");
  assert.ok(contrast(token("muted"), "#fffdf7") >= 4.5, "o detalhe do prato sobre a comanda");
});

test("ícone dentro de botão tem tamanho de ícone (sem isso o desenho ocupa o botão inteiro)", () => {
  assert.match(block(".nv-btn svg"), /width: 24px/);
  assert.match(block(".nv-btn svg"), /height: 24px/);
});

test("em celular de 320 px a barra da sacola cabe com a bolinha de voz (uma linha para cada texto)", () => {
  assert.match(css, /@media \(max-width: 340px\) \{[^@]*\.nv-bag \{\s*gap: 6px;\s*padding: 0 16px;\s*font-size: 15px;/);
  assert.match(css, /\.nv-bag strong \{\s*font-size: 18px;\s*white-space: nowrap;/);
});

test("o telefone do endereço de entrega não quebra no meio do número", () => {
  assert.match(read("Tracking.tsx"), /<span className="nv-nowrap">\{track\.handling\.phone\}<\/span>/);
  assert.match(block(".nv-nowrap"), /white-space: nowrap/);
});
