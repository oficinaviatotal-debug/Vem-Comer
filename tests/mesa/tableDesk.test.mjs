import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DESK_POLL_MS,
  NO_SCAN_TEXT,
  STATUS_DONE,
  activeOrdersOfTable,
  callsOfTable,
  cameraErrorMessage,
  codeMessage,
  deskTiles,
  numberFromTyped,
  readTableCode,
  scanSupport,
  tableById,
  tableByNumber,
  tableHeadline,
  tableTitle,
  tileNote,
} from "../../frontend/src/mesa/tableDeskLogic.ts";
import { STATUS_DONE as SERVER_DONE } from "../../frontend/src/service/orderStatus.ts";
import { menuFor, shortcutsFor } from "../../frontend/src/nav/navLogic.ts";

const T1 = "0b6f3a52-1111-4a2b-9c3d-000000000001";
const T2 = "0b6f3a52-1111-4a2b-9c3d-000000000002";
const tables = [
  { id: T2, number: 12, status: "free" },
  { id: T1, number: 4, status: "free" },
];
const ago = (min) => new Date(Date.now() - min * 60000).toISOString();

// ---------------------------------------------------------------- the QR

test("the QR of this restaurant's table opens that table", () => {
  const read = readTableCode(`https://vem.example/?empresa=dona-rosa&mesa=${T1}`, "dona-rosa");
  assert.deepEqual(read, { kind: "table", tableId: T1 });
});

test("the QR also works with a path, extra parameters and capital letters", () => {
  const link = `https://vem.example/app/index.html?utm=x&empresa=Dona-Rosa&mesa=${T1.toUpperCase()}#topo`;
  assert.deepEqual(readTableCode(link, "dona-rosa"), { kind: "table", tableId: T1 });
});

test("the QR of another restaurant never opens a table here", () => {
  const read = readTableCode(`https://vem.example/?empresa=pizzaria-da-bahia&mesa=${T1}`, "dona-rosa");
  assert.deepEqual(read, { kind: "other-restaurant" });
  assert.match(codeMessage(read, false), /outro restaurante/);
});

test("anything that is not a table link is refused in words", () => {
  const junk = [
    "",
    "   ",
    "mesa 4",
    "WIFI:T:WPA;S:casa;P:senha;;",
    "https://vem.example/?empresa=dona-rosa", // no table
    `https://vem.example/?mesa=${T1}`, // no restaurant
    "https://vem.example/?empresa=dona-rosa&mesa=4", // not an id
    `https://vem.example/?empresa=dona-rosa&mesa=${T1}&mesa=${T2}`, // two tables
    `https://vem.example/?empresa=dona-rosa&empresa=outro&mesa=${T1}`, // two restaurants
    `javascript:alert(1)//?empresa=dona-rosa&mesa=${T1}`,
    `ftp://vem.example/?empresa=dona-rosa&mesa=${T1}`,
    `https://vem.example/?empresa=dona-rosa&mesa=${T1}${"a".repeat(600)}`, // longer than the server ever makes
    null,
    undefined,
  ];
  for (const text of junk) {
    assert.deepEqual(readTableCode(text, "dona-rosa"), { kind: "not-a-table" }, String(text).slice(0, 40));
  }
  assert.match(codeMessage({ kind: "not-a-table" }, false), /não é de uma mesa/);
});

test("a table that is not in the register is said in words, not opened", () => {
  const read = readTableCode(`https://vem.example/?empresa=dona-rosa&mesa=${T1}`, "dona-rosa");
  assert.equal(codeMessage(read, true), "");
  assert.match(codeMessage(read, false), /não está no cadastro/);
  assert.equal(tableById(tables, "0b6f3a52-1111-4a2b-9c3d-0000000000ff"), null);
  assert.equal(tableById(tables, T1.toUpperCase())?.number, 4);
});

// ---------------------------------------------------------------- the number

test("4, 04 and 'mesa 4' are the same table", () => {
  for (const typed of ["4", "04", " 4 ", "mesa 4", "Mesa4", "MESA  4"]) {
    assert.equal(numberFromTyped(typed), 4, typed);
    assert.equal(tableByNumber(tables, typed)?.id, T1, typed);
  }
});

