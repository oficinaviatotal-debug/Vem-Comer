// Contraste de verdade onde o leitor automático não consegue calcular (fundo em degradê, relevo 3D, pseudo-elementos):
// esconde a letra, fotografa o fundo que ficou atrás dela e mede o pior contraste contra a cor da letra.
// Mínimo: 4,5:1 (3:1 para letra grande: 24 px ou mais, ou 18,66 px em negrito).
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { iniciar, pngjs, SAIDA } from "./comum.mjs";

const { PNG } = pngjs();
const app = await iniciar();
const lin = (v) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const razao = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

const vistos = new Set(); // o mesmo tipo de texto (marca, classe, cor, tamanho) só precisa ser medido uma vez
const falhas = [];
let medidos = 0;
for (const rota of app.rotas) {
  let pagina;
  try {
    pagina = await app.abrir(rota);
    const escolhidos = await pagina.evaluate((chaves) => {
      const saida = [];
      const ja = new Set(chaves);
      let n = 0;
      for (const el of document.querySelectorAll("body *")) {
        const proprios = [...el.childNodes].filter((c) => c.nodeType === 3 && c.textContent.trim().length > 0);
        if (proprios.length === 0) continue;
        // Emoji é figura colorida: ignora a cor da letra (a medição, que apaga a letra, não consegue apagá-lo) e não é texto para o contraste.
        if (proprios.every((c) => /^[\p{Extended_Pictographic}\u200d\ufe0f\u{1F3FB}-\u{1F3FF}\s]+$/u.test(c.textContent))) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
        const caixa = el.getBoundingClientRect();
        if (caixa.width < 6 || caixa.height < 6) continue;
        let no = el;
        let desligado = false;
        let soLeitor = false;
        while (no && no !== document.body) {
          if (no.disabled || no.getAttribute("aria-disabled") === "true") desligado = true;
          if (no.classList && no.classList.contains("nv-sr")) soLeitor = true;
          no = no.parentElement;
        }
        if (soLeitor) continue;
        const chave = [el.tagName, el.className, cs.color, cs.fontSize, cs.fontWeight, desligado].join("|");
        if (ja.has(chave)) continue;
        ja.add(chave);
        el.setAttribute("data-ctr", String(n));
        saida.push({ n, chave, tag: el.tagName.toLowerCase(), classe: String(el.className).slice(0, 60), texto: proprios.map((c) => c.textContent.trim()).join(" ").slice(0, 40), cor: cs.color, tamanho: parseFloat(cs.fontSize), peso: Number(cs.fontWeight) || 400, desligado });
        n += 1;
      }
      return saida;
    }, [...vistos]);
    for (const p of escolhidos) {
      vistos.add(p.chave);
      if (p.desligado) continue; // botão desligado não precisa de contraste (WCAG 1.4.3)
      const alvo = pagina.locator(`[data-ctr="${p.n}"]`).first();
      try {
        await alvo.evaluate((el) => {
          el.style.setProperty("color", "transparent", "important");
          el.style.setProperty("text-shadow", "none", "important");
          el.querySelectorAll("*").forEach((c) => c.style.setProperty("color", "transparent", "important"));
        });
        // O painel rola por dentro de uma caixa: a foto é da janela, no lugar onde o texto está agora.
        const onde = await alvo.evaluate((el) => {
          el.scrollIntoView({ block: "center", inline: "nearest" });
          const retangulos = [];
          for (const no of el.childNodes) {
            if (no.nodeType !== 3 || !no.textContent.trim()) continue;
            const faixa = document.createRange();
            faixa.selectNodeContents(no);
            for (const r of faixa.getClientRects()) if (r.width > 1 && r.height > 1) retangulos.push(r);
          }
          if (retangulos.length === 0) return null;
          const x0 = Math.min(...retangulos.map((r) => r.left));
          const y0 = Math.min(...retangulos.map((r) => r.top));
          const x1 = Math.max(...retangulos.map((r) => r.right));
          const y1 = Math.max(...retangulos.map((r) => r.bottom));
          const em_cima = document.elementFromPoint((x0 + x1) / 2, (y0 + y1) / 2);
          const visivel = Boolean(em_cima) && (em_cima === el || el.contains(em_cima) || em_cima.contains(el));
          return { x: x0, y: y0, width: x1 - x0, height: y1 - y0, visivel };
        });
        if (!onde || !onde.visivel || onde.x < 0 || onde.y < 0 || onde.y + onde.height > app.altura || onde.x + onde.width > app.largura + 1) continue;
        const png = PNG.sync.read(await pagina.screenshot({ clip: { x: onde.x, y: onde.y, width: onde.width, height: onde.height }, animations: "disabled", timeout: 4000 }));
        const cor = /rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?\)/.exec(p.cor);
        if (!cor) continue;
        const letra = [Number(cor[1]), Number(cor[2]), Number(cor[3])];
        const opacidade = cor[4] === undefined ? 1 : Number(cor[4]);
        const razoes = [];
        for (let y = 0; y < png.height; y += 1) {
          for (let x = 0; x < png.width; x += 1) {
            const i = (png.width * y + x) << 2;
            const fundo = [png.data[i], png.data[i + 1], png.data[i + 2]];
            const misturada = letra.map((c, k) => c * opacidade + fundo[k] * (1 - opacidade));
            razoes.push(razao(lum(...misturada), lum(...fundo)));
          }
        }
        if (razoes.length === 0) continue;
        razoes.sort((a, b) => a - b);
        const pior = razoes[Math.floor(razoes.length * 0.03)]; // 3º percentil: ignora pontos soltos
        const grande = p.tamanho >= 24 || (p.tamanho >= 18.66 && p.peso >= 700);
        const minimo = grande ? 3 : 4.5;
        medidos += 1;
        if (pior < minimo) falhas.push({ tela: rota, ...p, pior: Number(pior.toFixed(2)), minimo });
      } catch {
        /* o elemento saiu da tela */
      }
    }
  } catch (e) {
    console.log("  ERRO", rota, e.message.split("\n")[0]);
  }
  await pagina?.close();
}
await app.encerrar();
writeFileSync(join(SAIDA, `contraste-${app.largura}.json`), JSON.stringify(falhas, null, 1));
console.log(`contraste, ${app.largura}px: ${medidos} combinações de texto medidas, ${falhas.length} abaixo do mínimo`);
for (const f of falhas) console.log(`  ${f.pior} < ${f.minimo}  ${f.tela}  <${f.tag} class="${f.classe}"> "${f.texto}"  cor ${f.cor} ${f.tamanho}px/${f.peso}`);
if (falhas.length > 0) process.exitCode = 1;
