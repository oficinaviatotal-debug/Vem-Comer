// Letra grande do celular (quem aumentou o tamanho do texto): nada pode rolar de lado nem ficar cortado.
// Aumenta todas as letras da tela pelo FATOR (1,5 e 2 são o que o Android e o iPhone dão no máximo, sem a ampliação de tela).
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { iniciar, SAIDA } from "./comum.mjs";

const FATOR = Number(process.env.FATOR || 1.5);
const app = await iniciar({ largura: Number(process.env.LARGURA || 360) });
const largas = [];
const cortados = new Map();
for (const rota of app.rotas) {
  let pagina;
  try {
    pagina = await app.abrir(rota, 250);
    const r = await pagina.evaluate((fator) => {
      const todos = [...document.querySelectorAll("body *")];
      const tamanhos = todos.map((el) => parseFloat(getComputedStyle(el).fontSize));
      todos.forEach((el, i) => el.style.setProperty("font-size", `${tamanhos[i] * fator}px`, "important"));
      return new Promise((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const saida = { sobra: document.documentElement.scrollWidth - document.documentElement.clientWidth, cortados: [] };
            for (const el of document.querySelectorAll("a, button, label, h1, h2, h3, p, li, span, strong, small, b, input")) {
              const cs = getComputedStyle(el);
              if (cs.display === "none" || cs.visibility === "hidden" || el.closest(".nv-sr")) continue;
              // Por desenho, não é defeito: figura decorativa (aria-hidden), campo que rola o próprio texto, e fileira que o dedo rola de lado.
              if (el.closest("[aria-hidden='true']") || el.tagName === "INPUT") continue;
              const noTrilho = () => {
                for (let pai = el.parentElement; pai && pai !== document.body; pai = pai.parentElement) {
                  const x = getComputedStyle(pai).overflowX;
                  if ((x === "auto" || x === "scroll") && pai.scrollWidth > pai.clientWidth + 2) return true;
                }
                return false;
              };
              const emTrilho = noTrilho();
              // Texto que o desenho corta de propósito em 2 ou 3 linhas (line-clamp) continua inteiro para o leitor de tela.
              const recorteProposital = cs.getPropertyValue("-webkit-line-clamp") !== "none" && cs.getPropertyValue("-webkit-line-clamp") !== "";
              const temTexto = [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
              if (!temTexto && el.tagName !== "INPUT") continue;
              const delado = !emTrilho && el.scrollWidth - el.clientWidth > 2 && (cs.overflowX !== "visible" || cs.textOverflow === "ellipsis");
              const embaixo = !recorteProposital && el.scrollHeight - el.clientHeight > 2 && cs.overflowY !== "visible";
              const caixa = el.getBoundingClientRect();
              const fora = !emTrilho && (caixa.right > document.documentElement.clientWidth + 2 || caixa.left < -2);
              if (delado || embaixo || fora) saida.cortados.push({ tag: el.tagName.toLowerCase(), classe: String(el.className).slice(0, 50), texto: (el.textContent || "").trim().slice(0, 30), motivo: fora ? "fora da tela" : delado ? "cortado de lado" : "cortado embaixo" });
            }
            resolve(saida);
          }),
        ),
      );
    }, FATOR);
    if (r.sobra > 2) largas.push({ tela: rota, por: r.sobra });
    for (const c of r.cortados) {
      const chave = `${c.tag}.${c.classe}|${c.motivo}`;
      if (!cortados.has(chave)) cortados.set(chave, { tela: rota, ...c });
    }
  } catch (e) {
    console.log("  ERRO", rota, e.message.split("\n")[0]);
  }
  await pagina?.close();
}
await app.encerrar();
writeFileSync(join(SAIDA, `letra-grande-${app.largura}-${FATOR}.json`), JSON.stringify({ largas, cortados: [...cortados.values()] }, null, 1));
console.log(`letra grande x${FATOR} em ${app.largura}px: telas que rolam de lado: ${largas.length}; textos cortados (tipos): ${cortados.size}`);
for (const l of largas.slice(0, 25)) console.log(`  rola de lado ${l.por}px  ${l.tela}`);
for (const c of [...cortados.values()].slice(0, 40)) console.log(`  ${c.motivo}  ${c.tela}  <${c.tag} class="${c.classe}"> "${c.texto}"`);
if (largas.length > 0) process.exitCode = 1;
