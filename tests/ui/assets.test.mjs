import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

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

test("every image the app shows exists, and no heavy PNG photo is left", () => {
  const app = read("src/App.tsx");
  const images = new Set([...app.matchAll(/"(\/images\/[^"]+)"/g)].map((match) => match[1]));
  assert.ok(images.size > 0);
  for (const image of images) assert.ok(exists(image), `${image} is missing`);
  assert.equal([...images].some((image) => image.endsWith(".png")), false);
});
