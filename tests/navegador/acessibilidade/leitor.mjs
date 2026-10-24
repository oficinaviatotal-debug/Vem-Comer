// Leitor automático de acessibilidade (axe-core: WCAG 2.2 AA e boas práticas) em todas as telas de conferência.
// Uso: LARGURA=390 node leitor.mjs   (vem do rodar.sh; veja README.md)
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { axeFonte, iniciar, SAIDA } from "./comum.mjs";

const app = await iniciar();
const axe = axeFonte();
const achados = {}; // regra -> { impacto, ajuda, elementos: [{ tela, alvo, html, resumo }] }
const erros = [];
const semConta = {}; // motivo -> [{ tela, alvo }]: contraste que o axe não consegue calcular (a medição do contraste.mjs cobre)
for (const rota of app.rotas) {
  let pagina;
  try {
    pagina = await app.abrir(rota, 350, (mensagem) => erros.push(`${rota}: ${mensagem}`));
    await pagina.evaluate(axe);
    const { violacoes, incompletos } = await pagina.evaluate(async () => {
      const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] }, resultTypes: ["violations", "incomplete"] });
      return {
        violacoes: r.violations.map((v) => ({ id: v.id, impacto: v.impact, ajuda: v.help, nos: v.nodes.map((n) => ({ alvo: n.target.join(" "), html: n.html.slice(0, 160), resumo: (n.failureSummary || "").replace(/\s+/g, " ").slice(0, 200) })) })),
        incompletos: r.incomplete.filter((v) => v.id === "color-contrast").flatMap((v) => v.nodes.map((n) => ({ alvo: n.target.join(" "), motivo: (n.any[0] && n.any[0].message) || "" }))),
      };
    });
    for (const n of incompletos) (semConta[n.motivo] ??= []).push({ tela: rota, alvo: n.alvo });
    for (const v of violacoes) {
      const entrada = (achados[v.id] ??= { impacto: v.impacto, ajuda: v.ajuda, elementos: [] });
      for (const n of v.nos) entrada.elementos.push({ tela: rota, ...n });
    }
  } catch (e) {
    erros.push(`${rota}: ${e.message.split("\n")[0]}`);
  }
  await pagina?.close();
}
await app.encerrar();
writeFileSync(join(SAIDA, `leitor-${app.largura}.json`), JSON.stringify({ achados, erros, semConta }, null, 1));
console.log(`leitor automático, ${app.largura}px: ${app.rotas.length} telas, ${erros.length} erros de carga, ${Object.keys(achados).length} tipos de defeito`);
for (const [id, v] of Object.entries(achados).sort((a, b) => b[1].elementos.length - a[1].elementos.length)) {
  const telas = new Set(v.elementos.map((n) => n.tela)).size;
  console.log(`  ${v.impacto.padEnd(8)} ${id.padEnd(30)} ${String(v.elementos.length).padStart(4)} elementos em ${String(telas).padStart(3)} telas: ${v.ajuda}`);
  for (const n of v.elementos.slice(0, 3)) console.log(`      ${n.tela}  ${n.alvo}`);
}
for (const [motivo, lista] of Object.entries(semConta)) console.log(`  contraste sem conta do axe (${lista.length}): ${motivo.slice(0, 100)}`);
for (const e of erros.slice(0, 15)) console.log("  ERRO", e);
if (Object.keys(achados).length > 0 || erros.length > 0) process.exitCode = 1;