test("letters, zero, negative, decimals and huge numbers are not a table", () => {
  for (const typed of ["", "  ", "abc", "0", "00", "-4", "4.5", "4,5", "12345", "mesa", "4a", "1e3", null, undefined]) {
    assert.equal(numberFromTyped(typed), null, String(typed));
    assert.equal(tableByNumber(tables, typed), null, String(typed));
  }
});

test("a number that is not in the register finds nothing", () => {
  assert.equal(numberFromTyped("7"), 7);
  assert.equal(tableByNumber(tables, "7"), null);
});

// ---------------------------------------------------------------- orders and calls of a table

const orders = [
  { id: "o1", status: "PENDING_PAYMENT", order_type: "mesa", table_number: "4", customer_name: "Marcos", total_price: 64.9, created_at: ago(9) },
  { id: "o2", status: "em preparo", order_type: "mesa", table_number: "4", customer_name: "Lúcia", total_price: 38, created_at: ago(20) },
  { id: "o3", status: "concluido", order_type: "mesa", table_number: "4", customer_name: "Téo", total_price: 31, created_at: ago(70) },
  { id: "o4", status: "em preparo", order_type: "mesa", table_number: "12", customer_name: "Bia", total_price: 52, created_at: ago(11) },
  { id: "o5", status: "em preparo", order_type: "entrega", table_number: "4", customer_name: "Paulo", total_price: 99, created_at: ago(5) },
  { id: "o6", status: "em preparo", order_type: "mesa", table_number: null, customer_name: "Sem mesa", total_price: 10, created_at: ago(5) },
];

test("a table shows only its own orders that are still going, oldest first", () => {
  assert.deepEqual(activeOrdersOfTable(orders, 4).map((o) => o.id), ["o2", "o1"]);
  assert.deepEqual(activeOrdersOfTable(orders, 12).map((o) => o.id), ["o4"]);
  assert.deepEqual(activeOrdersOfTable(orders, 99), []);
});

test("a delivery with a table number, a finished order and an order with no table never count", () => {
  const ids = activeOrdersOfTable(orders, 4).map((o) => o.id);
  assert.ok(!ids.includes("o3") && !ids.includes("o5") && !ids.includes("o6"));
});

test("the word for a finished order is the one the server writes", () => {
  assert.equal(STATUS_DONE, SERVER_DONE);
});

const calls = [
  { id: "c1", table_number: 4, text: "Mesa 4 chama o garçom", waiting_seconds: 70 },
  { id: "c2", table_number: 12, text: "Mesa 12 pede a conta", waiting_seconds: 10 },
  { id: "c3", table_number: 4, text: "Mesa 4 pede água", waiting_seconds: 20 },
];

test("a table shows only its own calls", () => {
  assert.deepEqual(callsOfTable(calls, 4).map((c) => c.id), ["c1", "c3"]);
  assert.deepEqual(callsOfTable(calls, 5), []);
});

test("the list of tables is in order of number and says what was counted, never 'free' or 'busy'", () => {
  const tiles = deskTiles(tables, orders, calls);
  assert.deepEqual(tiles.map((t) => t.number), [4, 12]);
  assert.deepEqual(tiles[0], { id: T1, number: 4, calls: 2, orders: 2, tone: "call", note: "2 chamados" });
  assert.deepEqual(tiles[1], { id: T2, number: 12, calls: 1, orders: 1, tone: "call", note: "Chamando" });
  const quiet = deskTiles(tables, [], []);
  assert.deepEqual(quiet.map((t) => [t.tone, t.note]), [["quiet", "Sem pedido"], ["quiet", "Sem pedido"]]);
  for (const text of ["livre", "ocupada", "vazia"]) {
    for (const t of [...tiles, ...quiet]) assert.ok(!t.note.toLowerCase().includes(text), t.note);
  }
});

test("tile and headline words count correctly in singular and plural", () => {
  assert.equal(tileNote(0, 0), "Sem pedido");
  assert.equal(tileNote(0, 1), "1 pedido");
  assert.equal(tileNote(0, 3), "3 pedidos");
  assert.equal(tileNote(1, 5), "Chamando");
  assert.equal(tileNote(2, 0), "2 chamados");
  assert.equal(tableHeadline(0, 0), "Nenhum chamado e nenhum pedido em andamento");
  assert.equal(tableHeadline(1, 0), "1 chamado aberto");
  assert.equal(tableHeadline(2, 1), "2 chamados abertos e 1 pedido em andamento");
  assert.equal(tableHeadline(0, 2), "2 pedidos em andamento");
  assert.equal(tableTitle(4), "Mesa 4");
});

