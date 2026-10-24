// Peças que as quatro medições de acessibilidade usam em comum: achar as ferramentas, servir a página de conferência,
// abrir o navegador e listar as telas.
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const AQUI = fileURLToPath(new URL(".", import.meta.url));
export const RAIZ = join(AQUI, "..", "..", "..");

/** Onde procurar playwright, axe-core e pngjs: FERRAMENTAS (se existir), esta pasta, o front, e o lugar comum do ambiente da Anthropic. */
const LUGARES = [process.env.FERRAMENTAS, join(AQUI, "node_modules"), join(RAIZ, "frontend", "node_modules"), "/opt/npm-tools/node_modules"].filter(Boolean);

function achar(nome, resolver) {
  for (const lugar of LUGARES) {
    try {
      const req = createRequire(join(lugar, "/"));
      return resolver(req);
    } catch {
      /* tenta o próximo lugar */
    }
  }
  throw new Error(`Não achei "${nome}". Rode: cd tests/navegador/acessibilidade && npm install (ou aponte FERRAMENTAS para uma pasta node_modules que o tenha).`);
}

export const playwright = () => achar("playwright", (req) => req("playwright"));
export const pngjs = () => achar("pngjs", (req) => req("pngjs"));
export const axeFonte = () => readFileSync(achar("axe-core", (req) => req.resolve("axe-core/axe.min.js")), "utf8");

const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".webmanifest": "application/manifest+json" };

/** Serve a pasta da página de conferência numa porta livre, só neste computador. */
export async function servir(pasta) {
  const base = normalize(pasta);
  const servidor = createServer((req, res) => {
    const pedido = decodeURIComponent(new URL(req.url, "http://local").pathname);
    const arquivo = normalize(join(base, pedido === "/" ? "preview-novo.html" : pedido));
    if (arquivo !== base && !arquivo.startsWith(base + sep)) return void res.writeHead(403).end();
    if (!existsSync(arquivo) || !statSync(arquivo).isFile()) return void res.writeHead(404).end();
    res.writeHead(200, { "content-type": TIPOS[extname(arquivo)] ?? "application/octet-stream" });
    res.end(readFileSync(arquivo));
  });
  await new Promise((pronto) => servidor.listen(0, "127.0.0.1", pronto));
  return { porta: servidor.address().port, fechar: () => servidor.close() };
}

/** Todas as telas da página de conferência (`#/rota`), lidas do próprio arquivo, para a lista nunca ficar velha. */
export function rotas() {
  if (process.env.ROTAS) return process.env.ROTAS.split(/\s+/).filter(Boolean);
  const fonte = readFileSync(join(RAIZ, "frontend", "src", "novo", "preview.tsx"), "utf8");
  const corpo = fonte.slice(fonte.indexOf("function Screen()"));
  const achadas = new Set(["loja"]); // a tela de entrada, quando nenhuma rota combina
  for (const m of corpo.matchAll(/route === "([a-z0-9-]+)"/g)) achadas.add(m[1]);
  for (const m of corpo.matchAll(/Record<string, \w+> = \{([\s\S]*?)\n  \};/g)) for (const k of m[1].matchAll(/^\s*"?([a-z0-9-]+)"?:/gm)) achadas.add(k[1]);
  for (const m of corpo.matchAll(/startsWith\("([a-z0-9-]+)"\)/g)) achadas.add(m[1]);
  return [...achadas];
}

/** Pasta do que a página de conferência gerou (o rodar.sh monta) e pasta dos resultados. */
export const PASTA = process.env.PASTA || join(tmpdir(), "vem-comer-conferencia");
export const SAIDA = process.env.SAIDA || join(tmpdir(), "vem-comer-acessibilidade");
mkdirSync(SAIDA, { recursive: true });

/** Abre o navegador e um contexto do tamanho de celular pedido; devolve também como abrir uma tela e como encerrar. */
export async function iniciar({ largura = Number(process.env.LARGURA || 390), altura = 844 } = {}) {
  if (!existsSync(join(PASTA, "preview-novo.html"))) throw new Error(`Falta a página de conferência em ${PASTA}. Rode tests/navegador/acessibilidade/rodar.sh (ele monta).`);
  const { chromium } = playwright();
  const servidor = await servir(PASTA);
  const navegador = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const contexto = await navegador.newContext({ viewport: { width: largura, height: altura }, locale: "pt-BR", reducedMotion: "reduce" });
  return {
    largura,
    altura,
    contexto,
    rotas: rotas(),
    async abrir(rota, espera = 300, aoErro = null) {
      const pagina = await contexto.newPage();
      if (aoErro) pagina.on("pageerror", (e) => aoErro(e.message));
      await pagina.goto(`http://127.0.0.1:${servidor.porta}/preview-novo.html#/${rota}`);
      await pagina.waitForSelector(".nv-root", { timeout: 8000 });
      await pagina.waitForTimeout(espera);
      return pagina;
    },
    async encerrar() {
      await navegador.close();
      servidor.fechar();
    },
  };
}
