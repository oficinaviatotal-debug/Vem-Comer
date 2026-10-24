// Tamanho de dedo (44 × 44 px) e foco visível (contorno de 2 px ou mais ao andar com a tecla Tab) em todas as telas.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { iniciar, SAIDA } from "./comum.mjs";

const app = await iniciar();
const pequenos = new Map(); // tipo -> primeiro exemplo
const semFoco = new Map();
let elementos = 0;
for (const rota of app.rotas) {
  let pagina;
  try {
    pagina = await app.abrir(rota);
    // 1) tamanho
    const tamanhos = await pagina.evaluate(() => {
      const saida = [];
      const seletor = "a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=radio], [role=tab], [tabindex]:not([tabindex='-1'])";
      for (const el of document.querySelectorAll(seletor)) {
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none") continue;
        if (el.closest(".nv-sr")) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        // O toque de um campo dentro de um rótulo vale pelo rótulo inteiro; o botão com .nv-hit toca pelo cartão/balão que o contém.
        const dono = el.classList.contains("nv-hit")
          ? [...(function* () {
              for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) yield p;
            })()].find((p) => getComputedStyle(p).position !== "static")
          : null;
        const caixa = el.closest("label")?.getBoundingClientRect() ?? dono?.getBoundingClientRect() ?? r;
        saida.push({ tag: el.tagName.toLowerCase(), classe: String(el.className).slice(0, 50), tipo: el.getAttribute("type") || "", nome: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30), w: Math.round(caixa.width), h: Math.round(caixa.height), noTexto: Boolean(el.closest("p, li, span.nv-hint")) && el.tagName === "A" });
      }
      return saida;
    });
    elementos += tamanhos.length;
    for (const t of tamanhos) {
      if ((t.w < 44 || t.h < 44) && !(t.tipo === "checkbox" || t.tipo === "radio")) {
        const chave = `${t.tag}.${t.classe}`;
        if (!pequenos.has(chave)) pequenos.set(chave, { tela: rota, ...t });
      }
    }
    // 2) foco: anda com Tab e confere o contorno de cada um
    for (let i = 0; i < 45; i += 1) {
      await pagina.keyboard.press("Tab");
      const foco = await pagina.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        const envolve = el.closest("label, .nv-field, .nv-dish, .nv-job");
        const es = envolve ? getComputedStyle(envolve) : null;
        const proprio = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2;
        const doCartao = es && es.outlineStyle !== "none" && parseFloat(es.outlineWidth) >= 2;
        return { ok: proprio || doCartao, tag: el.tagName.toLowerCase(), classe: String(el.className).slice(0, 50), nome: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30), sombra: cs.boxShadow.slice(0, 60) };
      });
      if (!foco) break;
      if (!foco.ok) {
        const chave = `${foco.tag}.${foco.classe}`;
        if (!semFoco.has(chave)) semFoco.set(chave, { tela: rota, ...foco });
      }
    }
  } catch (e) {
    console.log("  ERRO", rota, e.message.split("\n")[0]);
  }
  await pagina?.close();
}
await app.encerrar();
writeFileSync(join(SAIDA, `dedo-e-foco-${app.largura}.json`), JSON.stringify({ pequenos: [...pequenos.values()], semFoco: [...semFoco.values()] }, null, 1));
console.log(`dedo e foco, ${app.largura}px: ${elementos} elementos tocáveis medidos`);
console.log(`  menores que 44 px: ${pequenos.size} tipos`);
for (const v of pequenos.values()) console.log(`    ${v.w}x${v.h} ${v.noTexto ? "(link no texto) " : ""}${v.tela}  <${v.tag} class="${v.classe}"> "${v.nome}"`);
console.log(`  sem contorno de foco (tecla Tab): ${semFoco.size} tipos`);
for (const v of semFoco.values()) console.log(`    ${v.tela}  <${v.tag} class="${v.classe}"> "${v.nome}"  sombra: ${v.sombra}`);
// link no meio de um texto corrido pode ser menor (WCAG 2.5.8, exceção "em linha"); o resto não
if ([...pequenos.values()].some((v) => !v.noTexto) || semFoco.size > 0) process.exitCode = 1;