test("tables with no orders and no calls give an empty, honest list", () => {
  assert.deepEqual(deskTiles([], orders, calls), []);
});

// ---------------------------------------------------------------- the camera

test("the camera is offered only when the phone can really read a QR on a secure address and the site may use it", () => {
  const ok = { hasDetector: true, hasCamera: true, secure: true };
  assert.equal(scanSupport(ok), "camera");
  assert.equal(scanSupport({ ...ok, policyAllows: true }), "camera");
  assert.equal(scanSupport({ ...ok, policyAllows: undefined }), "camera");
  assert.equal(scanSupport({ ...ok, policyAllows: false }), "none");
  assert.equal(scanSupport({ ...ok, hasDetector: false }), "none");
  assert.equal(scanSupport({ ...ok, hasCamera: false }), "none");
  assert.equal(scanSupport({ ...ok, secure: false }), "none");
  assert.match(NO_SCAN_TEXT, /digite o número/);
});

test("each way the camera can fail has its own plain sentence, with a way out", () => {
  const names = ["NotAllowedError", "SecurityError", "NotFoundError", "NotReadableError", "AbortError", "Outro"];
  const texts = names.map(cameraErrorMessage);
  for (const text of texts) assert.match(text, /lista|digite|tente de novo/i);
  assert.match(cameraErrorMessage("NotAllowedError"), /bloqueada/);
  assert.match(cameraErrorMessage("NotReadableError"), /em uso/);
  assert.ok(DESK_POLL_MS >= 5000, "the screen should not hammer the server");
});

// ---------------------------------------------------------------- who sees it, and the server rule

const base = (role) => ({ role, allowed: () => true, hasPlanTab: false, platformAdmin: false, openOrders: 0, helpCount: null });
const viewsOf = (role) => menuFor(base(role)).flatMap((g) => g.items.map((i) => i.view));

test("'Abrir mesa' is for who serves the floor and for nobody else", () => {
  for (const role of ["OWNER", "MANAGER", "WAITER", "CASHIER"]) assert.ok(viewsOf(role).includes("mesa"), role);
  for (const role of ["KITCHEN", "COURIER", "", undefined, "VISITOR"]) assert.ok(!viewsOf(role).includes("mesa"), String(role));
});

test("the waiter's first big button is 'Abrir uma mesa'", () => {
  assert.equal(shortcutsFor("WAITER")[0].view, "mesa");
  assert.ok(menuFor(base("WAITER")).flatMap((g) => g.items).some((i) => i.view === "mesa"));
});

test("a blocked plan hides 'Abrir mesa'", () => {
  const blocked = menuFor({ ...base("WAITER"), allowed: (view) => ["pedidos", "acerto", "plano"].includes(view) });
  assert.ok(!blocked.flatMap((g) => g.items).some((i) => i.view === "mesa"));
});

// ---------------------------------------------------------------- what the files say

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("the server lets the site itself use the camera, and nobody else", () => {
  const caddy = read("../../deploy/vps/Caddyfile");
  assert.match(caddy, /Permissions-Policy "camera=\(self\), geolocation=\(\)"/);
  assert.ok(!caddy.includes("camera=*"));
});

test("the scanner closes the camera and sends nothing anywhere", () => {
  const scanner = read("../../frontend/src/mesa/QrScanner.tsx");
  assert.match(scanner, /getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
  assert.match(scanner, /return stop;/);
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|toDataURL|MediaRecorder|localStorage/.test(scanner), "the picture must stay on the phone");
});

test("the table screen only answers calls: it does not change orders or money", () => {
  const screen = read("../../frontend/src/mesa/TableDesk.tsx");
  assert.ok(!/updateOrder|setOrderStatus|confirmPayment|createOrder|deleteTable|createTable/.test(screen));
  assert.match(screen, /answerTableCall/);
  assert.match(screen, /rel="noopener noreferrer"/);
});

test("the panel wires the new screen for the same roles the menu uses", () => {
  const panel = read("../../frontend/src/service/AdminPanel.tsx");
  assert.match(panel, /\| "mesa"\r?\n/);
  assert.match(panel, /"mesa",\r?\n/);
  assert.match(panel, /view === "mesa" && \["OWNER", "MANAGER", "WAITER", "CASHIER"\]\.includes\(String\(currentUser\?\.role\)\)/);
});
