import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../../frontend/", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const exists = (publicPath) => existsSync(new URL("public" + publicPath, root));

test("index.html links a manifest and icons that exist", () => {
  const html = read("index.html");
  assert.match(html, /rel="manifest" href="\/manifest\.json"/);
  assert.match(html, /name="theme-color"/);
  for (const [, href] of html.matchAll(/(?:rel="(?:icon|apple-touch-icon|preload)"[^>]*?href|href)="(\/[^"#?]+\.(?:png|ico|woff))"/g)) {
    assert.ok(exists(href), `index.html points to ${href}, which is not in frontend/public`);
  }
});

test("the manifest is valid JSON and every icon file exists", () => {
  const manifest = JSON.parse(read("public/manifest.json"));
  assert.equal(manifest.name, "Vem Comer");
  assert.ok(manifest.start_url);
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512"));
  assert.ok(manifest.icons.some((icon) => icon.purpose === "maskable"));
  for (const icon of manifest.icons) {
    assert.ok(exists(icon.src), `manifest icon ${icon.src} is missing`);
  }
});

test("every font in the stylesheet is shipped with the app (the CSP blocks other origins)", () => {
  const css = read("src/styles.css");
  const urls = [...css.matchAll(/url\("(\/fonts\/[^"]+)"\)/g)].map((match) => match[1]);
  assert.ok(urls.length >= 3, "expected the self-hosted font files");
  for (const url of urls) assert.ok(exists(url), `${url} is missing`);
  assert.equal(/fonts\.googleapis|fonts\.gstatic|@import url\(["']?https?:/.test(css), false);
});

test("font licenses travel with the font files", () => {
  assert.ok(exists("/fonts/OFL-BricolageGrotesque.txt"));
  assert.ok(exists("/fonts/OFL-InstrumentSans.txt"));
});

function sourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(path));
    else if (/\.(tsx?|css)$/.test(entry.name)) out.push(path);
  }
  return out;
}

test("every image or font path written in the source exists in frontend/public", () => {
  const src = fileURLToPath(new URL("src/", root));
  let found = 0;
  for (const file of sourceFiles(src)) {
    const text = readFileSync(file, "utf8");
    for (const [, path] of text.matchAll(/["'(](\/[\w./-]+\.(?:png|webp|jpe?g|svg|ico|woff2?))["')]/g)) {
      found += 1;
      assert.ok(exists(path), `${file} points to ${path}, which is not in frontend/public`);
    }
  }
  assert.ok(found > 0, "expected at least the logo and the fonts");
});

test("no stock photo is bundled: a restaurant must not show another restaurant's food", () => {
  assert.equal(existsSync(new URL("public/images", root)), false);
});
