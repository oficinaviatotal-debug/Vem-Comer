import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

/**
 * Acessibilidade do visual novo (pedido do GD, 23/10/2026 21:22: "verificando os botões, os comandos, a acessibilidade").
 *
 * A medição de verdade (leitor automático axe, contraste pixel a pixel, tamanho de dedo, foco, letra grande) roda no navegador
 * com `tests/navegador/acessibilidade/rodar.sh`, que o GitHub não tem. Estes testes guardam, sem navegador, o que essa
 * medição consertou, para que não volte: as contas de contraste das cores do sistema visual e as regras de HTML e de CSS que
 * deram defeito.
 */
const DIR = new URL("../../frontend/src/novo/", import.meta.url);
const read = (name) => readFileSync(new URL(name, DIR), "utf8");
const css = read("novo.css");
const tsx = readdirSync(DIR).filter((name) => name.endsWith(".tsx") && name !== "preview.tsx");

// ---------------------------------------------------------------- contraste (WCAG 2.2, 1.4.3)

const hex = (value) => {
  const clean = value.replace("#", "");
  return [0, 2, 4].map((at) => parseInt(clean.slice(at, at + 2), 16));
};
const channel = (v) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const ratio = (a, b) => {
  const [hi, lo] = [luminance(hex(a)), luminance(hex(b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** Cor com um véu de branco por cima (o "brilho" dos botões em relevo), no ponto onde a letra fica. */
const veil = (color, alpha) => "#" + hex(color).map((v) => Math.round(v * (1 - alpha) + 255 * alpha).toString(16).padStart(2, "0")).join("");

/** As cores de um bloco `.seletor { --nv-x: valor; ... }`. */
const tokens = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const found = css.match(new RegExp(`(?:^|\\n)${escaped} \\{([^}]*)\\}`));
  assert.ok(found, `não achei o bloco ${selector}`);
  return Object.fromEntries([...found[1].matchAll(/(--nv-[a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]));
};
/**
 * O brilho dos botões em relevo (`--nv-shine`): branco que começa em X% no topo e some em Y% da altura.
 * `shineAt(0.3)` é o véu no ponto onde começa a letra de uma linha só (uns 30% da altura do botão).
 */
const shine = css.match(/--nv-shine:\s*linear-gradient\(180deg,\s*rgba\(255,\s*255,\s*255,\s*([0-9.]+)\),\s*rgba\(255,\s*255,\s*255,\s*0\)\s*([0-9.]+)%\)/);
assert.ok(shine, "não achei o brilho (--nv-shine) no CSS");
const SHINE_TOP = Number(shine[1]);
const SHINE_END = Number(shine[2]) / 100;
const shineAt = (fraction) => SHINE_TOP * Math.max(0, 1 - fraction / SHINE_END);
const LETTER_TOP = 0.3;
const comer = tokens(".nv-root");
const work = { ...comer, ...tokens(".nv-work") };

for (const [name, theme] of [["Vem Comer", comer], ["Vem Trabalhar", work]]) {
  test(`${name}: o texto de apoio passa de 4,5:1 em todos os fundos claros`, () => {
    for (const back of ["--nv-paper", "--nv-peach", "--nv-green-soft"]) {
      const value = ratio(theme["--nv-muted"], theme[back]);
      assert.ok(value >= 4.5, `${theme["--nv-muted"]} sobre ${back} (${theme[back]}) dá ${value.toFixed(2)}`);
    }
  });

  test(`${name}: o texto principal e o do link passam de 4,5:1 nos fundos claros`, () => {
    for (const back of ["--nv-paper", "--nv-peach", "--nv-green-soft"]) {
      assert.ok(ratio(theme["--nv-ink"], theme[back]) >= 7, `tinta sobre ${back}`);
      const link = ratio(theme["--nv-fire-text"], theme[back]);
      assert.ok(link >= 4.5, `link ${theme["--nv-fire-text"]} sobre ${back} (${theme[back]}) dá ${link.toFixed(2)}`);
    }
  });

  test(`${name}: o aviso de erro passa de 4,5:1 no fundo dele e no branco`, () => {
    assert.ok(ratio(theme["--nv-alert"], theme["--nv-alert-soft"]) >= 4.5);
    assert.ok(ratio(theme["--nv-alert"], theme["--nv-paper"]) >= 4.5);
  });
}

test("Vem Comer: a letra escura sobre o botão laranja passa de 4,5:1, mesmo no ponto mais claro do brilho", () => {
  assert.match(css, /\.nv-btn\.is-fire \{[^}]*color: #1b1200/);
  const bright = veil(comer["--nv-fire"], SHINE_TOP);
  assert.ok(ratio("#1b1200", bright) >= 4.5, `no ponto mais claro do botão: ${ratio("#1b1200", bright).toFixed(2)}`);
});

test("Vem Trabalhar: a letra branca sobre o botão azul passa de 4,5:1 onde a letra começa", () => {
  assert.match(css, /\.nv-work \.nv-btn\.is-fire \{[^}]*color: #fff/);
  const where = veil(work["--nv-fire"], shineAt(LETTER_TOP));
  assert.ok(ratio("#ffffff", where) >= 4.5, `${work["--nv-fire"]} com o brilho do ponto da letra dá ${ratio("#ffffff", where).toFixed(2)}`);
  assert.ok(ratio("#ffffff", work["--nv-fire"]) >= 5.5, "e sem o brilho, folgado");
});

test("os balõezinhos de atalho (azul e laranja) têm letra branca acima de 4,5:1 onde a letra começa", () => {
  const bubble = css.match(/\.nv-cross-bubble \{[^}]*background: var\(--nv-shine\), (#[0-9a-f]{6})/);
  const food = css.match(/\.nv-cross-bubble\.is-food \{[^}]*background: var\(--nv-shine\), (#[0-9a-f]{6})/);
  assert.ok(bubble && food, "os dois balões usam cor fixa com o brilho");
  for (const [name, found] of [["azul", bubble], ["laranja", food]]) {
    const value = ratio("#ffffff", veil(found[1], shineAt(LETTER_TOP)));
    assert.ok(value >= 4.5, `balão ${name} ${found[1]} dá ${value.toFixed(2)}`);
  }
});

test("o cartão que está sendo mudado fica de lado sem apagar demais as letras (opacidade 0,8 ou mais)", () => {
  const block = css.match(/\.nv-dishcard\.is-editing \{([^}]*)\}/);
  assert.ok(block, "não achei o cartão em edição");
  const opacity = Number(/opacity:\s*([0-9.]+)/.exec(block[1])?.[1]);
  assert.ok(opacity >= 0.8, `opacidade ${opacity}: com 0,6 as etiquetas davam 3,2:1`);
});

// ---------------------------------------------------------------- HTML que o leitor de tela entende

test("o papel de aviso (status, alert) não vai num <li>: dentro de lista ele quebra a lista", () => {
  for (const name of tsx) {
    const source = read(name);
    assert.ok(!/<li\b[^>]*\brole=/.test(source), `${name}: <li> com role`);
  }
  const notices = read("Notices.tsx");
  assert.match(notices, /<p className="nv-notice-text" role=\{notice\.tone === "urgent" \? "alert" : "status"\}>/);
});

test("aria-label só vai em quem pode ter nome: <p>, <span> e <div> pedem um role junto", () => {
  for (const name of tsx) {
    const source = read(name);
    for (const tag of source.matchAll(/<(p|span|div)\b([^>]*)>/g)) {
      // Região, lista e item de lista (<section>, <ul>, <ol>, <li>) têm papel próprio e aceitam nome;
      // parágrafo e "genérico" (<p>, <span>, <div>) não: o leitor de tela ignora o nome sem um role.
      if (!/\baria-label(ledby)?=/.test(tag[2])) continue;
      assert.match(tag[2], /\brole=/, `${name}: <${tag[1]}${tag[2].slice(0, 60)}…> tem aria-label sem role`);
    }
  }
});

test("o código de entrega é lido pelo nome falado (role=img), não dígito por dígito", () => {
  assert.match(read("Tracking.tsx"), /<p className="nv-dcode-digits" role="img" aria-label=\{track\.deliveryCode\.spoken\}>/);
});

test("o atalho para o outro lado (trabalho, fome) fica dentro de um ponto de referência (nav com nome)", () => {
  for (const name of ["ShopMenu.tsx", "JobsHome.tsx"]) {
    assert.match(read(name), /<nav className="nv-cross" aria-label="Outro caminho">/, name);
    assert.doesNotMatch(read(name), /<div className="nv-cross">/, name);
  }
});

// ---------------------------------------------------------------- letra grande (quem aumentou o texto do celular)

test("letra grande: as abas descem de linha em vez de sair da tela, e o número vai para baixo do nome", () => {
  assert.match(css, /\.nv-tabs \{[^}]*grid-template-columns: repeat\(auto-fit, minmax\(max\(3\.3em, 30%\), 1fr\)\)/);
  assert.match(css, /\.nv-tab \{[^}]*flex-wrap: wrap/);
});

test("letra grande: linhas de conta, número do dia, etapas e células do Hoje deixam a palavra quebrar", () => {
  assert.match(css, /\.nv-leader \{[^}]*flex-wrap: wrap/);
  assert.match(css, /\.nv-leader b \{[^}]*white-space: nowrap/);
  assert.match(css, /\.nv-sales-total \{[^}]*overflow-wrap: anywhere/);
  assert.match(css, /\.nv-steps li \{[^}]*overflow-wrap: anywhere/);
  assert.match(css, /\.nv-now-row \{[^}]*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.nv-now-cell \{[^}]*overflow-wrap: anywhere/);
  assert.match(css, /\.nv-dishlist-head \{[^}]*flex-wrap: wrap/);
});

test("letra grande: mensagens (erro, aviso, dica, vazio) quebram e-mails e números compridos", () => {
  const group = css.match(/(\.nv-error,\n(?:\.nv-[a-z-]+,\n)+\.nv-[a-z-]+) \{([^}]*)\}/);
  assert.ok(group, "não achei o grupo de mensagens");
  for (const name of [".nv-error", ".nv-ok", ".nv-hint", ".nv-empty", ".nv-code-hint", ".nv-notice-text"]) assert.ok(group[1].includes(name), name);
  assert.match(group[2], /overflow-wrap: anywhere/);
});
