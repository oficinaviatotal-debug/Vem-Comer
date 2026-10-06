/**
 * Um "canvas de mentira" que anota o que foi desenhado (sem desenhar nada): serve para conferir,
 * pelo Node, onde cada desenho de logomarca pinta e se só usa as chamadas que todo celular entende.
 * Qualquer chamada que não está aqui (por exemplo roundRect, que celulares mais velhos não têm) dá erro.
 */
export function fakeCanvas() {
  let m = [1, 0, 0, 1, 0, 0];
  const stack = [];
  let clipped = false;
  let path = [];
  const painted = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const colors = new Set();
  const texts = [];
  const log = { fills: 0, strokes: 0 };

  const mul = (a, b) => [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
  const at = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const scaleOf = () => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
  const add = (x, y) => path.push(at(x, y));
  const grow = (points, pad) => {
    for (const [x, y] of points) {
      painted.minX = Math.min(painted.minX, x - pad);
      painted.maxX = Math.max(painted.maxX, x + pad);
      painted.minY = Math.min(painted.minY, y - pad);
      painted.maxY = Math.max(painted.maxY, y + pad);
    }
  };

  const state = { fillStyle: "#000000", strokeStyle: "#000000", lineWidth: 1, font: "10px sans-serif" };
  const sizeOfFont = () => Number(/(\d+(?:\.\d+)?)px/.exec(state.font)?.[1] ?? 10);

  const pen = {
    get fillStyle() { return state.fillStyle; },
    set fillStyle(v) { state.fillStyle = v; colors.add(String(v).toUpperCase()); },
    get strokeStyle() { return state.strokeStyle; },
    set strokeStyle(v) { state.strokeStyle = v; colors.add(String(v).toUpperCase()); },
    get lineWidth() { return state.lineWidth; },
    set lineWidth(v) { state.lineWidth = v; },
    get font() { return state.font; },
    set font(v) { state.font = v; },
    lineCap: "butt",
    lineJoin: "miter",
    textAlign: "start",
    textBaseline: "alphabetic",

    save() { stack.push([m.slice(), clipped, { ...state }]); },
    restore() { const top = stack.pop(); if (top) { [m, clipped] = [top[0], top[1]]; Object.assign(state, top[2]); } },
    translate(x, y) { m = mul(m, [1, 0, 0, 1, x, y]); },
    scale(x, y) { m = mul(m, [x, 0, 0, y, 0, 0]); },
    rotate(a) { m = mul(m, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]); },

    beginPath() { path = []; },
    closePath() {},
    moveTo(x, y) { add(x, y); },
    lineTo(x, y) { add(x, y); },
    arcTo(x1, y1, x2, y2) { add(x1, y1); add(x2, y2); },
    arc(x, y, r, a0, a1, anticlockwise = false) {
      let from = a0;
      let to = a1;
      if (!anticlockwise && to < from) to += Math.PI * 2;
      if (anticlockwise && to > from) to -= Math.PI * 2;
      for (let i = 0; i <= 24; i += 1) {
        const a = from + ((to - from) * i) / 24;
        add(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
    },
    ellipse(x, y, rx, ry, turn, a0, a1) {
      for (let i = 0; i <= 24; i += 1) {
        const a = a0 + ((a1 - a0) * i) / 24;
        const ex = Math.cos(a) * rx;
        const ey = Math.sin(a) * ry;
        add(x + ex * Math.cos(turn) - ey * Math.sin(turn), y + ex * Math.sin(turn) + ey * Math.cos(turn));
      }
    },
    bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
      const [x0, y0] = path.length ? path[path.length - 1] : at(0, 0);
      const inv = (px, py) => { const d = m[0] * m[3] - m[1] * m[2]; const dx = px - m[4]; const dy = py - m[5]; return [(m[3] * dx - m[2] * dy) / d, (-m[1] * dx + m[0] * dy) / d]; };
      const [sx, sy] = inv(x0, y0);
      for (let i = 1; i <= 12; i += 1) {
        const t = i / 12; const u = 1 - t;
        add(u ** 3 * sx + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t ** 3 * x, u ** 3 * sy + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t ** 3 * y);
      }
    },
    quadraticCurveTo(cx, cy, x, y) { add(cx, cy); add(x, y); },

    fill() { log.fills += 1; if (!clipped) grow(path, 0); },
    stroke() { log.strokes += 1; if (!clipped) grow(path, (state.lineWidth * scaleOf()) / 2); },
    clip() { grow(path, 0); clipped = true; },
    fillRect(x, y, w, h) { if (!clipped) grow([at(x, y), at(x + w, y + h)], 0); },
    clearRect() {},
    measureText(text) {
      const size = sizeOfFont();
      return { width: Array.from(text).length * size * 0.55, actualBoundingBoxAscent: size * 0.72, actualBoundingBoxDescent: 0 };
    },
    fillText(text, x, y) {
      const size = sizeOfFont();
      const [px, py] = at(x, y);
      texts.push({ text, x: px, y: py, size, width: Array.from(text).length * size * 0.55, align: pen.textAlign, baseline: pen.textBaseline });
    },
  };

  return { pen, painted, colors, texts, log };
}
