import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { Window } from "happy-dom";

const root = process.cwd();
const frontendRoot = path.join(root, "frontend");
const sourceRoots = [
  path.join(frontendRoot, "src"),
  path.join(frontendRoot, "index.html"),
];

const dangerousSourcePatterns = [
  { name: "innerHTML", re: /\.innerHTML\b/ },
  { name: "outerHTML", re: /\.outerHTML\b/ },
  { name: "insertAdjacentHTML", re: /insertAdjacentHTML\s*\(/ },
  { name: "document.write", re: /document\.write\s*\(/ },
  { name: "dangerouslySetInnerHTML", re: /dangerouslySetInnerHTML/ },
  { name: "javascript: URL", re: /javascript\s*:/i },
];

async function collectFiles(target) {
  const stat = await import("node:fs/promises").then(({ stat }) => stat(target));
  if (stat.isFile()) return [target];

  const entries = await readdir(target, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(full));
    else if (/\.(html|tsx?|jsx?|js)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const files = [];
for (const rootEntry of sourceRoots) files.push(...await collectFiles(rootEntry));

const findings = [];
for (const file of files) {
  const text = await readFile(file, "utf8");
  for (const pattern of dangerousSourcePatterns) {
    if (pattern.re.test(text)) {
      findings.push(`${path.relative(root, file)} -> ${pattern.name}`);
    }
  }

  if (file.endsWith(".html") && /<[^>]+\son[a-z]+\s*=\s*/i.test(text)) {
    findings.push(`${path.relative(root, file)} -> inline event handler`);
  }
}

if (findings.length) {
  console.error("Dangerous client-side HTML/URL sinks found:");
  console.error(findings.join("\n"));
  process.exit(1);
}

const window = new Window({ url: "http://localhost:5174/" });
const document = window.document;
const attackerPayload = '<img src=x onerror="window.__xss = true"><script>window.__xss = true</script>';

const safeHost = document.createElement("div");
safeHost.textContent = attackerPayload;
document.body.appendChild(safeHost);

if (safeHost.querySelector("img,script")) {
  throw new Error("DOM simulation created executable HTML from attacker-controlled text");
}

if (safeHost.textContent !== attackerPayload) {
  throw new Error("DOM simulation did not preserve attacker payload as inert text");
}

const index = await readFile(path.join(frontendRoot, "index.html"), "utf8");
const csp = index.match(/http-equiv="Content-Security-Policy"[^>]*content="([^"]+)"/i)?.[1] ?? "";

for (const directive of [
  "default-src 'self'",
  "script-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
]) {
  if (!csp.includes(directive)) {
    throw new Error(`CSP missing required directive: ${directive}`);
  }
}

console.log(`PASS: scanned ${files.length} frontend source files; no dangerous HTML/URL sinks found.`);
console.log("PASS: malicious <img onerror> + <script> payload remained inert in Happy DOM.");
console.log("PASS: baseline CSP directives are present.");
